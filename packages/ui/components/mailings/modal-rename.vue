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
    <v-card flat tile>
      <v-card-title>
        {{ $t(`mailings.rename`) }}
      </v-card-title>
      <v-card-text>
        <label class="form-label">
          {{ $t('global.name') }}
        </label>
        <v-text-field
          id="new-mailing-name"
          v-model="data.newName"
          name="new-mailing-name"
          solo
          flat
          dense
          hide-details="auto"
          class="form-input"
        />
      </v-card-text>
      <v-divider class="mt-4" />
      <v-card-actions>
        <v-spacer />
        <v-btn text color="primary" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn elevation="0" color="accent" @click="action">
          {{ $t('global.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 0.375rem;
}

.form-input {
  &.v-text-field.v-text-field--solo {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      background: #fff;
      min-height: 36px;
      padding: 0 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4);
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: var(--v-accent-base);
    }

    ::v-deep input {
      font-size: 0.875rem;
      padding: 6px 0;
    }
  }
}
</style>
