# X1 Smartech coupon + staff portal

Customer page: `dist/index.html`. Staff portal: `dist/admin.html`.

## Try the local preview

Open the customer page and admin.html in two tabs of the SAME browser on the same origin. Register a customer using OTP 123456, then open the demo admin panel. The new record appears automatically. Find the customer and press Redeem, then confirm. The customer status updates and plays the fireworks animation. Repeat redemption is disabled.

Preview records use localStorage shared between tabs and persist after reload. Use fictional details: preview has no authentication or database security. Previous sessionStorage preview records are not migrated; register again. Different browsers/devices do not sync until Supabase is connected.

## Live setup

1. Create a Supabase project. Run `supabase/setup.sql` and THEN `supabase/admin-migration.sql` in the SQL editor. Existing installations run only admin-migration.sql. It removes the old customer redemption function.
2. Enable Phone authentication with an SMS provider, and Email/password authentication for staff. Configure rate limits and anti-abuse settings before launch.
3. Create a staff user in Supabase Authentication. Authorize their UUID from the SQL editor:

```sql
insert into public.coupon_admins(user_id) values ('STAFF-USER-UUID');
```

4. Add project URL and publishable/anon key to `dist/config.js`. Never use the service-role key in browser files.
5. Deploy dist on a public HTTPS static host. Point the printed QR code to the customer page. Give staff the /admin.html URL.

Customers can only register and view their own coupon. Staff sign in separately and the database verifies membership in coupon_admins before listing records or redeeming. Direct browser table writes are prohibited. Each redemption saves its timestamp and staff user UUID. Conditional database updates prevent repeat redemption, including concurrent requests. Customer and admin sessions use separate storage keys.

Both pages poll Supabase every three seconds while visible; this is automatic near-live synchronization, not a push subscription. The admin list supports search, status filters and 25 records per page. Staff must check that the customer is present before confirming redemption. Customer fireworks play when their open page first observes the redeemed status.

## Checks before launch

Use two customer mobile numbers and a staff account. Check registration, staff search, redemption, page reload, cross-device sync and duplicate/concurrent redemption. Confirm a normal customer cannot call admin_list_customers or admin_redeem_coupon, and that the old redeem_laptop_coupon function no longer exists. Live database/OTP checks require your configured Supabase project.

The offer is ₹1,100 off a laptop purchase, once per mobile number. A future offer reset/campaign system is not yet implemented. Define your final sale terms and data retention policy before launch. Email is collected but not verified.
