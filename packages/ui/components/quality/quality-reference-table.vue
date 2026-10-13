<script>
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { exceptionsOf, generalOf } from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';

// Every check and what applies to it, read only, folded by default: where to
// look at everything without the page listing it.
export default {
  name: 'BsQualityReferenceTable',
  components: { BsDataTable },
  mixins: [mixinQualityTexts],
  props: {
    // The group's `qualitySettings`, as saved.
    settings: { type: Object, default: null },
  },
  computed: {
    count() {
      return Object.keys(CHECKS).length;
    },
    headers() {
      return [
        { text: this.$t('qualitySettings.reference.check'), value: 'name' },
        {
          text: this.$t('qualitySettings.reference.category'),
          value: 'category',
        },
        {
          text: this.$t('qualitySettings.reference.applied'),
          value: 'applied',
          sortable: false,
        },
      ];
    },
    items() {
      const applied = generalOf(this.settings);
      const exceptions = exceptionsOf(this.settings);
      return Object.keys(CHECKS).map((id) => ({
        id,
        name: this.checkName(id),
        category: this.categoryName(id),
        applied: this.exceptionText(id, applied[id]),
        isException: Boolean(exceptions[id]),
      }));
    },
  },
};
</script>

<template>
  <v-expansion-panels flat class="qx-reference">
    <v-expansion-panel>
      <v-expansion-panel-header>
        {{ $t('qualitySettings.reference.toggle', { count }) }}
      </v-expansion-panel-header>
      <v-expansion-panel-content>
        <bs-data-table :headers="headers" :items="items" :items-per-page="-1">
          <template #item.name="{ item }">
            {{ item.name }}
            <v-chip
              v-if="item.isException"
              x-small
              outlined
              color="accent"
              class="ml-2"
            >
              {{ $t('qualitySettings.reference.exception') }}
            </v-chip>
          </template>
        </bs-data-table>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<style lang="scss" scoped>
.qx-reference {
  margin-top: 32px;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
}
</style>
