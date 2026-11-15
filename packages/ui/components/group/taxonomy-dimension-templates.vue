<script>
import { templatesReading } from '~/helpers/taxonomy-preview.js';

/**
 * The Templates segment of a dimension: the company's templates that read it,
 * by its name or through a design token one of its values carries. Emits
 * `preview` with a template id, to open what an email of it proposes.
 */
export default {
  name: 'BsTaxonomyDimensionTemplates',
  props: {
    dimension: { type: Object, required: true },
    templates: { type: Array, default: () => [] },
    values: { type: Array, default: () => [] },
  },
  computed: {
    reading() {
      return templatesReading({
        dimension: this.dimension,
        templates: this.templates,
        values: this.values,
      });
    },
    compared() {
      return (template) =>
        Object.keys(
          (template.contract.compared || {})[this.dimension.name] || {}
        );
    },
  },
};
</script>

<template>
  <section class="dimension-templates">
    <p class="text-body-2">
      {{ $t('taxonomy.workspace.templates.intro', { label: dimension.label }) }}
    </p>
    <p v-if="!reading.length" class="dimension-templates__empty">
      {{ $t('taxonomy.workspace.templates.none', { label: dimension.label }) }}
    </p>
    <ul v-else class="dimension-templates__list">
      <li v-for="template in reading" :key="template.id">
        <span class="dimension-templates__name">{{ template.name }}</span>
        <span
          v-if="compared(template).length"
          class="dimension-templates__compared"
        >
          {{ $t('taxonomy.workspace.templates.compares') }}
          <code v-for="literal in compared(template)" :key="literal">{{
            literal
          }}</code>
        </span>
        <v-btn text small color="accent" @click="$emit('preview', template.id)">
          {{ $t('taxonomy.workspace.templates.preview') }}
        </v-btn>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.dimension-templates {
  max-width: 760px;

  &__empty {
    font-size: 13px;
    color: var(--gray-600);
  }

  &__list {
    list-style: none;
    padding: 0;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    background: #fff;

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--gray-200);

      &:last-child {
        border-bottom: 0;
      }
    }
  }

  &__name {
    flex: 1;
    min-width: 160px;
    font-weight: 500;
  }

  &__compared {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    font-size: 12px;
    color: var(--gray-700);
  }
}
</style>
