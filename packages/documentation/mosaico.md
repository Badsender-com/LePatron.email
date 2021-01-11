# Mosaico Editor

[original repository](https://github.com/voidlabs/mosaico)

Mosaico's Editor is based on [Knockout](https://knockoutjs.com/)  
It's served as a standalone front application.

## Serving the Editor

The editor is rendered by a specific express controller:  
`packages/server/controllers/mailings/mosaico-editor.js`

You'll find the base HTML file at:  
`packages/server/html-templates/mosaico-editor.pug`

It's here that we pass any endpoints URL & data to Mosaico

## Build & extensions

Mosaico's editor has been enhanced during Badsender's development.  
This was done by:

- tweaking the [Browserify's build](http://browserify.org/demos.html) in the gulpfile.
- writing some extensions.

Mosaico's Editor is extendable by design (see `src/js/ext/badsender-extensions.js`)  
All Badsender's extensions are prefixed by `badsender-`.  
Any Badsender's code will also be transformed by [BabelJS](https://babeljs.io/).

We rely on 2 environments variables to clean up the bundle:

- `process.env.MOSAICO`: this will be removed from the bundle
- `process.env.BADSENDER`: this will be kept

This allow us to keep the diff from the original code as low as possible

## Templates and models

Mosaico's template define the blocks & the data model:

- It will parse any `@supports -ko-blockdefs {}` CSS rules to deduce which kind of widgets & data representation the template supports.
- Then in the HTML any `data-ko-block="blockName"` will be transformed to a block on the left side.
- Any binding inside those blocks will use `-ko-blockdefs` widgets to define the data representation inside that block.  
  **this is what will be persisted in the DB under the _data_ key in the collection**

## Download & preview

Since only the JSON data are saved in DB, in order to get the HTML, you'll need to:

- load the editor
- use the `viewModel.exportHTML`:
  this will render in the browser the mailing according to its data & the template
  (look at `src/js/viewmodel.js`)
- call a Backend route with HTML content
- then the HTML will be processed again in the `packages/server/controllers/mailings/download-zip.js` controller

## Basic front initialisation flow

The entry point is `src/js/app.js`

- init
- start

in `src/js/template-loader.js`

- templateLoader: Ajax datas
- templateCompiler:
  - Initialize viewmodel (./viewmodel.js)
  - Add server datas
  - apply plugins (server-storage, setEditorIcon + mosaico defined)
