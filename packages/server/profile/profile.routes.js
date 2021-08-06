'use strict';

const express = require('express');

const router = express.Router();

const profiles = require('./profile.controller.js');

const { GUARD_USER, GUARD_ADMIN } = require('../account/auth.guard.js');

router.post('/', GUARD_ADMIN, profiles.createProfile);
router.post('/:profileId', GUARD_ADMIN, profiles.updateProfile);
router.post(
  '/:mailingId/send-campaign-mail',
  GUARD_USER,
  profiles.sendCampaignMail
);
router.delete('/:profileId', GUARD_ADMIN, profiles.deleteProfile);
router.get('/:profileId', GUARD_USER, profiles.readProfile);
router.get('/:profileId/admin', GUARD_ADMIN, profiles.readProfileForAdmin);
router.post('/actito-entities-list', GUARD_ADMIN, profiles.actitoEntitiesList);
router.post(
  '/actito-target-tables-list',
  GUARD_ADMIN,
  profiles.actitoTargetTableList
);
router.get(
  '/:groupId/profile-list-for-editor',
  GUARD_USER,
  profiles.profileListEditor
);
router.get(
  '/:profileId/campaign-mail/:campaignId',
  GUARD_USER,
  profiles.getCampaignMail
);

module.exports = router;
