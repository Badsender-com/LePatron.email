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

- [ ] Add new profile page

  ```
    <script>
      import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';

      import * as acls from '~/helpers/pages-acls.js';
      import ProfileForm from '~/components/profiles/profile-form';
      import BsGroupMenu from '~/components/group/menu.vue';

      export default {
        name: 'PageNewProfile',
        components: { ProfileForm, BsGroupMenu },
        mixins: [mixinPageTitle],
        meta: {
          acl: acls.ACL_GROUP_ADMIN,
        },
      };
      </script>

      <template>
        <bs-layout-left-menu>
          <template #menu>
            <bs-group-menu />
          </template>
          <profile-form />
        </bs-layout-left-menu>
      </template>

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
            <v-icon>note_add</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.newProfile') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
  ```
- [ ] Add component `packages/ui/components/profiles/profile-form.vue`

```
  <script>
  import { validationMixin } from 'vuelidate';

  export default {
    name: 'ProfileForm',
    mixins: [validationMixin],
    supportedLanguages: [
      { text: 'English', value: 'en' },
      { text: 'Français', value: 'fr' },
    ],
  };
  </script>

  <template>
    <v-card tag="form">
      Profile form
    </v-card>
  </template>

```

- [ ] Add trads to `public/lang/badsender-en.js` and `public/lang/badsender-fr.js`.
