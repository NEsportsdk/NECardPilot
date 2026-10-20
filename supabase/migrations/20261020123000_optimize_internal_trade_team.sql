-- Cover foreign keys introduced by the internal trade-team foundation.

create index vallective_team_invitations_invited_by_idx
  on public.vallective_team_invitations (invited_by)
  where invited_by is not null;

create index vallective_team_invitations_accepted_by_idx
  on public.vallective_team_invitations (accepted_by)
  where accepted_by is not null;

create index trade_card_assignments_card_idx
  on public.trade_card_assignments (card_id);
