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
    // Activation-impact section (expertise only — skills never pass these).
    showImpact: { type: Boolean, default: false },
    // Matches: [{ featureType, description, matchedFilter:{scope,categories,emailType} }].
    impact: { type: Array, default: () => [] },
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
    filterLabel(filter) {
      const parts = [];
      const scopes = Array.isArray(filter.scope)
        ? filter.scope
        : [filter.scope];
      if (scopes.length) parts.push(scopes.join('/'));
      if (filter.emailType) parts.push(filter.emailType);
      if (Array.isArray(filter.categories) && filter.categories.length) {
        parts.push(filter.categories.join('/'));
      }
      return parts.join(' / ');
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

      <v-alert
        v-if="showImpact"
        :type="impact.length ? 'info' : 'warning'"
        dense
        outlined
        class="mt-4 mb-0 text-caption"
      >
        <div class="font-weight-medium mb-1">
          {{ $t('aiSkills.expertise.impactTitle') }}
        </div>
        <template v-if="impact.length">
          <div>{{ $t('aiSkills.expertise.impactLoadedBy') }}</div>
          <ul class="impact-list">
            <li v-for="m in impact" :key="m.featureType">
              {{ m.description }} ({{ filterLabel(m.matchedFilter) }})
            </li>
          </ul>
        </template>
        <span v-else>{{ $t('aiSkills.expertise.impactNone') }}</span>
      </v-alert>

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
.impact-list {
  margin: 0.25rem 0 0;
  padding-left: 1.1rem;
}
</style>
