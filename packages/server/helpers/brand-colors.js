'use strict'

const _ = require('lodash')
// import the same Vuetify colors helpers for coherent branding
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
function colorToInt(color) {
  let rgb

  if (typeof color === 'number') {
    rgb = color
  } else if (typeof color === 'string') {
    let c = color[0] === '#' ? color.substring(1) : color

    if (c.length === 3) {
      c = c
        .split('')
        .map(function (char) {
          return char + char
        })
        .join('')
    }

    if (c.length !== 6) {
      console.warn("'".concat(color, "' is not a valid rgb color"))
    }

    rgb = parseInt(c, 16)
  } else {
    throw new TypeError(
      'Colors can only be numbers or strings, recieved '.concat(
        color == null ? color : color.constructor.name,
        ' instead',
      ),
    )
  }

  if (rgb < 0) {
    console.warn("Colors cannot be negative: '".concat(color, "'"))
    rgb = 0
  } else if (rgb > 0xffffff || isNaN(rgb)) {
    console.warn("'".concat(color, "' is not a valid rgb color"))
    rgb = 0xffffff
  }

  return rgb
}

function intToHex(color) {
  var hexColor = color.toString(16)
  if (hexColor.length < 6) hexColor = '0'.repeat(6 - hexColor.length) + hexColor
  return '#' + hexColor
}

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
