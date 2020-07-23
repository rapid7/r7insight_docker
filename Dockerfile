# r7insight_docker arm alpine base

FROM arm32v7/node:12-alpine

LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"

RUN apk add --no-cache bash

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json index.js VERSION package-lock.json ./
RUN npm install

ENTRYPOINT ["/usr/src/app/index.js"]
CMD []
