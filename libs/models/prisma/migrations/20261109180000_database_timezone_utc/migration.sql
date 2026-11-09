-- Timestamps are `timestamp` without a time zone, written in UTC, and queries
-- compare them with NOW(). NOW() follows the session's TimeZone, so a
-- server outside UTC (e.g. Europe/Brussels) would count open sessions hours
-- too long. Pin the database to UTC; it applies to new connections.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
