<script>
import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';
import { mapMutations } from 'vuex';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  GENERAL,
  exceptionsOf,
  emptyException,
  recommendedOf,
  generalOf,
  exceptionsPayload,
  fieldErrors,
} from '~/helpers/quality-exceptions.js';
import { qualitySettingsErrorKeyFor } from '~/helpers/quality-settings.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsQualityExceptionCard from '~/components/quality/quality-exception-card.vue';
import BsQualityExceptionDialog from '~/components/quality/quality-exception-dialog.vue';
import BsQualitySaveBar from '~/components/quality/quality-save-bar.vue';
import BsQualityExceptionsEmpty from '~/components/quality/quality-exceptions-empty.vue';

const CATALOGUE_ORDER = Object.keys(CHECKS);

// The exceptions of one level, the general settings or a template's: a card
// per exception, the dialog that adds one, and the save button. Only what
// changed is sent (exceptionsPayload).
export default {
  name: 'BsQualityExceptionsEditor',
  components: {
    BsQualityExceptionsEmpty,
    BsQualityExceptionCard,
    BsQualityExceptionDialog,
    BsQualitySaveBar,
  },
  mixins: [mixinQualityTexts],
  props: {
    level: { type: String, required: true },
    // The stored `qualitySettings` of this level.
    settings: { type: Object, default: null },
    // The group's, which a template's exceptions are laid over.
    generalSettings: { type: Object, default: null },
    groupId: { type: String, default: '' },
    // Saves the payload; returns a promise.
    save: { type: Function, required: true },
  },
  data() {
    return { drafts: {}, lastEdited: {}, dialog: false, loading: false };
  },
  computed: {
    isGeneral() {
      return this.level === GENERAL;
    },
    saved() {
      return exceptionsOf(this.settings);
    },
    general() {
      return generalOf(this.generalSettings);
    },
    generalExceptions() {
      return exceptionsOf(this.generalSettings);
    },
    ids() {
      return CATALOGUE_ORDER.filter((id) => this.drafts[id]);
    },
    payload() {
      return exceptionsPayload(this.level, this.drafts, this.saved);
    },
    changeCount() {
      return Object.keys(this.payload.checks).length;
    },
    errors() {
      return Object.fromEntries(
        this.ids.map((id) => [
          id,
          fieldErrors(
            id,
            this.drafts[id],
            this.baseOf(id),
            this.lastEdited[id]
          ),
        ])
      );
    },
    invalidCount() {
      return Object.values(this.errors).reduce(
        (count, e) => count + Object.keys(e).length,
        0
      );
    },
    title() {
      return this.isGeneral
        ? this.$tc('qualitySettings.exceptionCount', this.ids.length)
        : this.$tc('qualitySettings.template.own', this.ids.length);
    },
    candidates() {
      return CATALOGUE_ORDER.filter((id) => !this.drafts[id]).map((id) => ({
        id,
        applies: this.baseText(id, true),
      }));
    },
  },
  watch: {
    settings: {
      immediate: true,
      handler() {
        this.reset();
      },
    },
    changeCount: {
      immediate: true,
      handler(count) {
        this.$emit('changes', count);
      },
    },
    // The checks this level sets, as edited: a template's page lists the
    // general exceptions it does not replace.
    ids: {
      immediate: true,
      handler(ids) {
        this.$emit('exceptions', ids);
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    baseOf(id) {
      return this.isGeneral ? recommendedOf(id) : this.general[id];
    },

    // What applies without this level's exception: the general setting
    // where the group has an exception, else the recommended values.
    baseText(id, short = false) {
      if (!this.isGeneral && this.generalExceptions[id]) {
        return this.$t('qualitySettings.card.general', {
          value: this.appliedText(id, this.general[id]),
        });
      }
      return this.$t(
        short
          ? 'qualitySettings.card.recommendedShort'
          : 'qualitySettings.card.recommended',
        { value: this.appliedText(id, recommendedOf(id)) }
      );
    },

    reset() {
      this.drafts = cloneDeep(this.saved);
      this.lastEdited = {};
    },

    openAdd() {
      this.dialog = true;
    },

    add(id) {
      this.drafts = { ...this.drafts, [id]: emptyException(id) };
    },

    remove(id) {
      this.drafts = omit(this.drafts, id);
    },

    setState(id, state) {
      if (!state) return;
      const exception = { ...this.drafts[id], state };
      // Turned off: its unsaved thresholds go back to what is stored.
      if (state === 'off') {
        exception.thresholds = cloneDeep(
          (this.saved[id] || emptyException(id)).thresholds
        );
      }
      this.drafts = { ...this.drafts, [id]: exception };
    },

    setThreshold(id, name, value) {
      const exception = this.drafts[id];
      this.drafts = {
        ...this.drafts,
        [id]: {
          ...exception,
          thresholds: {
            ...exception.thresholds,
            [name]: value === '' ? null : value,
          },
        },
      };
      this.lastEdited = { ...this.lastEdited, [id]: name };
    },

    async submit() {
      this.loading = true;
      try {
        await this.save(this.payload);
        this.showSnackbar({
          text: this.$t('qualitySettings.snackbars.updated'),
          color: 'success',
        });
        this.$emit('saved');
      } catch (error) {
        this.showSnackbar({
          text: this.$t(qualitySettingsErrorKeyFor(error)),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="qx-editor">
    <template v-if="ids.length">
      <h3 class="qx-editor__title">{{ title }}</h3>
      <p v-if="isGeneral" class="qx-editor__subtitle">
        {{ $t('qualitySettings.general.others') }}
      </p>
      <div class="qx-editor__cards">
        <bs-quality-exception-card
          v-for="id in ids"
          :key="id"
          :check-id="id"
          :level="level"
          :exception="drafts[id]"
          :saved="saved[id] || null"
          :base="baseOf(id)"
          :base-text="isGeneral ? '' : baseText(id)"
          :errors="errors[id]"
          :group-id="groupId"
          :disabled="loading"
          @state="setState(id, $event)"
          @threshold="(name, value) => setThreshold(id, name, value)"
          @remove="remove(id)"
        />
      </div>
    </template>
    <bs-quality-exceptions-empty
      v-else
      :is-general="isGeneral"
      @add="openAdd"
    />

    <bs-quality-save-bar
      v-if="changeCount || invalidCount || loading"
      :change-count="changeCount"
      :loading="loading"
      :invalid-count="invalidCount"
      @cancel="reset"
      @save="submit"
    />

    <bs-quality-exception-dialog
      v-model="dialog"
      :title="
        isGeneral
          ? $t('qualitySettings.dialog.title')
          : $t('qualitySettings.dialog.titleTemplate')
      "
      :intro="
        isGeneral
          ? $t('qualitySettings.dialog.intro')
          : $t('qualitySettings.dialog.introTemplate')
      "
      :candidates="candidates"
      @pick="add"
    />
  </div>
</template>

<style lang="scss" scoped>
.qx-editor {
  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--gray-900);
    margin: 0;
  }

  &__subtitle {
    font-size: 0.875rem;
    color: var(--gray-700);
    margin: 0.25rem 0 0;
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }
}
</style>
