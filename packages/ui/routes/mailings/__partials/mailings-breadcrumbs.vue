<script>
import {
  getPathToBreadcrumbsDataType,
  findNestedLocation,
} from '~/utils/workspaces';
import { mapState } from 'vuex';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import { FOLDER } from '~/store/folder';
import { ChevronRight } from 'lucide-vue';

export default {
  name: 'MailingsBreadcrumbs',
  components: {
    LucideChevronRight: ChevronRight,
  },
  props: {
    large: { type: Boolean, default: false },
    workspaceOrFolderItem: { type: Object, default: null },
  },
  computed: {
    ...mapState(FOLDER, [
      'workspaces',
      'areLoadingWorkspaces',
      'treeviewWorkspaces',
    ]),
    selectedLocation() {
      return findNestedLocation(
        this.treeviewWorkspaces,
        'id',
        this.$route.query?.wid || this.$route.query?.fid
      );
    },
    breadcrumbsData() {
      return getPathToBreadcrumbsDataType(
        this.workspaceOrFolderItem ?? this.selectedLocation
      );
    },
  },
  methods: {
    queryParamsBasedOnItemType(item) {
      if (item?.type === SPACE_TYPE.WORKSPACE) {
        return { wid: item.id };
      } else {
        return { fid: item.id };
      }
    },
  },
};
</script>
<template>
  <v-breadcrumbs class="pl-0" :large="large" :items="breadcrumbsData">
    <template #divider>
      <lucide-chevron-right :size="16" />
    </template>
    <template #item="{ item }">
      <v-breadcrumbs-item
        :to="{ path: '/', query: queryParamsBasedOnItemType(item) }"
        :disabled="item.disabled"
      >
        {{ item.text }}
      </v-breadcrumbs-item>
    </template>
  </v-breadcrumbs>
</template>
