<script>
import { mapState, mapGetters } from 'vuex';

import { PAGE } from '~/store/page.js';
import { USER, IS_ADMIN } from '~/store/user.js';
import BsSnackBar from '~/components/snackbar.vue';

export default {
  name: `bs-layout-default`,
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
    }),
  },
};
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app temporary>
      <v-list dense>
        <v-list-item link nuxt to="/">
          <v-list-item-content>
            <v-list-item-title>{{
              $tc('global.mailing', 2)
            }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item link nuxt to="/mailings/new">
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.newMailing') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <template v-if="isAdmin">
          <v-list-item link nuxt to="/groups">
            <v-list-item-content>
              <v-list-item-title>{{
                $tc('global.group', 2)
              }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item link nuxt to="/users">
            <v-list-item-content>
              <v-list-item-title>{{ $tc('global.user', 2) }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item link nuxt to="/templates">
            <v-list-item-content>
              <v-list-item-title>{{
                $tc('global.template', 2)
              }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </template>
        <v-list-item link href="/account/logout">
          <v-list-item-content>
            <v-list-item-title>{{ $t('layout.logout') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app color="secondary" dark>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>{{ title | capitalize }}</v-toolbar-title>
      <v-spacer />
      <v-btn text link nuxt to="/" class="ml-2">{{
        $tc('global.mailing', 2)
      }}</v-btn>
      <v-btn text link nuxt to="/mailings/new" class="ml-2">{{
        $t('global.newMailing')
      }}</v-btn>
      <template v-if="isAdmin">
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn icon nuxt to="/groups" v-on="on" class="ml-2">
              <v-icon>group</v-icon>
            </v-btn>
          </template>
          <span>{{ $tc('global.group', 2) }}</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn icon nuxt to="/users" v-on="on" class="ml-2">
              <v-icon>person</v-icon>
            </v-btn>
          </template>
          <span>{{ $tc('global.user', 2) }}</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn icon nuxt to="/templates" v-on="on" class="ml-2">
              <v-icon>web</v-icon>
            </v-btn>
          </template>
          <span>{{ $tc('global.template', 2) }}</span>
        </v-tooltip>
      </template>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-btn icon href="/account/logout" v-on="on" class="ml-2">
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
