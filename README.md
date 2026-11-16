# royal-bikers

Royal Bikers invitation page for Motorcycle Live 2026 (Hall 3, Stand 3B20, NEC Birmingham).

Static site: `index.html` + `img/`. Personalise with `?name=Sarah`.

## RSVPs

- The form posts to `/api/rsvp` (Vercel function), which saves to MongoDB Atlas, database `royalbikers`, collection `rsvps`. One row per email; resubmitting updates it.
- Admin panel: `/admin`. It shows counts by day and interest, has search, delete and CSV download.

### Vercel environment variables

See `.env.example`: `MONGODB_URI`, `MONGODB_DB`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
