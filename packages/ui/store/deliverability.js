export const DELIVERABILITY = 'deliverability';

export const state = () => ({
  audits: [],
  currentAudit: null,
  inventoryItems: {},
  loading: false,
});

// Getters
export const AUDITS = 'AUDITS';
export const CURRENT_AUDIT = 'CURRENT_AUDIT';
export const INVENTORY_ITEMS = 'INVENTORY_ITEMS';
export const IS_LOADING = 'IS_LOADING';

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
};

// Mutations
export const M_SET_AUDITS = 'M_SET_AUDITS';
export const M_SET_CURRENT_AUDIT = 'M_SET_CURRENT_AUDIT';
export const M_SET_INVENTORY_ITEMS = 'M_SET_INVENTORY_ITEMS';
export const M_SET_LOADING = 'M_SET_LOADING';
export const M_ADD_AUDIT = 'M_ADD_AUDIT';
export const M_UPDATE_AUDIT = 'M_UPDATE_AUDIT';
export const M_DELETE_AUDIT = 'M_DELETE_AUDIT';

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
};

// Actions
export const FETCH_AUDITS = 'FETCH_AUDITS';
export const FETCH_AUDIT = 'FETCH_AUDIT';
export const CREATE_AUDIT = 'CREATE_AUDIT';
export const UPDATE_AUDIT = 'UPDATE_AUDIT';
export const DELETE_AUDIT = 'DELETE_AUDIT';
export const FETCH_INVENTORY_ITEMS = 'FETCH_INVENTORY_ITEMS';
export const BULK_UPSERT_INVENTORY = 'BULK_UPSERT_INVENTORY';

export const actions = {
  async [FETCH_AUDITS]({ commit, rootState }) {
    commit(M_SET_LOADING, true);
    try {
      const group = rootState.user.info.group;
      // Group can be either a string (ID) or an object with id or _id
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
      // Group can be either a string (ID) or an object with id or _id
      const groupId = typeof group === 'string' ? group : group.id || group._id;
      console.log(
        '[deliverability.store] Creating audit for groupId:',
        groupId
      );
      console.log('[deliverability.store] Audit data:', auditData);

      const response = await this.$axios.$post(
        `deliverability/groups/${groupId}/audits`,
        auditData
      );

      console.log('[deliverability.store] Full response:', response);
      console.log('[deliverability.store] response.audit:', response.audit);

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
    _context,
    { auditId, category, items, updateProgress = true }
  ) {
    try {
      const response = await this.$axios.$post(
        `deliverability/audits/${auditId}/inventory/bulk`,
        {
          category,
          items,
          updateProgress,
        }
      );
      return response.items;
    } catch (error) {
      console.error('Error upserting inventory items:', error);
      throw error;
    }
  },
};
