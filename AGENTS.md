# AGENTS.md - AI Agent Instructions

This file provides context for AI coding assistants working on LePatron.email.

## Project Overview

LePatron.email is an open-source email builder based on Mosaico. It allows users to create responsive HTML emails using a drag-and-drop interface, manage templates, and export to various Email Service Providers (ESP).

## Tech Stack

- **Backend**: Node.js 14.16, Express.js, MongoDB 3.4+
- **Frontend**: Vue.js 2, Nuxt.js, Vuex, Vuetify
- **Editor**: Mosaico (Knockout.js based)
- **Build**: Webpack, Babel
- **Package Manager**: Yarn (monorepo with workspaces)

## Project Structure

```
/packages
  /server          # Express API (routes, models, services)
  /ui              # Vue.js/Nuxt frontend
  /editor          # Mosaico email editor
  /documentation   # Project docs
/public            # Static assets, editor templates
/scripts           # Build and utility scripts
```

## Development Commands

```bash
# Install dependencies
yarn

# Development (all packages)
yarn dev

# Build for production
yarn build

# Run tests
yarn test

# Linting and formatting
yarn code:lint          # Detect linter warnings and errors
yarn code:fix           # Auto-fix linter errors and run prettier formatting
yarn code:pretty        # Run prettier formatting only

# Build editor only
yarn editor:build

# Build UI only
yarn build:ui
```

## New Feature Workflow

**When the user asks for a new feature, do not start coding.** Grill it first. A new feature is anything that adds a capability, a screen, an endpoint, a data model or an integration. Bug fixes, refactors, dependency bumps and small changes inside an existing behavior skip this workflow; when in doubt, ask.

Each step has a skill in `.claude/skills/` (Claude Code invokes them by name; other agents read the `SKILL.md`):

| Step | Skill             | Output                                                                               |
| ---- | ----------------- | ------------------------------------------------------------------------------------ |
| 1    | `grill-with-docs` | Shared understanding of the design, agreed test seams, an ADR, `GLOSSARY.md` updates |
| 2    | `to-prd`          | The PRD, published as a GitHub issue labelled `⛰ Epic`                               |
| 3    | `to-issues`       | Tracer-bullet tickets, as sub-issues of the epic with their blocking edges           |
| 4    | `tdd`             | The first PR: the ADR, the glossary, and the acceptance tests, skipped               |
| 5    | `tdd`             | One PR per ticket: turn its tests on (red), implement (green), review with `/review` |

1. **Grill.** Interview the user round by round until every branch of the design is settled; look facts up in the code yourself, leave only decisions to the user. Terms go into `GLOSSARY.md` as they are resolved, decisions into an ADR in `docs/adr/` (`Status: proposed`), on a `feat/<feature>-adr-tests` branch created from `develop` before the first file is written. Nothing moves on before the user confirms the shared understanding.
2. **Epic.** Synthesize the grilling into a PRD (problem, solution, user stories, implementation and testing decisions, out of scope), show it, and publish it once the user agrees. The repository is public: no client name, unfixed vulnerability or secret in any issue.
3. **Tickets.** Split the epic into vertical slices, each one PR, each with its blockers. Ticket 01 is always the ADR + tests PR, and blocks the others. The user approves the breakdown before anything is published.
4. **First PR** (`feat/<feature>-adr-tests`, closes ticket 01). The ADR, the `GLOSSARY.md` changes, and the tests at the agreed seams, written in full as the epic's acceptance criteria inside `describe.skip` blocks that name the ticket turning them on. No production code, CI stays green.
5. **Ticket PRs** (`feat/<feature>-<ticket>`, one per ticket, frontier first). Remove the `.skip` of the ticket's blocks, implement until they pass, add the smaller tests the implementation needs. When the first PR merges, the ADR moves to `Status: accepted`.

Before exploring the code for any task, read `GLOSSARY.md` (if it exists) and the ADRs in `docs/adr/` that touch the area. Use the glossary's terms in code, tests and issues. If a change contradicts an ADR, say so explicitly instead of silently overriding it.

## Parallel Work

Other people and other agents work on this repository at the same time. Before starting a task (a grilling, a ticket, a fix), and again before opening a PR, look for work that overlaps it:

```bash
# Open PRs touching the same area (adapt the path pattern)
gh pr list --state open --limit 50 --json number,title,author,files \
  --jq '.[] | select(any(.files[].path; test("packages/server/mailing/"))) | "#\(.number) \(.title) (@\(.author.login))"'

# Issues and PRs on the same subject, open or recently closed
gh issue list --state all --search "<keywords>" --limit 10
gh pr list --state merged --search "<keywords>" --limit 10

# Other local sessions, and what landed on develop since the branch started
git worktree list
git fetch origin develop && git log --oneline HEAD..origin/develop -- <paths>
```

Nothing found: carry on without comment. Something found: stop, and warn the user in a short block, in their language, before going further:

```
⚠️ Overlapping work
- #1138 (open PR, @someone): changes the quality drawer this task touches
- #1141 (merged yesterday): already fixes the truncated responses

1. Update first? (rebase, pick up their changes, refresh the ticket)
2. Does it change the decision or the scope of this task?
3. Wait for #1138 to merge before going further?
```

Each question gets the user's answer; do not settle them yourself. Never edit, comment on or close someone else's issue or PR without being asked.

## Code Conventions

### General

- Use English for code, comments, and logs (never French in code)
- French is acceptable only for user-facing strings (i18n files)
- No hardcoded values - use config or constants
- All user-facing text must be internationalized

### Naming

- Files: `kebab-case.js` for JS files, `kebab-case.vue` for Vue components
- Vue component names: `PascalCase` (e.g., `name: 'BsUserForm'`)
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- MongoDB models: `PascalCase` (e.g., `Mailing`, `User`, `Group`)

### Branch Naming Convention

```
type/short-description

types:
- feat/    - New features
- fix/     - Bug fixes
- docs/    - Documentation changes
- refactor/ - Code refactoring
- test/    - Adding or updating tests
- chore/   - Maintenance tasks

Examples:
- feat/user-authentication
- fix/login-redirect-bug
- docs/api-guidelines
- refactor/comment-service
```

### Commit Messages (Karma format)

```
type(scope): short description

types: feat, fix, docs, style, refactor, test, chore
scope: server, ui, editor, etc.
```

## Package-Specific Guidelines

### packages/server

- Routes in `/{resource}/{resource}.routes.js`
- Controllers in `/{resource}/{resource}.controller.js`
- Services in `/{resource}/{resource}.service.js`
- Models/schemas in `/{resource}/{resource}.schema.js`
- Unit tests in `/tests/server/{resource}/` (centralized test directory)

**Flat or nested?** A module owning a single entity stays flat, as above —
that covers `mailing`, `group`, `translation`, `ai-feature`, `integration`,
`user`, `workspace`. A module owning several entities uses one sub-folder per
layer (`controllers/`, `services/`, `models/`, `schemas/`, `jobs/`,
`constant/`), as `ai-skill` does for its three entities (skill, expertise,
invocation): 27 flat files would be unreadable. The file-naming rules above
still apply inside each sub-folder, and `/tests/server/{resource}/` mirrors
whichever structure the module uses.

### packages/ui

- Pages in `/pages/`
- Components in `/components/`
- Store modules in `/store/`
- Locales in `/helpers/locales/` (fr.js, en.js)
- Use tilde for absolute imports: `import { api } from '~/helpers/api-routes'`

### packages/editor

- Extensions in `/src/js/ext/`
- Templates in `/src/tmpl-badsender/`
- Editor locales in `/public/lang/` (badsender-fr.js, badsender-en.js)

## Design System

LePatron.email has a documented design system for UI consistency and white-label support.

### Documentation

| Document                                                                           | Content                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [docs/design-system/](./docs/design-system/)                                       | Visual specifications (tokens, components, patterns) |
| [docs/design-system/05-debt-registry.md](./docs/design-system/05-debt-registry.md) | Known UI inconsistencies                             |
| [docs/design-system/07-editor-stack.md](./docs/design-system/07-editor-stack.md)   | Editor-specific documentation                        |
| [docs/UX_GUIDELINES.md](./docs/UX_GUIDELINES.md)                                   | UX patterns, accessibility                           |
| [docs/plans/ui-progressive-update.md](./docs/plans/ui-progressive-update.md)       | UI modernization roadmap (11 phases)                 |

### Key Constraints

**Vue App (`packages/ui/`):**

- Use Vuetify 2.x components (never raw HTML for standard UI)
- Use Material Design Icons via `v-icon`
- Use CSS variables for colors (enables white-label)
- Target font: Work Sans (currently Montserrat)

**Email Editor (`packages/editor/`):**

- Use LESS variables from `style_variables.less`
- Use CSS variables for theme integration (`--v-primary-base`, etc.)
- Use jQuery UI widgets and Knockout bindings
- Use Font Awesome 4.7 icons (`fa fa-*`)

### White-Label Architecture

- **Customizable**: Colors, logo (stored in Group settings)
- **Fixed**: Component structure, UX patterns, layouts

## Mongoose Conventions

### Foreign Keys

Use underscore prefix for references to other collections, with aliases:

```javascript
_company: {
  type: ObjectId,
  ref: 'Group',
  required: true,
  alias: 'group',  // Creates getter without underscore
}
_user: {
  type: ObjectId,
  ref: 'User',
  alias: 'userId',
}
```

### Hidden Fields

Use mongoose-hidden plugin to hide sensitive fields from JSON output:

```javascript
Schema.plugin(mongooseHidden, {
  hidden: { password: true, token: true },
});
```

### Sensitive Fields Encryption

Use encryption plugin for API keys and secrets:

```javascript
const encryptionPlugin = require('../utils/encryption-plugin.js');
ProfileSchema.plugin(encryptionPlugin, ['secretKey', 'apiKey']);
```

### Schema Validation

```javascript
email: {
  type: String,
  required: [true, 'Email is required'],
  validate: [{
    validator: validator.isEmail,
    message: '{VALUE} is not a valid email'
  }]
}
```

## Error Handling

### Pattern

Use http-errors library with ERROR_CODES constants:

```javascript
const createError = require('http-errors');
const { ERROR_CODES } = require('../constant/error-codes.js');
const asyncHandler = require('express-async-handler');

// Wrap all controller functions with asyncHandler
module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
};

// Throw errors with error codes
if (!user) {
  throw new createError.NotFound(ERROR_CODES.USER_NOT_FOUND);
}
```

### Error Codes

All error codes are defined in `/packages/server/constant/error-codes.js`.
Always add new codes there - don't use string literals.

### Error Response Structure

```javascript
// Consistent error handling in controllers
try {
  // ... logic
} catch (error) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: 'Internal server error' });
}
```

## Route Protection

Use guard middleware for protected routes:

```javascript
const { GUARD_USER, GUARD_ADMIN, guard } = require('../account/auth.guard.js');

// Available guards
GUARD_USER; // Logged-in users (regular + admin)
GUARD_ADMIN; // Super admin only
GUARD_GROUP_ADMIN; // Group admin
guard([Roles.X]); // Custom role check

// Usage in routes
router.get('', GUARD_USER, controller.list);
router.delete('/:id', GUARD_ADMIN, controller.delete);
```

## Logging

### Rules

- Use `logger` from `../utils/logger.js`, **NOT** `console.log`
- All logs must be in English
- Never log sensitive data (passwords, tokens, API keys)

```javascript
const logger = require('../utils/logger.js');

// Good
logger.log('Processing mailing', mailingId);
logger.error('Failed to send email', { error: err.message });

// Bad - don't do this
console.log('Upload réussi'); // French + console.log
console.log('Password:', password); // Sensitive data
```

## Utility Libraries

### Lodash

Use for object manipulation:

```javascript
const pick = require('lodash').pick;
const { omit } = require('lodash');

// Pick specific fields from request
const userParams = pick(req.body, ['name', 'email', 'lang']);

// Omit fields when copying
const copy = omit(original, ['_id', 'createdAt', 'updatedAt']);
```

### Validation

- Backend: `validator` library + Mongoose schema validation
- Frontend: `vuelidate` for Vue form validation

## Common Tasks

### Adding a new API endpoint

1. Create or update route file in `packages/server/{resource}/`
2. Add controller function wrapped with `asyncHandler`
3. Add service logic if needed
4. Update schema if new fields required
5. Add guard middleware for protection
6. Add error codes to `error-codes.js` if needed
7. Add tests in `/tests/server/{resource}/`

### Adding a Vue component

1. Create `kebab-case.vue` in `packages/ui/components/`
2. Use `PascalCase` for component name property
3. Add translations in `packages/ui/helpers/locales/fr.js` and `en.js`
4. Use tilde imports for helpers: `import { x } from '~/helpers/...'`
5. Import and use in page or parent component

### Adding editor translations

1. Edit `public/lang/badsender-fr.js` and `badsender-en.js`
2. Use `viewModel.t('key')` in editor code

## Testing

- Backend tests: `yarn test` (uses Jest)
- Test structure mirrors source structure in `/tests` directory:
  ```
  /tests/
    /server/
      /comment/comment.test.js
      /notification/notification.test.js
    /ui/
      /components/...
      /utils/...
  ```
- Run specific test: `yarn test -- --grep "pattern"`
- See [tests/README.md](./tests/README.md) for detailed testing guidelines

> **Note**: Test coverage is currently low. New features should include tests.

## Database

MongoDB collections:

- `users` - User accounts
- `groups` - Organizations/workspaces
- `mailings` - Email campaigns
- `templates` - Email templates (wireframes)
- `profiles` - ESP export profiles
- `galleries` - Image galleries
- `workspaces` - Workspace containers
- `folders` - Folder organization

## ESP Integrations

Supported providers in `packages/server/esp/`:

- Sendinblue (Brevo)
- DSC
- Actito
- Adobe Campaign

## Do's and Don'ts

### Do

- Follow existing code patterns
- Add translations for any user-facing text
- Write tests for new backend features
- Use async/await for asynchronous code
- Use `asyncHandler` wrapper for controller functions
- Use `logger` for all logging
- Use `ERROR_CODES` constants for errors
- Use guard middleware for route protection
- Use Lodash for object manipulation

### Don't

- Hardcode URLs, credentials, or magic numbers
- Skip error handling
- Commit `.env` files or secrets
- Use `var` - prefer `const` and `let`
- Use `console.log` - use `logger` instead
- Write French in code, comments, or logs
- Log sensitive data (passwords, tokens, keys)
- Create circular dependencies between modules

## Known Issues

- Node version must be 14.16.0 (use nvm)
- Editor changes require `yarn editor:build` to take effect
- Pre-commit hooks may fail on wrong Node version (use `--no-verify` if needed)
- Test coverage is currently very low

## Useful References

- [CONTRIBUTING.md](./docs/CONTRIBUTING.md) - Contribution guidelines
- [TEMPLATE_DEVELOPER_GUIDE.md](./docs/TEMPLATE_DEVELOPER_GUIDE.md) - Mosaico template development
- [docs/adr/](./docs/adr/) - Architecture Decision Records
- [.claude/skills/](./.claude/skills/) - Agent skills, including the new feature workflow
- [docs/index.md](./docs/index.md) - Complete documentation index
- [packages/documentation/](./packages/documentation/) - Technical documentation

---

## Code Review Guidelines

When reviewing code, evaluate against these criteria organized by severity.

### CRITICAL - Security

- No hardcoded secrets, API keys, or credentials
- Input validation on all user inputs
- SQL/NoSQL injection prevention (use Mongoose, not raw queries)
- XSS prevention (output encoding)
- Authentication/authorization properly implemented (use guards)
- CORS configured correctly
- Sensitive fields encrypted (use encryptionPlugin)

### HIGH - Architecture

- Single Responsibility Principle respected
- No circular dependencies between modules
- Proper error handling with ERROR_CODES
- Follows existing codebase patterns
- No breaking changes to public APIs without versioning
- Uses asyncHandler for async controller functions

### MEDIUM - Performance

- No N+1 database queries (use `.populate()`)
- Async operations for I/O-bound tasks
- No memory leaks (event listeners cleaned up)
- Appropriate caching strategies
- No blocking operations in hot paths

### LOW - Maintainability

- Clear, descriptive naming (variables, functions, files)
- DRY principle (no copy-paste code)
  - Extract duplicated utility functions (e.g., date formatting) into shared `/utils` files
  - Use libraries like `date-fns` or `dayjs` for common date operations instead of duplicating code
  - Extract repeated URLs/constants into named constants at file top
- Functions under 50 lines, **files under 300 lines** (strictly enforced)
  - If a file exceeds 300 lines, split it into multiple smaller, focused files
  - Consider breaking large components into sub-components
  - Separate concerns into different service/utility files
- Tests for critical paths
  - Unit tests: `/tests/` directory mirroring source structure
    - Backend: `/tests/server/{resource}/{resource}.test.js`
    - UI: `/tests/ui/components/{component}.test.js`
  - Integration/E2E tests and documentation: `/packages/documentation/tests/`
  - Test checklists: `/packages/documentation/tests/` (e.g., `comments-testing-checklist.md`)
- Comments only for "why", not "what"
  - Document complex business logic
  - Explain non-obvious role definitions (e.g., "actor" in notifications: someone who mentioned, replied, or resolved)
- Uses logger, not console.log

### Pre-Review Checklist

Before submitting code for review, **always run**:

```bash
yarn code:lint    # Check for linting errors
yarn code:fix     # Auto-fix errors and format code
yarn test         # Ensure all tests pass
```

### Review Output Format

When providing review feedback, use this format:

```
## Review Summary
[1-2 sentence overview]

## Issues Found

### CRITICAL
- [file:line] Issue description
  → Suggested fix

### HIGH
- [file:line] Issue description
  → Suggested fix

### MEDIUM
- [file:line] Issue description

### LOW
- [file:line] Issue description

## Recommendations
[Optional architectural or design suggestions]

## Code Quality Checks
- [ ] All files under 300 lines unless striclty necessary
- [ ] No duplicate code (extracted to utils)
- [ ] yarn code:lint passes
- [ ] Tests added/updated
- [ ] UX/design system compliance (if UI changes)
```
