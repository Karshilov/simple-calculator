import { FUNCTION_LIST, TokenNode, Tokens } from "./lexer";
import { nextX, unboxValue } from "./utils";

export abstract class Expr {
  protected op: TokenNode;
  protected children: Expr[];

  public abstract evaluate(ctx: Map<string, BaseValue>): Result<BaseValue>;

  constructor(op: TokenNode, children: Expr[]) {
    this.op = op;
    this.children = children;
  }
}

export class BinaryExpr extends Expr {
  protected leftExpr: Expr;
  protected rightExpr: Expr;

  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
    this.leftExpr = children[0];
    this.rightExpr = children[1];
  }

  public evaluate(
    ctx: Map<string, BaseValue>
  ): Result<StringValue | NumberValue | NullValue> {
    if (this.children.length !== 2)
      return new ErrorValue(
        `binary expression must have 2 children: ${this.children.length}`
      );

    let left = this.leftExpr.evaluate(ctx);
    let right = this.rightExpr.evaluate(ctx);

    if (left instanceof ErrorValue) return left;
    if (right instanceof ErrorValue) return right;

    let leftValue = left.getValue();
    let rightValue = right.getValue();

    if (left instanceof Array || right instanceof Array)
      return new ErrorValue(`params for binary op shouldn't be array`);

    let operator = this.op.tokenContent;
    switch (operator) {
      case "+":
        if (typeof leftValue === "string" || typeof rightValue === "string")
          return new StringValue(
            (leftValue || "").toString() + (rightValue || "").toString()
          );
        else return new NumberValue(Number(leftValue) + Number(rightValue));
      case "-":
        return new NumberValue(Number(leftValue) - Number(rightValue));
      case "*":
        leftValue = Number(leftValue);
        rightValue = Number(rightValue);
        return new NumberValue(leftValue * rightValue);
      case "/":
        leftValue = Number(leftValue);
        rightValue = Number(rightValue);
        return new NumberValue(leftValue / rightValue);
      case "^":
        leftValue = Number(leftValue);
        rightValue = Number(rightValue);
        return new NumberValue(Math.pow(leftValue, rightValue));
    }
    return new NullValue();
  }
}

export class UnaryExpr extends Expr {
  protected rightExpr: Expr;

  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
    this.rightExpr = children[0];
  }

  public evaluate(ctx: Map<string, BaseValue>): Result<NumberValue> {
    if (this.children.length !== 1)
      return new ErrorValue(`unary expression must have exactly one child`);

    let value = this.rightExpr.evaluate(ctx);

    if (value instanceof ErrorValue) return value;

    if (!(typeof value.getValue() === "number"))
      return new ErrorValue(
        `unary expression can only receive number but got ${value.getValue()}`
      );

    if (this.op.tokenType === Tokens.Empty) {
      return new NumberValue(value.getValue());
    } else if (this.op.tokenContent === "-") {
      return new NumberValue(-value.getValue());
    } else {
      return new NumberValue(NaN);
    }
  }
}

export class NumberExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, BaseValue>): NumberValue {
    if (typeof this.op.tokenContent === "number") {
      return new NumberValue(this.op.tokenContent);
    }
    return new NumberValue(NaN);
  }
}

export class StringExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, BaseValue>): Result<StringValue> {
    return new StringValue(this.op.tokenContent.toString());
  }
}

export class ReferenceExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  getId() {
    if (typeof this.op.tokenContent === "number") {
      throw new Error("invalid reference id");
    }
    return this.op.tokenContent;
  }

  public evaluate(ctx: Map<string, BaseValue>): Result<BaseValue> {
    if (typeof this.op.tokenContent === "number") {
      return new ErrorValue("invalid reference id");
    }

    const value = ctx.get(this.op.tokenContent);

    if (value) {
      return value;
    }
    return new NumberValue(NaN);
  }
}

export class RangeRefExpr extends Expr {
  protected leftExpr: ReferenceExpr;
  protected rightExpr: ReferenceExpr;

  constructor(op: TokenNode, children: ReferenceExpr[]) {
    super(op, children);
    this.leftExpr = children[0];
    this.rightExpr = children[1];
  }

  public evaluate(ctx: Map<string, BaseValue>): Result<CollectionValue> {
    if (this.children.length !== 2)
      return new ErrorValue(
        `range reference expression must have 2 children but it only got: ${this.children.length}`
      );
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

    const result: BaseValue[] = [];

    while (minX <= maxX) {
      const curY = minY;
      while (minY <= maxY) {
        const currentId = minX + "_" + minY;
        result.push(ctx.get(currentId) ?? new NullValue());
        minY++;
      }
      minX = nextX(minX);
      minY = curY;
    }
    return new CollectionValue(result);
  }
}

export class FunctionExpr extends Expr {
  constructor(op: TokenNode, children: Expr[]) {
    super(op, children);
  }

  public evaluate(ctx: Map<string, BaseValue>): Result<BaseValue> {
    const params: BaseValue[] = [];
    this.children.forEach((child) => params.push(child.evaluate(ctx)));
    if (
      typeof this.op.tokenContent === "number" ||
      !FUNCTION_LIST.includes(this.op.tokenContent)
    )
      throw new Error(`invalid function name: '${this.op.tokenContent}`);
    return FUNCTION_MAP[this.op.tokenContent](params);
  }
}

export enum VALUE_TYPE {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  NULL = "null",
  ERROR = "error",
  COLLECTION = "collection",
  FORMULA = "formula",
}

export abstract class BaseValue {
  abstract readonly type: VALUE_TYPE;
  abstract getValue(): any;
}

export const FUNCTION_MAP: { [key: string]: any } = {
  SUM: (values: BaseValue[]) => {
    const flatValues = values.map((v) => unboxValue(v)).flat();
    if (flatValues.length === 0) return new NullValue();
    const result: any = flatValues.reduce(
      (a, b) => a + b,
      flatValues.some((v) => typeof v === "string") ? "" : 0
    );
    if (typeof result === "string") return new StringValue(result);
    if (typeof result === "number") return new NumberValue(result);
    return new NumberValue(NaN);
  },
  AVERAGE: (values: any[]) => {
    const flatValues = values.map((v) => unboxValue(v)).flat();
    if (flatValues.length === 0) return new NullValue();
    const result: any = flatValues.reduce((a, b) => a + b, 0);
    if (typeof result === "number")
      return new NumberValue(result / flatValues.length);
    return new NumberValue(NaN);
  },
  MAX: (values: any[]) => {
    const flatValues = values.map((v) => unboxValue(v)).flat();
    if (flatValues.length === 0) return new NullValue();
    const result: any = flatValues.reduce((a, b) => (a > b ? a : b));
    if (typeof result === "number") return new NumberValue(result);
    if (typeof result === "string") return new StringValue(result);
    return new NumberValue(NaN);
  },
  MIN: (values: any[]) => {
    const flatValues = values.map((v) => unboxValue(v)).flat();
    if (flatValues.length === 0) return new NullValue();
    const result: any = flatValues.reduce((a, b) => (a < b ? a : b));
    if (typeof result === "number") return new NumberValue(result);
    if (typeof result === "string") return new StringValue(result);
    return new NumberValue(NaN);
  },
};

export class StringValue extends BaseValue {
  readonly type = VALUE_TYPE.STRING;
  value: string = "";

  constructor(value: string) {
    super();
    this.value = value;
  }

  getValue() {
    return this.value;
  }
}

export class NumberValue extends BaseValue {
  readonly type = VALUE_TYPE.NUMBER;
  value: number = 0;

  constructor(value: number) {
    super();
    this.value = value;
  }

  getValue() {
    return this.value;
  }

  toString() {
    return this.value;
  }
}

export class BooleanValue extends BaseValue {
  readonly type = VALUE_TYPE.BOOLEAN;
  value: boolean = false;

  constructor(value: boolean) {
    super();
    this.value = value;
  }

  getValue() {
    return this.value;
  }

  toString() {
    return this.value ? "true" : "false";
  }
}

export class NullValue extends BaseValue {
  readonly type = VALUE_TYPE.NULL;

  constructor() {
    super();
  }

  getValue() {
    return null;
  }

  toString() {
    return "";
  }
}

export class ErrorValue extends BaseValue {
  readonly type = VALUE_TYPE.ERROR;
  message: string = "";

  constructor(message: string) {
    super();
    this.message = message;
  }

  getValue() {
    return this;
  }
}

export class CollectionValue extends BaseValue {
  readonly type = VALUE_TYPE.COLLECTION;
  values: Array<BaseValue>;

  constructor(values: Array<BaseValue>) {
    super();
    this.values = values;
  }

  getValue() {
    return this.values;
  }

  toString() {
    return this.values.toString();
  }
}

export class FormulaValue extends BaseValue {
  readonly type = VALUE_TYPE.FORMULA;
  formula: Expr;
  ctx: Map<string, BaseValue> = new Map<string, BaseValue>();

  constructor(formula: Expr, ctx?: Map<string, BaseValue>) {
    super();
    this.formula = formula;
    ctx && (this.ctx = ctx);
  }

  getValue() {
    return this.formula.evaluate(this.ctx).getValue();
  }
}

export type Result<T extends BaseValue> = T | ErrorValue;
