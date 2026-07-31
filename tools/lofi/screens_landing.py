"""Landing site (apps/landing) — desktop 1440 and phone 390."""

from lofi import D, M, S, W, box, grid, rows, screen, txt

X, Y = 1440, 1600
P, PH = 390, 1900


def nav(w, small=False):
    h = 64 if not small else 56
    return [
        box(0, 0, w, h, "", M),
        txt(16 if small else 40, h / 2 + 5, "DeanPOS", 15, "l", "bold"),
        txt(w - (16 if small else 40), h / 2 + 5,
            "☰" if small else "What it does   ·   Pricing   ·   Join the waitlist", 13, "r"),
    ]


def build():
    out = []

    # ------------------------------------------------------------------- home
    e = nav(X)
    e += [
        box(0, 64, X, 380, "", D),
        txt(X / 2, 190, "A point-of-sale for counter-service food", 34, "c", "bold"),
        txt(X / 2, 232, "Built for carinderias and fast-casual. Keeps selling when the internet drops.", 16, "c"),
        box(X / 2 - 210, 280, 200, 56, "Join the waitlist", S, size=14),
        box(X / 2 + 10, 280, 200, 56, "See pricing", W, size=14),
        txt(X / 2, 384, "₱ prices · VAT optional · one deploy, many restaurants", 12, "c"),
    ]
    e += grid(120, 490, 380, 220, 3, [
        "SELLS OFFLINE\n\nThe till keeps working with no\nnetwork. Sales queue and sync\nwhen it comes back.",
        "YOUR MENU, YOUR WAY\n\nUlam → Adobo / Munggo →\nWhole / Half, plus add-ons\nlike extra rice.",
        "THE DAY ADDS UP\n\nOpen a drawer with a float,\ncount it at close, see the\nvariance and who approved it.",
    ], gx=60, size=13)
    e += [
        box(120, 750, X - 240, 300, "", W),
        txt(160, 800, "The terminal", 18, "l", "bold"),
        box(160, 820, 560, 200, "screenshot of the sale screen\n(tablet)", D, dash=1, size=13),
        box(760, 820, 520, 200, "Fast entry, big targets, works\non a tablet or a phone.\n\n"
                                "Manager approval for voids,\nrefunds and discounts.", W, align="l", size=13),
        box(120, 1090, X - 240, 200, "WHAT IT DOES NOT DO\n\n"
                                     "No card processing · no accounting or e-invoicing · no loyalty or promos\n"
                                     "No purchasing or stock counts · no dine-in tables · no printed receipts yet\n\n"
                                     "Published on purpose. Better to know now than after onboarding.",
            M, align="l", size=13),
        box(120, 1330, 700, 200, "Join the waitlist\n\n"
                                 "[ Your name                    ]\n"
                                 "[ Business name                ]\n"
                                 "[ Email or mobile              ]\n"
                                 "[ City ]   [ Anything else? (optional) ]\n\n"
                                 "[  JOIN  ]     We reply personally. No newsletter.", W, align="l", size=13),
        box(860, 1330, 460, 200, "Not a signup form.\n\nThere is no self-serve account yet —\n"
                                 "we set each restaurant up ourselves.", D, dash=1, align="l", size=12),
        box(0, Y - 60, X, 60, "DeanPOS · Premium Softwares · how we handle your data · contact", M, size=12),
    ]
    out.append(screen("landing/home-1440.svg", X, Y, "Landing · Home", "landing · desktop 1440", e, notes=[
        "The two questions that decide the purchase are answered above the fold: does it work offline, can my staff use it.",
        "The non-goals block is a feature, not a disclaimer — do not soften it.",
        "No claim of tax compliance anywhere on the site.",
        "The waitlist form is the only unauthenticated write in the whole product.",
    ]))

    e = nav(P, small=True)
    e += [
        box(0, 56, P, 300, "", D),
        txt(P / 2, 140, "A point-of-sale", 21, "c", "bold"),
        txt(P / 2, 168, "for counter-service food", 21, "c", "bold"),
        txt(P / 2, 204, "Keeps selling when the", 13, "c"),
        txt(P / 2, 224, "internet drops.", 13, "c"),
        box(20, 250, P - 40, 50, "Join the waitlist", S, size=13),
        box(20, 310, P - 40, 40, "See pricing", W, size=13),
    ]
    e += rows(20, 380, P - 40, 130, [
        "SELLS OFFLINE\n\nThe till keeps working with\nno network.",
        "YOUR MENU, YOUR WAY\n\nUlam → Adobo → Whole /\nHalf, plus add-ons.",
        "THE DAY ADDS UP\n\nFloat, count, variance,\nand who approved it.",
    ], gap=16, align="l", size=12)
    e += [
        box(20, 830, P - 40, 200, "screenshot of the sale screen", D, dash=1, size=12),
        box(20, 1060, P - 40, 220, "WHAT IT DOES NOT DO\n\nNo card processing\nNo accounting / e-invoicing\n"
                                   "No loyalty or promos\nNo purchasing or stock\nNo dine-in tables\n"
                                   "No printed receipts yet", M, align="l", size=12),
        box(20, 1310, P - 40, 320, "Join the waitlist\n\n[ Your name              ]\n"
                                   "[ Business name          ]\n[ Email or mobile        ]\n[ City                   ]\n"
                                   "[ Anything else?         ]\n\n[         JOIN          ]\n\n"
                                   "We reply personally.", W, align="l", size=12),
        box(0, PH - 80, P, 80, "DeanPOS · Premium Softwares\nhow we handle your data · contact", M, size=11),
    ]
    out.append(screen("landing/home-390.svg", P, PH, "Landing · Home", "landing · phone 390", e, notes=[
        "Same section order as desktop; nothing is dropped on the small screen.",
    ]))

    # ---------------------------------------------------------------- pricing
    e = nav(X)
    e += [
        txt(X / 2, 150, "Pricing", 32, "c", "bold"),
        txt(X / 2, 186, "One plan. No card processing fees, because we do not touch the card.", 15, "c"),
        box(X / 2 - 260, 230, 520, 320, "PER STORE / MONTH\n\n₱ —\n\n"
                                        "Unlimited terminals at that store\nUnlimited staff accounts\n"
                                        "Offline selling · drawer reconciliation\nReports and CSV export\n\n"
                                        "[  Join the waitlist  ]", W, size=14),
        box(X / 2 - 260, 580, 520, 90, "Pricing is not final while we are onboarding by hand.\n"
                                       "It will be stated here before self-serve signup exists.", D, dash=1, size=12),
        txt(200, 740, "Questions people actually ask", 18, "l", "bold"),
    ]
    e += rows(200, 764, X - 400, 84, [
        "Does it work without internet?    Yes — the terminal sells offline and syncs when it reconnects.",
        "Can it charge a credit card?      No. A card amount can be recorded; DeanPOS does not process it.",
        "Is this BIR compliant?            No. DeanPOS produces business reports, not statutory ones.",
        "Can I move my data out?           Yes. You can export everything you have put in.",
        "What if I stop using it?          Export first, then we delete your data on request.",
    ], gap=12, align="l", size=13)
    e += [
        box(200, 1300, X - 400, 160, "Join the waitlist\n\n"
                                     "[ Name ]  [ Business ]  [ Email or mobile ]  [ City ]     [  JOIN  ]\n\n"
                                     "We reply personally. No newsletter, no drip sequence.", W, align="l", size=13),
        box(0, Y - 60, X, 60, "DeanPOS · Premium Softwares · how we handle your data · contact", M, size=12),
    ]
    out.append(screen("landing/pricing-1440.svg", X, Y, "Landing · Pricing", "landing · desktop 1440", e, notes=[
        "The BIR answer is deliberately blunt — it is the claim most likely to be misread.",
        "Export and deletion are answered here because they are the questions a cautious owner asks.",
    ]))

    return out
