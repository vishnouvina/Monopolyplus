# Architecture Notes

## Engine boundaries

- `lib/engine/*` is pure business logic.
- `applyGameAction()` receives `GameState + GameAction` and returns a new state plus events/transactions.
- Deterministic rules are implemented in code, never delegated to LLMs.
- Engine modules are now split by responsibility:
  - `gameEngine.ts`: action dispatcher + turn orchestration
  - `common.ts`: state lookup + event/transaction helpers
  - `economy.ts`: money transfer, bankruptcy, rent, winner detection
  - `jail.ts`: jail-specific actions
  - `trade.ts`: trade lifecycle
  - `validators.ts`: reusable rule guards for complex actions

## Service boundaries

- `lib/services/gameService.ts` handles persistence and state snapshots.
- DB writes are transactionally grouped per action (state + turn + log + transactions).
- Snapshot state keeps a rolling window of logs/transactions; DB tables remain the long-term history source.
- `lib/services/geminiClient.ts` is the only LLM adapter.

## Ingestion boundaries

- `lib/ingestion/assetParsingService.ts` converts uploaded files to a reviewable board draft.
- Gemini is optional. Fallback parser uses deterministic filename heuristics.
- Host review step in setup UI finalizes board JSON.

## UI boundaries

- Setup UI: board source selection, player setup, parse-and-review flow.
- Host UI: authority screen, action controls, board/log/ownership, QR generation.
- Player UI: token-bound view + turn-appropriate actions.

## Future boundaries

- IRL tracking interfaces: `lib/future/interfaces.ts`.
- RPG-lite future support: `futureModifiers` field in game state.
