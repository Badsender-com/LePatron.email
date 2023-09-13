const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const {
  createPersonalizedBlock,
  editPersonalizedBlock,
} = require('../../utils/apis'); // Import the edit API
const axios = require('axios');
const styleHelper = require('../../utils/style/styleHelper');

const SaveBlockModalComponent = Vue.component('SaveBlockModal', {
  components: {
    ModalComponent,
  },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    blockName: '',
    blockCategory: '',
    blockContent: null,
    isLoading: false,
    mode: 'CREATE', // Initialize the mode to CREATE
    style: styleHelper,
  }),
  mounted() {
    this.vm.toggleSaveBlockModal = this.handleToggleSaveBlockModalChange;
  },
  computed: {
    disableSaveButton() {
      return this.isLoading || !this.blockName;
    },
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.blockName = '';
      this.blockCategory = '';
      this.blockContent = null;
      this.$refs.modalRef?.closeModal();
    },
    // Handle modal toggling and set the mode
    handleToggleSaveBlockModalChange(value, data, mode = 'CREATE') {
      this.mode = mode; // Set the mode
      if (value) {
        this.openModal();
        this.blockContent = data;

        // If in EDIT mode, populate fields from blockInformation
        if (mode === 'EDIT' && data.blockInformation) {
          this.blockName = data.blockInformation.name;
          this.blockCategory = data.blockInformation.category;
        }
      } else {
        this.closeModal();
      }
    },
    handleOnSubmit() {
      this.isLoading = true;
      let payload = {};
      let blockId = null;

      const templateId = this.vm?.currentMailing?.templateId; // Retrieve templateId from currentMailing

      // Construct the payload based on the mode
      if (this.mode === 'CREATE') {
        const { blockInformation, ...blockContent } = this.blockContent;
        payload = {
          name: this.blockName,
          category: this.blockCategory,
          groupId: this.vm?.metadata?.groupId,
          content: blockContent,
          templateId, // Include templateId in payload only for CREATE mode
        };
      } else if (this.mode === 'EDIT') {
        const { blockInformation } = this.blockContent;
        blockId = blockInformation.id; // Use the ID for editing
        payload = {
          name: this.blockName,
          category: this.blockCategory,
          groupId: this.vm?.metadata?.groupId,
        };
      }

      // Choose API endpoint and HTTP method based on the mode
      const apiEndpoint =
        this.mode === 'CREATE'
          ? { url: createPersonalizedBlock(), method: 'post' }
          : { url: editPersonalizedBlock(blockId), method: 'put' };

      axios({
        method: apiEndpoint.method,
        url: apiEndpoint.url,
        data: payload,
      })
        .then(() => {
          this.vm.notifier.success(this.vm.t('save-block-success'));
          this.isLoading = false;
          this.closeModal();
          const event = new Event('personalizedBlockApiActionApplied');
          window.dispatchEvent(event);
        })
        .catch(() => {
          this.vm.notifier.error(this.vm.t('save-block-error'));
          this.isLoading = false;
        });
    },
  },
  template: `<modal-component 
  ref="modalRef">
  <div class="modal-content" :onClose="closeModal">
      <div class="row">
          <div class="col s12">
          <h5>{{ mode === 'CREATE' ? vm.t('title-save-block') : vm.t('title-edit-block') }}</h5>
          </div>
          <form class="col s12">
              <div class="row">
                  <div class="input-field col s12">
                      <input
                        id="blockName"
                        v-model="blockName"
                        type="text"
                        name="blockName"
                        :placeholder="vm.t('placeholder-block-name')">
                        <label for="blockName">{{ vm.t('block-name') }}</label>
                  </div>
                  <div class="input-field col s12">
                      <input
                        id="blockCategory"
                        v-model="blockCategory"
                        type="text"
                        name="blockCategory"
                        :placeholder="vm.t('placeholder-block-category')">
                        <label for="blockCategory">{{ vm.t('block-category') }}</label>
                  </div>
              </div>
          </form>
      </div>
  </div>
  <div class="modal-footer">
      <button
          @click.prevent="closeModal"
          class="btn-flat waves-effect waves-light"
          name="closeAction">
          {{ vm.t('block-modal-close') }}
      </button>
      <button
          @click.prevent="handleOnSubmit"
          :disabled="disableSaveButton"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction">
          <span v-if="isLoading">{{ vm.t('saving-block') }}</span>
          <span v-else-if="mode === 'CREATE'">{{ vm.t('save-block') }}</span>
          <span v-else-if="mode === 'EDIT'">{{ vm.t('edit-block') }}</span>
      </button>
  </div>
</modal-component>
  `,
});

module.exports = {
  SaveBlockModalComponent,
};
