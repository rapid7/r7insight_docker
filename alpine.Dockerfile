# r7insight_docker alpine base

FROM mhart/alpine-node:12.13.0
LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"
RUN apk add --no-cache bash

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json index.js VERSION package-lock.json ./
RUN npm install

ENTRYPOINT ["npm", "run", "start", "--"]

CMD []
