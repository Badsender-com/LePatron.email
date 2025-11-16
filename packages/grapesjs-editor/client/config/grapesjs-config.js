/**
 * GrapesJS Editor Configuration
 *
 * This file contains the configuration for the GrapesJS editor,
 * including plugins, storage, device manager, and style manager settings.
 */

export const getGrapesJSConfig = (options = {}) => {
  const {
    templateId,
    container = '#gjs',
    height = 'calc(100vh - 120px)',
    onSave = null,
    onLoad = null,
  } = options;

  return {
    // Container
    container,
    fromElement: false,

    // Dimensions
    height,
    width: 'auto',

    // Storage Manager (remote save/load)
    storageManager: {
      type: 'remote',
      autosave: true,
      autoload: false, // We load manually
      stepsBeforeSave: 1,
      options: {
        remote: {
          urlLoad: `/grapesjs/templates/${templateId}`,
          urlStore: `/grapesjs/templates/${templateId}/save`,
          onLoad: (result) => {
            if (onLoad) onLoad(result);
            return result.grapesjs_data || {};
          },
          onStore: (data, editor) => {
            const payload = {
              grapesjs_data: {
                components: data.components || [],
                styles: data.styles || [],
                assets: editor.AssetManager.getAll() || [],
                customBlocks: [],
                pages: data.pages || [],
              },
            };
            if (onSave) onSave(payload);
            return payload;
          },
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
    },

    // Canvas settings
    canvas: {
      styles: [],
      scripts: [],
    },

    // Panels (toolbar buttons)
    panels: {
      defaults: [
        {
          id: 'basic-actions',
          el: '.panel__basic-actions',
          buttons: [
            {
              id: 'visibility',
              active: true,
              className: 'btn-toggle-borders',
              label: '<i class="fa fa-clone"></i>',
              command: 'sw-visibility',
              attributes: { title: 'Afficher/masquer les bordures' },
            },
          ],
        },
        {
          id: 'panel-devices',
          el: '.panel__devices',
          buttons: [
            {
              id: 'device-desktop',
              label: '<i class="fa fa-desktop"></i>',
              command: 'set-device-desktop',
              active: true,
              attributes: { title: 'Vue Desktop' },
            },
            {
              id: 'device-tablet',
              label: '<i class="fa fa-tablet"></i>',
              command: 'set-device-tablet',
              attributes: { title: 'Vue Tablette' },
            },
            {
              id: 'device-mobile',
              label: '<i class="fa fa-mobile"></i>',
              command: 'set-device-mobile',
              attributes: { title: 'Vue Mobile' },
            },
          ],
        },
      ],
    },

    // Device Manager (responsive preview)
    deviceManager: {
      devices: [
        {
          id: 'desktop',
          name: 'Desktop',
          width: '',
        },
        {
          id: 'tablet',
          name: 'Tablet',
          width: '768px',
          widthMedia: '992px',
        },
        {
          id: 'mobile',
          name: 'Mobile',
          width: '320px',
          widthMedia: '480px',
        },
      ],
    },

    // Block Manager
    blockManager: {
      appendTo: '.blocks-container',
      blocks: [], // Blocks will be loaded dynamically
    },

    // Layer Manager
    layerManager: {
      appendTo: '.layers-container',
    },

    // Style Manager
    styleManager: {
      appendTo: '.styles-container',
      sectors: [
        {
          name: 'Général',
          open: true,
          buildProps: ['display', 'width', 'height', 'padding', 'margin'],
        },
        {
          name: 'Typographie',
          open: false,
          buildProps: [
            'font-family',
            'font-size',
            'font-weight',
            'letter-spacing',
            'color',
            'line-height',
            'text-align',
            'text-decoration',
            'text-transform',
          ],
        },
        {
          name: 'Décorations',
          open: false,
          buildProps: [
            'background-color',
            'border',
            'border-radius',
            'box-shadow',
          ],
        },
      ],
    },

    // Trait Manager (component properties)
    traitManager: {
      appendTo: '.traits-container',
    },

    // Asset Manager (image upload)
    assetManager: {
      upload: false, // Disable for now, will implement later
      uploadName: 'file',
      multiUpload: false,
      autoAdd: true,
      assets: [],
    },

    // Rich Text Editor
    richTextEditor: {
      actions: ['bold', 'italic', 'underline', 'strikethrough', 'link'],
    },

    // Avoid inline styles in some cases
    avoidInlineStyle: false,
  };
};

/**
 * Commands for GrapesJS editor
 */
export const setupCommands = (editor) => {
  // Set Desktop device
  editor.Commands.add('set-device-desktop', {
    run: (editor) => editor.setDevice('desktop'),
  });

  // Set Tablet device
  editor.Commands.add('set-device-tablet', {
    run: (editor) => editor.setDevice('tablet'),
  });

  // Set Mobile device
  editor.Commands.add('set-device-mobile', {
    run: (editor) => editor.setDevice('mobile'),
  });
};

/**
 * Load blocks into the editor
 */
export const loadBlocks = async (editor, axios) => {
  try {
    // Load standard blocks from API
    const response = await axios.get('/grapesjs/blocks/standard');

    if (response.data.success && response.data.blocks) {
      const blockManager = editor.BlockManager;

      response.data.blocks.forEach((blockDef) => {
        blockManager.add(blockDef.id, {
          label: blockDef.label,
          category: blockDef.category,
          media: blockDef.media,
          content: blockDef.content,
          attributes: { class: 'gjs-block' },
        });
      });

      console.log(`✅ Loaded ${response.data.blocks.length} standard blocks`);
    }
  } catch (error) {
    console.error('❌ Error loading blocks:', error);
  }
};
