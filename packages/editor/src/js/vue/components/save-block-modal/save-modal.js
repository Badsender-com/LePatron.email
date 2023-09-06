const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { createPersonalizedBlock } = require('../../utils/apis');
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
    style: styleHelper,
  }),
  mounted() {
    this.vm.toggleSaveBlockModal = this.handleToggleSaveBlockModalChange;
  },
  computed: {
    disableSaveButton() {
      // Disable the button if blockName is empty or if the request is still loading
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
    handleToggleSaveBlockModalChange(value, data) {
      if (value === true) {
        this.openModal();
        this.blockContent = data;
      } else {
        this.closeModal();
        this.blockContent = null;
      }
    },
    handleOnSubmit() {
      this.isLoading = true;
      // remove blockInformation from blockContent to do not save it twice
      const { blockInformation, ...blockContent } = this.blockContent;
      const payload = {
        name: this.blockName,
        category: this.blockCategory,
        groupId: this.vm?.metadata?.groupId, // Retrieve groupId here
        content: blockContent,
      };

      axios
        .post(createPersonalizedBlock(), payload)
        .then(() => {
          this.vm.notifier.success(this.vm.t('save-block-success'));
          this.isLoading = false;
          this.closeModal();
          // Dispatch a custom event to signal that a new personalized block has been added, triggering a refresh in the list component.
          const event = new Event('personalizedBlockAdded');
          window.dispatchEvent(event);
        })
        .catch(() => {
          this.vm.notifier.error(this.vm.t('save-block-error'));
          this.isLoading = false;
        });
    },
  },
  template: `
    <modal-component 
        ref="modalRef">
        <div class="modal-content" :onClose="closeModal">
            <div class="row">
                <div class="col s12">
                    <h5>{{vm.t('title-save-block')}}</h5>
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
                <span v-else>{{ vm.t('save-block') }}</span>
            </button>
        </div>
    </modal-component>
    `,
});

module.exports = {
  SaveBlockModalComponent,
};
