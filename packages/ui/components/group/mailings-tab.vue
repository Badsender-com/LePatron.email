<script>
import * as apiRoutes from '~/helpers/api-routes.js'
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue'

export default {
  name: `bs-group-mailings-tab`,
  components: { BsMailingsAdminTable },
  data() {
    return { mailings: [], loading: false }
  },
  async mounted() {
    const {
      $axios,
      $route: { params },
    } = this
    try {
      this.loading = true
      const mailingsResponse = await $axios.$get(
        apiRoutes.groupsItemMailings(params),
      )
      this.mailings = mailingsResponse.items
    } catch (error) {
      console.log(error)
    } finally {
      this.loading = false
    }
  },
}
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-mailings-admin-table :mailings="mailings" :loading="loading" />
    </v-card-text>
  </v-card>
</template>
