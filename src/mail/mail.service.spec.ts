import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailerService } from '../mailer/mailer.service';
import { I18nContext } from 'nestjs-i18n';

describe('MailService', () => {
  let service: MailService;
  let mailerService: { sendMail: jest.Mock };
  let mockI18n: { t: jest.Mock };

  const translations: Record<string, string> = {
    'common.confirmEmail': 'Confirm email',
    'common.resetPassword': 'Reset password',
    'confirm-email.text1': 'Hey!',
    'confirm-email.text2': 'Welcome',
    'confirm-email.text3': 'Click to confirm',
    'confirm-new-email.text1': 'Hey!',
    'confirm-new-email.text2': 'Email change',
    'confirm-new-email.text3': 'Click to confirm',
    'reset-password.text1': 'Hey!',
    'reset-password.text2': 'Forgot password?',
    'reset-password.text3': 'Click to reset',
    'reset-password.text4': 'Ignore if not you',
  };

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    mockI18n = {
      t: jest.fn((key: string) => Promise.resolve(translations[key])),
    };

    jest.spyOn(I18nContext, 'current').mockReturnValue(mockI18n as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailerService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'app.frontendDomain') return 'https://example.com';
              if (key === 'app.workingDirectory') return '/app';
              throw new Error(`Unknown config key: ${key}`);
            }),
            get: jest.fn((key: string) => {
              if (key === 'app.name') return 'TestApp';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('userSignUp', () => {
    it('should send sign-up email with correct template and context', async () => {
      await service.userSignUp({ to: 'user@example.com', data: { hash: 'abc123' } });

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      const call = mailerService.sendMail.mock.calls[0][0];

      expect(call.to).toBe('user@example.com');
      expect(call.subject).toBe('Confirm email');
      expect(call.templatePath).toContain('activation.hbs');
      expect(call.context.title).toBe('Confirm email');
      expect(call.context.actionTitle).toBe('Confirm email');
      expect(call.context.app_name).toBe('TestApp');
      expect(call.context.text1).toBe('Hey!');
      expect(call.context.text2).toBe('Welcome');
      expect(call.context.text3).toBe('Click to confirm');
      expect(call.context.text4).toBeUndefined();

      // URL should contain /confirm-email?hash=abc123
      expect(call.context.url).toContain('/confirm-email');
      expect(call.context.url).toContain('hash=abc123');
    });

    it('should translate correct i18n keys', async () => {
      await service.userSignUp({ to: 'user@example.com', data: { hash: 'h' } });

      expect(mockI18n.t).toHaveBeenCalledWith('common.confirmEmail');
      expect(mockI18n.t).toHaveBeenCalledWith('confirm-email.text1');
      expect(mockI18n.t).toHaveBeenCalledWith('confirm-email.text2');
      expect(mockI18n.t).toHaveBeenCalledWith('confirm-email.text3');
    });
  });

  describe('forgotPassword', () => {
    it('should send reset-password email with correct template and URL params', async () => {
      await service.forgotPassword({
        to: 'user@example.com',
        data: { hash: 'reset-hash', tokenExpires: 1700000000000 },
      });

      const call = mailerService.sendMail.mock.calls[0][0];

      expect(call.to).toBe('user@example.com');
      expect(call.subject).toBe('Reset password');
      expect(call.templatePath).toContain('reset-password.hbs');
      expect(call.context.title).toBe('Reset password');
      expect(call.context.text4).toBe('Ignore if not you');

      // URL should contain /password-change?hash=...&expires=...
      expect(call.context.url).toContain('/password-change');
      expect(call.context.url).toContain('hash=reset-hash');
      expect(call.context.url).toContain('expires=1700000000000');
    });
  });

  describe('confirmNewEmail', () => {
    it('should send confirm-new-email with correct template and URL', async () => {
      await service.confirmNewEmail({
        to: 'new@example.com',
        data: { hash: 'new-hash' },
      });

      const call = mailerService.sendMail.mock.calls[0][0];

      expect(call.to).toBe('new@example.com');
      expect(call.templatePath).toContain('confirm-new-email.hbs');
      expect(call.context.url).toContain('/confirm-new-email');
      expect(call.context.url).toContain('hash=new-hash');
      expect(call.context.text1).toBe('Hey!');
      expect(call.context.text4).toBeUndefined();
    });
  });

  describe('when i18n context is not available', () => {
    it('should still send email with undefined translations', async () => {
      jest.spyOn(I18nContext, 'current').mockReturnValue(undefined);

      await service.userSignUp({ to: 'user@example.com', data: { hash: 'h' } });

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.subject).toBeUndefined();
      expect(call.context.title).toBeUndefined();
    });
  });
});
