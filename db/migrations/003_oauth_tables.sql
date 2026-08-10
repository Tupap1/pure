-- Migration 003: OAuth 2.0 PKCE Tables
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id VARCHAR(255) PRIMARY KEY,
  client_name VARCHAR(255),
  redirect_uris TEXT[],
  token_endpoint_auth_method VARCHAR(50) DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method VARCHAR(20) DEFAULT 'S256',
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
