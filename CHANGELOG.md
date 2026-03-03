# Changelog

All notable changes to Dev Checkpoint will be documented in this file.

## [0.1.0] - 2026-03-03

### Added
- Manual checkpoint capture via `Ctrl+Shift+M` / `Cmd+Shift+M`
- Auto-checkpoint on idle detection (configurable, default: 5 min)
- 5 heuristic signal collectors: Git state, editor context, TODO/FIXME scanner, recently modified files, terminal history
- Deterministic narrative generator — human-readable context summary with zero AI/cloud
- JSON storage in VSCode's globalStorageUri (local, offline, private)
- WebviewPanel with React — checkpoint history sidebar
- Real-time updates when checkpoints are created or deleted
- 62 unit tests
- Zero external runtime dependencies
- Zero network calls
- Works on Windows, macOS, Linux
