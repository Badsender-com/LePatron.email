// Saving an expertise's details (ADR 0013): keeping it to the platform
// company again is confirmed first, with the open task skills that consume
// it. While they are read the page is busy; when they cannot be, the user
// is told and the save goes on.
//
// The page has `exp`, `savedAudience`, `usedBy`, `saving`, a `closeModal`
// ref and mixinAiVersionedItem.

import * as api from '~/helpers/ai-skill-routes.js';
import { closesToPlatform } from '~/helpers/ai-skill-audience-change.js';
import { usedByOf } from '~/helpers/used-by-feature.js';

export default {
  methods: {
    async saveDetails() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      await this.$nextTick();
      const skills = closesToPlatform(this.savedAudience, this.exp.audience)
        ? await this.readOpenTaskSkills()
        : [];
      if (skills && skills.length) {
        this.$refs.closeModal.open(skills);
        return;
      }
      await this.patchDetails({ unchecked: skills === null });
    },
    // The open task skills that consume it. The page is busy while they are
    // read; null when they cannot be, and saving stays possible.
    async readOpenTaskSkills() {
      this.saving = true;
      try {
        const res = await this.$axios.$get(
          api.aiExpertiseOpenTaskSkills(this.exp.expertiseId)
        );
        return res.skills || [];
      } catch (err) {
        return null;
      } finally {
        this.saving = false;
      }
    },
    async patchDetails({ unchecked = false } = {}) {
      const saved = await this.replaceItem(() =>
        this.$axios.$patch(api.aiExpertise(this.exp.expertiseId), {
          title: this.exp.title,
          description: this.exp.description,
          category: this.exp.category,
          scope: this.exp.scope,
          isTransversal: this.exp.isTransversal,
          appliesToEmailTypes: this.exp.appliesToEmailTypes,
          appliesToLanguages: this.exp.appliesToLanguages,
          audience: this.exp.audience,
        })
      );
      if (!saved) return;
      this.savedAudience = this.exp.audience;
      // The scope and the category decide which features load it (ADR 0019):
      // a change of them warns which features stop or start loading it.
      this.usedBy = usedByOf(this.exp);
      this.tellSaved({ unchecked, warnings: this.exp.warnings || [] });
    },
  },
};
