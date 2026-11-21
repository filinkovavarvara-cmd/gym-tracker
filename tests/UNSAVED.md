# Editor navigation protection

Both editors capture an initial normalized data snapshot when opened. Dirty
comparison includes names, values, composition/order and individual sets, but
not focus/reorder mode/visual expansion. Equivalent numeric strings normalize
to numbers; restoring the original data clears dirty state.

All navigate() exits and opening another editor use the same pending-navigation
guard. The first requested destination wins while the dialog is open. Continue
keeps the draft, Discard drops only the draft, Save writes a detached prepared
state to the existing atomic snapshot before publishing and navigating.
Invalid drafts do not offer Save. Write exceptions preserve draft, memory and
storage; retry is supported. Normal Save uses the same transaction.

Browser Back on an open editor is intercepted using an editor history marker.
It returns to the editor's parent after the same decision. This is not a general
SPA router or arbitrary multi-page browser-history reconstruction. Escape does
not close the editor (unchanged). Reload/closing the tab is not guarded and no
new draft persistence was introduced. Active workout navigation is unchanged.

Run npm.cmd test from the repository root. Tests use disposable Chrome
contexts with synthetic localStorage. Screenshots: %TEMP%\gym-ux09-evidence.