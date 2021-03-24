<script>
export default {
  name: 'BsModalTags',
  data() {
    return { show: false };
  },
  methods: {
    open() {
      this.show = true;
    },
    close() {
      this.show = false;
    },
  },
};
</script>

<template>
  <v-dialog v-model="show" v-bind="$attrs">
    <slot />
  </v-dialog>
</template>
