const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const {
  translateBlock,
  getTranslationLanguages,
} = require('../../utils/apis');
const axios = require('axios');
const {
  extractBlockTranslatableContent,
  injectBlockTranslations,
} = require('../../../utils/block-content-extractor');
const ko = require('knockout');

const TranslateBlockModalComponent = Vue.component('TranslateBlockModal', {
  components: {
    ModalComponent,
  },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    blockData: null,
    blockObservable: null,
    sourceLanguage: 'auto',
    targetLanguage: '',
    availableLanguages: [],
    isLoading: false,
    error: null,
    defaultSourceLanguage: 'auto',
  }),
  mounted() {
    this.vm.toggleTranslateBlockModal = this.handleToggleModal;
    this.loadLanguages();
  },
  computed: {
    disableTranslateButton() {
      return this.isLoading || !this.targetLanguage || this.targetLanguage === this.sourceLanguage;
    },
    sourceLanguageOptions() {
      // Include 'auto' option for auto-detection (Phase 4)
      const autoOption = { code: 'auto', name: 'Détection automatique' };
      return [autoOption, ...this.availableLanguages];
    },
    targetLanguageOptions() {
      // Don't include 'auto' for target language
      return this.availableLanguages;
    },
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.blockData = null;
      this.blockObservable = null;
      this.targetLanguage = '';
      this.sourceLanguage = this.defaultSourceLanguage;
      this.error = null;
      this.$refs.modalRef?.closeModal();
    },
    /**
     * Load available languages from server
     */
    async loadLanguages() {
      try {
        const response = await axios.get(getTranslationLanguages());
        const { isAvailable, languages, defaultSourceLanguage } = response.data;

        if (!isAvailable) {
          this.availableLanguages = [];
          this.defaultSourceLanguage = 'auto';
          return;
        }

        // Transform language codes to objects with code and name
        // For now, we'll use the code as the name (can be enhanced with language names later)
        this.availableLanguages = languages.map((code) => ({
          code,
          name: this.getLanguageName(code),
        }));

        this.defaultSourceLanguage = defaultSourceLanguage || 'auto';
        this.sourceLanguage = this.defaultSourceLanguage;
      } catch (error) {
        console.error('Failed to load languages:', error);
        this.availableLanguages = [];
      }
    },
    /**
     * Get human-readable language name from code
     * @param {string} code - Language code (e.g., 'en', 'fr')
     * @returns {string} Language name
     */
    getLanguageName(code) {
      const languageNames = {
        en: 'English',
        fr: 'Français',
        de: 'Deutsch',
        es: 'Español',
        it: 'Italiano',
        pt: 'Português',
        nl: 'Nederlands',
        pl: 'Polski',
        ru: 'Русский',
        ja: '日本語',
        zh: '中文',
        ar: 'العربية',
      };
      return languageNames[code] || code.toUpperCase();
    },
    /**
     * Handle modal open/close
     * @param {boolean} isOpen - Open/close state
     * @param {Object} data - Block data and context
     */
    handleToggleModal(isOpen, data) {
      if (isOpen && data) {
        this.blockData = data.block;
        this.blockObservable = data.blockObservable;
        this.openModal();
      } else {
        this.closeModal();
      }
    },
    /**
     * Submit translation request
     */
    async handleTranslate() {
      if (!this.blockObservable || !this.targetLanguage) {
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        // Extract translatable content from block
        const blockContent = extractBlockTranslatableContent(this.blockData);
        console.log('[Translation] Extracted content:', blockContent);

        // Check if there's anything to translate
        if (Object.keys(blockContent).length === 0) {
          this.error = 'Ce bloc ne contient aucun contenu traduisible.';
          this.isLoading = false;
          return;
        }

        // Call translation API
        const response = await axios.post(translateBlock(), {
          blockContent,
          sourceLanguage: this.sourceLanguage,
          targetLanguage: this.targetLanguage,
        });

        const { translated } = response.data;
        console.log('[Translation] Received translations:', translated);
        console.log('[Translation] Block observable:', this.blockObservable);

        // Wrap injection in undo transaction
        this.vm.startMultiple();
        try {
          injectBlockTranslations(this.blockObservable, translated);
          console.log('[Translation] Injection completed');
        } finally {
          this.vm.stopMultiple();
        }

        // Show success message
        const successMessage = 'Bloc traduit avec succès. Utilisez Annuler (Ctrl+Z) pour revenir en arrière.';
        this.vm.notifier.success(successMessage);

        // Close modal
        this.closeModal();
      } catch (error) {
        console.error('Translation error:', error);

        // Handle different error types
        let errorMessage = 'La traduction a échoué. Veuillez réessayer.';

        if (error.response) {
          const { status, data } = error.response;

          if (status === 400) {
            if (data.message && data.message.includes('NO_INTEGRATION_FOR_FEATURE')) {
              errorMessage = 'La fonctionnalité de traduction n\'est pas configurée. Veuillez contacter votre administrateur.';
            } else if (data.message && data.message.includes('TRANSLATION_TARGET_LANGUAGE_NOT_ALLOWED')) {
              errorMessage = 'Cette langue n\'est pas disponible. Vérifiez les paramètres de votre groupe.';
            } else if (data.message) {
              errorMessage = data.message;
            }
          } else if (status === 429) {
            errorMessage = 'Quota de traduction dépassé. Veuillez réessayer plus tard.';
          } else if (status === 504) {
            errorMessage = 'Délai de traduction dépassé. Le fournisseur a mis trop de temps à répondre.';
          }
        } else if (error.request) {
          errorMessage = 'Erreur réseau. Veuillez vérifier votre connexion.';
        }

        this.error = errorMessage;
      } finally {
        this.isLoading = false;
      }
    },
  },
  template: `<modal-component
  ref="modalRef"
  :isLoading="isLoading"
  persistent
  maxWidth="560">
  <div class="modal-content">
      <div class="row">
          <div class="col s12">
              <h5>Traduire le bloc</h5>
          </div>

          <!-- Error message -->
          <div v-if="error" class="col s12">
              <div class="error-message" style="padding: 12px; margin-bottom: 16px; background-color: #ffebee; border-left: 4px solid #f44336; color: #c62828; border-radius: 4px;">
                  {{ error }}
              </div>
          </div>

          <form class="col s12">
              <div class="row">
                  <!-- Source Language -->
                  <div class="input-field col s12">
                      <label for="sourceLanguage">Langue source</label>
                      <select
                        id="sourceLanguage"
                        v-model="sourceLanguage"
                        class="browser-default"
                        style="margin-top: 8px; padding: 8px 12px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px;">
                        <option
                          v-for="lang in sourceLanguageOptions"
                          :key="lang.code"
                          :value="lang.code">
                          {{ lang.name }}
                        </option>
                      </select>
                  </div>

                  <!-- Target Language -->
                  <div class="input-field col s12">
                      <label for="targetLanguage">Langue cible</label>
                      <select
                        id="targetLanguage"
                        v-model="targetLanguage"
                        class="browser-default"
                        style="margin-top: 8px; padding: 8px 12px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px;">
                        <option value="" disabled>Sélectionnez une langue</option>
                        <option
                          v-for="lang in targetLanguageOptions"
                          :key="lang.code"
                          :value="lang.code">
                          {{ lang.name }}
                        </option>
                      </select>
                  </div>
              </div>
          </form>
      </div>
  </div>
  <div class="modal-footer">
      <button
          @click.prevent="closeModal"
          :disabled="isLoading"
          class="btn-flat waves-effect waves-light"
          name="closeAction">
          Annuler
      </button>
      <button
          @click.prevent="handleTranslate"
          :disabled="disableTranslateButton"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction">
          <span v-if="isLoading">Traduction en cours...</span>
          <span v-else>Traduire</span>
      </button>
  </div>
</modal-component>
  `,
});

module.exports = {
  TranslateBlockModalComponent,
};
