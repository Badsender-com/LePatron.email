<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import {
  NOTIFICATION,
  FETCH_NOTIFICATIONS,
  FETCH_UNREAD_COUNT,
  MARK_NOTIFICATION_READ,
  MARK_ALL_READ,
  START_POLLING,
  STOP_POLLING,
} from '~/store/notification.js';

export default {
  name: 'NotificationBell',
  data() {
    return {
      menuOpen: false,
    };
  },
  computed: {
    ...mapState(NOTIFICATION, ['notifications', 'unreadCount', 'isLoading']),
    ...mapGetters(NOTIFICATION, ['hasUnread']),
    displayedNotifications() {
      // Show max 10 notifications in dropdown
      return this.notifications.slice(0, 10);
    },
  },
  mounted() {
    this.startPolling();
  },
  beforeDestroy() {
    this.stopPolling();
  },
  methods: {
    ...mapActions(NOTIFICATION, {
      fetchNotifications: FETCH_NOTIFICATIONS,
      fetchUnreadCount: FETCH_UNREAD_COUNT,
      markNotificationRead: MARK_NOTIFICATION_READ,
      markAllRead: MARK_ALL_READ,
      startPolling: START_POLLING,
      stopPolling: STOP_POLLING,
    }),
    async onMenuOpen() {
      this.menuOpen = true;
      await this.fetchNotifications({ $t: this.$t });
    },
    onMenuClose() {
      this.menuOpen = false;
    },
    async handleNotificationClick(notification) {
      // Mark as read
      if (!notification.read) {
        await this.markNotificationRead({
          notificationId: notification.id,
          $t: this.$t,
        });
      }
      // Navigate to mailing editor with comments open
      if (notification.mailingId) {
        window.location.href = `/editor/${notification.mailingId}?comments=1`;
      }
      this.menuOpen = false;
    },
    async handleMarkAllRead() {
      await this.markAllRead({ $t: this.$t });
    },
    getNotificationIcon(type) {
      switch (type) {
        case 'comment_mention':
          return 'mdi-at';
        case 'comment_reply':
          return 'mdi-reply';
        case 'comment_resolved':
          return 'mdi-check-circle';
        default:
          return 'mdi-bell';
      }
    },
    getNotificationColor(type) {
      switch (type) {
        case 'comment_mention':
          return 'primary';
        case 'comment_reply':
          return 'info';
        case 'comment_resolved':
          return 'success';
        default:
          return 'grey';
      }
    },
    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        return this.$t('notifications.justNow');
      } else if (diffMins < 60) {
        return this.$t('notifications.minutesAgo', { count: diffMins });
      } else if (diffHours < 24) {
        return this.$t('notifications.hoursAgo', { count: diffHours });
      } else if (diffDays < 7) {
        return this.$t('notifications.daysAgo', { count: diffDays });
      } else {
        return d.toLocaleDateString();
      }
    },
  },
};
</script>

<template>
  <v-menu
    v-model="menuOpen"
    offset-y
    left
    :close-on-content-click="false"
    max-width="400"
    min-width="320"
    @input="menuOpen ? onMenuOpen() : onMenuClose()"
  >
    <template #activator="{ on, attrs }">
      <v-btn icon v-bind="attrs" v-on="on">
        <v-badge
          :content="unreadCount"
          :value="hasUnread"
          color="error"
          overlap
        >
          <v-icon>mdi-bell-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="notification-header">
        <span>{{ $t('notifications.title') }}</span>
        <v-spacer />
        <v-btn
          v-if="hasUnread"
          text
          x-small
          color="primary"
          @click="handleMarkAllRead"
        >
          {{ $t('notifications.markAllRead') }}
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-list v-if="isLoading" class="notification-list">
        <v-list-item>
          <v-list-item-content class="text-center">
            <v-progress-circular indeterminate size="24" />
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <v-list v-else-if="notifications.length === 0" class="notification-list">
        <v-list-item>
          <v-list-item-content class="text-center grey--text">
            {{ $t('notifications.empty') }}
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <v-list v-else class="notification-list" dense>
        <v-list-item
          v-for="notification in displayedNotifications"
          :key="notification.id"
          :class="{ 'notification-unread': !notification.read }"
          @click="handleNotificationClick(notification)"
        >
          <v-list-item-avatar size="32">
            <v-icon
              :color="getNotificationColor(notification.type)"
              size="20"
            >
              {{ getNotificationIcon(notification.type) }}
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title class="notification-title">
              <strong>{{ notification.actorName }}</strong>
              <span class="notification-action">
                {{ $t(`notifications.types.${notification.type}`) }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle class="notification-subtitle">
              <span class="notification-mailing">{{ notification.mailingName }}</span>
              <span class="notification-time">{{ formatDate(notification.createdAt) }}</span>
            </v-list-item-subtitle>
            <v-list-item-subtitle
              v-if="notification.commentPreview"
              class="notification-preview"
            >
              "{{ notification.commentPreview }}"
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action v-if="!notification.read">
            <v-icon x-small color="primary">mdi-circle</v-icon>
          </v-list-item-action>
        </v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<style scoped>
.notification-header {
  padding: 12px 16px;
  font-size: 1rem;
}

.notification-list {
  max-height: 400px;
  overflow-y: auto;
}

.notification-unread {
  background-color: rgba(25, 118, 210, 0.04);
}

.notification-title {
  font-size: 0.875rem;
  line-height: 1.3;
}

.notification-action {
  font-weight: normal;
  margin-left: 4px;
}

.notification-subtitle {
  font-size: 0.75rem;
  display: flex;
  justify-content: space-between;
}

.notification-mailing {
  color: rgba(0, 0, 0, 0.6);
}

.notification-time {
  color: rgba(0, 0, 0, 0.4);
}

.notification-preview {
  font-size: 0.75rem;
  font-style: italic;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}
</style>
