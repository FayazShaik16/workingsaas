# Active Context

## Current Sprint Execution
- Restoring deterministic demo credentials and login access for the 4 core demo presenter accounts (`director@mvgr.edu.in`, `hod.cse@mvgr.edu.in`, `faculty.cse1@mvgr.edu.in`, `finance@mvgr.edu.in`) in the live acceptance organization.
- Writing and executing `scripts/restore-demo-access.ts` against the live Supabase instance.
- Updating auth metadata (`email_confirm: true`, `must_change_password: false`) and setting standard passwords while preserving all organization, timetable, task, wallet, and ledger rows.

## Next Operational Action
- Run `scripts/restore-demo-access.ts`, commit, push to `origin/main`, and output the clear login matrix.

