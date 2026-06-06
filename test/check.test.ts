import { describe, it, expect } from "vitest";
import { check, checkData } from "../src/check.js";

const SAMPLE = `---
tags: ["ok", "ng"]
title: "これはタイトルです"
---

本文
`;

describe("check — example from the spec", () => {
  it("records a failure for not.has('ng') when 'ng' is present", () => {
    const result = check(SAMPLE, (fm) => {
      fm.key("tags").not.has("ng");
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      key: "tags",
      rule: "has",
      negated: true,
      ok: false,
    });
  });

  it("passes not.has('xyz') when the value is absent", () => {
    const result = check(SAMPLE, (fm) => {
      fm.key("tags").not.has("xyz");
    });
    expect(result.ok).toBe(true);
  });

  it("checks title length (9 chars: passes >=9, fails >=10)", () => {
    // "これはタイトルです" is 9 characters.
    expect(check(SAMPLE, (fm) => fm.key("title").lengthMin(9)).ok).toBe(true);
    expect(check(SAMPLE, (fm) => fm.key("title").lengthMin(10)).ok).toBe(false);
  });
});

describe("check — collects results without throwing", () => {
  it("reports missing frontmatter as a failure", () => {
    const result = check("just body text", (fm) => {
      fm.key("title").required();
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.rule).toBe("parse");
  });

  it("reports malformed YAML as a parse failure", () => {
    const bad = `---\ntitle: "unterminated\n---\nbody`;
    const result = check(bad, (fm) => {
      fm.key("title").required();
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.rule).toBe("parse");
  });

  it("aggregates multiple rule results in order", () => {
    const result = check(SAMPLE, (fm) => {
      fm.key("title").required().type("string").lengthMin(9);
      fm.key("tags").type("array").has("ok").not.has("ng");
    });
    expect(result.results).toHaveLength(6);
    expect(result.failures.map((f) => f.rule)).toEqual(["has"]);
  });
});

describe("checkData", () => {
  it("runs rules against pre-parsed data", () => {
    const result = checkData({ title: "hi" }, (fm) => {
      fm.key("title").lengthMin(10);
    });
    expect(result.ok).toBe(false);
  });
});
