import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { SocialInterface } from '../social/interfaces/social.interface';
import { BaseSocialAuthService } from '../social/base-social-auth.service';
import { SocialAuthException } from '../social/exceptions/social-auth.exception';
import { AuthGoogleLoginDto } from './dto/auth-google-login.dto';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class AuthGoogleService extends BaseSocialAuthService<AuthGoogleLoginDto> {
  private google: OAuth2Client;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
    this.google = new OAuth2Client(
      configService.get('google.clientId', { infer: true }),
      configService.get('google.clientSecret', { infer: true }),
    );
  }

  protected async fetchProfile(
    loginDto: AuthGoogleLoginDto,
  ): Promise<SocialInterface> {
    const ticket = await this.google.verifyIdToken({
      idToken: loginDto.idToken,
      audience: [
        this.configService.getOrThrow('google.clientId', { infer: true }),
      ],
    });

    const data = ticket.getPayload();

    if (!data) {
      throw new SocialAuthException();
    }

    return {
      id: data.sub,
      email: data.email,
      firstName: data.given_name,
      lastName: data.family_name,
    };
  }
}
