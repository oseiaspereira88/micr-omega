---
title: "Leaked Engine References in Scaffolded Templates and Indexes"
kind: bug
engine_version: 1.2.2-dev
reported_at: 2026-08-15T05:40:21-03:00
---

# POSE Engine Report: Leaked Engine References in Scaffolded Templates and Indexes

## Description
Template files shipped with POSE (specifically .pose/indexes/module-metadata.json and validation-matrix.json) contain hardcoded references to POSE internal engine modules (pose-mcp with entrypoint pose-mcp/cmd/pose/main.go, mcp-enforce, docs-site, and @pose-maintainers). When installed on target repositories, these entries leak into the consumer repository indexes.

---
### System Context (Auto-generated)
- **POSE Engine Version:** 1.2.2-dev
- **OS/Arch:** linux/amd64
- **Go Version:** go1.26.5-X:nodwarf5
- **Reported At:** 2026-08-15T05:40:21-03:00
- **Kind:** bug

