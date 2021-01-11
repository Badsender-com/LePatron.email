<script>
export default {
  name: `bs-mailings-filters`,
  model: { prop: `filters`, event: `update` },
  props: {
    filters: { type: Object, default: () => ({}) },
    tags: { type: Array, default: () => [] },
    templates: { type: Array, default: () => [] },
  },
  data() {
    return {
      pickerCreatedStart: false,
      pickerCreatedEnd: false,
      pickerUpdatedStart: false,
      pickerUpdatedEnd: false,
    }
  },
  computed: {
    localFilters: {
      get() {
        return this.filters
      },
      set(updatedFilters) {
        this.$emit(`update`, updatedFilters)
      },
    },
  },
  methods: {
    reset() {
      this.localFilters = {
        show: 0,
        name: ``,
        templates: [],
        createdAtStart: ``,
        createdAtEnd: ``,
        updatedAtStart: ``,
        updatedAtEnd: ``,
        tags: [],
      }
    },
  },
}
</script>

<template>
  <v-expansion-panels v-model="localFilters.show" flat focusable>
    <v-expansion-panel>
      <v-expansion-panel-header expand-icon="filter_list" disable-icon-rotate>{{ $t(`mailings.list`) }}</v-expansion-panel-header>
      <v-expansion-panel-content>
        <div class="bs-mailings-filters__form">
          <v-text-field v-model="localFilters.name" :label="$t(`global.name`)" clearable />
          <div></div>
          <v-select
            v-model="localFilters.templates"
            :label="$tc(`global.template`, 2)"
            :items="templates"
            item-text="name"
            item-value="id"
            multiple
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
              <template v-slot:activator="{ on }">
                <v-text-field
                  v-model="localFilters.createdAtStart"
                  :label="$t(`mailings.filters.createdBetween`)"
                  prepend-icon="event"
                  clearable
                  v-on="on"
                />
              </template>
              <v-date-picker v-model="localFilters.createdAtStart" no-title />
            </v-menu>
            <v-menu
              v-model="pickerCreatedEnd"
              :close-on-content-click="false"
              :nudge-right="40"
              transition="scale-transition"
              offset-y
              min-width="290px"
            >
              <template v-slot:activator="{ on }">
                <v-text-field
                  v-model="localFilters.createdAtEnd"
                  :label="$t(`mailings.filters.and`)"
                  prepend-icon="event"
                  clearable
                  v-on="on"
                />
              </template>
              <v-date-picker v-model="localFilters.createdAtEnd" no-title />
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
              <template v-slot:activator="{ on }">
                <v-text-field
                  v-model="localFilters.updatedAtStart"
                  :label="$t(`mailings.filters.updatedBetween`)"
                  prepend-icon="event"
                  clearable
                  v-on="on"
                />
              </template>
              <v-date-picker v-model="localFilters.updatedAtStart" no-title />
            </v-menu>

            <v-menu
              v-model="pickerUpdatedEnd"
              :close-on-content-click="false"
              :nudge-right="40"
              transition="scale-transition"
              offset-y
              min-width="290px"
            >
              <template v-slot:activator="{ on }">
                <v-text-field
                  v-model="localFilters.updatedAtEnd"
                  :label="$t(`mailings.filters.and`)"
                  prepend-icon="event"
                  clearable
                  v-on="on"
                />
              </template>
              <v-date-picker v-model="localFilters.updatedAtEnd" no-title />
            </v-menu>
          </div>
          <v-select v-model="localFilters.tags" :label="$t(`global.tags`)" :items="tags" multiple />
          <div class="bs-mailings-filters__actions">
            <v-btn color="primary" text @click="reset">{{$t(`global.reset`)}}</v-btn>
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
