FROM node:16.14.2-bullseye-slim

LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"

ENV NODE_ENV production

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY index.js ./

ENTRYPOINT ["npm", "start", "--"]

CMD []
