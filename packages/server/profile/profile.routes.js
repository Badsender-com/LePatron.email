'use strict';

const express = require('express');

const router = express.Router();

const profiles = require('./profile.controller.js');

const { GUARD_ADMIN } = require('../account/auth.guard.js');

router.post('/create', profiles.create);
router.post('/send-campaign', profiles.sendCampaignMail);
router.get('/', GUARD_ADMIN, profiles.list);
module.exports = router;
