FROM node:latest

# Create the bot's directory
RUN mkdir -p /usr/src/astolfo
WORKDIR /usr/src/astolfo

COPY package.json /usr/src/astolfo

# Install dependencies
RUN npm install

# Copy the bot's source code
COPY . /usr/src/astolfo

# Build the bot's source code
RUN npm run build

RUN cp -r /usr/src/astolfo/dist /usr/src/astolfo/dist

RUN cp -r /usr/src/astolfo/node_modules /usr/src/astolfo/node_modules

RUN rm -rf /usr/src/astolfo/src

# Run the bot
CMD ["npm", "run", "start"]
