# Molecules

Molecules are groups of atoms that function together as a unit.

> **See also**: [UX_GUIDELINES.md](../UX_GUIDELINES.md) for layout patterns (panels, overlays), badge positioning, and filter/toggle best practices.

## Vue App Molecules

### Modal Confirm

**Component**: `components/modal-confirm.vue`

A reusable confirmation dialog combining card, title, content slot, and action buttons.

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | String | `''` | Dialog title |
| `modalWidth` | String | `'500'` | Dialog width |
| `actionLabel` | String | `''` | Confirm button label |
| `actionButtonColor` | String | `'error'` | Confirm button color |
| `displaySubmitButton` | Boolean | `true` | Show confirm button |
| `isForm` | Boolean | `false` | If true, hides default actions |

**Usage**:
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

**Events**:
- `@confirm` - Emitted when action button clicked
- `@close` - Emitted when dialog closed
- `@click-outside` - Emitted when clicking outside dialog

---

### Modal Confirm Form

**Component**: `components/modal-confirm-form.vue`

Extended version with form validation support.

---

### Actions Dropdown

**Component**: `components/profiles/profiles-actions-dropdown.vue`

A vertical dots menu containing action items.

**Structure**:
```html
<v-menu offset-y>
  <template #activator="{ on }">
    <v-btn color="accent" dark icon v-on="on">
      <v-icon>mdi-dots-vertical</v-icon>
    </v-btn>
  </template>
  <v-list activable>
    <slot />
  </v-list>
</v-menu>
```

**Usage**:
```html
<bs-actions-dropdown>
  <v-list-item @click="edit">
    <v-list-item-title>{{ $t('global.edit') }}</v-list-item-title>
  </v-list-item>
  <v-list-item @click="delete">
    <v-list-item-title>{{ $t('global.delete') }}</v-list-item-title>
  </v-list-item>
</bs-actions-dropdown>
```

---

### Form Groups

A recurring pattern of label + input + validation in grid:

```html
<v-row>
  <v-col cols="6">
    <v-text-field
      id="email"
      v-model="localModel.email"
      :label="$t('users.email')"
      name="email"
      type="email"
      required
      :error-messages="emailErrors"
      @input="$v.user.email.$touch()"
      @blur="$v.user.email.$touch()"
    />
  </v-col>
  <v-col cols="6">
    <v-text-field
      id="name"
      v-model="localModel.name"
      :label="$t('forms.user.name')"
      name="name"
      :error-messages="nameErrors"
      @input="$v.user.name.$touch()"
      @blur="$v.user.name.$touch()"
    />
  </v-col>
</v-row>
```

**Grid conventions**:
- Use `v-row` / `v-col` for layout
- Two columns: `cols="6"` each
- Full width: `cols="12"`
- Three columns: `cols="4"` each

---

### Loading Bar

**Component**: `components/loadingBar.vue`

A simple loading indicator.

---

### Tags

**Component**: `components/mailings/tags-menu.vue`

Tag selection and display component.

**CSS class** (from `index.scss`):
```scss
.v-application .tags {
  color: white;
  background-color: rgb(0, 172, 220);  // accent
  padding: 0 5px;
  border-radius: 5px;
  white-space: nowrap;
  display: inline-block;
}
```

---

## Component Inventory

| Molecule | Location | Purpose |
|----------|----------|---------|
| `modal-confirm` | `components/` | Confirmation dialogs |
| `modal-confirm-form` | `components/` | Form-based dialogs |
| `snackbar` | `components/` | Notifications (store-driven) |
| `loadingBar` | `components/` | Loading indicator |
| `layout-left-menu` | `components/` | Sidebar navigation |
| `tags-menu` | `components/mailings/` | Tag selection |
| `modal-duplicate` | `components/mailings/` | Duplicate mailing dialog |
| `modal-rename` | `components/mailings/` | Rename mailing dialog |
| `modal-transfer` | `components/mailings/` | Transfer mailing dialog |
| `modal-tags-form` | `components/mailings/` | Edit tags dialog |
| `profile-form` | `components/profiles/` | ESP profile form |
| `profiles-actions-dropdown` | `components/profiles/` | Profile actions menu |
| `profiles-actions-dropdown-item` | `components/profiles/` | Action menu item |
| `cover-image` | `components/template/` | Template cover display |
| `edit-form` | `components/template/` | Template edit form |
| `images-list` | `components/template/` | Template images grid |
| `html-preview` | `components/template/` | HTML preview iframe |
| `workspace-form` | `components/workspaces/` | Workspace creation form |
| `user/menu` | `components/user/` | User navigation menu |
| `user/actions` | `components/user/` | User action methods |

---

## ESP Form Components

Specialized forms for each ESP provider:

| Component | ESP |
|-----------|-----|
| `ACTITOComponent.vue` | Actito |
| `ADOBEComponent.vue` | Adobe Campaign |
| `DSCComponent.vue` | DSC |
| `SENDINBLUEComponent.vue` | Brevo (Sendinblue) |

These follow the same pattern with provider-specific fields.

---

## Editor Molecules

The email editor (`packages/editor/`) uses a different technology stack (Knockout, jQuery UI, LESS) but shares design tokens via CSS variables.

### Toolbar Buttons

**Location**: `editor/src/css/style_mosaico.less`, `style_badsender.less`

Editor toolbar buttons using jQuery UI patterns:

```css
/* Action buttons */
.ui-button {
  background: var(--v-accent-base);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

/* Icon buttons */
.ui-button-icon-only {
  background: transparent;
  color: var(--v-primary-base);
  padding: 0.5rem;
}
```

---

### Tabs (jQuery UI)

**Location**: Editor panels use jQuery UI tabs

```css
.ui-tabs-nav {
  background: transparent;
  border-bottom: 1px solid #ddd;
}

.ui-tabs-nav li.ui-state-active a {
  color: var(--v-accent-base);
  border-bottom: 2px solid var(--v-accent-base);
}
```

---

### Toggle/Switch

**Location**: `editor/src/css/style_badsender.less`

Custom toggle components for editor options:

```css
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.toggle input:checked + .slider {
  background-color: var(--v-accent-base);
}
```

---

### Color Picker

**Technology**: EasyLogic Color Picker

Used for selecting colors in block editing:

```css
.colorpicker-container {
  font-family: inherit;
}

.colorpicker-palette-item.selected {
  border-color: var(--v-accent-base);
}
```

---

### Upload Zone

**Location**: `editor/src/js/ext/badsender-server-storage.js`

Drag-and-drop image upload area:

```css
.upload-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
}

.upload-zone.dragover {
  border-color: var(--v-accent-base);
  background: rgba(0, 172, 220, 0.1);
}
```

---

### Image Gallery

**Technology**: jQuery UI Sortable

Grid of uploaded images with drag-to-reorder:

```css
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
}

.image-item {
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: move;
}

.image-item.selected {
  border-color: var(--v-accent-base);
}
```

---

### Draggable Blocks

**Technology**: Knockout + jQuery UI Draggable

Email content blocks that can be dragged into the canvas:

```css
.block-item {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.75rem;
  cursor: grab;
}

.block-item:hover {
  border-color: var(--v-accent-base);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.block-item.ui-draggable-dragging {
  opacity: 0.8;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

---

### Dialog/Modal

**Location**: Custom CSS in editor styles

Editor dialogs for settings and confirmations:

```css
.editor-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  max-width: 500px;
}

.editor-dialog-header {
  padding: 1rem;
  border-bottom: 1px solid #eee;
  font-weight: 600;
}

.editor-dialog-actions {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
```

---

## Editor Component Inventory

| Component | Technology | White-Label Ready |
|-----------|------------|-------------------|
| Toolbar buttons | jQuery UI | Yes (CSS vars) |
| Tabs | jQuery UI | Yes (CSS vars) |
| Toggle/Switch | Custom CSS | Yes (CSS vars) |
| Color Picker | EasyLogic | Partial |
| Upload zone | Custom | Yes (CSS vars) |
| Image gallery | jQuery UI Sortable | Yes (CSS vars) |
| Draggable blocks | Knockout + jQuery UI | Yes (CSS vars) |
| Dialogs | Custom CSS | Yes (CSS vars) |

**Note**: Most editor components already use CSS variables (`--v-primary-base`, `--v-accent-base`) inherited from Vuetify, making them compatible with white-label theming.
