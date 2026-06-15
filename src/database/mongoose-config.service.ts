/**
 * Back-compat re-export.
 *
 * The Mongoose config service now lives under `./options/` alongside the other
 * database assembly helpers. This shim keeps the historic import path working
 * for existing consumers (e.g. the document seed module) so they don't all
 * need to be touched in the same change.
 */
export { MongooseConfigService } from './options/mongoose-config.service';
