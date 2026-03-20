import { createDefaultBoardConfig } from "@/lib/board/defaultBoard";
import { BoardDefinition, CardDefinition, EffectDefinition } from "@/lib/domain/types";
import { GeminiClient } from "@/lib/services/geminiClient";

export type UploadedAsset = {
  name: string;
  mimeType: string;
  bytes: Buffer;
};

type ParseDraft = {
  manifest: {
    boardImages: string[];
    propertyCards: string[];
    chanceCards: string[];
    communityCards: string[];
    unknown: string[];
  };
  draftBoard: BoardDefinition;
  warnings: string[];
};

type ParsedProperty = {
  propertyName: string;
  price?: number;
  baseRent?: number;
  colorGroup?: string;
};

function normalize(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function classify(assets: UploadedAsset[]) {
  const grouped = {
    boardImages: [] as UploadedAsset[],
    propertyCards: [] as UploadedAsset[],
    chanceCards: [] as UploadedAsset[],
    communityCards: [] as UploadedAsset[],
    unknown: [] as UploadedAsset[]
  };

  for (const asset of assets) {
    const key = asset.name.toLowerCase();
    if (key.includes("board")) {
      grouped.boardImages.push(asset);
    } else if (key.includes("property")) {
      grouped.propertyCards.push(asset);
    } else if (key.includes("chance")) {
      grouped.chanceCards.push(asset);
    } else if (key.includes("community") || key.includes("chest")) {
      grouped.communityCards.push(asset);
    } else {
      grouped.unknown.push(asset);
    }
  }

  return grouped;
}

function inferEffectFromText(text: string): EffectDefinition {
  const lc = text.toLowerCase();

  const gainMatch = lc.match(/collect\s*\$?(\d+)/) ?? lc.match(/receive\s*\$?(\d+)/);
  if (gainMatch) {
    return { type: "GAIN_MONEY", amount: Number(gainMatch[1]) };
  }

  const payMatch = lc.match(/pay\s*\$?(\d+)/);
  if (payMatch) {
    return { type: "PAY_MONEY", amount: Number(payMatch[1]) };
  }

  if (lc.includes("go to jail")) {
    return { type: "GO_TO_JAIL" };
  }

  if (lc.includes("advance to go")) {
    return { type: "MOVE_TO", tileIndex: 0, collectGo: true };
  }

  return { type: "NOOP" };
}

function cardFromFilename(fileName: string, deck: "CHANCE" | "COMMUNITY_CHEST", index: number): CardDefinition {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replaceAll(/[_-]+/g, " ")
    .replace(/\b(chance|community|chest|card)\b/gi, "")
    .trim();

  const text = base.length > 0 ? base : `${deck} card ${index + 1}`;
  return {
    id: `${deck.toLowerCase()}-${index + 1}`,
    deck,
    text,
    effect: inferEffectFromText(text)
  };
}

function parsePropertyFromFilename(fileName: string): ParsedProperty | null {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const tokens = base.split(/[_-]+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const numbers = tokens
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value) && value > 0);

  const propertyName = tokens
    .filter((token) => Number.isNaN(Number(token)) && token !== "property" && token !== "card")
    .join(" ")
    .trim();

  if (!propertyName) {
    return null;
  }

  return {
    propertyName,
    price: numbers[0],
    baseRent: numbers[1]
  };
}

async function parsePropertyWithGemini(client: GeminiClient, asset: UploadedAsset): Promise<ParsedProperty | null> {
  try {
    const result = (await client.parseImagesToJson({
      prompt:
        "Extract monopoly property card data with keys propertyName, price, baseRent, colorGroup. If unknown return null values.",
      images: [{ mimeType: asset.mimeType, bytes: asset.bytes }]
    })) as ParsedProperty;

    if (!result || typeof result !== "object") {
      return null;
    }

    return {
      propertyName: String(result.propertyName ?? "").trim(),
      price: typeof result.price === "number" ? result.price : undefined,
      baseRent: typeof result.baseRent === "number" ? result.baseRent : undefined,
      colorGroup: typeof result.colorGroup === "string" ? result.colorGroup : undefined
    };
  } catch {
    return null;
  }
}

function applyParsedProperties(board: BoardDefinition, parsedProperties: ParsedProperty[]) {
  for (const parsed of parsedProperties) {
    const match = board.tiles.find((tile) => {
      if (!["PROPERTY", "RAILROAD", "UTILITY"].includes(tile.type)) {
        return false;
      }
      return normalize(tile.name) === normalize(parsed.propertyName);
    });

    if (!match) {
      continue;
    }

    if (typeof parsed.price === "number") {
      match.price = parsed.price;
    }

    if (typeof parsed.baseRent === "number") {
      const currentRents = match.rents ?? [parsed.baseRent];
      currentRents[0] = parsed.baseRent;
      match.rents = currentRents;
    }

    if (parsed.colorGroup) {
      match.colorGroup = parsed.colorGroup.toUpperCase();
    }
  }
}

export async function parseAssetsToDraft(input: {
  assets: UploadedAsset[];
  configName: string;
  allowGemini: boolean;
}) {
  const grouped = classify(input.assets);
  const warnings: string[] = [];
  const board = createDefaultBoardConfig();
  board.id = `uploaded-${Date.now()}`;
  board.name = input.configName;
  board.metadata = {
    generated: false,
    source: "uploaded",
    boardImages: grouped.boardImages.length,
    propertyCards: grouped.propertyCards.length,
    chanceCards: grouped.chanceCards.length,
    communityCards: grouped.communityCards.length
  };

  const gemini = new GeminiClient();
  const shouldUseGemini = input.allowGemini && gemini.isEnabled();
  if (!shouldUseGemini) {
    warnings.push("Gemini unavailable or disabled. Parsed data uses deterministic filename heuristics.");
  }

  const parsedProperties: ParsedProperty[] = [];
  for (const file of grouped.propertyCards) {
    const viaGemini = shouldUseGemini ? await parsePropertyWithGemini(gemini, file) : null;
    const fallback = parsePropertyFromFilename(file.name);
    const parsed = viaGemini?.propertyName ? viaGemini : fallback;
    if (parsed) {
      parsedProperties.push(parsed);
    }
  }

  applyParsedProperties(board, parsedProperties);

  if (grouped.chanceCards.length > 0) {
    board.chanceDeck = grouped.chanceCards.map((asset, idx) => cardFromFilename(asset.name, "CHANCE", idx));
  }

  if (grouped.communityCards.length > 0) {
    board.communityChestDeck = grouped.communityCards.map((asset, idx) => cardFromFilename(asset.name, "COMMUNITY_CHEST", idx));
  }

  if (grouped.boardImages.length === 0) {
    warnings.push("No board image detected. Tile order currently mirrors the default board template.");
  }

  const draft: ParseDraft = {
    manifest: {
      boardImages: grouped.boardImages.map((asset) => asset.name),
      propertyCards: grouped.propertyCards.map((asset) => asset.name),
      chanceCards: grouped.chanceCards.map((asset) => asset.name),
      communityCards: grouped.communityCards.map((asset) => asset.name),
      unknown: grouped.unknown.map((asset) => asset.name)
    },
    draftBoard: board,
    warnings
  };

  return draft;
}
