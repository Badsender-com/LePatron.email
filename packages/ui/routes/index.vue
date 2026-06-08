<script>
/**
 * Home page - redirects to the first enabled module
 *
 * Module priority:
 * 1. Email Builder (mailings)
 * 2. CRM Intelligence
 *
 * If no modules are enabled, shows the Email Builder placeholder
 */
import MailingsPage from '~/routes/mailings/index.vue';
import { USER, IS_ADMIN } from '~/store/user';

export default {
  ...MailingsPage,
  middleware({ store, redirect, query }) {
    // Super admin goes to groups management
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      return redirect('/groups');
    }

    const userInfo = store.state.user?.info;
    const group = userInfo?.group;

    // Check module activation status (default to true for backward compatibility)
    const isEmailBuilderEnabled = group?.enableEmailBuilder !== false;
    const isCrmIntelligenceEnabled = group?.enableCrmIntelligence === true;

    // Redirect to first enabled module:
    // Priority: Email Builder > CRM Intelligence
    // Preserve the query string (e.g. ?fid=/?wid= when landing on `/` from an
    // old link or the editor back arrow) so the workspace tree opens on the
    // right folder/workspace instead of an empty page.
    if (isEmailBuilderEnabled) {
      return redirect('/mailings', query);
    }

    if (isCrmIntelligenceEnabled) {
      return redirect('/crm-intelligence', query);
    }

    // If no modules are enabled, continue to show Email Builder placeholder
  },
};
</script>
