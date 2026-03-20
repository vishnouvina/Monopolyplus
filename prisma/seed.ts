import { BoardSource, GameStatus, Prisma, PrismaClient } from "@prisma/client";
import { createDefaultBoardConfig } from "../lib/board/defaultBoard";
import { createInitialGameState } from "../lib/engine/gameFactory";

const prisma = new PrismaClient();

async function main() {
  const board = createDefaultBoardConfig();

  let boardConfig = await prisma.boardConfig.findFirst({ where: { source: BoardSource.DEFAULT } });
  if (!boardConfig) {
    boardConfig = await prisma.boardConfig.create({
      data: {
        name: board.name,
        source: BoardSource.DEFAULT,
        data: board as unknown as Prisma.InputJsonValue
      }
    });
  }

  const existingGame = await prisma.game.findFirst({ where: { name: "Seeded Local Game" } });
  if (existingGame) {
    return;
  }

  const game = await prisma.game.create({
    data: {
      name: "Seeded Local Game",
      status: GameStatus.SETUP,
      boardConfigId: boardConfig.id,
      state: {} as Prisma.InputJsonValue
    }
  });

  const players = await Promise.all(
    ["Ari", "Sam", "Rin", "Lee"].map((name, idx) =>
      prisma.player.create({
        data: {
          gameId: game.id,
          name,
          token: ["Car", "Hat", "Dog", "Ship"][idx],
          seatOrder: idx,
          accessToken: `seed_${idx}_${crypto.randomUUID().slice(0, 8)}`
        }
      })
    )
  );

  const state = createInitialGameState({
    name: game.name,
    board,
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      token: player.token,
      accessToken: player.accessToken
    }))
  });
  state.id = game.id;

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: GameStatus.IN_PROGRESS,
      state: state as unknown as Prisma.InputJsonValue
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
