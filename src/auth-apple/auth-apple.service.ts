import { Injectable } from '@nestjs/common';
import appleSigninAuth from 'apple-signin-auth';
import { ConfigService } from '@nestjs/config';
import { SocialInterface } from '../social/interfaces/social.interface';
import { BaseSocialAuthService } from '../social/base-social-auth.service';
import { AuthAppleLoginDto } from './dto/auth-apple-login.dto';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class AuthAppleService extends BaseSocialAuthService<AuthAppleLoginDto> {
  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  protected async fetchProfile(
    loginDto: AuthAppleLoginDto,
  ): Promise<SocialInterface> {
    const data = await appleSigninAuth.verifyIdToken(loginDto.idToken, {
      audience: this.configService.get('apple.appAudience', { infer: true }),
    });

    return {
      id: data.sub,
      email: data.email,
      firstName: loginDto.firstName,
      lastName: loginDto.lastName,
    };
  }
}
