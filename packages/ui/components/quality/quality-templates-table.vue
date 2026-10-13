<script>
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { exceptionsOf } from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import { ChevronRight } from 'lucide-vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';

const CATALOGUE_ORDER = Object.keys(CHECKS);

// The "Templates" tab: each template of the group, and what it sets for
// itself. A row opens the template's exceptions.
export default {
  name: 'BsQualityTemplatesTable',
  components: { BsDataTable, ChevronRight },
  mixins: [mixinQualityTexts],
  props: {
    templates: { type: Array, default: () => [] },
    groupId: { type: String, required: true },
  },
  data() {
    return { search: '', show: 'all' };
  },
  computed: {
    headers() {
      return [
        { text: this.$t('qualitySettings.templates.template'), value: 'name' },
        {
          text: this.$t('qualitySettings.templates.exceptions'),
          value: 'count',
          sortable: true,
        },
        { text: '', value: 'open', sortable: false, width: 48 },
      ];
    },
    showOptions() {
      return [
        { value: 'all', text: this.$t('qualitySettings.templates.all') },
        {
          value: 'with',
          text: this.$t('qualitySettings.templates.withExceptions'),
        },
      ];
    },
    rows() {
      return this.templates.map((template) => {
        const exceptions = exceptionsOf(template.qualitySettings);
        const ids = CATALOGUE_ORDER.filter((id) => exceptions[id]);
        return {
          id: template.id,
          name: template.name,
          count: ids.length,
          summary: ids
            .map((id) => this.exceptionSummary(id, exceptions[id]))
            .join(' · '),
        };
      });
    },
    items() {
      const query = this.search.trim().toLowerCase();
      return this.rows.filter(
        (row) =>
          (this.show === 'all' || row.count > 0) &&
          (!query || String(row.name).toLowerCase().includes(query))
      );
    },
  },
  methods: {
    open(row) {
      this.$router.push(
        `/groups/${this.groupId}/settings/quality/templates/${row.id}`
      );
    },
  },
};
</script>

<template>
  <div class="qx-templates">
    <p class="qx-templates__intro">
      {{ $t('qualitySettings.templates.intro') }}
    </p>
    <div v-if="templates.length" class="qx-templates__filters">
      <v-text-field
        v-model="search"
        :label="$t('qualitySettings.templates.search')"
        prepend-inner-icon="mdi-magnify"
        outlined
        dense
        hide-details
        clearable
        class="qx-templates__search"
      />
      <v-select
        v-model="show"
        :items="showOptions"
        :label="$t('qualitySettings.templates.show')"
        outlined
        dense
        hide-details
        class="qx-templates__show"
      />
    </div>
    <bs-data-table
      v-if="templates.length"
      :headers="headers"
      :items="items"
      clickable
      @click:row="open"
    >
      <template #item.count="{ item }">
        <span v-if="!item.count" class="qx-templates__none">
          {{ $t('qualitySettings.templates.none') }}
        </span>
        <span v-else class="qx-templates__exceptions">
          <v-chip x-small color="accent" outlined>
            {{ $tc('qualitySettings.exceptionCount', item.count) }}
          </v-chip>
          <span class="qx-templates__summary">{{ item.summary }}</span>
        </span>
      </template>
      <template #item.open="{ item }">
        <chevron-right
          :size="16"
          :aria-label="
            $t('qualitySettings.templates.open', { name: item.name })
          "
          class="qx-templates__open"
        />
      </template>
    </bs-data-table>
    <div v-else class="qx-templates__empty">
      {{ $t('qualitySettings.templates.empty') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.qx-templates {
  &__intro {
    margin: 8px 0 16px;
    font-size: 0.875rem;
    color: var(--gray-700);
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__search {
    flex: 1 1 260px;
    max-width: 360px;
  }

  &__show {
    flex: 0 1 240px;
  }

  &__open {
    color: var(--gray-700);
  }

  &__none {
    color: var(--gray-700);
  }

  &__exceptions {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 480px;
    color: var(--gray-700);
  }

  &__empty {
    padding: 24px;
    text-align: center;
    border: 1px dashed var(--gray-300);
    border-radius: 8px;
    color: var(--gray-700);
    font-size: 0.875rem;
  }
}
</style>
