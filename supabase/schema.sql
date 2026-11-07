-- Run this once in the Supabase SQL editor, then set the two EXPO_PUBLIC_* variables.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New friend',
  handle text not null default 'newfriend',
  friend_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint different_friends check (user_low < user_high)
);

create table if not exists public.daily_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  cigarettes integer not null default 0 check (cigarettes >= 0),
  tasks_done integer not null default 0 check (tasks_done >= 0),
  tasks_total integer not null default 0 check (tasks_total >= 0),
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- Full personal state is readable only by its owner. Friend score totals stay
-- in daily_activity and never expose task titles, goals, or smoke notes.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.make_friend_code()
returns text language plpgsql as $$
declare result text;
begin
  loop
    result := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (select 1 from public.profiles where friend_code = result);
  end loop;
  return result;
end;
$$;

create or replace function public.new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare display text;
begin
  display := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'New friend');
  insert into public.profiles (id, display_name, handle, friend_code)
  values (new.id, display, lower(regexp_replace(display, '[^a-zA-Z0-9]+', '', 'g')), public.make_friend_code());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.new_user_profile();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.daily_activity enable row level security;
alter table public.user_state enable row level security;

drop policy if exists user_state_select_own on public.user_state;
create policy user_state_select_own on public.user_state for select to authenticated
using (user_id = auth.uid());
drop policy if exists user_state_insert_own on public.user_state;
create policy user_state_insert_own on public.user_state for insert to authenticated
with check (user_id = auth.uid());
drop policy if exists user_state_update_own on public.user_state;
create policy user_state_update_own on public.user_state for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.friendships f
  where (f.user_low = auth.uid() and f.user_high = profiles.id)
     or (f.user_high = auth.uid() and f.user_low = profiles.id)
));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated
using (user_low = auth.uid() or user_high = auth.uid());
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
using (user_low = auth.uid() or user_high = auth.uid());

drop policy if exists activity_read on public.daily_activity;
create policy activity_read on public.daily_activity for select to authenticated
using (user_id = auth.uid() or exists (
  select 1 from public.friendships f
  where (f.user_low = auth.uid() and f.user_high = daily_activity.user_id)
     or (f.user_high = auth.uid() and f.user_low = daily_activity.user_id)
));
drop policy if exists activity_insert_own on public.daily_activity;
create policy activity_insert_own on public.daily_activity for insert to authenticated
with check (user_id = auth.uid());
drop policy if exists activity_update_own on public.daily_activity;
create policy activity_update_own on public.daily_activity for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.add_friend_by_code(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare friend uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to add friends'; end if;
  select id into friend from public.profiles where friend_code = upper(trim(code));
  if friend is null then raise exception 'No friend found with that code'; end if;
  if friend = auth.uid() then raise exception 'That is your own code'; end if;
  insert into public.friendships (user_low, user_high)
  values (least(auth.uid(), friend), greatest(auth.uid(), friend))
  on conflict do nothing;
  return friend;
end;
$$;
revoke all on function public.add_friend_by_code(text) from public;
grant execute on function public.add_friend_by_code(text) to authenticated;
