<script>
import * as apiRoutes from '~/helpers/api-routes.js'
import * as userStatusHelpers from '~/helpers/user-status.js'
import BsUsersTable from '~/components/users/table.vue'

export default {
  name: `bs-group-users-tab`,
  components: { BsUsersTable },
  data() {
    return { users: [], loading: false }
  },
  async mounted() {
    const {
      $axios,
      $route: { params },
    } = this
    try {
      this.loading = true
      const usersResponse = await $axios.$get(apiRoutes.groupsItemUsers(params))
      this.users = usersResponse.items
    } catch (error) {
      console.log(error)
    } finally {
      this.loading = false
    }
  },
  methods: {
    updateUser(updatedUser) {
      const userIndex = this.users.findIndex(user => user.id === updatedUser.id)
      this.$set(this.users, userIndex, updatedUser)
    },
  },
}
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-users-table
        :users="users"
        @update="updateUser"
        :loading="loading"
        :hidden-cols="[`group`]"
      />
    </v-card-text>
  </v-card>
</template>
