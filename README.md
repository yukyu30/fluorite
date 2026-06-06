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

## Claude Code skill

The package ships a [Claude Code](https://claude.com/claude-code) **skill** at
`skills/fluorite/SKILL.md` so an agent can author and review fluorite rules,
configs, and CLI invocations for you. It is included in the published tarball,
so once `@yukyu30/fluorite` is installed you can wire it up from
`node_modules`.

Install it for a single project:

```sh
mkdir -p .claude/skills
cp -r node_modules/@yukyu30/fluorite/skills/fluorite .claude/skills/fluorite
# or symlink to track upgrades automatically:
ln -s ../../node_modules/@yukyu30/fluorite/skills/fluorite .claude/skills/fluorite
```

Or install it globally for every project:

```sh
cp -r node_modules/@yukyu30/fluorite/skills/fluorite ~/.claude/skills/fluorite
```

Claude Code discovers the skill by its `name` / `description` frontmatter and
loads it when you ask it to validate Markdown frontmatter or work with
fluorite.

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
2. On npmjs.com → the package → **Settings → Trusted Publisher → GitHub
   Actions**, set:
   - Organization or user: `yukyu30`
   - Repository: `fluorite`
   - Workflow filename: `tagpr.yml`
   - Environment: *(leave empty)*
3. GitHub → Settings → Actions → General → enable
   "Allow GitHub Actions to create and approve pull requests" (for tagpr).

After that, every merged Release PR publishes automatically with no token.

## License

MIT
