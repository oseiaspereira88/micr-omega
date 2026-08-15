---
title: "Leaked Engine Internal Modules in Default module-metadata.json and validation-matrix.json"
kind: bug
engine_version: 1.2.2-dev
reported_at: 2026-08-15T05:54:24-03:00
---

# POSE Engine Report: Leaked Engine Internal Modules in Default module-metadata.json and validation-matrix.json

## Description
### Context
When running 'pose init' or 'pose install' on any consumer repository, initial index files are generated in '.pose/indexes/'.

### Problems Identified
1. **Leaked Module Definitions**: '.pose/indexes/module-metadata.json' contains hardcoded entries for 'pose-mcp' (with entrypoint 'pose-mcp/cmd/pose/main.go'), 'mcp-enforce', and owner '@pose-maintainers'.
2. **Leaked Validation Overrides**: '.pose/indexes/validation-matrix.json' contains 'moduleOverrides' for 'pose-mcp' (calling Go tests against './internal/pose', './internal/cli', etc.) and 'docs-site' (Python stack).
3. **Template Contamination**: These internal modules from the POSE development repository were bundled into the distributed binary templates.

### Impact
Target consumer projects inherit non-existent module definitions and foreign check overrides that confuse AI agents, pollute repository indexes, and cause validation mismatches.

### Proposed Fix
Sanitize embedded templates in the POSE Go binary so that 'module-metadata.json' and 'validation-matrix.json' are initialized with clean, empty module objects or dynamically discovered modules from the target repository.

---
### System Context (Auto-generated)
- **POSE Engine Version:** 1.2.2-dev
- **OS/Arch:** linux/amd64
- **Go Version:** go1.26.5-X:nodwarf5
- **Reported At:** 2026-08-15T05:54:24-03:00
- **Kind:** bug

