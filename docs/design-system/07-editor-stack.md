# Email Editor UI Stack

The email editor (`packages/editor/`) uses a different technology stack than the Vue app. This document covers editor-specific UI patterns.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Knockout.js** | 3.5.0 | Data binding and MVVM |
| **jQuery** | 3.4.1 | DOM manipulation |
| **jQuery UI** | 1.11.4 | Widgets (sortable, draggable, tabs) |
| **Konva.js** | 8.x | Image editor canvas (layers, transforms) |
| **LESS** | - | Styling |
| **Mosaico** | - | Email template framework |
| **TinyMCE** | 4.5.8 | Rich text editing |
| **@easylogic/colorpicker** | - | Sketch-style color picker |

## File Structure

```
packages/editor/src/
├── css/
│   ├── style_variables.less      # Design tokens
│   ├── style_mosaico.less        # Mosaico overrides
│   ├── badsender-topbar.less     # Top toolbar
│   ├── badsender-editor.less     # Main editor
│   ├── badsender-colorpicker.less
│   └── ...
├── js/
│   └── ext/
│       └── badsender-extensions.js  # Custom extensions
└── tmpl/
    └── main.tmpl.html            # Main template
```

## Design Tokens Integration

The editor uses CSS variables to share the Vuetify theme:

```less
// In badsender-topbar.less
#toolbar {
  background: var(--v-primary-base);

  .ui-button {
    background-color: var(--v-primary-base);
    border-bottom: 3px solid var(--v-accent-base);

    &:hover {
      background-color: var(--v-accent-base);
    }
  }
}
```

### Available CSS Variables

| Variable | Usage |
|----------|-------|
| `--v-primary-base` | Primary color (dark blue) |
| `--v-primary-lighten1` | Lighter primary |
| `--v-primary-lighten2` | Even lighter primary |
| `--v-accent-base` | Accent color (cyan) |
| `--v-error-base` | Error color (red) |

## LESS Variables

Defined in `style_variables.less`:

### Colors

```less
@bs-primary-color: #093040;
@bs-secondary-color: #265090;
@bs-accent-color: #00acdc;
@bs-white-color: #ffffff;
@link-color: #f04e23;
```

### Typography

```less
// Current (to be migrated - see Plan Phase 1)
@font-family: 'trebuchet ms', arial, sans-serif;
@base-font-size: 13.6px;

// Target
@font-family: 'Work Sans', sans-serif;
```

### Sizing

```less
@standard-border-radius: 5px;
@button-border-radius: 5px;
@element-margin-vertical: 1.5em;
```

### Z-Index Scale

```less
@zindex-thead: 1001;
@zindex-popup: 1003;
@zindex-tooltip: 1004;
@zindex-dialog-modal: 1004;
@zindex-dialog: 1005;
```

## UI Components

### Toolbar Buttons

```html
<button class="ui-button">
  <span class="ui-icon fa fa-save"></span>
  <span class="ui-button-text">Save</span>
</button>

<button class="ui-button primaryButton">
  Primary Action
</button>
```

**States**:
- `.pressed` - Active state
- `.ui-button-disabled` - Disabled state
- `.ui-state-active` - Selected state

### jQuery UI Integration

```javascript
// Sortable
$('.sortable-list').sortable({
  handle: '.drag-handle',
  placeholder: 'sort-placeholder',
});

// Draggable
$('.draggable-item').draggable({
  helper: 'clone',
  revert: 'invalid',
});

// Tabs
$('.tabs-container').tabs();
```

### Knockout Bindings

```html
<!-- Text binding -->
<span data-bind="text: blockTitle"></span>

<!-- Value binding -->
<input data-bind="value: propertyValue" />

<!-- Click binding -->
<button data-bind="click: saveBlock">Save</button>

<!-- Visible binding -->
<div data-bind="visible: isEditing">...</div>

<!-- CSS class binding -->
<div data-bind="css: { active: isActive }">...</div>

<!-- Foreach binding -->
<ul data-bind="foreach: items">
  <li data-bind="text: name"></li>
</ul>
```

## Custom Components

### Color Picker

Two implementations exist (see DEBT-007):
- **New**: `badsender-colorpicker.js` + `badsender-colorpicker.less` - Uses @easylogic/colorpicker (Sketch-style)
- **Legacy**: `colorpicker.js` - Uses evol-colorpicker (to be deprecated)

### Image Gallery

`badsender-gallery.js` + `badesender-image-gallery.less` - Image selection modal with:
- Mailing/Template tabs
- Lazy-loading
- blueimp jQuery File Upload integration

### Image Editor

Complex canvas-based editor using Konva.js (see DEBT-009):
- `image-editor.js` - Main canvas with layers, zoom, transformations
- `image-editor-cropper.js` - Crop with aspect ratios (16:9, 4:3, 1:1)
- `image-editor-text.js` - Text overlay with font picker
- `image-editor-filters.js` - 6 filters (grayscale, blur, pixelate, contrast, brighten, invert)

### Image Cropper

`badsender-image-cropper.less` - Croppie integration for upload preview.

### Mobile Preview

`badsender-mobile-preview.less` - Responsive preview toggle.

## Dropdown Menu Pattern

```less
.download-form {
  position: relative;
}

.download-form__menu {
  opacity: 0;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: (@topbar-height);
  box-shadow: 0 1px 10px 0 rgba(0, 0, 0, 0.5);
  transition: opacity 0.5s;
}

.download-form:hover .download-form__menu {
  opacity: 1;
  pointer-events: initial;
}
```

## Development Constraints

When modifying editor UI:

1. **Use LESS variables** - Never hardcode colors
2. **Use CSS variables for theme** - `var(--v-primary-base)` etc.
3. **Follow jQuery UI patterns** - Don't mix with Vue
4. **Use Knockout for data binding** - Not Vue
5. **Font Awesome 4.7 icons** - `fa fa-*` classes
6. **Z-index scale** - Use defined variables

## Integration Points

### Editor ↔ Vue App Communication

The editor communicates with the Vue app through:

1. **URL parameters** - Mailing ID, user context
2. **PostMessage** - For iframe communication
3. **Server API** - For saving/loading

### Shared Services

| Service | Purpose |
|---------|---------|
| Image upload | Shared image handling |
| Preview | Email preview generation |
| Export | ZIP/ESP export |

## Future Considerations

The editor stack is stable and functional. Any major changes should consider:

1. **Gradual migration** - Don't rewrite everything
2. **Preserve Mosaico compatibility** - Core dependency
3. **Test thoroughly** - Complex interactions
4. **Document changes** - Update this file

## Related Files

- `gulpfile.js` - Build process
- `packages/server/image/` - Image handling
- `packages/server/mailing/` - Mailing operations
