import { defineStore } from 'pinia'

/**
 * Email Store - Gestion de l'état de l'email en cours d'édition
 * Structure hiérarchique: Sections → Colonnes → Composants
 */
export const useEmailStore = defineStore('email', {
  state: () => ({
    // Metadata de l'email
    metadata: {
      title: 'Untitled Email',
      subject: '',
      preheader: '',
      designSystemId: 'demo'
    },

    // Sections de l'email (structure hiérarchique)
    sections: [],

    // Sélection multi-niveau
    selectedSectionId: null,
    selectedColumnId: null,
    selectedComponentId: null,
    selectedType: null, // 'section' | 'column' | 'component'

    // UI state
    previewDevice: 'desktop', // 'desktop' | 'mobile'
    isRendering: false,
    lastRenderTime: 0,

    // Design System chargé
    designSystem: null,

    // Composants disponibles
    availableComponents: []
  }),

  getters: {
    /**
     * Retourne la section sélectionnée
     */
    selectedSection(state) {
      if (!state.selectedSectionId) return null
      return state.sections.find(s => s.id === state.selectedSectionId)
    },

    /**
     * Retourne la colonne sélectionnée
     */
    selectedColumn(state) {
      if (!state.selectedSectionId || !state.selectedColumnId) return null
      const section = state.sections.find(s => s.id === state.selectedSectionId)
      if (!section) return null
      return section.columns.find(c => c.id === state.selectedColumnId)
    },

    /**
     * Retourne le composant sélectionné
     */
    selectedComponent(state) {
      if (!state.selectedSectionId || !state.selectedColumnId || !state.selectedComponentId) return null
      const section = state.sections.find(s => s.id === state.selectedSectionId)
      if (!section) return null
      const column = section.columns.find(c => c.id === state.selectedColumnId)
      if (!column) return null
      return column.components.find(comp => comp.id === state.selectedComponentId)
    },

    /**
     * Retourne l'élément sélectionné (section, column ou component)
     */
    selectedElement(state) {
      if (state.selectedType === 'section') {
        return this.selectedSection
      } else if (state.selectedType === 'column') {
        return this.selectedColumn
      } else if (state.selectedType === 'component') {
        return this.selectedComponent
      }
      return null
    },

    /**
     * Retourne l'email au format JSON pour l'API
     */
    emailJSON(state) {
      return {
        metadata: state.metadata,
        sections: state.sections
      }
    },

    /**
     * Indique si l'email est vide
     */
    isEmpty(state) {
      return state.sections.length === 0
    },

    /**
     * Retourne le nombre de sections
     */
    sectionCount(state) {
      return state.sections.length
    },

    /**
     * Retourne le nombre total de composants (tous les composants de toutes les colonnes)
     */
    totalComponentCount(state) {
      let count = 0
      state.sections.forEach(section => {
        section.columns.forEach(column => {
          count += column.components.length
        })
      })
      return count
    }
  },

  actions: {
    // ============================================
    // ACTIONS SECTIONS
    // ============================================

    /**
     * Ajoute une section à la fin de l'email
     * @param {string} componentName - Nom du composant section (ex: 'section-1col')
     * @param {object} props - Props de la section
     * @param {number} columnCount - Nombre de colonnes
     * @param {array} columnWidths - Largeurs des colonnes (ex: ['100%'] ou ['50%', '50%'])
     */
    addSection(componentName, props = {}, columnCount = 1, columnWidths = ['100%']) {
      const sectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Créer les colonnes
      const columns = []
      for (let i = 0; i < columnCount; i++) {
        columns.push({
          id: `col-${sectionId}-${i}`,
          width: columnWidths[i] || '100%',
          props: {
            padding: '0',
            backgroundColor: 'transparent',
            align: 'left',
            verticalAlign: 'top'
          },
          components: []
        })
      }

      const section = {
        id: sectionId,
        component: componentName,
        props: { ...props },
        columns
      }

      this.sections.push(section)
      this.selectSection(sectionId)

      console.log('✅ Section added:', sectionId, componentName, `${columnCount} columns`)
    },

    /**
     * Insère une section à un index spécifique
     */
    insertSectionAt(index, componentName, props = {}, columnCount = 1, columnWidths = ['100%']) {
      const sectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const columns = []
      for (let i = 0; i < columnCount; i++) {
        columns.push({
          id: `col-${sectionId}-${i}`,
          width: columnWidths[i] || '100%',
          props: {
            padding: '0',
            backgroundColor: 'transparent',
            align: 'left',
            verticalAlign: 'top'
          },
          components: []
        })
      }

      const section = {
        id: sectionId,
        component: componentName,
        props: { ...props },
        columns
      }

      this.sections.splice(index, 0, section)
      this.selectSection(sectionId)

      console.log('✅ Section inserted at', index, ':', sectionId)
    },

    /**
     * Supprime une section
     */
    deleteSection(sectionId) {
      const index = this.sections.findIndex(s => s.id === sectionId)
      if (index !== -1) {
        this.sections.splice(index, 1)

        if (this.selectedSectionId === sectionId) {
          this.deselectAll()
        }

        console.log('✅ Section deleted:', sectionId)
      } else {
        console.warn('⚠️ Section not found:', sectionId)
      }
    },

    /**
     * Met à jour les props d'une section
     */
    updateSectionProps(sectionId, props) {
      const section = this.sections.find(s => s.id === sectionId)
      if (section) {
        Object.assign(section.props, props)
        console.log('✅ Section props updated:', sectionId)
      } else {
        console.warn('⚠️ Section not found:', sectionId)
      }
    },

    /**
     * Déplace une section (vers le haut ou le bas)
     */
    moveSection(fromIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= this.sections.length) {
        console.warn('⚠️ Invalid fromIndex:', fromIndex)
        return
      }

      if (toIndex < 0 || toIndex >= this.sections.length) {
        console.warn('⚠️ Invalid toIndex:', toIndex)
        return
      }

      if (fromIndex === toIndex) {
        console.warn('⚠️ Cannot move section to same position:', fromIndex)
        return
      }

      const [section] = this.sections.splice(fromIndex, 1)
      this.sections.splice(toIndex, 0, section)

      console.log('✅ Section moved from', fromIndex, 'to', toIndex)
    },

    /**
     * Duplique une section
     */
    duplicateSection(sectionId) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Deep clone avec nouveaux IDs
      const duplicatedSection = {
        id: newSectionId,
        component: section.component,
        props: { ...section.props },
        columns: section.columns.map((col, idx) => ({
          id: `col-${newSectionId}-${idx}`,
          width: col.width,
          props: { ...col.props },
          components: col.components.map(comp => ({
            id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            component: comp.component,
            props: { ...comp.props }
          }))
        }))
      }

      const index = this.sections.findIndex(s => s.id === sectionId)
      this.sections.splice(index + 1, 0, duplicatedSection)
      this.selectSection(newSectionId)

      console.log('✅ Section duplicated:', sectionId, '→', newSectionId)
    },

    // ============================================
    // ACTIONS COLONNES
    // ============================================

    /**
     * Met à jour les props d'une colonne
     */
    updateColumnProps(sectionId, columnId, props) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      Object.assign(column.props, props)
      console.log('✅ Column props updated:', columnId)
    },

    // ============================================
    // ACTIONS COMPOSANTS
    // ============================================

    /**
     * Ajoute un composant à une colonne
     */
    addComponentToColumn(sectionId, columnId, componentName, props = {}) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      const componentId = `comp-${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const component = {
        id: componentId,
        component: componentName,
        props: { ...props }
      }

      column.components.push(component)
      this.selectComponent(sectionId, columnId, componentId)

      console.log('✅ Component added to column:', componentId, componentName)
    },

    /**
     * Insère un composant à un index spécifique dans une colonne
     */
    insertComponentAt(sectionId, columnId, index, componentName, props = {}) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      const componentId = `comp-${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const component = {
        id: componentId,
        component: componentName,
        props: { ...props }
      }

      column.components.splice(index, 0, component)
      this.selectComponent(sectionId, columnId, componentId)

      console.log('✅ Component inserted at', index, 'in column:', componentId)
    },

    /**
     * Supprime un composant
     */
    deleteComponent(sectionId, columnId, componentId) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      const index = column.components.findIndex(comp => comp.id === componentId)
      if (index !== -1) {
        column.components.splice(index, 1)

        if (this.selectedComponentId === componentId) {
          this.deselectAll()
        }

        console.log('✅ Component deleted:', componentId)
      } else {
        console.warn('⚠️ Component not found:', componentId)
      }
    },

    /**
     * Met à jour les props d'un composant
     */
    updateComponentProps(sectionId, columnId, componentId, props) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      const component = column.components.find(comp => comp.id === componentId)
      if (!component) {
        console.warn('⚠️ Component not found:', componentId)
        return
      }

      Object.assign(component.props, props)
      console.log('✅ Component props updated:', componentId)
    },

    /**
     * Déplace un composant dans la même colonne
     */
    moveComponentWithinColumn(sectionId, columnId, fromIndex, toIndex) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      if (fromIndex < 0 || fromIndex >= column.components.length) {
        console.warn('⚠️ Invalid fromIndex:', fromIndex)
        return
      }

      if (toIndex < 0 || toIndex >= column.components.length) {
        console.warn('⚠️ Invalid toIndex:', toIndex)
        return
      }

      if (fromIndex === toIndex) {
        return
      }

      const [component] = column.components.splice(fromIndex, 1)
      column.components.splice(toIndex, 0, component)

      console.log('✅ Component moved within column from', fromIndex, 'to', toIndex)
    },

    /**
     * Duplique un composant
     */
    duplicateComponent(sectionId, columnId, componentId) {
      const section = this.sections.find(s => s.id === sectionId)
      if (!section) {
        console.warn('⚠️ Section not found:', sectionId)
        return
      }

      const column = section.columns.find(c => c.id === columnId)
      if (!column) {
        console.warn('⚠️ Column not found:', columnId)
        return
      }

      const component = column.components.find(comp => comp.id === componentId)
      if (!component) {
        console.warn('⚠️ Component not found:', componentId)
        return
      }

      const newComponentId = `comp-${component.component}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const duplicatedComponent = {
        id: newComponentId,
        component: component.component,
        props: { ...component.props }
      }

      const index = column.components.findIndex(comp => comp.id === componentId)
      column.components.splice(index + 1, 0, duplicatedComponent)
      this.selectComponent(sectionId, columnId, newComponentId)

      console.log('✅ Component duplicated:', componentId, '→', newComponentId)
    },

    // ============================================
    // SÉLECTION
    // ============================================

    /**
     * Sélectionne une section
     */
    selectSection(sectionId) {
      this.selectedSectionId = sectionId
      this.selectedColumnId = null
      this.selectedComponentId = null
      this.selectedType = 'section'
      console.log('👆 Section selected:', sectionId)
    },

    /**
     * Sélectionne une colonne
     */
    selectColumn(sectionId, columnId) {
      this.selectedSectionId = sectionId
      this.selectedColumnId = columnId
      this.selectedComponentId = null
      this.selectedType = 'column'
      console.log('👆 Column selected:', columnId)
    },

    /**
     * Sélectionne un composant
     */
    selectComponent(sectionId, columnId, componentId) {
      this.selectedSectionId = sectionId
      this.selectedColumnId = columnId
      this.selectedComponentId = componentId
      this.selectedType = 'component'
      console.log('👆 Component selected:', componentId)
    },

    /**
     * Désélectionne tout
     */
    deselectAll() {
      this.selectedSectionId = null
      this.selectedColumnId = null
      this.selectedComponentId = null
      this.selectedType = null
      console.log('👆 Deselected all')
    },

    // ============================================
    // EMAIL GLOBAL
    // ============================================

    /**
     * Charge un email depuis JSON
     */
    loadEmail(emailData) {
      if (emailData.metadata) {
        this.metadata = { ...emailData.metadata }
      }

      if (emailData.sections) {
        this.sections = JSON.parse(JSON.stringify(emailData.sections))
      }

      this.deselectAll()

      console.log('✅ Email loaded:', this.sections.length, 'sections')
    },

    /**
     * Réinitialise l'email
     */
    resetEmail() {
      this.metadata = {
        title: 'Untitled Email',
        subject: '',
        preheader: '',
        designSystemId: 'demo'
      }
      this.sections = []
      this.deselectAll()

      console.log('✅ Email reset')
    },

    /**
     * Met à jour les metadata
     */
    updateMetadata(metadata) {
      Object.assign(this.metadata, metadata)
      console.log('✅ Metadata updated')
    },

    /**
     * Change le Design System
     */
    changeDesignSystem(designSystemId) {
      this.metadata.designSystemId = designSystemId
      console.log('✅ Design System changed to:', designSystemId)
    },

    /**
     * Change le device de preview
     */
    setPreviewDevice(device) {
      this.previewDevice = device
      console.log('📱 Preview device:', device)
    },

    /**
     * Définit l'état de rendering
     */
    setRendering(isRendering) {
      this.isRendering = isRendering
    },

    /**
     * Définit le temps de dernier render
     */
    setLastRenderTime(time) {
      this.lastRenderTime = time
    },

    /**
     * Charge le Design System
     */
    setDesignSystem(designSystem) {
      this.designSystem = designSystem
      console.log('✅ Design System loaded:', designSystem?.id)
    },

    /**
     * Charge la liste des composants disponibles
     */
    setAvailableComponents(components) {
      this.availableComponents = components
      console.log('✅ Components loaded:', components.length)
    }
  }
})
