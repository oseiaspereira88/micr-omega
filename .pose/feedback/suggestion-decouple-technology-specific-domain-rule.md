---
title: "Decouple Technology-Specific Domain Rules into First-Class Extensions with Stack-Driven Auto-Resolution"
kind: suggestion
engine_version: 1.2.2-dev
reported_at: 2026-08-15T06:00:55-03:00
---

# POSE Engine Report: Decouple Technology-Specific Domain Rules into First-Class Extensions with Stack-Driven Auto-Resolution

## Description
### Context & Current Limitations
Currently, POSE embeds a hardcoded, arbitrary subset of technology-specific domain rules in '.pose/rules/' (specifically 'backend-go.md' and 'frontend-react.md') and references them directly in the root 'AGENTS.md'. 

When onboarding repositories outside of Go/React (e.g., Cloudflare Workers, Node.js, Rust, Python/FastAPI, Android/Kotlin, iOS/Swift, Vue, Svelte, Elixir):
1. Projects receive irrelevant default rules (e.g. 'backend-go.md' in a pure TypeScript repository).
2. Projects lack domain-specific rules tailored to their actual architecture (e.g., Workers/Durable Objects, actors, memory management, mobile lifecycles).
3. The set of available rules is rigid and not customizable during initialization.

### Leveraging the Existing Extension Architecture
POSE already implements a signed, transactional, data-only extension lifecycle ('pose extension install|list|remove|verify') with support for 'kind: "rule"' (demonstrated by 'pose-rule-kubernetes').

This pattern should be generalized for all technology-specific domain rules:
- **Universal Base Rules in Core**: Core POSE should only embed universal governance rules ('security.md', 'documentation-style.md', 'delivery-evidence.md', 'knowledge-governance.md', '_base-recurrence.md', 'release-integrity.md').
- **Technology Rules as Extensions**: All stack-specific rules ('pose-rule-backend-go', 'pose-rule-frontend-react', 'pose-rule-backend-cloudflare-workers', 'pose-rule-backend-node', 'pose-rule-backend-rust', 'pose-rule-backend-python', 'pose-rule-mobile-android', etc.) should live as modular rule extensions in an official catalog.

### Proposed Stack-Driven Auto-Resolution Flow
1. **Manifest Inspection**: During 'pose init' (or 'pose init --discover'), POSE runs stack detection (enhancing 'pose stacks') by inspecting manifests ('package.json', 'wrangler.toml', 'Cargo.toml', 'go.mod', 'build.gradle.kts', etc.).
2. **Auto-Resolution & Interactive Selection**: POSE matches detected technologies against the rule extension catalog, offering an automatic recommended baseline or interactive prompt for user confirmation.
3. **Dynamic 'AGENTS.md' Generation**: 'AGENTS.md' is scaffolded dynamically to list and link only the actively installed/resolved domain rules.
4. **On-Demand Management**: Users can discover and install additional domain rules at any time using 'pose extension install <package>' or a dedicated alias like 'pose rule add <name>'.

---
### System Context (Auto-generated)
- **POSE Engine Version:** 1.2.2-dev
- **OS/Arch:** linux/amd64
- **Go Version:** go1.26.5-X:nodwarf5
- **Reported At:** 2026-08-15T06:00:55-03:00
- **Kind:** suggestion

