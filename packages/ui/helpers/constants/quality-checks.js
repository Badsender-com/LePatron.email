// The quality control's checks, for the "Contrôle qualité" settings pages.
//
// The catalogue (states, categories, defaults, bounds) is the one the editor
// and the server read, packages/shared/quality/checks.js: the pages never offer
// a setting the server would refuse, nor miss a check the editor runs. Only
// how the pages lay the checks out is theirs.

export {
  CHECKS,
  CHECK_STATES,
  SERVER_CHECKS,
} from '../../../shared/quality/checks.js';

// In the order the pages list them: by category, as the editor's drawer does.
export const CHECK_CATEGORIES = [
  'copy',
  'accessibility',
  'content',
  'technical',
  'performance',
];
