<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="p-4 border-b bg-white">
      <h2 class="font-bold text-lg text-gray-800">Composants</h2>
      <p class="text-sm text-gray-500 mt-1">
        {{ components.length }} composant(s) disponible(s)
      </p>
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
      <div v-if="components.length === 0" class="text-center text-gray-400 py-12">
        <p>Aucun composant disponible</p>
      </div>

      <!-- Composants par catégorie -->
      <div v-for="category in categories" :key="category" class="mb-4">
        <h3 class="text-xs font-semibold text-gray-500 uppercase mb-2">
          {{ category }}
        </h3>

        <div
          v-for="component in getComponentsByCategory(category)"
          :key="component.name"
          class="mb-2 p-3 bg-white rounded-lg border-2 border-gray-200 cursor-move hover:border-blue-400 hover:shadow-md transition-all duration-200"
          draggable="true"
          @dragstart="onDragStart($event, component)"
          @dragend="onDragEnd"
        >
          <div class="flex items-center gap-3">
            <!-- Icône -->
            <div class="text-2xl">{{ component.icon || '📦' }}</div>

            <!-- Info -->
            <div class="flex-1">
              <div class="font-medium text-gray-800">{{ component.label }}</div>
              <div class="text-xs text-gray-500">{{ component.description || 'Aucune description' }}</div>
            </div>

            <!-- Badge catégorie -->
            <div class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {{ component.category }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer avec stats -->
    <div v-if="!isLoading && !error" class="p-3 border-t bg-gray-50 text-xs text-gray-500">
      <div class="flex justify-between">
        <span>Design System: {{ designSystemName }}</span>
        <span>{{ components.length }} composants</span>
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

// Computed
const components = computed(() => componentsComposable.components.value)
const isLoading = computed(() => componentsComposable.isLoading.value)
const error = computed(() => componentsComposable.error.value)

const designSystemName = computed(() => {
  return emailStore.designSystem?.name || emailStore.metadata.designSystemId || 'N/A'
})

const categories = computed(() => {
  // Extraire les catégories uniques
  const cats = [...new Set(components.value.map(c => c.category))]
  return cats.sort()
})

// Méthodes
const getComponentsByCategory = (category) => {
  return components.value.filter(c => c.category === category)
}

const onDragStart = (event, component) => {
  isDragging.value = true

  // Données pour le drop
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'component',
    componentName: component.name,
    component: component
  }))

  console.log('🎯 Drag start:', component.name)
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
</style>
