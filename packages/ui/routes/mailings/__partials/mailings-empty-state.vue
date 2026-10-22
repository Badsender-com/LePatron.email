<script>
import { mapState } from 'vuex';
import { Mail } from 'lucide-vue';
import { FOLDER, hasActiveFilters } from '~/store/folder';

// What the email listing says when it shows nothing: with filters, that
// nothing matches in the search scope, and a way to clear them (ADR 0007);
// without, that the location holds no email.
export default {
  name: 'MailingsEmptyState',
  components: { LucideMail: Mail },
  props: {
    allWorkspaces: { type: Boolean, default: false },
  },
  computed: {
    ...mapState(FOLDER, ['filters']),
    filtered() {
      return hasActiveFilters(this.filters);
    },
    message() {
      if (this.allWorkspaces) {
        return this.$t('mailings.search.noResultsInAllWorkspaces');
      }
      return this.filtered
        ? this.$t('mailings.search.noResultsInFolder')
        : this.$t('mailings.noMailingsAvailable');
    },
  },
};
</script>

<template>
  <div class="mailings-empty-state">
    <lucide-mail :size="48" class="mailings-empty-state__icon" />
    <p class="mailings-empty-state__text">{{ message }}</p>
    <v-btn
      v-if="filtered"
      text
      small
      color="primary"
      @click="$emit('clear-filters')"
    >
      {{ $t('mailings.search.clearFilters') }}
    </v-btn>
  </div>
</template>

<style lang="scss" scoped>
/* Empty state (BsDataTable spec) */
.mailings-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;

  &__icon {
    color: rgba(0, 0, 0, 0.26); // --gray-500
    margin-bottom: 12px;
  }

  &__text {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87); // --gray-900
  }
}
</style>
