import { AuthGoogleController } from './auth-google.controller';
import { AuthGoogleService } from './auth-google.service';
import { AuthService } from '../auth/auth.service';
import { SocialInterface } from '../social/interfaces/social.interface';

describe('AuthGoogleController', () => {
  let controller: AuthGoogleController;
  const getProfileByToken = jest.fn();
  const validateSocialLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const authGoogleService = { getProfileByToken } as Partial<AuthGoogleService>;
    const authService = { validateSocialLogin } as Partial<AuthService>;

    controller = new AuthGoogleController(
      authService as AuthService,
      authGoogleService as AuthGoogleService,
    );
  });

  it('should resolve the social profile then delegate to validateSocialLogin', async () => {
    const profile: SocialInterface = {
      id: 'google-1',
      email: 'user@example.com',
    };
    const loginResponse = { token: 'jwt' };

    getProfileByToken.mockResolvedValue(profile);
    validateSocialLogin.mockResolvedValue(loginResponse);

    const result = await controller.login({ idToken: 'token' });

    expect(getProfileByToken).toHaveBeenCalledWith({ idToken: 'token' });
    expect(validateSocialLogin).toHaveBeenCalledWith('google', profile);
    expect(result).toBe(loginResponse);
  });
});
