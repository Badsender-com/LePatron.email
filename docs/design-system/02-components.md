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

*Last updated: February 2026*
