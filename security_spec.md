# Security Specification - Warehouse OS

## 1. Data Invariants
- Items must contain valid `code`, `desc`, and `uom`.
- Balances must have a positive or zero `qty`, valid `code`, and location `loc`.
- Transactions must have a valid `id`, `type`, `code`, and `qty`.
- User accounts must have an `id`, `username`, and `role`.

## 2. Access Model
- Multi-device real-time sync across handphones (mobile) and desktop workstations.
- Validates data fields and bounded lengths to avoid denial of wallet and malformed payloads.
