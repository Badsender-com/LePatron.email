'use strict';

// Severities are fixed and always listed in this order (Error → Warning → Info
// → Not run → Passed). Colour is never the only signal: each has an icon and
// a label. `collapsed`: the group starts folded, so that what needs fixing
// comes first and the list stays short (most checks pass). A check that could
// not run is never folded away: the user must see it was not judged.
//
// Frozen: the panel reads these from its template, and Vue would otherwise
// make module constants reactive.
const SEVERITY_ORDER = Object.freeze([
  'error',
  'warning',
  'info',
  'not-run',
  'success',
]);

// Translation keys are prefixed: the editor merges this dictionary with
// Mosaico's, where a bare "Error" or "Copy" would collide.
const SEVERITY_META = Object.freeze({
  error: Object.freeze({
    icon: 'lucide-alert-circle',
    labelKey: 'quality-severity-error',
    groupKey: 'quality-group-errors',
    countKey: '__count__ errors',
  }),
  warning: Object.freeze({
    icon: 'lucide-triangle-alert',
    labelKey: 'quality-severity-warning',
    groupKey: 'quality-group-warnings',
    countKey: '__count__ warnings',
  }),
  info: Object.freeze({
    icon: 'lucide-info',
    labelKey: 'quality-severity-info',
    groupKey: 'quality-group-infos',
    countKey: '__count__ infos',
    collapsed: true,
  }),
  'not-run': Object.freeze({
    icon: 'lucide-circle-help',
    labelKey: 'quality-severity-not-run',
    groupKey: 'quality-group-not-run',
    countKey: '__count__ checks not run',
  }),
  success: Object.freeze({
    icon: 'lucide-check-circle',
    labelKey: 'quality-severity-passed',
    groupKey: 'quality-group-passed',
    countKey: '__count__ checks passed',
    collapsed: true,
  }),
});

const CATEGORY_KEYS = Object.freeze({
  technical: 'quality-category-technical',
  content: 'quality-category-content',
  accessibility: 'quality-category-accessibility',
  copy: 'quality-category-copy',
  performance: 'quality-category-performance',
});

module.exports = { SEVERITY_ORDER, SEVERITY_META, CATEGORY_KEYS };
