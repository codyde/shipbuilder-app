#!/usr/bin/env node

/**
 * Test script for OAuth 2.1 Authorization Code + PKCE flow
 * This script simulates an MCP client connecting to our server
 */

import { randomBytes, createHash } from 'crypto';

const BASE_URL = 'http://localhost:3001';
const CLIENT_ID = 'test-mcp-client';
const REDIRECT_URI = 'http://localhost:8080/callback';

console.log('🚀 Testing OAuth 2.1 Authorization Code + PKCE Flow for MCP\n');

// Step 1: Test discovery endpoints
console.log('1. Testing OAuth Discovery Endpoints...');

try {
  // Test authorization server metadata
  const authServerResponse = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
  if (authServerResponse.ok) {
    const authServerMetadata = await authServerResponse.json();
    console.log('✅ Authorization Server Metadata:', JSON.stringify(authServerMetadata, null, 2));
  } else {
    console.log('❌ Authorization Server Metadata failed:', authServerResponse.status);
  }

  // Test protected resource metadata
  const resourceResponse = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`);
  if (resourceResponse.ok) {
    const resourceMetadata = await resourceResponse.json();
    console.log('✅ Protected Resource Metadata:', JSON.stringify(resourceMetadata, null, 2));
  } else {
    console.log('❌ Protected Resource Metadata failed:', resourceResponse.status);
  }
} catch (error) {
  console.log('❌ Discovery failed:', error.message);
}

// Step 2: Test MCP server info
console.log('\n2. Testing MCP Server Info...');

try {
  const mcpInfoResponse = await fetch(`${BASE_URL}/mcp`);
  if (mcpInfoResponse.ok) {
    const mcpInfo = await mcpInfoResponse.json();
    console.log('✅ MCP Server Info:', JSON.stringify(mcpInfo, null, 2));
  } else {
    console.log('❌ MCP Server Info failed:', mcpInfoResponse.status);
  }
} catch (error) {
  console.log('❌ MCP Server Info failed:', error.message);
}

// Step 3: Generate PKCE parameters
console.log('\n3. Generating PKCE Parameters...');

const codeVerifier = randomBytes(32).toString('base64url');
const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
const state = randomBytes(16).toString('hex');

console.log('✅ Code Verifier:', codeVerifier);
console.log('✅ Code Challenge:', codeChallenge);
console.log('✅ State:', state);

// Step 4: Generate authorization URL
console.log('\n4. Generating Authorization URL...');

const authParams = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  scope: 'projects:read tasks:read',
  state: state,
});

const authUrl = `${BASE_URL}/api/auth/authorize?${authParams.toString()}`;
console.log('✅ Authorization URL:', authUrl);

console.log('\n📝 Next Steps:');
console.log('1. Open the authorization URL in your browser');
console.log('2. Complete the OAuth flow (login and consent)');
console.log('3. The client will receive an authorization code');
console.log('4. Exchange the code for an access token using POST /mcp/token');

console.log('\n🔧 Token Exchange Example:');
console.log('POST /mcp/token');
console.log('Content-Type: application/x-www-form-urlencoded');
console.log('');
console.log('grant_type=authorization_code');
console.log('code=<authorization_code>');
console.log(`client_id=${CLIENT_ID}`);
console.log(`redirect_uri=${REDIRECT_URI}`);
console.log(`code_verifier=${codeVerifier}`);

console.log('\n✨ OAuth 2.1 flow test completed!');