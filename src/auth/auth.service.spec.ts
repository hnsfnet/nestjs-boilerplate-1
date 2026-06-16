import { Test } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AuthTokensService } from './auth-tokens.service';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { MailService } from '../mail/mail.service';
import { AuthProvidersEnum } from './auth-providers.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { User } from '../users/domain/user';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findBySocialIdAndProvider: jest.fn(),
  };
  const sessionService = {
    create: jest.fn(),
    updateByHash: jest.fn(),
    deleteByUserId: jest.fn(),
    deleteByUserIdWithExclude: jest.fn(),
    deleteById: jest.fn(),
  };
  const mailService = {
    userSignUp: jest.fn(),
    forgotPassword: jest.fn(),
    confirmNewEmail: jest.fn(),
  };
  const authTokensService = {
    createSessionHash: jest.fn(),
    getTokensData: jest.fn(),
    createConfirmEmailHash: jest.fn(),
    createConfirmNewEmailHash: jest.fn(),
    createForgotPasswordToken: jest.fn(),
    verifyConfirmEmailHash: jest.fn(),
    verifyConfirmNewEmailHash: jest.fn(),
    verifyForgotPasswordHash: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: SessionService, useValue: sessionService },
        { provide: MailService, useValue: mailService },
        { provide: AuthTokensService, useValue: authTokensService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('validateLogin', () => {
    it('creates a session with a fresh hash and returns the login payload + user', async () => {
      const password = 'secret';
      const user = {
        id: 1,
        email: 'user@example.com',
        provider: AuthProvidersEnum.email,
        password: bcrypt.hashSync(password, 10),
        role: { id: 2 },
      } as unknown as User;

      usersService.findByEmail.mockResolvedValue(user);
      authTokensService.createSessionHash.mockReturnValue('session-hash');
      sessionService.create.mockResolvedValue({ id: 'sess-1' });
      authTokensService.getTokensData.mockResolvedValue({
        token: 'access',
        refreshToken: 'refresh',
        tokenExpires: 1234,
      });

      const result = await service.validateLogin({
        email: 'user@example.com',
        password,
      } as AuthEmailLoginDto);

      expect(result).toEqual({
        refreshToken: 'refresh',
        token: 'access',
        tokenExpires: 1234,
        user,
      });
      expect(sessionService.create).toHaveBeenCalledWith({
        user,
        hash: 'session-hash',
      });
      expect(authTokensService.getTokensData).toHaveBeenCalledWith({
        id: 1,
        role: { id: 2 },
        sessionId: 'sess-1',
        hash: 'session-hash',
      });
    });
  });

  describe('refreshToken', () => {
    it('rotates the session hash and returns tokens without the user', async () => {
      authTokensService.createSessionHash.mockReturnValue('new-hash');
      sessionService.updateByHash.mockResolvedValue({
        id: 'sess-1',
        user: { id: 1 },
      });
      usersService.findById.mockResolvedValue({ id: 1, role: { id: 2 } });
      authTokensService.getTokensData.mockResolvedValue({
        token: 'access',
        refreshToken: 'refresh',
        tokenExpires: 99,
      });

      const result = await service.refreshToken({
        sessionId: 'sess-1',
        hash: 'old-hash',
      });

      expect(result).toEqual({
        token: 'access',
        refreshToken: 'refresh',
        tokenExpires: 99,
      });
      expect(sessionService.updateByHash).toHaveBeenCalledWith(
        { id: 'sess-1', hash: 'old-hash' },
        { hash: 'new-hash' },
      );
    });

    it('throws Unauthorized when the session can no longer be found', async () => {
      authTokensService.createSessionHash.mockReturnValue('new-hash');
      sessionService.updateByHash.mockResolvedValue(null);

      await expect(
        service.refreshToken({ sessionId: 'sess-1', hash: 'old-hash' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('update', () => {
    it('evicts every other session (keeping the current one) on password change', async () => {
      const currentUser = {
        id: 1,
        email: 'user@example.com',
        password: bcrypt.hashSync('old-password', 10),
      } as unknown as User;

      usersService.findById.mockResolvedValue(currentUser);
      usersService.update.mockResolvedValue(currentUser);

      await service.update(
        {
          id: 1,
          role: { id: 2 },
          sessionId: 'sess-current',
          iat: 0,
          exp: 0,
        } as unknown as JwtPayloadType,
        {
          password: 'new-password',
          oldPassword: 'old-password',
        } as AuthUpdateDto,
      );

      expect(sessionService.deleteByUserIdWithExclude).toHaveBeenCalledWith({
        userId: 1,
        excludeSessionId: 'sess-current',
      });
    });
  });

  describe('confirmEmail', () => {
    it('activates an inactive user', async () => {
      authTokensService.verifyConfirmEmailHash.mockResolvedValue(1);
      usersService.findById.mockResolvedValue({
        id: 1,
        status: { id: StatusEnum.inactive },
      } as unknown as User);

      await service.confirmEmail('hash');

      expect(usersService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: { id: StatusEnum.active } }),
      );
    });

    it('rejects when the user is not in the inactive state', async () => {
      authTokensService.verifyConfirmEmailHash.mockResolvedValue(1);
      usersService.findById.mockResolvedValue({
        id: 1,
        status: { id: StatusEnum.active },
      } as unknown as User);

      await expect(service.confirmEmail('hash')).rejects.toThrow(
        NotFoundException,
      );
      expect(usersService.update).not.toHaveBeenCalled();
    });
  });
});
