import { parseFrontmatter } from "./parse.js";
import { Recorder } from "./recorder.js";
import type { CheckResult, RulesFn, RuleResult } from "./types.js";

/**
 * Run a rule set against the frontmatter of a Markdown source string.
 *
 * Never throws: malformed YAML or a missing frontmatter block is surfaced as a
 * failing {@link RuleResult} so results can always be collected and reported.
 *
 * ```ts
 * const result = check(markdown, (fm) => {
 *   fm.key("title").required().lengthMin(10);
 *   fm.key("tags").not.has("ng");
 * });
 * if (!result.ok) console.error(result.failures);
 * ```
 */
export function check(source: string, rules: RulesFn): CheckResult {
  const parsed = parseFrontmatter(source);
  const recorder = new Recorder(parsed.data);

  if (parsed.error) {
    recorder.push(parseErrorResult(`invalid frontmatter: ${parsed.error}`));
  } else if (!parsed.hasFrontmatter) {
    recorder.push(parseErrorResult("no frontmatter block found"));
  } else {
    rules(recorder);
  }

  const results = recorder.results;
  const failures = results.filter((r) => !r.ok);
  return {
    ok: failures.length === 0,
    results,
    failures,
    data: parsed.data,
  };
}

/** Run a rule set against already-parsed frontmatter data. */
export function checkData(
  data: Record<string, unknown>,
  rules: RulesFn,
): CheckResult {
  const recorder = new Recorder(data);
  rules(recorder);
  const results = recorder.results;
  const failures = results.filter((r) => !r.ok);
  return { ok: failures.length === 0, results, failures, data };
}

function parseErrorResult(message: string): RuleResult {
  return {
    key: "(frontmatter)",
    rule: "parse",
    ok: false,
    negated: false,
    message,
    value: undefined,
  };
}
