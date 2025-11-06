<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="p-4 border-b bg-white">
      <h2 class="font-bold text-lg text-gray-800">Composants</h2>
      <p class="text-sm text-gray-500 mt-1">
        {{ filteredComponents.length }} composant(s) disponible(s)
      </p>
    </div>

    <!-- Tabs -->
    <div class="flex border-b bg-white">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
        :class="{
          'text-blue-600 border-b-2 border-blue-600 bg-blue-50': activeTab === tab.id,
          'text-gray-600 hover:text-gray-800 hover:bg-gray-50': activeTab !== tab.id
        }"
      >
        <span class="mr-2">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p class="mt-2 text-sm text-gray-500">Chargement...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center p-4">
      <div class="text-center text-red-500">
        <p class="font-semibold">❌ Erreur</p>
        <p class="text-sm mt-1">{{ error }}</p>
        <button
          @click="loadComponentsList"
          class="mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
        >
          Réessayer
        </button>
      </div>
    </div>

    <!-- Liste des composants -->
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-2">
      <!-- Vide -->
      <div v-if="filteredComponents.length === 0" class="text-center text-gray-400 py-12">
        <p class="text-4xl mb-3">{{ currentTab.emptyIcon }}</p>
        <p class="font-medium">{{ currentTab.emptyText }}</p>
        <p class="text-sm mt-1">{{ currentTab.emptyHint }}</p>
      </div>

      <!-- Composants de l'onglet actif -->
      <div
        v-for="component in filteredComponents"
        :key="component.name"
        class="mb-2 p-4 bg-white rounded-lg border-2 border-gray-200 cursor-move hover:border-blue-400 hover:shadow-md transition-all duration-200"
        draggable="true"
        @dragstart="onDragStart($event, component)"
        @dragend="onDragEnd"
      >
        <div class="flex items-start gap-3">
          <!-- Icône -->
          <div class="text-3xl flex-shrink-0">{{ component.icon || '📦' }}</div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-800 mb-1">{{ component.label }}</div>

            <!-- Description pour sections (afficher le nombre de colonnes) -->
            <div v-if="activeTab === 'sections'" class="text-xs text-gray-600 mb-2">
              <span v-if="component.columnCount === 1">1 colonne</span>
              <span v-else>{{ component.columnCount }} colonnes</span>
              <span v-if="component.columnWidths" class="ml-2 text-gray-400">
                ({{ component.columnWidths.join(' / ') }})
              </span>
            </div>
            <div v-else class="text-xs text-gray-500 mb-2">
              {{ component.description || 'Composant de contenu' }}
            </div>

            <!-- Badge catégorie -->
            <div class="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {{ component.name }}
            </div>
          </div>

          <!-- Visual indicator pour sections -->
          <div v-if="activeTab === 'sections'" class="flex-shrink-0">
            <div class="flex gap-1">
              <div
                v-for="i in component.columnCount"
                :key="i"
                class="w-3 h-8 bg-gray-300 rounded"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer avec stats -->
    <div v-if="!isLoading && !error" class="p-3 border-t bg-gray-50 text-xs text-gray-500">
      <div class="flex justify-between">
        <span>{{ currentTab.label }}</span>
        <span>{{ filteredComponents.length }} composants</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useComponents } from '../composables/useComponents'
import { useEmailStore } from '../stores/email'

const componentsComposable = useComponents()
const emailStore = useEmailStore()

// État local
const isDragging = ref(false)
const activeTab = ref('sections') // 'sections' | 'content' | 'custom'

// Tabs configuration
const tabs = [
  {
    id: 'sections',
    label: 'Sections',
    icon: '📋',
    emptyIcon: '📋',
    emptyText: 'Aucune section disponible',
    emptyHint: 'Les sections sont des conteneurs multi-colonnes'
  },
  {
    id: 'content',
    label: 'Contenus',
    icon: '📝',
    emptyIcon: '📝',
    emptyText: 'Aucun contenu disponible',
    emptyHint: 'Les contenus sont des composants simples (texte, image, bouton...)'
  },
  {
    id: 'custom',
    label: 'Sur-mesure',
    icon: '⭐',
    emptyIcon: '⭐',
    emptyText: 'Aucun composant sur-mesure',
    emptyHint: 'Les composants sur-mesure sont développés pour votre design system'
  }
]

// Computed
const components = computed(() => componentsComposable.components.value)
const isLoading = computed(() => componentsComposable.isLoading.value)
const error = computed(() => componentsComposable.error.value)

const currentTab = computed(() => {
  return tabs.find(t => t.id === activeTab.value) || tabs[0]
})

const filteredComponents = computed(() => {
  return components.value.filter(c => c.category === activeTab.value)
})

// Méthodes
const onDragStart = (event, component) => {
  isDragging.value = true

  // Données pour le drop - différentes selon le type
  event.dataTransfer.effectAllowed = 'copy'

  const dragData = {
    type: component.category, // 'sections' | 'content' | 'custom'
    category: component.category,
    componentName: component.name,
    component: component
  }

  // Pour les sections, ajouter columnCount et columnWidths
  if (component.category === 'sections') {
    dragData.columnCount = component.columnCount || 1
    dragData.columnWidths = component.columnWidths || ['100%']
  }

  event.dataTransfer.setData('application/json', JSON.stringify(dragData))

  console.log('🎯 Drag start:', component.name, `(${component.category})`)
}

const onDragEnd = () => {
  isDragging.value = false
  console.log('🎯 Drag end')
}

const loadComponentsList = async () => {
  try {
    await componentsComposable.initialize()
  } catch (err) {
    console.error('Failed to load components:', err)
  }
}

// Lifecycle
onMounted(async () => {
  await loadComponentsList()
})
</script>

<style scoped>
/* Animation pour le drag */
.cursor-move:active {
  cursor: grabbing;
}

/* Transition smooth pour les onglets */
button {
  transition: all 0.2s ease;
}
</style>
