<script>
import BsModalConfirm from '~/components/modal-confirm.vue';

export default {
  name: 'BsAiArchiveModal',
  components: { BsModalConfirm },
  props: {
    title: { type: String, required: true },
    body: { type: String, required: true },
    loading: { type: Boolean, default: false },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="title"
    :is-form="true"
    modal-width="450"
  >
    <p>{{ body }}</p>
    <v-divider class="mt-4" />
    <div class="modal-actions">
      <v-btn text color="primary" :disabled="loading" @click="close">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        color="error"
        elevation="0"
        :loading="loading"
        @click="$emit('confirm')"
      >
        {{ $t('aiSkills.actions.archive') }}
      </v-btn>
    </div>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
