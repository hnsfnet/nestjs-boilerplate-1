import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseSocialAuthService } from './base-social-auth.service';
import { SocialAuthException } from './exceptions/social-auth.exception';
import { SocialInterface } from './interfaces/social.interface';

class TestSocialAuthService extends BaseSocialAuthService<{ token: string }> {
  constructor(
    private readonly impl: (dto: { token: string }) => Promise<SocialInterface>,
  ) {
    super();
  }

  protected fetchProfile(dto: { token: string }): Promise<SocialInterface> {
    return this.impl(dto);
  }
}

describe('BaseSocialAuthService', () => {
  beforeAll(() => {
    // The base service logs unexpected errors before normalizing them; keep the
    // test output clean.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should return the profile produced by fetchProfile on success', async () => {
    const profile: SocialInterface = { id: 'abc', email: 'a@b.com' };
    const service = new TestSocialAuthService(() => Promise.resolve(profile));

    await expect(service.getProfileByToken({ token: 't' })).resolves.toEqual(
      profile,
    );
  });

  it('should pass through a SocialAuthException without rewrapping it', async () => {
    const thrown = new SocialAuthException();
    const service = new TestSocialAuthService(() => Promise.reject(thrown));

    await expect(service.getProfileByToken({ token: 't' })).rejects.toBe(thrown);
  });

  it('should normalize a generic error into a 422 SocialAuthException', async () => {
    const service = new TestSocialAuthService(() =>
      Promise.reject(new Error('boom')),
    );

    expect.assertions(3);
    try {
      await service.getProfileByToken({ token: 't' });
    } catch (error) {
      expect(error).toBeInstanceOf(SocialAuthException);
      expect((error as SocialAuthException).getStatus()).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect((error as SocialAuthException).getResponse()).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { user: 'wrongToken' },
      });
    }
  });

  it('should normalize a foreign HttpException into a 422 SocialAuthException', async () => {
    const service = new TestSocialAuthService(() =>
      Promise.reject(new HttpException('nope', HttpStatus.BAD_GATEWAY)),
    );

    expect.assertions(2);
    try {
      await service.getProfileByToken({ token: 't' });
    } catch (error) {
      expect(error).toBeInstanceOf(SocialAuthException);
      expect((error as SocialAuthException).getStatus()).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  });
});
