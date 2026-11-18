<script>
import { Calendar } from 'lucide-vue';

// One date of the listing's filters: a field that opens the app's calendar,
// not the browser's. The value is the ISO day (`YYYY-MM-DD`), as the filters
// store it; the field shows it as the user's language writes a date.
export default {
  name: 'MailingsDateField',
  components: { LucideCalendar: Calendar },
  props: {
    value: { type: String, default: '' },
    label: { type: String, required: true },
  },
  data() {
    return { menu: false };
  },
  computed: {
    display() {
      const [year, month, day] = (this.value || '').split('-').map(Number);
      if (!year || !month || !day) return '';
      return new Date(year, month - 1, day).toLocaleDateString(
        this.$i18n.locale
      );
    },
  },
  methods: {
    pick(value) {
      this.menu = false;
      this.$emit('input', value);
    },
  },
};
</script>

<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    content-class="bs-date-menu"
    offset-y
    min-width="auto"
  >
    <template #activator="{ on, attrs }">
      <v-text-field
        :value="display"
        :placeholder="$t('mailings.filters.datePlaceholder')"
        :aria-label="label"
        class="mailings-date-field"
        outlined
        dense
        readonly
        clearable
        hide-details
        v-bind="attrs"
        v-on="on"
        @click:clear="$emit('input', '')"
      >
        <template #append>
          <lucide-calendar :size="14" aria-hidden="true" />
        </template>
      </v-text-field>
    </template>
    <v-date-picker
      :value="value || undefined"
      :locale="$i18n.locale"
      :first-day-of-week="1"
      color="accent"
      no-title
      @input="pick"
    />
  </v-menu>
</template>

<style lang="scss">
// The calendar floats in the app's body, outside the component's scope.
.bs-date-menu {
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;

  .v-picker {
    border-radius: 8px;
    font-family: inherit;
  }

  .v-date-picker-header {
    padding: 8px 12px 0;

    .v-date-picker-header__value button {
      font-size: 14px;
      font-weight: 600;
      color: var(--gray-900);
    }
  }

  .v-date-picker-table {
    padding: 0 12px 12px;
    height: auto;

    th {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--gray-600);
    }

    .v-btn {
      font-size: 12px;
      font-weight: 500;
    }

    // Today, when not the chosen day: the accent, outlined.
    .v-btn.v-date-picker-table__current:not(.v-btn--active) {
      border: 1px solid var(--v-accent-base);
      color: var(--v-accent-base);
    }

    .v-btn--active {
      color: #fff !important;
    }
  }
}
</style>
