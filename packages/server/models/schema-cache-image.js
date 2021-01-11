'use strict'

const { Schema } = require('mongoose')

const { normalizeString } = require('./utils')

const CacheImageSchema = Schema(
  {
    path: {
      type: String,
      required: true,
      set: normalizeString,
    },
    name: {
      type: String,
      required: true,
      set: normalizeString,
    },
  },
  { timestamps: true },
)

module.exports = CacheImageSchema
