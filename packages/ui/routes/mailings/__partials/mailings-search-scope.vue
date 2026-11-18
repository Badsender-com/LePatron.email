<script>
import { SEARCH_SCOPE_ALL, isSearchingAll } from '~/utils/mailing-search';

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
    <span id="mailings-search-scope-label" class="mailings-search-scope__label">
      {{ $t('mailings.search.scope') }}
    </span>
    <!-- Vuetify's toggle says nothing to a screen reader: a radio group says
         which scope is on. -->
    <v-btn-toggle
      :value="scope"
      mandatory
      dense
      role="radiogroup"
      aria-labelledby="mailings-search-scope-label"
      class="mailings-search-scope__toggle"
      @change="changeScope"
    >
      <v-btn
        :value="$options.CURRENT_FOLDER"
        role="radio"
        :aria-checked="String(scope === $options.CURRENT_FOLDER)"
        small
        text
      >
        {{ $t('mailings.search.currentFolder') }}
      </v-btn>
      <v-btn
        :value="$options.SEARCH_SCOPE_ALL"
        role="radio"
        :aria-checked="String(scope === $options.SEARCH_SCOPE_ALL)"
        small
        text
      >
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

  &__label {
    font-size: 13px;
    color: var(--gray-600);
  }

  // A segmented control: a gray track, the chosen segment raised in white.
  // Vuetify gives the toggle its own white ground and a border to each
  // button: both are overridden here.
  &__toggle.v-btn-toggle {
    padding: 3px;
    background: var(--gray-200) !important;
    border: none;
    border-radius: 8px;

    ::v-deep .v-btn.v-btn {
      height: 28px;
      padding: 0 12px;
      border: none !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: var(--gray-700) !important;
      font-size: 13px;
      font-weight: 500;
      text-transform: none;
      letter-spacing: normal;

      &:hover {
        color: var(--gray-900) !important;
      }
    }

    ::v-deep .v-btn.v-btn--active {
      background: #fff !important;
      color: var(--gray-900) !important;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16), 0 0 0 1px var(--gray-200);
    }

    ::v-deep .v-btn::before {
      opacity: 0 !important;
    }
  }
}
</style>
