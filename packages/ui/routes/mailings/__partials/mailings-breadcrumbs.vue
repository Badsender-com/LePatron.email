<script>
import {
  getPathToBreadcrumbsDataType,
  findNestedLocation,
} from '~/utils/workspaces';
import { mapState } from 'vuex';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import { FOLDER } from '~/store/folder';
import BsBreadcrumb from '~/components/layout/BsBreadcrumb.vue';

export default {
  name: 'MailingsBreadcrumbs',
  components: {
    BsBreadcrumb,
  },
  props: {
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
    // Convert to BsBreadcrumb format: { text, to }
    breadcrumbItems() {
      return this.breadcrumbsData.map((item, index) => {
        const isLast = index === this.breadcrumbsData.length - 1;
        return {
          text: item.text,
          to: isLast
            ? null
            : {
                path: '/mailings',
                query: this.queryParamsBasedOnItemType(item),
              },
        };
      });
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
  <bs-breadcrumb :items="breadcrumbItems" />
</template>
