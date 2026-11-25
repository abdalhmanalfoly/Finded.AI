-- FindIt AI - 005: require audited RPC for account suspension changes.
-- Safe to apply after 002_security.sql and 003_functions.sql.
revoke update (is_suspended) on public.profiles from authenticated;
