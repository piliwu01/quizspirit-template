CREATE TABLE pvp_rooms (
 code TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id), class_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'waiting', created_at INTEGER NOT NULL, config TEXT NOT NULL,
 request_id TEXT NOT NULL, body_hash TEXT NOT NULL, UNIQUE(host_id,request_id)
);
CREATE INDEX pvp_host_created ON pvp_rooms(host_id,created_at);
CREATE UNIQUE INDEX pvp_one_live_host ON pvp_rooms(host_id) WHERE status IN ('waiting','active');
CREATE TABLE pvp_members (user_id TEXT PRIMARY KEY REFERENCES users(id),room_code TEXT NOT NULL REFERENCES pvp_rooms(code));
CREATE TABLE activity_locks (user_id TEXT PRIMARY KEY REFERENCES users(id),mode TEXT NOT NULL CHECK(mode IN ('raid','pvp')),room_code TEXT NOT NULL);
INSERT OR IGNORE INTO activity_locks(user_id,mode,room_code)
 SELECT m.user_id,'raid',m.room_code FROM raid_members m JOIN raid_rooms r ON m.room_code=r.code WHERE r.status IN ('waiting','active','paused');
