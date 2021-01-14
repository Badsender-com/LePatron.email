'use strict'

const { extend, pick } = require('lodash')
const chalk = require('chalk')
const nodemailer = require('nodemailer')
const nodemailerSendgrid = require('nodemailer-sendgrid')
const wellknown = require('nodemailer-wellknown')
const createError = require('http-errors')

const config = require('../node.config.js')

let mailConfig = config.emailTransport
if (mailConfig.service) {
  mailConfig = extend({}, mailConfig, wellknown(mailConfig.service))
  delete mailConfig.service
}
const transporter = nodemailer.createTransport(
  config.isDev
    ? config.emailTransport
    : nodemailerSendgrid({
        apiKey: config.emailTransport.apiKey,
      }),
)

const mailReady = transporter.verify()

// mailReady
//   .then(() => {
//     console.log(chalk.green('[SERVICES] EMAIL transport creation – SUCCESS'))
//   })
//   .catch(err => {
//     console.log(chalk.red('[SERVICES] EMAIL transport creation – ERROR'))
//     console.trace(err)
//   })

function send(options) {
  var mailOptions = extend({}, options, pick(config.emailOptions, ['from']))
  return new Promise(function (resolve, reject) {
    transporter
      .sendMail(mailOptions)
      .then(function (info) {
        console.log(chalk.green('email send to', info.accepted))
        resolve(info)
      })
      .catch(function (err) {
        console.log(chalk.red('email error'))
        const message =
          err.code === 'ECONNREFUSED' ? 'smtp connection failed' : 'email error'
        reject(createError(500, message))
      })
  })
}

module.exports = {
  transporter,
  mailReady,
  send,
}
