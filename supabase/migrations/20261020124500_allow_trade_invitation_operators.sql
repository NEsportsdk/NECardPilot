-- Allow the beta operator who created a trade invitation to deliver and audit
-- it without becoming the owner of the invited business workspace.

create policy "Vallective invitation operators can view sent invitations"
on public.vallective_team_invitations
for select
to authenticated
using (
  invited_by = (select auth.uid())
  and exists (
    select 1
    from public.beta_feedback_admins admin
    where admin.user_id = (select auth.uid())
  )
);

create policy "Vallective invitation operators can update delivery state"
on public.vallective_team_invitations
for update
to authenticated
using (
  invited_by = (select auth.uid())
  and exists (
    select 1
    from public.beta_feedback_admins admin
    where admin.user_id = (select auth.uid())
  )
)
with check (
  invited_by = (select auth.uid())
  and exists (
    select 1
    from public.beta_feedback_admins admin
    where admin.user_id = (select auth.uid())
  )
);
