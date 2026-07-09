-- ============================================
--  کورد ڤۆیس — سکیمای داتابەیس (Supabase)
--  ئەم فایلە لە SQL Editor ی Supabase دا ڕان بکە
-- ============================================

-- ---------- پرۆفایلەکان ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  display_name text generated always as (first_name || ' ' || last_name) stored,
  birth_date date,
  created_at timestamptz default now()
);

-- کاتێک ئەکاونتێکی نوێ دروست دەبێت، پرۆفایلی بۆ دروست دەکرێت
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, birth_date)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'بەکارهێنەر'),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'birth_date', '')::date
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ڕوومەکان ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  topic text default '',
  admin_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table public.room_participants (
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  mic_on boolean not null default false,
  hand boolean not null default false,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

create table public.room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- ---------- هاوڕێیەتی ----------
create table public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- ---------- چاتی تایبەت ----------
create table public.dm_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  kind text not null default 'text' check (kind in ('text','call')),
  created_at timestamptz default now()
);

-- ============================================
--  RLS — پاراستنی داتا
-- ============================================
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_messages enable row level security;
alter table public.friendships enable row level security;
alter table public.dm_messages enable row level security;

-- پرۆفایلەکان: هەموو کەسێکی چووەژوورەوە دەتوانێت بیانبینێت
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- ڕوومەکان
create policy "rooms readable" on public.rooms
  for select to authenticated using (true);
create policy "create room" on public.rooms
  for insert to authenticated with check (auth.uid() = admin_id);
create policy "admin deletes room" on public.rooms
  for delete to authenticated using (auth.uid() = admin_id);

-- بەشدارەکان
create policy "participants readable" on public.room_participants
  for select to authenticated using (true);
create policy "join room" on public.room_participants
  for insert to authenticated with check (auth.uid() = user_id);
create policy "leave room" on public.room_participants
  for delete to authenticated using (auth.uid() = user_id);
-- خۆت تەنها دەتوانیت دەست بەرزبکەیتەوە؛ ئەدمین دەتوانێت مایک بگۆڕێت
create policy "update participant" on public.room_participants
  for update to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select admin_id from public.rooms r where r.id = room_id)
  );

-- نامەکانی ڕووم
create policy "room msgs readable" on public.room_messages
  for select to authenticated using (true);
create policy "send room msg" on public.room_messages
  for insert to authenticated with check (auth.uid() = sender_id);

-- هاوڕێیەتی
create policy "friendships readable" on public.friendships
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "send request" on public.friendships
  for insert to authenticated with check (auth.uid() = requester_id);
create policy "answer request" on public.friendships
  for update to authenticated using (auth.uid() = addressee_id);
create policy "cancel request" on public.friendships
  for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- چاتی تایبەت: تەنها نێرەر و وەرگر دەیبینن
create policy "dm readable" on public.dm_messages
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "send dm" on public.dm_messages
  for insert to authenticated with check (auth.uid() = sender_id);

-- ============================================
--  Realtime — نوێبوونەوەی ڕاستەوخۆ
-- ============================================
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.dm_messages;
