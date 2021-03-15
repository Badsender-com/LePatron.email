<script>
import { mapState, mapGetters } from 'vuex';

import { PAGE } from '~/store/page.js';
import { USER, IS_ADMIN, IS_GROUP_ADMIN } from '~/store/user.js';
import BsSnackBar from '~/components/snackbar.vue';

export default {
  name: 'BsLayoutDefault',
  components: { BsSnackBar },
  data() {
    return { drawer: false };
  },
  computed: {
    ...mapState(PAGE, {
      title: (state) => state.pageTitle,
    }),
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
  },
};
</script>

<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      app
      temporary
    >
      <v-list dense>
        <template v-if="isAdmin">
          <v-list-item
            link
            nuxt
            to="/groups"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{ $tc('global.group', 2) }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </template>
        <v-list-item
          link
          href="/account/logout"
        >
          <v-list-item-content>
            <v-list-item-title>{{ $t('layout.logout') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar
      app
      color="secondary"
      dark
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>{{ title | capitalize }}</v-toolbar-title>
      <v-spacer />
      <template v-if="isAdmin">
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              icon
              nuxt
              to="/groups"
              class="ml-2"
              v-on="on"
            >
              <v-icon>group</v-icon>
            </v-btn>
          </template>
          <span>{{ $tc('global.group', 2) }}</span>
        </v-tooltip>
      </template>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            href="/account/logout"
            class="ml-2"
            v-on="on"
          >
            <v-icon>power_settings_new</v-icon>
          </v-btn>
        </template>
        <span>{{ $t('layout.logout') }}</span>
      </v-tooltip>
    </v-app-bar>
    <v-main>
      <nuxt />
    </v-main>

    <bs-snack-bar />
  </v-app>
</template>
