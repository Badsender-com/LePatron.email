# LePatron.email

An email design platform: a client company's brand templates are turned into mailings by its marketing teams, in a visual editor, then exported or sent to an ESP.

## Language

### Editor

**Synthetic block**:
A block the editor injects into every template's palette rather than finding in the template's own markup. There are two, and one shared mechanism carries both.
_Avoid_: Virtual block, injected block

**HTML code block**:
The synthetic block whose content is markup the user pastes. LePatron does not own that markup.
_UI_: Bloc Code HTML

**Composed block**:
The synthetic block whose content is assembled in the Block Builder. LePatron owns the markup it ships, and regenerates it from the composition.
_UI_: Composer un bloc
_Avoid_: Builder block, custom block, personalized block

**Block Builder**:
The tool a composed block is assembled in: a palette, a composition area and a settings panel.
_UI_: Composer un bloc

**Composition**:
What a composed block holds, as stored: the rows, their columns, the elements inside them, and the block's own styling. Read and written as a serialised string.

**Row**:
One horizontal band of a composition, holding one to four columns. A composition is a list of rows; a row is not addressable by Mosaico, only from inside the Block Builder.
_UI_: Ligne

**Column**:
One cell of a row, carrying a width in percent and a list of elements. A column keeps its cell in the export even when it holds nothing, so the layout does not collapse.
_UI_: Colonne

**Element**:
The smallest thing a user places in a column: text, image, button, divider or spacer.
_UI_: Élément
_Avoid_: Component, widget, module

**Preset**:
A named set of column widths offered in the panel (1, 2×50, 66/33, 33/66, 3×33, 4×25). A shortcut for writing widths, never stored as such.
_UI_: Structure

### Generation

**Slot**:
A hole in a compiled element template, declaring the escaping context its value goes through. A value cannot reach the markup without passing one.

**Escaping context**:
What a slot declares about where its value lands — text, attribute, URL, colour, pixels, CSS value, rich text, or markup. It carries the escaping, so escaping is a property of the slot rather than the author's vigilance.

**Generated CSS**:
The stylesheet derived from a composition at export time, for the rules that cannot be inlined. Never stored: it is recomputed wherever the composition is rendered.

**Head CSS**:
The stylesheet an author writes by hand for a mailing, injected into the exported document's `<head>`.
_UI_: CSS personnalisé
