const REPORTS = [
  "Summary",
  "Orders",
  "By item",
  "By category",
  "By cashier",
  "By payment method",
  "Discounts & overrides",
  "Refunds",
  "Drawer sessions",
];

const CONFIGURATION = [
  "Catalog",
  "Add-ons",
  "Discounts",
  "Availability",
  "Devices",
  "Users",
  "Roster",
  "Settings",
  "Quarantine",
];

// Sidebar structure and order only — reports-summary-1440.svg. No screen
// exists behind any entry yet, so nothing here is a link.
export function Nav() {
  return (
    <nav aria-label="Primary">
      <h2 id="nav-reports-heading">Reports</h2>
      <ul aria-labelledby="nav-reports-heading">
        {REPORTS.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <ul>
        {CONFIGURATION.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </nav>
  );
}
