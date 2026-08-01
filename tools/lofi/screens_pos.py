"""POS terminal (apps/pos) — tablet landscape 1280x800 and phone 390x844."""

from lofi import D, M, S, W, box, grid, ln, rows, screen, table, txt

T, TH = 1280, 800
P, PH = 390, 844
TABLET = "pos · tablet landscape 1280x800"
PHONE = "pos · phone 390x844"


def topbar(w, h=56, offline=True):
    return [
        box(0, 0, w, h, "", M),
        txt(14, h / 2 + 5, "DeanPOS · Malabon · Counter 2", 13),
        box(w / 2 - 110, 12, 220, h - 24, "OFFLINE · 3 queued" if offline else "ONLINE · synced", S, size=12),
        txt(w - 14, h / 2 + 5, "Ana (cashier)  ·  Lock", 13, "r"),
    ]


def build():
    out = []

    # ---------------------------------------------------------------- sale grid
    e = topbar(T)
    e += [box(0, 56, 180, TH - 56, "", D)]
    e += rows(10, 68, 160, 52, ["All", ("Ulam", S), "Rice", "Drinks", "Sides", "Extras"], gap=8)
    e += [
        box(190, 68, 560, 44, "Search menu…", W, align="l"),
        box(760, 68, 160, 44, "Tickets · 3", W, size=12),
    ]
    e += grid(190, 124, 232, 150, 3, [
        "Ulam\n₱120–", "Rice\n₱15", "Pancit\n₱90", "Lumpia\n₱60",
        "Softdrinks\n₱35", "Water\n₱20", "Itlog\n₱20",
    ], gx=17, gy=14)
    e += [
        box(190 + 249, 124 + 328, 232, 150, "Munggo\nSOLD OUT", M),
        box(190 + 498, 124 + 328, 232, 150, "Turon\n₱15", W),
    ]
    e += [
        box(930, 56, 350, TH - 56, "", D),
        box(940, 68, 330, 40, "Order C2-0421", M),
    ]
    e += rows(940, 118, 330, 74, [
        "Adobo · Whole  ×1\n+ Extra rice ×1              ₱135",
        "Munggo · Half  ×2                    ₱140",
        "Softdrinks  ×1                        ₱35",
    ], gap=8, align="l", size=12)
    e += [
        txt(940, 400, "How it's going out — optional", 11),
        box(940, 408, 160, 38, "Dine in", S, size=12),
        box(1110, 408, 160, 38, "Take out", W, size=12),
        box(940, 452, 160, 38, "Delivery", W, size=12),
        box(1110, 452, 160, 38, "Pick up", W, size=12),
        box(940, 502, 330, 44, "Set aside as a ticket…", W, size=12),
        box(940, 560, 330, 30, "Subtotal                        ₱310", W, align="l", size=12),
        box(940, 592, 330, 30, "VAT included (12%)         ₱33.21", W, align="l", size=12),
        box(940, 624, 330, 44, "TOTAL                            ₱310", M, align="l"),
        box(940, 678, 160, 46, "Clear", W),
        box(1110, 678, 160, 46, "Manager", W),
        box(940, 734, 330, 54, "PAY  ₱310", S, size=16),
    ]
    out.append(screen("pos/sale-grid-1280.svg", T, TH, "POS · Sale screen", TABLET, e, notes=[
        "Cart is a persistent right column at this width — not a sheet.",
        "Unavailable Variants render but are not tappable (Munggo tile).",
        "Search filters tiles in place; no separate results screen.",
        "Order number is device-assigned and visible before payment.",
        "TICKETS COUNT is visible from the sale screen — an order set aside is never out of sight.",
        "The fulfilment tag is OPTIONAL and v1 acts on it nowhere: no fee, no routing, no pricing (ADR-0011).",
        "Set aside labels the draft and clears the cart for the next customer. It is not a void and writes nothing.",
    ]))

    # phone sale grid
    e = topbar(P, 48)
    e += [box(8, 56, P - 16, 40, "Search menu…", W, align="l", size=12)]
    e += [box(8 + i * 92, 104, 86, 34, t, S if i == 1 else W, size=11)
          for i, t in enumerate(["All", "Ulam", "Rice", "Drinks"])]
    e += grid(8, 148, 183, 120, 2, [
        "Ulam\n₱120–", "Rice\n₱15", "Pancit\n₱90", "Lumpia\n₱60",
        "Softdrinks\n₱35", "Water\n₱20", "Itlog\n₱20", "Munggo\nSOLD OUT",
    ], gx=8, gy=8, size=12)
    e += [
        box(0, PH - 76, P, 76, "", M),
        txt(14, PH - 44, "3 items · ₱310", 14, "l", "bold"),
        txt(14, PH - 24, "tap to open cart  ▲", 11),
        box(P - 130, PH - 64, 120, 52, "PAY", S, size=15),
    ]
    out.append(screen("pos/sale-grid-390.svg", P, PH, "POS · Sale screen", PHONE, e, notes=[
        "Cart becomes a bottom sheet — same lines, same order, different container.",
        "Two tile columns. Tile content and order match the tablet exactly.",
        "PAY stays reachable one-handed at the bottom.",
    ]))

    # ------------------------------------------------------------ cart (phone)
    e = topbar(P, 48, offline=False)
    e += [
        box(0, 56, P, 44, "Order C2-0421", M),
        box(P / 2 - 30, 104, 60, 6, "", S, r=3),
    ]
    e += rows(8, 120, P - 16, 96, [
        "Adobo · Whole            ₱120\n+ Extra rice ×1            ₱15\n[ − ]  1  [ + ]              ₱135   ✕",
        "Munggo · Half  ₱70       ₱140\n[ − ]  2  [ + ]                      ✕",
        "Softdrinks                ₱35\n[ − ]  1  [ + ]                      ✕",
    ], gap=8, align="l", size=11)
    e += [
        box(8, 440, P - 16, 28, "Subtotal                                 ₱310", W, align="l", size=11),
        box(8, 472, P - 16, 28, "VAT included (12%)                  ₱33.21", W, align="l", size=11),
        box(8, 504, P - 16, 40, "TOTAL                                     ₱310", M, align="l"),
        box(8, 556, 175, 44, "Clear order", W, size=12),
        box(191, 556, 191, 44, "Manager…", W, size=12),
        box(8, PH - 76, P - 16, 60, "PAY  ₱310", S, size=16),
    ]
    out.append(screen("pos/cart-390.svg", P, PH, "POS · Cart sheet", PHONE, e, notes=[
        "Sheet over the grid; the grid stays mounted behind it.",
        "Line edits (quantity, remove) exist only before payment.",
        "'Clear order' asks for confirmation when the cart is non-empty.",
    ]))

    # ----------------------------------------------------------- variant grid
    e = topbar(T)
    e += [box(0, 56, 180, TH - 56, "", D)]
    e += rows(10, 68, 160, 52, ["All", ("Ulam", S), "Rice", "Drinks", "Sides", "Extras"], gap=8)
    e += [
        box(190, 68, 730, 44, "‹  Ulam  —  choose a variant", M, align="l"),
    ]
    e += grid(190, 124, 232, 150, 3, [
        "Adobo\n₱120", "Munggo\n₱110", "Menudo\n₱130", "Bistek\n₱140",
        "Ginataan\n₱115", "Kaldereta\n₱145", "Sisig\n₱150", "Tinola\n₱120",
    ], gx=17, gy=14)
    e += [
        box(190 + 498, 124 + 328, 232, 150, "Pinakbet\nSOLD OUT", M),
        box(190, 124 + 492, 730, 60, "…scrolls — the grid is not capped", W, dash=1, size=12),
    ]
    e += [
        box(930, 56, 350, TH - 56, "", D),
        box(940, 68, 330, 40, "Order C2-0421", M),
        box(940, 118, 330, 240, "cart, unchanged\n(still visible while drilling in)", W, dash=1, size=12),
        box(940, 624, 330, 44, "TOTAL                            ₱310", M, align="l"),
        box(940, 734, 330, 54, "PAY  ₱310", S, size=16),
    ]
    out.append(screen("pos/variant-grid-1280.svg", T, TH, "POS · Variant grid (drill-down)", TABLET, e, notes=[
        "Tapping a MenuItem replaces the tile grid in place — same grid, one level down.",
        "This is why Variants are a grid and not a list in a modal: there can be a dozen, and this scrolls.",
        "The cart stays visible; drilling in is not a mode the cashier can get lost in.",
        "'‹ Ulam' returns to the top-level grid. Choosing a category also exits the drill-down.",
        "A MenuItem with exactly one Variant SKIPS this screen entirely.",
    ]))

    e = topbar(P, 48)
    e += [box(8, 56, P - 16, 40, "‹  Ulam — choose a variant", M, align="l", size=12)]
    e += grid(8, 104, 183, 116, 2, [
        "Adobo\n₱120", "Munggo\n₱110", "Menudo\n₱130", "Bistek\n₱140",
        "Ginataan\n₱115", "Kaldereta\n₱145",
    ], gx=8, gy=8, size=12)
    e += [
        box(8, 476, 183, 116, "Sisig\n₱150", W, size=12),
        box(199, 476, 183, 116, "Pinakbet\nSOLD OUT", M, size=12),
        box(8, 600, P - 16, 40, "…scrolls", W, dash=1, size=11),
        box(0, PH - 76, P, 76, "", M),
        txt(14, PH - 44, "3 items · ₱310", 14, "l", "bold"),
        box(P - 130, PH - 64, 120, 52, "PAY", S, size=15),
    ]
    out.append(screen("pos/variant-grid-390.svg", P, PH, "POS · Variant grid (drill-down)", PHONE, e, notes=[
        "Same drill-down, two columns. The list scrolls; nothing is capped.",
    ]))

    # --------------------------------------------------- modifier / add-on modal
    dw, dh = 640, 520
    dx, dy = (T - dw) / 2, (TH - dh) / 2
    e = topbar(T) + [box(0, 56, T, TH - 56, "", D, dash=1)]
    e += [
        box(dx, dy, dw, dh, "", W),
        txt(dx + 16, dy + 34, "Adobo   ₱120", 16, "l", "bold"),
        txt(dx + 16, dy + 56, "Ulam  ›  Adobo", 11),
        txt(dx + 16, dy + 92, "Size — choose exactly one (required)", 12),
        box(dx + 16, dy + 104, (dw - 42) / 2, 52, "( • ) Whole   ×1.0", S, align="l", size=13),
        box(dx + 26 + (dw - 42) / 2, dy + 104, (dw - 42) / 2, 52, "(   ) Half    ×0.5", W, align="l", size=13),
        txt(dx + 16, dy + 190, "Add-ons — optional, up to each item's max", 12),
        box(dx + 16, dy + 202, dw - 32, 44, "[✓] Extra rice   +₱15        [ − ]  1  [ + ]   max 3", W, align="l", size=12),
        box(dx + 16, dy + 252, dw - 32, 44, "[ ] Itlog        +₱20        [ − ]  0  [ + ]   max 2", W, align="l", size=12),
        txt(dx + 16, dy + 326, "Quantity", 12),
        box(dx + 16, dy + 338, 180, 52, "[ − ]   1   [ + ]", W, size=14),
        box(dx + 16, dy + dh - 68, 180, 52, "Cancel", W),
        box(dx + dw - 300, dy + dh - 68, 284, 52, "Add to order  ₱135", S, size=15),
    ]
    out.append(screen("pos/modifier-picker-1280.svg", T, TH, "POS · Modifiers and add-ons", TABLET, e, notes=[
        "The Variant is already chosen — this modal carries options only, so it stays small.",
        "A required group cannot be skipped; the primary action is disabled until it is satisfied.",
        "Add-on quantity is bounded by its configured max — the stepper stops, it does not warn.",
        "The running price updates in the primary action label as choices change.",
        "A Variant with no modifier groups and no add-ons SKIPS this modal — it goes straight to the cart.",
    ]))

    e = topbar(P, 48) + [
        box(0, 48, P, 46, "Adobo   ₱120", M, align="l", size=13),
        txt(10, 118, "Size — choose one (required)", 11),
        box(8, 126, (P - 22) / 2, 50, "( • ) Whole", S, size=12),
        box(14 + (P - 22) / 2, 126, (P - 22) / 2, 50, "(   ) Half", W, size=12),
        txt(10, 206, "Add-ons", 11),
        box(8, 214, P - 16, 42, "[✓] Extra rice +₱15   [−] 1 [+]", W, align="l", size=11),
        box(8, 262, P - 16, 42, "[ ] Itlog      +₱20   [−] 0 [+]", W, align="l", size=11),
        txt(10, 340, "Quantity", 11),
        box(8, 348, 160, 48, "[ − ]  1  [ + ]", W, size=13),
        box(8, PH - 140, P - 16, 44, "Cancel", W, size=12),
        box(8, PH - 84, P - 16, 60, "Add to order  ₱135", S, size=15),
    ]
    out.append(screen("pos/modifier-picker-390.svg", P, PH, "POS · Modifiers and add-ons", PHONE, e, notes=[
        "Fits without scrolling in the common case, because the Variant list is no longer in here.",
        "Actions pinned to the bottom.",
    ]))

    # ------------------------------------------------------------------ payment
    e = topbar(T)
    e += [
        txt(40, 92, "Amount due", 12),
        box(40, 100, 290, 116, "₱308.00", M, size=30),
        txt(620, 92, "Payment method", 12, "r"),
        box(346, 100, 132, 54, "Cash", S, size=13),
        box(488, 100, 132, 54, "GCash ⬤", W, size=13),
        box(346, 162, 132, 54, "Maya ⬤", W, size=13),
        box(488, 162, 132, 54, "Card", W, size=13),
        txt(40, 250, "Tendered  —  cash only", 13),
        box(40, 262, 580, 84, "₱ 500", W, size=26),
    ]
    e += grid(40, 396, 108, 60, 5, ["₱100", "₱200", "₱500", "₱1000", "Exact"], gx=10)
    e += [
        box(40, 474, 580, 84, "CHANGE\n₱192.00", W, size=24),
        box(40, 578, 580, 118, "Keypad, quick tender, and change are CASH-ONLY controls.\n"
                               "A recorded tender asks for one amount and nothing else.\n"
                               "\n"
                               "A recorded tender authorises nothing — no gateway,\n"
                               "no QR, no settlement.",
            D, dash=1, align="l", size=11),
        box(40, 712, 285, 52, "Back to order", W, size=13),
        box(660, 96, 580, 424, "Order summary  (read-only)\n\n"
                               "Adobo · Whole  ×2                     ₱240.00\n"
                               "  + Extra rice ×1                      ₱15.00\n"
                               "Munggo · Half  ×1                      ₱55.00\n"
                               "Rice           ×2                      ₱30.00\n"
                               "Softdrink      ×1                      ₱45.00\n"
                               "                                ─────────────\n"
                               "Subtotal                              ₱385.00\n"
                               "Senior citizen / PWD 20%              −₱77.00\n"
                               "  ref SC-0099213 (Senior ID)\n"
                               "VAT — exempt on this sale                   —\n"
                               "                                ─────────────\n"
                               "AMOUNT DUE                            ₱308.00",
            W, align="l", size=12),
        box(660, 548, 580, 216, "COMPLETE SALE", S, size=22),
    ]
    out.append(screen("pos/payment-1280.svg", T, TH, "POS · Payment", TABLET, e, notes=[
        "METHOD SITS AT THE TOP, level with the amount due. How are you paying is asked BEFORE the keypad, not after.",
        "The method row is the TENANT'S list. A cash-only tenant — the default — sees no chooser at all.",
        "GCASH AND MAYA CARRY THEIR OWN MARK AND BRAND COLOUR — GCash blue, Maya black. Every other method is a plain chip.",
        "Those marks come from each provider's OFFICIAL BRAND KIT. Never redrawn, never a colour eyeballed from a screenshot.",
        "Branding must not imply an integration. The authorises-nothing copy stays exactly where it is, for that reason.",
        "Only cash asks for a tendered amount and computes change. A recorded tender is a typed amount, no change.",
        "Nothing here authorises anything. The copy must make that unmistakable or a tenant will assume otherwise.",
        "Cash below the total cannot complete — the primary action is disabled, not warned after.",
        "The VAT and discount lines are both conditional. Neither renders as a zero when absent.",
        "COMPLETE SALE is idempotent on the order UUID: a double tap yields one sale.",
        "Back to order returns to the cart with the basket intact — it is not a void.",
    ]))

    e = topbar(P, 48) + [
        box(8, 56, 180, 88, "AMOUNT DUE\n₱308.00", M, size=20),
        txt(196, 72, "Payment method", 10),
        box(196, 80, 88, 30, "Cash", S, size=11),
        box(290, 80, 92, 30, "GCash ⬤", W, size=11),
        box(196, 114, 88, 30, "Maya ⬤", W, size=11),
        box(290, 114, 92, 30, "Card", W, size=11),
        txt(10, 168, "Tendered  —  cash only", 11),
        box(8, 176, P - 16, 62, "₱ 500", W, size=24),
    ]
    e += grid(8, 250, 70, 44, 5, ["100", "200", "500", "1000", "Exact"], gx=8, size=11)
    e += [box(8, 306, P - 16, 68, "CHANGE\n₱192.00", W, size=20)]
    e += [
        box(8, 388, P - 16, 44, "cash-only tenant: no chooser, and this row is not rendered",
            D, dash=1, size=10),
        box(8, 446, P - 16, 44, "keypad, quick tender, and change are cash-only controls",
            D, dash=1, size=10),
        box(8, 542, P - 16, 140, "Order summary (read-only)\n\n"
                                 "…lines…\nSubtotal            ₱385.00\n"
                                 "Senior/PWD 20%      −₱77.00\nVAT — exempt              —\n"
                                 "AMOUNT DUE          ₱308.00", W, align="l", size=11),
        box(8, PH - 148, P - 16, 44, "Back to order", W, size=12),
        box(8, PH - 92, P - 16, 68, "COMPLETE SALE", S, size=17),
    ]
    out.append(screen("pos/payment-390.svg", P, PH, "POS · Payment", PHONE, e, notes=[
        "Same order of sections as the tablet: method beside the amount due, at the TOP, before the keypad.",
        "Methods wrap to a 2×2 block at this width. GCash and Maya keep their mark and brand colour here too.",
        "Quick-tender row must stay reachable with the on-screen keypad open.",
    ]))

    # ----------------------------------------------------------------- tickets
    e = topbar(T) + [
        box(0, 56, T, TH - 56, "", D),
        txt(40, 108, "Open tickets on this terminal", 20, "l", "bold"),
        txt(40, 136, "3 open  ·  ₱905 not yet collected", 12),
        box(T - 40 - 240, 92, 240, 52, "New order", S, size=14),
    ]
    e += rows(40, 168, T - 80, 78, [
        "Table 4        4 items      ₱310      open 6 min          [ Resume ]   [ Discard ]",
        "Aling Nena     2 items      ₱175      open 14 min         [ Resume ]   [ Discard ]",
        "Red shirt      6 items      ₱420      open 31 min         [ Resume ]   [ Discard ]",
    ], gap=10, align="l", size=13)
    e += [
        box(40, 440, 600, 132, "A ticket is a DRAFT with a label.\n\n"
                               "It never leaves this terminal, appears in no report and\n"
                               "no total, and reaches the server only when it is paid.",
            D, dash=1, align="l", size=12),
        box(660, 440, 580, 132, "Discarding writes NOTHING — no record, no reversal.\n\n"
                                "A void is for a sale that happened. Nothing happened here.",
            D, dash=1, align="l", size=12),
        box(40, 600, T - 80, 88, "The drawer cannot be closed while any ticket is open.\n"
                                 "Pay it or discard it first — the close screen lists them with both actions.",
            M, align="l", size=13),
    ]
    out.append(screen("pos/tickets-1280.svg", T, TH, "POS · Open tickets", TABLET, e, notes=[
        "Reached from the sale screen's Tickets count. Empty state: this screen says so and offers New order.",
        "AGE IS SHOWN because a ticket open for 40 minutes is usually a customer who left.",
        "Resume opens the draft with its lines and its label intact. It is not a state transition.",
        "Tickets belong to THIS DEVICE. Another terminal shows none of these, by construction (ADR-0011).",
        "Sorted oldest first — the one most likely to be forgotten is at the top.",
    ]))

    e = topbar(P, 48) + [
        box(0, 48, P, 44, "Open tickets · 3", M),
    ]
    e += rows(8, 100, P - 16, 76, [
        "Table 4          4 items    ₱310\nopen 6 min      [ Resume ]  [ Discard ]",
        "Aling Nena       2 items    ₱175\nopen 14 min     [ Resume ]  [ Discard ]",
        "Red shirt        6 items    ₱420\nopen 31 min     [ Resume ]  [ Discard ]",
    ], gap=8, align="l", size=11)
    e += [
        box(8, 356, P - 16, 74, "Never leaves this terminal. In no report, no total,\n"
                                "and no drawer figure until it is paid.", D, dash=1, align="l", size=11),
        box(8, PH - 92, P - 16, 68, "New order", S, size=15),
    ]
    out.append(screen("pos/tickets-390.svg", P, PH, "POS · Open tickets", PHONE, e, notes=[
        "Same rows and same order as the tablet; actions stack inside the row.",
        "New order stays reachable one-handed at the bottom.",
    ]))

    # ------------------------------------------------------------------ tables
    e = topbar(T) + [
        box(0, 56, T, TH - 56, "", D),
        txt(40, 108, "Tables", 20, "l", "bold"),
        txt(40, 136, "Malabon · 3 of 8 tables occupied · 5 tickets open · ₱1,230 uncollected", 12),
        box(T - 40 - 240, 92, 240, 52, "New order", S, size=14),
    ]
    tiles = [
        ("Table 1\nfree", W), ("Table 2\nfree", W),
        ("Table 3\n4 items · ₱310\n6 min", S), ("Table 4\nfree", W),
        ("Table 5\n6 items · ₱420\n31 min", S), ("Table 6\nfree", W),
        ("Counter\n2 items · ₱175\n14 min", S), ("Takeout\nfree", W),
    ]
    for i, (t, f) in enumerate(tiles):
        c, r = i % 4, i // 4
        e.append(box(40 + c * 300, 176 + r * 150, 280, 130, t, f, size=13))
    e += [
        box(40, 500, T - 80, 34, "Other open tickets  —  labels typed at the counter", M,
            align="l", size=12),
    ]
    e += rows(40, 542, T - 80, 58, [
        "Aling Nena        3 items      ₱240      open 8 min       [ Resume ]  [ Move… ]  [ Discard ]",
        "Red shirt         1 item        ₱85      open 22 min      [ Resume ]  [ Move… ]  [ Discard ]",
    ], gap=8, align="l", size=12)
    e += [
        box(40, 676, T - 80, 96, "A TABLE IS A LABEL. Nothing is stored on it — occupied means "
                                 "an open ticket on this terminal carries that label.\n"
                                 "No floor plan, no seating, no covers, no turn time. This is the "
                                 "comparison product's predefined-ticket model (Loyverse §2.14), not a table-service system.",
            D, dash=1, align="l", size=12),
    ]
    out.append(screen("pos/tables-1280.svg", T, TH, "POS · Tables", TABLET, e, notes=[
        "SAME ROUTE AS `tickets-1280`, in the configuration where the Store HAS table labels. Not a second screen.",
        "With no table labels configured — the default — the grid is absent entirely and this is the plain ticket list.",
        "A free tile starts a new order already labelled. An occupied tile resumes its ticket.",
        "An occupied label is NOT offered when labelling another order — one open ticket per table (Loyverse §2.14.2).",
        "Occupancy is DERIVED from this Device's open tickets. Another terminal's tickets are invisible, so its tables read free.",
        "Move… changes a ticket's label. Split and merge are deliberately absent — both are shared-draft operations.",
    ]))

    # ------------------------------------------------------------ set aside
    dw, dh = 660, 470
    dx, dy = (T - dw) / 2, 56 + (TH - 56 - dh) / 2
    e = topbar(T) + [box(0, 56, T, TH - 56, "", D, dash=1), box(dx, dy, dw, dh, "", W)]
    e += [
        txt(dx + 16, dy + 36, "Set this order aside", 16, "l", "bold"),
        txt(dx + 16, dy + 62, "Order C2-0421 · 4 items · ₱310", 12),
        txt(dx + 16, dy + 100, "Table  —  this Store's list", 11),
    ]
    e += grid(dx + 16, dy + 110, 148, 44, 4,
              ["Table 1", "Table 2", "Table 4", "Table 6", "Takeout", "Table 7", "Table 8"],
              gx=8, gy=8, size=12)
    e += [txt(dx + 16, dy + 258, "Tables 3 and 5 and Counter are not listed — they already have a ticket", 11)]
    e += [
        box(dx + 16, dy + 268, dw - 32, 74, "Or type a label\n\n"
                                            "[ Aling Nena                                    ]",
            W, align="l", size=12),
        box(dx + 16, dy + dh - 68, (dw - 42) / 2, 52, "Cancel", W),
        box(dx + 26 + (dw - 42) / 2, dy + dh - 68, (dw - 42) / 2, 52, "Set aside", S),
    ]
    out.append(screen("pos/set-aside-1280.svg", T, TH, "POS · Set aside as a ticket", TABLET, e, notes=[
        "TABLE LIST IS OPTIONAL AND EMPTY BY DEFAULT. With no tables configured, only the free-text field renders.",
        "OCCUPIED LABELS ARE NOT OFFERED — one open ticket per table (Loyverse §2.14.2, ADR-0011).",
        "A table is a LABEL with no stored state. Occupied is derived from this Device's open tickets.",
        "A label may be a customer's name — it is personal data, shown and exported, never logged.",
        "Setting aside clears the cart for the next customer. It is not a void and writes nothing to the server.",
    ]))

    # ----------------------------------------------------------- discount picker
    dw, dh = 700, 560
    dx, dy = (T - dw) / 2, 56 + (TH - 56 - dh) / 2
    e = topbar(T) + [box(0, 56, T, TH - 56, "", D, dash=1), box(dx, dy, dw, dh, "", W)]
    e += [
        txt(dx + 16, dy + 36, "Apply a discount", 16, "l", "bold"),
        txt(dx + 16, dy + 62, "Order C2-0421 · subtotal ₱385.00", 12),
    ]
    e += rows(dx + 16, dy + 82, dw - 32, 52, [
        ("Senior citizen / PWD    20%    one line    VAT-exempt    needs Senior ID", S),
        "Staff meal              50%    whole order  manager required",
        "Goodwill             (prompt)  whole order  manager required",
    ], gap=8, align="l", size=12)
    e += [
        box(dx + 16, dy + 268, dw - 32, 92, "Senior ID  (required)\n\n"
                                            "[ SC-0099213                                    ]",
            W, align="l", size=12),
        box(dx + 16, dy + 372, dw - 32, 72, "Applies to which line?\n"
                                            "( • ) Adobo · Whole ×2    (   ) Munggo · Half ×1    (   ) Rice ×2",
            W, align="l", size=12),
        box(dx + 16, dy + dh - 68, (dw - 42) / 2, 52, "Cancel", W),
        box(dx + 26 + (dw - 42) / 2, dy + dh - 68, (dw - 42) / 2, 52, "Apply discount", S),
    ]
    out.append(screen("pos/discount-picker-1280.svg", T, TH, "POS · Discount picker", TABLET, e, notes=[
        "OPTIONAL SCREEN. A tenant with no Discounts configured has no discount control anywhere — this never renders.",
        "The list is the tenant's own. Nothing here is automatic, conditional, or scheduled: a person chooses it.",
        "A Discount requiring a reference cannot apply until the reference is entered. The label is tenant-set.",
        "A restricted Discount opens the manager override dialog before it applies.",
        "A line-scoped Discount asks which line. Amount discounts are whole-order only and skip that step.",
        "This is NOT the manual price override, which stays separate and always manager-gated.",
    ]))

    # ------------------------------------------------------------------ receipt
    e = topbar(T, offline=False)
    e += [
        box(340, 88, 600, 610, "", W),
        txt(640, 130, "SALE COMPLETE", 20, "c", "bold"),
        txt(640, 158, "Order C2-0421 · 2026-07-31 12:41", 12, "c"),
        txt(640, 180, "Malabon · Counter 2 · Ana", 12, "c"),
        box(360, 200, 560, 200, "Adobo · Whole  ×1                       ₱120\n"
                                "   + Extra rice ×1                       ₱15\n"
                                "Munggo · Half  ×2                       ₱140\n"
                                "Softdrinks  ×1                            ₱35",
            W, align="l", size=12),
        box(360, 412, 560, 128, "Subtotal                                 ₱310.00\n"
                                "Senior citizen / PWD 20%                 −₱62.00\n"
                                "VAT (12%)                                  ₱26.57\n"
                                "TOTAL                                       ₱248.00\n"
                                "Cash · tendered ₱500.00      change ₱252.00",
            M, align="l", size=12),
        box(360, 550, 560, 30, "the discount and VAT lines are each CONDITIONAL — absent, not zero",
            D, dash=1, size=11),
        box(360, 592, 270, 46, "Void order (manager)", W, size=12),
        box(650, 592, 270, 46, "Refund (manager)", W, size=12),
        box(360, 650, 560, 48, "NEW ORDER", S, size=17),
    ]
    out.append(screen("pos/receipt-1280.svg", T, TH, "POS · Receipt", TABLET, e, notes=[
        "On-screen only — there is no printer in v1.",
        "VAT is backed out of the total, never added — and only when the tenant is VAT-registered.",
        "A non-VAT tenant's receipt has no VAT line at all. It must not imply a registration they lack.",
        "A discount prints with its name; a VAT-exempt one removes the VAT line for that sale.",
        "Void and Refund are visible here but require a manager Override.",
        "NEW ORDER is one tap: the queue keeps moving.",
    ]))

    e = topbar(P, 48, offline=False) + [
        txt(P / 2, 92, "SALE COMPLETE", 17, "c", "bold"),
        txt(P / 2, 116, "C2-0421 · 12:41 · Ana", 11, "c"),
        box(8, 134, P - 16, 170, "Adobo · Whole ×1              ₱120\n"
                                 "  + Extra rice ×1               ₱15\n"
                                 "Munggo · Half ×2              ₱140\n"
                                 "Softdrinks ×1                    ₱35", W, align="l", size=11),
        box(8, 316, P - 16, 130, "VATable            ₱276.79\nVAT (12%)         ₱33.21\n"
                                 "TOTAL               ₱310.00\nTendered ₱500 · Change ₱190",
            M, align="l", size=11),
        box(8, 462, (P - 22) / 2, 44, "Void", W, size=11),
        box(14 + (P - 22) / 2, 462, (P - 22) / 2, 44, "Refund", W, size=11),
        box(8, PH - 92, P - 16, 68, "NEW ORDER", S, size=17),
    ]
    out.append(screen("pos/receipt-390.svg", P, PH, "POS · Receipt", PHONE, e))

    # -------------------------------------------------------- manager override
    dw, dh = 620, 700
    dx, dy = (T - dw) / 2, 56 + (TH - 56 - dh) / 2
    e = topbar(T) + [box(0, 56, T, TH - 56, "", D, dash=1), box(dx, dy, dw, dh, "", W)]
    e += [
        txt(dx + 16, dy + 36, "Manager approval required", 16, "l", "bold"),
        box(dx + 16, dy + 54, dw - 32, 56, "Void order C2-0421 · ₱310.00", M, align="l", size=13),
        txt(dx + 16, dy + 136, "Reason (required)", 12),
        box(dx + 16, dy + 148, dw - 32, 40, "▾  Rung up in error", W, align="l", size=12),
        box(dx + 16, dy + 196, dw - 32, 56, "Note (optional)", W, align="l", size=12),
        txt(dx + 16, dy + 282, "Manager PIN", 12),
        box(dx + 16, dy + 294, dw - 32, 46, "•  •  •  •", W, size=18),
    ]
    e += grid(dx + 16, dy + 352, (dw - 52) / 3, 52, 3,
              ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"], gx=10, gy=8, size=15)
    # keypad ends at dy+352+4*60-8 = dy+584; actions sit below it
    e += [
        box(dx + 16, dy + dh - 66, (dw - 42) / 2, 50, "Cancel", W),
        box(dx + 26 + (dw - 42) / 2, dy + dh - 66, (dw - 42) / 2, 50, "Approve", S),
    ]
    out.append(screen("pos/manager-override-1280.svg", T, TH, "POS · Manager override", TABLET, e, notes=[
        "One approval authorises one action; it is consumed on use.",
        "Works offline — the PIN is verified against the locally synced hash.",
        "Reason is required; it appears in reporting and in the audit row.",
        "Same dialog serves void, refund, manual price override, and drawer variance.",
        "Wrong PIN attempts are throttled on-device and the lockout survives a reload.",
    ]))

    # ---------------------------------------------------------------- PIN unlock
    e = [
        box(0, 0, T, TH, "", D),
        txt(T / 2, 90, "DeanPOS · Malabon · Counter 2", 15, "c", "bold"),
        box(T / 2 - 130, 110, 260, 34, "OFFLINE · 3 queued", S, size=12),
        txt(300, 200, "Who is on the till?", 13),
    ]
    e += grid(300, 216, 160, 90, 4, ["Ana", "Boy", "Cris", "Dina"], gx=14, size=14)
    e += [
        txt(300, 356, "PIN", 13),
        box(300, 368, 684, 60, "•  •  •  •", W, size=22),
    ]
    e += grid(300, 448, 220, 68, 3, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "UNLOCK"],
              gx=12, gy=10, size=18)
    e += [box(300, 760, 684, 30, "Too many attempts — locked for 2:00", M, dash=1, size=12)]
    out.append(screen("pos/pin-unlock-1280.svg", T, TH, "POS · PIN unlock", TABLET, e, notes=[
        "Works with no network — PIN hashes for this Store's users are held locally.",
        "Only users assigned to this Store appear.",
        "The lockout strip is the throttled state; it persists across a page reload.",
        "The Device is already enrolled — this screen identifies the person, not the terminal.",
    ]))

    e = [
        box(0, 0, P, PH, "", D),
        txt(P / 2, 70, "Malabon · Counter 2", 13, "c", "bold"),
        box(P / 2 - 100, 84, 200, 28, "OFFLINE · 3 queued", S, size=11),
    ]
    e += grid(8, 130, (P - 24) / 2, 70, 2, ["Ana", "Boy", "Cris", "Dina"], gx=8, gy=8, size=13)
    e += [box(8, 300, P - 16, 54, "•  •  •  •", W, size=20)]
    e += grid(8, 370, (P - 32) / 3, 62, 3, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "UNLOCK"],
              gx=8, gy=8, size=16)
    out.append(screen("pos/pin-unlock-390.svg", P, PH, "POS · PIN unlock", PHONE, e))

    # ----------------------------------------------------------- device enrolment
    e = [
        box(0, 0, T, TH, "", D),
        txt(T / 2, 140, "Enrol this terminal", 22, "c", "bold"),
        txt(T / 2, 172, "An admin generates a code in the back-office. It is single-use and short-lived.",
            12, "c"),
        txt(400, 250, "Enrolment code", 13),
        box(400, 262, 480, 70, "F 4 K 9  —  2 X 7 M", W, size=24),
        txt(400, 372, "Name this terminal", 13),
        box(400, 384, 480, 52, "Counter 2", W, align="l"),
        box(400, 462, 480, 74, "Store: Malabon\n(resolved from the code — not chosen here)", M, size=12),
        box(400, 566, 480, 64, "ENROL", S, size=17),
        box(400, 654, 480, 40, "Code expired or already used", W, dash=1, size=12),
    ]
    out.append(screen("pos/device-enrolment-1280.svg", T, TH, "POS · Device enrolment", TABLET, e, notes=[
        "Store comes from the code — never chosen on the device.",
        "Runs once per terminal; the resulting token survives restarts and outages.",
        "The dashed strip is the failure state: expired, consumed, or unknown code.",
    ]))

    # -------------------------------------------------------------- drawer open
    e = topbar(T)
    e += [
        txt(40, 100, "Open drawer session", 20, "l", "bold"),
        txt(40, 128, "Ana · Counter 2 · Malabon · 2026-07-31 06:58", 12),
        txt(40, 176, "Count the float", 13),
    ]
    denoms = ["₱1000", "₱500", "₱200", "₱100", "₱50", "₱20", "₱10", "₱5", "₱1"]
    e += [box(40, 190 + i * 46, 560, 40,
              f"{d}     [   0   ]  ×          =   ₱0.00", W, align="l", size=12)
          for i, d in enumerate(denoms)]
    e += [
        box(40, 190 + 9 * 46 + 10, 560, 54, "FLOAT TOTAL                                 ₱1,000.00", M, align="l", size=15),
        box(640, 176, 600, 300, "Why this exists\n\nEvery Order taken on this terminal belongs to\n"
                                "this drawer session. At close you count the drawer\n"
                                "and the difference is the Variance.", D, dash=1, size=13),
        box(640, 500, 600, 74, "OPEN SESSION", S, size=17),
        box(640, 596, 600, 60, "Selling is blocked until a session is open", W, dash=1, size=12),
    ]
    out.append(screen("pos/drawer-open-1280.svg", T, TH, "POS · Open drawer session", TABLET, e, notes=[
        "Denomination entry is a counting aid; the float is their sum and is not typed directly.",
        "Works offline.",
        "One open session per Device — a second attempt is refused by the database, not the UI.",
    ]))

    # ------------------------------------------------------------- drawer close
    e = topbar(T)
    e += [
        txt(40, 100, "Close drawer session — count the drawer", 20, "l", "bold"),
        txt(40, 128, "Ana · Counter 2 · opened 06:58 · 41 orders", 12),
    ]
    e += [box(40, 168 + i * 44, 560, 38, f"{d}     [   0   ]  ×          =   ₱0.00", W, align="l", size=12)
          for i, d in enumerate(denoms)]
    e += [
        box(40, 168 + 9 * 44 + 8, 560, 54, "COUNTED                                      ₱9,430.00", M, align="l", size=15),
        box(640, 168, 600, 250, "Expected total is not shown\nand is not sent to this device\n"
                                "until the count is submitted.\n\nThis is a blind count.", D, dash=1, size=14),
        box(640, 440, 600, 150, "After submit:\n"
                                "Expected  ₱9,480.00     Counted  ₱9,430.00\n"
                                "VARIANCE  −₱50.00  — beyond tolerance\n"
                                "→ manager Override + reason required", W, dash=1, align="l", size=12),
        box(640, 612, 600, 74, "SUBMIT COUNT", S, size=17),
        box(640, 706, 600, 44, "⚠ 3 sales still waiting to sync", M, size=12),
    ]
    out.append(screen("pos/drawer-close-1280.svg", T, TH, "POS · Close drawer session (blind count)", TABLET, e, notes=[
        "Expected is withheld server-side until the count is submitted — hiding it in the UI is not enough.",
        "The right-hand dashed panel is the post-submit reveal, not a second screen.",
        "Variance beyond the Tenant's tolerance requires a manager Override with a reason.",
        "Closing with unsynced entries is allowed, warned, and marked on the session.",
        "A closed session is final — corrections are appended notes, never edits.",
    ]))

    e = topbar(P, 48) + [
        txt(10, 76, "Close drawer — count", 15, "l", "bold"),
        txt(10, 96, "Ana · opened 06:58 · 41 orders", 10),
    ]
    e += [box(8, 110 + i * 40, P - 16, 34, f"{d}   [  0  ]  =  ₱0.00", W, align="l", size=11)
          for i, d in enumerate(denoms)]
    e += [
        box(8, 110 + 9 * 40 + 6, P - 16, 46, "COUNTED            ₱9,430.00", M, align="l", size=13),
        box(8, 566, P - 16, 88, "Expected is not shown until\nyou submit — this is a blind count.", D, dash=1, size=11),
        box(8, 668, P - 16, 44, "⚠ 3 sales waiting to sync", M, size=11),
        box(8, PH - 92, P - 16, 68, "SUBMIT COUNT", S, size=16),
    ]
    out.append(screen("pos/drawer-close-390.svg", P, PH, "POS · Close drawer session (blind count)", PHONE, e))

    # --------------------------------------------------------------- sync status
    e = topbar(T)
    e += [
        txt(40, 104, "Sync", 20, "l", "bold"),
        box(40, 124, 600, 120, "OFFLINE since 12:02  (39 min)\n"
                               "3 sales queued · oldest 31 min\nLast successful sync 12:02", M, align="l", size=14),
        box(40, 264, 600, 60, "SYNC NOW", S, size=15),
        txt(40, 372, "Queued", 13),
    ]
    e += rows(40, 386, 600, 56, [
        "order   C2-0421   ₱310.00   12:41   attempt 4",
        "order   C2-0422   ₱95.00    12:52   attempt 3",
        "void    C2-0419              12:55   attempt 3",
    ], gap=8, align="l", size=12)
    e += [
        box(680, 124, 560, 200, "Nothing is ever discarded.\n\nA queued sale retries until the server\n"
                                "acknowledges it. Retries back off; they do not stop.", D, dash=1, size=13),
        box(680, 348, 560, 80, "⚠ Sales have been stuck for over 30 minutes.\nTell a manager before closing up.", M, align="l", size=12),
        box(680, 452, 560, 80, "⛔ This terminal has been revoked.\nQueued sales are held for review — do not clear them.", W, dash=1, align="l", size=12),
        box(680, 556, 560, 80, "Storage is not persistent on this device.\nQueued sales could be evicted — tell the operator.", W, dash=1, align="l", size=12),
    ]
    out.append(screen("pos/sync-status-1280.svg", T, TH, "POS · Sync status", TABLET, e, notes=[
        "Reachable from the top-bar pill on every screen.",
        "The three dashed panels are states, not stacked content: stalled, revoked, non-persistent storage.",
        "There is no 'clear queue' control anywhere, by design.",
    ]))

    e = topbar(P, 48) + [
        box(8, 60, P - 16, 104, "OFFLINE since 12:02\n3 sales queued · oldest 31 min\nLast sync 12:02", M, align="l", size=12),
        box(8, 176, P - 16, 52, "SYNC NOW", S, size=14),
        txt(10, 258, "Queued", 12),
    ]
    e += rows(8, 268, P - 16, 50, [
        "order C2-0421  ₱310.00  attempt 4",
        "order C2-0422  ₱95.00   attempt 3",
        "void  C2-0419           attempt 3",
    ], gap=6, align="l", size=11)
    e += [box(8, 448, P - 16, 70, "⚠ Stuck over 30 minutes.\nTell a manager before closing up.", M, align="l", size=11)]
    out.append(screen("pos/sync-status-390.svg", P, PH, "POS · Sync status", PHONE, e))

    # --------------------------------------------------------------- order lookup
    e = topbar(T)
    e += [
        txt(40, 104, "Recent orders on this terminal", 20, "l", "bold"),
        box(40, 124, 600, 46, "Search order number…", W, align="l"),
        txt(40, 194, "Rung up by", 11),
    ]
    for i, (t, f) in enumerate([("Anyone", W), ("Ana", S), ("Boy", W)]):
        e.append(box(40 + i * 130, 202, 122, 40, t, f, size=12))
    e += rows(40, 258, 600, 56, [
        "C2-0421   12:41   ₱310.00   Ana   synced",
        "C2-0420   12:33   ₱145.00   Ana   queued",
        "C2-0419   12:20   ₱210.00   Ana   VOIDED",
        "C2-0418   12:11   ₱80.00    Ana   synced",
    ], gap=8, align="l", size=12)
    e += [box(680, 124, 560, 560, "Selected order\n\n(receipt view, read-only,\nwith Void / Refund actions)", D, dash=1, size=14)]
    out.append(screen("pos/order-lookup-1280.svg", T, TH, "POS · Order lookup", TABLET, e, notes=[
        "Scoped to this Device — order numbers are unique per Device, not per Store.",
        "Sync state is visible per order.",
        "Selecting an order opens the receipt view; corrections start from there.",
        "RUNG UP BY lists only the Users who actually used this terminal in the window — not the Store's directory.",
        "It filters on the User attributed to the Order, whatever their Role. A manager's own sales are in the list.",
        "Defaults to the signed-in User after a handover, because 'find mine' is the reason the filter exists.",
    ]))

    # ------------------------------------------------------------ running summary
    e = topbar(T)
    e += [
        txt(40, 104, "Drawer session · OPEN", 20, "l", "bold"),
        txt(40, 128, "opened 06:58 by Ana · Malabon · Counter 2 · 5h 43m", 12),
        box(40, 148, 580, 300, "Float declared                          ₱1,000.00\n"
                               "\n"
                               "Orders taken                                    41\n"
                               "\n"
                               "Cash                                     ₱8,480.00\n"
                               "GCash                                      ₱890.00\n"
                               "Maya                                       ₱260.00\n"
                               "Card                                     ₱1,150.00\n"
                               "\n"
                               "Refunds (cash)                            −₱175.00\n"
                               "Cash in                                    ₱250.00\n"
                               "Cash out                                  −₱200.00",
            W, align="l", size=13),
        box(40, 466, 580, 76, "Non-cash methods are shown but never reach the drawer.\n"
                              "A busy GCash day is not a till about to come up short.", D, dash=1, align="l", size=12),
        box(40, 566, 285, 56, "Cash movement", W, size=13),
        box(335, 566, 285, 56, "Close session", S, size=13),
        box(40, 646, 580, 76, "Reading this screen writes nothing. It does not close, mark,\n"
                              "or touch the session — and it works with no network.", D, dash=1, align="l", size=12),
        box(660, 148, 580, 240, "WITH the right to see expected cash\n\n"
                                "EXPECTED CASH                    ₱9,355.00\n\n"
                                "= float + cash − cash refunds\n  + cash in − cash out\n\n"
                                "A manager checking where the till stands\n"
                                "at 3pm, before anybody counts anything.",
            W, align="l", size=13),
        box(660, 408, 580, 240, "WITHOUT it — the cashier's view\n\n"
                                "EXPECTED CASH                            —\n"
                                "                          not shown, and\n"
                                "                          NOT IN THE PAYLOAD\n\n"
                                "Everything above stays visible. Only the\n"
                                "expected figure is withheld, by the same\n"
                                "right that governs the close-time reveal.",
            D, dash=1, align="l", size=13),
        box(660, 668, 580, 54, "One right, one secret. A second permission for the same number is how\n"
                               "a control gets widened by accident.", M, align="l", size=11),
    ]
    out.append(screen("pos/running-summary-1280.svg", T, TH, "POS · Running summary (open session)", TABLET, e, notes=[
        "The two right-hand panels are the SAME screen for two people, not two panels stacked.",
        "This is the second route to the expected total and therefore the second place the blind count can be defeated.",
        "Withholding it in the UI while shipping it in the payload is not withholding it.",
        "Computed on the device from the orders it holds, so it works offline.",
        "Read-only. There is no action here that changes the session except the two buttons, which are existing flows.",
        "No printing — there is no receipt printer in v1.",
    ]))

    # ------------------------------------------------------------ session history
    e = topbar(T)
    e += [
        txt(40, 104, "Sessions closed on this terminal", 20, "l", "bold"),
        txt(40, 128, "Counter 2 · most recent first · recent window only", 12),
    ]
    e += rows(40, 150, 600, 64, [
        "07-30  06:55 → 15:20   Ana    counted ₱9,430   −₱50   synced",
        "07-29  06:58 → 15:05   Ana    counted ₱8,910    ₱0    synced",
        "07-28  14:30 → 23:10   Dina   counted ₱7,240   −₱20   PENDING SYNC",
        "07-28  06:52 → 14:25   Ana    counted ₱9,105   +₱15   synced",
    ], gap=10, align="l", size=12)
    e += [
        box(40, 456, 600, 70, "A close still sitting in the Outbox is marked pending — 'did it go through'\n"
                              "is something you can see, not something you assume.", D, dash=1, align="l", size=12),
        box(680, 150, 560, 300, "Selected session  ·  07-30\n\n"
                                "Opened 06:55 by Ana · closed 15:20 by Ana\n"
                                "Float                            ₱1,000.00\n"
                                "Orders                                  47\n"
                                "Cash                             ₱9,180.00\n"
                                "GCash / Maya / Card              ₱1,940.00\n"
                                "\n"
                                "Expected                         ₱9,480.00\n"
                                "Counted                          ₱9,430.00\n"
                                "Variance                           −₱50.00\n"
                                "Approved by Boy · miscount",
            W, align="l", size=13),
        box(680, 470, 560, 130, "The expected figure obeys the same right here.\n"
                                "A cashier without it sees the count and the\n"
                                "variance and no expected total.\n\n"
                                "A cashier sees only their own sessions.", D, dash=1, align="l", size=12),
        box(680, 620, 560, 102, "Scoped to THIS DEVICE and a bounded recent window.\n\n"
                                "A terminal is not a reporting surface. Every cross-device,\n"
                                "cross-store, or cross-period question is the back-office.",
            M, align="l", size=12),
    ]
    out.append(screen("pos/session-history-1280.svg", T, TH, "POS · Session history", TABLET, e, notes=[
        "Device-scoped server-side — a Device token cannot read another Device's sessions.",
        "Sync state per session uses the same vocabulary as the sync-status screen.",
        "Closed sessions are immutable. Nothing on this screen edits anything.",
    ]))

    return out
