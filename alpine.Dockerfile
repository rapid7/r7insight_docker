# r7insight_docker alpine base

FROM mhart/alpine-node:12.13.0
LABEL maintainer="Rapid 7 - Platform Support <platformsupport@rapid7.com>"
RUN apk add --no-cache bash

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json index.js VERSION ./
RUN npm install --production

ENTRYPOINT ["/usr/src/app/index.js"]
CMD []
