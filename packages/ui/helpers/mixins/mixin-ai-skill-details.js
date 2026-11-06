// Saving a skill's details (ADR 0013): opening it to every company is
// confirmed first, with the expertises its active version consumes kept to
// the platform company, which a publication reads too. While they are read
// the page is busy; when they cannot be, the user is told and the save goes
// on.
//
// The page has `skill`, `savedAudience`, `saving`, an `activeVersion()`
// method, an `openModal` ref and mixinAiVersionedItem.

import * as api from '~/helpers/ai-skill-routes.js';
import { SKILL_NATURES } from '~/helpers/ai-skill-categories.js';
import { opensToAll } from '~/helpers/ai-skill-audience-change.js';

export default {
  methods: {
    // What opening it to all, with this version, would leave out for the
    // other companies: a task version's expertises kept to the platform
    // company. The page is busy while they are read; null when they cannot
    // be, and opening stays possible.
    async readPlatformOnlyExpertises(version) {
      if (!version || version.nature !== SKILL_NATURES.TASK) return [];
      this.saving = true;
      try {
        const res = await this.$axios.$get(
          api.aiSkillPlatformOnlyExpertises(
            this.skill.skillId,
            version.versionMajor,
            version.versionMinor
          )
        );
        return res.expertises || [];
      } catch (err) {
        return null;
      } finally {
        this.saving = false;
      }
    },

    async saveDetails() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      await this.$nextTick();
      const expertises = opensToAll(this.savedAudience, this.skill.audience)
        ? await this.readPlatformOnlyExpertises(this.activeVersion())
        : [];
      if (expertises && expertises.length) {
        this.$refs.openModal.open(expertises);
        return;
      }
      await this.patchDetails([], { unchecked: expertises === null });
    },

    // Saved, and opened to all with the expertises chosen. The skill saved,
    // what its opening warns of replaces the success message.
    async patchDetails(openExpertiseIds, { unchecked = false } = {}) {
      const {
        title,
        description,
        category,
        audience,
        servedToAssistants,
      } = this.skill;
      let warnings = [];
      const saved = await this.replaceItem(async () => {
        const res = await this.$axios.$patch(api.aiSkill(this.skill.skillId), {
          title,
          description,
          category,
          audience,
          servedToAssistants,
          ...(openExpertiseIds.length ? { openExpertiseIds } : {}),
        });
        warnings = res.warnings || [];
        delete res.warnings;
        return res;
      });
      if (!saved) return;
      this.savedAudience = this.skill.audience;
      this.tellSaved({ warnings, unchecked });
    },
  },
};
