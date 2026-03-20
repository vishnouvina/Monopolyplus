import { BoardSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boardSchema } from "@/lib/domain/schemas";
import { createBoardConfig, createGameFromBoard, ensureDefaultBoardConfig } from "@/lib/services/gameService";

const setupSchema = z.object({
  gameName: z.string().min(2),
  players: z
    .array(
      z.object({
        name: z.string().min(1),
        token: z.string().min(1)
      })
    )
    .min(2)
    .max(8),
  boardMode: z.enum(["DEFAULT", "EXISTING", "UPLOADED"]),
  boardConfigId: z.string().optional(),
  uploadedBoardName: z.string().optional(),
  boardJson: z.unknown().optional()
});

export async function POST(request: Request) {
  try {
    const body = setupSchema.parse(await request.json());

    let boardConfigId = body.boardConfigId;

    if (body.boardMode === "DEFAULT") {
      const defaultBoard = await ensureDefaultBoardConfig();
      boardConfigId = defaultBoard.id;
    }

    if (body.boardMode === "UPLOADED") {
      if (!body.boardJson) {
        return NextResponse.json({ error: "Uploaded mode requires boardJson." }, { status: 400 });
      }

      const parsedBoard = boardSchema.parse(body.boardJson);
      const boardConfig = await createBoardConfig({
        name: body.uploadedBoardName ?? `${body.gameName} Uploaded Board`,
        source: BoardSource.UPLOADED,
        board: parsedBoard
      });
      boardConfigId = boardConfig.id;
    }

    if (!boardConfigId) {
      return NextResponse.json({ error: "boardConfigId is required." }, { status: 400 });
    }

    const game = await createGameFromBoard({
      gameName: body.gameName,
      boardConfigId,
      players: body.players
    });

    return NextResponse.json({
      gameId: game.gameId,
      players: game.players.map((player) => ({
        id: player.id,
        name: player.name,
        accessToken: player.accessToken,
        token: player.token
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown setup error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
