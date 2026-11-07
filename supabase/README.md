# Cloud accounts and global friends

The app works offline without an account. A free Supabase project adds Google sign-in, private cloud sync for tasks, goals, settings, and smoke logs, plus global friend codes. Only daily totals are shared with friends.

1. Create a Supabase project and run [`schema.sql`](./schema.sql) in its SQL editor.
2. In Supabase Authentication → URL Configuration, add `puffometer://auth/callback` to Redirect URLs.
3. In Authentication → Providers → Google, enable Google. Create a Google OAuth **Web application** client in Google Cloud, use Supabase's displayed `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI, and put that client ID and secret in Supabase. The Google secret stays in Supabase, never in the app.
4. Optionally enable email and password sign-in. Choose whether new accounts must confirm email.
5. Copy `.env.example` to `.env` at the project root and fill in the project URL and publishable key. Never put the service role key in the app.
6. Rebuild the iOS app, sign in with Google on two devices, then enter one user's eight character friend code on the other.

Friend codes create a mutual connection immediately. Friends can see each other's name, handle, daily task completion, cigarette count, and points. Task titles, goals, moods, and individual smoke logs sync to the owner's `user_state` row only. Row level security keeps private state owner-only and daily totals visible to connected friends.
