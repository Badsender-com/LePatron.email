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

## Neutral Grays (fixed)

| Token | Value | CSS Variable | Usage |
|-------|-------|--------------|-------|
| Gray 50 | `#fafafa` | `--gray-50` | Subtle backgrounds |
| Gray 100 | `#f5f5f5` | `--gray-100` | Hover backgrounds |
| Gray 200 | `#eeeeee` | `--gray-200` | Light borders |
| Gray 300 | `#e0e0e0` | `--gray-300` | Input borders |
| Gray 400 | `#bdbdbd` | `--gray-400` | Disabled text |
| Gray 500 | `#9e9e9e` | `--gray-500` | Placeholder text |
| Gray 600 | `#757575` | `--gray-600` | Secondary text |
| Gray 700 | `#616161` | `--gray-700` | — |
| Gray 800 | `#424242` | `--gray-800` | Primary text |
| Gray 900 | `#212121` | `--gray-900` | Headings |

> Based on Material Design gray palette.

---

## Typography

| Stack | Current | Target |
|-------|---------|--------|
| Vue App | Montserrat | **Work Sans** |
| Editor | Trebuchet MS | **Work Sans** |
| Website | Work Sans | Work Sans |

> **Progressive migration**: When modifying UI code, ensure Work Sans is applied.

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
| `@standard-border-radius` | 4px | Default, inputs, buttons |
| `@large-border-radius` | 8px | Cards, dialogs, panels |
| `@pill-border-radius` | 9999px | Pills, chips, badges |

Vuetify: `rounded`, `rounded="lg"`, `rounded="0"`, `rounded="pill"`

---

## Buttons (fixed)

| Property | Value |
|----------|-------|
| Border radius | `4px` |
| Text transform | `uppercase` |
| Letter spacing | `0.025em` |
| Font weight | `500` |
| Padding | `0.625rem 1.25rem` (10px 20px) |

### Variants

| Variant | Background | Text |
|---------|------------|------|
| Primary (accent) | `--accent` | white |
| Secondary | `--primary` | white |
| Text | transparent | `--primary` |
| Outlined | transparent | `--accent` |
| Destructive | `--error` | white |

> **Convention**: Primary actions always use `accent` color, not `primary`.

---

## Form Fields (fixed)

| Property | Default | Focus | Error |
|----------|---------|-------|-------|
| Border | `1px solid --gray-300` | `1px solid --accent` | `1px solid --error` |
| Border radius | `4px` | — | — |
| Padding | `0.75rem` (12px) | — | — |
| Background | `white` | — | — |

### Focus State

```css
border-color: var(--accent);
/* Optional: subtle shadow for emphasis */
box-shadow: 0 0 0 2px rgba(0, 172, 220, 0.1);
```

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

## Icons

| Location | Current | Target | Usage |
|----------|---------|--------|-------|
| Vue App | MDI | MDI | `<v-icon>mdi-cog</v-icon>` |
| Editor | Font Awesome 4.7 | **MDI** | `<i class="fa fa-cog"></i>` → `<span class="mdi mdi-cog"></span>` |

> **Progressive migration**: When modifying Editor code, replace FA icons with MDI equivalents.
> See [materialdesignicons.com](https://materialdesignicons.com/) for icon reference.

---

*Last updated: February 2026 (v1.1 - added grays, buttons, form fields)*
