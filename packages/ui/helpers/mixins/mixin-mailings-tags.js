import { mailings } from '~/helpers/api-routes.js';
import { FOLDER, SET_TAGS } from '~/store/folder';

// Tagging the emails of the listing, one or a selection. The page provides
// `tags`, `mailingsSelection`, `loading`, `showSnackbar`,
// `resetMailingsSelection` and `fetchMailListingForFilterUpdate`.
export default {
  methods: {
    onTagCreate(newTag) {
      this.$store.commit(`${FOLDER}/${SET_TAGS}`, [
        ...new Set([newTag, ...this.tags]),
      ]);
    },
    async onMailSelectionTagsUpdate(tagsUpdates) {
      await this.handleTagsUpdate({
        items: this.mailingsSelection.map((mailing) => mailing.id),
        tags: tagsUpdates,
      });
      this.resetMailingsSelection();
    },
    async onMailTableTagsUpdate(tagsInformations) {
      const { tags, selectedMailing } = tagsInformations;
      await this.handleTagsUpdate({
        items: [selectedMailing.id],
        tags,
      });
    },
    async handleTagsUpdate({ items, tags }) {
      const { $axios } = this;
      this.loading = true;
      try {
        await $axios.$put(mailings(), {
          items,
          tags,
        });
        await this.fetchMailListingForFilterUpdate();
        this.showSnackbar({
          text: this.$t('mailings.editTagsSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
