const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { textGenBlock } = require('../../utils/apis');
const axios = require('axios');
const {
  extractBlockTranslatableContent,
  injectBlockTranslations,
} = require('../../../utils/block-content-extractor');

/**
 * POC textgen — "Générer par IA" on a block. Mirror of TranslateBlockModal:
 * extract the block's text fields, send them with the user's brief to the
 * skills pipeline, inject the generated values back into the KO observables
 * inside a single undo transaction (Ctrl+Z reverts everything at once).
 *
 * API contract: dot-notation paths travel as VALUES of {path, value} pairs
 * (BSON forbids dots in persisted object keys server-side) — the extractor's
 * flat map is converted at both boundaries.
 */
const TextGenBlockModalComponent = Vue.component('TextGenBlockModal', {
  components: {
    ModalComponent,
  },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    blockData: null,
    blockObservable: null,
    instruction: '',
    isLoading: false,
    error: null,
  }),
  mounted() {
    this.vm.toggleTextGenBlockModal = this.handleToggleModal;
  },
  computed: {
    disableGenerateButton() {
      return this.isLoading || !this.instruction.trim();
    },
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.blockData = null;
      this.blockObservable = null;
      this.instruction = '';
      this.error = null;
      this.$refs.modalRef?.closeModal();
    },
    handleToggleModal(isOpen, data) {
      if (isOpen && data) {
        this.blockData = data.block;
        this.blockObservable = data.blockObservable;
        this.openModal();
      } else {
        this.closeModal();
      }
    },
    async handleGenerate() {
      if (!this.blockObservable || !this.instruction.trim()) {
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const blockContent = extractBlockTranslatableContent(this.blockData);
        const paths = Object.keys(blockContent);
        if (paths.length === 0) {
          this.error = 'Ce bloc ne contient pas de champs texte.';
          this.isLoading = false;
          return;
        }

        // Flat map → {path, value} pairs (API contract, BSON-safe).
        const currentContent = paths.map((path) => ({
          path,
          value: blockContent[path],
        }));

        const response = await axios.post(textGenBlock(), {
          instruction: this.instruction.trim(),
          currentContent,
          // Used server-side only for super-admins (no own group): target the
          // mailing's group, like the metadata feature flag does.
          groupId: this.vm.metadata && this.vm.metadata.groupId,
        });
        const { generated, omittedPaths } = response.data;

        if (!generated || !generated.length) {
          this.error =
            "La génération n'a produit aucun champ utilisable. Réessayez en reformulant le brief.";
          this.isLoading = false;
          return;
        }

        // Pairs → flat map for the shared injector.
        const values = {};
        generated.forEach((entry) => {
          values[entry.path] = entry.value;
        });

        this.vm.startMultiple();
        try {
          injectBlockTranslations(this.blockObservable, values);
        } finally {
          this.vm.stopMultiple();
        }

        // Signal partial generations ("3 champs sur 4 générés") to avoid
        // confusion when a field silently kept its previous content.
        let successMessage =
          'Contenu généré. Utilisez Annuler (Ctrl+Z) pour revenir en arrière.';
        if (omittedPaths && omittedPaths.length) {
          successMessage =
            generated.length +
            ' champ(s) sur ' +
            paths.length +
            ' généré(s) — non couverts : ' +
            omittedPaths.join(', ') +
            '. Ctrl+Z pour annuler.';
        }
        this.vm.notifier.success(successMessage);
        this.closeModal();
      } catch (error) {
        console.error('Textgen error:', error);
        let errorMessage = 'La génération a échoué. Veuillez réessayer.';
        if (error.response) {
          const { status, data } = error.response;
          if (status === 400 && data.message) {
            errorMessage = data.message.includes('NO_INTEGRATION_FOR_FEATURE')
              ? "Le moteur IA n'est pas configuré pour votre groupe. Contactez votre administrateur."
              : data.message;
          } else if (status === 429) {
            errorMessage = 'Quota IA dépassé. Veuillez réessayer plus tard.';
          } else if (status === 504) {
            errorMessage =
              'Délai dépassé. Le fournisseur IA a mis trop de temps à répondre.';
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
  class="medium-modal"
  :isLoading="isLoading"
  persistent>
  <div class="modal-content">
      <div class="row">
          <div class="col s12">
              <h5>Générer le contenu du bloc (IA)</h5>
          </div>

          <div v-if="error" class="col s12">
              <div class="error-message" style="padding: 12px; margin-bottom: 16px; background-color: #ffebee; border-left: 4px solid #f44336; color: #c62828; border-radius: 4px;">
                  {{ error }}
              </div>
          </div>

          <form class="col s12">
              <div class="row">
                  <div class="input-field col s12">
                      <label for="textgenInstruction">Que doit dire ce bloc ?</label>
                      <textarea
                        id="textgenInstruction"
                        v-model="instruction"
                        rows="5"
                        placeholder="Ex. : Bloc principal d'un email promo : -20% sur la nouvelle collection de vestes en lin, du 15 au 22 juin. Ton chaleureux, sans urgence agressive."
                        style="margin-top: 8px; padding: 8px 12px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px; width: 100%; min-height: 110px; box-sizing: border-box;"></textarea>
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
          @click.prevent="handleGenerate"
          :disabled="disableGenerateButton"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction">
          <span v-if="isLoading">Génération en cours…</span>
          <span v-else>Générer</span>
      </button>
  </div>
</modal-component>
  `,
});

module.exports = {
  TextGenBlockModalComponent,
};
