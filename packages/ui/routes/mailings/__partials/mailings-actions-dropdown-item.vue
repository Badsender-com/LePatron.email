<script>
export default {
  name: 'BsMailingsActionsDropdownItem',
  props: {
    icon: { type: String, default: () => '' },
    onClick: { type: Function, default: () => () => {} },
  },
};
</script>

<template>
  <v-list-item nuxt @click="onClick()">
    <v-list-item-avatar>
      <v-btn color="accent" icon>
        <v-icon>{{ icon }}</v-icon>
      </v-btn>
    </v-list-item-avatar>
    <v-list-item-title>
      <slot />
    </v-list-item-title>
  </v-list-item>
</template>
