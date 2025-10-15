# Security Audit Summary

## Overview
This audit reviews the Supabase Edge Functions and media utilities in the repository to identify high-severity security weaknesses. The findings below highlight unauthenticated administrative endpoints and storage proxies that leak sensitive data or allow privilege escalation.

## Critical Findings

### 1. Unauthenticated storage proxy exposes all buckets
* **File:** `supabase/functions/media-proxy/index.ts`
* **Issue:** The function boots a Supabase client with the Service Role key and serves files from any requested storage bucket without validating the caller. Any unauthenticated request with a `path` parameter can download internal documents, bypassing Supabase storage security and Row Level Security.
* **Impact:** Complete exfiltration of all stored files (documents, media, backups) and circumvention of access controls.
* **Recommendation:** Require authenticated callers, use the anon key instead of the service role key, and enforce per-user authorization before streaming a file.

### 2. Anyone can trigger document emails and mint signed URLs
* **File:** `supabase/functions/send-document-email/index.ts`
* **Issue:** The handler accepts arbitrary POST bodies, instantiates a Service Role client, and queries the `documents` table and storage to mint signed download URLs. There is no authentication or authorization check before the email is sent.
* **Impact:** An attacker can enumerate document IDs, mint signed URLs for confidential files, and spam arbitrary recipients with organization-branded email.
* **Recommendation:** Enforce authentication, verify the caller’s access to the target document via RLS-aware queries, and avoid exposing signed URLs to unauthorized users.

### 3. User creation endpoint lacks authentication and role restrictions
* **File:** `supabase/functions/create-user-admin/index.ts`
* **Issue:** The function is publicly callable, uses the Service Role key, and trusts the `role` field supplied in the request body when inserting/updating the `profiles` table. An attacker can create new accounts and assign elevated roles such as `admin`.
* **Impact:** Remote privilege escalation to administrative accounts without prior access, leading to full compromise of the platform.
* **Recommendation:** Require strong authentication (e.g., master admin token) before invoking the endpoint and hard-code permissible roles server-side.

### 4. Share link endpoints bypass Row Level Security
* **Files:**
  * `supabase/functions/generate-share-link/index.ts`
  * `supabase/functions/revoke-share-link/index.ts`
* **Issue:** Both functions instantiate Supabase clients with the Service Role key. Although they read the caller’s JWT to obtain a user ID, subsequent queries run with service-role privileges, bypassing RLS policies. Any authenticated user can therefore generate or revoke tokens for documents they do not own if they know the UUID.
* **Impact:** Unauthorized document sharing and denial of access controls, potentially leaking confidential files to external recipients.
* **Recommendation:** Use the anon key with the caller’s Authorization header, or manually enforce ownership checks before mutating records.

## Next Steps
1. Replace Service Role usage in user-facing endpoints with anon clients that honor RLS, supplemented with explicit permission checks.
2. Require authentication and sector/role authorization for every state-changing handler.
3. Conduct a comprehensive review of all remaining Edge Functions to ensure Service Role keys are only used in tightly controlled, internal workflows.
