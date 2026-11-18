CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(40) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(12) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  virtual_balance NUMERIC(12,2) NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  sport VARCHAR(40) NOT NULL,
  competition VARCHAR(100) NOT NULL,
  starts_at TIMESTAMPTZ,
  display_time VARCHAR(80) NOT NULL,
  home VARCHAR(100) NOT NULL,
  away VARCHAR(100) NOT NULL,
  odds_home NUMERIC(7,2) NOT NULL,
  odds_draw NUMERIC(7,2) NOT NULL DEFAULT 0,
  odds_away NUMERIC(7,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS demo_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  combined_odds NUMERIC(12,4) NOT NULL,
  virtual_potential NUMERIC(12,2) NOT NULL,
  picks JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'demo-pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS events_active_idx ON events(active, starts_at);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON demo_tickets(user_id, created_at DESC);

-- Optional starter events for the virtual demo. Re-running is safe because IDs are unique only per insert; remove these rows if you prefer a blank setup.
INSERT INTO events(sport,competition,display_time,home,away,odds_home,odds_draw,odds_away) VALUES
('Fútbol','Liga Demo','Demo · 20:00','Cóndores FC','Tigres del Sur',1.85,3.20,2.05),
('Fútbol','Liga Demo','Demo · 21:30','Atlético Central','Real Oriente',2.10,3.10,1.75),
('Básquet','Amistoso Demo','Demo · 19:00','Santa Cruz','La Paz',1.70,0,2.00),
('Tenis','Torneo Demo','Demo · 17:00','Jugador A','Jugador B',1.90,0,1.90);
