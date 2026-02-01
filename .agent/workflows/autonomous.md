---
description: Autonomous coding workflow - auto-run all safe commands
---
// turbo-all

This workflow enables autonomous coding without user confirmation for safe operations.

## Guidelines
1. All `run_command` tool calls should set `SafeToAutoRun: true` for:
   - File reading operations
   - Build and test commands
   - Server startup commands
   - Linting and formatting

2. Code edits proceed automatically without confirmation.

3. Browser testing proceeds autonomously.
   - Browser subagent actions are considered safe.
   - Internal browser steps should set `SafeToAutoRun: true`.

