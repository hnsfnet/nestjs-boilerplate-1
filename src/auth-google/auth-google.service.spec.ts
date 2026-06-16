import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthGoogleService } from './auth-google.service';
import { SocialTokenInvalidException } from '../social/exceptions/social-auth.exception';
import { OAuth2Client } from 'google-auth-library';

// Mock google-auth-library
jest.mock('google-auth-library', () => {
  const verifyIdTokenMock = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
    __verifyIdTokenMock: verifyIdTokenMock,
  };
});

// Access the mock for test setup
const { __verifyIdTokenMock: verifyIdTokenMock } = jest.requireMock(
  'google-auth-library',
) as { __verifyIdTokenMock: jest.Mock };

describe('AuthGoogleService', () => {
  let service: AuthGoogleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGoogleService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                'google.clientId': 'test-client-id',
                'google.clientSecret': 'test-client-secret',
              };
              return values[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              const values: Record<string, string> = {
                'google.clientId': 'test-client-id',
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthGoogleService>(AuthGoogleService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have providerName "google"', () => {
    expect(service.providerName).toBe('google');
  });

  describe('getProfileByToken', () => {
    it('should return normalized SocialInterface on valid token', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-id-123',
          email: 'user@gmail.com',
          given_name: 'John',
          family_name: 'Doe',
        }),
      });

      const result = await service.getProfileByToken({ idToken: 'valid-token' });

      expect(result).toEqual({
        id: 'google-user-id-123',
        email: 'user@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should throw SocialTokenInvalidException when payload is null', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => null,
      });

      await expect(
        service.getProfileByToken({ idToken: 'bad-token' }),
      ).rejects.toThrow(SocialTokenInvalidException);

      await expect(
        service.getProfileByToken({ idToken: 'bad-token' }),
      ).rejects.toMatchObject({
        provider: 'google',
        reason: 'invalidToken',
      });
    });

    it('should throw SocialTokenInvalidException when verifyIdToken fails', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Token expired'));

      await expect(
        service.getProfileByToken({ idToken: 'expired-token' }),
      ).rejects.toThrow(SocialTokenInvalidException);
    });

    it('should handle profile with missing optional fields', async () => {
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({
          sub: 'user-456',
          email: undefined,
          given_name: undefined,
          family_name: undefined,
        }),
      });

      const result = await service.getProfileByToken({
        idToken: 'token-no-optional',
      });
      expect(result).toEqual({
        id: 'user-456',
        email: undefined,
        firstName: undefined,
        lastName: undefined,
      });
    });
  });
});
