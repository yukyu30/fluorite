import type { Recorder } from "./recorder.js";
import type { RuleResult, ValueType } from "./types.js";

/** Sentinel meaning "the key was not present in the frontmatter". */
const MISSING = Symbol("missing");

function valueType(value: unknown): ValueType | "undefined" {
  if (value === MISSING) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === "object") {
    return t;
  }
  return "undefined";
}

function lengthOf(value: unknown): number | undefined {
  if (typeof value === "string" || Array.isArray(value)) return value.length;
  return undefined;
}

function display(value: unknown): string {
  if (value === MISSING) return "undefined";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Fluent, chainable assertions for a single frontmatter key.
 *
 * Each terminal matcher records one {@link RuleResult} on the parent
 * {@link Recorder} and returns `this`, so matchers can be chained:
 *
 * ```ts
 * fm.key("title").required().type("string").lengthMin(10);
 * fm.key("tags").not.has("ng");
 * ```
 *
 * The `.not` modifier negates only the next matcher, then resets.
 */
export class KeyAssertion {
  #negated = false;

  constructor(
    private readonly recorder: Recorder,
    private readonly key: string,
    private readonly value: unknown,
    private readonly present: boolean,
  ) {}

  /** Negate the next matcher in the chain. */
  get not(): this {
    this.#negated = true;
    return this;
  }

  /** The raw value (resolved against the sentinel) used by matchers. */
  private get resolved(): unknown {
    return this.present ? this.value : MISSING;
  }

  /**
   * Record a result, applying the pending `.not` negation, then reset it.
   */
  private record(
    rule: string,
    rawPass: boolean,
    describe: (negated: boolean) => string,
    expected?: unknown,
  ): this {
    const negated = this.#negated;
    this.#negated = false;
    const ok = negated ? !rawPass : rawPass;
    const result: RuleResult = {
      key: this.key,
      rule,
      ok,
      negated,
      message: describe(negated),
      value: this.present ? this.value : undefined,
      expected,
    };
    this.recorder.push(result);
    return this;
  }

  /** Assert the key exists in the frontmatter. */
  required(): this {
    return this.record(
      "required",
      this.present,
      (neg) => (neg ? `should not exist` : `is required`),
    );
  }

  /** Alias of {@link required}. */
  exists(): this {
    return this.record(
      "exists",
      this.present,
      (neg) => (neg ? `should not exist` : `should exist`),
    );
  }

  /** Assert the value is of the given type. */
  type(expected: ValueType): this {
    const actual = valueType(this.resolved);
    return this.record(
      "type",
      actual === expected,
      (neg) =>
        neg
          ? `should not be of type ${expected}`
          : `should be of type ${expected} (was ${actual})`,
      expected,
    );
  }

  /** Assert the value strictly equals `expected` (deep for arrays/objects). */
  eq(expected: unknown): this {
    return this.record(
      "eq",
      deepEqual(this.resolved, expected),
      (neg) =>
        neg
          ? `should not equal ${display(expected)}`
          : `should equal ${display(expected)}`,
      expected,
    );
  }

  /** Assert the value is one of `allowed` (enum). */
  oneOf(allowed: readonly unknown[]): this {
    return this.record(
      "oneOf",
      allowed.some((a) => deepEqual(this.resolved, a)),
      (neg) =>
        neg
          ? `should not be one of ${display(allowed)}`
          : `should be one of ${display(allowed)}`,
      allowed,
    );
  }

  /** Assert a string value matches the given regular expression. */
  matches(pattern: RegExp): this {
    const v = this.resolved;
    const pass = typeof v === "string" && pattern.test(v);
    return this.record(
      "matches",
      pass,
      (neg) =>
        neg
          ? `should not match ${pattern}`
          : `should match ${pattern}`,
      pattern.source,
    );
  }

  /** Assert an array contains `item`, or a string contains the substring. */
  has(item: unknown): this {
    const v = this.resolved;
    let pass = false;
    if (Array.isArray(v)) pass = v.some((el) => deepEqual(el, item));
    else if (typeof v === "string" && typeof item === "string")
      pass = v.includes(item);
    return this.record(
      "has",
      pass,
      (neg) =>
        neg ? `should not have ${display(item)}` : `should have ${display(item)}`,
      item,
    );
  }

  /** Assert an array/string contains all of `items`. */
  hasAll(items: readonly unknown[]): this {
    const v = this.resolved;
    const pass = items.every((item) => contains(v, item));
    return this.record(
      "hasAll",
      pass,
      (neg) =>
        neg
          ? `should not have all of ${display(items)}`
          : `should have all of ${display(items)}`,
      items,
    );
  }

  /** Assert an array/string contains at least one of `items`. */
  hasAny(items: readonly unknown[]): this {
    const v = this.resolved;
    const pass = items.some((item) => contains(v, item));
    return this.record(
      "hasAny",
      pass,
      (neg) =>
        neg
          ? `should not have any of ${display(items)}`
          : `should have any of ${display(items)}`,
      items,
    );
  }

  /** Assert the string/array length equals `n`. */
  length(n: number): this {
    const len = lengthOf(this.resolved);
    return this.record(
      "length",
      len === n,
      (neg) =>
        neg
          ? `length should not be ${n} (was ${len ?? "n/a"})`
          : `length should be ${n} (was ${len ?? "n/a"})`,
      n,
    );
  }

  /** Assert the string/array length is at least `n`. */
  lengthMin(n: number): this {
    const len = lengthOf(this.resolved);
    return this.record(
      "lengthMin",
      len !== undefined && len >= n,
      (neg) =>
        neg
          ? `length should be < ${n} (was ${len ?? "n/a"})`
          : `length should be >= ${n} (was ${len ?? "n/a"})`,
      n,
    );
  }

  /** Assert the string/array length is at most `n`. */
  lengthMax(n: number): this {
    const len = lengthOf(this.resolved);
    return this.record(
      "lengthMax",
      len !== undefined && len <= n,
      (neg) =>
        neg
          ? `length should be > ${n} (was ${len ?? "n/a"})`
          : `length should be <= ${n} (was ${len ?? "n/a"})`,
      n,
    );
  }
}

function contains(container: unknown, item: unknown): boolean {
  if (Array.isArray(container)) return container.some((el) => deepEqual(el, item));
  if (typeof container === "string" && typeof item === "string")
    return container.includes(item);
  return false;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((el, i) => deepEqual(el, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual(ao[k], bo[k]));
}
