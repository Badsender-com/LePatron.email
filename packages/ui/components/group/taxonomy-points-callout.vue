<script>
import { AlertTriangle } from 'lucide-vue';

/**
 * The points to check of the selected dimension (ADR-0026), never blocking:
 * each says what is missing and links to where it is set. Emits `go` with the
 * segment to open.
 */
const SEGMENT_OF = {
  missingCode: 'values',
  nothingOffered: 'crossings',
  noValue: 'values',
  tokenUnread: 'templates',
  dimensionUnread: 'settings',
  literalNotCarried: 'templates',
};

export default {
  name: 'BsTaxonomyPointsCallout',
  components: { LucideAlertTriangle: AlertTriangle },
  props: {
    points: { type: Array, default: () => [] },
    values: { type: Array, default: () => [] },
    templates: { type: Array, default: () => [] },
  },
  computed: {
    labels() {
      return Object.fromEntries(
        this.values.map((value) => [String(value.id), value.label])
      );
    },
  },
  methods: {
    segmentOf(point) {
      return SEGMENT_OF[point.kind] || 'values';
    },
    textOf(point) {
      const names = (point.templateIds || [])
        .map((id) => (this.templates.find((t) => t.id === id) || {}).name)
        .filter(Boolean)
        .join(', ');
      return this.$t(`taxonomy.workspace.points.${point.kind}`, {
        value: this.labels[point.valueId] || '',
        parent: this.labels[point.parentValueId] || '',
        token: point.token || '',
        identifier: point.identifier || '',
        templates: names,
      });
    },
  },
};
</script>

<template>
  <div v-if="points.length" class="points-callout" role="status">
    <strong class="points-callout__title">
      <lucide-alert-triangle :size="16" />
      {{ $t('taxonomy.workspace.points.title', { n: points.length }) }}
    </strong>
    <ul>
      <li v-for="(point, index) in points" :key="index">
        {{ textOf(point) }}
        <a href="#" @click.prevent="$emit('go', segmentOf(point))">
          {{ $t(`taxonomy.workspace.segments.${segmentOf(point)}`) }}
        </a>
      </li>
    </ul>
  </div>
</template>

<style lang="scss" scoped>
.points-callout {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 180, 0, 0.6);
  background: rgba(255, 180, 0, 0.08);
  border-radius: 7px;
  font-size: 13px;

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #8a5a00;
  }

  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
}
</style>
