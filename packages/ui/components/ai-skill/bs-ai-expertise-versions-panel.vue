<script>
// The page owns the expertise object; this panel edits its own drafts and
// hands a merged version back on save / publish (see mixin-version-drafts).
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsTimestamp from '~/components/bs-timestamp.vue';
import mixinVersionDrafts from '~/helpers/mixins/mixin-version-drafts.js';
import { Plus, CheckCircle2, Copy, Trash2 } from 'lucide-vue';

// What the version editor lets one change on a DRAFT.
const EDITABLE_FIELDS = Object.freeze([
  'body',
  'examplesGood',
  'examplesBad',
  'changelog',
  'releaseNotes',
]);

export default {
  name: 'BsAiExpertiseVersionsPanel',
  components: {
    BsTextarea,
    BsCombobox,
    BsTimestamp,
    LucidePlus: Plus,
    LucideCheckCircle2: CheckCircle2,
    LucideCopy: Copy,
    LucideTrash2: Trash2,
  },
  mixins: [mixinVersionDrafts],
  props: {
    expertise: { type: Object, required: true },
    saving: { type: Boolean, default: false },
    // "major.minor" of the version to expand on load (create flow lands here
    // with the seeded v1.0 DRAFT open — §4).
    autoExpandVersion: { type: String, default: null },
  },
  data() {
    return { openPanel: null };
  },
  computed: {
    // Consumed by mixin-version-drafts.
    versionsSource() {
      return this.expertise.versions;
    },
    activeVersionRef() {
      return this.expertise && this.expertise.activeVersion;
    },
    editableVersionFields() {
      return EDITABLE_FIELDS;
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
              <v-chip v-if="isVersionDirty(v)" x-small outlined color="warning">
                {{ $t('aiSkills.version.unsavedChanges') }}
              </v-chip>
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
            <bs-textarea
              v-model="draftFor(v).body"
              :label="$t('aiSkills.expertise.bodyLabel')"
              :rows="10"
              :readonly="v.status !== 'DRAFT'"
              monospace
            />
            <p class="text-caption text--secondary section-id-help">
              {{ $t('aiSkills.expertise.sectionIdHelp') }}
            </p>
            <bs-combobox
              v-model="draftFor(v).examplesGood"
              :label="$t('aiSkills.expertise.goodExamples')"
              multiple
              chips
              small-chips
              :clearable="v.status === 'DRAFT'"
              :readonly="v.status !== 'DRAFT'"
            />
            <bs-combobox
              v-model="draftFor(v).examplesBad"
              :label="$t('aiSkills.expertise.badExamples')"
              multiple
              chips
              small-chips
              :clearable="v.status === 'DRAFT'"
              :readonly="v.status !== 'DRAFT'"
            />
            <bs-textarea
              v-if="isMajorDraft(v)"
              v-model="draftFor(v).changelog"
              :label="$t('aiSkills.version.changelog')"
              :rows="2"
            />
            <bs-textarea
              v-if="isMajorDraft(v)"
              v-model="draftFor(v).releaseNotes"
              :label="$t('aiSkills.version.releaseNotes')"
              :rows="2"
            />
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
