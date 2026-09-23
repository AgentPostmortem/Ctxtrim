# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and semantic versioning.

## [0.1.17] - 2026-09-23

### Fixed

- Classify `.ipynb` notebooks as data trim candidates, including notebooks below the large-data threshold.
- Repair unresolved merge markers in the package lockfile while updating release metadata.

## [0.1.16] - 2026-09-17

### Fixed

- Treat vendored (`node_modules`, `vendor`, ...) and build output (`dist`, `build`, ...) directories as single trim candidates: record the directory once by name and never read or descend into it. Reported patterns and category totals are unchanged.

## [0.1.15] - 2026-09-17

### Fixed

- Surface unreadable files (e.g. EACCES / mode-000) as estimated tokens from their
  known size instead of reporting them as clean 0-token sources.

## [0.1.14] - 2026-09-16

### Fixed

- Include symlinked files that resolve to regular files in scan results instead of silently omitting them.

## [0.1.13] - 2026-09-16

### Fixed

- Repair orphan managed-block end markers instead of duplicating them.

## [0.1.12] - 2026-09-16

### Fixed

- Classify common Python, Bun, Deno, and Pixi lockfiles as trimmable lockfiles.

## [0.1.11] - 2026-09-16

### Fixed

- Classify `.log` files as trimmable data instead of source.

## [0.1.10] - 2026-09-15

### Fixed

- Match generated-file markers case-insensitively.
## [0.1.9] - 2026-09-12

### Fixed

- Reject unknown CLI flags (for example `--wriet`) with exit code 2 instead of
  silently ignoring them and running report-only.

## [0.1.8] - 2026-09-12

### Added

- Test coverage for scanning an empty directory (zero files, 0% waste).

### Fixed

- Reject file and missing scan targets instead of silently scanning the current directory.
  The CLI exits with code 2 before reporting or writing ignore files for an invalid target.

## [0.1.7] - 2026-09-11

### Fixed

- Reject multiple positional paths with exit code 2 before scanning or writing ignore files.

## [0.1.6] - 2026-09-08

### Fixed

- Write and report each ignore file only once when `--targets` contains duplicates.

## [0.1.5] - 2026-09-07

### Fixed

- `--fail-on-waste 0` no longer fails every build: a 0% waste (clean) repo now
  passes, while any actual waste still trips the threshold.

## [0.1.4] - 2026-09-07

### Fixed

- Repair an unclosed managed ignore block in place instead of appending a
  duplicate block on every run.

## [0.1.3] - 2026-09-06

### Fixed

- Reject non-finite and negative numeric CLI options instead of scanning with
  invalid thresholds or silently ignoring invalid waste gates.
- Reject unknown `--targets` values with a clear error instead of silently
  skipping all ignore-file writes.

## [0.1.2] - 2026-08-09

### Fixed

- Skip reading binary file contents during repository scans while preserving
  their existing classification and zero-token accounting.

## [0.1.1] - 2026-08-06

### Changed

- Repository moved to the `AgentPostmortem` GitHub organization; package metadata
  (`repository`, `bugs`, `homepage`) now points at the new location. The package
  name and scope are unchanged.

## [0.1.0] - 2026-07-30

### Added
- Initial release.
