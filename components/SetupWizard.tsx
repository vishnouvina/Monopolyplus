"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BoardConfigSummary = {
  id: string;
  name: string;
  source: "DEFAULT" | "GENERATED" | "UPLOADED";
};

type ParsedDraft = {
  manifest: {
    boardImages: string[];
    propertyCards: string[];
    chanceCards: string[];
    communityCards: string[];
    unknown: string[];
  };
  draftBoard: unknown;
  warnings: string[];
};

const tokenOptions = [
  "Car",
  "Hat",
  "Dog",
  "Ship",
  "Thimble",
  "Boot",
  "Wheelbarrow",
  "Top Hat"
];

export function SetupWizard({ boards }: { boards: BoardConfigSummary[] }) {
  const router = useRouter();
  const [gameName, setGameName] = useState("Weekend Monopoly");
  const [boardMode, setBoardMode] = useState<"DEFAULT" | "EXISTING" | "UPLOADED">("DEFAULT");
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? "");
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState(
    Array.from({ length: 4 }, (_, idx) => ({ name: `Player ${idx + 1}`, token: tokenOptions[idx] }))
  );
  const [files, setFiles] = useState<File[]>([]);
  const [parsedDraft, setParsedDraft] = useState<ParsedDraft | null>(null);
  const [boardJsonText, setBoardJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersView = useMemo(
    () =>
      Array.from({ length: playerCount }, (_, idx) =>
        players[idx] ?? {
          name: `Player ${idx + 1}`,
          token: tokenOptions[idx % tokenOptions.length]
        }
      ),
    [playerCount, players]
  );

  function updatePlayer(index: number, key: "name" | "token", value: string) {
    const next = [...playersView];
    next[index] = {
      ...next[index],
      [key]: value
    };
    setPlayers(next);
  }

  async function parseAssets() {
    setError(null);
    setLoading(true);

    try {
      const form = new FormData();
      form.set("configName", `${gameName} Uploaded Board`);
      form.set("allowGemini", "true");
      for (const file of files) {
        form.append("assets", file);
      }

      const response = await fetch("/api/setup/parse-assets", {
        method: "POST",
        body: form
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to parse assets");
      }

      setParsedDraft(payload);
      setBoardJsonText(JSON.stringify(payload.draftBoard, null, 2));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown parse error");
    } finally {
      setLoading(false);
    }
  }

  async function createGame() {
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        gameName,
        players: playersView,
        boardMode
      };

      if (boardMode === "EXISTING") {
        body.boardConfigId = selectedBoardId;
      }

      if (boardMode === "UPLOADED") {
        body.boardJson = JSON.parse(boardJsonText);
        body.uploadedBoardName = `${gameName} Uploaded Board`;
      }

      const response = await fetch("/api/setup/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create game");
      }

      router.push(`/host/${payload.gameId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown setup error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="card p-6">
        <p className="badge">Monopoly Plus MVP</p>
        <h1 className="mt-3 text-3xl font-black">Hybrid Board Setup</h1>
        <p className="mt-2 text-sm text-slate-600">Configure board source, players, and launch host + QR-linked player sessions.</p>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-xl font-bold">1. Game Settings</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold">Game Name</label>
            <input className="input" value={gameName} onChange={(event) => setGameName(event.target.value)} />

            <label className="block text-sm font-semibold">Board Mode</label>
            <select className="input" value={boardMode} onChange={(event) => setBoardMode(event.target.value as typeof boardMode)}>
              <option value="DEFAULT">Generate default board</option>
              <option value="EXISTING">Use saved board config</option>
              <option value="UPLOADED">Upload and parse assets</option>
            </select>

            {boardMode === "EXISTING" && (
              <>
                <label className="block text-sm font-semibold">Saved Board</label>
                <select className="input" value={selectedBoardId} onChange={(event) => setSelectedBoardId(event.target.value)}>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name} ({board.source})
                    </option>
                  ))}
                </select>
              </>
            )}

            {boardMode === "UPLOADED" && (
              <>
                <label className="block text-sm font-semibold">Game Assets</label>
                <input
                  className="input"
                  type="file"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                <button className="btn btn-ghost" disabled={loading || files.length === 0} onClick={parseAssets}>
                  Parse Assets
                </button>
              </>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-xl font-bold">2. Players</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-semibold">Player Count</label>
            <input
              className="input"
              type="number"
              min={2}
              max={8}
              value={playerCount}
              onChange={(event) => setPlayerCount(Math.max(2, Math.min(8, Number(event.target.value) || 2)))}
            />

            {playersView.map((player, index) => (
              <div className="rounded-lg border border-slate-200 p-3" key={index}>
                <p className="mb-2 text-sm font-semibold">Player {index + 1}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="input"
                    value={player.name}
                    onChange={(event) => updatePlayer(index, "name", event.target.value)}
                    placeholder="Name"
                  />
                  <select
                    className="input"
                    value={player.token}
                    onChange={(event) => updatePlayer(index, "token", event.target.value)}
                  >
                    {tokenOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {boardMode === "UPLOADED" && parsedDraft && (
        <section className="card mt-6 p-5">
          <h2 className="text-xl font-bold">3. Parsed Draft Review</h2>
          <p className="mt-2 text-sm text-slate-600">Edit JSON before finalizing this board config.</p>
          {parsedDraft.warnings.length > 0 && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {parsedDraft.warnings.join(" ")}
            </div>
          )}
          <textarea
            className="input mt-4 min-h-64 font-mono text-xs"
            value={boardJsonText}
            onChange={(event) => setBoardJsonText(event.target.value)}
          />
        </section>
      )}

      {error && <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="mt-6">
        <button className="btn btn-primary" disabled={loading} onClick={createGame}>
          {loading ? "Working..." : "Create Game and Open Host UI"}
        </button>
      </section>
    </main>
  );
}
