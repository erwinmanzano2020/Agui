# HR employee ↔ entity link

- Added nullable `employees.entity_id` with FK to `entities` plus lookup indexes for house-scoped queries.
- Introduced `findOrCreateEntityForEmployee` to resolve/create entities via email/phone identifiers using the authenticated client.
- HR “Add employee” now accepts optional email/phone, validates basic format, and links the created employee to the resolved entity.
- Updated contracts to reflect identity linkage expectations and recorded the change here.
