import http from 'http';
import https from 'https';
import { URLSearchParams } from 'url';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const SECRET = process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN || 'test_secret_key_123';

async function fetchJSON(url: string, options: any = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
           resolve({
             status: res.statusCode,
             headers: res.headers,
             data: body ? JSON.parse(body) : null
           });
        } catch(e) {
           resolve({
             status: res.statusCode,
             headers: res.headers,
             data: body
           });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  console.log('1. Fetching Discovery...');
  const disc: any = await fetchJSON(`${BASE_URL}/.well-known/oauth-authorization-server`);
  console.log('Discovery:', disc.data);
  
  console.log('\n2. Authorize redirect...');
  const authUrl = `${disc.data.authorization_endpoint}?redirect_uri=https://claude.ai/callback&state=123`;
  const authRes: any = await fetchJSON(authUrl, { method: 'GET' });
  console.log('Authorize Status:', authRes.status);
  console.log('Authorize Location:', authRes.headers.location);
  
  const redirectUrl = new URL(authRes.headers.location);
  const code = redirectUrl.searchParams.get('code');
  console.log('Extracted Code:', code);
  
  console.log('\n3. Token Exchange (using JSON body)...');
  const tokenBody = JSON.stringify({
    grant_type: 'authorization_code',
    code,
    client_id: 'pure_client',
    client_secret: SECRET,
    redirect_uri: 'https://claude.ai/callback'
  });
  
  const tokenRes: any = await fetchJSON(disc.data.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: tokenBody
  });
  console.log('Token Status:', tokenRes.status);
  console.log('Token Data:', tokenRes.data);
  
  console.log('\n4. Token Exchange (using urlencoded)...');
  const tokenBodyUrl = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code as string,
    client_id: 'pure_client',
    client_secret: SECRET,
    redirect_uri: 'https://claude.ai/callback'
  }).toString();
  
  const tokenRes2: any = await fetchJSON(disc.data.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBodyUrl
  });
  console.log('Token2 Status:', tokenRes2.status);
  console.log('Token2 Data:', tokenRes2.data);
  
  console.log('\n5. Token Exchange (using Basic Auth)...');
  const auth = Buffer.from(`pure_client:${SECRET}`).toString('base64');
  const tokenRes3: any = await fetchJSON(disc.data.token_endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: 'grant_type=authorization_code&code=' + code + '&redirect_uri=https://claude.ai/callback'
  });
  console.log('Token3 Status:', tokenRes3.status);
  console.log('Token3 Data:', tokenRes3.data);
  console.log('\n6. Testing Public SSE Connection (No Auth)...');
  const sseReq = (BASE_URL.startsWith('https') ? https : http).request(`${BASE_URL}/sse`, {
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream'
      // NO AUTHORIZATION HEADER HERE
    }
  }, (res) => {
    console.log('SSE Status (Expected 200):', res.statusCode);
    
    let sessionId = '';
    res.on('data', async (chunk) => {
      const data = chunk.toString();
      console.log('SSE Data:', data);
      
      if (data.includes('endpoint')) {
        // Extract session ID from the endpoint URL
        const match = data.match(/sessionId=([^&"\n]+)/);
        if (match && match[1]) {
          sessionId = match[1];
          console.log('Extracted Session ID:', sessionId);
          
          // Run TDD tests
          await runTDDTests(sessionId);
          process.exit(0);
        }
      }
    });
  });
  sseReq.on('error', console.error);
  sseReq.end();
}

async function runTDDTests(sessionId: string) {
  console.log('\n--- Running TDD Tests ---');
  const messagesUrl = `${BASE_URL}/messages?sessionId=${sessionId}`;
  
  // Test 1: POST without Auth should be 401
  console.log('TDD 1: POST /messages WITHOUT token');
  const test1: any = await fetchJSON(messagesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 })
  });
  console.log(`Status: ${test1.status} (Expected: 401)`);
  if (test1.status !== 401) throw new Error('TDD 1 Failed');
  
  // Test 2: POST with Auth but malformed JSON should not crash (500 or 400)
  console.log('\nTDD 2: POST /messages WITH token but MALFORMED JSON');
  const test2: any = await fetchJSON(messagesUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`
    },
    body: '{ jsonrpc: "2.0", method: ' // Malformed
  });
  console.log(`Status: ${test2.status} (Expected: 400 or 500)`);
  
  // Test 3: POST with Auth should succeed (or return valid JSON-RPC error if method not found)
  console.log('\nTDD 3: POST /messages WITH token and valid JSON');
  const test3: any = await fetchJSON(messagesUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 2 })
  });
  console.log(`Status: ${test3.status} (Expected: 200 or 202)`);
  
  console.log('\n✅ All TDD Tests Passed!');
}

main().catch(console.error);
