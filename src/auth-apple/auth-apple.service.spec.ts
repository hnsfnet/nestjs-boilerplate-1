import appleSigninAuth from 'apple-signin-auth';
import { AuthAppleService } from './auth-apple.service';
import { SocialAuthException } from '../social/exceptions/social-auth.exception';

jest.mock('apple-signin-auth');

describe('AuthAppleService', () => {
  const verifyIdToken = appleSigninAuth.verifyIdToken as jest.Mock;
  let service: AuthAppleService;

  beforeEach(() => {
    jest.clearAllMocks();

    const configService = {
      get: jest.fn().mockReturnValue(['audience']),
    };

    service = new AuthAppleService(configService as never);
  });

  it('should map a verified Apple token plus the DTO name fields', async () => {
    verifyIdToken.mockResolvedValue({
      sub: 'apple-1',
      email: 'user@example.com',
    });

    await expect(
      service.getProfileByToken({
        idToken: 'token',
        firstName: 'Grace',
        lastName: 'Hopper',
      }),
    ).resolves.toEqual({
      id: 'apple-1',
      email: 'user@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
    });
  });

  it('should still resolve when the token carries no email', async () => {
    verifyIdToken.mockResolvedValue({ sub: 'apple-2' });

    const profile = await service.getProfileByToken({ idToken: 'token' });

    expect(profile.id).toBe('apple-2');
    expect(profile.email).toBeUndefined();
  });

  it('should normalize a verification failure into a 422 SocialAuthException', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(
      service.getProfileByToken({ idToken: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthException);
  });
});
