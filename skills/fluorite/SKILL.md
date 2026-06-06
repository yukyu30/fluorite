---
name: fluorite
description: >-
  Inspect and validate Markdown YAML frontmatter with @yukyu30/fluorite's
  readable, chainable DSL — as a library (check / checkData) or a CLI
  (fluorite check). Use this whenever you author or review fluorite rules,
  write a fluorite.config.{js,mjs,cjs}, validate frontmatter fields (required
  keys, type, enum/subsetOf, regex, length, array membership) across Markdown
  docs, or wire fluorite into CI. Triggers: "fluorite", "frontmatter
  validation", "check markdown frontmatter", "lint frontmatter tags/title".
---

# fluorite

`@yukyu30/fluorite` inspects and validates Markdown **frontmatter** with a
chainable DSL. It works both as a **library** and a **CLI**.

The core idea: **checks never throw**. Every matcher records a *result object*
(pass/fail with a human-readable reason), so you can collect and report all
failures at once instead of bailing on the first error.

## When to use this skill

- Writing or reviewing `fluorite.config.{js,mjs,cjs}` rule sets.
- Calling `check` / `checkData` from code to validate frontmatter.
- Catching tag/enum drift, missing required keys, wrong types, title length,
  date format, etc. in Markdown docs.
- Wiring `fluorite check` into a CI step that fails on invalid frontmatter.

## Install

```sh
npm install @yukyu30/fluorite
# or as a dev/CI dependency
npm install -D @yukyu30/fluorite
```

Requires Node.js >= 18. The package ships ESM + CJS builds and a `fluorite`
CLI bin.

## Library API

### `check(source, rules) => CheckResult`

Parses frontmatter out of a Markdown `source` string and runs `rules` against
it. A missing frontmatter block or malformed YAML is recorded as a failing
`parse` rule (key `"(frontmatter)"`) instead of throwing.

```ts
import { check } from "@yukyu30/fluorite";

const markdown = `---
title: "これはタイトルです"
tags: ["ok", "ng"]
---
本文`;

const result = check(markdown, (fm) => {
  fm.key("title").required().type("string").lengthMin(10);
  fm.key("tags").not.has("ng");
});

// Checks never throw — ALL failures are collected, not just the first.
// "これはタイトルです" is 9 chars, so lengthMin(10) fails too:
result.ok;       // false
result.failures; // [
                 //   { key: "title", rule: "lengthMin", ok: false, ... },
                 //   { key: "tags",  rule: "has", negated: true, ok: false, ... },
                 // ]
```

### `checkData(data, rules) => CheckResult`

Same DSL, but against an already-parsed frontmatter object (skip the Markdown
parsing step). Useful for unit tests and when you already hold the data.

```ts
import { checkData } from "@yukyu30/fluorite";

checkData({ title: "hi" }, (fm) => fm.key("title").lengthMin(10)).ok; // false
```

### `CheckResult`

| field      | description                                  |
| ---------- | -------------------------------------------- |
| `ok`       | `true` when **every** recorded rule passed   |
| `results`  | every `RuleResult`, in the order recorded    |
| `failures` | only the failing `RuleResult`s               |
| `data`     | the parsed frontmatter object                |

Each `RuleResult` has: `key`, `rule`, `ok`, `negated`, `message`, `value`,
and optional `expected`.

### Other exports

- `defineConfig(config)` — identity helper for typed config authoring.
- `parseFrontmatter(source) => ParseResult` — low-level parse (`data`,
  `content`, `hasFrontmatter`, `error?`).
- `formatReports(reports, { quiet? }) => string` — the colorized CLI report
  formatter (reusable for custom runners).
- Types/classes: `CheckResult`, `RuleResult`, `RulesFn`, `FluoriteConfig`,
  `ValueType`, `Recorder`, `KeyAssertion`, `EachAssertion`, `FileReport`,
  `FormatOptions`, `ParseResult`.

## Matcher DSL

Start a chain with `fm.key("<name>")`, then chain matchers. Each terminal
matcher records one result and returns `this`, so matchers compose:

```ts
fm.key("title").required().type("string").lengthMin(10).lengthMax(80);
```

### Single-value matchers (`fm.key(...)`)

| matcher                | passes when …                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `required()`           | the key exists in the frontmatter                              |
| `exists()`             | alias of `required()`                                          |
| `type(t)`              | value's type is `t` (`string`/`number`/`boolean`/`array`/`object`/`null`) |
| `eq(expected)`         | value deep-equals `expected` (arrays/objects compared by value)|
| `oneOf(allowed)`       | value deep-equals one element of `allowed` (enum)              |
| `matches(regexp)`      | value is a **string** and matches the pattern                 |
| `has(item)`            | array contains `item`, or string contains the substring       |
| `hasAll(items)`        | array/string contains **every** item                          |
| `hasAny(items)`        | array/string contains **at least one** item                   |
| `subsetOf(allowed)`    | value is an array and **every** element is in `allowed`        |
| `only(allowed)`        | alias of `subsetOf()`                                          |
| `length(n)`            | string/array length === `n`                                    |
| `lengthMin(n)`         | string/array length >= `n`                                     |
| `lengthMax(n)`         | string/array length <= `n`                                     |

### Per-element matchers (`fm.key(...).each`)

Apply a matcher to **every** element of an array value. Passes only when the
value is an array and all elements satisfy the matcher; failures list the
offending elements.

| matcher                  | passes when …                                  |
| ------------------------ | ---------------------------------------------- |
| `each.oneOf(allowed)`    | every element is in `allowed`                   |
| `each.type(t)`           | every element is of type `t`                     |
| `each.matches(regexp)`   | every element is a string matching the pattern  |

```ts
fm.key("tags").each.oneOf(["ok", "release", "blog"]);
fm.key("tags").each.matches(/^[a-z0-9-]+$/); // kebab-case only
```

> `subsetOf(allowed)` and `each.oneOf(allowed)` overlap: both enforce an enum
> over array contents. `subsetOf` reports the full set of invalid values in one
> result; pick whichever message you prefer.

### Negation: `.not`

`.not` negates **only the next matcher**, then resets:

```ts
fm.key("tags").not.has("ng").has("ok");
// 1) tags must NOT have "ng"
// 2) tags must have "ok"  (negation already reset)
```

Gotchas to keep in mind when writing rules:

- `.not` applies to a single matcher. To negate several, repeat `.not` before
  each one.
- For type-sensitive matchers (`matches`, `has`, length matchers), a value of
  the wrong type (e.g. a number for `matches`) makes the **base** matcher fail,
  so the **negated** form passes. If you mean "exists AND does not match",
  assert the type first: `fm.key("x").type("string").not.matches(/.../)`.
- `each` on a non-array always fails, even when negated.

## CLI

```sh
fluorite check [patterns...] [options]
```

| option              | meaning                                                      |
| ------------------- | ----------------------------------------------------------- |
| `-c, --config <p>`  | config path (default: `fluorite.config.{js,mjs,cjs}` in cwd)|
| `-q, --quiet`       | only print files that have failures                         |
| `-h, --help`        | show help                                                    |

```sh
fluorite check "docs/**/*.md"
fluorite check --config fluorite.config.mjs
fluorite check -q          # CI-friendly: show only failures
```

Exit code is `0` when all files pass, `1` when any file fails (or on
config/usage errors). File patterns passed on the CLI override `include` from
the config. A config file is **required** for the rule set.

## Config file

Create `fluorite.config.mjs` (or `.js` / `.cjs`) at the project root:

```ts
import { defineConfig } from "@yukyu30/fluorite";

// Canonical tag vocabulary — anything outside this set is drift.
const TAGS = ["ok", "release", "blog", "news"];

export default defineConfig({
  include: ["docs/**/*.md"],            // default: ["**/*.md"]
  exclude: ["**/node_modules/**"],      // default: ["**/node_modules/**"]
  rules: (fm) => {
    fm.key("title").required().type("string").lengthMin(10);
    fm.key("tags").required().type("array").subsetOf(TAGS);
  },
});
```

`FluoriteConfig`:

- `rules` (**required**) — `(fm) => void`, the rule set applied to every file.
- `include?` — glob patterns of Markdown files to check.
- `exclude?` — glob patterns to ignore.

## CI example (GitHub Actions)

```yaml
- run: npx fluorite check "docs/**/*.md" -q
```

The step fails the job (exit 1) when any document's frontmatter is invalid.

## Common recipes

```ts
// Required string with a length window
fm.key("title").required().type("string").lengthMin(10).lengthMax(80);

// ISO date format
fm.key("date").matches(/^\d{4}-\d{2}-\d{2}$/);

// Enum for a single value
fm.key("status").oneOf(["draft", "published"]);

// Enum over array contents + forbid a specific tag
fm.key("tags").subsetOf(["ok", "release", "blog"]).not.has("ng");

// Every tag is kebab-case
fm.key("tags").each.matches(/^[a-z0-9-]+$/);
```

## Behavior notes

- Frontmatter must be a YAML block fenced by `---` at (or near) the very top of
  the file; otherwise it is treated as "no frontmatter" (a failing `parse`
  rule when run through `check`).
- String/array `length` counts UTF-16 code units, so astral characters (some
  emoji) count as 2.
- YAML dates parse to JS `Date` objects, whose `type()` is `"object"`.
