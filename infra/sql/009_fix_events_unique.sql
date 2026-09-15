-- Add FK and unique constraints to hand_events
ALTER TABLE hand_events 
  ADD CONSTRAINT hand_events_hand_fk 
  FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE CASCADE;

ALTER TABLE hand_events 
  ADD CONSTRAINT hand_events_hand_seq_unique 
  UNIQUE (hand_id, sequence);

-- Add FK and unique constraints to hand_snapshots
ALTER TABLE hand_snapshots 
  ADD CONSTRAINT hand_snapshots_hand_fk 
  FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE CASCADE;

ALTER TABLE hand_snapshots 
  ADD CONSTRAINT hand_snapshots_hand_seq_unique 
  UNIQUE (hand_id, sequence);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hand_events_hand ON hand_events(hand_id, sequence);
CREATE INDEX IF NOT EXISTS idx_hand_snapshots_hand ON hand_snapshots(hand_id, sequence);