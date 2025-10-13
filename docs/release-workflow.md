# Release Workflow Plan

## Branching and Review Alignment
- Adopt thematic branches per feature (e.g., `feature/realtime-backend`, `feature/ranking-ui`).
- Developers create pull requests targeting `main` with linked thematic branch.
- Each PR includes:
  - Summary of changes and testing evidence.
  - QA sign-off checklist before merge.
- Review flow:
  1. Developer opens PR and assigns a peer developer reviewer.
  2. After code review approval, assign QA for validation on feature branch environment.
  3. QA logs results in PR comments; blockers require fixes before merge.
  4. Merge to `main` only after QA approval.

## MVP Deployment Schedule
- Deliver MVP to staging using manual deploy via Cloudflare Wrangler + Pages.
- Deployment cadence: twice weekly (e.g., Tuesday and Thursday) until CI/CD automation is ready.
- Responsibilities:
  - Dev owner triggers Wrangler publish and updates release notes.
  - QA verifies staging smoke tests post-deploy.
  - Product collects internal stakeholder feedback within 24 hours of each deploy.

## Release Checklist
1. **Staging Approval**
   - Latest commits merged to `main`.
   - QA regression suite passed on staging.
   - Product owner signs off.
2. **Monitoring Preparedness**
   - Observability dashboards configured (errors, latency, key user flows).
   - Alerts set for critical thresholds.
   - Logging retention verified.
3. **Communication Plan**
   - Release notes drafted and shared with support/success teams.
   - Internal announcement scheduled.
   - External communication (if any) prepared.

## Post-Go-Live Monitoring Plan
- Monitor metrics for first 48 hours:
  - Error rates, latency, and user engagement KPIs.
- Establish on-call rotation covering launch window.
- Daily standup review of metrics and support tickets.
- Immediate rollback criteria defined (e.g., error rate > 5%, latency > 2x baseline).
- Retrospective scheduled within one week to capture learnings.
