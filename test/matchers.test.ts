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
  it("exists() mirrors required() with its own wording", () => {
    expect(run({ a: 1 }, (fm) => fm.key("a").exists()).ok).toBe(true);
    const r = run({}, (fm) => fm.key("a").exists());
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.message).toBe("should exist");
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

describe("isoDate", () => {
  it("passes for a YYYY-MM-DD calendar date string", () => {
    expect(run({ d: "2026-06-07" }, (fm) => fm.key("d").isoDate()).ok).toBe(true);
  });
  it("rejects a date-time string", () => {
    expect(run({ d: "2026-06-07 10:30:00" }, (fm) => fm.key("d").isoDate()).ok).toBe(false);
  });
  it("rejects impossible calendar dates", () => {
    expect(run({ d: "2026-02-30" }, (fm) => fm.key("d").isoDate()).ok).toBe(false);
    expect(run({ d: "2026-13-01" }, (fm) => fm.key("d").isoDate()).ok).toBe(false);
    expect(run({ d: "2026-00-10" }, (fm) => fm.key("d").isoDate()).ok).toBe(false);
  });
  it("rejects loosely-formatted dates", () => {
    expect(run({ d: "2026-6-7" }, (fm) => fm.key("d").isoDate()).ok).toBe(false);
    expect(run({ d: "06/07/2026" }, (fm) => fm.key("d").isoDate()).ok).toBe(false);
  });
  it("fails for a missing key, reporting undefined", () => {
    const r = run({}, (fm) => fm.key("d").isoDate());
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.message).toContain("undefined");
  });
  it("fails for a Date object and names the date type", () => {
    const r = run({ d: new Date("2026-06-07") }, (fm) => fm.key("d").isoDate());
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.message).toContain("date");
  });
  it("negation asserts the value is not a date", () => {
    expect(run({ d: "nope" }, (fm) => fm.key("d").not.isoDate()).ok).toBe(true);
    expect(run({ d: "2026-06-07" }, (fm) => fm.key("d").not.isoDate()).ok).toBe(false);
  });
});

describe("type(date)", () => {
  it("recognizes Date objects as the date type, not object", () => {
    expect(run({ d: new Date() }, (fm) => fm.key("d").type("date")).ok).toBe(true);
    expect(run({ d: new Date() }, (fm) => fm.key("d").type("object")).ok).toBe(false);
  });
});

describe("each.isoDate", () => {
  it("passes when every element is a YYYY-MM-DD date", () => {
    expect(run({ d: ["2026-01-02", "2026-02-03"] }, (fm) => fm.key("d").each.isoDate()).ok).toBe(true);
  });
  it("fails and lists the invalid dates", () => {
    const r = run({ d: ["2026-01-02", "2026-13-99"] }, (fm) => fm.key("d").each.isoDate());
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.message).toContain("2026-13-99");
  });
  it("fails on a non-array value", () => {
    expect(run({ d: "2026-01-02" }, (fm) => fm.key("d").each.isoDate()).ok).toBe(false);
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
  it("reports n/a for length / lengthMax on non-measurable values", () => {
    expect(run({}, (fm) => fm.key("v").length(3)).failures[0]!.message).toContain("n/a");
    expect(run({ v: 1 }, (fm) => fm.key("v").lengthMax(3)).failures[0]!.message).toContain("n/a");
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

describe("negation of every matcher", () => {
  it("not.exists", () => {
    expect(run({}, (fm) => fm.key("a").not.exists()).ok).toBe(true);
    expect(run({ a: 1 }, (fm) => fm.key("a").not.exists()).ok).toBe(false);
  });
  it("not.type", () => {
    expect(run({ v: 1 }, (fm) => fm.key("v").not.type("string")).ok).toBe(true);
    expect(run({ v: "x" }, (fm) => fm.key("v").not.type("string")).ok).toBe(false);
  });
  it("not.eq", () => {
    expect(run({ v: 1 }, (fm) => fm.key("v").not.eq(2)).ok).toBe(true);
    expect(run({ v: 1 }, (fm) => fm.key("v").not.eq(1)).ok).toBe(false);
  });
  it("not.oneOf", () => {
    expect(run({ v: "z" }, (fm) => fm.key("v").not.oneOf(["a", "b"])).ok).toBe(true);
    expect(run({ v: "a" }, (fm) => fm.key("v").not.oneOf(["a", "b"])).ok).toBe(false);
  });
  it("not.matches", () => {
    expect(run({ v: "abc" }, (fm) => fm.key("v").not.matches(/^\d+$/)).ok).toBe(true);
    expect(run({ v: "123" }, (fm) => fm.key("v").not.matches(/^\d+$/)).ok).toBe(false);
  });
  it("not.hasAll / not.hasAny", () => {
    expect(run({ v: ["a"] }, (fm) => fm.key("v").not.hasAll(["a", "b"])).ok).toBe(true);
    expect(run({ v: ["a", "b"] }, (fm) => fm.key("v").not.hasAll(["a", "b"])).ok).toBe(false);
    expect(run({ v: ["x"] }, (fm) => fm.key("v").not.hasAny(["a", "b"])).ok).toBe(true);
    expect(run({ v: ["a"] }, (fm) => fm.key("v").not.hasAny(["a", "b"])).ok).toBe(false);
  });
  it("not.length / not.lengthMin / not.lengthMax", () => {
    expect(run({ v: "ab" }, (fm) => fm.key("v").not.length(3)).ok).toBe(true);
    expect(run({ v: "abc" }, (fm) => fm.key("v").not.length(3)).ok).toBe(false);
    expect(run({ v: "ab" }, (fm) => fm.key("v").not.lengthMin(3)).ok).toBe(true);
    expect(run({ v: "abcd" }, (fm) => fm.key("v").not.lengthMax(3)).ok).toBe(true);
  });

  it("negated length matchers on a non-measurable value report n/a", () => {
    const min = run({}, (fm) => fm.key("v").not.lengthMin(1));
    expect(min.ok).toBe(true);
    expect(min.results[0]!.message).toContain("n/a");
    const max = run({}, (fm) => fm.key("v").not.lengthMax(1));
    expect(max.ok).toBe(true);
    expect(max.results[0]!.message).toContain("n/a");
    const exact = run({}, (fm) => fm.key("v").not.length(3));
    expect(exact.results[0]!.message).toContain("n/a");
  });
});

describe("has / hasAll / hasAny on strings (substring containment)", () => {
  it("hasAll matches every substring", () => {
    expect(run({ v: "hello world" }, (fm) => fm.key("v").hasAll(["hello", "world"])).ok).toBe(true);
    expect(run({ v: "hello" }, (fm) => fm.key("v").hasAll(["hello", "world"])).ok).toBe(false);
  });
  it("hasAny matches at least one substring", () => {
    expect(run({ v: "hello" }, (fm) => fm.key("v").hasAny(["zzz", "ell"])).ok).toBe(true);
  });
  it("containment fails when the container is neither array nor string", () => {
    expect(run({ v: 42 }, (fm) => fm.key("v").hasAll(["4"])).ok).toBe(false);
    expect(run({ v: 42 }, (fm) => fm.key("v").hasAny(["4"])).ok).toBe(false);
  });
});

describe("eq deep equality over objects", () => {
  it("compares nested objects structurally", () => {
    expect(run({ v: { a: 1, b: { c: 2 } } }, (fm) => fm.key("v").eq({ a: 1, b: { c: 2 } })).ok).toBe(true);
  });
  it("fails when key counts differ", () => {
    expect(run({ v: { a: 1 } }, (fm) => fm.key("v").eq({ a: 1, b: 2 })).ok).toBe(false);
  });
  it("fails when a value differs", () => {
    expect(run({ v: { a: 1 } }, (fm) => fm.key("v").eq({ a: 2 })).ok).toBe(false);
  });
  it("fails when arrays differ in length", () => {
    expect(run({ v: [1] }, (fm) => fm.key("v").eq([1, 2])).ok).toBe(false);
  });
  it("compares against undefined without crashing", () => {
    const r = run({}, (fm) => fm.key("v").eq(undefined));
    expect(r.failures[0]!.message).toContain("undefined");
  });
  it("treats an object and an array as unequal", () => {
    expect(run({ v: { 0: "a" } }, (fm) => fm.key("v").eq(["a"])).ok).toBe(false);
  });
  it("treats null and an object as unequal", () => {
    expect(run({ v: null }, (fm) => fm.key("v").eq({})).ok).toBe(false);
    expect(run({ v: {} }, (fm) => fm.key("v").eq(null)).ok).toBe(false);
  });
  it("oneOf matches an object member deeply", () => {
    expect(run({ v: { a: 1 } }, (fm) => fm.key("v").oneOf([{ a: 1 }, { b: 2 }])).ok).toBe(true);
  });
});

describe("type() edge cases", () => {
  it("distinguishes null from object", () => {
    expect(run({ v: null }, (fm) => fm.key("v").type("null")).ok).toBe(true);
    expect(run({ v: null }, (fm) => fm.key("v").type("object")).ok).toBe(false);
  });
  it("a missing key is reported as type undefined", () => {
    const r = run({}, (fm) => fm.key("v").type("string"));
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.message).toContain("undefined");
  });
  it("an unsupported runtime value is neither a known type", () => {
    expect(run({ v: (() => 1) as unknown }, (fm) => fm.key("v").type("object")).ok).toBe(false);
  });
});

describe("display() tolerance", () => {
  it("falls back to String() for values JSON cannot serialize", () => {
    // A BigInt argument makes JSON.stringify throw inside the message builder.
    const r = run({ v: ["x"] }, (fm) => fm.key("v").has(1n as unknown));
    expect(r.ok).toBe(false);
    expect(r.failures[0]!.message).toContain("1");
  });
});
