import { BoardSource, GameStatus, Prisma } from "@prisma/client";
import { createDefaultBoardConfig } from "@/lib/board/defaultBoard";
import { houseCostFromTile } from "@/lib/board/display";
import { actionRequestSchema, boardSchema, gameStateSchema } from "@/lib/domain/schemas";
import { BoardDefinition, GameAction } from "@/lib/domain/types";
import { createInitialGameState } from "@/lib/engine/gameFactory";
import { applyGameAction } from "@/lib/engine/gameEngine";
import { prisma } from "@/lib/services/prisma";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function randomToken(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
}

export async function ensureDefaultBoardConfig() {
  const existing = await prisma.boardConfig.findFirst({ where: { source: BoardSource.DEFAULT } });
  if (existing) {
    return existing;
  }

  const board = createDefaultBoardConfig();
  return createBoardConfig({
    name: board.name,
    source: BoardSource.DEFAULT,
    board
  });
}

export async function createBoardConfig(input: { name: string; source: BoardSource; board: BoardDefinition }) {
  const parsedBoard = boardSchema.parse(input.board);

  const created = await prisma.boardConfig.create({
    data: {
      name: input.name,
      source: input.source,
      data: toJsonValue(parsedBoard)
    }
  });

  const propertyRows = parsedBoard.tiles
    .filter((tile) => tile.type === "PROPERTY" || tile.type === "RAILROAD" || tile.type === "UTILITY")
    .map((tile) => ({
      boardConfigId: created.id,
      tileIndex: tile.index,
      name: tile.name,
      tileType: tile.type,
      colorGroup: tile.colorGroup,
      price: tile.price,
      rents: tile.rents ? toJsonValue(tile.rents) : Prisma.JsonNull
    }));

  if (propertyRows.length > 0) {
    await prisma.propertyDefinition.createMany({ data: propertyRows });
  }

  const chanceRows = parsedBoard.chanceDeck.map((card) => ({
    boardConfigId: created.id,
    deckType: "CHANCE" as const,
    name: card.id,
    text: card.text,
    effect: toJsonValue(card.effect)
  }));

  const chestRows = parsedBoard.communityChestDeck.map((card) => ({
    boardConfigId: created.id,
    deckType: "COMMUNITY_CHEST" as const,
    name: card.id,
    text: card.text,
    effect: toJsonValue(card.effect)
  }));

  await prisma.parsedCard.createMany({ data: [...chanceRows, ...chestRows] });

  return created;
}

export async function listBoardConfigs() {
  return prisma.boardConfig.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function createGameFromBoard(input: {
  gameName: string;
  boardConfigId: string;
  players: Array<{ name: string; token: string }>;
}) {
  const boardConfig = await prisma.boardConfig.findUnique({ where: { id: input.boardConfigId } });
  if (!boardConfig) {
    throw new Error("Board config not found.");
  }

  const board = boardSchema.parse(boardConfig.data);

  const game = await prisma.game.create({
    data: {
      name: input.gameName,
      boardConfigId: boardConfig.id,
      status: GameStatus.SETUP,
      state: toJsonValue({})
    }
  });

  const createdPlayers = await Promise.all(
    input.players.map((player, index) =>
      prisma.player.create({
        data: {
          gameId: game.id,
          name: player.name,
          token: player.token,
          seatOrder: index,
          accessToken: randomToken("player")
        }
      })
    )
  );

  const initialState = createInitialGameState({
    name: input.gameName,
    board,
    players: createdPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      token: player.token,
      accessToken: player.accessToken
    }))
  });
  initialState.id = game.id;

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: GameStatus.IN_PROGRESS,
      state: toJsonValue(initialState)
    }
  });

  return {
    gameId: game.id,
    players: createdPlayers
  };
}

export async function getGameState(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { seatOrder: "asc" }
      }
    }
  });

  if (!game) {
    return null;
  }

  const state = gameStateSchema.parse(game.state);

  return {
    game,
    state
  };
}

export async function applyActionToGame(gameId: string, rawAction: unknown) {
  const parsedAction = actionRequestSchema.parse(rawAction) as GameAction;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    throw new Error("Game not found.");
  }

  const currentState = gameStateSchema.parse(game.state);
  const result = applyGameAction(currentState, parsedAction);
  const snapshotState = {
    ...result.state,
    logs: result.state.logs.slice(-200),
    transactions: result.state.transactions.slice(-200)
  };

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: game.id },
      data: {
        state: toJsonValue(snapshotState),
        status: result.state.phase === "GAME_OVER" ? GameStatus.FINISHED : GameStatus.IN_PROGRESS
      }
    });

    await tx.turn.create({
      data: {
        gameId,
        turnNumber: result.state.turnNumber,
        playerId: result.state.players[result.state.currentPlayerIndex].id,
        phase: parsedAction.type,
        diceOne: result.state.lastRoll?.dieOne,
        diceTwo: result.state.lastRoll?.dieTwo
      }
    });

    if (result.newTransactions.length > 0) {
      await tx.transaction.createMany({
        data: result.newTransactions.map((entry) => ({
          gameId,
          turnNumber: entry.turnNumber,
          fromPlayerId: entry.fromPlayerId,
          toPlayerId: entry.toPlayerId,
          amount: entry.amount,
          reason: entry.reason,
          metadata: entry.metadata ? toJsonValue(entry.metadata) : Prisma.JsonNull
        }))
      });
    }

    if (result.newEvents.length > 0) {
      await tx.gameLog.createMany({
        data: result.newEvents.map((entry) => ({
          gameId,
          turnNumber: entry.turnNumber,
          eventType: entry.type,
          message: entry.message,
          payload: entry.payload ? toJsonValue(entry.payload) : Prisma.JsonNull
        }))
      });
    }
  });

  return result.state;
}

export async function getPlayerSession(token: string) {
  const player = await prisma.player.findUnique({
    where: { accessToken: token },
    include: {
      game: true
    }
  });

  if (!player) {
    return null;
  }

  const state = gameStateSchema.parse(player.game.state);
  const playerState = state.players.find((candidate) => candidate.id === player.id);
  if (!playerState) {
    throw new Error("Player state not found in game snapshot.");
  }

  const isPlayersTurn = state.players[state.currentPlayerIndex].id === player.id;

  const canBidAuction = state.phase === "AUCTION" && Boolean(state.auction?.participants.includes(player.id));
  const canProposeTrade = !playerState.bankrupt;
  const canRespondTrade = !playerState.bankrupt && state.pendingTrades.some((trade) => trade.toPlayerId === player.id);
  const canPayJailFine =
    isPlayersTurn && state.phase === "AWAITING_ROLL" && playerState.inJail && playerState.cash >= state.board.rules.jailFine;
  const canUseGetOutOfJailCard =
    isPlayersTurn && state.phase === "AWAITING_ROLL" && playerState.inJail && playerState.getOutOfJailCards > 0;
  const canBuildHouse =
    isPlayersTurn &&
    state.phase === "AWAITING_END_TURN" &&
    playerState.properties.some((tileId) => {
      const tile = state.board.tiles.find((candidate) => candidate.id === tileId);
      if (!tile || tile.type !== "PROPERTY") {
        return false;
      }
      const currentHouses = state.propertyHouses?.[tile.id] ?? 1;
      if (currentHouses >= 5) {
        return false;
      }
      return playerState.cash >= houseCostFromTile(tile);
    });

  return {
    gameId: player.gameId,
    player,
    state,
    playerState,
    availableActions: isPlayersTurn
      ? {
          canRoll: state.phase === "AWAITING_ROLL",
          canProposeTrade,
          canRespondTrade,
          canPayJailFine,
          canUseGetOutOfJailCard,
          canActivateEffect: state.phase === "AWAITING_EFFECT_ACTIVATION",
          canPayRent: state.phase === "AWAITING_RENT_PAYMENT",
          canBuy: state.phase === "AWAITING_PURCHASE_DECISION",
          canDecline: state.phase === "AWAITING_PURCHASE_DECISION",
          canBidAuction,
          canBuildHouse,
          canEndTurn: state.phase === "AWAITING_END_TURN"
        }
      : {
          canRoll: false,
          canProposeTrade,
          canRespondTrade,
          canPayJailFine: false,
          canUseGetOutOfJailCard: false,
          canActivateEffect: false,
          canPayRent: false,
          canBuy: false,
          canDecline: false,
          canBidAuction,
          canBuildHouse: false,
          canEndTurn: false
        }
  };
}
