# AGENTS.md - AI Agent Instructions

LePatron.email is an open-source email builder based on Mosaico: users build responsive HTML emails by drag and drop, manage templates, and export to Email Service Providers (ESP).

Yarn monorepo, Node 18.18.0 (`.nvmrc`):

```
/packages
  /server          # Express API + Mongoose (MongoDB)
  /ui              # Nuxt 2 / Vue 2, Vuex, Vuetify 2
  /editor          # Mosaico editor (Knockout.js, built by gulp)
  /shared          # CommonJS modules read by the server, the UI and the editor
  /documentation   # VuePress docs, API docs
/tests             # Jest, mirrors /packages
/public            # Static assets, editor templates
```

## Commands

```bash
yarn dev                          # Server + maildev
yarn test-ci                      # Jest, all tests (`yarn test` is --watch and never exits)
yarn test-ci tests/server/mailing # One folder or file
yarn editor:build                 # Editor changes only take effect after this
yarn ui:build                     # Nuxt build
npx eslint <files>                # Lint the files you touched
npx prettier --write <files>      # Format the files you touched
```

`yarn code:fix` and `yarn code:pretty` rewrite the whole repository: never run them for a PR. The pre-commit hook runs Prettier on the staged files.

## Always

- **Read first.** Before exploring the code for any task, read `GLOSSARY.md` and the ADRs in `docs/adr/` that touch the area. Use the glossary's terms in code, tests and issues. A change that contradicts an ADR says so explicitly.
- **Rights.** Ask for a capability, never compare roles (see "Rights" below). A diff that touches rights gets the review in [docs/agents/rights-review.md](docs/agents/rights-review.md).
- **One PR, one intent.** Agent instruction files go in their own PR ([docs/AI_POLICIES.md](docs/AI_POLICIES.md)).
- **Public repository.** No client name, secret or unfixed vulnerability in an issue, a PR, a commit or a comment. A vulnerability found in a review goes to the user, not to GitHub.
- **Done means** `yarn test-ci` green, ESLint and Prettier clean on the touched files, and a test for each behavior the change adds or fixes (a bug fix starts with a failing test).
- **English** in code, comments, logs and tests. French only in user-facing strings, which are always translated (`packages/ui/helpers/locales/`, `public/lang/badsender-*.js`).
- **Files under 300 lines**, functions under 50. Split before going over.

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

1. **Grill.** Interview the user round by round until every branch of the design is settled; look facts up in the code yourself, leave only decisions to the user. Terms go into `GLOSSARY.md` as they are resolved, decisions into an ADR in `docs/adr/` (`Status: proposed`), on a `feat/<feature>-adr-tests` branch created from `develop` before the first file is written. A feature that adds an act settles which roles may do it. Nothing moves on before the user confirms the shared understanding.
2. **Epic.** Synthesize the grilling into a PRD (problem, solution, user stories, implementation and testing decisions, out of scope), show it, and publish it once the user agrees.
3. **Tickets.** Split the epic into vertical slices, each one PR, each with its blockers. Ticket 01 is always the ADR + tests PR, and blocks the others. The user approves the breakdown before anything is published.
4. **First PR** (`feat/<feature>-adr-tests`, closes ticket 01). The ADR, the `GLOSSARY.md` changes, and the tests at the agreed seams, written in full as the epic's acceptance criteria inside `describe.skip` blocks that name the ticket turning them on. No production code, CI stays green.
5. **Ticket PRs** (`feat/<feature>-<ticket>`, one per ticket, frontier first). Remove the `.skip` of the ticket's blocks, implement until they pass, add the smaller tests the implementation needs. When the first PR merges, the ADR moves to `Status: accepted`.

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

## Conventions

- **Names**: files `kebab-case.js` / `kebab-case.vue`, Vue `name: 'BsPascalCase'`, `camelCase` variables, `UPPER_SNAKE_CASE` constants, `PascalCase` models.
- **Branches**: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/` + a short description.
- **Commits** (Karma): `type(scope): short description`, types `feat fix docs style refactor test chore`, scope `server`, `ui`, `editor`…
- No hardcoded URL, credential or magic number: config or a named constant. `const`/`let`, never `var`.
- Comments say why, not what.

### packages/server

- `{resource}/{resource}.routes.js`, `.controller.js`, `.service.js`, `.schema.js`; tests in `tests/server/{resource}/`. A module owning several entities uses one sub-folder per layer (`controllers/`, `services/`, `models/`…), as `ai-skill` does.
- Controllers are wrapped in `asyncHandler` and throw `http-errors` with a code from `constant/error-codes.js` (`throw new createError.NotFound(ERROR_CODES.USER_NOT_FOUND)`); `config/error-handler.js` formats the response. No string literal as a code, no local `try/catch` answering `500`.
- `logger` from `utils/logger.js`, never `console.log`; never log a password, a token or a key.
- Mongoose: a reference is `_name` with an `alias` (`_company` → `group`); secrets use `utils/encryption-plugin.js`, hidden fields `mongoose-hidden`; validation lives in the schema (`validator`).
- Lodash `pick` for what a request may set, `omit` when copying a document.

### packages/ui

- Pages in `routes/`, components in `components/`, store in `store/`, locales in `helpers/locales/{fr,en}.js`; imports with `~/`.
- Vuetify 2 components, `v-icon` (Material Design Icons), colors through CSS variables (white-label). Look in `components/` before creating one. Design system: [docs/design-system/](docs/design-system/), [docs/UX_GUIDELINES.md](docs/UX_GUIDELINES.md), known gaps in `docs/design-system/03-debt-registry.md`. Forms are validated with `vuelidate`.

### packages/editor

- Extensions in `src/js/ext/`, templates in `src/tmpl-badsender/`, translations in `public/lang/badsender-{fr,en}.js` read through `viewModel.t('key')`.
- LESS variables from `style_variables.less`, theme CSS variables (`--v-primary-base`), jQuery UI widgets, Knockout bindings, Font Awesome 4.7 (`fa fa-*`). See `docs/design-system/04-editor-stack.md`.

## Rights

Roles, capabilities and the list of each role are defined once, in `packages/shared/access/roles.js` ([ADR 0004](docs/adr/0004-reviewer-writer-tech-admin-roles.md), extending [ADR 0002](docs/adr/0002-super-admin-persisted-role.md)). A role is a fixed list of capabilities: a capability it does not list is refused.

- **Ask for a capability**: `permissions.can(user, CAPABILITIES.X)` on the server (`account/permissions.js`, the only code that reads a role), the `CAN` getter in the UI, `userCan` in the editor; a page names its capability in `meta.acl` (`helpers/pages-acls.js`). Never `isAdmin`, `isGroupAdmin`, `Roles.X` or `.role ===` to decide a right: every role such a test does not name, writer and reviewer included, silently takes the other branch. Another account's role is data: read what it allows with `roleCan`.
- **Every route that writes declares its capability**: `router.delete('/:id', GUARD_CAN(CAPABILITIES.MAILING_DELETE), …)`. `tests/server/account/route-access.test.js` fails on a write route without one, unless it is in `EXEMPTIONS` with the reason. `GUARD_USER` (signed in), `GUARD_GROUP_ADMIN` and `GUARD_ADMIN` remain for reads and settings.
- **The scope is checked apart**: a capability says what, never in which company or workspace. Check the resource's company or workspace with `account/permissions.js` (`canAccessGroup`, `canManageGroup`, `canReadWorkspace`, `canWriteWorkspace`) and `account/request-scope.js`, never with a comparison of ids written by hand. An id from a request is a string, or refused.
- **The server sends the capabilities** with the current user (`permissions.withCapabilities`): a new response that returns the user goes through it.
- **Changing a role's rights** changes the matrix in `tests/shared/access/roles.test.js` in the same PR, and ADR 0004 or the plan (`docs/plans/rbac-refonte.md` §3.6) when a decision moves.

## Testing

- Jest; `tests/` mirrors `packages/` ([tests/README.md](tests/README.md)). Shared helpers in `tests/helpers/`; `tests/editor/helpers/current-user.js` gives an editor user of any role.
- Before adding a test file, look for the one that already covers the surface and add the case there.
- A test that checks a right covers every role, not only the one the change is about.
- Manual checklists live in `docs/` (`comments-testing-checklist.md`…) and `packages/documentation/tests/`.

---

## Code Review Guidelines

Read the diff against its base branch (`git diff origin/<base>...HEAD`, or `gh pr diff <n>`), not only the last commit. Report concrete findings only, each tied to a line, by severity.

### CRITICAL - Security

- A route without its capability or its scope check (another company's or workspace's resource), a role granted or an account managed beyond one's own rights: see [docs/agents/rights-review.md](docs/agents/rights-review.md).
- Secrets in code, unvalidated input, NoSQL injection (a request object passed as a query), unescaped HTML (XSS), secret fields not encrypted.

### HIGH - Correctness and architecture

- A role comparison deciding a right; the UI or the editor showing an action the server refuses, or hiding one it accepts.
- Errors not thrown with `ERROR_CODES`, controllers outside `asyncHandler`.
- A change that breaks documents already stored (schema, migration, serialization).
- Circular dependencies; a shared function or API changed without updating its callers.

### MEDIUM - Performance

- N+1 queries (use `.populate()` or one query), blocking work in a request, listeners never removed.

### LOW - Maintainability

- Duplicated code that belongs in a helper; files over 300 lines; comments that say what instead of why; `console.log`.
- A behavior without a test; a test removed without a replacement.

### Review Output Format

```
## Review Summary
[1-2 sentence overview]

## Rights touched
[The table from docs/agents/rights-review.md, or "None": why]

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
```

## References

[docs/AI_POLICIES.md](docs/AI_POLICIES.md) (PR structure) · [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) · [docs/TEMPLATE_DEVELOPER_GUIDE.md](docs/TEMPLATE_DEVELOPER_GUIDE.md) (Mosaico templates) · [docs/adr/](docs/adr/) · [.claude/skills/](.claude/skills/) · [docs/index.md](docs/index.md)
