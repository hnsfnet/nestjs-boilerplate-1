import { Logger } from '@nestjs/common';
import { SocialInterface } from './interfaces/social.interface';
import { SocialAuthProvider } from './interfaces/social-auth-provider.interface';
import { SocialAuthException } from './exceptions/social-auth.exception';

/**
 * Template base shared by every social login provider.
 *
 * Concrete providers only implement {@link fetchProfile} (resolve config,
 * verify the token, map the payload). This base owns the parts that used to be
 * copy-pasted and inconsistent across providers:
 *  - a single public entry point ({@link getProfileByToken}); and
 *  - uniform error handling: any failure is turned into a single
 *    {@link SocialAuthException}, so the caller always gets the same error
 *    type/status regardless of provider.
 *
 * Unexpected (non-{@link SocialAuthException}) failures are logged with the
 * provider class name before being normalized, which keeps provider internals
 * out of the response while still leaving a trace for production debugging.
 */
export abstract class BaseSocialAuthService<LoginDto>
  implements SocialAuthProvider<LoginDto>
{
  private readonly socialAuthLogger = new Logger(BaseSocialAuthService.name);

  async getProfileByToken(loginDto: LoginDto): Promise<SocialInterface> {
    try {
      return await this.fetchProfile(loginDto);
    } catch (error) {
      throw this.toSocialAuthException(error);
    }
  }

  /**
   * Provider specific step: verify the incoming token and map the verified
   * payload to the internal {@link SocialInterface}. Throw a
   * {@link SocialAuthException} for known auth failures; any other thrown value
   * is normalized by {@link getProfileByToken}.
   */
  protected abstract fetchProfile(loginDto: LoginDto): Promise<SocialInterface>;

  private toSocialAuthException(error: unknown): SocialAuthException {
    if (error instanceof SocialAuthException) {
      return error;
    }

    this.socialAuthLogger.warn(
      `${this.constructor.name} failed to resolve the social profile`,
      error instanceof Error ? error.stack : String(error),
    );

    return new SocialAuthException();
  }
}
