import { GameEvent, GameState, TileDefinition, TransactionEntry } from "@/lib/domain/types";
import { alivePlayers, appendEvent, appendTransaction, getPlayerById } from "@/lib/engine/common";

export function maybeFinalizeWinner(state: GameState, events: GameEvent[]) {
  const alive = alivePlayers(state);
  if (alive.length === 1) {
    state.phase = "GAME_OVER";
    state.winnerPlayerId = alive[0].id;
    appendEvent(events, state, "GAME_OVER", `${alive[0].name} wins the game.`);
  }
}

export function maybeHandleBankruptcy(state: GameState, events: GameEvent[], playerId: string, creditorId?: string) {
  const player = getPlayerById(state, playerId);
  if (!player || player.bankrupt || player.cash >= state.board.rules.bankruptcyFloor) {
    return;
  }

  player.bankrupt = true;
  player.inJail = false;
  player.jailTurns = 0;
  player.cash = 0;

  const creditor = creditorId ? getPlayerById(state, creditorId) : undefined;

  for (const tileId of player.properties) {
    if (creditor && !creditor.bankrupt) {
      state.ownership[tileId] = creditor.id;
      creditor.properties.push(tileId);
      if (!state.propertyHouses[tileId]) {
        state.propertyHouses[tileId] = 1;
      }
    } else {
      delete state.ownership[tileId];
      delete state.propertyHouses[tileId];
    }
  }

  player.properties = [];
  state.pendingTrades = state.pendingTrades.filter((trade) => trade.fromPlayerId !== player.id && trade.toPlayerId !== player.id);
  appendEvent(events, state, "BANKRUPTCY", `${player.name} is bankrupt.`);
}

export function transferCash(
  state: GameState,
  events: GameEvent[],
  txns: TransactionEntry[],
  amount: number,
  reason: string,
  fromPlayerId?: string,
  toPlayerId?: string
) {
  if (amount <= 0) {
    return;
  }

  const fromPlayer = fromPlayerId ? getPlayerById(state, fromPlayerId) : undefined;
  const toPlayer = toPlayerId ? getPlayerById(state, toPlayerId) : undefined;

  if (fromPlayer && !fromPlayer.bankrupt) {
    fromPlayer.cash -= amount;
  }

  if (toPlayer && !toPlayer.bankrupt) {
    toPlayer.cash += amount;
  }

  appendTransaction(txns, state, amount, reason, fromPlayerId, toPlayerId);

  if (fromPlayer) {
    maybeHandleBankruptcy(state, events, fromPlayer.id, toPlayerId);
  }

  maybeFinalizeWinner(state, events);
}

export function getHouseCost(tile: TileDefinition): number {
  if (tile.houseCost && tile.houseCost > 0) {
    return tile.houseCost;
  }

  const group = tile.colorGroup?.toUpperCase() ?? "";
  if (group === "BROWN" || group === "LIGHT_BLUE") {
    return 50;
  }
  if (group === "PINK" || group === "ORANGE") {
    return 100;
  }
  if (group === "RED" || group === "YELLOW") {
    return 150;
  }
  return 200;
}

function propertyGroupOwnedCount(state: GameState, ownerId: string, type: "RAILROAD" | "UTILITY"): number {
  return state.board.tiles.filter((tile) => tile.type === type && state.ownership[tile.id] === ownerId).length;
}

function ownsFullColorGroup(state: GameState, ownerId: string, colorGroup?: string): boolean {
  if (!colorGroup) {
    return false;
  }

  const groupKey = colorGroup.trim().toUpperCase();
  const groupTiles = state.board.tiles.filter(
    (tile) => tile.type === "PROPERTY" && tile.colorGroup?.trim().toUpperCase() === groupKey
  );

  if (groupTiles.length === 0) {
    return false;
  }

  return groupTiles.every((tile) => state.ownership[tile.id] === ownerId);
}

export function calculateRent(state: GameState, tile: TileDefinition, ownerId: string): number {
  if (tile.type === "RAILROAD") {
    const owned = propertyGroupOwnedCount(state, ownerId, "RAILROAD");
    return [25, 50, 100, 200][Math.max(0, Math.min(owned - 1, 3))];
  }

  if (tile.type === "UTILITY") {
    const owned = propertyGroupOwnedCount(state, ownerId, "UTILITY");
    const multiplier = owned >= 2 ? 10 : 4;
    return (state.lastRoll?.total ?? 7) * multiplier;
  }

  const houses = Math.max(1, state.propertyHouses[tile.id] ?? 1);
  if (!tile.rents || tile.rents.length === 0) {
    return 0;
  }
  if (tile.rents.length === 1) {
    return tile.rents[0];
  }
  const index = Math.min(houses, tile.rents.length - 1);
  const baseRent = tile.rents[index];
  if (ownsFullColorGroup(state, ownerId, tile.colorGroup)) {
    return baseRent * 2;
  }
  return baseRent;
}
