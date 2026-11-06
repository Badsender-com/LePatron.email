import { mapMutations } from 'vuex';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

// A switch of the company (two-factor authentication, MCP access, retex),
// saved on its own: switching it never carries the rest of the group's form.
//
// The switch shows `switchValue`, not the group's value. A Vuetify switch
// keeps the state it was clicked to: after a failed save it would stay on a
// value the server never saved, since the group's value did not move and so
// told it nothing. `switchValue` follows the click, then goes back to the
// saved value when the save fails.
//
// The host component binds `:input-value="switchValue"` and `@change="save"`.
//
// @param {Object} options
// @param {string} options.field the group's boolean field
// @param {string} options.updatedKey the locale key of the saved message
export default function mixinGroupSwitch({ field, updatedKey }) {
  return {
    props: {
      group: { type: Object, required: true },
    },
    data() {
      return { loading: false, switchValue: this.group[field] === true };
    },
    watch: {
      [`group.${field}`](value) {
        this.switchValue = value === true;
      },
    },
    methods: {
      ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
      async save(value) {
        const saved = this.group[field] === true;
        this.switchValue = Boolean(value);
        this.loading = true;
        try {
          const group = await this.$axios.$put(
            groupsItem({ groupId: this.group.id }),
            { [field]: Boolean(value) }
          );
          this.$emit('update', group);
          this.showSnackbar({ text: this.$t(updatedKey), color: 'success' });
        } catch (error) {
          this.switchValue = saved;
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
        } finally {
          this.loading = false;
        }
      },
    },
  };
}
