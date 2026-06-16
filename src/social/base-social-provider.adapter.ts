import { SocialInterface } from '../interfaces/social.interface';
import { SocialProviderAdapter } from '../interfaces/social-provider-adapter.interface';
import {
  SocialProviderConfigException,
  SocialProviderTimeoutException,
  SocialProviderUnavailableException,
} from '../exceptions/social-auth.exception';

/**
 * Base class for social login provider adapters.
 *
 * Provides shared infrastructure:
 *  - HTTP fetch with configurable timeout and unified error mapping
 *  - Helper to assert provider configuration completeness
 *
 * Subclasses must implement:
 *  - `providerName` – identifier used in error messages and auth provider enum
 *  - `getProfileByToken()` – provider-specific token verification + mapping
 */
export abstract class BaseSocialProviderAdapter<TLoginDto = unknown>
  implements SocialProviderAdapter<TLoginDto>
{
  /** Default HTTP timeout in milliseconds for upstream API calls. */
  protected readonly defaultTimeoutMs = 10_000;

  /** Provider identifier, e.g. 'google', 'apple', 'facebook'. */
  abstract readonly providerName: string;

  /**
   * Main entry point called by controllers.
   * Delegates to the provider-specific implementation.
   */
  abstract getProfileByToken(loginDto: TLoginDto): Promise<SocialInterface>;

  /**
   * Perform an HTTP GET with timeout and unified exception mapping.
   * Use this for any outbound call to a provider's API.
   *
   * @param url Fully-qualified URL to call.
   * @param timeoutMs Request timeout (defaults to {@link defaultTimeoutMs}).
   * @returns Parsed JSON body.
   * @throws {SocialProviderTimeoutException} on timeout.
   * @throws {SocialProviderUnavailableException} on non-2xx or network error.
   */
  protected async fetchJson<T = unknown>(
    url: string,
    timeoutMs: number = this.defaultTimeoutMs,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new SocialProviderTimeoutException(this.providerName, error);
      }
      throw new SocialProviderUnavailableException(
        this.providerName,
        'Network error contacting provider',
        error,
      );
    }

    if (!response.ok) {
      let detail: string;
      try {
        const errorData = (await response.json()) as Record<string, unknown>;
        const errorField = errorData.error;
        detail =
          typeof errorField === 'object' && errorField !== null
            ? ((errorField as Record<string, string>).message ??
              `Provider returned HTTP ${response.status}`)
            : typeof errorField === 'string'
              ? errorField
              : `Provider returned HTTP ${response.status}`;
      } catch {
        detail = `Provider returned HTTP ${response.status}`;
      }
      throw new SocialProviderUnavailableException(this.providerName, detail);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Assert that required config values are present, throwing a
   * consistent misconfiguration error if not.
   *
   * @param entries Key/value pairs to check; entries with falsy values fail.
   * @throws {SocialProviderConfigException} when any entry is missing.
   */
  protected assertConfig(entries: Record<string, string | undefined>): void {
    const missing = Object.entries(entries)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new SocialProviderConfigException(
        this.providerName,
        `Missing required config: ${missing.join(', ')}`,
      );
    }
  }
}
