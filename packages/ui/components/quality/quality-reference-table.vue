<script>
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { referenceRows } from '~/helpers/quality-drafts.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import { ChevronDown } from 'lucide-vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';

// Every check and what applies to it, read only, folded by default: where to
// look at everything without the page listing it.
export default {
  name: 'BsQualityReferenceTable',
  components: { BsDataTable, ChevronDown },
  mixins: [mixinQualityTexts],
  props: {
    // The group's `qualitySettings` as edited (generalOfDrafts): what will
    // apply once saved.
    settings: { type: Object, default: null },
    // As stored: a row that differs is marked as not saved.
    savedSettings: { type: Object, default: null },
  },
  data() {
    return { open: false };
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
      return referenceRows(this.settings, this.savedSettings).map((row) => ({
        ...row,
        name: this.checkName(row.id),
        category: this.categoryName(row.id),
        applied: this.appliedText(row.id, row.applied),
      }));
    },
  },
};
</script>

<template>
  <section class="qx-reference">
    <button
      type="button"
      class="qx-reference__toggle"
      :aria-expanded="open ? 'true' : 'false'"
      @click="open = !open"
    >
      <chevron-down
        :size="16"
        class="qx-reference__chevron"
        :class="{ 'qx-reference__chevron--open': open }"
      />
      {{ $t('qualitySettings.reference.toggle', { count }) }}
    </button>
    <v-expand-transition>
      <div v-if="open" class="qx-reference__table">
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
            <v-chip
              v-if="item.unsaved"
              x-small
              class="ml-2 qx-reference__unsaved"
            >
              <span class="qx-reference__unsaved-dot" />
              {{ $t('qualitySettings.card.unsaved') }}
            </v-chip>
          </template>
        </bs-data-table>
      </div>
    </v-expand-transition>
  </section>
</template>

<style lang="scss" scoped>
.qx-reference {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid var(--gray-300);

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 0.8125rem;
    color: var(--gray-700);
    cursor: pointer;
  }

  &__chevron {
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  // As the cards' "Non enregistrée" chip.
  &__unsaved {
    background: rgba(255, 180, 0, 0.2) !important;
    color: var(--gray-900) !important;
    font-weight: 600;
  }

  &__unsaved-dot {
    width: 6px;
    height: 6px;
    margin-right: 5px;
    border-radius: 50%;
    background: var(--v-warning-base);
  }

  &__table {
    margin-top: 12px;
  }
}
</style>
