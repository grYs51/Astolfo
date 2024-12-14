FROM node:23-alpine

# Create the bot's directory
WORKDIR /app
RUN apk add --no-cache openssl

# Build arguments for environment variables
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

#show yarn version
COPY package.json /app
COPY yarn.lock /app
COPY src /app/src
COPY prisma /app/prisma
COPY tsconfig.json /app
COPY .yarnrc.yml /app
COPY .yarn /app/.yarn

# Build the bot's source code
RUN yarn install && yarn build && rm -rf /app/src

# Expose the bot's port
EXPOSE 3000

# Run migrations and start the bot
CMD ["sh", "-c", "npx prisma migrate deploy && yarn start"]