import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';

/**
 * Single error type raised by every social login provider.
 *
 * It extends {@link UnprocessableEntityException} so the HTTP layer keeps the
 * existing `422` status and response body (`{ status, errors: { user } }`) that
 * the Google provider already produced. Funnelling Apple/Facebook through the
 * same exception means the business layer no longer has to deal with a mix of
 * `400`/`401`/`408`/`500`/raw string errors coming from different providers.
 */
export class SocialAuthException extends UnprocessableEntityException {
  constructor(reason: string = 'wrongToken') {
    super({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: {
        user: reason,
      },
    });
  }
}
