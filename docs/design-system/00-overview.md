# LePatron.email Design System

## Purpose

This design system documents the **current state** of LePatron.email's UI, serving as:

1. **Living inventory** of existing components and patterns
2. **Constraint system** for development (human and AI-assisted)
3. **Progressive harmonization guide** for future improvements
4. **White-label foundation** for client customization

> **Complementary documentation**: [UX_GUIDELINES.md](../UX_GUIDELINES.md) covers behavioral patterns, accessibility, and UX best practices.

## Philosophy

**Design System as Constraint**: The design system constrains UI implementation, like APIs constrain backend architecture. Developers compose from existing primitives rather than inventing new patterns.

## White-Label Architecture

LePatron.email is designed to support **white-labeling** for agencies and clients. The design system separates customizable elements from fixed structure:

### Customizable (per client/agency)

| Layer | Scope | Storage |
|-------|-------|---------|
| **Tokens** | Colors, logo | Database (Group settings) |

### Fixed (not customizable)

| Layer | Scope | Reason |
|-------|-------|--------|
| **Atoms** | Component structure | Consistency, maintenance |
| **Molecules** | Component composition | UX consistency |
| **Organisms** | Page sections | Feature parity |
| **Templates** | Page layouts | Navigation consistency |

This separation ensures:
- **Brand flexibility**: Clients can apply their visual identity
- **UX consistency**: All users have the same interaction patterns
- **Maintainability**: Core components are shared across all instances

## Dual Stack Reality

LePatron.email has two distinct UI stacks that coexist:

| Stack | Location | Technologies | Purpose |
|-------|----------|--------------|---------|
| **Vue App** | `packages/ui/` | Vuetify 2.x, Vue 2, SCSS | Admin interface, settings, lists |
| **Email Editor** | `packages/editor/` | Knockout, jQuery UI, LESS, Mosaico | Email composition |

These stacks share brand colors via CSS variables but use different component libraries.

## Atomic Design Vocabulary

We use Atomic Design to categorize components:

| Level | Definition | White-Label | Examples |
|-------|------------|-------------|----------|
| **Tokens** | Design primitives | Partial | Colors, logo (fonts fixed) |
| **Atoms** | Single UI elements | Fixed | `v-btn`, `v-text-field`, `v-icon` |
| **Molecules** | Grouped atoms | Fixed | Form groups, dropdowns, cards |
| **Organisms** | Page sections | Fixed | Tables, navigation bars |
| **Templates** | Page layouts | Fixed | DefaultLayout, CenteredLayout |

## Document Structure

| File | Content |
|------|---------|
| [01-tokens.md](./01-tokens.md) | Colors, typography, spacing, shadows |
| [02-atoms.md](./02-atoms.md) | Base Vuetify components usage |
| [03-molecules.md](./03-molecules.md) | Composed components |
| [04-organisms.md](./04-organisms.md) | Complex page sections |
| [05-debt-registry.md](./05-debt-registry.md) | Known inconsistencies |
| [06-patterns.md](./06-patterns.md) | Recurring UI patterns |
| [07-editor-stack.md](./07-editor-stack.md) | Editor-specific documentation |

### Related Documentation

| File | Content |
|------|---------|
| [UX_GUIDELINES.md](../UX_GUIDELINES.md) | UX patterns, accessibility, behavioral guidelines |
| [AGENTS.md](../../AGENTS.md) | Technical conventions for development |
| [AI_POLICIES.md](../AI_POLICIES.md) | PR structure and quality standards |

> **Note**: This design system focuses on **visual specifications** (tokens, components).
> For **behavioral patterns** (accessibility, UX best practices, review checklists), see [UX_GUIDELINES.md](../UX_GUIDELINES.md).

## Development Constraints

When developing UI for LePatron.email:

### Vue App (`packages/ui/`)

1. **Use Vuetify 2.x components** - Never raw HTML for standard UI elements
2. **Use Work Sans font** - Target typography (currently Montserrat)
3. **Use Material Design Icons** - Via `v-icon` component
4. **Use Vuetify grid** - `v-row`/`v-col` with 12-column system
5. **Use vuelidate** for form validation
6. **Use Vuex stores** for state management
7. **Use i18n keys** - Never hardcoded French/English text
8. **Use CSS variables for colors** - Enable white-label theming

### Email Editor (`packages/editor/`)

1. **Use LESS variables** from `style_variables.less`
2. **Use CSS variables** for theme integration (`--v-primary-base`, etc.)
3. **Use jQuery UI widgets** for interactive elements
4. **Use Knockout bindings** for data binding

## Living Document

This documentation evolves with the codebase:

- **Before each PR**: Check if UI changes require documentation updates
- **Known debts**: Logged in [05-debt-registry.md](./05-debt-registry.md)
- **Direction**: Document target state alongside current state

---

*Last updated: February 2026*
