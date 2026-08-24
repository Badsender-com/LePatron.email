// Editable local copies of a versioned entity's versions (skill / expertise).
//
// The version panels used to `v-model` straight into `skill.versions[i]` —
// the page's own objects — behind an `eslint-disable vue/no-mutating-props`.
// State was shared by reference across four levels with no contract, which is
// what let "Publier" silently drop unsaved edits (review R-04).
//
// The contract now: the page owns the entity, the panel owns its drafts, and
// the panel hands a merged version back on save / publish. A draft is rebuilt
// from the server document only when that version itself moved on (its
// `updatedAt` changed), so an unrelated re-render of the parent — the details
// form emits a fresh entity object on every keystroke — never discards what is
// being typed.
//
// The host component must provide three computeds:
//   • `versionsSource`        → the versions array
//   • `activeVersionRef`      → the entity's `activeVersion` ({ major, minor })
//   • `editableVersionFields` → the field names the panel lets one edit

function sameValue(a, b) {
  const normalise = (v) => (v === undefined ? null : v);
  return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
}

export default {
  data() {
    return { versionDrafts: {} };
  },
  computed: {
    sortedVersions() {
      return [...(this.versionsSource || [])].sort((a, b) => {
        if (b.versionMajor !== a.versionMajor) {
          return b.versionMajor - a.versionMajor;
        }
        return b.versionMinor - a.versionMinor;
      });
    },
    hasActive() {
      const av = this.activeVersionRef;
      return !!(av && av.major != null);
    },
  },
  watch: {
    versionsSource: { immediate: true, handler: 'syncVersionDrafts' },
  },
  methods: {
    versionLabel(v) {
      return `${v.versionMajor}.${v.versionMinor}`;
    },
    versionStamp(v) {
      return String(v.updatedAt || v.createdAt || '');
    },
    statusLabel(v) {
      return this.$t(`aiSkills.statuses.${v.status}`);
    },
    statusColor(v) {
      if (v.status === 'ACTIVE') return 'success';
      return v.status === 'ARCHIVED' ? 'grey' : 'warning';
    },
    isMajorDraft(v) {
      return v.status === 'DRAFT' && v.versionMinor === 0;
    },
    syncVersionDrafts() {
      const next = {};
      (this.versionsSource || []).forEach((v) => {
        const key = this.versionLabel(v);
        const current = this.versionDrafts[key];
        next[key] =
          current && current.__stamp === this.versionStamp(v)
            ? current
            : this.newVersionDraft(v);
      });
      this.versionDrafts = next;
    },
    newVersionDraft(v) {
      const draft = { __stamp: this.versionStamp(v) };
      this.editableVersionFields.forEach((name) => {
        const value = v[name];
        draft[name] = Array.isArray(value) ? [...value] : value;
      });
      return draft;
    },
    // Strict on purpose: `syncVersionDrafts` runs immediately and on every
    // change of the versions array, so a missing draft is a bug we want loud
    // rather than a silent write into a throwaway object.
    draftFor(v) {
      return this.versionDrafts[this.versionLabel(v)];
    },
    // The version as it stands on screen: server document + pending edits.
    mergedVersion(v) {
      const draft = this.draftFor(v) || {};
      const merged = { ...v };
      this.editableVersionFields.forEach((name) => {
        if (name in draft) merged[name] = draft[name];
      });
      return merged;
    },
    isVersionDirty(v) {
      const draft = this.draftFor(v);
      if (!draft) return false;
      return this.editableVersionFields.some(
        (name) => !sameValue(draft[name], v[name])
      );
    },
    emitSaveVersion(v) {
      this.$emit('save', { version: this.mergedVersion(v) });
    },
    // `dirty` lets the page persist the draft before publishing it, instead of
    // publishing the last saved content and wiping the edits off the screen.
    emitActivateVersion(v) {
      this.$emit('activate', {
        version: this.mergedVersion(v),
        dirty: this.isVersionDirty(v),
      });
    },
  },
};
