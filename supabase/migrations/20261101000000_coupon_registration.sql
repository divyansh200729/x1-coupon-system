-- Customer coupon registration and staff redemption baseline.
-- Safe for fresh projects and the existing setup.sql schema; preserves records.
begin;

-- Run once in your Supabase SQL editor. The mobile number is the primary key.
create table if not exists public.coupon_customers (
  phone text primary key check (phone ~ '^\+91[6-9][0-9]{9}$'),
  user_id uuid not null unique references auth.users(id),
  name text not null check (length(name) between 2 and 100),
  email text not null check (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  discount_inr integer not null default 1100 check (discount_inr = 1100),
  created_at timestamptz not null default now(),
  consent_at timestamptz not null default now(),
  redeemed_at timestamptz
);
alter table public.coupon_customers enable row level security;
revoke all on public.coupon_customers from public, anon, authenticated;
-- No direct writes: functions derive the phone from a confirmed Auth user.
create or replace function public.get_my_coupon()
returns setof public.coupon_customers language sql security definer set search_path = '' as $$
  select c.* from public.coupon_customers c where c.user_id = auth.uid();
$$;
create or replace function public.register_coupon_customer(p_name text, p_email text)
returns setof public.coupon_customers language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  select '+' || ltrim(u.phone, '+') into v_phone from auth.users u
    where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null then raise exception 'Please verify your mobile number first.'; end if;
  insert into public.coupon_customers(phone,user_id,name,email)
    values(v_phone,auth.uid(),trim(p_name),trim(p_email))
    on conflict(phone) do nothing;
  return query select c.* from public.coupon_customers c where c.phone = v_phone and c.user_id = auth.uid();
end;
$$;
revoke all on function public.get_my_coupon() from public, anon;
revoke all on function public.register_coupon_customer(text,text) from public, anon;
grant execute on function public.get_my_coupon() to authenticated;
grant execute on function public.register_coupon_customer(text,text) to authenticated;

-- REQUIRED: run admin-migration.sql next to enable staff-only redemption.

-- Run AFTER setup.sql (also upgrades existing installations).
-- Remove customer redemption at the database boundary.
drop function if exists public.redeem_laptop_coupon();
create table if not exists public.coupon_admins (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.coupon_admins enable row level security;
revoke all on public.coupon_admins from public, anon, authenticated;
alter table public.coupon_customers add column if not exists redeemed_by uuid references auth.users(id);
create or replace function public.is_coupon_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.coupon_admins a where a.user_id = auth.uid());
$$;
create or replace function public.admin_list_customers(p_search text default '', p_status text default 'all', p_offset integer default 0)
returns setof public.coupon_customers language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_coupon_admin() then raise exception 'Staff access required.' using errcode = '42501'; end if;
 return query select c.* from public.coupon_customers c
 where (p_search = '' or c.name ilike '%'||p_search||'%' or c.phone ilike '%'||p_search||'%' or c.email ilike '%'||p_search||'%')
 and (p_status = 'all' or (p_status = 'redeemed' and c.redeemed_at is not null) or (p_status = 'ready' and c.redeemed_at is null))
 order by c.created_at desc, c.phone limit 25 offset greatest(p_offset,0);
end;
$$;
create or replace function public.admin_redeem_coupon(p_phone text)
returns setof public.coupon_customers language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_coupon_admin() then raise exception 'Staff access required.' using errcode = '42501'; end if;
 return query update public.coupon_customers c set redeemed_at = now(), redeemed_by = auth.uid()
 where c.phone = p_phone and c.redeemed_at is null returning c.*;
 if not found then
  return query select c.* from public.coupon_customers c where c.phone = p_phone;
  if not found then raise exception 'Customer not found.'; end if;
 end if;
end;
$$;
revoke all on function public.is_coupon_admin() from public, anon;
revoke all on function public.admin_list_customers(text,text,integer) from public, anon;
revoke all on function public.admin_redeem_coupon(text) from public, anon;
grant execute on function public.is_coupon_admin() to authenticated;
grant execute on function public.admin_list_customers(text,text,integer) to authenticated;
grant execute on function public.admin_redeem_coupon(text) to authenticated;
-- Create a staff user in Supabase Authentication, then authorize their UUID:
-- insert into public.coupon_admins(user_id) values ('STAFF-USER-UUID');
-- Do this only via the SQL editor. Customers cannot add themselves as admins.

commit;

