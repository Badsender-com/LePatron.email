<script>
export default {
  name: `bs-modal-confirm`,
  props: {
    title: { type: String, default: '' },
    actionLabel: { type: String, default: '' },
  },
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
    action() {
      this.close();
      this.$emit(`confirm`);
    },
  },
};
</script>

<template>
  <v-dialog v-model="show" width="500" class="bs-modal-confirm">
    <v-card>
      <v-card-title class="headline">{{ title }}</v-card-title>
      <v-card-text>
        <slot />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">{{
          $t(`global.cancel`)
        }}</v-btn>
        <v-btn color="primary" @click="action">{{ actionLabel }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<i18n>
{
  "en": {},
  "fr": {}
}
</i18n>
