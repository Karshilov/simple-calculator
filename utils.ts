export type ValueType =
  | string
  | number
  | (string | number)[]
  | string[]
  | number[]
  | null
  | ValueType[];

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

export const FUNCTION_MAP: { [key: string]: any } = {
  SUM: (values: any[]) =>
    values
      .flat()
      .slice(1)
      .reduce((a, b) => (b ? a + b : a), values.flat()[0]),
  AVERAGE: (values: any[]) =>
    values
      .flat()
      .slice(1)
      .reduce((a, b) => (b ? a + b : a), values.flat()[0]) /
    values.flat().length,
  MAX: (values: any[]) =>
    values
      .flat()
      .slice(1)
      .reduce((a, b) => (b > a ? b : a), values.flat()[0]),
  MIN: (values: any[]) =>
    values
      .flat()
      .slice(1)
      .reduce((a, b) => (b < a ? b : a), values.flat()[0]),
};
