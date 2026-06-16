import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import path from 'path';

import { AuthAppleModule } from './auth-apple/auth-apple.module';
import { AuthFacebookModule } from './auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from './auth-google/auth-google.module';
import { AuthModule } from './auth/auth.module';
import { AllConfigType } from './config/config.type';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { HomeModule } from './home/home.module';
import { MailModule } from './mail/mail.module';
import { MailerModule } from './mailer/mailer.module';
import { SessionModule } from './session/session.module';
import { UsersModule } from './users/users.module';

// --- config loaders (grouped by concern) ---
// Core
import appConfig from './config/app.config';
import databaseConfig from './database/config/database.config';
// Auth
import authConfig from './auth/config/auth.config';
import appleConfig from './auth-apple/config/apple.config';
import facebookConfig from './auth-facebook/config/facebook.config';
import googleConfig from './auth-google/config/google.config';
// Features
import fileConfig from './files/config/file.config';
import mailConfig from './mail/config/mail.config';

/**
 * All config loaders in one place so the `ConfigModule.forRoot` call below
 * stays declarative.  Add new loaders here — not inline in the `load` array —
 * so the list remains easy to scan.
 */
const configLoaders = [
  // Core
  appConfig,
  databaseConfig,
  // Auth
  authConfig,
  appleConfig,
  facebookConfig,
  googleConfig,
  // Features
  fileConfig,
  mailConfig,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      envFilePath: ['.env'],
    }),
    DatabaseModule.forRoot(),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
  ],
})
export class AppModule {}
