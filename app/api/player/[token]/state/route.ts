import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/services/gameService";

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const session = await getPlayerSession(token);

  if (!session) {
    return NextResponse.json({ error: "Player session not found." }, { status: 404 });
  }

  return NextResponse.json(session);
}
