# QA-01 atomic workout completion

Both completion entry points call commitFinishWorkout(). Preparation runs on a
detached state/input copy, preserving the live workout and draft on any error.
One setItem('gym_state_v1', ...) stores both History and activeWorkout:null.
Only then memory/UI are published. Failure displays a toast and supports retry.

Legacy completion migrates to the existing Phase 3 snapshot on first success;
legacy keys are untouched. Multi-key legacy rollback cannot guarantee atomicity.
loadData() already prioritizes the snapshot; subsequent saves use it. Backup
schema is unchanged. Extra space is needed while legacy keys remain present.

Workout ID is the idempotency key: an existing record is retained unchanged,
no new record is appended, and the active duplicate clears only after commit.
This does not retroactively deduplicate already-corrupted historical arrays or
provide multi-tab locking. localStorage atomicity is not a disk-durability promise.

Tests: npm.cmd test -- tests/completion.spec.js, Chrome at 375/390px; synthetic
data only. The tests assert the starting storage mode and inject quota/security
errors at the sole write, including legacy migration. A separate test records
write/removal attempts, requires exactly one snapshot write, and verifies that
legacy keys remain unchanged. Other cases cover retry with/without reload,
repeated calls, ID collisions, and switching workouts. Run npm.cmd test for
the complete regression suite.
