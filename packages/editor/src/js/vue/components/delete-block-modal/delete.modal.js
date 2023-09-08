const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { deletePersonalizedBlock } = require('../../utils/apis');
const axios = require('axios');
const styleHelper = require('../../utils/style/styleHelper');

const DeleteBlockModalComponent = Vue.component('DeleteBlockModal', {
  components: {
    ModalComponent,
  },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    blockId: null,
    blockName: '',
    isLoading: false,
    style: styleHelper,
  }),
  mounted() {
    this.vm.toggleDeleteBlockModal = this.handleToggleDeleteBlockModalChange;
  },
  computed: {
    disableDeleteButton() {
      return this.isLoading || !this.blockId;
    },
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.blockId = null;
      this.$refs.modalRef?.closeModal();
    },
    handleToggleDeleteBlockModalChange(value, blockContent) {
      const blockId = blockContent?.blockInformation?.id;
      this.blockName = blockContent?.blockInformation?.name;
      if (value === true) {
        this.openModal();
        this.blockId = blockId;
      } else {
        this.closeModal();
        this.blockId = null;
      }
    },
    handleOnSubmit() {
      this.isLoading = true;
      const groupId = this.vm?.metadata?.groupId;
      axios
        .delete(deletePersonalizedBlock(this.blockId), { params: { groupId } })
        .then(() => {
          this.vm.notifier.success(this.vm.t('delete-block-success'));
          this.isLoading = false;
          this.closeModal();
          const event = new Event('personalizedBlockApiActionApplied');
          window.dispatchEvent(event);
        })
        .catch(() => {
          this.vm.notifier.error(this.vm.t('delete-block-error'));
          this.isLoading = false;
        });
    },
  },
  template: `
  <modal-component ref="modalRef" :class="{ 'small-modal': true, 'error-modal': true }">
      <div class="modal-content" :onClose="closeModal">
        <div class="row">
          <div class="col s12">
            <h5>{{vm.t('title-delete-block')}}</h5>
          </div>
          <div class="col s12 small-text">
            <p>{{ vm.t('confirm-delete-block') }} <span class="bold-text">{{ blockName }}</span>?</p>
          </div>
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
          :disabled="disableDeleteButton"
          class="btn waves-effect waves-light error-button"
          type="submit"
          name="submitAction">
          <span v-if="isLoading">{{ vm.t('deleting-block') }}</span>
          <span v-else>{{ vm.t('delete-block') }}</span>
        </button>
      </div>
    </modal-component>
  `,
});

module.exports = {
  DeleteBlockModalComponent,
};
