import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { AllConfigType } from '../../config/config.type';
import { buildConnectionParams } from './database-connection.helper';
import { buildTypeOrmSslOptions } from './ssl-options.helper';

/**
 * Assembles TypeORM driver options from the shared `database.*` config
 * namespace.
 *
 * Shared connection fields (url, host, port, credentials, name) come from
 * {@link buildConnectionParams} so they stay in sync with the Mongoose driver.
 * TypeORM-specific settings — entity paths, migrations, pool sizing, SSL —
 * are handled here because they don't apply to any other driver.
 */
@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const connection = buildConnectionParams(this.configService);

    return {
      type: this.configService.get('database.type', { infer: true }),
      url: connection.url,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      database: connection.name,
      synchronize: this.configService.get('database.synchronize', {
        infer: true,
      }),
      dropSchema: false,
      keepConnectionAlive: true,
      logging:
        this.configService.get('app.nodeEnv', { infer: true }) !== 'production',
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
      cli: {
        entitiesDir: 'src',

        subscribersDir: 'subscriber',
      },
      extra: {
        // based on https://node-postgres.com/apis/pool
        // max connection pool size
        max: this.configService.get('database.maxConnections', { infer: true }),
        ssl: buildTypeOrmSslOptions(this.configService),
      },
    } as TypeOrmModuleOptions;
  }
}
