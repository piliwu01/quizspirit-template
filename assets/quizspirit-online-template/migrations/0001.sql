PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 class_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('teacher','student')),
 password TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE progress (
 user_id TEXT PRIMARY KEY REFERENCES users(id), version INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL
);
CREATE TABLE operations (
 user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL, route TEXT NOT NULL,
 result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,request_id)
);
CREATE TABLE state_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE banks (id TEXT PRIMARY KEY, title TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE login_limits (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
