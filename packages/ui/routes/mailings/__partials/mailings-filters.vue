<script>
import { FOLDER, SET_FILTERS } from '~/store/folder';
import { TEMPLATE } from '~/store/template';
import { mapState } from 'vuex';
import debounce from 'lodash/debounce';

export default {
  name: 'MailingsFilters',
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
  <v-expansion-panels accordion focusable flat tile>
    <v-expansion-panel>
      <v-expansion-panel-header
        expand-icon="filter_list"
        color="grey lighten-3"
      >
        <div>
          <v-icon>manage_search</v-icon>
          {{ $t(`mailings.list`) }}
        </div>
      </v-expansion-panel-header>
      <v-expansion-panel-content>
        <div class="bs-mailings-filters__form">
          <v-text-field
            :value="filters.name"
            :label="$t(`global.name`)"
            clearable
            @input="handleNameChange"
          />
          <v-select
            :value="filters.templates"
            :label="$tc(`global.template`, 2)"
            :items="templates"
            item-text="name"
            item-value="id"
            multiple
            @input="(value) => handleFilterChange('templates', value)"
          />
          <v-select
            :value="filters.tags"
            :label="$t(`global.tags`)"
            :items="tags"
            multiple
            :disabled="true"
            @input="(value) => handleFilterChange('tags', value)"
          />
          <div class="bs-mailings-filters__date-picker">
            <v-menu
              v-model="pickerCreatedStart"
              :close-on-content-click="false"
              :nudge-right="40"
              transition="scale-transition"
              offset-y
              min-width="290px"
            >
              <template #activator="{ on }">
                <v-text-field
                  :value="filters.createdAtStart"
                  :label="$t(`mailings.filters.createdBetween`)"
                  prepend-icon="event"
                  clearable
                  @input="
                    (value) => handleFilterChange('createdAtStart', value)
                  "
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.createdAtStart"
                no-title
                @input="(value) => handleFilterChange('createdAtStart', value)"
              />
            </v-menu>
            <v-menu
              v-model="pickerCreatedEnd"
              :close-on-content-click="false"
              :nudge-right="40"
              transition="scale-transition"
              offset-y
              min-width="290px"
            >
              <template #activator="{ on }">
                <v-text-field
                  :value="filters.createdAtEnd"
                  :label="$t(`mailings.filters.and`)"
                  prepend-icon="event"
                  clearable
                  @input="(value) => handleFilterChange('createdAtEnd', value)"
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.createdAtEnd"
                no-title
                @input="(value) => handleFilterChange('createdAtEnd', value)"
              />
            </v-menu>
          </div>
          <div class="bs-mailings-filters__date-picker">
            <v-menu
              v-model="pickerUpdatedStart"
              :close-on-content-click="false"
              :nudge-right="40"
              transition="scale-transition"
              offset-y
              min-width="290px"
            >
              <template #activator="{ on }">
                <v-text-field
                  :value="filters.updatedAtStart"
                  :label="$t(`mailings.filters.updatedBetween`)"
                  prepend-icon="event"
                  clearable
                  @input="
                    (value) => handleFilterChange('updatedAtStart', value)
                  "
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.updatedAtStart"
                no-title
                @input="(value) => handleFilterChange('updatedAtStart', value)"
              />
            </v-menu>

            <v-menu
              v-model="pickerUpdatedEnd"
              :close-on-content-click="false"
              :nudge-right="40"
              transition="scale-transition"
              offset-y
              min-width="290px"
            >
              <template #activator="{ on }">
                <v-text-field
                  :value="filters.updatedAtEnd"
                  :label="$t(`mailings.filters.and`)"
                  prepend-icon="event"
                  clearable
                  @input="(value) => handleFilterChange('updatedAtEnd', value)"
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.updatedAtEnd"
                no-title
                @input="(value) => handleFilterChange('updatedAtEnd', value)"
              />
            </v-menu>
          </div>
          <div class="bs-mailings-filters__actions">
            <v-btn color="grey darken-2" dark elevation="0" @click="reset">
              {{ $t(`global.reset`) }}
            </v-btn>
          </div>
        </div>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<style lang="scss" scoped>
.bs-mailings-filters__form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-gap: 0 3rem;
}
.bs-mailings-filters__actions {
  text-align: right;
  align-self: center;
}
.bs-mailings-filters__date-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-gap: 1rem;
}
</style>
