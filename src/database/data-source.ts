import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';

import databaseConfig from './config/database.config';
import { DatabaseConfig } from './config/database-config.type';

/**
 * Standalone `DataSource` used by the TypeORM CLI (migrations, schema sync).
 *
 * Runs outside the Nest DI container, so it cannot rely on `ConfigService`.
 * Instead it reads from the same {@link databaseConfig} loader that the rest
 * of the application uses, keeping field names and defaults in one place.
 */
const db = databaseConfig() as DatabaseConfig;

export const AppDataSource = new DataSource({
  type: db.type as DataSourceOptions['type'],
  url: db.url,
  host: db.host,
  port: db.port ?? 5432,
  username: db.username,
  password: db.password,
  database: db.name,
  synchronize: db.synchronize,
  dropSchema: false,
  keepConnectionAlive: true,
  logging: process.env.NODE_ENV !== 'production',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  cli: {
    entitiesDir: 'src',

    subscribersDir: 'subscriber',
  },
  extra: {
    // based on https://node-postgres.com/api/pool
    // max connection pool size
    max: db.maxConnections,
    ssl: db.sslEnabled
      ? {
          rejectUnauthorized: db.rejectUnauthorized,
          ca: db.ca ?? undefined,
          key: db.key ?? undefined,
          cert: db.cert ?? undefined,
        }
      : undefined,
  },
} as DataSourceOptions);
