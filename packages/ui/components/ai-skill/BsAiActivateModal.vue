<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import { CheckCircle2 } from 'lucide-vue';

export default {
  name: 'BsAiActivateModal',
  components: {
    BsModalConfirm,
    BsTextarea,
    LucideCheckCircle2: CheckCircle2,
  },
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      payload: { changelog: '', releaseNotes: '' },
    };
  },
  computed: {
    canSubmit() {
      return !!this.payload.changelog && !!this.payload.releaseNotes;
    },
  },
  methods: {
    open() {
      this.payload = { changelog: '', releaseNotes: '' };
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      if (!this.canSubmit) return;
      this.$emit('confirm', { ...this.payload });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.version.activateTitle')"
    :is-form="true"
    modal-width="500"
  >
    <v-form @submit.prevent="onSubmit">
      <p class="text-caption text--secondary mb-3">
        {{ $t('aiSkills.version.activateBody') }}
      </p>
      <bs-textarea
        v-model="payload.changelog"
        :label="$t('aiSkills.version.changelog')"
        :rows="2"
        :disabled="loading"
      />
      <bs-textarea
        v-model="payload.releaseNotes"
        :label="$t('aiSkills.version.releaseNotes')"
        :rows="2"
        :disabled="loading"
      />
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="!canSubmit"
        >
          <lucide-check-circle2 :size="18" class="mr-2" />
          {{ $t('aiSkills.version.activate') }}
        </v-btn>
      </div>
    </v-form>
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
