-- Migration 012: OAuth 2.0 refresh tokens
-- Sin refresh_token el cliente (Claude Web) tiene que repetir el consentimiento cada
-- vez que caduca el access token. Cada refresh_token se usa una sola vez (rotación):
-- el UPDATE ... WHERE revoked = FALSE ... RETURNING lo consume de forma atómica.
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  token VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
