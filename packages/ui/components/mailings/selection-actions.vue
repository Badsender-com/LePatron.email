<script>
import BsMailingsTagsMenu from '~/components/mailings/tags-menu.vue'

export default {
  name: `bs-mailing-selection-actions`,
  components: { BsMailingsTagsMenu },
  props: {
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      deleteDialog: false,
    }
  },
  computed: {
    selectionLength() {
      return this.mailingsSelection.length
    },
    hasSelection() {
      return this.selectionLength > 0
    },
  },
  methods: {
    openDeleteDialog() {
      this.deleteDialog = true
    },
    closeDeleteDialog() {
      this.deleteDialog = false
    },
    onDeleteMailings() {
      this.closeDeleteDialog()
      this.$emit(
        `deleteMailings`,
        this.mailingsSelection.map(mailing => mailing.id),
      )
    },
  },
}
</script>

<template>
  <div>
    <v-alert text dense color="info" v-if="hasSelection">
      <div class="bs-mailing-selection-actions">
        <span
          class="bs-mailing-selection-actions__count"
        >{{ $tc('mailings.selectedCount', selectionLength, {count: selectionLength}) }}</span>

        <div class="bs-mailing-selection-actions__actions">
          <bs-mailings-tags-menu
            :tags="tags"
            :mailings-selection="mailingsSelection"
            @create="$emit(`createTag`, $event)"
            @update="$emit(`updateTags`, $event)"
          />
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn icon v-on="on" color="info" @click="openDeleteDialog">
                <v-icon>delete</v-icon>
              </v-btn>
            </template>
            <span>{{ $tc('mailings.deleteCount', selectionLength, {count: selectionLength}) }}</span>
          </v-tooltip>
        </div>
      </div>
    </v-alert>
    <v-dialog v-model="deleteDialog" width="500">
      <v-card>
        <v-card-title
          class="headline"
        >{{ $tc('mailings.deleteCount', selectionLength, {count: selectionLength}) }}</v-card-title>
        <v-card-text>
          <p>{{ $t('mailings.deleteNotice') }}</p>
          <ul>
            <li v-for="mailing in mailingsSelection" :key="`delete-${mailing.id}`">{{mailing.name}}</li>
          </ul>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" text @click="closeDeleteDialog">{{ $t(`global.cancel`) }}</v-btn>
          <v-btn color="primary" @click="onDeleteMailings">{{ $t(`global.delete`) }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style lang="scss" scoped>
.bs-mailing-selection-actions {
  display: flex;
  align-items: center;
}
.bs-mailing-selection-actions__count {
  margin-right: auto;
}
</style>
