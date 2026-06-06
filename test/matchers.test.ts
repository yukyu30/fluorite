import { describe, it, expect } from "vitest";
import { checkData } from "../src/check.js";
import type { RulesFn } from "../src/types.js";

function run(data: Record<string, unknown>, rules: RulesFn) {
  return checkData(data, rules);
}

describe("required / exists", () => {
  it("passes when present, fails when absent", () => {
    expect(run({ a: 1 }, (fm) => fm.key("a").required()).ok).toBe(true);
    expect(run({}, (fm) => fm.key("a").required()).ok).toBe(false);
  });
  it("negated required asserts absence", () => {
    expect(run({}, (fm) => fm.key("a").not.required()).ok).toBe(true);
    expect(run({ a: 1 }, (fm) => fm.key("a").not.required()).ok).toBe(false);
  });
});

describe("type", () => {
  it.each([
    ["string", "x", true],
    ["number", 1, true],
    ["boolean", true, true],
    ["array", [1], true],
    ["object", { x: 1 }, true],
    ["null", null, true],
    ["string", 1, false],
    ["array", { x: 1 }, false],
  ] as const)("type(%s) on %j -> %s", (t, value, expected) => {
    expect(run({ v: value }, (fm) => fm.key("v").type(t)).ok).toBe(expected);
  });
});

describe("eq / oneOf", () => {
  it("eq deep-compares", () => {
    expect(run({ v: [1, 2] }, (fm) => fm.key("v").eq([1, 2])).ok).toBe(true);
    expect(run({ v: [1, 2] }, (fm) => fm.key("v").eq([2, 1])).ok).toBe(false);
  });
  it("oneOf checks membership", () => {
    expect(run({ v: "b" }, (fm) => fm.key("v").oneOf(["a", "b"])).ok).toBe(true);
    expect(run({ v: "z" }, (fm) => fm.key("v").oneOf(["a", "b"])).ok).toBe(false);
  });
});

describe("matches", () => {
  it("tests strings against a regexp", () => {
    expect(run({ v: "2026-06-06" }, (fm) => fm.key("v").matches(/^\d{4}-\d{2}-\d{2}$/)).ok).toBe(true);
    expect(run({ v: "nope" }, (fm) => fm.key("v").matches(/^\d+$/)).ok).toBe(false);
  });
  it("fails on non-strings", () => {
    expect(run({ v: 123 }, (fm) => fm.key("v").matches(/\d+/)).ok).toBe(false);
  });
});

describe("has / hasAll / hasAny", () => {
  it("has works for arrays and substrings", () => {
    expect(run({ v: ["a", "b"] }, (fm) => fm.key("v").has("a")).ok).toBe(true);
    expect(run({ v: "hello" }, (fm) => fm.key("v").has("ell")).ok).toBe(true);
    expect(run({ v: ["a"] }, (fm) => fm.key("v").has("z")).ok).toBe(false);
  });
  it("hasAll requires every item", () => {
    expect(run({ v: ["a", "b", "c"] }, (fm) => fm.key("v").hasAll(["a", "c"])).ok).toBe(true);
    expect(run({ v: ["a"] }, (fm) => fm.key("v").hasAll(["a", "c"])).ok).toBe(false);
  });
  it("hasAny requires at least one", () => {
    expect(run({ v: ["a"] }, (fm) => fm.key("v").hasAny(["a", "z"])).ok).toBe(true);
    expect(run({ v: ["x"] }, (fm) => fm.key("v").hasAny(["a", "z"])).ok).toBe(false);
  });
});

describe("length / lengthMin / lengthMax", () => {
  it("length exact", () => {
    expect(run({ v: "abc" }, (fm) => fm.key("v").length(3)).ok).toBe(true);
    expect(run({ v: [1, 2] }, (fm) => fm.key("v").length(2)).ok).toBe(true);
    expect(run({ v: "abc" }, (fm) => fm.key("v").length(2)).ok).toBe(false);
  });
  it("lengthMin boundary", () => {
    expect(run({ v: "1234567890" }, (fm) => fm.key("v").lengthMin(10)).ok).toBe(true);
    expect(run({ v: "123456789" }, (fm) => fm.key("v").lengthMin(10)).ok).toBe(false);
  });
  it("lengthMax boundary", () => {
    expect(run({ v: "12345" }, (fm) => fm.key("v").lengthMax(5)).ok).toBe(true);
    expect(run({ v: "123456" }, (fm) => fm.key("v").lengthMax(5)).ok).toBe(false);
  });
  it("length on non-measurable values fails", () => {
    expect(run({ v: 42 }, (fm) => fm.key("v").lengthMin(1)).ok).toBe(false);
    expect(run({}, (fm) => fm.key("v").lengthMin(1)).ok).toBe(false);
  });
});

describe(".not applies only to the next matcher", () => {
  it("resets after one matcher", () => {
    const result = run({ tags: ["ok", "ng"] }, (fm) => {
      fm.key("tags").not.has("zzz").has("ok");
    });
    expect(result.ok).toBe(true);
    expect(result.results.map((r) => [r.rule, r.negated, r.ok])).toEqual([
      ["has", true, true],
      ["has", false, true],
    ]);
  });
});
