create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  experience_rating smallint not null,
  message text not null,
  page_path text not null,
  screen_class text not null,
  language text not null,
  is_online boolean not null,
  is_standalone boolean not null,
  allow_follow_up boolean not null default true,
  status text not null default 'new',
  created_at timestamp with time zone not null default now(),
  constraint beta_feedback_category_check
    check (category in ('bug', 'idea', 'usability', 'data', 'other')),
  constraint beta_feedback_experience_rating_check
    check (experience_rating between 1 and 5),
  constraint beta_feedback_message_length_check
    check (char_length(btrim(message)) between 20 and 2000),
  constraint beta_feedback_page_path_check
    check (
      page_path ~ '^/'
      and char_length(page_path) <= 300
      and position('?' in page_path) = 0
      and position('#' in page_path) = 0
    ),
  constraint beta_feedback_screen_class_check
    check (screen_class in ('mobile', 'tablet', 'desktop')),
  constraint beta_feedback_language_length_check
    check (char_length(language) between 1 and 20),
  constraint beta_feedback_status_check
    check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed'))
);

create index beta_feedback_user_created_at_idx
  on public.beta_feedback (user_id, created_at desc);

create index beta_feedback_status_created_at_idx
  on public.beta_feedback (status, created_at desc);

alter table public.beta_feedback enable row level security;

revoke all on table public.beta_feedback from anon, authenticated;

grant insert (
  user_id,
  category,
  experience_rating,
  message,
  page_path,
  screen_class,
  language,
  is_online,
  is_standalone,
  allow_follow_up
) on table public.beta_feedback to authenticated;

create policy "Users can submit own beta feedback"
on public.beta_feedback
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'new'
);
