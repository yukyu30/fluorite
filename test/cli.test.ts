import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { main, HELP } from "../src/cli-main.js";

/** Capture everything written to stdout/stderr while a block runs. */
function captureIO() {
  const out: string[] = [];
  const err: string[] = [];
  const o = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: unknown) => {
      out.push(String(chunk));
      return true;
    });
  const e = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      err.push(String(chunk));
      return true;
    });
  return {
    get out() {
      return out.join("");
    },
    get err() {
      return err.join("");
    },
    restore() {
      o.mockRestore();
      e.mockRestore();
    },
  };
}

/** Build a throwaway project directory from a map of relative path -> content. */
async function makeProject(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fluorite-cli-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

const GOOD = `---\ntitle: "これは十分に長いタイトルです"\n---\nbody\n`;
const BAD = `---\ntitle: "短い"\n---\nbody\n`;

// A config that needs no imports (loadConfig only requires a `rules` function).
const CONFIG = `export default {
  include: ["**/*.md"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10);
  },
};
`;

describe("CLI main()", () => {
  const originalCwd = process.cwd();
  const created: string[] = [];
  let io: ReturnType<typeof captureIO>;

  async function project(files: Record<string, string>): Promise<string> {
    const dir = await makeProject(files);
    created.push(dir);
    process.chdir(dir);
    return dir;
  }

  beforeEach(() => {
    io = captureIO();
  });

  afterEach(async () => {
    io.restore();
    process.chdir(originalCwd);
    await Promise.all(created.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("--help prints usage and exits 0", async () => {
    const code = await main(["--help"]);
    expect(code).toBe(0);
    expect(io.out).toBe(HELP);
  });

  it("no command prints help to stderr and exits 0", async () => {
    const code = await main([]);
    expect(code).toBe(0);
    expect(io.err).toContain("fluorite — inspect and validate");
  });

  it("unknown command prints an error and exits 1", async () => {
    const code = await main(["bogus"]);
    expect(code).toBe(1);
    expect(io.err).toContain("Unknown command: bogus");
  });

  it("missing config file exits 1 with guidance", async () => {
    await project({ "doc.md": GOOD });
    const code = await main(["check"]);
    expect(code).toBe(1);
    expect(io.err).toContain("No config file found");
  });

  it("invalid config (no rules) exits 1", async () => {
    await project({
      "doc.md": GOOD,
      "fluorite.config.mjs": "export default { include: ['**/*.md'] };",
    });
    const code = await main(["check"]);
    expect(code).toBe(1);
    expect(io.err).toContain("Failed to load config");
  });

  it("a config that throws on import is reported, not crashed", async () => {
    await project({
      "doc.md": GOOD,
      "fluorite.config.mjs": "throw new Error('boom');",
    });
    const code = await main(["check"]);
    expect(code).toBe(1);
    expect(io.err).toContain("Failed to load config");
    expect(io.err).toContain("boom");
  });

  it("no files matched exits 1", async () => {
    await project({ "fluorite.config.mjs": CONFIG });
    const code = await main(["check", "does-not-exist/**/*.md"]);
    expect(code).toBe(1);
    expect(io.err).toContain("No files matched");
  });

  it("passing files exit 0 and print a green report", async () => {
    await project({ "good.md": GOOD, "fluorite.config.mjs": CONFIG });
    const code = await main(["check"]);
    expect(code).toBe(0);
    expect(io.out).toContain("good.md");
    expect(io.out).toContain("1 passed");
    expect(io.out).toContain("0 failed");
  });

  it("failing files exit 1 and print the rule failure", async () => {
    await project({ "bad.md": BAD, "fluorite.config.mjs": CONFIG });
    const code = await main(["check"]);
    expect(code).toBe(1);
    expect(io.out).toContain("bad.md");
    expect(io.out).toContain("length should be >= 10");
    expect(io.out).toContain("1 failed");
  });

  it("discovers fluorite.config.mjs by convention (no --config)", async () => {
    await project({ "bad.md": BAD, "fluorite.config.mjs": CONFIG });
    const code = await main(["check"]);
    expect(code).toBe(1);
  });

  it("honours an explicit --config path", async () => {
    const dir = await project({ "bad.md": BAD });
    await writeFile(join(dir, "custom.config.mjs"), CONFIG);
    const code = await main(["check", "--config", "custom.config.mjs"]);
    expect(code).toBe(1);
    expect(io.out).toContain("bad.md");
  });

  it("--quiet suppresses passing files but still lists failures", async () => {
    await project({
      "good.md": GOOD,
      "bad.md": BAD,
      "fluorite.config.mjs": CONFIG,
    });
    const code = await main(["check", "--quiet"]);
    expect(code).toBe(1);
    expect(io.out).not.toContain("good.md");
    expect(io.out).toContain("bad.md");
  });

  it("falls back to **/*.md when neither CLI nor config gives patterns", async () => {
    await project({
      "bad.md": BAD,
      "fluorite.config.mjs": "export default { rules: (fm) => fm.key('title').lengthMin(10) };",
    });
    const code = await main(["check"]);
    expect(code).toBe(1);
    expect(io.out).toContain("bad.md");
  });

  it("reports a non-Error thrown by the config", async () => {
    await project({
      "doc.md": GOOD,
      "fluorite.config.mjs": "throw 'plain string failure';",
    });
    const code = await main(["check"]);
    expect(code).toBe(1);
    expect(io.err).toContain("Failed to load config");
    expect(io.err).toContain("plain string failure");
  });

  it("positional patterns override config.include", async () => {
    await project({
      "bad.md": BAD,
      "fluorite.config.mjs":
        "export default { include: ['no-such-dir/**/*.md'], rules: (fm) => fm.key('title').lengthMin(10) };",
    });
    // include would match nothing, but the positional pattern matches bad.md.
    const code = await main(["check", "*.md"]);
    expect(code).toBe(1);
    expect(io.out).toContain("bad.md");
  });
});
