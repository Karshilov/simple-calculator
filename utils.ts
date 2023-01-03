import { BaseValue, VALUE_TYPE } from "./types";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const nextX = (s: string): string => {
  if (!alphabet.find((c) => s[s.length - 1] === c))
    throw new Error(`invalid ref address: ${s}`);
  const nextCharacter =
    alphabet[alphabet.findIndex((c) => c === s[s.length - 1]) + 1];
  if (!nextCharacter) {
    if (s.length > 1) return nextX(s.slice(0, s.length - 1)) + "A";
    else return "AA";
  }
  return s.slice(0, s.length - 1) + nextCharacter;
};

export const unboxValue = (value: BaseValue) => {
  switch (value.type) {
    case VALUE_TYPE.COLLECTION:
      return value.getValue().map((v: BaseValue) => unboxValue(v));
    default:
      return value.getValue();
  }
};
