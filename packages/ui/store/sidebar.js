'use strict';

const DEFAULT_WIDTH = 320; // Increased from 240px
const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const COLLAPSED_WIDTH = 60;

// State
export const state = () => ({
  collapsed:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('lepatron_sidebar_collapsed') === 'true'
      : false,
  activeModule: null, // 'email-builder' | 'crm-intelligence' | null
  width:
    typeof localStorage !== 'undefined'
      ? parseInt(
          localStorage.getItem('lepatron_sidebar_width') || DEFAULT_WIDTH,
          10
        )
      : DEFAULT_WIDTH,
  mobileOpen: false, // Mobile sidebar drawer state
  // Last seen groupId — used by SettingsList to keep linking to the
  // current customer group when the route doesn't expose it (e.g. on
  // /templates/<id> reached from /groups/<id>/settings/templates).
  lastGroupId: null,
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

  SET_WIDTH(state, width) {
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    state.width = clampedWidth;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lepatron_sidebar_width', clampedWidth);
    }
  },

  SET_MOBILE_OPEN(state, value) {
    state.mobileOpen = value;
  },

  TOGGLE_MOBILE_OPEN(state) {
    state.mobileOpen = !state.mobileOpen;
  },

  SET_LAST_GROUP_ID(state, groupId) {
    state.lastGroupId = groupId || null;
  },
};

// Getters
export const getters = {
  isCollapsed: (state) => state.collapsed,
  activeModule: (state) => state.activeModule,
  sidebarWidth: (state) => (state.collapsed ? COLLAPSED_WIDTH : state.width),
  lastGroupId: (state) => state.lastGroupId,
};

// Mutation types (for imports)
export const SET_COLLAPSED = 'SET_COLLAPSED';
export const SET_ACTIVE_MODULE = 'SET_ACTIVE_MODULE';
export const SET_WIDTH = 'SET_WIDTH';
export const SET_MOBILE_OPEN = 'SET_MOBILE_OPEN';
export const TOGGLE_MOBILE_OPEN = 'TOGGLE_MOBILE_OPEN';
export const SET_LAST_GROUP_ID = 'SET_LAST_GROUP_ID';

// Constants (for imports)
export const SIDEBAR_MIN_WIDTH = MIN_WIDTH;
export const SIDEBAR_MAX_WIDTH = MAX_WIDTH;
export const SIDEBAR_DEFAULT_WIDTH = DEFAULT_WIDTH;
