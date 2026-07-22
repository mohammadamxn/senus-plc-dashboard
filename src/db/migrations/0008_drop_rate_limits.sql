-- Drop invite rate-limit table. Counters now live in-process
-- (src/modules/auth/rate-limit.ts) so we no longer persist them in Postgres.
DROP TABLE IF EXISTS "rate_limits";
