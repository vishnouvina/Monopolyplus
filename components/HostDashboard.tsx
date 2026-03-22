"use client";

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { BoardOverview } from "@/components/BoardOverview";
import { rentSchedule, tileAccentColor, tilePrice } from "@/lib/board/display";
import { GameState } from "@/lib/domain/types";

type HostPayload = {
  gameId: string;
  state: GameState;
  players: Array<{
    id: string;
    name: string;
    token: string;
    accessToken: string;
    seatOrder: number;
  }>;
};

export function HostDashboard({ gameId }: { gameId: string }) {
  const [payload, setPayload] = useState<HostPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollingPreview, setRollingPreview] = useState<[number, number] | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/state`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch game state");
      }
      setPayload(data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown host error");
    }
  }, [gameId]);

  useEffect(() => {
    void refresh();
    const handle = setInterval(() => {
      void refresh();
    }, 1400);
    return () => clearInterval(handle);
  }, [refresh]);

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomDie() {
    return (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  async function sendAction(action: Record<string, unknown>, delayMs = 320) {
    try {
      setPending(true);
      await sleep(delayMs);
      const response = await fetch(`/api/games/${gameId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown action failure");
    } finally {
      setPending(false);
    }
  }

  async function handleRollAction() {
    if (pending || rolling || !payload || payload.state.phase !== "AWAITING_ROLL") {
      return;
    }

    setRolling(true);
    setRollingPreview([randomDie(), randomDie()]);
    const handle = setInterval(() => {
      setRollingPreview([randomDie(), randomDie()]);
    }, 90);

    await sleep(760);
    clearInterval(handle);
    await sendAction({ type: "ROLL_DICE" }, 120);
    setRolling(false);
    setRollingPreview(null);
  }

  if (!payload) {
    return <main className="mx-auto max-w-7xl p-6">Loading host dashboard...</main>;
  }

  const state = payload.state;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const canPayJailFine = state.phase === "AWAITING_ROLL" && currentPlayer.inJail && currentPlayer.cash >= state.board.rules.jailFine;
  const canUseJailCard = state.phase === "AWAITING_ROLL" && currentPlayer.inJail && currentPlayer.getOutOfJailCards > 0;

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6">
      <header className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="badge">Host Console</p>
            <h1 className="mt-2 text-3xl font-black">{state.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Game ID: {gameId}</p>
            <p className="mt-1 text-sm text-slate-700">
              Phase: <strong>{state.phase}</strong> | Turn: <strong>{state.turnNumber}</strong> | Current Player: <strong>{currentPlayer.name}</strong>
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Setup complete: player QR links ready</div>
        </div>
      </header>

      {error && <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="mt-5 space-y-5">
        <div className="card p-4">
          <h2 className="text-xl font-bold">Board Overview</h2>
          <BoardOverview state={state} isRolling={rolling} rollingPreview={rollingPreview} />
        </div>

        <div className="card p-4">
          <h2 className="text-xl font-bold">Turn Controls</h2>
          <p className="mt-2 text-sm text-slate-700">
            Dice: {rollingPreview ? `${rollingPreview[0]} + ${rollingPreview[1]}` : state.lastRoll ? `${state.lastRoll.dieOne} + ${state.lastRoll.dieTwo}` : "-"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={`btn ${state.phase === "AWAITING_ROLL" ? "btn-primary" : "btn-ghost"}`}
              disabled={pending || rolling || state.phase !== "AWAITING_ROLL"}
              onClick={handleRollAction}
            >
              Roll Dice
            </button>
            <button className={`btn ${canPayJailFine ? "btn-primary" : "btn-ghost"}`} disabled={pending || !canPayJailFine} onClick={() => sendAction({ type: "PAY_JAIL_FINE" })}>
              Pay Jail Fine
            </button>
            <button className={`btn ${canUseJailCard ? "btn-primary" : "btn-ghost"}`} disabled={pending || !canUseJailCard} onClick={() => sendAction({ type: "USE_GET_OUT_OF_JAIL_CARD" })}>
              Use Jail Card
            </button>
            <button
              className={`btn ${state.phase === "AWAITING_EFFECT_ACTIVATION" ? "btn-primary" : "btn-ghost"}`}
              disabled={pending || state.phase !== "AWAITING_EFFECT_ACTIVATION"}
              onClick={() => sendAction({ type: "ACTIVATE_TILE_EFFECT" })}
            >
              Activate Card
            </button>
            <button className={`btn ${state.phase === "AWAITING_RENT_PAYMENT" ? "btn-primary" : "btn-ghost"}`} disabled={pending || state.phase !== "AWAITING_RENT_PAYMENT"} onClick={() => sendAction({ type: "PAY_RENT" })}>
              Pay Rent
            </button>
            <button
              className={`btn ${state.phase === "AWAITING_PURCHASE_DECISION" ? "btn-primary" : "btn-ghost"}`}
              disabled={pending || state.phase !== "AWAITING_PURCHASE_DECISION"}
              onClick={() => sendAction({ type: "PURCHASE_PROPERTY" })}
            >
              Buy
            </button>
            <button
              className={`btn ${state.phase === "AWAITING_PURCHASE_DECISION" ? "btn-primary" : "btn-ghost"}`}
              disabled={pending || state.phase !== "AWAITING_PURCHASE_DECISION"}
              onClick={() => sendAction({ type: "DECLINE_PROPERTY" })}
            >
              Decline
            </button>
            <button className={`btn ${state.phase === "AWAITING_END_TURN" ? "btn-primary" : "btn-ghost"}`} disabled={pending || state.phase !== "AWAITING_END_TURN"} onClick={() => sendAction({ type: "END_TURN" })}>
              End Turn
            </button>
          </div>

          {state.phase === "AUCTION" && state.auction && (
            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
              <h3 className="font-bold">Auction</h3>
              {(() => {
                const auctionTile = state.board.tiles[state.auction.tileIndex];
                return (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-300 bg-white">
                    <div className="h-2 w-full" style={{ backgroundColor: tileAccentColor(auctionTile) }} />
                    <div className="p-2">
                      <p className="font-semibold">{auctionTile.name}</p>
                      <p className="text-xs text-slate-600">Price: {tilePrice(auctionTile) ? `$${tilePrice(auctionTile)}` : "N/A"}</p>
                      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-700">
                        {rentSchedule(auctionTile).map((entry) => (
                          <p key={`${auctionTile.id}-${entry.label}`}>
                            {entry.label}: ${entry.amount}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="mt-2 space-y-2">
                {state.auction.participants.map((participantId) => {
                  const player = state.players.find((entry) => entry.id === participantId);
                  if (!player) {
                    return null;
                  }

                  const submitted = state.auction?.bids[participantId];
                  return (
                    <div className="rounded border border-slate-200 bg-white px-2 py-1 text-xs" key={participantId}>
                      <span className="font-semibold">{player.name}</span>
                      <span className="ml-2 text-slate-600">{submitted !== undefined ? `Bid: $${submitted}` : "No bid yet"}</span>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-primary mt-3" disabled={pending} onClick={() => sendAction({ type: "RESOLVE_AUCTION" })}>
                Resolve Auction
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-xl font-bold">Ownership and Cash</h2>
          <div className="mt-3 space-y-2">
            {state.players.map((player) => (
              <div className="rounded border border-slate-200 p-2" key={player.id}>
                <p className="font-semibold">
                  {player.name} ({player.token}) {player.bankrupt ? "- Bankrupt" : ""}
                </p>
                <p className="text-sm text-slate-700">Cash: ${player.cash}</p>
                <div className="mt-2">
                  {player.properties.length === 0 && <p className="text-xs text-slate-600">Properties: None</p>}
                  {player.properties.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {player.properties.map((tileId) => {
                        const ownedTile = state.board.tiles.find((tile) => tile.id === tileId);
                        if (!ownedTile) {
                          return null;
                        }
                        return (
                          <div className="overflow-hidden rounded border border-slate-200 bg-slate-50" key={tileId}>
                            <div className="h-1.5 w-full" style={{ backgroundColor: tileAccentColor(ownedTile) }} />
                            <p className="px-2 py-1 text-[11px] font-semibold text-slate-700">{ownedTile.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xl font-bold">Player QR Access</h2>
          <p className="mt-1 text-sm text-slate-600">Scan to open each mobile player UI.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {payload.players.map((player) => {
              const path = `/player/${player.accessToken}`;
              const link = `${baseUrl}${path}`;
              return (
                <div className="rounded border border-slate-200 p-3" key={player.id}>
                  <p className="text-sm font-semibold">{player.name}</p>
                  <a
                    className="mt-1 inline-block max-w-full truncate rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-700"
                    href={link}
                    rel="noreferrer"
                    target="_blank"
                    title={link}
                  >
                    {path}
                  </a>
                  <div className="mt-2 inline-block rounded bg-white p-2">
                    <QRCodeSVG value={link} size={120} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card mt-5 p-4">
        <h2 className="text-xl font-bold">Game Log</h2>
        <div className="mt-3 max-h-80 space-y-2 overflow-auto">
          {state.logs
            .slice()
            .reverse()
            .slice(0, 120)
            .map((entry) => (
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-sm" key={entry.id}>
                <span className="font-semibold">{entry.type}</span> - {entry.message}
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
