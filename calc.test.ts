import { Lexer } from "./lexer"
import { Parser } from "./parser"

const lexer = new Lexer();

const parser = new Parser(lexer);

describe("Calc without variables", () => {
    it("basic integer add & sub", () => {
        const expr = parser.parse("1 + 2 - 3");
        expect(expr.evaluate(new Map())).toEqual(0);
    })
    it("basic float add & sub", () => {
        const expr = parser.parse("1.1 + 2.2 - 1")
        expect(Math.abs(expr.evaluate(new Map()) - 2.3)).toBeLessThan(1e-7);
    })
    it("basic sci format float add & sub", () => {
        const expr = parser.parse("1e5 + 1e-2 - 1e4");
        expect(Math.abs(expr.evaluate(new Map()) - 90000.01)).toBeLessThan(1e-7);
    })
    it("operator priority without parentheses", () => {
        const expr = parser.parse("1 + 2 * 3");
        expect(expr.evaluate(new Map())).toEqual(7);
    })
    it("operator priority with parentheses", () => {
        const expr = parser.parse("(1 + 2) * 3");
        expect(expr.evaluate(new Map())).toEqual(9);
    })
    it("unary operator", () => {
        const expr = parser.parse("(-1 + 2) * (3 - (-1))");
        expect(expr.evaluate(new Map())).toEqual(4);
    })
})

describe("Calc with variables", () => {
    it("single x", () => {
        const expr = parser.parse("(-1 + x) * (3 - (-1))");
        expect(expr.evaluate(new Map([['x', 2]]))).toEqual(4);
    })
    it("x1 & x2", () => {
        const expr = parser.parse("(-1 + x1) * (3 - (-x2))");
        expect(expr.evaluate(new Map([['x1', 2], ['x2', 1]]))).toEqual(4);
    })
    it("unknown variables", () => {
        const expr = parser.parse("(-1 + x) * (3 - (-1))");
        expect(expr.evaluate(new Map())).toBeNaN();
    })
})