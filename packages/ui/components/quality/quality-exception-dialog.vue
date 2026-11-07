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
    intro: { type: String, default: '' },
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
              (id) =>
                !query ||
                normalized(
                  `${this.checkName(id)} ${this.description(id)}`
                ).includes(query)
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
    description(id) {
      return this.$t(`qualitySettings.descriptions.${id}`);
    },

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
    max-width="640"
    scrollable
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-card-title class="qx-dialog__title">{{ title }}</v-card-title>
      <v-card-subtitle v-if="intro" class="qx-dialog__intro">
        {{ intro }}
      </v-card-subtitle>
      <div class="qx-dialog__search">
        <v-text-field
          v-model="search"
          :placeholder="$t('qualitySettings.dialog.search')"
          :aria-label="$t('qualitySettings.dialog.search')"
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
          <v-subheader class="qx-dialog__category">
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
              <v-list-item-subtitle class="qx-dialog__description">
                {{ description(item.id) }}
              </v-list-item-subtitle>
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
        <v-btn text color="accent" @click="$emit('input', false)">
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

  &__category {
    height: 32px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray-700);
  }

  &__applies {
    font-size: 12px;
    white-space: nowrap;
    text-align: right;
  }

  ::v-deep .v-list-item {
    min-height: 40px;
  }

  &__description {
    white-space: normal;
    font-size: 12px;
  }

  ::v-deep .v-list-item__title {
    font-size: 14px;
    font-weight: 400;
  }
}
</style>
