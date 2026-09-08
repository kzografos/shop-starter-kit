# Downstream manual reconciliation — PetShopCY

Changes made upstream in `shop-starter-kit` that **cannot** reach PetShopCY by
cherry-pick, because the files involved were never tracked by git. Cherry-picking
every commit in a phase will still leave these undone.

PetShopCY pulls upstream through `v1.5.0-infra` plus the legal track, skips
Phase 6 permanently, and takes fixes per-commit rather than merged. Work this
list by hand at each pull.

## How to use this file

Each entry states the action, why no commit carries it, and how to verify the
result. Tick nothing off until the verification passes in the PetShopCY repo.

---

## Phase 1 — Clean ground

### 1. Delete `mkadmin.js`

**Action:** `rm -f mkadmin.js`

**Why no commit carries it:** listed in `.gitignore` (`mkadmin.js`), so it was
never tracked. `git rm` has nothing to remove and the deletion produces no diff.

**Why it matters:** the file hardcodes a personal email address and a plaintext
password, and creates a user at role `ADMIN`. Anyone who receives the repo as a
zip or folder copy — rather than a `git clone` — gets a script that plants a
working administrator account in their database.

**Replacement:** upstream commit `8ac0802` adds an env-driven owner bootstrap
(`OWNER_EMAIL` / `OWNER_PASSWORD` in `backend/prisma/seed.ts`). That commit does
cherry-pick normally, so PetShopCY gains the replacement automatically — only the
deletion is manual.

**Verify:** `test ! -f mkadmin.js && echo clean`

---

### 2. Delete `tree.txt`

**Action:** `rm -f tree.txt`

**Why no commit carries it:** listed in `.gitignore` (`tree.txt`), never tracked.

**Why it matters:** 27 MB of directory listing. It is not in the image (the
updated `.dockerignore` excludes it upstream) but it bloats the working copy and
any archive of the repo.

**Verify:** `test ! -f tree.txt && echo clean`

---

### 3. Delete `schema-dump.txt`

**Action:** `rm -f schema-dump.txt`

**Why no commit carries it:** listed in `.gitignore` (`schema-dump.txt`), never
tracked.

**Why it matters:** a stale copy of the database schema that will drift from
`prisma/schema.prisma` and mislead anyone who reads it.

**Verify:** `test ! -f schema-dump.txt && echo clean`

---

### 4. Remove `OWNER_PASSWORD` from `.env` after first boot

**Action:** once the owner account exists, delete the `OWNER_PASSWORD` line from
`.env` and restart.

**Why no commit carries it:** `.env` is gitignored in every environment, so no
upstream change can edit a downstream `.env`.

**Why it matters:** the bootstrap only runs while no `ADMIN` exists, so after
first boot the value is dead weight — a live owner password sitting in plaintext
on disk indefinitely, readable by anything with filesystem access. The seed logs
a warning on successful bootstrap telling the operator to remove it.

**Verify:** `grep -c OWNER_PASSWORD .env` returns `0`, and the owner can still
sign in.

---

### 5. Retitle `.claude/CLAUDE.md`

**Action:** change line 1 from `# PetShopCY Tech Stack Rules` to whatever names
that repo.

**Why no commit carries it:** `.claude/` is listed in `.gitignore`, so the whole
directory is untracked.

**Why it matters:** cosmetic upstream, where the file now reads "Shop Starter Kit
Tech Stack Rules". Listed only so the reconciliation is complete — decide per
repo whether it is worth doing.

**Verify:** `head -1 .claude/CLAUDE.md`

---

## Notes

- `.claude/` and `docs/` are also gitignored upstream, so nothing under them
  propagates either. They contain working notes rather than shipping code, so
  they are not tracked in this file unless something operational moves into them.
- Add an entry here the moment an untracked file is touched, not at the end of a
  phase. An unrecorded one is invisible to the downstream reconciliation.
