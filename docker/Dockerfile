FROM node:10

ENV NODE_ENV=development

RUN apt install bzip2 tar git imagemagick

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install

RUN npm i -g grunt-cli

RUN mkdir -p /home/node/app
RUN mkdir -p /home/node/app/node_modules/

WORKDIR /home/node/app

COPY ./mosaico .

RUN chown -R node:node /home/node
USER node

RUN yarn install

EXPOSE 3000

CMD ["yarn", "dev"]
