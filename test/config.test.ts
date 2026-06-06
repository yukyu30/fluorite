import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import {
  defineConfig,
  resolveConfigPath,
  loadConfig,
} from "../src/config.js";

const created: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fluorite-config-"));
  created.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("defineConfig", () => {
  it("returns its argument unchanged (identity helper)", () => {
    const cfg = { include: ["a.md"], rules: () => {} };
    expect(defineConfig(cfg)).toBe(cfg);
  });
});

describe("resolveConfigPath", () => {
  it("resolves an explicit path against cwd", async () => {
    const dir = await tempDir();
    const resolved = await resolveConfigPath("my.config.mjs", dir);
    expect(isAbsolute(resolved!)).toBe(true);
    expect(resolved).toBe(join(dir, "my.config.mjs"));
  });

  it("discovers a conventional config file in cwd", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "fluorite.config.mjs"), "export default { rules: () => {} };");
    const resolved = await resolveConfigPath(undefined, dir);
    expect(resolved).toBe(join(dir, "fluorite.config.mjs"));
  });

  it("prefers .js over .mjs/.cjs when several exist", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "fluorite.config.js"), "export default { rules: () => {} };");
    await writeFile(join(dir, "fluorite.config.mjs"), "export default { rules: () => {} };");
    const resolved = await resolveConfigPath(undefined, dir);
    expect(resolved).toBe(join(dir, "fluorite.config.js"));
  });

  it("returns undefined when no config exists", async () => {
    const dir = await tempDir();
    expect(await resolveConfigPath(undefined, dir)).toBeUndefined();
  });
});

describe("loadConfig", () => {
  it("loads a default-exported config object", async () => {
    const dir = await tempDir();
    const path = join(dir, "fluorite.config.mjs");
    await writeFile(
      path,
      "export default { include: ['x.md'], rules: (fm) => fm.key('title').required() };",
    );
    const cfg = await loadConfig(path);
    expect(cfg.include).toEqual(["x.md"]);
    expect(typeof cfg.rules).toBe("function");
  });

  it("falls back to the module namespace when there is no default export", async () => {
    const dir = await tempDir();
    const path = join(dir, "named.config.mjs");
    await writeFile(path, "export const rules = (fm) => fm.key('title').required();");
    const cfg = await loadConfig(path);
    expect(typeof cfg.rules).toBe("function");
  });

  it("throws when the config has no rules function", async () => {
    const dir = await tempDir();
    const path = join(dir, "bad.config.mjs");
    await writeFile(path, "export default { include: ['x.md'] };");
    await expect(loadConfig(path)).rejects.toThrow(/rules/);
  });

  it("propagates errors thrown while evaluating the config", async () => {
    const dir = await tempDir();
    const path = join(dir, "throws.config.mjs");
    await writeFile(path, "throw new Error('kaboom');");
    await expect(loadConfig(path)).rejects.toThrow(/kaboom/);
  });
});
