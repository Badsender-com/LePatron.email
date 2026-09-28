'use strict';

// Severities are fixed and always listed in this order (Error → Warning → Info
// → Passed). Colour is never the only signal: each has an icon and a label.
const SEVERITY_ORDER = ['error', 'warning', 'info', 'success'];

const SEVERITY_META = {
  error: {
    icon: 'lucide-alert-circle',
    labelKey: 'Error',
    groupKey: 'Errors',
    countKey: '__count__ errors',
  },
  warning: {
    icon: 'lucide-triangle-alert',
    labelKey: 'Warning',
    groupKey: 'Warnings',
    countKey: '__count__ warnings',
  },
  info: {
    icon: 'lucide-info',
    labelKey: 'Info',
    groupKey: 'Infos',
    countKey: '__count__ infos',
  },
  success: {
    icon: 'lucide-check-circle',
    labelKey: 'Check passed',
    groupKey: 'Passed',
    countKey: '__count__ checks passed',
  },
};

const CATEGORY_KEYS = {
  technical: 'Technical',
  content: 'Content',
  accessibility: 'Accessibility',
  copy: 'Copy',
  performance: 'Performance',
};

module.exports = { SEVERITY_ORDER, SEVERITY_META, CATEGORY_KEYS };
