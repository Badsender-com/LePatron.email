<script>
import { Plus } from 'lucide-vue';
import * as apiRoutes from '~/helpers/api-routes.js';
import { proposeIdentifier } from '~/helpers/taxonomy-builder.js';

/**
 * The quick-add row under a dimension's values (ADR-0026): Enter adds the
 * value with the identifier proposed from its label, offered everywhere, and
 * keeps the cursor in the field for the next one. The rest is set in the
 * value's panel. Emits `added` and `error`.
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
    return { label: '', saving: false };
  },
  computed: {
    identifier() {
      return this.isEmailType ? '' : proposeIdentifier(this.label.trim());
    },
  },
  methods: {
    async add() {
      const label = this.label.trim();
      if (!label || this.saving) return;
      try {
        this.saving = true;
        await this.$axios.$post(apiRoutes.taxonomyItemsCreate(), {
          label,
          ...(this.identifier ? { canonicalType: this.identifier } : {}),
          order: this.nextOrder,
          type: this.dimensionName,
          groupId: this.$route.params.groupId,
        });
        this.label = '';
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
      maxlength="100"
    />
    <span v-if="identifier" class="taxonomy-quick-add__hint">
      {{ $t('taxonomy.workspace.quickAdd.identifier') }}
      <code>{{ identifier }}</code>
    </span>
    <v-btn
      type="submit"
      color="accent"
      elevation="0"
      small
      :loading="saving"
      :disabled="!label.trim()"
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
    background: var(--white);
    border: 1px solid var(--gray-300);
    border-radius: 6px;
    font-size: 13px;

    &:focus {
      outline: none;
      border-color: var(--v-accent-base);
      box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.2);
    }
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
