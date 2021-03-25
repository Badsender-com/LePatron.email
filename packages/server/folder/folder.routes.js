'use strict';

const express = require('express');
const router = express.Router();

const folders = require('./folder.controller.js');
router.get('', folders.list);
router.post('', folders.create);

module.exports = router;
