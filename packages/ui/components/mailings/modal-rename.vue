<script>
export default {
  name: 'BsMailingsModalRename',
  data() {
    return { data: {}, show: false };
  },
  methods: {
    open(item) {
      this.data = item;
      this.show = true;
    },
    close() {
      this.show = false;
    },
    action() {
      this.close();
      this.$emit('update', this.data);
    },
  },
};
</script>

<template>
  <v-dialog v-model="show" class="bs-mailings-modal-rename" width="500">
    <v-card>
      <v-card-title class="headline">
        {{ $t(`mailings.rename`) }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          id="new-mailing-name"
          v-model="data.newName"
          :label="$t(`global.name`)"
          name="new-mailing-name"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn color="primary" @click="action">
          {{ $t('global.update') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped></style>
