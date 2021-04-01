<script>
import {
  getPathToBreadcrumbsDataType,
  getTreeviewWorkspaces,
  findNestedLocation,
} from '~/utils/workspaces';
import { workspacesByGroup } from '~/helpers/api-routes';
import { SPACE_TYPE } from '~/helpers/constants/space-type';

export default {
  name: 'MailingsBreadcrumbs',
  props: {
    large: { type: Boolean, default: false },
  },
  data() {
    return {
      workspacesWithPath: [],
      workspaceIsError: false,
      workspacesIsLoading: false,
    };
  },
  computed: {
    selectedLocation() {
      return findNestedLocation(
        this.workspacesWithPath,
        'id',
        this.$route.query?.wid || this.$route.query?.fid
      );
    },
    breadcrumbsData() {
      return getPathToBreadcrumbsDataType(this.selectedLocation);
    },
  },
  watch: {
    $route: 'fetchData',
  },
  async mounted() {
    await this.fetchData();
  },
  methods: {
    async fetchData() {
      const { $axios } = this;
      try {
        this.workspacesIsLoading = true;
        const { items } = await $axios.$get(workspacesByGroup());
        this.workspacesWithPath = getTreeviewWorkspaces(items);
      } catch (error) {
        this.workspaceIsError = true;
      } finally {
        this.workspacesIsLoading = false;
      }
    },
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
      <v-icon>mdi-chevron-right</v-icon>
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
