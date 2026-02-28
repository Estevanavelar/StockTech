# Fix: Authentication Redirect Loop

## Problem
After removing Manus authentication and keeping only AvAdmin, users were experiencing a redirect loop when trying to access StockTech.

### Root Causes
1. **Server-side Interception**: The server was intercepting URLs with `?token=...` and redirecting to the auth callback before the React frontend could save the token.
2. **HttpOnly Cookies**: The `avelar_token` cookie was set as `httpOnly`, preventing the frontend from reading it to include in the `Authorization` header.
3. **Strict Authorization Header**: The tRPC context only looked at the `Authorization` header, failing if it wasn't present (e.g., on first load before the header was attached).

## Solution
Implemented a multi-layered fix to ensure stable token synchronization and authentication:

### 1. Frontend Changes (`main.tsx`)
- Immediate storage of token in `localStorage` upon detection in URL.
- Improved synchronization logic with the backend.
- Token retrieval from either `cookie` or `localStorage` for the tRPC client.

### 2. Backend Changes (`oauth.ts`)
- Changed `avelar_token` cookie to `httpOnly: false`, allowing frontend access.
- Removed server-side redirect in `index.ts` to let React manage the auth flow.

### 3. Context Changes (`context.ts`)
- Added cookie fallback for authentication. If the `Authorization` header is missing, the server now attempts to authenticate using the `avelar_token` or `app_session_id` cookies.

## Prevention
Always ensure that when migrating authentication providers:
- The frontend has enough time to capture URL parameters before any server-side redirects.
- Cookies intended for client-side header inclusion are NOT `httpOnly`.
- The server context supports multiple authentication vectors (headers + cookies) during the transition or for initial page loads.
