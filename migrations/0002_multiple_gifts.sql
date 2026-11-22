CREATE TABLE reservations_multiple(family_id TEXT NOT NULL REFERENCES families(id),gift_id TEXT NOT NULL REFERENCES gifts(id),PRIMARY KEY(family_id,gift_id));
INSERT INTO reservations_multiple SELECT family_id,gift_id FROM reservations;
DROP TABLE reservations;
ALTER TABLE reservations_multiple RENAME TO reservations;
CREATE INDEX reservations_gift ON reservations(gift_id);
