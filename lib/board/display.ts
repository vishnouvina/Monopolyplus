import { TileDefinition } from "@/lib/domain/types";

export const COLOR_GROUP_COLORS: Record<string, string> = {
  BROWN: "#8b5a2b",
  LIGHT_BLUE: "#0ea5e9",
  PINK: "#db2777",
  ORANGE: "#ea580c",
  RED: "#dc2626",
  YELLOW: "#ca8a04",
  GREEN: "#16a34a",
  DARK_BLUE: "#1d4ed8",
  LIME: "#65a30d",
  CRIMSON: "#b91c1c",
  NAVY: "#1e3a8a"
};

export const SPECIAL_TILE_COLORS = {
  RAILROAD: "#334155",
  UTILITY: "#a16207",
  CHANCE: "#f59e0b",
  COMMUNITY_CHEST: "#7c3aed",
  TAX: "#e11d48",
  GO: "#0f766e",
  GO_TO_JAIL: "#be123c",
  FREE_PARKING: "#0369a1",
  JAIL: "#52525b",
  DEFAULT: "#64748b"
} as const;

const FALLBACK_GROUP_COLORS = ["#e11d48", "#0284c7", "#7c3aed", "#16a34a", "#ea580c", "#0f766e", "#1d4ed8", "#be123c"];

function normalizeGroup(group: string): string {
  return group.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function stableColorFromKey(key: string): string {
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return FALLBACK_GROUP_COLORS[hash % FALLBACK_GROUP_COLORS.length];
}

export function isPurchasableTile(tile?: TileDefinition | null): tile is TileDefinition {
  if (!tile) {
    return false;
  }
  return tile.type === "PROPERTY" || tile.type === "RAILROAD" || tile.type === "UTILITY";
}

export function tileAccentColor(tile: TileDefinition): string {
  if (tile.type === "PROPERTY" && tile.colorGroup) {
    const normalized = normalizeGroup(tile.colorGroup);
    return COLOR_GROUP_COLORS[normalized] ?? stableColorFromKey(normalized);
  }

  if (tile.type === "RAILROAD") {
    return SPECIAL_TILE_COLORS.RAILROAD;
  }

  if (tile.type === "UTILITY") {
    return SPECIAL_TILE_COLORS.UTILITY;
  }

  if (tile.type === "CHANCE") {
    return SPECIAL_TILE_COLORS.CHANCE;
  }

  if (tile.type === "COMMUNITY_CHEST") {
    return SPECIAL_TILE_COLORS.COMMUNITY_CHEST;
  }

  if (tile.type === "TAX") {
    return SPECIAL_TILE_COLORS.TAX;
  }

  if (tile.type === "GO") {
    return SPECIAL_TILE_COLORS.GO;
  }

  if (tile.type === "GO_TO_JAIL") {
    return SPECIAL_TILE_COLORS.GO_TO_JAIL;
  }

  if (tile.type === "FREE_PARKING") {
    return SPECIAL_TILE_COLORS.FREE_PARKING;
  }

  if (tile.type === "JAIL") {
    return SPECIAL_TILE_COLORS.JAIL;
  }

  return SPECIAL_TILE_COLORS.DEFAULT;
}

export function tilePrice(tile?: TileDefinition | null): number | undefined {
  if (!tile) {
    return undefined;
  }

  if (isPurchasableTile(tile)) {
    return tile.price;
  }

  return undefined;
}

export function baseRent(tile?: TileDefinition | null): number | undefined {
  if (!tile || !isPurchasableTile(tile)) {
    return undefined;
  }

  return tile.rents?.[0];
}
