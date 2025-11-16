<template>
  <div class="grapesjs-editor-wrapper">
    <!-- Top Toolbar -->
    <div class="editor-toolbar">
      <v-toolbar flat dense>
        <v-toolbar-title>{{ templateName }}</v-toolbar-title>
        <v-spacer></v-spacer>

        <!-- Brand Selector -->
        <v-select
          v-if="enableBrandSelector"
          v-model="selectedBrand"
          :items="brandOptions"
          label="Marque"
          outlined
          dense
          hide-details
          class="mr-4"
          style="max-width: 200px"
          @change="onBrandChange"
        ></v-select>

        <!-- Device Preview Buttons -->
        <div class="panel__devices mr-4"></div>

        <!-- Save Button -->
        <v-btn
          color="primary"
          :loading="isSaving"
          small
          @click="saveTemplate"
        >
          <v-icon left small>mdi-content-save</v-icon>
          Sauvegarder
        </v-btn>

        <!-- Export Button -->
        <v-btn
          color="secondary"
          class="ml-2"
          small
          @click="exportTemplate"
        >
          <v-icon left small>mdi-download</v-icon>
          Exporter
        </v-btn>
      </v-toolbar>
    </div>

    <!-- Main Editor Layout -->
    <div class="editor-main">
      <!-- Left Panel: Blocks -->
      <div class="editor-panel editor-panel-left">
        <div class="panel-header">
          <h3>Blocs</h3>
        </div>
        <div class="blocks-container"></div>
      </div>

      <!-- Center: Canvas -->
      <div class="editor-canvas">
        <div class="panel__basic-actions"></div>
        <div id="gjs"></div>
      </div>

      <!-- Right Panel: Settings -->
      <div class="editor-panel editor-panel-right">
        <v-tabs v-model="rightPanelTab" dense>
          <v-tab>Styles</v-tab>
          <v-tab>Propriétés</v-tab>
          <v-tab>Calques</v-tab>
        </v-tabs>
        <v-tabs-items v-model="rightPanelTab">
          <v-tab-item>
            <div class="styles-container"></div>
          </v-tab-item>
          <v-tab-item>
            <div class="traits-container"></div>
          </v-tab-item>
          <v-tab-item>
            <div class="layers-container"></div>
          </v-tab-item>
        </v-tabs-items>
      </div>
    </div>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.message }}
      <template v-slot:action="{ attrs }">
        <v-btn
          text
          v-bind="attrs"
          @click="snackbar.show = false"
        >
          Fermer
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
export default {
  name: 'GrapesJSEditor',

  props: {
    templateId: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      default: 'Template GrapesJS',
    },
    enableBrandSelector: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      editor: null,
      selectedBrand: 'badsender',
      brandOptions: [
        { text: 'Badsender', value: 'badsender' },
        { text: 'Sobriété & Marketing', value: 'sm' },
        { text: 'Le Patron', value: 'lepatron' },
      ],
      isSaving: false,
      rightPanelTab: 0,
      snackbar: {
        show: false,
        message: '',
        color: 'success',
      },
    };
  },

  async mounted() {
    try {
      // Dynamically import GrapesJS and config (client-side only)
      const grapesjs = await import('grapesjs');
      const grapesJSPresetNewsletter = await import('grapesjs-preset-newsletter');

      // Initialize GrapesJS editor with full configuration
      await this.initEditor(grapesjs.default, grapesJSPresetNewsletter.default);

      // Load blocks into the editor
      await this.loadBlocks();

      // Load template data
      await this.loadTemplate();

      this.showNotification('Éditeur initialisé avec succès', 'success');
    } catch (error) {
      console.error('Error initializing GrapesJS:', error);
      this.showNotification('Erreur lors de l\'initialisation de l\'éditeur', 'error');
    }
  },

  beforeDestroy() {
    if (this.editor) {
      this.editor.destroy();
    }
  },

  methods: {
    async initEditor(grapesjs, grapesJSPresetNewsletter) {
      // Import configuration
      const { getGrapesJSConfig, setupCommands } = await import(
        '~/../../packages/grapesjs-editor/client/config/grapesjs-config.js'
      );

      // Get editor configuration
      const config = getGrapesJSConfig({
        templateId: this.templateId,
        container: '#gjs',
        height: 'calc(100vh - 200px)',
        onSave: (payload) => {
          // Add brand to payload
          payload.brand = this.selectedBrand;
        },
        onLoad: (result) => {
          if (result.brand) {
            this.selectedBrand = result.brand;
          }
        },
      });

      // Add newsletter preset to plugins
      config.plugins = [grapesJSPresetNewsletter];
      config.pluginsOpts = {
        [grapesJSPresetNewsletter]: {
          modalTitleImport: 'Importer template',
          modalLabelImport: 'Coller votre HTML ici',
          modalTitleExport: 'Exporter template',
          codeViewerTheme: 'material',
          // Configure preset options
          cellStyle: {
            'font-size': '14px',
            'font-family': 'Arial, Helvetica, sans-serif',
            color: '#333333',
            'line-height': '1.5',
          },
        },
      };

      // Initialize editor
      this.editor = grapesjs.init(config);

      // Setup custom commands
      setupCommands(this.editor);

      // Add event listeners
      this.editor.on('storage:store', () => {
        console.log('✅ Template auto-saved');
      });

      this.editor.on('storage:error', (err) => {
        console.error('❌ Storage error:', err);
        this.showNotification('Erreur lors de la sauvegarde', 'error');
      });

      this.editor.on('load', () => {
        console.log('✅ Editor loaded');
      });
    },

    async loadBlocks() {
      try {
        const response = await this.$axios.get('/api/grapesjs/blocks/standard');

        if (response.data.success && response.data.blocks) {
          const blockManager = this.editor.BlockManager;

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
        this.showNotification('Erreur lors du chargement des blocs', 'warning');
      }
    },

    async loadTemplate() {
      try {
        const response = await this.$axios.get(
          `/api/grapesjs/templates/${this.templateId}`
        );

        if (response.data.success) {
          const { grapesjs_data, brand } = response.data;

          if (brand) {
            this.selectedBrand = brand;
          }

          // Load data into editor
          if (grapesjs_data && grapesjs_data.components) {
            this.editor.setComponents(grapesjs_data.components);
            if (grapesjs_data.styles) {
              this.editor.setStyle(grapesjs_data.styles);
            }
          }

          console.log('✅ Template loaded');
        }
      } catch (error) {
        console.error('❌ Error loading template:', error);
        this.showNotification('Erreur lors du chargement du template', 'error');
      }
    },

    async saveTemplate() {
      this.isSaving = true;
      try {
        const grapesjs_data = {
          components: this.editor.getComponents(),
          styles: this.editor.getStyle(),
          assets: this.editor.AssetManager.getAll(),
          customBlocks: [],
          pages: [],
        };

        const response = await this.$axios.post(
          `/api/grapesjs/templates/${this.templateId}/save`,
          {
            grapesjs_data,
            brand: this.selectedBrand,
          }
        );

        if (response.data.success) {
          this.showNotification('Template sauvegardé avec succès', 'success');
        } else {
          throw new Error(response.data.error || 'Échec de la sauvegarde');
        }
      } catch (error) {
        console.error('Error saving template:', error);
        this.showNotification('Erreur lors de la sauvegarde', 'error');
      } finally {
        this.isSaving = false;
      }
    },

    async exportTemplate() {
      try {
        const html = this.editor.runCommand('gjs-get-inlined-html');

        // Create a downloadable file
        const blob = new Blob([html], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.templateName.replace(/\s+/g, '-')}.html`;
        link.click();
        window.URL.revokeObjectURL(url);

        this.showNotification('Template exporté avec succès', 'success');
      } catch (error) {
        console.error('Error exporting template:', error);
        this.showNotification('Erreur lors de l\'export', 'error');
      }
    },

    onBrandChange(brand) {
      console.log('Brand changed to:', brand);
      // TODO: Apply brand theme (CSS Variables) in Phase 3
      this.showNotification(`Marque changée: ${brand}`, 'info');
    },

    showNotification(message, color = 'success') {
      this.snackbar = {
        show: true,
        message,
        color,
      };
    },
  },
};
</script>

<style scoped>
.grapesjs-editor-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.editor-toolbar {
  flex-shrink: 0;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-panel {
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-panel-left {
  width: 280px;
  flex-shrink: 0;
}

.editor-panel-right {
  width: 300px;
  flex-shrink: 0;
  border-right: none;
  border-left: 1px solid #e0e0e0;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  color: #666;
}

.blocks-container,
.styles-container,
.traits-container,
.layers-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.editor-canvas {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  position: relative;
}

.panel__basic-actions,
.panel__devices {
  display: inline-block;
}

/* GrapesJS overrides */
:deep(.gjs-cv-canvas) {
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}

:deep(.gjs-block) {
  width: auto;
  min-height: 60px;
  padding: 8px;
  margin: 4px 0;
}

:deep(.gjs-block svg) {
  width: 32px;
  height: 32px;
}
</style>

<style>
/* Import GrapesJS CSS dynamically */
@import 'grapesjs/dist/css/grapes.min.css';
@import 'grapesjs-preset-newsletter/dist/grapesjs-preset-newsletter.css';
</style>
