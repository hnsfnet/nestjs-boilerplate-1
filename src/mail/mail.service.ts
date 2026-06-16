import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';

import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import path from 'path';
import { AllConfigType } from '../config/config.type';

interface MailDescriptor<T = Record<string, unknown>> {
  templateName: string;
  titleKey: string;
  textKeys: string[];
  urlPath: string;
  buildUrlParams: (data: T) => Record<string, string>;
}

const MAIL_DESCRIPTORS: {
  signUp: MailDescriptor<{ hash: string }>;
  forgotPassword: MailDescriptor<{ hash: string; tokenExpires: number }>;
  confirmNewEmail: MailDescriptor<{ hash: string }>;
} = {
  signUp: {
    templateName: 'activation.hbs',
    titleKey: 'common.confirmEmail',
    textKeys: ['confirm-email.text1', 'confirm-email.text2', 'confirm-email.text3'],
    urlPath: '/confirm-email',
    buildUrlParams: (data) => ({ hash: data.hash }),
  },
  forgotPassword: {
    templateName: 'reset-password.hbs',
    titleKey: 'common.resetPassword',
    textKeys: [
      'reset-password.text1',
      'reset-password.text2',
      'reset-password.text3',
      'reset-password.text4',
    ],
    urlPath: '/password-change',
    buildUrlParams: (data) => ({
      hash: data.hash,
      expires: data.tokenExpires.toString(),
    }),
  },
  confirmNewEmail: {
    templateName: 'confirm-new-email.hbs',
    titleKey: 'common.confirmEmail',
    textKeys: [
      'confirm-new-email.text1',
      'confirm-new-email.text2',
      'confirm-new-email.text3',
    ],
    urlPath: '/confirm-new-email',
    buildUrlParams: (data) => ({ hash: data.hash }),
  },
};

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async userSignUp(mailData: MailData<{ hash: string }>): Promise<void> {
    await this.send(MAIL_DESCRIPTORS.signUp, mailData);
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    await this.send(MAIL_DESCRIPTORS.forgotPassword, mailData);
  }

  async confirmNewEmail(mailData: MailData<{ hash: string }>): Promise<void> {
    await this.send(MAIL_DESCRIPTORS.confirmNewEmail, mailData);
  }

  private async send<T>(
    descriptor: MailDescriptor<T>,
    mailData: MailData<T>,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let title: MaybeType<string>;
    const texts: MaybeType<string>[] = [];

    if (i18n) {
      const translations = await Promise.all([
        i18n.t(descriptor.titleKey),
        ...descriptor.textKeys.map((key) => i18n.t(key)),
      ]);
      title = translations[0];
      for (let i = 1; i < translations.length; i++) {
        texts.push(translations[i]);
      }
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + descriptor.urlPath,
    );
    const urlParams = descriptor.buildUrlParams(mailData.data);
    for (const [key, value] of Object.entries(urlParams)) {
      url.searchParams.set(key, value);
    }

    const context: Record<string, MaybeType<string>> = {
      title,
      url: url.toString(),
      actionTitle: title,
      app_name: this.configService.get('app.name', { infer: true }),
    };
    texts.forEach((text, index) => {
      context[`text${index + 1}`] = text;
    });

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: title,
      text: `${url.toString()} ${title}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        descriptor.templateName,
      ),
      context,
    });
  }
}
