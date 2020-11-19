# r7insight_docker

# FROM node:12.13.0-buster
FROM node:12.13.0
LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"

ENV NODE_ENV production

# RUN apk add bind-tools bash

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY index.js ./

ENTRYPOINT ["npm", "start", "--"]

CMD []
