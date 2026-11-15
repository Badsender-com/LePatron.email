<script>
import { valuesProposed } from '~/helpers/taxonomy-preview.js';

/**
 * What an email of a template proposes (ADR-0026): pick a template, read the
 * dimensions it offers, their values, under which parent value each child
 * value is offered, the defaults, and the design tokens it reads. Emits
 * `select-template` with a template id.
 */
export default {
  name: 'BsTaxonomyTemplatePreview',
  props: {
    templates: { type: Array, default: () => [] },
    templateId: { type: String, default: null },
    dimensions: { type: Array, default: () => [] },
    values: { type: Array, default: () => [] },
  },
  computed: {
    template() {
      return (
        this.templates.find((t) => t.id === this.templateId) ||
        this.templates[0] ||
        null
      );
    },
    preview() {
      if (!this.template) return null;
      return valuesProposed({
        template: this.template,
        dimensions: this.dimensions,
        values: this.values,
      });
    },
    labels() {
      return Object.fromEntries(
        this.values.map((value) => [String(value.id), value.label])
      );
    },
  },
  methods: {
    labelOf(id) {
      return (
        this.labels[id] || this.$t(`taxonomy.dimensions.trigger.${id}.label`)
      );
    },
    isDefault(entry, id) {
      return entry.defaultValue === id;
    },
  },
};
</script>

<template>
  <section class="template-preview">
    <h2 class="template-preview__title">
      {{ $t('taxonomy.workspace.preview.title') }}
    </h2>
    <p v-if="!templates.length" class="text-body-2">
      {{ $t('taxonomy.workspace.preview.noTemplate') }}
    </p>
    <template v-else>
      <v-chip-group
        :value="template && template.id"
        mandatory
        column
        active-class="accent--text"
        @change="$emit('select-template', $event)"
      >
        <v-chip v-for="t in templates" :key="t.id" :value="t.id" small outlined>
          {{ t.name }}
        </v-chip>
      </v-chip-group>
      <div v-if="preview" class="template-preview__body">
        <div
          v-for="entry in preview.dimensions"
          :key="entry.name"
          class="template-preview__dimension"
        >
          <h3>{{ entry.label }}</h3>
          <dl v-if="entry.under" class="template-preview__under">
            <template v-for="(ids, parentId) in entry.under">
              <dt :key="`${parentId}-t`">{{ labelOf(parentId) }}</dt>
              <dd :key="`${parentId}-d`">
                <span v-if="!ids.length" class="template-preview__none">
                  {{ $t('taxonomy.workspace.preview.nothing') }}
                </span>
                <span
                  v-for="id in ids"
                  :key="id"
                  :class="{
                    'template-preview__default':
                      entry.defaultUnder[parentId] === id,
                  }"
                >
                  {{ labelOf(id) }}
                </span>
              </dd>
            </template>
          </dl>
          <p v-else class="template-preview__values">
            <span
              v-for="id in entry.values"
              :key="id"
              :class="{ 'template-preview__default': isDefault(entry, id) }"
            >
              {{ labelOf(id) }}
            </span>
          </p>
        </div>
        <p class="template-preview__tokens">
          {{ $t('taxonomy.workspace.preview.tokens') }}
          <code v-for="token in preview.tokens" :key="token">{{ token }}</code>
          <span v-if="!preview.tokens.length">—</span>
        </p>
        <p class="template-preview__legend">
          {{ $t('taxonomy.workspace.preview.legend') }}
        </p>
      </div>
    </template>
  </section>
</template>

<style lang="scss" scoped>
.template-preview {
  &__title {
    font-size: 18px;
    font-weight: 600;
    color: var(--v-primary-base);
  }

  &__body {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }

  &__dimension {
    padding: 12px 16px;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    background: #fff;

    h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 6px;
    }
  }

  &__under {
    display: grid;
    grid-template-columns: minmax(120px, 220px) minmax(0, 1fr);
    gap: 4px 12px;
    font-size: 13px;

    dt {
      color: var(--gray-700);
    }

    dd {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
    }
  }

  &__values {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    font-size: 13px;
  }

  &__default {
    font-weight: 600;

    &::after {
      content: ' ★';
      color: #8a5a00;
    }
  }

  &__none,
  &__legend {
    font-size: 12px;
    color: var(--gray-600);
  }

  &__tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: 13px;
  }
}
</style>
