# AI_POLICIES.md - AI Agent Best Practices

This document defines policies and best practices when working with AI coding agents on LePatron.email.

## PR Structure and Separation of Concerns

### One Feature Per PR

- **NEVER mix multiple unrelated features in a single PR**
- Split large features into logical, reviewable PRs
- Example: Comments feature + Notifications should be **2 separate PRs**
  - PR #1: Backend foundation for comments
  - PR #2: Notifications system
  - This makes reviews manageable and reduces risk of merge conflicts

### Documentation PRs

- **Agent instruction files (../../AGENTS.md, CLAUDE.md, etc.) should be in separate PRs**
- Don't bundle documentation updates with feature implementations
- Documentation PRs should be:
  - Small and focused
  - Easy to review
  - Merged quickly to keep guidance up-to-date

### PR Checklist

Before creating a PR, verify:

- [ ] Single, focused feature or fix
- [ ] No unrelated documentation changes included
- [ ] Branch name follows convention (e.g., `feat/comments`, not `mvp-comments`)
- [ ] CI is passing (no failing tests)
- [ ] Linting passes (`yarn code:lint`)
- [ ] Files respect 300-line limit

## Testing and CI

### Test Organization

```
/tests/                                           # All unit tests (mirrors source structure)
  /server/
    /comment/comment.test.js                      # Backend unit tests
    /notification/notification.test.js
  /ui/
    /components/...                               # Frontend unit tests
/packages/documentation/tests/                    # Integration/E2E tests + checklists
```

### Before Pushing

```bash
yarn code:lint        # Check for errors
yarn code:fix         # Auto-fix and format
yarn test             # Run all tests
```

### CI Failures

- **NEVER push if CI is failing**
- Fix test failures before requesting review
- Don't create PRs with known failing tests
- If a test fails after your changes, it's your responsibility to fix it

## Code Quality Standards

### File Size Limits

- **Maximum 300 lines per file** (strictly enforced)
- If approaching this limit:
  - Split into multiple smaller files
  - Extract reusable functions to `/utils`
  - Break components into sub-components
- Agent should proactively warn when files approach 300 lines

### DRY Principle (Don't Repeat Yourself)

```javascript
// ❌ BAD - Duplicated code
// File 1: badsender-comments.js
function formatDate(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 60) return diffMins + ' min';
  // ... more logic
}

// File 2: notification-bell.vue
function formatDate(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 60) return diffMins + ' min';
  // ... same logic
}

// ✅ GOOD - Extracted to utility
// utils/date-helpers.js
export function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 60) return diffMins + ' min';
  // ... logic in one place
}

// Both files import from utils
import { formatRelativeDate } from '~/utils/date-helpers';
```

### Constants Extraction

```javascript
// ❌ BAD - Repeated strings
$.ajax({ url: '/api/mailings/' + mailingId + '/comments' });
$.post('/api/mailings/' + mailingId + '/comments', data);

// ✅ GOOD - Named constant
const COMMENTS_API_URL = '/api/mailings/' + mailingId + '/comments';
$.ajax({ url: COMMENTS_API_URL });
$.post(COMMENTS_API_URL, data);
```

## Unused Code Detection

### Before Committing

- **Verify all new constants/enums are actually used**
- Search codebase for references: `grep -r "CONSTANT_NAME" .`
- Example issue from review:
  ```javascript
  // notification.schema.js
  COMMENT_NEW: 'comment_new',  // ⚠️ Not used in code - verify if needed
  ```

### Removing Unused Code

- If a constant/function is unused, either:
  - Remove it entirely
  - Document where it will be used (with TODO)
  - Or use it if it was intended to be used

## Parameters and Pagination

### Parameter Usage Verification

When adding API parameters, verify:

```javascript
// Example from review
async function findByUser({ userId, limit, skip }) {
  // ⚠️ Questions to answer:
  // 1. Is 'skip' parameter actually used in the query?
  // 2. Is 'skip' the right parameter for pagination? (vs 'page' or 'offset')
  // 3. Is pagination properly documented in API docs?
}
```

### Best Practices

- Use standard pagination patterns (`limit`/`offset` or `page`/`pageSize`)
- Document all query parameters in API routes
- Verify parameters are used in implementation

## UI/UX Consistency

### Component Reuse

- **ALWAYS check existing components before creating new ones**
- Reference [ux-guidelines.md](./ux-guidelines.md) for design system
- Verify component naming is consistent with existing patterns

### Icon and Badge Conventions

- Use consistent iconography
- Example from review: "Add comment" button looks like "Add badge"
  - Solution: Use text labels, not just icons
  - Or use recognizable comment icon (💬)

## Agent Instructions Hierarchy

When multiple instruction files exist:

1. **../../AGENTS.md** - Primary technical guidelines (architecture, conventions)
2. **AI_POLICIES.md** - This file (PR structure, quality standards)
3. **ux-guidelines.md** - UI/UX specific guidelines
4. **CLAUDE.md** - Claude Code specific commands and shortcuts

## Review Process

### Self-Review Before Submitting

Agent should perform self-review checking:

- [ ] PR contains only related changes
- [ ] All files under 300 lines
- [ ] No code duplication
- [ ] Constants extracted
- [ ] Unused code removed
- [ ] yarn code:lint passes
- [ ] Tests pass
- [ ] UX guidelines followed (if UI changes)

### Responding to Review Feedback

When reviewer requests changes:

- Address all CRITICAL and HIGH issues immediately
- Document why MEDIUM/LOW issues were not addressed (if applicable)
- Re-run linting and tests after fixes
- Update PR description with changes made

## Common Anti-Patterns to Avoid

### ❌ Anti-Pattern: Large Monolithic PRs

```
PR #960: "MVP Comments"
- Adds comment system (15 files)
- Adds notification system (8 files)
- Updates ../../AGENTS.md
- Adds testing checklist
```

**Problem**: Too many changes, hard to review, high risk

### ✅ Better Approach

```
PR #960: "Comments System - Backend Foundation"
- comment.schema.js
- comment.service.js
- comment.controller.js
- comment.routes.js
- Tests

PR #961: "Comments System - Editor Integration"
- badsender-comments.js
- Editor UI components

PR #962: "Notification System"
- notification.schema.js
- notification.service.js
- notification.controller.js

PR #963: "Agent Guidelines Update"
- ../../AGENTS.md updates
- AI_POLICIES.md
```

### ❌ Anti-Pattern: Ignoring File Size Limits

**Problem**: 600+ line files are unmaintainable

### ✅ Solution

Split into focused modules:

```
comment/
  comment.service.js         # Core business logic (< 300 lines)
  comment.validation.js      # Validation rules (< 100 lines)
  comment.notifications.js   # Notification helpers (< 150 lines)
```

### ❌ Anti-Pattern: Copy-Paste Code

**Problem**: Same logic duplicated across multiple files

### ✅ Solution

Extract to shared utilities:

```
utils/
  date-helpers.js
  api-helpers.js
  validation-helpers.js
```

## Continuous Improvement

This file is a living document. When you encounter issues in code reviews:

1. Add the issue pattern to this file
2. Provide good/bad examples
3. Suggest preventive measures
4. Update agent instructions accordingly

---

**Remember**: Quality over speed. A well-structured, clean PR merged in 2 days is better than a rushed, messy PR that takes 2 weeks to review and fix.
