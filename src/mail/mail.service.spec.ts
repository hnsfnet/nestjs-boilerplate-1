import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import path from 'path';
import { MailService } from './mail.service';
import { MailerService } from '../mailer/mailer.service';

describe('MailService', () => {
  let service: MailService;
  const sendMail = jest.fn();

  const templatePath = (name: string) =>
    path.join('/work', 'src', 'mail', 'mail-templates', name);

  beforeEach(async () => {
    jest.clearAllMocks();

    const configService = {
      get: jest.fn((key: string) =>
        key === 'app.name' ? 'TestApp' : undefined,
      ),
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'app.frontendDomain':
            return 'https://example.com';
          case 'app.workingDirectory':
            return '/work';
          default:
            return undefined;
        }
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: { sendMail } },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(MailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with an active i18n context', () => {
    beforeEach(() => {
      jest.spyOn(I18nContext, 'current').mockReturnValue({
        t: jest.fn().mockResolvedValue('translated'),
      } as any);
    });

    it('userSignUp builds the activation mail with the confirm-email link', async () => {
      await service.userSignUp({
        to: 'user@example.com',
        data: { hash: 'abc' },
      });

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'translated',
        text: 'https://example.com/confirm-email?hash=abc translated',
        templatePath: templatePath('activation.hbs'),
        context: {
          title: 'translated',
          url: 'https://example.com/confirm-email?hash=abc',
          actionTitle: 'translated',
          app_name: 'TestApp',
          text1: 'translated',
          text2: 'translated',
          text3: 'translated',
        },
      });
    });

    it('forgotPassword keeps both hash and expires query params and four text blocks', async () => {
      await service.forgotPassword({
        to: 'user@example.com',
        data: { hash: 'abc', tokenExpires: 1700000000000 },
      });

      const url =
        'https://example.com/password-change?hash=abc&expires=1700000000000';
      expect(sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'translated',
        text: `${url} translated`,
        templatePath: templatePath('reset-password.hbs'),
        context: {
          title: 'translated',
          url,
          actionTitle: 'translated',
          app_name: 'TestApp',
          text1: 'translated',
          text2: 'translated',
          text3: 'translated',
          text4: 'translated',
        },
      });
    });

    it('confirmNewEmail targets the confirm-new-email template and route', async () => {
      await service.confirmNewEmail({
        to: 'new@example.com',
        data: { hash: 'xyz' },
      });

      expect(sendMail).toHaveBeenCalledWith({
        to: 'new@example.com',
        subject: 'translated',
        text: 'https://example.com/confirm-new-email?hash=xyz translated',
        templatePath: templatePath('confirm-new-email.hbs'),
        context: {
          title: 'translated',
          url: 'https://example.com/confirm-new-email?hash=xyz',
          actionTitle: 'translated',
          app_name: 'TestApp',
          text1: 'translated',
          text2: 'translated',
          text3: 'translated',
        },
      });
    });
  });

  it('falls back to undefined strings when no i18n context is present', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue(undefined);

    await service.userSignUp({ to: 'user@example.com', data: { hash: 'abc' } });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: undefined,
        text: 'https://example.com/confirm-email?hash=abc undefined',
        context: expect.objectContaining({
          title: undefined,
          app_name: 'TestApp',
          text1: undefined,
          text2: undefined,
          text3: undefined,
        }),
      }),
    );
  });
});
