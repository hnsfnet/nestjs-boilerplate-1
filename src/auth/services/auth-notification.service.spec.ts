import { Test, TestingModule } from '@nestjs/testing';
import { AuthNotificationService } from './auth-notification.service';
import { TokenService } from './token.service';
import { MailService } from '../../mail/mail.service';

describe('AuthNotificationService', () => {
  let service: AuthNotificationService;
  let tokenService: {
    signConfirmEmailToken: jest.Mock;
    signForgotPasswordToken: jest.Mock;
  };
  let mailService: {
    userSignUp: jest.Mock;
    forgotPassword: jest.Mock;
    confirmNewEmail: jest.Mock;
  };

  beforeEach(async () => {
    tokenService = {
      signConfirmEmailToken: jest.fn().mockResolvedValue('confirm-jwt'),
      signForgotPasswordToken: jest
        .fn()
        .mockResolvedValue({ hash: 'forgot-jwt', tokenExpires: 1700000000000 }),
    };
    mailService = {
      userSignUp: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue(undefined),
      confirmNewEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthNotificationService,
        { provide: TokenService, useValue: tokenService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthNotificationService>(AuthNotificationService);
  });

  describe('sendSignUpConfirmation', () => {
    it('should sign confirm-email token and send sign-up email', async () => {
      await service.sendSignUpConfirmation('user@example.com', 42);

      expect(tokenService.signConfirmEmailToken).toHaveBeenCalledWith({
        confirmEmailUserId: 42,
      });
      expect(mailService.userSignUp).toHaveBeenCalledWith({
        to: 'user@example.com',
        data: { hash: 'confirm-jwt' },
      });
    });
  });

  describe('sendForgotPassword', () => {
    it('should sign forgot-password token and send forgot-password email', async () => {
      await service.sendForgotPassword('user@example.com', 42);

      expect(tokenService.signForgotPasswordToken).toHaveBeenCalledWith(42);
      expect(mailService.forgotPassword).toHaveBeenCalledWith({
        to: 'user@example.com',
        data: { hash: 'forgot-jwt', tokenExpires: 1700000000000 },
      });
    });
  });

  describe('sendConfirmNewEmail', () => {
    it('should sign confirm-email token with newEmail and send email', async () => {
      await service.sendConfirmNewEmail(
        'new@example.com',
        42,
        'new@example.com',
      );

      expect(tokenService.signConfirmEmailToken).toHaveBeenCalledWith({
        confirmEmailUserId: 42,
        newEmail: 'new@example.com',
      });
      expect(mailService.confirmNewEmail).toHaveBeenCalledWith({
        to: 'new@example.com',
        data: { hash: 'confirm-jwt' },
      });
    });
  });
});
