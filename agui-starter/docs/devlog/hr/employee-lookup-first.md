# HR employee lookup-first identity flow

- Add lookup-only RPC for HR to find identities by email/phone (normalized, masked) before enrolling employees.
- New UI: identity lookup card surfaces none/single/multiple matches; encoder must explicitly pick a person before linking.
- Employee creation still blocks duplicate active identities per house (409) and shows the existing employee code/name; inactive rows can be rehired.
- Employee list/detail now surface linked identity display name and identifiers for HR visibility.
