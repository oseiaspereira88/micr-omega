---
title: "Monorepo Workspace Deduplication in Pose Validate"
kind: suggestion
engine_version: 1.2.2-dev
reported_at: 2026-08-15T05:40:24-03:00
---

# POSE Engine Report: Monorepo Workspace Deduplication in Pose Validate

## Description
In monorepo setups with npm/yarn/pnpm/cargo workspaces where the root manifest delegates tasks to workspaces (e.g. npm test --workspaces), pose validate executes both the root directory and every child workspace individually, running full test suites and builds redundantly. pose validate should detect workspace topologies or support a configuration flag to run only workspace targets or only root orchestration.

---
### System Context (Auto-generated)
- **POSE Engine Version:** 1.2.2-dev
- **OS/Arch:** linux/amd64
- **Go Version:** go1.26.5-X:nodwarf5
- **Reported At:** 2026-08-15T05:40:24-03:00
- **Kind:** suggestion

