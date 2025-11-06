<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="p-4 border-b flex justify-between items-center">
      <div>
        <h2 class="font-bold text-lg text-gray-800">Canvas</h2>
        <p class="text-sm text-gray-500 mt-1">
          {{ emailStore.blockCount }} bloc(s)
        </p>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <button
          v-if="!emailStore.isEmpty"
          @click="clearAll"
          class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200"
          title="Tout supprimer"
        >
          🗑️ Vider
        </button>
      </div>
    </div>

    <!-- Zone de drop / Liste des blocs -->
    <div
      class="flex-1 overflow-y-auto p-4 bg-gray-50"
      :class="{ 'bg-blue-50': isDragOver }"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
    >
      <!-- Message vide -->
      <div
        v-if="emailStore.isEmpty"
        class="h-full flex items-center justify-center text-center text-gray-400"
      >
        <div>
          <div class="text-6xl mb-4">📧</div>
          <p class="text-lg font-medium">Canvas vide</p>
          <p class="text-sm mt-2">Glissez un composant ici pour commencer</p>
        </div>
      </div>

      <!-- Liste des blocs -->
      <div v-else class="space-y-2">
        <!-- Zone de drop au début (avant le premier bloc) -->
        <div
          class="h-8 rounded border-2 border-dashed transition-all"
          :class="dropTargetIndex === 0 ? 'bg-blue-100 border-blue-400' : 'bg-gray-100 border-gray-300 opacity-50 hover:opacity-100'"
          @drop="onDropBetween($event, 0)"
          @dragover="onDragOverBetween($event, 0)"
          @dragleave="onDragLeaveBetween"
        >
          <div class="h-full flex items-center justify-center text-xs text-gray-500">
            Déposer ici
          </div>
        </div>

        <div
          v-for="(block, index) in emailStore.blocks"
          :key="block.id"
          class="group relative p-4 bg-white rounded-lg border-2 transition-all duration-200"
          :class="{
            'border-blue-500 shadow-md': isSelected(block.id),
            'border-gray-200 hover:border-gray-300': !isSelected(block.id)
          }"
          @click="selectBlock(block.id)"
        >
          <!-- Drag handle -->
          <div
            class="absolute left-2 top-1/2 transform -translate-y-1/2 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
            draggable="true"
            @dragstart="onBlockDragStart($event, index)"
            @dragend="onBlockDragEnd"
            title="Déplacer"
          >
            <div class="flex flex-col gap-1">
              <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>

          <!-- Contenu du bloc -->
          <div class="ml-6">
            <div class="flex items-start justify-between">
              <!-- Info -->
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-gray-800">
                    {{ getComponentLabel(block.component) }}
                  </span>
                  <span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {{ block.component }}
                  </span>
                </div>

                <!-- Preview des props principales -->
                <div class="mt-2 text-sm text-gray-600">
                  <div v-if="block.component === 'button'" class="truncate">
                    {{ block.props.text || 'Button' }} → {{ block.props.url || '#' }}
                  </div>
                  <div v-else-if="block.component === 'heading'" class="truncate">
                    {{ block.props.level || 'h2' }}: {{ block.props.text || 'Heading' }}
                  </div>
                  <div v-else-if="block.component === 'container'" class="truncate">
                    Container ({{ block.props.maxWidth || '600px' }})
                  </div>
                  <div v-else class="text-gray-400 italic">
                    {{ Object.keys(block.props).length }} propriété(s)
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="duplicateBlock(block.id)"
                  class="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  title="Dupliquer"
                >
                  📋
                </button>
                <button
                  v-if="index > 0"
                  @click.stop="moveBlockUp(index)"
                  class="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  title="Monter"
                >
                  ⬆️
                </button>
                <button
                  v-if="index < emailStore.blocks.length - 1"
                  @click.stop="moveBlockDown(index)"
                  class="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                  title="Descendre"
                >
                  ⬇️
                </button>
                <button
                  @click.stop="deleteBlock(block.id)"
                  class="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <!-- Indicateur de sélection -->
          <div
            v-if="isSelected(block.id)"
            class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"
          ></div>

          <!-- Zone de drop entre les blocs -->
          <div
            class="absolute left-0 right-0 h-2 -bottom-1 cursor-pointer"
            :class="{
              'bg-blue-400 opacity-50': dropTargetIndex === index + 1
            }"
            @drop="onDropBetween($event, index + 1)"
            @dragover="onDragOverBetween($event, index + 1)"
            @dragleave="onDragLeaveBetween"
          ></div>
        </div>

        <!-- Zone de drop à la fin (après tous les blocs) -->
        <div
          class="h-12 rounded border-2 border-dashed transition-all mt-2"
          :class="dropTargetIndex === emailStore.blocks.length ? 'bg-blue-100 border-blue-400' : 'bg-gray-100 border-gray-300 opacity-50 hover:opacity-100'"
          @drop="onDropBetween($event, emailStore.blocks.length)"
          @dragover="onDragOverBetween($event, emailStore.blocks.length)"
          @dragleave="onDragLeaveBetween"
        >
          <div class="h-full flex items-center justify-center text-xs text-gray-500">
            ➕ Déposer un nouveau bloc ici
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEmailStore } from '../stores/email'
import { useComponents } from '../composables/useComponents'

const emailStore = useEmailStore()
const componentsComposable = useComponents()

// État local
const isDragOver = ref(false)
const dropTargetIndex = ref(null)
const draggingBlockIndex = ref(null)

// Computed
const components = computed(() => componentsComposable.components.value)

// Méthodes
const isSelected = (blockId) => {
  return emailStore.selectedBlockId === blockId
}

const selectBlock = (blockId) => {
  emailStore.selectBlock(blockId)
}

const getComponentLabel = (componentName) => {
  const component = components.value.find(c => c.name === componentName)
  return component?.label || componentName
}

const deleteBlock = (blockId) => {
  if (confirm('Supprimer ce bloc ?')) {
    emailStore.deleteBlock(blockId)
  }
}

const duplicateBlock = (blockId) => {
  emailStore.duplicateBlock(blockId)
}

const moveBlockUp = (index) => {
  if (index > 0) {
    emailStore.moveBlock(index, index - 1)
  }
}

const moveBlockDown = (index) => {
  if (index < emailStore.blocks.length - 1) {
    emailStore.moveBlock(index, index + 1)
  }
}

const clearAll = () => {
  if (confirm('Supprimer tous les blocs ?')) {
    emailStore.resetEmail()
  }
}

// Drag & Drop - Composants depuis ComponentLibrary
const onDragOver = (event) => {
  // Only handle on parent container when canvas is empty
  // When canvas has blocks, let the explicit drop zones handle it
  if (!emailStore.isEmpty) return

  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

const onDragLeave = (event) => {
  // Only handle when canvas is empty
  if (!emailStore.isEmpty) return

  // Vérifier si on quitte vraiment la zone (pas un enfant)
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragOver.value = false
  }
}

const onDrop = async (event) => {
  // Only handle on parent container when canvas is empty
  // When canvas has blocks, let the explicit drop zones handle it
  if (!emailStore.isEmpty) return

  event.preventDefault()
  isDragOver.value = false

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'))

    if (data.type === 'component') {
      console.log('📦 Dropping component:', data.componentName)

      // Charger les defaults du composant
      const defaults = await componentsComposable.getDefaultProps(data.componentName)

      // Ajouter le bloc
      emailStore.addBlock(data.componentName, defaults)
    }

  } catch (err) {
    console.error('❌ Drop error:', err)
  }
}

// Drag & Drop - Réorganisation des blocs
const onBlockDragStart = (event, index) => {
  draggingBlockIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index.toString())

  console.log('🎯 Block drag start:', index)
}

const onBlockDragEnd = () => {
  draggingBlockIndex.value = null
  dropTargetIndex.value = null
  console.log('🎯 Block drag end')
}

const onDragOverBetween = (event, targetIndex) => {
  event.preventDefault()
  event.stopPropagation()

  // Accepter à la fois 'copy' (nouveaux composants) et 'move' (réorganisation)
  event.dataTransfer.dropEffect = draggingBlockIndex.value !== null ? 'move' : 'copy'

  dropTargetIndex.value = targetIndex
  console.log('🎯 Drag over zone index:', targetIndex)
}

const onDragLeaveBetween = () => {
  dropTargetIndex.value = null
}

const onDropBetween = async (event, targetIndex) => {
  event.preventDefault()
  event.stopPropagation()

  // Cas 1: Drop d'un nouveau composant depuis ComponentLibrary
  try {
    const jsonData = event.dataTransfer.getData('application/json')
    if (jsonData) {
      const data = JSON.parse(jsonData)

      if (data.type === 'component') {
        console.log('📦 Dropping NEW component at index:', targetIndex, data.componentName)

        // Charger les defaults du composant
        const defaults = await componentsComposable.getDefaultProps(data.componentName)

        // Insérer le bloc à l'index spécifique
        emailStore.insertBlockAt(targetIndex, data.componentName, defaults)

        dropTargetIndex.value = null
        return
      }
    }
  } catch (err) {
    console.log('Not a new component, checking for block reordering...')
  }

  // Cas 2: Réorganisation d'un bloc existant
  if (draggingBlockIndex.value !== null) {
    const fromIndex = draggingBlockIndex.value
    let toIndex = targetIndex

    // Ajuster l'index si on déplace vers le bas
    if (fromIndex < toIndex) {
      toIndex--
    }

    // Ne rien faire si on déplace à la même position
    if (fromIndex === toIndex) {
      console.log('⚠️ Same position, skipping move:', fromIndex)
      dropTargetIndex.value = null
      draggingBlockIndex.value = null
      return
    }

    console.log('📦 Moving block from', fromIndex, 'to', toIndex)
    emailStore.moveBlock(fromIndex, toIndex)
  }

  dropTargetIndex.value = null
  draggingBlockIndex.value = null
}
</script>

<style scoped>
/* Smooth transitions */
.group {
  transition: all 0.2s ease;
}
</style>
