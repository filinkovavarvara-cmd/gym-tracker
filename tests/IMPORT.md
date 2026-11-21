# Import validation and transaction contract

Backup: existing `1.0` schema; versionless legacy backups are accepted. `programs`
and `workoutLogs` are required arrays (explicit empty arrays are permitted).
Programs require id/name/days; days require id/name/exercises. Exercises require
id/name; optional targets, notes and historical snapshots are type checked.
Missing legacy name/hidden dictionaries default only after references resolve.
Current program must resolve. Historical day/program IDs may refer to deleted
templates; exercise IDs must resolve through dictionaries, templates or snapshots.
IDs are unique per relevant collection. Dates must be real ISO calendar dates;
diaries use YYYY-MM-DD. Sets require finite nonnegative numeric weight, positive
integer reps, and optional valid numeric millisecond timestamp. Unknown fields
inside accepted records are preserved; unsupported versions are rejected.

Diary: existing `workoutLogs[].entries[].exercise` names, stable `seed-<id>` log
IDs, optional templates and merged_names. Repeated imports merge by log ID and
do NOT infer deletion from absence. Existing templates are preserved. New first
imports can add the same seed program structure as the previous importer.

Every import is prepared without writes, validated, then previewed. Backup is
explicit replacement, including active-workout reset. Diary preserves the active
workout. The preview compares exact proposed records by stable key ordering.
No separate destructive diary replacement mode is provided.

Persistence uses ONE atomic localStorage setItem at `gym_state_v1`, then publishes
the prepared state in memory. On quota/security exceptions neither memory nor any
storage key is changed. Legacy keys remain untouched and are used only until the
first successful atomic import, editor save, or workout completion. Thereafter
normal saves update the authoritative snapshot.
Exports remain version 1.0; no user-facing schema migration is required.
Memory/storage fingerprints reject stale previews, but this is not a multi-tab
locking protocol. localStorage durability is still subject to browser/site-data
deletion; filesystem/disk-loss guarantees are outside the Web Storage API.

Run `npm.cmd test` from the repository root. All tests use disposable
Chrome contexts and synthetic data, never the user's gym-backup.json. Failure tests
compare both memory and all storage keys, and reload to check persistent integrity.
Preview screenshots: `%TEMP%\gym-import-evidence`.