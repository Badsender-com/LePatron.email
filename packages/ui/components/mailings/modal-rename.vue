<script>
export default {
  name: `bs-mailings-modal-rename`,
  model: { prop: `dialogInfo`, event: `update` },
  props: {
    dialogInfo: {
      type: Object,
      default: () => ({ newName: ``, show: false }),
    },
  },
  computed: {
    localModel: {
      get() {
        return this.dialogInfo;
      },
      set(updatedValue) {
        this.$emit(`update`, updatedValue);
      },
    },
  },
  methods: {
    closeDialog() {
      this.$emit(`close`);
    },
    updateName() {
      this.$emit(`update`, this.dialogInfo);
    },
  },
};
</script>

<template>
  <v-dialog
    class="bs-mailings-modal-rename"
    v-model="localModel.show"
    width="500"
  >
    <v-card>
      <v-card-title class="headline">{{ $t(`mailings.rename`) }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="localModel.newName"
          :label="$t(`global.name`)"
          id="new-mailing-name"
          name="new-mailing-name"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="closeDialog">{{
          $t(`global.cancel`)
        }}</v-btn>
        <v-btn color="primary" @click="updateName">{{
          $t(`global.update`)
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped></style>
