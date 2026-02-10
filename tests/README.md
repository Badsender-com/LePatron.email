# Tests Directory

This directory contains all unit tests for LePatron.email, organized to mirror the source code structure.

## Structure

```
/tests/
├── README.md                      # This file
├── server/                        # Backend tests
│   ├── comment/
│   │   ├── comment.test.js
│   │   ├── comment.service.test.js
│   │   └── comment.controller.test.js
│   ├── notification/
│   │   └── notification.test.js
│   └── ...                        # Other backend resources
└── ui/                            # Frontend tests
    ├── components/
    │   ├── notification-bell.test.js
    │   └── ...
    └── utils/
        ├── date-helpers.test.js
        └── ...
```

## Principles

### Mirror Source Structure

Tests mirror the source code structure exactly:

- **Source**: `packages/server/comment/comment.service.js`
- **Test**: `tests/server/comment/comment.service.test.js`

### Centralized, Not Co-located

- All unit tests are in this `/tests/` directory
- Easier to find and manage all tests
- Clear separation between source and test code
- Avoids cluttering source directories

### Import Paths

Since tests are in a separate directory, use relative paths to import source:

```javascript
// tests/server/comment/comment.test.js
const commentService = require('../../../packages/server/comment/comment.service');

// tests/ui/components/notification-bell.test.js
import NotificationBell from '../../../packages/ui/components/notification-bell.vue';
```

## Running Tests

```bash
# Run all tests
yarn test

# Run specific test file
yarn test tests/server/comment/comment.test.js

# Run tests matching pattern
yarn test -- --grep "Comment"

# Run tests in watch mode
yarn test --watch

# Run with coverage
yarn test --coverage
```

## Writing Tests

### Backend Test Template

```javascript
// tests/server/{resource}/{resource}.test.js
'use strict';

const service = require('../../../packages/server/{resource}/{resource}.service');

describe('{Resource} Service', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('create', () => {
    it('should create a new {resource}', async () => {
      const data = {
        /* test data */
      };
      const result = await service.create(data);

      expect(result).toBeDefined();
      expect(result.field).toBe(data.field);
    });

    it('should throw error if required field missing', async () => {
      await expect(service.create({})).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find {resource} by id', async () => {
      // Test implementation
    });
  });
});
```

### Frontend Test Template

```javascript
// tests/ui/components/{component}.test.js
import { mount, shallowMount } from '@vue/test-utils';
import Component from '../../../packages/ui/components/{component}.vue';

describe('Component', () => {
  it('should render correctly', () => {
    const wrapper = shallowMount(Component);
    expect(wrapper.exists()).toBe(true);
  });

  it('should emit event on click', async () => {
    const wrapper = mount(Component);
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });

  it('should display prop value', () => {
    const wrapper = mount(Component, {
      propsData: { message: 'Test' },
    });
    expect(wrapper.text()).toContain('Test');
  });
});
```

### Utility Test Template

```javascript
// tests/ui/utils/{util}.test.js
import { functionName } from '../../../packages/ui/utils/{util}';

describe('functionName', () => {
  it('should handle normal case', () => {
    expect(functionName('input')).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(functionName('')).toBe('');
    expect(functionName(null)).toBe(null);
  });

  it('should throw on invalid input', () => {
    expect(() => functionName(undefined)).toThrow();
  });
});
```

## Test Coverage

Check test coverage:

```bash
yarn test --coverage
```

Coverage reports are generated in `/coverage/` directory.

### Coverage Goals

- Critical paths: 80%+ coverage
- Services and controllers: 70%+ coverage
- Utilities: 90%+ coverage
- UI components: 60%+ coverage

## Best Practices

### Do

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Test edge cases and error conditions
- ✅ Keep tests isolated (no dependencies between tests)
- ✅ Use `beforeEach`/`afterEach` for setup/cleanup
- ✅ Mock external dependencies (API calls, database)

### Don't

- ❌ Test framework code (e.g., testing if Vue reactive works)
- ❌ Test trivial getters/setters
- ❌ Share state between tests
- ❌ Make tests depend on execution order
- ❌ Test implementation details (internal functions)

## Mocking

### Mock Database Calls

```javascript
jest.mock('../../../packages/server/utils/database', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));
```

### Mock External APIs

```javascript
jest.mock('axios');
axios.get.mockResolvedValue({
  data: {
    /* mock data */
  },
});
```

### Mock Vue Store

```javascript
const store = {
  state: { user: { id: '123' } },
  dispatch: jest.fn(),
  commit: jest.fn(),
};
```

## CI Integration

Tests run automatically:

- On every push
- On every pull request
- Before deployment

**CI Requirements**:

- All tests must pass
- No failing tests allowed
- Coverage thresholds must be met (if configured)

## Migration Guide

If you have existing co-located tests (e.g., `comment.test.js` next to `comment.service.js`):

1. **Move** the test file to the `/tests/` directory

   ```bash
   mv packages/server/comment/comment.test.js tests/server/comment/comment.test.js
   ```

2. **Update** import paths in the test file

   ```javascript
   // Before
   const service = require('./comment.service');

   // After
   const service = require('../../../packages/server/comment/comment.service');
   ```

3. **Run** tests to verify they still work
   ```bash
   yarn test tests/server/comment/comment.test.js
   ```

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Testing conventions
- [docs/AI_POLICIES.md](../docs/AI_POLICIES.md) - Testing requirements
- [packages/documentation/tests/README.md](../packages/documentation/tests/README.md) - Integration tests
