-- Migration 002: SMWE credit ledger (customers + credit events)
-- Mirrors SPE migrations/004_credits.sql pattern

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_customers')
BEGIN
  CREATE TABLE smwe_customers (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    entra_oid       NVARCHAR(64)  NOT NULL UNIQUE,   -- Entra External ID object ID
    email           NVARCHAR(254) NOT NULL,
    display_name    NVARCHAR(200) NULL,
    plan            NVARCHAR(20)  NOT NULL DEFAULT 'free',
    -- plans: free | individual | professional | team | business | enterprise
    daily_limit     INT           NOT NULL DEFAULT 5, -- C1+C2 queries per UTC day
    paddle_customer_id NVARCHAR(100) NULL,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'smwe_credit_events')
BEGIN
  -- Append-only ledger; balance = SUM(delta) per customer
  CREATE TABLE smwe_credit_events (
    id            INT           IDENTITY(1,1) PRIMARY KEY,
    customer_id   INT           NOT NULL REFERENCES smwe_customers(id),
    delta         INT           NOT NULL,   -- positive = credit added; negative = spent
    event_type    NVARCHAR(30)  NOT NULL,   -- 'daily_reset','pack_purchase','spend_c0','spend_c1','spend_c2','spend_c3','admin_adjust'
    query_class   NVARCHAR(5)   NULL,       -- 'C0','C1','C2','C3'
    reference_id  NVARCHAR(100) NULL,       -- Paddle transaction ID or query log ID
    created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX ix_smwe_credit_events_customer ON smwe_credit_events (customer_id, created_at DESC);
END;
