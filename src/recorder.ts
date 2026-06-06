import { KeyAssertion } from "./assertion.js";
import type { RuleResult } from "./types.js";

/**
 * The `fm` object passed to a rule set. Holds the parsed frontmatter data,
 * hands out {@link KeyAssertion} instances via {@link key}, and accumulates
 * every {@link RuleResult} the matchers record.
 */
export class Recorder {
  readonly results: RuleResult[] = [];

  constructor(readonly data: Record<string, unknown>) {}

  /** Begin a chain of assertions against the given frontmatter key. */
  key(name: string): KeyAssertion {
    const present = Object.prototype.hasOwnProperty.call(this.data, name);
    return new KeyAssertion(this, name, this.data[name], present);
  }

  /** Internal: append a recorded rule result. */
  push(result: RuleResult): void {
    this.results.push(result);
  }
}
