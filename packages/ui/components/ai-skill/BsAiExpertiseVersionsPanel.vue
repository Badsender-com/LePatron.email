<script>
// Parent owns the expertise object; in-place edits via v-model on version
// fields. See BsAiSkillDetailsForm for rationale.
/* eslint-disable vue/no-mutating-props */
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import { Plus, CheckCircle2 } from 'lucide-vue';

export default {
  name: 'BsAiExpertiseVersionsPanel',
  components: {
    BsTextarea,
    BsCombobox,
    LucidePlus: Plus,
    LucideCheckCircle2: CheckCircle2,
  },
  props: {
    expertise: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  methods: {
    formatDate(d) {
      return d ? new Date(d).toLocaleString() : '';
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
            </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <bs-textarea
              v-model="v.body"
              :label="$t('aiSkills.expertise.bodyLabel')"
              :rows="10"
              :readonly="!!v.activatedAt"
              monospace
            />
            <bs-combobox
              v-model="v.examplesGood"
              :label="$t('aiSkills.expertise.goodExamples')"
              multiple
              chips
              small-chips
              :readonly="!!v.activatedAt"
            />
            <bs-combobox
              v-model="v.examplesBad"
              :label="$t('aiSkills.expertise.badExamples')"
              multiple
              chips
              small-chips
              :readonly="!!v.activatedAt"
            />
            <div
              v-if="!v.activatedAt"
              class="d-flex justify-end mt-2"
              style="gap: 0.5rem"
            >
              <v-btn
                text
                color="primary"
                :loading="saving"
                @click="$emit('save', v)"
              >
                {{ $t('aiSkills.version.saveDraft') }}
              </v-btn>
              <v-btn color="accent" elevation="0" @click="$emit('activate', v)">
                <lucide-check-circle2 :size="18" class="mr-2" />
                {{ $t('aiSkills.version.activate') }}
              </v-btn>
            </div>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>
  </div>
</template>
