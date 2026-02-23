# Design Tokens

> **This document is the SINGLE SOURCE OF TRUTH for all design values.**
> Other documents must reference this file, not duplicate values.

## White-Label Summary

| Token | Customizable | Default | Target |
|-------|--------------|---------|--------|
| Brand colors | Yes | See below | — |
| Logo | Yes | LePatron SVG | — |
| Typography | No | Montserrat | Work Sans |
| Semantic colors | No | Fixed | — |
| Spacing | No | Vuetify 4px | — |

---

## Brand Colors (customizable)

| Token | Default | CSS Variable | Usage |
|-------|---------|--------------|-------|
| **Primary** | `#093040` | `--v-primary-base` | Headers, navigation |
| **Secondary** | `#265090` | `--v-secondary-base` | Secondary elements |
| **Accent** | `#00ACDC` | `--v-accent-base` | Primary actions, links, CTAs |
| **Warning** | `#FFB400` | `--v-warning-base` | Warnings |
| **Error** | `#F04E23` | `--v-error-base` | Errors, destructive actions |

### Vue App Implementation (Vuetify)

```scss
// Vuetify classes
.primary          // Background
.primary--text    // Text color
.accent           // Accent background

// CSS variables
var(--v-primary-base)
var(--v-accent-base)
```

### Editor Implementation (LESS)

```less
// packages/editor/src/css/style_variables.less
@bs-primary-color: #093040;
@bs-secondary-color: #265090;
@bs-accent-color: #00acdc;
```

---

## Semantic Colors (fixed)

| Semantic | Color | Vuetify | LESS |
|----------|-------|---------|------|
| Success | `#4caf50` | `success` | `@green` |
| Error | `#FF5252` | `error` | `@red` |
| Warning | `#fb8c00` | `warning` | `@yellow` |
| Info | `#2196F3` | `info` | `@blue` |

---

## Typography (fixed)

| Stack | Current | Target |
|-------|---------|--------|
| Vue App | Montserrat | **Work Sans** |
| Editor | Trebuchet MS | **Work Sans** |
| Website | Work Sans | Work Sans |

### Target Configuration

```scss
// Vue App - nuxt.config.js + variables.scss
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap');
$body-font-family: 'Work Sans', sans-serif;
```

```less
// Editor - style_variables.less
@font-family: 'Work Sans', sans-serif;
```

---

## Spacing (fixed)

Vuetify uses a 4px-based scale:

| Class | Value |
|-------|-------|
| `pa-1` | 4px |
| `pa-2` | 8px |
| `pa-3` | 12px |
| `pa-4` | 16px |
| `pa-5` | 20px |
| `pa-6` | 24px |

Prefixes: `p`=padding, `m`=margin, `a`=all, `x`=horizontal, `y`=vertical, `t`=top, `b`=bottom, `l`=left, `r`=right

---

## Border Radius (fixed)

| Token | Value | Usage |
|-------|-------|-------|
| `@standard-border-radius` | 5px | Default |
| `@button-border-radius` | 5px | Buttons |
| `@large-border-radius` | 7px | Cards, dialogs |

Vuetify: `rounded`, `rounded="lg"`, `rounded="0"`

---

## Shadows (fixed)

Vuetify: `elevation` prop (0-24)

```html
<v-card elevation="0">  <!-- flat -->
<v-card elevation="2">  <!-- subtle -->
<v-card elevation="4">  <!-- moderate -->
```

---

## Z-Index (fixed)

| Token | Value | Usage |
|-------|-------|-------|
| `@zindex-thead` | 1001 | Sticky table headers |
| `@zindex-popup` | 1003 | Popups, dropdowns |
| `@zindex-tooltip` | 1004 | Tooltips |
| `@zindex-dialog` | 1005 | Dialog content |

---

## Icons (fixed)

| System | Location | Usage |
|--------|----------|-------|
| Material Design Icons | Vue App | `<v-icon>settings</v-icon>` |
| Font Awesome 4.7 | Editor | `<i class="fa fa-cog"></i>` |

---

*Last updated: February 2026*
