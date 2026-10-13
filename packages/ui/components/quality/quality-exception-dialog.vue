<script>
import { checksByCategory } from '~/helpers/quality-settings.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';

// Picks the check to add an exception on, among those that have none yet.
const normalized = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default {
  name: 'BsQualityExceptionDialog',
  mixins: [mixinQualityTexts],
  props: {
    value: { type: Boolean, default: false },
    title: { type: String, required: true },
    // The checks offered, each with what applies to it today.
    candidates: { type: Array, required: true }, // [{ id, applies }]
  },
  data() {
    return { search: '' };
  },
  computed: {
    groups() {
      const query = normalized(this.search.trim());
      const byId = new Map(this.candidates.map((c) => [c.id, c]));
      return checksByCategory()
        .map(({ category, ids }) => ({
          category,
          items: ids
            .filter((id) => byId.has(id))
            .filter(
              (id) => !query || normalized(this.checkName(id)).includes(query)
            )
            .map((id) => byId.get(id)),
        }))
        .filter((group) => group.items.length);
    },
  },
  watch: {
    value(open) {
      if (open) this.search = '';
    },
  },
  methods: {
    pick(id) {
      this.$emit('pick', id);
      this.$emit('input', false);
    },
  },
};
</script>

<template>
  <v-dialog
    :value="value"
    max-width="620"
    scrollable
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-card-title class="qx-dialog__title">{{ title }}</v-card-title>
      <div class="qx-dialog__search">
        <v-text-field
          v-model="search"
          :label="$t('qualitySettings.dialog.search')"
          prepend-inner-icon="mdi-magnify"
          outlined
          dense
          hide-details
          autofocus
          clearable
        />
      </div>
      <v-divider />
      <v-card-text class="qx-dialog__list">
        <p v-if="!groups.length" class="qx-dialog__none">
          {{ $t('qualitySettings.dialog.none') }}
        </p>
        <v-list v-for="group in groups" :key="group.category" dense>
          <v-subheader>
            {{ $t(`qualitySettings.categories.${group.category}`) }}
          </v-subheader>
          <v-list-item
            v-for="item in group.items"
            :key="item.id"
            :data-pick="item.id"
            @click="pick(item.id)"
          >
            <v-list-item-content>
              <v-list-item-title>{{ checkName(item.id) }}</v-list-item-title>
            </v-list-item-content>
            <v-list-item-action-text class="qx-dialog__applies">
              {{ item.applies }}
            </v-list-item-action-text>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn text color="primary" @click="$emit('input', false)">
          {{ $t('global.cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
.qx-dialog {
  &__search {
    padding: 0 24px 16px;
  }

  &__list {
    max-height: 60vh;
    overflow-x: hidden;
    padding: 0 8px !important;
  }

  &__none {
    padding: 24px 16px;
    color: var(--gray-700);
  }

  &__applies {
    max-width: 50%;
    white-space: normal;
    text-align: right;
  }
}
</style>
