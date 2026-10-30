-- Run once in your Supabase SQL editor. The mobile number is the primary key.
create table public.coupon_customers (
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
revoke all on public.coupon_customers from anon, authenticated;
-- No direct writes: functions derive the phone from a confirmed Auth user.
create function public.get_my_coupon()
returns setof public.coupon_customers language sql security definer set search_path = '' as $$
  select c.* from public.coupon_customers c where c.user_id = auth.uid();
$$;
create function public.register_coupon_customer(p_name text, p_email text)
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
