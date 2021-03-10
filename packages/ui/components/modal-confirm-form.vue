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
  },
  data() {
    return {
      data: {},
      valid: true,
      nameRule: [
        (v) => v === this.data?.name || 'You need to provide the name',
      ],
    };
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
      this.$refs.form.reset();
      this.$refs.deleteDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="deleteDialog"
    :title="`${this.$t('global.delete')} ${data.name}`"
    :is-form="true"
  >
    <v-form ref="form" v-model="valid" @submit.prevent="submit">
      <slot />
      <v-checkbox
        v-if="confirmCheckBox"
        :rules="[(v) => !!v || 'You must agree to continue!']"
        :label="confirmCheckBoxMessage"
        required
      />
      <v-text-field
        :rules="nameRule"
        :label="confirmationInputLabel"
        required
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn type="submit" color="primary">
          {{ $t('global.delete') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
