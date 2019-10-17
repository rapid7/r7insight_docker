# r7insight_docker unit-test image

FROM node:12.12.0-stretch
LABEL maintainer="Rapid 7 - Logentries <support@logentries.com>"

ENV NODE_ENV development

WORKDIR /app
COPY package.json index.js VERSION ./
COPY tests tests
#   Install required packages in `package.json` and mocha cli tool
RUN npm update && npm i && npm i -g mocha

CMD ["mocha", "tests/**/test*.js", "--reporter", "spec"]
