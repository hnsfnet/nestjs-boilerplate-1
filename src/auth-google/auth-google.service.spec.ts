import { HttpStatus } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthGoogleService } from './auth-google.service';
import { SocialAuthException } from '../social/exceptions/social-auth.exception';

jest.mock('google-auth-library');

describe('AuthGoogleService', () => {
  const verifyIdToken = jest.fn();
  let service: AuthGoogleService;

  beforeEach(() => {
    jest.clearAllMocks();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      verifyIdToken,
    }));

    const configService = {
      get: jest.fn().mockReturnValue('client-id'),
      getOrThrow: jest.fn().mockReturnValue('client-id'),
    };

    service = new AuthGoogleService(configService as never);
  });

  it('should map a verified Google payload to the internal social profile', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-1',
        email: 'user@example.com',
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    });

    await expect(
      service.getProfileByToken({ idToken: 'token' }),
    ).resolves.toEqual({
      id: 'google-1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it('should still resolve when the payload has no email', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-2', given_name: 'NoEmail' }),
    });

    const profile = await service.getProfileByToken({ idToken: 'token' });

    expect(profile.id).toBe('google-2');
    expect(profile.email).toBeUndefined();
  });

  it('should raise a 422 SocialAuthException when the token has no payload', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => null });

    expect.assertions(2);
    try {
      await service.getProfileByToken({ idToken: 'token' });
    } catch (error) {
      expect(error).toBeInstanceOf(SocialAuthException);
      expect((error as SocialAuthException).getStatus()).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  });

  it('should normalize a verification failure into a 422 SocialAuthException', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid signature'));

    await expect(
      service.getProfileByToken({ idToken: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthException);
  });
});
