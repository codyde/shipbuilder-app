#!/usr/bin/env node

/**
 * Test OAuth Device Flow for MCP
 * 
 * This simulates how an MCP client (like Context) would authenticate using device flow
 */

const baseUrl = 'http://localhost:5173';

async function testDeviceFlow() {
  console.log('🚀 Testing OAuth Device Flow for MCP\n');

  try {
    // Step 1: Request device and user codes
    console.log('1️⃣  Requesting device and user codes...');
    const deviceResponse = await fetch(`${baseUrl}/mcp/device/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'mcp_test_client',
        scope: 'projects:read tasks:read'
      })
    });

    if (!deviceResponse.ok) {
      throw new Error(`Device authorization failed: ${deviceResponse.status}`);
    }

    const deviceData = await deviceResponse.json();
    console.log('✅ Device codes generated:');
    console.log(`   User Code: ${deviceData.user_code}`);
    console.log(`   Device Code: ${deviceData.device_code.substring(0, 8)}...`);
    console.log(`   Verification URI: ${deviceData.verification_uri}`);
    console.log(`   Complete URI: ${deviceData.verification_uri_complete}`);
    console.log(`   Expires in: ${deviceData.expires_in} seconds`);
    console.log(`   Poll interval: ${deviceData.interval} seconds\n`);

    // Step 2: Show user instructions
    console.log('2️⃣  User Instructions:');
    console.log(`   🌐 Open: ${deviceData.verification_uri}`);
    console.log(`   🔑 Enter code: ${deviceData.user_code}`);
    console.log(`   ⚡ Or click: ${deviceData.verification_uri_complete}\n`);

    // Step 3: Poll for token
    console.log('3️⃣  Polling for authorization...');
    console.log('   (Waiting for user to approve in browser)\n');

    let attempts = 0;
    const maxAttempts = Math.floor(deviceData.expires_in / deviceData.interval);

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, deviceData.interval * 1000));
      attempts++;

      console.log(`   Poll attempt ${attempts}/${maxAttempts}...`);

      try {
        const tokenResponse = await fetch(`${baseUrl}/mcp/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceData.device_code,
            client_id: 'mcp_test_client'
          })
        });

        const tokenData = await tokenResponse.json();

        if (tokenResponse.ok) {
          console.log('✅ Authorization successful!');
          console.log(`   Access Token: ${tokenData.access_token.substring(0, 20)}...`);
          console.log(`   Token Type: ${tokenData.token_type}`);
          console.log(`   Expires in: ${tokenData.expires_in} seconds`);
          console.log(`   Scope: ${tokenData.scope}\n`);

          // Step 4: Test MCP API
          console.log('4️⃣  Testing MCP API access...');
          const mcpResponse = await fetch(`${baseUrl}/mcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-1',
              method: 'tools/list'
            })
          });

          if (mcpResponse.ok) {
            const mcpData = await mcpResponse.json();
            console.log('✅ MCP API access successful!');
            console.log(`   Available tools: ${mcpData.result?.tools?.length || 0}`);
            if (mcpData.result?.tools) {
              mcpData.result.tools.forEach(tool => {
                console.log(`   - ${tool.name}: ${tool.description}`);
              });
            }
          } else {
            console.log('❌ MCP API access failed:', mcpResponse.status);
          }

          return;
        }

        if (tokenData.error === 'authorization_pending') {
          console.log('   ⏳ Still waiting for user authorization...');
          continue;
        }

        if (tokenData.error === 'access_denied') {
          console.log('❌ User denied authorization');
          return;
        }

        if (tokenData.error === 'expired_token') {
          console.log('❌ Device code expired');
          return;
        }

        console.log('❌ Unexpected error:', tokenData.error);
        return;

      } catch (error) {
        console.log('❌ Network error during polling:', error.message);
        continue;
      }
    }

    console.log('❌ Timeout: User did not authorize within the time limit');

  } catch (error) {
    console.error('❌ Device flow test failed:', error.message);
  }
}

// Run the test
testDeviceFlow();