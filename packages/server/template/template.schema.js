'use strict';

const _ = require('lodash');
const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const mongooseHidden = require('mongoose-hidden')();

const { normalizeString } = require('../utils/model');
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
      set: normalizeString,
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
  return this.markup != null;
});

TemplateSchema.statics.findForApi = async function findForApi(query = {}) {
  const templates = await this.find(query)
    // we need to keep markup in order for the virtual `hasMarkup` to have the right result
    // we also need all assets
    .populate({ path: '_company', select: 'id name' })
    .sort({ name: 1 });
  // change some fields
  // • we don't want the markup to be send => remove
  // • we don't want all assets => remove
  // • BUT we still want the cover image => add
  return templates.map((template) => {
    // pick is more performant than omit
    const templateRes = _.pick(template.toJSON(), [
      'id',
      'name',
      'description',
      'createdAt',
      'updatedAt',
      'hasMarkup',
      'group',
    ]);
    templateRes.coverImage = template.assets['_full.png'];
    return templateRes;
  });
};

// TemplateSchema.virtual('url').get(function() {
//   let userId = this._user && this._user._id ? this._user._id : this._user
//   let userUrl = this._user ? `/users/${userId}` : '/users'
//   let companyId =
//     this._company && this._company._id ? this._company._id : this._company
//   let companyUrl = this._company ? `/companies/${companyId}` : '/companies'
//   // read should be `/companies/${this._company}/wireframes/${this._id}`
//   return {
//     read: `/users/${this._user}/wireframe/${this._id}`,
//     show: `/wireframes/${this._id}`,
//     backTo: this._company ? companyUrl : userUrl,
//     user: userUrl,
//     company: companyUrl,
//     delete: `/wireframes/${this._id}/delete`,
//     removeImages: `/wireframes/${this._id}/remove-images`,
//     markup: `/wireframes/${this._id}/markup`,
//     preview: `/wireframes/${this._id}/preview`,
//     generatePreviews: `/wireframes/${this._id}/generate-previews`,
//     imgCover: this.assets['_full.png']
//       ? `/img/${this.assets['_full.png']}`
//       : false,
//   }
// })

module.exports = TemplateSchema;
