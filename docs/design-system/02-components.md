# UI Components

> **Source of truth**: This document + [preview/components.html](./preview/components.html) > **Tokens**: See [01-tokens.md](./01-tokens.md) for colors, typography, spacing.
> **UX Patterns**: See [UX_GUIDELINES.md](../UX_GUIDELINES.md) for behavioral patterns.

---

## Buttons

### Standard Button

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  /* sentence case, never uppercase */
  letter-spacing: 0.01em;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
```

### Variants

| Variant                        | Background  | Text        | Border         | Usage                               |
| ------------------------------ | ----------- | ----------- | -------------- | ----------------------------------- |
| **Accent** (primary action)    | `--accent`  | white       | none           | Save, Submit, Confirm               |
| **Primary** (secondary action) | `--primary` | white       | none           | Alternative actions                 |
| **Text**                       | transparent | `--primary` | none           | Cancel, Close                       |
| **Outlined**                   | transparent | `--accent`  | 1px `--accent` | Optional actions                    |
| **Error** (destructive)        | `--error`   | white       | none           | Delete, Remove                      |
| **Disabled**                   | any         | any         | any            | `opacity: 0.5; cursor: not-allowed` |

### Hover States

```css
.btn-accent:hover {
  background: #0095c0; /* Darkened accent */
}

.btn-primary:hover {
  background: #072530; /* Darkened primary */
}

.btn-text:hover {
  background: var(--gray-100);
}

.btn-error:hover {
  background: #d32f2f; /* Darkened error */
}
```

### Icon Button

```css
.btn-icon {
  padding: 8px;
  border-radius: 50%;
  background: transparent;
  color: var(--gray-600);
}

.btn-icon:hover {
  background: var(--gray-100);
}
```

> **Convention**: Primary actions use `accent`, never `primary`.

---

## Form Actions

Reusable pattern for action buttons in forms, cards, and modals.

```css
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--gray-200);
}

/* When submit button is on its own line (flex-wrap) */
.form-actions > .btn {
  margin-left: auto;
}
```

> **Convention**: Primary action buttons (Save, Submit, Add) are always **right-aligned**.

---

## Form Fields

### Text Input

```css
.text-field input {
  padding: 12px;
  border: 1px solid var(--gray-300);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  width: 100%;
  transition: border-color 0.2s;
}

.text-field input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 172, 220, 0.1);
}

.text-field input.error {
  border-color: var(--error);
}

.text-field label {
  font-size: 12px;
  color: var(--gray-600);
  margin-bottom: 4px;
}

.text-field .error-text {
  font-size: 12px;
  color: var(--error);
  margin-top: 4px;
}
```

### Textarea

```css
.textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--gray-300);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 172, 220, 0.1);
}

.textarea::placeholder {
  color: var(--gray-600);
}
```

### Select / Dropdown

```css
.select {
  padding: 12px;
  border: 1px solid var(--gray-300);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.select:focus {
  outline: none;
  border-color: var(--accent);
}
```

---

## Chips / Tags

Interactive pill-shaped elements for categories, filters, or status indicators.

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  background: var(--gray-100);
  color: var(--gray-600);
}

/* Hover only when NOT selected (prevents hover overriding selected state) */
.chip:hover:not(.selected) {
  background: var(--gray-200);
  color: var(--gray-800);
}

.chip.selected {
  background: var(--accent);
  color: white;
}

.chip .icon {
  font-size: 16px;
}
```

> **Important**: Use `:hover:not(.selected)` to prevent hover styles from overriding the selected state.

### Semantic Variants (selected state)

| Variant | Background            |
| ------- | --------------------- |
| Info    | `--info` (#2196F3)    |
| Warning | `--warning` (#fb8c00) |
| Error   | `--error` (#FF5252)   |
| Success | `--success` (#4caf50) |

### Chip Group

```css
.chip-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
```

---

## Status Badge

Pill-shaped badge with icon and count for status indicators.

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  color: white; /* Always white text */
}

.status-badge .icon {
  font-size: 14px;
}
```

### Variants

| Status   | Background          | Icon                             |
| -------- | ------------------- | -------------------------------- |
| Pending  | `--warning` (solid) | `schedule` / `mdi-clock-outline` |
| Resolved | `--success` (solid) | `check` / `mdi-check`            |
| Error    | `--error` (solid)   | `error` / `mdi-alert`            |
| Info     | `--info` (solid)    | `info` / `mdi-information`       |

> **Important**: Background is **solid** (100% opaque), not transparent/faded. Text is **always white**.

---

## Icon Action Button

Small icon-only buttons for contextual actions (edit, delete, reply, etc.).

```css
.icon-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--gray-400);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.icon-action-btn .icon {
  font-size: 16px;
}

.icon-action-btn:hover {
  background: var(--gray-100);
  color: var(--accent);
}

.icon-action-btn.danger:hover {
  background: rgba(255, 82, 82, 0.1);
  color: var(--error);
}

.icon-action-btn.success:hover {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success);
}
```

### Common Actions

| Action  | Icon                    | Hover variant |
| ------- | ----------------------- | ------------- |
| Reply   | `reply` / `mdi-reply`   | default       |
| Edit    | `edit` / `mdi-pencil`   | default       |
| Resolve | `check` / `mdi-check`   | success       |
| Delete  | `delete` / `mdi-delete` | danger        |

---

## Cards

```css
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-title {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary);
}

.card-content {
  padding: 0 16px 16px;
  color: var(--gray-600);
  font-size: 14px;
}

.card-actions {
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--gray-200);
}
```

---

## Modal / Dialog

Every popin of the Vue app has **one anatomy**, whatever its content (a confirmation, a form, a picker). It is written once, in `packages/ui/assets/global-styles/dialogs.scss`, and applies to a plain `v-dialog` / `v-card` as well as to `BsModalConfirm`, `BsModalConfirmForm` and `BsModalForm`. **A dialog never restyles itself**: no `flat tile`, no `headline` or `text-h6` title, no local `.modal-actions` rule. If one must differ, the design system decides it first.

```
┌──────────────────────────────────────────┐
│ Title                       Inter 20 / 600 │  24px 24px 8px, --v-primary-base
│ Body text                   14 / 1.5       │  8px 24px 24px, gray-700
├──────────────────────────────────────────┤  1px hairline, gray-200, full width
│                  [ Cancel ] [ Main action ] │  16px 24px, 8px gap, right-aligned
└──────────────────────────────────────────┘
```

| Part      | Rule                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container | White, `--r-md` radius (10px), `--shadow-modal`. Over a scrim in the primary color (46%, Vuetify's own opacity).                                                                                        |
| Title     | Inter 20px / 600, `--v-primary-base`, sentence case, a question mark when it asks something ("Exiger la double authentification ?"). A Lucide icon may precede it.                                      |
| Body      | 14px / 1.5, `--gray-700`. A quieter second line takes the `bs-dialog-note` class (13px, `--gray-600`).                                                                                                  |
| Footer    | A `--gray-200` hairline across the card, actions on the right. A form's footer written inside its body still runs the width of the card.                                                                |
| Actions   | Cancel is a `text` button in the primary color, to the left. The main action is a `cta` (`color="accent"`). A destructive confirmation is `danger` (`color="error"`, filled). Never a filled `primary`. |
| Buttons   | 36px high, 14px / 500, the radius of the controls, **sentence case**.                                                                                                                                   |
| Width     | `max-width` 400 (a short question), 500 (the default), 600 (a form), up to 900 (a table or a picker).                                                                                                   |
| Closing   | Cancel, Escape and a click outside all cancel and leave things as they were. A dialog that must not be closed by accident is `persistent`.                                                              |

**Which component to use**

- A confirmation: `BsModalConfirm` (`title`, `action-label`, `action-button-color`); with a typed confirmation or a checkbox, `BsModalConfirmForm`.
- A form in a popin: `BsModalForm`, or `BsModalConfirm` with `is-form` when the footer is the form's own.
- A one-off layout (a picker, a preview): a plain `v-dialog` > `v-card` > `v-card-title`, `v-card-text`, `v-divider`, `v-card-actions`.

**Not in the Vue app's scope**: the editor's dialogs (Knockout / jQuery UI, see [04-editor-stack.md](./04-editor-stack.md)) keep their own look until the editor moves to the design system. A preview or a gallery that is only content (no footer) keeps the title and the container, and closes on Escape or a click outside.

**Why filled `danger` and not outlined `danger-ink`**: the outlined button is for the action that opens a confirmation ("Supprimer l'entreprise" in the danger zone); the confirmation itself is the `danger` variant of the design system's `Btn`.

---

## Panel Header

Header for sidebars and slide-out panels.

```css
.panel-header {
  background: var(--primary);
  color: white;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px 8px 0 0;
}

.panel-header-title {
  font-size: 16px;
  font-weight: 500;
}

.panel-header-close {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-header-close:hover {
  opacity: 0.8;
}
```

---

## Module Sidebar

Main navigation sidebar for switching between application modules.

### Behavior

- **Default state:** 56px width (icons only)
- **On hover:** Expands to 200px with labels
- **Transition:** `200ms cubic-bezier(0.4, 0, 0.2, 1)`
- **Position:** Fixed left, overlay (doesn't push main content)
- **Mobile:** Hidden below 960px, replaced by hamburger menu drawer

### Structure

```
┌──────────────────────┐
│  MODULES             │
│  ├─ Email Builder    │
│  └─ CRM Intelligence │
├──────────────────────┤
│  UTILITIES           │
│  ├─ Help             │
│  └─ Logout           │
├──────────────────────┤
│  SETTINGS            │
│  └─ Parameters       │
└──────────────────────┘
```

### Item States

| State    | Icon Color          | Background   | Indicator               | Usage                |
| -------- | ------------------- | ------------ | ----------------------- | -------------------- |
| Default  | `grey darken-1`     | transparent  | none                    | Inactive module      |
| Hover    | `accent`            | `#f5f5f5`    | none                    | Mouse over           |
| Active   | `accent`            | `accent/12%` | **3px left bar accent** | Current module       |
| Disabled | `grey`, 40% opacity | transparent  | none                    | Module not available |

### Active Indicator

The active state features a prominent **3px vertical bar** on the left side of the item, using the accent color. This provides clear visual feedback for the current module.

```css
.sidebar-item__indicator {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background-color: transparent;
}

.sidebar-item--active .sidebar-item__indicator {
  background-color: #00acdc;
}
```

### CSS

```css
.module-sidebar {
  position: fixed;
  top: 64px;
  left: 0;
  bottom: 0;
  width: 56px;
  transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  z-index: 5;
}

.module-sidebar--expanded {
  width: 220px;
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
}

.sidebar-item {
  height: 44px;
  margin: 2px 4px;
  border-radius: 8px;
  transition: background-color 150ms ease;
}

.sidebar-item:hover {
  background-color: #f5f5f5;
}

.sidebar-item--active {
  background-color: rgba(0, 172, 220, 0.12);
}

/* Icon hover animation */
.sidebar-item:hover .v-icon {
  transform: scale(1.05);
}

/* Mobile: hide sidebar */
@media (max-width: 960px) {
  .module-sidebar {
    display: none !important;
  }
}
```

### Icons

**Target Library**: Lucide (see [01-tokens.md](./01-tokens.md#icons) for migration mapping)

| Module           | Icon            | Current (MDI)             | Target (Lucide) |
| ---------------- | --------------- | ------------------------- | --------------- |
| Email Builder    | Palette         | `mdi-palette`             | `Palette`       |
| CRM Intelligence | Line chart      | `mdi-chart-line`          | `LineChart`     |
| Help             | Question circle | `mdi-help-circle-outline` | `HelpCircle`    |
| Logout           | Exit door       | `mdi-logout`              | `LogOut`        |
| Settings         | Gear            | `mdi-cog-outline`         | `Settings`      |

### Usage (Vue)

```vue
<bs-module-sidebar />
```

### Related Files

| File                               | Purpose                      |
| ---------------------------------- | ---------------------------- |
| `ui/components/module-sidebar.vue` | Main sidebar component       |
| `ui/components/sidebar-item.vue`   | Reusable item component      |
| `ui/layouts/default.vue`           | Mobile drawer implementation |

---

## Comment Card

Card pattern for comments, discussions, and threaded content.

### Structure

```
┌─────────────────────────────────────────┐
│ Author Name    2 fév.    [Badge] [Badge]│  ← Header
├─────────────────────────────────────────┤
│ Comment text with @mention inline...    │  ← Body
├─────────────────────────────────────────┤
│ [↩] [✓] [✎] [🗑]           [Link →]    │  ← Actions
├─────────────────────────────────────────┤
│ ┃  ┌─────────────────────────────────┐  │
│ ┃  │ Reply Author    2 fév.          │  │  ← Nested reply
│ ┃  │ Reply text...                   │  │
│ ┃  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### CSS

```css
.comment-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
  transition: border-color 0.15s;
}

.comment-card:hover {
  border-color: var(--gray-300);
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.comment-author {
  font-weight: 600;
  font-size: 13px;
  color: var(--primary);
}

.comment-date {
  font-size: 11px;
  color: var(--gray-400);
}

.comment-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--gray-800);
  margin-bottom: 12px;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--gray-100);
}
```

---

## Nested Content

Visual treatment for threaded/nested items (replies, sub-items).

```css
.nested-content {
  margin-left: 14px;
  padding-left: 14px;
  border-left: 2px solid var(--gray-200);
  margin-top: 12px;
}

/* Active/highlighted variant */
.nested-content.accent {
  border-left: 3px solid var(--accent);
}

.nested-content .comment-card {
  background: var(--gray-50);
}
```

---

## Inline Mention

Highlighted @mention within text content.

```css
.mention {
  background: rgba(0, 172, 220, 0.15);
  color: #0088a8; /* --accent darkened ~20% */
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
```

---

## Text Link with Icon

Inline link with trailing or leading icon.

```css
.text-link-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.text-link-icon:hover {
  text-decoration: underline;
}

.text-link-icon .icon {
  font-size: 14px;
}
```

---

## Alert

A framed sentence that says something about the page or the form it sits in, and stays there until the page changes. Written once, in `packages/ui/assets/global-styles/feedback.scss`: an author picks a tone with `<v-alert type="...">` and the variant (`outlined`, `text`, `dense`, solid) makes no difference. It is the alert of the sign-in card (`AuthCard`) for every page.

| Tone      | Use                                                         | Ground                | Frame              | Icon            |
| --------- | ----------------------------------------------------------- | --------------------- | ------------------ | --------------- |
| `error`   | Something went wrong, or cannot be done                     | `--color-error-bg`    | `--error-border`   | `--danger-ink`  |
| `warning` | A consequence to know before going on                       | `--tint-warning-soft` | `--warning-border` | `--warning-ink` |
| `info`    | A fact that explains the page ("the list is empty: normal") | `--tint-info-soft`    | `--info-border`    | `--info-ink`    |
| `success` | Something is in place and stays so (not a toast: see below) | `--tint-success-soft` | `--success-border` | `--success-ink` |

- 12px 16px padding, a 1px frame, `--r-md` radius, the text in 13px / 1.5 `--gray-900`: **the tone is carried by the frame and the icon, never by the text**. No shadow, no left bar, no solid fill.
- `role="alert"` (Vuetify's default) for what went wrong; a plain note otherwise.
- One alert states one thing, in one or two sentences. A mistake made on a field goes on the field, not in an alert.
- Sentence case, no exclamation mark; an `error` says what happened and what to do.

## Tooltip

A short label on a control that has no text of its own (an icon button) or whose text is cut. Written in `feedback.scss`, for every `v-tooltip`.

- `--gray-900` ground, white text, 12px / 500, 6px 10px padding, `--r-sm` radius, `--shadow-menu`, **280px at most**.
- It shows on hover **and on keyboard focus**, above the dialogs (the z-index scale), and never holds anything to click.
- The text is a noun or a verb ("Aide", "Renommer"), never a sentence; the same words name the control for a screen reader (`aria-label`).
- Position: `bottom` by default; `top` when the control is at the foot of the screen, `left` or `right` along a side panel.

---

## Feedback after an action: inline or toast

Two kinds of feedback, and **the one to use depends on what was done**:

| What was done                                                                                   | Feedback                                                       |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **A setting was saved** (a switch, a settings tab, the company form): a value that stays        | **Inline**, where it was made: `BsSaveOutcome`. Never a toast. |
| **An action on a record** (create, delete, send, duplicate, translate): something that happened | A **toast** (snackbar), see below.                             |

### Inline: `BsSaveOutcome`

`packages/ui/components/layout/bs-save-outcome.vue`, with the `mixinInlineOutcome` mixin (`markSaved()`, `markFailed(detail)`).

- **Saved**: a Lucide `Check` and "Enregistré", 13px / 500 in `--success-ink`, announced (`role="status"`, a live region always in the page), gone after **4 seconds**.
- **Failed**: "Modification non enregistrée." in `--danger-ink` (`role="alert"`), then what the page knows ("Le nom est déjà pris"), then an underlined **"Réessayer"** that does the save again. It stays until the next try. The switch of a failed change goes back to its saved state.
- **Where**: next to the control that was used. A switch: under the sentence of its row (`BsGroupFeatureSwitch` in a `BsGroupSettingCard`). A form with a save button: **to the left of the button**, in the same bar.
- Validation stays on the fields; this is only the outcome of the save.

Pages that use it: the company form, the colors, the export options, the email builder settings, the tracking (global and per template), and the switches saved on their own through `mixinGroupSwitch` (two-factor, MCP access, retex).

### Toast: the snackbar

For an action on a record, not for a setting.

```css
.snackbar {
  padding: 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: white;
}

.snackbar.success {
  background: var(--success);
}
.snackbar.error {
  background: var(--error);
}
.snackbar.warning {
  background: var(--warning);
}
.snackbar.info {
  background: var(--info);
}
```

---

## Filters Panel (listing)

The email listing's search and filters ([preview](./preview/mailings-list.html)).
Implementation: `mailings-filters.vue`, `mailings-search-scope.vue`, `mailings-date-field.vue`
in `packages/ui/routes/mailings/__partials/`.

**Anatomy** (one card, `--gray-300` border, 10px radius, 16px padding):

1. **Search field**: full-width up to **520px**, 38px high, search icon vertically centred on the text line, clearable.
2. **Row**: label "Dans", the **segmented scope control**, then the **Filtres** button and, when a filter is set, **Réinitialiser**. They sit together on the left: on a wide screen a control must stay near the field it refines.
3. **Hint**: only when the scope is "all workspaces" ("Résultats dans vos N espaces de travail. La colonne Emplacement indique où se trouve chaque email.").
4. **Panel** (collapsed by default, opened by Filtres): Templates, Tags, "Créé entre … au …", "Mis à jour entre … au …". Labels above the fields, placeholders "Tous les templates" / "Tous les tags".

**Rules**

- Fields never stretch with the screen: a grid of `repeat(auto-fill, minmax(200px, 280px))`.
- The **Filtres** badge counts the panel's filters (templates, tags, dates), not the name, which has its own clearable field. With a filter set, the button takes the accent border and a 8% accent tint.
- Filters carry over a change of scope (ADR 0007): the badge and Réinitialiser say why a list is narrowed.
- **Réinitialiser** sits last in the bar, outlined, and appears only when a panel filter is set (a typed name alone does not bring it). It resets everything: name, filters and scope back to "Dossier courant". Accessible name "Réinitialiser la recherche".
- **Escape** in the name field empties that field only, scope and filters kept.
- Source of truth: the `FiltresPanel` sheet of the "LePatron App - Design System" artifact. Known deviation: the segmented control's track is `--gray-200` (the app's `--gray-100` is a 4% alpha that barely shows on white).

### Segmented control

A gray track (`--gray-200`, 3px padding, 8px radius); the chosen segment is raised: white, `--gray-900`, weight 600, 1px `--gray-200` ring and a light shadow. The others are transparent, `--gray-700`, weight 500, no border. Vuetify's `v-btn-toggle` brings its own white ground and a border per button: both are overridden. Semantics: `role="radiogroup"` with `role="radio"` segments.

### Date field

Never the browser's native date input: its calendar cannot be styled. A readonly outlined field (placeholder `JJ/MM/AAAA`, calendar icon) opens a Vuetify `v-date-picker` in a menu (`content-class="bs-date-menu"`):

- `color="accent"`, `no-title`, week starting on Monday, locale of the app.
- Header month in 14px / 600; weekday initials 11px / 600 uppercase `--gray-600`; day cells 12px / 500.
- Today (not chosen): 1px accent outline and accent text. Chosen day: solid accent, white text.
- The field shows the date as the language writes it; the stored value stays `YYYY-MM-DD`.

---

## Security section (company settings)

The company settings form ([DS sheet: `CompanySettings`](https://claude.ai/artifact/JtUDvCUrEjhutNiYQLZNif)). **One "Sécurité" section holds every setting that says who gets in and how**: Permissions, Authentification SAML and Double authentification. They read like the "Modules activés" cards: a bordered card per setting, its icon on a tile, a name, a sentence, and the switch on the right with its state word (`FeatureSwitch`: "Activé / Désactivé", "Activée / Désactivée", "Exigée / Non exigée"). The danger zone stays last, nothing goes under it.

Implementation: `group/form.vue` (the section), `group/setting-card.vue` (the card, with a `body` slot for what a setting unfolds), `group/feature-switch.vue`, `layout/bs-settings-row.vue` (the last two taken from the MCP stack), and `group/two-factor-option.vue` (the third row, passed through the `security-rows` slot).

- **Permissions** and **SAML** are saved with the form's "Enregistrer"; SAML unfolds its fields (entry point, issuer, certificate) in its own card once on.
- **Double authentification** saves on its own. Its sentence is followed by how many members have set it up ("Configurée par N membres sur M", with a bar once N > 0). Turning it on or off is **confirmed with its impact** ("N membres sur M ne l'ont pas encore configurée"); in the app's usual dialog (rounded card, title, text, hairline, "Annuler" and the action in the accent, red to stop requiring); the action carries the verb ("Exiger la double authentification", "Ne plus exiger"). Cancelling, Escape or a click outside puts the switch back on what is saved.
- Its outcome is read **on the option**, never in a toast: "Enregistré" with a check (13px 500 success-ink, `role="status"`, gone after 4 seconds); on failure the switch returns to its saved state and the card says "Modification non enregistrée." in danger-ink with an underlined "Réessayer" (`role="alert"`).
- A company admin reads the state and is told that only a tech admin changes it; a SAML company leaves two-factor to its identity provider.
- **Not built yet**: the "Membres sans double authentification" row and the `MfaMembers` sub-page (reminders, CSV export), and the lockout guard ("Configurer la mienne": a member sets it up at sign-in, there is no account page for it).

---

## Toggle / Switch

> **In the Vue app**: one look everywhere, the Vuetify `v-switch` with `color="accent"`. No `inset` pill, no `color="primary"` (navy): the spec below is the visual intent (accent thumb when on).
>
> **Which switch where**
>
> - **A setting of a page** (a module, an option, a toggle of a settings tab): `BsGroupFeatureSwitch`, which says its state in words ("Activé / Désactivé", "Exigée / Non exigée") to the switch's left. On a `BsGroupSettingCard` (icon tile, name, sentence), in the `header-actions` slot of a `BsFormSection`, or in a `BsSettingsRow`. The off track barely stands out from white: **the word carries the state, never drop it**.
> - **A field of a form** (the "Actif" of an integration, in a dialog) and **a filter** (the logs' "Masquer les tests"): a labelled `v-switch` in the accent, the label being the field's.
> - **A toggle in a table row** (a user's access to a workspace): a bare dense `v-switch`; the column header names it.

```css
.toggle-track {
  width: 34px;
  height: 14px;
  background: var(--gray-300);
  border-radius: 7px;
  position: relative;
  cursor: pointer;
}

.toggle-track.active {
  background: rgba(0, 172, 220, 0.3);
}

.toggle-thumb {
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
  position: absolute;
  top: -3px;
  left: 0;
  transition: left 0.2s;
}

.toggle-track.active .toggle-thumb {
  left: 14px;
  background: var(--accent);
}
```

---

## Upload Zone

```css
.upload-zone {
  border: 2px dashed var(--gray-300);
  padding: 32px;
  text-align: center;
  border-radius: 4px;
  font-size: 14px;
  color: var(--gray-600);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-zone:hover {
  border-color: var(--accent);
  background: rgba(0, 172, 220, 0.05);
}

.upload-zone .icon {
  font-size: 32px;
  margin-bottom: 8px;
  display: block;
}
```

---

## Gallery Item

```css
.gallery-item {
  width: 100px;
  height: 100px;
  background: var(--gray-200);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 4px;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.gallery-item:hover {
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.gallery-item .delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: var(--error);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: none;
}

.gallery-item:hover .delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## Draggable Block

```css
.draggable-block {
  background: white;
  border: 2px solid transparent;
  padding: 16px;
  margin: 8px 0;
  cursor: move;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.draggable-block:hover {
  border-color: var(--accent);
}

.draggable-block.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 172, 220, 0.2);
}
```

---

## Icons

**Target Library**: Lucide (https://lucide.dev)

| Library                   | Usage                       | Status                |
| ------------------------- | --------------------------- | --------------------- |
| **Lucide**                | Target for Vue App + Editor | Migration in progress |
| **Material Design Icons** | Legacy (Vue App)            | Being replaced        |
| **Font Awesome 4.7**      | Legacy (Editor)             | Being replaced        |

**Usage (Vue)**:

```vue
<script>
import { Settings, HelpCircle, Trash2, Pencil, Plus, X } from 'lucide-vue';

export default {
  components: { Settings, HelpCircle, Trash2, Pencil, Plus, X },
};
</script>

<template>
  <Settings :size="24" />
  <Pencil :size="20" color="currentColor" />
</template>
```

**Common icons mapping** (see [01-tokens.md](./01-tokens.md#icon-systems-fixed) for full table):

| Purpose  | MDI (legacy) | Lucide (target) |
| -------- | ------------ | --------------- |
| Settings | `mdi-cog`    | `Settings`      |
| Edit     | `mdi-pencil` | `Pencil`        |
| Delete   | `mdi-delete` | `Trash2`        |
| Add      | `mdi-plus`   | `Plus`          |
| Close    | `mdi-close`  | `X`             |

Reference: [lucide.dev/icons](https://lucide.dev/icons)

---

## Implementation Notes

### Vue App (Vuetify)

```html
<!-- Button -->
<v-btn color="accent" elevation="0">Save</v-btn>
<v-btn text color="primary">Cancel</v-btn>
<v-btn color="error" elevation="0">Delete</v-btn>

<!-- Chip -->
<v-chip small color="accent" text-color="white">Selected</v-chip>

<!-- Icon -->
<v-icon>mdi-cog</v-icon>
```

### Editor (Knockout + jQuery UI)

```html
<!-- Button -->
<button class="ui-button primaryButton">
  <span class="ui-button-text">Save</span>
</button>

<!-- Icon (legacy FA) -->
<i class="fa fa-cog"></i>

<!-- Icon (legacy MDI) -->
<span class="mdi mdi-cog"></span>

<!-- Icon (target - Lucide inline SVG) -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
>
  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18..." />
</svg>
```

### CSS Variables

All components use CSS variables for white-label support:

```css
var(--v-primary-base)    /* Vuetify */
var(--v-accent-base)     /* Vuetify */
@bs-primary-color        /* LESS */
@bs-accent-color         /* LESS */
```

---

## Reusable Components Inventory

| Component            | File                                   | Usage                |
| -------------------- | -------------------------------------- | -------------------- |
| `modal-confirm`      | `ui/components/modal-confirm.vue`      | Confirmation dialogs |
| `modal-confirm-form` | `ui/components/modal-confirm-form.vue` | Form dialogs         |
| `snackbar`           | `ui/components/snackbar.vue`           | Notifications        |
| `loadingBar`         | `ui/components/loadingBar.vue`         | Loading indicator    |

---

## Bs\* component family — two abstraction layers

The `Bs*` prefix covers **two distinct kinds of components**, and the
distinction is not just stylistic — it affects portability.

### Primitives — pure, stateless, copy-paste safe

These components are slot-forwarding wrappers around a Vuetify primitive. They
take props in, emit events out, and have **no dependency on Vuex, Vue Router,
vue-i18n or any application-level concern**. They can be extracted to a
shared package or used in isolation in another app without modification.

| Component         | File                                           | Wraps                              |
| ----------------- | ---------------------------------------------- | ---------------------------------- |
| `bs-data-table`   | `ui/components/data-table/bs-data-table.vue`   | `v-data-table` + design-system CSS |
| `bs-text-field`   | `ui/components/form/bs-text-field.vue`         | `v-text-field` (label-above style) |
| `bs-select`       | `ui/components/form/bs-select.vue`             | `v-select` (label-above style)     |
| `bs-row-actions`  | `ui/components/row-actions/bs-row-actions.vue` | Quick action icons + kebab menu    |
| `bs-breadcrumb`   | `ui/components/layout/bs-breadcrumb.vue`       | Breadcrumb trail                   |
| `bs-page-header`  | `ui/components/layout/bs-page-header.vue`      | Page header shell + slots          |
| `bs-form-section` | `ui/components/layout/bs-form-section.vue`     | Form section heading + content     |

### Shells — feature-aware, app-coupled

These components **consume Vuex, Vue Router, vue-i18n, Vuetify breakpoints or
application state**. They are part of LePatron's application shell, not the
design-system primitive layer. **They cannot be copy-pasted to another app or
extracted to a shared package without bringing the matching stores, routes
and i18n keys along.**

If you ever extract the design-system to a separate package, **leave these
behind** (or rename them under a different prefix, e.g. `AppSidebar*`).

| Component                     | File                                                          | Dependencies                           |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `bs-sidebar`                  | `ui/components/sidebar/bs-sidebar.vue`                        | Vuex (`sidebar`, `user`), router, i18n |
| `bs-sidebar-brand`            | `ui/components/sidebar/bs-sidebar-brand.vue`                  | router, i18n                           |
| `bs-sidebar-company-switcher` | `ui/components/sidebar/bs-sidebar-company-switcher.vue`       | Vuex `user`, router, i18n              |
| `bs-sidebar-context-zone`     | `ui/components/sidebar/bs-sidebar-context-zone.vue`           | Vuex `sidebar`, router                 |
| `bs-sidebar-module-list`      | `ui/components/sidebar/bs-sidebar-module-list.vue`            | Vuex `user`, router, i18n              |
| `bs-sidebar-system-zone`      | `ui/components/sidebar/bs-sidebar-system-zone.vue`            | Vuex `user`, router, i18n              |
| `bs-sidebar-toggle`           | `ui/components/sidebar/bs-sidebar-toggle.vue`                 | Vuex `sidebar`                         |
| `bs-sidebar-dashboard-list`   | `ui/components/sidebar/context/bs-sidebar-dashboard-list.vue` | Vuex `user`, router, i18n              |
| `bs-sidebar-settings-list`    | `ui/components/sidebar/context/bs-sidebar-settings-list.vue`  | Vuex `user`, router, i18n, ACL helpers |
| `bs-sidebar-workspace-tree`   | `ui/components/sidebar/context/bs-sidebar-workspace-tree.vue` | Vuex `folder`, router, localStorage    |

### Modals — three patterns coexisting (debt)

There are currently three modal wrappers in `ui/components/`:

| Component            | File                                    | Consumers                 |
| -------------------- | --------------------------------------- | ------------------------- |
| `modal-confirm`      | `ui/components/modal-confirm.vue`       | 15+ — current default     |
| `modal-confirm-form` | `ui/components/modal-confirm-form.vue`  | 2 (workspaces, templates) |
| `bs-modal-form`      | `ui/components/modal/bs-modal-form.vue` | 1 (`modal-create-group`)  |

`bs-modal-form` was introduced as the intended new design-system standard
but only one consumer was migrated, so it currently looks more like an
abandoned alternative than a real standard. **TODO**: pick one (probably
`bs-modal-form` if it represents the design-system direction) and migrate
the rest, or remove `bs-modal-form` until the migration can actually be
done across the codebase. Tracked separately, not in scope of the review
PR.

---

## File naming convention

All `Bs*` design-system components live under `ui/components/` and use
**kebab-case** file names (e.g. `bs-data-table.vue`, `bs-sidebar.vue`). This
matches AGENTS.md and lets us spot stale PascalCase imports easily on a
case-sensitive CI filesystem.

---

_Last updated: 2026-05-15 (v2.5 - Primitive/shell distinction documented; Bs\* renamed to kebab-case across the board)_
