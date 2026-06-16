import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  const mockConfig: Record<string, string> = {
    'auth.secret': 'access-secret',
    'auth.expires': '15m',
    'auth.refreshSecret': 'refresh-secret',
    'auth.refreshExpires': '7d',
    'auth.confirmEmailSecret': 'confirm-email-secret',
    'auth.confirmEmailExpires': '1h',
    'auth.forgotSecret': 'forgot-secret',
    'auth.forgotExpires': '1h',
  };

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
      verifyAsync: jest.fn().mockResolvedValue({}),
    };
    configService = {
      getOrThrow: jest.fn((key: string) => mockConfig[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe('generateTokenPair', () => {
    it('should sign access and refresh tokens with correct payloads and secrets', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokenPair({
        id: 1,
        role: { id: 2 },
        sessionId: 10,
        hash: 'session-hash',
      });

      expect(result).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpires: expect.any(Number),
      });

      // Access token call
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { id: 1, role: { id: 2 }, sessionId: 10 },
        { secret: 'access-secret', expiresIn: '15m' },
      );

      // Refresh token call
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sessionId: 10, hash: 'session-hash' },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );
    });

    it('should return tokenExpires as a future timestamp', async () => {
      const before = Date.now();
      const result = await service.generateTokenPair({
        id: 1,
        role: { id: 2 },
        sessionId: 10,
        hash: 'h',
      });
      expect(result.tokenExpires).toBeGreaterThanOrEqual(before);
    });
  });

  describe('signConfirmEmailToken', () => {
    it('should sign with confirmEmailSecret and correct payload', async () => {
      jwtService.signAsync.mockResolvedValue('confirm-token');

      const result = await service.signConfirmEmailToken({
        confirmEmailUserId: 42,
      });

      expect(result).toBe('confirm-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { confirmEmailUserId: 42 },
        { secret: 'confirm-email-secret', expiresIn: '1h' },
      );
    });

    it('should include newEmail in payload when provided', async () => {
      await service.signConfirmEmailToken({
        confirmEmailUserId: 42,
        newEmail: 'new@example.com',
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { confirmEmailUserId: 42, newEmail: 'new@example.com' },
        { secret: 'confirm-email-secret', expiresIn: '1h' },
      );
    });
  });

  describe('verifyConfirmEmailToken', () => {
    it('should verify with confirmEmailSecret', async () => {
      jwtService.verifyAsync.mockResolvedValue({ confirmEmailUserId: 42 });

      const result = await service.verifyConfirmEmailToken('some-hash');

      expect(result).toEqual({ confirmEmailUserId: 42 });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('some-hash', {
        secret: 'confirm-email-secret',
      });
    });

    it('should propagate errors from jwtService', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        service.verifyConfirmEmailToken('bad-hash'),
      ).rejects.toThrow('invalid');
    });
  });

  describe('signForgotPasswordToken', () => {
    it('should return hash and tokenExpires', async () => {
      jwtService.signAsync.mockResolvedValue('forgot-token');

      const before = Date.now();
      const result = await service.signForgotPasswordToken(42);

      expect(result.hash).toBe('forgot-token');
      expect(result.tokenExpires).toBeGreaterThanOrEqual(before);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { forgotUserId: 42 },
        { secret: 'forgot-secret', expiresIn: '1h' },
      );
    });
  });

  describe('verifyForgotPasswordToken', () => {
    it('should verify with forgotSecret', async () => {
      jwtService.verifyAsync.mockResolvedValue({ forgotUserId: 42 });

      const result = await service.verifyForgotPasswordToken('some-hash');

      expect(result).toEqual({ forgotUserId: 42 });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('some-hash', {
        secret: 'forgot-secret',
      });
    });
  });
});
