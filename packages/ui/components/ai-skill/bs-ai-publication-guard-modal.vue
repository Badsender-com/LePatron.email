<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import { CheckCircle2, ShieldCheck } from 'lucide-vue';
import { aiVersionAction } from '~/helpers/ai-skill-routes.js';
import { skillErrorMessage } from '~/helpers/ai-skill-errors.js';
import BsAiGuardCases from '~/components/ai-skill/bs-ai-guard-cases.vue';
import { failedCount } from '~/helpers/publication-guard.js';

// The publication guard (ADR 0019): opened when the server asks for it on a
// version a feature uses. Says what it would replay, replays it on demand,
// shows each case before and after, then publishes or records the cancel.
export default {
  name: 'BsAiPublicationGuardModal',
  components: {
    BsAiGuardCases,
    BsModalConfirm,
    LucideCheckCircle2: CheckCircle2,
    LucideShieldCheck: ShieldCheck,
  },
  props: {
    kind: { type: String, required: true },
    entityId: { type: String, required: true },
  },
  data() {
    return {
      version: null,
      payload: {},
      plan: { usedBy: [], calls: 0, missing: [] },
      guard: null,
      busy: false,
      error: '',
    };
  },
  computed: {
    usedByLabel() {
      return this.plan.usedBy.map((f) => f.description).join(', ');
    },
    missing() {
      return (this.guard || this.plan).missing || [];
    },
    failed() {
      return failedCount(this.guard);
    },
  },
  methods: {
    open({ version, payload, plan }) {
      Object.assign(this, {
        version,
        payload: payload || {},
        plan,
        guard: null,
        busy: false,
        error: '',
      });
      this.$refs.modal.open();
    },
    route(action) {
      return aiVersionAction(
        this.kind,
        this.entityId,
        this.version.versionMajor,
        this.version.versionMinor,
        action
      );
    },
    async call(run) {
      this.busy = true;
      this.error = '';
      try {
        return await run();
      } catch (err) {
        this.error = skillErrorMessage(this, err);
        return null;
      } finally {
        this.busy = false;
      }
    },
    async runGuard() {
      this.guard = await this.call(() =>
        this.$axios.$post(this.route('guard'))
      );
    },
    async publish() {
      const doc = await this.call(() =>
        this.$axios.$post(this.route('activate'), {
          ...this.payload,
          guardKey: this.guard.key,
        })
      );
      if (!doc) return;
      this.$refs.modal.close();
      this.$emit('published', doc);
    },
    async cancel() {
      const doc = await this.call(() =>
        this.$axios.$post(this.route('cancel-publication'), {
          guardKey: this.guard.key,
        })
      );
      if (!doc) return;
      this.$refs.modal.close();
      this.$emit('cancelled', doc);
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.publicationGuard.title')"
    :is-form="true"
    modal-width="900"
  >
    <p class="text-body-2 mb-2">{{ $t('aiSkills.publicationGuard.intro') }}</p>
    <p class="text-body-2 mb-1">
      {{ $t('aiSkills.publicationGuard.usedBy', { features: usedByLabel }) }}
    </p>
    <p v-if="!guard" class="text-caption text--secondary mb-1">
      {{ $t('aiSkills.publicationGuard.calls', { calls: plan.calls }) }}
    </p>
    <v-alert v-if="missing.length" type="warning" dense outlined class="mt-2">
      {{
        $t('aiSkills.publicationGuard.missing', { skills: missing.join(', ') })
      }}
    </v-alert>

    <bs-ai-guard-cases v-if="guard" :guard="guard" />

    <p v-if="error" class="text-caption error--text mt-2 mb-0">{{ error }}</p>

    <v-divider class="mt-4" />
    <div class="modal-actions">
      <v-btn
        v-if="!guard"
        text
        color="primary"
        :disabled="busy"
        @click="$refs.modal.close()"
      >
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn v-else text color="primary" :disabled="busy" @click="cancel">
        {{ $t('aiSkills.publicationGuard.cancel') }}
      </v-btn>
      <v-btn
        v-if="!guard"
        color="accent"
        elevation="0"
        :loading="busy"
        @click="runGuard"
      >
        <lucide-shield-check :size="18" class="mr-2" />
        {{ $t('aiSkills.publicationGuard.run') }}
      </v-btn>
      <v-btn
        v-else
        color="accent"
        elevation="0"
        :loading="busy"
        @click="publish"
      >
        <lucide-check-circle2 :size="18" class="mr-2" />
        {{
          failed
            ? $t('aiSkills.publicationGuard.publishAnyway')
            : $t('aiSkills.publicationGuard.publish')
        }}
      </v-btn>
    </div>
    <p v-if="busy && !guard" class="text-caption text--secondary mb-0">
      {{ $t('aiSkills.publicationGuard.running') }}
    </p>
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
