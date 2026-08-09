DROP POLICY "discount_tenant_isolation" ON "Discount";
CREATE POLICY "discount_tenant_isolation" ON "Discount"
    USING ("tenant_id" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

DROP POLICY "discount_audit_tenant_isolation" ON "DiscountAudit";
CREATE POLICY "discount_audit_tenant_isolation" ON "DiscountAudit"
    USING ("tenant_id" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
