<script>
import { FileJson, ArrowRight } from 'lucide-vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import * as api from '~/helpers/ai-skill-routes.js';
import {
  keyOf,
  isSelectable,
  defaultSelection,
  importPayload,
  reportCounts,
  draftLinks,
  warningValues,
} from '~/helpers/skills-import.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Importing a skills export (ADR 0018): the file, then what the import would
// do with each item, before anything is written.
export default {
  name: 'BsAiSkillsImportModal',
  components: {
    BsModalConfirm,
    LucideFileJson: FileJson,
    LucideArrowRight: ArrowRight,
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
    // Only the outcomes that happened: "0 skipped" says nothing.
    counts() {
      return Object.fromEntries(
        Object.entries(reportCounts(this.report)).filter(([, n]) => n > 0)
      );
    },
    drafts() {
      return draftLinks(this.report);
    },
    fromLine() {
      const { origin, exportedBy, exportedAt } = this.preview;
      return this.$t('skillsImport.from', {
        origin,
        by: exportedBy,
        date: new Date(exportedAt).toLocaleDateString(),
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
        const message =
          (err.response && err.response.data && err.response.data.message) ||
          err.message;
        this.error = this.$t('skillsImport.importFailed', { message });
      } finally {
        this.importing = false;
      }
    },
    reasonOf(item) {
      const key = `skillsImport.reasons.${item.reason}`;
      return this.$te(key)
        ? this.$t(key)
        : this.$t(`skillsImport.states.${item.reason}`);
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
        const message =
          (err.response && err.response.data && err.response.data.message) ||
          err.message;
        this.error = this.$t('skillsImport.unreadable', { message });
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

    <div v-else-if="report" class="bs-ai-skills-import__report">
      <p class="bs-ai-skills-import__counts">
        <span
          v-for="(count, outcome) in counts"
          :key="outcome"
          :class="`bs-ai-skills-import__count--${outcome}`"
        >
          {{ $tc(`skillsImport.report.${outcome}`, count, { count }) }}
        </span>
      </p>
      <template v-if="drafts.length">
        <p class="bs-ai-skills-import__from">
          {{ $t('skillsImport.report.publish') }}
        </p>
        <ul class="bs-ai-skills-import__items">
          <li
            v-for="draft in drafts"
            :key="draft.to"
            class="bs-ai-skills-import__item"
          >
            <nuxt-link :to="draft.to" @click.native="close">
              {{ draft.id }} · v{{ draft.version }}
              <lucide-arrow-right :size="14" />
            </nuxt-link>
          </li>
        </ul>
      </template>
      <p v-else class="bs-ai-skills-import__from">
        {{ $t('skillsImport.report.nothing') }}
      </p>
      <p
        v-for="item in report.failed"
        :key="`failed-${item.kind}-${item.id}`"
        class="bs-ai-skills-import__reason"
      >
        {{
          $t('skillsImport.report.failedItem', {
            id: item.id,
            message: item.message,
          })
        }}
      </p>
      <p
        v-for="item in report.skipped"
        :key="`skipped-${item.kind}-${item.id}`"
        class="bs-ai-skills-import__warning"
      >
        {{
          $t('skillsImport.report.skippedItem', {
            id: item.id,
            reason: reasonOf(item),
          })
        }}
      </p>
    </div>

    <div v-else class="bs-ai-skills-import__preview">
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
          <v-btn text class="text-none" @click="reset">
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
      <p v-if="error" class="bs-ai-skills-import__reason mt-2">{{ error }}</p>
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

  &__counts {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0 0 0.75rem;
    font-weight: 500;
  }

  &__count--failed {
    color: var(--color-error);
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
