CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chats_distinct_members CHECK (member_a <> member_b),
  CONSTRAINT chats_canonical_members CHECK (member_a < member_b),
  CONSTRAINT chats_unique_pair UNIQUE (member_a, member_b)
);

CREATE INDEX IF NOT EXISTS chats_member_a_updated_idx ON chats(member_a, updated_at DESC);
CREATE INDEX IF NOT EXISTS chats_member_b_updated_idx ON chats(member_b, updated_at DESC);
