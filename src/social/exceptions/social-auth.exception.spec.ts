import { HttpStatus } from '@nestjs/common';
import {
  SocialAuthException,
  SocialTokenInvalidException,
  SocialProviderTimeoutException,
  SocialProviderUnavailableException,
  SocialProviderConfigException,
} from './social-auth.exception';

describe('SocialAuthException hierarchy', () => {
  describe('SocialAuthException (base)', () => {
    it('should carry provider name, reason, and status', () => {
      const err = new SocialAuthException(
        'something broke',
        HttpStatus.BAD_REQUEST,
        'test-provider',
        'testReason',
      );
      expect(err.provider).toBe('test-provider');
      expect(err.reason).toBe('testReason');
      expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const body = err.getResponse() as Record<string, unknown>;
      expect(body).toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        errors: { provider: 'test-provider', reason: 'testReason' },
      });
    });

    it('should preserve the cause chain', () => {
      const cause = new Error('root');
      const err = new SocialAuthException(
        'msg',
        HttpStatus.BAD_REQUEST,
        'p',
        'r',
        cause,
      );
      expect(err.cause).toBe(cause);
    });
  });

  describe('SocialTokenInvalidException', () => {
    it('should map to 422 UNPROCESSABLE_ENTITY', () => {
      const err = new SocialTokenInvalidException('google');
      expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(err.provider).toBe('google');
      expect(err.reason).toBe('invalidToken');
    });

    it('should accept a custom detail message', () => {
      const err = new SocialTokenInvalidException(
        'apple',
        'JWT signature mismatch',
      );
      expect(err.provider).toBe('apple');
      const body = err.getResponse() as Record<string, unknown>;
      expect(
        (body.errors as Record<string, string>).message,
      ).toBe('JWT signature mismatch');
    });
  });

  describe('SocialProviderTimeoutException', () => {
    it('should map to 504 GATEWAY_TIMEOUT', () => {
      const err = new SocialProviderTimeoutException('facebook');
      expect(err.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
      expect(err.provider).toBe('facebook');
      expect(err.reason).toBe('providerTimeout');
    });
  });

  describe('SocialProviderUnavailableException', () => {
    it('should map to 502 BAD_GATEWAY', () => {
      const err = new SocialProviderUnavailableException('google');
      expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(err.provider).toBe('google');
      expect(err.reason).toBe('providerError');
    });
  });

  describe('SocialProviderConfigException', () => {
    it('should map to 500 INTERNAL_SERVER_ERROR', () => {
      const err = new SocialProviderConfigException('facebook');
      expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(err.provider).toBe('facebook');
      expect(err.reason).toBe('providerMisconfigured');
    });
  });
});
