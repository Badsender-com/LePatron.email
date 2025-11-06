import { defineStore } from 'pinia'

/**
 * Email Store - Gestion de l'état de l'email en cours d'édition
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

    // Blocs de l'email (flat structure)
    blocks: [],

    // ID du bloc sélectionné
    selectedBlockId: null,

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
     * Retourne le bloc sélectionné
     */
    selectedBlock(state) {
      if (!state.selectedBlockId) return null
      return state.blocks.find(block => block.id === state.selectedBlockId)
    },

    /**
     * Retourne l'email au format JSON pour l'API
     */
    emailJSON(state) {
      return {
        metadata: state.metadata,
        blocks: state.blocks
      }
    },

    /**
     * Indique si l'email est vide
     */
    isEmpty(state) {
      return state.blocks.length === 0
    },

    /**
     * Retourne le nombre de blocs
     */
    blockCount(state) {
      return state.blocks.length
    }
  },

  actions: {
    /**
     * Ajoute un bloc à la fin de l'email
     * @param {string} componentName - Nom du composant (ex: 'button')
     * @param {object} props - Props initiales (optionnel, sinon defaults du Design System)
     */
    addBlock(componentName, props = {}) {
      const blockId = `block-${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const block = {
        id: blockId,
        component: componentName,
        props: { ...props }
      }

      this.blocks.push(block)
      this.selectBlock(blockId)

      console.log('✅ Block added:', blockId, componentName)
    },

    /**
     * Insère un bloc à un index spécifique
     * @param {number} index - Position d'insertion
     * @param {string} componentName - Nom du composant
     * @param {object} props - Props initiales
     */
    insertBlockAt(index, componentName, props = {}) {
      const blockId = `block-${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const block = {
        id: blockId,
        component: componentName,
        props: { ...props }
      }

      this.blocks.splice(index, 0, block)
      this.selectBlock(blockId)

      console.log('✅ Block inserted at', index, ':', blockId, componentName)
    },

    /**
     * Met à jour les props d'un bloc
     * @param {string} blockId - ID du bloc
     * @param {object} props - Props à mettre à jour (merge)
     */
    updateBlockProps(blockId, props) {
      const block = this.blocks.find(b => b.id === blockId)
      if (block) {
        Object.assign(block.props, props)
        console.log('✅ Block props updated:', blockId)
      } else {
        console.warn('⚠️ Block not found:', blockId)
      }
    },

    /**
     * Remplace complètement les props d'un bloc
     * @param {string} blockId - ID du bloc
     * @param {object} props - Nouvelles props
     */
    replaceBlockProps(blockId, props) {
      const block = this.blocks.find(b => b.id === blockId)
      if (block) {
        block.props = { ...props }
        console.log('✅ Block props replaced:', blockId)
      } else {
        console.warn('⚠️ Block not found:', blockId)
      }
    },

    /**
     * Supprime un bloc
     * @param {string} blockId - ID du bloc à supprimer
     */
    deleteBlock(blockId) {
      const index = this.blocks.findIndex(b => b.id === blockId)
      if (index !== -1) {
        this.blocks.splice(index, 1)

        // Désélectionner si c'était le bloc sélectionné
        if (this.selectedBlockId === blockId) {
          this.selectedBlockId = null
        }

        console.log('✅ Block deleted:', blockId)
      } else {
        console.warn('⚠️ Block not found:', blockId)
      }
    },

    /**
     * Sélectionne un bloc
     * @param {string} blockId - ID du bloc à sélectionner
     */
    selectBlock(blockId) {
      this.selectedBlockId = blockId
      console.log('👆 Block selected:', blockId)
    },

    /**
     * Désélectionne le bloc courant
     */
    deselectBlock() {
      this.selectedBlockId = null
      console.log('👆 Block deselected')
    },

    /**
     * Déplace un bloc d'un index à un autre
     * @param {number} fromIndex - Index source
     * @param {number} toIndex - Index destination
     */
    moveBlock(fromIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= this.blocks.length) {
        console.warn('⚠️ Invalid fromIndex:', fromIndex)
        return
      }

      if (toIndex < 0 || toIndex >= this.blocks.length) {
        console.warn('⚠️ Invalid toIndex:', toIndex)
        return
      }

      const [block] = this.blocks.splice(fromIndex, 1)
      this.blocks.splice(toIndex, 0, block)

      console.log('✅ Block moved from', fromIndex, 'to', toIndex)
    },

    /**
     * Duplique un bloc
     * @param {string} blockId - ID du bloc à dupliquer
     */
    duplicateBlock(blockId) {
      const block = this.blocks.find(b => b.id === blockId)
      if (!block) {
        console.warn('⚠️ Block not found:', blockId)
        return
      }

      const newBlockId = `block-${block.component}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const duplicatedBlock = {
        id: newBlockId,
        component: block.component,
        props: { ...block.props }
      }

      const index = this.blocks.findIndex(b => b.id === blockId)
      this.blocks.splice(index + 1, 0, duplicatedBlock)
      this.selectBlock(newBlockId)

      console.log('✅ Block duplicated:', blockId, '→', newBlockId)
    },

    /**
     * Charge un email depuis JSON
     * @param {object} emailData - Email au format JSON
     */
    loadEmail(emailData) {
      if (emailData.metadata) {
        this.metadata = { ...emailData.metadata }
      }

      if (emailData.blocks) {
        this.blocks = JSON.parse(JSON.stringify(emailData.blocks))
      }

      this.selectedBlockId = null

      console.log('✅ Email loaded:', this.blocks.length, 'blocks')
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
      this.blocks = []
      this.selectedBlockId = null

      console.log('✅ Email reset')
    },

    /**
     * Met à jour les metadata
     * @param {object} metadata - Metadata à mettre à jour
     */
    updateMetadata(metadata) {
      Object.assign(this.metadata, metadata)
      console.log('✅ Metadata updated')
    },

    /**
     * Change le Design System
     * @param {string} designSystemId - ID du Design System
     */
    changeDesignSystem(designSystemId) {
      this.metadata.designSystemId = designSystemId
      console.log('✅ Design System changed to:', designSystemId)
    },

    /**
     * Change le device de preview
     * @param {string} device - 'desktop' | 'mobile'
     */
    setPreviewDevice(device) {
      this.previewDevice = device
      console.log('📱 Preview device:', device)
    },

    /**
     * Définit l'état de rendering
     * @param {boolean} isRendering - État
     */
    setRendering(isRendering) {
      this.isRendering = isRendering
    },

    /**
     * Définit le temps de dernier render
     * @param {number} time - Temps en ms
     */
    setLastRenderTime(time) {
      this.lastRenderTime = time
    },

    /**
     * Charge le Design System
     * @param {object} designSystem - Design System chargé
     */
    setDesignSystem(designSystem) {
      this.designSystem = designSystem
      console.log('✅ Design System loaded:', designSystem?.id)
    },

    /**
     * Charge la liste des composants disponibles
     * @param {array} components - Liste des composants
     */
    setAvailableComponents(components) {
      this.availableComponents = components
      console.log('✅ Components loaded:', components.length)
    }
  }
})
