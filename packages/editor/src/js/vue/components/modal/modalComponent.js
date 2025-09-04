const Vue = require('vue/dist/vue.common');

const ModalComponent = Vue.component('ModalComponent', {
  props: {
    isLoading: {
      type: Boolean,
      default: false,
    },
    onClose: {
      type: Function,
      default: () => {},
    },
    isFullWidth: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    modalInstance: null,
  }),
  mounted() {
    const modalRef = this.$refs.modalRef;
    const options = {
      dismissible: false,
    };
    this.modalInstance = M.Modal.init(modalRef, options);
  },
  methods: {
    openModal() {
      this.modalInstance?.open();
    },
    closeModal() {
      this.modalInstance?.close();
      if (typeof this.onClose === 'function') {
        this.onClose();
      }
    },
  },
  template: `
    <div>
      <div class="material-css">
        <div id="modal1" class="modal modal-fixed-footer" ref="modalRef" :style="isFullWidth
            ? { width: '100%', maxWidth: '100%', height: '90%' }
            : { width: '', maxWidth: '', height: '90%' }">
          <div class="valign-wrapper" :style="{    height: '100%', justifyContent: 'center'}" v-if="isLoading">
            <div class="preloader-wrapper small active">
                <div class="spinner-layer spinner-green-only">
                  <div class="circle-clipper left">
                    <div class="circle"></div>
                  </div><div class="gap-patch">
                  <div class="circle"></div>
                </div><div class="circle-clipper right">
                  <div class="circle"></div>
                </div>
                </div>
              </div>
          </div>
            <slot v-else/>
        </div>
      </div>
    </div>
    `,
});

module.exports = {
  ModalComponent,
};
