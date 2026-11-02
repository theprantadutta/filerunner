-- Chunked uploads: a file sent as many small requests, then assembled. Lets large files
-- through proxies that cap request bodies (Cloudflare: 100 MB) and lets a dropped
-- connection cost one chunk instead of the whole file.
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    folder_path TEXT,
    total_size BIGINT NOT NULL,
    chunk_size BIGINT NOT NULL,
    chunk_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Bumped by every chunk; sessions idle for a day are abandoned and pruned
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_sessions_updated_at ON upload_sessions(updated_at);

-- One row per chunk received. Its own table so parallel chunks never contend on one row.
CREATE TABLE upload_chunks (
    session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    PRIMARY KEY (session_id, chunk_index)
);
