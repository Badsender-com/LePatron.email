'use strict';

const Client = require('ssh2-sftp-client');
const SocksClient = require('socks').SocksClient;
const request = require('request');
const url = require('url');
const fs = require('fs-extra');
const crypto = require('crypto');
const config = require('../node.config.js');
const { getImageName } = require('../utils/download-zip-markdown.js');

class FTPClient {
  constructor(
    host = 'localhost',
    port = 22,
    username = 'anonymous',
    password = 'guest'
  ) {
    this.client = new Client();
    this.settings = {
      host: host,
      port: port,
      username: username,
      password: password,
      keepaliveInterval: 2000,
      keepaliveCountMax: 50,
    };
  }

  async upload(sourceArray, folderPath) {
    const self = this;
    const client = this.client;
    const currentDate = new Date().valueOf().toString();
    const random = Math.random().toString();
    const tmpDir = `/tmp/${crypto
      .createHash('sha1')
      .update(currentDate + random)
      .digest('hex')}`;

    try {
      fs.mkdir(tmpDir);
    } catch (err) {
      console.log('Error while creating tmp : ' + err);
    }

    try {
      await client.connect({
        ...self.settings,
      });

      const exists = await client.exists(folderPath);
      if (!exists) {
        await client.mkdir(folderPath, true);
      }

      const uploads = sourceArray.map(async (fileUrl) => {
        const fileName = getImageName(fileUrl);
        const localPath = `${tmpDir}/${fileName}`;
        const remotePath = `${folderPath}${fileName}`;

        await new Promise((resolve, reject) => {
          const requestedFile = request.get(fileUrl);
          const fileStream = fs.createWriteStream(localPath);

          requestedFile.pipe(fileStream);
          fileStream.on('finish', resolve);
          fileStream.on('error', reject);
        });

        try {
          client.on('debug', (msg) => console.log('DEBUG SFTP:', msg));
          await client
            .fastPut(localPath, remotePath, { chunkSize: 16384 })
            .then(() => {
              console.log(`Upload réussi pour ${fileName}`);
            })
            .catch((err) => {
              console.error(`Upload échoué pour ${fileName}:`, err);
              throw err;
            });
        } catch (error) {
          console.log(`ERROR OCCURED WHILE PUT SENT : ${error}`);
        }

        return fileName;
      });

      const results = await Promise.allSettled(uploads);
      console.log('Résultats des uploads :', results);
    } catch (err) {
      console.log('METHOD ERRORED', err);
    } finally {
      console.log('END OF UPLOADING');

      try {
        fs.remove(`${tmpDir}`);
      } catch (err) {
        console.log('Error while removing tmp : ', err);
      }

      try {
        await client.end();
      } catch (err) {
        console.log('ERROR WHEN ENDING CLIENT', err);
      }
    }

    return client;
  }

  getProxy() {
    const self = this;
    const proxy = new url.URL(config.proxyUrl);

    return SocksClient.createConnection({
      proxy: {
        host: proxy.hostname,
        port: 1080,
        type: 5,
        userId: proxy.username,
        password: proxy.password,
      },
      command: 'connect',
      destination: {
        host: self.settings.host,
        port: self.settings.port,
      },
    });
  }
}

module.exports = FTPClient;
