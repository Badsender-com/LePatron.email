'use strict';

const express = require('express');

const router = express.Router();

const profiles = require('./profile.controller.js');

const { GUARD_USER, GUARD_ADMIN } = require('../account/auth.guard.js');

router.post('/', GUARD_ADMIN, profiles.create);
router.post('/send-campaign-mail', GUARD_USER, profiles.sendCampaignMail);
router.delete('/:profileId', GUARD_ADMIN, profiles.deleteProfile);

module.exports = router;
