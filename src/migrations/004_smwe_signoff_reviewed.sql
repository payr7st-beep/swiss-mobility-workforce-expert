-- Migration 004: Mark all SMWE chunks as reviewed = 1
-- Sign-off date: 2026-08-19
UPDATE smwe_chunks SET reviewed=1
WHERE source_file IN (
  'SMWE-RULESET-1-EU883.md','SMWE-RULESET-2-PERMIT.md','SMWE-RULESET-3-DTA.md',
  'SMWE-KB-01-Immigration.md','SMWE-KB-02-GlobalMobility.md','SMWE-KB-03-CrossBorder.md',
  'SMWE-KB-04-SocialSecurity.md','SMWE-KB-05-DTAs.md','SMWE-KB-06-WorkforceCompliance.md'
) AND embedding IS NOT NULL;
SELECT source_file,COUNT(*) AS total,SUM(reviewed) AS reviewed FROM smwe_chunks GROUP BY source_file ORDER BY source_file;
