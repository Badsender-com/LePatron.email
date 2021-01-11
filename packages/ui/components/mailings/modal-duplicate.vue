<script>
export default {
  name: `bs-mailing-modal-duplicate`,
  model: { prop: `dialogInfo`, event: `update` },
  props: {
    dialogInfo: {
      type: Object,
      default: () => ({ name: ``, show: false }),
    },
  },
  computed: {
    localModel: {
      get() {
        return this.dialogInfo
      },
      set(updatedValue) {
        this.$emit(`update`, updatedValue)
      },
    },
  },
  methods: {
    closeDialog() {
      this.$emit(`close`)
    },
    duplicateMailing() {
      this.$emit(`duplicate`, this.dialogInfo)
    },
  },
}
</script>

<template>
  <v-dialog class="bs-mailings-modal-duplicate" v-model="localModel.show" width="500">
    <v-card>
      <v-card-title class="headline">{{ $t(`mailings.duplicate`) }}</v-card-title>
      <v-card-text>
        <p v-html="$t(`mailings.duplicateNotice`, {name: this.localModel.name })" />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="closeDialog">{{ $t(`global.cancel`) }}</v-btn>
        <v-btn color="primary" @click="duplicateMailing">{{ $t(`global.duplicate`) }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
</style>
