<script>
import { ArrowLeft, Shield } from 'lucide-vue';

export default {
  name: 'BsCompaniesNav',
  components: {
    LucideArrowLeft: ArrowLeft,
    LucideShield: Shield,
  },
  computed: {
    navItems() {
      return [
        {
          category: 'superAdmin',
          label: this.$t('settingsNav.categories.superAdmin'),
          items: [
            {
              id: 'companies-list',
              label: this.$t('settingsNav.companiesList'),
              icon: 'mdi-domain',
              route: '/groups',
              visible: true,
              superAdminOnly: true,
              exact: true,
            },
          ],
        },
      ];
    },
  },
  methods: {
    isActive(route) {
      return this.$route.path === route;
    },
  },
};
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-list dense nav>
        <!-- Back link -->
        <v-list-item nuxt class="mb-4" link to="/mailings">
          <v-list-item-icon class="mr-3">
            <lucide-arrow-left :size="20" />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.backToMails') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>

        <!-- Navigation categories -->
        <template v-for="category in navItems">
          <v-subheader
            :key="`header-${category.category}`"
            class="text-uppercase"
          >
            {{ category.label }}
          </v-subheader>

          <v-list-item
            v-for="item in category.items"
            :key="item.id"
            :class="{ 'v-list-item--active': isActive(item.route) }"
            :to="item.route"
            :exact="item.exact"
            nuxt
            link
          >
            <v-list-item-icon class="mr-3">
              <v-icon :color="isActive(item.route) ? 'accent' : ''">
                {{ item.icon }}
              </v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title>
                {{ item.label }}
              </v-list-item-title>
            </v-list-item-content>
            <!-- Super admin only indicator -->
            <v-list-item-action
              v-if="item.superAdminOnly"
              class="super-admin-indicator"
            >
              <v-tooltip right>
                <template #activator="{ on, attrs }">
                  <lucide-shield
                    v-bind="attrs"
                    :size="16"
                    class="super-admin-icon"
                    v-on="on"
                  />
                </template>
                <span>{{ $t('settingsNav.superAdminOnly') }}</span>
              </v-tooltip>
            </v-list-item-action>
          </v-list-item>
        </template>
      </v-list>
    </v-col>
  </v-row>
</template>

<style scoped>
.v-list-item--active {
  background-color: rgba(0, 172, 220, 0.08);
}

.v-list-item--active .v-list-item__title {
  color: var(--v-accent-base);
  font-weight: 500;
}

.v-subheader {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.6);
  height: 32px;
  margin-top: 8px;
}

.v-list-item__title {
  font-size: 0.875rem;
}

.v-list-item__icon {
  margin-right: 12px !important;
}

.super-admin-indicator {
  margin: 0 !important;
  min-width: auto !important;
}

.super-admin-icon {
  color: rgba(0, 0, 0, 0.38);
}

.v-list-item--active .super-admin-icon {
  color: var(--v-accent-base);
}
</style>
