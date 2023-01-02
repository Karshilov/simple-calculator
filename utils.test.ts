import { nextX } from "./utils";

describe("utils test", () => {
  it("next X", () => {
    expect(nextX("A")).toBe("B");
    expect(nextX("Z")).toBe("AA");
    expect(nextX("ABC")).toBe("ABD");
    expect(nextX("ABZ")).toBe("ACA");
    expect(nextX("ZZZ")).toBe("AAAA");
    expect(nextX("AZZ")).toBe("BAA");
  });
});
