<script>
export default {
  name: 'BsMailingsTagsMenu',
  data() {
    return {
      showTagMenu: false,
    };
  },
  computed: {
    tagsCheckboxList() {
      return [];
    },
  },
  created() {},
  methods: {
    closeMenu() {
      this.showTagMenu = false;
    },
    openMenu() {
      this.showTagMenu = true;
    },
    onToggleTag() {},
    onUpdateMailingsTags() {},
  },
};
</script>

<template>
  <v-dialog v-model="showTagMenu" :close-on-content-click="false" :width="300">
    <v-card>
      <v-list>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title class="title">
              {{ $t(`tags.list`) }}
            </v-list-item-title>
          </v-list-item-content>
          <v-list-item-action>
            <v-btn icon @click="closeMenu">
              <v-icon>close</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>
      <v-divider />
      <v-list>
        <v-list-item
          v-for="tagCheckbox in tagsCheckboxList"
          :key="tagCheckbox.name"
          @click="toggleTag(tagCheckbox)"
        >
          <v-list-item-action>
            <v-icon>{{ tagCheckbox.checkIcon }}</v-icon>
          </v-list-item-action>
          <v-list-item-title>{{ tagCheckbox.name }}</v-list-item-title>
        </v-list-item>
      </v-list>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="onUpdateMailingsTags">
          {{ $t(`global.apply`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
