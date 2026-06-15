import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

import databaseConfig from './config/database.config';
import { DatabaseConfig } from './config/database-config.type';
import { MongooseConfigService } from './options/mongoose-config.service';
import { TypeOrmConfigService } from './options/typeorm-config.service';

/**
 * Centralises the decision of which database driver the application boots
 * with. The rest of the codebase should not need to know whether we are
 * running against a relational (TypeORM) or document (Mongoose) store -
 * importing `DatabaseModule.forRoot()` is enough.
 *
 * The actual connection options for each driver are assembled by
 * {@link TypeOrmConfigService} and {@link MongooseConfigService} so that this
 * module only coordinates *which* one is wired up, not *how*.
 */
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const databaseChoice = (databaseConfig() as DatabaseConfig)
      .isDocumentDatabase;

    const databaseDriverModule = databaseChoice
      ? MongooseModule.forRootAsync({
          useClass: MongooseConfigService,
        })
      : TypeOrmModule.forRootAsync({
          useClass: TypeOrmConfigService,
          dataSourceFactory: async (options: DataSourceOptions) => {
            return new DataSource(options).initialize();
          },
        });

    return {
      module: DatabaseModule,
      imports: [databaseDriverModule],
      exports: [databaseDriverModule],
    };
  }
}
