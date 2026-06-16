import { HttpStatus, Logger } from '@nestjs/common';
import { AuthFacebookService } from './auth-facebook.service';
import { SocialAuthException } from '../social/exceptions/social-auth.exception';

type FetchBody = Record<string, unknown>;

const buildResponse = (ok: boolean, body: FetchBody, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
});

const validTokenResponse = () =>
  buildResponse(true, { data: { is_valid: true, app_id: 'app-id' } });

describe('AuthFacebookService', () => {
  const fetchMock = jest.fn();

  const createService = (
    get: (key: string) => unknown = (key) =>
      key === 'facebook.appId'
        ? 'app-id'
        : key === 'facebook.appSecret'
          ? 'app-secret'
          : undefined,
  ) => new AuthFacebookService({ get } as never);

  beforeAll(() => {
    global.fetch = fetchMock as never;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('should map a verified token and profile to the internal social profile', async () => {
    fetchMock
      .mockResolvedValueOnce(validTokenResponse())
      .mockResolvedValueOnce(
        buildResponse(true, {
          id: 'fb-1',
          email: 'user@example.com',
          first_name: 'Linus',
          last_name: 'Torvalds',
        }),
      );

    await expect(
      createService().getProfileByToken({ accessToken: 'token' }),
    ).resolves.toEqual({
      id: 'fb-1',
      email: 'user@example.com',
      firstName: 'Linus',
      lastName: 'Torvalds',
    });
  });

  it('should default email to undefined when the profile omits it', async () => {
    fetchMock
      .mockResolvedValueOnce(validTokenResponse())
      .mockResolvedValueOnce(buildResponse(true, { id: 'fb-2', first_name: 'A' }));

    const profile = await createService().getProfileByToken({
      accessToken: 'token',
    });

    expect(profile).toEqual({
      id: 'fb-2',
      email: undefined,
      firstName: 'A',
      lastName: '',
    });
  });

  it('should reject with a 422 SocialAuthException when the token is not valid', async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(true, { data: { is_valid: false } }),
    );

    expect.assertions(3);
    try {
      await createService().getProfileByToken({ accessToken: 'token' });
    } catch (error) {
      expect(error).toBeInstanceOf(SocialAuthException);
      expect((error as SocialAuthException).getStatus()).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      // The profile endpoint must not be reached once verification fails.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('should reject when the token belongs to a different app', async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(true, { data: { is_valid: true, app_id: 'someone-else' } }),
    );

    await expect(
      createService().getProfileByToken({ accessToken: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthException);
  });

  it('should reject when the debug_token endpoint returns a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(false, {}, 401));

    await expect(
      createService().getProfileByToken({ accessToken: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthException);
  });

  it('should reject when the profile endpoint returns a non-ok status', async () => {
    fetchMock
      .mockResolvedValueOnce(validTokenResponse())
      .mockResolvedValueOnce(buildResponse(false, {}, 500));

    await expect(
      createService().getProfileByToken({ accessToken: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthException);
  });

  it('should reject when the profile response is missing an id', async () => {
    fetchMock
      .mockResolvedValueOnce(validTokenResponse())
      .mockResolvedValueOnce(buildResponse(true, { email: 'user@example.com' }));

    await expect(
      createService().getProfileByToken({ accessToken: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthException);
  });

  it('should reject without calling Facebook when app credentials are missing', async () => {
    const service = createService(() => undefined);

    expect.assertions(2);
    try {
      await service.getProfileByToken({ accessToken: 'token' });
    } catch (error) {
      expect(error).toBeInstanceOf(SocialAuthException);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });
});
