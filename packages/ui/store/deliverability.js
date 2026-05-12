export const DELIVERABILITY = 'deliverability';

export const state = () => ({
  audits: [],
  currentAudit: null,
  inventoryItems: {},
  mappingGroups: [],
  mappingEntries: [],
  loading: false,
});

// Getters
export const AUDITS = 'AUDITS';
export const CURRENT_AUDIT = 'CURRENT_AUDIT';
export const INVENTORY_ITEMS = 'INVENTORY_ITEMS';
export const IS_LOADING = 'IS_LOADING';
export const MAPPING_GROUPS = 'MAPPING_GROUPS';
export const MAPPING_ENTRIES = 'MAPPING_ENTRIES';

export const getters = {
  [AUDITS](state) {
    return state.audits;
  },
  [CURRENT_AUDIT](state) {
    return state.currentAudit;
  },
  [INVENTORY_ITEMS](state) {
    return state.inventoryItems;
  },
  [IS_LOADING](state) {
    return state.loading;
  },
  [MAPPING_GROUPS](state) {
    return state.mappingGroups;
  },
  [MAPPING_ENTRIES](state) {
    return state.mappingEntries;
  },
};

// Mutations
export const M_SET_AUDITS = 'M_SET_AUDITS';
export const M_SET_CURRENT_AUDIT = 'M_SET_CURRENT_AUDIT';
export const M_SET_INVENTORY_ITEMS = 'M_SET_INVENTORY_ITEMS';
export const M_SET_INVENTORY_CATEGORY = 'M_SET_INVENTORY_CATEGORY';
export const M_SET_LOADING = 'M_SET_LOADING';
export const M_ADD_AUDIT = 'M_ADD_AUDIT';
export const M_UPDATE_AUDIT = 'M_UPDATE_AUDIT';
export const M_DELETE_AUDIT = 'M_DELETE_AUDIT';
export const M_SET_MAPPING = 'M_SET_MAPPING';
export const M_ADD_MAPPING_GROUP = 'M_ADD_MAPPING_GROUP';
export const M_UPDATE_MAPPING_GROUP = 'M_UPDATE_MAPPING_GROUP';
export const M_DELETE_MAPPING_GROUP = 'M_DELETE_MAPPING_GROUP';
export const M_ADD_MAPPING_ENTRY = 'M_ADD_MAPPING_ENTRY';
export const M_UPDATE_MAPPING_ENTRY = 'M_UPDATE_MAPPING_ENTRY';
export const M_DELETE_MAPPING_ENTRY = 'M_DELETE_MAPPING_ENTRY';

export const mutations = {
  [M_SET_AUDITS](state, audits) {
    state.audits = audits;
  },
  [M_SET_CURRENT_AUDIT](state, audit) {
    state.currentAudit = audit;
  },
  [M_SET_INVENTORY_ITEMS](state, items) {
    state.inventoryItems = items;
  },
  [M_SET_INVENTORY_CATEGORY](state, { category, items }) {
    state.inventoryItems = {
      ...state.inventoryItems,
      [category.toLowerCase()]: items,
    };
  },
  [M_SET_LOADING](state, loading) {
    state.loading = loading;
  },
  [M_ADD_AUDIT](state, audit) {
    state.audits.unshift(audit);
  },
  [M_UPDATE_AUDIT](state, updatedAudit) {
    const index = state.audits.findIndex((a) => a.id === updatedAudit.id);
    if (index !== -1) {
      state.audits.splice(index, 1, updatedAudit);
    }
    if (state.currentAudit && state.currentAudit.id === updatedAudit.id) {
      state.currentAudit = updatedAudit;
    }
  },
  [M_DELETE_AUDIT](state, auditId) {
    state.audits = state.audits.filter((a) => a.id !== auditId);
    if (state.currentAudit && state.currentAudit.id === auditId) {
      state.currentAudit = null;
    }
  },
  [M_SET_MAPPING](state, { groups, entries }) {
    state.mappingGroups = groups;
    state.mappingEntries = entries;
  },
  [M_ADD_MAPPING_GROUP](state, group) {
    state.mappingGroups.push(group);
  },
  [M_UPDATE_MAPPING_GROUP](state, updatedGroup) {
    const idx = state.mappingGroups.findIndex((g) => g.id === updatedGroup.id);
    if (idx !== -1) state.mappingGroups.splice(idx, 1, updatedGroup);
  },
  [M_DELETE_MAPPING_GROUP](state, groupId) {
    state.mappingGroups = state.mappingGroups.filter((g) => g.id !== groupId);
    state.mappingEntries = state.mappingEntries.map((e) =>
      e.groupId === groupId ? { ...e, groupId: null } : e
    );
  },
  [M_ADD_MAPPING_ENTRY](state, entry) {
    state.mappingEntries.push(entry);
  },
  [M_UPDATE_MAPPING_ENTRY](state, updatedEntry) {
    const idx = state.mappingEntries.findIndex((e) => e.id === updatedEntry.id);
    if (idx !== -1) state.mappingEntries.splice(idx, 1, updatedEntry);
  },
  [M_DELETE_MAPPING_ENTRY](state, entryId) {
    state.mappingEntries = state.mappingEntries.filter((e) => e.id !== entryId);
  },
};

// Actions
export const FETCH_AUDITS = 'FETCH_AUDITS';
export const FETCH_AUDIT = 'FETCH_AUDIT';
export const CREATE_AUDIT = 'CREATE_AUDIT';
export const UPDATE_AUDIT = 'UPDATE_AUDIT';
export const DELETE_AUDIT = 'DELETE_AUDIT';
export const FETCH_INVENTORY_ITEMS = 'FETCH_INVENTORY_ITEMS';
export const BULK_UPSERT_INVENTORY = 'BULK_UPSERT_INVENTORY';
export const FETCH_MAPPING = 'FETCH_MAPPING';
export const CREATE_MAPPING_GROUP = 'CREATE_MAPPING_GROUP';
export const UPDATE_MAPPING_GROUP = 'UPDATE_MAPPING_GROUP';
export const DELETE_MAPPING_GROUP = 'DELETE_MAPPING_GROUP';
export const CREATE_MAPPING_ENTRY = 'CREATE_MAPPING_ENTRY';
export const UPDATE_MAPPING_ENTRY = 'UPDATE_MAPPING_ENTRY';
export const DELETE_MAPPING_ENTRY = 'DELETE_MAPPING_ENTRY';
export const REORDER_MAPPING_ENTRIES = 'REORDER_MAPPING_ENTRIES';
export const REORDER_MAPPING_GROUPS = 'REORDER_MAPPING_GROUPS';
export const UPDATE_INVENTORY_PROGRESS = 'UPDATE_INVENTORY_PROGRESS';

export const actions = {
  async [FETCH_AUDITS]({ commit, rootState }) {
    commit(M_SET_LOADING, true);
    try {
      const group = rootState.user.info.group;
      const groupId = typeof group === 'string' ? group : group.id || group._id;
      const response = await this.$axios.$get(
        `deliverability/groups/${groupId}/audits`
      );
      commit(M_SET_AUDITS, response.audits || []);
    } catch (error) {
      console.error('Error fetching audits:', error);
      throw error;
    } finally {
      commit(M_SET_LOADING, false);
    }
  },

  async [FETCH_AUDIT]({ commit }, auditId) {
    commit(M_SET_LOADING, true);
    try {
      const response = await this.$axios.$get(
        `deliverability/audits/${auditId}`
      );
      commit(M_SET_CURRENT_AUDIT, response.audit);
      return response.audit;
    } catch (error) {
      console.error('Error fetching audit:', error);
      throw error;
    } finally {
      commit(M_SET_LOADING, false);
    }
  },

  async [CREATE_AUDIT]({ commit, rootState }, auditData) {
    commit(M_SET_LOADING, true);
    try {
      const group = rootState.user.info.group;
      const groupId = typeof group === 'string' ? group : group.id || group._id;
      const response = await this.$axios.$post(
        `deliverability/groups/${groupId}/audits`,
        auditData
      );
      commit(M_ADD_AUDIT, response.audit);
      return response.audit;
    } catch (error) {
      console.error('[deliverability.store] Error creating audit:', error);
      throw error;
    } finally {
      commit(M_SET_LOADING, false);
    }
  },

  async [UPDATE_AUDIT]({ commit }, { auditId, data }) {
    commit(M_SET_LOADING, true);
    try {
      const response = await this.$axios.$put(
        `deliverability/audits/${auditId}`,
        data
      );
      commit(M_UPDATE_AUDIT, response.audit);
      return response.audit;
    } catch (error) {
      console.error('Error updating audit:', error);
      throw error;
    } finally {
      commit(M_SET_LOADING, false);
    }
  },

  async [DELETE_AUDIT]({ commit }, auditId) {
    commit(M_SET_LOADING, true);
    try {
      await this.$axios.$delete(`deliverability/audits/${auditId}`);
      commit(M_DELETE_AUDIT, auditId);
    } catch (error) {
      console.error('Error deleting audit:', error);
      throw error;
    } finally {
      commit(M_SET_LOADING, false);
    }
  },

  async [FETCH_INVENTORY_ITEMS]({ commit }, auditId) {
    try {
      const response = await this.$axios.$get(
        `deliverability/audits/${auditId}/inventory`
      );
      commit(M_SET_INVENTORY_ITEMS, response.items || {});
      return response.items;
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }
  },

  async [BULK_UPSERT_INVENTORY](
    { commit },
    { auditId, category, items, updateProgress = true }
  ) {
    try {
      const response = await this.$axios.$post(
        `deliverability/audits/${auditId}/inventory/bulk`,
        { category, items, updateProgress }
      );
      commit(M_SET_INVENTORY_CATEGORY, { category, items: response.items });
      return response.items;
    } catch (error) {
      console.error('Error upserting inventory items:', error);
      throw error;
    }
  },

  async [FETCH_MAPPING]({ commit }, auditId) {
    try {
      const response = await this.$axios.$get(
        `deliverability/audits/${auditId}/mapping`
      );
      commit(M_SET_MAPPING, {
        groups: response.groups || [],
        entries: response.entries || [],
      });
      return response;
    } catch (error) {
      console.error('Error fetching mapping:', error);
      throw error;
    }
  },

  async [CREATE_MAPPING_GROUP]({ commit }, { auditId, name }) {
    try {
      const response = await this.$axios.$post(
        `deliverability/audits/${auditId}/mapping/groups`,
        { name }
      );
      commit(M_ADD_MAPPING_GROUP, response.group);
      return response.group;
    } catch (error) {
      console.error('Error creating mapping group:', error);
      throw error;
    }
  },

  async [UPDATE_MAPPING_GROUP]({ commit }, { auditId, groupId, data }) {
    try {
      const response = await this.$axios.$put(
        `deliverability/audits/${auditId}/mapping/groups/${groupId}`,
        data
      );
      commit(M_UPDATE_MAPPING_GROUP, response.group);
      return response.group;
    } catch (error) {
      console.error('Error updating mapping group:', error);
      throw error;
    }
  },

  async [DELETE_MAPPING_GROUP]({ commit }, { auditId, groupId }) {
    try {
      await this.$axios.$delete(
        `deliverability/audits/${auditId}/mapping/groups/${groupId}`
      );
      commit(M_DELETE_MAPPING_GROUP, groupId);
    } catch (error) {
      console.error('Error deleting mapping group:', error);
      throw error;
    }
  },

  async [CREATE_MAPPING_ENTRY]({ commit }, { auditId, groupId }) {
    try {
      const response = await this.$axios.$post(
        `deliverability/audits/${auditId}/mapping/entries`,
        { groupId: groupId || null }
      );
      commit(M_ADD_MAPPING_ENTRY, response.entry);
      return response.entry;
    } catch (error) {
      console.error('Error creating mapping entry:', error);
      throw error;
    }
  },

  async [UPDATE_MAPPING_ENTRY]({ commit }, { auditId, entryId, data }) {
    try {
      const response = await this.$axios.$put(
        `deliverability/audits/${auditId}/mapping/entries/${entryId}`,
        data
      );
      commit(M_UPDATE_MAPPING_ENTRY, response.entry);
      return response.entry;
    } catch (error) {
      console.error('Error updating mapping entry:', error);
      throw error;
    }
  },

  async [DELETE_MAPPING_ENTRY]({ commit }, { auditId, entryId }) {
    try {
      await this.$axios.$delete(
        `deliverability/audits/${auditId}/mapping/entries/${entryId}`
      );
      commit(M_DELETE_MAPPING_ENTRY, entryId);
    } catch (error) {
      console.error('Error deleting mapping entry:', error);
      throw error;
    }
  },

  async [REORDER_MAPPING_ENTRIES](_ctx, { auditId, updates }) {
    try {
      await this.$axios.$post(
        `deliverability/audits/${auditId}/mapping/reorder`,
        { updates }
      );
    } catch (error) {
      console.error('Error reordering mapping entries:', error);
      throw error;
    }
  },

  async [REORDER_MAPPING_GROUPS](_ctx, { auditId, updates }) {
    try {
      await this.$axios.$post(
        `deliverability/audits/${auditId}/mapping/reorder-groups`,
        { updates }
      );
    } catch (error) {
      console.error('Error reordering mapping groups:', error);
      throw error;
    }
  },

  async [UPDATE_INVENTORY_PROGRESS](
    { commit },
    { auditId, category, completed }
  ) {
    try {
      const response = await this.$axios.$put(
        `deliverability/audits/${auditId}/inventory/progress`,
        { category, completed }
      );
      commit('M_SET_CURRENT_AUDIT', response.audit);
      return response.audit;
    } catch (error) {
      console.error('Error updating inventory progress:', error);
      throw error;
    }
  },
};
