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

> **Heads-up on access:** the map is deliberately open — no sign-in. Anyone with the URL
> can add, edit and delete pins, so share the link only with people you trust. If you ever
> want a passcode or per-person accounts instead, the policies in `schema.sql` are the
> place to change it.

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
