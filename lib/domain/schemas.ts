import { z } from "zod";

const effectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GAIN_MONEY"), amount: z.number().int() }),
  z.object({ type: z.literal("PAY_MONEY"), amount: z.number().int() }),
  z.object({ type: z.literal("MOVE_TO"), tileIndex: z.number().int(), collectGo: z.boolean().optional() }),
  z.object({ type: z.literal("MOVE_BY"), steps: z.number().int() }),
  z.object({ type: z.literal("GO_TO_JAIL") }),
  z.object({ type: z.literal("COLLECT_FROM_PLAYERS"), amountPerPlayer: z.number().int() }),
  z.object({ type: z.literal("PAY_EACH_PLAYER"), amountPerPlayer: z.number().int() }),
  z.object({ type: z.literal("GET_OUT_OF_JAIL") }),
  z.object({ type: z.literal("NOOP") })
]);

export const cardSchema = z.object({
  id: z.string(),
  deck: z.enum(["CHANCE", "COMMUNITY_CHEST"]),
  text: z.string(),
  effect: effectSchema
});

export const tileSchema = z.object({
  id: z.string(),
  index: z.number().int(),
  name: z.string(),
  type: z.enum([
    "GO",
    "PROPERTY",
    "RAILROAD",
    "UTILITY",
    "TAX",
    "JAIL",
    "FREE_PARKING",
    "CHANCE",
    "COMMUNITY_CHEST",
    "GO_TO_JAIL",
    "SPECIAL"
  ]),
  taxAmount: z.number().int().optional(),
  price: z.number().int().optional(),
  rents: z.array(z.number().int()).optional(),
  colorGroup: z.string().optional(),
  houseCost: z.number().int().optional(),
  mortgageValue: z.number().int().optional()
});

export const ruleSchema = z.object({
  startCash: z.number().int(),
  passGoAmount: z.number().int(),
  jailFine: z.number().int(),
  auctionEnabled: z.boolean(),
  bankruptcyFloor: z.number().int()
});

export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  tiles: z.array(tileSchema).min(1),
  chanceDeck: z.array(cardSchema).min(1),
  communityChestDeck: z.array(cardSchema).min(1),
  rules: ruleSchema,
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

export const playerStateSchema = z.object({
  id: z.string(),
  accessToken: z.string(),
  name: z.string(),
  token: z.string(),
  cash: z.number().int(),
  position: z.number().int(),
  inJail: z.boolean(),
  jailTurns: z.number().int(),
  properties: z.array(z.string()),
  getOutOfJailCards: z.number().int(),
  bankrupt: z.boolean()
});

const transactionSchema = z.object({
  id: z.string(),
  turnNumber: z.number().int(),
  fromPlayerId: z.string().optional(),
  toPlayerId: z.string().optional(),
  amount: z.number().int(),
  reason: z.string(),
  metadata: z.record(z.unknown()).optional()
});

const gameEventSchema = z.object({
  id: z.string(),
  turnNumber: z.number().int(),
  type: z.string(),
  message: z.string(),
  payload: z.record(z.unknown()).optional()
});

const tradeOfferSchema = z.object({
  id: z.string(),
  fromPlayerId: z.string(),
  toPlayerId: z.string(),
  offeredCash: z.number().int().nonnegative(),
  requestedCash: z.number().int().nonnegative(),
  offeredTileIds: z.array(z.string()),
  requestedTileIds: z.array(z.string()),
  createdAtTurn: z.number().int().positive()
});

export const gameStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  board: boardSchema,
  players: z.array(playerStateSchema).min(2),
  currentPlayerIndex: z.number().int(),
  turnNumber: z.number().int(),
  phase: z.enum([
    "SETUP",
    "AWAITING_ROLL",
    "AWAITING_EFFECT_ACTIVATION",
    "AWAITING_RENT_PAYMENT",
    "AWAITING_PURCHASE_DECISION",
    "AUCTION",
    "AWAITING_END_TURN",
    "GAME_OVER"
  ]),
  chancePointer: z.number().int(),
  communityPointer: z.number().int(),
  ownership: z.record(z.string()),
  lastRoll: z
    .object({
      dieOne: z.number().int(),
      dieTwo: z.number().int(),
      total: z.number().int(),
      isDouble: z.boolean()
    })
    .optional(),
  pendingPurchase: z
    .object({
      tileIndex: z.number().int(),
      price: z.number().int()
    })
    .optional(),
  pendingEffect: z
    .object({
      tileIndex: z.number().int(),
      tileType: tileSchema.shape.type,
      cardText: z.string(),
      cardId: z.string().optional(),
      deck: z.enum(["CHANCE", "COMMUNITY_CHEST"]).optional(),
      effect: effectSchema
    })
    .optional(),
  pendingRent: z
    .object({
      tileIndex: z.number().int(),
      tileId: z.string(),
      ownerPlayerId: z.string(),
      amount: z.number().int().nonnegative()
    })
    .optional(),
  propertyHouses: z.record(z.number().int().min(1).max(5)).default({}),
  auction: z
    .object({
      tileIndex: z.number().int(),
      minBid: z.number().int(),
      participants: z.array(z.string()),
      bids: z.record(z.number().int())
    })
    .optional(),
  pendingTrades: z.array(tradeOfferSchema).default([]),
  transactions: z.array(transactionSchema),
  logs: z.array(gameEventSchema),
  winnerPlayerId: z.string().optional(),
  futureModifiers: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["PASSIVE_POWER", "GLOBAL_EVENT", "RULE_MODIFIER"]),
      name: z.string(),
      active: z.boolean(),
      params: z.record(z.unknown())
    })
  )
});

export const createGameInputSchema = z.object({
  gameName: z.string().min(2),
  boardId: z.string().min(1),
  players: z
    .array(
      z.object({
        name: z.string().min(1),
        token: z.string().min(1)
      })
    )
    .min(2)
    .max(8)
});

export const actionRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROLL_DICE") }),
  z.object({ type: z.literal("PAY_JAIL_FINE") }),
  z.object({ type: z.literal("USE_GET_OUT_OF_JAIL_CARD") }),
  z.object({ type: z.literal("ACTIVATE_TILE_EFFECT") }),
  z.object({ type: z.literal("PAY_RENT") }),
  z.object({ type: z.literal("BUILD_HOUSE"), tileId: z.string() }),
  z.object({
    type: z.literal("PROPOSE_TRADE"),
    fromPlayerId: z.string(),
    toPlayerId: z.string(),
    offeredCash: z.number().int().nonnegative(),
    requestedCash: z.number().int().nonnegative(),
    offeredTileIds: z.array(z.string()),
    requestedTileIds: z.array(z.string())
  }),
  z.object({ type: z.literal("ACCEPT_TRADE"), tradeId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("REJECT_TRADE"), tradeId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("CANCEL_TRADE"), tradeId: z.string(), playerId: z.string() }),
  z.object({
    type: z.literal("PLACE_AUCTION_BID"),
    playerId: z.string(),
    amount: z.number().int().nonnegative().refine((value) => value % 10 === 0, "Bid amount must be a multiple of 10.")
  }),
  z.object({ type: z.literal("PURCHASE_PROPERTY") }),
  z.object({ type: z.literal("DECLINE_PROPERTY") }),
  z.object({ type: z.literal("RESOLVE_AUCTION") }),
  z.object({ type: z.literal("END_TURN") })
]);

export const assetParseSchema = z.object({
  configName: z.string().min(1).default("Uploaded Board"),
  allowGemini: z.boolean().default(true)
});
