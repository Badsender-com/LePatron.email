import { USER, USER_SET, USER_SET_HAS_FTP_ACCESS } from '~/store/user';
import { groupsItem } from '~/helpers/api-routes';

export const actions = {
  async nuxtServerInit(store, nuxtContext) {
    const { dispatch, commit } = store;
    const { req } = nuxtContext;
    if (req.user == null) return;
    let group;
    try {
      group = await this.$axios.$get(
        groupsItem({ groupId: req.user?.group.id })
      );
    } catch {
      console.error('Error while fetching group');
    }

    await Promise.all([
      dispatch(`${USER}/${USER_SET}`, req.user),
      commit(
        `${USER}/${USER_SET_HAS_FTP_ACCESS}`,
        group?.downloadMailingWithFtpImages
      ),
    ]);
  },
};
