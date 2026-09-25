# Virtual Garage for Nerds 🏎️

Your cars deserve better than a glovebox full of crumpled receipts and a Notes app entry that just says "oil??". This is a digital garage for people who check their tire pressures for fun — track every fill-up, every oil change, every questionable mod purchase, and watch your MPG trend like it's a stock ticker.

**Live demo:** https://trinhhongson.github.io/Virtual-Garage-For-Nerd/

## What's in the garage

- **My Garage** — manage your whole fleet. Year, make, model, nickname, VIN, trim, color, purchase details. Switch between your daily and your "financially irresponsible decision" with one tap.
- **Logbook** — three journals for your car's life story:
  - ⛽ **Fuel** — every fill-up with odometer, gallons, and price. MPG is calculated automatically (current odo − previous odo ÷ gallons, the way the car gods intended).
  - 🔧 **Maintenance** — oil changes, brake pads, spark plugs, and the torque specs you'll definitely need again in 30k miles.
  - ⚡ **Mods** — because "just one more part" is a lifestyle. Track brand, specs, cost, and mileage at install.
- **Fuel insights** — a smoothed MPG trend graph (moving average + spline, so one bad tank doesn't ruin the vibe). Hover on desktop or tap on mobile to inspect any fill-up. Plus average MPG, best tank, and total fuel spend.
- **CSV import** — bulk-import years of fuel logs. The template header is `Date,Odometer,Gallons,PricePerGal,Notes`. Finally, a use for that spreadsheet you've been "meaning to organize."
- **Dark mode** — automatic via your system preference. For late-night parts browsing, as is tradition.
- **Mobile-first** — bottom nav, bottom sheets, 44px touch targets. Built to be used with greasy hands in a driveway. (Wash them first. Please.)

## Tech stack

- **Frontend:** React 19 + Vite — no heavy chart libraries, the MPG graph is hand-rolled SVG. Like a carburetor: simple, mechanical, satisfying.
- **Backend:** Firebase — Google sign-in for auth, Firestore for data (`users/{uid}/vehicles`, `/logs`, `/mods`, `/maintenance`).
- **Hosting:** GitHub Pages, deployed automatically on every push to `main`.

## Self-hosting quick start

Want your own garage? Takes about 10 minutes — less time than an oil change.

**1. Clone and install**

```bash
git clone https://github.com/trinhhongson/Virtual-Garage-For-Nerd.git
cd Virtual-Garage-For-Nerd
npm install
```

**2. Bring your own Firebase** (free Spark plan is plenty)

- Create a project at [console.firebase.google.com](https://console.firebase.google.com).
- **Authentication → Sign-in method** → enable **Google**. (Yes, Google only — your garage has standards.)
- **Firestore Database** → Create database → start in **production mode** and add rules scoped to the signed-in user, e.g.:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**3. Point the app at your project**

Open `src/App.jsx`, find the `firebaseConfig` object near the top, and swap in your own project's values (Firebase console → Project settings → Your apps → Web app):

```js
const firebaseConfig = {
  apiKey: "yours",
  authDomain: "yours.firebaseapp.com",
  projectId: "yours",
  // ...
};
```

**4. Run it**

```bash
npm run dev     # local dev server
npm run build   # production build
npm run lint    # keep it clean
```

**5. Deploy to GitHub Pages** (optional, but why not flex)

- `vite.config.js` already sets `base: '/Virtual-Garage-For-Nerd/'` — change it to match *your* repo name.
- Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- Push to `main`. The included workflow builds and deploys automatically. Your garage goes live in ~2 minutes — faster than most turbo spool.

## Contributing

Found a bug? Got a feature idea (launch control mode? maintenance reminders? a "money spent on mods" shame counter)? Open an issue or PR. All car nerds welcome — yes, even the rotary people.

## License

MIT. Do whatever you want with it, just don't blame us when the mod list gets longer than the maintenance list.
