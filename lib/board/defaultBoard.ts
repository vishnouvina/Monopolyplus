import { BoardDefinition, TileDefinition } from "@/lib/domain/types";

function tile(input: Omit<TileDefinition, "id">): TileDefinition {
  return {
    ...input,
    id: `tile-${input.index}`
  };
}

export function createDefaultBoardConfig(): BoardDefinition {
  const tiles: TileDefinition[] = [
    tile({ index: 0, name: "GO", type: "GO" }),
    tile({ index: 1, name: "Mediterranean Avenue", type: "PROPERTY", colorGroup: "BROWN", price: 60, rents: [2, 10, 30, 90, 160, 250] }),
    tile({ index: 2, name: "Community Chest", type: "COMMUNITY_CHEST" }),
    tile({ index: 3, name: "Baltic Avenue", type: "PROPERTY", colorGroup: "BROWN", price: 60, rents: [4, 20, 60, 180, 320, 450] }),
    tile({ index: 4, name: "Income Tax", type: "TAX", taxAmount: 200 }),
    tile({ index: 5, name: "Reading Railroad", type: "RAILROAD", price: 200, rents: [25, 50, 100, 200] }),
    tile({ index: 6, name: "Oriental Avenue", type: "PROPERTY", colorGroup: "LIGHT_BLUE", price: 100, rents: [6, 30, 90, 270, 400, 550] }),
    tile({ index: 7, name: "Chance", type: "CHANCE" }),
    tile({ index: 8, name: "Vermont Avenue", type: "PROPERTY", colorGroup: "LIGHT_BLUE", price: 100, rents: [6, 30, 90, 270, 400, 550] }),
    tile({ index: 9, name: "Connecticut Avenue", type: "PROPERTY", colorGroup: "LIGHT_BLUE", price: 120, rents: [8, 40, 100, 300, 450, 600] }),
    tile({ index: 10, name: "Jail / Just Visiting", type: "JAIL" }),
    tile({ index: 11, name: "St. Charles Place", type: "PROPERTY", colorGroup: "PINK", price: 140, rents: [10, 50, 150, 450, 625, 750] }),
    tile({ index: 12, name: "Electric Company", type: "UTILITY", price: 150, rents: [4, 10] }),
    tile({ index: 13, name: "States Avenue", type: "PROPERTY", colorGroup: "PINK", price: 140, rents: [10, 50, 150, 450, 625, 750] }),
    tile({ index: 14, name: "Virginia Avenue", type: "PROPERTY", colorGroup: "PINK", price: 160, rents: [12, 60, 180, 500, 700, 900] }),
    tile({ index: 15, name: "Pennsylvania Railroad", type: "RAILROAD", price: 200, rents: [25, 50, 100, 200] }),
    tile({ index: 16, name: "St. James Place", type: "PROPERTY", colorGroup: "ORANGE", price: 180, rents: [14, 70, 200, 550, 750, 950] }),
    tile({ index: 17, name: "Community Chest", type: "COMMUNITY_CHEST" }),
    tile({ index: 18, name: "Tennessee Avenue", type: "PROPERTY", colorGroup: "ORANGE", price: 180, rents: [14, 70, 200, 550, 750, 950] }),
    tile({ index: 19, name: "New York Avenue", type: "PROPERTY", colorGroup: "ORANGE", price: 200, rents: [16, 80, 220, 600, 800, 1000] }),
    tile({ index: 20, name: "Free Parking", type: "FREE_PARKING" }),
    tile({ index: 21, name: "Kentucky Avenue", type: "PROPERTY", colorGroup: "RED", price: 220, rents: [18, 90, 250, 700, 875, 1050] }),
    tile({ index: 22, name: "Chance", type: "CHANCE" }),
    tile({ index: 23, name: "Indiana Avenue", type: "PROPERTY", colorGroup: "RED", price: 220, rents: [18, 90, 250, 700, 875, 1050] }),
    tile({ index: 24, name: "Illinois Avenue", type: "PROPERTY", colorGroup: "RED", price: 240, rents: [20, 100, 300, 750, 925, 1100] }),
    tile({ index: 25, name: "B. & O. Railroad", type: "RAILROAD", price: 200, rents: [25, 50, 100, 200] }),
    tile({ index: 26, name: "Atlantic Avenue", type: "PROPERTY", colorGroup: "YELLOW", price: 260, rents: [22, 110, 330, 800, 975, 1150] }),
    tile({ index: 27, name: "Ventnor Avenue", type: "PROPERTY", colorGroup: "YELLOW", price: 260, rents: [22, 110, 330, 800, 975, 1150] }),
    tile({ index: 28, name: "Water Works", type: "UTILITY", price: 150, rents: [4, 10] }),
    tile({ index: 29, name: "Marvin Gardens", type: "PROPERTY", colorGroup: "YELLOW", price: 280, rents: [24, 120, 360, 850, 1025, 1200] }),
    tile({ index: 30, name: "Go To Jail", type: "GO_TO_JAIL" }),
    tile({ index: 31, name: "Pacific Avenue", type: "PROPERTY", colorGroup: "GREEN", price: 300, rents: [26, 130, 390, 900, 1100, 1275] }),
    tile({ index: 32, name: "North Carolina Avenue", type: "PROPERTY", colorGroup: "GREEN", price: 300, rents: [26, 130, 390, 900, 1100, 1275] }),
    tile({ index: 33, name: "Community Chest", type: "COMMUNITY_CHEST" }),
    tile({ index: 34, name: "Pennsylvania Avenue", type: "PROPERTY", colorGroup: "GREEN", price: 320, rents: [28, 150, 450, 1000, 1200, 1400] }),
    tile({ index: 35, name: "Short Line", type: "RAILROAD", price: 200, rents: [25, 50, 100, 200] }),
    tile({ index: 36, name: "Chance", type: "CHANCE" }),
    tile({ index: 37, name: "Park Place", type: "PROPERTY", colorGroup: "DARK_BLUE", price: 350, rents: [35, 175, 500, 1100, 1300, 1500] }),
    tile({ index: 38, name: "Luxury Tax", type: "TAX", taxAmount: 100 }),
    tile({ index: 39, name: "Boardwalk", type: "PROPERTY", colorGroup: "DARK_BLUE", price: 400, rents: [50, 200, 600, 1400, 1700, 2000] })
  ];

  const chanceDeck = [
    { id: "chance-1", deck: "CHANCE" as const, text: "Advance to GO. Collect $200.", effect: { type: "MOVE_TO", tileIndex: 0, collectGo: true } as const },
    { id: "chance-2", deck: "CHANCE" as const, text: "Advance to Illinois Avenue.", effect: { type: "MOVE_TO", tileIndex: 24 } as const },
    { id: "chance-3", deck: "CHANCE" as const, text: "Advance to St. Charles Place.", effect: { type: "MOVE_TO", tileIndex: 11 } as const },
    { id: "chance-4", deck: "CHANCE" as const, text: "Advance to Electric Company.", effect: { type: "MOVE_TO", tileIndex: 12 } as const },
    { id: "chance-5", deck: "CHANCE" as const, text: "Take a trip to Reading Railroad.", effect: { type: "MOVE_TO", tileIndex: 5 } as const },
    { id: "chance-6", deck: "CHANCE" as const, text: "Bank pays you dividend of $50.", effect: { type: "GAIN_MONEY", amount: 50 } as const },
    { id: "chance-7", deck: "CHANCE" as const, text: "Get Out of Jail Free.", effect: { type: "GET_OUT_OF_JAIL" } as const },
    { id: "chance-8", deck: "CHANCE" as const, text: "Go back 3 spaces.", effect: { type: "MOVE_BY", steps: -3 } as const },
    { id: "chance-9", deck: "CHANCE" as const, text: "Go to Jail. Do not pass GO.", effect: { type: "GO_TO_JAIL" } as const },
    { id: "chance-10", deck: "CHANCE" as const, text: "Make general repairs. Pay $40.", effect: { type: "PAY_MONEY", amount: 40 } as const },
    { id: "chance-11", deck: "CHANCE" as const, text: "Pay poor tax of $15.", effect: { type: "PAY_MONEY", amount: 15 } as const },
    { id: "chance-12", deck: "CHANCE" as const, text: "Your building loan matures. Receive $150.", effect: { type: "GAIN_MONEY", amount: 150 } as const },
    { id: "chance-13", deck: "CHANCE" as const, text: "You have won a crossword competition. Collect $100.", effect: { type: "GAIN_MONEY", amount: 100 } as const },
    { id: "chance-14", deck: "CHANCE" as const, text: "You have been elected chairman. Pay each player $50.", effect: { type: "PAY_EACH_PLAYER", amountPerPlayer: 50 } as const },
    { id: "chance-15", deck: "CHANCE" as const, text: "Speeding fine $15.", effect: { type: "PAY_MONEY", amount: 15 } as const },
    { id: "chance-16", deck: "CHANCE" as const, text: "Advance token to Boardwalk.", effect: { type: "MOVE_TO", tileIndex: 39 } as const }
  ];

  const communityChestDeck = [
    { id: "cc-1", deck: "COMMUNITY_CHEST" as const, text: "Advance to GO. Collect $200.", effect: { type: "MOVE_TO", tileIndex: 0, collectGo: true } as const },
    { id: "cc-2", deck: "COMMUNITY_CHEST" as const, text: "Bank error in your favor. Collect $200.", effect: { type: "GAIN_MONEY", amount: 200 } as const },
    { id: "cc-3", deck: "COMMUNITY_CHEST" as const, text: "Doctor's fees. Pay $50.", effect: { type: "PAY_MONEY", amount: 50 } as const },
    { id: "cc-4", deck: "COMMUNITY_CHEST" as const, text: "From sale of stock you get $50.", effect: { type: "GAIN_MONEY", amount: 50 } as const },
    { id: "cc-5", deck: "COMMUNITY_CHEST" as const, text: "Get Out of Jail Free.", effect: { type: "GET_OUT_OF_JAIL" } as const },
    { id: "cc-6", deck: "COMMUNITY_CHEST" as const, text: "Go to Jail. Do not pass GO.", effect: { type: "GO_TO_JAIL" } as const },
    { id: "cc-7", deck: "COMMUNITY_CHEST" as const, text: "Holiday fund matures. Receive $100.", effect: { type: "GAIN_MONEY", amount: 100 } as const },
    { id: "cc-8", deck: "COMMUNITY_CHEST" as const, text: "Income tax refund. Collect $20.", effect: { type: "GAIN_MONEY", amount: 20 } as const },
    { id: "cc-9", deck: "COMMUNITY_CHEST" as const, text: "It is your birthday. Collect $10 from every player.", effect: { type: "COLLECT_FROM_PLAYERS", amountPerPlayer: 10 } as const },
    { id: "cc-10", deck: "COMMUNITY_CHEST" as const, text: "Life insurance matures. Collect $100.", effect: { type: "GAIN_MONEY", amount: 100 } as const },
    { id: "cc-11", deck: "COMMUNITY_CHEST" as const, text: "Hospital fees. Pay $100.", effect: { type: "PAY_MONEY", amount: 100 } as const },
    { id: "cc-12", deck: "COMMUNITY_CHEST" as const, text: "Pay school fees of $50.", effect: { type: "PAY_MONEY", amount: 50 } as const },
    { id: "cc-13", deck: "COMMUNITY_CHEST" as const, text: "Receive consultancy fee. Collect $25.", effect: { type: "GAIN_MONEY", amount: 25 } as const },
    { id: "cc-14", deck: "COMMUNITY_CHEST" as const, text: "You are assessed for street repairs. Pay $40.", effect: { type: "PAY_MONEY", amount: 40 } as const },
    { id: "cc-15", deck: "COMMUNITY_CHEST" as const, text: "You have won second prize in a beauty contest. Collect $10.", effect: { type: "GAIN_MONEY", amount: 10 } as const },
    { id: "cc-16", deck: "COMMUNITY_CHEST" as const, text: "You inherit $100.", effect: { type: "GAIN_MONEY", amount: 100 } as const }
  ];

  return {
    id: "default-monopoly-inspired",
    name: "Default Monopoly-Inspired Board",
    tiles,
    chanceDeck,
    communityChestDeck,
    rules: {
      startCash: 1500,
      passGoAmount: 200,
      jailFine: 50,
      auctionEnabled: true,
      bankruptcyFloor: 0
    },
    metadata: {
      version: "v1",
      generated: true
    }
  };
}
