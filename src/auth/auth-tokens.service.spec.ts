import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { AuthTokensService } from './auth-tokens.service';

describe('AuthTokensService', () => {
  let service: AuthTokensService;
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };

    const configValues: Record<string, string> = {
      'auth.secret': 'access-secret',
      'auth.expires': '15m',
      'auth.refreshSecret': 'refresh-secret',
      'auth.refreshExpires': '3650d',
      'auth.confirmEmailSecret': 'confirm-secret',
      'auth.confirmEmailExpires': '1d',
      'auth.forgotSecret': 'forgot-secret',
      'auth.forgotExpires': '30m',
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => configValues[key]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthTokensService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(AuthTokensService);
  });

  describe('createSessionHash', () => {
    it('returns a 64-char sha256 hex string', () => {
      expect(service.createSessionHash()).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces a different value on each call', () => {
      expect(service.createSessionHash()).not.toEqual(
        service.createSessionHash(),
      );
    });
  });

  describe('getTokensData', () => {
    it('signs access + refresh tokens with the configured secrets and an expiry', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access')
        .mockResolvedValueOnce('refresh');

      const before = Date.now();
      const result = await service.getTokensData({
        id: 1,
        role: { id: 2 },
        sessionId: 'sess-1',
        hash: 'session-hash',
      });

      expect(result).toEqual({
        token: 'access',
        refreshToken: 'refresh',
        tokenExpires: expect.any(Number),
      });
      expect(result.tokenExpires).toBeGreaterThanOrEqual(before);

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { id: 1, role: { id: 2 }, sessionId: 'sess-1' },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sessionId: 'sess-1', hash: 'session-hash' },
        { secret: 'refresh-secret', expiresIn: '3650d' },
      );
    });
  });

  describe('createConfirmEmailHash', () => {
    it('signs the confirm-email payload with the confirm secret', async () => {
      jwtService.signAsync.mockResolvedValueOnce('confirm-hash');

      await expect(service.createConfirmEmailHash(3)).resolves.toBe(
        'confirm-hash',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { confirmEmailUserId: 3 },
        { secret: 'confirm-secret', expiresIn: '1d' },
      );
    });
  });

  describe('createConfirmNewEmailHash', () => {
    it('embeds the new email in the confirm payload', async () => {
      jwtService.signAsync.mockResolvedValueOnce('new-email-hash');

      await expect(
        service.createConfirmNewEmailHash(4, 'new@example.com'),
      ).resolves.toBe('new-email-hash');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { confirmEmailUserId: 4, newEmail: 'new@example.com' },
        { secret: 'confirm-secret', expiresIn: '1d' },
      );
    });
  });

  describe('createForgotPasswordToken', () => {
    it('returns the signed hash plus an absolute expiry timestamp', async () => {
      jwtService.signAsync.mockResolvedValueOnce('forgot-hash');
      const before = Date.now();

      const result = await service.createForgotPasswordToken(7);

      expect(result.hash).toBe('forgot-hash');
      expect(result.tokenExpires).toBeGreaterThanOrEqual(before);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { forgotUserId: 7 },
        { secret: 'forgot-secret', expiresIn: '30m' },
      );
    });
  });

  describe('verifyConfirmEmailHash', () => {
    it('returns the user id from a valid token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ confirmEmailUserId: 42 });
      await expect(service.verifyConfirmEmailHash('ok')).resolves.toBe(42);
    });

    it('throws UnprocessableEntityException on an invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad'));
      await expect(service.verifyConfirmEmailHash('bad')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('verifyConfirmNewEmailHash', () => {
    it('returns userId and newEmail from a valid token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        confirmEmailUserId: 5,
        newEmail: 'new@example.com',
      });
      await expect(service.verifyConfirmNewEmailHash('ok')).resolves.toEqual({
        userId: 5,
        newEmail: 'new@example.com',
      });
    });

    it('throws UnprocessableEntityException on an invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad'));
      await expect(service.verifyConfirmNewEmailHash('bad')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('verifyForgotPasswordHash', () => {
    it('returns the user id from a valid token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ forgotUserId: 9 });
      await expect(service.verifyForgotPasswordHash('ok')).resolves.toBe(9);
    });

    it('throws UnprocessableEntityException on an invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad'));
      await expect(service.verifyForgotPasswordHash('bad')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
