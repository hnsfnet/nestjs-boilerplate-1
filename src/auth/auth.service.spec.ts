import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { AuthNotificationService } from './services/auth-notification.service';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { AuthProvidersEnum } from './auth-providers.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { RoleEnum } from '../roles/roles.enum';
import {
  UnprocessableEntityException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

// Mock session hash to return predictable values
jest.mock('./utils/session-hash.util', () => ({
  generateSessionHash: jest.fn(() => 'mock-session-hash'),
}));

import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    findBySocialIdAndProvider: jest.Mock;
  };
  let sessionService: {
    create: jest.Mock;
    updateByHash: jest.Mock;
    deleteById: jest.Mock;
    deleteByUserId: jest.Mock;
    deleteByUserIdWithExclude: jest.Mock;
  };
  let tokenService: {
    generateTokenPair: jest.Mock;
    signConfirmEmailToken: jest.Mock;
    verifyConfirmEmailToken: jest.Mock;
    signForgotPasswordToken: jest.Mock;
    verifyForgotPasswordToken: jest.Mock;
  };
  let authNotificationService: {
    sendSignUpConfirmation: jest.Mock;
    sendForgotPassword: jest.Mock;
    sendConfirmNewEmail: jest.Mock;
  };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashed-password',
    provider: AuthProvidersEnum.email,
    role: { id: RoleEnum.user },
    status: { id: StatusEnum.active },
  };

  const mockSession = {
    id: 10,
    user: mockUser,
    hash: 'session-hash',
  };

  const mockTokens = {
    token: 'access-token',
    refreshToken: 'refresh-token',
    tokenExpires: Date.now() + 900000,
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findBySocialIdAndProvider: jest.fn(),
    };
    sessionService = {
      create: jest.fn(),
      updateByHash: jest.fn(),
      deleteById: jest.fn(),
      deleteByUserId: jest.fn(),
      deleteByUserIdWithExclude: jest.fn(),
    };
    tokenService = {
      generateTokenPair: jest.fn().mockResolvedValue(mockTokens),
      signConfirmEmailToken: jest.fn().mockResolvedValue('confirm-jwt'),
      verifyConfirmEmailToken: jest.fn(),
      signForgotPasswordToken: jest.fn(),
      verifyForgotPasswordToken: jest.fn(),
    };
    authNotificationService = {
      sendSignUpConfirmation: jest.fn().mockResolvedValue(undefined),
      sendForgotPassword: jest.fn().mockResolvedValue(undefined),
      sendConfirmNewEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: SessionService, useValue: sessionService },
        { provide: TokenService, useValue: tokenService },
        { provide: AuthNotificationService, useValue: authNotificationService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateLogin', () => {
    it('should return tokens and user on valid login', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      sessionService.create.mockResolvedValue(mockSession);

      const result = await service.validateLogin({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpires: mockTokens.tokenExpires,
        user: mockUser,
      });
      expect(sessionService.create).toHaveBeenCalledWith({
        user: mockUser,
        hash: 'mock-session-hash',
      });
      expect(tokenService.generateTokenPair).toHaveBeenCalledWith({
        id: 1,
        role: { id: RoleEnum.user },
        sessionId: 10,
        hash: 'mock-session-hash',
      });
    });

    it('should throw if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateLogin({ email: 'none@example.com', password: 'p' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw if user registered via social provider', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        provider: 'google',
      });

      await expect(
        service.validateLogin({ email: 'test@example.com', password: 'p' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw if password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateLogin({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('register', () => {
    it('should create user and send sign-up confirmation', async () => {
      usersService.create.mockResolvedValue({ id: 2, email: 'new@example.com' });

      await service.register({
        email: 'new@example.com',
        password: 'password',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          role: { id: RoleEnum.user },
          status: { id: StatusEnum.inactive },
        }),
      );
      expect(authNotificationService.sendSignUpConfirmation).toHaveBeenCalledWith(
        'new@example.com',
        2,
      );
    });
  });

  describe('confirmEmail', () => {
    it('should activate user on valid hash', async () => {
      tokenService.verifyConfirmEmailToken.mockResolvedValue({
        confirmEmailUserId: 1,
      });
      usersService.findById.mockResolvedValue({
        ...mockUser,
        status: { id: StatusEnum.inactive },
      });

      await service.confirmEmail('valid-hash');

      expect(usersService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: { id: StatusEnum.active } }),
      );
    });

    it('should throw on invalid hash', async () => {
      tokenService.verifyConfirmEmailToken.mockRejectedValue(new Error('bad'));

      await expect(service.confirmEmail('bad-hash')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw if user already active', async () => {
      tokenService.verifyConfirmEmailToken.mockResolvedValue({
        confirmEmailUserId: 1,
      });
      usersService.findById.mockResolvedValue({
        ...mockUser,
        status: { id: StatusEnum.active },
      });

      await expect(service.confirmEmail('valid-hash')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send forgot-password notification for existing user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await service.forgotPassword('test@example.com');

      expect(authNotificationService.sendForgotPassword).toHaveBeenCalledWith(
        'test@example.com',
        1,
      );
    });

    it('should throw if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.forgotPassword('none@example.com')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('resetPassword', () => {
    it('should update password and delete all sessions', async () => {
      tokenService.verifyForgotPasswordToken.mockResolvedValue({
        forgotUserId: 1,
      });
      usersService.findById.mockResolvedValue(mockUser);

      await service.resetPassword('valid-hash', 'newPassword');

      expect(sessionService.deleteByUserId).toHaveBeenCalledWith({
        userId: 1,
      });
      expect(usersService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ password: 'newPassword' }),
      );
    });

    it('should throw on invalid hash', async () => {
      tokenService.verifyForgotPasswordToken.mockRejectedValue(
        new Error('expired'),
      );

      await expect(service.resetPassword('bad-hash', 'p')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('confirmNewEmail', () => {
    it('should update email and set active status', async () => {
      tokenService.verifyConfirmEmailToken.mockResolvedValue({
        confirmEmailUserId: 1,
        newEmail: 'new@example.com',
      });
      usersService.findById.mockResolvedValue(mockUser);

      await service.confirmNewEmail('valid-hash');

      expect(usersService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          email: 'new@example.com',
          status: { id: StatusEnum.active },
        }),
      );
    });

    it('should throw on invalid hash', async () => {
      tokenService.verifyConfirmEmailToken.mockRejectedValue(new Error('bad'));

      await expect(service.confirmNewEmail('bad-hash')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should rotate session hash and return new token pair', async () => {
      sessionService.updateByHash.mockResolvedValue(mockSession);
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.refreshToken({
        sessionId: 10,
        hash: 'old-hash',
      });

      expect(sessionService.updateByHash).toHaveBeenCalledWith(
        { id: 10, hash: 'old-hash' },
        { hash: 'mock-session-hash' },
      );
      expect(result).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpires: mockTokens.tokenExpires,
      });
    });

    it('should throw if session not found (hash mismatch)', async () => {
      sessionService.updateByHash.mockResolvedValue(null);

      await expect(
        service.refreshToken({ sessionId: 10, hash: 'stale-hash' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user has no role', async () => {
      sessionService.updateByHash.mockResolvedValue(mockSession);
      usersService.findById.mockResolvedValue({ ...mockUser, role: null });

      await expect(
        service.refreshToken({ sessionId: 10, hash: 'old-hash' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('update', () => {
    it('should send confirm-new-email notification when email changes', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      usersService.findByEmail.mockResolvedValue(null);

      await service.update(
        { id: 1, role: mockUser.role, sessionId: 10, iat: 0, exp: 0 },
        { email: 'new@example.com' },
      );

      expect(authNotificationService.sendConfirmNewEmail).toHaveBeenCalledWith(
        'new@example.com',
        1,
        'new@example.com',
      );
    });

    it('should delete other sessions when password changes', async () => {
      const userWithPassword = { ...mockUser, password: 'hashed-old' };
      usersService.findById.mockResolvedValue(userWithPassword);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.update(
        { id: 1, role: mockUser.role, sessionId: 10, iat: 0, exp: 0 },
        { password: 'newPass', oldPassword: 'oldPass' },
      );

      expect(sessionService.deleteByUserIdWithExclude).toHaveBeenCalledWith({
        userId: 1,
        excludeSessionId: 10,
      });
    });

    it('should throw if old password is wrong', async () => {
      const userWithPassword = { ...mockUser, password: 'hashed-old' };
      usersService.findById.mockResolvedValue(userWithPassword);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.update(
          { id: 1, role: mockUser.role, sessionId: 10, iat: 0, exp: 0 },
          { password: 'newPass', oldPassword: 'wrongOld' },
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('logout', () => {
    it('should delete session by id', async () => {
      await service.logout({ sessionId: 10 });
      expect(sessionService.deleteById).toHaveBeenCalledWith(10);
    });
  });

  describe('softDelete', () => {
    it('should remove user', async () => {
      await service.softDelete(mockUser);
      expect(usersService.remove).toHaveBeenCalledWith(1);
    });
  });
});
