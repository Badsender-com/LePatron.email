import {
  notifications,
  notificationsUnreadCount,
  notificationMarkRead,
  notificationsMarkAllRead,
} from '~/helpers/api-routes';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export const NOTIFICATION = 'notification';

// Mutation types
export const SET_NOTIFICATIONS = 'SET_NOTIFICATIONS';
export const SET_UNREAD_COUNT = 'SET_UNREAD_COUNT';
export const SET_IS_LOADING = 'SET_IS_LOADING';
export const MARK_AS_READ = 'MARK_AS_READ';
export const RESET_NOTIFICATIONS = 'RESET_NOTIFICATIONS';

// Action types
export const FETCH_NOTIFICATIONS = 'fetchNotifications';
export const FETCH_UNREAD_COUNT = 'fetchUnreadCount';
export const MARK_NOTIFICATION_READ = 'markNotificationRead';
export const MARK_ALL_READ = 'markAllRead';
export const START_POLLING = 'startPolling';
export const STOP_POLLING = 'stopPolling';

// Polling interval in milliseconds (60 seconds)
const POLLING_INTERVAL = 60000;

let pollingIntervalId = null;

export const state = () => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
});

export const getters = {
  hasUnread: (state) => state.unreadCount > 0,
  unreadNotifications: (state) =>
    state.notifications.filter((n) => !n.read),
};

export const mutations = {
  [SET_NOTIFICATIONS](state, notifications) {
    state.notifications = notifications;
  },
  [SET_UNREAD_COUNT](state, count) {
    state.unreadCount = count;
  },
  [SET_IS_LOADING](state, isLoading) {
    state.isLoading = isLoading;
  },
  [MARK_AS_READ](state, notificationId) {
    const notification = state.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    }
  },
  [RESET_NOTIFICATIONS](state) {
    state.notifications = [];
    state.unreadCount = 0;
    state.isLoading = false;
  },
};

export const actions = {
  async [FETCH_NOTIFICATIONS]({ commit }, { $t } = {}) {
    commit(SET_IS_LOADING, true);
    try {
      const response = await this.$axios.$get(notifications());
      commit(SET_NOTIFICATIONS, response.items || []);
      // Also update unread count from the response if available
      if (typeof response.unreadCount === 'number') {
        commit(SET_UNREAD_COUNT, response.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if ($t) {
        commit(
          `${PAGE}/${SHOW_SNACKBAR}`,
          {
            text: $t('global.errors.errorOccured'),
            color: 'error',
          },
          { root: true }
        );
      }
    } finally {
      commit(SET_IS_LOADING, false);
    }
  },

  async [FETCH_UNREAD_COUNT]({ commit }) {
    try {
      const response = await this.$axios.$get(notificationsUnreadCount());
      commit(SET_UNREAD_COUNT, response.count || 0);
    } catch (error) {
      // Silent fail for polling - don't spam errors
      console.error('Error fetching unread count:', error);
    }
  },

  async [MARK_NOTIFICATION_READ]({ commit, dispatch }, { notificationId, $t } = {}) {
    try {
      await this.$axios.$patch(notificationMarkRead({ notificationId }));
      commit(MARK_AS_READ, notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      if ($t) {
        commit(
          `${PAGE}/${SHOW_SNACKBAR}`,
          {
            text: $t('global.errors.errorOccured'),
            color: 'error',
          },
          { root: true }
        );
      }
      // Refresh notifications to get correct state
      await dispatch(FETCH_NOTIFICATIONS, { $t });
    }
  },

  async [MARK_ALL_READ]({ commit, dispatch }, { $t } = {}) {
    try {
      await this.$axios.$patch(notificationsMarkAllRead());
      commit(SET_UNREAD_COUNT, 0);
      // Refresh notifications to update read status
      await dispatch(FETCH_NOTIFICATIONS, { $t });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      if ($t) {
        commit(
          `${PAGE}/${SHOW_SNACKBAR}`,
          {
            text: $t('global.errors.errorOccured'),
            color: 'error',
          },
          { root: true }
        );
      }
    }
  },

  [START_POLLING]({ dispatch }) {
    // Clear any existing interval
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
    // Fetch immediately
    dispatch(FETCH_UNREAD_COUNT);
    // Set up polling
    pollingIntervalId = setInterval(() => {
      dispatch(FETCH_UNREAD_COUNT);
    }, POLLING_INTERVAL);
  },

  [STOP_POLLING]() {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  },
};
