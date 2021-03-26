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
      if (this.folder?.id) {
        return { folderId: this.folder?.id };
      }
      if (this.workspace?.id) {
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
        if (query?.wid) {
          this.workspace = $axios.$get(getWorkspace(query?.wid));
        }

        if (query?.fid) {
          this.folder = $axios.$get(getFolder(this.$route.query?.wid));
        }
      }

      return { workspace: this.workspace, folder: this.folder };
    },
  },
};
