-- Migration 001: SMWE RAG chunk store
-- Azure SQL native VECTOR(1024) type (GA June 2025)
-- Run: node scripts/migrate.js 001

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_chunks')
BEGIN
  CREATE TABLE smwe_chunks (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    chunk_id        NVARCHAR(64)  NOT NULL UNIQUE,         -- deterministic hash of source+offset
    source_file     NVARCHAR(200) NOT NULL,                -- e.g. 'SMWE-KB-01-Immigration.md'
    module_code     NVARCHAR(20)  NOT NULL,                -- e.g. 'KB-01', 'RS-1', 'RS-3'
    domain          NVARCHAR(20)  NOT NULL,                -- 'immigration','global_mobility','cross_border','social_security','dta','workforce'
    chunk_kind      NVARCHAR(20)  NOT NULL DEFAULT 'text', -- 'text','table','rule','definition'
    heading         NVARCHAR(400) NULL,                    -- nearest heading above chunk
    citation        NVARCHAR(400) NULL,                    -- statutory reference extracted
    chunk_text      NVARCHAR(MAX) NOT NULL,
    embedding       VECTOR(1024)  NULL,                    -- bge-m3 multilingual embedding
    char_count      INT           NOT NULL DEFAULT 0,
    token_estimate  INT           NOT NULL DEFAULT 0,
    reviewed        BIT           NOT NULL DEFAULT 0,      -- 1 = expert sign-off complete
    ingest_run_id   INT           NULL,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX ix_smwe_chunks_domain       ON smwe_chunks (domain);
  CREATE INDEX ix_smwe_chunks_module_code  ON smwe_chunks (module_code);
  CREATE INDEX ix_smwe_chunks_source_file  ON smwe_chunks (source_file);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_ingest_runs')
BEGIN
  CREATE TABLE smwe_ingest_runs (
    id            INT        IDENTITY(1,1) PRIMARY KEY,
    run_ts        DATETIME2  NOT NULL DEFAULT SYSUTCDATETIME(),
    source_file   NVARCHAR(200) NOT NULL,
    chunks_added  INT        NOT NULL DEFAULT 0,
    chunks_updated INT       NOT NULL DEFAULT 0,
    status        NVARCHAR(20) NOT NULL DEFAULT 'running',  -- 'running','done','error'
    error_message NVARCHAR(MAX) NULL
  );
END;
