-- Preserve pre-attribution Orders while requiring every future Order write to
-- carry the server-validated cashier relation and immutable display snapshot.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_cashier_required_for_new_rows"
  CHECK ("cashier_user_id" IS NOT NULL AND "cashier_name" IS NOT NULL)
  NOT VALID;
