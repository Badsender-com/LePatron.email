<script>
import * as api from '~/helpers/ai-skill-routes.js';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsAiLanguagePicker from '~/components/ai-skill/BsAiLanguagePicker.vue';
import suggestIdentifier from '~/helpers/suggest-skill-identifier.js';
import { emailTypeLabel } from '~/helpers/email-types.js';
import { RefreshCw } from 'lucide-vue';

const CATEGORIES = [
  'redaction',
  'qc',
  'design',
  'html_integration',
  'deliverability',
  'translation',
  'other',
];

export default {
  name: 'BsAiExpertiseCreateModal',
  components: {
    BsModalConfirm,
    BsTextField,
    BsSelect,
    BsTextarea,
    BsCombobox,
    BsAiLanguagePicker,
    LucideRefreshCw: RefreshCw,
  },
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      expertise: this.emptyExpertise(),
      identifierManuallyEdited: false,
      showIdentifier: false,
      scopeFacets: [],
      emailTypeFacets: [],
    };
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    suggestedIdentifier() {
      return suggestIdentifier({
        category: this.expertise.category,
        scope: this.expertise.scope,
        title: this.expertise.title,
      });
    },
    canSubmit() {
      return !!this.expertise.expertiseId && !!this.expertise.title;
    },
  },
  watch: {
    suggestedIdentifier(next) {
      if (!this.identifierManuallyEdited && next) {
        this.expertise.expertiseId = next;
      }
    },
  },
  methods: {
    emailTypeLabel(value) {
      return emailTypeLabel(this, value);
    },
    emptyExpertise() {
      return {
        expertiseId: '',
        title: '',
        description: '',
        category: 'redaction',
        scope: [],
        isTransversal: false,
        appliesToEmailTypes: [],
        appliesToLanguages: [],
      };
    },
    onTransversalChange(checked) {
      // Scope and transversal are contradictory; the flag wins.
      if (checked) this.expertise.scope = [];
    },
    async open() {
      this.expertise = this.emptyExpertise();
      this.identifierManuallyEdited = false;
      this.showIdentifier = false;
      this.$refs.modal.open();
      await this.loadFacets();
    },
    async loadFacets() {
      try {
        const res = await this.$axios.$get(api.aiExpertiseFacets());
        this.scopeFacets = res.scopes || [];
        this.emailTypeFacets = res.emailTypes || [];
      } catch (err) {
        this.scopeFacets = [];
        this.emailTypeFacets = [];
      }
    },
    close() {
      this.$refs.modal.close();
    },
    onIdentifierInput(value) {
      this.expertise.expertiseId = value;
      this.identifierManuallyEdited = true;
    },
    resetIdentifier() {
      this.identifierManuallyEdited = false;
      this.expertise.expertiseId = this.suggestedIdentifier;
    },
    onSubmit() {
      if (!this.canSubmit) return;
      this.$emit('submit', { ...this.expertise });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.expertise.newExpertise')"
    :is-form="true"
    modal-width="600"
  >
    <v-form @submit.prevent="onSubmit">
      <bs-text-field
        v-model="expertise.title"
        :label="$t('global.title')"
        :disabled="loading"
        required
      />
      <bs-textarea
        v-model="expertise.description"
        :label="$t('global.description')"
        :hint="$t('aiSkills.expertise.descriptionHelp')"
        persistent-hint
        :rows="2"
        :disabled="loading"
      />
      <bs-select
        v-model="expertise.category"
        :items="categoryOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiSkills.filters.category')"
        :hint="$t('aiSkills.expertise.categoryHelp')"
        persistent-hint
        :disabled="loading"
      />
      <v-checkbox
        v-model="expertise.isTransversal"
        :label="$t('aiSkills.expertise.transversal')"
        :hint="$t('aiSkills.expertise.transversalHint')"
        persistent-hint
        dense
        class="mt-2"
        :disabled="loading"
        @change="onTransversalChange"
      />
      <bs-combobox
        v-model="expertise.scope"
        :items="scopeFacets"
        :label="$t('aiSkills.expertise.scope')"
        :hint="$t('aiSkills.expertise.scopeHelp')"
        persistent-hint
        multiple
        chips
        small-chips
        :disabled="loading || expertise.isTransversal"
      />
      <bs-combobox
        v-model="expertise.appliesToEmailTypes"
        :items="emailTypeFacets"
        :label="$t('aiSkills.expertise.appliesToEmailTypes')"
        :hint="$t('aiSkills.expertise.emailTypeHelp')"
        persistent-hint
        multiple
        chips
        small-chips
        :disabled="loading"
      >
        <template #selection="{ item }">
          <v-chip small>
            {{ emailTypeLabel(item) }}
          </v-chip>
        </template>
        <template #item="{ item }">
          {{ emailTypeLabel(item) }}
        </template>
      </bs-combobox>
      <bs-ai-language-picker
        :value="expertise.appliesToLanguages"
        :label="$t('aiSkills.expertise.appliesToLanguages')"
        :hint="$t('aiSkills.expertise.languageHelp')"
        :disabled="loading"
        @input="expertise.appliesToLanguages = $event"
      />

      <div class="technical-id mt-4">
        <v-btn
          text
          small
          color="primary"
          class="px-0"
          @click="showIdentifier = !showIdentifier"
        >
          {{ $t('aiSkills.expertise.technicalId') }}
          <v-icon :size="18">
            {{ showIdentifier ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
          </v-icon>
        </v-btn>
        <div v-if="showIdentifier" class="identifier-row">
          <bs-text-field
            :value="expertise.expertiseId"
            :label="$t('aiSkills.expertise.id')"
            placeholder="redaction.cta.principles"
            :disabled="loading"
            required
            class="identifier-row__field"
            @input="onIdentifierInput"
          />
          <v-tooltip top>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                :disabled="loading || !suggestedIdentifier"
                class="identifier-row__reset"
                v-bind="attrs"
                v-on="on"
                @click="resetIdentifier"
              >
                <lucide-refresh-cw :size="18" />
              </v-btn>
            </template>
            <span>{{ $t('aiSkills.expertise.idResetHint') }}</span>
          </v-tooltip>
        </div>
      </div>

      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="loading || !canSubmit"
        >
          {{ $t('global.create') }}
        </v-btn>
      </div>
    </v-form>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.identifier-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  &__field {
    flex: 1;
  }

  &__reset {
    margin-top: 1.6rem;
  }
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
