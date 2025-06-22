import 'dotenv/config';
import * as Sentry from '@sentry/node';

const { logger } = Sentry;

interface SentryOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
}

interface SentryTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface SentryUser {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar?: {
    avatarUrl?: string;
  };
}

export class SentryOAuthService {
  private config: SentryOAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.SENTRY_OAUTH_CLIENT_ID!,
      clientSecret: process.env.SENTRY_OAUTH_CLIENT_SECRET!,
      redirectUri: process.env.SENTRY_OAUTH_REDIRECT_URI!,
      baseUrl: process.env.SENTRY_BASE_URL || 'https://sentry.io',
    };

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('Sentry OAuth credentials not configured');
    }
  }

  /**
   * Generate the authorization URL to redirect users to Sentry
   */
  getAuthorizationUrl(state?: string): string {
    // Sentry-specific scopes for OAuth login - minimal permissions needed for user authentication
    const scope = 'org:read member:read';
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scope,
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `${this.config.baseUrl}/oauth/authorize/?${params.toString()}`;
    const { logger } = Sentry;
    logger.info('Generated authorization URL', {
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
  async exchangeCodeForToken(code: string): Promise<SentryTokenResponse> {
    const tokenUrl = `${this.config.baseUrl}/oauth/token/`;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    try {
      logger.info(logger.fmt`Exchanging code for token with Sentry: ${code}`, {
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

      logger.info('Token exchange response', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
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
            oauth_service: 'sentry',
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
      logger.info('Successfully received token', {
        hasAccessToken: !!tokenData.access_token,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in,
        refreshToken: !!tokenData.refresh_token,
        fullTokenData: tokenData,
        accessTokenLength: tokenData.access_token ? tokenData.access_token.length : 0,
        tokenKeys: Object.keys(tokenData)
      });

      return tokenData;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Token exchange error', {
          message: error.message,
          stack: error.stack
        });
        Sentry.captureException(error, {
          tags: { 
            oauth_service: 'sentry',
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
      const networkError = new Error('Network error during token exchange');
      Sentry.captureException(networkError, {
        tags: { 
          oauth_service: 'sentry',
          oauth_step: 'token_exchange_unknown'
        }
      });
      throw networkError;
    }
  }

  /**
   * Get user information from Sentry API using access token
   */
  async getUserInfo(accessToken: string): Promise<SentryUser> {
    // OAuth 2.0 standard user info endpoints
    const possibleEndpoints = [
      `${this.config.baseUrl}/oauth/userinfo`,        // Standard OAuth 2.0 userinfo endpoint
      `${this.config.baseUrl}/userinfo`,              // Alternative standard endpoint
      `${this.config.baseUrl}/oauth/userinfo/`,       // With trailing slash
      `${this.config.baseUrl}/userinfo/`,             // Alternative with trailing slash
      `${this.config.baseUrl}/api/0/user/`,           // Sentry API user endpoint
      `${this.config.baseUrl}/api/0/users/me/`,       // Sentry API current user
    ];

    let lastError: Error | null = null;

    for (const userUrl of possibleEndpoints) {
      try {
        const { logger } = Sentry;
        logger.info(`Trying user endpoint: ${userUrl}`, {
          userUrl,
          hasAccessToken: !!accessToken,
          tokenLength: accessToken.length
        });

        // Use standard OAuth 2.0 Bearer token authentication
        const response = await fetch(userUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        logger.info(`Response from ${userUrl}`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (response.ok) {
          const userData = await response.json();
          
          // Detailed logging for API endpoint user data
          logger.info('=== USER DATA FROM API ENDPOINT ===', {
            timestamp: new Date().toISOString(),
            endpoint: userUrl,
            fullUserData: userData,
            userDataKeys: Object.keys(userData)
          });
          
          console.log('\n=== USER DATA FROM API ENDPOINT ===');
          console.log('Timestamp:', new Date().toISOString());
          console.log('Endpoint:', userUrl);
          console.log('Full User Data:', JSON.stringify(userData, null, 2));
          console.log('User Data Keys:', Object.keys(userData));
          console.log('==================================\n');
          
          logger.info(`Successfully received user data from ${userUrl}`, {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            username: userData.username,
            hasAvatar: !!userData.avatar,
            fullUserData: userData
          });
          
          if (!userData.id || !userData.email) {
            logger.warn(`Invalid user data from ${userUrl}`, { userData });
            lastError = new Error(`Invalid user data from ${userUrl}`);
            continue;
          }
          
          // Success! Return the user data
          return {
            id: userData.id,
            email: userData.email,
            name: userData.name || userData.username || userData.email.split('@')[0],
            username: userData.username,
            avatar: userData.avatar?.avatarUrl || userData.avatar?.url || userData.avatar,
          };
        } else {
          const errorText = await response.text();
          logger.warn(`Failed endpoint ${userUrl}`, {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500), // Limit error text to first 500 chars
            isHTML: errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')
          });
          lastError = new Error(`${response.status}: ${errorText.substring(0, 200)}`);
          continue;
        }
      } catch (endpointError) {
        const errorMessage = endpointError instanceof Error ? endpointError.message : String(endpointError);
        logger.warn(`Error trying endpoint ${userUrl}`, {
          error: endpointError,
          message: errorMessage,
          isJSONParseError: errorMessage.includes('Unexpected token'),
          stack: endpointError instanceof Error ? endpointError.stack : undefined
        });
        lastError = endpointError instanceof Error ? endpointError : new Error(String(endpointError));
        continue;
      }
    }

    // If we get here, all endpoints failed
    const finalError = lastError || new Error('All Sentry user endpoints failed');
    logger.error('All Sentry user endpoints failed', {
      error: finalError,
      triedEndpoints: possibleEndpoints,
      accessTokenLength: accessToken.length
    });
    
    Sentry.captureException(finalError, {
      tags: { 
        oauth_service: 'sentry',
        oauth_step: 'user_info_all_failed'
      },
      extra: { 
        triedEndpoints: possibleEndpoints,
        lastError: lastError?.message,
        accessTokenLength: accessToken.length
      }
    });
    
    throw finalError;
  }

  /**
   * Complete OAuth flow: exchange code for token and get user info
   */
  async completeOAuthFlow(code: string): Promise<{ user: SentryUser; accessToken: string }> {
    const tokenResponse = await this.exchangeCodeForToken(code);
    const { logger } = Sentry;
    
    // Check if user info is included in token response (some providers do this)
    if (tokenResponse.user || tokenResponse.user_info || tokenResponse.profile) {
      const userInfo = tokenResponse.user || tokenResponse.user_info || tokenResponse.profile;
      
      // Detailed logging for token-embedded user data
      logger.info('=== USER INFO FROM TOKEN RESPONSE ===', {
        timestamp: new Date().toISOString(),
        fullTokenResponse: tokenResponse,
        userInfo: userInfo,
        tokenKeys: Object.keys(tokenResponse)
      });
      
      console.log('\n=== USER INFO FROM TOKEN RESPONSE ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Full Token Response:', JSON.stringify(tokenResponse, null, 2));
      console.log('User Info Object:', JSON.stringify(userInfo, null, 2));
      console.log('====================================\n');
      
      logger.info('Found user info in token response', { userInfo });
      
      if (userInfo.id && userInfo.email) {
        return {
          user: {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name || userInfo.username || userInfo.email.split('@')[0],
            username: userInfo.username,
            avatar: userInfo.avatar,
          },
          accessToken: tokenResponse.access_token,
        };
      }
    }
    
    // Fall back to fetching user info from API
    logger.info('User info not in token response, fetching from API');
    const user = await this.getUserInfo(tokenResponse.access_token);
    
    return {
      user,
      accessToken: tokenResponse.access_token,
    };
  }
}

export const sentryOAuthService = new SentryOAuthService();