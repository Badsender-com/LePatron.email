<script>
import {
  getPathToBreadcrumbsDataType,
  getTreeviewWorkspaces,
  findNestedLocation,
} from '~/utils/workspaces';
import { workspacesByGroup } from '~/helpers/api-routes';

export default {
  name: 'MailingsBreadcrumbs',
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
        this.$route.query?.wid
      );
    },
    breadcrumbsData() {
      return getPathToBreadcrumbsDataType(this.selectedLocation);
    },
  },
  async mounted() {
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
};
</script>
<template>
  <v-breadcrumbs :items="breadcrumbsData">
    <template #divider>
      <v-icon>mdi-chevron-right</v-icon>
    </template>
    <template #item="{ item }">
      <v-breadcrumbs-item
        :to="{ path: '/', query: { wid: item.id } }"
        :disabled="item.disabled"
      >
        {{ item.text }}
      </v-breadcrumbs-item>
    </template>
  </v-breadcrumbs>
</template>
