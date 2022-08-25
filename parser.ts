import { Lexer, TokenNode, Tokens, TokenStream } from "./lexer";

/**
 * E  ->  TE'
 * E' ->  +TE' | -TE' | ε
 * T  ->  UT'
 * T' -> *UT' | /UT' | ε
 * U  ->  -F | F
 * F  -> (E) | identifier | number
 */

abstract class Expr {
  protected op: TokenNode;
  protected children: Expr[];

  public abstract evaluate(ctx: Map<string, any>): number;

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
        `binary expression must has 2 children: ${children.length}`
      );
    this.leftExpr = children[0];
    this.rightExpr = children[1];
  }

  public evaluate(ctx: Map<string, any>): any {
    let left = this.leftExpr.evaluate(ctx);
    let right = this.rightExpr.evaluate(ctx);

    left = Number(left);
    right = Number(right);

    let operator = this.op.tokenContent;
    switch (operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
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

  public evaluate(ctx: Map<string, any>): number {
    let value = this.rightExpr.evaluate(ctx);

    if (this.op.tokenType === Tokens.Empty) {
      return value;
    } else if (this.op.tokenContent === "-") {
      return -value;
    } else {
      return NaN;
    }
  }
}

class NumberExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, any>): number {
    if (typeof this.op.tokenContent === "number") {
      return this.op.tokenContent;
    }
    return NaN;
  }
}

class IdentifierExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, any>): number {
    if (typeof this.op.tokenContent === "number") {
      return NaN;
    }
    if (ctx.get(this.op.tokenContent)) {
      return Number(ctx.get(this.op.tokenContent));
    }
    return NaN;
  }
}

export class Parser {
  private lexer: Lexer;

  private tokenStream: TokenStream;
  private current: TokenNode;

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  public parse(content: string): Expr {
    this.tokenStream = this.lexer.scan(content);
    this.next();
    return this.parseExpr();
  }

  private next() {
    this.current = this.tokenStream.next();
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

  private e1(lhs) {
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

  private t1(lhs) {
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

    if (this.isDelimiter(token) === '(') {
      this.next();
      const expression = this.parseExpr();

      const closingParen = this.current;
      if (this.isDelimiter(closingParen) !== ")") {
        throw new Error (`unclosed parentheses in expression`);
      }
      this.next();
      return expression;
    }

    if (token.tokenType === Tokens.Number) {
      this.next();
      return new NumberExpr(token, []);
    }

    if (token.tokenType === Tokens.Identifier) {
        this.next();
        return new IdentifierExpr(token, []);
    }

    throw new Error(`Invalid expression`);
  }
}
