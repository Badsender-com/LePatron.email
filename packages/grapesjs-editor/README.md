# GrapesJS Editor Integration

## 📋 Overview

This package contains the GrapesJS editor integration for LePatron.email. It provides a modern, flexible email editor as an alternative to the existing Mosaico/Knockout editor.

## 🎯 POC Phase 1 - Status

**Completed tasks:**

- ✅ Project structure created
- ✅ Dependencies added to package.json
- ✅ Mongoose schema extended with GrapesJS fields
- ✅ Backend API routes created
- ✅ Basic Vue component created
- ✅ Environment variable configuration documented

**Current state:**

This is the **Phase 1** implementation focusing on infrastructure and foundation. The basic structure is in place but needs Node.js 14.16.0 to install dependencies and run.

## 🏗️ Architecture

### Directory Structure

```
packages/grapesjs-editor/
├── client/               # Frontend code
│   ├── components/       # Vue components
│   ├── config/           # GrapesJS configuration
│   ├── blocks/
│   │   ├── standard/     # Standard reusable blocks
│   │   └── custom/       # Custom Badsender blocks
│   └── utils/            # Utility functions
│
└── server/               # Backend code
    ├── routes/           # Express routes
    ├── controllers/      # Route controllers
    ├── services/         # Business logic
    └── config/           # Configuration files
        └── standard-blocks.json  # Standard blocks definition
```

### Database Schema

The `Mailing` schema has been extended with the following fields:

```javascript
{
  editor_type: {
    type: String,
    enum: ['mosaico', 'grapesjs'],
    default: 'mosaico'
  },
  grapesjs_data: {
    components: Array,    // HTML structure
    styles: Array,        // CSS styles
    assets: Array,        // Images/files
    customBlocks: Array,  // Template-specific blocks
    pages: Array          // Multi-page support
  },
  brand: {
    type: String,
    enum: ['badsender', 'sm', 'lepatron']
  }
}
```

## 🔌 API Endpoints

### Blocks

- `GET /api/grapesjs/blocks/standard` - Get standard blocks
- `GET /api/grapesjs/blocks/custom/:templateId` - Get custom blocks for a template

### Templates

- `GET /api/grapesjs/templates/:id` - Load template data
- `POST /api/grapesjs/templates/:id/save` - Save template data
- `POST /api/grapesjs/templates/:id/export` - Export to HTML (TODO)
- `POST /api/grapesjs/templates/:id/preview` - Preview with variables (TODO)

## 🚀 Getting Started

### Prerequisites

- Node.js 14.16.0 (required by the project)
- MongoDB
- Yarn

### Installation

1. Install dependencies:
```bash
yarn install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and set ENABLE_GRAPESJS_EDITOR=true
```

3. Start the development server:
```bash
yarn dev
```

## 📦 Standard Blocks

Currently defined in `server/config/standard-blocks.json`:

1. **textBlock** - Rich text paragraph
2. **titleBlock** - Heading (H2)
3. **imageBlock** - Image with link
4. **buttonBlock** - Call-to-action button
5. **dividerBlock** - Horizontal separator
6. **spacerBlock** - Vertical spacing

## 🎨 Multi-Brand Support

The editor supports three brands via the `brand` field:

- **badsender** - Badsender branding
- **sm** - Sobriété & Marketing
- **lepatron** - Le Patron

Brand-specific styling will be implemented using CSS Variables in Phase 3.

## 📝 Vue Component Usage

```vue
<template>
  <GrapesJSEditor
    :template-id="mailingId"
    :template-name="mailingName"
    :enable-brand-selector="true"
  />
</template>

<script>
import GrapesJSEditor from '~/components/GrapesJSEditor.vue';

export default {
  components: {
    GrapesJSEditor
  },
  data() {
    return {
      mailingId: '507f1f77bcf86cd799439011',
      mailingName: 'Newsletter Janvier 2025'
    }
  }
}
</script>
```

## 🔧 Configuration

### Environment Variables

- `ENABLE_GRAPESJS_EDITOR` - Enable/disable GrapesJS editor (default: false)

### GrapesJS Configuration

Configuration will be located in `client/config/grapesjs-config.js` (to be implemented in Phase 2).

## 📋 Next Steps (Phase 2)

- [ ] Implement the 6 standard blocks completely
- [ ] Add GrapesJS configuration file
- [ ] Integrate block loading in the editor
- [ ] Add drag-and-drop functionality
- [ ] Implement auto-save (every 30 seconds)
- [ ] Add desktop/mobile preview toggle

## 📋 Next Steps (Phase 3)

- [ ] Replicate Badsender template blocks
- [ ] Implement CSS Variables for multi-brand
- [ ] Add HTML export with inline CSS (juice)
- [ ] Implement email variable substitution
- [ ] Add brand selector functionality

## 🧪 Testing

To test the current implementation:

1. Create a new mailing with `editor_type: 'grapesjs'` via MongoDB or API
2. Access the GrapesJS editor component
3. Test API endpoints using curl or Postman

Example API test:
```bash
# Get standard blocks
curl http://localhost:3000/api/grapesjs/blocks/standard

# Load a template
curl http://localhost:3000/api/grapesjs/templates/YOUR_TEMPLATE_ID
```

## 📚 Resources

- [GrapesJS Documentation](https://grapesjs.com/docs/)
- [GrapesJS Newsletter Preset](https://github.com/artf/grapesjs-preset-newsletter)
- [Email HTML Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)

## ⚠️ Known Limitations

- **Phase 1 only**: This is infrastructure setup, not a fully functional editor yet
- **No UI integration**: The component needs to be integrated into the mailing creation/edit flow
- **Export not implemented**: HTML export will be added in Phase 3
- **No custom blocks yet**: Custom Badsender blocks will be added in Phase 3

## 🤝 Contributing

This is a POC. For questions or contributions, please refer to the main project documentation.

## 📄 License

Same as LePatron.email main project (GPL-3.0)
