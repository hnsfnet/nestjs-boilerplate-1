import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialInterface } from '../social/interfaces/social.interface';
import { FacebookInterface } from './interfaces/facebook.interface';
import { AuthFacebookLoginDto } from './dto/auth-facebook-login.dto';
import { AllConfigType } from '../config/config.type';
import { BaseSocialProviderAdapter } from '../social/base-social-provider.adapter';
import {
  SocialTokenInvalidException,
  SocialProviderConfigException,
  SocialProviderUnavailableException,
} from '../social/exceptions/social-auth.exception';

@Injectable()
export class AuthFacebookService extends BaseSocialProviderAdapter<AuthFacebookLoginDto> {
  readonly providerName = 'facebook';

  // Base Facebook Graph API URL and API version
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly apiVersion = 'v23.0';

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  /**
   * Retrieves a Facebook user profile using the provided access token.
   * First validates the token, then fetches the user's profile fields.
   */
  async getProfileByToken(
    loginDto: AuthFacebookLoginDto,
  ): Promise<SocialInterface> {
    // Step 1: Verify that the token is valid and belongs to our app
    await this.verifyAccessToken(loginDto.accessToken);

    // Step 2: Construct the profile URL and query Facebook for user data
    const profileUrl = new URL(`${this.baseUrl}/${this.apiVersion}/me`);
    profileUrl.searchParams.set('fields', 'id,last_name,email,first_name');
    profileUrl.searchParams.set('access_token', loginDto.accessToken);

    const data = await this.fetchJson<FacebookInterface>(profileUrl.toString());

    // Ensure required fields are present in the response
    if (!data.id) {
      throw new SocialProviderUnavailableException(
        this.providerName,
        'Invalid Facebook profile data: missing id',
      );
    }

    // Map Facebook data to our internal social user interface
    return {
      id: data.id,
      email: data.email || undefined,
      firstName: data.first_name || '',
      lastName: data.last_name || '',
    };
  }

  /**
   * Validates the Facebook access token by calling the /debug_token endpoint.
   * Also ensures the token belongs to our application.
   */
  private async verifyAccessToken(accessToken: string): Promise<void> {
    const appId = this.configService.get('facebook.appId', { infer: true });
    const appSecret = this.configService.get('facebook.appSecret', {
      infer: true,
    });

    this.assertConfig({ appId, appSecret });

    const debugUrl = new URL(`${this.baseUrl}/debug_token`);
    const appAccessToken = `${appId}|${appSecret}`;

    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', appAccessToken);

    // Use a shorter timeout for token verification
    const result = await this.fetchJson<{
      data: { is_valid: boolean; app_id: string };
    }>(debugUrl.toString(), 5000);

    const tokenData = result.data;

    if (!tokenData.is_valid) {
      throw new SocialTokenInvalidException(
        this.providerName,
        'Invalid Facebook access token',
      );
    }

    // Security: ensure the token belongs to our app
    if (tokenData.app_id !== appId) {
      throw new SocialTokenInvalidException(
        this.providerName,
        'Access token does not belong to this app',
      );
    }
  }

  /**
   * Exchanges a short-lived Facebook access token for a long-lived one.
   * Useful for persisting user sessions longer than the default 1–2 hours.
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    const appId = this.configService.get('facebook.appId', { infer: true });
    const appSecret = this.configService.get('facebook.appSecret', {
      infer: true,
    });

    this.assertConfig({ appId, appSecret });

    const tokenUrl = new URL(`${this.baseUrl}/oauth/access_token`);
    tokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const data = await this.fetchJson<{ access_token: string }>(
      tokenUrl.toString(),
    );

    if (!data.access_token) {
      throw new SocialProviderUnavailableException(
        this.providerName,
        'Token exchange did not return an access token',
      );
    }

    return data.access_token;
  }
}
