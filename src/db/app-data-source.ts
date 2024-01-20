import path from 'path';
import { DataSource } from 'typeorm';

const myDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT as unknown as number,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  logging: false,
  synchronize: true,
});

export default myDataSource;
