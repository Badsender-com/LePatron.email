'use strict';

const _ = require('lodash');
const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const mongooseHidden = require('mongoose-hidden')();

const { trimString } = require('../utils/model');
const { GroupModel } = require('../constant/model.names');

/**
 * @apiDefine templates
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} description
 * @apiSuccess {String} coverImage the cover image real name
 * @apiSuccess {Date} createdAt creation date
 * @apiSuccess {Date} updatedAt last update date
 * @apiSuccess {Boolean} hasMarkup whereas this template has a mosaico's template uploaded or not
 * @apiSuccess {Object} group The group it belongs to
 * @apiSuccess {String} group.id
 * @apiSuccess {String} group.name
 */

/**
 * @apiDefine template
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} description
 * @apiSuccess {Date} createdAt creation date
 * @apiSuccess {Date} updatedAt last update date
 * @apiSuccess {Boolean} hasMarkup whereas this template has a mosaico's template uploaded or not
 * @apiSuccess {String} markup the template's markup
 * @apiSuccess {Object} assets all the images with `key` the image name at the upload & `value` the name once uploaded
 * @apiSuccess {Object} group The group it belongs to
 * @apiSuccess {String} group.id
 * @apiSuccess {String} group.name
 */

const TemplateSchema = Schema(
  {
    name: {
      type: String,
      unique: true,
      required: [true, 'name is required'],
      set: trimString,
    },
    description: {
      type: String,
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'group is required'],
      // Ideally we should have run a script to migrate fields
      // • don't have time
      // • so just make an alias
      alias: 'group',
    },
    markup: {
      type: String,
    },
    // change from images array to assets for 1 reason
    // mosaico get the block thumbs image by looking the ID of the block
    // alas images are named with `${wireframeId}-${imageHash}.${ext}`
    // to fetch the right image we need a catalog
    //
    // need to store as JSON because mongoDB won't accept keys containing dots
    //   =>  MongoError: The dotted field is not valid for storage
    //   { 'image.png': '589321ab2cd3855cddd2aaad-36f5bb441ae6a8c15288cedac8b54f35.png' }
    // won't work
    assets: {
      type: String,
      get: (v) => {
        try {
          return JSON.parse(v);
        } catch (e) {
          return false;
        }
      },
      set: (v) => {
        return JSON.stringify(v);
      },
    },
  },
  { timestamps: true, toJSON: { virtuals: true, getters: true } }
);

// easily hide keys from toJSON
// https://www.npmjs.com/package/mongoose-hidden
TemplateSchema.plugin(mongooseHidden, {
  hidden: { _id: true, __v: true, _company: true },
});

// TemplateSchema.virtual('imgPath').get(function() {
//   return `/img/${this._id}-`
// })

TemplateSchema.virtual('hasMarkup').get(function () {
  return Boolean(this.markup);
});
TemplateSchema.index({ name: 1 });

TemplateSchema.statics.findForApi = async function findForApi(query = {}) {
  const templates = await this.find(query, {
    id: '$_id',
    name: 1,
    description: 1,
    createdAt: 1,
    updatedAt: 1,
    _company: 1,
    assets: 1,
    hasMarkup: {
      $cond: { if: { $gt: ['$markup', null] }, then: true, else: false },
    },
  })
    .populate({ path: '_company', select: 'id name' })
    .sort({ name: 1 })
    .lean();

  const finalTemplates = templates.map(({ assets, ...template }) => ({
    ...template,
    coverImage: JSON.parse(assets)?.['_full.png'] || null,
  }));
  return finalTemplates;
};

module.exports = TemplateSchema;
