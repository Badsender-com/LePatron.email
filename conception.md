## Description:

PR to add profile section to Group admin interface

## How ?

- [ ] Add `Profile` folder to `packages/ui/routes/groups/_groupId`
- [ ] Add `packages/ui/components/group/profile-tab.vue`

```
  <script>

  export default {
    name: 'BsGroupProfilesTab'
  };
  </script>

  <template>
    <v-card
      flat
      tile
    >
      <v-card-text>
        Profile listing
      </v-card-text>
    </v-card>
  </template>
```

- [ ] Edit `packages/ui/routes/groups/_groupId/index.vue` and add those partition of code in the template

```
    ...
    <v-tab v-if="isAdmin" href="#group-profile">
            {{ $tc('global.profile', 2) }}
    </v-tab>
    ...
     <v-tab-item v-if="isGroupAdmin" value="group-profile">
        <bs-group-profiles-tab />
     </v-tab-item>
```

- [ ] Edit menu `packages/ui/components/group/menu.vue` add to computed method
  ```
  newWorkspaceHref() {
      return `/groups/${this.groupId}/new-profile`;
    }
  ...
    // Add to the template
        <v-list-item nuxt link :to="newUserHref">
          <v-list-item-avatar>
            <v-icon>person_add</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.newUser') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
  ```
