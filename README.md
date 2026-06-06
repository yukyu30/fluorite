# fluorite

Inspect and validate Markdown **frontmatter** with a readable, chainable DSL —
usable as a **library** and a **CLI**.

```md
---
tags: ["ok", "ng"]
title: "これはタイトルです"
---
```

```ts
import { check } from "@yukyu30/fluorite";

const result = check(markdown, (fm) => {
  fm.key("title").required().type("string").lengthMin(10);
  fm.key("tags").not.has("ng"); // ← fails (red) because "ng" is present
});

result.ok; // false
result.failures; // [{ key: "tags", rule: "has", negated: true, ok: false, ... }]
```

Checks never throw — every rule produces a **result object** (pass/fail with a
reason) so you can collect and report them as red/green.

## Install

```sh
npm install @yukyu30/fluorite
```

## Use cases

Concrete recipes for the things people reach for fluorite to do. The matcher
vocabulary used here is documented in full under [Library API](#library-api).

### 1. Lint blog / docs frontmatter in CI

Keep every post's frontmatter consistent and fail the build when it drifts.
Put the rules in a config file and wire `fluorite check` into your pipeline.

```js
// fluorite.config.mjs
import { defineConfig } from "@yukyu30/fluorite";

export default defineConfig({
  include: ["content/**/*.md"],
  exclude: ["**/drafts/**"],
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10).lengthMax(70);
    fm.key("date").required().matches(/^\d{4}-\d{2}-\d{2}$/);
    fm.key("description").required().lengthMin(50).lengthMax(160); // good for SEO
    fm.key("draft").type("boolean");
  },
});
```

```jsonc
// package.json
{
  "scripts": {
    "lint:content": "fluorite check"
  }
}
```

```yaml
# .github/workflows/content.yml
- run: npm ci
- run: npm run lint:content # exits 1 on any failure → red CI
```

### 2. Catch tag typos & enforce a tag vocabulary

Tags drift fast (`Blog` vs `blog`, a stray `ng`). Pin the canonical set and
fluorite names the exact offending values, or enforce a notation rule instead.

```js
const TAGS = ["release", "blog", "news", "guide"];

export default defineConfig({
  rules: (fm) => {
    fm.key("tags").required().type("array").subsetOf(TAGS);
    // tags: ["blog", "New", "ng"]
    // → all items should be one of [...] (invalid: ["New","ng"])
  },
});

// …or don't maintain a list — just require lowercase kebab-case:
fm.key("tags").each.matches(/^[a-z0-9-]+$/);
```

### 3. Enforce a publish workflow with conditional rules

The rule set is just a function, and `fm.data` is the parsed frontmatter — so
you can apply stricter rules only once a post is marked published.

```js
export default defineConfig({
  rules: (fm) => {
    fm.key("status").required().oneOf(["draft", "review", "published"]);

    if (fm.data.status === "published") {
      fm.key("date").required().matches(/^\d{4}-\d{2}-\d{2}$/);
      fm.key("author").required().type("string");
      fm.key("description").required().lengthMin(50);
      fm.key("tags").not.has("wip"); // can't ship a work-in-progress tag
    }
  },
});
```

### 4. Validate identifiers, slugs & dates with patterns

```js
fm.key("slug").required().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); // kebab-case
fm.key("date").required().matches(/^\d{4}-\d{2}-\d{2}$/); // ISO date
fm.key("version").matches(/^\d+\.\d+\.\d+$/); // semver
```

### 5. Check frontmatter programmatically (SSG / build script)

Use the library directly when you generate a site or want a custom report.
`check` never throws — it returns a result you can collect.

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
    for (const f of result.failures) {
      console.error(`${file} → ${f.key}: ${f.message}`);
    }
  }
}
if (failed.length) process.exit(1);
```

### 6. Validate data that isn't Markdown (CMS / API payloads)

Already have the object parsed? Skip the Markdown step with `checkData` — handy
for content coming from a headless CMS, an API, or a YAML/JSON loader.

```ts
import { checkData } from "@yukyu30/fluorite";

const entry = await cms.getEntry("home"); // { title, tags, ... }
const result = checkData(entry, (fm) => {
  fm.key("title").required().type("string");
  fm.key("tags").subsetOf(["featured", "evergreen"]);
});
```

### 7. Block bad frontmatter before it lands (pre-commit)

```jsonc
// package.json — with lint-staged + husky
{
  "lint-staged": {
    "content/**/*.md": "fluorite check"
  }
}
```

## Library API

### `check(source, rules) => CheckResult`

Parses the frontmatter out of a Markdown `source` string and runs the `rules`
callback against it. The `fm` argument is a recorder: each matcher you call
records one result.

```ts
const result = check(source, (fm) => {
  fm.key("title").required().lengthMin(10);
});
```

`CheckResult`:

| field      | description                                  |
| ---------- | -------------------------------------------- |
| `ok`       | `true` when every rule passed                |
| `results`  | every recorded `RuleResult`, in order        |
| `failures` | only the failing `RuleResult`s               |
| `data`     | the parsed frontmatter object                |

A missing frontmatter block or malformed YAML is recorded as a failing
`parse` rule rather than throwing.

### `checkData(data, rules) => CheckResult`

Same as `check`, but runs against an already-parsed frontmatter object.

### Matchers

Begin a chain with `fm.key("name")`. The `.not` modifier negates **only the
next** matcher, then resets.

**Existence / type**

- `required()` / `exists()` — the key is present
- `type(t)` — `"string" | "number" | "boolean" | "array" | "object" | "null"`

**Value**

- `eq(value)` — deep-equality
- `oneOf([...])` — value is one of the allowed set (enum)
- `matches(regexp)` — string matches the pattern

**Containment (arrays & strings)**

- `has(value)` — array contains the element, or string contains the substring
- `hasAll([...])` — contains every item
- `hasAny([...])` — contains at least one item

**Enum / array contents** — catch tag notation drift

- `subsetOf([...])` / `only([...])` — value is an array whose every element is
  in the allowed set; failures list the offending (typo'd) values
- `each.oneOf([...])` — same as `subsetOf`, via the per-element accessor
- `each.type(t)` — every element is of type `t`
- `each.matches(regexp)` — every (string) element matches the pattern

**Length (arrays & strings)**

- `length(n)` — length equals `n`
- `lengthMin(n)` — length `>= n`
- `lengthMax(n)` — length `<= n`

```ts
check(source, (fm) => {
  fm.key("status").oneOf(["draft", "published"]);
  fm.key("slug").matches(/^[a-z0-9-]+$/);
  fm.key("tags").type("array").hasAll(["blog"]).not.has("ng");
  fm.key("summary").lengthMin(20).lengthMax(160);
});
```

### Defining a tag enum

Tags drift easily (`Blog` vs `blog`, stray `ng`). Define the canonical
vocabulary once and `subsetOf` flags anything outside it — the failure names
the exact offending values:

```ts
const TAGS = ["ok", "release", "blog", "news"];

check(source, (fm) => {
  fm.key("tags").type("array").subsetOf(TAGS);
});
// tags: ["ok", "Blog", "ng"]
// → all items should be one of [...] (invalid: ["Blog","ng"])

// Or enforce a notation rule instead of a fixed list:
check(source, (fm) => {
  fm.key("tags").each.matches(/^[a-z0-9-]+$/); // lowercase kebab-case only
});
```

## CLI

```sh
fluorite check "docs/**/*.md" [--config <path>] [--quiet]
```

- Collects files via glob, checks each file's frontmatter, prints a red/green
  report, and exits with code `1` if any file fails (great for CI).
- Rules come from a config file (`fluorite.config.{js,mjs,cjs}`, or `--config`).

```
✘ docs/bad.md
  ✘ title: length should be >= 10 (was 2) (value: "短い")
  ✘ tags: should not have "ng" (value: ["ok","ng"])
✔ docs/good.md

2 files, 1 passed, 1 failed, 2 rule failures
```

Options:

- `-c, --config <path>` — path to a config file
- `-q, --quiet` — only print files that have failures
- `-h, --help` — show help

### Config file

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
`**/*.md` is used.

## Development

```sh
npm test          # run the test suite (vitest)
npm run coverage  # run with a coverage report (v8)
npm run typecheck # tsc --noEmit
npm run build     # bundle to dist/ with tsup
```

The suite covers the matcher DSL (every matcher, its `.not` form, and the
`each.*` accessor), frontmatter parsing, the aggregate `check` / `checkData`
results, config loading, the report formatter, and the CLI — both in-process
and by running the built `dist/cli.js` end-to-end.

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

One-time setup:

1. **First publish** (the package must exist before a trusted publisher can be
   attached). From your machine:
   ```sh
   npm login
   npm publish --access public
   ```
2. GitHub → repo **Settings → Environments → New environment** named
   `release`. Optionally add protection rules (e.g. required reviewers) so a
   publish waits for manual approval. The `publish` job runs in this
   environment.
3. On npmjs.com → the package → **Settings → Trusted Publisher → GitHub
   Actions**, set:
   - Organization or user: `yukyu30`
   - Repository: `fluorite`
   - Workflow filename: `tagpr.yml`
   - Environment: `release` *(must match step 2)*
4. GitHub → Settings → Actions → General → enable
   "Allow GitHub Actions to create and approve pull requests" (for tagpr).

After that, every merged Release PR publishes automatically with no token.
The `tagpr` job maintains the Release PR on every push to `main`; only the
separate `publish` job is gated by the `release` environment, so protection
rules apply to publishing alone.

## License

MIT
