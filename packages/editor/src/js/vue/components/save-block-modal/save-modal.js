const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
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
    blockInformation: null,
    style: styleHelper,
    subscriptions: [],
  }),
  mounted() {
    this.vm.toggleSaveBlockModal = this.handleToggleSaveBlockModalChange;
  },
  computed: {
    disableSaveButton() {
      return !this.blockName; // Disable the button if blockName is empty
    },
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.blockName = '';
      this.blockCategory = '';
      this.blockInformation = null;
      this.$refs.modalRef?.closeModal();
    },
    handleToggleSaveBlockModalChange(value, data) {
      if (value === true) {
        this.openModal();
        this.blockInformation = data;
      } else {
        this.closeModal();
        this.blockInformation = null;
      }
    },
    handleOnSubmit() {
      // TODO: Add Logic to handle the submission of the block details
      this.closeModal();
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
                {{ vm.t('save-block') }}
            </button>
        </div>
    </modal-component>
    `,
});

module.exports = {
  SaveBlockModalComponent,
};
