import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function main() {
  console.log('Connecting to MCP Server...');
  // Initialize the transport using the public SSE endpoint, just like Claude Web does.
  const transport = new SSEClientTransport(new URL('https://mcp.btw-one.com/sse'));
  
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );
  
  const apiKey = process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN || 'test_secret_key_123';
  const originalFetch = global.fetch;
  global.fetch = async (url, options: any = {}) => {
    if (url.toString().includes('/messages')) {
      const newHeaders = new Headers(options.headers);
      newHeaders.set('Authorization', `Bearer ${apiKey}`);
      options.headers = newHeaders;
      console.log(`[Client] Intercepted POST to ${url}. Injected Authorization header.`);
    }
    return originalFetch(url, options);
  };
  
  try {
    await client.connect(transport);
    console.log('✅ Successfully connected to MCP server!');
    
    console.log('\nFetching tools...');
    const tools = await client.listTools();
    console.log(`✅ Discovered ${tools.tools.length} tools:`, tools.tools.map(t => t.name).join(', '));
    
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    process.exit(0);
  }
}

main();
