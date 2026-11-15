<script>
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { parentCandidates } from '~/helpers/taxonomy-builder.js';

/**
 * Moving a dimension under another parent: an explicit action, since its
 * values lose their defaults on the way (ADR-0024, ADR-0026). Emits `save`
 * with `{ id, payload: { parentName } }`.
 */
export default {
  name: 'BsTaxonomyDimensionMoveDialog',
  components: { BsModalForm, BsSelect },
  props: {
    loading: { type: Boolean, default: false },
    dimensions: { type: Array, default: () => [] },
  },
  data() {
    return { dimension: null, parentName: null };
  },
  computed: {
    parentItems() {
      if (!this.dimension) return [];
      const labels = Object.fromEntries(
        this.dimensions.map((d) => [d.name, d.label])
      );
      return [
        { value: null, text: this.$t('taxonomy.dimensions.form.parentNone') },
        ...parentCandidates(this.dimensions, this.dimension).map((name) => ({
          value: name,
          text: labels[name],
        })),
      ];
    },
    unchanged() {
      return (
        !this.dimension ||
        (this.dimension.parentName || null) === this.parentName
      );
    },
  },
  methods: {
    open(dimension) {
      this.dimension = dimension;
      this.parentName = dimension.parentName || null;
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      if (this.unchanged) return this.close();
      this.$emit('save', {
        id: this.dimension.id,
        payload: { parentName: this.parentName },
      });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="
      $t('taxonomy.workspace.move.title', {
        label: dimension ? dimension.label : '',
      })
    "
    :submit-label="$t('taxonomy.workspace.move.action')"
    :loading="loading"
    width="520"
    @submit="onSubmit"
  >
    <bs-select
      v-model="parentName"
      :label="$t('taxonomy.dimensions.form.parent')"
      :items="parentItems"
      :disabled="loading"
    />
    <p class="taxonomy-move__warning" role="note">
      {{ $t('taxonomy.workspace.move.warning') }}
    </p>
  </bs-modal-form>
</template>

<style lang="scss" scoped>
.taxonomy-move__warning {
  padding: 10px 12px;
  border: 1px solid rgba(255, 180, 0, 0.6);
  background: rgba(255, 180, 0, 0.08);
  border-radius: 7px;
  font-size: 13px;
  color: var(--gray-900);
}
</style>
