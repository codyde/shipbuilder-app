import 'dotenv/config';
import * as Sentry from '@sentry/node';

const { logger } = Sentry;

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  locale?: string;
}

export class GoogleOAuthService {
  private config: GoogleOAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    };

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
  }

  /**
   * Generate the authorization URL to redirect users to Google
   */
  getAuthorizationUrl(state?: string): string {
    // Google OAuth 2.0 scopes for basic profile information
    const scope = 'openid email profile';
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scope,
      access_type: 'offline', // Get refresh token
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    logger.info('Generated Google authorization URL', {
      authUrl,
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scope: scope
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    try {
      logger.info(logger.fmt`Exchanging code for token with Google: ${code}`, {
        tokenUrl,
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        codeLength: code.length
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: params.toString(),
      });

      logger.info('Google token exchange response', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `Failed to exchange code for token: ${response.status} ${errorText}`;
        logger.error(logger.fmt`${errorMessage}`, {
          status: response.status,
          statusText: response.statusText,
          errorText,
          tokenUrl,
          requestBody: params.toString()
        });
        
        Sentry.captureException(new Error(errorMessage), {
          tags: { 
            oauth_service: 'google',
            oauth_step: 'token_exchange',
            http_status: response.status.toString()
          },
          extra: {
            status: response.status,
            statusText: response.statusText,
            errorText,
            tokenUrl,
            clientId: this.config.clientId,
            redirectUri: this.config.redirectUri
          }
        });
        
        throw new Error(errorMessage);
      }

      const tokenData = await response.json();
      logger.info('Successfully received Google token', {
        hasAccessToken: !!tokenData.access_token,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in,
        hasRefreshToken: !!tokenData.refresh_token,
        hasIdToken: !!tokenData.id_token,
        accessTokenLength: tokenData.access_token ? tokenData.access_token.length : 0,
        tokenKeys: Object.keys(tokenData)
      });

      return tokenData;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Google token exchange error', {
          message: error.message,
          stack: error.stack
        });
        Sentry.captureException(error, {
          tags: { 
            oauth_service: 'google',
            oauth_step: 'token_exchange_network'
          },
          extra: {
            tokenUrl,
            clientId: this.config.clientId,
            redirectUri: this.config.redirectUri
          }
        });
        throw error;
      }
      const networkError = new Error('Network error during Google token exchange');
      Sentry.captureException(networkError, {
        tags: { 
          oauth_service: 'google',
          oauth_step: 'token_exchange_unknown'
        }
      });
      throw networkError;
    }
  }

  /**
   * Get user information from Google API using access token
   */
  async getUserInfo(accessToken: string): Promise<GoogleUser> {
    const userUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

    try {
      logger.info(`Fetching user info from Google: ${userUrl}`, {
        userUrl,
        hasAccessToken: !!accessToken,
        tokenLength: accessToken.length
      });

      const response = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      logger.info(`Response from Google userinfo`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `Failed to get user info from Google: ${response.status} ${errorText}`;
        logger.error(errorMessage, {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
          userUrl
        });
        
        Sentry.captureException(new Error(errorMessage), {
          tags: { 
            oauth_service: 'google',
            oauth_step: 'user_info',
            http_status: response.status.toString()
          },
          extra: {
            status: response.status,
            statusText: response.statusText,
            errorText,
            userUrl,
            accessTokenLength: accessToken.length
          }
        });
        
        throw new Error(errorMessage);
      }

      const userData = await response.json();
      
      // Detailed logging for Google user data
      logger.info('=== USER DATA FROM GOOGLE API ===', {
        timestamp: new Date().toISOString(),
        endpoint: userUrl,
        fullUserData: userData,
        userDataKeys: Object.keys(userData)
      });
      
      console.log('\n=== USER DATA FROM GOOGLE API ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Endpoint:', userUrl);
      console.log('Full User Data:', JSON.stringify(userData, null, 2));
      console.log('User Data Keys:', Object.keys(userData));
      console.log('=================================\n');
      
      logger.info(`Successfully received user data from Google`, {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        verified_email: userData.verified_email,
        hasPicture: !!userData.picture,
        fullUserData: userData
      });
      
      if (!userData.id || !userData.email) {
        const errorMessage = 'Invalid user data from Google - missing id or email';
        logger.error(errorMessage, { userData });
        throw new Error(errorMessage);
      }

      if (!userData.verified_email) {
        const errorMessage = 'Google account email is not verified';
        logger.error(errorMessage, { userData });
        throw new Error(errorMessage);
      }
      
      return {
        id: userData.id,
        email: userData.email,
        verified_email: userData.verified_email,
        name: userData.name || `${userData.given_name} ${userData.family_name}`.trim() || userData.email.split('@')[0],
        given_name: userData.given_name,
        family_name: userData.family_name,
        picture: userData.picture,
        locale: userData.locale,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error fetching Google user info', {
        error: error,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        accessTokenLength: accessToken.length
      });
      
      Sentry.captureException(error instanceof Error ? error : new Error(errorMessage), {
        tags: { 
          oauth_service: 'google',
          oauth_step: 'user_info_network'
        },
        extra: { 
          userUrl,
          accessTokenLength: accessToken.length,
          originalError: errorMessage
        }
      });
      
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  /**
   * Complete OAuth flow: exchange code for token and get user info
   */
  async completeOAuthFlow(code: string): Promise<{ user: GoogleUser; accessToken: string }> {
    const tokenResponse = await this.exchangeCodeForToken(code);
    
    // Google doesn't typically include user info in token response, so we fetch it separately
    logger.info('Fetching user info from Google API');
    const user = await this.getUserInfo(tokenResponse.access_token);
    
    return {
      user,
      accessToken: tokenResponse.access_token,
    };
  }
}

export const googleOAuthService = new GoogleOAuthService();