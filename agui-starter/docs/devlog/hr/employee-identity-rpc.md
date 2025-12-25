# HR employee identity RPC

- Added `hr_find_or_create_entity_for_employee` security-definer RPC that enforces HR/house access, normalizes email/phone (E.164 + legacy 09…) and creates or reuses entities/identifiers.
- HR create flow now calls the RPC via the authenticated client; we keep identity tables locked down while enabling Preview identity linking.
- Legacy phone identifiers (digits-only local) are matched alongside canonical `+63` to prevent duplicate entities.
