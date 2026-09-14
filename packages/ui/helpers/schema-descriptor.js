// Fetch + cache for skill input-schema descriptors, plus field-label
// humanisation. Pure JS (no component state) so it stays testable and the
// InputForm component keeps its line budget.

import { aiSkillSchemaDescriptor } from '~/helpers/ai-skill-routes.js';

// schemaId → Promise<descriptor|null>. Caching the promise (not the value)
// deduplicates concurrent calls for the same schema.
const cache = new Map();

/**
 * @param {Object} $axios Nuxt axios instance
 * @param {string} schemaId
 * @param {{ fresh?: boolean }} [options] `fresh: true` bypasses the cache —
 *   used when the selected skill CHANGES, so a stale descriptor (e.g. a
 *   super-admin edited the skill's inputSchemaId meanwhile) never feeds the
 *   form. The cache only serves re-renders of the same schema.
 * @returns {Promise<Object|null>} descriptor, or null when unknown (404)
 */
export function fetchSchemaDescriptor($axios, schemaId, { fresh } = {}) {
  if (!schemaId) return Promise.resolve(null);
  if (fresh || !cache.has(schemaId)) {
    const promise = $axios
      .$get(aiSkillSchemaDescriptor(schemaId))
      .catch((err) => {
        cache.delete(schemaId);
        if (err.response && err.response.status === 404) return null;
        throw err;
      });
    cache.set(schemaId, promise);
  }
  return cache.get(schemaId);
}

export function clearDescriptorCache() {
  cache.clear();
}

/**
 * Human label for an input field: the i18n override table first
 * (aiPlayground.fieldLabels.*), then automatic humanisation
 * (camelCase / snake_case / dots → spaced words, capitalized).
 */
export function humanizeFieldLabel(vm, name) {
  const key = `aiPlayground.fieldLabels.${name}`;
  if (vm.$te(key)) return vm.$t(key);
  const words = String(name)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_.]+/g, ' ')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Optional example placeholder for a field (aiPlayground.fieldPlaceholders.*).
 */
export function fieldPlaceholder(vm, name) {
  const key = `aiPlayground.fieldPlaceholders.${name}`;
  return vm.$te(key) ? vm.$t(key) : '';
}
