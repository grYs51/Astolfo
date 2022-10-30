import * as mongo from './src/db';

/* add here your specific jest setup */
process.env.LOG_LEVEL = 'fatal';

const client = mongo.createClient('mongodb://localhost/t-profile-gen-test');

beforeAll(() => mongo.connect(client));
afterAll(() => mongo.disconnect());
