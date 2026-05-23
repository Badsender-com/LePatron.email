<script>
/* eslint-disable vue/no-mutating-props */
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import { Plus, CheckCircle2, Copy, Trash2 } from 'lucide-vue';

export default {
  name: 'BsAiExpertiseVersionsPanel',
  components: {
    BsTextarea,
    BsCombobox,
    LucidePlus: Plus,
    LucideCheckCircle2: CheckCircle2,
    LucideCopy: Copy,
    LucideTrash2: Trash2,
  },
  props: {
    expertise: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  computed: {
    hasActive() {
      const av = this.expertise && this.expertise.activeVersion;
      return !!(av && av.major != null);
    },
    sortedVersions() {
      return [...(this.expertise.versions || [])].sort((a, b) => {
        if (b.versionMajor !== a.versionMajor) {
          return b.versionMajor - a.versionMajor;
        }
        return b.versionMinor - a.versionMinor;
      });
    },
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
    isMajorDraft(v) {
      return v.status === 'DRAFT' && v.versionMinor === 0;
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
      <v-expansion-panels accordion flat>
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
              v-model="v.body"
              :label="$t('aiSkills.expertise.bodyLabel')"
              :rows="10"
              :readonly="v.status !== 'DRAFT'"
              monospace
            />
            <bs-combobox
              v-model="v.examplesGood"
              :label="$t('aiSkills.expertise.goodExamples')"
              multiple
              chips
              small-chips
              :readonly="v.status !== 'DRAFT'"
            />
            <bs-combobox
              v-model="v.examplesBad"
              :label="$t('aiSkills.expertise.badExamples')"
              multiple
              chips
              small-chips
              :readonly="v.status !== 'DRAFT'"
            />
            <bs-textarea
              v-if="isMajorDraft(v)"
              v-model="v.changelog"
              :label="$t('aiSkills.version.changelog')"
              :rows="2"
            />
            <bs-textarea
              v-if="isMajorDraft(v)"
              v-model="v.releaseNotes"
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
