import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

import { isDocumentDatabase } from './database-type.helper';
import { MongooseConfigService } from './options/mongoose-config.service';
import { TypeOrmConfigService } from './options/typeorm-config.service';

/**
 * Centralises the decision of which database driver the application boots
 * with. The rest of the codebase should not need to know whether we are
 * running against a relational (TypeORM) or document (Mongoose) store -
 * importing `DatabaseModule.forRoot()` is enough.
 *
 * The database-type branch lives in {@link isDocumentDatabase} so that this
 * module only coordinates *which* driver is wired up, not *how*. Driver
 * connection options are assembled by {@link TypeOrmConfigService} and
 * {@link MongooseConfigService} respectively.
 */
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const databaseDriverModule = isDocumentDatabase()
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
