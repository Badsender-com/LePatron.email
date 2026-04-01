# Design Tokens

Design tokens are the smallest design decisions: colors, fonts, spacing, etc.

## White-Label Support

Tokens are the **only customizable layer** in the design system. For white-label deployments, certain tokens can be stored in the database and override defaults.

### Token Categories

| Category            | White-Label  | Storage  | Scope     |
| ------------------- | ------------ | -------- | --------- |
| **Brand Colors**    | Customizable | Database | Per group |
| **Logo**            | Customizable | Database | Per group |
| **Typography**      | Fixed        | Code     | Global    |
| **Semantic Colors** | Fixed        | Code     | Global    |
| **Spacing**         | Fixed        | Code     | Global    |
| **Border Radius**   | Fixed        | Code     | Global    |
| **Shadows**         | Fixed        | Code     | Global    |
| **Z-Index**         | Fixed        | Code     | Global    |
| **Icons**           | Fixed        | Code     | Global    |

---

## Colors

### Brand Colors (Customizable)

Default LePatron colors (can be overridden per group):

| Token         | Default   | CSS Variable         | Usage                       |
| ------------- | --------- | -------------------- | --------------------------- |
| **Primary**   | `#093040` | `--v-primary-base`   | Headers, primary actions    |
| **Secondary** | `#265090` | `--v-secondary-base` | Secondary elements          |
| **Accent**    | `#00ACDC` | `--v-accent-base`    | Highlights, links, CTAs     |
| **Warning**   | `#FFB400` | `--v-warning-base`   | Warnings                    |
| **Error**     | `#F04E23` | `--v-error-base`     | Errors, destructive actions |

**White-label implementation**:

```javascript
// Group schema (future)
{
  branding: {
    primaryColor: '#093040',    // Overrides --v-primary-base
    secondaryColor: '#265090',  // Overrides --v-secondary-base
    accentColor: '#00ACDC',     // Overrides --v-accent-base
  }
}
```

### Vue App (Vuetify Theme)

Access via Vuetify classes or CSS variables:

```scss
// Vuetify classes
.primary          // Background
.primary--text    // Text color
.accent           // Accent background
.error            // Error state

// CSS variables (available in LESS too)
var(--v-primary-base)
var(--v-primary-lighten1)
var(--v-primary-lighten2)
var(--v-accent-base)
var(--v-error-base)
```

### Editor (LESS Variables)

Defined in `packages/editor/src/css/style_variables.less`:

```less
@bs-primary-color: #093040;
@bs-secondary-color: #265090;
@bs-accent-color: #00acdc;
@bs-white-color: #ffffff;

@link-color: #f04e23;
@red: #ff5252;
@green: #4caf50;
@yellow: #fb8c00;
@blue: #2196f3;
```

### Semantic Colors (Fixed)

These colors have functional meaning and should NOT be customized:

| Semantic | Color            | Vuetify   | LESS      |
| -------- | ---------------- | --------- | --------- |
| Success  | Green `#4caf50`  | `success` | `@green`  |
| Error    | Red `#FF5252`    | `error`   | `@red`    |
| Warning  | Yellow `#fb8c00` | `warning` | `@yellow` |
| Info     | Blue `#2196F3`   | `info`    | `@blue`   |

---

## Logo (Customizable)

The logo can be customized per group:

| Token            | Default          | Storage  |
| ---------------- | ---------------- | -------- |
| **Logo SVG/URL** | LePatron logo    | Database |
| **Favicon**      | LePatron favicon | Database |

**Current location**: Inline SVG in `layouts/default.vue`

**White-label direction**: Move to dynamic component that reads from group settings.

---

## Typography (Fixed)

Typography is **not customizable** in white-label deployments to ensure consistent readability and UX across all instances.

### Target State

| Property         | Value                   |
| ---------------- | ----------------------- |
| **Font Family**  | `Inter`                 |
| **Font Weights** | 300, 400, 500, 600, 700 |
| **Source**       | Google Fonts            |

**Why Inter?**

- Modern, highly legible sans-serif designed specifically for screens
- Excellent support for UI text at all sizes
- Variable font support for optimal performance
- Wide character set and language support
- Industry standard for SaaS applications (used by GitHub, Figma, Linear, etc.)

**Target configuration**:

```scss
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
$body-font-family: 'Inter', sans-serif;
```

### Current State (Legacy)

| Stack       | Font Family  | Status    | Target  |
| ----------- | ------------ | --------- | ------- |
| **Vue App** | Montserrat   | Current   | Inter   |
| **Editor**  | Trebuchet MS | Legacy    | Inter   |
| **Website** | Work Sans    | Current   | Inter   |

Vue App (`packages/ui/assets/global-styles/variables.scss`):

```scss
// Current (to be migrated)
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@100;200;300;400;500;600;700&display=swap');
$body-font-family: 'Montserrat';
```

Editor (`packages/editor/src/css/style_variables.less`):

```less
// Current (to be migrated)
@font-family: 'trebuchet ms', arial, sans-serif;
@base-font-size: 13.6px;
```

### Debt: Font Inconsistency

Three different fonts are currently used across the platform:

- **Vue App**: Montserrat
- **Editor**: Trebuchet MS
- **Website**: Work Sans

**Direction**: Unify all stacks to **Inter** for modern appearance and optimal screen readability.

---

## Spacing (Fixed)

Spacing tokens are fixed to ensure consistent layouts across all white-label instances.

### Vue App (Vuetify)

Use Vuetify spacing classes based on 4px increments:

| Class  | Value |
| ------ | ----- |
| `pa-0` | 0px   |
| `pa-1` | 4px   |
| `pa-2` | 8px   |
| `pa-3` | 12px  |
| `pa-4` | 16px  |
| `pa-5` | 20px  |
| `pa-6` | 24px  |

Prefixes:

- `p` = padding, `m` = margin
- `a` = all, `x` = horizontal, `y` = vertical
- `t` = top, `b` = bottom, `l` = left, `r` = right

**Examples**:

```html
<div class="pa-4">
  <!-- padding: 16px all sides -->
  <div class="mx-2">
    <!-- margin: 8px horizontal -->
    <div class="mt-3 mb-2"><!-- margin-top: 12px, margin-bottom: 8px --></div>
  </div>
</div>
```

### Editor (LESS)

Defined in `style_variables.less`:

```less
@element-margin-vertical: 1.5em;
@ui-tabs-panel-padding: 4px;
```

---

## Border Radius (Fixed)

| Token                          | Value | Usage           |
| ------------------------------ | ----- | --------------- |
| `@standard-border-radius`      | 5px   | Default corners |
| `@button-border-radius`        | 5px   | Buttons         |
| `@large-border-radius`         | 7px   | Cards, dialogs  |
| `@large-balloon-border-radius` | 3em   | Round badges    |

### Vuetify

Use `rounded` prop on components:

```html
<v-card rounded>
  <!-- default radius -->
  <v-card rounded="lg">
    <!-- larger radius -->
    <v-card rounded="0">
      <!-- no radius -->
      <v-btn rounded> <!-- pill button --></v-btn></v-card
    ></v-card
  ></v-card
>
```

---

## Shadows (Fixed)

### Vuetify

Use `elevation` prop (0-24):

```html
<v-card elevation="0">
  <!-- flat -->
  <v-card elevation="2">
    <!-- subtle shadow -->
    <v-card elevation="4"> <!-- moderate shadow --></v-card></v-card
  ></v-card
>
```

### Editor (LESS)

```less
@shadow-color: contrast(@background-color, ...);
box-shadow: 0 1px 10px 0 rgba(0, 0, 0, 0.5);
```

---

## Z-Index Scale (Fixed)

Defined in editor (`style_variables.less`):

| Token                  | Value | Usage                |
| ---------------------- | ----- | -------------------- |
| `@zindex-thead`        | 1001  | Sticky table headers |
| `@zindex-popup`        | 1003  | Popups, dropdowns    |
| `@zindex-tooltip`      | 1004  | Tooltips             |
| `@zindex-dialog-modal` | 1004  | Modal overlays       |
| `@zindex-dialog`       | 1005  | Dialog content       |

---

## Icon Systems (Fixed)

Icons are fixed to maintain consistent UX across all instances.

### Target State

| System     | Location | Usage                                      |
| ---------- | -------- | ------------------------------------------ |
| **Lucide** | Vue App  | `<lucide-icon name="settings" />`          |
| **Lucide** | Editor   | `<lucide-icon name="settings" />` or SVG   |

**Why Lucide?**

- Modern, consistent icon set with 1500+ icons
- Lightweight SVG-based (tree-shakeable)
- Active community and regular updates
- Clean, minimal design that fits modern UIs
- MIT licensed
- Used by Shadcn/UI, Tailwind UI, and many modern frameworks

**Reference**: https://lucide.dev/icons

**Installation**:

```bash
yarn add lucide-vue  # For Vue 2
# or
yarn add lucide-vue-next  # For Vue 3
```

**Usage in Vue**:

```vue
<script>
import { Settings, User, Mail, Trash2, Edit, Plus, X } from 'lucide-vue';

export default {
  components: { Settings, User, Mail, Trash2, Edit, Plus, X }
}
</script>

<template>
  <Settings :size="24" />
  <User :size="20" color="currentColor" />
</template>
```

**Common icons mapping (MDI → Lucide)**:

| Purpose        | MDI (legacy)           | Lucide (target)    |
| -------------- | ---------------------- | ------------------ |
| Settings       | `mdi-cog`              | `Settings`         |
| User           | `mdi-account`          | `User`             |
| Email          | `mdi-email`            | `Mail`             |
| Delete         | `mdi-delete`           | `Trash2`           |
| Edit           | `mdi-pencil`           | `Edit` or `Pencil` |
| Add            | `mdi-plus`             | `Plus`             |
| Close          | `mdi-close`            | `X`                |
| Help           | `mdi-help-circle`      | `HelpCircle`       |
| Logout         | `mdi-logout`           | `LogOut`           |
| Dashboard      | `mdi-view-dashboard`   | `LayoutDashboard`  |
| Chart          | `mdi-chart-line`       | `LineChart`        |
| Palette        | `mdi-palette`          | `Palette`          |
| Arrow Up       | `mdi-arrow-up`         | `ArrowUp`          |
| Arrow Down     | `mdi-arrow-down`       | `ArrowDown`        |
| Check          | `mdi-check`            | `Check`            |
| Alert          | `mdi-alert`            | `AlertTriangle`    |
| Info           | `mdi-information`      | `Info`             |
| Search         | `mdi-magnify`          | `Search`           |
| Menu           | `mdi-menu`             | `Menu`             |
| More (dots)    | `mdi-dots-vertical`    | `MoreVertical`     |
| External link  | `mdi-open-in-new`      | `ExternalLink`     |
| Save           | `mdi-content-save`     | `Save`             |
| Folder         | `mdi-folder`           | `Folder`           |
| File           | `mdi-file`             | `File`             |
| Copy           | `mdi-content-copy`     | `Copy`             |
| Download       | `mdi-download`         | `Download`         |
| Upload         | `mdi-upload`           | `Upload`           |
| Refresh        | `mdi-refresh`          | `RefreshCw`        |
| Eye            | `mdi-eye`              | `Eye`              |
| Eye Off        | `mdi-eye-off`          | `EyeOff`           |

### Current State (Legacy)

| System                    | Location | Status  |
| ------------------------- | -------- | ------- |
| **Material Design Icons** | Vue App  | Current |
| **Font Awesome 4.7**      | Editor   | Legacy  |

**Direction**: Migrate all icon usage to **Lucide** for modern appearance and consistency.

---

## Summary: White-Label Tokens

| Token           | Customizable | Default           | Target    |
| --------------- | ------------ | ----------------- | --------- |
| Primary Color   | Yes          | `#093040`         | —         |
| Secondary Color | Yes          | `#265090`         | —         |
| Accent Color    | Yes          | `#00ACDC`         | —         |
| Logo            | Yes          | LePatron SVG      | —         |
| Favicon         | Yes          | LePatron favicon  | —         |
| Font Family     | No           | Montserrat        | Inter     |
| Semantic Colors | No           | Fixed             | —         |
| Spacing         | No           | Vuetify 4px scale | —         |
| Border Radius   | No           | 5px default       | —         |
| Shadows         | No           | Vuetify elevation | —         |
| Icons           | No           | MDI / FA          | Lucide    |
