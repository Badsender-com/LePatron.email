# Documentation Index

Complete guide to LePatron.email documentation for developers and AI agents.

## 📋 Quick Reference

| File                                                         | Purpose                                                 | Primary Audience         |
| ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------ |
| [AGENTS.md](../AGENTS.md)                                    | Technical guidelines, conventions, code review criteria | AI agents, developers    |
| [AI-POLICIES.md](./AI_POLICIES.md)                           | PR structure, quality standards, anti-patterns          | AI agents                |
| [UX-GUIDELINES.md](./agents/ux-guidelines.md)                | Design system, component reuse, Vuetify patterns        | AI agents, UI developers |
| [CLAUDE.md](./CLAUDE.md)                                     | Claude Code commands and quick reference                | Claude Code users        |
| [CONTRIBUTING.md](./CONTRIBUTING.md)                         | How to contribute to the project                        | Contributors             |
| [TEMPLATE_DEVELOPER_GUIDE.md](./TEMPLATE_DEVELOPER_GUIDE.md) | Mosaico template development                            | Template developers      |
| [README.md](./README.md)                                     | Project overview and setup                              | Everyone                 |

## 📚 Documentation Structure

### Root Level Documentation

#### For AI Agents

1. **[AGENTS.md](../AGENTS.md)** - Primary reference

   - Tech stack (Node.js, Vue.js, MongoDB)
   - Project structure
   - Naming conventions
   - Code patterns (routes, controllers, services)
   - Error handling with ERROR_CODES
   - Mongoose conventions
   - Logging rules
   - Code review guidelines (CRITICAL → LOW severity)

2. **[AI-POLICIES.md](./AI_POLICIES.md)** - Quality & process

   - PR structure (one feature per PR)
   - Testing organization
   - File size limits (300 lines max)
   - DRY principle and code duplication
   - Unused code detection
   - Pre-review checklists

3. **[UX-GUIDELINES.md](./agents/ux-guidelines.md)** - Design system

   - Vuetify component patterns
   - Icon usage (Material Design Icons)
   - Layout patterns (panels, badges, filters)
   - Color palette and typography
   - Accessibility requirements
   - Common UX anti-patterns from reviews

4. **[CLAUDE.md](./CLAUDE.md)** - Quick commands
   - `/review`, `/architecture-review`, `/security-review`
   - Available subagents (code-reviewer, architect, security-auditor, ux-reviewer)
   - Linting commands (`yarn code:lint`, `yarn code:fix`)

#### For Developers

1. **[README.md](./README.md)** - Getting started

   - Installation
   - Environment setup
   - Running the application
   - Deployment

2. **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guide

   - Git workflow
   - Pull request process
   - Code style
   - Testing

3. **[TEMPLATE_DEVELOPER_GUIDE.md](./TEMPLATE_DEVELOPER_GUIDE.md)** - Mosaico templates
   - Template structure
   - Block creation
   - Styling
   - Testing templates

### Package-Level Documentation

#### /packages/documentation/

- **development.md** - Development setup and workflows
- **heroku-configuration.md** - Deployment configuration
- **mosaico.md** - Mosaico editor documentation
- **api/** - API documentation (generated)
- **tests/** - Testing documentation and checklists

#### /packages/documentation/tests/

- **README.md** - Testing strategy
- **{feature}-testing-checklist.md** - Manual QA checklists
- **integration/** - Integration test docs

### Hidden Configuration

#### /.claude/

- **ux-review.txt** - UX reviewer agent instructions

## 🎯 When to Use Each Document

### Starting a New Feature

1. Read [AGENTS.md](../AGENTS.md) for conventions
2. Check [AI-POLICIES.md](./AI_POLICIES.md) for PR structure
3. If UI work: read [UX-GUIDELINES.md](./agents/ux-guidelines.md)
4. Create feature branch following naming convention

### Before Code Review

1. Run `yarn code:lint` and `yarn code:fix`
2. Run `yarn test`
3. Check [AI-POLICIES.md](./AI_POLICIES.md) pre-review checklist
4. Use `/review` command in Claude Code

### Adding UI Components

1. Read [UX-GUIDELINES.md](./agents/ux-guidelines.md)
2. Search for existing components first
3. Use Vuetify components
4. Follow design system patterns
5. Use `/ux-review` (if available) or `ux-reviewer` subagent

### Code Review (as reviewer)

1. Reference [AGENTS.md](../AGENTS.md) Code Review Guidelines
2. Use severity levels: CRITICAL → HIGH → MEDIUM → LOW
3. Check [AI-POLICIES.md](./AI_POLICIES.md) for common anti-patterns
4. For UI changes: use [UX-GUIDELINES.md](./agents/ux-guidelines.md)

### Writing Tests

1. Unit tests: co-locate with source (`{resource}.test.js`)
2. Testing docs: `/packages/documentation/tests/`
3. Follow patterns in [packages/documentation/tests/README.md](./packages/documentation/tests/README.md)

## 🔄 Documentation Workflow

### Updating Documentation

- Documentation changes should be in **separate PRs**
- Don't bundle docs with feature implementations
- Keep agent instruction files (AGENTS.md, etc.) in sync

### Adding New Guidelines

When encountering new patterns or issues:

1. Document the pattern in appropriate file:
   - Code patterns → [AGENTS.md](../AGENTS.md)
   - Process/quality → [AI-POLICIES.md](./AI_POLICIES.md)
   - UI/UX patterns → [UX-GUIDELINES.md](./agents/ux-guidelines.md)
2. Add examples (good ✅ and bad ❌)
3. Create separate PR for documentation update

### Document Hierarchy

```
CLAUDE.md (Quick reference)
    ↓
AGENTS.md (Technical guidelines)
    ↓
AI-POLICIES.md (Quality standards)
    ↓
UX-GUIDELINES.md (Design system)
    ↓
Package-specific docs
```

## 🛠️ Development Commands Quick Reference

```bash
# Setup
yarn                      # Install dependencies

# Development
yarn dev                  # Run all packages in dev mode
yarn editor:build         # Build editor only
yarn build:ui             # Build UI only

# Quality
yarn code:lint            # Check for linting errors
yarn code:fix             # Auto-fix errors and format code
yarn test                 # Run all tests

# Build
yarn build                # Production build (all packages)

# Claude Code Commands
/review                   # General code review
/architecture-review      # Architecture analysis
/security-review          # Security audit
```

## 📦 Subagent Usage

```bash
# In Claude Code
Task tool with subagent_type:

- code-reviewer          # Critical code review
- architect              # Architecture and design patterns
- security-auditor       # Security vulnerabilities
- ux-reviewer            # UX/UI design system compliance
```

## 🔍 Finding Information

### "How do I structure my backend code?"

→ [AGENTS.md](../AGENTS.md) - Package-Specific Guidelines → packages/server

### "What's the PR structure?"

→ [AI-POLICIES.md](./AI_POLICIES.md) - PR Structure and Separation of Concerns

### "How do I use Vuetify components?"

→ [UX-GUIDELINES.md](./agents/ux-guidelines.md) - Vuetify Components

### "What are the code review severity levels?"

→ [AGENTS.md](../AGENTS.md) - Code Review Guidelines

### "Where do I put tests?"

→ [packages/documentation/tests/README.md](./packages/documentation/tests/README.md)

### "How do I name my branch?"

→ [AGENTS.md](../AGENTS.md) - Branch Naming Convention

### "What's the commit message format?"

→ [AGENTS.md](../AGENTS.md) - Commit Messages (Karma format)

## 📝 Document Maintenance

These documents are living documents that evolve with the project:

- Update when new patterns emerge
- Add examples from real code reviews
- Remove outdated information
- Keep cross-references accurate

**Last Updated**: 2026-02-10
**Maintainers**: LePatron.email development team
