import { EffectDefinition, GameAction, GameEvent, GameState, PendingEffect, PlayerState, TileDefinition, TransactionEntry } from "@/lib/domain/types";
import { rollDice } from "@/lib/engine/dice";

function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

function appendEvent(events: GameEvent[], state: GameState, type: string, message: string, payload?: Record<string, unknown>) {
  events.push({
    id: crypto.randomUUID(),
    turnNumber: state.turnNumber,
    type,
    message,
    payload
  });
}

function appendTransaction(
  txns: TransactionEntry[],
  state: GameState,
  amount: number,
  reason: string,
  fromPlayerId?: string,
  toPlayerId?: string,
  metadata?: Record<string, unknown>
) {
  txns.push({
    id: crypto.randomUUID(),
    turnNumber: state.turnNumber,
    fromPlayerId,
    toPlayerId,
    amount,
    reason,
    metadata
  });
}

function getTile(state: GameState, index: number): TileDefinition {
  return state.board.tiles[index];
}

function getPlayerById(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getTileOwner(state: GameState, tile: TileDefinition): PlayerState | undefined {
  const ownerId = state.ownership[tile.id];
  if (!ownerId) {
    return undefined;
  }
  return getPlayerById(state, ownerId);
}

function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.bankrupt);
}

function maybeFinalizeWinner(state: GameState, events: GameEvent[]) {
  const alive = alivePlayers(state);
  if (alive.length === 1) {
    state.phase = "GAME_OVER";
    state.winnerPlayerId = alive[0].id;
    appendEvent(events, state, "GAME_OVER", `${alive[0].name} wins the game.`);
  }
}

function transferCash(
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

function maybeHandleBankruptcy(state: GameState, events: GameEvent[], playerId: string, creditorId?: string) {
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
    } else {
      delete state.ownership[tileId];
    }
  }

  player.properties = [];

  appendEvent(events, state, "BANKRUPTCY", `${player.name} is bankrupt.`);
}

function movePlayerBy(state: GameState, events: GameEvent[], player: PlayerState, steps: number) {
  const tileCount = state.board.tiles.length;
  const previous = player.position;
  const rawPosition = previous + steps;
  let next = rawPosition % tileCount;
  if (next < 0) {
    next += tileCount;
  }

  if (steps > 0 && rawPosition >= tileCount) {
    const passedGoCount = Math.floor(rawPosition / tileCount);
    const bonus = passedGoCount * state.board.rules.passGoAmount;
    player.cash += bonus;
    appendEvent(events, state, "PASS_GO", `${player.name} passed GO and collected $${bonus}.`);
  }

  player.position = next;
}

function sendToJail(state: GameState, events: GameEvent[], player: PlayerState) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  appendEvent(events, state, "JAIL", `${player.name} was sent to jail.`);
}

function propertyGroupOwnedCount(state: GameState, ownerId: string, type: "RAILROAD" | "UTILITY"): number {
  return state.board.tiles.filter((tile) => tile.type === type && state.ownership[tile.id] === ownerId).length;
}

function calculateRent(state: GameState, tile: TileDefinition, ownerId: string): number {
  if (tile.type === "RAILROAD") {
    const owned = propertyGroupOwnedCount(state, ownerId, "RAILROAD");
    return [25, 50, 100, 200][Math.max(0, Math.min(owned - 1, 3))];
  }

  if (tile.type === "UTILITY") {
    const owned = propertyGroupOwnedCount(state, ownerId, "UTILITY");
    const multiplier = owned >= 2 ? 10 : 4;
    return (state.lastRoll?.total ?? 7) * multiplier;
  }

  return tile.rents?.[0] ?? 0;
}

function startAuction(state: GameState, events: GameEvent[], tileIndex: number) {
  const decliningPlayer = getCurrentPlayer(state);
  const participants = state.players
    .filter((player) => player.id !== decliningPlayer.id && !player.bankrupt && player.cash > 0)
    .map((player) => player.id);

  state.auction = {
    tileIndex,
    minBid: 10,
    participants,
    bids: {}
  };
  state.phase = "AUCTION";

  const tile = getTile(state, tileIndex);
  appendEvent(events, state, "AUCTION_STARTED", `Auction started for ${tile.name}. ${decliningPlayer.name} cannot participate.`);
}

function enqueuePendingEffect(state: GameState, events: GameEvent[], player: PlayerState, pendingEffect: PendingEffect) {
  state.pendingEffect = pendingEffect;
  state.phase = "AWAITING_EFFECT_ACTIVATION";
  appendEvent(events, state, "EFFECT_READY", `${player.name} can activate: ${pendingEffect.cardText}`);
}

function enqueueCardEffect(state: GameState, events: GameEvent[], player: PlayerState, deckType: "CHANCE" | "COMMUNITY_CHEST", tileIndex: number) {
  if (deckType === "CHANCE") {
    const idx = state.chancePointer % state.board.chanceDeck.length;
    const card = state.board.chanceDeck[idx];
    state.chancePointer += 1;
    appendEvent(events, state, "CARD_DRAW", `${player.name} drew Chance: ${card.text}`);
    enqueuePendingEffect(state, events, player, {
      tileIndex,
      tileType: "CHANCE",
      cardText: card.text,
      cardId: card.id,
      deck: "CHANCE",
      effect: card.effect
    });
    return;
  }

  const idx = state.communityPointer % state.board.communityChestDeck.length;
  const card = state.board.communityChestDeck[idx];
  state.communityPointer += 1;
  appendEvent(events, state, "CARD_DRAW", `${player.name} drew Community Chest: ${card.text}`);
  enqueuePendingEffect(state, events, player, {
    tileIndex,
    tileType: "COMMUNITY_CHEST",
    cardText: card.text,
    cardId: card.id,
    deck: "COMMUNITY_CHEST",
    effect: card.effect
  });
}

function resolveCardEffect(
  state: GameState,
  events: GameEvent[],
  txns: TransactionEntry[],
  player: PlayerState,
  card: { id: string; text: string; effect: EffectDefinition },
  depth: number
) {
  const effect = card.effect;

  if (effect.type === "GAIN_MONEY") {
    transferCash(state, events, txns, effect.amount, `Card reward: ${card.text}`, undefined, player.id);
    return;
  }

  if (effect.type === "PAY_MONEY") {
    transferCash(state, events, txns, effect.amount, `Card penalty: ${card.text}`, player.id, undefined);
    return;
  }

  if (effect.type === "MOVE_TO") {
    const previous = player.position;
    if (effect.collectGo || effect.tileIndex < previous) {
      player.cash += state.board.rules.passGoAmount;
      appendEvent(events, state, "PASS_GO", `${player.name} collected $${state.board.rules.passGoAmount} from GO.`);
    }
    player.position = effect.tileIndex;
    resolveLanding(state, events, txns, player, depth + 1);
    return;
  }

  if (effect.type === "MOVE_BY") {
    movePlayerBy(state, events, player, effect.steps);
    resolveLanding(state, events, txns, player, depth + 1);
    return;
  }

  if (effect.type === "GO_TO_JAIL") {
    sendToJail(state, events, player);
    state.phase = "AWAITING_END_TURN";
    return;
  }

  if (effect.type === "COLLECT_FROM_PLAYERS") {
    for (const other of state.players) {
      if (other.id === player.id || other.bankrupt) {
        continue;
      }
      transferCash(state, events, txns, effect.amountPerPlayer, `Card transfer: ${card.text}`, other.id, player.id);
    }
    return;
  }

  if (effect.type === "PAY_EACH_PLAYER") {
    for (const other of state.players) {
      if (other.id === player.id || other.bankrupt) {
        continue;
      }
      transferCash(state, events, txns, effect.amountPerPlayer, `Card transfer: ${card.text}`, player.id, other.id);
    }
    return;
  }

  if (effect.type === "GET_OUT_OF_JAIL") {
    player.getOutOfJailCards += 1;
    appendEvent(events, state, "CARD_EFFECT", `${player.name} gained a Get Out of Jail card.`);
    return;
  }
}

function resolveLanding(
  state: GameState,
  events: GameEvent[],
  txns: TransactionEntry[],
  player: PlayerState,
  depth = 0
): void {
  if (depth > 4 || state.phase === "GAME_OVER" || player.bankrupt) {
    return;
  }

  const tile = getTile(state, player.position);
  appendEvent(events, state, "LAND", `${player.name} landed on ${tile.name}.`, {
    tileIndex: tile.index,
    tileType: tile.type
  });

  if (tile.type === "PROPERTY" || tile.type === "RAILROAD" || tile.type === "UTILITY") {
    const owner = getTileOwner(state, tile);
    if (!owner) {
      state.pendingPurchase = {
        tileIndex: tile.index,
        price: tile.price ?? 0
      };
      state.phase = "AWAITING_PURCHASE_DECISION";
      appendEvent(events, state, "PROPERTY_AVAILABLE", `${tile.name} is available for $${tile.price ?? 0}.`);
      return;
    }

    if (owner.id !== player.id && !owner.bankrupt) {
      const rent = calculateRent(state, tile, owner.id);
      state.pendingRent = {
        tileIndex: tile.index,
        tileId: tile.id,
        ownerPlayerId: owner.id,
        amount: rent
      };
      state.phase = "AWAITING_RENT_PAYMENT";
      appendEvent(events, state, "RENT_DUE", `${player.name} owes $${rent} rent to ${owner.name}.`);
    }
    return;
  }

  if (tile.type === "TAX") {
    const amount = tile.taxAmount ?? 0;
    transferCash(state, events, txns, amount, `${tile.name} tax`, player.id, undefined);
    appendEvent(events, state, "TAX", `${player.name} paid tax of $${amount}.`);
    return;
  }

  if (tile.type === "CHANCE") {
    enqueueCardEffect(state, events, player, "CHANCE", tile.index);
    return;
  }

  if (tile.type === "COMMUNITY_CHEST") {
    enqueueCardEffect(state, events, player, "COMMUNITY_CHEST", tile.index);
    return;
  }

  if (tile.type === "GO_TO_JAIL") {
    enqueuePendingEffect(state, events, player, {
      tileIndex: tile.index,
      tileType: "GO_TO_JAIL",
      cardText: "Go directly to Jail. Do not pass GO.",
      effect: { type: "GO_TO_JAIL" }
    });
  }
}

function resolvePostRollPhase(state: GameState, events: GameEvent[], player: PlayerState) {
  if (
    state.phase === "AWAITING_EFFECT_ACTIVATION" ||
    state.phase === "AWAITING_RENT_PAYMENT" ||
    state.phase === "AWAITING_PURCHASE_DECISION" ||
    state.phase === "AUCTION" ||
    state.phase === "GAME_OVER"
  ) {
    return;
  }

  if (player.bankrupt) {
    state.phase = "AWAITING_END_TURN";
    return;
  }

  if (state.lastRoll?.isDouble && !player.inJail) {
    state.phase = "AWAITING_ROLL";
    appendEvent(events, state, "DOUBLE_ROLL", `${player.name} rolled doubles and gets another roll.`);
    return;
  }

  state.phase = "AWAITING_END_TURN";
}

function resolveRollAction(state: GameState, events: GameEvent[], txns: TransactionEntry[], forcedDice?: [number, number]) {
  if (state.phase !== "AWAITING_ROLL") {
    throw new Error("Cannot roll dice in current phase.");
  }

  const player = getCurrentPlayer(state);
  if (player.bankrupt) {
    throw new Error("Bankrupt players cannot act.");
  }
  state.pendingEffect = undefined;

  const roll = rollDice(forcedDice);
  state.lastRoll = roll;
  appendEvent(events, state, "DICE_ROLL", `${player.name} rolled ${roll.dieOne} + ${roll.dieTwo} = ${roll.total}.`);

  if (player.inJail) {
    if (player.getOutOfJailCards > 0) {
      player.getOutOfJailCards -= 1;
      player.inJail = false;
      player.jailTurns = 0;
      appendEvent(events, state, "JAIL_EXIT", `${player.name} used a Get Out of Jail card.`);
    } else if (roll.isDouble) {
      player.inJail = false;
      player.jailTurns = 0;
      appendEvent(events, state, "JAIL_EXIT", `${player.name} rolled doubles and left jail.`);
    } else {
      player.jailTurns += 1;
      if (player.jailTurns >= 3) {
        transferCash(state, events, txns, state.board.rules.jailFine, "Jail fine", player.id, undefined);
        player.inJail = false;
        player.jailTurns = 0;
        appendEvent(events, state, "JAIL_FINE", `${player.name} paid $${state.board.rules.jailFine} to leave jail.`);
      } else {
        state.phase = "AWAITING_END_TURN";
        appendEvent(events, state, "JAIL_STAY", `${player.name} remains in jail.`);
        return;
      }
    }
  }

  movePlayerBy(state, events, player, roll.total);
  resolveLanding(state, events, txns, player);
  maybeFinalizeWinner(state, events);
  resolvePostRollPhase(state, events, player);
}

function resolvePayRentAction(state: GameState, events: GameEvent[], txns: TransactionEntry[]) {
  if (state.phase !== "AWAITING_RENT_PAYMENT" || !state.pendingRent) {
    throw new Error("No rent payment is pending.");
  }

  const player = getCurrentPlayer(state);
  const owner = getPlayerById(state, state.pendingRent.ownerPlayerId);
  const tile = getTile(state, state.pendingRent.tileIndex);
  if (!owner || owner.bankrupt) {
    state.pendingRent = undefined;
    state.phase = state.lastRoll?.isDouble ? "AWAITING_ROLL" : "AWAITING_END_TURN";
    return;
  }

  transferCash(state, events, txns, state.pendingRent.amount, `Rent payment for ${tile.name}`, player.id, owner.id);
  appendEvent(events, state, "RENT", `${player.name} paid $${state.pendingRent.amount} rent to ${owner.name}.`);
  state.pendingRent = undefined;
  if (!state.winnerPlayerId) {
    state.phase = state.lastRoll?.isDouble ? "AWAITING_ROLL" : "AWAITING_END_TURN";
  }
  if (!state.winnerPlayerId && state.lastRoll?.isDouble && !player.inJail) {
    appendEvent(events, state, "DOUBLE_ROLL", `${player.name} rolled doubles and gets another roll.`);
  }
}

function resolveActivateTileEffectAction(state: GameState, events: GameEvent[], txns: TransactionEntry[]) {
  if (state.phase !== "AWAITING_EFFECT_ACTIVATION" || !state.pendingEffect) {
    throw new Error("No tile effect is pending.");
  }

  const player = getCurrentPlayer(state);
  const pendingEffect = state.pendingEffect;
  state.pendingEffect = undefined;
  state.phase = "AWAITING_END_TURN";

  appendEvent(events, state, "EFFECT_ACTIVATED", `${player.name} activated: ${pendingEffect.cardText}`);
  resolveCardEffect(
    state,
    events,
    txns,
    player,
    {
      id: pendingEffect.cardId ?? `tile-effect-${pendingEffect.tileIndex}`,
      text: pendingEffect.cardText,
      effect: pendingEffect.effect
    },
    0
  );

  maybeFinalizeWinner(state, events);
  resolvePostRollPhase(state, events, player);
}

function resolvePurchaseAction(state: GameState, events: GameEvent[], txns: TransactionEntry[]) {
  if (state.phase !== "AWAITING_PURCHASE_DECISION" || !state.pendingPurchase) {
    throw new Error("No property purchase is pending.");
  }

  const player = getCurrentPlayer(state);
  const tile = getTile(state, state.pendingPurchase.tileIndex);
  const price = state.pendingPurchase.price;

  if (player.cash < price) {
    appendEvent(events, state, "PURCHASE_SKIPPED", `${player.name} cannot afford ${tile.name}.`);
    state.pendingPurchase = undefined;
    if (state.board.rules.auctionEnabled) {
      startAuction(state, events, tile.index);
    } else {
      state.phase = state.lastRoll?.isDouble ? "AWAITING_ROLL" : "AWAITING_END_TURN";
    }
    return;
  }

  transferCash(state, events, txns, price, `Purchase: ${tile.name}`, player.id, undefined);
  state.ownership[tile.id] = player.id;
  player.properties.push(tile.id);
  state.pendingPurchase = undefined;

  appendEvent(events, state, "PROPERTY_PURCHASED", `${player.name} purchased ${tile.name} for $${price}.`);
  state.phase = state.lastRoll?.isDouble ? "AWAITING_ROLL" : "AWAITING_END_TURN";
  if (state.lastRoll?.isDouble && !player.inJail) {
    appendEvent(events, state, "DOUBLE_ROLL", `${player.name} rolled doubles and gets another roll.`);
  }
}

function resolveDeclineAction(state: GameState, events: GameEvent[]) {
  if (state.phase !== "AWAITING_PURCHASE_DECISION" || !state.pendingPurchase) {
    throw new Error("No property purchase is pending.");
  }

  const player = getCurrentPlayer(state);
  const tile = getTile(state, state.pendingPurchase.tileIndex);
  appendEvent(events, state, "PROPERTY_DECLINED", `${player.name} declined to buy ${tile.name}.`);

  const tileIndex = state.pendingPurchase.tileIndex;
  state.pendingPurchase = undefined;

  if (state.board.rules.auctionEnabled) {
    startAuction(state, events, tileIndex);
    return;
  }

  state.phase = state.lastRoll?.isDouble ? "AWAITING_ROLL" : "AWAITING_END_TURN";
  if (state.lastRoll?.isDouble && !player.inJail) {
    appendEvent(events, state, "DOUBLE_ROLL", `${player.name} rolled doubles and gets another roll.`);
  }
}

function resolvePlaceAuctionBidAction(state: GameState, events: GameEvent[], playerId: string, amount: number) {
  if (state.phase !== "AUCTION" || !state.auction) {
    throw new Error("No auction in progress.");
  }

  if (!state.auction.participants.includes(playerId)) {
    throw new Error("Player is not eligible to bid in this auction.");
  }

  const bidder = getPlayerById(state, playerId);
  if (!bidder || bidder.bankrupt) {
    throw new Error("Invalid bidder.");
  }

  if (amount > bidder.cash) {
    throw new Error("Bid exceeds available cash.");
  }

  state.auction.bids[playerId] = amount;
  appendEvent(events, state, "AUCTION_BID", `${bidder.name} submitted a bid of $${amount}.`);
}

function resolveAuctionAction(state: GameState, events: GameEvent[], txns: TransactionEntry[]) {
  if (state.phase !== "AUCTION" || !state.auction) {
    throw new Error("No auction in progress.");
  }

  const tile = getTile(state, state.auction.tileIndex);
  let winner: PlayerState | undefined;
  let winningBid = 0;

  for (const participantId of state.auction.participants) {
    const player = getPlayerById(state, participantId);
    if (!player || player.bankrupt) {
      continue;
    }

    const offered = state.auction.bids[participantId] ?? 0;
    if (offered < state.auction.minBid || offered > player.cash) {
      continue;
    }

    state.auction.bids[participantId] = offered;

    if (offered > winningBid) {
      winningBid = offered;
      winner = player;
    }
  }

  if (winner && winningBid > 0) {
    transferCash(state, events, txns, winningBid, `Auction win: ${tile.name}`, winner.id, undefined);
    state.ownership[tile.id] = winner.id;
    winner.properties.push(tile.id);
    appendEvent(events, state, "AUCTION_WON", `${winner.name} won the auction for ${tile.name} at $${winningBid}.`);
  } else {
    appendEvent(events, state, "AUCTION_NO_BID", `No valid bids for ${tile.name}. Property remains unowned.`);
  }

  state.auction = undefined;
  state.phase = state.lastRoll?.isDouble ? "AWAITING_ROLL" : "AWAITING_END_TURN";
  const currentPlayer = getCurrentPlayer(state);
  if (state.lastRoll?.isDouble && !currentPlayer.inJail) {
    appendEvent(events, state, "DOUBLE_ROLL", `${currentPlayer.name} rolled doubles and gets another roll.`);
  }
  maybeFinalizeWinner(state, events);
}

function resolveEndTurnAction(state: GameState, events: GameEvent[]) {
  if (state.phase !== "AWAITING_END_TURN") {
    throw new Error("Cannot end turn in current phase.");
  }

  maybeFinalizeWinner(state, events);
  if (state.winnerPlayerId) {
    return;
  }

  const totalPlayers = state.players.length;
  let attempts = 0;
  let nextIndex = state.currentPlayerIndex;

  while (attempts < totalPlayers) {
    nextIndex = (nextIndex + 1) % totalPlayers;
    if (!state.players[nextIndex].bankrupt) {
      break;
    }
    attempts += 1;
  }

  state.currentPlayerIndex = nextIndex;
  state.turnNumber += 1;
  state.phase = "AWAITING_ROLL";
  state.lastRoll = undefined;
  state.pendingPurchase = undefined;
  state.pendingEffect = undefined;
  state.pendingRent = undefined;
  state.auction = undefined;

  appendEvent(events, state, "TURN_START", `Turn ${state.turnNumber}: ${state.players[nextIndex].name} to play.`);
}

export function applyGameAction(currentState: GameState, action: GameAction) {
  const state = structuredClone(currentState) as GameState;
  const events: GameEvent[] = [];
  const transactions: TransactionEntry[] = [];

  if (state.phase === "AWAITING_EFFECT_ACTIVATION" && !state.pendingEffect) {
    state.phase = "AWAITING_END_TURN";
  }

  if (state.phase === "GAME_OVER") {
    throw new Error("Game is over.");
  }

  if (action.type === "ROLL_DICE") {
    resolveRollAction(state, events, transactions, action.forcedDice);
  } else if (action.type === "ACTIVATE_TILE_EFFECT") {
    resolveActivateTileEffectAction(state, events, transactions);
  } else if (action.type === "PAY_RENT") {
    resolvePayRentAction(state, events, transactions);
  } else if (action.type === "PLACE_AUCTION_BID") {
    resolvePlaceAuctionBidAction(state, events, action.playerId, action.amount);
  } else if (action.type === "PURCHASE_PROPERTY") {
    resolvePurchaseAction(state, events, transactions);
  } else if (action.type === "DECLINE_PROPERTY") {
    resolveDeclineAction(state, events);
  } else if (action.type === "RESOLVE_AUCTION") {
    resolveAuctionAction(state, events, transactions);
  } else if (action.type === "END_TURN") {
    resolveEndTurnAction(state, events);
  }

  state.logs.push(...events);
  state.transactions.push(...transactions);

  return {
    state,
    newEvents: events,
    newTransactions: transactions
  };
}
