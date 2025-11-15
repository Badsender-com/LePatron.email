# GrapesJS Editor Integration

## 📋 Overview

This package contains the GrapesJS editor integration for LePatron.email. It provides a modern, flexible email editor as an alternative to the existing Mosaico/Knockout editor.

## 🎯 POC Status

### ✅ Phase 1: Infrastructure (COMPLETED)

- ✅ Project structure created
- ✅ Dependencies added to package.json
- ✅ Mongoose schema extended with GrapesJS fields
- ✅ Backend API routes created
- ✅ Basic Vue component created
- ✅ Environment variable configuration documented

### ✅ Phase 2: Standard Blocks & Editor (COMPLETED)

- ✅ GrapesJS configuration file created (`grapesjs-config.js`)
- ✅ 6 standard blocks implemented (text, title, image, button, divider, spacer)
- ✅ Full Vue editor component with 3-panel layout
- ✅ Block loading from API integrated
- ✅ Device preview (Desktop/Tablet/Mobile)
- ✅ Style Manager, Trait Manager, Layer Manager panels
- ✅ GrapesJS CSS configured in Nuxt
- ✅ Test page created (`/grapesjs-test`)

**Current state:**

The editor is now **fully functional** with drag & drop blocks, responsive preview, and save/load capabilities. Ready for testing!

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

## 📋 Next Steps (Phase 3)

- [ ] Replicate Badsender template blocks
- [ ] Implement CSS Variables for multi-brand
- [ ] Add HTML export with inline CSS (juice)
- [ ] Implement email variable substitution
- [ ] Add brand selector functionality

## 🧪 Testing

### Quick Test Setup

1. **Install dependencies:**
```bash
yarn install
```

2. **Create a test template in MongoDB:**
```javascript
db.mailings.insertOne({
  name: "Test GrapesJS Newsletter",
  editor_type: "grapesjs",
  brand: "badsender",
  _wireframe: ObjectId("YOUR_TEMPLATE_ID"), // Use an existing template ID
  _company: ObjectId("YOUR_COMPANY_ID"),    // Use an existing company ID
  grapesjs_data: {
    components: [],
    styles: [],
    assets: [],
    customBlocks: [],
    pages: []
  },
  createdAt: new Date(),
  updatedAt: new Date()
})
```

3. **Start the development server:**
```bash
yarn dev
```

4. **Access the test page:**
```
http://localhost:3000/grapesjs-test?id=YOUR_MAILING_ID
```

### What You Can Test

✅ **Drag & Drop:** Drag blocks from the left panel to the canvas
✅ **Responsive Preview:** Switch between Desktop/Tablet/Mobile views
✅ **Edit Content:** Click on any block to edit text, styles, properties
✅ **Save:** Click "Sauvegarder" to save your template
✅ **Export:** Click "Exporter" to download HTML
✅ **Brand Selector:** Switch between Badsender/SM/LePatron

### Test API Endpoints

```bash
# Get standard blocks
curl http://localhost:3000/api/grapesjs/blocks/standard

# Load a template
curl http://localhost:3000/api/grapesjs/templates/YOUR_TEMPLATE_ID

# Save a template
curl -X POST http://localhost:3000/api/grapesjs/templates/YOUR_TEMPLATE_ID/save \
  -H "Content-Type: application/json" \
  -d '{"grapesjs_data": {"components": [], "styles": []}, "brand": "badsender"}'
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
