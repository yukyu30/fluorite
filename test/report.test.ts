import { describe, it, expect } from "vitest";
import { formatReports, type FileReport } from "../src/report.js";
import { checkData } from "../src/check.js";
import type { RulesFn } from "../src/types.js";

// picocolors may or may not emit ANSI depending on the environment; strip it so
// assertions are stable either way.
const strip = (s: string) => s.replace(/\[[0-9;]*m/g, "");

function report(file: string, data: Record<string, unknown>, rules: RulesFn): FileReport {
  return { file, result: checkData(data, rules) };
}

const requireLongTitle: RulesFn = (fm) => fm.key("title").required().lengthMin(10);

describe("formatReports", () => {
  it("lists passing files and a green summary", () => {
    const out = strip(
      formatReports([
        report("a.md", { title: "これは十分に長いタイトル" }, requireLongTitle),
        report("b.md", { title: "これも十分に長いタイトル" }, requireLongTitle),
      ]),
    );
    expect(out).toContain("✔ a.md");
    expect(out).toContain("✔ b.md");
    expect(out).toContain("2 files, 2 passed, 0 failed, 0 rule failures");
  });

  it("lists each failing rule under the file", () => {
    const out = strip(
      formatReports([report("bad.md", { title: "短い" }, requireLongTitle)]),
    );
    expect(out).toContain("✘ bad.md");
    expect(out).toContain("title: length should be >= 10");
    expect(out).toContain('(value: "短い")');
    expect(out).toContain("1 files, 0 passed, 1 failed, 1 rule failures");
  });

  it("counts every rule failure across files", () => {
    const out = strip(
      formatReports([
        report("x.md", {}, (fm) => {
          fm.key("title").required();
          fm.key("tags").required();
        }),
      ]),
    );
    expect(out).toContain("1 failed, 2 rule failures");
  });

  it("quiet mode hides passing files but keeps failures", () => {
    const out = strip(
      formatReports(
        [
          report("good.md", { title: "これは十分に長いタイトル" }, requireLongTitle),
          report("bad.md", { title: "x" }, requireLongTitle),
        ],
        { quiet: true },
      ),
    );
    expect(out).not.toContain("good.md");
    expect(out).toContain("✘ bad.md");
    // The summary still accounts for the passing file.
    expect(out).toContain("2 files, 1 passed, 1 failed");
  });

  it("handles an empty report list", () => {
    const out = strip(formatReports([]));
    expect(out).toContain("0 files, 0 passed, 0 failed, 0 rule failures");
  });

  it("tolerates values that cannot be JSON-stringified", () => {
    // A BigInt makes JSON.stringify throw; displayValue must fall back.
    const out = strip(
      formatReports([
        report("big.md", { n: 1n }, (fm) => fm.key("n").type("string")),
      ]),
    );
    expect(out).toContain("✘ big.md");
    expect(out).toContain("value: 1");
  });
});
