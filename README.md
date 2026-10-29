# X1 Smartech ₹1,100 laptop coupon

Buildless HTML/CSS/JavaScript. Serve `dist` using any static host. No build or npm install required.

## Preview

Without Supabase configuration the page shows a preview banner. Enter any valid Indian mobile number and code **123456**. Preview records use sessionStorage in this tab only; they are not real customer records. Return with the same number in the same tab to see its redeemed state.

## Connect Supabase

1. Create a Supabase project and run `supabase/setup.sql` once in its SQL editor.
2. Enable Phone authentication and configure an SMS provider in Authentication → Providers. Configure SMS rate limits and anti-abuse settings before a public launch. Supabase supports configured test numbers for development.
3. Put your project URL and publishable/anon key in `dist/config.js`. Never put a service-role key in this file.
4. Deploy `dist` to a public HTTPS static host. The initial Sites preview is owner-private and is not yet a customer-facing QR destination.
5. Test with two mobile numbers: register, redeem, sign out, sign back in, reload and confirm the first redemption timestamp never changes. Verify that the other number keeps its own coupon. Test simultaneous redemption requests against your test project.
6. Generate your printed QR code from the final public HTTPS page URL. Scanning it opens this registration page.

Live authentication uses Supabase SMS OTP. Customer name, email, consent time, mobile and redemption timestamp are stored in `coupon_customers`; inspect/export records from the Supabase dashboard. Email is collected but not verified. The database derives the mobile number from verified authentication and gives browsers no direct table access. Only authenticated users can call functions for their own record. Redemption is an atomic database update and remains used across devices.

The discount is ₹1,100 on a laptop purchase, once per mobile number. The customer presses Redeem at the store. This version does not validate a purchase or require staff approval; add that workflow if required. No expiry or minimum spend has been invented. Define your final sale terms and customer data retention policy before launch.
