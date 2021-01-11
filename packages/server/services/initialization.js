'use strict'

const util = require('util')
const chalk = require('chalk')

const config = require('../node.config.js')
const { mongoose } = require('./models.js')
const { mailReady } = require('./mail.js')

//----- MONGO DATABASE

mongoose.connection.once('open', e => {
  console.log(chalk.green(`[SERVICES] DB – connection ok`))
})

// https://mongoosejs.com/docs/deprecations
const dbConnection = mongoose.connect(config.database, {
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true,
  useUnifiedTopology: true,
  retryWrites: false,
})

dbConnection.catch(dbConnectionError => {
  console.log(chalk.red(`[SERVICES] DB – can't connect`))
  console.log(util.inspect(dbConnectionError, { colors: true }))
})

//----- GLOBAL CHECK

const areReady = Promise.all([config.setup, dbConnection, mailReady]).catch(
  serviceDependenciesError => {
    console.log(
      chalk.red(
        `[SERVICES] One or more service dependency is preventing the application from running properly`,
      ),
    )
    return false
  },
)

module.exports = {
  areReady,
}
