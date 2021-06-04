<h1 align="center">✉️ LePatron.email</h1>
<h2 align="center">🚀 Deploy on the Cloud</h2>

## How to deploy on Heroku:

#### Prerequired:

- Hosted and accessible `Mongo DB`
- `Aws` bucket
- Mail provider choosen from the list below

#### Steps:

1. Fork the `github repo`.
2. Go to heroku, press `New` then Click on `Create new app`
3. Select you app name, and choose a server location ( this will affect your server ping ), then press `create app`.
4. Go to deploy tab, In the deployment method click on `Github connect`, search for you repo nam and then click on `connect`.
5. In the `Automatic deploys` section, Click on `Enable automatic deploys`.
6. Go to `Settings` tab, Flow readme instruction for [configuring heroku environments variables](./packages/documentation/heroku-configuration.md##-configuring-heroku-environments-variables).
7. Go back on the `Deploy` tab, in the `Manual deploy` section, click on `deploy branch`. You got your application up and running now.

---

## How to deploy on Clever Cloud:

After forking repo:

#### From Clever Cloud console:

1.Select Create -> an application 2. `Create Brand new app` 3. Select `Node`, Click Next 4. Select App name and the description and location, example in our case the name is `badsender-app`, Click `create` 5. Add all environment variables from [configuring heroku environments variables](./packages/documentation/heroku-configuration.md##-configuring-heroku-environments-variables).

5. Deploy your application
   Using CLI
   You must commit before deploy

`git commit -m "Clever deploy"`

then run :

`clever deploy`

Using gitlab CI
define $CLEVER_TOKEN and CLEVER_SECRET to gitlab CI/CD environment variables

add this stage to your .gitlab-ci.yml

```
deploy-to-clever-env:
stage: deploy
variables:
APP_NAME: [clever cloud app name]
APP_ID: [clever cloud app id]
script:
- wget https://clever-tools.cellar.services.clever-cloud.com/releases/latest/clever-tools-latest_linux.tar.gz
- tar xvzf clever-tools-latest_linux.tar.gz
- ./clever-tools-latest_linux/clever login --token $CLEVER_TOKEN --secret $CLEVER_SECRET
- ./clever-tools-latest_linux/clever link ${APP_ID}
- ./clever-tools-latest_linux/clever deploy -a ${APP_NAME}
environment:
name: [env name]
url: https://${APP_NAME}.cleverapps.io

```
