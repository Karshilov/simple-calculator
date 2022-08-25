export enum Tokens {
    Identifier,
    Number,
    Delimiter,
    Operator,
    End,
    Empty
}

export class TokenNode {
    tokenType: Tokens;
    tokenContent: string | number;

    constructor(tokenType: Tokens, tokenContent: string | number) {
        this.tokenType = tokenType;
        this.tokenContent = tokenContent;
    }
}

export const END_TOKEN = 'あ';

export class TokenStream {
    current: string | null;
    content: string;
    position: number;
    operators: RegExp;
    delimiters: RegExp;
    constructor(operators: RegExp, delimiters: RegExp, content: string) {
        this.content = content;
        this.delimiters = delimiters;
        this.operators = operators;
        this.position = 0;
        this.current = null;
    }

    read() {
        if (this.position < this.content.length) 
            this.current = this.content[this.position++];
        else 
            this.current = END_TOKEN;
    }

    rollback() {
        if (this.position > 0) 
            this.current = this.content[this.position--];
        else this.current = null;
    }

    next() {
        if (this.current === null) this.read();
        if (this.current === END_TOKEN) return new TokenNode(Tokens.End, END_TOKEN);
        let currentToken: TokenNode | null  = null;

        if (/^\s+$/.test(this.current || '')) {
            this.current = null;
            return this.next();
        }

        if (this.current?.match(/[0-9]/)) {
            currentToken = this.readNumber()
        } 
        else if (this.current?.match(/[a-zA-Z]/)) {
            currentToken = this.readIdentifier();
        } else if (this.delimiters.test(this.current || '')) {
            currentToken = new TokenNode(Tokens.Delimiter, this.current || '');
            this.current = null;
        } else if (this.operators.test(this.current || '')) {
            currentToken = new TokenNode(Tokens.Operator, this.current || '');
            this.current = null;
        }

        if (currentToken === null) {
            throw new Error(`Invalid token at position ${this.position}`);
        }
        return currentToken;
    }

    readNumber(): TokenNode {
        let value: string = this.current || '';
        for ( this.read(); !Object.is(Number(value + this.current), NaN); this.read()) {
            value += this.current;
        }
        if (this.current === 'e') {
            if (!Object.is(Number(this.content.slice(this.position, this.position + 1)), NaN)
                || !Object.is(Number(this.content.slice(this.position, this.position + 2)), NaN)) {
                value += this.current;
                for (this.read(); Object.is(Number(value + this.current), NaN); this.read()) {
                    value += this.current;
                }
                value += this.current;
                for ( this.read(); !Object.is(Number(value + this.current), NaN); this.read()) {
                    value += this.current;
                }
                return new TokenNode(Tokens.Number, Number(value));
            }
            else {
                return new TokenNode(Tokens.Number, Number(value));
            }
        } else {
            return new TokenNode(Tokens.Number, Number(value));
        }
    }

    readIdentifier(): TokenNode {
        let value: string = this.current || '';
        for ( this.read(); /[a-zA-Z0-9]/.test(this.current || '') || this.current === '_'; this.read()) {
            value += this.current;
        }
        return new TokenNode(Tokens.Identifier, value);
    }
}

export class Lexer {
    operators: RegExp = /[\+\-\*\/]/;
    delimiters: RegExp = /[\(\),]/;

    constructor(operators?: RegExp, delimiters?: RegExp) {
        if (operators) this.operators = operators;
        if (delimiters) this.delimiters = delimiters;
    }

    scan(content: string): TokenStream {
        return new TokenStream(this.operators, this.delimiters, content);
    }
}