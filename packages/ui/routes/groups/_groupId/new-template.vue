<script>
import { mapMutations } from 'vuex'

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js'
import mixinPageTitle from '~/helpers/mixin-page-title.js'
import * as acls from '~/helpers/pages-acls.js'
import * as apiRoutes from '~/helpers/api-routes.js'
import BsGroupMenu from '~/components/group/menu.vue'
import BsTemplateCreateForm from '~/components/templates/create-form.vue'

export default {
  name: `bs-page-group-new-template`,
  mixins: [mixinPageTitle],
  components: { BsGroupMenu, BsTemplateCreateForm },
  meta: {
    acl: acls.ACL_ADMIN,
  },
  head() {
    return { title: this.title }
  },
  data() {
    return {
      group: {},
      loading: false,
      newTemplate: { name: ``, description: `` },
    }
  },
  computed: {
    title() {
      return `${this.$tc('global.group', 1)} – ${this.group.name} - ${this.$t('global.newTemplate')}`
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
    async createTemplate() {
      const { $axios } = this
      try {
        this.loading = true
        const template = await $axios.$post(apiRoutes.templates(), {
          ...this.newTemplate,
          groupId: this.group.id,
        })
        this.showSnackbar({ text: this.$t('snackbars.created'), color: `success` })
        this.$router.push(apiRoutes.templatesItem({ templateId: template.id }))
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
    <bs-template-create-form v-model="newTemplate" :disabled="loading" @submit="createTemplate" />
  </bs-layout-left-menu>
</template>
