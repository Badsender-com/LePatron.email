<script>
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'BsModalConfirmForm',
  components: {
    BsModalConfirm,
  },
  props: {
    confirmationInputLabel: { type: String, default: '' },
    confirmCheckBox: { type: Boolean, default: false },
    confirmCheckBoxMessage: { type: String, default: '' },
    withInputConfirmation: { type: Boolean, default: true },
  },
  data() {
    return {
      data: {},
      valid: true,
      nameRule: [
        (v) => v === this.data?.name || this.$t('forms.workspace.inputError'),
      ],
    };
  },
  computed: {
    confirmModalHeaderTitle() {
      return `${this.$t('global.delete')} ${this.data?.name}`;
    },
  },
  methods: {
    submit() {
      this.$refs.form.validate();
      if (this.valid) {
        this.close();
        this.$emit('confirm', this.data);
      }
    },
    open(item) {
      this.data = item;
      this.$refs.deleteDialog.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.deleteDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="deleteDialog"
    :title="confirmModalHeaderTitle"
    :is-form="true"
  >
    <v-form ref="form" v-model="valid" @submit.prevent="submit">
      <slot />
      <v-checkbox
        v-if="confirmCheckBox"
        :rules="[(v) => !!v || $t('forms.workspace.checkBoxError')]"
        :label="confirmCheckBoxMessage"
        required
      />
      <v-text-field
        v-if="withInputConfirmation"
        :rules="nameRule"
        :label="confirmationInputLabel"
        required
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn text color="primary" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn outline type="submit" color="error">
          {{ $t('global.delete') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
