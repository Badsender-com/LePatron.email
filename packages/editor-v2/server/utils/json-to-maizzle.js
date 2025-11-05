const designSystemService = require('../services/design-system.service');

/**
 * Transforme le format Email JSON en template Maizzle complet
 *
 * Format attendu :
 * {
 *   metadata: {
 *     title: string,
 *     subject: string,
 *     preheader: string,
 *     designSystemId: string,
 *   },
 *   blocks: [
 *     {
 *       id: string,
 *       component: string,
 *       props: object,
 *     }
 *   ]
 * }
 */
async function jsonToMaizzle(emailData, renderService) {
  const { metadata = {}, blocks = [] } = emailData;

  // Charger le Design System si spécifié
  let designSystem = null;
  if (metadata.designSystemId) {
    try {
      designSystem = await designSystemService.load(metadata.designSystemId);
    } catch (err) {
      console.warn(`Design System "${metadata.designSystemId}" not found, using defaults`);
    }
  }

  // Résoudre les props de chaque block avec les valeurs du Design System
  const resolvedBlocks = blocks.map(block => {
    const resolvedProps = resolvePropsWithDesignSystem(block.props, designSystem);
    return {
      ...block,
      props: resolvedProps,
    };
  });

  // Construire le HTML de chaque block
  const blocksHtml = await Promise.all(
    resolvedBlocks.map(async (block) => {
      try {
        // Charger le template du composant
        const template = await renderService.loadComponentTemplate(block.component);

        // Injecter les props dans le template (simple remplacement pour POC)
        const renderedBlock = injectPropsIntoTemplate(template, block.props, block.id);

        return renderedBlock;
      } catch (err) {
        console.error(`Error rendering block ${block.id}:`, err);
        return `<!-- Error rendering block ${block.id}: ${err.message} -->`;
      }
    })
  );

  // Construire le template Maizzle complet
  const maizzleTemplate = buildMaizzleTemplate(metadata, blocksHtml.join('\n'));

  return maizzleTemplate;
}

/**
 * Résout les références au Design System dans les props
 * Ex: "{{designSystem.tokens.colors.primary}}" → "#007bff"
 */
function resolvePropsWithDesignSystem(props, designSystem) {
  if (!designSystem || !props) return props;

  const resolved = {};

  Object.keys(props).forEach(key => {
    const value = props[key];

    if (typeof value === 'string' && value.includes('{{designSystem.')) {
      // Extraire le chemin du token
      const match = value.match(/{{designSystem\.(.*?)}}/);
      if (match) {
        const tokenPath = match[1];
        const resolvedValue = getNestedValue(designSystem, tokenPath);
        resolved[key] = resolvedValue !== undefined ? resolvedValue : value;
      } else {
        resolved[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      // Récursif pour objets imbriqués
      resolved[key] = resolvePropsWithDesignSystem(value, designSystem);
    } else {
      resolved[key] = value;
    }
  });

  return resolved;
}

/**
 * Récupère une valeur imbriquée dans un objet par chemin
 * Ex: getNestedValue(obj, 'tokens.colors.primary')
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Injecte les props dans un template de composant
 * Remplace les {{ propName }} par les valeurs
 */
function injectPropsIntoTemplate(template, props, blockId) {
  let result = template;

  // Retirer le <script props> block (sera traité par Maizzle)
  // Pour le POC, on fait un simple remplacement manuel
  result = result.replace(/<script props>[\s\S]*?<\/script>/i, '');

  // Remplacer les variables {{ propName }}
  Object.keys(props).forEach(key => {
    const value = props[key];
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, escapeHtml(String(value)));
  });

  // Remplacer {{ blockId }}
  result = result.replace(/{{\\s*blockId\\s*}}/g, blockId);

  // Gérer les conditionnels basiques (if condition="level === 'h1'")
  // Pour le POC, simplification : on évalue les conditions basiques
  result = evaluateBasicConditionals(result, props);

  // Nettoyer les variables non remplacées
  result = result.replace(/{{[^}]+}}/g, '');

  return result;
}

/**
 * Évalue les conditionnels basiques dans le template
 * Ex: <if condition="level === 'h1'">...</if>
 */
function evaluateBasicConditionals(template, props) {
  let result = template;

  // Regex pour capturer <if condition="...">...</if>
  const ifRegex = /<if\s+condition=["']([^"']+)["']>([\s\S]*?)<\/if>/gi;

  result = result.replace(ifRegex, (match, condition, content) => {
    try {
      // Évaluer la condition de façon sécurisée (POC simplifié)
      const evaluated = evaluateCondition(condition, props);
      return evaluated ? content : '';
    } catch (err) {
      console.warn('Failed to evaluate condition:', condition, err);
      return ''; // En cas d'erreur, ne pas afficher
    }
  });

  return result;
}

/**
 * Évalue une condition simple (POC - version simplifiée)
 * Ex: "level === 'h1'" avec props = { level: 'h1' }
 */
function evaluateCondition(condition, props) {
  // Remplacer les variables dans la condition
  let evalString = condition;
  Object.keys(props).forEach(key => {
    const value = props[key];
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    const replacement = typeof value === 'string' ? `'${value}'` : value;
    evalString = evalString.replace(regex, replacement);
  });

  // Évaluer (ATTENTION : eval n'est pas sécurisé en production!)
  // Pour le POC, on garde cette approche simple
  try {
    return eval(evalString);
  } catch (err) {
    console.warn('Condition eval error:', evalString, err);
    return false;
  }
}

/**
 * Échappe les caractères HTML pour éviter les injections
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Construit le template Maizzle complet avec layout
 */
function buildMaizzleTemplate(metadata, blocksHtml) {
  const {
    title = 'Email sans titre',
    subject = '',
    preheader = '',
  } = metadata;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
  ${preheader ? `
  <!--[if !mso]><!-->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${escapeHtml(preheader)}
  </div>
  <!--<![endif]-->
  ` : ''}
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f4;">
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
</html>`;
}

module.exports = {
  jsonToMaizzle,
  resolvePropsWithDesignSystem,
  injectPropsIntoTemplate,
  buildMaizzleTemplate,
};
