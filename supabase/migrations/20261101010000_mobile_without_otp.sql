-- Apply after the baseline migration. Existing records and staff access remain.
begin;
alter table public.coupon_customers alter column user_id drop not null;
drop function if exists public.register_coupon_customer(text,text);
drop function if exists public.get_my_coupon();

-- Mobile-only access is not authentication. Return coupon status, not personal details.
create or replace function public.lookup_coupon_by_mobile(p_phone text)
returns table(phone text, discount_inr integer, redeemed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if p_phone is null or p_phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Enter a valid Indian mobile number.' using errcode = '22023';
  end if;
  return query select c.phone,c.discount_inr,c.redeemed_at
    from public.coupon_customers c where c.phone = p_phone;
end;
$$;

create or replace function public.register_coupon_by_mobile(p_phone text,p_name text,p_email text)
returns table(phone text, discount_inr integer, redeemed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if p_phone is null or p_phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Enter a valid Indian mobile number.' using errcode = '22023';
  end if;
  if p_name is null or length(trim(p_name)) not between 2 and 100
    or p_email is null or length(trim(p_email)) > 254
    or trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid name and email.' using errcode = '22023';
  end if;
  insert into public.coupon_customers as c(phone,name,email)
    values(p_phone,trim(p_name),trim(p_email))
    on conflict on constraint coupon_customers_pkey do nothing;
  return query select * from public.lookup_coupon_by_mobile(p_phone);
end;
$$;
revoke all on public.coupon_customers from public,anon,authenticated;
revoke all on function public.lookup_coupon_by_mobile(text) from public;
revoke all on function public.register_coupon_by_mobile(text,text,text) from public;
grant execute on function public.lookup_coupon_by_mobile(text) to anon,authenticated;
grant execute on function public.register_coupon_by_mobile(text,text,text) to anon,authenticated;
commit;
