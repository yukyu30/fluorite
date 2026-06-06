import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const REPO = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const CLI = join(REPO, "dist", "cli.js");

const CONFIG = `export default {
  include: ["**/*.md"],
  rules: (fm) => fm.key("title").required().lengthMin(10),
};
`;
const GOOD = `---\ntitle: "これは十分に長いタイトルです"\n---\nbody\n`;
const BAD = `---\ntitle: "短い"\n---\nbody\n`;

async function runCli(cwd: string, args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

const created: string[] = [];
async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fluorite-bin-"));
  created.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(join(dir, rel), content);
  }
  return dir;
}

// Exercise the real published entrypoint (dist/cli.js): shebang, argv parsing,
// exit codes and the top-level error handler.
describe("fluorite bin (built artifact)", () => {
  beforeAll(async () => {
    if (!existsSync(CLI)) {
      await execFileAsync("npm", ["run", "build"], { cwd: REPO });
    }
  }, 120_000);

  afterEach(async () => {
    await Promise.all(created.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("exits 0 and prints a report when all files pass", async () => {
    const dir = await project({ "good.md": GOOD, "fluorite.config.mjs": CONFIG });
    const { code, stdout } = await runCli(dir, ["check"]);
    expect(code).toBe(0);
    expect(stdout).toContain("good.md");
    expect(stdout).toContain("1 passed");
  });

  it("exits 1 when a file fails", async () => {
    const dir = await project({ "bad.md": BAD, "fluorite.config.mjs": CONFIG });
    const { code, stdout } = await runCli(dir, ["check"]);
    expect(code).toBe(1);
    expect(stdout).toContain("length should be >= 10");
  });

  it("prints help with --help", async () => {
    const dir = await project({});
    const { code, stdout } = await runCli(dir, ["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  it("surfaces an unexpected error via the top-level handler", async () => {
    const dir = await project({ "fluorite.config.mjs": CONFIG });
    // An unknown flag makes argv parsing throw — caught by the bin's handler.
    const { code, stderr } = await runCli(dir, ["check", "--definitely-not-a-flag"]);
    expect(code).toBe(1);
    expect(stderr).toContain("fluorite:");
  });
});
