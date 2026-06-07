# fluorite

**English** · [日本語](./README.ja.md)

[![npm](https://img.shields.io/npm/v/@yukyu30/fluorite.svg)](https://www.npmjs.com/package/@yukyu30/fluorite)
[![node](https://img.shields.io/node/v/@yukyu30/fluorite.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@yukyu30/fluorite.svg)](./LICENSE)

> Validate Markdown **frontmatter** with a readable, chainable DSL — as a
> **library** or a **CLI**.

fluorite checks the YAML frontmatter at the top of your Markdown files: that the
keys you expect exist, have the right type, match a pattern, stay within an
allowed vocabulary, and so on. You describe the rules once; fluorite reports
every file as red or green and exits non-zero when something drifts — ideal for
**CI** and **pre-commit**.

```md
---
title: "Getting started with fluorite"
date: 2026-06-07
tags: ["guide", "release"]
---
```

```ts
import { check } from "@yukyu30/fluorite";

const result = check(markdown, (fm) => {
  fm.key("title").required().type("string").lengthMin(10);
  fm.key("date").required().isoDate();
  fm.key("tags").type("array").subsetOf(["guide", "release", "news"]);
});

result.ok;       // true / false
result.failures; // the rules that didn't pass, each with a readable reason
```

## Why fluorite?

- **Reads like a sentence.** `fm.key("title").required().type("string").lengthMin(10)`
  — the rule _is_ the documentation.
- **Never throws.** Every matcher records a pass/fail result with a reason.
  Malformed YAML or a missing block becomes a failure, not a crash — so you can
  always collect and report.
- **Unquoted dates stay strings.** YAML turns `date: 2026-06-07` into a `Date`
  and erases how it was written. fluorite keeps it verbatim, so you can validate
  the `YYYY-MM-DD` form without quoting every value
  ([why this matters](#dates-stay-strings)).
- **One tool, two entry points.** The same rule set runs as a library (in an
  SSG / build script) and as a CLI (in CI / pre-commit).
- **Drop-in.** Ships ESM + CommonJS with TypeScript types. Node 18+, four small
  dependencies, no config required to start.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Core idea](#core-idea)
- [Matchers](#matchers)
- [Dates stay strings](#dates-stay-strings)
- [Recipes](#recipes)
- [CLI](#cli)
- [API](#api)
- [Development](#development)
- [Releasing](#releasing)

## Install

Requires **Node.js 18+**. The package ships both ESM and CommonJS builds with
TypeScript types.

```sh
npm install -D @yukyu30/fluorite   # dev dependency — typical for CI / pre-commit
npm install    @yukyu30/fluorite   # runtime dependency — if you call it at build time
```

```sh
pnpm add -D @yukyu30/fluorite
yarn add -D @yukyu30/fluorite
```

Or run the CLI with no install at all:

```sh
npx @yukyu30/fluorite check "docs/**/*.md"
```

## Quick start

Pick the entry point that fits. Both run the exact same kind of rule set.

### As a CLI

1. Put your rules in a config file:

   ```js
   // fluorite.config.mjs
   import { defineConfig } from "@yukyu30/fluorite";

   export default defineConfig({
     include: ["docs/**/*.md"],
     rules: (fm) => {
       fm.key("title").required().type("string").lengthMin(10);
       fm.key("date").required().isoDate();
       fm.key("tags").required().type("array");
     },
   });
   ```

2. Run it:

   ```sh
   npx fluorite check
   ```

   ```
   ✘ docs/draft.md
     ✘ title: length should be >= 10 (was 5) (value: "Hello")
   ✔ docs/intro.md

   2 files, 1 passed, 1 failed, 1 rule failures
   ```

The command exits `1` when any file fails, so wiring it into CI is a single
line. See [CLI](#cli) for options and config details.

### As a library

```ts
import { check } from "@yukyu30/fluorite";

const result = check(markdownSource, (fm) => {
  fm.key("title").required().lengthMin(10);
  fm.key("tags").not.has("draft");
});

if (!result.ok) {
  for (const f of result.failures) console.error(`${f.key}: ${f.message}`);
}
```

`check` never throws — read `result.ok` / `result.failures` and report however
you like. See [API](#api) for the full surface.

## Core idea

**Results, not exceptions.** A rule set is just a function that receives `fm`
(a recorder) and calls matchers on keys. Every matcher records one result;
nothing throws. `check` gathers them into a `CheckResult`:

| field      | description                                  |
| ---------- | -------------------------------------------- |
| `ok`       | `true` when every rule passed                |
| `results`  | every recorded result, in order              |
| `failures` | only the failing results                     |
| `data`     | the parsed frontmatter object                |

Each entry (a `RuleResult`) carries the `key`, the matcher `rule`, its `ok`
flag, a human-readable `message`, and the actual `value`. A missing frontmatter
block or malformed YAML is recorded as a failing `parse` rule — a broken file is
a red line in the report, never a stack trace.

## Matchers

Start a chain with `fm.key("name")`, then chain matchers. `.not` negates **only
the next** matcher, then resets.

```ts
fm.key("tags").type("array").hasAll(["blog"]).not.has("ng");
```

**Existence & type**

| matcher                   | passes when                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `required()` / `exists()` | the key is present                                                                                 |
| `type(t)`                 | value is of type `t` — `"string" \| "number" \| "boolean" \| "array" \| "object" \| "null" \| "date"` |

**Value**

| matcher          | passes when                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| `eq(value)`      | deep-equals `value`                                                                  |
| `oneOf([...])`   | value is one of the allowed set (enum)                                               |
| `matches(re)`    | string matches the pattern                                                           |
| `isoDate()`      | string is a real `YYYY-MM-DD` date (rejects timestamps & impossible dates like `2026-02-30`) |

**Containment** (arrays & strings)

| matcher          | passes when                                                       |
| ---------------- | ---------------------------------------------------------------- |
| `has(v)`         | array contains the element, or string contains the substring     |
| `hasAll([...])`  | contains every item                                              |
| `hasAny([...])`  | contains at least one item                                       |

**Array contents** — keep a tag / enum vocabulary clean

| matcher                          | passes when                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `subsetOf([...])` / `only([...])` | every array element is in the allowed set; failures list the offenders |
| `each.oneOf([...])`              | the same check, via the per-element accessor                         |
| `each.type(t)`                   | every element is of type `t`                                         |
| `each.matches(re)`               | every (string) element matches the pattern                          |
| `each.isoDate()`                 | every element is a `YYYY-MM-DD` date                                 |

**Length** (arrays & strings)

| matcher         | passes when            |
| --------------- | ---------------------- |
| `length(n)`     | length equals `n`      |
| `lengthMin(n)`  | length `>= n`          |
| `lengthMax(n)`  | length `<= n`          |

```ts
check(source, (fm) => {
  fm.key("status").oneOf(["draft", "published"]);
  fm.key("slug").matches(/^[a-z0-9-]+$/);
  fm.key("date").isoDate();
  fm.key("tags").type("array").subsetOf(["blog", "news"]).not.has("wip");
  fm.key("summary").lengthMin(20).lengthMax(160);
});
```

## Dates stay strings

This is the thing most frontmatter linters get wrong.

YAML 1.1 coerces an unquoted `date: 2026-06-07` into a JavaScript `Date`, which
**erases how it was written**: a clean `YYYY-MM-DD`, a full timestamp, and even
a typo all collapse into the same `Date` object. You can't lint a format you
can no longer see — unless you quote every single date in every file.

fluorite parses frontmatter with a schema that omits the timestamp type, so
**dates stay verbatim strings**. `isoDate()` — or a plain
`matches(/^\d{4}-\d{2}-\d{2}$/)` — then validates the written form directly, with
no quoting required:

```ts
fm.key("date").required().isoDate();
```

```
2026-06-07           → ok
2026-06-07 10:30:00  → fails — has a time component
2026-6-7             → fails — not zero-padded
2026-02-30           → fails — not a real calendar day
```

Booleans, numbers and `null` are still parsed as usual — only dates are kept as
written.

## Recipes

Concrete, copy-pasteable patterns. The matcher vocabulary is in
[Matchers](#matchers).

### Lint blog / docs frontmatter in CI

Keep every post consistent and fail the build when it drifts. Put the rules in a
config file and call `fluorite check` from your pipeline.

```js
// fluorite.config.mjs
import { defineConfig } from "@yukyu30/fluorite";

export default defineConfig({
  include: ["content/**/*.md"],
  exclude: ["**/drafts/**"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10).lengthMax(70);
    fm.key("date").required().isoDate();
    fm.key("description").required().lengthMin(50).lengthMax(160); // good for SEO
    fm.key("draft").type("boolean");
  },
});
```

```yaml
# .github/workflows/content.yml
- run: npm ci
- run: npx fluorite check   # exits 1 on any failure → red CI
```

### Catch tag typos & pin a vocabulary

Tags drift fast (`Blog` vs `blog`, a stray `ng`). Pin the canonical set and
fluorite names the exact offending values — or enforce a notation rule instead
of maintaining a list.

```js
const TAGS = ["release", "blog", "news", "guide"];

fm.key("tags").required().type("array").subsetOf(TAGS);
// tags: ["blog", "New", "ng"]
// → all items should be one of [...] (invalid: ["New","ng"])

// …or don't keep a list — just require lowercase kebab-case:
fm.key("tags").each.matches(/^[a-z0-9-]+$/);
```

### Stricter rules once a post is published

The rule set is a function and `fm.data` is the parsed frontmatter, so you can
apply tighter rules conditionally.

```js
export default defineConfig({
  rules: (fm) => {
    fm.key("status").required().oneOf(["draft", "review", "published"]);

    if (fm.data.status === "published") {
      fm.key("date").required().isoDate();
      fm.key("author").required().type("string");
      fm.key("description").required().lengthMin(50);
      fm.key("tags").not.has("wip"); // can't ship a work-in-progress tag
    }
  },
});
```

### Validate slugs, versions & dates with patterns

```js
fm.key("slug").required().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); // kebab-case
fm.key("version").matches(/^\d+\.\d+\.\d+$/);                    // semver
fm.key("date").required().isoDate();                            // YYYY-MM-DD
```

### Check frontmatter in a build script

Use the library directly when you generate a site or want a custom report.
`check` never throws — collect results across files yourself.

```ts
import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import { check } from "@yukyu30/fluorite";

const failed: string[] = [];
for (const file of await glob("content/**/*.md")) {
  const result = check(await readFile(file, "utf8"), (fm) => {
    fm.key("title").required().lengthMin(10);
    fm.key("tags").type("array").subsetOf(["blog", "news"]);
  });
  if (!result.ok) {
    failed.push(file);
    for (const f of result.failures) console.error(`${file} → ${f.key}: ${f.message}`);
  }
}
if (failed.length) process.exit(1);
```

### Validate data that isn't Markdown (CMS / API)

Already have a parsed object? Skip the Markdown step with `checkData` — handy
for a headless CMS, an API payload, or a YAML / JSON loader.

```ts
import { checkData } from "@yukyu30/fluorite";

const entry = await cms.getEntry("home"); // { title, tags, ... }
const result = checkData(entry, (fm) => {
  fm.key("title").required().type("string");
  fm.key("tags").subsetOf(["featured", "evergreen"]);
});
```

### Block bad frontmatter before it lands (pre-commit)

```jsonc
// package.json — with lint-staged + husky
{
  "lint-staged": {
    "content/**/*.md": "fluorite check"
  }
}
```

## CLI

```sh
fluorite check [patterns...] [options]
```

Collects files via glob, checks each file's frontmatter against the config's
rule set, prints a red/green report, and exits `1` if any file fails.

```
✘ docs/bad.md
  ✘ title: length should be >= 10 (was 2) (value: "短い")
  ✘ tags: should not have "ng" (value: ["ok","ng"])
✔ docs/good.md

2 files, 1 passed, 1 failed, 2 rule failures
```

**Options**

- `-c, --config <path>` — path to a config file
  (default: `fluorite.config.{js,mjs,cjs}`)
- `-q, --quiet` — only print files that have failures
- `-h, --help` — show help

**Config file**

```js
// fluorite.config.mjs
import { defineConfig } from "@yukyu30/fluorite";

export default defineConfig({
  include: ["docs/**/*.md"],
  exclude: ["**/node_modules/**"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10);
    fm.key("tags").required().type("array").not.has("ng");
  },
});
```

Positional patterns on the CLI override `include`. If neither is given,
`**/*.md` is used; `exclude` defaults to `**/node_modules/**`.

## API

### `check(source, rules) => CheckResult`

Parses the frontmatter out of a Markdown `source` string and runs the `rules`
callback against it. See [Core idea](#core-idea) for the shape of `CheckResult`.
A missing block or malformed YAML is recorded as a failing `parse` rule rather
than thrown.

### `checkData(data, rules) => CheckResult`

The same, but runs against an already-parsed frontmatter object — no Markdown
step.

### `defineConfig(config) => FluoriteConfig`

Identity helper that gives a config file full type inference. `config` is
`{ include?, exclude?, rules }`.

### Also exported

For advanced use, fluorite also exports `parseFrontmatter`, `loadConfig`,
`resolveConfigPath`, `formatReports`, the `Recorder` / `KeyAssertion` /
`EachAssertion` classes, and the `CheckResult`, `RuleResult`, `RulesFn`,
`FluoriteConfig`, and `ValueType` types.

## Development

```sh
npm test          # run the test suite (vitest)
npm run coverage  # run with a coverage report (v8)
npm run typecheck # tsc --noEmit
npm run build     # bundle to dist/ with tsup
```

The suite covers the matcher DSL (every matcher, its `.not` form, and the
`each.*` accessor), frontmatter parsing, the aggregate `check` / `checkData`
results, config loading, the report formatter, and the CLI — both in-process and
by running the built `dist/cli.js` end-to-end.

## Releasing

Releases are automated with [tagpr](https://github.com/Songmu/tagpr) +
`npm publish` (`.github/workflows/tagpr.yml`):

1. Push commits to `main`. tagpr opens/updates a **Release PR** that bumps the
   version in `package.json` and updates `CHANGELOG.md`.
2. Label the Release PR `minor` / `major` to control the bump (default: patch).
3. Merge the Release PR. tagpr creates the `vX.Y.Z` tag + GitHub Release, and
   the same workflow run publishes the package to npm.

Publishing uses npm **trusted publishing (OIDC)** — no `NPM_TOKEN` secret, and
provenance is attached automatically.

<details>
<summary>One-time setup</summary>

1. **First publish** (the package must exist before a trusted publisher can be
   attached). From your machine:
   ```sh
   npm login
   npm publish --access public
   ```
2. GitHub → repo **Settings → Environments → New environment** named `release`.
   Optionally add protection rules (e.g. required reviewers) so a publish waits
   for manual approval. The `publish` job runs in this environment.
3. On npmjs.com → the package → **Settings → Trusted Publisher → GitHub
   Actions**, set:
   - Organization or user: `yukyu30`
   - Repository: `fluorite`
   - Workflow filename: `tagpr.yml`
   - Environment: `release` _(must match step 2)_
4. GitHub → Settings → Actions → General → enable "Allow GitHub Actions to
   create and approve pull requests" (for tagpr).

After that, every merged Release PR publishes automatically with no token. The
`tagpr` job maintains the Release PR on every push to `main`; only the separate
`publish` job is gated by the `release` environment, so protection rules apply
to publishing alone.

</details>

## License

MIT
