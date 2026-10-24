# Admin mode for AusFlow iOS

Decided 2026-10-24. Administrators want the web console's global view on the phone, natively. The old WasteID
mobile site showed admins a "Trade Waste Dash" with device counts, due buckets and a long menu; AusFlow 1.1.2
shows every role the driver's Today screen.

Prototypes (direction A, Stitch/hydro look from the web console's layout D): design canvas
https://claude.ai/artifact/UE6Vya7qFcwg9kC7Rp48Uf and `ausflow-ios-admin-prototypes.html` in
github.com/belimked/ccaount.

## Rules

- **Tabs follow the signed-in role.** `ops` (drivers) keep Today / History / Devices / Me, unchanged.
  `admin`, `authority` and `user` (view-only) open Dashboard / Devices / Records / Me.
- **One app, one build.** The view mode is a per-user preference on the phone (`viewMode`), defaulted from the
  role. Admins can switch to the driver view from Me (to record pickups themselves or demo); drivers have no
  console entry. Read-only users get the console with every write hidden (`canWrite` already false).
- **Same data.** Everything the console shows is already in `/state` on the phone (companies, locations,
  devices, drivers, vehicles, facilities, pickups, transfers, unloads, reported issues). Admin screens are
  derived views; no new sync paths in phases 1–2.
- **Scanning differs by view.** Driver scan starts a pickup; admin scan opens the record.
- **Look.** Admin screens use the `admin` palette in `theme.ts` (slate text, `#0369a1` primary, white cards
  with 1 px `#e2e8f0` borders, iOS segmented controls, mono numbers), matching web layout D so people moving
  between console and phone see one product. Driver screens keep the existing AusFlow look.

## Phases

| Phase | Scope | Backend | Native deps |
|---|---|---|---|
| 1 | Role-based shell (`(admin)` tab group, view-mode switch), Dashboard (KPIs, due buckets, 14-day pump-out bars, overdue by company, recent flags), global Devices list (search, All / Overdue / Due soon / Inactive, company filter, sort by due), Records (pump-outs / transfers / unloads by day, 7 / 30 / 90 days), admin Me (Console links, switch view, data status) | none | none |
| 2 | Detail pages: transport company, driver (working days + legs timeline), vehicle (on-board, loads), location, occupier; Companies & people directory (6 segments); device detail gains service-history strip, photos grid and admin links | none | none |
| 3 | Alerts (client-derived, same rules as web `store/alerts.js`: overdue, capacity, location, nolocation, longJob, reportedIssue, vehicleFull; acknowledge/dismiss via `/sync`), Ops tickets (`/tickets` API: list, detail, status, notes) | alert status collection already synced by web; tickets API exists | none |
| 4 | Maps (device map, driver route with per-leg colours), photo viewer, QR labels (device label print/share; vehicle and driver codes if the client wants them), admin scanner | vehicle `qr` exists; driver QR needs a field | `react-native-maps` (MapKit), `expo-print` / share sheet |

Each phase: unit tests + `tsc` + lint locally, push `feat/admin-mode`, GitHub builds and runs E2E (driver
flows must stay green: E2E accounts are `ops`), then an Ad Hoc build for testers. Version bumps 1.2.0 at the
first tester build.

## Out of scope

CSV import, console layout switcher, Trace graph, Users & roles editing (admin web only for now).
