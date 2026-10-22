<script>
import { SEARCH_SCOPE_ALL, isSearchingAll } from '~/store/folder';

const CURRENT_FOLDER = 'folder';

// The search scope (ADR 0007): the emails of the current location, or every
// email of the user's accessible workspaces. It lives in the route
// (`scope=all`), beside the location to come back to, so a reload keeps it;
// the sidebar tree reloads the list on the route change, filters kept.
export default {
  name: 'MailingsSearchScope',
  CURRENT_FOLDER,
  SEARCH_SCOPE_ALL,
  computed: {
    scope() {
      return isSearchingAll(this.$route.query)
        ? SEARCH_SCOPE_ALL
        : CURRENT_FOLDER;
    },
  },
  methods: {
    changeScope(scope) {
      if (scope === this.scope) return;
      const query = { ...this.$route.query };
      if (scope === SEARCH_SCOPE_ALL) {
        query.scope = SEARCH_SCOPE_ALL;
      } else {
        delete query.scope;
      }
      this.$router.push({ query });
    },
  },
};
</script>

<template>
  <div class="mailings-search-scope">
    <span class="mailings-search-scope__label">
      {{ $t('mailings.search.scope') }}
    </span>
    <v-btn-toggle
      :value="scope"
      mandatory
      dense
      color="accent"
      class="mailings-search-scope__toggle"
      @change="changeScope"
    >
      <v-btn :value="$options.CURRENT_FOLDER" small text>
        {{ $t('mailings.search.currentFolder') }}
      </v-btn>
      <v-btn :value="$options.SEARCH_SCOPE_ALL" small text>
        {{ $t('mailings.search.allWorkspaces') }}
      </v-btn>
    </v-btn-toggle>
  </div>
</template>

<style lang="scss" scoped>
.mailings-search-scope {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;

  &__label {
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.54); // --gray-700
  }

  &__toggle ::v-deep .v-btn {
    text-transform: none;
    letter-spacing: normal;
  }
}
</style>
