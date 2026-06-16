import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { SocialInterface } from '../social/interfaces/social.interface';
import { AuthGoogleLoginDto } from './dto/auth-google-login.dto';
import { AllConfigType } from '../config/config.type';
import { BaseSocialProviderAdapter } from '../social/base-social-provider.adapter';
import { SocialTokenInvalidException } from '../social/exceptions/social-auth.exception';

@Injectable()
export class AuthGoogleService extends BaseSocialProviderAdapter<AuthGoogleLoginDto> {
  readonly providerName = 'google';

  private google: OAuth2Client;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
    this.google = new OAuth2Client(
      configService.get('google.clientId', { infer: true }),
      configService.get('google.clientSecret', { infer: true }),
    );
  }

  async getProfileByToken(
    loginDto: AuthGoogleLoginDto,
  ): Promise<SocialInterface> {
    try {
      const ticket = await this.google.verifyIdToken({
        idToken: loginDto.idToken,
        audience: [
          this.configService.getOrThrow('google.clientId', { infer: true }),
        ],
      });

      const data = ticket.getPayload();

      if (!data) {
        throw new SocialTokenInvalidException(this.providerName);
      }

      return {
        id: data.sub,
        email: data.email,
        firstName: data.given_name,
        lastName: data.family_name,
      };
    } catch (error) {
      // Re-throw our own exceptions unchanged
      if (error instanceof SocialTokenInvalidException) {
        throw error;
      }

      // google-auth-library throws various errors (JWT expired, invalid signature, etc.)
      throw new SocialTokenInvalidException(
        this.providerName,
        'Google token verification failed',
        error,
      );
    }
  }
}
