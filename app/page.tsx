import { SetupWizard } from "@/components/SetupWizard";
import { ensureDefaultBoardConfig, listBoardConfigs } from "@/lib/services/gameService";

export default async function HomePage() {
  await ensureDefaultBoardConfig();
  const boards = await listBoardConfigs();

  return <SetupWizard boards={boards.map((board) => ({ id: board.id, name: board.name, source: board.source }))} />;
}
