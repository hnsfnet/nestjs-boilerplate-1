import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import crypto from 'crypto';
import ms from 'ms';
import { AllConfigType } from '../config/config.type';
import { Session } from '../session/domain/session';
import { User } from '../users/domain/user';

/**
 * Owns every token / session-hash / expiry concern for authentication:
 * signing access & refresh tokens, generating session rotation hashes, and
 * issuing / verifying the short-lived JWTs embedded in confirmation and
 * password-reset emails. AuthService delegates here so that "auth business
 * decisions" stay separate from token mechanics.
 */
@Injectable()
export class AuthTokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * Random per-session hash used to rotate/refresh sessions. Identical to the
   * value previously inlined in login / social-login / refresh.
   */
  createSessionHash(): string {
    return crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
  }

  async getTokensData(data: {
    id: User['id'];
    role: User['role'];
    sessionId: Session['id'];
    hash: Session['hash'];
  }) {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: data.role,
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  /** Hash embedded in the sign-up confirmation email link. */
  async createConfirmEmailHash(userId: User['id']): Promise<string> {
    return this.jwtService.signAsync(
      {
        confirmEmailUserId: userId,
      },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );
  }

  /** Hash embedded in the "confirm new email" link when a user changes email. */
  async createConfirmNewEmailHash(
    userId: User['id'],
    newEmail: User['email'],
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        confirmEmailUserId: userId,
        newEmail,
      },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );
  }

  /**
   * Forgot-password hash plus its absolute expiry timestamp. The expiry is
   * returned so callers can surface it in the reset link (the `expires` query
   * param) without recomputing the TTL.
   */
  async createForgotPasswordToken(
    userId: User['id'],
  ): Promise<{ hash: string; tokenExpires: number }> {
    const tokenExpiresIn = this.configService.getOrThrow('auth.forgotExpires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      {
        forgotUserId: userId,
      },
      {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
        expiresIn: tokenExpiresIn,
      },
    );

    return { hash, tokenExpires };
  }

  async verifyConfirmEmailHash(hash: string): Promise<User['id']> {
    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
      });

      return jwtData.confirmEmailUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }
  }

  async verifyConfirmNewEmailHash(
    hash: string,
  ): Promise<{ userId: User['id']; newEmail: User['email'] }> {
    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
        newEmail: User['email'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
      });

      return {
        userId: jwtData.confirmEmailUserId,
        newEmail: jwtData.newEmail,
      };
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }
  }

  async verifyForgotPasswordHash(hash: string): Promise<User['id']> {
    try {
      const jwtData = await this.jwtService.verifyAsync<{
        forgotUserId: User['id'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
      });

      return jwtData.forgotUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }
  }
}
