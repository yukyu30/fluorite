import { describe, it, expect } from "vitest";
import { check, checkData } from "../src/check.js";
import type { RulesFn, RuleResult } from "../src/types.js";

function firstFailure(data: Record<string, unknown>, rules: RulesFn): RuleResult {
  const r = checkData(data, rules);
  return r.failures[0]!;
}

// The report messages are part of the documented UX (they appear in the CLI
// output and the README), so pin the wording for the common matchers.
describe("failure messages", () => {
  it("required / type / length", () => {
    expect(firstFailure({}, (fm) => fm.key("title").required()).message).toBe("is required");
    expect(firstFailure({ v: 1 }, (fm) => fm.key("v").type("string")).message).toBe(
      "should be of type string (was number)",
    );
    expect(firstFailure({ v: "ab" }, (fm) => fm.key("v").lengthMin(10)).message).toBe(
      "length should be >= 10 (was 2)",
    );
    expect(firstFailure({ v: 1 }, (fm) => fm.key("v").lengthMin(1)).message).toBe(
      "length should be >= 1 (was n/a)",
    );
  });

  it("eq / oneOf / matches", () => {
    expect(firstFailure({ v: "a" }, (fm) => fm.key("v").eq("b")).message).toContain(
      'should equal "b"',
    );
    expect(firstFailure({ v: "z" }, (fm) => fm.key("v").oneOf(["a", "b"])).message).toContain(
      'should be one of ["a","b"]',
    );
    expect(firstFailure({ v: "nope" }, (fm) => fm.key("v").matches(/^\d+$/)).message).toContain(
      "should match",
    );
  });

  it("has and its negation", () => {
    expect(firstFailure({ tags: ["ok"] }, (fm) => fm.key("tags").has("blog")).message).toBe(
      'should have "blog"',
    );
    expect(firstFailure({ tags: ["ok", "ng"] }, (fm) => fm.key("tags").not.has("ng")).message).toBe(
      'should not have "ng"',
    );
  });

  it("subsetOf names the offending values", () => {
    const msg = firstFailure({ tags: ["ok", "Blog", "ng"] }, (fm) =>
      fm.key("tags").subsetOf(["ok", "release"]),
    ).message;
    expect(msg).toContain("all items should be one of");
    expect(msg).toContain('invalid: ["Blog","ng"]');
  });

  it("subsetOf on a non-array explains the expectation", () => {
    expect(firstFailure({ tags: "ok" }, (fm) => fm.key("tags").subsetOf(["ok"])).message).toContain(
      "should be an array of values from",
    );
  });

  it("each.* names the offending values, or the type on a non-array", () => {
    expect(
      firstFailure({ tags: ["ok", "NG"] }, (fm) => fm.key("tags").each.oneOf(["ok"])).message,
    ).toContain('invalid: ["NG"]');
    expect(
      firstFailure({ tags: "ok" }, (fm) => fm.key("tags").each.type("string")).message,
    ).toContain("should be an array of string");
    expect(
      firstFailure({ tags: "ok" }, (fm) => fm.key("tags").each.matches(/x/)).message,
    ).toContain("should be an array of strings matching");
  });

  it("parse failures carry an explanatory message", () => {
    expect(check("no frontmatter here", (fm) => fm.key("a").required()).failures[0]!.message).toBe(
      "no frontmatter block found",
    );
    expect(
      check(`---\nbad: "open\n---\nbody`, (fm) => fm.key("a").required()).failures[0]!.message,
    ).toContain("invalid frontmatter");
  });
});
