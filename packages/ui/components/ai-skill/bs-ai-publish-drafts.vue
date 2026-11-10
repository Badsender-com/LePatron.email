<script>
import { mapMutations } from 'vuex';
import { CheckCircle2, Rocket, ShieldCheck } from 'lucide-vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsAiGuardCases from '~/components/ai-skill/bs-ai-guard-cases.vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { aiSkillsPublications } from '~/helpers/ai-skill-routes.js';
import {
  skillErrorMessage,
  skillWarningMessage,
} from '~/helpers/ai-skill-errors.js';
import { failedCount, notReplayedOf } from '~/helpers/publication-guard.js';
import {
  batchNeedsGuard,
  failureReasonKey,
  itemLabel,
  readItems,
  skipReasonKey,
  skippedOf,
} from '~/helpers/publish-drafts.js';

// Several drafts published at once from a list (ADR 0019): the server finds
// the draft of each selected item, one guard covers everything they touch
// when a feature uses one, then each is published and the report says how.
export default {
  name: 'BsAiPublishDrafts',
  components: {
    BsAiGuardCases,
    BsModalConfirm,
    LucideCheckCircle2: CheckCircle2,
    LucideRocket: Rocket,
    LucideShieldCheck: ShieldCheck,
  },
  props: {
    // The selection, as `{ kind, id }`.
    items: { type: Array, default: () => [] },
  },
  data() {
    return { plan: null, guard: null, report: null, busy: false, error: '' };
  },
  computed: {
    // The items published with a warning, as their own page tells it.
    warned() {
      return ((this.report || {}).published || []).filter(
        (p) => p.warnings && p.warnings.length
      );
    },
    targets() {
      return (this.plan && this.plan.targets) || [];
    },
    skipped() {
      return skippedOf(this.plan, this.report);
    },
    needsGuard() {
      return batchNeedsGuard(this.plan);
    },
    usedByLabel() {
      return ((this.plan && this.plan.usedBy) || [])
        .map((f) => f.description)
        .join(', ');
    },
    missing() {
      return (this.guard || this.plan || {}).missing || [];
    },
    failed() {
      return failedCount(this.guard);
    },
    notReplayed() {
      return notReplayedOf(this.guard || this.plan);
    },
  },
  methods: {
    // A draft left out because its publication would fail says why, with
    // the server's code when it gives one.
    skipText(item) {
      if (item.reason === 'failed' && item.message) {
        return skillErrorMessage(this, { response: { data: item } });
      }
      return this.$t(skipReasonKey(item.reason));
    },
    warningsOf(item) {
      return item.warnings.map((w) => skillWarningMessage(this, w)).join(' ');
    },
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    itemLabel,
    failureReasonKey,
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
    post(action, body = {}) {
      return this.call(() =>
        this.$axios.$post(aiSkillsPublications(action), {
          items: this.items,
          ...body,
        })
      );
    },
    async open() {
      Object.assign(this, { plan: null, guard: null, report: null });
      this.$refs.modal.open();
      this.plan = await this.post('plan');
    },
    async runGuard() {
      this.guard = await this.post('guard');
    },
    async publish() {
      const report = await this.post(null, {
        guardKey: this.guard ? this.guard.key : undefined,
        items: readItems(this.targets),
      });
      if (!report) return;
      this.report = report;
      this.$emit('published', report);
    },
    async cancel() {
      if (!(await this.post('cancel', { guardKey: this.guard.key }))) return;
      this.$refs.modal.close();
      this.showSnackbar({
        text: this.$t('aiSkills.publishDrafts.cancelled'),
        color: 'info',
      });
    },
  },
};
</script>

<template>
  <div v-if="items.length" class="bs-ai-publish-drafts">
    <v-btn outlined color="primary" class="text-none" @click="open">
      <lucide-rocket :size="16" class="mr-2" />
      {{ $t('aiSkills.publishDrafts.action') }}
    </v-btn>

    <bs-modal-confirm
      ref="modal"
      :title="$t('aiSkills.publishDrafts.title')"
      :is-form="true"
      modal-width="900"
    >
      <template v-if="report">
        <p class="text-body-2 font-weight-medium mb-2">
          {{ $t('aiSkills.publishDrafts.report') }}
        </p>
        <p v-if="report.published.length" class="text-body-2 mb-1">
          {{ $t('aiSkills.publishDrafts.publishedLabel') }}
          {{ report.published.map(itemLabel).join(', ') }}
        </p>
        <div v-if="warned.length" class="text-body-2 mb-1">
          {{ $t('aiSkills.publishDrafts.warnedLabel') }}
          <ul>
            <li v-for="p in warned" :key="`${p.kind}:${p.id}`">
              <code>{{ itemLabel(p) }}</code> — {{ warningsOf(p) }}
            </li>
          </ul>
        </div>
        <div v-if="report.failed.length" class="text-body-2 mb-1">
          {{ $t('aiSkills.publishDrafts.failedLabel') }}
          <ul>
            <li v-for="f in report.failed" :key="`${f.kind}:${f.id}`">
              <code>{{ itemLabel(f) }}</code> —
              {{ $t(failureReasonKey(f.reason)) }}
            </li>
          </ul>
        </div>
      </template>
      <template v-else-if="plan">
        <p class="text-body-2 mb-2">{{ $t('aiSkills.publishDrafts.intro') }}</p>
        <p v-if="!targets.length" class="text-body-2 mb-2">
          {{ $t('aiSkills.publishDrafts.nothing') }}
        </p>
        <p v-else class="text-body-2 mb-2">
          {{ $t('aiSkills.publishDrafts.targets', { count: targets.length }) }}
          {{ targets.map(itemLabel).join(', ') }}
        </p>
        <template v-if="targets.length">
          <template v-if="needsGuard">
            <p class="text-body-2 mb-1">
              {{
                $t('aiSkills.publicationGuard.usedBy', {
                  features: usedByLabel,
                })
              }}
            </p>
            <p v-if="!guard" class="text-caption text--secondary mb-1">
              {{
                $t('aiSkills.publicationGuard.calls', {
                  calls: plan.calls,
                  max: plan.maxCalls,
                })
              }}
            </p>
            <v-alert
              v-if="notReplayed"
              type="warning"
              dense
              outlined
              class="mt-2"
            >
              {{
                $t('aiSkills.publicationGuard.notReplayed', {
                  count: notReplayed,
                })
              }}
            </v-alert>
            <v-alert
              v-if="missing.length"
              type="warning"
              dense
              outlined
              class="mt-2"
            >
              {{
                $t('aiSkills.publicationGuard.missing', {
                  skills: missing.join(', '),
                })
              }}
            </v-alert>
          </template>
          <p v-else class="text-caption text--secondary mb-1">
            {{ $t('aiSkills.publishDrafts.noGuard') }}
          </p>
        </template>
        <bs-ai-guard-cases v-if="guard" :guard="guard" />
      </template>

      <div v-if="skipped.length" class="text-body-2 mt-2">
        {{ $t('aiSkills.publishDrafts.skippedLabel') }}
        <ul>
          <li v-for="s in skipped" :key="`${s.kind}:${s.id}`">
            <code>{{ s.id }}</code> — {{ skipText(s) }}
          </li>
        </ul>
      </div>

      <p v-if="error" class="text-caption error--text mt-2 mb-0">{{ error }}</p>
      <p v-if="busy && needsGuard && !guard" class="text-caption mb-0">
        {{ $t('aiSkills.publicationGuard.running') }}
      </p>

      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn
          v-if="report || !targets.length || !guard"
          text
          color="primary"
          :disabled="busy"
          @click="$refs.modal.close()"
        >
          {{
            report ? $t('aiSkills.publishDrafts.close') : $t('global.cancel')
          }}
        </v-btn>
        <v-btn v-else text color="primary" :disabled="busy" @click="cancel">
          {{ $t('aiSkills.publicationGuard.cancel') }}
        </v-btn>
        <template v-if="!report && targets.length">
          <v-btn
            v-if="needsGuard && !guard"
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
                : $t('aiSkills.publishDrafts.publish')
            }}
          </v-btn>
        </template>
      </div>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-publish-drafts {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
