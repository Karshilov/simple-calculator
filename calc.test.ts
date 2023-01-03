import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { BaseValue, FormulaValue, NumberValue, StringValue } from "./types";

const lexer = new Lexer();

const parser = new Parser(lexer);

describe("Calc without variables", () => {
  it("basic integer add & sub", () => {
    const expr = parser.parse("1 + 2 - 3");
    expect(expr.evaluate(new Map()).getValue()).toEqual(0);
  });
  it("basic float add & sub", () => {
    const expr = parser.parse("1.1 + 2.2 - 1");
    expect(
      Math.abs((expr.evaluate(new Map()).getValue() as unknown as number) - 2.3)
    ).toBeLessThan(1e-7);
  });
  it("basic sci format float add & sub", () => {
    const expr = parser.parse("1e5 + 1e-2 - 1e4");
    expect(
      Math.abs(
        (expr.evaluate(new Map()).getValue() as unknown as number) - 90000.01
      )
    ).toBeLessThan(1e-7);
  });
  it("operator priority without parentheses", () => {
    const expr = parser.parse("1 + 2 * 3");
    expect(expr.evaluate(new Map()).getValue()).toEqual(7);
  });
  it("operator priority with parentheses", () => {
    const expr = parser.parse("(1 + 2) * 3");
    expect(expr.evaluate(new Map()).getValue()).toEqual(9);
  });
  it("unary operator", () => {
    const expr = parser.parse("(-1 + 2) * (3 - (-1))");
    expect(expr.evaluate(new Map()).getValue()).toEqual(4);
  });
  it("power operator", () => {
    const expr = parser.parse("2 ^ 4");
    expect(expr.evaluate(new Map()).getValue()).toEqual(16);
  });
  it("power operator with parentheses", () => {
    const expr = parser.parse("2 ^ (4 - 1)");
    expect(expr.evaluate(new Map()).getValue()).toEqual(8);
  });
  it("power operator in complicated expression", () => {
    const expr = parser.parse("(-1 * 2) ^ (2 + 2 ^ 2)");
    expect(expr.evaluate(new Map()).getValue()).toEqual(64);
  });
  it("float power operator", () => {
    const expr = parser.parse("2 ^ 0.5");
    expect(
      Math.abs(
        (expr.evaluate(new Map()).getValue() as unknown as number) -
          Math.pow(2, 0.5)
      )
    ).toBeLessThan(1e-7);
  });
});

describe("Calc with references", () => {
  it("single A_1", () => {
    const expr = parser.parse("(-1 + A_1) * (3 - (-1))");
    expect(
      expr.evaluate(new Map([["A_1", new NumberValue(2)]])).getValue()
    ).toEqual(4);
  });
  it("A_1 & A_2", () => {
    const expr = parser.parse("(-1 + A_1) * (3 - (-A_2))");
    const formulaRef = parser.parse("3 * 3 - 2 ^ 2 * 2");
    expect(
      expr
        .evaluate(
          new Map<string, BaseValue>([
            ["A_1", new NumberValue(2)],
            ["A_2", new FormulaValue(formulaRef)],
          ])
        )
        .getValue()
    ).toEqual(4);
  });
  it("invalid ref id", () => {
    const expr = parser.parse("(-1 + x) * (3 - (-1))");
    expect(expr.evaluate(new Map()).getValue()).toBeNaN();
  });
});

describe("Calc with functions", () => {
  it("SUM", () => {
    const expr = parser.parse("1 + SUM(A_1, A_2)");
    expect(
      expr
        .evaluate(
          new Map([
            ["A_1", new NumberValue(2)],
            ["A_2", new NumberValue(3)],
          ])
        )
        .getValue()
    ).toEqual(6);
  });
  it("string SUM", () => {
    const expr = parser.parse(`"1" + SUM(A_1, A_2)`);
    expect(
      expr
        .evaluate(
          new Map([
            ["A_1", new StringValue("2")],
            ["A_2", new StringValue("3")],
          ])
        )
        .getValue()
    ).toEqual("123");
  });
  it("AVERAGE", () => {
    const expr = parser.parse("1 + AVERAGE(A_1, A_2, 1)");
    expect(
      expr
        .evaluate(
          new Map([
            ["A_1", new NumberValue(2)],
            ["A_2", new NumberValue(3)],
          ])
        )
        .getValue()
    ).toEqual(3);
  });
  it("Range selection with SUM", () => {
    const expr = parser.parse("1 + SUM(A_1:B_6)");
    expect(
      expr
        .evaluate(
          new Map([
            ["A_1", new NumberValue(2)],
            ["A_2", new NumberValue(3)],
            ["B_4", new NumberValue(5)],
            ["B_6", new NumberValue(10)],
          ])
        )
        .getValue()
    ).toEqual(21);
  });
});
