#!/bin/bash
# scripts/test-mcp-http.sh
# Test script for MCP HTTP Server

set -e

TOKEN=$(grep MCP_AUTH_TOKEN .env.local 2>/dev/null | cut -d= -f2 || echo "NO_TOKEN")
BASE_URL="${1:-http://localhost:3001}"

echo "═══════════════════════════════════════════════════════════════"
echo "Testing MCP HTTP Server: $BASE_URL"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1: Health check (sin auth)
echo "[1/5] Health check (sin autenticación)..."
curl -s "$BASE_URL/health" | jq . || echo "FAILED"
echo ""

# Test 2: Sin token (debe fallar con 401)
echo "[2/5] Sin token (debe retornar 401)..."
curl -s -w "\nStatus: %{http_code}\n" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | head -5
echo ""

# Test 3: Initialize con token
echo "[3/5] Initialize con token..."
curl -s -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }' | jq .result.serverInfo || echo "FAILED"
echo ""

# Test 4: List herramientas
echo "[4/5] Herramientas disponibles..."
curl -s -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq '.result.tools[] | {name, description}' || echo "FAILED"
echo ""

# Test 5: Call get_academic_overview
echo "[5/5] Ejecutando herramienta: get_academic_overview..."
curl -s -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_academic_overview",
      "arguments": {}
    }
  }' | jq '.result.content[0].text' | head -20 || echo "FAILED"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✅ Tests completados"
echo "═══════════════════════════════════════════════════════════════"
