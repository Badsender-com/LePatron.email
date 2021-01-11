'use strict'

// we need to sick to “wireframe-” prefix for compatibility reason
module.exports = function _getTemplateImagePrefix(templateId) {
  return `wireframe-${templateId}`
}
