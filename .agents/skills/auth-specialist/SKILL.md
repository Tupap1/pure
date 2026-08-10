---
name: auth-specialist
description: >-
  Provides comprehensive best practices, architecture guidelines, and checklists for implementing a full, secure OAuth 2.0 and user authentication system in the Pure platform, specifically tailored for MCP and general web app security. Use this skill when auditing, designing, or implementing authentication features.
---

# Full Authentication & Security Specialist Skill

This skill contains the canonical knowledge and best practices for building a production-grade authentication system for the Pure platform, replacing the mock OAuth flows with a real, robust architecture.

## 1. Architectural Goals (Auth Completo)
- **User Identity Management**: Migrate from "no users" to a robust User Identity model (e.g., PostgreSQL users table or integrating Supabase/Auth0/NextAuth).
- **OAuth 2.0 Provider**: The platform must act as a true OAuth 2.0 Authorization Server to support Claude Web and other 3rd party clients securely.
- **Stateless/Stateful Tokens**: Use cryptographically secure JWTs (JSON Web Tokens) or opaque tokens backed by a fast cache (e.g., Redis) or DB.

## 2. OAuth 2.0 Best Practices & Flow
The implementation must adhere strictly to RFC 6749.

### A. Authorization Endpoint (`GET /oauth/authorize`)
1. **User Authentication**: The user must be redirected to a login page if not already authenticated.
2. **Consent Screen**: Clearly present what permissions (scopes) the 3rd party application (e.g., Claude Web) is requesting.
3. **Security**: Validate `redirect_uri` against a strict whitelist. Use `state` to prevent CSRF. Support PKCE (`code_challenge`) for public clients.

### B. Token Endpoint (`POST /oauth/token`)
1. **Code Validation**: Authorization codes must be single-use and expire quickly (e.g., 5 minutes).
2. **Client Authentication**: Validate `client_secret` securely (store hashes, not plain text, if managing dynamically).
3. **Token Issuance**: Return an `access_token` and optionally a `refresh_token`. Ensure responses include `Cache-Control: no-store`.

## 3. Database Schema Requirements
A full auth system requires at least the following relational entities:
- `users`: id, email, password_hash, created_at
- `oauth_clients`: client_id, client_secret_hash, redirect_uris, name
- `oauth_auth_codes`: code, client_id, user_id, expires_at, used
- `oauth_access_tokens`: token, client_id, user_id, expires_at

## 4. Implementation Steps & Audit Checklist
When requested to implement or audit auth, follow this checklist strictly:
- [ ] **Data Flow Trace**: Verify how user data moves from DB to Token to MCP Server. (Remember the Diagnostic Protocol Rule 1).
- [ ] **CORS**: Ensure strict CORS policies on the token endpoint, but allow Claude's origins or `*` appropriately for Bearer tokens.
- [ ] **Secret Storage**: Ensure no secrets are hardcoded in the codebase. Use `.env` and environment variables.
- [ ] **Error Handling**: Follow standard OAuth 2.0 error responses (e.g., `invalid_grant`, `invalid_client`).

## 5. Security Audit Mandates
Whenever modifying auth code:
- Ensure top-level `try/catch` around all HTTP routes handling authentication.
- Defend against Timing Attacks on password/secret validation by using crypto constant-time comparisons (`crypto.timingSafeEqual`).
- Defend against Replay Attacks on authorization codes by enforcing atomic `UPDATE ... SET used = true WHERE code = ? AND used = false`.
