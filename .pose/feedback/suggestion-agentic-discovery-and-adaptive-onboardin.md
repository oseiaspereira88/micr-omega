---
title: "Agentic Discovery and Adaptive Onboarding in pose init for Existing Projects"
kind: suggestion
engine_version: 1.2.2-dev
reported_at: 2026-08-15T05:54:19-03:00
---

# POSE Engine Report: Agentic Discovery and Adaptive Onboarding in pose init for Existing Projects

## Description
### Context
When installing or initializing POSE in pre-existing repositories (brownfield projects), 'pose init' currently scaffolds static generic templates and static rules (such as 'backend-go.md' and placeholder text in 'AGENTS.md').

### Problems Identified
1. **Unfilled Placeholders**: 'AGENTS.md' is created with comments like '<!-- Describe here... -->' and raw placeholders like '<repo>: describe the repository\'s purpose...'.
2. **Hardcoded Domain Rules**: Default rules assume Go backend ('backend-go.md') regardless of whether the target project uses TypeScript, Cloudflare Workers, Python, Rust, etc.
3. **Empty / Defaulted Module Metadata**: '.pose/indexes/module-metadata.json' does not automatically discover existing sub-packages or entrypoints.
4. **Ignored Pre-existing Documentation**: Existing project documentation ('CLAUDE.md', 'README.md', 'docs/*', architecture roadmaps) is not parsed or indexed into '.pose/knowledge/' or 'AGENTS.md'.

### Proposed Improvements
- Add an automated/agentic onboarding flag: 'pose init --discover' or 'pose assess onboard'.
- Inspect project manifests ('package.json', 'pnpm-workspace.yaml', 'wrangler.toml', 'Cargo.toml', 'go.mod', 'pyproject.toml') to identify modules and entrypoints.
- Parse 'README.md' / 'CLAUDE.md' to automatically populate the '## Project context' section in 'AGENTS.md'.
- Adaptively install relevant domain rules matching the detected stack (e.g., React, Cloudflare Workers, Node, Rust) and prune non-applicable rules.

---
### System Context (Auto-generated)
- **POSE Engine Version:** 1.2.2-dev
- **OS/Arch:** linux/amd64
- **Go Version:** go1.26.5-X:nodwarf5
- **Reported At:** 2026-08-15T05:54:19-03:00
- **Kind:** suggestion

