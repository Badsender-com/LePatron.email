# Organisms

Organisms are complex UI components composed of molecules and atoms that form distinct sections of the interface.

## Vue App Organisms

### Data Tables with Actions

**Example**: `components/users/table.vue`

A complete data table with:
- Column headers with i18n labels
- Sortable columns
- Custom cell templates (links, badges, icons)
- Action dropdown per row
- Loading state
- Integration with action modals

**Structure**:
```html
<v-data-table :headers="tableHeaders" :items="users" :loading="loading">
  <template #item.email="{ item }">
    <nuxt-link :to="`/users/${item.id}`">{{ item.email }}</nuxt-link>
  </template>
  <template #item.role="{ item }">
    <v-badge v-if="item.role === 'admin'" inline color="accent" content="Admin" />
  </template>
  <template #item.status="{ item }">
    <v-icon color="accent">{{ getStatusIcon(item) }}</v-icon>
  </template>
  <template #item.actions="{ item }">
    <bs-actions-dropdown :user="item" ... />
  </template>
</v-data-table>
```

**Conventions**:
- Headers defined in computed property
- Use `$t()` for all text
- Custom filters for dates: `item.createdAt | preciseDateTime`
- Custom filters for status: `item | userStatus`
- Link to detail page via `nuxt-link`

---

### Form Pages

**Pattern**: Card containing form with actions

```html
<v-card flat tile tag="form">
  <v-card-title v-if="title">{{ title }}</v-card-title>
  <v-card-text>
    <v-row>
      <!-- Form fields in grid -->
    </v-row>
  </v-card-text>
  <v-divider />
  <v-card-actions>
    <v-spacer />
    <v-btn color="accent" elevation="0" @click="onSubmit">
      {{ $t('global.save') }}
    </v-btn>
  </v-card-actions>
</v-card>
```

---

### Navigation Header

**Component**: `layouts/default.vue` app bar

```html
<v-app-bar app color="primary" dark flat>
  <v-toolbar-title>
    <svg><!-- Logo --></svg>
    {{ title }}
  </v-toolbar-title>
  <v-spacer />

  <!-- Help button -->
  <v-tooltip bottom>
    <template #activator="{ on }">
      <v-btn icon color="primary lighten-4" href="..." v-on="on">
        <v-icon>help</v-icon>
      </v-btn>
    </template>
    <span>{{ $t('layout.help') }}</span>
  </v-tooltip>

  <!-- Settings (admin only) -->
  <v-tooltip v-if="isGroupAdmin" bottom>
    <template #activator="{ on }">
      <v-btn icon color="primary lighten-4" :href="groupAdminUrl" v-on="on">
        <v-icon>settings</v-icon>
      </v-btn>
    </template>
    <span>{{ $t('global.settings') }}</span>
  </v-tooltip>

  <!-- Logout -->
  <v-tooltip bottom>
    <template #activator="{ on }">
      <v-btn icon color="white" href="/account/logout" v-on="on">
        <v-icon>power_settings_new</v-icon>
      </v-btn>
    </template>
    <span>{{ $t('layout.logout') }}</span>
  </v-tooltip>
</v-app-bar>
```

---

### Settings Tabs

**Pattern**: Group settings with multiple tabs

**Location**: `routes/groups/_groupId.vue` (assumed pattern)

```html
<v-tabs>
  <v-tab>{{ $t('groups.tabs.info') }}</v-tab>
  <v-tab>{{ $t('groups.tabs.users') }}</v-tab>
  <v-tab>{{ $t('groups.tabs.profiles') }}</v-tab>
  <!-- ... -->
</v-tabs>

<v-tabs-items>
  <v-tab-item>
    <bs-group-form />
  </v-tab-item>
  <v-tab-item>
    <bs-users-tab />
  </v-tab-item>
  <!-- ... -->
</v-tabs-items>
```

---

## Organism Inventory

| Organism | Location | Purpose |
|----------|----------|---------|
| `users/table` | `components/users/` | Users list with actions |
| `templates/table` | `components/templates/` | Templates list |
| `profiles/table` | `components/profiles/` | ESP profiles list |
| `mailings/admin-table` | `components/mailings/` | Admin mailings list |
| `group/form` | `components/group/` | Group settings form |
| `group/menu` | `components/group/` | Group sidebar menu |
| `group/users-tab` | `components/group/` | Users management tab |
| `group/profile-tab` | `components/group/` | Profiles management tab |
| `group/templates-tab` | `components/group/` | Templates management tab |
| `group/tags-tab` | `components/group/` | Tags management tab |
| `group/workspaces-tab` | `components/group/` | Workspaces tab |
| `group/emails-groups-tab` | `components/group/` | Email groups tab |
| `group/mailings-tab` | `components/group/` | Mailings settings tab |
| `group/color-scheme` | `components/group/` | Color scheme picker |
| `template/menu` | `components/template/` | Template detail sidebar |
| `templates/create-form` | `components/templates/` | Template creation wizard |

---

## Layouts (Templates)

| Layout | Location | Purpose |
|--------|----------|---------|
| `default` | `layouts/default.vue` | Main app layout with header |
| `centered` | `layouts/centered.vue` | Centered content (login) |
| `error` | `layouts/error.vue` | Error page layout |

---

## Page Structure Convention

```
+------------------------------------------+
|  App Bar (logo, title, actions)          |
+------------------------------------------+
|                                          |
|  +------------------------------------+  |
|  | Page Content (nuxt)                |  |
|  |                                    |  |
|  |  +-----------------------------+   |  |
|  |  | Card/Table Organism         |   |  |
|  |  +-----------------------------+   |  |
|  |                                    |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|  Snackbar (notifications)                |
+------------------------------------------+
```
