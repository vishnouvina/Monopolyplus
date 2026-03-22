import { describe, expect, test, vi } from "vitest";
import { createDefaultBoardConfig } from "@/lib/board/defaultBoard";
import { GameState } from "@/lib/domain/types";
import { createInitialGameState } from "@/lib/engine/gameFactory";
import { applyGameAction } from "@/lib/engine/gameEngine";

function makeState(): GameState {
  return createInitialGameState({
    name: "Test Game",
    board: createDefaultBoardConfig(),
    players: [
      { id: "p1", name: "Alice", token: "Car", accessToken: "tok1" },
      { id: "p2", name: "Bob", token: "Hat", accessToken: "tok2" }
    ]
  });
}

describe("game engine core flow", () => {
  test("dice roll moves player and passing GO grants cash", () => {
    const start = makeState();
    start.players[0].position = 39;

    const rolled = applyGameAction(start, { type: "ROLL_DICE", forcedDice: [1, 1] });

    expect(rolled.state.players[0].position).toBe(1);
    expect(rolled.state.players[0].cash).toBeGreaterThanOrEqual(1700);
  });

  test("property purchase assigns ownership and deducts cash", () => {
    const start = makeState();

    const rolled = applyGameAction(start, { type: "ROLL_DICE", forcedDice: [1, 2] });
    expect(rolled.state.phase).toBe("AWAITING_PURCHASE_DECISION");

    const purchased = applyGameAction(rolled.state, { type: "PURCHASE_PROPERTY" });
    const tile = purchased.state.board.tiles[3];

    expect(purchased.state.ownership[tile.id]).toBe("p1");
    expect(purchased.state.players[0].properties).toContain(tile.id);
    expect(purchased.state.players[0].cash).toBe(1440);
  });

  test("rent payment transfers cash to owner", () => {
    let state = makeState();

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    state = applyGameAction(state, { type: "PURCHASE_PROPERTY" }).state;
    state = applyGameAction(state, { type: "END_TURN" }).state;

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    expect(state.phase).toBe("AWAITING_RENT_PAYMENT");
    expect(state.pendingRent?.amount).toBe(20);

    const afterRentPaid = applyGameAction(state, { type: "PAY_RENT" }).state;
    expect(afterRentPaid.players[1].cash).toBe(1480);
    expect(afterRentPaid.players[0].cash).toBe(1460);
    expect(afterRentPaid.pendingRent).toBeUndefined();
  });

  test("chance/community card resolution requires explicit activation", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const state = makeState();
      const rolled = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [3, 4] });

      expect(rolled.state.phase).toBe("AWAITING_EFFECT_ACTIVATION");
      expect(rolled.state.pendingEffect?.cardText).toBeTruthy();

      const activated = applyGameAction(rolled.state, { type: "ACTIVATE_TILE_EFFECT" });
      expect(activated.state.players[0].position).toBe(0);
      expect(activated.state.players[0].cash).toBe(1700);
      expect(activated.state.phase).toBe("AWAITING_END_TURN");
      expect(activated.state.logs.some((entry) => entry.type === "CARD_DRAW")).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test("building a house increases future rent tier", () => {
    let state = makeState();

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    state = applyGameAction(state, { type: "PURCHASE_PROPERTY" }).state;
    expect(state.propertyHouses[state.board.tiles[3].id]).toBe(1);

    state = applyGameAction(state, { type: "BUILD_HOUSE", tileId: state.board.tiles[3].id }).state;
    expect(state.propertyHouses[state.board.tiles[3].id]).toBe(2);
    expect(state.players[0].cash).toBe(1390);

    state = applyGameAction(state, { type: "END_TURN" }).state;
    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    expect(state.phase).toBe("AWAITING_RENT_PAYMENT");
    expect(state.pendingRent?.amount).toBe(60);
  });

  test("owning full color set doubles property rent", () => {
    let state = makeState();
    const baltic = state.board.tiles[3];
    const mediterranean = state.board.tiles[1];

    state.ownership[baltic.id] = "p1";
    state.ownership[mediterranean.id] = "p1";
    state.players[0].properties.push(mediterranean.id, baltic.id);
    state.propertyHouses[mediterranean.id] = 1;
    state.propertyHouses[baltic.id] = 1;

    state.players[1].position = 0;
    state.currentPlayerIndex = 1;
    state.phase = "AWAITING_ROLL";

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    expect(state.phase).toBe("AWAITING_RENT_PAYMENT");
    expect(state.pendingRent?.amount).toBe(40);
  });

  test("go-to-jail tile requires activation and then sends player to jail", () => {
    let state = makeState();
    state.players[0].position = 26;

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [2, 2] }).state;
    expect(state.phase).toBe("AWAITING_EFFECT_ACTIVATION");
    expect(state.pendingEffect?.tileType).toBe("GO_TO_JAIL");

    state = applyGameAction(state, { type: "ACTIVATE_TILE_EFFECT" }).state;
    expect(state.players[0].inJail).toBe(true);
    expect(state.players[0].position).toBe(10);
    expect(state.phase).toBe("AWAITING_END_TURN");
  });

  test("player can manually pay jail fine before rolling", () => {
    let state = makeState();
    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].cash = 300;
    state.phase = "AWAITING_ROLL";

    state = applyGameAction(state, { type: "PAY_JAIL_FINE" }).state;
    expect(state.players[0].inJail).toBe(false);
    expect(state.players[0].jailTurns).toBe(0);
    expect(state.players[0].cash).toBe(250);
    expect(state.phase).toBe("AWAITING_ROLL");
  });

  test("player can manually use get out of jail card before rolling", () => {
    let state = makeState();
    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].getOutOfJailCards = 1;
    state.phase = "AWAITING_ROLL";

    state = applyGameAction(state, { type: "USE_GET_OUT_OF_JAIL_CARD" }).state;
    expect(state.players[0].inJail).toBe(false);
    expect(state.players[0].jailTurns).toBe(0);
    expect(state.players[0].getOutOfJailCards).toBe(0);
    expect(state.phase).toBe("AWAITING_ROLL");
  });

  test("rolling in jail no longer auto-uses card", () => {
    let state = makeState();
    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].getOutOfJailCards = 1;
    state.phase = "AWAITING_ROLL";

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    expect(state.players[0].inJail).toBe(true);
    expect(state.players[0].getOutOfJailCards).toBe(1);
    expect(state.phase).toBe("AWAITING_END_TURN");
  });

  test("double roll is logged when extra turn is granted after purchase flow", () => {
    let state = makeState();

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [3, 3] }).state;
    expect(state.phase).toBe("AWAITING_PURCHASE_DECISION");

    state = applyGameAction(state, { type: "PURCHASE_PROPERTY" }).state;
    expect(state.phase).toBe("AWAITING_ROLL");
    expect(state.logs.some((entry) => entry.type === "DOUBLE_ROLL")).toBe(true);
  });

  test("turn transitions move to next active player", () => {
    let state = makeState();

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    state = applyGameAction(state, { type: "DECLINE_PROPERTY" }).state;
    state = applyGameAction(state, { type: "RESOLVE_AUCTION" }).state;
    state = applyGameAction(state, { type: "END_TURN" }).state;

    expect(state.turnNumber).toBe(2);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("AWAITING_ROLL");
  });

  test("declining player cannot participate in auction and others can bid", () => {
    let state = makeState();

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    state = applyGameAction(state, { type: "DECLINE_PROPERTY" }).state;

    expect(state.phase).toBe("AUCTION");
    expect(state.auction?.participants.includes("p1")).toBe(false);
    expect(state.auction?.participants.includes("p2")).toBe(true);

    state = applyGameAction(state, { type: "PLACE_AUCTION_BID", playerId: "p2", amount: 30 }).state;
    expect(state.auction?.bids.p2).toBe(30);

    state = applyGameAction(state, { type: "RESOLVE_AUCTION" }).state;
    const tile = state.board.tiles[3];
    expect(state.ownership[tile.id]).toBe("p2");
    expect(state.players[1].cash).toBe(1470);
  });

  test("trade proposal and acceptance swaps cash and properties", () => {
    let state = makeState();
    const tileA = state.board.tiles[1];
    const tileB = state.board.tiles[3];

    state.ownership[tileA.id] = "p1";
    state.ownership[tileB.id] = "p2";
    state.players[0].properties.push(tileA.id);
    state.players[1].properties.push(tileB.id);

    state = applyGameAction(state, {
      type: "PROPOSE_TRADE",
      fromPlayerId: "p1",
      toPlayerId: "p2",
      offeredCash: 100,
      requestedCash: 50,
      offeredTileIds: [tileA.id],
      requestedTileIds: [tileB.id]
    }).state;

    expect(state.pendingTrades).toHaveLength(1);
    const tradeId = state.pendingTrades[0].id;

    state = applyGameAction(state, { type: "ACCEPT_TRADE", tradeId, playerId: "p2" }).state;

    expect(state.pendingTrades).toHaveLength(0);
    expect(state.ownership[tileA.id]).toBe("p2");
    expect(state.ownership[tileB.id]).toBe("p1");
    expect(state.players[0].cash).toBe(1450);
    expect(state.players[1].cash).toBe(1550);
  });

  test("trade can be proposed outside active player turn/phase", () => {
    let state = makeState();
    state.phase = "AWAITING_PURCHASE_DECISION";
    state.currentPlayerIndex = 0;

    state = applyGameAction(state, {
      type: "PROPOSE_TRADE",
      fromPlayerId: "p2",
      toPlayerId: "p1",
      offeredCash: 20,
      requestedCash: 0,
      offeredTileIds: [],
      requestedTileIds: []
    }).state;

    expect(state.pendingTrades).toHaveLength(1);
    expect(state.pendingTrades[0].fromPlayerId).toBe("p2");
  });

  test("trade recipient can reject and proposer can cancel", () => {
    let state = makeState();

    state = applyGameAction(state, {
      type: "PROPOSE_TRADE",
      fromPlayerId: "p1",
      toPlayerId: "p2",
      offeredCash: 10,
      requestedCash: 0,
      offeredTileIds: [],
      requestedTileIds: []
    }).state;
    const rejectTradeId = state.pendingTrades[0].id;
    state = applyGameAction(state, { type: "REJECT_TRADE", tradeId: rejectTradeId, playerId: "p2" }).state;
    expect(state.pendingTrades).toHaveLength(0);

    state = applyGameAction(state, {
      type: "PROPOSE_TRADE",
      fromPlayerId: "p1",
      toPlayerId: "p2",
      offeredCash: 20,
      requestedCash: 0,
      offeredTileIds: [],
      requestedTileIds: []
    }).state;
    const cancelTradeId = state.pendingTrades[0].id;
    state = applyGameAction(state, { type: "CANCEL_TRADE", tradeId: cancelTradeId, playerId: "p1" }).state;
    expect(state.pendingTrades).toHaveLength(0);
  });

  test("bankruptcy marks player bankrupt and can end game", () => {
    let state = makeState();

    const propertyTile = state.board.tiles[39];
    state.ownership[propertyTile.id] = "p1";
    state.players[0].properties.push(propertyTile.id);
    state.players[1].position = 36;
    state.players[1].cash = 20;
    state.currentPlayerIndex = 1;
    state.phase = "AWAITING_ROLL";

    state = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [1, 2] }).state;
    expect(state.phase).toBe("AWAITING_RENT_PAYMENT");

    state = applyGameAction(state, { type: "PAY_RENT" }).state;
    expect(state.players[1].bankrupt).toBe(true);
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winnerPlayerId).toBe("p1");
  });
});
