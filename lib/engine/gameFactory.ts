import { CreateGameInput, GameState } from "@/lib/domain/types";

export function createInitialGameState(input: CreateGameInput): GameState {
  return {
    id: input.name.toLowerCase().replaceAll(/\s+/g, "-") + "-state",
    name: input.name,
    board: input.board,
    players: input.players.map((player) => ({
      id: player.id,
      accessToken: player.accessToken,
      name: player.name,
      token: player.token,
      cash: input.board.rules.startCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      properties: [],
      getOutOfJailCards: 0,
      bankrupt: false
    })),
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: "AWAITING_ROLL",
    ownership: {},
    transactions: [],
    logs: [],
    propertyHouses: {},
    pendingTrades: [],
    futureModifiers: []
  };
}
