export const environment = {
    // The API is served from its own host in production (CORS on the bot
    // allows https://astolfo.grys.dev). This must be a literal: process.env
    // doesn't exist in the browser bundle and nothing substitutes it at build.
    BACKEND_URL: 'https://astolfo-api.grys.dev',
    production: true,
};
