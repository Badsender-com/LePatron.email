module.exports = {
  apps: [
    {
      name: 'bad-sender',
      script: 'node packages/server/index.js',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      watch: false,
      instances: 1,
    },
  ],
};
