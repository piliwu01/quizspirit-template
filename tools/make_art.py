"""產生題靈冒險 QuizSpirit 原創角色圖（SVG → 透明 PNG）。
每個角色依屬性決定配色與特徵，依 id 決定耳朵、眼睛、花紋等變化，依進化階段決定大小與裝飾。"""
import json, random, subprocess, sys, os, math

sys.path.insert(0, os.path.dirname(__file__))
from roster import ROSTER, ROSTER_TYPES

PALETTE = {
    'grass':    ('#7ccf6a', '#3f9a4a', '#e9f7c9'),
    'fire':     ('#ff8a4c', '#d9472b', '#ffe3b0'),
    'water':    ('#5ab3f0', '#2b6fc4', '#d6f0ff'),
    'electric': ('#7fe3e0', '#23908d', '#e3fffd'),
    'psychic':  ('#f08ad0', '#b24aa4', '#ffe0f4'),
    'ghost':    ('#9b8ce0', '#5a4aa8', '#e6e0ff'),
    'dark':     ('#5b5f7a', '#2e3048', '#c9cde4'),
    'dragon':   ('#7a86f0', '#3f45b8', '#dfe3ff'),
    'steel':    ('#a9b8c8', '#66788c', '#eef3f8'),
    'fairy':    ('#ffadc8', '#e0638f', '#fff0f5'),
    'normal':   ('#d9c3a0', '#a68a62', '#fff6e6'),
    'rock':     ('#c4a27a', '#86643e', '#f2e4cf'),
    'ice':      ('#a8e6f5', '#4fb3cf', '#f0fcff'),
    'fighting': ('#e0795a', '#a8432c', '#ffe1d4'),
    'bug':      ('#a8d45a', '#6a9a22', '#f1fbd6'),
}

STAGES = {2: 1, 3: 2, 5: 1, 6: 2, 8: 1, 9: 2, 26: 1}
STARTER_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26}


def hue_shift(hex_color, shift):
    import colorsys
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb((h + shift) % 1, l, s)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


LEGEND = {150, 151, 249, 250, 384, 483, 484, 643, 644, 716, 717, 785, 888, 1007, 1008}


def ornament(t, c1, c2, c3, cx, top, r, rnd, stage):
    s = []
    if t == 'fire':
        for i, dx in enumerate((-0.25, 0, 0.25)[: 2 + min(stage, 1)]):
            h = r * (0.55 + 0.15 * (i == 1)) * (1 + 0.15 * stage)
            x = cx + dx * r
            s.append(f'<path d="M{x-r*0.18},{top+r*0.1} Q{x-r*0.2},{top-h*0.5} {x},{top-h} Q{x+r*0.22},{top-h*0.45} {x+r*0.18},{top+r*0.1} Z" fill="#ffb347" stroke="{c2}" stroke-width="6"/>')
            s.append(f'<path d="M{x-r*0.08},{top+r*0.05} Q{x-r*0.08},{top-h*0.35} {x},{top-h*0.6} Q{x+r*0.1},{top-h*0.3} {x+r*0.08},{top+r*0.05} Z" fill="#fff1a8"/>')
    elif t == 'grass':
        n = 1 + stage
        for i in range(n):
            ang = -30 + 60 * (i / max(1, n - 1)) if n > 1 else 0
            s.append(f'<g transform="rotate({ang} {cx} {top+r*0.15})"><path d="M{cx},{top+r*0.15} C{cx-r*0.45},{top-r*0.25} {cx-r*0.2},{top-r*0.8} {cx},{top-r*0.85} C{cx+r*0.2},{top-r*0.8} {cx+r*0.45},{top-r*0.25} {cx},{top+r*0.15} Z" fill="#9be07a" stroke="{c2}" stroke-width="6"/><path d="M{cx},{top+r*0.1} L{cx},{top-r*0.7}" stroke="{c2}" stroke-width="5"/></g>')
        if stage == 2:
            s.append(f'<circle cx="{cx}" cy="{top-r*0.75}" r="{r*0.14}" fill="#ff9ec7" stroke="{c2}" stroke-width="5"/>')
    elif t == 'water':
        s.append(f'<path d="M{cx-r*0.12},{top+r*0.12} Q{cx},{top-r*(0.55+0.2*stage)} {cx+r*0.32},{top-r*(0.2+0.1*stage)} Q{cx+r*0.18},{top} {cx+r*0.15},{top+r*0.15} Z" fill="{c3}" stroke="{c2}" stroke-width="6"/>')
    elif t == 'electric':
        for side in (-1, 1):
            x = cx + side * r * 0.22
            s.append(f'<path d="M{x},{top+r*0.15} Q{x+side*r*0.05},{top-r*0.35} {x+side*r*0.2},{top-r*(0.55+0.1*stage)}" stroke="{c2}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="{x+side*r*0.2}" cy="{top-r*(0.55+0.1*stage)}" r="{r*0.12}" fill="#f4fbff" stroke="{c2}" stroke-width="5"/>')
        s.append(f'<path d="M{cx-r*0.06},{top+r*0.3} l{r*0.1},{-r*0.02} l{-r*0.05},{r*0.12} l{r*0.12},{-r*0.02}" stroke="#ffffff" stroke-width="6" fill="none" stroke-linejoin="round"/>')
    elif t in ('psychic', 'fairy'):
        col = '#ff6fb5' if t == 'psychic' else '#ffffff'
        s.append(f'<path d="M{cx},{top-r*0.55} l{r*0.12},{r*0.25} l{r*0.27},{r*0.04} l{-r*0.2},{r*0.18} l{r*0.06},{r*0.27} l{-r*0.25},{-r*0.13} l{-r*0.25},{r*0.13} l{r*0.06},{-r*0.27} l{-r*0.2},{-r*0.18} l{r*0.27},{-r*0.04} Z" fill="{col}" stroke="{c2}" stroke-width="5" stroke-linejoin="round"/>')
    elif t in ('dragon', 'rock', 'steel', 'fighting'):
        for side in (-1, 1):
            x = cx + side * r * 0.42
            s.append(f'<path d="M{x-side*r*0.12},{top+r*0.25} Q{x+side*r*0.05},{top-r*0.6} {x+side*r*0.35},{top-r*(0.7+0.15*stage)} Q{x+side*r*0.15},{top-r*0.2} {x+side*r*0.18},{top+r*0.25} Z" fill="{c3}" stroke="{c2}" stroke-width="6"/>')
    elif t == 'ice':
        for dx in (-0.35, 0, 0.35):
            x = cx + dx * r
            s.append(f'<path d="M{x-r*0.12},{top+r*0.15} L{x},{top-r*0.6} L{x+r*0.12},{top+r*0.15} Z" fill="#e8fbff" stroke="{c2}" stroke-width="5"/>')
    elif t == 'bug':
        for side in (-1, 1):
            x = cx + side * r * 0.25
            s.append(f'<path d="M{x},{top+r*0.15} Q{x+side*r*0.1},{top-r*0.5} {x+side*r*0.35},{top-r*0.6}" stroke="{c2}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="{x+side*r*0.35}" cy="{top-r*0.6}" r="{r*0.09}" fill="{c1}" stroke="{c2}" stroke-width="5"/>')
    elif t in ('ghost', 'dark'):
        s.append(f'<path d="M{cx-r*0.25},{top-r*0.05} A{r*0.3},{r*0.3} 0 1 0 {cx+r*0.25},{top-r*0.05} A{r*0.22},{r*0.22} 0 1 1 {cx-r*0.25},{top-r*0.05} Z" fill="{c3}" stroke="{c2}" stroke-width="5"/>')
    return ''.join(s)


def ears(style, cx, cy, r, c1, c2, c3):
    out = []
    for side in (-1, 1):
        bx = cx + side * r * 0.55
        by = cy - r * 0.65
        if style == 0:   # 尖耳
            out.append(f'<path d="M{bx-side*r*0.25},{by+r*0.2} L{bx+side*r*0.15},{by-r*0.55} L{bx+side*r*0.3},{by+r*0.1} Z" fill="{c1}" stroke="{c2}" stroke-width="7" stroke-linejoin="round"/><path d="M{bx-side*r*0.1},{by+r*0.1} L{bx+side*r*0.12},{by-r*0.3} L{bx+side*r*0.2},{by+r*0.05} Z" fill="{c3}"/>')
        elif style == 1:  # 圓耳
            out.append(f'<circle cx="{bx}" cy="{by-r*0.05}" r="{r*0.26}" fill="{c1}" stroke="{c2}" stroke-width="7"/><circle cx="{bx}" cy="{by-r*0.05}" r="{r*0.13}" fill="{c3}"/>')
        elif style == 2:  # 垂耳
            out.append(f'<ellipse cx="{bx+side*r*0.25}" cy="{by+r*0.35}" rx="{r*0.17}" ry="{r*0.38}" transform="rotate({side*-25} {bx+side*r*0.25} {by+r*0.35})" fill="{c2}" stroke="{c2}" stroke-width="5"/>')
        # style 3: 無耳
    return ''.join(out)


def creature(cid, t, stage, legend):
    rnd = random.Random(cid * 7919)
    c1, c2, c3 = PALETTE.get(t, PALETTE['normal'])
    if cid not in STARTER_IDS:
        shift = rnd.uniform(-0.07, 0.07)
        c1, c2, c3 = (hue_shift(c, shift) for c in (c1, c2, c3))
    W = 512
    scale = 1.0 + 0.12 * stage + (0.12 if legend else 0)
    r = 118 * scale
    cx, cy = W / 2, 300 + (0 if stage == 0 else 0)
    body_ry = r * rnd.uniform(0.92, 1.05)
    body_rx = r * rnd.uniform(1.0, 1.15)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{W}" viewBox="0 0 {W} {W}">',
           '<defs>',
           f'<radialGradient id="g" cx="40%" cy="35%" r="75%"><stop offset="0%" stop-color="{c3}"/><stop offset="45%" stop-color="{c1}"/><stop offset="100%" stop-color="{c2}"/></radialGradient>',
           '</defs>']
    # 光環（傳說級）
    if legend:
        svg.append(f'<circle cx="{cx}" cy="{cy-r*0.15}" r="{r*1.35}" fill="none" stroke="{c1}" stroke-width="10" stroke-dasharray="18 14" opacity="0.7"/>')
    # 尾巴
    tail_side = rnd.choice((-1, 1))
    tx = cx + tail_side * body_rx * 0.95
    if t == 'electric':
        svg.append(f'<path d="M{tx-tail_side*20},{cy+40} Q{tx+tail_side*55},{cy+30} {tx+tail_side*60},{cy-40}" stroke="{c2}" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="{tx+tail_side*62}" cy="{cy-62}" r="28" fill="#f4fbff" stroke="{c2}" stroke-width="6"/><circle cx="{tx+tail_side*62}" cy="{cy-62}" r="12" fill="{c1}"/>')
    elif t == 'water':
        svg.append(f'<path d="M{tx-tail_side*25},{cy+30} Q{tx+tail_side*70},{cy+10} {tx+tail_side*95},{cy-60} Q{tx+tail_side*60},{cy+60} {tx-tail_side*10},{cy+70} Z" fill="{c3}" stroke="{c2}" stroke-width="7"/>')
    elif t == 'fire':
        svg.append(f'<path d="M{tx-tail_side*20},{cy+50} C{tx+tail_side*90},{cy+60} {tx+tail_side*120},{cy-40} {tx+tail_side*70},{cy-90} C{tx+tail_side*75},{cy-30} {tx+tail_side*30},{cy} {tx-tail_side*10},{cy+10} Z" fill="{c1}" stroke="{c2}" stroke-width="7"/><path d="M{tx+tail_side*70},{cy-90} C{tx+tail_side*95},{cy-50} {tx+tail_side*85},{cy-30} {tx+tail_side*65},{cy-25} Z" fill="{c3}"/>')
    elif t not in ('ghost',):
        svg.append(f'<path d="M{tx-tail_side*20},{cy+40} Q{tx+tail_side*60},{cy+40} {tx+tail_side*55},{cy-15}" stroke="{c2}" stroke-width="22" fill="none" stroke-linecap="round"/>')
    # 翅膀（龍、飛行感）
    if t in ('dragon',) or (legend and t in ('psychic', 'fire', 'dark', 'fairy')):
        for side in (-1, 1):
            wx = cx + side * body_rx * 0.7
            svg.append(f'<path d="M{wx},{cy-20} Q{wx+side*130},{cy-160} {wx+side*170},{cy-60} Q{wx+side*120},{cy-50} {wx+side*110},{cy} Q{wx+side*70},{cy-10} {wx},{cy+20} Z" fill="{c3}" stroke="{c2}" stroke-width="7" stroke-linejoin="round" opacity="0.95"/>')
    # 腳
    if t != 'ghost':
        for side in (-1, 1):
            svg.append(f'<ellipse cx="{cx+side*body_rx*0.45}" cy="{cy+body_ry*0.92}" rx="{r*0.28}" ry="{r*0.16}" fill="{c2}"/>')
    # 耳朵
    svg.append(ears(rnd.randrange(4) if t not in ('electric', 'fire') else (3 if t == 'electric' else 0), cx, cy, r, c1, c2, c3))
    # 身體
    if t == 'ghost':
        w = body_rx
        svg.append(f'<path d="M{cx-w},{cy} A{w},{body_ry} 0 0 1 {cx+w},{cy} L{cx+w},{cy+body_ry*0.9} Q{cx+w*0.75},{cy+body_ry*0.65} {cx+w*0.5},{cy+body_ry*0.9} Q{cx+w*0.25},{cy+body_ry*0.65} {cx},{cy+body_ry*0.9} Q{cx-w*0.25},{cy+body_ry*0.65} {cx-w*0.5},{cy+body_ry*0.9} Q{cx-w*0.75},{cy+body_ry*0.65} {cx-w},{cy+body_ry*0.9} Z" fill="url(#g)" stroke="{c2}" stroke-width="8" opacity="0.93"/>')
    else:
        svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{body_rx}" ry="{body_ry}" fill="url(#g)" stroke="{c2}" stroke-width="8"/>')
    # 肚子
    svg.append(f'<ellipse cx="{cx}" cy="{cy+body_ry*0.42}" rx="{body_rx*0.55}" ry="{body_ry*0.42}" fill="{c3}" opacity="0.9"/>')
    # 花紋
    pat = rnd.randrange(3)
    if pat == 0:
        for i in range(3):
            svg.append(f'<path d="M{cx-body_rx*0.95+i*14},{cy-30+i*22} q20,8 0,16" stroke="{c2}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    elif pat == 1:
        for (dx, dy) in ((-0.7, -0.35), (0.72, -0.3), (0.8, 0.1)):
            svg.append(f'<circle cx="{cx+dx*body_rx}" cy="{cy+dy*body_ry}" r="{r*0.07}" fill="{c3}" opacity="0.85"/>')
    # 頭頂屬性特徵
    svg.append(ornament(t, c1, c2, c3, cx, cy - body_ry * 0.92, r, rnd, stage))
    # 眼睛
    eye_style = rnd.randrange(3)
    ey = cy - body_ry * 0.18
    for side in (-1, 1):
        ex = cx + side * body_rx * 0.36
        if eye_style == 2 and stage == 2:
            svg.append(f'<path d="M{ex-26},{ey-6} Q{ex},{ey-30} {ex+26},{ey-6} Q{ex},{ey+18} {ex-26},{ey-6} Z" fill="#2b2140"/><circle cx="{ex+8}" cy="{ey-10}" r="7" fill="#fff"/>')
        else:
            er = r * (0.17 if eye_style != 1 else 0.14)
            svg.append(f'<ellipse cx="{ex}" cy="{ey}" rx="{er}" ry="{er*1.18}" fill="#2b2140"/><circle cx="{ex+er*0.35}" cy="{ey-er*0.4}" r="{er*0.38}" fill="#fff"/><circle cx="{ex-er*0.3}" cy="{ey+er*0.4}" r="{er*0.16}" fill="#fff"/>')
        # 腮紅（雷屬性不加，避免與知名角色特徵相似）
        if t != 'electric':
          svg.append(f'<ellipse cx="{cx+side*body_rx*0.58}" cy="{ey+r*0.3}" rx="{r*0.13}" ry="{r*0.08}" fill="#ff7f9e" opacity="0.55"/>')
    # 嘴
    my = ey + r * 0.32
    mouth = rnd.randrange(3)
    if mouth == 0:
        svg.append(f'<path d="M{cx-18},{my} Q{cx-9},{my+12} {cx},{my} Q{cx+9},{my+12} {cx+18},{my}" stroke="#2b2140" stroke-width="6" fill="none" stroke-linecap="round"/>')
    elif mouth == 1:
        svg.append(f'<path d="M{cx-16},{my-2} Q{cx},{my+22} {cx+16},{my-2} Z" fill="#c2405e" stroke="#2b2140" stroke-width="5"/>')
    else:
        svg.append(f'<path d="M{cx-14},{my} Q{cx},{my+14} {cx+14},{my}" stroke="#2b2140" stroke-width="6" fill="none" stroke-linecap="round"/>')
        if t in ('dragon', 'dark', 'fire', 'rock', 'fighting'):
            svg.append(f'<path d="M{cx-10},{my+2} l5,9 l5,-8 Z M{cx+10},{my+2} l-5,9 l-5,-8 Z" fill="#fff"/>')
    # 傳說級頭冠寶石
    if legend:
        svg.append(f'<path d="M{cx},{cy-body_ry*0.62} l18,22 l-18,22 l-18,-22 Z" fill="#fff" stroke="{c2}" stroke-width="5"/>')
    svg.append('</svg>')
    return ''.join(svg)


def main(out_dirs, roster_types):
    for cid, t in roster_types.items():
        stage = STAGES.get(cid, 0)
        legend = cid in LEGEND
        svg = creature(cid, t, stage, legend)
        tmp = f'/tmp/qs_{cid}.svg'
        open(tmp, 'w').write(svg)
        for d in out_dirs:
            os.makedirs(d, exist_ok=True)
            subprocess.run(['rsvg-convert', '-w', '256', '-h', '256', '-o', os.path.join(d, f'{cid}.png'), tmp], check=True)


if __name__ == '__main__':
    types = {cid: t for cid, (_en, _zh, t) in ROSTER_TYPES.items()}
    assert set(types) == set(ROSTER)
    main(sys.argv[1:], types)
