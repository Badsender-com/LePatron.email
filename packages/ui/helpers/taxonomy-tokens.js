/**
 * The design tokens of a company's taxonomy (ADR-0026): which dimensions
 * carry some, in the order they are resolved (the last one wins a token two
 * values of one email carry), and what each dimension's values carry.
 * Covered by tests/ui/helpers/taxonomy-tokens.test.js.
 */
import { resolutionOrder } from './taxonomy-builder.js';

const plainTokens = (tokens) =>
  tokens instanceof Map ? Object.fromEntries(tokens) : tokens || {};

const tokenNames = (values, name) => [
  ...new Set(
    values
      .filter((value) => value.type === name && value.isActive !== false)
      .flatMap((value) => Object.keys(plainTokens(value.tokens)))
  ),
];

/**
 * @param {Object} params
 * @param {Object[]} params.dimensions
 * @param {Object[]} params.values
 * @returns {Array<{name: string, label: string, tokens: string[]}>} the
 *   dimensions whose active values carry tokens, the winner last
 */
export function precedenceList({ dimensions = [], values = [] }) {
  const byName = Object.fromEntries(dimensions.map((d) => [d.name, d]));
  return resolutionOrder(dimensions)
    .map((name) => ({
      name,
      label: byName[name].label,
      tokens: tokenNames(values, name).sort(),
    }))
    .filter((entry) => entry.tokens.length > 0);
}

/**
 * @param {string} name a dimension's name
 * @param {Object[]} values
 * @returns {Array<{token: string, carriedBy: Array<{label: string, value: string}>}>}
 *   by token name
 */
export function tokensOfDimension(name, values = []) {
  const own = values.filter((value) => value.type === name);
  return tokenNames(values, name)
    .sort()
    .map((token) => ({
      token,
      carriedBy: own
        .filter((value) => token in plainTokens(value.tokens))
        .map((value) => ({
          label: value.label,
          value: plainTokens(value.tokens)[token],
        })),
    }));
}
