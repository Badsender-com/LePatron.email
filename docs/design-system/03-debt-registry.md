# UI Debt Registry

> **Resolution plan**: See [docs/plans/ui-progressive-update.md](../plans/ui-progressive-update.md) for the 11-phase plan.
> **Tokens**: See [01-tokens.md](./01-tokens.md) for target values.

## Active Debts

### DEBT-001: Multiple Font Families

| | |
|---|---|
| **Severity** | Medium |
| **Plan** | Phase 1 |
| **Current** | Vue App: Montserrat, Editor: Trebuchet MS |
| **Target** | Work Sans everywhere (see [01-tokens.md](./01-tokens.md#typography-fixed)) |

---

### DEBT-002: Multiple Icon Systems

| | |
|---|---|
| **Severity** | Low |
| **Current** | Vue App: MDI, Editor: Font Awesome 4.7 |
| **Direction** | Accepted - Editor stays on FA, new Vue features use MDI |

---

### DEBT-003: Mixed CSS Conventions

| | |
|---|---|
| **Severity** | Medium |
| **Plan** | Phase 2 |
| **Issues** | Inline styles, `!important`, hardcoded colors |
| **Direction** | Use CSS variables, Vuetify classes |

---

### DEBT-004: Hardcoded Colors

| | |
|---|---|
| **Severity** | Low |
| **Plan** | Phase 2 |
| **Direction** | Replace with CSS variables (see [01-tokens.md](./01-tokens.md#brand-colors-customizable)) |

---

### DEBT-005: Non-Centralized Modals

| | |
|---|---|
| **Severity** | Low |
| **Plan** | Phase 10 |
| **Issues** | Different patterns across modals |
| **Direction** | Extract common logic into a composable |

---

### DEBT-006: jQuery UI in Editor

| | |
|---|---|
| **Severity** | Low (Accepted) |
| **Current** | Editor uses jQuery UI widgets |
| **Direction** | Accepted debt - editor is stable |

---

### DEBT-007: Multiple Color Pickers

| | |
|---|---|
| **Severity** | Medium |
| **Plan** | Phase 11 |
| **Current** | @easylogic/colorpicker (new) + evol-colorpicker (legacy) |
| **Direction** | Deprecate evol-colorpicker, unify on @easylogic |

---

### DEBT-008: Legacy jQuery UI Components

| | |
|---|---|
| **Severity** | Low |
| **Plan** | Phase 11 |
| **Components** | jqueryui-tabs, jqueryui-spinner, tooltips |
| **Direction** | Progressively replace with CSS-only alternatives |

---

### DEBT-009: Complex Image Editor

| | |
|---|---|
| **Severity** | Low (Accepted) |
| **Plan** | Phase 11 |
| **Stack** | Konva.js + jQuery + Knockout |
| **Direction** | Accepted debt - functional and stable |

---

## Resolved Debts

_No debts have been fully resolved yet._

---

## Adding a Debt

```markdown
### DEBT-XXX: [Title]

| | |
|---|---|
| **Severity** | Critical/High/Medium/Low |
| **Plan** | Phase X |
| **Current** | Description |
| **Direction** | Solution |
```

---

*Last updated: February 2026*
