export type TileType =
  | "GO"
  | "PROPERTY"
  | "RAILROAD"
  | "UTILITY"
  | "TAX"
  | "JAIL"
  | "FREE_PARKING"
  | "CHANCE"
  | "COMMUNITY_CHEST"
  | "GO_TO_JAIL"
  | "SPECIAL";

export type TurnPhase =
  | "SETUP"
  | "AWAITING_ROLL"
  | "AWAITING_EFFECT_ACTIVATION"
  | "AWAITING_RENT_PAYMENT"
  | "AWAITING_PURCHASE_DECISION"
  | "AUCTION"
  | "AWAITING_END_TURN"
  | "GAME_OVER";

export type DeckType = "CHANCE" | "COMMUNITY_CHEST";

export type EffectDefinition =
  | { type: "GAIN_MONEY"; amount: number }
  | { type: "PAY_MONEY"; amount: number }
  | { type: "MOVE_TO"; tileIndex: number; collectGo?: boolean }
  | { type: "MOVE_BY"; steps: number }
  | { type: "GO_TO_JAIL" }
  | { type: "COLLECT_FROM_PLAYERS"; amountPerPlayer: number }
  | { type: "PAY_EACH_PLAYER"; amountPerPlayer: number }
  | { type: "GET_OUT_OF_JAIL" }
  | { type: "NOOP" };

export type CardDefinition = {
  id: string;
  deck: DeckType;
  text: string;
  effect: EffectDefinition;
};

export type TileDefinition = {
  id: string;
  index: number;
  name: string;
  type: TileType;
  taxAmount?: number;
  price?: number;
  rents?: number[];
  colorGroup?: string;
  houseCost?: number;
  mortgageValue?: number;
};

export type RuleConfig = {
  startCash: number;
  passGoAmount: number;
  jailFine: number;
  auctionEnabled: boolean;
  bankruptcyFloor: number;
};

export type BoardDefinition = {
  id: string;
  name: string;
  tiles: TileDefinition[];
  chanceDeck: CardDefinition[];
  communityChestDeck: CardDefinition[];
  rules: RuleConfig;
  metadata?: Record<string, string | number | boolean>;
};

export type PlayerState = {
  id: string;
  accessToken: string;
  name: string;
  token: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  properties: string[];
  getOutOfJailCards: number;
  bankrupt: boolean;
};

export type DiceRoll = {
  dieOne: number;
  dieTwo: number;
  total: number;
  isDouble: boolean;
};

export type PendingPurchase = {
  tileIndex: number;
  price: number;
};

export type PendingEffect = {
  tileIndex: number;
  tileType: TileType;
  cardText: string;
  cardId?: string;
  deck?: DeckType;
  effect: EffectDefinition;
};

export type PendingRent = {
  tileIndex: number;
  tileId: string;
  ownerPlayerId: string;
  amount: number;
};

export type AuctionState = {
  tileIndex: number;
  minBid: number;
  participants: string[];
  bids: Record<string, number>;
};

export type TradeOffer = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredCash: number;
  requestedCash: number;
  offeredTileIds: string[];
  requestedTileIds: string[];
  createdAtTurn: number;
};

export type TransactionEntry = {
  id: string;
  turnNumber: number;
  fromPlayerId?: string;
  toPlayerId?: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type GameEvent = {
  id: string;
  turnNumber: number;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
};

export type FutureRuleModifier = {
  id: string;
  kind: "PASSIVE_POWER" | "GLOBAL_EVENT" | "RULE_MODIFIER";
  name: string;
  active: boolean;
  params: Record<string, unknown>;
};

export type GameState = {
  id: string;
  name: string;
  board: BoardDefinition;
  players: PlayerState[];
  currentPlayerIndex: number;
  turnNumber: number;
  phase: TurnPhase;
  ownership: Record<string, string>;
  lastRoll?: DiceRoll;
  pendingPurchase?: PendingPurchase;
  pendingEffect?: PendingEffect;
  pendingRent?: PendingRent;
  propertyHouses: Record<string, number>;
  auction?: AuctionState;
  pendingTrades: TradeOffer[];
  transactions: TransactionEntry[];
  logs: GameEvent[];
  winnerPlayerId?: string;
  // Reserved extension point for future RPG-lite/global modifiers.
  futureModifiers: FutureRuleModifier[];
};

export type GameAction =
  | { type: "ROLL_DICE"; forcedDice?: [number, number] }
  | { type: "PAY_JAIL_FINE" }
  | { type: "USE_GET_OUT_OF_JAIL_CARD" }
  | { type: "ACTIVATE_TILE_EFFECT" }
  | { type: "PAY_RENT" }
  | { type: "BUILD_HOUSE"; tileId: string }
  | {
      type: "PROPOSE_TRADE";
      fromPlayerId: string;
      toPlayerId: string;
      offeredCash: number;
      requestedCash: number;
      offeredTileIds: string[];
      requestedTileIds: string[];
    }
  | { type: "ACCEPT_TRADE"; tradeId: string; playerId: string }
  | { type: "REJECT_TRADE"; tradeId: string; playerId: string }
  | { type: "CANCEL_TRADE"; tradeId: string; playerId: string }
  | { type: "PLACE_AUCTION_BID"; playerId: string; amount: number }
  | { type: "PURCHASE_PROPERTY" }
  | { type: "DECLINE_PROPERTY" }
  | { type: "RESOLVE_AUCTION" }
  | { type: "END_TURN" };

export type EngineResult = {
  state: GameState;
  newEvents: GameEvent[];
  newTransactions: TransactionEntry[];
};

export type CreateGameInput = {
  name: string;
  board: BoardDefinition;
  players: Array<{ name: string; token: string; accessToken: string; id: string }>;
};
