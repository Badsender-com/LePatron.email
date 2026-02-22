# UI Debt Registry

This document tracks known UI inconsistencies and technical debt. Each item includes context, impact, and suggested direction.

## Active Debts

### DEBT-001: Dual Font Families

**Status**: Active
**Severity**: Medium
**Area**: Typography

**Current State**:
- Vue App uses **Montserrat** (Google Fonts)
- Email Editor uses **Trebuchet MS** (system font)

**Impact**:
- Visual disconnect when transitioning between interfaces
- Brand inconsistency

**Direction**:
- Consider migrating editor to Montserrat
- Requires updating `@font-family` in `style_variables.less`
- Low priority: users spend most time in one interface

---

### DEBT-002: Dual Icon Systems

**Status**: Active
**Severity**: Low
**Area**: Icons

**Current State**:
- Vue App: Material Design Icons via `<v-icon>`
- Editor: Font Awesome 4.7 via `<i class="fa fa-...">`

**Impact**:
- Slightly different icon styles
- Two icon fonts loaded (bundle size)

**Direction**:
- Keep as-is for now (editor legacy code)
- New Vue components should use MDI exclusively
- Future: Consider migrating editor to MDI when refactoring

---

### DEBT-003: Mixed CSS Conventions

**Status**: Active
**Severity**: Medium
**Area**: Styling

**Current State**:
- Vue App: SCSS with Vuetify utility classes
- Editor: LESS with custom variables
- Some inline styles in templates
- Some `!important` overrides

**Impact**:
- Maintenance complexity
- Inconsistent spacing/sizing

**Direction**:
- New code should use Vuetify classes when possible
- Avoid inline styles except for dynamic values
- Minimize `!important` usage

**Examples of debt**:
```scss
// In index.scss - padding override
.v-card__text {
  padding-bottom: 0 !important;
}
```

---

### DEBT-004: Hardcoded Colors

**Status**: Active
**Severity**: Low
**Area**: Colors

**Current State**:
Some components use hardcoded hex values instead of theme variables.

**Examples**:
```scss
// In index.scss
background-color: rgb(0, 172, 220);  // Should be var(--v-accent-base)

// In style_variables.less - these are correct
@bs-accent-color: #00acdc;
```

**Direction**:
- Audit for hardcoded colors
- Replace with CSS variables or Vuetify classes

---

### DEBT-005: Non-Centralized Modal Patterns

**Status**: Active
**Severity**: Low
**Area**: Components

**Current State**:
Multiple modal components with slightly different patterns:
- `modal-confirm.vue`
- `modal-confirm-form.vue`
- `mailings/modal-duplicate.vue`
- `mailings/modal-rename.vue`
- etc.

**Impact**:
- Code duplication
- Inconsistent behavior

**Direction**:
- Consider extracting common modal logic to a composable
- Standardize open/close/confirm patterns

---

### DEBT-006: jQuery UI in Editor

**Status**: Active (Legacy)
**Severity**: Low (Accepted)
**Area**: Architecture

**Current State**:
Editor uses jQuery UI widgets (sortable, draggable, etc.) alongside Knockout.

**Impact**:
- Different mental model than Vue
- Older patterns

**Direction**:
- **Accepted debt** - Editor is stable
- No immediate migration planned
- Document patterns for maintenance

---

## Resolved Debts

### DEBT-R001: Inconsistent Button Colors

**Status**: Resolved
**Resolution Date**: [Date]

**Was**:
Some buttons used `color="primary"` for primary actions.

**Now**:
Primary actions use `color="accent"`, cancel uses `text color="primary"`.

---

## Adding New Debt

When identifying new UI debt:

1. Create entry with unique ID: `DEBT-XXX`
2. Set severity:
   - **Critical**: Blocks users or causes errors
   - **High**: Significant UX impact
   - **Medium**: Noticeable inconsistency
   - **Low**: Minor polish issue
3. Document current state and direction
4. Link to related issues if applicable

```markdown
### DEBT-XXX: [Title]

**Status**: Active
**Severity**: [Critical/High/Medium/Low]
**Area**: [Typography/Colors/Components/Layout/Icons]

**Current State**:
[Description of the inconsistency]

**Impact**:
[How it affects users or developers]

**Direction**:
[Suggested resolution approach]
```
