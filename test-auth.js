// Simple test to hit the auth endpoint
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testAuthEndpoint() {
    console.log('Testing auth endpoint...');
    
    try {
        // Test health endpoint first
        console.log('\n1. Testing health endpoint...');
        const healthResponse = await fetch(`${API_BASE}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
        
        // Test auth/me without token (should fail with 401)
        console.log('\n2. Testing auth/me without token...');
        const noAuthResponse = await fetch(`${API_BASE}/auth/me`);
        console.log('Status:', noAuthResponse.status);
        const noAuthData = await noAuthResponse.json();
        console.log('Response:', noAuthData);
        
        // Test auth/sentry redirect
        console.log('\n3. Testing auth/sentry endpoint...');
        const sentryResponse = await fetch(`${API_BASE}/auth/sentry`, {
            redirect: 'manual'
        });
        console.log('Sentry auth status:', sentryResponse.status);
        console.log('Sentry auth location:', sentryResponse.headers.get('location'));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Server is not running. Start it with: npm run dev:server');
        }
    }
}

testAuthEndpoint();