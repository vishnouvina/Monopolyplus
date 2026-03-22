import { GameState, PlayerState, TileDefinition } from "@/lib/domain/types";

export function assertBuildHouseAllowed(
  state: GameState,
  player: PlayerState,
  tile: TileDefinition,
  currentHouses: number
) {
  if (state.phase !== "AWAITING_END_TURN") {
    throw new Error("Houses can be built at end of turn.");
  }

  if (tile.type !== "PROPERTY") {
    throw new Error("Can only build houses on properties.");
  }

  if (state.ownership[tile.id] !== player.id) {
    throw new Error("You do not own this property.");
  }

  if (currentHouses >= 5) {
    throw new Error("Property is already at max development.");
  }
}

export function normalizeTradeValues(tradeInput: {
  fromPlayerId: string;
  toPlayerId: string;
  offeredCash: number;
  requestedCash: number;
  offeredTileIds: string[];
  requestedTileIds: string[];
}) {
  const offeredCash = Math.max(0, tradeInput.offeredCash);
  const requestedCash = Math.max(0, tradeInput.requestedCash);

  if (tradeInput.fromPlayerId === tradeInput.toPlayerId) {
    throw new Error("Cannot trade with yourself.");
  }

  if (
    offeredCash === 0 &&
    requestedCash === 0 &&
    tradeInput.offeredTileIds.length === 0 &&
    tradeInput.requestedTileIds.length === 0
  ) {
    throw new Error("Trade must include cash and/or properties.");
  }

  return {
    offeredCash,
    requestedCash
  };
}
