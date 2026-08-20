<script>
// Parent owns the skill object and accepts in-place edits via v-model on the
// individual version fields. See BsAiSkillDetailsForm for rationale.
/* eslint-disable vue/no-mutating-props */
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { aiSkillSchemaDescriptor } from '~/helpers/ai-skill-routes.js';
import copyToClipboard from '~/helpers/copy-to-clipboard.js';
import { Plus, CheckCircle2, Check, Copy, Trash2 } from 'lucide-vue';

// How long a copied chip keeps its confirmation mark.
const COPIED_FEEDBACK_MS = 1500;

export default {
  name: 'BsAiSkillVersionsPanel',
  components: {
    BsTextarea,
    BsSelect,
    LucidePlus: Plus,
    LucideCheck: Check,
    LucideCheckCircle2: CheckCircle2,
    LucideCopy: Copy,
    LucideTrash2: Trash2,
  },
  props: {
    skill: { type: Object, required: true },
    saving: { type: Boolean, default: false },
    // Schema ids from the zod registry — schemas are versioned (UX review §3).
    schemas: { type: Array, default: () => [] },
    // "major.minor" of the version to expand on load (create flow lands here
    // with the seeded v1.0 DRAFT open — §B2).
    autoExpandVersion: { type: String, default: null },
    // Coherence warnings shown inline next to the concerned version's action
    // row (§1.1), so they are visible where the buttons are.
    warnings: { type: Array, default: () => [] },
    warningsVersionKey: { type: String, default: null },
  },
  data() {
    return {
      openPanel: null,
      // schemaId → descriptor|null, populated lazily to power the placeholder
      // helper (§C2). Null means "unknown / failed to load".
      descriptorCache: {},
      // Held in JS (not inline in the template): a literal `}}` inside a
      // mustache expression breaks the Vue template parser.
      expertiseToken: '{{input.expertise}}',
      // Token of the placeholder chip just copied, and whether the copy
      // failed — the panel has no access to the page snackbar, so the feedback
      // is local to the chip row.
      copiedToken: null,
      copyFailed: false,
    };
  },
  computed: {
    hasActive() {
      const av = this.skill && this.skill.activeVersion;
      return !!(av && av.major != null);
    },
    inputSchemas() {
      return this.schemas.filter((s) => /Input$/.test(s));
    },
    outputSchemas() {
      return this.schemas.filter((s) => /Output$/.test(s));
    },
    sortedVersions() {
      return [...(this.skill.versions || [])].sort((a, b) => {
        if (b.versionMajor !== a.versionMajor) {
          return b.versionMajor - a.versionMajor;
        }
        return b.versionMinor - a.versionMinor;
      });
    },
    // Watched as a stable string so a change to any version's input schema
    // triggers a descriptor (re)load.
    inputSchemaIds() {
      return this.sortedVersions.map((v) => v.inputSchemaId || '').join(',');
    },
  },
  watch: {
    inputSchemaIds() {
      this.ensureDescriptors();
    },
  },
  mounted() {
    this.ensureDescriptors();
    if (this.autoExpandVersion) {
      const idx = this.sortedVersions.findIndex(
        (v) => this.versionLabel(v) === this.autoExpandVersion
      );
      if (idx >= 0) this.openPanel = idx;
    }
  },
  beforeDestroy() {
    clearTimeout(this.copiedTimer);
  },
  methods: {
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
    versionLabel(v) {
      return `${v.versionMajor}.${v.versionMinor}`;
    },
    statusLabel(v) {
      return this.$t(`aiSkills.statuses.${v.status}`);
    },
    statusColor(v) {
      return v.status === 'ACTIVE'
        ? 'success'
        : v.status === 'ARCHIVED'
        ? 'grey'
        : 'warning';
    },
    ensureDescriptors() {
      const ids = new Set(
        this.sortedVersions.map((v) => v.inputSchemaId).filter(Boolean)
      );
      ids.forEach((id) => this.loadDescriptor(id));
    },
    async loadDescriptor(schemaId) {
      if (!schemaId || schemaId in this.descriptorCache) return;
      // Reserve the slot so concurrent expansions don't double-fetch.
      this.$set(this.descriptorCache, schemaId, null);
      try {
        const d = await this.$axios.$get(aiSkillSchemaDescriptor(schemaId));
        this.$set(this.descriptorCache, schemaId, d);
      } catch (e) {
        this.$set(this.descriptorCache, schemaId, null);
      }
    },
    // Placeholders usable in the skill body / input template, derived from the
    // version's input-schema descriptor (§C2). Returns null while the
    // descriptor is loading or unknown, so the helper block stays hidden.
    placeholdersFor(v) {
      const d = v.inputSchemaId && this.descriptorCache[v.inputSchemaId];
      if (!d) return null;
      const tokens = (d.fields || []).map((f) => ({
        token: `{{input.${f.name}}}`,
        required: !!f.required,
      }));
      if (d.hasExpertiseField) {
        tokens.push({ token: '{{input.expertise}}', required: false });
      }
      return tokens.length ? tokens : null;
    },
    // The placeholders are only ever valid in the input template (the schema's
    // pre('validate') hook rejects them in systemPrompt / skillBody), so the
    // chips just hand the token over — there is no ambiguity about the target
    // field, and nothing to retype by hand.
    async copyPlaceholder(token) {
      const copied = await copyToClipboard(token);
      clearTimeout(this.copiedTimer);
      this.copyFailed = !copied;
      this.copiedToken = copied ? token : null;
      if (copied) {
        this.copiedTimer = setTimeout(() => {
          this.copiedToken = null;
        }, COPIED_FEEDBACK_MS);
      }
    },
    hasExpertiseFor(v) {
      const d = v.inputSchemaId && this.descriptorCache[v.inputSchemaId];
      return !!(d && d.hasExpertiseField);
    },
    warningsFor(v) {
      if (this.versionLabel(v) !== this.warningsVersionKey) return [];
      return this.warnings || [];
    },
  },
};
</script>

<template>
  <div>
    <div class="d-flex justify-end mb-3" style="gap: 0.5rem">
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <span v-bind="attrs" v-on="on">
            <v-btn
              outlined
              color="primary"
              :disabled="!hasActive"
              @click="$emit('create-minor')"
            >
              <lucide-plus :size="18" class="mr-2" />
              {{ $t('aiSkills.version.newMinor') }}
            </v-btn>
          </span>
        </template>
        <span>{{ $t('aiSkills.version.newMinorHint') }}</span>
      </v-tooltip>
      <v-tooltip top>
        <template #activator="{ on, attrs }">
          <v-btn
            color="accent"
            elevation="0"
            v-bind="attrs"
            v-on="on"
            @click="$emit('create-major')"
          >
            <lucide-plus :size="18" class="mr-2" />
            {{ $t('aiSkills.version.newMajor') }}
          </v-btn>
        </template>
        <span>{{ $t('aiSkills.version.newMajorHint') }}</span>
      </v-tooltip>
    </div>
    <v-card outlined>
      <v-expansion-panels v-model="openPanel" accordion flat>
        <v-expansion-panel
          v-for="v in sortedVersions"
          :key="`${v.versionMajor}.${v.versionMinor}`"
        >
          <v-expansion-panel-header>
            <div class="d-flex align-center" style="gap: 0.5rem">
              <span class="font-weight-medium">v{{ versionLabel(v) }}</span>
              <v-chip
                x-small
                :color="statusColor(v)"
                :outlined="v.status !== 'ACTIVE'"
                :dark="v.status === 'ACTIVE'"
              >
                {{ statusLabel(v) }}
              </v-chip>
              <span class="text-caption text--secondary">
                {{ formatDate(v.updatedAt || v.createdAt) }}
              </span>
              <span
                v-if="v.changelog"
                class="text-caption text--secondary text-truncate version-changelog"
              >
                — {{ v.changelog }}
              </span>
              <v-spacer />
              <v-tooltip left>
                <template #activator="{ on, attrs }">
                  <v-btn
                    icon
                    small
                    v-bind="attrs"
                    v-on="on"
                    @click.stop="$emit('duplicate', v)"
                  >
                    <lucide-copy :size="16" />
                  </v-btn>
                </template>
                <span>{{ $t('aiSkills.version.duplicateHint') }}</span>
              </v-tooltip>
            </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <div class="schema-row">
              <bs-select
                v-model="v.inputSchemaId"
                :items="inputSchemas"
                :label="$t('aiSkills.skill.inputSchemaId')"
                :readonly="v.status !== 'DRAFT'"
                :disabled="v.status !== 'DRAFT'"
              />
              <bs-select
                v-model="v.outputSchemaId"
                :items="outputSchemas"
                :label="$t('aiSkills.skill.outputSchemaId')"
                :readonly="v.status !== 'DRAFT'"
                :disabled="v.status !== 'DRAFT'"
              />
            </div>
            <p class="text-caption text--secondary schema-help">
              {{ $t('aiSkills.version.schemasHelp') }}
            </p>
            <bs-textarea
              v-model="v.systemPrompt"
              :label="$t('aiSkills.version.systemPrompt')"
              :rows="3"
              :readonly="v.status !== 'DRAFT'"
              monospace
            />
            <bs-textarea
              v-model="v.skillBody"
              :label="$t('aiSkills.version.skillBody')"
              :rows="5"
              :readonly="v.status !== 'DRAFT'"
              monospace
            />
            <p class="text-caption text--secondary output-format-note">
              {{ $t('aiSkills.version.outputFormatNote') }}
            </p>
            <bs-textarea
              v-model="v.inputTemplate"
              :label="$t('aiSkills.version.inputTemplate')"
              :rows="3"
              :readonly="v.status !== 'DRAFT'"
              monospace
            />
            <div v-if="placeholdersFor(v)" class="placeholder-help mb-3">
              <span class="text-caption text--secondary">
                {{ $t('aiSkills.version.placeholdersHelp') }}
              </span>
              <div class="mt-1">
                <v-chip
                  v-for="p in placeholdersFor(v)"
                  :key="p.token"
                  x-small
                  label
                  outlined
                  class="mr-1 mb-1 placeholder-chip"
                  :title="$t('aiSkills.version.placeholderCopyHint')"
                  @click="copyPlaceholder(p.token)"
                >
                  <code>{{ p.token }}</code>
                  <span v-if="p.required" class="placeholder-required ml-1">
                    *
                  </span>
                  <lucide-check
                    v-if="copiedToken === p.token"
                    :size="12"
                    class="ml-1 placeholder-copied"
                  />
                </v-chip>
              </div>
              <span
                v-if="copyFailed"
                class="text-caption placeholder-copy-failed"
              >
                {{ $t('aiSkills.version.placeholderCopyFailed') }}
              </span>
              <span class="text-caption text--disabled">
                {{ $t('aiSkills.version.placeholdersRequiredHint') }}
              </span>
              <p class="text-caption text--secondary mt-1 mb-0">
                {{ $t('aiSkills.version.placeholdersInvocationNote') }}
                <template v-if="hasExpertiseFor(v)">
                  {{
                    $t('aiSkills.version.placeholdersExpertiseNote', {
                      token: expertiseToken,
                    })
                  }}
                </template>
              </p>
            </div>
            <bs-textarea
              v-if="v.status === 'DRAFT'"
              v-model="v.changelog"
              :label="$t('aiSkills.version.changelog')"
              :placeholder="$t('aiSkills.version.changelogPlaceholder')"
              :rows="2"
            />
            <bs-textarea
              v-if="v.status === 'DRAFT'"
              v-model="v.releaseNotes"
              :label="$t('aiSkills.version.releaseNotes')"
              :placeholder="$t('aiSkills.version.releaseNotesPlaceholder')"
              :rows="2"
            />
            <v-alert
              v-for="(warning, i) in warningsFor(v)"
              :key="`warn-${i}`"
              type="warning"
              dense
              outlined
              class="mt-3 mb-0"
            >
              {{ warning }}
            </v-alert>
            <div
              v-if="v.status === 'DRAFT'"
              class="d-flex justify-end mt-2"
              style="gap: 0.5rem"
            >
              <v-btn
                text
                color="error"
                :loading="saving"
                @click="$emit('delete', v)"
              >
                <lucide-trash2 :size="18" class="mr-2" />
                {{ $t('aiSkills.version.deleteDraft') }}
              </v-btn>
              <v-btn
                text
                color="primary"
                :loading="saving"
                @click="$emit('save', { version: v })"
              >
                {{ $t('aiSkills.version.saveDraft') }}
              </v-btn>
              <v-btn
                color="accent"
                elevation="0"
                :loading="saving"
                @click="$emit('activate', v)"
              >
                <lucide-check-circle2 :size="18" class="mr-2" />
                {{ $t('aiSkills.version.publish') }}
              </v-btn>
            </div>
            <p v-else class="text-caption text--secondary mt-2">
              {{ $t('aiSkills.version.readOnlyHint') }}
            </p>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>
  </div>
</template>

<style lang="scss" scoped>
.version-changelog {
  max-width: 320px;
}
.schema-row {
  display: flex;
  gap: 0.75rem;

  > * {
    flex: 1;
  }
}
.output-format-note {
  margin: -0.25rem 0 0.75rem;
}
.schema-help {
  margin: -0.25rem 0 0.75rem;
}
.placeholder-help {
  margin-top: -0.25rem;

  code {
    font-size: 0.72rem;
    background: none;
    padding: 0;
  }
}
.placeholder-required {
  color: var(--v-error-base, #d32f2f);
  font-weight: 600;
}
.placeholder-chip {
  cursor: pointer;
}
.placeholder-copied {
  color: var(--v-success-base, #4caf50);
}
.placeholder-copy-failed {
  display: block;
  color: var(--v-error-base, #d32f2f);
}
</style>
