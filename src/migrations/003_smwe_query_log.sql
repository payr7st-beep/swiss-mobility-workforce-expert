-- Migration 003: SMWE query log + gap signals
-- Feeds gapDetector.js — mirrors SPE sip_query_log + sip_gap_signals pattern

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_query_log')
BEGIN
  CREATE TABLE smwe_query_log (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    agent_id        NVARCHAR(32)  NOT NULL DEFAULT 'SMWE',
    customer_id     INT           NULL REFERENCES smwe_customers(id),
    session_id      NVARCHAR(64)  NULL,
    query_text      NVARCHAR(2000) NOT NULL,
    query_class     NVARCHAR(5)   NOT NULL,   -- C0/C1/C2/C3
    intent_class    NVARCHAR(30)  NULL,        -- IMMIGRATION/GLOBAL_MOBILITY/CROSS_BORDER/SOCIAL_SECURITY/DTA/WORKFORCE/cross_domain
    domain          NVARCHAR(30)  NULL,
    chunks_returned INT           NOT NULL DEFAULT 0,
    top_score       FLOAT         NULL,        -- highest cosine similarity
    gap_flagged     BIT           NOT NULL DEFAULT 0,  -- 1 = retrieval quality below threshold
    credits_spent   INT           NOT NULL DEFAULT 0,
    response_ms     INT           NULL,
    queried_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX ix_smwe_query_log_gap       ON smwe_query_log (gap_flagged, queried_at DESC);
  CREATE INDEX ix_smwe_query_log_customer  ON smwe_query_log (customer_id, queried_at DESC);
  CREATE INDEX ix_smwe_query_log_intent    ON smwe_query_log (intent_class, queried_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_gap_signals')
BEGIN
  CREATE TABLE smwe_gap_signals (
    id             INT           IDENTITY(1,1) PRIMARY KEY,
    agent_id       NVARCHAR(32)  NOT NULL DEFAULT 'SMWE',
    topic_cluster  NVARCHAR(200) NOT NULL,
    signal_count   INT           NOT NULL DEFAULT 1,
    status         NVARCHAR(20)  NOT NULL DEFAULT 'open',  -- open/authoring/resolved/dismissed
    first_seen     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    last_seen      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    resolved_at    DATETIME2     NULL,
    notes          NVARCHAR(MAX) NULL
  );

  CREATE UNIQUE INDEX ix_smwe_gap_signals_cluster
    ON smwe_gap_signals (agent_id, topic_cluster)
    WHERE status IN ('open','authoring');
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_agent_registry')
BEGIN
  -- Cross-agent registry — shared with SPE/SPC via Hermes orchestration
  CREATE TABLE smwe_agent_registry (
    id           INT           IDENTITY(1,1) PRIMARY KEY,
    agent_id     NVARCHAR(32)  NOT NULL UNIQUE,  -- e.g. 'SMWE','SPE','SPC'
    agent_name   NVARCHAR(100) NOT NULL,
    mcp_endpoint NVARCHAR(500) NULL,
    domains      NVARCHAR(MAX) NOT NULL DEFAULT '[]',  -- JSON array
    capabilities NVARCHAR(MAX) NOT NULL DEFAULT '[]',  -- JSON array
    status       NVARCHAR(20)  NOT NULL DEFAULT 'active',
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  -- Seed SMWE entry
  INSERT INTO smwe_agent_registry (agent_id, agent_name, domains, capabilities)
  VALUES (
    'SMWE',
    'Swiss Mobility & Workforce Expert',
    '["immigration","global_mobility","cross_border","social_security","dta","workforce_compliance"]',
    '["permit_classification","a1_assessment","dta_lookup","pe_risk","cla_lookup","equity_allocation"]'
  );
END;
