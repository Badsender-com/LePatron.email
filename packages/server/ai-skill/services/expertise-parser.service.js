'use strict';

const { SectionIdRegex } = require('../constant/skill-constants.js');

const H2_LINE = /^##\s+(.*)$/;
const BRACKET_PREFIX = /^\[([^\]]+)\]\s*(.*)$/;

/**
 * Parse a Markdown body and extract `[section-id] Title` H2 sections.
 *
 * Convention (see PLAN §3.2):
 *   ## [urgency-strategy] Stratégie d'urgence
 *
 * @param {string} markdown
 * @returns {{ sections: Array<{id: string, title: string, position: number}>, errors: string[] }}
 *
 * Errors detected:
 * - section-id that does not match ^[a-z0-9-]+$ (hard error)
 * - duplicate section-id within the same document (hard error)
 * - H2 without bracket prefix (warning string, still listed; does not block)
 */
function parseSections(markdown) {
  const sections = [];
  const errors = [];
  const warnings = [];
  const seenIds = new Set();

  if (typeof markdown !== 'string' || markdown.length === 0) {
    return { sections, errors, warnings };
  }

  const lines = markdown.split(/\r?\n/);
  let position = 0;

  for (const line of lines) {
    const h2Match = H2_LINE.exec(line.trim());
    if (!h2Match) continue;

    const h2Content = h2Match[1].trim();
    const bracketMatch = BRACKET_PREFIX.exec(h2Content);

    if (!bracketMatch) {
      warnings.push(`H2 without [section-id] prefix: "${h2Content}"`);
      continue;
    }

    const id = bracketMatch[1].trim();
    const title = bracketMatch[2].trim();

    if (!SectionIdRegex.test(id)) {
      errors.push(
        `Section id "${id}" is not a valid slug (must match ^[a-z0-9-]+$)`
      );
      continue;
    }

    if (seenIds.has(id)) {
      errors.push(`Duplicate section id "${id}"`);
      continue;
    }

    seenIds.add(id);
    sections.push({ id, title, position });
    position += 1;
  }

  return { sections, errors, warnings };
}

module.exports = { parseSections };
