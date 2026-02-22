# Design Tokens

Design tokens are the smallest design decisions: colors, fonts, spacing, etc.

## White-Label Support

Tokens are the **only customizable layer** in the design system. For white-label deployments, certain tokens can be stored in the database and override defaults.

### Token Categories

| Category | White-Label | Storage | Scope |
|----------|-------------|---------|-------|
| **Brand Colors** | Customizable | Database | Per group |
| **Logo** | Customizable | Database | Per group |
| **Typography** | Fixed | Code | Global |
| **Semantic Colors** | Fixed | Code | Global |
| **Spacing** | Fixed | Code | Global |
| **Border Radius** | Fixed | Code | Global |
| **Shadows** | Fixed | Code | Global |
| **Z-Index** | Fixed | Code | Global |
| **Icons** | Fixed | Code | Global |

---

## Colors

### Brand Colors (Customizable)

Default LePatron colors (can be overridden per group):

| Token | Default | CSS Variable | Usage |
|-------|---------|--------------|-------|
| **Primary** | `#093040` | `--v-primary-base` | Headers, primary actions |
| **Secondary** | `#265090` | `--v-secondary-base` | Secondary elements |
| **Accent** | `#00ACDC` | `--v-accent-base` | Highlights, links, CTAs |
| **Warning** | `#FFB400` | `--v-warning-base` | Warnings |
| **Error** | `#F04E23` | `--v-error-base` | Errors, destructive actions |

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
@red: #FF5252;
@green: #4caf50;
@yellow: #fb8c00;
@blue: #2196F3;
```

### Semantic Colors (Fixed)

These colors have functional meaning and should NOT be customized:

| Semantic | Color | Vuetify | LESS |
|----------|-------|---------|------|
| Success | Green `#4caf50` | `success` | `@green` |
| Error | Red `#FF5252` | `error` | `@red` |
| Warning | Yellow `#fb8c00` | `warning` | `@yellow` |
| Info | Blue `#2196F3` | `info` | `@blue` |

---

## Logo (Customizable)

The logo can be customized per group:

| Token | Default | Storage |
|-------|---------|---------|
| **Logo SVG/URL** | LePatron logo | Database |
| **Favicon** | LePatron favicon | Database |

**Current location**: Inline SVG in `layouts/default.vue`

**White-label direction**: Move to dynamic component that reads from group settings.

---

## Typography (Fixed)

Typography is **not customizable** in white-label deployments to ensure consistent readability and UX across all instances.

### Current State

| Stack | Font Family | Status |
|-------|-------------|--------|
| **Vue App** | Montserrat | Current |
| **Editor** | Trebuchet MS | Legacy |
| **Website** | Work Sans | Reference |

### Target State

| Property | Value |
|----------|-------|
| **Font Family** | `Work Sans` |
| **Font Weights** | 300, 400, 500, 600, 700 |
| **Source** | Google Fonts |

**Why Work Sans?**
- Already used on lepatron.email website (brand consistency)
- Designed specifically for screen readability
- Modern, clean appearance suited for SaaS applications
- Better letter spacing than Montserrat for UI text

**Target configuration**:

```scss
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap');
$body-font-family: 'Work Sans';
```

### Current Configuration

Vue App (`packages/ui/assets/global-styles/variables.scss`):

```scss
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@100;200;300;400;500;600;700&display=swap');
$body-font-family: 'Montserrat';
```

Editor (`packages/editor/src/css/style_variables.less`):

```less
@font-family: 'trebuchet ms', arial, sans-serif;
@base-font-size: 13.6px;
```

### Debt: Font Inconsistency

Three different fonts are currently used across the platform:
- **Vue App**: Montserrat
- **Editor**: Trebuchet MS
- **Website**: Work Sans

**Direction**: Unify all stacks to **Work Sans** for brand consistency and modern appearance.

---

## Spacing (Fixed)

Spacing tokens are fixed to ensure consistent layouts across all white-label instances.

### Vue App (Vuetify)

Use Vuetify spacing classes based on 4px increments:

| Class | Value |
|-------|-------|
| `pa-0` | 0px |
| `pa-1` | 4px |
| `pa-2` | 8px |
| `pa-3` | 12px |
| `pa-4` | 16px |
| `pa-5` | 20px |
| `pa-6` | 24px |

Prefixes:
- `p` = padding, `m` = margin
- `a` = all, `x` = horizontal, `y` = vertical
- `t` = top, `b` = bottom, `l` = left, `r` = right

**Examples**:
```html
<div class="pa-4">       <!-- padding: 16px all sides -->
<div class="mx-2">       <!-- margin: 8px horizontal -->
<div class="mt-3 mb-2">  <!-- margin-top: 12px, margin-bottom: 8px -->
```

### Editor (LESS)

Defined in `style_variables.less`:

```less
@element-margin-vertical: 1.5em;
@ui-tabs-panel-padding: 4px;
```

---

## Border Radius (Fixed)

| Token | Value | Usage |
|-------|-------|-------|
| `@standard-border-radius` | 5px | Default corners |
| `@button-border-radius` | 5px | Buttons |
| `@large-border-radius` | 7px | Cards, dialogs |
| `@large-balloon-border-radius` | 3em | Round badges |

### Vuetify

Use `rounded` prop on components:

```html
<v-card rounded>          <!-- default radius -->
<v-card rounded="lg">     <!-- larger radius -->
<v-card rounded="0">      <!-- no radius -->
<v-btn rounded>           <!-- pill button -->
```

---

## Shadows (Fixed)

### Vuetify

Use `elevation` prop (0-24):

```html
<v-card elevation="0">    <!-- flat -->
<v-card elevation="2">    <!-- subtle shadow -->
<v-card elevation="4">    <!-- moderate shadow -->
```

### Editor (LESS)

```less
@shadow-color: contrast(@background-color, ...);
box-shadow: 0 1px 10px 0 rgba(0, 0, 0, 0.5);
```

---

## Z-Index Scale (Fixed)

Defined in editor (`style_variables.less`):

| Token | Value | Usage |
|-------|-------|-------|
| `@zindex-thead` | 1001 | Sticky table headers |
| `@zindex-popup` | 1003 | Popups, dropdowns |
| `@zindex-tooltip` | 1004 | Tooltips |
| `@zindex-dialog-modal` | 1004 | Modal overlays |
| `@zindex-dialog` | 1005 | Dialog content |

---

## Icon Systems (Fixed)

Icons are fixed to maintain consistent UX across all instances.

| System | Location | Usage |
|--------|----------|-------|
| **Material Design Icons** | Vue App | `<v-icon>settings</v-icon>` |
| **Font Awesome 4.7** | Editor | `<i class="fa fa-cog"></i>` |

**Direction**: Prefer MDI for new Vue components. FA remains for editor legacy code.

---

## Summary: White-Label Tokens

| Token | Customizable | Default | Target |
|-------|--------------|---------|--------|
| Primary Color | Yes | `#093040` | — |
| Secondary Color | Yes | `#265090` | — |
| Accent Color | Yes | `#00ACDC` | — |
| Logo | Yes | LePatron SVG | — |
| Favicon | Yes | LePatron favicon | — |
| Font Family | No | Montserrat | Work Sans |
| Semantic Colors | No | Fixed | — |
| Spacing | No | Vuetify 4px scale | — |
| Border Radius | No | 5px default | — |
| Shadows | No | Vuetify elevation | — |
| Icons | No | MDI / FA | — |
