'use strict'

// https://devcenter.heroku.com/articles/node-concurrency
const throng = require('throng')
const chalk = require('chalk')
const SegfaultHandler = require('segfault-handler')

const start = require('./index.js')

if (!/^10\./.test(process.versions.node)) {
  const msg = `wrong nodeJS version. Should run on nodeJS 10.
  See package.json#engines`
  console.log(chalk.red(msg))
}

SegfaultHandler.registerHandler(`crash.log`, (signal, address, stack) => {
  console.log({
    signal,
    address,
    stack,
  })
})

const workers = process.env.WEB_CONCURRENCY || 1

throng({
  start,
  workers,
  lifetime: Infinity,
})
