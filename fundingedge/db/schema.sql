-- FundingEdge optional persistence. Applied automatically on first use (idempotent).
CREATE TABLE IF NOT EXISTS funding_observations (
  exchange      TEXT             NOT NULL,
  symbol        TEXT             NOT NULL,           -- exchange-native symbol
  funding_rate  DOUBLE PRECISION NOT NULL,           -- decimal per funding event
  event_ts      TIMESTAMPTZ      NOT NULL,           -- funding settlement time the rate applies to
  observed_at   TIMESTAMPTZ      NOT NULL,           -- when we last observed this rate
  PRIMARY KEY (exchange, symbol, event_ts)           -- de-duplicates; later observation overwrites
);
CREATE INDEX IF NOT EXISTS funding_obs_lookup ON funding_observations (exchange, symbol, event_ts DESC);
CREATE INDEX IF NOT EXISTS funding_obs_observed ON funding_observations (observed_at);

CREATE TABLE IF NOT EXISTS alert_log (
  dedupe_key TEXT PRIMARY KEY,
  sent_at    TIMESTAMPTZ NOT NULL
);
