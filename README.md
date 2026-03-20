# Monopoly Plus MVP (v1)

Hybrid Monopoly-like board game platform with one host screen, one player screen per token via QR, deterministic game engine, and optional Gemini-backed asset parsing.

## Stack

- Frontend/Backend: Next.js App Router + React + TypeScript
- DB: SQLite + Prisma
- Validation: Zod
- Styling: Tailwind CSS
- QR: `qrcode.react`
- Tests: Vitest
- LLM: Gemini only (`@google/generative-ai`), used only for asset parsing

## What v1 includes

- Setup flow for host:
  - Default/generated board
  - Existing board config
  - Uploaded assets parse flow (board/cards)
- Asset ingestion pipeline:
  - Classifies uploaded files
  - Gemini parsing when available
  - Deterministic filename fallback when Gemini is unavailable
  - Host JSON review/edit before creating a game
- Core game loop:
  - Turn order and active player
  - Dice rolling
  - Movement + pass GO
  - Property purchase/decline
  - Auction flow (host bid resolution)
  - Rent/tax handling
  - Jail handling
  - Chance/Community draw + effect execution
  - Bankruptcy + winner detection
- Central host UI:
  - Board overview
  - Controls
  - Auction panel
  - Ownership/cash
  - Log stream
  - QR + links for each player session
- Player UI:
  - Mobile-friendly snapshot
  - Available actions on own turn
  - Cash, properties, relevant events
  - Reconnect using token URL
- Extension interfaces for future IRL tracking:
  - `BoardStateProvider`
  - `PhysicalBoardTracker`
  - `MoveConfirmationLayer`
- Extension-safe structure for future RPG-lite features via `futureModifiers`

## Project structure

```text
app/
  api/
    setup/
      boards/
      create/
      parse-assets/
    games/[gameId]/
      state/
      action/
    player/[token]/state/
  host/[gameId]/
  player/[token]/
  layout.tsx
  page.tsx
components/
  SetupWizard.tsx
  HostDashboard.tsx
  PlayerDashboard.tsx
lib/
  board/defaultBoard.ts
  domain/{types.ts,schemas.ts}
  engine/{dice.ts,gameFactory.ts,gameEngine.ts}
  ingestion/assetParsingService.ts
  services/{prisma.ts,gameService.ts,geminiClient.ts}
  future/interfaces.ts
prisma/
  schema.prisma
  seed.ts
tests/
  gameEngine.test.ts
sample-assets/
  game-assets/*
  mock-parsed-board.json
```

## Architecture summary

### 1) Engine-first design

- Source of truth: serialized `GameState` JSON in DB.
- API routes validate input and call engine actions.
- Engine (`applyGameAction`) is deterministic and handles rules.
- UI never hardcodes game rules.

### 2) Board + rules decoupled from UI

- `BoardDefinition` drives tiles/decks/rules.
- Default board generator in `lib/board/defaultBoard.ts`.
- Uploaded boards stored as persisted board configs.

### 3) Parsing workflow

1. Upload assets in setup UI.
2. `parse-assets` route builds manifest and parses draft board.
3. Gemini used only for multimodal extraction (if key exists).
4. Host edits/approves JSON.
5. Approved board saved as `BoardConfig`; game created from that.

### 4) Realtime mechanism

- v1 uses short-interval polling for host/player clients.
- Clean upgrade path to WebSockets by swapping transport, keeping same action/state APIs.

### 5) Future modules (not active in v1)

- Physical board tracking boundaries are isolated in `lib/future/interfaces.ts`.
- RPG-lite reserved via `futureModifiers` in game state (not surfaced in v1 UI/rules).

## Local setup

0. Use Node 22 LTS (`.nvmrc` is included):

```bash
nvm use
```

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

3. Create DB and Prisma client:

```bash
npx prisma migrate dev --name init
npm run prisma:generate
```

4. Seed default board + sample game:

```bash
npm run prisma:seed
```

5. Start app:

```bash
npm run dev
```

6. Open host setup:

- [http://localhost:3000](http://localhost:3000)

## Environment variables

- `DATABASE_URL` (required): SQLite URL (`file:./dev.db`)
- `NEXT_PUBLIC_BASE_URL` (recommended): used for player link generation
- `GEMINI_API_KEY` (optional): enables Gemini-powered image parsing
- Default Gemini model in code: `gemini-flash-lite-latest` (overrideable per request)

## QR-code local play flow

1. Host creates game in setup.
2. Host UI (`/host/:gameId`) renders one player URL + QR per player token.
3. Each player scans their QR to open `/player/:accessToken`.
4. Player UI shows that player's state and actions for their turn.
5. Reconnection is URL-based using the same token.

## Core tests included

- Dice + movement + pass GO
- Property purchase
- Rent transfers
- Chance/community auto resolution
- Turn transitions
- Bankruptcy and game-over edge case

Run tests:

```bash
npm test
```

## Current v1 limitations

- Polling instead of WebSockets
- Auction is single-resolution bid submission (no multi-round live bidding)
- No trading workflow
- No houses/hotels build flow UI (engine stores rent tiers but v1 uses base rent)
- No production auth (token URL approach for local sessions)
- Uploaded board tile order currently defaults to template unless manually edited in JSON review

## Future IRL board tracking integration plan

1. Add camera/frame ingest service implementing `PhysicalBoardTracker`.
2. Add calibration UI and save per-board transform.
3. Feed detections through `BoardStateProvider`.
4. Compare predicted vs engine state with `MoveConfirmationLayer`.
5. Host resolves mismatches before committing actions.

The game engine remains independent from computer vision modules.

## Future RPG-lite extension plan

1. Introduce passive powers as rule modifiers linked to players.
2. Add global events and timed rule effects into `futureModifiers`.
3. Resolve modifiers in pre/post-action hooks around `applyGameAction`.
4. Keep card effects deterministic and composable with modifier pipeline.

## Sample assets

- `sample-assets/game-assets/` includes SVG cards/board examples.
- `sample-assets/mock-parsed-board.json` provides a mock normalized board config.
