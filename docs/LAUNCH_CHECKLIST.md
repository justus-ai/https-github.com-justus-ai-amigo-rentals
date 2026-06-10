# Go-Live Checklist (Fast and Safe)

## Before Launch (Required)

- [ ] Set production environment variables from `.env.example`.
- [ ] Verify Stripe webhook events are received in production.
- [ ] Verify M-Pesa callback reaches `/api/payments/mpesa/callback` over HTTPS.
- [ ] Run one real card payment success and cancel flow.
- [ ] Run one real M-Pesa success and failure flow.
- [ ] Confirm booking overlap protection blocks conflicting dates.
- [ ] Replace all placeholder legal/business details.
- [ ] Create and test database backup and restore.
- [ ] Configure uptime checks for `/health` and `/ready`.
- [ ] Configure alert routing to support/ops email.

## Right After Launch

- [ ] Review daily reconciliation report.
- [ ] Review failed payment and refund queue.
- [ ] Track support response time and unresolved tickets.
- [ ] Enable strict preflight checks in production startup.
