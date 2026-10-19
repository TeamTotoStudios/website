# TeamToto Studios — Rocket League tournament website

This is a static HTML/CSS/JavaScript website for GitHub Pages. It keeps `logo.png` as the logo file and adds a Calendar, Projects, About, account creation/login, and an admin-only event publishing form.

## Important: real accounts need a backend

GitHub Pages only hosts static files. It cannot securely create accounts, verify passwords, store events, or enforce admin permissions by itself. This project uses Supabase for authentication and the database. The front-end hides the admin form for regular members, while Supabase Row Level Security policies enforce who is allowed to publish events.

## 1. Keep your logo

Put your existing `logo.png` in the same repository folder as `index.html`, `style.css`, and `script.js`. Filenames are case-sensitive on GitHub Pages.

## 2. Create a Supabase project

1. Create a project at https://supabase.com/.
2. In the project dashboard, open **SQL Editor**.
3. Open `supabase-setup.sql`, copy the whole script into the SQL Editor, and run it.
4. In **Project Settings → API** (or **Connect**, depending on the dashboard version), copy the Project URL and the publishable/anon public key.
5. In `script.js`, replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with those values.

Only use the public/publishable/anon key in browser code. **Never put a `service_role` or secret key in `script.js`, HTML, GitHub, or any public repository.** The SQL policies are what protect event publishing.

## 3. Configure email sign-up

In Supabase, open **Authentication → URL Configuration** and add your GitHub Pages site URL to the allowed redirect/site URLs. A project site normally looks like:

`https://YOUR-GITHUB-USERNAME.github.io/TeamToto-Studios/`

Use your actual GitHub username. Configure email confirmation according to your preference. If confirmation is enabled, new users must click the email confirmation link before they can log in. Check Supabase's current Auth settings if the email confirmation redirect needs an explicit URL.

## 4. Publish on GitHub Pages

Upload/replace `index.html`, `style.css`, `script.js`, `supabase-setup.sql`, and `SETUP.md` in the repository root. Keep `logo.png` there too. Commit the changes. In **Settings → Pages**, choose the `main` branch and `/(root)` if Pages is configured to deploy from a branch.

## 5. Grant your account admin privileges

1. Sign up on your website with the email address you want to use as the administrator.
2. If email confirmation is enabled, confirm that email and log in once so the account exists.
3. In Supabase, open **SQL Editor** and run this query, replacing the example email with the exact email you registered:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('you@example.com')
);
```

4. The query should update one row. Log out and log back in on the website, or refresh the page. Your account should show **Administrator**, and the admin event form should appear in the Calendar section.

Only run that admin-grant query yourself from the trusted Supabase dashboard. Do not add an admin selector or role-editing feature to the public website. Regular users have no policy allowing them to change their own role.

## 6. Add events

Log in using the account whose role you changed to `admin`. Scroll to Calendar. Fill in the event name, date/time, description, and a full `https://` link (for example, a Discord invite, Twitch stream, or registration page), then publish. Events are stored in Supabase and displayed to all site visitors.

## Troubleshooting

- **“Account features are not configured yet”**: check that the Supabase URL and public key in `script.js` were replaced correctly.
- **Sign-up works but login says email not confirmed**: click the confirmation email, or review the project's email-confirmation settings.
- **Events fail to load**: make sure you ran all of `supabase-setup.sql` and check the browser console for errors.
- **Admin form doesn't appear**: confirm the exact email was used in the SQL query, verify one profile row was updated, then log out and back in.
- **Logo missing**: make sure `logo.png` is at the repository root and the name/capitalization matches exactly.
- **GitHub Pages 404**: verify Settings → Pages is deploying the `main` branch from `/(root)` and wait a few minutes after committing.
