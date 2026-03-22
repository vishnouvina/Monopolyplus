# Monopoly Plus (MVP)

Local-first Monopoly-like web app with:
- one host screen
- one player screen per token (QR link)
- deterministic game engine
- optional Gemini asset parsing for custom boards/cards

## Quick start

### Requirements
- Node 22 (recommended)
- npm

If you use `nvm`:
```bash
nvm use
```

### Setup
```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run prisma:generate
npm run prisma:seed
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Environment variables

- `DATABASE_URL` (required)
  - default: `file:./dev.db`
- `NEXT_PUBLIC_BASE_URL` (recommended for QR links)
  - default: `http://localhost:3000`
- `GEMINI_API_KEY` (optional)
  - used only for asset parsing
  - default model: `gemini-flash-lite-latest`

## Core gameplay (current)

Implemented:
- turn order and active player
- dice roll + movement + pass GO
- manual card activation (`Chance`, `Community Chest`, `Go To Jail`)
- property buy / decline
- auction flow
  - landing player cannot bid
  - other players bid from their own UI in `+10/-10` steps
  - host resolves auction
- rent payment via explicit `Pay Rent` action
- tax, jail, bankruptcy, winner detection
- transaction log and game log

## Host + player flow

1. Create game on setup screen.
2. Open host screen at `/host/:gameId`.
3. Share player QR links from host UI.
4. Players open `/player/:token` on their phones.

Player UI shows:
- cash / position / owned properties
- current property card
- dice result when it is their turn
- available actions highlighted when actionable

## Custom assets / ingestion

Supported upload categories (filename-based + optional Gemini extraction):
- board images
- property card images
- chance card images
- community chest card images

Workflow:
1. Upload assets in setup.
2. Parse to draft JSON.
3. Review/edit JSON.
4. Create game from finalized board config.

If Gemini is unavailable, deterministic fallback parsing is used.

## Tech stack

- Next.js (App Router) + React + TypeScript
- Prisma + SQLite
- Zod validation
- Tailwind CSS
- Vitest tests

## Project layout

```text
app/
  api/
  host/[gameId]/
  player/[token]/
components/
lib/
  board/
  domain/
  engine/
  ingestion/
  services/
  future/
prisma/
tests/
sample-assets/
```

## Scripts

```bash
npm run dev
npm run build
npm test
npm run prisma:seed
```

## Tests

Current tests cover:
- movement / pass GO
- purchase flow
- rent flow
- card activation flow
- doubles behavior
- auction eligibility + bidding
- bankruptcy
- palette uniqueness constraints

## Known limits (MVP)

- polling sync (no WebSockets yet)
- no trading system
- no houses/hotels management UI
- no production auth (token URL sessions for local play)
- no IRL camera tracking implementation yet (interfaces are scaffolded)

## Future extension points already in code

- IRL tracking interfaces:
  - `BoardStateProvider`
  - `PhysicalBoardTracker`
  - `MoveConfirmationLayer`
- RPG-lite placeholder:
  - `futureModifiers` in game state (inactive)
