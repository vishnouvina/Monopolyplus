import { GameState } from "@/lib/domain/types";
import { baseRent, isPurchasableTile, tileAccentColor, tilePrice } from "@/lib/board/display";

function tilePosition(index: number) {
  // Uneven lane distribution:
  // bottom: 14 tiles, left: 8 tiles, top: 14 tiles, right: 8 tiles (total 40)
  const bottomCount = 14;
  const cols = 14;
  const rows = 8;

  if (index >= 0 && index <= 13) {
    return { row: rows - 1, col: cols - 1 - index };
  }

  if (index >= 14 && index <= 19) {
    return { row: rows - 2 - (index - 14), col: 0 };
  }

  if (index === 20) {
    return { row: 0, col: 0 };
  }

  if (index >= 21 && index <= 32) {
    return { row: 0, col: index - 20 };
  }

  if (index === 33) {
    return { row: 0, col: cols - 1 };
  }

  if (index >= 34 && index <= 39) {
    return { row: index - 33, col: cols - 1 };
  }

  // Fallback for non-standard indexes in custom boards.
  if (index < bottomCount) {
    return { row: rows - 1, col: Math.max(0, cols - 1 - index) };
  }

  const wrapped = index % 40;
  return { row: wrapped % rows, col: Math.floor(wrapped / rows) % cols };
}

export function BoardOverview({ state, isRolling, rollingPreview }: { state: GameState; isRolling?: boolean; rollingPreview?: [number, number] | null }) {
  const pawnsByTile: Record<number, string[]> = {};

  for (const player of state.players) {
    const atTile = pawnsByTile[player.position] ?? [];
    atTile.push(player.token);
    pawnsByTile[player.position] = atTile;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const currentTile = state.board.tiles[currentPlayer.position];
  const currentTileOwnerId = currentTile ? state.ownership[currentTile.id] : undefined;
  const currentTileOwner = currentTileOwnerId ? state.players.find((player) => player.id === currentTileOwnerId) : undefined;
  const pendingEffect = state.pendingEffect;
  const hasDoubleExtraTurn = state.phase === "AWAITING_ROLL" && Boolean(state.lastRoll?.isDouble);
  const centerTitle = pendingEffect ? "Pending Card" : "Current Tile";
  const centerText = pendingEffect?.cardText ?? currentTile.name;
  const centerTileColor = pendingEffect
    ? tileAccentColor(state.board.tiles[pendingEffect.tileIndex] ?? currentTile)
    : tileAccentColor(currentTile);
  const shownDice =
    isRolling && rollingPreview
      ? rollingPreview
      : state.lastRoll
        ? ([state.lastRoll.dieOne, state.lastRoll.dieTwo] as [number, number])
        : null;

  return (
    <div className="board-shell mt-3">
      <div className="board-grid">
        <div className="board-center">
          <h3 className="text-2xl font-black tracking-tight">MONOPOLY PLUS</h3>
          <p className="mt-1 text-sm text-slate-700">
            Turn {state.turnNumber} - {currentPlayer.name}
          </p>
          {hasDoubleExtraTurn && <p className="center-double-badge">Doubles rolled: extra turn for {currentPlayer.name}</p>}
          <div className={`dice-tray ${isRolling ? "dice-tray-rolling" : ""}`}>
            <div className="die-face">{shownDice?.[0] ?? "-"}</div>
            <div className="die-face">{shownDice?.[1] ?? "-"}</div>
          </div>
          <div className={`center-card ${pendingEffect ? "center-card-pending" : ""}`}>
            <div className="center-card-band" style={{ backgroundColor: centerTileColor }} />
            <div className="center-card-body">
              <p className="center-card-kicker">{centerTitle}</p>
              <p className="center-card-title">{centerText}</p>
              {!pendingEffect && isPurchasableTile(currentTile) && (
                <p className="center-card-row">
                  Price: {tilePrice(currentTile) ? `$${tilePrice(currentTile)}` : "N/A"} | Base Rent: {baseRent(currentTile) ? `$${baseRent(currentTile)}` : "N/A"}
                </p>
              )}
              {!pendingEffect && currentTile.type === "TAX" && <p className="center-card-row">Tax: ${currentTile.taxAmount ?? 0}</p>}
              {!pendingEffect && isPurchasableTile(currentTile) && <p className="center-card-row">Owner: {currentTileOwner ? currentTileOwner.name : "Unowned"}</p>}
              {pendingEffect && <p className="center-card-row">Activate from player/host controls to resolve this effect.</p>}
              {pendingEffect && <p className="center-card-waiting">Waiting for {currentPlayer.name}</p>}
            </div>
          </div>
        </div>

        {state.board.tiles.map((tile) => {
          const pos = tilePosition(tile.index);
          const ownerId = state.ownership[tile.id];
          const owner = ownerId ? state.players.find((player) => player.id === ownerId) : undefined;
          const price = tilePrice(tile);

          return (
            <div
              className={`board-tile ${tile.index === currentPlayer.position ? "board-tile-active" : ""}`}
              key={tile.id}
              style={{ gridRow: pos.row + 1, gridColumn: pos.col + 1 }}
            >
              <div className="board-tile-band" style={{ backgroundColor: tileAccentColor(tile) }} />
              <div className="board-tile-inner">
                <p className="board-tile-index">#{tile.index}</p>
                <p className="board-tile-name">{tile.name}</p>
                {isPurchasableTile(tile) && <p className="board-tile-meta">{price ? `$${price}` : "N/A"}</p>}
                {tile.type === "TAX" && <p className="board-tile-meta">${tile.taxAmount ?? 0}</p>}
                {owner && <p className="board-tile-owner">Owner: {owner.name}</p>}

                {(pawnsByTile[tile.index] ?? []).length > 0 && (
                  <div className="board-pawns">
                    {(pawnsByTile[tile.index] ?? []).map((pawn) => (
                      <span className="board-pawn-pill" key={`${tile.id}-${pawn}`}>
                        {pawn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
