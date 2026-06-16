import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthFacebookService } from './auth-facebook.service';
import {
  SocialTokenInvalidException,
  SocialProviderConfigException,
  SocialProviderTimeoutException,
  SocialProviderUnavailableException,
} from '../social/exceptions/social-auth.exception';

describe('AuthFacebookService', () => {
  let service: AuthFacebookService;
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthFacebookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                'facebook.appId': 'test-app-id',
                'facebook.appSecret': 'test-app-secret',
              };
              return values[key];
            }),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthFacebookService>(AuthFacebookService);
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have providerName "facebook"', () => {
    expect(service.providerName).toBe('facebook');
  });

  describe('getProfileByToken', () => {
    function mockTokenVerification(valid = true, appId = 'test-app-id') {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { is_valid: valid, app_id: appId },
        }),
      });
    }

    function mockProfileResponse(data: Record<string, unknown>) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });
    }

    it('should return normalized SocialInterface on valid token', async () => {
      mockTokenVerification();
      mockProfileResponse({
        id: 'fb-user-123',
        email: 'user@fb.com',
        first_name: 'Alice',
        last_name: 'Wonder',
      });

      const result = await service.getProfileByToken({
        accessToken: 'valid-token',
      });

      expect(result).toEqual({
        id: 'fb-user-123',
        email: 'user@fb.com',
        firstName: 'Alice',
        lastName: 'Wonder',
      });
    });

    it('should handle missing email gracefully', async () => {
      mockTokenVerification();
      mockProfileResponse({
        id: 'fb-user-456',
        first_name: 'Bob',
        last_name: 'Builder',
      });

      const result = await service.getProfileByToken({
        accessToken: 'valid-token',
      });

      expect(result.email).toBeUndefined();
      expect(result.id).toBe('fb-user-456');
    });

    it('should throw SocialTokenInvalidException when token is not valid', async () => {
      mockTokenVerification(false);

      await expect(
        service.getProfileByToken({ accessToken: 'invalid-token' }),
      ).rejects.toThrow(SocialTokenInvalidException);
    });

    it('should throw SocialTokenInvalidException when token belongs to different app', async () => {
      mockTokenVerification(true, 'other-app-id');

      await expect(
        service.getProfileByToken({ accessToken: 'wrong-app-token' }),
      ).rejects.toThrow(SocialTokenInvalidException);
    });

    it('should throw SocialProviderConfigException when credentials are missing', async () => {
      // Override config to return empty values
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          AuthFacebookService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
              getOrThrow: jest.fn(),
            },
          },
        ],
      }).compile();

      const svc2 = module2.get<AuthFacebookService>(AuthFacebookService);

      await expect(
        svc2.getProfileByToken({ accessToken: 'token' }),
      ).rejects.toThrow(SocialProviderConfigException);
    });

    it('should throw SocialProviderTimeoutException on timeout', async () => {
      fetchMock.mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      );

      await expect(
        service.getProfileByToken({ accessToken: 'token' }),
      ).rejects.toThrow(SocialProviderTimeoutException);
    });

    it('should throw SocialProviderUnavailableException on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        service.getProfileByToken({ accessToken: 'token' }),
      ).rejects.toThrow(SocialProviderUnavailableException);
    });

    it('should throw SocialProviderUnavailableException when profile API returns error', async () => {
      mockTokenVerification();
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Permission denied' } }),
      });

      await expect(
        service.getProfileByToken({ accessToken: 'valid-token' }),
      ).rejects.toThrow(SocialProviderUnavailableException);
    });

    it('should throw when profile data has no id', async () => {
      mockTokenVerification();
      mockProfileResponse({ first_name: 'No', last_name: 'ID' });

      await expect(
        service.getProfileByToken({ accessToken: 'valid-token' }),
      ).rejects.toThrow(SocialProviderUnavailableException);
    });
  });

  describe('exchangeForLongLivedToken', () => {
    it('should return long-lived token on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'long-lived-token-xyz' }),
      });

      const result = await service.exchangeForLongLivedToken('short-token');
      expect(result).toBe('long-lived-token-xyz');
    });

    it('should throw when exchange fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid token' }),
      });

      await expect(
        service.exchangeForLongLivedToken('expired-token'),
      ).rejects.toThrow(SocialProviderUnavailableException);
    });

    it('should throw when config is missing', async () => {
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          AuthFacebookService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
              getOrThrow: jest.fn(),
            },
          },
        ],
      }).compile();

      const svc2 = module2.get<AuthFacebookService>(AuthFacebookService);
      await expect(
        svc2.exchangeForLongLivedToken('token'),
      ).rejects.toThrow(SocialProviderConfigException);
    });
  });
});
