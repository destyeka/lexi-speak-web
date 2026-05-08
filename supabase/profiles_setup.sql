-- Run this in Supabase SQL Editor for project: lexa-speak-ielts

-- 1) Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'guru', 'admin')),
  affiliation text, -- [NEW] Atribut afiliasi user
  coach_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Alter statements in case the table already exists
alter table public.profiles
  add column if not exists affiliation text;

alter table public.profiles
  add column if not exists coach_id uuid references public.profiles(id) on delete set null;

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

-- 2d) Student score history (for trend charts)
create table if not exists public.student_score_history (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  speaking_attempts integer not null default 1 check (speaking_attempts >= 0),
  unit_index integer,
  part_index integer,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null
);

create index if not exists student_score_history_student_idx on public.student_score_history(student_id);
create index if not exists student_score_history_recorded_at_idx on public.student_score_history(recorded_at desc);

create or replace function public.log_student_progress_history()
returns trigger
language plpgsql
as $$
begin
  if new.latest_score is not null then
    insert into public.student_score_history (
      student_id,
      score,
      speaking_attempts,
      unit_index,
      part_index,
      recorded_at,
      recorded_by
    )
    values (
      new.student_id,
      new.latest_score,
      coalesce(new.speaking_attempts, 0),
      new.last_unit_index,
      new.last_part_index,
      coalesce(new.last_activity_at, new.updated_at, now()),
      new.updated_by
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
  notes text
)
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
    raise exception 'only student accounts can record practice progress';
  end if;

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
    coalesce(speaking_attempts, 0),
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
    speaking_attempts = excluded.speaking_attempts,
    last_activity_at = excluded.last_activity_at,
    last_unit_index = excluded.last_unit_index,
    last_part_index = excluded.last_part_index,
    notes = excluded.notes,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
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
  public.is_admin()
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

-- Helper function to check if student is member (security definer to avoid recursion)
create or replace function public.student_is_class_member(p_student_id uuid, p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.class_members 
    where student_id = p_student_id and class_id = p_class_id
  );
$$;

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
begin
  select id into v_class_id
  from public.classes
  where join_code = p_join_code;

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

create table if not exists public.topic_details (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  type text not null check (type in ('question','bullet')),
  content text not null,
  order_index int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_topics_part on public.topics(part);
create index if not exists idx_topic_details_topic_id on public.topic_details(topic_id);

alter table public.topics enable row level security;
alter table public.topic_details enable row level security;

drop policy if exists "Allow read topics" on public.topics;
create policy "Allow read topics"
on public.topics
for select
to authenticated
using (is_active = true);

drop policy if exists "Allow read topic_details" on public.topic_details;
create policy "Allow read topic_details"
on public.topic_details
for select
to authenticated
using (true);

-- topics insert/update/delete
drop policy if exists "Admin manage topics" on public.topics;
create policy "Admin manage topics"
on public.topics
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
  )
);

-- topic_details insert/update/delete
drop policy if exists "Admin manage topic_details" on public.topic_details;
create policy "Admin manage topic_details"
on public.topic_details
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
  )
);

-- 5a) Assignment tables [NEW]
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  part int not null default 1,
  title text not null,
  description text,
  due_at timestamptz,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

alter table public.assignments
  add column if not exists part int not null default 1;

create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  content text not null,
  type text not null default 'question' check (type in ('question', 'bullet')),
  order_index int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','in_progress','submitted')),
  started_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

-- Alter statements for assignment_questions table
alter table public.assignment_questions
  add column if not exists type text not null default 'question' check (type in ('question', 'bullet'));

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