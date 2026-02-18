# UI Utilities

Shared utility functions for the LePatron.email UI package.

## Purpose

This folder contains reusable utility functions to avoid code duplication across components.

## Organization

```
/packages/ui/utils/
├── README.md           # This file
├── date-helpers.js     # Date formatting and manipulation
├── api-helpers.js      # API request helpers
├── validation-helpers.js # Form validation utilities
└── format-helpers.js   # Text and data formatting
```

## Guidelines

### When to Create a Utility

Create a utility function when:

1. The same code is used in **2+ components**
2. The logic is **pure** (no side effects)
3. The function is **reusable** across different contexts

### When NOT to Create a Utility

Don't create a utility for:

1. Component-specific logic
2. One-off operations
3. Functions tightly coupled to a single component's state

### Anti-Pattern: Premature Abstraction

```javascript
// ❌ BAD - Creating utility for one-time use
// utils/string-helpers.js
export function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Used only once in one component
```

### Good Pattern: Extract Duplicated Code

```javascript
// ✅ GOOD - Used in multiple components
// utils/date-helpers.js
export function formatRelativeDate(dateString) {
  // ... logic used in 3+ components
}

// Used in: notification-bell.vue, comment-list.vue, activity-feed.vue
```

## Example: Date Helpers

**Problem from code review**:

- `formatCommentDate()` duplicated in `badsender-comments.js` and `notification-bell.vue`

**Solution**:

```javascript
// packages/ui/utils/date-helpers.js
/**
 * Format a date as a relative time string (e.g., "5 min", "2h", "3j")
 * @param {string|Date} dateString - The date to format
 * @param {object} i18n - i18n instance for translations (optional)
 * @returns {string} Formatted relative date
 */
export function formatRelativeDate(dateString, i18n = null) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return i18n ? i18n.t('date.now') : 'now';
  } else if (diffMins < 60) {
    return `${diffMins} min`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}j`;
  } else {
    // Format: "12 jan." or "12 jan. 2025"
    const months = [
      'jan.',
      'fév.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
      return `${day} ${month}`;
    }
    return `${day} ${month} ${year}`;
  }
}

/**
 * Format a date as full date string
 * @param {string|Date} dateString
 * @param {string} locale - Locale code (e.g., 'fr', 'en')
 * @returns {string}
 */
export function formatFullDate(dateString, locale = 'fr') {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
```

**Usage in Components**:

```vue
<!-- packages/ui/components/notifications/notification-bell.vue -->
<template>
  <div>
    <span>{{ formatRelativeDate(notification.createdAt, $i18n) }}</span>
  </div>
</template>

<script>
import { formatRelativeDate } from '~/utils/date-helpers';

export default {
  methods: {
    formatRelativeDate,
  },
};
</script>
```

```javascript
// packages/editor/src/js/ext/badsender-comments.js
const { formatRelativeDate } = require('../../../ui/utils/date-helpers');

viewModel.formatCommentDate = function (dateString) {
  return formatRelativeDate(dateString);
};
```

## Example: API Helpers

**Problem from code review**:

- API base URL repeated multiple times: `'/api/mailings/' + mailingId + '/comments'`

**Solution**:

```javascript
// packages/ui/utils/api-helpers.js

/**
 * Build API URL for mailing comments
 * @param {string} mailingId
 * @returns {string}
 */
export function getMailingCommentsUrl(mailingId) {
  return `/api/mailings/${mailingId}/comments`;
}

/**
 * Build API URL for a specific comment
 * @param {string} mailingId
 * @param {string} commentId
 * @returns {string}
 */
export function getCommentUrl(mailingId, commentId) {
  return `/api/mailings/${mailingId}/comments/${commentId}`;
}

/**
 * Build API URL for comment replies
 * @param {string} mailingId
 * @param {string} commentId
 * @returns {string}
 */
export function getCommentRepliesUrl(mailingId, commentId) {
  return `/api/mailings/${mailingId}/comments/${commentId}/replies`;
}

/**
 * Build API URL for resolving comment
 * @param {string} mailingId
 * @param {string} commentId
 * @returns {string}
 */
export function getResolveCommentUrl(mailingId, commentId) {
  return `/api/mailings/${mailingId}/comments/${commentId}/resolve`;
}
```

**Usage**:

```javascript
// Before (❌ BAD - Repeated strings)
$.ajax({ url: '/api/mailings/' + mailingId + '/comments' });
$.post('/api/mailings/' + mailingId + '/comments', data);

// After (✅ GOOD - Using utility)
import { getMailingCommentsUrl } from '~/utils/api-helpers';
const url = getMailingCommentsUrl(mailingId);
$.ajax({ url });
$.post(url, data);
```

## Example: Validation Helpers

```javascript
// packages/ui/utils/validation-helpers.js

/**
 * Check if a string is a valid email
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a string contains mentions (@username)
 * @param {string} text
 * @returns {boolean}
 */
export function hasMentions(text) {
  return /@\w+/.test(text);
}

/**
 * Extract mentioned usernames from text
 * @param {string} text
 * @returns {string[]} Array of usernames (without @)
 */
export function extractMentions(text) {
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return matches.map((m) => m.substring(1)); // Remove @
}

/**
 * Validate comment content
 * @param {string} content
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCommentContent(content) {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Comment cannot be empty' };
  }
  if (content.length > 5000) {
    return { valid: false, error: 'Comment is too long (max 5000 characters)' };
  }
  return { valid: true };
}
```

## Example: Format Helpers

```javascript
// packages/ui/utils/format-helpers.js

/**
 * Format user for display
 * Show name instead of ID
 * @param {object} user - User object with name, email, _id
 * @returns {string}
 */
export function formatUserName(user) {
  if (!user) return 'Unknown';
  return user.name || user.email || `User ${user._id}`;
}

/**
 * Format mention for display
 * @param {object} user
 * @returns {string}
 */
export function formatMention(user) {
  return `@${formatUserName(user)}`;
}

/**
 * Truncate text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format number with locale
 * @param {number} num
 * @param {string} locale
 * @returns {string}
 */
export function formatNumber(num, locale = 'fr') {
  return new Intl.NumberFormat(locale).format(num);
}
```

## Testing Utilities

Create tests for utility functions in `/tests/` directory:

```javascript
// tests/ui/utils/date-helpers.test.js
import { formatRelativeDate } from '../../../packages/ui/utils/date-helpers';

describe('formatRelativeDate', () => {
  it('should format recent dates as "now"', () => {
    const now = new Date();
    expect(formatRelativeDate(now)).toBe('now');
  });

  it('should format minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeDate(fiveMinutesAgo)).toBe('5 min');
  });

  // ... more tests
});
```

## Importing Utilities

### In Vue Components

```javascript
// Use tilde for absolute imports
import { formatRelativeDate } from '~/utils/date-helpers';
import { getMailingCommentsUrl } from '~/utils/api-helpers';
```

### In Editor Code (Mosaico)

```javascript
// Use relative imports
const { formatRelativeDate } = require('../../../ui/utils/date-helpers');
```

### In Server Code

```javascript
// Server has its own utils in packages/server/utils/
const logger = require('../utils/logger');
```

## Utility Function Checklist

Before creating a new utility:

- [ ] Is it used in 2+ places?
- [ ] Is it pure (no side effects)?
- [ ] Is it reusable across contexts?
- [ ] Is it properly documented (JSDoc)?
- [ ] Does it have unit tests?
- [ ] Is it exported in index.js (if applicable)?

## Related Documentation

- [AGENTS.md](../../../AGENTS.md) - Code conventions
- [../../docs/AI_POLICIES.md](../../../../../docs/AI_POLICIES.md) - DRY principle
- [../../docs/UX_GUIDELINES.md](../../../../../docs/UX_GUIDELINES.md) - UI utilities
