---
title: Heroku configuration
lang: en-US
---

# heroku server configuration

## buildpack

In order for the image resize & the templates' preview generation to work you will need those build packs IN THAT ORDER:

- https://github.com/jontewks/puppeteer-heroku-buildpack.git
- heroku/nodejs

Copy and paste those url in the `Buildpacks` section of `Settings`

This has to be done BEFORE any deploy

## heroku features

you need to enable [session affinity](https://devcenter.heroku.com/articles/session-affinity).

```sh
heroku features:enable http-session-affinity
```

## resources

The following are Heroku's Resources.
They provide an easy way to install all necessary service but can be omitted if an identical service is provided outside Heroku.

### mongolab

[mongolab addon's detail](https://devcenter.heroku.com/articles/mongolab)

### sendgrid

[sendgrid addon's detail](https://devcenter.heroku.com/articles/sendgrid)

### logentries

[logentries addon's detail](https://devcenter.heroku.com/articles/logentries)

**You should disable High Response Time**
This will error with [SSE events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) even if there isn't any issue.
Go to `Tags and alerts` and un-check the corresponding line.

## configuring heroku environments variables

- go in the settings of your application
- click on `settings`
- click on `Reveal Config Vars`
- variables name should follow this pattern:

```
lepatron_emailOptions__from
```

- always put `lepatron_` first
- then each level of config should be seperate with a double underscore: `__`
- see `.lepatronrc-example` on the master branch for the config requirements

below are the common environments variables you should want to set:

### mail sending

```
lepatron_emailTransport__service         Mailjet
lepatron_emailTransport__auth__user      your Username (or API key)
lepatron_emailTransport__auth__pass      your password (or Secret Key)
```

lepatron_emailTransport\_\_service is for [nodemailer-wellknown](https://www.npmjs.com/package/nodemailer-wellknown) configuration

### from email address

```
lepatron_emailOptions__from              Badsender Builder <emailbuilder@badsender.com>
```

### MongoDB database

the path to your mongoDB instance

```
lepatron_database                        mongodb://localhost/badsender
```

### Admin password

```
lepatron_admin__password                 a password of your choice
```

### Hostname

The domain name of your app

```
lepatron_host                            badsender-test.herokuapp.com
```

### Error pages:

```
MAINTENANCE_PAGE_URL                    Url of maintenance page in case you application is in maintenance mode.
ERROR_PAGE_URL                          Url of the page that will be displayed in case your application crashs
```

### AWS S3

Those are the keys you should set for aws

```
lepatron_storage__type                   aws
lepatron_storage__aws__accessKeyId       20 characters key
lepatron_storage__aws__secretAccessKey   40 characters secret key
lepatron_storage__aws__bucketName        your bucket name
lepatron_storage__aws__region            region of your bucket (ex: ap-southeast-1)
```

#### getting an AWS id

[console.aws.amazon.com/iam](https://console.aws.amazon.com/iam) -> **create new access key**

#### creating the bucket

[console.aws.amazon.com/s3](https://console.aws.amazon.com/s3) -> **create bucket**

you have also to set the good policy for the bucket:

**Properties** -> **Permissions** -> **Add bucket policy**

and copy and paste this:

```json
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicRead",
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOURBUCKETNAME/*"
    }
  ]
}
```

then replace `YOURBUCKETNAME` by your real bucket name

### Other config

```js
// redirect any http request to https
forcessl:       false,
images: {
  // needed only if not using S3 image storage
  uploadDir:    'uploads',
  // tmp directory name for image upload
  tmpDir:       'tmp',
  // cache resized images & add cache-control to image request
  cache:        false,
},
```
