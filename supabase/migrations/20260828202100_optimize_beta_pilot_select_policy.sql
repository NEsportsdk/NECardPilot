drop policy if exists "Users can read own beta pilot progress"
on public.beta_pilot_participants;

drop policy if exists "Beta admins can read pilot progress"
on public.beta_pilot_participants;

create policy "Users and beta admins can read pilot progress"
on public.beta_pilot_participants
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);
