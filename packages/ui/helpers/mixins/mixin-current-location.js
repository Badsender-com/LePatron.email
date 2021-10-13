import { mapState, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  computed: {
    ...mapState('folder', ['folder', 'workspace', 'hasAccess']),
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
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
  },
};
