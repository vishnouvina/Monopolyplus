import { NextResponse } from "next/server";
import { ensureDefaultBoardConfig, listBoardConfigs } from "@/lib/services/gameService";

export async function GET() {
  await ensureDefaultBoardConfig();
  const boards = await listBoardConfigs();
  return NextResponse.json({ boards });
}
