<script>
import { FileJson } from 'lucide-vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsAiSkillsImportReport from '~/components/ai-skill/bs-ai-skills-import-report.vue';
import * as api from '~/helpers/ai-skill-routes.js';
import { skillErrorMessage } from '~/helpers/ai-skill-errors.js';
import {
  keyOf,
  isSelectable,
  defaultSelection,
  importPayload,
  warningValues,
} from '~/helpers/skills-import.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Importing a skills export (ADR 0018): the file, then what the import would
// do with each item, before anything is written.
export default {
  name: 'BsAiSkillsImportModal',
  components: {
    BsModalConfirm,
    BsAiSkillsImportReport,
    LucideFileJson: FileJson,
  },
  data() {
    return {
      file: null,
      json: null,
      preview: null,
      selected: [],
      reading: false,
      importing: false,
      report: null,
      error: '',
    };
  },
  computed: {
    items() {
      return (this.preview && this.preview.items) || [];
    },
    selectableCount() {
      return this.items.filter(isSelectable).length;
    },
    fromLine() {
      const { origin, exportedBy, exportedAt } = this.preview;
      return this.$t('skillsImport.from', {
        origin,
        by: exportedBy,
        date: new Date(exportedAt).toLocaleDateString(this.$i18n.locale),
      });
    },
  },
  methods: {
    keyOf,
    isSelectable,
    open() {
      this.reset();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    reset() {
      this.file = null;
      this.json = null;
      this.preview = null;
      this.selected = [];
      this.report = null;
      this.error = '';
    },
    // The chosen items, written as drafts; the report says what became of
    // each one.
    async runImport() {
      this.importing = true;
      this.error = '';
      try {
        this.report = await this.$axios.$post(api.aiSkillsImport(), {
          file: this.json,
          ...importPayload(this.selected),
        });
        this.$emit('imported', this.report);
      } catch (err) {
        this.error = this.$t('skillsImport.importFailed', {
          message: this.reasonOfError(err),
        });
      } finally {
        this.importing = false;
      }
    },
    // The reason the server gives, in words when it is a known code.
    reasonOfError(err) {
      const data = err.response && err.response.data;
      return data && data.message ? skillErrorMessage(this, err) : err.message;
    },
    // Why the file cannot be read. A refusal the server names by a code says
    // its whole sentence; any other reason follows the words that say the
    // file is unreadable.
    unreadableBecause(err) {
      const data = err.response && err.response.data;
      if (data && data.message && this.$te(`aiSkills.errors.${data.message}`)) {
        return skillErrorMessage(this, err);
      }
      return this.$t('skillsImport.unreadable', {
        message: this.reasonOfError(err),
      });
    },
    // The file is read and checked here first, so a wrong file is said at
    // once; the server reads it again.
    async readFile() {
      this.error = '';
      if (!this.file) return;
      if (this.file.size > MAX_FILE_BYTES) {
        this.error = this.$t('skillsImport.tooLarge');
        return;
      }
      this.reading = true;
      try {
        this.json = JSON.parse(await this.file.text());
      } catch (err) {
        this.error = this.$t('skillsImport.notJson');
        this.reading = false;
        return;
      }
      try {
        this.preview = await this.$axios.$post(
          api.aiSkillsImportPreview(),
          this.json
        );
        this.selected = defaultSelection(this.items);
      } catch (err) {
        this.error = this.unreadableBecause(err);
      } finally {
        this.reading = false;
      }
    },
    stateColor(state) {
      return (
        { new: 'success', update: 'accent', blocked: 'error' }[state] || 'grey'
      );
    },
    warningText(warning) {
      return this.$t(
        `skillsImport.warnings.${warning.code}`,
        warningValues(warning, (key) => this.$t(key))
      );
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('skillsImport.title')"
    :display-submit-button="false"
    :cancel-label="report ? $t('global.close') : ''"
    modal-width="720"
  >
    <div v-if="!preview" class="bs-ai-skills-import__file">
      <v-file-input
        v-model="file"
        accept="application/json,.json"
        :label="$t('skillsImport.file')"
        :hint="$t('skillsImport.fileHint')"
        :error-messages="error"
        :loading="reading"
        persistent-hint
        outlined
        dense
        prepend-icon=""
      >
        <template #prepend-inner>
          <lucide-file-json :size="18" class="mr-2" />
        </template>
      </v-file-input>
      <v-btn
        color="accent"
        elevation="0"
        class="text-none mt-4"
        :disabled="!file"
        :loading="reading"
        @click="readFile"
      >
        {{ $t('skillsImport.preview') }}
      </v-btn>
    </div>

    <bs-ai-skills-import-report
      v-else-if="report"
      :report="report"
      @leave="close"
    />

    <div v-else class="bs-ai-skills-import__preview" aria-live="polite">
      <p class="bs-ai-skills-import__from">{{ fromLine }}</p>

      <ul class="bs-ai-skills-import__items">
        <li
          v-for="item in items"
          :key="keyOf(item)"
          class="bs-ai-skills-import__item"
        >
          <v-checkbox
            v-model="selected"
            :value="keyOf(item)"
            :disabled="!isSelectable(item)"
            :aria-label="item.title"
            hide-details
            class="mt-0 pt-0"
          />
          <div class="bs-ai-skills-import__text">
            <span class="bs-ai-skills-import__title">
              {{ item.title }}
              <span class="bs-ai-skills-import__meta">
                {{ $t(`skillsImport.kinds.${item.kind}`) }} · {{ item.id }} ·
                v{{ item.version }}
                <template v-if="item.current">
                  ({{ $t('skillsImport.current', { version: item.current }) }})
                </template>
              </span>
            </span>
            <span v-if="item.reason" class="bs-ai-skills-import__reason">
              {{ $t(`skillsImport.reasons.${item.reason}`) }}
            </span>
            <span
              v-for="warning in item.warnings || []"
              :key="warning.code"
              class="bs-ai-skills-import__warning"
            >
              {{ warningText(warning) }}
            </span>
          </div>
          <v-chip
            x-small
            outlined
            :color="stateColor(item.state)"
            class="flex-shrink-0"
          >
            {{ $t(`skillsImport.states.${item.state}`) }}
          </v-chip>
        </li>
      </ul>

      <div class="bs-ai-skills-import__footer">
        <span>
          {{
            selectableCount
              ? $tc('skillsImport.counter', selected.length, {
                  count: selected.length,
                })
              : $t('skillsImport.nothing')
          }}
        </span>
        <div>
          <v-btn text class="text-none" :disabled="importing" @click="reset">
            {{ $t('skillsImport.otherFile') }}
          </v-btn>
          <v-btn
            color="accent"
            elevation="0"
            class="text-none"
            :disabled="!selected.length"
            :loading="importing"
            @click="runImport"
          >
            {{ $t('skillsImport.run') }}
          </v-btn>
        </div>
      </div>
      <p v-if="error" class="bs-ai-skills-import__reason mt-2" role="alert">
        {{ error }}
      </p>
    </div>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.bs-ai-skills-import {
  &__from {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__items {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid var(--gray-300);
    border-radius: var(--r-md);
  }

  &__item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;

    & + & {
      border-top: 1px solid var(--gray-200);
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-weight: 500;
    color: var(--gray-900);
  }

  &__meta {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--gray-600);
  }

  &__reason,
  &__warning {
    font-size: 0.8125rem;
  }

  &__reason {
    color: var(--color-error);
  }

  &__warning {
    color: var(--gray-800);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: var(--gray-800);
  }
}
</style>
