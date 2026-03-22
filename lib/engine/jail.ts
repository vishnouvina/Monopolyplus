import { GameEvent, GameState, TransactionEntry } from "@/lib/domain/types";
import { appendEvent, getCurrentPlayer } from "@/lib/engine/common";
import { transferCash } from "@/lib/engine/economy";

export function resolvePayJailFineAction(state: GameState, events: GameEvent[], txns: TransactionEntry[]) {
  if (state.phase !== "AWAITING_ROLL") {
    throw new Error("Cannot pay jail fine in current phase.");
  }

  const player = getCurrentPlayer(state);
  if (!player.inJail) {
    throw new Error("Player is not in jail.");
  }

  const fine = state.board.rules.jailFine;
  if (player.cash < fine) {
    throw new Error("Insufficient cash to pay jail fine.");
  }

  transferCash(state, events, txns, fine, "Jail fine (manual)", player.id, undefined);
  if (!player.bankrupt) {
    player.inJail = false;
    player.jailTurns = 0;
    appendEvent(events, state, "JAIL_FINE", `${player.name} paid $${fine} to leave jail.`);
  }
}

export function resolveUseGetOutOfJailCardAction(state: GameState, events: GameEvent[]) {
  if (state.phase !== "AWAITING_ROLL") {
    throw new Error("Cannot use jail card in current phase.");
  }

  const player = getCurrentPlayer(state);
  if (!player.inJail) {
    throw new Error("Player is not in jail.");
  }

  if (player.getOutOfJailCards <= 0) {
    throw new Error("No Get Out of Jail card available.");
  }

  player.getOutOfJailCards -= 1;
  player.inJail = false;
  player.jailTurns = 0;
  appendEvent(events, state, "JAIL_EXIT", `${player.name} used a Get Out of Jail card.`);
}
