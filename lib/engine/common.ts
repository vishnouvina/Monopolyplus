import { GameEvent, GameState, PlayerState, TileDefinition, TransactionEntry } from "@/lib/domain/types";

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

export function appendEvent(events: GameEvent[], state: GameState, type: string, message: string, payload?: Record<string, unknown>) {
  events.push({
    id: crypto.randomUUID(),
    turnNumber: state.turnNumber,
    type,
    message,
    payload
  });
}

export function appendTransaction(
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

export function getTile(state: GameState, index: number): TileDefinition {
  return state.board.tiles[index];
}

export function getTileById(state: GameState, tileId: string): TileDefinition | undefined {
  return state.board.tiles.find((tile) => tile.id === tileId);
}

export function getPlayerById(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

export function getTileOwner(state: GameState, tile: TileDefinition): PlayerState | undefined {
  const ownerId = state.ownership[tile.id];
  if (!ownerId) {
    return undefined;
  }
  return getPlayerById(state, ownerId);
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.bankrupt);
}

export function removeTileFromPlayer(player: PlayerState, tileId: string) {
  player.properties = player.properties.filter((id) => id !== tileId);
}

export function addTileToPlayer(player: PlayerState, tileId: string) {
  if (!player.properties.includes(tileId)) {
    player.properties.push(tileId);
  }
}

export function transferTile(state: GameState, tileId: string, fromPlayer: PlayerState, toPlayer: PlayerState) {
  removeTileFromPlayer(fromPlayer, tileId);
  addTileToPlayer(toPlayer, tileId);
  state.ownership[tileId] = toPlayer.id;
  if (!state.propertyHouses[tileId]) {
    state.propertyHouses[tileId] = 1;
  }
}

export function uniqueIds(values: string[]): string[] {
  return [...new Set(values)];
}
