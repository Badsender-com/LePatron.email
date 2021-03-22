<script>
export default {
  name: 'BsMailingsActionsDropdownItem',
  props: {},
};
</script>

<template>
  <v-list-item nuxt link :to="`/mailings`">
    <v-list-item-avatar>
      <v-btn color="primary" icon>
        <v-icon>edit</v-icon>
      </v-btn>
    </v-list-item-avatar>
    <v-list-item-title>
      {{ $t('global.edit') }}
    </v-list-item-title>
  </v-list-item>
</template>

<style lang="scss" scoped></style>

<i18n>
{
"en": {},
"fr": {}
}
</i18n>
