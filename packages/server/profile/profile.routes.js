'use strict';

const express = require('express');

const router = express.Router();

const profiles = require('./profile.controller.js');

router.post('/create', profiles.create);
router.post('/send-campaign', profiles.sendCampaignMail);
router.delete('/:profileId', profiles.deleteProfile);

module.exports = router;
