import { describe, it, expect } from "vitest";
import { checkData } from "../src/check.js";
import type { RulesFn } from "../src/types.js";

function run(data: Record<string, unknown>, rules: RulesFn) {
  return checkData(data, rules);
}

const ALLOWED = ["ok", "release", "blog"] as const;

describe("subsetOf — enum for array contents", () => {
  it("passes when every element is in the allowed set", () => {
    const r = run({ tags: ["ok", "blog"] }, (fm) => fm.key("tags").subsetOf(ALLOWED));
    expect(r.ok).toBe(true);
  });

  it("fails and reports the offending (typo'd) values", () => {
    const r = run({ tags: ["ok", "Blog", "ng"] }, (fm) => fm.key("tags").subsetOf(ALLOWED));
    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(1);
    const f = r.failures[0]!;
    expect(f.rule).toBe("subsetOf");
    // The message should name the values outside the enum.
    expect(f.message).toContain("Blog");
    expect(f.message).toContain("ng");
  });

  it("treats an empty array as valid (vacuously)", () => {
    expect(run({ tags: [] }, (fm) => fm.key("tags").subsetOf(ALLOWED)).ok).toBe(true);
  });

  it("fails when the value is not an array", () => {
    expect(run({ tags: "ok" }, (fm) => fm.key("tags").subsetOf(ALLOWED)).ok).toBe(false);
    expect(run({}, (fm) => fm.key("tags").subsetOf(ALLOWED)).ok).toBe(false);
  });

  it("only() is an alias of subsetOf()", () => {
    expect(run({ tags: ["ok"] }, (fm) => fm.key("tags").only(ALLOWED)).ok).toBe(true);
    expect(run({ tags: ["x"] }, (fm) => fm.key("tags").only(ALLOWED)).ok).toBe(false);
  });

  it("supports negation (must contain something outside the enum)", () => {
    expect(run({ tags: ["ok", "ng"] }, (fm) => fm.key("tags").not.subsetOf(ALLOWED)).ok).toBe(true);
    expect(run({ tags: ["ok"] }, (fm) => fm.key("tags").not.subsetOf(ALLOWED)).ok).toBe(false);
  });
});

describe("each — per-element matchers", () => {
  it("each.oneOf behaves like an enum over array contents", () => {
    expect(run({ tags: ["ok", "blog"] }, (fm) => fm.key("tags").each.oneOf(ALLOWED)).ok).toBe(true);
    expect(run({ tags: ["ok", "nope"] }, (fm) => fm.key("tags").each.oneOf(ALLOWED)).ok).toBe(false);
  });

  it("each.type checks every element's type", () => {
    expect(run({ tags: ["a", "b"] }, (fm) => fm.key("tags").each.type("string")).ok).toBe(true);
    expect(run({ tags: ["a", 1] }, (fm) => fm.key("tags").each.type("string")).ok).toBe(false);
  });

  it("each.matches catches notation drift via a pattern", () => {
    const kebab = /^[a-z0-9-]+$/;
    expect(run({ tags: ["ok", "blog-post"] }, (fm) => fm.key("tags").each.matches(kebab)).ok).toBe(true);
    expect(run({ tags: ["ok", "Blog Post"] }, (fm) => fm.key("tags").each.matches(kebab)).ok).toBe(false);
  });

  it("each on a non-array fails", () => {
    expect(run({ tags: "ok" }, (fm) => fm.key("tags").each.oneOf(ALLOWED)).ok).toBe(false);
  });

  it("reports the offending elements in the message", () => {
    const r = run({ tags: ["ok", "nope", "BLOG"] }, (fm) => fm.key("tags").each.oneOf(ALLOWED));
    expect(r.failures[0]!.message).toContain("nope");
    expect(r.failures[0]!.message).toContain("BLOG");
  });
});

describe("each — negation", () => {
  it("each.not.oneOf passes when no element is in the set", () => {
    expect(run({ tags: ["x", "y"] }, (fm) => fm.key("tags").each.not.oneOf(ALLOWED)).ok).toBe(true);
    expect(run({ tags: ["ok"] }, (fm) => fm.key("tags").each.not.oneOf(ALLOWED)).ok).toBe(false);
  });

  it("each.not.type passes when no element is of the type", () => {
    expect(run({ tags: [1, 2] }, (fm) => fm.key("tags").each.not.type("string")).ok).toBe(true);
    expect(run({ tags: ["a"] }, (fm) => fm.key("tags").each.not.type("string")).ok).toBe(false);
  });

  it("each.not.matches passes when no element matches", () => {
    const kebab = /^[a-z0-9-]+$/;
    expect(run({ tags: ["A", "B"] }, (fm) => fm.key("tags").each.not.matches(kebab)).ok).toBe(true);
    expect(run({ tags: ["ok"] }, (fm) => fm.key("tags").each.not.matches(kebab)).ok).toBe(false);
  });

  it(".not before .each propagates the negation into each", () => {
    expect(run({ tags: ["x", "y"] }, (fm) => fm.key("tags").not.each.oneOf(ALLOWED)).ok).toBe(true);
  });

  it("a non-array fails even when negated (can never satisfy per-element)", () => {
    expect(run({ tags: "ok" }, (fm) => fm.key("tags").each.not.oneOf(ALLOWED)).ok).toBe(false);
  });

  it("each on a missing key fails and records no value", () => {
    const r = run({}, (fm) => fm.key("tags").each.oneOf(ALLOWED));
    expect(r.ok).toBe(false);
    expect(r.results[0]!.value).toBeUndefined();
  });
});
