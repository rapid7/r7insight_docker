# docker-logentries

FROM node:0.12-onbuild
LABEL maintainer="Rapid 7 - Logentries <support@logentries.com>"

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json index.js VERSION ./
RUN npm install --production && npm cache clean

ENTRYPOINT ["/usr/src/app/index.js"]
CMD []
