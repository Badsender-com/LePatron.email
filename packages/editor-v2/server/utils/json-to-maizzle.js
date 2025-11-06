import designSystemService from '../services/design-system.service.js'

/**
 * Transforme le format Email JSON en template Maizzle complet
 */
export async function jsonToMaizzle(emailData, renderService) {
  const { metadata = {}, blocks = [] } = emailData

  // Charger le Design System si spécifié
  let designSystem = null
  if (metadata.designSystemId) {
    try {
      designSystem = await designSystemService.load(metadata.designSystemId)
    } catch (err) {
      console.warn(`Design System "${metadata.designSystemId}" not found, using defaults`)
    }
  }

  // Résoudre les props de chaque block avec les valeurs du Design System
  const resolvedBlocks = blocks.map(block => {
    const resolvedProps = resolvePropsWithDesignSystem(block.props, designSystem)
    // Ajouter valeurs par défaut pour les props communes
    return {
      ...block,
      props: applyDefaults(resolvedProps, block.component),
    }
  })

  // Construire le HTML de chaque block
  const blocksHtml = await Promise.all(
    resolvedBlocks.map(async (block) => {
      try {
        // Charger le template du composant
        const template = await renderService.loadComponentTemplate(block.component)

        // Rendre le composant avec les props
        const componentHtml = renderComponentTemplate(template, block.props, block.id)

        return componentHtml
      } catch (err) {
        console.error(`Error rendering block ${block.id}:`, err)
        return `<!-- Error rendering block ${block.id}: ${err.message} -->`
      }
    })
  )

  // Construire le template Maizzle complet
  const maizzleTemplate = buildMaizzleTemplate(metadata, blocksHtml.join('\n'))

  return maizzleTemplate
}

/**
 * Applique les valeurs par défaut selon le composant
 */
function applyDefaults(props, componentName) {
  const defaults = {
    button: {
      text: 'Click me',
      url: '#',
      backgroundColor: '#007bff',
      textColor: '#ffffff',
      borderRadius: '4px',
      padding: '12px 24px',
      align: 'left',
    },
    heading: {
      text: 'Titre par défaut',
      level: 'h2',
      textColor: '#333333',
      fontSize: '24px',
      fontWeight: 'bold',
      align: 'left',
      lineHeight: '1.3',
      marginTop: '16px',
      marginBottom: '16px',
    },
    container: {
      backgroundColor: '#ffffff',
      padding: '16px',
      borderWidth: '0',
      borderColor: '#dddddd',
      borderStyle: 'solid',
      borderRadius: '0',
      maxWidth: '600px',
      align: 'center',
      content: '<p style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; color: #666666;">Contenu</p>',
    },
  }

  return { ...defaults[componentName] || {}, ...props }
}

/**
 * Rend un template de composant en remplaçant les variables
 */
function renderComponentTemplate(template, props, blockId) {
  let result = template

  // Ajouter blockId aux props
  const finalProps = { ...props, blockId }

  // Évaluer les conditionnels AVANT de remplacer les variables
  result = evaluateBasicConditionals(result, finalProps)

  // IMPORTANT : Traiter les triple curly braces {{{ }}} EN PREMIER
  // pour éviter que le nettoyage des {{ }} ne les casse
  result = result.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (match, varName) => {
    const value = finalProps[varName.trim()]
    return value !== undefined ? String(value) : ''
  })

  // Remplacer les variables {{ propName }}
  Object.keys(finalProps).forEach(key => {
    let value = finalProps[key]

    // Gérer les valeurs undefined/null
    if (value === undefined || value === null) {
      value = ''
    }

    // Échapper le HTML sauf pour 'content' (déjà traité ci-dessus)
    const finalValue = escapeHtml(String(value))

    const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g')
    result = result.replace(regex, finalValue)
  })

  // Nettoyer les variables non remplacées
  result = result.replace(/\{\{\s*[^}]+\s*\}\}/g, '')

  return result
}

/**
 * Échappe les caractères spéciaux pour regex
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Résout les références au Design System dans les props
 */
export function resolvePropsWithDesignSystem(props, designSystem) {
  if (!designSystem || !props) return props

  const resolved = {}

  Object.keys(props).forEach(key => {
    const value = props[key]

    if (typeof value === 'string' && value.includes('{{designSystem.')) {
      const match = value.match(/{{designSystem\.(.*?)}}/)
      if (match) {
        const tokenPath = match[1]
        const resolvedValue = getNestedValue(designSystem, tokenPath)
        resolved[key] = resolvedValue !== undefined ? resolvedValue : value
      } else {
        resolved[key] = value
      }
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolvePropsWithDesignSystem(value, designSystem)
    } else {
      resolved[key] = value
    }
  })

  return resolved
}

/**
 * Récupère une valeur imbriquée dans un objet par chemin
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

/**
 * Évalue les conditionnels basiques dans le template
 */
function evaluateBasicConditionals(template, props) {
  let result = template

  // Regex qui capture TOUT entre les guillemets de condition (même avec des quotes internes)
  // Double quotes: <if condition="level === 'h1'">
  const ifRegex = /<if\s+condition="([^"]*)">([\s\S]*?)<\/if>|<if\s+condition='([^']*)'>([\s\S]*?)<\/if>/gi

  result = result.replace(ifRegex, (match, conditionDouble, contentDouble, conditionSingle, contentSingle) => {
    // La condition et le contenu sont soit dans les groupes double quotes (1,2) soit single quotes (3,4)
    const condition = conditionDouble || conditionSingle
    const content = contentDouble || contentSingle

    try {
      const evaluated = evaluateCondition(condition, props)
      return evaluated ? content : ''
    } catch (err) {
      console.warn('Failed to evaluate condition:', condition, err)
      return ''
    }
  })

  return result
}

/**
 * Évalue une condition simple
 */
function evaluateCondition(condition, props) {
  let evalString = condition

  Object.keys(props).forEach(key => {
    const value = props[key]
    const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, 'g')
    const replacement = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : JSON.stringify(value)
    evalString = evalString.replace(regex, replacement)
  })

  try {
    return eval(evalString)
  } catch (err) {
    console.warn('Condition eval error:', evalString, err)
    return false
  }
}

/**
 * Échappe les caractères HTML
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

/**
 * Construit le template Maizzle complet avec layout
 */
export function buildMaizzleTemplate(metadata, blocksHtml) {
  const {
    title = 'Email sans titre',
    subject = '',
    preheader = '',
  } = metadata

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f4;">
  ${preheader ? `
  <!--[if !mso]><!-->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${escapeHtml(preheader)}
  </div>
  <!--<![endif]-->
  ` : ''}
  <table role="presentation" style="width: 100%; margin: 0; padding: 0; background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">
          <tr>
            <td style="padding: 0;">
              ${blocksHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
