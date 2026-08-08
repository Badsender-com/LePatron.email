'use strict';

const createError = require('http-errors');

const { extend, pick } = require('lodash');
const chalk = require('chalk');
const nodemailer = require('nodemailer');
const wellknown = require('nodemailer-wellknown');

const config = require('../node.config.js');

let mailConfig = config.emailTransport;
if (mailConfig.service) {
  mailConfig = extend({}, mailConfig, wellknown(mailConfig.service));
  delete mailConfig.service;
}
const transporter = nodemailer.createTransport(config.emailTransport);

// Verify the SMTP connection at startup. `mailReady` is exposed so callers can
// await readiness. Skipped under test: it does a real network round-trip on
// every module import, and its async rejection (bad/absent SMTP creds) would
// otherwise surface as an unhandled rejection that Jest mis-attributes to an
// unrelated test. A catch is attached so a startup failure (e.g. in dev/CI)
// stays a logged warning rather than crashing the process.
const mailReady =
  config.NODE_ENV === 'test' ? Promise.resolve() : transporter.verify();
mailReady.catch(function (err) {
  console.log(chalk.red('smtp verification failed'));
  console.log(err.message);
});

function send(options) {
  const mailOptions = extend({}, options, pick(config.emailOptions, ['from']));
  return new Promise(function (resolve, reject) {
    transporter
      .sendMail(mailOptions)
      .then(function (info) {
        console.log(chalk.green('email send to', info.accepted));
        resolve(info);
      })
      .catch(function (err) {
        console.log(chalk.red('email error'));
        console.log(err);
        const message =
          err.code === 'ECONNREFUSED'
            ? 'smtp connection failed'
            : 'email error';
        reject(createError(500, message));
      });
  });
}

module.exports = {
  transporter,
  mailReady,
  send,
};
