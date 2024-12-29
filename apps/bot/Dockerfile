# FROM node:23-alpine

# # Install tini
# RUN apk add --no-cache tini

# # Create the bot's directory
# WORKDIR /app
# RUN apk add --no-cache openssl

# # Build arguments for environment variables
# ARG DATABASE_URL
# ENV DATABASE_URL=${DATABASE_URL}

# # Copy necessary files
# COPY package.json yarn.lock /app/
# COPY ./apps/bot/src /app/src
# COPY ./libs/models/prisma /app/prisma
# # COPY tsconfig.json /app/
# # COPY .yarnrc.yml /app/
# COPY .yarn /app/.yarn

# RUN ls -la /app

# # Install dependencies and build the bot's source code
# # RUN yarn install && yarn build && rm -rf /app/src
# RUN yarn install && npx nx build bot && rm -rf /app/src

# # Expose the bot's port
# EXPOSE 3000

# # Use tini as the init system
# ENTRYPOINT ["/sbin/tini", "--"]

# # Run migrations and start the bot
# # Don't use npm start because node will run a sub-process of npm and won't receive signals
# CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]



# Build the docker image with `npx nx run cat-fostering-api:container`.
# Tip: Modify "container" options in project.json to change docker build args.
#
# Run the container with `docker run -e ORY_ACTION_API_KEY='hello' -e POSTGRES_URL='postgres://dbuser:secret@postgres:5432/appdb' --network cat-fostering_ory -p 3000:3000 -t ghcr.io/getlarge/cat-fostering/cat-fostering-api:latest`.


ARG NODE_VERSION=23

FROM node:${NODE_VERSION} AS deps

WORKDIR /app

RUN echo "Building bot image with NODE_VERSION=${NODE_VERSION}"

COPY ./dist/apps/bot/package.json ./dist/apps/bot/yarn.lock ./

RUN yarn install
RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN node-prune

### 
FROM node:${NODE_VERSION}-alpine
USER node

ENV NODE_ENV=development
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app ./
COPY --chown=node:node ./dist/apps/bot ./

CMD ["node", "index.js"]

