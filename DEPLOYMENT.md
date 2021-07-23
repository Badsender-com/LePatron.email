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

After forking the repo:

### From Clever Cloud console:

1.Select Create -> an application -> `Create Brand new app` 2. Select `Node`, Click `Next` 3. Select App name and the description and location, example in our case the name is `badsender-app`, Click `create` 4. Add all environment variables from [configuring heroku environments variables](./packages/documentation/heroku-configuration.md##-configuring-heroku-environments-variables).

#### Using Clever tools

1. You must commit before deploy `git commit -m "Clever deploy"`
2. Install and follow setup instructions [Clever tools](https://github.com/CleverCloud/clever-tools)
3. Link the existing application to your local repo with `clever link [--org <ORG-NAME>] <APP-NAME> [--alias <alias>]`
4. Add this environment variable `CC_POST_BUILD_HOOK = yarn build`
5. Deploy the application by running `clever deploy [--alias <alias>]`
