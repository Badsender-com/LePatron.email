<script>
import { FOLDER, SET_FILTERS } from '~/store/folder';
import { TEMPLATE } from '~/store/template';
import { mapState } from 'vuex';
import _ from 'lodash';

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
    },
    handleNameChange: _.debounce(function (value) {
      this.commitFilterChangeToStore({ name: value });
    }, 300),
    handleTemplateChange(value) {
      this.commitFilterChangeToStore({ templates: value });
    },
    handleTagsChange(value) {
      this.commitFilterChangeToStore({ tags: value });
    },
    handleCreatedAtStartChange(value) {
      this.commitFilterChangeToStore({ createdAtStart: value });
    },
    handleCreatedAtEndChange(value) {
      this.commitFilterChangeToStore({ createdAtEnd: value });
    },
    handleUpdatedAtStartChange(value) {
      this.commitFilterChangeToStore({ updatedAtStart: value });
    },
    handleUpdatedAtEndChange(value) {
      this.commitFilterChangeToStore({ updatedAtEnd: value });
    },
    commitFilterChangeToStore(changeObject) {
      this.$store.commit(`${FOLDER}/${SET_FILTERS}`, {
        ...changeObject,
      });
      this.$emit('on-refresh');
    },
  },
};
</script>

<template>
  <v-expansion-panels flat focusable>
    <v-expansion-panel>
      <v-expansion-panel-header expand-icon="filter_list" disable-icon-rotate>
        {{ $t(`mailings.list`) }}
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
            @input="handleTemplateChange"
          />
          <v-select
            :value="filters.tags"
            :label="$t(`global.tags`)"
            :items="tags"
            multiple
            @input="handleTagsChange"
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
                  @input="handleCreatedAtStartChange"
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.createdAtStart"
                no-title
                @input="handleCreatedAtStartChange"
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
                  @input="handleCreatedAtEndChange"
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.createdAtEnd"
                no-title
                @input="handleCreatedAtEndChange"
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
                  @input="handleUpdatedAtStartChange"
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.updatedAtStart"
                no-title
                @input="handleUpdatedAtStartChange"
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
                  @input="handleUpdatedAtEndChange"
                  v-on="on"
                />
              </template>
              <v-date-picker
                :value="filters.updatedAtEnd"
                no-title
                @input="handleUpdatedAtEndChange"
              />
            </v-menu>
          </div>
          <v-select
            v-model="localFilters.tags"
            :label="$t(`global.tags`)"
            :items="tags"
            multiple
          />
          <div class="bs-mailings-filters__actions">
            <v-btn color="primary" text @click="reset">
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
  grid-column: span 3;
  text-align: right;
}
.bs-mailings-filters__date-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-gap: 1rem;
}
</style>
