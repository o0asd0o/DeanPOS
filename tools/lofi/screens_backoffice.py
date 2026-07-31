"""Back-office (apps/backoffice) — desktop 1440x900, plus phone 390x844 where it matters."""

from lofi import D, M, S, W, box, grid, ln, rows, screen, table, txt

X, Y = 1440, 900
P, PH = 390, 844
DESK = "backoffice · desktop 1440x900"
PHONE = "backoffice · phone 390x844"

# (label, depth). Reports is a group: the eight sales reports are its children, and
# `Summary` is also the back-office landing page. There is no separate Dashboard.
NAV = [
    ("Reports", 0),
    ("Summary", 1),
    ("Orders", 1),
    ("By item", 1),
    ("By category", 1),
    ("By cashier", 1),
    ("By payment method", 1),
    ("Discounts & overrides", 1),
    ("Drawer sessions", 1),
    ("Catalog", 0),
    ("Add-ons", 0),
    ("Discounts", 0),
    ("Availability", 0),
    ("Devices", 0),
    ("Users", 0),
    ("Roster", 0),
    ("Settings", 0),
    ("Quarantine", 0),
]


def shell(active, title, crumb=""):
    e = [
        box(0, 0, 240, Y, "", D),
        txt(16, 34, "DeanPOS", 15, "l", "bold"),
        box(12, 48, 216, 36, "▾  Aling Nena's", W, align="l", size=12),
    ]
    for i, (n, depth) in enumerate(NAV):
        x = 12 + depth * 14
        e.append(box(x, 100 + i * 34, 228 - x, 28, n, S if n == active else D,
                     align="l", size=11 if depth else 12))
    e += [
        box(12, Y - 60, 216, 40, "Jomel · admin  ·  Sign out", W, align="l", size=11),
        box(240, 0, X - 240, 64, "", M),
        txt(264, 40, title, 17, "l", "bold"),
        txt(X - 24, 40, crumb, 12, "r"),
    ]
    return e


def build():
    out = []

    # ------------------------------------------------------------------- login
    e = [
        box(0, 0, X, Y, "", D),
        box(X / 2 - 230, 220, 460, 420, "", W),
        txt(X / 2, 280, "DeanPOS back-office", 20, "c", "bold"),
        txt(X / 2 - 206, 330, "Email", 12),
        box(X / 2 - 206, 342, 412, 48, "", W),
        txt(X / 2 - 206, 416, "Password", 12),
        box(X / 2 - 206, 428, 412, 48, "", W),
        box(X / 2 - 206, 504, 412, 56, "SIGN IN", S, size=15),
        box(X / 2 - 206, 578, 412, 40, "Email or password is incorrect", W, dash=1, size=12),
    ]
    out.append(screen("backoffice/login-1440.svg", X, Y, "Back-office · Sign in", DESK, e, notes=[
        "One message for unknown email and wrong password — no account enumeration.",
        "No self-service password reset in v1; an admin sets a temporary password.",
        "This is the desk. Cashiers unlock the terminal with a PIN instead.",
    ]))

    # ----------------------------------------------------------------- catalog
    e = shell("Catalog", "Catalog", "Malabon · Cubao")
    e += [
        box(264, 88, 260, Y - 120, "", D),
        txt(276, 112, "Categories", 12, "l", "bold"),
    ]
    e += rows(276, 124, 236, 36, [("Ulam", S), "Rice", "Drinks", "Sides", "Extras",
                                  ("+ New category", W)], gap=6, align="l", size=12)
    e += [
        box(548, 88, 400, 40, "Search menu items…", W, align="l", size=12),
        box(X - 24 - 180, 88, 180, 40, "+ New menu item", S, size=12),
    ]
    e += table(548, 144, X - 572, ["MENU ITEM", "CATEGORY", "VARIANTS", "STATUS"],
               [["Ulam", "Ulam", "3", "live"],
                ["Pancit", "Ulam", "2", "live"],
                ["Rice", "Rice", "1", "live"],
                ["Halo-halo", "Extras", "0", "not sellable — no variant"],
                ["Turon", "Extras", "1", "archived"]],
               colw=[380, 220, 140, 100])
    out.append(screen("backoffice/catalog-list-1440.svg", X, Y, "Back-office · Catalog", DESK, e, notes=[
        "A MenuItem with no Variant is listed and flagged — it never reaches a terminal.",
        "Archived rows are filtered out by default and still readable.",
        "Categories reorder here; that order is the terminal's grid order.",
    ]))

    # ---------------------------------------------------------- menuitem editor
    e = shell("Catalog", "Ulam", "Catalog › Ulam")
    e += [
        txt(264, 110, "Name", 12), box(264, 122, 460, 44, "Ulam", W, align="l"),
        txt(744, 110, "Category", 12), box(744, 122, 300, 44, "▾  Ulam", W, align="l"),
        box(X - 24 - 160, 122, 160, 44, "Archive", W, size=12),
        txt(264, 208, "Variants — the price lives here", 13, "l", "bold"),
    ]
    e += table(264, 220, X - 288, ["VARIANT", "PRICE", "MODIFIER GROUPS", "ADD-ONS", ""],
               [["Adobo", "₱120.00", "Size", "Extra rice, Itlog", "edit  archive"],
                ["Munggo", "₱110.00", "Size", "Extra rice", "edit  archive"],
                ["Menudo", "₱130.00", "Size", "Extra rice, Itlog", "edit  archive"]],
               colw=[300, 180, 320, 340, 288])
    e += [
        box(264, 372, 200, 40, "+ Add variant", W, size=12),
        txt(264, 452, "Modifier groups — shared, edit once and every linked variant follows", 13, "l", "bold"),
        box(264, 466, 560, 190, "Group: Size\nRule: ▾ choose exactly one (required)\n\n"
                                "• Whole   ×1.0   [default]\n• Half    ×0.5\n\n"
                                "Linked to 3 variants", W, align="l", size=12),
        box(848, 466, 560, 190, "Delta type is stored, never inferred:\n\n"
                                "  absolute    ± centavos\n  multiplier  × rate\n\n"
                                "0.5 is never guessed as ₱0.50 or half price.", D, dash=1, align="l", size=12),
        box(264, 680, 220, 40, "+ Add modifier group", W, size=12),
        box(X - 24 - 200, Y - 76, 200, 52, "Save", S),
    ]
    out.append(screen("backoffice/menuitem-editor-1440.svg", X, Y, "Back-office · Menu item editor", DESK, e, notes=[
        "Price lives on the Variant. The MenuItem has none and is not sellable alone.",
        "Modifier groups are shared objects — editing one updates every linked Variant.",
        "A price change affects future Orders only; past OrderLines keep their recorded price.",
    ]))

    # ----------------------------------------------------------------- add-ons
    e = shell("Add-ons", "Add-ons", "tenant-wide")
    e += [box(X - 24 - 160, 88, 160, 40, "+ New add-on", S, size=12)]
    e += table(264, 144, X - 288, ["ADD-ON", "DELTA TYPE", "VALUE", "MAX QTY", "LINKED VARIANTS", ""],
               [["Extra rice", "absolute", "+₱15.00", "3", "12", "edit  archive"],
                ["Itlog", "absolute", "+₱20.00", "2", "8", "edit  archive"],
                ["Extra sabaw", "absolute", "+₱10.00", "1", "4", "edit  archive"]],
               colw=[300, 220, 200, 160, 260, 288])
    e += [box(264, 320, 700, 120, "An add-on with no linked variants is offered nowhere.\n"
                                  "Max quantity is enforced at the till by the stepper, and again on the server.",
              D, dash=1, align="l", size=12)]
    out.append(screen("backoffice/addons-1440.svg", X, Y, "Back-office · Add-ons", DESK, e))

    # ------------------------------------------------------------- availability
    e = shell("Availability", "Availability", "Malabon")
    e += [
        box(264, 88, 300, 40, "▾  Store: Malabon", W, align="l", size=12),
        box(580, 88, 300, 40, "Search variants…", W, align="l", size=12),
        box(X - 24 - 220, 88, 220, 40, "Mark all available", W, size=12),
    ]
    e += table(264, 144, X - 288, ["VARIANT", "MENU ITEM", "PRICE", "AVAILABLE AT MALABON"],
               [["Adobo", "Ulam", "₱120.00", "[ ON  ]"],
                ["Munggo", "Ulam", "₱110.00", "[ OFF ]  ← sold out"],
                ["Menudo", "Ulam", "₱130.00", "[ ON  ]"],
                ["Rice", "Rice", "₱15.00", "[ ON  ]"]],
               colw=[340, 320, 240, 528])
    e += [box(264, 330, 760, 100, "Availability is per Store. Cubao is unaffected by anything set here.\n"
                                  "This is the F&B sold-out switch — not stock tracking.", D, dash=1, align="l", size=12)]
    out.append(screen("backoffice/availability-1440.svg", X, Y, "Back-office · Availability", DESK, e, notes=[
        "Per Store, never tenant-wide.",
        "A manager may only toggle Stores they are assigned to.",
    ]))

    # ----------------------------------------------------------------- devices
    e = shell("Devices", "Devices", "Malabon · Cubao")
    e += [box(X - 24 - 180, 88, 180, 40, "+ Enrol a device", S, size=12)]
    e += table(264, 144, X - 288, ["DEVICE", "STORE", "LAST SEEN", "QUEUE", "RELEASE", "STATUS", ""],
               [["Counter 1", "Malabon", "2 min ago", "0", "r-118", "active", "rename  revoke"],
                ["Counter 2", "Malabon", "39 min ago", "3 · oldest 31m", "r-118", "active  ⚠ stalled", "rename  revoke"],
                ["Counter 1", "Cubao", "5 min ago", "0", "r-117", "active  ⚠ old release", "rename  revoke"],
                ["Old tablet", "Malabon", "6 days ago", "2 held", "r-102", "REVOKED", "review held"]],
               colw=[220, 180, 180, 220, 140, 260, 152])
    e += [
        box(264, 330, 620, 200, "Enrol a device\n\nCode:  F4K9 — 2X7M\nStore: Malabon\nExpires in 09:41\n\n"
                                "Single-use. Enter it on the terminal.", W, align="l", size=13),
        box(908, 330, 500, 200, "Revoking is immediate and enforced on replay.\n\n"
                                "Sales already queued on a revoked device are HELD\n"
                                "for review — never dropped, never auto-accepted.\n"
                                "That money was really collected.", D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/devices-1440.svg", X, Y, "Back-office · Devices", DESK, e, notes=[
        "Queue depth and last-seen come from device telemetry; this is where a stalled terminal shows up.",
        "Enrolment codes are single-use, short-lived, and bound to one Store.",
        "Revoke needs a confirmation and is the response to a stolen tablet.",
    ]))

    # ------------------------------------------------------------------- users
    e = shell("Users", "Users", "")
    e += [box(X - 24 - 160, 88, 160, 40, "+ Add user", S, size=12)]
    e += table(264, 144, X - 288, ["NAME", "EMAIL", "ROLE", "STORES", "PIN", "STATUS", ""],
               [["Ana Reyes", "ana@…", "cashier", "Malabon", "set", "active", "edit  deactivate"],
                ["Boy Santos", "boy@…", "manager", "Malabon, Cubao", "set", "active", "edit  deactivate"],
                ["Cris Dela Cruz", "cris@…", "cashier", "Cubao", "not set", "active", "edit  deactivate"],
                ["Dina Lim", "dina@…", "cashier", "Malabon", "set", "deactivated", "reactivate"]],
               colw=[240, 240, 160, 260, 120, 180, 152])
    e += [
        box(264, 330, 640, 190, "Edit user\n\nRole  ▾ cashier\nStores  [✓] Malabon   [ ] Cubao\n\n"
                                "[ Reset password (temporary) ]   [ Reset PIN ]", W, align="l", size=13),
        box(928, 330, 480, 190, "Deactivating is immediate:\nsessions revoked, PIN removed from devices\n"
                                "on next sync — and every past Order and\nOverride stays attributed to them.",
            D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/users-1440.svg", X, Y, "Back-office · Users", DESK, e, notes=[
        "Role answers what kind of action; Store assignment answers where.",
        "Nothing is deleted — deactivation preserves the audit trail.",
    ]))

    # --------------------------------------------------------- drawer sessions
    e = shell("Drawer sessions", "Drawer sessions", "last 7 days")
    e += [
        box(264, 88, 240, 40, "▾  All stores", W, align="l", size=12),
        box(520, 88, 240, 40, "▾  Last 7 days", W, align="l", size=12),
        box(X - 24 - 160, 88, 160, 40, "Export CSV", W, size=12),
    ]
    e += table(264, 144, X - 288,
               ["OPENED", "STORE / DEVICE", "CASHIER", "FLOAT", "EXPECTED", "COUNTED", "VARIANCE", "APPROVED BY"],
               [["07-31 06:58", "Malabon · Counter 2", "Ana", "₱1,000", "₱9,480.00", "₱9,430.00", "−₱50.00", "Boy · miscount"],
                ["07-31 07:02", "Malabon · Counter 1", "Dina", "₱1,000", "₱7,220.00", "₱7,220.00", "₱0.00", "—"],
                ["07-30 06:55", "Cubao · Counter 1", "Cris", "₱800", "₱5,110.00", "₱5,090.00", "−₱20.00", "—  within tolerance"],
                ["07-31 07:10", "Cubao · Counter 1", "Cris", "₱800", "—", "—", "—", "STILL OPEN  ⚠"]],
               colw=[160, 260, 120, 120, 160, 160, 160, 212])
    e += [
        box(264, 330, 700, 170, "Selected session\n\n41 orders · cash ₱8,480 · card recorded ₱1,150\n"
                                "Cash movements:  −₱200 supplies (Boy)   +₱250 change top-up (Boy)\n"
                                "Closed offline — arrived 13:20\n\n[ Add note ]   (figures are final)", W, align="l", size=12),
        box(988, 330, 420, 170, "Terminal computed ₱9,480.00\nServer computed  ₱9,480.00\n\n"
                                "A mismatch here is a SYNC alarm,\nnot a variance — both figures are kept.",
            D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/drawer-sessions-1440.svg", X, Y, "Back-office · Drawer sessions", DESK, e, notes=[
        "A session open far longer than a plausible shift is flagged here and alerted on.",
        "Closed sessions are immutable; notes append.",
        "Cash movements are listed so a payout is not read as a shortfall.",
    ]))

    # -------------------------------------------------------------- quarantine
    e = shell("Quarantine", "Quarantined orders", "2 awaiting a decision")
    e += table(264, 100, 700, ["ORDER", "DEVICE", "CASHIER", "TAKEN", "TOTAL"],
               [["C9-0114", "Old tablet (revoked)", "Dina", "07-25 11:40", "₱240.00"],
                ["C9-0115", "Old tablet (revoked)", "Dina", "07-25 11:52", "₱95.00"]],
               colw=[140, 220, 120, 140, 80])
    e += [
        box(264, 280, 700, 300, "C9-0114\n\nAdobo · Whole ×2                       ₱240.00\n"
                                "Cash · tendered ₱250 · change ₱10\n\n"
                                "Device revoked 07-24 18:00\nOrder taken 07-25 11:40 — after revocation\n"
                                "Arrived 07-31 09:12\n\nReason (required)  ▾", W, align="l", size=12),
        box(264, 600, 340, 56, "Accept into ledger", S, size=13),
        box(624, 600, 340, 56, "Reject", W, size=13),
        box(988, 100, 420, 480, "Why a human decides\n\nA revoked device may still hold sales a real\n"
                                "customer really paid for. Accepting blindly lets a\n"
                                "stolen tablet inject revenue; rejecting blindly\n"
                                "destroys takings.\n\nEvery decision records who made it and why.",
            D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/quarantine-1440.svg", X, Y, "Back-office · Quarantine adjudication", DESK, e, notes=[
        "Admin only. This is the ending to the stolen-tablet path.",
        "An unadjudicated order never appears in any report figure.",
    ]))

    # --------------------------------------------------------- reports: summary
    e = shell("Summary", "Sales summary — Thursday 31 July 2026", "Asia/Manila · day starts 00:00")
    e += [
        box(264, 88, 230, 40, "▾  All stores", W, align="l", size=12),
        box(506, 88, 260, 40, "▾  31 Jul 2026  (single day)", W, align="l", size=12),
        box(778, 88, 250, 40, "▾  All day   (11:00–14:00…)", W, align="l", size=12),
        box(X - 24 - 160, 88, 160, 40, "Export CSV", W, size=12),
        box(264, 140, X - 288, 40, "Computed 14:02 · ⚠ contains a terminal that had not finished syncing "
                                   "· ⚠ 1 device with implausible clock skew", M, align="l", size=12),
    ]
    # the waterfall. gross − discounts − overrides − refunds = net, then the counts.
    tiles = [
        ("GROSS\n₱46,180.00\n▲ 6.2% vs prev", S),
        ("− DISCOUNTS\n₱1,240.00\n▲ 18%", W),
        ("− OVERRIDES\n₱180.00\n▼ 40%", W),
        ("− REFUNDS\n₱620.00\n▲ 5%", W),
        ("= NET\n₱44,140.00\n▲ 5.4%", W),
        ("VAT (12%)\n₱4,729.29\nonly if VAT is on", D),
        ("ORDERS\n214\n▲ 3.1%", W),
        ("AVERAGE ORDER\n₱206.26\n▲ 2.2%", W),
    ]
    for i, (t, f) in enumerate(tiles):
        e.append(box(264 + i * 144, 192, 134, 104, t, f, dash=1 if i == 5 else 0, size=11))
    e += [
        txt(264, 336, "Net sales · bucketed automatically  (≤31d daily · ≤26w weekly · else monthly)",
            13, "l", "bold"),
        box(264, 344, 700, 190, "", W),
    ]
    for i, h in enumerate([40, 62, 88, 74, 120, 150, 96, 54, 70, 102, 130, 118, 84, 60,
                           76, 110, 140, 126, 92, 66, 48, 80, 104, 136, 148, 112, 88, 70, 58, 94]):
        e.append(box(278 + i * 22, 520 - h, 16, h, "", S))
    e += [
        box(264, 542, 700, 30, "…and the same figures as a table directly below the chart",
            D, dash=1, size=11),
        txt(264, 604, "Sales by hour", 13, "l", "bold"),
        box(264, 612, 700, 160, "", W),
    ]
    for i, h in enumerate([24, 44, 96, 132, 120, 56, 36, 48, 88, 112, 72, 32]):
        e.append(box(280 + i * 56, 756 - h, 40, h, "", S))
    e += [
        txt(280, 790, "07   08   09   10   11   12   13   14   15   16   17   18", 11),
        txt(988, 336, "Top variants", 13, "l", "bold"),
    ]
    e += table(988, 344, 420, ["VARIANT", "QTY", "REVENUE"],
               [["Adobo · Whole", "88", "₱10,560"],
                ["Rice", "201", "₱3,015"],
                ["Munggo · Half", "64", "₱4,480"],
                ["Softdrinks", "97", "₱3,395"]], rh=30, colw=[220, 80, 120])
    e += [
        box(988, 512, 420, 76, "Voids 4 · Refunds 3 (₱620) · Overrides 2 (₱180)\n"
                               "Discounts: Senior/PWD ×9 (₱1,240)", W, align="l", size=11),
        box(988, 604, 420, 168, "EVERY figure here is a link.\n\n"
                                "A day in the table, a variant, a cashier,\n"
                                "a payment method — each opens the ORDERS\n"
                                "list with that filter already applied.\n\n"
                                "A total nobody can get behind is a total\n"
                                "nobody will trust.", D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/reports-summary-1440.svg", X, Y, "Back-office · Sales summary", DESK, e, notes=[
        "This screen is also the back-office landing page. There is no separate dashboard.",
        "The strip is a waterfall: gross − discounts − overrides − refunds = net. Selecting a tile charts that figure.",
        "The VAT tile is drawn dashed because it is CONDITIONAL — a non-VAT tenant sees no VAT anywhere.",
        "Discounts and overrides are separate tiles on purpose: a statutory discount is not somebody changing a price.",
        "A sale belongs to the day the DEVICE says it happened, not the day it arrived.",
        "Bucketing is automatic from the range length. There is no bucket selector.",
        "Charts are additions to tables, never replacements.",
    ]))

    e = [
        box(0, 0, P, 56, "", M),
        txt(12, 34, "Summary · 31 Jul", 14, "l", "bold"),
        txt(P - 12, 34, "☰", 16, "r"),
        box(8, 64, P - 16, 48, "Computed 14:02 · ⚠ pending sync in range", M, align="l", size=10),
    ]
    e += rows(8, 122, P - 16, 46, [
        "GROSS                 ₱46,180.00   ▲6.2%",
        "− DISCOUNTS            ₱1,240.00   ▲18%",
        "− OVERRIDES              ₱180.00   ▼40%",
        "− REFUNDS                ₱620.00   ▲5%",
        ("= NET                 ₱44,140.00   ▲5.4%", S),
        "ORDERS                        214   ▲3.1%",
        "AVERAGE ORDER            ₱206.26   ▲2.2%",
    ], gap=6, align="l", size=11)
    e += [
        box(8, 486, P - 16, 44, "VAT (12%) ₱4,729.29  —  absent entirely if VAT is off",
            D, dash=1, align="l", size=10),
        txt(10, 566, "Sales by hour", 12, "l", "bold"),
        box(8, 574, P - 16, 140, "", W),
    ]
    for i, h in enumerate([20, 40, 90, 120, 105, 50, 32, 44, 80]):
        e.append(box(18 + i * 40, 704 - h, 28, h, "", S))
    e += [box(8, 730, P - 16, 96, "Same figures as a table below the chart.\n"
                                  "Tapping any of them opens the Orders list.", D, dash=1, align="l", size=11)]
    out.append(screen("backoffice/reports-summary-390.svg", P, PH, "Back-office · Sales summary", PHONE, e, notes=[
        "The waterfall stacks; NET stays emphasised because it is the answer.",
        "This is the owner checking the day from their phone at 9pm — and it is the landing page.",
    ]))

    # ---------------------------------------------------------- reports: orders
    e = shell("Orders", "Orders", "31 Jul 2026 · 214 orders · ₱46,180.00")
    e += [
        box(264, 88, 200, 36, "▾  All stores", W, align="l", size=11),
        box(474, 88, 210, 36, "▾  31 Jul 2026", W, align="l", size=11),
        box(694, 88, 150, 36, "▾  All cashiers", W, align="l", size=11),
        box(854, 88, 150, 36, "▾  All devices", W, align="l", size=11),
        box(1014, 88, 170, 36, "▾  All methods", W, align="l", size=11),
        box(1194, 88, 222, 36, "Search order no.…", W, align="l", size=11),
    ]
    for i, (t, f) in enumerate([("All 214", S), ("Sales 207", W), ("Refunds 3", W), ("Voids 4", W)]):
        e.append(box(264 + i * 124, 134, 114, 32, t, f, size=11))
    e += [box(X - 24 - 230, 134, 230, 32, "Export ▾  order / order-line", W, size=11)]
    e += table(264, 180, 740,
               ["TIME", "ORDER", "CASHIER", "METHOD", "LINES", "TOTAL", "STATE"],
               [["12:41", "C2-0421", "Ana", "Cash", "3", "₱285.00", "paid"],
                ["12:38", "C2-0420", "Ana", "GCash", "1", "₱120.00", "paid"],
                ["12:35", "C1-0388", "Dina", "Cash", "5", "₱610.00", "paid · Senior/PWD"],
                ["12:31", "C2-0419", "Ana", "Cash", "2", "₱175.00", "REFUNDED · Boy"],
                ["12:26", "C2-0418", "Ana", "Card", "4", "₱480.00", "paid"],
                ["12:22", "C1-0387", "Dina", "Cash", "1", "₱15.00", "VOIDED · Boy"],
                ["12:19", "C1-0386", "Dina", "Maya", "3", "₱330.00", "paid"],
                ["12:14", "C2-0417", "Ana", "Cash", "2", "₱240.00", "paid · override"]],
               rh=32, colw=[80, 110, 100, 110, 60, 110, 170])
    e += [
        box(264, 476, 740, 34, "…paged. A range with no page limit is the cheapest denial-of-service here.",
            D, dash=1, size=11),
        box(1020, 180, 396, 400, "C1-0388   ·   12:35   ·   Dina\nMalabon · Counter 1 · session 07-31 07:02\n"
                                 "\n"
                                 "Adobo · Whole  ×2            ₱240.00\n"
                                 "  + Extra rice ×1             ₱15.00\n"
                                 "Munggo · Half  ×1             ₱55.00\n"
                                 "Rice           ×2             ₱30.00\n"
                                 "Softdrink      ×1             ₱45.00\n"
                                 "                        ───────────\n"
                                 "Subtotal                    ₱385.00\n"
                                 "Senior/PWD 20%              −₱77.00\n"
                                 "  ref: SC-0099213 (Senior ID)\n"
                                 "VAT — exempt on this sale         —\n"
                                 "                        ───────────\n"
                                 "TOTAL                       ₱308.00\n"
                                 "Cash · tendered ₱500 · change ₱192\n"
                                 "\n"
                                 "Recorded prices. Never re-priced.", W, align="l", size=11),
        box(1020, 596, 396, 176, "No cancel. No edit. No delete.\n\n"
                                 "A paid Order is reversed by a Void or a\n"
                                 "Refund taken at the terminal, each with a\n"
                                 "reason and an approving manager.\n\n"
                                 "A comparable product lets the back-office\n"
                                 "make a row disappear. This one does not.",
            D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/reports-orders-1440.svg", X, Y, "Back-office · Orders", DESK, e, notes=[
        "The drill target for every other report. Arriving from a figure lands here with filters applied.",
        "Reversal state and its approver are in the ROW — not something you find by opening it.",
        "Two export shapes: one row per Order (register) and one row per OrderLine (what a bookkeeper wants).",
        "A discount reference is a real person's ID number. Shown here, never logged.",
        "The method column disappears entirely for a cash-only tenant.",
    ]))

    # --------------------------------------------------------- reports: by item
    e = shell("By item", "Sales by item", "31 Jul 2026 · all stores")
    e += [
        box(264, 88, 230, 40, "▾  All stores", W, align="l", size=12),
        box(506, 88, 260, 40, "▾  31 Jul 2026", W, align="l", size=12),
        box(778, 88, 250, 40, "▾  All day", W, align="l", size=12),
        box(X - 24 - 160, 88, 160, 40, "Export CSV", W, size=12),
    ]
    e += table(264, 148, X - 288, ["VARIANT", "CATEGORY", "QTY", "GROSS", "DISCOUNTS", "REFUNDS", "NET"],
               [["▾ Adobo", "Ulam", "88", "₱10,560", "₱420", "₱0", "₱10,140"],
                ["   Munggo", "Ulam", "64", "₱7,040", "₱180", "₱110", "₱6,750"],
                ["   Rice", "Rice", "201", "₱3,015", "₱0", "₱0", "₱3,015"],
                ["   Softdrinks", "Drinks", "97", "₱3,395", "₱0", "₱45", "₱3,350"]],
               rh=34, colw=[300, 200, 120, 180, 180, 160, 12])
    e += [
        box(264, 320, X - 288, 150,
            "Adobo — expanded\n\n"
            "  Modifiers      Whole 61  (69%)   ·   Half 27  (31%)\n"
            "  Add-ons        Extra rice 44 (50% attach)   ·   Itlog 12 (14% attach)\n\n"
            "  For a carinderia this is a PREP decision — how much to cook whole versus half — not analytics.",
            W, align="l", size=12),
        box(264, 496, 700, 96, "No standalone modifier report and no standalone add-on report.\n"
                               "Both are breakdowns inside this one. Neither earns a nav entry.",
            D, dash=1, align="l", size=12),
        box(988, 496, 420, 96, "Gross profit and margin do not appear.\n"
                               "DeanPOS knows prices, not costs.", D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/reports-by-item-1440.svg", X, Y, "Back-office · Sales by item", DESK, e, notes=[
        "A Variant row expands to its Modifier split and Add-on attach rate.",
        "The DISCOUNTS column is absent for a tenant with none configured.",
        "Every row links into the Orders list filtered to that Variant.",
    ]))

    # --------------------------------------------------------------- discounts
    e = shell("Discounts", "Discounts", "tenant-wide · 3 configured")
    e += [box(X - 24 - 170, 88, 170, 40, "+ New discount", S, size=12)]
    e += table(264, 148, X - 288,
               ["NAME", "TYPE", "VALUE", "SCOPE", "VAT-EXEMPT", "REFERENCE", "MANAGER", "STATUS"],
               [["Senior citizen / PWD", "percent", "20%", "line", "YES", "required · Senior ID", "no", "live"],
                ["Staff meal", "percent", "50%", "order", "no", "—", "yes", "live"],
                ["Goodwill", "amount", "(prompt)", "order", "no", "—", "yes", "live"],
                ["Fiesta 2025", "percent", "10%", "order", "no", "—", "no", "archived"]],
               rh=34, colw=[280, 140, 140, 120, 140, 240, 120, 12])
    e += [
        box(264, 336, 700, 300, "New discount\n\n"
                                "Name          [ Senior citizen / PWD          ]\n"
                                "Type          (•) percent   ( ) amount\n"
                                "Value         [ 20 ] %      □ leave blank — prompt the cashier\n"
                                "Scope         (•) one line  ( ) whole order\n"
                                "              amount discounts are whole-order only\n\n"
                                "□ Requires a manager\n"
                                "☑ VAT-exempt — removes VAT from this sale\n"
                                "☑ Requires a reference   label [ Senior ID     ]\n\n"
                                "                                   [ Archive ]  [ Save ]",
            W, align="l", size=12),
        box(988, 336, 420, 148, "This is not a promotions engine: no\n"
                                "conditions, no schedules, no codes, no\n"
                                "BOGO, no segments, no stacking rules.\n"
                                "A person applies one, on purpose,\n"
                                "every time.\n\n"
                                "Archived, never deleted — an Order from\n"
                                "March still references it.",
            D, dash=1, align="l", size=12),
        txt(988, 516, "EMPTY STATE — what every new tenant sees", 12, "l", "bold"),
        box(988, 526, 420, 110, "No discounts configured.\n\n"
                                "Add one if your shop gives a senior\n"
                                "citizen or staff discount.\n\n"
                                "            [ + New discount ]", W, align="l", size=12),
        box(988, 648, 420, 88, "Not an edge case — this is the DEFAULT, and the\n"
                               "configuration most tenants will keep. The terminal\n"
                               "shows no discount control at all in this state.",
            M, align="l", size=11),
    ]
    out.append(screen("backoffice/discounts-1440.svg", X, Y, "Back-office · Discounts", DESK, e, notes=[
        "Optional. Empty list is the default and a complete configuration.",
        "VAT-exempt is what makes the statutory Senior/PWD case correct rather than approximate.",
        "The reference label is tenant-set because staff call it different things.",
        "A manual price override is NOT a Discount and stays a separate, manager-gated thing.",
    ]))

    # -------------------------------------------------------- settings · sales
    e = shell("Settings", "Settings — sales", "Aling Nena's")
    e += [
        box(264, 100, 560, 260, "VAT\n\n"
                                "□  This business is VAT-registered        ← OFF by default\n"
                                "   Rate  [ 12 ] %\n\n"
                                "A price is always what the customer pays.\n"
                                "VAT is never ADDED — where enabled it is backed out\n"
                                "of the recorded total for receipts and reports.\n\n"
                                "Turning this on affects sales from now on. Last month\n"
                                "stays as last month was sold.", W, align="l", size=12),
        box(848, 100, 560, 260, "Most carinderias sit below the ₱3,000,000\nregistration threshold and are not\n"
                                "VAT-registered.\n\n"
                                "Shipping VAT ON by default would hand those\n"
                                "tenants figures that are confidently wrong and\n"
                                "a receipt implying a registration they do not\n"
                                "hold.\n\n"
                                "So: off, until an owner says otherwise.",
            D, dash=1, align="l", size=12),
        txt(264, 410, "Payment methods", 14, "l", "bold"),
        box(X - 24 - 190, 388, 190, 36, "+ Add method", S, size=12),
    ]
    e += table(264, 424, X - 288, ["METHOD", "KIND", "MALABON", "CUBAO", "STATUS", ""],
               [["Cash", "cash", "[ ON ]", "[ ON ]", "always on", "— cannot be renamed or removed"],
                ["GCash", "recorded", "[ ON ]", "[ ON ]", "live", "rename  deactivate"],
                ["Maya", "recorded", "[ ON ]", "[ OFF ]", "live", "rename  deactivate"],
                ["Card", "recorded", "[ OFF ]", "[ ON ]", "live", "rename  deactivate"],
                ["Bank transfer", "recorded", "[ OFF ]", "[ OFF ]", "deactivated", "reactivate"]],
               rh=32, colw=[240, 160, 140, 140, 180, 12])
    e += [
        box(264, 632, 700, 140, "A new tenant starts with CASH ONLY.\n\n"
                                "Only cash reaches the drawer. Every other method RECORDS AN AMOUNT\n"
                                "and authorises nothing — no gateway, no QR, no settlement.\n"
                                "The name is captured on the sale, so renaming one never rewrites history.",
            W, align="l", size=12),
        box(988, 632, 420, 140, "Code branches on KIND, never on a name.\n\n"
                                "That is what keeps expected cash correct\n"
                                "when a tenant adds a method nobody\n"
                                "anticipated.", D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/settings-sales-1440.svg", X, Y, "Back-office · Sales settings", DESK, e, notes=[
        "VAT, payment methods, and the Variance tolerance are Tenant settings; admin only, and audited.",
        "A setting governs sales from now on. The value in force is captured on each sale.",
        "Cash is seeded at tenant creation and is undeletable — enforced by a database constraint.",
        "The Discount list is not here; it is back-office CRUD alongside the catalog.",
    ]))

    # ------------------------------------------------------------------ roster
    e = shell("Roster", "Roster — week of 3 Aug 2026", "Malabon · DRAFT")
    e += [
        box(264, 88, 240, 40, "▾  Store: Malabon", W, align="l", size=12),
        box(520, 88, 280, 40, "◀   3–9 Aug 2026   ▶", W, size=12),
        box(816, 88, 200, 40, "Copy last week", W, size=12),
        box(X - 24 - 380, 88, 180, 40, "DRAFT — not visible to staff", M, size=11),
        box(X - 24 - 190, 88, 190, 40, "PUBLISH WEEK", S, size=13),
    ]
    days = ["MON 3", "TUE 4", "WED 5", "THU 6", "FRI 7", "SAT 8", "SUN 9"]
    cw = (X - 288 - 160) / 7
    e += [box(264, 148, 160, 40, "", M)]
    for i, d in enumerate(days):
        e.append(box(424 + i * cw, 148, cw, 40, d, M, size=12))
    staff = ["Ana", "Boy", "Cris", "Dina", "(unassigned)"]
    cells = [
        ["06:30–15:00", "06:30–15:00", "", "06:30–15:00", "06:30–15:00", "", ""],
        ["14:30–23:00", "", "14:30–23:00", "14:30–23:00", "", "10:00–19:00", ""],
        ["", "14:30–23:00", "06:30–15:00", "", "14:30–23:00", "14:30–23:00", ""],
        ["", "", "", "", "06:30–15:00", "06:30–15:00", "06:30–15:00"],
        ["", "", "", "", "", "", "14:30–23:00"],
    ]
    for r, name in enumerate(staff):
        ry = 188 + r * 84
        e.append(box(264, ry, 160, 84, name, D, align="l", size=12))
        for c in range(7):
            v = cells[r][c]
            e.append(box(424 + c * cw, ry, cw, 84, v, W if v else D, size=11))
    e += [
        box(264, 620, 700, 150, "Before publishing\n\n"
                                "⚠ Cris is rostered Wed 06:30–15:00 at Malabon and Cubao — overlap\n"
                                "⚠ Sunday 9 Aug evening is unassigned\n"
                                "⛔ Dina is deactivated — cannot be rostered\n\n"
                                "Warnings while drafting. Overlaps block publish.", W, align="l", size=12),
        box(988, 620, 420, 150, "Publish means VISIBLE.\n\nNobody is notified — DeanPOS has no\n"
                                "email or SMS transport, by decision.", D, dash=1, align="l", size=12),
    ]
    out.append(screen("backoffice/roster-1440.svg", X, Y, "Back-office · Roster", DESK, e, notes=[
        "A Shift is rostered work. It is NOT a DrawerSession, and v1 does not link them.",
        "Copy last week is the primary way a roster gets built.",
        "Overlap detection spans Stores — the failure is a person in two places.",
        "An unassigned row is legitimate: coverage laid out before people are chosen.",
    ]))

    e = [
        box(0, 0, P, 56, "", M),
        txt(12, 34, "My schedule", 14, "l", "bold"),
        txt(P - 12, 34, "☰", 16, "r"),
        box(8, 64, P - 16, 34, "Ana · Malabon · Asia/Manila", W, align="l", size=11),
    ]
    e += rows(8, 110, P - 16, 74, [
        "MON 3 Aug        06:30 – 15:00\nMalabon · opening — collect delivery",
        "TUE 4 Aug        06:30 – 15:00\nMalabon",
        "THU 6 Aug        06:30 – 15:00\nMalabon",
        "FRI 7 Aug        06:30 – 15:00\nMalabon",
    ], gap=8, align="l", size=11)
    e += [box(8, 450, P - 16, 70, "You see only your own Shifts.\nUnpublished weeks are not shown at all.",
              D, dash=1, align="l", size=11)]
    out.append(screen("backoffice/roster-mine-390.svg", P, PH, "Back-office · My schedule", PHONE, e, notes=[
        "A cashier's entire back-office surface: their own published Shifts, nothing else.",
    ]))

    return out
