-- Every team or accepted group may receive one approval per task. Collapse
-- any historical repeat approvals before enforcing the invariant.

with ranked_approvals as (
  select id,
         row_number() over (
           partition by task_id, coalesce(pairing_id, team_id)
           order by reviewed_at, submitted_at, id
         ) as approval_number
  from public.submissions
  where status = 'approved'
)
update public.submissions s
set status = 'superseded',
    points_awarded = null
from ranked_approvals r
where s.id = r.id
  and r.approval_number > 1;

update public.tasks set max_submissions = 1 where max_submissions <> 1;

alter table public.tasks
  alter column max_submissions set default 1,
  drop constraint tasks_max_submissions_check,
  add constraint tasks_single_approval_check check (max_submissions = 1);
