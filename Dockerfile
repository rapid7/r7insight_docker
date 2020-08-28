# r7insight_docker

FROM node:12.13.0-buster
LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json index.js VERSION package-lock.json ./
RUN npm install

ENTRYPOINT ["npm", "run", "start", "--"]
CMD []
