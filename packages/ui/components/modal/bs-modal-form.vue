<script>
/**
 * BsModalForm - Modal dialog for forms
 *
 * A standardized modal component for form dialogs that provides:
 * - Consistent title, content, and actions layout
 * - Loading state management
 * - Cancel and submit buttons with proper styling
 * - Proper spacing and design system compliance
 *
 * Usage:
 * <bs-modal-form
 *   ref="modal"
 *   :title="$t('modal.title')"
 *   :submit-label="$t('global.create')"
 *   :loading="isLoading"
 *   @submit="handleSubmit"
 *   @cancel="handleCancel"
 * >
 *   <bs-text-field v-model="name" label="Name" required />
 *   <bs-select v-model="status" :items="options" label="Status" />
 * </bs-modal-form>
 */
export default {
  name: 'BsModalForm',
  props: {
    /**
     * Modal title displayed in the header
     */
    title: { type: String, required: true },

    /**
     * Width of the modal (in pixels or CSS value)
     */
    width: { type: [String, Number], default: 500 },

    /**
     * Label for the submit button
     */
    submitLabel: { type: String, default: '' },

    /**
     * Label for the cancel button
     */
    cancelLabel: { type: String, default: '' },

    /**
     * Color of the submit button
     */
    submitColor: { type: String, default: 'accent' },

    /**
     * Loading state - disables form and shows loader on submit button
     */
    loading: { type: Boolean, default: false },

    /**
     * Whether the submit button is disabled (in addition to loading state)
     */
    submitDisabled: { type: Boolean, default: false },

    /**
     * Whether to show the submit button
     */
    showSubmit: { type: Boolean, default: true },

    /**
     * Whether clicking outside closes the modal
     */
    persistent: { type: Boolean, default: false },
  },
  data() {
    return {
      isOpen: false,
    };
  },
  computed: {
    computedSubmitLabel() {
      return this.submitLabel || this.$t('global.save');
    },
    computedCancelLabel() {
      return this.cancelLabel || this.$t('global.cancel');
    },
  },
  methods: {
    /**
     * Opens the modal
     */
    open() {
      this.isOpen = true;
      this.$emit('open');
    },

    /**
     * Closes the modal
     */
    close() {
      this.isOpen = false;
      this.$emit('close');
    },

    /**
     * Handles cancel action
     */
    onCancel() {
      this.$emit('cancel');
      this.close();
    },

    /**
     * Handles form submission
     */
    onSubmit() {
      this.$emit('submit');
    },
  },
};
</script>

<template>
  <v-dialog
    v-model="isOpen"
    :width="width"
    :persistent="persistent || loading"
    class="bs-modal-form"
  >
    <v-card class="bs-modal-form__card">
      <v-card-title class="bs-modal-form__title">
        {{ title }}
      </v-card-title>

      <v-card-text class="bs-modal-form__content">
        <form @submit.prevent="onSubmit">
          <slot />

          <div class="bs-modal-form__actions">
            <v-spacer />
            <v-btn
              text
              color="primary"
              :disabled="loading"
              @click="onCancel"
            >
              {{ computedCancelLabel }}
            </v-btn>
            <v-btn
              v-if="showSubmit"
              type="submit"
              :color="submitColor"
              elevation="0"
              :loading="loading"
              :disabled="loading || submitDisabled"
            >
              {{ computedSubmitLabel }}
            </v-btn>
          </div>
        </form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
.bs-modal-form {
  &__card {
    border-radius: 8px;
  }

  &__title {
    font-size: 1.25rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    padding: 1.25rem 1.5rem 0.75rem;
  }

  &__content {
    padding: 0.5rem 1.5rem 1.25rem !important;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 1rem;
    margin-top: 0.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    gap: 0.5rem;
  }
}
</style>
