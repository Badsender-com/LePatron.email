<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="p-4 border-b bg-white">
      <h2 class="font-bold text-lg text-gray-800">Configuration</h2>
      <div v-if="selectedElement" class="mt-2">
        <!-- Breadcrumb -->
        <div class="text-xs text-gray-400 mb-1">
          {{ getBreadcrumb() }}
        </div>
        <!-- Element label -->
        <p class="text-sm font-medium text-gray-700">
          {{ getElementLabel() }}
        </p>
      </div>
    </div>

    <!-- Aucun élément sélectionné -->
    <div
      v-if="!selectedElement"
      class="flex-1 flex items-center justify-center text-center text-gray-400 p-4"
    >
      <div>
        <div class="text-6xl mb-4">⚙️</div>
        <p class="text-lg font-medium">Aucun élément sélectionné</p>
        <p class="text-sm mt-2">
          Cliquez sur une section, colonne ou composant<br />dans le Canvas pour éditer ses propriétés
        </p>
      </div>
    </div>

    <!-- Loading schema -->
    <div
      v-else-if="isLoadingSchema"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p class="mt-2 text-sm text-gray-500">Chargement du schéma...</p>
      </div>
    </div>

    <!-- Formulaire de configuration -->
    <div v-else-if="schema" class="flex-1 overflow-y-auto p-4">
      <!-- Sections du schema -->
      <div
        v-for="(sectionProps, sectionName) in schema.configurableProperties"
        :key="sectionName"
        class="mb-6"
      >
        <h3 class="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b">
          {{ getSectionLabel(sectionName) }}
        </h3>

        <!-- Champs de la section -->
        <div class="space-y-4">
          <div
            v-for="(propConfig, propName) in sectionProps"
            :key="propName"
          >
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              {{ propConfig.label }}
              <span v-if="propConfig.required" class="text-red-500">*</span>
            </label>

            <!-- String input -->
            <input
              v-if="propConfig.type === 'string'"
              v-model="selectedElement.props[propName]"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :placeholder="propConfig.placeholder || propConfig.label"
              :required="propConfig.required"
              @input="onPropChange"
            />

            <!-- URL input -->
            <input
              v-else-if="propConfig.type === 'url'"
              v-model="selectedElement.props[propName]"
              type="url"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :placeholder="propConfig.placeholder || 'https://example.com'"
              :required="propConfig.required"
              @input="onPropChange"
            />

            <!-- Color picker -->
            <div v-else-if="propConfig.type === 'color'" class="flex gap-2">
              <input
                v-model="selectedElement.props[propName]"
                type="color"
                class="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                @input="onPropChange"
              />
              <input
                v-model="selectedElement.props[propName]"
                type="text"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="#000000"
                @input="onPropChange"
              />
            </div>

            <!-- Slider -->
            <div v-else-if="propConfig.type === 'slider'">
              <input
                v-model.number="selectedElement.props[propName]"
                type="range"
                :min="propConfig.min || 0"
                :max="propConfig.max || 100"
                :step="propConfig.step || 1"
                class="w-full"
                @input="onPropChange"
              />
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>{{ propConfig.min || 0 }}{{ propConfig.unit || '' }}</span>
                <span class="font-semibold text-gray-700">
                  {{ selectedElement.props[propName] }}{{ propConfig.unit || '' }}
                </span>
                <span>{{ propConfig.max || 100 }}{{ propConfig.unit || '' }}</span>
              </div>
            </div>

            <!-- Toggle/Checkbox -->
            <label
              v-else-if="propConfig.type === 'toggle' || propConfig.type === 'checkbox'"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                v-model="selectedElement.props[propName]"
                type="checkbox"
                class="w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                @change="onPropChange"
              />
              <span class="text-sm text-gray-700">{{ propConfig.label }}</span>
            </label>

            <!-- Select dropdown -->
            <select
              v-else-if="propConfig.type === 'select'"
              v-model="selectedElement.props[propName]"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              @change="onPropChange"
            >
              <option
                v-for="option in propConfig.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- Button group -->
            <div
              v-else-if="propConfig.type === 'button-group'"
              class="flex gap-2"
            >
              <button
                v-for="option in propConfig.options"
                :key="option.value"
                @click="setButtonGroupValue(propName, option.value)"
                class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                :class="selectedElement.props[propName] === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                <span v-if="option.icon">{{ option.icon }} </span>
                {{ option.label }}
              </button>
            </div>

            <!-- Textarea -->
            <textarea
              v-else-if="propConfig.type === 'textarea'"
              v-model="selectedElement.props[propName]"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              :placeholder="propConfig.placeholder || propConfig.label"
              @input="onPropChange"
            ></textarea>

            <!-- Description/help text -->
            <p v-if="propConfig.description" class="mt-1 text-xs text-gray-500">
              {{ propConfig.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer avec actions -->
    <div v-if="selectedElement" class="p-4 border-t bg-white">
      <div class="flex gap-2">
        <button
          @click="resetToDefaults"
          class="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          🔄 Réinitialiser
        </button>
        <button
          v-if="canDuplicate"
          @click="duplicateSelectedElement"
          class="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          📋 Dupliquer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useEmailStore } from '../stores/email'
import { useComponents } from '../composables/useComponents'

const emailStore = useEmailStore()
const componentsComposable = useComponents()

// État local
const schema = ref(null)
const isLoadingSchema = ref(false)

// Computed
const selectedElement = computed(() => {
  if (emailStore.selectedType === 'section') return emailStore.selectedSection
  if (emailStore.selectedType === 'column') return emailStore.selectedColumn
  if (emailStore.selectedType === 'component') return emailStore.selectedComponent
  return null
})

const canDuplicate = computed(() => {
  // Sections and components can be duplicated, but not columns (for now)
  return emailStore.selectedType === 'section' || emailStore.selectedType === 'component'
})

const components = computed(() => componentsComposable.components.value)

// Méthodes
const getComponentLabel = (componentName) => {
  const component = components.value.find(c => c.name === componentName)
  return component?.label || componentName
}

const getElementLabel = () => {
  if (!selectedElement.value) return ''

  if (emailStore.selectedType === 'section') {
    return getComponentLabel(selectedElement.value.component)
  } else if (emailStore.selectedType === 'column') {
    // Find column index
    const section = emailStore.selectedSection
    if (!section) return 'Colonne'
    const columnIndex = section.columns.findIndex(c => c.id === emailStore.selectedColumnId)
    return `Colonne ${columnIndex + 1} (${selectedElement.value.width})`
  } else if (emailStore.selectedType === 'component') {
    return getComponentLabel(selectedElement.value.component)
  }
  return ''
}

const getBreadcrumb = () => {
  const parts = []

  if (emailStore.selectedSectionId) {
    const section = emailStore.selectedSection
    if (section) {
      const sectionIndex = emailStore.sections.findIndex(s => s.id === emailStore.selectedSectionId)
      parts.push(`Section ${sectionIndex + 1}`)
    }
  }

  if (emailStore.selectedColumnId) {
    const section = emailStore.selectedSection
    if (section) {
      const columnIndex = section.columns.findIndex(c => c.id === emailStore.selectedColumnId)
      parts.push(`Colonne ${columnIndex + 1}`)
    }
  }

  if (emailStore.selectedComponentId && emailStore.selectedType === 'component') {
    // Don't add component to breadcrumb, it's shown in the element label
  }

  return parts.join(' > ')
}

const getSectionLabel = (sectionName) => {
  const labels = {
    content: 'Contenu',
    style: 'Style',
    layout: 'Disposition',
    advanced: 'Avancé'
  }
  return labels[sectionName] || sectionName
}

const loadSchema = async () => {
  if (!selectedElement.value) {
    schema.value = null
    return
  }

  isLoadingSchema.value = true

  try {
    if (emailStore.selectedType === 'section') {
      // Load section schema
      const componentName = selectedElement.value.component
      schema.value = await componentsComposable.loadComponentSchema(componentName, 'sections')
    } else if (emailStore.selectedType === 'column') {
      // Load column schema from components.json
      const response = await fetch('/api/v2/components/schema/columns')
      const data = await response.json()
      schema.value = data.schema || data.component?.schema || data
    } else if (emailStore.selectedType === 'component') {
      // Load component schema - need to determine category
      const componentName = selectedElement.value.component
      // Try content first, then custom
      try {
        schema.value = await componentsComposable.loadComponentSchema(componentName, 'content')
      } catch (err) {
        try {
          schema.value = await componentsComposable.loadComponentSchema(componentName, 'custom')
        } catch (err2) {
          console.error('Failed to load component schema:', err2)
          schema.value = null
        }
      }
    }
  } catch (err) {
    console.error('Failed to load schema:', err)
    schema.value = null
  } finally {
    isLoadingSchema.value = false
  }
}

const onPropChange = () => {
  // Les props sont déjà mis à jour par v-model
  // Le watch du store déclenchera le re-render automatiquement
  console.log('✏️ Props changed')
}

const setButtonGroupValue = (propName, value) => {
  selectedElement.value.props[propName] = value
  onPropChange()
}

const resetToDefaults = async () => {
  if (!selectedElement.value) return

  if (confirm('Réinitialiser les propriétés aux valeurs par défaut ?')) {
    try {
      let defaults = {}

      if (emailStore.selectedType === 'section') {
        defaults = await componentsComposable.getDefaultProps(selectedElement.value.component, 'sections')
        emailStore.updateSectionProps(emailStore.selectedSectionId, defaults)
      } else if (emailStore.selectedType === 'column') {
        // Column default props
        defaults = {
          padding: '0',
          backgroundColor: 'transparent',
          align: 'left',
          verticalAlign: 'top'
        }
        emailStore.updateColumnProps(emailStore.selectedSectionId, emailStore.selectedColumnId, defaults)
      } else if (emailStore.selectedType === 'component') {
        // Determine category
        let category = 'content'
        try {
          await componentsComposable.loadComponentSchema(selectedElement.value.component, 'content')
        } catch {
          category = 'custom'
        }
        defaults = await componentsComposable.getDefaultProps(selectedElement.value.component, category)
        emailStore.updateComponentProps(
          emailStore.selectedSectionId,
          emailStore.selectedColumnId,
          emailStore.selectedComponentId,
          defaults
        )
      }

      console.log('✅ Props reset to defaults')
    } catch (err) {
      console.error('Failed to reset props:', err)
    }
  }
}

const duplicateSelectedElement = () => {
  if (!selectedElement.value) return

  if (emailStore.selectedType === 'section') {
    emailStore.duplicateSection(emailStore.selectedSectionId)
  } else if (emailStore.selectedType === 'component') {
    emailStore.duplicateComponent(
      emailStore.selectedSectionId,
      emailStore.selectedColumnId,
      emailStore.selectedComponentId
    )
  }
}

// Watchers
watch(selectedElement, async (newElement) => {
  if (newElement) {
    await loadSchema()
  } else {
    schema.value = null
  }
}, { immediate: true })

// Also watch selectedType to reload schema when switching between section/column/component
watch(() => emailStore.selectedType, async () => {
  await loadSchema()
})
</script>

<style scoped>
/* Custom styles pour les inputs */
input[type="range"] {
  accent-color: #3b82f6;
}
</style>
