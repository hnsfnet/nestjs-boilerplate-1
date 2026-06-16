import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { MailService } from '../mail/mail.service';
import { SocialInterface } from '../social/interfaces/social.interface';

describe('AuthService.validateSocialLogin', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let sessionService: jest.Mocked<Partial<SessionService>>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    socialId: 'social-123',
    provider: 'google',
    role: { id: 1 },
    status: { id: 1 },
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findBySocialIdAndProvider: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    };
    sessionService = {
      create: jest.fn().mockResolvedValue({ id: 'session-1', hash: 'hash-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: UsersService, useValue: usersService },
        { provide: SessionService, useValue: sessionService },
        { provide: MailService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn((key: string) => {
              const values: Record<string, string> = {
                'auth.secret': 'secret',
                'auth.expires': '15m',
                'auth.refreshSecret': 'refresh-secret',
                'auth.refreshExpires': '7d',
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('social login flow', () => {
    it('should create a new user when no existing user found', async () => {
      const socialData: SocialInterface = {
        id: 'new-social-id',
        email: 'newuser@gmail.com',
        firstName: 'New',
        lastName: 'User',
      };

      (
        usersService.findBySocialIdAndProvider as jest.Mock
      ).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        ...socialData,
      });
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        ...socialData,
        role: { id: 1 },
      });

      const result = await service.validateSocialLogin('google', socialData);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          socialId: 'new-social-id',
          provider: 'google',
          email: 'newuser@gmail.com',
        }),
      );
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should update existing user with social email when email was missing', async () => {
      const socialData: SocialInterface = {
        id: 'existing-social-id',
        email: 'new-email@gmail.com',
      };

      const existingUser = {
        id: 'existing-user',
        email: null,
        socialId: 'existing-social-id',
        provider: 'google',
      };

      (
        usersService.findBySocialIdAndProvider as jest.Mock
      ).mockResolvedValue(existingUser);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.update as jest.Mock).mockResolvedValue(existingUser);

      const result = await service.validateSocialLogin('google', socialData);

      expect(usersService.update).toHaveBeenCalledWith(
        'existing-user',
        expect.objectContaining({ email: 'new-email@gmail.com' }),
      );
      expect(result.token).toBeDefined();
    });

    it('should match existing user by email when social id not found', async () => {
      const socialData: SocialInterface = {
        id: 'brand-new-social-id',
        email: 'existing@example.com',
      };

      (
        usersService.findBySocialIdAndProvider as jest.Mock
      ).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateSocialLogin('google', socialData);
      expect(result.token).toBeDefined();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should handle social login without email (no email scenario)', async () => {
      const socialData: SocialInterface = {
        id: 'no-email-social-id',
        email: undefined,
      };

      (
        usersService.findBySocialIdAndProvider as jest.Mock
      ).mockResolvedValue(null);

      (usersService.create as jest.Mock).mockResolvedValue({
        id: 'no-email-user',
        socialId: 'no-email-social-id',
        provider: 'apple',
      });
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 'no-email-user',
        email: null,
        socialId: 'no-email-social-id',
        provider: 'apple',
        role: { id: 1 },
      });

      const result = await service.validateSocialLogin('apple', socialData);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: null,
          socialId: 'no-email-social-id',
          provider: 'apple',
        }),
      );
      expect(result.token).toBeDefined();
    });

    it('should throw when social data has no id and no matching user', async () => {
      const socialData: SocialInterface = {
        id: undefined as unknown as string,
        email: 'orphan@example.com',
      };

      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateSocialLogin('facebook', socialData),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
