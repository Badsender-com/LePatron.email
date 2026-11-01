<script>
import { Pencil } from 'lucide-vue';
import { TRIGGER_VALUES } from '~/helpers/taxonomy-builder.js';

/**
 * The trigger: its wording is the company's, its two values the doctrine's,
 * shown read-only. Emits `edit` with the dimension.
 */
export default {
  name: 'BsTaxonomyTriggerDimension',
  components: { LucidePencil: Pencil },
  props: {
    dimension: { type: Object, required: true },
  },
  computed: {
    triggerValues() {
      return TRIGGER_VALUES;
    },
  },
};
</script>

<template>
  <section class="taxonomy-dimension">
    <header class="taxonomy-dimension__header">
      <h2 class="taxonomy-dimension__title">
        {{ dimension.label }}
      </h2>
      <v-chip x-small outlined color="accent">
        {{ $t('taxonomy.dimensions.standard') }}
      </v-chip>
      <v-spacer />
      <v-btn text small color="accent" @click="$emit('edit', dimension)">
        <lucide-pencil :size="16" class="mr-1" />
        {{ $t('global.edit') }}
      </v-btn>
    </header>
    <p v-if="dimension.description" class="taxonomy-dimension__description">
      {{ dimension.description }}
    </p>
    <!-- The doctrine's two values: shown so the admin knows them, never
         edited. -->
    <p class="taxonomy-dimension__hint">
      {{ $t('taxonomy.dimensions.trigger.readOnly') }}
    </p>
    <dl class="taxonomy-dimension__values">
      <div
        v-for="value in triggerValues"
        :key="value.value"
        class="taxonomy-dimension__value"
      >
        <dt>{{ $t(`${value.key}.label`) }}</dt>
        <dd>{{ $t(`${value.key}.description`) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style lang="scss" scoped>
.taxonomy-dimension {
  margin-bottom: 2rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
  }

  &__description,
  &__hint {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  &__values {
    margin: 0;
  }

  &__value {
    padding: 0.75rem 0;
    border-top: 1px solid var(--gray-200);

    dt {
      font-weight: 500;
    }

    dd {
      color: var(--gray-700);
      font-size: 0.875rem;
      margin: 0;
    }
  }
}
</style>
