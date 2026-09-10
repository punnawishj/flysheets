# flysheets — real backend starter

This is a working Next.js + Supabase version of the flysheets marketplace
prototype: real Google sign-in, a real Postgres database, real private
file storage (a buyer literally cannot download the full PDF until their
order is marked paid), and an admin dashboard for weekly seller payouts.

Payment collection stays manual by design (buyer transfers via PromptPay
QR or bank transfer, uploads a slip, you or an optional automatic
checker approves it) — that's the same model you already run for your
other businesses, and it needs no payment-gateway license to start. See
"Growing past this" at the bottom for how to add a real payment gateway
later.

## What you need before starting

- Node.js 18 or newer (`node -v` to check)
- A free [Supabase](https://supabase.com) account
- A [Google Cloud](https://console.cloud.google.com) account (for Google sign-in — free)
- A [Vercel](https://vercel.com) account, when you're ready to put this online (free tier is fine)

## 1. Create the Supabase project

1. In Supabase, click **New project**. Pick any name/region, save the database password somewhere.
2. Go to **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**. This creates the `profiles`, `listings`, and `orders` tables plus all their security rules.
3. Go to **Storage** and create three buckets exactly named:
   - `previews` — toggle **Public bucket: ON**
   - `full-files` — leave **Public bucket: OFF**
   - `slips` — leave **Public bucket: OFF**
   (The upload/read rules for these were already created by schema.sql — you only need to create the buckets themselves here.)
4. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click "reveal") → `SUPABASE_SERVICE_ROLE_KEY` — **treat this like a password, never commit it or put it in front-end code**

## 2. Turn on real Google sign-in

1. In Supabase: **Authentication → Providers → Google → Enable**.
2. In Google Cloud Console: **APIs & Services → Credentials → Create Credentials → OAuth client ID** (type: Web application).
   - Authorized redirect URI: the callback URL Supabase shows you on that same Google provider settings page (looks like `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`).
3. Paste the resulting **Client ID** and **Client Secret** back into the Supabase Google provider screen and save.
4. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` for now (you'll change this to your real domain after deploying).

## 3. Configure this project

```bash
cp .env.local.example .env.local
```

Fill in the values from steps 1–2, plus:

- `ADMIN_EMAIL` — the Google account that should see `/admin` (yours)
- `PROMPTPAY_ID` — your real PromptPay-linked phone number or 13-digit ID, so the QR on the checkout page actually pays your account
- `SLIPOK_API_KEY` / `SLIPOK_BRANCH_ID` — optional; leave blank and slip review is manual in `/admin` (works fine, just needs you to click Approve)

Then install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with Google, and try the whole flow: become a seller → upload a listing → open it in a different browser profile/account as a buyer → pay → upload a slip → approve it in `/admin` → download the file.

## 4. Deploy it for real

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project → import the repo**. Add the same environment variables from `.env.local` in the Vercel project settings.
3. Deploy. Vercel gives you a `https://your-project.vercel.app` URL (or attach a custom domain later).
4. Back in Supabase **Authentication → URL Configuration**, change **Site URL** to your real deployed URL, and add it to **Redirect URLs** too — otherwise Google sign-in will redirect to `localhost` and fail.

That's it — this is now a real site anyone with a Google account can use, not limited to your own organization the way the claude.ai prototype was.

## What's already real here (vs. the claude.ai prototype)

- Google sign-in is real OAuth, not a name/email form.
- The full PDF is in a private storage bucket with no public read policy at all — the only way out is a 10-minute signed URL your server issues after checking `orders.status = 'paid'` and that the requester is the buyer. See `src/app/order/[id]/page.tsx`.
- Every write that matters (approving a payment, marking a payout, publishing a listing) goes through Postgres Row Level Security (`supabase/schema.sql`) or a server action that re-checks identity — never something the browser can fake.
- Commission math (`src/lib/money.ts`) is computed server-side from the listing's real price at the moment of purchase, and frozen onto the order — editing a listing's price later never rewrites past orders.

## What's still manual, on purpose

- **Payment collection**: buyer transfers via QR/bank transfer and uploads a slip. Automatic checking is wired up for [SlipOK](https://slipok.com) (sign up, drop the key in `.env.local`, done) but works fine unconfigured — you just approve slips by hand in `/admin`.
- **Weekly seller payouts**: still you, transferring from your own banking app, then clicking "mark as paid" in `/admin` to update the record. There's no bulk bank-transfer API wired up.

## Growing past this

When volume outgrows manual review/payouts, look at a real payment
gateway with PromptPay + payout support for Thai marketplaces — Opn
Payments (formerly Omise) is the easiest to onboard as an individual/SME
and has a native PromptPay QR API, but you'd still transfer to sellers
yourself; 2C2P advertises split-payment and mass-payout features aimed at
marketplaces but expects a registered company and a heavier KYC process.
Once you're moving real volume as a payment intermediary it's worth a
quick conversation with an accountant/lawyer about Bank of Thailand
e-payment rules and VAT — not something to guess at from a README.
