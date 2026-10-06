# issues

Work we're going to do on proc, defined well enough to hand to an agent. Not a
backlog of wishes and not a record of work done: git is the record, and the code
and its doc comments are the documentation. A ticket says what was intended on
its date; don't read it as a description of the code. If something is being done
in one sitting, it doesn't need a ticket.

A ticket is one file, `NNN.short-name.TYPE.md`, where TYPE is `bug`, `task` or
`feature`. Numbers run across all three folders; take the next one after the
highest. Its folder is its status: `open/`, `in-progress/`, `closed/`. Status
moves belong to whoever hands the work out, not to the agent doing it: `git mv`
and commit before handing it off, so the move never rides in on someone else's
commit. An agent reads its ticket and leaves it where it is.

Keep a ticket short: what's wrong or wanted, decisions already made (in the
owner's words, dated), where in the code (by symbol, since line numbers drift),
and what done looks like. Open questions come in two kinds:

- `Ask j50n:` is one only the owner can answer: what users see and do, scope,
  priorities, taste. `grep -r 'Ask j50n' issues/open` lists everything waiting
  on him.
- `To decide:` is a design question for whoever builds the ticket. They decide
  it, add a `Decided:` line saying what and why, and put the why in a doc
  comment where it explains the code.

Close a ticket only once its decisions live in the code; the ticket shouldn't be
the only place a why survives. Add two lines, then move it to `closed/`:

- `Closed by` the commit (or "won't do" and why).
- `Verified:` the evidence that it's done: the tests that cover it, by file and
  name, and whether they fail on the code before the fix; anything checked by
  hand, and how.

## Releases

`closed/` holds what has been done since the last release. At release time its
tickets are the draft of the release notes (what a user of the last release
would notice, checked against `git log`), and the release commit deletes them.
Git keeps them; the repo keeps only work still to do and the record of the code
itself.

## Order

The folders have no order, and numbers say only when a ticket was written. That
has been enough so far; if it stops being enough, a `Next:` line here, naming
tickets in order, is the first thing to try.

## GitHub issues

GitHub issues are for people outside the project: bug reports and requests from
users. When one needs work, it gets a ticket here that names it (`GitHub #33`),
and the work happens from the ticket. Anything posted to GitHub (a comment, a
close) is reviewed by j50n before it goes out.
