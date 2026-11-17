CREATE TABLE raid_rooms (
 code TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id), class_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'waiting', created_at INTEGER NOT NULL,
 request_id TEXT NOT NULL, body_hash TEXT NOT NULL, UNIQUE(host_id,request_id)
);
CREATE INDEX raid_host_created ON raid_rooms(host_id,created_at);
CREATE UNIQUE INDEX raid_one_live_host ON raid_rooms(host_id) WHERE status IN ('waiting','active','paused');
CREATE TABLE raid_members (
 user_id TEXT PRIMARY KEY REFERENCES users(id), room_code TEXT NOT NULL REFERENCES raid_rooms(code)
);
