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
import {
  USER,
  IS_ADMIN,
  IS_BOOTSTRAP_ACCOUNT,
  MODULES_GROUP,
} from '~/store/user';

export default {
  ...MailingsPage,
  middleware({ store, redirect, query }) {
    // The bootstrap account stays in the settings; a super admin lands on the
    // modules of its selected group, like a company admin of that group
    // (ADR 0002, amended).
    if (store.getters[`${USER}/${IS_BOOTSTRAP_ACCOUNT}`]) {
      return redirect('/groups');
    }

    const group = store.getters[`${USER}/${MODULES_GROUP}`];

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

    // No module enabled: a super admin opens the group's settings, anyone else
    // gets the Email Builder placeholder.
    if (store.getters[`${USER}/${IS_ADMIN}`] && group?.id) {
      return redirect(`/groups/${group.id}/settings/general`);
    }
  },
};
</script>
