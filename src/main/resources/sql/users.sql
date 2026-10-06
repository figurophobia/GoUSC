-- Semilla idempotente: se repite en cada arranque, así que no duplica usuarios.
INSERT INTO users (username, password, email, elo, wins, losses, created_at) VALUES
    ('deivi', 'deivi123', 'deivi@usc.gal', 1500, 0, 0, NOW()),
    ('ana', 'ana123', 'ana@usc.gal', 1500, 0, 0, NOW()),
    ('joel', 'joel123', 'joel@usc.gal', 1500, 0, 0, NOW()),
    ('pepe', 'pepe123', NULL, 1500, 0, 0, NOW())
ON CONFLICT (username) DO NOTHING;
