'use strict'

const _ = require('lodash')
// import the same Vuetify colors helpers for coherent branding
const { intToHex, colorToInt } = require('vuetify/es5/util/colorUtils.js')
const LAB = require('vuetify/es5/util/color/transformCIELAB.js')
const sRGB = require('vuetify/es5/util/color/transformSRGB.js')

const config = require('../node.config.js')

module.exports = {
  asCssCustomProperties,
}

function asCssCustomProperties() {
  const themeColors = Object.entries(config.brandOptions.colors).map(
    ([colorName, colorValue]) => {
      const variations = genVariations(colorName, colorToInt(colorValue))
      const cssCustomProperties = Object.entries(variations).map(
        ([variationName, variationColor]) => {
          return `--v-${colorName}-${variationName}: ${variationColor}`
        },
      )
      return cssCustomProperties
    },
  )
  return _.flatten(themeColors)
}

// COPY FROM VUETIFY
function genVariations(name, value) {
  const values = {
    base: intToHex(value),
  }
  for (let i = 5; i > 0; --i) {
    values[`lighten${i}`] = intToHex(lighten(value, i))
  }
  for (let i = 1; i <= 4; ++i) {
    values[`darken${i}`] = intToHex(darken(value, i))
  }
  return values
}
function lighten(value, amount) {
  const lab = LAB.fromXYZ(sRGB.toXYZ(value))
  lab[0] = lab[0] + amount * 10
  return sRGB.fromXYZ(LAB.toXYZ(lab))
}
function darken(value, amount) {
  const lab = LAB.fromXYZ(sRGB.toXYZ(value))
  lab[0] = lab[0] - amount * 10
  return sRGB.fromXYZ(LAB.toXYZ(lab))
}
