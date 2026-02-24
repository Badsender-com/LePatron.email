# UI Components

> **Tokens**: See [01-tokens.md](./01-tokens.md) for colors, typography, spacing.
> **UX Patterns**: See [UX_GUIDELINES.md](../UX_GUIDELINES.md) for behavioral patterns.

## Vue App (Vuetify)

### Buttons

```html
<!-- Primary action -->
<v-btn color="accent" elevation="0" @click="onSubmit">
  {{ $t('global.save') }}
</v-btn>

<!-- Cancel -->
<v-btn text color="primary" @click="close">
  {{ $t('global.cancel') }}
</v-btn>

<!-- Destructive -->
<v-btn color="error" elevation="0" @click="delete">
  {{ $t('global.delete') }}
</v-btn>

<!-- Icon -->
<v-btn icon color="primary lighten-4">
  <v-icon>settings</v-icon>
</v-btn>
```

**Convention**: Primary actions = `color="accent"`, never `color="primary"`.

---

### Form Fields

```html
<v-text-field
  id="email"
  v-model="localModel.email"
  :label="$t('users.email')"
  name="email"
  type="email"
  required
  :error-messages="emailErrors"
  @input="$v.user.email.$touch()"
/>

<v-select
  id="lang"
  v-model="localModel.lang"
  :label="$t('users.lang')"
  :items="$options.supportedLanguages"
/>
```

---

### Icons

```html
<v-icon>settings</v-icon>
<v-icon color="primary">help</v-icon>
<v-icon small>info</v-icon>
```

Reference: [materialdesignicons.com](https://materialdesignicons.com/)

---

### Cards and Dialogs

```html
<v-card flat tile>
  <v-card-title>{{ title }}</v-card-title>
  <v-card-text>Content</v-card-text>
  <v-divider />
  <v-card-actions>
    <v-spacer />
    <v-btn text color="primary">Cancel</v-btn>
    <v-btn color="accent" elevation="0">Save</v-btn>
  </v-card-actions>
</v-card>

<v-dialog v-model="show" width="500">
  <v-card>...</v-card>
</v-dialog>
```

---

### Tables

```html
<v-data-table
  :headers="headers"
  :items="items"
  :loading="loading"
  :items-per-page="10"
>
  <template #item.actions="{ item }">
    <bs-actions-dropdown :item="item" />
  </template>
</v-data-table>
```

---

### Notifications (Snackbar)

Via store:
```javascript
this.$store.commit('page/SHOW_SNACKBAR', {
  text: this.$t('success.saved'),
  color: 'success',
  timeout: 3000,
});
```

---

### Chips / Tags

Small interactive elements for categories, filters, or status indicators.

```html
<!-- Vuetify -->
<v-chip small color="accent" text-color="white">
  Selected
</v-chip>

<v-chip small outlined>
  Default
</v-chip>

<!-- Semantic variants -->
<v-chip small color="info" text-color="white">Info</v-chip>
<v-chip small color="warning" text-color="white">Warning</v-chip>
<v-chip small color="error" text-color="white">Error</v-chip>
<v-chip small color="success" text-color="white">Success</v-chip>
```

**Specifications** (see [01-tokens.md](./01-tokens.md)):

| Property | Value |
|----------|-------|
| Border radius | `9999px` (pill) |
| Padding | `4px 12px` |
| Font size | `12px` |
| Font weight | `500` |

**States**:

| State | Background | Text |
|-------|------------|------|
| Default | `--gray-100` | `--gray-600` |
| Hover | `--gray-200` | `--gray-800` |
| Selected | `--accent` | white |

**Semantic variants** (selected state):

| Variant | Background |
|---------|------------|
| Info | `--info` (#2196F3) |
| Warning | `--warning` (#fb8c00) |
| Error | `--error` (#FF5252) |
| Success | `--success` (#4caf50) |

---

### Textarea

Multi-line text input for comments, descriptions, etc.

```html
<!-- Vuetify -->
<v-textarea
  v-model="comment"
  :label="$t('comments.placeholder')"
  rows="3"
  auto-grow
  outlined
/>
```

**Specifications**:

| Property | Value |
|----------|-------|
| Border | `1px solid --gray-300` |
| Border radius | `4px` |
| Padding | `12px` |
| Min height | `80px` |
| Font size | `14px` |
| Resize | `vertical` |

**Focus state**:
```css
border-color: var(--accent);
box-shadow: 0 0 0 2px rgba(0, 172, 220, 0.1);
```

---

### Chip Group (Segmented Control)

Group of chips with radio behavior (single selection). Used for category/filter selection.

```html
<!-- Vuetify -->
<v-chip-group v-model="selected" mandatory>
  <v-chip v-for="option in options" :key="option.value" :value="option.value" filter>
    <v-icon left small>{{ option.icon }}</v-icon>
    {{ option.label }}
  </v-chip>
</v-chip-group>
```

**Specifications**:

| Property | Value |
|----------|-------|
| Container | `display: flex; gap: 8px` |
| Behavior | Single selection (radio) |
| Chip default | `background: --gray-100; color: --gray-600` |
| Chip hover | `background: --gray-200; color: --gray-800` |
| Chip selected | `background: --accent; color: white` |

**Semantic variants** (for severity/priority):

| Variant | Selected background |
|---------|---------------------|
| Info | `--info` (#2196F3) |
| Warning | `--warning` (#fb8c00) |
| Error | `--error` (#FF5252) |
| Success | `--success` (#4caf50) |

---

### Panel Header

Header for sidebars and slide-out panels.

**Specifications**:

| Property | Value |
|----------|-------|
| Background | `--primary` (#093040) |
| Text color | `white` |
| Font size | `16px` |
| Font weight | `500` |
| Padding | `12px 16px` |
| Close button | Icon button, white, 24px |

**Structure**:
```
┌─────────────────────────────────────┐
│ Panel Title                      ✕  │
└─────────────────────────────────────┘
```

---

### Status Badge

Pill-shaped badge with icon and count for status indicators.

```html
<!-- Vuetify -->
<v-chip small :color="statusColor" text-color="white">
  <v-icon left small>{{ statusIcon }}</v-icon>
  {{ count }} {{ label }}
</v-chip>
```

**Specifications**:

| Property | Value |
|----------|-------|
| Border radius | `9999px` (pill) |
| Padding | `4px 12px` |
| Font size | `12px` |
| Font weight | `600` |
| Icon size | `14px` |
| Gap (icon-text) | `4px` |

**Variants**:

| Status | Background | Icon |
|--------|------------|------|
| Pending | `--warning` | `mdi-clock-outline` |
| Resolved | `--success` | `mdi-check` |
| Error | `--error` | `mdi-alert` |
| Info | `--info` | `mdi-information` |

---

### Icon Action Button

Small icon-only buttons for contextual actions (edit, delete, reply, etc.).

**Specifications**:

| Property | Value |
|----------|-------|
| Size | `28px × 28px` |
| Border radius | `4px` |
| Icon size | `16px` |
| Background | `transparent` |
| Color | `--gray-400` |
| Transition | `all 0.15s ease` |

**States**:

| State | Background | Color |
|-------|------------|-------|
| Default | `transparent` | `--gray-400` |
| Hover | `--gray-100` | `--accent` |
| Hover (danger) | `--error (10%)` | `--error` |
| Hover (success) | `--success (10%)` | `--success` |

**Common actions**:

| Action | Icon | Hover variant |
|--------|------|---------------|
| Reply | `mdi-reply` | default |
| Edit | `mdi-pencil` | default |
| Resolve | `mdi-check` | success |
| Delete | `mdi-delete` | danger |

---

### Comment Card

Card pattern for comments, discussions, and threaded content.

**Structure**:
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

**Card specifications**:

| Property | Value |
|----------|-------|
| Background | `white` |
| Border | `1px solid --gray-200` |
| Border radius | `8px` |
| Padding | `14px` |
| Margin bottom | `10px` |
| Hover border | `--gray-300` |

**Header**:

| Element | Style |
|---------|-------|
| Author name | `font-weight: 600; font-size: 13px; color: --primary` |
| Date | `font-size: 11px; color: --gray-400` |
| Badges | Chips (see Chips section) |

**Body**:

| Property | Value |
|----------|-------|
| Font size | `14px` |
| Line height | `1.6` |
| Color | `--gray-800` |

**Actions row**:

| Property | Value |
|----------|-------|
| Padding top | `8px` |
| Border top | `1px solid --gray-100` |
| Margin top | `8px` |
| Gap | `4px` |

---

### Nested Content

Visual treatment for threaded/nested items (replies, sub-items).

**Specifications**:

| Property | Value |
|----------|-------|
| Margin left | `14px` |
| Padding left | `14px` |
| Border left | `2px solid --gray-200` |

**With accent highlight** (active reply):

| Property | Value |
|----------|-------|
| Border left | `3px solid --accent` |
| Background | `--gray-50` |

---

### Inline Mention

Highlighted @mention within text content.

**Specifications**:

| Property | Value |
|----------|-------|
| Background | `--accent (15%)` |
| Color | `--accent` (darkened 20%) |
| Padding | `1px 6px` |
| Border radius | `4px` |
| Font weight | `500` |

---

### Text Link with Icon

Inline link with trailing or leading icon.

**Specifications**:

| Property | Value |
|----------|-------|
| Color | `--accent` |
| Font size | `12px` |
| Font weight | `500` |
| Icon size | `14px` |
| Gap | `4px` |
| Hover | `text-decoration: underline` |

**Example**: `Aller au bloc →`

---

## Reusable Components

| Component | File | Usage |
|-----------|------|-------|
| `modal-confirm` | `components/modal-confirm.vue` | Confirmation dialogs |
| `modal-confirm-form` | `components/modal-confirm-form.vue` | Form dialogs |
| `snackbar` | `components/snackbar.vue` | Notifications |
| `loadingBar` | `components/loadingBar.vue` | Loading indicator |
| `actions-dropdown` | `components/profiles/profiles-actions-dropdown.vue` | Actions menu |

### Modal Confirm

```html
<bs-modal-confirm
  ref="confirmDelete"
  :title="$t('mailings.deleteConfirm')"
  :action-label="$t('global.delete')"
  action-button-color="error"
  @confirm="onDeleteConfirm"
>
  <p>{{ $t('mailings.deleteWarning') }}</p>
</bs-modal-confirm>

<!-- Open via ref -->
<script>
this.$refs.confirmDelete.open();
</script>
```

---

## Editor (jQuery UI / Knockout)

### Buttons

```html
<button class="ui-button primaryButton">
  <span class="ui-button-text">Save</span>
</button>
```

Classes: `.ui-button`, `.primaryButton`, `.ui-button-disabled`, `.pressed`

### Icons

```html
<i class="fa fa-cog"></i>
<i class="fa fa-save"></i>
```

### Tabs

```javascript
$('.tabs-container').tabs();
```

### Sortable / Draggable

```javascript
$('.sortable-list').sortable({ handle: '.drag-handle' });
$('.draggable-item').draggable({ helper: 'clone' });
```

### Knockout Bindings

```html
<span data-bind="text: blockTitle"></span>
<input data-bind="value: propertyValue" />
<button data-bind="click: saveBlock">Save</button>
<div data-bind="visible: isEditing">...</div>
```

---

## Inventory by Domain

### Mailings

| Component | Usage |
|-----------|-------|
| `modal-duplicate` | Duplicate mailing |
| `modal-rename` | Rename |
| `modal-transfer` | Transfer |
| `modal-tags-form` | Manage tags |
| `tags-menu` | Tag selection |

### ESP Profiles

| Component | ESP |
|-----------|-----|
| `ACTITOComponent.vue` | Actito |
| `ADOBEComponent.vue` | Adobe Campaign |
| `DSCComponent.vue` | DSC |
| `SENDINBLUEComponent.vue` | Brevo |

### Group Settings

| Component | Usage |
|-----------|-------|
| `group/form` | Group form |
| `group/users-tab` | User management |
| `group/profiles-tab` | ESP profiles management |
| `group/templates-tab` | Templates management |
| `group/workspaces-tab` | Workspaces management |

---

## Layouts

| Layout | Usage |
|--------|-------|
| `default` | Main layout with header |
| `centered` | Centered content (login) |
| `error` | Error page |

---

*Last updated: February 2026 (v1.2 - added Chip Group, Panel Header, Status Badge, Icon Actions, Comment Card, Mentions, Links)*
