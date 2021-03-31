import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async mixinCreateMailing(
      template,
      loadingKey = 'loading',
      defaultMailName = '',
      currentLocationParams
    ) {
      if (!template.hasMarkup) return;
      const { $axios } = this;
      this[loadingKey] = true;

      console.log(currentLocationParams);
      if (
        !currentLocationParams.parentFolderId &&
        !currentLocationParams.workspaceId
      ) {
        return;
      }

      try {
        let requestCreateMailData = {
          templateId: template.id,
          ...currentLocationParams,
        };
        if (defaultMailName) {
          requestCreateMailData = {
            ...requestCreateMailData,
            mailingName: defaultMailName,
          };
        }
        const newMailing = await $axios.$post(
          apiRoutes.mailings(),
          requestCreateMailData
        );
        // don't use Nuxt router
        // • we are redirecting to the mosaico app
        //   OUTSIDE the Vue app
        const { origin } = window.location;
        window.location = `${origin}/editor/${newMailing.id}`;
      } catch (error) {
        this.showSnackbar({ text: 'an error as occurred', color: 'error' });
      } finally {
        this[loadingKey] = false;
      }
    },
  },
};
