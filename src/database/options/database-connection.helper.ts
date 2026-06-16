import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';

/**
 * Common connection parameters shared by every database driver.
 *
 * Both TypeORM and Mongoose need the same handful of fields (url, host, port,
 * credentials, database name). Extracting them here means each driver-specific
 * config service only has to map these values to its own option shape, rather
 * than re-reading the same keys from `ConfigService`.
 */
export interface DatabaseConnectionParams {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  name?: string;
}

/**
 * Read the shared connection fields from the centralised `database.*` config
 * namespace.  Used by {@link TypeOrmConfigService} and
 * {@link MongooseConfigService} so that adding a new shared field only requires
 * a change in one place.
 */
export function buildConnectionParams(
  configService: ConfigService<AllConfigType>,
): DatabaseConnectionParams {
  return {
    url: configService.get('database.url', { infer: true }),
    host: configService.get('database.host', { infer: true }),
    port: configService.get('database.port', { infer: true }),
    username: configService.get('database.username', { infer: true }),
    password: configService.get('database.password', { infer: true }),
    name: configService.get('database.name', { infer: true }),
  };
}
