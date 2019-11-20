# r7insight_docker

FROM node:0.12-onbuild
LABEL maintainer="Rapid 7 - InsightOps Team <InsightOpsTeam@rapid7.com>"

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json index.js VERSION ./
RUN npm install --production

ENTRYPOINT ["/usr/src/app/index.js"]
CMD []
