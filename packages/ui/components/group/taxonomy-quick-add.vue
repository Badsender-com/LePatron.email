<script>
import { Plus } from 'lucide-vue';
import * as apiRoutes from '~/helpers/api-routes.js';
import { proposeIdentifier } from '~/helpers/taxonomy-builder.js';
import {
  IDENTIFIER_PATTERN,
  IDENTIFIER_MAX_LENGTH,
} from '../../../shared/taxonomy/identifier.js';
import { TAXONOMY_LIMITS, doctrineTypeItems } from '~/helpers/taxonomy.js';

/**
 * The quick-add row under a dimension's values (ADR-0026): Enter adds the
 * value, offered everywhere, and keeps the cursor in the label for the next
 * one. Its identifier is proposed from the label and can be written instead,
 * the one an existing template already compares (`bel_fr`); once written, it
 * no longer follows the label. An email type also takes its doctrine type
 * here (ADR-0030), so a whole list is built without opening a panel. The rest
 * is set in the value's panel. Emits `added` and `error`.
 */
export default {
  name: 'BsTaxonomyQuickAdd',
  components: { LucidePlus: Plus },
  props: {
    dimensionName: { type: String, required: true },
    isEmailType: { type: Boolean, default: false },
    nextOrder: { type: Number, default: 0 },
  },
  data() {
    return {
      label: '',
      identifier: '',
      identifierTouched: false,
      doctrineType: '',
      saving: false,
    };
  },
  computed: {
    labelLimit() {
      return TAXONOMY_LIMITS.LABEL;
    },
    identifierLimit() {
      return IDENTIFIER_MAX_LENGTH;
    },
    identifierValid() {
      // Empty is valid: the value is then published under its id.
      return !this.identifier || IDENTIFIER_PATTERN.test(this.identifier);
    },
    doctrineTypes() {
      return doctrineTypeItems((key) => this.$t(key));
    },
  },
  watch: {
    label(label) {
      if (this.identifierTouched) return;
      this.identifier = proposeIdentifier(label.trim()) || '';
    },
  },
  methods: {
    async add() {
      const label = this.label.trim();
      if (!label || this.saving || !this.identifierValid) return;
      try {
        this.saving = true;
        await this.$axios.$post(apiRoutes.taxonomyItemsCreate(), {
          label,
          ...(this.identifier ? { canonicalType: this.identifier } : {}),
          ...(this.doctrineType ? { doctrineType: this.doctrineType } : {}),
          order: this.nextOrder,
          type: this.dimensionName,
          groupId: this.$route.params.groupId,
        });
        this.label = '';
        this.identifier = '';
        this.identifierTouched = false;
        this.doctrineType = '';
        this.$emit('added');
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.saving = false;
        this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
      }
    },
  },
};
</script>

<template>
  <form class="taxonomy-quick-add" @submit.prevent="add">
    <label class="sr-only" :for="`quick-add-${dimensionName}`">
      {{ $t('taxonomy.workspace.quickAdd.label') }}
    </label>
    <input
      :id="`quick-add-${dimensionName}`"
      ref="input"
      v-model="label"
      class="taxonomy-quick-add__input"
      :placeholder="$t('taxonomy.workspace.quickAdd.placeholder')"
      :disabled="saving"
      :maxlength="labelLimit"
    />
    <label
      class="taxonomy-quick-add__hint"
      :for="`quick-add-${dimensionName}-identifier`"
    >
      {{ $t('taxonomy.workspace.quickAdd.identifier') }}
    </label>
    <input
      :id="`quick-add-${dimensionName}-identifier`"
      v-model="identifier"
      class="taxonomy-quick-add__input taxonomy-quick-add__identifier"
      :class="{ 'taxonomy-quick-add__input--invalid': !identifierValid }"
      :aria-invalid="String(!identifierValid)"
      :disabled="saving"
      :maxlength="identifierLimit"
      spellcheck="false"
      @input="identifierTouched = true"
    />
    <template v-if="isEmailType">
      <label
        class="taxonomy-quick-add__hint"
        :for="`quick-add-${dimensionName}-doctrine`"
      >
        {{ $t('taxonomy.form.doctrineType') }}
      </label>
      <select
        :id="`quick-add-${dimensionName}-doctrine`"
        v-model="doctrineType"
        class="taxonomy-quick-add__input taxonomy-quick-add__doctrine"
        :disabled="saving"
        @keydown.enter.prevent="add"
      >
        <option value="">{{ $t('taxonomy.form.doctrineTypeNone') }}</option>
        <option
          v-for="option in doctrineTypes"
          :key="option.value"
          :value="option.value"
        >
          {{ option.text }}
        </option>
      </select>
    </template>
    <v-btn
      type="submit"
      color="accent"
      elevation="0"
      small
      :loading="saving"
      :disabled="!label.trim() || !identifierValid"
    >
      <lucide-plus :size="16" class="mr-1" />
      {{ $t('taxonomy.workspace.quickAdd.action') }}
    </v-btn>
  </form>
</template>

<style lang="scss" scoped>
.taxonomy-quick-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border: 1px solid var(--gray-300);
  border-top: 0;
  border-radius: 0 0 7px 7px;
  background: var(--gray-100);

  &__input {
    flex: 1 1 220px;
    max-width: 360px;
    padding: 7px 12px;
    background: #fff;
    border: 1px solid var(--gray-300);
    border-radius: 6px;
    font-size: 13px;

    &:focus {
      outline: none;
      border-color: var(--v-accent-base);
      box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.2);
    }
  }

  &__identifier {
    flex: 0 1 180px;
    font-family: monospace;
  }

  &__doctrine {
    flex: 0 1 200px;
  }

  &__input--invalid {
    border-color: var(--v-error-base);
  }

  &__hint {
    font-size: 12px;
    color: var(--gray-700);
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
