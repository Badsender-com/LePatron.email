<script>
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'BsModalConfirmForm',
  components: {
    BsModalConfirm,
  },
  props: {
    confirmationInputLabel: { type: String, default: '' },
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
        // Reset the data
        this.data = {};
      }
    },
    open(item) {
      this.data = item;
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
    :title="`${this.$t('global.delete')} ${data.name}`"
    :is-form="true"
  >
    <v-form ref="form" v-model="valid" @submit.prevent="submit">
      <slot />
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
