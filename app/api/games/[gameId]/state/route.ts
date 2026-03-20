import { NextResponse } from "next/server";
import { getGameState } from "@/lib/services/gameService";

export async function GET(_: Request, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const found = await getGameState(gameId);

  if (!found) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  return NextResponse.json({
    gameId,
    state: found.state,
    players: found.game.players.map((player) => ({
      id: player.id,
      name: player.name,
      token: player.token,
      accessToken: player.accessToken,
      seatOrder: player.seatOrder
    }))
  });
}
