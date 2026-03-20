import { HostDashboard } from "@/components/HostDashboard";

export default async function HostPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <HostDashboard gameId={gameId} />;
}
