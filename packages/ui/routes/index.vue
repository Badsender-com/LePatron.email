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
  middleware({ store, redirect }) {
    // Super admin goes to groups management
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      return redirect('/groups');
    }

    const userInfo = store.state.user?.info;
    const group = userInfo?.group;

    // Check module activation status (default to true for backward compatibility)
    const isEmailBuilderEnabled = group?.enableEmailBuilder !== false;
    const isCrmIntelligenceEnabled = group?.enableCrmIntelligence === true;

    // If Email Builder is disabled but CRM Intelligence is enabled,
    // redirect to CRM Intelligence
    if (!isEmailBuilderEnabled && isCrmIntelligenceEnabled) {
      return redirect('/crm-intelligence');
    }

    // Otherwise, continue to Email Builder page
    // (shows placeholder if Email Builder is disabled)
  },
};
</script>
