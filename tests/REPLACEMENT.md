# Exercise replacement protection

Replacement checks current UI state, persisted workout.inputs, and entry.sets.
Explicit numbers (including zero), partial rows, and modified notes/targets count
as entered data. Hints and untouched template notes/targets do not. Opening an
empty per-set editor alone does not require confirmation.

Cancel closes the picker and preserves the entire workout. Confirm clears only
the old/new exercise input slots and old result entries, retains the existing
replacement convention of carrying targets and notes, and leaves unrelated data
unchanged. Custom replacements do not write to the exercise dictionary.

The replacement is built on a copy and persisted with ONE setItem, using either
the legacy active-workout key or the Phase 3 state snapshot. Only after success
is memory updated. Failures leave all memory/storage data untouched and allow a
new attempt. A pending flag prevents duplicate confirmation operations.

Tests use isolated synthetic data, Chrome, 375/390px. Screenshots are stored in
`%TEMP%\gym-ux15-evidence`.