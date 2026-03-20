import { DiceRoll } from "@/lib/domain/types";

export function rollDice(forcedDice?: [number, number]): DiceRoll {
  const dieOne = forcedDice ? forcedDice[0] : Math.floor(Math.random() * 6) + 1;
  const dieTwo = forcedDice ? forcedDice[1] : Math.floor(Math.random() * 6) + 1;

  return {
    dieOne,
    dieTwo,
    total: dieOne + dieTwo,
    isDouble: dieOne === dieTwo
  };
}
