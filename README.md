<h1 align="center">✉️ LePatron.email</h1>
<h2 align="center">Open Source Email Builder</h2>

---

## 🚀 Deploy on the Cloud

## How to deploy on Heroku:

#### Prerequired:

- Hosted and accessible `Mongo DB`
- `Aws` bucket

#### Steps:

1. Fork the `github repo`.
2. Go to heroku, press `New` then Click on `Create new app`
3. Select you app name, and choose a server location ( this will affect your server ping ), then press `create app`.
4. Go to deploy tab, In the deployment method click on `Github connect`, search for you repo nam and then click on `connect`.
5. In the `Automatic deploys` section, Click on `Enable automatic deploys`.
6. Go to `Settings` tab, Flow readme instruction for [configuring heroku environments variables](./packages/documentation/heroku-configuration.md##-configuring-heroku-environments-variables).
7. Go back on the `Deploy` tab, in the `Manual deploy` section, click on `deploy branch`. You got your application up and running now.

---

## Run locally

### 1. Install dependencies

```bash
yarn
yarn build
```

### 2. Run the database

```bash
yarn docker:up
```

(You will be able to stop the docker compose with `yarn docker:down`)

### 3. Run the application

```bash
yarn dev
```

The application is available on [localhost:3000](http://localhost:3000)

Login with

- **Email:** admin
- **Password:** admin

A catch all mailbox is available on [localhost:1080](http://localhost:1080/)

## Access to the database

- You need MongoDB on your computer. If you haven't, you can install [MongoDB Compass](https://www.mongodb.com/try/download/compass)
- Install the version you need
- In a shell terminal, launch the following commands:

```bash
docker ps # Check if your database docker container is launched
docker exec -it lepatron_mongo_container bash # Run command prompt on your docker container
mongo # To see the mongo connection name
```

- The connection name looks something like `mongodb://127.0.0.1:27017/?compressors=disabled&gssapiServiceName=mongodb`
- Remove all the queries parameters to have : `mongodb://127.0.0.1:27017/`
- Paste it in MongoDB Compass UI
- You have access to your database

## Generate documentation

### Run application documentation

```bash
yarn docs:dev
```

### Build application documentation

```bash
yarn docs:dev:build
```

### Run API documentation

```bash
yarn docs:api
```

### Build API documentation

```bash
yarn docs:api:build
```

### Troubleshooting

If you encounter this error during documentation generation :

```
(node:24453) UnhandledPromiseRejectionWarning: Error: EACCES: permission denied, scandir '.../.mongodb/diagnostic.data'
```

Simply give access to .mongodb folder to your user :

```
chown $(whoami):$(whoami) -R ./.mongodb
```

---

## License

**GPL-3.0**
