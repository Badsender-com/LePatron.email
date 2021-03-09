<script>
export default {
  name: 'BsModalConfirmForm',
  props: {
    modelName: String,
  },
  data() {
    return {
      inputName: '',
      nameRule: [
        (v) => v === this.modalName || 'You need to provide the name', // this will have trads ofc
      ],
    };
  },
  methods: {
    submit(data) {
      this.close();
      this.$emit('action', data);
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="deleteDialogue"
    :title="`${this.$t('global.delete')}`"
    :action-label="$t('global.delete')"
    :is-form="true"
  >
    <v-form v-model="valid" @submit="submit">
      <v-divider />
      <v-card-actions>
        <v-text-field
          v-model="inputName"
          :rules="nameRule"
          :label="modelName"
          required
        />
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t(`global.cancel`) }}
        </v-btn>
        <v-btn type="submit" color="primary">
          {{ actionLabel }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
