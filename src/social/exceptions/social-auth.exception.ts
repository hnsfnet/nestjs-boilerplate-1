import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for all social authentication errors.
 * Carries the provider name for consistent error reporting.
 *
 * Subclasses map to specific HTTP status codes so that callers
 * (controllers, exception filters) never need to inspect raw errors.
 */
export class SocialAuthException extends HttpException {
  public readonly provider: string;
  public readonly reason: string;

  constructor(
    message: string,
    status: HttpStatus,
    provider: string,
    reason: string,
    cause?: unknown,
  ) {
    super(
      {
        status,
        errors: {
          provider,
          reason,
          message,
        },
      },
      status,
      { cause },
    );
    this.provider = provider;
    this.reason = reason;
  }
}

/**
 * Token provided by the client is invalid, expired, or cannot be verified.
 * HTTP 422 – the request payload is semantically wrong.
 */
export class SocialTokenInvalidException extends SocialAuthException {
  constructor(provider: string, detail?: string, cause?: unknown) {
    super(
      detail ?? 'Invalid or unverifiable token',
      HttpStatus.UNPROCESSABLE_ENTITY,
      provider,
      'invalidToken',
      cause,
    );
  }
}

/**
 * Provider API did not respond within the configured timeout.
 * HTTP 504 – upstream timeout.
 */
export class SocialProviderTimeoutException extends SocialAuthException {
  constructor(provider: string, cause?: unknown) {
    super(
      'Provider request timed out',
      HttpStatus.GATEWAY_TIMEOUT,
      provider,
      'providerTimeout',
      cause,
    );
  }
}

/**
 * Provider API returned an error response (non-2xx).
 * HTTP 502 – bad gateway, upstream returned an error.
 */
export class SocialProviderUnavailableException extends SocialAuthException {
  constructor(provider: string, detail?: string, cause?: unknown) {
    super(
      detail ?? 'Provider returned an error',
      HttpStatus.BAD_GATEWAY,
      provider,
      'providerError',
      cause,
    );
  }
}

/**
 * Provider credentials are not configured on the server.
 * HTTP 500 – server misconfiguration.
 */
export class SocialProviderConfigException extends SocialAuthException {
  constructor(provider: string, detail?: string, cause?: unknown) {
    super(
      detail ?? 'Provider credentials not configured',
      HttpStatus.INTERNAL_SERVER_ERROR,
      provider,
      'providerMisconfigured',
      cause,
    );
  }
}
