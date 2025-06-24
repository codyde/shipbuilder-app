// Debug authentication flow to find the issue

console.log('=== DEBUG: Authentication Flow ===\n');

// Check environment variables
console.log('1. Environment Check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('SENTRY_OAUTH_CLIENT_ID exists:', !!process.env.SENTRY_OAUTH_CLIENT_ID);

// Check if we can start the basic app
console.log('\n2. Basic Module Loading:');
try {
    console.log('✅ Script started successfully');
    
    // Import key modules to check for errors
    console.log('Testing import paths...');
    
    // Check if basic Node modules work
    const fs = await import('fs');
    console.log('✅ fs module loaded');
    
    const path = await import('path');
    console.log('✅ path module loaded');
    
    const url = await import('url');
    console.log('✅ url module loaded');
    
    console.log('\n3. Checking server directory structure:');
    const serverExists = fs.existsSync('./server');
    console.log('server/ directory exists:', serverExists);
    
    if (serverExists) {
        const dbExists = fs.existsSync('./server/db');
        console.log('server/db/ directory exists:', dbExists);
        
        const routesExists = fs.existsSync('./server/routes');
        console.log('server/routes/ directory exists:', routesExists);
        
        const envExists = fs.existsSync('./server/.env');
        console.log('server/.env file exists:', envExists);
    }
    
} catch (error) {
    console.error('❌ Module loading failed:', error.message);
}

console.log('\n=== Debug Complete ===');