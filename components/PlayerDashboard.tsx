"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { baseRent, isPurchasableTile, tileAccentColor, tilePrice } from "@/lib/board/display";
import { GameState } from "@/lib/domain/types";

type PlayerPayload = {
  gameId: string;
  player: {
    id: string;
    name: string;
    token: string;
    accessToken: string;
  };
  state: GameState;
  playerState: {
    id: string;
    name: string;
    token: string;
    cash: number;
    properties: string[];
    position: number;
    bankrupt: boolean;
    inJail: boolean;
    getOutOfJailCards: number;
  };
  availableActions: {
    canRoll: boolean;
    canActivateEffect: boolean;
    canPayRent: boolean;
    canBuy: boolean;
    canDecline: boolean;
    canBidAuction: boolean;
    canEndTurn: boolean;
  };
};

export function PlayerDashboard({ accessToken }: { accessToken: string }) {
  const [payload, setPayload] = useState<PlayerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [auctionBidDraft, setAuctionBidDraft] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/player/${accessToken}/state`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch player state");
      }
      setPayload(data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown player error");
    }
  }, [accessToken]);

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

  async function sendAction(type: "ROLL_DICE" | "ACTIVATE_TILE_EFFECT" | "PAY_RENT" | "PURCHASE_PROPERTY" | "DECLINE_PROPERTY" | "END_TURN") {
    if (!payload) {
      return;
    }

    try {
      setPending(true);
      await sleep(260);
      const response = await fetch(`/api/games/${payload.gameId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown action error");
    } finally {
      setPending(false);
    }
  }

  const recentRelevantLogs = useMemo(() => {
    if (!payload) {
      return [];
    }

    const playerName = payload.player.name.toLowerCase();
    return payload.state.logs
      .filter((entry) => entry.message.toLowerCase().includes(playerName) || entry.type === "CARD_DRAW")
      .slice()
      .reverse()
      .slice(0, 20);
  }, [payload]);

  const auctionForSync = payload?.state.auction;
  const currentBidForSync = payload && auctionForSync ? auctionForSync.bids[payload.player.id] ?? 0 : 0;

  useEffect(() => {
    setAuctionBidDraft(currentBidForSync);
  }, [currentBidForSync, auctionForSync?.tileIndex]);

  if (!payload) {
    return <main className="mx-auto max-w-md p-4">Loading player view...</main>;
  }

  const tile = payload.state.board.tiles[payload.playerState.position];
  const isPlayersTurn = payload.state.players[payload.state.currentPlayerIndex]?.id === payload.player.id;
  const currentTileOwnerId = tile ? payload.state.ownership[tile.id] : undefined;
  const currentTileOwner = currentTileOwnerId ? payload.state.players.find((player) => player.id === currentTileOwnerId) : undefined;
  const pendingEffect = payload.state.pendingEffect;
  const pendingRent = payload.state.pendingRent;
  const auction = payload.state.auction;
  const auctionTile = auction ? payload.state.board.tiles[auction.tileIndex] : undefined;
  const currentBid = auction?.bids[payload.player.id] ?? 0;
  const canBid = payload.availableActions.canBidAuction && Boolean(auction);

  async function submitAuctionBid() {
    if (!payload || !auction) {
      return;
    }

    try {
      setPending(true);
      await sleep(180);
      const response = await fetch(`/api/games/${payload.gameId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PLACE_AUCTION_BID", playerId: payload.player.id, amount: auctionBidDraft })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Bid failed");
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown bid error");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-3 py-4">
      <section className="card p-4">
        <p className="badge">Player Session</p>
        <h1 className="mt-2 text-2xl font-black">{payload.player.name}</h1>
        <p className="text-sm text-slate-700">Pawn: {payload.player.token}</p>
        <p className="mt-2 text-sm text-slate-700">Cash: ${payload.playerState.cash}</p>
        <p className="text-sm text-slate-700">Position: #{payload.playerState.position} ({tile?.name ?? "Unknown"})</p>
        <p className="text-xs text-slate-600">Bookmark this URL for reconnection.</p>
      </section>

      {error && <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isPlayersTurn && (
        <section className="card mt-3 p-4">
          <h2 className="text-lg font-bold">Dice</h2>
          <p className="mt-2 text-sm text-slate-700">
            {payload.state.lastRoll
              ? `${payload.state.lastRoll.dieOne} + ${payload.state.lastRoll.dieTwo} = ${payload.state.lastRoll.total}`
              : "Roll to start your turn."}
          </p>
        </section>
      )}

      <section className="card mt-3 p-4">
        <h2 className="text-lg font-bold">Current Property Card</h2>
        {isPurchasableTile(tile) ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-300">
            <div className="h-4 w-full" style={{ backgroundColor: tileAccentColor(tile) }} />
            <div className="bg-white p-3">
              <p className="mt-1 text-xl font-black leading-tight">{tile.name}</p>
              <p className="text-sm text-slate-700">Price: {tilePrice(tile) ? `$${tilePrice(tile)}` : "N/A"}</p>
              <p className="text-sm text-slate-700">Base Rent: {baseRent(tile) ? `$${baseRent(tile)}` : "N/A"}</p>
              <p className="text-sm text-slate-700">Owner: {currentTileOwner ? currentTileOwner.name : "Unowned"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No purchasable property on current tile.</p>
        )}
      </section>

      <section className="card mt-3 p-4">
        <h2 className="text-lg font-bold">Available Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className={`btn ${payload.availableActions.canRoll ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canRoll || pending} onClick={() => sendAction("ROLL_DICE")}>
            Roll
          </button>
          <button className={`btn ${payload.availableActions.canActivateEffect ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canActivateEffect || pending} onClick={() => sendAction("ACTIVATE_TILE_EFFECT")}>
            Activate
          </button>
          <button className={`btn ${payload.availableActions.canPayRent ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canPayRent || pending} onClick={() => sendAction("PAY_RENT")}>
            Pay Rent
          </button>
          <button className={`btn ${payload.availableActions.canBuy ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canBuy || pending} onClick={() => sendAction("PURCHASE_PROPERTY")}>
            Buy
          </button>
          <button className={`btn ${payload.availableActions.canDecline ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canDecline || pending} onClick={() => sendAction("DECLINE_PROPERTY")}>
            Decline
          </button>
          <button className={`btn ${payload.availableActions.canEndTurn ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canEndTurn || pending} onClick={() => sendAction("END_TURN")}>
            End Turn
          </button>
        </div>
      </section>

      {pendingRent && (
        <section className="card mt-3 p-4">
          <h2 className="text-lg font-bold">Rent Due</h2>
          <p className="mt-2 text-sm text-slate-700">
            You owe ${pendingRent.amount} to {payload.state.players.find((entry) => entry.id === pendingRent.ownerPlayerId)?.name ?? "owner"}.
          </p>
        </section>
      )}

      {payload.state.phase === "AUCTION" && auction && auctionTile && (
        <section className="card mt-3 p-4">
          <h2 className="text-lg font-bold">Auction</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-300">
            <div className="h-4 w-full" style={{ backgroundColor: tileAccentColor(auctionTile) }} />
            <div className="bg-white p-3">
              <p className="text-lg font-black leading-tight">{auctionTile.name}</p>
              <p className="text-sm text-slate-700">Price: {tilePrice(auctionTile) ? `$${tilePrice(auctionTile)}` : "N/A"}</p>
              <p className="text-sm text-slate-700">Base Rent: {baseRent(auctionTile) ? `$${baseRent(auctionTile)}` : "N/A"}</p>
            </div>
          </div>

          {canBid ? (
            <div className="mt-3">
              <p className="text-sm text-slate-700">Your submitted bid: ${currentBid}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() => setAuctionBidDraft((prev) => Math.max(0, prev - 10))}
                >
                  -10
                </button>
                <div className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold">${auctionBidDraft}</div>
                <button className="btn btn-ghost" disabled={pending} onClick={() => setAuctionBidDraft((prev) => prev + 10)}>
                  +10
                </button>
                <button className="btn btn-primary" disabled={pending || auctionBidDraft > payload.playerState.cash} onClick={submitAuctionBid}>
                  Submit Bid
                </button>
              </div>
              {auctionBidDraft > payload.playerState.cash && <p className="mt-2 text-xs text-red-700">Bid exceeds your cash.</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-700">You cannot bid in this auction.</p>
          )}
        </section>
      )}

      {pendingEffect && (
        <section className="card mt-3 p-4">
          <h2 className="text-lg font-bold">Pending Card</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-300">
            <div className="h-4 w-full" style={{ backgroundColor: tileAccentColor(tile) }} />
            <div className="bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Awaiting Activation</p>
              <p className="mt-1 text-lg font-black leading-tight">{pendingEffect.cardText}</p>
              {pendingEffect.effect.type === "MOVE_TO" && <p className="text-sm text-slate-700">Move to tile #{pendingEffect.effect.tileIndex}</p>}
              {pendingEffect.effect.type === "PAY_MONEY" && <p className="text-sm text-slate-700">Pay ${pendingEffect.effect.amount}</p>}
              {pendingEffect.effect.type === "GAIN_MONEY" && <p className="text-sm text-slate-700">Collect ${pendingEffect.effect.amount}</p>}
            </div>
          </div>
        </section>
      )}

      <section className="card mt-3 p-4">
        <h2 className="text-lg font-bold">Owned Properties</h2>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {payload.playerState.properties.length === 0 && "No properties"}
          {payload.playerState.properties.map((tileId) => {
            const ownedTile = payload.state.board.tiles.find((entry) => entry.id === tileId);
            if (!ownedTile) {
              return (
                <div className="rounded border border-slate-200 bg-slate-50 p-2" key={tileId}>
                  {tileId}
                </div>
              );
            }

            return (
              <div className="overflow-hidden rounded border border-slate-200 bg-slate-50" key={tileId}>
                <div className="h-2 w-full" style={{ backgroundColor: tileAccentColor(ownedTile) }} />
                <div className="p-2">
                  <p className="font-semibold">{ownedTile.name}</p>
                  <p className="text-xs text-slate-600">
                    {ownedTile.type}
                    {tilePrice(ownedTile) ? ` · $${tilePrice(ownedTile)}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mt-3 p-4">
        <h2 className="text-lg font-bold">Relevant Events</h2>
        <div className="mt-2 space-y-2">
          {recentRelevantLogs.map((entry) => (
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs" key={entry.id}>
              <span className="font-semibold">{entry.type}</span> - {entry.message}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
