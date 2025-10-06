# Extension `pg_net` in `public` Schema

## Issue Summary
- **Problem:** The `pg_net` extension is installed in the default `public` schema (`public.pg_net`). Keeping extensions in `public` increases the risk of namespace collisions and makes it easier for other roles to call extension-provided functions unintentionally.
- **Impact:** The `public` schema is typically writable or accessible to many roles. Leaving powerful extensions there enlarges the attack surface and can expose privileged capabilities (e.g., network access) to roles that should not have them.

## Suggested Fixes
1. **Install the extension into a dedicated schema** (for example `extensions` or `tools`) to keep the default `public` schema clean:
   ```sql
   -- One-time setup
   CREATE SCHEMA IF NOT EXISTS extensions;
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;

   -- Move the extension
   DROP EXTENSION IF EXISTS pg_net;
   CREATE EXTENSION pg_net WITH SCHEMA extensions;
   ```
   Adjust the schema name to match your project's conventions.
2. **Schema-qualify references to the extension** (e.g., `extensions.http_get(...)`) in functions, policies, or other database code after relocation so dependencies remain valid.
3. **Review privileges on the new schema** to ensure only trusted roles can execute the extension's functions or create objects there (e.g., grant usage/execute to application roles as needed).

Moving the extension out of `public` reduces namespace pollution and aligns with security best practices for managing PostgreSQL extensions.
