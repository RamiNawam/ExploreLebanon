# Lebanon Adventure

A shared map of Lebanon for pinning adventures you've had and places you still want to go.
Frontend-only React + TypeScript (Vite + Leaflet), with Supabase for shared storage.

- **Red pins** — adventures: name, date, main picture, extra pictures, description.
- **Blue pins** — the to-do list: name, description, picture. Tick them off once visited.
- Collapsible **Adventure Log** side tab listing every pin, oldest first.
- Three ways to drop a pin: the toolbar buttons, a **press-and-hold** anywhere on the map,
  or **From photo** — pick a picture and the pin lands where the camera says it was taken,
  with the date filled in from the same EXIF metadata.
- Clicking a pin flies the map to it and opens its card.
- Works on phones: the picture buttons open the camera roll directly; laptops can also
  drag-and-drop files.

## Run it locally

```bash
npm install
npm run dev
```

Without Supabase credentials the app still works — pins are saved in your own browser
(IndexedDB) and are not shared. Add the two env vars below to switch to the shared map.

## Shared storage (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql) and run it. That
   creates the `pins` table, its access policies, the public `pin-photos` bucket and turns
   on realtime.
3. In **Settings → Data API**, copy the **Project URL**. In **Settings → API Keys**, copy the
   **Publishable key** (`sb_publishable_...`) — that is the current name for what used to be
   the `anon` key, which still lives on the *Legacy API keys* tab if you prefer it. Never use
   a `sb_secret_` / `service_role` key here: this is a browser build.
4. Put them in `.env.local` (see [`.env.example`](.env.example)) for local dev, and in
   Netlify under **Site configuration → Environment variables**:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```

## Accounts

The map is private: reading and writing pins both require a signed-in account, enforced by
Postgres row-level security rather than by the app, so the rule holds even if someone calls
the API directly with the publishable key.

There is no public sign-up — you create the accounts yourself:

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
2. **Email:** the username, lowercased, at `@lebanon-adventure.app`. The domain is never
   contacted; it exists only because Supabase Auth identifies people by address.
   `RamiNawam` → `raminawam@lebanon-adventure.app`.
3. **Password:** type it straight into the dashboard. Supabase hashes it (bcrypt); it is
   never stored in this repository or reachable from the browser bundle.
4. Tick **Auto Confirm User**, so the account works without an email round-trip.
5. Repeat for the second account.

Sign in with the plain username (`RamiNawam`), not the address — the app adds the domain.

**Staying signed in.** A successful sign-in stores a session that refreshes itself, so a
device is asked for the password once and not again. Each browser also registers itself in
the `devices` table; the account row at the bottom of the Adventure Log lists them and can
remove one, which signs that browser out the next time it reloads.

> **If you ever want to add a third person,** create the user the same way. To lock things
> down further — say, each person only editing their own pins — the policies in
> `supabase/schema.sql` are the place to change it.

## Deploy (Netlify)

Netlify picks up [`netlify.toml`](netlify.toml) automatically.

- **From the dashboard:** *Add new site → Import an existing project*, pick this GitHub
  repo, then add the two environment variables and deploy.
- **From the CLI:**

  ```bash
  npm i -g netlify-cli
  netlify login
  netlify init      # links this repo to a new site
  netlify deploy --build --prod
  ```

Any push to `main` redeploys once the repo is linked.

## Layout

```
src/
  components/   Splash, MapView, Sidebar, Toolbar, PinEditor, PinDetail
  data/         Lebanon / governorate / district geometry + curated places
  hooks/        usePins — load, save, live-refresh
  lib/          repo (cloud vs device), supabase, geo maths, image resizing
```

Boundaries come from [geoBoundaries](https://www.geoboundaries.org/) (ADM0–ADM2);
basemap tiles from OpenStreetMap, OpenTopoMap and Esri World Imagery.
