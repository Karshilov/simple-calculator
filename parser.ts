import {
  END_TOKEN,
  FUNCTION_LIST,
  Lexer,
  TokenNode,
  Tokens,
  TokenStream,
} from "./lexer";
import { FUNCTION_MAP, nextX, ValueType } from "./utils";

/**
 * E  ->  TE'
 * E' ->  +TE' | -TE' | ε
 * T  ->  UT'
 * T' -> *UT' | /UT' | ε
 * U -> SU'
 * U' -> ^SU' | ε
 * S  ->  -F | F
 * F  -> (E) | FUNCTION(A) | identifier | number
 * A -> EA' | ε
 * A' -> ,EA' | :A' | ε
 */

abstract class Expr {
  protected op: TokenNode;
  protected children: Expr[];

  public abstract evaluate(ctx: Map<string, any>): ValueType;

  constructor(op: TokenNode, children: Expr[]) {
    this.op = op;
    this.children = children;
  }
}

class BinaryExpr extends Expr {
  protected leftExpr: Expr;
  protected rightExpr: Expr;

  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
    if (children.length !== 2)
      throw new Error(
        `binary expression must have 2 children: ${children.length}`
      );
    this.leftExpr = children[0];
    this.rightExpr = children[1];
  }

  public evaluate(ctx: Map<string, any>): ValueType {
    let left = this.leftExpr.evaluate(ctx);
    let right = this.rightExpr.evaluate(ctx);

    if (left instanceof Array || right instanceof Array)
      throw new Error(`params for binary op shouldn't be array`);

    let operator = this.op.tokenContent;
    switch (operator) {
      case "+":
        return ((left as any) + right) as any;
      case "-":
        return (left as any) - (right as any);
      case "*":
        left = Number(left);
        right = Number(right);
        return left * right;
      case "/":
        left = Number(left);
        right = Number(right);
        return left / right;
      case "^":
        left = Number(left);
        right = Number(right);
        return Math.pow(left, right);
    }
    return null;
  }
}

class UnaryExpr extends Expr {
  protected rightExpr: Expr;

  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
    if (children.length !== 1)
      throw new Error(`unary expression must have exactly one child`);
    this.rightExpr = children[0];
  }

  public evaluate(ctx: Map<string, any>): ValueType {
    let value = this.rightExpr.evaluate(ctx);

    if (this.op.tokenType === Tokens.Empty) {
      return value;
    } else if (this.op.tokenContent === "-") {
      return -(value || 0);
    } else {
      return NaN;
    }
  }
}

class NumberExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, any>): ValueType {
    if (typeof this.op.tokenContent === "number") {
      return this.op.tokenContent;
    }
    return NaN;
  }
}

class ReferenceExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  getId() {
    if (typeof this.op.tokenContent === "number") {
      throw new Error("invalid reference id");
    }
    return this.op.tokenContent;
  }

  public evaluate(ctx: Map<string, any>): ValueType {
    if (typeof this.op.tokenContent === "number") {
      throw new Error("invalid reference id");
    }
    if (ctx.get(this.op.tokenContent)) {
      return ctx.get(this.op.tokenContent);
    }
    return NaN;
  }
}

class RangeRefExpr extends Expr {
  protected leftExpr: ReferenceExpr;
  protected rightExpr: ReferenceExpr;

  constructor(op: TokenNode, children: ReferenceExpr[]) {
    super(op, children);
    if (children.length !== 2)
      throw new Error(
        `range reference expression must have 2 children but it only got: ${children.length}`
      );
    this.leftExpr = children[0];
    this.rightExpr = children[1];
  }

  public evaluate(ctx: Map<string, any>): ValueType {
    let left = this.leftExpr.getId();
    let right = this.rightExpr.getId();

    const re = /^[A-Z]+_[1-9]+[0-9]*$/;

    [left, right].forEach((refId) => {
      if (!re.test(refId)) throw new Error(`invalid reference id: ${refId}`);
    });

    const [lx, ly] = left.split("_");
    const [rx, ry] = right.split("_");

    let minX = lx > rx ? rx : lx;
    let maxX = lx > rx ? lx : rx;


    let minY = Number(ly > ry ? ry : ly);
    let maxY = Number(ly > ry ? ly : ry);

    const result: any[] = [];

    while (minX <= maxX) {
      const curY = minY;
      while (minY <= maxY) {
        const currentId = minX + "_" + minY;
        result.push(ctx.get(currentId) ?? null);
        minY++;
      }
      minX = nextX(minX);
      minY = curY;
    }
    return result;
  }
}

class FunctionExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, any>): ValueType {
    const params: ValueType[] = [];
    this.children.forEach((child) => params.push(child.evaluate(ctx)));
    if (
      typeof this.op.tokenContent === "number" ||
      !FUNCTION_LIST.includes(this.op.tokenContent)
    )
      throw new Error(`invalid function name: '${this.op.tokenContent}`);
    return FUNCTION_MAP[this.op.tokenContent](params);
  }
}

export class Parser {
  private lexer: Lexer;

  private tokenStream?: TokenStream;
  private current: TokenNode = new TokenNode(Tokens.Empty, END_TOKEN);

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  public parse(content: string): Expr {
    this.tokenStream = this.lexer.scan(content);
    this.next();
    return this.parseExpr();
  }

  private next() {
    this.current = this.tokenStream?.next() || this.current;
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
        }
      }
    }
    return result;
  }
}
