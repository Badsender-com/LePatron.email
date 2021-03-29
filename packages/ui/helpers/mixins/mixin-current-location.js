import { getWorkspace, getFolder } from '~/helpers/api-routes';

export default {
  data: () => ({
    workspace: {},
    folder: {},
  }),
  computed: {
    currentLocation() {
      return this.folder?.id || this.workspace?.id;
    },
    currentLocationParam() {
      console.log('calling currentLocationParam');
      if (this.folder?.id) {
        console.log('is folder this.folder?.id');
        return { folderId: this.folder?.id };
      }
      if (this.workspace?.id) {
        console.log('is workspace this.workspace?.id');
        return { workspaceId: this.workspace?.id };
      }
    },
    hasAccess() {
      return this.workspace?.hasAccess || false;
    },
  },
  methods: {
    async getFolderAndWorkspaceData($axios, query) {
      if (!$axios || !query) {
        return;
      }

      if (query?.wid || query?.fid) {
        if (query?.fid) {
          this.folder = await $axios.$get(getFolder(query?.fid));
        }

        if (query?.wid) {
          this.workspace = await $axios.$get(getWorkspace(query?.wid));
        }
      }

      return { workspace: this.workspace, folder: this.folder };
    },
  },
};
