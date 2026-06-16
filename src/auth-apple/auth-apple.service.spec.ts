import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthAppleService } from './auth-apple.service';
import { SocialTokenInvalidException } from '../social/exceptions/social-auth.exception';

// Mock apple-signin-auth
const verifyIdTokenMock = jest.fn();
jest.mock('apple-signin-auth', () => ({
  __esModule: true,
  default: { verifyIdToken: verifyIdTokenMock },
}));

describe('AuthAppleService', () => {
  let service: AuthAppleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthAppleService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, unknown> = {
                'apple.appAudience': ['com.example.app'],
              };
              return values[key];
            }),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthAppleService>(AuthAppleService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have providerName "apple"', () => {
    expect(service.providerName).toBe('apple');
  });

  describe('getProfileByToken', () => {
    it('should return normalized SocialInterface on valid token', async () => {
      verifyIdTokenMock.mockResolvedValue({
        sub: 'apple-user-id-789',
        email: 'user@icloud.com',
      });

      const result = await service.getProfileByToken({
        idToken: 'valid-token',
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(result).toEqual({
        id: 'apple-user-id-789',
        email: 'user@icloud.com',
        firstName: 'Jane',
        lastName: 'Smith',
      });
    });

    it('should throw SocialTokenInvalidException when verification fails', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.getProfileByToken({ idToken: 'bad-token' }),
      ).rejects.toThrow(SocialTokenInvalidException);

      await expect(
        service.getProfileByToken({ idToken: 'bad-token' }),
      ).rejects.toMatchObject({
        provider: 'apple',
        reason: 'invalidToken',
      });
    });

    it('should handle missing name fields gracefully', async () => {
      verifyIdTokenMock.mockResolvedValue({
        sub: 'apple-user-456',
        email: undefined,
      });

      const result = await service.getProfileByToken({ idToken: 'token' });
      expect(result).toEqual({
        id: 'apple-user-456',
        email: undefined,
        firstName: undefined,
        lastName: undefined,
      });
    });

    it('should use firstName and lastName from loginDto (Apple provides them client-side only)', async () => {
      verifyIdTokenMock.mockResolvedValue({
        sub: 'apple-user-789',
        email: 'user@privaterelay.appleid.com',
      });

      const result = await service.getProfileByToken({
        idToken: 'token',
        firstName: 'Provided',
        lastName: 'ByClient',
      });
      expect(result.firstName).toBe('Provided');
      expect(result.lastName).toBe('ByClient');
    });
  });
});
