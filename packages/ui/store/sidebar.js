'use strict';

// State
export const state = () => ({
  collapsed:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('lepatron_sidebar_collapsed') === 'true'
      : false,
  activeModule: null, // 'email-builder' | 'crm-intelligence' | null
});

// Mutations
export const mutations = {
  SET_COLLAPSED(state, value) {
    state.collapsed = value;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lepatron_sidebar_collapsed', value);
    }
  },

  SET_ACTIVE_MODULE(state, moduleId) {
    state.activeModule = moduleId;
  },
};

// Getters
export const getters = {
  isCollapsed: (state) => state.collapsed,
  activeModule: (state) => state.activeModule,
};

// Mutation types (for imports)
export const SET_COLLAPSED = 'SET_COLLAPSED';
export const SET_ACTIVE_MODULE = 'SET_ACTIVE_MODULE';
