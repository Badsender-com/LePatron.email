<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplateCoverImage from '~/components/template/cover-image.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';

export default {
  name: 'BsTemplateMenu',
  components: { BsModalConfirm, BsTemplateCoverImage },
  model: { prop: 'loading', event: 'update' },
  props: {
    loading: { type: Boolean, default: false },
    template: { type: Object, default: () => ({ group: {}, assets: {} }) },
  },
  computed: {
    hasCover() {
      if (this.template.assets == null) return false;
      return this.template.assets['_full.png'] != null;
    },
    coverSrc() {
      if (!this.hasCover) return '';
      const imageName = this.template.assets['_full.png'];
      return apiRoutes.imagesItem({ imageName });
    },
    localLoading: {
      get() {
        return this.loading;
      },
      set(newLoading) {
        this.$emit('update', newLoading);
      },
    },
  },
  methods: {
    confirmDeletion() {
      this.$refs.deleteDialog.open();
    },
    deleteTemplate() {
      this.$emit('delete');
    },
    generatePreviews() {
      this.$emit('generatePreviews');
    },
  },
};
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-list dense>
        <v-list-item
          v-if="isGroupAdmin || isAdmin"
          nuxt
          class="mb-4"
          link
          to="/"
        >
          <v-list-item-avatar>
            <v-icon>arrow_back</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{
                isAdmin ? $t('global.backToGroups') : $t('global.backToMails')
              }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-subheader>{{ $tc('global.group', 1) }}</v-subheader>
        <v-list-item link nuxt :to="`/groups/${template.group.id}`">
          <v-list-item-avatar>
            <v-icon color="primary">
              group
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ template.group.name }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-subheader>{{ $t('global.actions') }}</v-subheader>
        <v-list-item :disabled="loading" link @click="confirmDeletion">
          <v-list-item-avatar>
            <v-icon color="accent">
              delete_forever
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.delete') }}
              <v-tooltip right>
                <template #activator="{ on }">
                  <v-icon color="grey" small v-on="on">
                    info
                  </v-icon>
                </template>
                <span>{{ $t('template.deleteNotice') }}</span>
              </v-tooltip>
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item
          v-if="template.hasMarkup"
          :disabled="loading"
          @click="generatePreviews"
        >
          <v-list-item-avatar>
            <v-icon color="accent">
              camera_alt
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.newPreview') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <template v-if="hasCover">
          <v-subheader>{{ $t('global.preview') }}</v-subheader>
          <bs-template-cover-image :src="coverSrc" />
        </template>

        <bs-modal-confirm
          ref="deleteDialog"
          :title="`${$t('global.delete')} ${template.name}?`"
          :action-label="$t('global.delete')"
          @confirm="deleteTemplate"
        >
          {{ $t('template.deleteNotice') }}
        </bs-modal-confirm>

        <!-- <v-list-item>
          <v-list-item-avatar>
            <v-icon>{{ statusIcon }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ user | userStatus }}</v-list-item-title>
          </v-list-item-content>
    </v-list-item>-->
      </v-list>
    </v-col>
  </v-row>
</template>

<style lang="scss" scoped>
.bs-template-cover-image {
  outline: 1px solid var(--v-primary-base);
  margin: 0 16px;
}
</style>
