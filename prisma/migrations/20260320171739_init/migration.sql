-- CreateTable
CREATE TABLE "BoardConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SETUP',
    "boardConfigId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_boardConfigId_fkey" FOREIGN KEY ("boardConfigId") REFERENCES "BoardConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "seatOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "diceOne" INTEGER,
    "diceTwo" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Turn_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "fromPlayerId" TEXT,
    "toPlayerId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "turnNumber" INTEGER,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropertyDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardConfigId" TEXT NOT NULL,
    "tileIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tileType" TEXT NOT NULL,
    "colorGroup" TEXT,
    "price" INTEGER,
    "rents" JSONB,
    CONSTRAINT "PropertyDefinition_boardConfigId_fkey" FOREIGN KEY ("boardConfigId") REFERENCES "BoardConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParsedCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardConfigId" TEXT NOT NULL,
    "deckType" TEXT NOT NULL,
    "name" TEXT,
    "text" TEXT NOT NULL,
    "effect" JSONB NOT NULL,
    CONSTRAINT "ParsedCard_boardConfigId_fkey" FOREIGN KEY ("boardConfigId") REFERENCES "BoardConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetParseSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardConfigId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assetsManifest" JSONB NOT NULL,
    "draftJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetParseSession_boardConfigId_fkey" FOREIGN KEY ("boardConfigId") REFERENCES "BoardConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_accessToken_key" ON "Player"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Player_gameId_seatOrder_key" ON "Player"("gameId", "seatOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssetParseSession_boardConfigId_key" ON "AssetParseSession"("boardConfigId");
