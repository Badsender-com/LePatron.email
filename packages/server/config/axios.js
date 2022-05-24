const Axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const config = require('../node.config');

let agent = null;
if (config.proxyUrl) {
  const proxy = new url.URL(config.proxyUrl);
  if (typeof proxy !== 'undefined') {
    agent = new HttpsProxyAgent(config.proxyUrl);
  }
}

const axios = agent
  ? Axios.create({
      proxy: false,
      httpsAgent: agent,
    })
  : Axios.create();

axios.interceptors.request.use((request) => {
  request.url = encodeURI(request.url);
  return request;
});

module.exports = axios;
