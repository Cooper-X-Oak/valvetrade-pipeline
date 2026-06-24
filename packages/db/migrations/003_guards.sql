-- The three buyer != seller / immutability guards enforced at the DB layer.
-- Each has a corresponding test in packages/pipeline/test.

-- Guard 1: a non-buyer-side company can never become a Lead.
CREATE FUNCTION trg_lead_buyer_guard() RETURNS trigger AS $$
DECLARE buyer boolean; etype entity_type;
BEGIN
  SELECT is_buyer_side, entity_type INTO buyer, etype
    FROM company WHERE company_id = NEW.company_id;
  IF buyer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'buyer_guard: company % (entity_type=%) is not buyer-side; cannot become a Lead',
      NEW.company_id, COALESCE(etype::text, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_buyer_guard
  BEFORE INSERT OR UPDATE ON lead
  FOR EACH ROW EXECUTE FUNCTION trg_lead_buyer_guard();

-- Guard 2: closes the reclassification hole — a company referenced by a Lead cannot be
-- flipped to 'manufacturer' (which would silently orphan a buyer-side Lead).
CREATE FUNCTION trg_company_supply_flip_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.entity_type = 'manufacturer'
     AND OLD.entity_type IS DISTINCT FROM 'manufacturer'
     AND EXISTS (SELECT 1 FROM lead WHERE company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'supply_flip_guard: cannot reclassify company % to manufacturer while a Lead references it',
      NEW.company_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_supply_flip_guard
  BEFORE UPDATE ON company
  FOR EACH ROW EXECUTE FUNCTION trg_company_supply_flip_guard();

-- Guard 3: once a report is frozen (snapshot set), the snapshot/cycle_id/hash/frozen_at are
-- write-once. Telemetry columns (view_count, conversion_status, ...) stay mutable.
CREATE FUNCTION trg_report_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.snapshot IS NOT NULL AND (
       NEW.snapshot      IS DISTINCT FROM OLD.snapshot      OR
       NEW.cycle_id      IS DISTINCT FROM OLD.cycle_id      OR
       NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash OR
       NEW.frozen_at     IS DISTINCT FROM OLD.frozen_at) THEN
    RAISE EXCEPTION 'report_immutable: frozen report % snapshot/cycle_id/hash/frozen_at are write-once',
      NEW.report_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_immutable
  BEFORE UPDATE ON report
  FOR EACH ROW EXECUTE FUNCTION trg_report_immutable();
