<script>
import { FOLDER, SET_FILTERS } from '~/store/folder';
import { activeFiltersCount, isSearchingAll } from '~/utils/mailing-search';
import { TEMPLATE } from '~/store/template';
import { mapState } from 'vuex';
import debounce from 'lodash/debounce';
import MailingsDateField from '~/routes/mailings/__partials/mailings-date-field';
import MailingsSearchScope from '~/routes/mailings/__partials/mailings-search-scope';
import { Search, Filter, ChevronDown, RotateCcw, Calendar } from 'lucide-vue';

export default {
  name: 'MailingsFilters',
  components: {
    MailingsDateField,
    MailingsSearchScope,
    LucideSearch: Search,
    LucideFilter: Filter,
    LucideChevronDown: ChevronDown,
    LucideRotateCcw: RotateCcw,
    LucideCalendar: Calendar,
  },
  props: {
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      templatesIsLoading: true,
      expanded: false,
      dateRanges: [
        { key: 'createdAt', label: 'createdBetween' },
        { key: 'updatedAt', label: 'updatedBetween' },
      ],
    };
  },
  computed: {
    ...mapState(FOLDER, ['filters', 'workspacesHasRight']),
    ...mapState(TEMPLATE, ['templates']),
    searchingAll() {
      return isSearchingAll(this.$route.query);
    },
    // The panel's own filters: a narrowed list must say why, and filters
    // carry over a change of search scope (ADR 0007). The name has its own
    // field, cleared where it is typed.
    panelFilters() {
      // eslint-disable-next-line no-unused-vars
      const { name, ...rest } = this.filters;
      return rest;
    },
    activeCount() {
      return activeFiltersCount(this.panelFilters);
    },
  },
  watch: {
    // A new location starts with no filter. The search keeps them: switching
    // the scope looks further for the same email, and leaving a result for
    // its location finds it there (ADR 0007). The workspace tree reloads the
    // list on those route changes.
    $route(to, from) {
      const moved =
        to.query.wid !== from.query.wid || to.query.fid !== from.query.fid;
      if (moved && !isSearchingAll(from.query)) {
        this.reset();
      }
    },
  },

  // One debounce per instance (a method would lose its `cancel`).
  created() {
    this.debouncedNameChange = debounce((value) => {
      this.commitFilterChangeToStore({ name: value });
    }, 300);
  },
  beforeDestroy() {
    this.debouncedNameChange.cancel();
  },

  methods: {
    clearFilters() {
      this.$store.commit(`${FOLDER}/${SET_FILTERS}`, {
        name: '',
        templates: [],
        createdAtStart: '',
        createdAtEnd: '',
        updatedAtStart: '',
        updatedAtEnd: '',
        tags: [],
      });
    },
    reset() {
      this.clearFilters();
      this.$emit('on-refresh', { pagination: { page: 1 } });
    },
    // The bar's "Réinitialiser" resets the whole search: name, filters and
    // scope. Leaving "all workspaces" is a route change, which reloads the
    // list on its own.
    resetSearch() {
      if (!this.searchingAll) return this.reset();
      this.clearFilters();
      const query = { ...this.$route.query };
      delete query.scope;
      this.$router.push({ query });
    },
    // Escape empties the name field only, scope and filters kept.
    clearName() {
      this.debouncedNameChange.cancel();
      this.commitFilterChangeToStore({ name: '' });
    },
    handleNameChange(value) {
      this.debouncedNameChange(value);
    },
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
  <section
    class="filters-panel"
    role="search"
    :aria-label="$t('mailings.filters.title')"
  >
    <v-text-field
      :value="filters.name"
      :placeholder="$t('mailings.filters.searchPlaceholder')"
      :aria-label="$t('mailings.filters.searchPlaceholder')"
      class="filters-panel__search"
      outlined
      dense
      clearable
      hide-details
      @input="handleNameChange"
      @keydown.esc.prevent="clearName"
    >
      <template #prepend-inner>
        <lucide-search :size="16" aria-hidden="true" />
      </template>
    </v-text-field>

    <div class="filters-panel__row">
      <mailings-search-scope />
      <button
        type="button"
        class="filters-panel__button"
        :class="{ 'filters-panel__button--active': activeCount > 0 }"
        :aria-expanded="String(expanded)"
        aria-controls="mailings-filters-content"
        @click="expanded = !expanded"
      >
        <lucide-filter :size="14" aria-hidden="true" />
        {{ $t('mailings.filters.title') }}
        <span v-if="activeCount" class="filters-panel__count">
          {{ activeCount }}
        </span>
        <lucide-chevron-down
          :size="14"
          aria-hidden="true"
          class="filters-panel__chevron"
          :class="{ 'filters-panel__chevron--open': expanded }"
        />
      </button>
      <button
        v-if="activeCount"
        type="button"
        class="filters-panel__button"
        :aria-label="$t('mailings.filters.resetSearch')"
        @click="resetSearch"
      >
        <lucide-rotate-ccw :size="14" aria-hidden="true" />
        {{ $t('global.reset') }}
      </button>
    </div>

    <p v-if="searchingAll" class="filters-panel__hint">
      {{
        $t('mailings.search.allWorkspacesHint', {
          n: workspacesHasRight.length,
        })
      }}
    </p>

    <v-expand-transition>
      <div v-show="expanded" id="mailings-filters-content" class="filters-form">
        <div class="filters-form__grid">
          <div class="filters-form__field">
            <label for="mailings-filter-templates">
              {{ $tc('global.template', 2) }}
            </label>
            <v-select
              id="mailings-filter-templates"
              :value="filters.templates"
              :items="templates"
              :placeholder="$t('mailings.filters.allTemplates')"
              item-text="name"
              item-value="id"
              persistent-placeholder
              outlined
              dense
              multiple
              clearable
              hide-details
              @input="(value) => handleFilterChange('templates', value)"
            />
          </div>
          <div class="filters-form__field">
            <label for="mailings-filter-tags">{{ $t('global.tags') }}</label>
            <v-select
              id="mailings-filter-tags"
              :value="filters.tags"
              :items="tags"
              :placeholder="$t('mailings.filters.allTags')"
              persistent-placeholder
              outlined
              dense
              multiple
              clearable
              hide-details
              @input="(value) => handleFilterChange('tags', value)"
            />
          </div>
          <fieldset
            v-for="range in dateRanges"
            :key="range.key"
            class="filters-form__field"
          >
            <legend>
              <lucide-calendar :size="14" aria-hidden="true" />
              {{ $t(`mailings.filters.${range.label}`) }}
            </legend>
            <div class="filters-form__range">
              <mailings-date-field
                :value="filters[`${range.key}Start`]"
                :label="`${$t(`mailings.filters.${range.label}`)} ${$t(
                  'mailings.filters.startDate'
                )}`"
                @input="
                  (value) => handleFilterChange(`${range.key}Start`, value)
                "
              />
              <span>{{ $t('mailings.filters.to') }}</span>
              <mailings-date-field
                :value="filters[`${range.key}End`]"
                :label="`${$t(`mailings.filters.${range.label}`)} ${$t(
                  'mailings.filters.endDate'
                )}`"
                @input="(value) => handleFilterChange(`${range.key}End`, value)"
              />
            </div>
          </fieldset>
        </div>
      </div>
    </v-expand-transition>
  </section>
</template>

<style lang="scss" scoped>
.filters-panel {
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid var(--gray-300);
  border-radius: 10px;

  // Fields keep a reachable width on a wide screen: the card stretches with
  // the table, its controls do not.
  &__search {
    max-width: 520px;

    ::v-deep .v-input__slot {
      min-height: 38px !important;
    }

    // Vuetify sets the icon from the top of the field: it sits on the text's
    // middle line instead.
    ::v-deep .v-input__prepend-inner {
      display: flex;
      align-items: center;
      align-self: center;
      margin-top: 0 !important;
      padding-right: 8px;
      color: var(--gray-600);
    }
  }

  &__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;

    // The scope and the buttons sit together, near the field they refine.
    > :first-child {
      margin-right: 8px;
    }
  }

  &__button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border: 1px solid var(--gray-300);
    border-radius: 4px;
    background: #fff;
    color: var(--v-primary-base);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;

    &:hover {
      background: var(--gray-50);
    }

    &--active {
      border-color: var(--v-accent-base);
      background: rgba(0, 172, 220, 0.08);
    }
  }

  &__count {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--v-primary-base);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  &__chevron {
    transition: transform 0.15s ease-out;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__hint {
    margin: 12px 0 0;
    font-size: 12px;
    color: var(--gray-600);
  }
}

.filters-form {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--gray-200);

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 280px));
    gap: 16px;
  }

  &__field {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;

    label,
    legend {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
      padding: 0;
      font-size: 13px;
      font-weight: 500;
      color: var(--gray-700);
    }

    legend {
      font-weight: 500;
      color: var(--gray-700);
    }
  }

  &__range {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--gray-600);
  }

  ::v-deep .v-input__slot {
    min-height: 38px !important;
    font-size: 13px;
  }

  // A native date field has a width of its own: let it shrink with its column.
  &__range ::v-deep .v-input {
    min-width: 0;
  }

  &__range ::v-deep input {
    min-width: 0;
    font-size: 12px;
  }

  &__range ::v-deep .v-input__slot {
    padding: 0 8px !important;
  }
}

@media (max-width: 600px) {
  .filters-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
