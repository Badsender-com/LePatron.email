<script>
import { mapMutations } from 'vuex'

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js'
import mixinPageTitle from '~/helpers/mixin-page-title.js'
import * as acls from '~/helpers/pages-acls.js'
import * as apiRoutes from '~/helpers/api-routes.js'
import BsGroupMenu from '~/components/group/menu.vue'
import BsGroupForm from '~/components/group/form.vue'
import BsGroupTemplatesTab from '~/components/group/templates-tab.vue'
import BsGroupMailingsTab from '~/components/group/mailings-tab.vue'
import BsGroupUsersTab from '~/components/group/users-tab.vue'

export default {
  name: `bs-page-group`,
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  components: {
    BsGroupMenu,
    BsGroupForm,
    BsGroupUsersTab,
    BsGroupTemplatesTab,
    BsGroupMailingsTab,
  },
  head() {
    return { title: this.title }
  },
  data() {
    return {
      tab: `group-templates`,
      group: {},
      loading: false,
    }
  },
  computed: {
    title() {
      return `${this.$tc('global.group', 1)} – ${this.group.name}`
    },
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params))
      return { group: groupResponse }
    } catch (error) {
      console.log(error)
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateGroup() {
      const {
        $axios,
        $route: { params },
      } = this
      try {
        this.loading = true
        const group = await $axios.$put(
          apiRoutes.groupsItem(params),
          this.group,
        )
        this.showSnackbar({ text: this.$t('snackbars.updated'), color: `success` })
        this.mixinPageTitleUpdateTitle(this.title)
      } catch (error) {
        this.showSnackbar({ text: this.$t('global.errors.errorOccured'), color: `error` })
        console.log(error)
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<template>
  <bs-layout-left-menu>
    <template v-slot:menu>
      <bs-group-menu />
    </template>
    <v-tabs centered v-model="tab">
      <v-tabs-slider color="accent" />
      <v-tab href="#group-informations">{{$t('groups.tabs.informations')}}</v-tab>
      <v-tab href="#group-templates">{{$tc('global.template', 2)}}</v-tab>
      <v-tab href="#group-mailings">{{$tc('global.mailing', 2)}}</v-tab>
      <v-tab href="#group-users">{{$tc('global.user', 2)}}</v-tab>
      <v-tab-item value="group-informations" eager>
        <bs-group-form v-model="group" flat :disabled="loading" @submit="updateGroup" />
      </v-tab-item>
      <v-tab-item value="group-templates">
        <bs-group-templates-tab />
      </v-tab-item>
      <v-tab-item value="group-mailings">
        <bs-group-mailings-tab />
      </v-tab-item>
      <v-tab-item value="group-users">
        <bs-group-users-tab />
      </v-tab-item>
    </v-tabs>
  </bs-layout-left-menu>
</template>
