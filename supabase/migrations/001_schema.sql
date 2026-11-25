-- FindIt AI - 001: tables, constraints, helper functions, protection triggers
create extension if not exists pg_trgm with schema extensions;

-- ---------- tables ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  city text check (char_length(city) <= 80),
  role text not null default 'user' check (role in ('user', 'admin')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_suspended from public.profiles where id = auth.uid()), false);
$$;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('lost', 'found')),
  name text not null check (char_length(name) between 3 and 100),
  category text not null check (char_length(category) between 1 and 50),
  description text not null check (char_length(description) between 10 and 1000),
  location_text text not null check (char_length(location_text) between 3 and 200),
  city text not null check (char_length(city) between 1 and 80),
  latitude double precision,
  longitude double precision,
  event_date date not null check (event_date <= current_date + 1),
  event_time text check (event_time in ('Morning', 'Afternoon', 'Evening', 'Night', 'Not sure')),
  color text not null check (char_length(color) between 1 and 30),
  brand text check (char_length(brand) <= 60),
  additional_details text check (char_length(additional_details) <= 1000),
  status text not null default 'active' check (status in ('active', 'matched', 'resolved', 'closed')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 5 and 300),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid not null references public.items(id) on delete cascade,
  found_item_id uuid not null references public.items(id) on delete cascade,
  score int not null check (score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'suggested' check (status in ('suggested', 'contacted', 'confirmed')),
  dismissed_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lost_item_id, found_item_id),
  check (lost_item_id <> found_item_id)
);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  item_id uuid not null references public.items(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('match', 'contact_request', 'contact_response', 'message', 'system')),
  title text not null,
  body text not null default '',
  related_match_id uuid references public.matches(id) on delete set null,
  related_request_id uuid references public.contact_requests(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 100),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index items_browse_idx on public.items (type, status, created_at desc);
create index items_user_idx on public.items (user_id, created_at desc);
create index items_category_idx on public.items (category);
create index items_city_idx on public.items (city);
create index items_search_idx on public.items using gin ((name || ' ' || description) extensions.gin_trgm_ops);
create index item_images_item_idx on public.item_images (item_id, position);
create index matches_lost_idx on public.matches (lost_item_id);
create index matches_found_idx on public.matches (found_item_id);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
create index contact_requests_req_idx on public.contact_requests (requester_id);
create index contact_requests_rec_idx on public.contact_requests (recipient_id);
create unique index contact_requests_one_pending on public.contact_requests (requester_id, item_id) where status = 'pending';
create index messages_request_idx on public.messages (request_id, created_at);
create index flags_status_idx on public.flags (status, created_at desc);

-- ---------- updated_at triggers ----------
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger items_updated before update on public.items for each row execute function public.set_updated_at();
create trigger matches_updated before update on public.matches for each row execute function public.set_updated_at();
create trigger contact_requests_updated before update on public.contact_requests for each row execute function public.set_updated_at();
create trigger flags_updated before update on public.flags for each row execute function public.set_updated_at();

-- ---------- protection triggers ----------
-- auth.uid() is null when running from the SQL editor or with the service role (trusted contexts).
create or replace function public.profiles_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      raise exception 'You cannot change roles.';
    end if;
    if new.is_suspended is distinct from old.is_suspended and not public.is_admin() then
      raise exception 'You cannot change suspension.';
    end if;
    if new.id <> old.id then raise exception 'Invalid change.'; end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.profiles_protect();

create or replace function public.items_protect_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.is_hidden := false;
    if (select count(*) from public.items where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'Daily report limit reached. Try again tomorrow.';
    end if;
  end if;
  return new;
end $$;
create trigger items_protect_insert before insert on public.items for each row execute function public.items_protect_insert();

create or replace function public.items_protect_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.user_id <> old.user_id or new.type <> old.type then
      raise exception 'Owner and type cannot be changed.';
    end if;
    if new.is_hidden is distinct from old.is_hidden and not public.is_admin() then
      raise exception 'You cannot change visibility.';
    end if;
  end if;
  return new;
end $$;
create trigger items_protect_update before update on public.items for each row execute function public.items_protect_update();

create or replace function public.item_images_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.item_images where item_id = new.item_id) >= 3 then
    raise exception 'A report can have at most 3 images.';
  end if;
  return new;
end $$;
create trigger item_images_limit before insert on public.item_images for each row execute function public.item_images_limit();

-- ---------- new user -> profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare dn text;
begin
  dn := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 60);
  if char_length(dn) < 2 then dn := 'User'; end if;
  insert into public.profiles (id, display_name) values (new.id, dn);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
