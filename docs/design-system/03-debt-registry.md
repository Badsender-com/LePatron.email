# UI Debt Registry

> **Resolution plan**: See [docs/plans/ui-progressive-update.md](../plans/ui-progressive-update.md) for the 11-phase plan.
> **Tokens**: See [01-tokens.md](./01-tokens.md) for target values.

## Resolution Strategy

**Progressive Migration Principle**: Every code change (new feature or update) is an opportunity to migrate towards the target design system.

When touching existing code, apply these migrations:

| Aspect          | Current                                                     | Target                    |
| --------------- | ----------------------------------------------------------- | ------------------------- |
| Icons (Editor)  | Font Awesome 4.7                                            | Lucide                    |
| Icons (Vue App) | MDI                                                         | Lucide                    |
| Typography      | Vuetify classes (Roboto) / Trebuchet                        | Inter                     |
| Colors          | Hardcoded values                                            | CSS variables             |
| Primary actions | `color="accent"` (done: no filled `primary` button is left) | `color="accent"`          |
| Accessibility   | Missing                                                     | aria-labels, keyboard nav |

This ensures gradual, low-risk convergence without requiring dedicated refactoring sprints.

---

## Active Debts

_Measured in November 2026 on `packages/ui` (counts are of occurrences found in the code; they give an order of magnitude, not an audit)._

### DEBT-001: Multiple Font Families

|              |                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity** | Medium                                                                                                                                                     |
| **Plan**     | Phase 1                                                                                                                                                    |
| **Current**  | The Vue app is in Inter, but Vuetify typography classes (`headline`, `text-h*`, `text-body-*`) still set Roboto in 24 files; the editor is in Trebuchet MS |
| **Target**   | Inter everywhere (see [01-tokens.md](./01-tokens.md#typography-fixed))                                                                                     |
| **Done**     | Dialogs no longer use those classes (see the Dialog sheet)                                                                                                 |

---

### DEBT-002: Multiple Icon Systems

|               |                                                                         |
| ------------- | ----------------------------------------------------------------------- |
| **Severity**  | Low                                                                     |
| **Current**   | Vue App: MDI in 10 files (the rest is Lucide), Editor: Font Awesome 4.7 |
| **Target**    | Lucide everywhere (see [01-tokens.md](./01-tokens.md#icons))            |
| **Direction** | Progressive migration: move to Lucide on each feature change            |

---

### DEBT-003: Mixed CSS Conventions

|               |                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| **Severity**  | Medium                                                                                               |
| **Plan**      | Phase 2                                                                                              |
| **Issues**    | Inline styles, `!important` (also in `dialogs.scss`, to beat Vuetify's own, which is accepted there) |
| **Direction** | Use CSS variables, Vuetify classes                                                                   |

---

### DEBT-004: Hardcoded Colors

|               |                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Severity**  | Low                                                                                       |
| **Plan**      | Phase 2                                                                                   |
| **Current**   | About 167 hexadecimal literals in `.vue` styles                                           |
| **Direction** | Replace with CSS variables (see [01-tokens.md](./01-tokens.md#brand-colors-customizable)) |

---

### DEBT-006: jQuery UI in Editor

|               |                                  |
| ------------- | -------------------------------- |
| **Severity**  | Low (Accepted)                   |
| **Current**   | Editor uses jQuery UI widgets    |
| **Direction** | Accepted debt - editor is stable |

---

### DEBT-007: Multiple Color Pickers

|               |                                                          |
| ------------- | -------------------------------------------------------- |
| **Severity**  | Medium                                                   |
| **Plan**      | Phase 11                                                 |
| **Current**   | @easylogic/colorpicker (new) + evol-colorpicker (legacy) |
| **Direction** | Deprecate evol-colorpicker, unify on @easylogic          |

---

### DEBT-008: Legacy jQuery UI Components

|                |                                                  |
| -------------- | ------------------------------------------------ |
| **Severity**   | Low                                              |
| **Plan**       | Phase 11                                         |
| **Components** | jqueryui-tabs, jqueryui-spinner, tooltips        |
| **Direction**  | Progressively replace with CSS-only alternatives |

---

### DEBT-009: Complex Image Editor

|               |                                       |
| ------------- | ------------------------------------- |
| **Severity**  | Low (Accepted)                        |
| **Plan**      | Phase 11                              |
| **Stack**     | Konva.js + jQuery + Knockout          |
| **Direction** | Accepted debt - functional and stable |

---

### DEBT-012: Form fields not on the `Bs*` family

|               |                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| **Severity**  | Medium                                                                                                      |
| **Current**   | 20 `v-text-field`, 15 `v-select` and 9 `v-textarea` used raw, against 81 `bs-text-field` and 50 `bs-select` |
| **Target**    | The `Bs*` fields (label above the field, 38px, `gray-300` border, accent focus with the 3px halo)           |
| **Direction** | Migrate on each change; a raw field inside a `v-menu` or a table cell may stay when no label applies        |

---

### DEBT-013: Square cards

|               |                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| **Severity**  | Low                                                                                                  |
| **Current**   | 26 `<v-card ... tile>` (right angles), mostly the page cards of the settings tabs                    |
| **Target**    | Flat white cards, 1px `gray-300` border, `--r-md` radius (`FeatureCard`, `CardSpecs`)                |
| **Direction** | Drop `tile` on each change; check the page rhythm, since the layout zeroes `.v-card__text`'s padding |

---

### DEBT-014: Pages waiting for the MCP stack

|               |                                                                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**  | Low                                                                                                                                                                                                                                                                                |
| **Current**   | The "Fonctionnalités IA" page keeps labelled switches and success toasts; `feature-switch.vue` and `bs-settings-row.vue` are copies of the MCP stack's                                                                                                                             |
| **Target**    | `BsGroupFeatureSwitch` in a feature card, the outcome inline (`BsSaveOutcome`)                                                                                                                                                                                                     |
| **Direction** | Once the MCP stack is merged: drop the copies, take the page over, then close this debt                                                                                                                                                                                            |
| **Then**      | The copies stay identical to the MCP stack's until then. Two fixes wait for that day: the "on" word of `feature-switch.vue` takes `--success-ink` (not `--v-success-darken1`), and `BsSettingsRow`'s `titleId` is passed only where the control reads it through `aria-labelledby` |

---

### DEBT-015: Features of the design system not built

|               |                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**  | Medium                                                                                                                                                        |
| **Current**   | `MfaMembers` (the members' two-factor page, reminders, CSV export, the "Membres sans double authentification" row) and the lockout guard of `CompanySettings` |
| **Direction** | A feature of its own (server routes, an ADR): it starts with `/grill-with-docs`                                                                               |

---

### DEBT-016: Patterns the design system does not describe

|               |                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| **Severity**  | Low                                                                                                           |
| **Current**   | `v-tabs` (8 uses, in capitals: see DEBT-017) and `v-chip` outside the tag list (72) follow Vuetify's defaults |
| **Direction** | A sheet each, decided with the design system's owner, then a pass over the uses                               |
| **Done**      | Alerts (24 uses) and tooltips (48): see the Resolved section                                                  |

---

### DEBT-017: Accepted exceptions

|              |                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity** | None (decided)                                                                                                                                                       |
| **Tabs**     | The tabs of the AI pages (Skills, Expertise, a skill's details, the run detail of the playground) stay in capitals: super admin pages only, decided in November 2026 |
| **Toasts**   | An action on a record (create, delete, send) keeps its toast (190 calls); only a saved **setting** is read inline                                                    |
| **Switches** | A labelled `v-switch` stays for a form field, a filter and a table row (11 uses): see the Toggle / Switch section                                                    |

---

## Resolved Debts

### DEBT-020: Alerts and tooltips on Vuetify's defaults

|              |                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Resolved** | November 2026: `feedback.scss` gives every `v-alert` one anatomy by tone (soft ground, 1px frame, icon in the ink, text in `gray-900`) and every `v-tooltip` the dark label of the design system |
| **Was**      | 24 alerts in four variants (solid, outlined, text, left bar) and tooltips in Vuetify's translucent gray                                                                                          |

---

### DEBT-005: Non-centralized modals

|              |                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resolved** | November 2026: every dialog shares one anatomy, written once in `assets/global-styles/dialogs.scss` (see the Dialog section of [02-components.md](./02-components.md)) |
| **Was**      | Four ways of drawing a dialog (`BsModalConfirm`, `BsModalForm`, plain cards, the mailing list's)                                                                       |

---

### DEBT-010: Uppercase button labels

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Resolved** | November 2026: one global rule on `.v-btn` (`index.scss`), sentence case and `0.01em` tracking everywhere |
| **Was**      | Vuetify's `text-transform: uppercase` on every button ("ENREGISTRER", "CRÉER UN EMAIL")                   |

---

### DEBT-018: Feedback of a setting in a toast

|              |                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resolved** | November 2026: the company form, the colors, the export options, the email builder settings, the tracking and the two-factor option read their outcome inline (`BsSaveOutcome`) |
| **Was**      | A snackbar for every saved setting                                                                                                                                              |

---

### DEBT-019: A setting's switch without its state in words

|              |                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resolved** | November 2026: the modules, the permissions, SAML, two-factor, the template options, the export hosting, the metadata and the tracking use `BsGroupFeatureSwitch` |
| **Was**      | 21 labelled `v-switch`, two looks (`inset` and the default) and the primary color on some                                                                         |

---

## Adding a Debt

```markdown
### DEBT-XXX: [Title]

|               |                          |
| ------------- | ------------------------ |
| **Severity**  | Critical/High/Medium/Low |
| **Plan**      | Phase X                  |
| **Current**   | Description              |
| **Direction** | Solution                 |
```

---

_Last updated: November 2026_
