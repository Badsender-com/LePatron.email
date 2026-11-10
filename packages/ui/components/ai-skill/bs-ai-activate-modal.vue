<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsAiOpenExpertisesChoice from '~/components/ai-skill/bs-ai-open-expertises-choice.vue';
import { openingPayload } from '~/helpers/ai-skill-audience-change.js';
import { CheckCircle2 } from 'lucide-vue';

export default {
  name: 'BsAiActivateModal',
  components: {
    BsModalConfirm,
    BsTextarea,
    BsAiOpenExpertisesChoice,
    LucideCheckCircle2: CheckCircle2,
  },
  props: {
    loading: { type: Boolean, default: false },
    // Activation-impact section (expertise only — skills never pass these).
    showImpact: { type: Boolean, default: false },
    // Matches: [{ featureType, description, matchedFilter:{scope,categories,emailType} }].
    impact: { type: Array, default: () => [] },
    // Changelog / release notes are mandatory for a major version, optional for
    // a minor (both go through this modal so the impact alert always shows).
    isMajor: { type: Boolean, default: true },
    // The item is still used by the platform company only (ADR 0013):
    // publishing does not open it, so the modal says so and offers to.
    platformOnly: { type: Boolean, default: false },
    // What the version consumes kept to the platform company, offered to
    // open with the item: [{ expertiseId, title }] (a task skill only).
    platformOnlyExpertises: { type: Array, default: () => [] },
    // On a copy, an item not kept on it (ADR 0019): publishing it here keeps
    // it on the copy unless the person unticks the box.
    offerKeepOnCopy: { type: Boolean, default: false },
    // The item came from production: unticked, the next follow takes the
    // version published here out of it. One written on the copy leaves it
    // only when production has an item of the same id.
    itemFollowed: { type: Boolean, default: false },
  },
  data() {
    return {
      payload: { changelog: '', releaseNotes: '' },
      openToAll: false,
      openExpertiseIds: [],
      keepOnCopy: true,
    };
  },
  computed: {
    keepOnCopyText() {
      if (this.keepOnCopy) return this.$t('aiSkills.copy.publishKept');
      return this.itemFollowed
        ? this.$t('aiSkills.copy.publishFollowed')
        : this.$t('aiSkills.copy.publishLocal');
    },
    canSubmit() {
      if (!this.isMajor) return true;
      return !!this.payload.changelog && !!this.payload.releaseNotes;
    },
  },
  methods: {
    // `seed` is the DRAFT version being activated: its changelog / release
    // notes pre-fill the fields (still editable — the value confirmed here is
    // what gets persisted at activation).
    open(seed) {
      this.payload = {
        changelog: (seed && seed.changelog) || '',
        releaseNotes: (seed && seed.releaseNotes) || '',
      };
      this.openToAll = false;
      this.openExpertiseIds = [];
      this.keepOnCopy = true;
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      if (!this.canSubmit) return;
      // Published and opened in one request, with the expertises chosen.
      this.$emit('confirm', {
        ...this.payload,
        ...openingPayload(
          this.platformOnly && this.openToAll,
          this.openExpertiseIds,
          this.platformOnlyExpertises
        ),
        ...(this.offerKeepOnCopy ? { keepOnCopy: this.keepOnCopy } : {}),
      });
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
        {{
          isMajor
            ? $t('aiSkills.version.activateBody')
            : $t('aiSkills.version.activateBodyMinor')
        }}
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

      <v-alert
        v-if="platformOnly"
        type="info"
        dense
        outlined
        class="mt-4 mb-0 text-caption"
      >
        {{
          openToAll
            ? $t('aiSkills.version.openToAllNotice')
            : $t('aiSkills.version.platformOnlyReminder')
        }}
        <v-checkbox
          v-model="openToAll"
          :label="$t('aiSkills.version.openToAll')"
          :disabled="loading"
          dense
          hide-details
          class="mt-1"
        />
      </v-alert>
      <bs-ai-open-expertises-choice
        v-if="platformOnly && openToAll"
        v-model="openExpertiseIds"
        :expertises="platformOnlyExpertises"
        :disabled="loading"
      />

      <v-alert
        v-if="offerKeepOnCopy"
        type="info"
        dense
        outlined
        class="mt-4 mb-0 text-caption bs-ai-activate-keep"
      >
        <v-checkbox
          :input-value="keepOnCopy"
          :label="$t('aiSkills.copy.keep')"
          :disabled="loading"
          dense
          hide-details
          class="mt-0"
          @change="keepOnCopy = $event === true"
        />
        <p class="mb-0 mt-1 bs-ai-activate-keep__explain">
          {{ keepOnCopyText }}
        </p>
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
