import { SocialInterface } from './social.interface';

/**
 * Common contract every third-party login provider exposes at the service
 * boundary. A provider only has to turn its own login payload (id token,
 * access token, ...) into the internal {@link SocialInterface}; resolving the
 * provider config, verifying the token and mapping the profile are all hidden
 * behind this single method so the rest of the auth flow stays provider
 * agnostic.
 */
export interface SocialAuthProvider<LoginDto = unknown> {
  getProfileByToken(loginDto: LoginDto): Promise<SocialInterface>;
}
