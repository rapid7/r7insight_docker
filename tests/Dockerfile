# r7insight_docker unit-test image

FROM node:12.13.0-buster
LABEL maintainer="Rapid 7 - Platform Support <platformsupport@rapid7.com>"

ENV NODE_ENV development

WORKDIR /app
COPY package.json index.js VERSION ./
COPY tests tests
#   Install required packages in `package.json` and mocha cli tool
RUN npm update && npm i && npm i -g mocha

CMD ["mocha", "tests/**/test*.js", "--reporter", "spec"]
