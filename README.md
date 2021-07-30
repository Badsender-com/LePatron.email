<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/Badsender-com/LePatron.email">
    <img src="public/media/logo_blanc.png" alt="Logo">
  </a>

  <h3 align="center">LePatron.email</h3>

  <p align="center">
    Open source email builder
    <br />
    <br />
    <a href="https://github.com/Badsender-com/LePatron.email/issues">Report Bug</a>
    ·
    <a href="https://github.com/Badsender-com/LePatron.email/issues">Request Feature</a>
  </p>
</p>

<!-- ABOUT THE PROJECT -->

## About The Project

**LePatron is an email builder allowing to industrialize your email template production. Build tailor made email templates and make them available to your non-technical users.**

### Built With

- [Mosaico](https://github.com/voidlabs/mosaico)
- [Vue.js](https://vuejs.org/)
- [Express](https://expressjs.com/)

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

You will need the following tools to be able to run the project locally:

- [Node](https://nodejs.org)
- [Yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/get-started) 💡 Make sure you can run `docker-compose` in you terminal

### Installation

1. Clone the repo

   ```sh
   git clone https://github.com/Badsender-com/LePatron.email.git
   ```

2. Install NPM packages

   ```bash
   yarn
   yarn build
   ```

3. Run the local database

   ```bash
   yarn docker:up
   ```

   (You will be able to stop the docker compose with `yarn docker:down`)

4. Run the application

   ```bash
   yarn dev
   ```

   The application is available on [localhost:3000](http://localhost:3000)

   Login with

   - **Email:** admin
   - **Password:** admin

   A catch all mailbox is available on [localhost:1080](http://localhost:1080/)

### Database access

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

### Documentation generation

#### Run application documentation

```bash
yarn docs:dev
```

#### Build application documentation

```bash
yarn docs:dev:build
```

#### Run API documentation

```bash
yarn docs:api
```

#### Build API documentation

```bash
yarn docs:api:build
```

## Tests

When you open a feature / fix PR, make sure to include tests that covers this feature.

Units tests are written using the [jest](https://jestjs.io/) testing framework.

```bash
yarn test # run tests in watch mode, usefull when developing
yarn test-ci # run all tests, no watch. Mainly used in the CI
```

## Deployment

Instructions on how to deploy on [Heroku](./DEPLOYMENT.md##-How-to-deploy-on-Heroku:) and [CleverCloud](./DEPLOYMENT.md##-How-to-deploy-on-CleverCloud) are provided in the readme file.

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feat/AmazingFeature`)
5. Open a Pull Request

## Troubleshooting

If you encounter this error during documentation generation :

```
(node:24453) UnhandledPromiseRejectionWarning: Error: EACCES: permission denied, scandir '.../.mongodb/diagnostic.data'
```

Simply give access to .mongodb folder to your user :

```
chown $(whoami):$(whoami) -R ./.mongodb
```

<!-- LICENSE -->

## License

Distributed under the GPL-3.0 License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

Project Link: [https://lepatron.email/](https://lepatron.email/)
