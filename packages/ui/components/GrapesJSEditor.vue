<template>
  <div class="grapesjs-editor-wrapper">
    <div class="editor-toolbar">
      <v-toolbar flat>
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

        <!-- Save Button -->
        <v-btn
          color="primary"
          :loading="isSaving"
          @click="saveTemplate"
        >
          <v-icon left>mdi-content-save</v-icon>
          Sauvegarder
        </v-btn>

        <!-- Export Button -->
        <v-btn
          color="secondary"
          class="ml-2"
          @click="exportTemplate"
        >
          <v-icon left>mdi-download</v-icon>
          Exporter HTML
        </v-btn>
      </v-toolbar>
    </div>

    <!-- GrapesJS Container -->
    <div id="gjs" class="grapesjs-container"></div>

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
      snackbar: {
        show: false,
        message: '',
        color: 'success',
      },
    };
  },

  async mounted() {
    try {
      // Dynamically import GrapesJS (client-side only)
      const grapesjs = await import('grapesjs');
      const grapesJSPresetNewsletter = await import('grapesjs-preset-newsletter');

      // Load standard blocks
      await this.loadStandardBlocks();

      // Initialize GrapesJS editor
      this.initEditor(grapesjs.default, grapesJSPresetNewsletter.default);

      // Load template data
      await this.loadTemplate();
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
    initEditor(grapesjs, grapesJSPresetNewsletter) {
      this.editor = grapesjs.init({
        container: '#gjs',
        fromElement: false,
        height: 'calc(100vh - 120px)',
        width: 'auto',

        // Storage Manager
        storageManager: {
          type: 'remote',
          autosave: true,
          autoload: false, // We'll load manually
          stepsBeforeSave: 1,
          options: {
            remote: {
              urlLoad: `/api/grapesjs/templates/${this.templateId}`,
              urlStore: `/api/grapesjs/templates/${this.templateId}/save`,
              onLoad: (result) => result.grapesjs_data || {},
              onStore: (data) => ({
                grapesjs_data: data,
                brand: this.selectedBrand,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            },
          },
        },

        // Plugins
        plugins: [grapesJSPresetNewsletter],

        pluginsOpts: {
          [grapesJSPresetNewsletter]: {
            modalTitleImport: 'Importer template',
            modalLabelImport: 'Coller votre HTML ici',
            modalTitleExport: 'Exporter template',
            codeViewerTheme: 'material',
          },
        },

        // Canvas
        canvas: {
          styles: [],
          scripts: [],
        },

        // Device Manager (responsive)
        deviceManager: {
          devices: [
            {
              id: 'desktop',
              name: 'Desktop',
              width: '100%',
            },
            {
              id: 'mobile',
              name: 'Mobile',
              width: '320px',
              widthMedia: '480px',
            },
          ],
        },
      });

      // Add event listeners
      this.editor.on('storage:store', () => {
        console.log('Template auto-saved');
      });

      this.editor.on('storage:error', (err) => {
        console.error('Storage error:', err);
        this.showNotification('Erreur lors de la sauvegarde', 'error');
      });
    },

    async loadStandardBlocks() {
      try {
        const response = await this.$axios.get('/api/grapesjs/blocks/standard');
        if (response.data.success) {
          this.standardBlocks = response.data.blocks;
          console.log('Standard blocks loaded:', this.standardBlocks.length);
        }
      } catch (error) {
        console.error('Error loading standard blocks:', error);
      }
    },

    async loadTemplate() {
      try {
        const response = await this.$axios.get(`/api/grapesjs/templates/${this.templateId}`);
        if (response.data.success) {
          const { grapesjs_data, brand } = response.data;

          if (brand) {
            this.selectedBrand = brand;
          }

          // Load data into editor
          if (grapesjs_data) {
            this.editor.setComponents(grapesjs_data.components || []);
            this.editor.setStyle(grapesjs_data.styles || []);
            // TODO: Load assets and custom blocks
          }

          this.showNotification('Template chargé avec succès', 'success');
        }
      } catch (error) {
        console.error('Error loading template:', error);
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
          customBlocks: [], // TODO: Implement custom blocks
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
        const response = await this.$axios.post(
          `/api/grapesjs/templates/${this.templateId}/export`
        );

        if (response.data.success) {
          // TODO: Download HTML file
          this.showNotification('Export en cours de développement', 'info');
        }
      } catch (error) {
        console.error('Error exporting template:', error);
        this.showNotification('Erreur lors de l\'export', 'error');
      }
    },

    onBrandChange(brand) {
      console.log('Brand changed to:', brand);
      // TODO: Apply brand theme (CSS Variables)
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
}

.editor-toolbar {
  flex-shrink: 0;
}

.grapesjs-container {
  flex: 1;
  overflow: hidden;
}

/* GrapesJS specific styles will be loaded from the library */
</style>

<style>
/* Import GrapesJS CSS - This should be in a global CSS file or nuxt.config.js */
@import 'grapesjs/dist/css/grapes.min.css';
@import 'grapesjs-preset-newsletter/dist/grapesjs-preset-newsletter.css';
</style>
