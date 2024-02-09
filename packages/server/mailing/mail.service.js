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

const mailReady = transporter.verify();

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
