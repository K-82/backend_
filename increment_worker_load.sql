-- ============================================================
-- Atomic worker load increment/decrement
-- Run this in Supabase SQL Editor BEFORE deploying
-- ============================================================
-- Replaces the read-then-write pattern in content.js
-- with a single atomic UPDATE that prevents TOCTOU race conditions.
--
-- Usage from extension:
--   POST /rest/v1/rpc/increment_worker_load
--   Body: { "worker_tab_id": "project-uuid", "delta": 1 }
-- ============================================================

CREATE OR REPLACE FUNCTION increment_worker_load(worker_tab_id text, delta integer)
RETURNS void AS $$
  UPDATE public.workers 
  SET current_load = GREATEST(0, current_load + delta)
  WHERE tab_id = worker_tab_id;
$$ LANGUAGE sql;
