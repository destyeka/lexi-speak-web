-- Run this in Supabase SQL Editor for project: lexa-speak-ielts

-- 1) Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'guru', 'admin')),
  affiliation text, -- [NEW] Atribut afiliasi user
  coach_id uuid references public.profiles(id) on delete set null,
  certificate_name text,
  last_cert_name_update timestamptz,
  created_at timestamptz not null default now()
);

-- Alter statements in case the table already exists
alter table public.profiles
  add column if not exists affiliation text;

alter table public.profiles
  add column if not exists coach_id uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists certificate_name text;

alter table public.profiles
  add column if not exists last_cert_name_update timestamptz;

-- 1b) Classes & Class Members tables [NEW]
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  join_code text unique not null,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Alter statements for existing classes table
alter table public.classes
  add column if not exists name text;

alter table public.classes
  add column if not exists description text;

alter table public.classes
  add column if not exists coach_id uuid references public.profiles(id) on delete cascade;

-- Set default coach_id to created_by for existing rows
update public.classes
set coach_id = created_by
where coach_id is null;

-- Make coach_id not null after setting defaults
alter table public.classes
  alter column coach_id set not null;

create table if not exists public.class_members (
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- 2) Helpful index
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_coach_id_idx on public.profiles(coach_id);
-- Index untuk tabel kelas [NEW]
create index if not exists classes_join_code_idx on public.classes(join_code);
create index if not exists classes_created_by_idx on public.classes(created_by);
create index if not exists classes_coach_id_idx on public.classes(coach_id);
create index if not exists class_members_student_idx on public.class_members(student_id);

create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists class_join_requests_unique on public.class_join_requests(class_id, student_id);
create index if not exists class_join_requests_class_idx on public.class_join_requests(class_id);
create index if not exists class_join_requests_status_idx on public.class_join_requests(status);
create index if not exists class_join_requests_requested_at_idx on public.class_join_requests(requested_at desc);

alter table public.class_join_requests enable row level security;

-- 2c) Student progress table (1 row per student)
create table if not exists public.student_progress (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  latest_score numeric(5,2) check (latest_score is null or (latest_score >= 0 and latest_score <= 100)),
  progress_percent numeric(5,2) check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  speaking_attempts integer not null default 0 check (speaking_attempts >= 0),
  last_activity_at timestamptz,
  last_unit_index integer,
  last_part_index integer,
  notes text,
  metrics jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.student_progress
  add column if not exists speaking_attempts integer not null default 0;

alter table public.student_progress
  add column if not exists last_activity_at timestamptz;

alter table public.student_progress
  add column if not exists last_unit_index integer;

alter table public.student_progress
  add column if not exists last_part_index integer;

alter table public.student_progress
  add column if not exists metrics jsonb not null default '[]'::jsonb;

-- 2d) Student score history (for trend charts)
create table if not exists public.student_score_history (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  metrics jsonb not null default '[]'::jsonb,
  speaking_attempts integer not null default 1 check (speaking_attempts >= 0),
  unit_index integer,
  part_index integer,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  attempt_type text not null default 'practice' check (attempt_type in ('practice', 'test')),
  assignment_id uuid,
  analysis jsonb
);

alter table public.student_score_history
  add column if not exists unit_index integer;

alter table public.student_score_history
  add column if not exists part_index integer;

alter table public.student_score_history
  add column if not exists metrics jsonb not null default '[]'::jsonb;

alter table public.student_score_history
  add column if not exists attempt_type text not null default 'practice' check (attempt_type in ('practice', 'test'));

alter table public.student_score_history
  alter column attempt_type set default 'practice';

update public.student_score_history
set attempt_type = 'practice'
where attempt_type is null;

alter table public.student_score_history
  add column if not exists assignment_id uuid;

alter table public.student_score_history
  add column if not exists analysis jsonb;

create index if not exists student_score_history_student_idx on public.student_score_history(student_id);
create index if not exists student_score_history_recorded_at_idx on public.student_score_history(recorded_at desc);

create or replace function public.log_student_progress_history()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.skip_student_progress_history', true) = 'on' then
    return new;
  end if;

  if new.latest_score is not null then
    insert into public.student_score_history (
      student_id,
      score,
      metrics,
      speaking_attempts,
      unit_index,
      part_index,
      recorded_at,
      recorded_by,
      attempt_type
    )
    values (
      new.student_id,
      new.latest_score,
      coalesce(new.metrics, '[]'::jsonb),
      coalesce(new.speaking_attempts, 0),
      new.last_unit_index,
      new.last_part_index,
      coalesce(new.last_activity_at, new.updated_at, now()),
      new.updated_by,
      'practice'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_student_progress_history on public.student_progress;
create trigger trg_log_student_progress_history
after insert or update on public.student_progress
for each row
execute procedure public.log_student_progress_history();

create index if not exists student_progress_updated_at_idx on public.student_progress(updated_at desc);

create or replace function public.record_student_practice_progress(
  latest_score numeric,
  progress_percent numeric,
  speaking_attempts integer,
  last_activity_at timestamptz,
  last_unit_index integer,
  last_part_index integer,
  notes text,
  metrics jsonb,
  assignment_id uuid DEFAULT NULL,
  analysis jsonb DEFAULT NULL,
  attempt_type text DEFAULT 'practice'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_increment integer := greatest(coalesce(speaking_attempts, 0), 1);
  next_attempts integer;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'user'
  ) then
    raise exception 'only student accounts can record practice progress';
  end if;

  perform set_config('app.skip_student_progress_history', 'on', true);

  insert into public.student_progress (
    student_id,
    latest_score,
    progress_percent,
    speaking_attempts,
    last_activity_at,
    last_unit_index,
    last_part_index,
    notes,
    updated_at,
    updated_by
  )
  values (
    auth.uid(),
    latest_score,
    progress_percent,
    attempt_increment,
    coalesce(last_activity_at, now()),
    last_unit_index,
    last_part_index,
    notes,
    now(),
    auth.uid()
  )
  on conflict (student_id) do update
  set
    latest_score = excluded.latest_score,
    progress_percent = excluded.progress_percent,
    speaking_attempts = coalesce(speaking_attempts, 0) + attempt_increment,
    last_activity_at = excluded.last_activity_at,
    last_unit_index = excluded.last_unit_index,
    last_part_index = excluded.last_part_index,
    notes = excluded.notes,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning speaking_attempts into next_attempts;

  insert into public.student_score_history (
    student_id,
    score,
    metrics,
    speaking_attempts,
    unit_index,
    notes,
    part_index,
    recorded_at,
    recorded_by,
    attempt_type,
    assignment_id,
    analysis
  )
  values (
    auth.uid(),
    latest_score,
    coalesce(metrics, '[]'::jsonb),
    coalesce(next_attempts, attempt_increment),
    last_unit_index,
    last_part_index,
    notes,
    coalesce(last_activity_at, now()),
    auth.uid(),
    coalesce(attempt_type, 'practice'),
    assignment_id,
    analysis
  );
end;
$$;

create or replace function public.is_assigned_coach(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = student
      and p.role = 'user'
      and p.coach_id = auth.uid()
  );
$$;

-- 2b) Validate student-coach assignment consistency
create or replace function public.validate_coach_assignment()
returns trigger
language plpgsql
as $$
begin
  if new.coach_id is null then
    return new;
  end if;

  if new.role <> 'user' then
    raise exception 'coach_id can only be set for student rows';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new.coach_id
      and p.role = 'guru'
  ) then
    raise exception 'assigned coach must be a valid guru account';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_coach_assignment on public.profiles;
create trigger trg_validate_coach_assignment
before insert or update on public.profiles
for each row
execute procedure public.validate_coach_assignment();

-- 3) Admin helper function used by RLS policies
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.is_guru()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'guru'
  );
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'user'
  );
$$;

-- 4) Auto-create profile row when new auth user signs up
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, affiliation)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::text, 'user'),
    new.raw_user_meta_data ->> 'affiliation' -- [FIXED] Merekam afiliasi dari frontend
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- 4b) Backfill existing auth users (important for users created before trigger existed)
insert into public.profiles (id, email, role, affiliation)
select
  u.id,
  u.email,
  coalesce((u.raw_user_meta_data ->> 'role')::text, 'user') as role,
  u.raw_user_meta_data ->> 'affiliation' as affiliation -- [FIXED] Menarik afiliasi pengguna lama (jika ada)
from auth.users u
on conflict (id) do update
set 
  email = excluded.email,
  affiliation = excluded.affiliation;

-- 5) RLS policies
alter table public.profiles enable row level security;

-- Remove old policies first to avoid duplicate-name errors
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_update_admin_or_own" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "profiles_select_guru_directory" on public.profiles;

-- Read: own row or admin can read all
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (
  auth.uid() = id
  or public.is_admin()
);

-- Allow authenticated users to view coach accounts and allow a coach to view student profiles for their class.
create policy "profiles_select_guru_directory"
on public.profiles
for select
to authenticated
using (
  role in ('guru', 'coach')
  or exists (
    select 1
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = public.profiles.id
      and c.coach_id = auth.uid()
  )
);

-- Insert: authenticated user can create own row
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and role in ('user', 'guru', 'admin')
);

-- Update: admin manages all roles/rows, or user can update own row
create policy "profiles_update_admin_or_own"
on public.profiles
for update
to authenticated
using (
  public.is_admin() or auth.uid() = id
)
with check (
  public.is_admin() or auth.uid() = id
);

-- Delete: admin only
create policy "profiles_delete_admin"
on public.profiles
for delete
to authenticated
using (public.is_admin());

-- Allow a student to connect or disconnect a coach only when they are about to start a test.
create or replace function public.assign_student_coach(coach uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'user'
  ) then
    raise exception 'only student accounts can change their test coach';
  end if;

  if coach is not null and not exists (
    select 1
    from public.profiles p
    where p.id = coach
      and p.role = 'guru'
  ) then
    raise exception 'selected coach must be a valid guru account';
  end if;

  update public.profiles
  set coach_id = coach
  where id = auth.uid()
    and role = 'user';

  if not found then
    raise exception 'student profile not found';
  end if;
end;
$$;

-- 5b) RLS policies for student progress
alter table public.student_progress enable row level security;

drop policy if exists "student_progress_select" on public.student_progress;
drop policy if exists "student_progress_insert" on public.student_progress;
drop policy if exists "student_progress_update" on public.student_progress;
drop policy if exists "student_progress_delete" on public.student_progress;

create policy "student_progress_select"
on public.student_progress
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_assigned_coach(student_id)
);

create policy "student_progress_insert"
on public.student_progress
for insert
to authenticated
with check (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_assigned_coach(student_id)
);

create policy "student_progress_update"
on public.student_progress
for update
to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_assigned_coach(student_id)
)
with check (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_assigned_coach(student_id)
);

create policy "student_progress_delete"
on public.student_progress
for delete
to authenticated
using (public.is_admin());

-- 5c) RLS policies for student score history
alter table public.student_score_history enable row level security;

drop policy if exists "student_score_history_select" on public.student_score_history;
drop policy if exists "student_score_history_insert" on public.student_score_history;
drop policy if exists "student_score_history_update" on public.student_score_history;
drop policy if exists "student_score_history_delete" on public.student_score_history;

create policy "student_score_history_select"
on public.student_score_history
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_assigned_coach(student_id)
);

create policy "student_score_history_insert"
on public.student_score_history
for insert
to authenticated
with check (
  student_id = auth.uid()
  or public.is_admin()
  or public.is_assigned_coach(student_id)
);

create policy "student_score_history_update"
on public.student_score_history
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "student_score_history_delete"
on public.student_score_history
for delete
to authenticated
using (public.is_admin());

-- 5d) RLS policies & Function for Classes [NEW]
alter table public.classes enable row level security;
alter table public.class_members enable row level security;

drop policy if exists "classes_select" on public.classes;
drop policy if exists "classes_insert" on public.classes;
drop policy if exists "classes_update" on public.classes;
drop policy if exists "classes_delete" on public.classes;
drop policy if exists "classes_select_coach" on public.classes;
drop policy if exists "classes_select_all_students" on public.classes;

-- Simplified classes select - no circular dependency
create policy "classes_select"
on public.classes for select
to authenticated
using (
  created_by = auth.uid()
  or coach_id = auth.uid()
  or public.student_is_class_member(auth.uid(), id)
);

create policy "classes_insert"
on public.classes for insert
to authenticated
with check (
  public.is_guru()
  and created_by = auth.uid()
);

create policy "classes_update"
on public.classes for update
to authenticated
using (created_by = auth.uid() or coach_id = auth.uid())
with check (created_by = auth.uid() or coach_id = auth.uid());

create policy "classes_delete"
on public.classes for delete
to authenticated
using (created_by = auth.uid());

-- Helper function to check if user is coach/creator of class
create or replace function public.user_is_class_owner(p_user_id uuid, p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.classes 
    where id = p_class_id and (created_by = p_user_id or coach_id = p_user_id)
  );
$$;

drop policy if exists "class_members_select" on public.class_members;
drop policy if exists "class_members_delete_admin_guru" on public.class_members;
drop policy if exists "class_members_insert" on public.class_members;

-- Student can see their own memberships or coaches can see their class members
create policy "class_members_select"
on public.class_members for select
to authenticated
using (
  student_id = auth.uid()
  or public.user_is_class_owner(auth.uid(), class_id)
);

-- Student can insert their own membership
create policy "class_members_insert"
on public.class_members for insert
to authenticated
with check (
  student_id = auth.uid()
);

-- Coach/creator can delete members from their class
create policy "class_members_delete_admin_guru"
on public.class_members for delete
to authenticated
using (
  public.user_is_class_owner(auth.uid(), class_id)
);

-- Policies for class join requests
drop policy if exists "class_join_requests_select" on public.class_join_requests;
drop policy if exists "class_join_requests_insert" on public.class_join_requests;
drop policy if exists "class_join_requests_update" on public.class_join_requests;
drop policy if exists "class_join_requests_delete" on public.class_join_requests;

create policy "class_join_requests_select"
on public.class_join_requests for select
to authenticated
using (
  student_id = auth.uid()
  or public.user_is_class_owner(auth.uid(), class_id)
);

create policy "class_join_requests_insert"
on public.class_join_requests for insert
to authenticated
with check (
  student_id = auth.uid()
  and status = 'pending'
);

create policy "class_join_requests_update"
on public.class_join_requests for update
to authenticated
using (
  public.user_is_class_owner(auth.uid(), class_id)
)
with check (
  public.user_is_class_owner(auth.uid(), class_id)
);

create policy "class_join_requests_delete"
on public.class_join_requests for delete
to authenticated
using (
  public.user_is_class_owner(auth.uid(), class_id)
);

-- Function for student to join a class using code [NEW]
create or replace function public.join_class_by_code(p_join_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_normalized_code text := lower(trim(p_join_code));
begin
  select id into v_class_id
  from public.classes
  where lower(trim(join_code)) = v_normalized_code;

  if not found then
    raise exception 'Kode kelas tidak ditemukan atau tidak valid.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'user'
  ) then
    raise exception 'Hanya akun student (user) yang dapat meminta bergabung ke dalam kelas.';
  end if;

  if exists (
    select 1 from public.class_members
    where class_id = v_class_id and student_id = auth.uid()
  ) then
    raise exception 'Kamu sudah tergabung dalam kelas ini.';
  end if;

  if exists (
    select 1 from public.class_join_requests
    where class_id = v_class_id and student_id = auth.uid() and status = 'pending'
  ) then
    return;
  end if;

  if exists (
    select 1 from public.class_join_requests
    where class_id = v_class_id and student_id = auth.uid() and status = 'declined'
  ) then
    update public.class_join_requests
    set status = 'pending',
        requested_at = now(),
        resolved_at = null
    where class_id = v_class_id and student_id = auth.uid();
    return;
  end if;

  insert into public.class_join_requests (class_id, student_id, status, requested_at)
  values (v_class_id, auth.uid(), 'pending', now())
  on conflict do nothing;
end;
$$;

create or replace function public.expire_pending_join_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.class_join_requests
  set status = 'declined',
      resolved_at = now()
  where status = 'pending'
    and requested_at < now() - interval '7 days';
end;
$$;

create or replace function public.approve_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_student_id uuid;
begin
  select class_id, student_id into v_class_id, v_student_id
  from public.class_join_requests
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Permintaan tidak ditemukan atau sudah diproses.';
  end if;

  update public.class_join_requests
  set status = 'approved',
      resolved_at = now()
  where id = p_request_id;

  insert into public.class_members (class_id, student_id)
  values (v_class_id, v_student_id)
  on conflict do nothing;
end;
$$;

create or replace function public.approve_all_join_requests(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.class_join_requests
  set status = 'approved',
      resolved_at = now()
  where class_id = p_class_id
    and status = 'pending';

  insert into public.class_members (class_id, student_id)
  select class_id, student_id
  from public.class_join_requests
  where class_id = p_class_id
    and status = 'approved';
end;
$$;

create or replace function public.decline_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.class_join_requests
  set status = 'declined',
      resolved_at = now()
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Permintaan tidak ditemukan atau sudah diproses.';
  end if;
end;
$$;


-- question bank
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  part int not null check (part in (1,2,3)),
  title text not null,
  prompt text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Add columns if they don't exist (for existing topics tables)
alter table public.topics
  add column if not exists created_by uuid references public.profiles(id) on delete cascade;

alter table public.topics
  add column if not exists is_public boolean not null default false;

alter table public.topics
  add column if not exists topic_code text;

-- Add additional topic columns expected by the application
alter table public.topics
  add column if not exists unit_id uuid references public.session_units(id) on delete set null;

alter table public.topics
  add column if not exists session text;

alter table public.topics
  add column if not exists category text;

alter table public.topics
  add column if not exists category_code text;

create index if not exists idx_topics_unit_id on public.topics(unit_id);
create index if not exists idx_topics_session on public.topics(session);
create index if not exists idx_topics_category_code on public.topics(category_code);

-- Set created_by for existing topics (assume admin created them)
update public.topics
set created_by = (
  select id from public.profiles 
  where role = 'admin' 
  limit 1
)
where created_by is null;

create table if not exists public.topic_details (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  type text not null check (type in ('question','bullet')),
  content text not null,
  prompt text,
  rubric text,
  order_index int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_topics_part on public.topics(part);
create index if not exists idx_topic_details_topic_id on public.topic_details(topic_id);
create index if not exists idx_topics_created_by on public.topics(created_by);
create index if not exists idx_topics_is_public on public.topics(is_public);

-- Add columns to topic_details if they don't exist
alter table public.topic_details
  add column if not exists prompt text;

alter table public.topic_details
  add column if not exists rubric text;

-- [TAMBAHAN BARU] Membuat tabel session_units agar RLS tidak error
create table if not exists public.session_units (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  order_index int default 0,
  session_code text,
  is_active boolean default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.session_units enable row level security;

-- Allow reading public banks or banks created by user
drop policy if exists "Allow read session_units" on public.session_units;
create policy "Allow read session_units"
on public.session_units
for select
to authenticated
using (
  is_public = true
  or created_by = auth.uid()
  or public.is_guru()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Allow coaches and admins to create session_units
drop policy if exists "Coach and admin create session_units" on public.session_units;
create policy "Coach and admin create session_units"
on public.session_units
for insert
to authenticated
with check (
  (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'guru')
    )
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Allow creator or admin to update session_units
drop policy if exists "Coach and admin update session_units" on public.session_units;
create policy "Coach and admin update session_units"
on public.session_units
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Only admin can delete session_units
drop policy if exists "Admin delete session_units" on public.session_units;
create policy "Admin delete session_units"
on public.session_units
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Ensure session_code column exists and is indexed for lookups
alter table public.session_units
  add column if not exists session_code text;

create unique index if not exists session_units_session_code_idx on public.session_units(session_code);

-- Add additional columns used by the frontend and server logic
alter table public.session_units
  add column if not exists seq int default 0;

alter table public.session_units
  add column if not exists type text;

alter table public.session_units
  add column if not exists category text;

alter table public.session_units
  add column if not exists category_code text;

alter table public.session_units
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.session_units
  add column if not exists access_level text not null default 'free';

alter table public.session_units
  add column if not exists price numeric;

alter table public.session_units
  add column if not exists is_public boolean not null default false;

create index if not exists idx_session_units_seq on public.session_units(seq);
create index if not exists idx_session_units_type on public.session_units(type);
create index if not exists idx_session_units_category_code on public.session_units(category_code);
create index if not exists idx_session_units_is_public on public.session_units(is_public);

alter table public.topics enable row level security;
alter table public.topic_details enable row level security;

-- Updated RLS Policies for topics to support created_by and is_public
drop policy if exists "Allow read topics" on public.topics;
create policy "Allow read topics"
on public.topics
for select
to authenticated
using (
  is_public = true
  or created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Admin and creator can insert topics
drop policy if exists "Admin manage topics" on public.topics;
create policy "Admin manage topics"
on public.topics
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'guru', 'coach')
  )
);

-- Creator and admin can update
drop policy if exists "Admin update topics" on public.topics;
create policy "Admin update topics"
on public.topics
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Only admin can delete topics
drop policy if exists "Admin delete topics" on public.topics;
create policy "Admin delete topics"
on public.topics
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Updated RLS for topic_details
drop policy if exists "Allow read topic_details" on public.topic_details;
create policy "Allow read topic_details"
on public.topic_details
for select
to authenticated
using (
  -- Can read if topic is public
  exists (
    select 1 from public.topics t
    where t.id = topic_id and t.is_public = true
  )
  -- Or if they created the topic
  or exists (
    select 1 from public.topics t
    where t.id = topic_id and t.created_by = auth.uid()
  )
  -- Or if they're admin
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Creator and admin can insert topic details
drop policy if exists "Admin manage topic_details" on public.topic_details;
create policy "Admin manage topic_details"
on public.topic_details
for insert
to authenticated
with check (
  exists (
    select 1 from public.topics t
    where t.id = topic_id
    and (
      t.created_by = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  )
);

-- Creator and admin can update topic details
drop policy if exists "Admin update topic_details" on public.topic_details;
create policy "Admin update topic_details"
on public.topic_details
for update
to authenticated
using (
  exists (
    select 1 from public.topics t
    where t.id = topic_id
    and (
      t.created_by = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  )
)
with check (
  exists (
    select 1 from public.topics t
    where t.id = topic_id
    and (
      t.created_by = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  )
);

-- Only admin can delete topic details
drop policy if exists "Admin delete topic_details" on public.topic_details;
create policy "Admin delete topic_details"
on public.topic_details
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- 4c) Question Public Requests Table [NEW - CENTRALIZED QUESTION BANK]
create table if not exists public.question_public_requests (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

-- Create indexes for question_public_requests
create index if not exists idx_question_public_requests_topic on public.question_public_requests(topic_id);
create index if not exists idx_question_public_requests_status on public.question_public_requests(status);
create index if not exists idx_question_public_requests_requested_by on public.question_public_requests(requested_by);
create index if not exists idx_question_public_requests_created_at on public.question_public_requests(created_at desc);

-- Enable RLS on question_public_requests
alter table public.question_public_requests enable row level security;

-- RLS Policies for question_public_requests
drop policy if exists "question_public_requests_select" on public.question_public_requests;
drop policy if exists "question_public_requests_insert" on public.question_public_requests;
drop policy if exists "question_public_requests_update" on public.question_public_requests;
drop policy if exists "question_public_requests_delete" on public.question_public_requests;

-- Coaches and admins can view all pending requests for their topics
create policy "question_public_requests_select"
on public.question_public_requests for select
to authenticated
using (
  -- Admin can see all
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  -- Coaches can see requests for their own topics
  or exists (
    select 1 from public.topics t
    where t.id = topic_id
    and t.created_by = auth.uid()
  )
  -- Coaches can see their own requests
  or requested_by = auth.uid()
);

-- Coaches can insert requests
create policy "question_public_requests_insert"
on public.question_public_requests for insert
to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('guru', 'coach')
  )
  -- Prevent duplicate requests from same coach
  and not exists (
    select 1 from public.question_public_requests qpr
    where qpr.topic_id = topic_id
    and qpr.requested_by = auth.uid()
    and qpr.status in ('pending', 'approved')
  )
);

-- Only admin can update (approve/reject)
create policy "question_public_requests_update"
on public.question_public_requests for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Only admin can delete
create policy "question_public_requests_delete"
on public.question_public_requests for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Helper function to approve public request
create or replace function public.approve_public_question_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  -- Only admin can approve
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only admin can approve public requests';
  end if;

  -- Get topic_id from request
  select topic_id into v_topic_id
  from public.question_public_requests
  where id = p_request_id;

  if v_topic_id is null then
    raise exception 'Request not found';
  end if;

  -- Update request status and resolved_at
  update public.question_public_requests
  set
    status = 'approved',
    resolved_at = now(),
    resolved_by = auth.uid()
  where id = p_request_id;

  -- Update topic to is_public = true
  update public.topics
  set is_public = true
  where id = v_topic_id;
end;
$$;

-- Helper function to reject public request
create or replace function public.reject_public_question_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admin can reject
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only admin can reject public requests';
  end if;

  -- Update request status
  update public.question_public_requests
  set
    status = 'rejected',
    resolved_at = now(),
    resolved_by = auth.uid()
  where id = p_request_id;
end;
$$;

-- 5a) Assignment tables [NEW]
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  part int not null default 1,
  title text not null,
  description text,
  start_at timestamptz,
  due_at timestamptz,
  -- assignment-level metrics removed; use per-question rubric instead
  is_active boolean default true,
  created_at timestamptz not null default now()
);

alter table public.assignments
  add column if not exists part int not null default 1;

alter table public.assignments
  add column if not exists start_at timestamptz;



create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  part int not null default 1,
  content text not null,
  prompt text default '',
  type text not null default 'question' check (type in ('question', 'bullet')),
  order_index int default 0,
  rubric text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','in_progress','submitted')),
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  metrics jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

-- Alter statements for assignment_questions table
alter table public.assignment_questions
  add column if not exists part int not null default 1;
alter table public.assignment_questions
  add column if not exists prompt text default '';
alter table public.assignment_questions
  add column if not exists type text not null default 'question' check (type in ('question', 'bullet'));
alter table public.assignment_questions
  add column if not exists rubric text;
alter table public.assignment_questions
  add column if not exists topic_id uuid references public.topics(id) on delete cascade;

-- Indexes for assignments
create index if not exists assignments_class_id_idx on public.assignments(class_id);
create index if not exists assignments_coach_id_idx on public.assignments(coach_id);
create index if not exists assignments_created_at_idx on public.assignments(created_at desc);

-- Indexes for assignment_questions
create index if not exists assignment_questions_assignment_id_idx on public.assignment_questions(assignment_id);
create index if not exists assignment_questions_order_index_idx on public.assignment_questions(order_index);

-- Indexes for assignment_submissions
create index if not exists assignment_submissions_student_id_idx on public.assignment_submissions(student_id);
create index if not exists assignment_submissions_status_idx on public.assignment_submissions(status);
-- Ensure columns exist when table was created earlier without them
alter table public.assignment_submissions
  add column if not exists score numeric;

alter table public.assignment_submissions
  add column if not exists metrics jsonb not null default '[]'::jsonb;

alter table public.assignment_submissions
  add column if not exists analysis jsonb not null default '{}'::jsonb;

create index if not exists assignment_submissions_score_idx on public.assignment_submissions(score);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  score numeric not null,
  name_on_certificate text not null,
  certificate_name text,
  speaking_band text not null,
  issued_at timestamptz not null default now(),
  storage_bucket text not null default 'certificates',
  file_path text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists certificates_student_assignment_idx on public.certificates(student_id, assignment_id);
create index if not exists certificates_student_idx on public.certificates(student_id);
create index if not exists certificates_assignment_idx on public.certificates(assignment_id);
create index if not exists certificates_issued_at_idx on public.certificates(issued_at desc);

-- RLS for certificates
alter table public.certificates enable row level security;

drop policy if exists "certificates_select" on public.certificates;
drop policy if exists "certificates_insert" on public.certificates;
drop policy if exists "certificates_update" on public.certificates;
drop policy if exists "certificates_delete" on public.certificates;

create policy "certificates_select"
on public.certificates for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.assignments a
    where a.id = certificates.assignment_id
      and a.coach_id = auth.uid()
  )
);

create policy "certificates_insert"
on public.certificates for insert
to authenticated
with check (
  student_id = auth.uid()
);

create policy "certificates_update"
on public.certificates for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "certificates_delete"
on public.certificates for delete
to authenticated
using (student_id = auth.uid());

-- RLS for assignments
alter table public.assignments enable row level security;

drop policy if exists "assignments_select" on public.assignments;
drop policy if exists "assignments_insert" on public.assignments;
drop policy if exists "assignments_update" on public.assignments;
drop policy if exists "assignments_delete" on public.assignments;

create policy "assignments_select"
on public.assignments for select
to authenticated
using (
  coach_id = auth.uid()
  or exists (
    select 1 from public.class_members cm
    where cm.class_id = assignments.class_id
      and cm.student_id = auth.uid()
  )
);

create policy "assignments_insert"
on public.assignments for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'guru'
  )
  and coach_id = auth.uid()
);

create policy "assignments_update"
on public.assignments for update
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "assignments_delete"
on public.assignments for delete
to authenticated
using (coach_id = auth.uid());

-- RLS for assignment_questions
alter table public.assignment_questions enable row level security;

drop policy if exists "assignment_questions_select" on public.assignment_questions;
drop policy if exists "assignment_questions_insert" on public.assignment_questions;
drop policy if exists "assignment_questions_update" on public.assignment_questions;
drop policy if exists "assignment_questions_delete" on public.assignment_questions;

create policy "assignment_questions_select"
on public.assignment_questions for select
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_questions.assignment_id
      and (
        a.coach_id = auth.uid()
        or exists (
          select 1 from public.class_members cm
          where cm.class_id = a.class_id
            and cm.student_id = auth.uid()
        )
      )
  )
);

create policy "assignment_questions_insert"
on public.assignment_questions for insert
to authenticated
with check (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_questions.assignment_id
      and a.coach_id = auth.uid()
  )
);

create policy "assignment_questions_update"
on public.assignment_questions for update
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_questions.assignment_id
      and a.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_questions.assignment_id
      and a.coach_id = auth.uid()
  )
);

create policy "assignment_questions_delete"
on public.assignment_questions for delete
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_questions.assignment_id
      and a.coach_id = auth.uid()
  )
);

-- RLS for assignment_submissions
alter table public.assignment_submissions enable row level security;

drop policy if exists "assignment_submissions_select" on public.assignment_submissions;
drop policy if exists "assignment_submissions_insert" on public.assignment_submissions;
drop policy if exists "assignment_submissions_update" on public.assignment_submissions;
drop policy if exists "assignment_submissions_delete" on public.assignment_submissions;

create policy "assignment_submissions_select"
on public.assignment_submissions for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.assignments a
    where a.id = assignment_submissions.assignment_id
      and a.coach_id = auth.uid()
  )
);

create policy "assignment_submissions_insert"
on public.assignment_submissions for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'user'
  )
);

create policy "assignment_submissions_update"
on public.assignment_submissions for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "assignment_submissions_delete"
on public.assignment_submissions for delete
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_submissions.assignment_id
      and a.coach_id = auth.uid()
  )
);

-- 6) Run once to make your account admin (replace with your login email)
-- update public.profiles
-- set role = 'admin'
-- where email = 'your-email@example.com';

-- 7) Reset student auth/profile for vinatara27@gmail.com
-- Run this in Supabase SQL Editor if the student account exists but login still fails.
-- This keeps Auth and profiles aligned on the same email and forces the role to student.
do $$
begin
  update auth.users
  set
    email = 'vinatara27@gmail.com',
    email_confirmed_at = coalesce(email_confirmed_at, now())
  where email = 'vinatara27@gmail.com';

  update public.profiles
  set
    email = 'vinatara27@gmail.com',
    role = 'user'
  where email = 'vinatara27@gmail.com';
end 
$$;

-- If the auth account still cannot sign in after this,
-- reset the password from Supabase Auth dashboard or re-create the auth user,
-- because SQL cannot safely guess the correct password hash.