<script>
// The page owns the skill object; this panel edits its own drafts and hands a
// merged version back on save / publish (see mixin-version-drafts).
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTimestamp from '~/components/bs-timestamp.vue';
import { skillWarningMessage } from '~/helpers/ai-skill-errors.js';
import { missingSchemaIds } from '~/helpers/ai-skill-schemas.js';
import mixinVersionDrafts from '~/helpers/mixins/mixin-version-drafts.js';
import mixinSchemaDescriptors from '~/helpers/mixins/mixin-schema-descriptors.js';
import BsAiSkillFeatureVersionFields from '~/components/ai-skill/bs-ai-skill-feature-version-fields.vue';
import BsAiSkillTaskVersionFields from '~/components/ai-skill/bs-ai-skill-task-version-fields.vue';
import {
  SKILL_NATURES,
  SKILL_NATURE_VALUES,
} from '~/helpers/ai-skill-categories.js';
import BsAiSkillTestCases from '~/components/ai-skill/bs-ai-skill-test-cases.vue';
import { casesForNature } from '~/helpers/ai-skill-test-cases.js';
import { Plus, CheckCircle2, Copy, Trash2 } from 'lucide-vue';

// What the version editor lets one change on a DRAFT.
const EDITABLE_FIELDS = Object.freeze([
  'nature',
  'inputSchemaId',
  'outputSchemaId',
  'systemPrompt',
  'skillBody',
  'inputTemplate',
  'procedure',
  'consumedExpertiseIds',
  'testCases',
  'changelog',
  'releaseNotes',
]);

export default {
  name: 'BsAiSkillVersionsPanel',
  components: {
    BsTextarea,
    BsSelect,
    BsTimestamp,
    BsAiSkillFeatureVersionFields,
    BsAiSkillTaskVersionFields,
    BsAiSkillTestCases,
    LucidePlus: Plus,
    LucideCheckCircle2: CheckCircle2,
    LucideCopy: Copy,
    LucideTrash2: Trash2,
  },
  mixins: [mixinVersionDrafts, mixinSchemaDescriptors],
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
    return { openPanel: null };
  },
  computed: {
    // Consumed by mixin-version-drafts.
    versionsSource() {
      return this.skill.versions;
    },
    activeVersionRef() {
      return this.skill && this.skill.activeVersion;
    },
    editableVersionFields() {
      return EDITABLE_FIELDS;
    },
    natureOptions() {
      return SKILL_NATURE_VALUES.map((value) => ({
        value,
        text: this.$t(`aiSkills.natures.${value}`),
      }));
    },
  },
  mounted() {
    if (this.autoExpandVersion) {
      const idx = this.sortedVersions.findIndex(
        (v) => this.versionLabel(v) === this.autoExpandVersion
      );
      if (idx >= 0) this.openPanel = idx;
    }
  },
  methods: {
    casesForNature,
    // The nature is the version's (ADR 0013): a task skill's version has a
    // procedure instead of a template and schemas. One stored before natures
    // were versioned is a feature skill's.
    isTask(v) {
      const draft = this.draftFor(v);
      return ((draft && draft.nature) || v.nature) === SKILL_NATURES.TASK;
    },
    // A draft naming a schema the code of this instance lacks keeps a badge
    // until the code has it (ADR 0019).
    lacksSchema(v) {
      return missingSchemaIds(this.draftFor(v) || v, this.schemas).length > 0;
    },
    // The server sends warning codes; the wording lives in the locales.
    warningsFor(v) {
      if (this.versionLabel(v) !== this.warningsVersionKey) return [];
      return (this.warnings || []).map((w) => skillWarningMessage(this, w));
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
              <bs-timestamp :value="v.updatedAt || v.createdAt" />
              <v-chip
                v-if="lacksSchema(v)"
                x-small
                outlined
                color="warning"
                class="version-schema-missing"
                :title="$t('aiSkills.version.schemaMissingHint')"
              >
                {{ $t('aiSkills.version.schemaMissing') }}
              </v-chip>
              <v-chip
                v-if="isVersionDirty(v)"
                x-small
                outlined
                color="warning"
                class="version-dirty"
              >
                {{ $t('aiSkills.version.unsavedChanges') }}
              </v-chip>
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
            <bs-select
              v-model="draftFor(v).nature"
              :items="natureOptions"
              item-text="text"
              item-value="value"
              :label="$t('aiSkills.nature')"
              :hint="$t('aiSkills.natureHint')"
              persistent-hint
              :readonly="v.status !== 'DRAFT'"
              :disabled="v.status !== 'DRAFT'"
              class="mb-3"
              @input="
                draftFor(v).testCases = casesForNature(
                  $event,
                  draftFor(v).testCases
                )
              "
            />
            <bs-ai-skill-task-version-fields
              v-if="isTask(v)"
              :procedure="draftFor(v).procedure"
              :consumed-expertise-ids="draftFor(v).consumedExpertiseIds"
              :readonly="v.status !== 'DRAFT'"
              class="mb-3"
              @update:procedure="draftFor(v).procedure = $event"
              @update:consumedExpertiseIds="
                draftFor(v).consumedExpertiseIds = $event
              "
            />
            <template v-else>
              <bs-ai-skill-feature-version-fields
                :input-schema-id.sync="draftFor(v).inputSchemaId"
                :output-schema-id.sync="draftFor(v).outputSchemaId"
                :system-prompt.sync="draftFor(v).systemPrompt"
                :skill-body.sync="draftFor(v).skillBody"
                :input-template.sync="draftFor(v).inputTemplate"
                :schemas="schemas"
                :descriptor="descriptorFor(v)"
                :readonly="v.status !== 'DRAFT'"
              />
              <!-- A task skill has no test case: no feature calls it (ADR 0019). -->
              <bs-ai-skill-test-cases
                :test-cases="draftFor(v).testCases"
                :readonly="v.status !== 'DRAFT'"
                @update:testCases="draftFor(v).testCases = $event"
              />
            </template>
            <bs-textarea
              v-if="v.status === 'DRAFT'"
              v-model="draftFor(v).changelog"
              :label="$t('aiSkills.version.changelog')"
              :placeholder="$t('aiSkills.version.changelogPlaceholder')"
              :rows="2"
            />
            <bs-textarea
              v-if="v.status === 'DRAFT'"
              v-model="draftFor(v).releaseNotes"
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
                @click="emitSaveVersion(v)"
              >
                {{ $t('aiSkills.version.saveDraft') }}
              </v-btn>
              <v-btn
                color="accent"
                elevation="0"
                :loading="saving"
                @click="emitActivateVersion(v)"
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
</style>
