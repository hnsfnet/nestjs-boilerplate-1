import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';

/**
 * Build the TypeORM `extra.ssl` block from the shared `database.*` config.
 *
 * Extracted so that any future consumer that needs to assemble the same SSL
 * shape (e.g. a standalone DataSource used by the TypeORM CLI, a health check
 * probe, or a custom connection factory) can reuse it instead of re-reading
 * the same env fields.
 */
export function buildTypeOrmSslOptions(
  configService: ConfigService<AllConfigType>,
):
  | {
      rejectUnauthorized: boolean;
      ca: string | undefined;
      key: string | undefined;
      cert: string | undefined;
    }
  | undefined {
  const sslEnabled = configService.get('database.sslEnabled', { infer: true });
  if (!sslEnabled) {
    return undefined;
  }
  return {
    rejectUnauthorized: configService.get('database.rejectUnauthorized', {
      infer: true,
    }),
    ca: configService.get('database.ca', { infer: true }) ?? undefined,
    key: configService.get('database.key', { infer: true }) ?? undefined,
    cert: configService.get('database.cert', { infer: true }) ?? undefined,
  };
}
