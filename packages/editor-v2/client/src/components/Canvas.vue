<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="p-4 border-b flex justify-between items-center">
      <div>
        <h2 class="font-bold text-lg text-gray-800">Canvas</h2>
        <p class="text-sm text-gray-500 mt-1">
          {{ emailStore.sectionCount }} section(s) · {{ emailStore.totalComponentCount }} composant(s)
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

    <!-- Zone de composition -->
    <div
      class="flex-1 overflow-y-auto p-4 bg-gray-50"
      :class="{ 'bg-blue-50': isDragOverCanvas }"
      @drop="onDropOnCanvas"
      @dragover="onDragOverCanvas"
      @dragleave="onDragLeaveCanvas"
    >
      <!-- Message vide -->
      <div
        v-if="emailStore.isEmpty"
        class="h-full flex items-center justify-center text-center text-gray-400"
      >
        <div>
          <div class="text-6xl mb-4">📧</div>
          <p class="text-lg font-medium">Canvas vide</p>
          <p class="text-sm mt-2">Glissez une <strong>Section</strong> ici pour commencer</p>
          <p class="text-xs mt-1 text-gray-400">📋 Sections → ⚏ Section 1 colonne</p>
        </div>
      </div>

      <!-- Liste des sections -->
      <div v-else class="space-y-4">
        <!-- Zone de drop avant la première section -->
        <div
          class="h-12 rounded border-2 border-dashed transition-all"
          :class="dropTargetSection === 0 ? 'bg-blue-100 border-blue-400' : 'bg-gray-100 border-gray-300 opacity-50 hover:opacity-100'"
          @drop="onDropSection($event, 0)"
          @dragover="onDragOverSection($event, 0)"
          @dragleave="onDragLeaveSection"
        >
          <div class="h-full flex items-center justify-center text-xs text-gray-500">
            ➕ Déposer une section ici
          </div>
        </div>

        <!-- Section -->
        <div
          v-for="(section, sectionIndex) in emailStore.sections"
          :key="section.id"
          class="group relative bg-white rounded-lg border-2 transition-all"
          :class="{
            'border-blue-500 shadow-lg': isSectionSelected(section.id),
            'border-gray-300': !isSectionSelected(section.id)
          }"
        >
          <!-- Section Header -->
          <div
            class="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer"
            @click="selectSection(section.id)"
          >
            <div class="flex items-center gap-3">
              <!-- Drag handle -->
              <div
                class="cursor-move opacity-50 group-hover:opacity-100 transition-opacity"
                draggable="true"
                @dragstart="onSectionDragStart($event, sectionIndex)"
                @dragend="onSectionDragEnd"
                @click.stop
                title="Déplacer la section"
              >
                <div class="flex gap-0.5">
                  <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                </div>
              </div>

              <!-- Info section -->
              <div>
                <span class="font-semibold text-gray-800">
                  {{ getComponentLabel(section.component) }}
                </span>
                <span class="ml-2 text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                  {{ section.columns.length }} col{{ section.columns.length > 1 ? 's' : '' }}
                </span>
              </div>
            </div>

            <!-- Section actions -->
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click.stop="duplicateSection(section.id)"
                class="p-1.5 text-gray-600 hover:bg-gray-200 rounded text-sm"
                title="Dupliquer section"
              >
                📋
              </button>
              <button
                v-if="sectionIndex > 0"
                @click.stop="moveSectionUp(sectionIndex)"
                class="p-1.5 text-gray-600 hover:bg-gray-200 rounded text-sm"
                title="Monter"
              >
                ⬆️
              </button>
              <button
                v-if="sectionIndex < emailStore.sections.length - 1"
                @click.stop="moveSectionDown(sectionIndex)"
                class="p-1.5 text-gray-600 hover:bg-gray-200 rounded text-sm"
                title="Descendre"
              >
                ⬇️
              </button>
              <button
                @click.stop="deleteSection(section.id)"
                class="p-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                title="Supprimer section"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- Section Content: Colonnes -->
          <div class="p-4">
            <div class="grid gap-4" :style="{ gridTemplateColumns: getGridColumns(section.columns) }">
              <!-- Colonne -->
              <div
                v-for="(column, columnIndex) in section.columns"
                :key="column.id"
                class="min-h-[100px] rounded border-2 border-dashed transition-all"
                :class="{
                  'border-blue-400 bg-blue-50': isColumnSelected(section.id, column.id),
                  'border-gray-300 bg-gray-50': !isColumnSelected(section.id, column.id)
                }"
                @click.stop="selectColumn(section.id, column.id)"
              >
                <!-- Column header (optionnel) -->
                <div class="p-2 text-xs text-gray-500 border-b border-gray-200 bg-gray-100 flex justify-between items-center">
                  <span>Colonne {{ columnIndex + 1 }}</span>
                  <span class="text-gray-400">{{ column.width }}</span>
                </div>

                <!-- Composants dans la colonne -->
                <div class="p-2 space-y-2">
                  <!-- Drop zone si colonne vide -->
                  <div
                    v-if="column.components.length === 0"
                    class="h-20 flex items-center justify-center text-xs text-gray-400 border-2 border-dashed border-gray-300 rounded"
                    :class="{ 'bg-blue-100 border-blue-400': isDropTargetColumn(section.id, column.id, 0) }"
                    @drop="onDropComponent($event, section.id, column.id, 0)"
                    @dragover="onDragOverComponent($event, section.id, column.id, 0)"
                    @dragleave="onDragLeaveComponent"
                  >
                    ➕ Glisser un composant ici
                  </div>

                  <!-- Drop zone avant premier composant -->
                  <div
                    v-if="column.components.length > 0"
                    class="h-8 rounded border-2 border-dashed transition-all"
                    :class="isDropTargetColumn(section.id, column.id, 0) ? 'bg-blue-100 border-blue-400' : 'border-gray-200 opacity-0 hover:opacity-100'"
                    @drop="onDropComponent($event, section.id, column.id, 0)"
                    @dragover="onDragOverComponent($event, section.id, column.id, 0)"
                    @dragleave="onDragLeaveComponent"
                  >
                    <div class="h-full flex items-center justify-center text-xs text-gray-500">+</div>
                  </div>

                  <!-- Composant -->
                  <div
                    v-for="(component, componentIndex) in column.components"
                    :key="component.id"
                  >
                    <div
                      class="group/comp relative p-3 bg-white rounded border-2 transition-all"
                      :class="{
                        'border-blue-500 shadow-md': isComponentSelected(section.id, column.id, component.id),
                        'border-gray-200 hover:border-gray-300': !isComponentSelected(section.id, column.id, component.id)
                      }"
                      @click.stop="selectComponent(section.id, column.id, component.id)"
                    >
                      <!-- Drag handle composant -->
                      <div
                        class="absolute left-1 top-1/2 transform -translate-y-1/2 cursor-move opacity-0 group-hover/comp:opacity-100 transition-opacity"
                        draggable="true"
                        @dragstart="onComponentDragStart($event, section.id, column.id, componentIndex)"
                        @dragend="onComponentDragEnd"
                        @click.stop
                        title="Déplacer"
                      >
                        <div class="flex flex-col gap-0.5">
                          <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                          <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                        </div>
                      </div>

                      <!-- Contenu composant -->
                      <div class="ml-4 flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-gray-800">
                              {{ getComponentLabel(component.component) }}
                            </span>
                            <span class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {{ component.component }}
                            </span>
                          </div>
                          <!-- Preview props -->
                          <div class="mt-1 text-xs text-gray-500 truncate">
                            {{ getComponentPreview(component) }}
                          </div>
                        </div>

                        <!-- Actions composant -->
                        <div class="flex gap-0.5 opacity-0 group-hover/comp:opacity-100 transition-opacity">
                          <button
                            @click.stop="duplicateComponent(section.id, column.id, component.id)"
                            class="p-1 text-gray-600 hover:bg-gray-100 rounded text-xs"
                            title="Dupliquer"
                          >
                            📋
                          </button>
                          <button
                            @click.stop="deleteComponent(section.id, column.id, component.id)"
                            class="p-1 text-red-600 hover:bg-red-50 rounded text-xs"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Drop zone après le composant -->
                    <div
                      class="h-8 rounded border-2 border-dashed transition-all mt-2"
                      :class="isDropTargetColumn(section.id, column.id, componentIndex + 1) ? 'bg-blue-100 border-blue-400' : 'border-gray-200 opacity-0 hover:opacity-100'"
                      @drop="onDropComponent($event, section.id, column.id, componentIndex + 1)"
                      @dragover="onDragOverComponent($event, section.id, column.id, componentIndex + 1)"
                      @dragleave="onDragLeaveComponent"
                    >
                      <div class="h-full flex items-center justify-center text-xs text-gray-500">+</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Indicateur de sélection section -->
          <div
            v-if="isSectionSelected(section.id)"
            class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"
          ></div>
        </div>

        <!-- Zone de drop après chaque section -->
        <div
          class="h-12 rounded border-2 border-dashed transition-all"
          :class="dropTargetSection === emailStore.sections.length ? 'bg-blue-100 border-blue-400' : 'bg-gray-100 border-gray-300 opacity-50 hover:opacity-100'"
          @drop="onDropSection($event, emailStore.sections.length)"
          @dragover="onDragOverSection($event, emailStore.sections.length)"
          @dragleave="onDragLeaveSection"
        >
          <div class="h-full flex items-center justify-center text-xs text-gray-500">
            ➕ Déposer une section ici
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
const isDragOverCanvas = ref(false)
const dropTargetSection = ref(null)
const draggingSectionIndex = ref(null)
const draggingComponentInfo = ref(null) // { sectionId, columnId, componentIndex }
const dropTargetComponent = ref(null) // { sectionId, columnId, index }

// Computed
const components = computed(() => componentsComposable.components.value)

// Sélection
const isSectionSelected = (sectionId) => {
  return emailStore.selectedSectionId === sectionId && emailStore.selectedType === 'section'
}

const isColumnSelected = (sectionId, columnId) => {
  return emailStore.selectedSectionId === sectionId &&
         emailStore.selectedColumnId === columnId &&
         emailStore.selectedType === 'column'
}

const isComponentSelected = (sectionId, columnId, componentId) => {
  return emailStore.selectedSectionId === sectionId &&
         emailStore.selectedColumnId === columnId &&
         emailStore.selectedComponentId === componentId &&
         emailStore.selectedType === 'component'
}

const isDropTargetColumn = (sectionId, columnId, index) => {
  return dropTargetComponent.value?.sectionId === sectionId &&
         dropTargetComponent.value?.columnId === columnId &&
         dropTargetComponent.value?.index === index
}

const selectSection = (sectionId) => {
  emailStore.selectSection(sectionId)
}

const selectColumn = (sectionId, columnId) => {
  emailStore.selectColumn(sectionId, columnId)
}

const selectComponent = (sectionId, columnId, componentId) => {
  emailStore.selectComponent(sectionId, columnId, componentId)
}

// Helpers
const getComponentLabel = (componentName) => {
  const component = components.value.find(c => c.name === componentName)
  return component?.label || componentName
}

const getComponentPreview = (component) => {
  if (component.component === 'heading') {
    return `${component.props.level || 'h2'}: ${component.props.text || 'Titre'}`
  } else if (component.component === 'button') {
    return `${component.props.text || 'Bouton'} → ${component.props.url || '#'}`
  } else if (component.component === 'paragraph') {
    return component.props.text?.substring(0, 50) || 'Paragraphe...'
  } else if (component.component === 'image') {
    return component.props.alt || component.props.src || 'Image'
  } else if (component.component === 'spacer') {
    return `Espaceur: ${component.props.height || '20px'}`
  }
  return `${Object.keys(component.props).length} prop(s)`
}

const getGridColumns = (columns) => {
  // Convertir les largeurs en % vers fr pour CSS Grid
  // ex: ['50%', '50%'] → '1fr 1fr'
  // ex: ['33%', '66%'] → '1fr 2fr'
  return columns.map(col => {
    const width = col.width
    // Si c'est un pourcentage, convertir en fr
    if (width.endsWith('%')) {
      const percent = parseFloat(width)
      // Convertir en fraction (arrondir pour avoir des valeurs propres)
      // 50% → 1fr, 33% → 1fr, 66% → 2fr, etc.
      if (percent === 100) return '1fr'
      if (percent === 50) return '1fr'
      if (percent >= 65 && percent <= 67) return '2fr' // ~66%
      if (percent >= 32 && percent <= 34) return '1fr' // ~33%
      if (percent === 25) return '1fr'
      // Pour les autres cas, utiliser la proportion
      return `${Math.round(percent / 10)}fr`
    }
    // Sinon retourner tel quel (px, em, etc.)
    return width
  }).join(' ')
}

// Actions Sections
const deleteSection = (sectionId) => {
  if (confirm('Supprimer cette section et tous ses composants ?')) {
    emailStore.deleteSection(sectionId)
  }
}

const duplicateSection = (sectionId) => {
  emailStore.duplicateSection(sectionId)
}

const moveSectionUp = (index) => {
  if (index > 0) {
    emailStore.moveSection(index, index - 1)
  }
}

const moveSectionDown = (index) => {
  if (index < emailStore.sections.length - 1) {
    emailStore.moveSection(index, index + 1)
  }
}

// Actions Composants
const deleteComponent = (sectionId, columnId, componentId) => {
  if (confirm('Supprimer ce composant ?')) {
    emailStore.deleteComponent(sectionId, columnId, componentId)
  }
}

const duplicateComponent = (sectionId, columnId, componentId) => {
  emailStore.duplicateComponent(sectionId, columnId, componentId)
}

const clearAll = () => {
  if (confirm('Supprimer toutes les sections et composants ?')) {
    emailStore.resetEmail()
  }
}

// Drag & Drop - Canvas vide (sections seulement)
const onDragOverCanvas = (event) => {
  if (!emailStore.isEmpty) return

  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  isDragOverCanvas.value = true
}

const onDragLeaveCanvas = (event) => {
  if (!emailStore.isEmpty) return

  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragOverCanvas.value = false
  }
}

const onDropOnCanvas = async (event) => {
  if (!emailStore.isEmpty) return

  event.preventDefault()
  isDragOverCanvas.value = false

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'))

    if (data.type === 'sections' || data.category === 'sections') {
      console.log('📦 Dropping first section:', data.componentName)

      const defaults = await getDefaultPropsForComponent(data.componentName, data.category)

      emailStore.addSection(
        data.componentName,
        defaults,
        data.columnCount || 1,
        data.columnWidths || ['100%']
      )
    }
  } catch (err) {
    console.error('❌ Drop on canvas error:', err)
  }
}

// Drag & Drop - Sections
const onDragOverSection = (event, targetIndex) => {
  event.preventDefault()
  event.stopPropagation()

  event.dataTransfer.dropEffect = draggingSectionIndex.value !== null ? 'move' : 'copy'
  dropTargetSection.value = targetIndex
}

const onDragLeaveSection = () => {
  dropTargetSection.value = null
}

const onDropSection = async (event, targetIndex) => {
  event.preventDefault()
  event.stopPropagation()

  // Cas 1: Nouvelle section depuis ComponentLibrary
  try {
    const jsonData = event.dataTransfer.getData('application/json')
    if (jsonData) {
      const data = JSON.parse(jsonData)

      if (data.type === 'sections' || data.category === 'sections') {
        console.log('📦 Dropping section at index:', targetIndex, data.componentName)

        const defaults = await getDefaultPropsForComponent(data.componentName, data.category)

        emailStore.insertSectionAt(
          targetIndex,
          data.componentName,
          defaults,
          data.columnCount || 1,
          data.columnWidths || ['100%']
        )

        dropTargetSection.value = null
        return
      }
    }
  } catch (err) {
    console.log('Not a new section, checking for section reordering...')
  }

  // Cas 2: Réorganisation section existante
  if (draggingSectionIndex.value !== null) {
    const fromIndex = draggingSectionIndex.value
    let toIndex = targetIndex

    if (fromIndex < toIndex) {
      toIndex--
    }

    if (fromIndex !== toIndex) {
      console.log('🔄 Moving section from', fromIndex, 'to', toIndex)
      emailStore.moveSection(fromIndex, toIndex)
    }
  }

  dropTargetSection.value = null
  draggingSectionIndex.value = null
}

const onSectionDragStart = (event, index) => {
  draggingSectionIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index.toString())
  console.log('🎯 Section drag start:', index)
}

const onSectionDragEnd = () => {
  draggingSectionIndex.value = null
  dropTargetSection.value = null
  console.log('🎯 Section drag end')
}

// Drag & Drop - Composants
const onDragOverComponent = (event, sectionId, columnId, index) => {
  event.preventDefault()
  event.stopPropagation()

  event.dataTransfer.dropEffect = draggingComponentInfo.value ? 'move' : 'copy'
  dropTargetComponent.value = { sectionId, columnId, index }
}

const onDragLeaveComponent = () => {
  dropTargetComponent.value = null
}

const onDropComponent = async (event, sectionId, columnId, index) => {
  event.preventDefault()
  event.stopPropagation()

  // Cas 1: Nouveau composant depuis ComponentLibrary
  try {
    const jsonData = event.dataTransfer.getData('application/json')
    if (jsonData) {
      const data = JSON.parse(jsonData)

      if (data.type === 'content' || data.type === 'custom' || data.category === 'content' || data.category === 'custom') {
        console.log('📦 Dropping component at column:', sectionId, columnId, index, data.componentName)

        const defaults = await getDefaultPropsForComponent(data.componentName, data.category || data.type)

        emailStore.insertComponentAt(sectionId, columnId, index, data.componentName, defaults)

        dropTargetComponent.value = null
        return
      }
    }
  } catch (err) {
    console.log('Not a new component, checking for component reordering...')
  }

  // Cas 2: Réorganisation composant existant
  if (draggingComponentInfo.value) {
    const { sectionId: fromSectionId, columnId: fromColumnId, componentIndex: fromIndex } = draggingComponentInfo.value

    // Pour l'instant, on ne gère que le déplacement dans la même colonne
    if (fromSectionId === sectionId && fromColumnId === columnId) {
      let toIndex = index

      if (fromIndex < toIndex) {
        toIndex--
      }

      if (fromIndex !== toIndex) {
        console.log('🔄 Moving component within column from', fromIndex, 'to', toIndex)
        emailStore.moveComponentWithinColumn(sectionId, columnId, fromIndex, toIndex)
      }
    } else {
      // TODO: Déplacement entre colonnes différentes
      console.warn('⚠️ Moving components between columns not yet implemented')
    }
  }

  dropTargetComponent.value = null
  draggingComponentInfo.value = null
}

const onComponentDragStart = (event, sectionId, columnId, componentIndex) => {
  draggingComponentInfo.value = { sectionId, columnId, componentIndex }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', componentIndex.toString())
  console.log('🎯 Component drag start:', { sectionId, columnId, componentIndex })
}

const onComponentDragEnd = () => {
  draggingComponentInfo.value = null
  dropTargetComponent.value = null
  console.log('🎯 Component drag end')
}

// Helper pour charger les props par défaut
const getDefaultPropsForComponent = async (componentName, category) => {
  try {
    const schema = await componentsComposable.loadComponentSchema(componentName, category)

    const defaults = {}
    if (schema?.configurableProperties) {
      Object.values(schema.configurableProperties).forEach(section => {
        Object.entries(section).forEach(([propName, propConfig]) => {
          if (propConfig.default !== undefined) {
            defaults[propName] = propConfig.default
          }
        })
      })
    }

    return defaults
  } catch (err) {
    console.error('❌ Failed to load defaults for', componentName, err)
    return {}
  }
}
</script>

<style scoped>
.group,
.group\/comp {
  transition: all 0.2s ease;
}
</style>
