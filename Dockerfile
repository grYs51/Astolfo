FROM node:23-alpine

# Install tini
RUN apk add --no-cache tini

# Create the bot's directory
WORKDIR /app
RUN apk add --no-cache openssl

# Build arguments for environment variables
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Copy necessary files
COPY package.json yarn.lock /app/
COPY src /app/src
COPY prisma /app/prisma
COPY tsconfig.json /app/
COPY .yarnrc.yml /app/
COPY .yarn /app/.yarn

# Install dependencies and build the bot's source code
RUN yarn install && yarn build && rm -rf /app/src

# Expose the bot's port
EXPOSE 3000

# Use tini as the init system
ENTRYPOINT ["/sbin/tini", "--"]

# Run migrations and start the bot
# Don't use npm start because node will run a sub-process of npm and won't receive signals
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]