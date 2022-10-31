import { DataSource } from 'typeorm';

const myDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: ['src/db/models/*.entity.ts'],
  logging: false,
  synchronize: true,
});

export default myDataSource;
