FROM node:16.14.2-alpine3.15

LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"

RUN apk add --no-cache bash

ENV NODE_ENV production

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY index.js ./

ENTRYPOINT ["npm", "start", "--"]

CMD []
