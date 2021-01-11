import { mapMutations } from 'vuex'

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js'
import * as apiRoutes from '~/helpers/api-routes.js'

export default {
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async mixinCreateMailing(template, loadingKey = `loading`) {
      if (!template.hasMarkup) return
      const { $axios } = this
      this[loadingKey] = true
      try {
        const newMailing = await $axios.$post(apiRoutes.mailings(), {
          templateId: template.id,
        })
        // don't use Nuxt router
        // • we are redirecting to the mosaico app
        //   OUTSIDE the Vue app
        const { origin } = window.location
        const redirectUrl = apiRoutes.mailingsItem({
          mailingId: newMailing.id,
        })
        window.location.assign(`${origin}${redirectUrl}`)
      } catch (error) {
        this.showSnackbar({ text: `an error as occurred`, color: `error` })
        console.log(error)
      } finally {
        this[loadingKey] = false
      }
    },
  },
}
