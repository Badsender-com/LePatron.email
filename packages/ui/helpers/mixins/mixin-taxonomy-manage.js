import { mapGetters } from 'vuex';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';

/**
 * Whether the visitor changes the taxonomy (ADR-0026): the tech admin and the
 * super admin do; the company admin reads the same screen, without a control
 * of change. The server asks for the same capability on every write.
 */
export default {
  computed: {
    ...mapGetters(USER, { can: CAN }),
    canManageTaxonomy() {
      return this.can(CAPABILITIES.TAXONOMY_MANAGE);
    },
  },
};
