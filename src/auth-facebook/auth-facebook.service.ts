import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialInterface } from '../social/interfaces/social.interface';
import { BaseSocialAuthService } from '../social/base-social-auth.service';
import { SocialAuthException } from '../social/exceptions/social-auth.exception';
import { FacebookInterface } from './interfaces/facebook.interface';
import { AuthFacebookLoginDto } from './dto/auth-facebook-login.dto';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class AuthFacebookService extends BaseSocialAuthService<AuthFacebookLoginDto> {
  private readonly logger = new Logger(AuthFacebookService.name);

  // Base Facebook Graph API URL and API version
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly apiVersion = 'v23.0';

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  /**
   * Verifies the access token and fetches the user's Facebook profile.
   *
   * All failures (token verification, HTTP errors, timeouts, missing fields)
   * are surfaced as {@link SocialAuthException} so the base class can hand the
   * caller a single, consistent error instead of the previous mix of HTTP
   * statuses. Unexpected errors (e.g. network/timeout) bubble up and are
   * normalized by {@link BaseSocialAuthService.getProfileByToken}.
   */
  protected async fetchProfile(
    loginDto: AuthFacebookLoginDto,
  ): Promise<SocialInterface> {
    // Step 1: Verify that the token is valid and belongs to our app
    await this.verifyAccessToken(loginDto.accessToken);

    // Step 2: Construct the profile URL and query Facebook for user data
    const profileUrl = new URL(`${this.baseUrl}/${this.apiVersion}/me`);
    profileUrl.searchParams.set('fields', 'id,last_name,email,first_name');
    profileUrl.searchParams.set('access_token', loginDto.accessToken);

    const response = await fetch(profileUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000), // Abort request if it exceeds 10 seconds
    });

    if (!response.ok) {
      throw new SocialAuthException();
    }

    const data: FacebookInterface = await response.json();

    // Ensure required fields are present in the response
    if (!data.id) {
      throw new SocialAuthException();
    }

    // Map Facebook data to our internal social user interface
    return {
      id: data.id,
      email: data.email || undefined, // Email may not be present depending on user permissions
      firstName: data.first_name || '',
      lastName: data.last_name || '',
    };
  }

  /**
   * Validates the Facebook access token by calling the /debug_token endpoint.
   * Also ensures the token belongs to our application.
   * @param accessToken The user's short-lived access token to be verified.
   */
  private async verifyAccessToken(accessToken: string): Promise<void> {
    const appId = this.configService.get('facebook.appId', { infer: true });
    const appSecret = this.configService.get('facebook.appSecret', {
      infer: true,
    });

    // Application credentials must be configured properly. This is a server
    // side misconfiguration rather than a bad token, so it is logged before
    // being normalized into the shared social auth error.
    if (!appId || !appSecret) {
      this.logger.warn('Facebook app credentials are not configured');
      throw new SocialAuthException();
    }

    const debugUrl = new URL(`${this.baseUrl}/debug_token`);
    const appAccessToken = `${appId}|${appSecret}`;

    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', appAccessToken);

    const response = await fetch(debugUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout for validation
    });

    if (!response.ok) {
      throw new SocialAuthException();
    }

    const result = await response.json();
    const tokenData = result.data;

    // Check if the token is valid and active
    if (!tokenData?.is_valid) {
      throw new SocialAuthException();
    }

    // Check if the token belongs to our app (security measure)
    if (tokenData.app_id !== appId) {
      throw new SocialAuthException();
    }
  }
}
