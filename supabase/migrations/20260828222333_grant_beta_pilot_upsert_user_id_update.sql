-- PostgREST's ON CONFLICT upsert requires UPDATE privilege on every
-- inserted column that participates in the generated update, including
-- the user_id conflict column. The existing UPDATE policy still requires
-- both the current and resulting row to belong to auth.uid().
grant update (user_id)
on table public.beta_pilot_participants
to authenticated;
