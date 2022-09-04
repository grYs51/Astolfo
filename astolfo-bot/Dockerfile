FROM node:latest

RUN mkdir -p /usr/src/bot

WORKDIR /usr/src/bot

COPY dist/ /usr/src/bot
COPY .env /usr/src/bot

COPY package*.json ./

RUN npm install

EXPOSE 3000

# RUN npm run build

CMD [ "node", "index.js" ]