markdown

## Description:

PR to add profile schema to mongoDB

Server side: Le ProductController existe.

## How ?

- [ ] Add folder `Profile`
- [ ] Create types `profileTypes.js` inside the `Profile` folder

  ```
  /// ///
  // ProfileType
  /// ///
  const ProfileTypes = {
  ACTITO: 'actity',
  SENDINGBLUE: 'sendingblue',
  };

  module.exports = ProfileTypes;
  ```

- [ ] Create `Profile.Schema.js` File

  ```
  'use strict';

  const { Schema } = require('mongoose');
  const { ObjectId } = Schema.Types;
  const { GroupModel } = require('../constant/model.names.js');
  const { ProfileTypes } = require('./profiletypes.js');

  /**
   * @apiDefine profile
   * @apiSuccess {String} id
   * @apiSuccess {String} name
   * @apiSuccess {Date} createdAt
   * @apiSuccess {Date} createdAt
   * @apiSuccess {String} _group
   * @apiSuccess {Object} data the profile's data inserted by the Group admin
   */

  const ProfileSchema = Schema(
    {
      name: {
        type: String,
        required: [true, 'Profile name is required'],
      },
       type: {
        type: String,
        enum: [ProfileTypes.ACTITO, ProfileTypes.SENDINGBLUE],
        required: false,
      },
      _company: {
        type: ObjectId,
        ref: GroupModel,
        alias: 'group',
      },
      // http://mongoosejs.com/docs/schematypes.html#mixed
      data: {}
    },
    {
      timestamps: true,
      toJSON: { virtuals: true },
      toObject: { virtuals: true },
    }
  );

  module.exports = ProfileSchema;

  ```
