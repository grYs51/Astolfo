FROM node:16-alpine

RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

COPY dist/ /usr/src/bot
COPY package*.json ./

RUN npm install

## following 3 lines are for installing ffmepg
RUN apt update
RUN apt install ffmpeg

COPY . .

EXPOSE 3000

RUN npm run build

CMD [ "node", "dist/index.js" ]