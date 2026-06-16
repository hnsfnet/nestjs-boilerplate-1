import { HttpStatus } from '@nestjs/common';
import { BaseSocialProviderAdapter } from './base-social-provider.adapter';
import { SocialInterface } from './interfaces/social.interface';
import {
  SocialProviderConfigException,
  SocialProviderTimeoutException,
  SocialProviderUnavailableException,
} from './exceptions/social-auth.exception';

/**
 * Concrete adapter used only in tests to exercise BaseSocialProviderAdapter.
 */
class TestAdapter extends BaseSocialProviderAdapter<{ token: string }> {
  readonly providerName = 'test';

  async getProfileByToken(
    loginDto: { token: string },
  ): Promise<SocialInterface> {
    return { id: loginDto.token };
  }

  // Expose protected methods for direct testing
  public async testFetchJson<T = unknown>(
    url: string,
    timeoutMs?: number,
  ): Promise<T> {
    return this.fetchJson<T>(url, timeoutMs);
  }

  public testAssertConfig(
    entries: Record<string, string | undefined>,
  ): void {
    this.assertConfig(entries);
  }
}

describe('BaseSocialProviderAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('getProfileByToken (delegation)', () => {
    it('should delegate to subclass implementation', async () => {
      const result = await adapter.getProfileByToken({ token: 'abc' });
      expect(result).toEqual({ id: 'abc' });
    });
  });

  describe('fetchJson', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return parsed JSON on successful response', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Test User', id: '123' }),
      });

      const result = await adapter.testFetchJson<{
        name: string;
        id: string;
      }>('https://api.example.com/me');
      expect(result).toEqual({ name: 'Test User', id: '123' });
    });

    it('should throw SocialProviderUnavailableException on non-2xx response', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'Permission denied' },
        }),
      });

      await expect(
        adapter.testFetchJson('https://api.example.com/me'),
      ).rejects.toThrow(SocialProviderUnavailableException);

      try {
        await adapter.testFetchJson('https://api.example.com/me');
      } catch (error) {
        const err = error as SocialProviderUnavailableException;
        expect(err.provider).toBe('test');
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        const body = err.getResponse() as Record<string, unknown>;
        expect((body.errors as Record<string, string>).message).toBe(
          'Permission denied',
        );
      }
    });

    it('should throw SocialProviderTimeoutException on timeout', async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(
        Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      );

      await expect(
        adapter.testFetchJson('https://api.example.com/me'),
      ).rejects.toThrow(SocialProviderTimeoutException);
    });

    it('should throw SocialProviderUnavailableException on network error', async () => {
      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('DNS resolution failed'));

      await expect(
        adapter.testFetchJson('https://api.example.com/me'),
      ).rejects.toThrow(SocialProviderUnavailableException);
    });

    it('should handle non-JSON error body gracefully', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      });

      await expect(
        adapter.testFetchJson('https://api.example.com/me'),
      ).rejects.toThrow(SocialProviderUnavailableException);

      try {
        await adapter.testFetchJson('https://api.example.com/me');
      } catch (error) {
        const err = error as SocialProviderUnavailableException;
        const body = err.getResponse() as Record<string, unknown>;
        expect((body.errors as Record<string, string>).message).toBe(
          'Provider returned HTTP 500',
        );
      }
    });

    it('should handle error body with string error field', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(
        adapter.testFetchJson('https://api.example.com/me'),
      ).rejects.toThrow(SocialProviderUnavailableException);
    });
  });

  describe('assertConfig', () => {
    it('should not throw when all values are present', () => {
      expect(() =>
        adapter.testAssertConfig({ clientId: 'abc', clientSecret: 'xyz' }),
      ).not.toThrow();
    });

    it('should throw SocialProviderConfigException when a value is missing', () => {
      expect(() =>
        adapter.testAssertConfig({ clientId: 'abc', clientSecret: undefined }),
      ).toThrow(SocialProviderConfigException);
    });

    it('should list all missing keys in the error message', () => {
      try {
        adapter.testAssertConfig({
          clientId: undefined,
          clientSecret: undefined,
        });
        fail('Expected SocialProviderConfigException');
      } catch (error) {
        const err = error as SocialProviderConfigException;
        expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        const body = err.getResponse() as Record<string, unknown>;
        const message = (body.errors as Record<string, string>).message;
        expect(message).toContain('clientId');
        expect(message).toContain('clientSecret');
      }
    });

    it('should treat empty string as missing', () => {
      expect(() =>
        adapter.testAssertConfig({ clientId: '', clientSecret: 'ok' }),
      ).toThrow(SocialProviderConfigException);
    });
  });
});
