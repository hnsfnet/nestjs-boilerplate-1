import { Injectable } from '@nestjs/common';
import appleSigninAuth from 'apple-signin-auth';
import { ConfigService } from '@nestjs/config';
import { SocialInterface } from '../social/interfaces/social.interface';
import { AuthAppleLoginDto } from './dto/auth-apple-login.dto';
import { AllConfigType } from '../config/config.type';
import { BaseSocialProviderAdapter } from '../social/base-social-provider.adapter';
import { SocialTokenInvalidException } from '../social/exceptions/social-auth.exception';

@Injectable()
export class AuthAppleService extends BaseSocialProviderAdapter<AuthAppleLoginDto> {
  readonly providerName = 'apple';

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  async getProfileByToken(
    loginDto: AuthAppleLoginDto,
  ): Promise<SocialInterface> {
    try {
      const data = await appleSigninAuth.verifyIdToken(loginDto.idToken, {
        audience: this.configService.get('apple.appAudience', { infer: true }),
      });

      return {
        id: data.sub,
        email: data.email,
        firstName: loginDto.firstName,
        lastName: loginDto.lastName,
      };
    } catch (error) {
      throw new SocialTokenInvalidException(
        this.providerName,
        'Apple token verification failed',
        error,
      );
    }
  }
}
