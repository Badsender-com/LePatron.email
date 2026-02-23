# LePatron.email Design System

Design system documentation for LePatron.email.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  TOKENS (01-tokens.md) - Single source of truth         │
│  Colors, typography, spacing, shadows, z-index          │
└─────────────────────────────────────────────────────────┘
          ↓ referenced by
┌─────────────────────────────────────────────────────────┐
│  COMPONENTS (02-components.md)                          │
│  Vue App (Vuetify) + Editor (jQuery UI / Knockout)      │
└─────────────────────────────────────────────────────────┘
          ↓ used in
┌─────────────────────────────────────────────────────────┐
│  UX GUIDELINES (../UX_GUIDELINES.md)                    │
│  Behavioral patterns, accessibility, review             │
└─────────────────────────────────────────────────────────┘
```

## Documents

| Document | Content |
|----------|---------|
| [01-tokens.md](./01-tokens.md) | **Single source**: colors, typography, spacing |
| [02-components.md](./02-components.md) | Vue App + Editor components |
| [03-debt-registry.md](./03-debt-registry.md) | UI debts to address |
| [04-editor-stack.md](./04-editor-stack.md) | Editor technical stack |
| [../UX_GUIDELINES.md](../UX_GUIDELINES.md) | UX patterns and accessibility |

## Key Principle

> **Tokens = Single source of truth**. Other documents **reference** `01-tokens.md` for values (colors, typography). Never duplicate token values.

## White-Label

- **Customizable**: Brand colors, logo (via Group settings)
- **Fixed**: Typography, component structure, UX patterns

## HTML Preview

The `preview/` folder contains static HTML mockups to visualize the design system.

---

*Last updated: February 2026*
