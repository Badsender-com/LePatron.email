<script>
import * as apiRoutes from '~/helpers/api-routes.js'
import mixinCreateMailing from '~/helpers/mixin-create-mailing.js'
import BsTemplateCoverImage from '~/components/template/cover-image.vue'
import BsModalConfirm from '~/components/modal-confirm.vue'

export default {
  name: `bs-template-menu`,
  mixins: [mixinCreateMailing],
  components: { BsModalConfirm, BsTemplateCoverImage },
  model: { prop: `loading`, event: `update` },
  props: {
    loading: { type: Boolean, default: false },
    template: { type: Object, default: () => ({ group: {}, assets: {} }) },
  },
  computed: {
    hasCover() {
      if (this.template.assets == null) return false
      return this.template.assets[`_full.png`] != null
    },
    coverSrc() {
      if (!this.hasCover) return ``
      const imageName = this.template.assets[`_full.png`]
      return apiRoutes.imagesItem({ imageName })
    },
    localLoading: {
      get() {
        return this.loading
      },
      set(newLoading) {
        this.$emit(`update`, newLoading)
      },
    },
  },
  methods: {
    confirmDeletion() {
      this.$refs.deleteDialog.open()
    },
    deleteTemplate() {
      this.$emit(`delete`)
    },
    generatePreviews() {
      this.$emit(`generatePreviews`)
    },
  },
}
</script>

<template>
  <v-list>
    <v-subheader>{{$tc('global.group', 1)}}</v-subheader>
    <v-list-item link nuxt :to="`/groups/${template.group.id}`">
      <v-list-item-avatar>
        <v-icon>group</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{ template.group.name }}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-subheader>{{$t('global.actions')}}</v-subheader>
    <v-list-item
      v-if="template.hasMarkup"
      @click="mixinCreateMailing(template, `localLoading`)"
      :disabled="loading"
      link
    >
      <v-list-item-avatar>
        <v-icon>library_add</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{$t('global.newMailing')}}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item @click="confirmDeletion" :disabled="loading" link>
      <v-list-item-avatar>
        <v-icon>delete_forever</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>
          {{$t('global.delete')}}
          <v-tooltip right>
            <template v-slot:activator="{ on }">
              <v-icon color="grey" small v-on="on">info</v-icon>
            </template>
            <span>{{$t('template.deleteNotice')}}</span>
          </v-tooltip>
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item @click="generatePreviews" :disabled="loading" v-if="template.hasMarkup">
      <v-list-item-avatar>
        <v-icon>camera_alt</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>{{$t('global.newPreview')}}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <template v-if="hasCover">
      <v-subheader>{{$t('global.preview')}}</v-subheader>
      <bs-template-cover-image :src="coverSrc" />
    </template>

    <bs-modal-confirm
      ref="deleteDialog"
      :title="`${$t('global.delete')} ${template.name}?`"
      :action-label="$t('global.delete')"
      @confirm="deleteTemplate"
    >{{$t('template.deleteNotice')}}</bs-modal-confirm>

    <!-- <v-list-item>
          <v-list-item-avatar>
            <v-icon>{{ statusIcon }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ user | userStatus }}</v-list-item-title>
          </v-list-item-content>
    </v-list-item>-->
  </v-list>
</template>

<style lang="scss" scoped>
.bs-template-cover-image {
  outline: 1px solid var(--v-primary-base);
  margin: 0 16px;
}
</style>
