# Test Documentation

This folder contains testing documentation, checklists, and integration/E2E test guides.

## Organization

```
/tests/                            # Unit tests (mirrors source structure)
  /server/
    /comment/comment.test.js       # Backend unit tests
    /notification/notification.test.js
  /ui/
    /components/...                # Frontend unit tests

/packages/documentation/tests/
├── README.md                      # This file
├── *-testing-checklist.md         # Feature testing checklists
└── integration/                   # Integration test documentation
```

## Testing Strategy

### Unit Tests

- **Location**: `/tests/` directory (mirrors source structure)
- **Pattern**: Mirrors the source code structure
- **Example**:
  - Source: `packages/server/comment/comment.service.js`
  - Test: `tests/server/comment/comment.test.js`
  - Source: `packages/ui/components/notification-bell.vue`
  - Test: `tests/ui/components/notification-bell.test.js`
- **Run**: `yarn test` (executed by CI)
- **Framework**: Jest

### Integration/E2E Tests

- **Location**: This folder (`/packages/documentation/tests/`)
- **Purpose**: End-to-end testing guides and integration tests
- **Not run by CI**: These are manual or separate E2E test suites

### Testing Checklists

- **Location**: This folder
- **Purpose**: Manual QA checklists for features
- **Example**: `comments-testing-checklist.md`
- **Usage**:
  - Created for each major feature
  - Used by QA team for manual testing
  - References for automated test creation

## Before Committing

Always run:

```bash
yarn code:lint    # Check for linting errors
yarn code:fix     # Auto-fix and format
yarn test         # Run unit tests
```

## Creating New Tests

### Backend Unit Tests

```javascript
// tests/server/comment/comment.test.js
'use strict';

// Import from source location (relative path from tests/)
const commentService = require('../../../packages/server/comment/comment.service');

describe('Comment Service', () => {
  it('should create a comment', async () => {
    const comment = await commentService.create({
      mailingId: 'test-id',
      content: 'Test comment',
      userId: 'user-123',
    });
    expect(comment).toBeDefined();
    expect(comment.content).toBe('Test comment');
  });
});
```

### Frontend Unit Tests

```javascript
// tests/ui/components/notification-bell.test.js
import { mount } from '@vue/test-utils';
import NotificationBell from '../../../packages/ui/components/notification-bell.vue';

describe('NotificationBell', () => {
  it('should display unread count', () => {
    const wrapper = mount(NotificationBell, {
      propsData: { unreadCount: 5 },
    });
    expect(wrapper.text()).toContain('5');
  });
});
```

### Testing Checklist Template

```markdown
# {Feature} Testing Checklist

## Test Environment

- [ ] Local development
- [ ] Staging
- [ ] Production

## Functional Tests

- [ ] Test case 1
- [ ] Test case 2

## Edge Cases

- [ ] Edge case 1
- [ ] Edge case 2

## Browser Compatibility

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Mobile Testing

- [ ] iOS Safari
- [ ] Android Chrome
```

## CI/CD Integration

Unit tests are run automatically by the CI:

- On every push
- On every pull request
- Before deployment

If tests fail:

- PR cannot be merged
- Deployment is blocked
- Fix tests before proceeding

## Related Documentation

- [AGENTS.md](../../../AGENTS.md) - Development conventions
- [../../docs/AI_POLICIES.md](../../../../../docs/AI_POLICIES.md) - Quality standards
