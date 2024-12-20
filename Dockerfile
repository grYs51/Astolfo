FROM node:23-alpine

# Install system packages first
RUN apk add --no-cache tini openssl

# Create a non-root user
RUN addgroup -S bot \
    && adduser -S bot -G bot

# Switch to non-root user
USER bot

# Create the bot's directory
WORKDIR /app

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
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]