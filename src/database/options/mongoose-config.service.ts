import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MongooseModuleOptions,
  MongooseOptionsFactory,
} from '@nestjs/mongoose';
import { AllConfigType } from '../../config/config.type';
import mongooseAutoPopulate from 'mongoose-autopopulate';
import { buildConnectionParams } from './database-connection.helper';

/**
 * Assembles Mongoose driver options from the shared `database.*` config
 * namespace.
 *
 * Shared connection fields (url, credentials, database name) come from
 * {@link buildConnectionParams} so they stay in sync with the TypeORM driver.
 * Mongoose-specific settings — such as the `connectionFactory` plugin
 * registration — are handled here because they don't apply to any other
 * driver.
 */
@Injectable()
export class MongooseConfigService implements MongooseOptionsFactory {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  createMongooseOptions(): MongooseModuleOptions {
    const { url, name, username, password } = buildConnectionParams(
      this.configService,
    );

    return {
      uri: url,
      dbName: name,
      user: username,
      pass: password,
      connectionFactory(connection) {
        connection.plugin(mongooseAutoPopulate);
        return connection;
      },
    };
  }
}
