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
.filters-panel {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;

  &__header {
    background: #fafafa;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.7);
    min-height: 48px;
    padding: 0 1rem;

    &:hover {
      background: #f5f5f5;
    }
  }

  &__content {
    background: #fff;

    ::v-deep .v-expansion-panel-content__wrap {
      padding: 1rem;
    }
  }
}

.filters-form {
  &__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 0.5rem;

    &--dates {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  &__date-group {
    display: flex;
    flex-direction: column;
  }

  &__date-label {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__date-inputs {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;

    .bs-text-field {
      flex: 1;
      margin-bottom: 0;
    }

    // Ensure date fields have visible borders
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      border-radius: 4px;
      background: #fff !important;
      min-height: 36px;
      cursor: pointer;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4) !important;
      }
    }

    ::v-deep .v-input--is-focused .v-input__slot {
      border-color: #00acdc !important;
    }
  }

  &__date-separator {
    display: flex;
    align-items: center;
    height: 36px;
    color: rgba(0, 0, 0, 0.4);
    font-size: 0.875rem;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
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
