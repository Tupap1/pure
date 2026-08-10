import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import 'dotenv/config';

async function main() {
  const apiKey = process.env.MCP_API_KEY || 'Stability8-Showcase4-Lavish9-Petition3';
  const url = `https://mcp.btw-one.com/sse?apiKey=${apiKey}`;
  
  console.log(`Connecting to ${url}...`);
  
  const transport = new SSEClientTransport(new URL(url), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    }
  });
  
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  
  try {
    await client.connect(transport);
    console.log("Connected successfully!");
    const tools = await client.listTools();
    console.log("Available tools:", tools.tools.map(t => t.name));
    process.exit(0);
  } catch (error) {
    console.error("Connection failed:", error);
    process.exit(1);
  }
}

main();
