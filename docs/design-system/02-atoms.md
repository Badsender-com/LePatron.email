# Atoms

Atoms are the smallest UI elements that cannot be broken down further.

> **See also**: [UX_GUIDELINES.md](../UX_GUIDELINES.md) for component usage best practices, icon+text patterns, and accessibility requirements.

## Vue App Atoms (Vuetify)

### Buttons

**Component**: `v-btn`

**Standard usage in LePatron**:

```html
<!-- Primary action -->
<v-btn color="accent" elevation="0" @click="onSubmit">
  {{ $t('global.save') }}
</v-btn>

<!-- Secondary/Cancel action -->
<v-btn text color="primary" @click="close">
  {{ $t('global.cancel') }}
</v-btn>

<!-- Destructive action -->
<v-btn color="error" elevation="0" @click="delete">
  {{ $t('global.delete') }}
</v-btn>

<!-- Icon button (toolbar) -->
<v-btn icon color="primary lighten-4" @click="action">
  <v-icon>settings</v-icon>
</v-btn>
```

**Conventions**:
- Primary actions: `color="accent"` with `elevation="0"`
- Cancel buttons: `text` variant with `color="primary"`
- Toolbar icons: `icon` variant
- Never use raw `<button>` elements

---

### Text Fields

**Component**: `bs-text-field` (wrapper around `v-text-field`)

LePatron uses custom form components that display labels **above** the input field (not floating/inline like Vuetify default). This provides a cleaner, more modern look.

**Standard usage**:

```html
<bs-text-field
  v-model="localModel.email"
  :label="$t('users.email')"
  type="email"
  required
  :error-messages="emailErrors"
  @blur="$v.user.email.$touch()"
/>
```

**With hint text**:

```html
<bs-text-field
  v-model="localModel.name"
  :label="$t('forms.user.name')"
  :hint="$t('forms.user.nameHint')"
  required
/>
```

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `v-model` | String/Number | Input value |
| `label` | String | Label displayed above the input |
| `hint` | String | Helper text below the input |
| `error-messages` | String/Array | Validation error messages |
| `required` | Boolean | Shows asterisk and marks as required |
| `disabled` | Boolean | Disables the input |
| `placeholder` | String | Placeholder text |
| `type` | String | Input type (text, email, password, etc.) |

**Conventions**:
- Always use `bs-text-field` for new forms (not raw `v-text-field`)
- Use i18n keys for labels and hints
- Integrate with vuelidate for validation
- Pass errors via `:error-messages` prop

**Why not use Vuetify's built-in variants?**

| Vuetify Style | Issue |
|---------------|-------|
| Default (underline) | Label floats, inconsistent position |
| `outlined` | Label sits ON the border (not above) |
| `filled` | Background color, not our style |
| `solo` | No built-in label support |

Our `bs-text-field` wrapper provides a consistent "label above, bordered input" style.

---

### Select

**Component**: `bs-select` (wrapper around `v-select`)

**Standard usage**:

```html
<bs-select
  v-model="localModel.lang"
  :label="$t('users.lang')"
  :items="languageOptions"
  required
/>
```

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `v-model` | Any | Selected value |
| `label` | String | Label displayed above the select |
| `items` | Array | Options array |
| `hint` | String | Helper text below the select |
| `error-messages` | String/Array | Validation error messages |
| `required` | Boolean | Shows asterisk |
| `multiple` | Boolean | Allow multiple selection |
| `clearable` | Boolean | Show clear button |

**Items format**:
```javascript
// Array of objects with text/value
[
  { text: 'English', value: 'en' },
  { text: 'Français', value: 'fr' },
]
```

**Conventions**:
- Always use `bs-select` for new forms (not raw `v-select`)
- Same styling as `bs-text-field` for visual consistency

---

### Icons

**Target Library**: Lucide (https://lucide.dev)
**Package**: `lucide-vue` (Vue 2) or `lucide-vue-next` (Vue 3)

**Usage**:

```vue
<script>
import { Settings, HelpCircle, Trash2, Pencil, Plus, X, LogOut } from 'lucide-vue';

export default {
  components: { Settings, HelpCircle, Trash2, Pencil, Plus, X, LogOut }
}
</script>

<template>
  <!-- Standard icon -->
  <Settings :size="24" />

  <!-- With color -->
  <HelpCircle :size="24" color="var(--v-primary-base)" />

  <!-- Icon sizes -->
  <Settings :size="16" />  <!-- small -->
  <Settings :size="24" />  <!-- default -->
  <Settings :size="32" />  <!-- large -->
</template>
```

**Icon library**: Lucide Icons
**Reference**: https://lucide.dev/icons

**Common icons in LePatron**:

| Purpose               | Lucide Component | Size   |
| --------------------- | ---------------- | ------ |
| Settings              | `Settings`       | 24     |
| Logout                | `LogOut`         | 24     |
| Help                  | `HelpCircle`     | 24     |
| Delete                | `Trash2`         | 20     |
| Edit                  | `Pencil`         | 20     |
| Add/Create            | `Plus`           | 20     |
| Close/Dismiss         | `X`              | 20     |
| User                  | `User`           | 24     |
| Email                 | `Mail`           | 24     |
| Dashboard             | `LayoutDashboard`| 24     |
| Chart                 | `LineChart`      | 24     |
| Search                | `Search`         | 20     |
| More options          | `MoreVertical`   | 20     |
| External link         | `ExternalLink`   | 16     |
| Save                  | `Save`           | 20     |
| Arrow up/down         | `ArrowUp/Down`   | 16     |
| Check                 | `Check`          | 20     |
| Alert                 | `AlertTriangle`  | 20     |
| Info                  | `Info`           | 20     |

**Legacy (MDI)**: Material Design Icons via `<v-icon>` - being phased out

---

### Tooltips

**Component**: `v-tooltip`

**Standard usage**:

```html
<v-tooltip bottom>
  <template #activator="{ on }">
    <v-btn icon v-on="on">
      <v-icon>help</v-icon>
    </v-btn>
  </template>
  <span>{{ $t('layout.help') }}</span>
</v-tooltip>
```

**Positions**: `top`, `bottom`, `left`, `right`

---

### Cards

**Component**: `v-card`

**Standard usage**:

```html
<v-card flat tile>
  <v-card-title>Title</v-card-title>
  <v-card-text>Content</v-card-text>
  <v-divider />
  <v-card-actions>
    <v-spacer />
    <v-btn text>Cancel</v-btn>
    <v-btn color="accent">Save</v-btn>
  </v-card-actions>
</v-card>
```

**Conventions**:
- Use `flat tile` for form containers
- Use `v-divider` before `v-card-actions`
- Actions aligned right with `v-spacer`

---

### Dialogs

**Component**: `v-dialog`

**Standard usage**:

```html
<v-dialog v-model="show" width="500">
  <v-card flat tile>
    <v-card-title>{{ title }}</v-card-title>
    <v-card-text>
      <slot />
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn text color="primary" @click="close">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn color="error" elevation="0" @click="confirm">
        {{ actionLabel }}
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

---

### Snackbar

**Component**: `v-snackbar`

**Centralized via store** (see `components/snackbar.vue`):

```html
<v-snackbar
  bottom
  :value="snackbar.visible"
  :color="snackbar.color"
  :timeout="snackbar.timeout"
>
  {{ snackbar.text }}
  <v-btn text dark @click="closeSnackbar">
    {{ $t('global.close') }}
  </v-btn>
</v-snackbar>
```

**Colors for notifications**:
- Success: `success`
- Error: `error`
- Warning: `warning`
- Info: `info`

---

### Data Tables

**Component**: `v-data-table`

**Standard props**:

```html
<v-data-table
  :headers="headers"
  :items="items"
  :loading="loading"
  :items-per-page="10"
  :footer-props="{ 'items-per-page-options': [10, 25, 50] }"
>
  <template #item.actions="{ item }">
    <!-- Action buttons -->
  </template>
</v-data-table>
```

---

## Editor Atoms (jQuery UI)

### Buttons

**jQuery UI button**:

```html
<button class="ui-button primaryButton">
  <span class="ui-button-text">Save</span>
</button>
```

**LESS classes** (from `badsender-topbar.less`):
- `.ui-button` - Base button style
- `.primaryButton` - Primary action variant
- `.ui-button-disabled` - Disabled state
- `.pressed` - Active state

---

### Icons

**Font Awesome 4.7**:

```html
<i class="fa fa-cog"></i>
<i class="fa fa-save"></i>
<i class="fa fa-times"></i>
```

---

## Summary: When to Use What

| Context          | Atom Type | Component (Target)                    |
| ---------------- | --------- | ------------------------------------- |
| Vue App - Button | Vuetify   | `<v-btn>`                             |
| Vue App - Input  | Vuetify   | `<v-text-field>`                      |
| Vue App - Icon   | Lucide    | `<Settings :size="24" />`             |
| Editor - Button  | jQuery UI | `<button class="ui-button">` (legacy) |
| Editor - Icon    | Lucide    | Migrate from Font Awesome             |

**Migration note**: Replace `<v-icon>mdi-*</v-icon>` with Lucide components progressively.
