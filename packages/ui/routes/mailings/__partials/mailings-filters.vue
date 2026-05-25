<script>
import { FOLDER, SET_FILTERS } from '~/store/folder';
import { TEMPLATE } from '~/store/template';
import { mapState } from 'vuex';
import debounce from 'lodash/debounce';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { Filter, RotateCcw, Calendar } from 'lucide-vue';

export default {
  name: 'MailingsFilters',
  components: {
    BsTextField,
    BsSelect,
    LucideFilter: Filter,
    LucideRotateCcw: RotateCcw,
    LucideCalendar: Calendar,
  },
  props: {
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      templatesIsLoading: true,
      pickerCreatedStart: false,
      pickerCreatedEnd: false,
      pickerUpdatedStart: false,
      pickerUpdatedEnd: false,
    };
  },
  computed: {
    ...mapState(FOLDER, ['filters']),
    ...mapState(TEMPLATE, ['templates']),
  },
  watch: {
    $route: 'reset',
  },

  methods: {
    reset() {
      this.$store.commit(`${FOLDER}/${SET_FILTERS}`, {
        name: '',
        templates: [],
        createdAtStart: '',
        createdAtEnd: '',
        updatedAtStart: '',
        updatedAtEnd: '',
        tags: [],
      });
      this.$emit('on-refresh', { pagination: { page: 1 } });
    },
    handleNameChange: debounce(function (value) {
      this.commitFilterChangeToStore({ name: value });
    }, 300),
    handleFilterChange(filterKey, filterValue) {
      this.commitFilterChangeToStore({ [filterKey]: filterValue });
    },
    commitFilterChangeToStore(changeObject) {
      this.$store.commit(`${FOLDER}/${SET_FILTERS}`, {
        ...changeObject,
      });
      this.$emit('on-refresh', { pagination: { page: 1 } });
    },
  },
};
</script>

<template>
  <v-expansion-panels accordion focusable flat class="filters-panel">
    <v-expansion-panel>
      <v-expansion-panel-header class="filters-panel__header">
        <div class="d-flex align-center">
          <lucide-filter :size="18" class="mr-2" />
          {{ $t(`mailings.filters.title`) }}
        </div>
        <template #actions>
          <v-icon>$expand</v-icon>
        </template>
      </v-expansion-panel-header>
      <v-expansion-panel-content class="filters-panel__content">
        <div class="filters-form">
          <div class="filters-form__row">
            <bs-text-field
              :value="filters.name"
              :label="$t(`global.name`)"
              :placeholder="$t('mailings.filters.searchPlaceholder')"
              clearable
              dense
              @input="handleNameChange"
            />
            <bs-select
              :value="filters.templates"
              :label="$tc(`global.template`, 2)"
              :items="templates"
              item-text="name"
              item-value="id"
              multiple
              clearable
              dense
              @input="(value) => handleFilterChange('templates', value)"
            />
            <bs-select
              :value="filters.tags"
              :label="$t(`global.tags`)"
              :items="tags"
              multiple
              clearable
              dense
              @input="(value) => handleFilterChange('tags', value)"
            />
          </div>

          <div class="filters-form__row filters-form__row--dates">
            <div class="filters-form__date-group">
              <span class="filters-form__date-label">
                <lucide-calendar :size="14" class="mr-1" />
                {{ $t(`mailings.filters.createdBetween`) }}
              </span>
              <div class="filters-form__date-inputs">
                <v-menu
                  v-model="pickerCreatedStart"
                  :close-on-content-click="false"
                  :nudge-right="40"
                  transition="scale-transition"
                  offset-y
                  min-width="290px"
                >
                  <template #activator="{ on }">
                    <bs-text-field
                      :value="filters.createdAtStart"
                      :placeholder="$t('mailings.filters.startDate')"
                      clearable
                      dense
                      readonly
                      v-on="on"
                      @input="
                        (value) => handleFilterChange('createdAtStart', value)
                      "
                    />
                  </template>
                  <v-date-picker
                    :value="filters.createdAtStart"
                    no-title
                    @input="
                      (value) => handleFilterChange('createdAtStart', value)
                    "
                  />
                </v-menu>
                <span class="filters-form__date-separator">-</span>
                <v-menu
                  v-model="pickerCreatedEnd"
                  :close-on-content-click="false"
                  :nudge-right="40"
                  transition="scale-transition"
                  offset-y
                  min-width="290px"
                >
                  <template #activator="{ on }">
                    <bs-text-field
                      :value="filters.createdAtEnd"
                      :placeholder="$t('mailings.filters.endDate')"
                      clearable
                      dense
                      readonly
                      v-on="on"
                      @input="
                        (value) => handleFilterChange('createdAtEnd', value)
                      "
                    />
                  </template>
                  <v-date-picker
                    :value="filters.createdAtEnd"
                    no-title
                    @input="
                      (value) => handleFilterChange('createdAtEnd', value)
                    "
                  />
                </v-menu>
              </div>
            </div>

            <div class="filters-form__date-group">
              <span class="filters-form__date-label">
                <lucide-calendar :size="14" class="mr-1" />
                {{ $t(`mailings.filters.updatedBetween`) }}
              </span>
              <div class="filters-form__date-inputs">
                <v-menu
                  v-model="pickerUpdatedStart"
                  :close-on-content-click="false"
                  :nudge-right="40"
                  transition="scale-transition"
                  offset-y
                  min-width="290px"
                >
                  <template #activator="{ on }">
                    <bs-text-field
                      :value="filters.updatedAtStart"
                      :placeholder="$t('mailings.filters.startDate')"
                      clearable
                      dense
                      readonly
                      v-on="on"
                      @input="
                        (value) => handleFilterChange('updatedAtStart', value)
                      "
                    />
                  </template>
                  <v-date-picker
                    :value="filters.updatedAtStart"
                    no-title
                    @input="
                      (value) => handleFilterChange('updatedAtStart', value)
                    "
                  />
                </v-menu>
                <span class="filters-form__date-separator">-</span>
                <v-menu
                  v-model="pickerUpdatedEnd"
                  :close-on-content-click="false"
                  :nudge-right="40"
                  transition="scale-transition"
                  offset-y
                  min-width="290px"
                >
                  <template #activator="{ on }">
                    <bs-text-field
                      :value="filters.updatedAtEnd"
                      :placeholder="$t('mailings.filters.endDate')"
                      clearable
                      dense
                      readonly
                      v-on="on"
                      @input="
                        (value) => handleFilterChange('updatedAtEnd', value)
                      "
                    />
                  </template>
                  <v-date-picker
                    :value="filters.updatedAtEnd"
                    no-title
                    @input="
                      (value) => handleFilterChange('updatedAtEnd', value)
                    "
                  />
                </v-menu>
              </div>
            </div>
          </div>

          <div class="filters-form__actions">
            <v-btn text color="primary" @click="reset">
              <lucide-rotate-ccw :size="16" class="mr-1" />
              {{ $t(`global.reset`) }}
            </v-btn>
          </div>
        </div>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable Filters Panel — LePatron Design System v1.0
   Based on: /tmp/lepatron-design-v2/project/preview/components-data-table.html
   ========================================================================= */

.filters-panel {
  border: 1px solid rgba(0, 0, 0, 0.12); // --gray-300
  border-radius: 10px; // --r-md
  overflow: hidden;
  margin-bottom: 16px;

  &__header {
    background: rgba(0, 0, 0, 0.02); // --gray-50
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87); // --gray-900
    min-height: 52px; // BsDataTable toolbar height
    padding: 0 16px;
    transition: background 0.15s ease-out;

    &:hover {
      background: rgba(0, 0, 0, 0.04); // --gray-100
    }
  }

  &__content {
    background: rgba(0, 0, 0, 0.02); // --gray-50 (BsDataTable spec)
    border-top: 1px solid rgba(0, 0, 0, 0.08); // --gray-200

    ::v-deep .v-expansion-panel-content__wrap {
      padding: 16px; // BsDataTable filters padding
    }
  }
}

.filters-form {
  /* Grid 3 columns like BsDataTable spec */
  &__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px 16px; // BsDataTable spec: 12px row gap, 16px column gap
    margin-bottom: 8px;

    &--dates {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  &__date-group {
    display: flex;
    flex-direction: column;
    gap: 4px; // BsDataTable label-to-control gap
  }

  &__date-label {
    display: flex;
    align-items: center;
    font-size: 11px; // BsDataTable filters label size
    font-weight: 600;
    color: rgba(0, 0, 0, 0.54); // --gray-700
    letter-spacing: 0.02em;
  }

  &__date-inputs {
    display: flex;
    align-items: flex-start;
    gap: 6px; // BsDataTable range gap

    .bs-text-field {
      flex: 1;
      margin-bottom: 0;
    }

    /* BsDataTable filter input styles */
    ::v-deep .v-input__slot {
      height: 32px !important; // BsDataTable filter input height
      min-height: 32px !important;
      padding: 0 10px !important;
      background: #fff !important;
      border: 1px solid rgba(0, 0, 0, 0.12) !important; // --gray-300
      border-radius: 4px !important; // --r-sm
      cursor: pointer;
      font-size: 12px !important;
      transition: border 0.15s ease-out, box-shadow 0.15s ease-out;

      &:hover {
        border-color: rgba(0, 0, 0, 0.2) !important;
      }
    }

    ::v-deep .v-input--is-focused .v-input__slot {
      border-color: var(--v-accent-base) !important;
      box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.15) !important;
    }
  }

  &__date-separator {
    display: flex;
    align-items: center;
    height: 32px; // Match input height
    color: rgba(0, 0, 0, 0.38); // --gray-500
    font-size: 11px; // BsDataTable range separator size
  }

  /* Reset button (BsDataTable spec) */
  &__actions {
    grid-column: 1 / -1; // Span all columns
    display: flex;
    justify-content: flex-end;
    padding-top: 4px; // BsDataTable filters footer padding

    ::v-deep .v-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      background: transparent !important;
      padding: 4px 8px !important;
      min-width: auto !important;
      height: auto !important;
      border-radius: 4px !important; // --r-sm
      font-size: 12px !important;
      color: rgba(0, 0, 0, 0.54) !important; // --gray-700
      text-transform: none !important;
      letter-spacing: normal !important;

      &:hover {
        background: rgba(0, 0, 0, 0.08) !important; // --gray-200
        color: rgba(0, 0, 0, 0.87) !important; // --gray-900
      }
    }
  }
}

@media (max-width: 960px) {
  .filters-form__row {
    grid-template-columns: 1fr;
  }

  .filters-form__row--dates {
    grid-template-columns: 1fr;
  }
}
</style>
