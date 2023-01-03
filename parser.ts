import { END_TOKEN, Lexer, TokenNode, Tokens, TokenStream } from "./lexer";
import {
  BinaryExpr,
  Expr,
  FunctionExpr,
  NumberExpr,
  RangeRefExpr,
  ReferenceExpr,
  StringExpr,
  UnaryExpr,
} from "./types";

const END_TOKEN_NODE = new TokenNode(Tokens.Empty, END_TOKEN);

/**
 * E  ->  TE'
 * E' ->  +TE' | -TE' | ε
 * T  ->  UT'
 * T' -> *UT' | /UT' | ε
 * U -> SU'
 * U' -> ^SU' | ε
 * S  ->  -F | F
 * F  -> (E) | FUNCTION(A) | identifier | number | string
 * A -> EA' | ε
 * A' -> ,EA' | :A' | ε
 */
export class Parser {
  private lexer: Lexer;

  private tokenStream?: TokenStream;
  private current: TokenNode = END_TOKEN_NODE;

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  public parse(content: string): Expr {
    this.tokenStream = this.lexer.scan(content);
    this.next();
    return this.parseExpr();
  }

  private next() {
    const nextToken = this.tokenStream?.next();
    this.current = nextToken || END_TOKEN_NODE;
  }

  public parseExpr(): Expr {
    return this.e();
  }

  private e() {
    const lhs = this.t();
    return this.e1(lhs);
  }

  private isOperator(op: TokenNode): boolean | string {
    if (op.tokenType === Tokens.Operator) return op.tokenContent.toString();
    else return false;
  }

  private isDelimiter(op: TokenNode): boolean | string {
    if (op.tokenType === Tokens.Delimiter) return op.tokenContent.toString();
    else return false;
  }

  private e1(lhs: Expr): Expr {
    const op = this.current;
    if (this.isOperator(op) === "+" || this.isOperator(op) === "-") {
      this.next();
      const rhs = this.t();
      const node = new BinaryExpr(op, [lhs, rhs]);
      return this.e1(node);
    }
    return lhs;
  }

  private t() {
    const lhs = this.u();
    return this.t1(lhs);
  }

  private t1(lhs: Expr): Expr {
    const op = this.current;
    if (this.isOperator(op) === "*" || this.isOperator(op) === "/") {
      this.next();
      const rhs = this.u();
      const node = new BinaryExpr(op, [lhs, rhs]);
      return this.t1(node);
    }
    return lhs;
  }

  private u() {
    const lhs = this.s();
    return this.u1(lhs);
  }

  private u1(lhs: Expr): Expr {
    const op = this.current;
    if (this.isOperator(op) === "^") {
      this.next();
      const rhs = this.s();
      const node = new BinaryExpr(op, [lhs, rhs]);
      return this.u1(node);
    }
    return lhs;
  }

  private s() {
    const op = this.current;
    if (this.isOperator(op) === "-") {
      this.next();
      const argument = this.f();
      return new UnaryExpr(op, [argument]);
    }
    return this.f();
  }

  private f() {
    const token = this.current;

    if (this.isDelimiter(token) === "(") {
      this.next();
      const expression = this.parseExpr();

      const closingParen = this.current;
      if (this.isDelimiter(closingParen) !== ")") {
        throw new Error(`unclosed parentheses in expression`);
      }
      this.next();
      return expression;
    }

    if (token.tokenType === Tokens.Number) {
      this.next();
      return new NumberExpr(token, []);
    }

    if (token.tokenType === Tokens.String) {
      this.next();
      return new StringExpr(token, []);
    }

    if (token.tokenType === Tokens.Reference) {
      this.next();
      return new ReferenceExpr(token, []);
    }

    if (token.tokenType === Tokens.Function) {
      this.next();
      return new FunctionExpr(token, this.a());
    }

    throw new Error(`Invalid expression`);
  }

  private a() {
    const token = this.current;

    if (this.isDelimiter(token) === "(") {
      this.next();
      const lhs = this.parseExpr();
      const paramExprs = this.a1(lhs);
      const closingParen = this.current;
      if (this.isDelimiter(closingParen) !== ")") {
        throw new Error(`unclosed parentheses in expression`);
      }
      this.next();
      return paramExprs;
    }

    throw new Error("open paren is expected after a function");
  }

  private a1(lhs: Expr) {
    const op = this.current;
    const result = [lhs];
    while (this.isDelimiter(op) === "," || this.isDelimiter(op) === ":") {
      if (
        this.isDelimiter(this.current) === ")" ||
        this.current.tokenContent === END_TOKEN
      )
        break;
      this.next();
      const nextExpr = this.parseExpr();
      if (op.tokenContent === ",") {
        result.push(nextExpr);
      } else {
        const prevExpr = result[result.length - 1];
        if (
          prevExpr instanceof ReferenceExpr &&
          nextExpr instanceof ReferenceExpr
        ) {
          result[result.length - 1] = new RangeRefExpr(op, [
            prevExpr,
            nextExpr,
          ]);
        } else {
          throw new Error(
            `Range selection can only be used between 2 reference expressions`
          );
        }
      }
    }
    return result;
  }
}
