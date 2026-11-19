import { groupsItem } from '~/helpers/api-routes.js';
import mixinInlineOutcome from '~/helpers/mixins/mixin-inline-outcome.js';

// A switch of the company (two-factor authentication, MCP access, retex),
// saved on its own: switching it never carries the rest of the group's form.
// Its outcome is read where the switch is, never in a toast (design system,
// "A setting was saved"): `outcome` and `outcomeDetail` of
// `mixinInlineOutcome`, for the host's `BsSaveOutcome`.
//
// The switch shows `switchValue`, not the group's value. A Vuetify switch
// keeps the state it was clicked to: after a failed save it would stay on a
// value the server never saved, since the group's value did not move and so
// told it nothing. `switchValue` follows the click, then goes back to the
// saved value when the save fails.
//
// The host component binds `:input-value="switchValue"` and `@change="save"`,
// and `<bs-save-outcome :outcome="outcome" :detail="outcomeDetail"
// @retry="save(!switchValue)" />`: after a failure the switch is back on the
// saved value, so trying again asks for the other one.
//
// @param {Object} options
// @param {string} options.field the group's boolean field
export default function mixinGroupSwitch({ field }) {
  return {
    mixins: [mixinInlineOutcome],
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
      // Resolves to whether the value was saved.
      async save(value) {
        const saved = this.group[field] === true;
        this.switchValue = Boolean(value);
        this.clearOutcome();
        this.loading = true;
        try {
          const group = await this.$axios.$put(
            groupsItem({ groupId: this.group.id }),
            { [field]: Boolean(value) }
          );
          this.$emit('update', group);
          this.markSaved();
          return true;
        } catch (error) {
          this.switchValue = saved;
          this.markFailed();
          return false;
        } finally {
          this.loading = false;
        }
      },
    },
  };
}
