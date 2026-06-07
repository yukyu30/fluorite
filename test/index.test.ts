import { describe, it, expect } from "vitest";
import * as fluorite from "../src/index.js";

describe("public API surface", () => {
  it("re-exports the documented entry points", () => {
    expect(typeof fluorite.check).toBe("function");
    expect(typeof fluorite.checkData).toBe("function");
    expect(typeof fluorite.defineConfig).toBe("function");
    expect(typeof fluorite.loadConfig).toBe("function");
    expect(typeof fluorite.resolveConfigPath).toBe("function");
    expect(typeof fluorite.parseFrontmatter).toBe("function");
    expect(typeof fluorite.formatReports).toBe("function");
    expect(typeof fluorite.Recorder).toBe("function");
    expect(typeof fluorite.KeyAssertion).toBe("function");
    expect(typeof fluorite.EachAssertion).toBe("function");
  });

  it("the re-exported check() works end to end", () => {
    const r = fluorite.check(`---\ntitle: hello world\n---\nbody`, (fm) =>
      fm.key("title").required().lengthMin(5),
    );
    expect(r.ok).toBe(true);
  });
});
