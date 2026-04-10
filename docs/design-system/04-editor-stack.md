# Editor Stack

Technical documentation for the email editor (`packages/editor/`).

> **Tokens**: See [01-tokens.md](./01-tokens.md) for colors and typography.

## Technology Stack

| Technology             | Version | Usage                               |
| ---------------------- | ------- | ----------------------------------- |
| Knockout.js            | 3.5.0   | Data binding, MVVM                  |
| jQuery                 | 3.4.1   | DOM manipulation                    |
| jQuery UI              | 1.11.4  | Widgets (sortable, draggable, tabs) |
| Konva.js               | 8.x     | Image editor canvas                 |
| TinyMCE                | 4.5.8   | Rich text editing                   |
| @easylogic/colorpicker | -       | Color picker (new)                  |
| LESS                   | -       | Styling                             |
| Mosaico                | -       | Email template framework            |

## File Structure

```
packages/editor/src/
├── css/
│   ├── style_variables.less      # Tokens (references 01-tokens.md)
│   ├── style_mosaico.less        # Mosaico overrides
│   ├── badsender-topbar.less     # Toolbar
│   ├── badsender-editor.less     # Main editor
│   └── badsender-colorpicker.less
├── js/
│   ├── ext/
│   │   └── badsender-extensions.js
│   └── bindings/
│       ├── image-editor.js       # Konva.js canvas
│       ├── image-editor-cropper.js
│       ├── badsender-colorpicker.js
│       └── ...
└── tmpl/
    └── main.tmpl.html
```

## CSS Variables Integration

The editor uses Vuetify CSS variables for theming:

```less
#toolbar {
  background: var(--v-primary-base);

  .ui-button:hover {
    background-color: var(--v-accent-base);
  }
}
```

Available variables: `--v-primary-base`, `--v-accent-base`, `--v-error-base`

## Special Components

### Image Editor

Konva.js canvas with:

- `image-editor.js`: Layers, zoom, transformations
- `image-editor-cropper.js`: Crop (16:9, 4:3, 1:1)
- `image-editor-text.js`: Text overlay
- `image-editor-filters.js`: 6 filters (grayscale, blur, etc.)

### Color Picker

Two implementations (see DEBT-007):

- **New**: `badsender-colorpicker.js` (@easylogic/colorpicker)
- **Legacy**: `colorpicker.js` (evol-colorpicker, to deprecate)

### Image Gallery

`badsender-gallery.js`: Image selection with Mailing/Template tabs, lazy-loading.

## Editor ↔ Vue App Communication

| Method      | Usage                    |
| ----------- | ------------------------ |
| URL params  | Mailing ID, user context |
| PostMessage | Iframe communication     |
| Server API  | Save, load               |

## Development Constraints

1. Use LESS variables from `style_variables.less`
2. Use CSS variables for theming (`var(--v-primary-base)`)
3. Use jQuery UI for interactive widgets
4. Use Knockout for data binding
5. Icons: Font Awesome 4.7 (current) → **Lucide** (target, see [01-tokens.md](./01-tokens.md#icons))

## Progressive Migration

When modifying existing Editor code, apply these migrations:

| Aspect     | Current      | Target        | Action                                        |
| ---------- | ------------ | ------------- | --------------------------------------------- |
| Icons      | `fa fa-*`    | Lucide        | Replace FA classes with Lucide SVG components |
| Colors     | Hardcoded    | CSS variables | Use `var(--v-*)`                              |
| Typography | Trebuchet MS | Inter         | Update font-family                            |

**Example - Icon migration:**

```html
<!-- Before (Font Awesome) -->
<i class="fa fa-save"></i>

<!-- After (Lucide - in Vue context) -->
<Save :size="16" />

<!-- After (Lucide - in Editor/Knockout context, use inline SVG) -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path
    d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
  />
  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
  <path d="M7 3v4a1 1 0 0 0 1 1h7" />
</svg>
```

> **Note**: For the Editor (Knockout/jQuery), use inline SVGs copied from [lucide.dev](https://lucide.dev). For Vue, use `lucide-vue` components.

---

_Last updated: February 2026_
