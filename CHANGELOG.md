# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-02-28

### Added

- Initial public release of `@darksol/portguard`
- Cross-platform scanner for active localhost listeners
- CLI commands: `scan`, `free`, `kill`, `watch`, `find`, `range`
- Programmatic API exports: `scan`, `isPortFree`, `killPort`, `findByName`
- JSON output mode for scripting (`--json`)

### Changed

- README upgraded to SHIP_STANDARD production layout
- Added DARKSOL canonical logo asset (`assets/darksol-logo.png`)
- Normalized command and package naming to `Portguard` / `@darksol/portguard`
- Added repository metadata fields in `package.json`
