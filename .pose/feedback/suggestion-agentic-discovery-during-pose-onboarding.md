---
title: "Agentic Discovery during POSE Onboarding for Existing Repositories"
kind: suggestion
engine_version: 1.2.2-dev
reported_at: 2026-08-15T05:40:16-03:00
---

# POSE Engine Report: Agentic Discovery during POSE Onboarding for Existing Repositories

## Description
When initializing POSE in pre-existing projects (via pose init or pose install), the tool should offer an agentic/automated discovery phase (e.g. pose init --discover or pose assess onboard). It should inspect existing manifests (package.json, wrangler.toml, Cargo.toml, go.mod, etc.), project docs (README.md, CLAUDE.md), and detect workspaces/modules to automatically generate AGENTS.md project context, module-metadata.json, and install relevant domain rules instead of leaving unfilled placeholders or installing irrelevant rules like backend-go.

---
### System Context (Auto-generated)
- **POSE Engine Version:** 1.2.2-dev
- **OS/Arch:** linux/amd64
- **Go Version:** go1.26.5-X:nodwarf5
- **Reported At:** 2026-08-15T05:40:16-03:00
- **Kind:** suggestion

