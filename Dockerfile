FROM mhart/alpine-node:8

WORKDIR /app
EXPOSE 80
ARG NODE_ENV='development'
CMD ["node", "lib/index.js"]

RUN apk add --no-cache git

COPY package.json /app/package.json

RUN npm install

COPY lib /app/lib
COPY test /app/test
RUN if [ ${NODE_ENV} == "production" ] rm -rf /app/test
