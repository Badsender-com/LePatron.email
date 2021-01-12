---
title: Development
lang: en-US
---

## Dev prerequisite

- [NodeJS 10](https://nodejs.org/en/)
- [Yarn v1.13.0](https://yarnpkg.com/en/)
- [MongoDB >= v3.4.18](https://www.mongodb.com/)
  - if installed locally `mongod` to start
  - `brew install mongodb@3.4` on mac
  - for DB migration see [this post](https://stackoverflow.com/questions/51227939/using-brew-upgrade-mongo-update-from-3-4-to-4-0-error-the-data-files-need-to-be)
- a SMTP server ([maildev](https://github.com/djfarrelly/MailDev) will be installed for you)
- [sharp](http://sharp.dimens.io/en/stable/) should work out the box most of the time. In case of troubles see [sharp installation instructions](http://sharp.dimens.io/en/stable/install/). MacOs will need XCode in order to compile.

You need to have:

- clone/fork the project
- in your terminal, go in the folder
- run `yarn install` in the root folder

## Updating the code

It should have a default config for dev already setup.
If you want to change some, create `.lepatronrc` at the root of the project then fill with the values you want to overrride as described in the `.lepatronrc-example`

those are the main developer commands:

### Build the project for _production_

```
yarn build
```

### Start a server configured for _production_

```
yarn start
```

server will be running on `localhost:3000`

### Build and start a _production_ server

```
yarn prod
```

### Build and start a _development_ server

```
yarn dev
```

- server will be running on `localhost:3000`
- server will be restarted on files changes
- build will be updated on files changes also

### Generate the API Documentation

```
yarn build:documentation
```

### Show this documentation with [VuePress](https://vuepress.vuejs.org/)

This documentation can be served in a cleaner way with following command:

```
yarn build:documentation
```

Documentation will be served on [http://localhost:8080/](http://localhost:8080/)

### Make a release

You can make a release of any branch.
On heroku:

- the following will yarn script will be used to build `yarn heroku-postbuild`
- after that the server will be launched with the content of the `Procfile`

#### legacy release (deprecated)

Prior to the Nuxt Version a custom script was passed:
It builds the application on the `build` branch (thus the existence of this build branch)

It's no longer relevant

### Databases scripts

`.lepatronrc` should be provided with _dbConfigs_ infos. See `.lepatronrc-example` for more informations

#### sync-db

- can copy one DB into another
- can also copy a snapshot saved in `images.tmpDir` (see below) into another

```
yarn sync-db
```

#### backup-db

- will save a snapshot of the specified DB in the folder defined by `images.tmpDir` config

```
yarn backup-db
```

#### local-db

- save a _local db_ snapshot
- restore it later

```
yarn local-db
```

### S3 notes

This is some script to backup a bucket or sync a bucket from a backup.
This is mostly use for development purpose.

#### requirements

- [aws cli](http://docs.aws.amazon.com/cli/latest/reference/) – `brew install awscli` on a mac
- `.lepatronrc` filled with s3Configs parameters. See `.lepatronrc-example`

[more details about why we use the aws cli](http://stackoverflow.com/questions/17832860/backup-strategies-for-aws-s3-bucket#answer-32927276)

#### backing up to a local folder

```
yarn backup-s3
```

#### syncing a bucket from a local folder

```
yarn sync-s3
```
