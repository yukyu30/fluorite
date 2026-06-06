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
import { check } from "fluorite";

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
npm install fluorite
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
import { defineConfig } from "fluorite";

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

## License

MIT
