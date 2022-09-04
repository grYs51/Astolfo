FROM node:latest

# Create the bot's directory
RUN mkdir -p /usr/src/astolfo
WORKDIR /usr/src/astolfo

RUN npm i ffmpeg-static


# COPY package.json /usr/src/api
# RUN npm install

# Start the bot.
CMD ["node", "/dist/index.js"]