'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const {
  GroupModel,
  IntegrationModel,
} = require('../constant/model.names.js');

/**
 * Dashboard Schema
 *
 * Represents a dashboard that can be displayed to users.
 * Each dashboard references an Integration (e.g., Metabase instance)
 * and contains provider-specific configuration (e.g., Metabase dashboard ID).
 */
const DashboardSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Dashboard name is required'],
    },
    description: {
      type: String,
      default: '',
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      alias: 'group',
      required: [true, 'Group is required'],
    },
    _integration: {
      type: ObjectId,
      ref: IntegrationModel,
      alias: 'integration',
      required: [true, 'Integration is required'],
    },
    // Provider-specific dashboard identifier (e.g., Metabase dashboard ID)
    providerDashboardId: {
      type: Number,
      required: [true, 'Provider dashboard ID is required'],
    },
    // Optional locked parameters for filtering (passed to embed URL)
    lockedParams: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Display order (lower = first)
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for efficient queries by group
DashboardSchema.index({ _company: 1, order: 1 });

// Compound unique index: prevent duplicate dashboard IDs per integration
DashboardSchema.index(
  { _integration: 1, providerDashboardId: 1 },
  { unique: true }
);

module.exports = DashboardSchema;
