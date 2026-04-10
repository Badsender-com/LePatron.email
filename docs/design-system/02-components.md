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
  text-transform: uppercase;
  letter-spacing: 0.025em;
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

```css
.modal-backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.modal {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  margin: 0 auto;
}

.modal-title {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary);
}

.modal-content {
  padding: 0 16px 16px;
  color: var(--gray-600);
  font-size: 14px;
}

.modal-actions {
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--gray-200);
}
```

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

## Notifications (Snackbar)

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

## Toggle / Switch

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

| Component            | File                                   | Usage                   |
| -------------------- | -------------------------------------- | ----------------------- |
| `modal-confirm`      | `ui/components/modal-confirm.vue`      | Confirmation dialogs    |
| `modal-confirm-form` | `ui/components/modal-confirm-form.vue` | Form dialogs            |
| `snackbar`           | `ui/components/snackbar.vue`           | Notifications           |
| `loadingBar`         | `ui/components/loadingBar.vue`         | Loading indicator       |
| `module-sidebar`     | `ui/components/module-sidebar.vue`     | Main navigation sidebar |
| `sidebar-item`       | `ui/components/sidebar-item.vue`       | Sidebar navigation item |

---

_Last updated: April 2026 (v2.4 - Updated icon migration target: MDI → Lucide)_
