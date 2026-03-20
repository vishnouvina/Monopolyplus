# Architecture Notes

## Engine boundaries

- `lib/engine/*` is pure business logic.
- `applyGameAction()` receives `GameState + GameAction` and returns a new state plus events/transactions.
- Deterministic rules are implemented in code, never delegated to LLMs.

## Service boundaries

- `lib/services/gameService.ts` handles persistence and state snapshots.
- DB writes are transactionally grouped per action (state + turn + log + transactions).
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
