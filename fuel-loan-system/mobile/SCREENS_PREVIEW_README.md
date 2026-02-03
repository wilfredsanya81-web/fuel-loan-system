# Flutter screens — PNG export (no Flutter required)

To review the mobile UI without running Flutter:

1. **Open** `screens_preview.html` in a browser (double-click or File → Open).
2. **Click** “Export all as PNG” to download each screen as a PNG file.

You’ll get one PNG per screen, for example:

- `01_login.png` — Login
- `02_home_dashboard.png` — Home (Dashboard tab)
- `03_loans_list.png` — Loans list
- `04_search_rider.png` — Search rider
- `05_issue_loan.png` — Issue loan
- `06_loan_detail.png` — Loan detail
- `07_record_payment.png` — Record payment

**Requirements:** A modern browser and (for “Export all”) internet access so the page can load html2canvas from the CDN. If the CDN is blocked, download [html2canvas](https://github.com/niklasvh/html2canvas/releases) and serve it locally, or take screenshots of each phone frame manually.

**Note:** These are static HTML/CSS mockups that match the Flutter app layout and styling; they are not rendered by Flutter.
