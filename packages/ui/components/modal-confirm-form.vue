<script>
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field';

export default {
  name: 'BsModalConfirmForm',
  components: {
    BsModalConfirm,
    BsTextField,
  },
  props: {
    title: { type: String, default: '' },
    actionLabel: { type: String, default: '' },
    confirmationInputLabel: { type: String, default: '' },
    confirmCheckBox: { type: Boolean, default: false },
    confirmCheckBoxMessage: { type: String, default: '' },
    withInputConfirmation: { type: Boolean, default: true },
  },
  data() {
    return {
      data: {},
      confirmationInput: '',
      checkboxConfirmed: false,
    };
  },
  computed: {
    modalTitle() {
      return this.title || this.$t('global.delete');
    },
    buttonLabel() {
      return this.actionLabel || this.$t('global.delete');
    },
    inputError() {
      if (!this.confirmationInput) return '';
      if (this.confirmationInput !== this.data?.name) {
        return this.$t('forms.workspace.inputError');
      }
      return '';
    },
    checkboxError() {
      // Only show error after user interaction
      return '';
    },
    isValid() {
      const inputValid =
        !this.withInputConfirmation ||
        this.confirmationInput === this.data?.name;
      const checkboxValid = !this.confirmCheckBox || this.checkboxConfirmed;
      return inputValid && checkboxValid;
    },
  },
  methods: {
    submit() {
      if (this.isValid) {
        this.close();
        this.$emit('confirm', this.data);
      }
    },
    open(item) {
      this.data = item;
      this.confirmationInput = '';
      this.checkboxConfirmed = false;
      this.$refs.deleteDialog.open();
    },
    close() {
      this.$refs.deleteDialog.close();
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="deleteDialog"
    :title="modalTitle"
    :is-form="true"
  >
    <form @submit.prevent="submit">
      <slot />

      <v-checkbox
        v-if="confirmCheckBox"
        v-model="checkboxConfirmed"
        :label="confirmCheckBoxMessage"
        hide-details="auto"
        class="mt-4"
      />

      <bs-text-field
        v-if="withInputConfirmation"
        v-model="confirmationInput"
        :label="confirmationInputLabel"
        :error-messages="inputError"
        class="mt-4"
      />

      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="error"
          elevation="0"
          :disabled="!isValid"
        >
          {{ buttonLabel }}
        </v-btn>
      </div>
    </form>
  </bs-modal-confirm>
</template>

<style scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
