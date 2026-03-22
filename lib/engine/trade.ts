import { GameEvent, GameState, TradeOffer, TransactionEntry } from "@/lib/domain/types";
import { appendEvent, getPlayerById, transferTile, uniqueIds } from "@/lib/engine/common";
import { transferCash } from "@/lib/engine/economy";
import { normalizeTradeValues } from "@/lib/engine/validators";

type TradeInput = {
  fromPlayerId: string;
  toPlayerId: string;
  offeredCash: number;
  requestedCash: number;
  offeredTileIds: string[];
  requestedTileIds: string[];
};

function resolveTradeParties(state: GameState, trade: Pick<TradeOffer, "fromPlayerId" | "toPlayerId">) {
  const fromPlayer = getPlayerById(state, trade.fromPlayerId);
  const toPlayer = getPlayerById(state, trade.toPlayerId);
  if (!fromPlayer || !toPlayer) {
    throw new Error("Invalid trade participants.");
  }
  if (fromPlayer.bankrupt || toPlayer.bankrupt) {
    throw new Error("Bankrupt players cannot trade.");
  }
  return { fromPlayer, toPlayer };
}

export function resolveProposeTradeAction(state: GameState, events: GameEvent[], tradeInput: TradeInput) {
  const offeredTileIds = uniqueIds(tradeInput.offeredTileIds);
  const requestedTileIds = uniqueIds(tradeInput.requestedTileIds);
  const { offeredCash, requestedCash } = normalizeTradeValues({
    ...tradeInput,
    offeredTileIds,
    requestedTileIds
  });

  const { fromPlayer, toPlayer } = resolveTradeParties(state, tradeInput);

  if (fromPlayer.cash < offeredCash) {
    throw new Error("Insufficient cash for trade offer.");
  }

  for (const tileId of offeredTileIds) {
    if (state.ownership[tileId] !== fromPlayer.id) {
      throw new Error("You can only offer properties you own.");
    }
  }

  for (const tileId of requestedTileIds) {
    if (state.ownership[tileId] !== toPlayer.id) {
      throw new Error("You can only request properties owned by the recipient.");
    }
  }

  const trade: TradeOffer = {
    id: crypto.randomUUID(),
    fromPlayerId: fromPlayer.id,
    toPlayerId: toPlayer.id,
    offeredCash,
    requestedCash,
    offeredTileIds,
    requestedTileIds,
    createdAtTurn: state.turnNumber
  };
  state.pendingTrades.push(trade);

  appendEvent(events, state, "TRADE_PROPOSED", `${fromPlayer.name} proposed a trade to ${toPlayer.name}.`);
}

export function resolveAcceptTradeAction(state: GameState, events: GameEvent[], txns: TransactionEntry[], tradeId: string, playerId: string) {
  const trade = state.pendingTrades.find((entry) => entry.id === tradeId);
  if (!trade) {
    throw new Error("Trade not found.");
  }

  if (trade.toPlayerId !== playerId) {
    throw new Error("Only the recipient can accept this trade.");
  }

  const { fromPlayer, toPlayer } = resolveTradeParties(state, trade);

  if (fromPlayer.cash < trade.offeredCash) {
    throw new Error("Trade proposer no longer has enough cash.");
  }

  if (toPlayer.cash < trade.requestedCash) {
    throw new Error("Trade recipient no longer has enough cash.");
  }

  for (const tileId of trade.offeredTileIds) {
    if (state.ownership[tileId] !== fromPlayer.id) {
      throw new Error("Trade proposer no longer owns all offered properties.");
    }
  }

  for (const tileId of trade.requestedTileIds) {
    if (state.ownership[tileId] !== toPlayer.id) {
      throw new Error("Trade recipient no longer owns all requested properties.");
    }
  }

  if (trade.offeredCash > 0) {
    transferCash(state, events, txns, trade.offeredCash, "Trade cash offer", fromPlayer.id, toPlayer.id);
  }

  if (trade.requestedCash > 0) {
    transferCash(state, events, txns, trade.requestedCash, "Trade cash request", toPlayer.id, fromPlayer.id);
  }

  for (const tileId of trade.offeredTileIds) {
    transferTile(state, tileId, fromPlayer, toPlayer);
  }

  for (const tileId of trade.requestedTileIds) {
    transferTile(state, tileId, toPlayer, fromPlayer);
  }

  state.pendingTrades = state.pendingTrades.filter((entry) => entry.id !== tradeId);
  appendEvent(events, state, "TRADE_ACCEPTED", `${toPlayer.name} accepted a trade from ${fromPlayer.name}.`);
}

export function resolveRejectTradeAction(state: GameState, events: GameEvent[], tradeId: string, playerId: string) {
  const trade = state.pendingTrades.find((entry) => entry.id === tradeId);
  if (!trade) {
    throw new Error("Trade not found.");
  }

  if (trade.toPlayerId !== playerId) {
    throw new Error("Only the recipient can reject this trade.");
  }

  state.pendingTrades = state.pendingTrades.filter((entry) => entry.id !== tradeId);
  const fromPlayer = getPlayerById(state, trade.fromPlayerId);
  const toPlayer = getPlayerById(state, trade.toPlayerId);
  appendEvent(
    events,
    state,
    "TRADE_REJECTED",
    `${toPlayer?.name ?? "Player"} rejected a trade from ${fromPlayer?.name ?? "player"}.`
  );
}

export function resolveCancelTradeAction(state: GameState, events: GameEvent[], tradeId: string, playerId: string) {
  const trade = state.pendingTrades.find((entry) => entry.id === tradeId);
  if (!trade) {
    throw new Error("Trade not found.");
  }

  if (trade.fromPlayerId !== playerId) {
    throw new Error("Only the proposer can cancel this trade.");
  }

  state.pendingTrades = state.pendingTrades.filter((entry) => entry.id !== tradeId);
  const fromPlayer = getPlayerById(state, trade.fromPlayerId);
  const toPlayer = getPlayerById(state, trade.toPlayerId);
  appendEvent(
    events,
    state,
    "TRADE_CANCELED",
    `${fromPlayer?.name ?? "Player"} canceled a trade with ${toPlayer?.name ?? "player"}.`
  );
}
