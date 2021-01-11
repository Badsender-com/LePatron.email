<script>
export default {
  name: `bs-group-menu`,
  computed: {
    groupId() {
      return this.$route.params.groupId
    },
    newTemplateHref() {
      return `/groups/${this.groupId}/new-template`
    },
    newUserHref() {
      return `/groups/${this.groupId}/new-user`
    },
  },
}
</script>

<template>
  <v-list dense>
    <v-subheader>{{$t('global.actions')}}</v-subheader>
    <v-list-item nuxt link :to="newTemplateHref">
      <v-list-item-avatar>
        <v-icon>web</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{$t('global.newTemplate')}}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item nuxt link :to="newUserHref">
      <v-list-item-avatar>
        <v-icon>person_add</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{$t('global.newUser')}}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>
