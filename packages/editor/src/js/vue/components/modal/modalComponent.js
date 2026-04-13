const Vue = require('vue/dist/vue.common');

/**
 * ModalComponent - Vuetify-style modal for the editor
 *
 * A modernized modal component that provides:
 * - Consistent design with admin panel (Vuetify v-dialog style)
 * - Loading state with spinner
 * - Backdrop click handling
 * - Keyboard escape to close
 * - Smooth transitions
 *
 * Usage:
 * <modal-component ref="modalRef" :onClose="handleClose" :isLoading="loading">
 *   <div class="modal-content">...</div>
 *   <div class="modal-footer">...</div>
 * </modal-component>
 */
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
    persistent: {
      type: Boolean,
      default: false,
    },
    maxWidth: {
      type: [String, Number],
      default: 560,
    },
  },
  data: () => ({
    isOpen: false,
  }),
  computed: {
    modalStyle() {
      if (this.isFullWidth) {
        return {
          width: '90%',
          maxWidth: '95%',
        };
      }
      return {
        width: '100%',
        maxWidth: typeof this.maxWidth === 'number' ? `${this.maxWidth}px` : this.maxWidth,
      };
    },
  },
  mounted() {
    // Listen for escape key
    document.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleKeydown);
  },
  methods: {
    openModal() {
      this.isOpen = true;
      this.$emit('open');
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    },
    closeModal() {
      this.isOpen = false;
      this.$emit('close');
      document.body.style.overflow = '';
      if (typeof this.onClose === 'function') {
        this.onClose();
      }
    },
    handleBackdropClick() {
      if (!this.persistent && !this.isLoading) {
        this.closeModal();
      }
    },
    handleKeydown(e) {
      if (e.key === 'Escape' && this.isOpen && !this.persistent && !this.isLoading) {
        this.closeModal();
      }
    },
  },
  template: `
    <transition name="bs-modal-fade">
      <div v-if="isOpen" class="bs-modal-overlay" @click.self="handleBackdropClick">
        <div class="bs-modal-container" :style="modalStyle">
          <div class="bs-modal-card">
            <!-- Loading state -->
            <div v-if="isLoading" class="bs-modal-loading">
              <div class="bs-modal-spinner">
                <svg class="bs-modal-spinner-svg" viewBox="0 0 50 50">
                  <circle class="bs-modal-spinner-circle" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
                </svg>
              </div>
            </div>
            <!-- Content -->
            <div v-else class="bs-modal-content-wrapper">
              <slot />
            </div>
          </div>
        </div>
      </div>
    </transition>
  `,
});

module.exports = {
  ModalComponent,
};
