import { describe, expect, test } from "vitest";
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
    expect(state.pendingRent?.amount).toBe(4);

    const afterRentPaid = applyGameAction(state, { type: "PAY_RENT" }).state;
    expect(afterRentPaid.players[1].cash).toBe(1496);
    expect(afterRentPaid.players[0].cash).toBe(1444);
    expect(afterRentPaid.pendingRent).toBeUndefined();
  });

  test("chance/community card resolution requires explicit activation", () => {
    const state = makeState();
    const rolled = applyGameAction(state, { type: "ROLL_DICE", forcedDice: [3, 4] });

    expect(rolled.state.phase).toBe("AWAITING_EFFECT_ACTIVATION");
    expect(rolled.state.pendingEffect?.cardText).toBeTruthy();

    const activated = applyGameAction(rolled.state, { type: "ACTIVATE_TILE_EFFECT" });
    expect(activated.state.players[0].position).toBe(0);
    expect(activated.state.players[0].cash).toBe(1700);
    expect(activated.state.phase).toBe("AWAITING_END_TURN");
    expect(activated.state.logs.some((entry) => entry.type === "CARD_DRAW")).toBe(true);
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
