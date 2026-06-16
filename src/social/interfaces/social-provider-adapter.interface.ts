import { SocialInterface } from './social.interface';

/**
 * Unified contract that every social login provider must implement.
 *
 * @template TLoginDto The provider-specific DTO type (e.g. AuthGoogleLoginDto).
 */
export interface SocialProviderAdapter<TLoginDto = unknown> {
  /** Provider identifier used in error messages and auth provider enum. */
  readonly providerName: string;

  /**
   * Validate a provider-specific token and return normalized user profile data.
   * @param loginDto Provider-specific login DTO.
   * @returns Normalized social profile.
   * @throws {SocialAuthException} on any verification or communication failure.
   */
  getProfileByToken(loginDto: TLoginDto): Promise<SocialInterface>;
}
