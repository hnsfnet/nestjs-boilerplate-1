/**
 * Back-compat re-export.
 *
 * The TypeORM config service now lives under `./options/` alongside the other
 * database assembly helpers. This shim keeps the historic import path working
 * for existing consumers (e.g. the relational seed module, the TypeORM CLI
 * data source) so they don't all need to be touched in the same change.
 */
export { TypeOrmConfigService } from './options/typeorm-config.service';
