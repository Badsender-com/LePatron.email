<script>
import { mapState } from 'vuex';
import { Mail, RotateCcw, Search } from 'lucide-vue';
import { FOLDER } from '~/store/folder';
import { SEARCH_SCOPE_ALL, hasActiveFilters } from '~/utils/mailing-search';

// What the email listing says when it shows nothing (ADR 0007). With filters:
// that nothing matches in the search scope, a way to reset them and, from a
// location, to look in every workspace. Without: that there is no email.
export default {
  name: 'MailingsEmptyState',
  components: {
    LucideMail: Mail,
    LucideRotateCcw: RotateCcw,
    LucideSearch: Search,
  },
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
        return this.filtered
          ? this.$t('mailings.search.noMatchInAllWorkspaces')
          : this.$t('mailings.search.noMailingInAllWorkspaces');
      }
      return this.filtered
        ? this.$t('mailings.search.noMatchInLocation')
        : this.$t('mailings.noMailingsAvailable');
    },
  },
  methods: {
    searchAllWorkspaces() {
      this.$router.push({
        query: { ...this.$route.query, scope: SEARCH_SCOPE_ALL },
      });
    },
  },
};
</script>

<template>
  <div class="mailings-empty-state">
    <lucide-mail
      :size="48"
      class="mailings-empty-state__icon"
      aria-hidden="true"
    />
    <p class="mailings-empty-state__text">{{ message }}</p>
    <div v-if="filtered" class="mailings-empty-state__actions">
      <v-btn
        v-if="!allWorkspaces"
        text
        small
        color="accent"
        @click="searchAllWorkspaces"
      >
        <lucide-search :size="16" class="mr-1" aria-hidden="true" />
        {{ $t('mailings.search.searchAllWorkspaces') }}
      </v-btn>
      <v-btn text small @click="$emit('clear-filters')">
        <lucide-rotate-ccw :size="16" class="mr-1" aria-hidden="true" />
        {{ $t('mailings.search.resetFilters') }}
      </v-btn>
    </div>
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
    color: var(--gray-500);
    margin-bottom: 12px;
  }

  &__text {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--gray-900);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;

    ::v-deep .v-btn {
      text-transform: none;
      letter-spacing: normal;
    }
  }
}
</style>
