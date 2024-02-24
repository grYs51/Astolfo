FROM node:latest

# Create the bot's directory
WORKDIR /app

COPY package.json /app
COPY yarn.lock /app
COPY src /app/src
COPY prisma /app/prisma
# COPY .env /app
COPY tsconfig.json /app

# Build the bot's source code
RUN yarn install --pure-lockfile

RUN npm run build

RUN rm -rf /app/src

# Expose the bot's port
EXPOSE 3000

# Run the bot
CMD ["npm", "run", "start"]
