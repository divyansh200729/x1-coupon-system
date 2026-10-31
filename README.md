# X1 Smartech coupon + staff portal

Customer page: `dist/index.html`. Staff portal: `dist/admin.html`.

## Customer flow

New customers enter name, mobile number, email and consent to register directly. Returning customers choose "Already registered?" and enter only their mobile number. No SMS, OTP, or customer Auth account is required. The selected mobile number stays in sessionStorage for this tab until logout. One coupon per mobile number; registering again does not overwrite details or reset redemption.

Mobile-only access does not verify ownership: anyone who knows a number can view its coupon status, and someone can register another person's number. Public RPC responses contain only phone, discount and redemption time. Names, email addresses and staff identifiers remain restricted to staff. Staff must check the customer before redeeming.

## Supabase setup

1. For a single SQL editor setup, run the entire `supabase/install.sql` file. It creates missing tables and applies the current mobile-only flow, preserving existing records. Alternatively, run `supabase/migrations/20261101000000_coupon_registration.sql` then `supabase/migrations/20261101010000_mobile_without_otp.sql` in the SQL editor. Existing installations with the baseline already applied run only the second migration. Supabase CLI users can use `supabase db push`. Existing records are preserved. Earlier migrations retain the historical schema; the second migration removes the old customer Auth functions and allows registration without an Auth user.
2. Enable Email/password authentication for staff. Create a staff Auth user and authorize them through the SQL editor:

```sql
insert into public.coupon_admins(user_id) values ('STAFF-USER-UUID');
```

3. Set the project URL and public publishable/anon key in `dist/config.js`. Never put service-role credentials in browser files. Phone authentication and an SMS provider are not needed.
4. Deploy on Vercel using the included `vercel.json`. Customer page: `/`; staff panel: `/admin.html` or `/admin`.

Direct table access is blocked. Public customer RPCs only register or read coupon status. Staff listing and redemption still require staff authentication and database authorization. Conditional redemption updates prevent double redemption and record the staff UUID and timestamp. Both pages refresh every three seconds while visible.

## Connection and phone navigation

Both panels require the Supabase project URL and public key in `dist/config.js`. Missing configuration shows a connection message; there is no local demo or simulated registration. Returning login reads an existing coupon; new registration saves the name, email and phone through `register_coupon_by_mobile`.

Swipe right on the coupon to go back to details. Swipe left on details to return to the loaded coupon. Visible buttons and browser Back/Forward also navigate. Gestures ignore form controls and vertical scrolling. Logging out clears the loaded coupon and disables forward access until login.

## Validation before launch

Check new registration, mobile-only return, reload, logout, duplicate registration, staff search, redemption and cross-device refresh. Confirm an anonymous caller cannot list customers or redeem coupons. Verify public lookup does not return name, email, user UUID or staff UUID. Live database checks require a configured Supabase project.

The offer is ₹1,100 off a laptop purchase, once per mobile number. Email and phone ownership are not verified. Earlier browser-only records are not imported into Supabase; those customers must register again.
