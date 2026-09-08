# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and semantic versioning.

## [0.1.5] - 2026-09-08

### Fixed

- Write and report each ignore file only once when `--targets` contains duplicates.

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
