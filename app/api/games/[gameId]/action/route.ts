import { NextResponse } from "next/server";
import { applyActionToGame } from "@/lib/services/gameService";

export async function POST(request: Request, context: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId } = await context.params;
    const action = await request.json();
    const state = await applyActionToGame(gameId, action);
    return NextResponse.json({ state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
