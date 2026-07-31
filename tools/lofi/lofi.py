"""Tiny lo-fi wireframe emitter.

Structure and order only — greyscale boxes and labels. Deliberately ugly: a lo-fi
mock that looks designed invites an implementer to measure it. See
`.claude/skills/lofi-to-code/SKILL.md` for what a mock does and does not decide.

Run `python3 tools/lofi/generate.py` to rebuild everything in `design/lofi/`.
"""

import html
import os

OUT = "design/lofi"

# fills
W = "#ffffff"   # plain surface
M = "#eeeeee"   # muted / secondary
S = "#cccccc"   # emphasis (primary control, selected)
D = "#f7f7f7"   # page background block


def box(x, y, w, h, label="", fill=W, dash=0, size=13, align="c", r=0):
    return ("box", x, y, w, h, label, fill, dash, size, align, r)


def txt(x, y, s, size=13, align="l", weight="normal"):
    return ("txt", x, y, s, size, align, weight)


def ln(x1, y1, x2, y2, dash=0):
    return ("ln", x1, y1, x2, y2, dash)


def _lines(label):
    return label.split("\n") if label else []


def _render_el(e):
    k = e[0]
    if k == "box":
        _, x, y, w, h, label, fill, dash, size, align, r = e
        da = ' stroke-dasharray="6 4"' if dash else ""
        out = [
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" '
            f'stroke="#333" stroke-width="1"{da}/>'
        ]
        ls = _lines(label)
        if ls:
            lh = size + 5
            if align == "c":
                cy = y + h / 2 - (len(ls) - 1) * lh / 2 + size / 3
                for i, t in enumerate(ls):
                    out.append(
                        f'<text x="{x + w / 2}" y="{cy + i * lh}" font-size="{size}" '
                        f'text-anchor="middle" fill="#111">{html.escape(t)}</text>'
                    )
            else:
                cy = y + (size + 8) if len(ls) > 1 else y + h / 2 + size / 3
                for i, t in enumerate(ls):
                    out.append(
                        f'<text x="{x + 10}" y="{cy + i * lh}" font-size="{size}" '
                        f'fill="#111">{html.escape(t)}</text>'
                    )
        return "".join(out)
    if k == "txt":
        _, x, y, s, size, align, weight = e
        a = {"l": "start", "c": "middle", "r": "end"}[align]
        return (
            f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{a}" '
            f'font-weight="{weight}" fill="#111">{html.escape(s)}</text>'
        )
    _, x1, y1, x2, y2, dash = e
    da = ' stroke-dasharray="6 4"' if dash else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#333"{da}/>'


def screen(path, w, h, title, viewport, elems, notes=()):
    pad, top = 40, 78
    nh = len(notes) * 20 + (18 if notes else 0)
    cw, ch = w + pad * 2, h + top + pad + nh
    body = "".join(_render_el(e) for e in elems)
    ns = "".join(
        f'<text x="0" y="{h + 34 + i * 20}" font-size="12" fill="#555">'
        f"{html.escape('· ' + n)}</text>"
        for i, n in enumerate(notes)
    )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{cw}" height="{ch}" viewBox="0 0 {cw} {ch}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
<rect width="{cw}" height="{ch}" fill="#fafafa"/>
<text x="{pad}" y="34" font-size="17" font-weight="bold" fill="#111">{html.escape(title)}</text>
<text x="{pad}" y="56" font-size="12" fill="#555">{html.escape(viewport)} · lo-fi: structure and order only — spacing, type, colour and states come from tokens</text>
<g transform="translate({pad},{top})">
<rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff" stroke="#111" stroke-width="2"/>
{body}
{ns}
</g>
</svg>
"""
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(svg)
    return path


def rows(x, y, w, rh, items, gap=0, fill=W, size=13, align="l"):
    """Vertical stack of labelled boxes."""
    return [
        box(x, y + i * (rh + gap), w, rh, t, fill if not isinstance(t, tuple) else t[1],
            size=size, align=align)
        if not isinstance(t, tuple)
        else box(x, y + i * (rh + gap), w, rh, t[0], t[1], size=size, align=align)
        for i, t in enumerate(items)
    ]


def grid(x, y, cw, ch, cols, items, gx=10, gy=10, fill=W, size=13):
    out = []
    for i, t in enumerate(items):
        c, r = i % cols, i // cols
        out.append(box(x + c * (cw + gx), y + r * (ch + gy), cw, ch, t, fill, size=size))
    return out


def table(x, y, w, header, body_rows, rh=34, colw=None):
    """Header strip + rows, columns separated by labels only."""
    n = len(header)
    colw = colw or [w / n] * n
    out = [box(x, y, w, rh, "", M)]
    cx = x
    for i, htxt in enumerate(header):
        out.append(txt(cx + 10, y + rh / 2 + 4, htxt, 12, "l", "bold"))
        cx += colw[i]
    for r, row in enumerate(body_rows):
        ry = y + rh * (r + 1)
        out.append(box(x, ry, w, rh, "", W))
        cx = x
        for i, cell in enumerate(row):
            out.append(txt(cx + 10, ry + rh / 2 + 4, cell, 12))
            cx += colw[i]
    return out
