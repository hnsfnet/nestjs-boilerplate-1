import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { AllConfigType } from '../../config/config.type';
import { Session } from '../../session/domain/session';
import { User } from '../../users/domain/user';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async generateTokenPair(data: {
    id: User['id'];
    role: User['role'];
    sessionId: Session['id'];
    hash: Session['hash'];
  }): Promise<{ token: string; refreshToken: string; tokenExpires: number }> {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
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
      this.jwtService.signAsync(
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

    return { token, refreshToken, tokenExpires };
  }

  async signConfirmEmailToken(payload: {
    confirmEmailUserId: User['id'];
    newEmail?: User['email'];
  }): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
        infer: true,
      }),
      expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
        infer: true,
      }),
    });
  }

  async verifyConfirmEmailToken<T = {
    confirmEmailUserId: User['id'];
    newEmail?: User['email'];
  }>(hash: string): Promise<T> {
    return this.jwtService.verifyAsync<T>(hash, {
      secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
        infer: true,
      }),
    });
  }

  async signForgotPasswordToken(
    userId: User['id'],
  ): Promise<{ hash: string; tokenExpires: number }> {
    const tokenExpiresIn = this.configService.getOrThrow('auth.forgotExpires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      { forgotUserId: userId },
      {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
        expiresIn: tokenExpiresIn,
      },
    );

    return { hash, tokenExpires };
  }

  async verifyForgotPasswordToken<T = { forgotUserId: User['id'] }>(
    hash: string,
  ): Promise<T> {
    return this.jwtService.verifyAsync<T>(hash, {
      secret: this.configService.getOrThrow('auth.forgotSecret', {
        infer: true,
      }),
    });
  }
}
