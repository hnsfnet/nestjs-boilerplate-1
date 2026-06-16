import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';

import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import path from 'path';
import { AllConfigType } from '../config/config.type';

interface TemplatedMailOptions {
  to: string;
  titleKey: string;
  textKeys: string[];
  templateName: string;
  urlPath: string;
  query?: Record<string, string>;
}

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async userSignUp(mailData: MailData<{ hash: string }>): Promise<void> {
    await this.sendTemplatedMail({
      to: mailData.to,
      titleKey: 'common.confirmEmail',
      textKeys: [
        'confirm-email.text1',
        'confirm-email.text2',
        'confirm-email.text3',
      ],
      templateName: 'activation.hbs',
      urlPath: '/confirm-email',
      query: { hash: mailData.data.hash },
    });
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    await this.sendTemplatedMail({
      to: mailData.to,
      titleKey: 'common.resetPassword',
      textKeys: [
        'reset-password.text1',
        'reset-password.text2',
        'reset-password.text3',
        'reset-password.text4',
      ],
      templateName: 'reset-password.hbs',
      urlPath: '/password-change',
      query: {
        hash: mailData.data.hash,
        expires: mailData.data.tokenExpires.toString(),
      },
    });
  }

  async confirmNewEmail(mailData: MailData<{ hash: string }>): Promise<void> {
    await this.sendTemplatedMail({
      to: mailData.to,
      titleKey: 'common.confirmEmail',
      textKeys: [
        'confirm-new-email.text1',
        'confirm-new-email.text2',
        'confirm-new-email.text3',
      ],
      templateName: 'confirm-new-email.hbs',
      urlPath: '/confirm-new-email',
      query: { hash: mailData.data.hash },
    });
  }

  private async sendTemplatedMail(
    options: TemplatedMailOptions,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let title: MaybeType<string>;
    let texts: MaybeType<string>[] = [];

    if (i18n) {
      const translations = (await Promise.all([
        i18n.t(options.titleKey),
        ...options.textKeys.map((key) => i18n.t(key)),
      ])) as MaybeType<string>[];
      title = translations[0];
      texts = translations.slice(1);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + options.urlPath,
    );
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const textContext: Record<string, MaybeType<string>> = {};
    options.textKeys.forEach((_key, index) => {
      textContext[`text${index + 1}`] = texts[index];
    });

    await this.mailerService.sendMail({
      to: options.to,
      subject: title,
      text: `${url.toString()} ${title}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        options.templateName,
      ),
      context: {
        title,
        url: url.toString(),
        actionTitle: title,
        app_name: this.configService.get('app.name', { infer: true }),
        ...textContext,
      },
    });
  }
}
