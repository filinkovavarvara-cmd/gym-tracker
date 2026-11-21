# Historical exercise identity

Completed workouts resolve names from their own `exercises` snapshots first.
Templates, dictionaries and other historical snapshots are fallbacks only for
legacy records missing their own name. Sets and exercise IDs are never remapped.

Before the UI edits/deletes a template, missing legacy snapshots are populated
with compact `{id, name}` objects while their source names are still available.
This is lazy, additive preservation, not a destructive startup migration.
Existing snapshots, set values, timestamps and custom properties remain intact.
If every name source was already lost, the original name cannot be recovered.

Analytics discovers performed IDs directly from completed entries. For an ID
with multiple historical names it labels the catalog with the most recent
performed record's resolved name; each workout still displays its own name.
Identical display names with distinct IDs remain separate series. Exercise
history also matches strictly by ID rather than implicitly merging names.

Exports enrich only the downloaded copy of legacy records. Diary imports create
compact snapshots immediately. Name-only diaries with an ambiguous mapping to
multiple existing IDs are rejected without mutation; backups with explicit IDs
retain both exercises. Export schema remains 1.0 and existing backups remain
supported under the Phase 3 validation rules.

Run `npm.cmd test` from the repository root.
Tests use synthetic data in disposable Chrome contexts at 375px and 390px.
Before/after History and Analytics screenshots are stored in
`%TEMP%\gym-ux03-evidence`.