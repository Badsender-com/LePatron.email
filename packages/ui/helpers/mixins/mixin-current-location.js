import {
  getWorkspace,
  getFolder,
  getFolderAccess,
  getWorkspaceAccess,
} from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  data: () => ({
    workspace: {},
    folder: {},
    hasAccess() {},
  }),
  computed: {
    currentLocation() {
      return this.folder?.id || this.workspace?.id;
    },
    currentLocationParam() {
      if (this.folder?.id) {
        return { parentFolderId: this.folder?.id };
      }
      if (this.workspace?.id) {
        return { workspaceId: this.workspace?.id };
      }
    },
    hasAccess() {
      return this.workspace?.hasAccess || false;
    },
  },
  watch: {
    $route: 'computedGetFolderAndWorkspaceData',
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async computedGetFolderAndWorkspaceData() {
      return await this.getFolderAndWorkspaceData(
        this.$axios,
        this.$route?.query
      );
    },
    async getFolderAndWorkspaceData($axios, query) {
      try {
        if (!$axios || !query) {
          return;
        }

        if (query?.wid || query?.fid) {
          if (query?.fid) {
            const [folder, hasAccess] = await Promise.all([
              $axios.$get(getFolder(query?.fid)),
              $axios.$get(getFolderAccess(query?.fid)),
            ]);
            this.folder = folder;
            this.hasAccess = hasAccess;
            this.workspace = null;
          } else if (query?.wid) {
            const [workspace, hasAccess] = await Promise.all([
              $axios.$get(getWorkspace(query?.wid)),
              $axios.$get(getWorkspaceAccess(query?.wid)),
            ]);
            this.workspace = workspace;
            this.hasAccess = hasAccess;
            this.folder = null;
          }
          console.log(this.folder);
          console.log(this.workspace);
          console.log(this.hasAccess);
        }
        return { workspace: this.workspace, folder: this.folder };
      } catch {
        this.showSnackbar({ text: 'an error as occurred', color: 'error' });
      }
    },
  },
};
