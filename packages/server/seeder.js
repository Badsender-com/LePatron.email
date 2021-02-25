// const config = require('./node.config.js');
//
// const fs = require('fs-extra');
// const mongoose = require('mongoose');
// const Folders = require('./common/models.common');
// const Workspaces = require('./common/models.common');
// const Groups = require('./common/models.common');
// const Mailings = require('./common/models.common');
//
//
// mongoose.connect(config.database, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });
//
// const dirname= __dirname;
// const folders = JSON.parse(fs.readFileSync(`${dirname}/data/folders.json`, 'utf-8'));
// const workspaces = JSON.parse(fs.readFileSync(`${dirname}/data/workspaces.json`, 'utf-8'));
// const groups = JSON.parse(fs.readFileSync(`${dirname}/data/groups.json`, 'utf-8'));
// const mailings = JSON.parse(fs.readFileSync(`${dirname}/data/mailings.json`, 'utf-8'));
