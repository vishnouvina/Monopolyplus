import { PlayerDashboard } from "@/components/PlayerDashboard";

export default async function PlayerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PlayerDashboard accessToken={token} />;
}
