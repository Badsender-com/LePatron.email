<script>
// Parent owns the expertise object; in-place edits via v-model on version
// fields. See BsAiSkillDetailsForm for rationale.
/* eslint-disable vue/no-mutating-props */
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import { Plus, CheckCircle2, Copy, AlertTriangle } from 'lucide-vue';

export default {
  name: 'BsAiExpertiseVersionsPanel',
  components: {
    BsTextarea,
    BsCombobox,
    BsTextField,
    LucidePlus: Plus,
    LucideCheckCircle2: CheckCircle2,
    LucideCopy: Copy,
    LucideAlertTriangle: AlertTriangle,
  },
  props: {
    expertise: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  data() {
    return {
      // Per-version changelog input, keyed by versionNumber. Not persisted
      // on the version itself until the user clicks "Save changes" — keeps
      // the audit-trail input transient and avoids muddying the existing
      // `version.changelog` (which carries the publication changelog).
      editChangelogs: {},
    };
  },
  methods: {
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
    },
    changelogFor(v) {
      return this.editChangelogs[v.versionNumber] || '';
    },
    setChangelogFor(v, value) {
      this.$set(this.editChangelogs, v.versionNumber, value);
    },
    onSaveActive(v) {
      const cl = (this.editChangelogs[v.versionNumber] || '').trim();
      if (!cl) return;
      this.$emit('save', { version: v, changelog: cl });
      this.$set(this.editChangelogs, v.versionNumber, '');
    },
    statusForVersion(v) {
      if (this.expertise.activeVersion === v.versionNumber) return 'ACTIVE';
      if (v.activatedAt) return 'PUBLISHED';
      return 'DRAFT';
    },
    versionStatusLabel(v) {
      return this.$t(`aiSkills.statuses.${this.statusForVersion(v)}`);
    },
    versionChipColor(v) {
      const s = this.statusForVersion(v);
      return s === 'ACTIVE'
        ? 'success'
        : s === 'PUBLISHED'
        ? 'info'
        : 'warning';
    },
  },
};
</script>

<template>
  <div>
    <div class="d-flex justify-end mb-3">
      <v-btn color="accent" elevation="0" @click="$emit('create')">
        <lucide-plus :size="18" class="mr-2" />
        {{ $t('aiSkills.version.newVersionShort') }}
      </v-btn>
    </div>
    <v-card outlined>
      <v-expansion-panels accordion flat>
        <v-expansion-panel
          v-for="v in expertise.versions"
          :key="v.versionNumber"
        >
          <v-expansion-panel-header>
            <div class="d-flex align-center" style="gap: 0.5rem">
              <span class="font-weight-medium">v{{ v.versionNumber }}</span>
              <v-chip x-small :color="versionChipColor(v)" outlined>
                {{ versionStatusLabel(v) }}
              </v-chip>
              <span class="text-caption text--secondary">
                {{ formatDate(v.updatedAt || v.createdAt) }}
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
            <v-alert
              v-if="v.activatedAt"
              type="warning"
              dense
              outlined
              class="mb-3"
            >
              <div class="d-flex align-center" style="gap: 0.5rem">
                <lucide-alert-triangle :size="16" />
                <span class="text-body-2">
                  {{ $t('aiSkills.version.editActiveWarning') }}
                </span>
              </div>
            </v-alert>

            <bs-textarea
              v-model="v.body"
              :label="$t('aiSkills.expertise.bodyLabel')"
              :rows="10"
              monospace
            />
            <bs-combobox
              v-model="v.examplesGood"
              :label="$t('aiSkills.expertise.goodExamples')"
              multiple
              chips
              small-chips
            />
            <bs-combobox
              v-model="v.examplesBad"
              :label="$t('aiSkills.expertise.badExamples')"
              multiple
              chips
              small-chips
            />

            <bs-text-field
              v-if="v.activatedAt"
              :value="changelogFor(v)"
              :label="$t('aiSkills.version.editChangelogLabel')"
              :hint="$t('aiSkills.version.editChangelogHint')"
              required
              @input="setChangelogFor(v, $event)"
            />

            <div class="d-flex justify-end mt-2" style="gap: 0.5rem">
              <template v-if="v.activatedAt">
                <v-btn
                  color="accent"
                  elevation="0"
                  :loading="saving"
                  :disabled="!changelogFor(v).trim()"
                  @click="onSaveActive(v)"
                >
                  {{ $t('aiSkills.version.saveChanges') }}
                </v-btn>
              </template>
              <template v-else>
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
                  @click="$emit('activate', v)"
                >
                  <lucide-check-circle2 :size="18" class="mr-2" />
                  {{ $t('aiSkills.version.activate') }}
                </v-btn>
              </template>
            </div>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>
  </div>
</template>
