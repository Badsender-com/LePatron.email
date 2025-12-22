# LePatron Template Developer Guide

> **Comprehensive documentation for creating custom Mosaico email templates**
>
> This guide covers all features available in the LePatron/Mosaico template system, obtained through reverse engineering of the codebase.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [Template Structure](#template-structure)
4. [Block Definitions](#block-definitions)
5. [Editable Zones](#editable-zones)
6. [Variables and Bindings](#variables-and-bindings)
7. [Conditional Content](#conditional-content)
8. [Image Handling](#image-handling)
9. [Advanced Features](#advanced-features)
10. [AI Translation Protection](#ai-translation-protection)
11. [Complete Attribute Reference](#complete-attribute-reference)
12. [Available Block Types](#available-block-types)
13. [Best Practices](#best-practices)
14. [Undocumented Features](#undocumented-features)

---

## Quick Start

A minimal Mosaico template has three key elements:

```html
<!DOCTYPE html>
<html>
<head>
  <style type="text/css">
    @supports -ko-blockdefs {
      /* Block definitions go here */
      text { label: Text; widget: text; }
      textBlock { label: Text Block; properties: text; }
    }
  </style>
</head>
<body>
  <div data-ko-container="main">
    <div data-ko-block="textBlock">
      <div data-ko-editable="text">Default text</div>
    </div>
  </div>
</body>
</html>
```

---

## Core Concepts

### How Templates Work

1. **Templates define structure:** The HTML template defines the visual structure and available blocks
2. **Data is separate:** Content is stored as JSON, not in HTML
3. **Three rendering modes:**
   - `show` - Preview mode
   - `wysiwyg` - Editing mode with live preview
   - `preview` - Final rendered HTML for export

### Key Terminology

| Term | Definition |
|------|------------|
| **Block** | A draggable, reusable content unit (e.g., text block, image block) |
| **Container** | The main drag-and-drop zone where blocks can be placed |
| **Editable** | A field within a block that users can modify |
| **Widget** | The UI control type (text, color picker, dropdown, etc.) |
| **Mosaico-class** | Block and property definitions in `@supports -ko-blockdefs` |
| **Binding** | Dynamic connection between data and visual properties |

---

## Template Structure

### Basic HTML Structure

```html
<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width">
  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->

  <title>Email Template</title>

  <!-- Mosaico block definitions -->
  <style type="text/css">
    @supports -ko-blockdefs {
      /* Block definitions */
    }
  </style>

  <!-- Regular CSS styles -->
  <style type="text/css">
    /* Email client styles */
  </style>
</head>
<body>
  <!-- Main container for drag-and-drop -->
  <div data-ko-container="main">
    <!-- Blocks go here -->
  </div>
</body>
</html>
```

### Core HTML Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-ko-container="main"` | Marks the drag-and-drop zone | `<div data-ko-container="main">` |
| `data-ko-block="blockName"` | Defines a draggable block | `<div data-ko-block="textBlock">` |
| `data-ko-editable="fieldName"` | Marks content as editable | `<span data-ko-editable="title">` |
| `data-ko-display="condition"` | Conditional visibility | `<div data-ko-display="imageVisible">` |
| `data-ko-link="urlField"` | Link binding | `<a data-ko-link="buttonUrl">` |
| `data-ko-wrap="false"` | Disable container wrapping | `<div data-ko-wrap="false">` |
| `data-ko-remove` | Remove element during parsing | `<div data-ko-remove>` |
| `data-ko-properties="p1 p2"` | Declare block properties | Used for complex blocks |

---

## Block Definitions

### The @supports -ko-blockdefs Block

All block and property definitions must be inside this special CSS rule:

```html
<style type="text/css">
  @supports -ko-blockdefs {
    /* All definitions go here */
  }
</style>
```

### Widget Types

| Widget | Purpose | Options |
|--------|---------|---------|
| `text` | Multi-line rich text editor | None |
| `color` | Color picker | None |
| `url` | URL/link input | None |
| `src` | Image source picker (with upload) | None |
| `select` | Dropdown selector | `options: value1\|value2\|value3` |
| `boolean` | True/false toggle | None |
| `integer` | Numeric input | `min: X; max: Y;` |
| `id` | Internal identifier | None |

### Simple Property Definition

```css
@supports -ko-blockdefs {
  /* Color picker */
  backgroundColor {
    label: Background Color;
    widget: color;
  }

  /* Text input */
  titleText {
    label: Title;
    widget: text;
  }

  /* Dropdown selector */
  alignment {
    label: Text Alignment;
    widget: select;
    options: left|center|right;
  }

  /* Number input with constraints */
  fontSize {
    label: Font Size;
    widget: integer;
    min: 8;
    max: 72;
  }

  /* Boolean toggle */
  imageVisible {
    label: Show Image;
    widget: boolean;
  }
}
```

### Composite Property Definition

Group multiple properties together:

```css
@supports -ko-blockdefs {
  /* Define individual properties */
  face { label: Font Family; widget: select; options: Arial|Georgia|Courier; }
  color { label: Text Color; widget: color; }
  size { label: Font Size; widget: integer; min: 8; max: 72; }
  align { label: Alignment; widget: select; options: left|center|right; }

  /* Composite text style */
  textStyle {
    label: Text Style;
    properties: face color size align;
  }

  /* Image with properties */
  image {
    label: Image;
    properties: src url alt;
  }
}
```

### Block Definition

```css
@supports -ko-blockdefs {
  /* Simple text block */
  textBlock {
    label: Text Block;
    properties: backgroundColor textStyle text;
  }

  /* Block with default values */
  buttonBlock {
    label: Button Block;
    properties: buttonVisible=true buttonColor buttonText buttonUrl;
  }

  /* Block with theme */
  headerBlock {
    label: Header Block;
    properties: backgroundColor logo text;
    theme: frameTheme;
  }

  /* Block with variants */
  imageBlock {
    label: Image Block;
    properties: image gutterVisible=false;
    variant: gutterVisible;
  }
}
```

### Definition Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `label` | Display name in UI | `label: Text Block` |
| `widget` | Input control type | `widget: color` |
| `options` | Dropdown values (pipe-separated) | `options: left\|center\|right` |
| `extend` | Inherit from another definition | `extend: textStyle` |
| `properties` | Nested properties | `properties: face color size` |
| `properties: []` | Array property (repeatable) | `properties: items[]` |
| `variant` | Property for variant selection | `variant: imagePos` |
| `theme` | Apply theme styling | `theme: contentTheme` |
| `category` | Organization category | `category: hidden` |
| `min` / `max` | Numeric constraints | `min: 4; max: 90;` |
| `help` | Tooltip help text | `help: Not supported in Outlook` |

### Extended Properties

Inherit and customize existing definitions:

```css
@supports -ko-blockdefs {
  color { label: Color; widget: color; }

  /* Extend with custom label */
  backgroundColor { label: Background Color; extend: color; }
  linkColor { label: Link Color; extend: color; }

  /* Extend text style */
  textStyle { label: Text; properties: face color size align; }
  titleStyle { label: Title Style; extend: textStyle; }
}
```

### Preview Styling

Define how properties appear in the UI:

```css
@supports -ko-blockdefs {
  textStyle {
    label: Text Style;
    properties: face color size;
  }

  /* Show preview with actual font settings */
  textStyle:preview {
    -ko-bind-text: @['AaZz'];
    -ko-font-family: @face;
    -ko-color: @color;
    -ko-font-size: @[size]px;
  }
}
```

---

## Editable Zones

### Basic Editable Content

```html
<!-- Single-line text (simple toolbar) -->
<h1 data-ko-editable="headerText">Default Header</h1>
<span data-ko-editable="titleText">Title</span>

<!-- Multi-line text (full WYSIWYG toolbar) -->
<div data-ko-editable="bodyText">
  <p>Default paragraph text</p>
</div>

<td data-ko-editable="longText">
  <p>Cell content with formatting</p>
</td>
```

### Editor Type Auto-Detection

| Element | Editor Type | Toolbar |
|---------|------------|---------|
| `<DIV>` | Multi-line WYSIWYG | Full (bold, italic, lists, links, etc.) |
| `<TD>` | Multi-line WYSIWYG | Full |
| `<SPAN>` | Single-line | Simple (basic formatting) |
| `<H1>`, `<H2>`, etc. | Single-line | Simple |
| Other inline elements | Single-line | Simple |

### Editable with Style Bindings

```html
<div data-ko-editable="longText"
     class="long-text"
     style="
       font-family: Arial, sans-serif;
       -ko-font-family: @textStyle.face;
       color: #3f3f3f;
       -ko-color: @textStyle.color;
       font-size: 13px;
       -ko-font-size: @[textStyle.size]px;
       line-height: 1.5;
       -ko-line-height: @textStyle.lineHeight;">
  <p>Default content</p>
</div>
```

### Magic Auto-Prefix System

The system automatically looks up widget definitions:

```css
@supports -ko-blockdefs {
  text { label: Text; widget: text; }
}
```

```html
<!-- These all use the same "text" widget definition -->
<div data-ko-editable="text">Text 1</div>
<div data-ko-editable="headerText">Text 2</div>
<div data-ko-editable="bodyText">Text 3</div>
```

The system strips the camelCase prefix (`header`, `body`) and falls back to `text`.

---

## Variables and Bindings

### Variable Syntax

Variables are referenced with `@` prefix:

```html
<!-- Simple variable -->
-ko-background-color: @backgroundColor

<!-- Nested property -->
-ko-color: @textStyle.color
-ko-font-family: @textStyle.face

<!-- Array index -->
-ko-bind-text: @items[0].title

<!-- Root/theme references -->
-ko-background-color: @_theme_.frameTheme.backgroundColor
-ko-attr-width: @_root_.bodyWidth
```

### JavaScript Expressions

Use `@[...]` for expressions:

```html
<!-- Calculations -->
-ko-font-size: @[fontSize]px
-ko-width: @[imageWidth + 20]px
-ko-attr-width: @[Math.floor(width / 3)]

<!-- String concatenation -->
-ko-bind-text: @['Hello ' + userName]

<!-- Conditional expressions -->
-ko-width: @[showGutter ? '90%' : '100%']

<!-- Complex calc() -->
-ko-width: @['calc(' + (Math.floor(_root_.bodyWidth / 3) * 100 / 552) + '%)']
```

### CSS Property Bindings

Prefix CSS properties with `-ko-` to make them dynamic:

```html
<div style="
  background-color: #ffffff;
  -ko-background-color: @backgroundColor;

  color: #333333;
  -ko-color: @textStyle.color;

  font-size: 14px;
  -ko-font-size: @[textStyle.size]px;

  font-family: Arial, sans-serif;
  -ko-font-family: @textStyle.face;

  text-align: left;
  -ko-text-align: @textStyle.align;

  padding: 10px;
  -ko-padding: @[gutterWidth]px;

  border-radius: 4px;
  -ko-border-radius: @[buttonRadius]px;

  line-height: 1.5;
  -ko-line-height: @lineHeight;">
  Content
</div>
```

### HTML Attribute Bindings

Use `-ko-attr-` prefix for HTML attributes:

```html
<img
  src="placeholder.jpg"
  -ko-attr-src: @image.src

  alt="Default alt text"
  -ko-attr-alt: @image.alt

  width="600"
  -ko-attr-width: @[imageWidth]

  height="400"
  -ko-attr-height: @[imageHeight]>

<a
  href="https://example.com"
  -ko-attr-href: @linkUrl

  title="Link title"
  -ko-attr-title: @linkTitle>
  Click here
</a>

<td
  bgcolor="#ffffff"
  -ko-attr-bgcolor: @backgroundColor>
  Content
</td>
```

### Text Content Binding

```html
<!-- Bind text content -->
<span style="-ko-bind-text: @titleText">Default title</span>

<!-- With expression -->
<span style="-ko-bind-text: @[userName + ' - ' + userTitle]">Name</span>
```

### Link Binding

```html
<!-- Simple link -->
<a href="#" data-ko-link="buttonUrl">Click me</a>

<!-- Link with nested property -->
<a href="#" data-ko-link="button.url">
  <span data-ko-editable="button.text">Button Text</span>
</a>

<!-- Image link -->
<a href="#" data-ko-link="image.url">
  <img data-ko-editable="image.src" alt="">
</a>
```

---

## Conditional Content

### Basic Conditional Display

Show/hide elements based on boolean properties:

```html
<!-- Show if property is true -->
<tr data-ko-display="titleVisible">
  <td>Title content</td>
</tr>

<!-- Show if property is false -->
<tr data-ko-display="imageVisible eq false">
  <td>No image</td>
</tr>
```

### Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | Equal to | `imagePos eq 'left'` |
| `neq` | Not equal to | `variant neq 'full'` |
| `gt` | Greater than | `columns gt 2` |
| `gte` | Greater than or equal | `fontSize gte 14` |
| `lt` | Less than | `imageWidth lt 300` |
| `lte` | Less than or equal | `padding lte 20` |

### Logical Operators

```html
<!-- AND operator -->
<tr data-ko-display="imageVisible and fixedHeight">
  <td>Fixed height image</td>
</tr>

<!-- OR operator -->
<tr data-ko-display="buttonVisible or linkVisible">
  <td>CTA content</td>
</tr>

<!-- Combined -->
<div data-ko-display="titleVisible and (imagePos eq 'left' or imagePos eq 'right')">
  Side layout with title
</div>
```

### Complex Conditions

```html
<!-- Compare with string -->
<img data-ko-editable="image.src"
     data-ko-display="imagePos eq 'left'">

<!-- Numeric comparison -->
<li data-ko-display="listsize gt 1">Second item</li>
<li data-ko-display="listsize gt 2">Third item</li>

<!-- Negation -->
<div data-ko-display="preheaderOption neq 'none'">
  Preheader content
</div>

<!-- Multiple conditions -->
<tr data-ko-display="imageVisible and fixedImageHeightVisible eq false">
  <td>Flexible height image</td>
</tr>
```

### Variant-Based Display

Use variants to create alternate layouts:

```css
@supports -ko-blockdefs {
  imageBlock {
    label: Image Block;
    properties: image gutterVisible=false;
    variant: gutterVisible;
  }
}
```

```html
<div data-ko-block="imageBlock">
  <!-- No gutter variant -->
  <table data-ko-display="gutterVisible eq false">
    <tr><td><img data-ko-editable="image.src"></td></tr>
  </table>

  <!-- With gutter variant -->
  <table data-ko-display="gutterVisible">
    <tr>
      <td width="30"></td>
      <td><img data-ko-editable="image.src"></td>
      <td width="30"></td>
    </tr>
  </table>
</div>
```

---

## Image Handling

### Basic Image

```html
<img
  data-ko-editable="image.src"
  src="https://via.placeholder.com/600x400"
  alt="Default alt text"
  width="600"
  height="400">
```

### Image with Placeholder Dimensions

Used for proper preview rendering:

```html
<img
  data-ko-editable="image.src"
  data-ko-placeholder-width="258"
  data-ko-placeholder-height="150"
  src="placeholder.jpg"
  alt="">
```

### Image with Dynamic Attributes

```html
<img
  data-ko-editable="image.src"
  -ko-attr-alt: @image.alt
  -ko-attr-width: @[imageWidth]
  -ko-attr-height: @[imageHeight]
  src="placeholder.jpg"
  style="
    max-width: 600px;
    -ko-max-width: @[imageWidth]px;">
```

### Linked Image

```html
<a href="" data-ko-link="image.url">
  <img
    data-ko-editable="image.src"
    -ko-attr-alt: @image.alt
    src="placeholder.jpg">
</a>
```

### Conditional Image

```html
<!-- Show image only if enabled -->
<tr data-ko-display="imageVisible">
  <td>
    <a href="" data-ko-link="image.url">
      <img data-ko-editable="image.src"
           data-ko-placeholder-height="150"
           src="placeholder.jpg">
    </a>
  </td>
</tr>
```

### Image with Fixed vs Flexible Height

```html
<!-- Fixed height variant -->
<img data-ko-editable="image.src"
     data-ko-display="fixedImageHeight"
     height="150"
     src="placeholder.jpg">

<!-- Flexible height variant -->
<img data-ko-editable="image.src"
     data-ko-display="fixedImageHeight eq false"
     data-ko-placeholder-height="150"
     src="placeholder.jpg">
```

---

## Advanced Features

### Array Properties (Repeatable Sections)

```css
@supports -ko-blockdefs {
  /* Define array property */
  listItem {
    label: List Item;
    properties: text icon;
  }

  listBlock {
    label: List Block;
    properties: items[]; /* Array property */
  }
}
```

```html
<div data-ko-block="listBlock">
  <ul>
    <li data-ko-display="items.length gt 0">@items[0].text</li>
    <li data-ko-display="items.length gt 1">@items[1].text</li>
    <li data-ko-display="items.length gt 2">@items[2].text</li>
  </ul>
</div>
```

### Theme System

Define and apply themes to blocks:

```css
@supports -ko-blockdefs {
  /* Define themes */
  frameTheme {
    label: Frame Style;
    properties: backgroundColor textColor;
  }

  contentTheme {
    label: Content Style;
    properties: backgroundColor textStyle;
  }

  /* Apply to blocks */
  headerBlock {
    label: Header Block;
    theme: frameTheme;
  }

  textBlock {
    label: Text Block;
    theme: contentTheme;
  }
}
```

### Root and Theme References

```html
<!-- Access root-level properties -->
<table width="600" style="-ko-attr-width: @_root_.bodyWidth">

<!-- Access theme properties -->
<td style="
  background-color: #f5f5f5;
  -ko-background-color: @_theme_.contentTheme.backgroundColor;">
```

### Block Wrap Control

```html
<!-- Prevent automatic wrapping -->
<div data-ko-block="preheaderBlock" data-ko-wrap="false">
  Preheader content
</div>
```

### Remove Helper Elements

```html
<!-- Elements marked with data-ko-remove are removed during parsing -->
<div data-ko-remove>
  This is a helper comment visible only in source,
  not in the final template
</div>
```

### Multi-Column Layouts

```html
<div data-ko-block="tripleArticleBlock">
  <table width="100%">
    <tr>
      <!-- Column 1 -->
      <td width="33%">
        <img data-ko-editable="leftImage.src">
        <div data-ko-editable="leftText">Left content</div>
      </td>

      <!-- Column 2 -->
      <td width="33%">
        <img data-ko-editable="middleImage.src">
        <div data-ko-editable="middleText">Middle content</div>
      </td>

      <!-- Column 3 -->
      <td width="33%">
        <img data-ko-editable="rightImage.src">
        <div data-ko-editable="rightText">Right content</div>
      </td>
    </tr>
  </table>
</div>
```

### Social Media Links

```css
@supports -ko-blockdefs {
  socialBlock {
    label: Social Block;
    properties:
      socialIconType=colors
      fbVisible=true fbUrl
      twVisible=true twUrl
      inVisible=false inUrl;
    variant: socialIconType;
  }
}
```

```html
<div data-ko-block="socialBlock">
  <!-- Facebook -->
  <a href=""
     data-ko-link="fbUrl"
     data-ko-display="fbVisible">
    <img src="facebook-icon.png" alt="Facebook">
  </a>

  <!-- Twitter -->
  <a href=""
     data-ko-link="twUrl"
     data-ko-display="twVisible">
    <img src="twitter-icon.png" alt="Twitter">
  </a>

  <!-- LinkedIn -->
  <a href=""
     data-ko-link="inUrl"
     data-ko-display="inVisible">
    <img src="linkedin-icon.png" alt="LinkedIn">
  </a>
</div>
```

### Personalization Placeholders

```html
<!-- Web version link -->
<a href="[show_link]">View in browser</a>

<!-- Unsubscribe link -->
<a href="[unsubscribe_link]">Unsubscribe</a>

<!-- Profile management -->
<a href="[profile_link]">Update preferences</a>
```

---

## AI Translation Protection

LePatron includes an AI translation feature that can automatically translate mailings to other languages. Template developers can control which content should be translated using the `data-translate` attribute.

### The `data-translate` Attribute

This attribute follows DOM inheritance - children inherit their parent's translation setting unless they override it.

| Value | Behavior |
|-------|----------|
| Absent | Translated by default |
| `data-translate="false"` | Not translated, descendants inherit `false` |
| `data-translate="true"` | Translated, can override parent's `false` |

### Protecting an Entire Block

Use this for blocks containing legal text, disclaimers, or content that must remain in the original language:

```html
<!-- All fields in this block will NOT be translated -->
<div data-ko-block="footerBlock" data-translate="false">
  <p data-ko-editable="legalText">@[legalText]</p>      <!-- NOT translated -->
  <p data-ko-editable="unsubText">@[unsubText]</p>      <!-- NOT translated -->
</div>
```

### Protecting Individual Fields

Protect specific fields while allowing the rest of the block to be translated:

```html
<div data-ko-block="contentBlock">
  <h1 data-ko-editable="titleText">@[titleText]</h1>    <!-- Translated -->
  <p data-ko-editable="bodyText">@[bodyText]</p>        <!-- Translated -->
  <p data-ko-editable="disclaimer" data-translate="false">
    @[disclaimer]                                        <!-- NOT translated -->
  </p>
</div>
```

### Exception Inside Protected Block

Override a protected block for specific fields that should be translated:

```html
<div data-ko-block="footerBlock" data-translate="false">
  <p data-ko-editable="legalText">@[legalText]</p>      <!-- NOT translated -->
  <p data-ko-editable="copyrightText">@[copyrightText]</p>  <!-- NOT translated -->
  <p data-ko-editable="customText" data-translate="true">
    @[customText]                                        <!-- Translated (exception) -->
  </p>
</div>
```

### Nested Containers with Inheritance

The attribute cascades through nested elements:

```html
<div data-ko-block="complexBlock" data-translate="false">
  <div class="header">
    <p data-ko-editable="headerText">@[headerText]</p>  <!-- NOT translated -->
  </div>
  <div class="content" data-translate="true">
    <h2 data-ko-editable="contentTitle">@[contentTitle]</h2>  <!-- Translated -->
    <p data-ko-editable="contentBody">@[contentBody]</p>      <!-- Translated -->
  </div>
  <div class="footer">
    <p data-ko-editable="footerText">@[footerText]</p>  <!-- NOT translated -->
  </div>
</div>
```

### Common Use Cases

| Use Case | Recommendation |
|----------|----------------|
| Legal disclaimers | Protect entire block or field |
| Brand/product names | Protect specific field |
| Footer with legal text | Protect entire block |
| Technical terms/code | Protect specific field |
| Unsubscribe text | Often needs protection (legal requirement) |
| Custom marketing message in footer | Exception with `data-translate="true"` |

### Important Notes

1. **Email name is always translated** - The mailing name/subject is not controlled by this attribute
2. **Only text fields are affected** - URLs, colors, and other non-text properties are never translated
3. **Dynamic variables are preserved** - Placeholders like `%%FIRSTNAME%%` or `{{user.name}}` are kept intact during translation

---

## Complete Attribute Reference

### Template Structure Attributes

```html
<!-- Main container (drag-and-drop zone) -->
<div data-ko-container="main">

<!-- Block definition -->
<div data-ko-block="blockName">

<!-- Editable content -->
<div data-ko-editable="fieldName">

<!-- Conditional display -->
<div data-ko-display="condition">

<!-- Link binding -->
<a data-ko-link="urlField">

<!-- Disable wrapping -->
<div data-ko-wrap="false">

<!-- Remove during parsing -->
<div data-ko-remove>

<!-- Declare properties (advanced) -->
<div data-ko-properties="prop1 prop2">
```

### CSS Bindings (use in style attribute)

```html
<!-- Color properties -->
-ko-background-color: @color
-ko-color: @textColor
-ko-border-color: @borderColor

<!-- Typography -->
-ko-font-family: @fontFace
-ko-font-size: @[fontSize]px
-ko-font-weight: @fontWeight
-ko-line-height: @lineHeight
-ko-text-align: @alignment
-ko-text-decoration: @decoration

<!-- Spacing -->
-ko-padding: @[padding]px
-ko-margin: @[margin]px
-ko-padding-top: @[topPadding]px

<!-- Borders -->
-ko-border-radius: @[radius]px
-ko-border-width: @[borderWidth]px
-ko-border-bottom: @[height]px solid @color

<!-- Sizing -->
-ko-width: @[width]px
-ko-height: @[height]px
-ko-max-width: @[maxWidth]px
-ko-min-height: @[minHeight]px

<!-- Text binding -->
-ko-bind-text: @textContent
```

### HTML Attribute Bindings

```html
<!-- Image attributes -->
-ko-attr-src: @image.src
-ko-attr-alt: @image.alt
-ko-attr-width: @[imageWidth]
-ko-attr-height: @[imageHeight]

<!-- Link attributes -->
-ko-attr-href: @linkUrl
-ko-attr-title: @linkTitle
-ko-attr-target: @linkTarget

<!-- Table attributes -->
-ko-attr-bgcolor: @backgroundColor
-ko-attr-width: @[cellWidth]
-ko-attr-colspan: @[columnSpan]
```

### Image-Specific Attributes

```html
<!-- Placeholder dimensions for preview -->
data-ko-placeholder-width="600"
data-ko-placeholder-height="400"

<!-- Image source editor -->
data-ko-editable="image.src"
```

---

## Available Block Types

Based on the versafix-1 template, these are commonly available blocks:

### Content Blocks

| Block | Description |
|-------|-------------|
| `textBlock` | Simple text content with formatting |
| `titleBlock` | Large title/heading block |
| `sideArticleBlock` | Image with text sidebar (left/right variants) |
| `singleArticleBlock` | Full-width image + text |
| `doubleArticleBlock` | Two-column article layout |
| `tripleArticleBlock` | Three-column article layout |

### Image Blocks

| Block | Description |
|-------|-------------|
| `logoBlock` | Logo/brand image with optional background |
| `imageBlock` | Single image (with/without gutter) |
| `doubleImageBlock` | Two-image gallery |
| `tripleImageBlock` | Three-image gallery |

### Interactive Blocks

| Block | Description |
|-------|-------------|
| `buttonBlock` | Call-to-action button |
| `socialBlock` | Social media links (small icons) |
| `bigSocialBlock` | Social media links (large icons) |
| `shareBlock` | Share buttons |

### Utility Blocks

| Block | Description |
|-------|-------------|
| `hrBlock` | Horizontal separator/divider |
| `spacerBlock` | Vertical spacing |
| `preheaderBlock` | Preheader text area |
| `footerBlock` | Footer with unsubscribe |

---

## Best Practices

### 1. Mobile Responsive Design

Always include media queries:

```html
<style type="text/css">
  @media only screen and (max-width: 480px) {
    .mobile-hide { display: none !important; }
    .mobile-full { width: 100% !important; }
    .mobile-padding { padding: 10px !important; }
  }
</style>
```

### 2. Email Client Compatibility

```html
<!-- Outlook conditional comments -->
<!--[if mso]>
<table width="600"><tr><td>
<![endif]-->

<!-- Regular content -->
<div style="max-width: 600px;">
  Content
</div>

<!--[if mso]>
</td></tr></table>
<![endif]-->
```

### 3. Default Values in Block Definitions

Always provide sensible defaults:

```css
@supports -ko-blockdefs {
  buttonBlock {
    label: Button;
    properties:
      buttonVisible=true          /* Show by default */
      buttonColor=#3498db          /* Default blue */
      buttonText="Click here"      /* Default text */
      borderRadius=4;              /* Default 4px */
  }
}
```

### 4. Organized Property Groups

Group related properties:

```css
@supports -ko-blockdefs {
  /* Typography group */
  textStyle {
    label: Text Style;
    properties: face color size lineHeight;
  }

  /* Button group */
  buttonStyle {
    label: Button Style;
    properties: color backgroundColor borderRadius;
  }

  /* Use in block */
  articleBlock {
    label: Article;
    properties: textStyle buttonStyle content buttonUrl;
  }
}
```

### 5. Clear Labels and Help Text

```css
@supports -ko-blockdefs {
  borderRadius {
    label: Corner Radius;
    widget: integer;
    min: 0;
    max: 20;
    help: "Note: Border radius is not supported in Outlook";
  }
}
```

### 6. Fallback Styles

Always provide fallback values before dynamic bindings:

```html
<td style="
  background-color: #ffffff;
  -ko-background-color: @backgroundColor;
  color: #333333;
  -ko-color: @textColor;">
  Content
</td>
```

### 7. Testing Multiple Variants

When using variants, test all combinations:

```css
@supports -ko-blockdefs {
  imageBlock {
    properties: imagePos=left;
    variant: imagePos; /* left|right|top */
  }
}
```

```html
<div data-ko-block="imageBlock">
  <!-- Test each variant -->
  <div data-ko-display="imagePos eq 'left'">Left layout</div>
  <div data-ko-display="imagePos eq 'right'">Right layout</div>
  <div data-ko-display="imagePos eq 'top'">Top layout</div>
</div>
```

---

## Undocumented Features

These features exist in the codebase but have limited documentation:

### 1. Magic Deprefixing

The system automatically strips camelCase prefixes from editable field names:

```html
<!-- All these use the same "text" widget definition -->
<div data-ko-editable="text">Main text</div>
<div data-ko-editable="headerText">Header</div>
<div data-ko-editable="footerText">Footer</div>
```

### 2. Complex JavaScript Expressions

You can use full JavaScript in variable expressions:

```html
<td style="
  -ko-attr-width: @[Math.floor(_root_.bodyWidth / 3)]
  -ko-width: @['calc(' + (Math.floor(width * 100 / 600)) + '%)']">
```

### 3. Root and Theme References

Access global and theme-level properties:

```html
<!-- Root properties -->
-ko-attr-width: @_root_.bodyWidth
-ko-max-width: @[_root_.bodyWidth - 40]px

<!-- Theme properties -->
-ko-background-color: @_theme_.frameTheme.backgroundColor
-ko-color: @_theme_.contentTheme.textColor
```

### 4. Preview Styling

Control how properties appear in the editor UI:

```css
@supports -ko-blockdefs {
  textStyle {
    label: Text Style;
    properties: face color size;
  }

  /* Custom preview rendering */
  textStyle:preview {
    -ko-bind-text: @['AaZz'];
    -ko-font-family: @face;
    -ko-color: @color;
    -ko-font-size: @[size]px;
  }
}
```

### 5. Category System

Hide properties from main UI:

```css
@supports -ko-blockdefs {
  internalId {
    label: Internal ID;
    widget: id;
    category: hidden; /* Hide from UI */
  }
}
```

### 6. Image Placeholder System

Control preview dimensions separately from actual image:

```html
<img
  data-ko-editable="image.src"
  data-ko-placeholder-width="600"
  data-ko-placeholder-height="400"
  src="placeholder.jpg">
```

---

## Code Locations

For advanced customization, these are the key files:

| Feature | File Location |
|---------|---------------|
| Template Parser | `packages/editor/src/js/converter/parser.js` |
| Block Bindings | `packages/editor/src/js/bindings/blocks.js` |
| WYSIWYG Editor | `packages/editor/src/js/bindings/wysiwygs.js` |
| Template Loader | `packages/editor/src/js/template-loader.js` |
| Block Definitions | `packages/editor/src/js/vue/constant/blocks.js` |
| HTML Processing | `packages/server/utils/process-mosaico-html-render.js` |
| Template Examples | `template-example/versafix-1/template-versafix-1.html` |
| Tutorial | `template-example/tutorial/` |
| Documentation | `packages/documentation/mosaico.md` |

---

## Resources

- **Example Templates:** `/template-example/versafix-1/` and `/template-example/tutorial/`
- **Mosaico Documentation:** `/packages/documentation/mosaico.md`
- **Tutorial:** `/template-example/tutorial/mosaico-tutorial.md`

---

## Support

For issues or questions:
- Check the example templates in `/template-example/`
- Review the tutorial in `/template-example/tutorial/mosaico-tutorial.md`
- Examine the versafix-1 template for advanced patterns

---

**Document Version:** 1.1
**Updated:** 2025-12-22
**Method:** Reverse engineering of LePatron codebase
**Changelog:** Added AI Translation Protection section (v1.1)
