import { PAGE, SET_PAGE_TITLE } from '~/store/page.js';

export default {
  mounted() {
    this.mixinPageTitleUpdateTitle(this.title);
  },
  destroyed() {
    this.mixinPageTitleUpdateTitle(``);
  },
  methods: {
    mixinPageTitleUpdateTitle(title) {
      this.$store.commit(`${PAGE}/${SET_PAGE_TITLE}`, title);
    },
  },
};
