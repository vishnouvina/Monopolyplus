"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { houseCostFromTile, isPurchasableTile, rentSchedule, tileAccentColor, tilePrice } from "@/lib/board/display";
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
    canProposeTrade: boolean;
    canRespondTrade: boolean;
    canPayJailFine: boolean;
    canUseGetOutOfJailCard: boolean;
    canActivateEffect: boolean;
    canPayRent: boolean;
    canBuy: boolean;
    canDecline: boolean;
    canBidAuction: boolean;
    canBuildHouse: boolean;
    canEndTurn: boolean;
  };
};

export function PlayerDashboard({ accessToken }: { accessToken: string }) {
  const [payload, setPayload] = useState<PlayerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [auctionBidDraft, setAuctionBidDraft] = useState(0);
  const [tradeTargetId, setTradeTargetId] = useState("");
  const [tradeOfferCash, setTradeOfferCash] = useState(0);
  const [tradeRequestCash, setTradeRequestCash] = useState(0);
  const [offeredTileIds, setOfferedTileIds] = useState<string[]>([]);
  const [requestedTileIds, setRequestedTileIds] = useState<string[]>([]);

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

  async function sendAction(action: Record<string, unknown>, delayMs = 260) {
    if (!payload) {
      return;
    }

    try {
      setPending(true);
      await sleep(delayMs);
      const response = await fetch(`/api/games/${payload.gameId}/action`, {
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
  const tradePartners = payload.state.players.filter((player) => player.id !== payload.player.id && !player.bankrupt);
  const effectiveTradeTargetId = tradeTargetId || tradePartners[0]?.id || "";
  const selectedTradePartner = tradePartners.find((player) => player.id === effectiveTradeTargetId);
  const incomingTrades = payload.state.pendingTrades.filter((trade) => trade.toPlayerId === payload.player.id);
  const outgoingTrades = payload.state.pendingTrades.filter((trade) => trade.fromPlayerId === payload.player.id);

  function toggleTile(selected: string[], tileId: string, setSelected: (values: string[]) => void) {
    if (selected.includes(tileId)) {
      setSelected(selected.filter((entry) => entry !== tileId));
      return;
    }
    setSelected([...selected, tileId]);
  }

  function tileName(tileId: string): string {
    return payload?.state.board.tiles.find((tileEntry) => tileEntry.id === tileId)?.name ?? tileId;
  }

  async function submitAuctionBid() {
    if (!payload || !auction) {
      return;
    }

    await sendAction({ type: "PLACE_AUCTION_BID", playerId: payload.player.id, amount: auctionBidDraft }, 180);
  }

  async function submitTradeOffer() {
    if (!payload || !selectedTradePartner) {
      return;
    }

    await sendAction(
      {
        type: "PROPOSE_TRADE",
        fromPlayerId: payload.player.id,
        toPlayerId: selectedTradePartner.id,
        offeredCash: tradeOfferCash,
        requestedCash: tradeRequestCash,
        offeredTileIds,
        requestedTileIds
      },
      140
    );

    setTradeOfferCash(0);
    setTradeRequestCash(0);
    setOfferedTileIds([]);
    setRequestedTileIds([]);
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
          {payload.playerState.inJail && (
            <p className="mt-2 text-sm font-semibold text-amber-700">
              You are in jail. Choose to pay fine, use card, or roll for doubles.
            </p>
          )}
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
              {tile.type === "PROPERTY" && <p className="text-sm text-slate-700">Houses: {payload.state.propertyHouses?.[tile.id] ?? 1}</p>}
              <p className="text-sm text-slate-700">Owner: {currentTileOwner ? currentTileOwner.name : "Unowned"}</p>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-700">
                {rentSchedule(tile).map((entry, index) => {
                  const activeIndex = tile.type === "PROPERTY" ? Math.max(0, (payload.state.propertyHouses?.[tile.id] ?? 1) - 1) : -1;
                  const active = index === activeIndex;
                  return (
                    <p className={active ? "font-bold text-emerald-700" : ""} key={`${tile.id}-${entry.label}`}>
                      {entry.label}: ${entry.amount}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No purchasable property on current tile.</p>
        )}
      </section>

      <section className="card mt-3 p-4">
        <h2 className="text-lg font-bold">Available Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className={`btn ${payload.availableActions.canRoll ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canRoll || pending} onClick={() => sendAction({ type: "ROLL_DICE" })}>
            Roll
          </button>
          <button className={`btn ${payload.availableActions.canPayJailFine ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canPayJailFine || pending} onClick={() => sendAction({ type: "PAY_JAIL_FINE" })}>
            Pay Jail Fine
          </button>
          <button
            className={`btn ${payload.availableActions.canUseGetOutOfJailCard ? "btn-primary" : "btn-ghost"}`}
            disabled={!payload.availableActions.canUseGetOutOfJailCard || pending}
            onClick={() => sendAction({ type: "USE_GET_OUT_OF_JAIL_CARD" })}
          >
            Use Jail Card
          </button>
          <button className={`btn ${payload.availableActions.canActivateEffect ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canActivateEffect || pending} onClick={() => sendAction({ type: "ACTIVATE_TILE_EFFECT" })}>
            Activate
          </button>
          <button className={`btn ${payload.availableActions.canPayRent ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canPayRent || pending} onClick={() => sendAction({ type: "PAY_RENT" })}>
            Pay Rent
          </button>
          <button className={`btn ${payload.availableActions.canBuy ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canBuy || pending} onClick={() => sendAction({ type: "PURCHASE_PROPERTY" })}>
            Buy
          </button>
          <button className={`btn ${payload.availableActions.canDecline ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canDecline || pending} onClick={() => sendAction({ type: "DECLINE_PROPERTY" })}>
            Decline
          </button>
          <button className={`btn ${payload.availableActions.canEndTurn ? "btn-primary" : "btn-ghost"}`} disabled={!payload.availableActions.canEndTurn || pending} onClick={() => sendAction({ type: "END_TURN" })}>
            End Turn
          </button>
        </div>
      </section>

      <section className="card mt-3 p-4">
        <h2 className="text-lg font-bold">Trading</h2>
        <p className="mt-1 text-xs text-slate-600">You can trade anytime: cash and/or properties for cash and/or properties.</p>

        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold">Create Trade Offer</p>
          <label className="mt-2 block text-xs font-semibold text-slate-700">Trade Partner</label>
          <select
            className="input mt-1"
            disabled={pending || !payload.availableActions.canProposeTrade || tradePartners.length === 0}
            onChange={(event) => {
              setTradeTargetId(event.target.value);
              setRequestedTileIds([]);
            }}
            value={selectedTradePartner?.id ?? ""}
          >
            {tradePartners.length === 0 && <option value="">No valid players</option>}
            {tradePartners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-700">
              You Offer Cash
              <input
                className="input mt-1"
                min={0}
                onChange={(event) => setTradeOfferCash(Math.max(0, Number(event.target.value) || 0))}
                type="number"
                value={tradeOfferCash}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              You Request Cash
              <input
                className="input mt-1"
                min={0}
                onChange={(event) => setTradeRequestCash(Math.max(0, Number(event.target.value) || 0))}
                type="number"
                value={tradeRequestCash}
              />
            </label>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2">
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs font-semibold text-slate-700">Your Properties to Offer</p>
              <div className="mt-1 space-y-1">
                {payload.playerState.properties.length === 0 && <p className="text-xs text-slate-500">No properties</p>}
                {payload.playerState.properties.map((tileId) => (
                  <label className="flex items-center gap-2 text-xs" key={`offer-${tileId}`}>
                    <input
                      checked={offeredTileIds.includes(tileId)}
                      onChange={() => toggleTile(offeredTileIds, tileId, setOfferedTileIds)}
                      type="checkbox"
                    />
                    {tileName(tileId)}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs font-semibold text-slate-700">
                {selectedTradePartner ? `${selectedTradePartner.name}'s Properties to Request` : "Requested Properties"}
              </p>
              <div className="mt-1 space-y-1">
                {!selectedTradePartner && <p className="text-xs text-slate-500">Select a trade partner</p>}
                {selectedTradePartner && selectedTradePartner.properties.length === 0 && <p className="text-xs text-slate-500">No properties</p>}
                {selectedTradePartner?.properties.map((tileId) => (
                  <label className="flex items-center gap-2 text-xs" key={`request-${tileId}`}>
                    <input
                      checked={requestedTileIds.includes(tileId)}
                      onChange={() => toggleTile(requestedTileIds, tileId, setRequestedTileIds)}
                      type="checkbox"
                    />
                    {tileName(tileId)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            className={`btn mt-3 w-full ${payload.availableActions.canProposeTrade ? "btn-primary" : "btn-ghost"}`}
            disabled={
              pending ||
              !payload.availableActions.canProposeTrade ||
              !selectedTradePartner ||
              tradeOfferCash > payload.playerState.cash ||
              (tradeOfferCash === 0 && tradeRequestCash === 0 && offeredTileIds.length === 0 && requestedTileIds.length === 0)
            }
            onClick={submitTradeOffer}
          >
            Send Trade Offer
          </button>
          {tradeOfferCash > payload.playerState.cash && <p className="mt-1 text-xs text-red-700">Offered cash exceeds your current cash.</p>}
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold">Incoming Offers</p>
          {incomingTrades.length === 0 && <p className="text-xs text-slate-600">No incoming offers.</p>}
          {!payload.availableActions.canRespondTrade && incomingTrades.length > 0 && (
            <p className="text-xs text-slate-600">You cannot respond to trades right now.</p>
          )}
          {incomingTrades.map((trade) => {
            const from = payload.state.players.find((player) => player.id === trade.fromPlayerId);
            return (
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs" key={trade.id}>
                <p className="font-semibold">{from?.name ?? "Player"} offered a trade</p>
                <p>They offer: ${trade.offeredCash}{trade.offeredTileIds.length > 0 ? ` + ${trade.offeredTileIds.map(tileName).join(", ")}` : ""}</p>
                <p>You give: ${trade.requestedCash}{trade.requestedTileIds.length > 0 ? ` + ${trade.requestedTileIds.map(tileName).join(", ")}` : ""}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    className={`btn ${payload.availableActions.canRespondTrade ? "btn-primary" : "btn-ghost"}`}
                    disabled={pending || !payload.availableActions.canRespondTrade}
                    onClick={() => sendAction({ type: "ACCEPT_TRADE", tradeId: trade.id, playerId: payload.player.id }, 120)}
                  >
                    Accept
                  </button>
                  <button className="btn btn-ghost" disabled={pending || !payload.availableActions.canRespondTrade} onClick={() => sendAction({ type: "REJECT_TRADE", tradeId: trade.id, playerId: payload.player.id }, 120)}>
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold">Your Outgoing Offers</p>
          {outgoingTrades.length === 0 && <p className="text-xs text-slate-600">No outgoing offers.</p>}
          {outgoingTrades.map((trade) => {
            const to = payload.state.players.find((player) => player.id === trade.toPlayerId);
            return (
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs" key={trade.id}>
                <p className="font-semibold">Offer to {to?.name ?? "Player"}</p>
                <p>You offer: ${trade.offeredCash}{trade.offeredTileIds.length > 0 ? ` + ${trade.offeredTileIds.map(tileName).join(", ")}` : ""}</p>
                <p>You request: ${trade.requestedCash}{trade.requestedTileIds.length > 0 ? ` + ${trade.requestedTileIds.map(tileName).join(", ")}` : ""}</p>
                <button className="btn btn-ghost mt-2" disabled={pending} onClick={() => sendAction({ type: "CANCEL_TRADE", tradeId: trade.id, playerId: payload.player.id }, 120)}>
                  Cancel
                </button>
              </div>
            );
          })}
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
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-700">
                {rentSchedule(auctionTile).map((entry) => (
                  <p key={`${auctionTile.id}-${entry.label}`}>
                    {entry.label}: ${entry.amount}
                  </p>
                ))}
              </div>
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

            const currentHouses = payload.state.propertyHouses?.[ownedTile.id] ?? 1;
            const buildCost = houseCostFromTile(ownedTile);
            const canBuildThisTurn =
              isPlayersTurn &&
              payload.availableActions.canBuildHouse &&
              ownedTile.type === "PROPERTY" &&
              currentHouses < 5 &&
              payload.playerState.cash >= buildCost;

            return (
              <div className="overflow-hidden rounded border border-slate-200 bg-slate-50" key={tileId}>
                <div className="h-2 w-full" style={{ backgroundColor: tileAccentColor(ownedTile) }} />
                <div className="p-2">
                  <p className="font-semibold">{ownedTile.name}</p>
                  <p className="text-xs text-slate-600">
                    {ownedTile.type}
                    {tilePrice(ownedTile) ? ` · $${tilePrice(ownedTile)}` : ""}
                    {ownedTile.type === "PROPERTY" ? ` · Houses: ${currentHouses}` : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-slate-700">
                    {rentSchedule(ownedTile).map((entry, index) => {
                      const active = ownedTile.type === "PROPERTY" && index === currentHouses - 1;
                      return (
                        <p className={active ? "font-bold text-emerald-700" : ""} key={`${ownedTile.id}-${entry.label}`}>
                          {entry.label}: ${entry.amount}
                        </p>
                      );
                    })}
                  </div>
                  {ownedTile.type === "PROPERTY" && (
                    <button
                      className={`btn mt-2 w-full ${canBuildThisTurn ? "btn-primary" : "btn-ghost"}`}
                      disabled={!canBuildThisTurn || pending}
                      onClick={() => sendAction({ type: "BUILD_HOUSE", tileId: ownedTile.id }, 180)}
                    >
                      Build House (+1) ${buildCost}
                    </button>
                  )}
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
