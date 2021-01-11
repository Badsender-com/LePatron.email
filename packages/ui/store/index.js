import { USER, USER_SET } from '~/store/user'

export const actions = {
  async nuxtServerInit(store, nuxtContext) {
    const { dispatch } = store
    const { req } = nuxtContext
    if (req.user == null) return
    await Promise.all([dispatch(`${USER}/${USER_SET}`, req.user)])
  },
}
