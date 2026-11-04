#!/usr/bin/env python3
"""
Reference port of the Aetheris colour pipeline.

This is not a Minecraft renderer: it re-implements the atmosphere, sun/moon
lighting, PBR surface shading, bloom threshold, tone mapping and grading from
the GLSL in Aetheris/shaders/lib, then renders a small "lighting chart" so the
exposure and colour balance can be inspected without launching the game.

Usage: python3 tools/reference_render.py [out.png]
"""
import math, sys, os, subprocess

PI = math.pi

def sat(x): return max(0.0, min(1.0, x))
def sstep(a, b, x):
    if a == b: return 1.0 if x >= b else 0.0
    t = sat((x - a) / (b - a))
    return t * t * (3 - 2 * t)
def mix(a, b, t): return a + (b - a) * t
def vmul(v, s): return tuple(c * s for c in v)
def vadd(a, b): return tuple(x + y for x, y in zip(a, b))
def luma(c): return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def norm(v):
    l = math.sqrt(sum(x * x for x in v)) or 1e-5
    return tuple(x / l for x in v)

# ---------------- settings mirror (settings.glsl defaults) ----------------
EXPOSURE = 1.0
SATURATION = 1.08
CONTRAST = 1.06
WHITE_BALANCE = 0.0
EMISSIVE_STRENGTH = 1.0
BLOOM_THRESHOLD = 1.05

RAYLEIGH = (5.8e-6, 13.5e-6, 33.1e-6)
MIE = (21.0e-6,)
OZONE = (0.65e-6, 1.88e-6, 0.085e-6)
H_RAYLEIGH, H_MIE, H_OZONE = 8.0e3, 1.2e3, 2.2e4
SKY_GAIN, MIE_GAIN = 30.0, 11.0

def day_factor(sun_y): return sat(sstep(-0.12, 0.22, sun_y))

def sun_tint(sun_y):
    h = sat(sun_y)
    horizon = (1.0, 0.36, 0.10)
    mid = (1.0, 0.72, 0.44)
    noon = (1.0, 0.965, 0.918)
    c = tuple(mix(horizon[i], mid[i], sstep(0.0, 0.22, h)) for i in range(3))
    c = tuple(mix(c[i], noon[i], sstep(0.20, 0.65, h)) for i in range(3))
    f = mix(1.0, 0.72, math.exp(-h * 8.0))
    return tuple(x * f for x in c)

def moon_tint(): return vmul((0.52, 0.66, 1.0), 1.05)

def light_color(sun_y):
    day = day_factor(sun_y)
    sun = vmul(sun_tint(sun_y), 2.15)
    moon = vmul(moon_tint(), 0.22)
    t = sat(day * 1.25)
    return tuple(mix(moon[i], sun[i], t) for i in range(3))

def atmosphere(d, sun, rain=0.0):
    mu = dot(d, sun)
    zenith = sat(d[1] * 0.5 + 0.5)
    air_mass = min(1.0 / (max(d[1], 0.0) + 0.095), 14.0)
    sun_am = min(1.0 / (max(sun[1], 0.0) + 0.095), 22.0)

    betaR = tuple(b * H_RAYLEIGH for b in RAYLEIGH)
    betaM = tuple(MIE[0] * H_MIE for _ in range(3))
    betaO = tuple(b * H_OZONE for b in OZONE)

    sunT = [math.exp(-(betaR[i] + betaM[i]) * sun_am - betaO[i] * sun_am) for i in range(3)]
    mixf = sat(1.0 - sun[1] * 6.0)
    sunT = [mix(sunT[i], sunT[i] * (0.92, 0.94, 1.12)[i], mixf) for i in range(3)]
    viewT = [math.exp(-(betaR[i] + betaM[i]) * air_mass * 0.55) for i in range(3)]

    rayleigh_phase = 0.0596831 * (1.0 + mu * mu)
    g = 0.78
    mie_phase = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5))

    scatter = []
    for i in range(3):
        s = betaR[i] * rayleigh_phase * sunT[i] * viewT[i] * SKY_GAIN
        m = betaM[i] * mie_phase * sunT[i] * viewT[i] * MIE_GAIN
        scatter.append(s + m)

    # sunset / sunrise multiple-scattering boost
    golden = math.exp(-pow(sat(sun[1]) * 3.4, 1.5)) * sstep(-0.10, 0.02, sun[1])
    band = pow(1.0 - sat(d[1]), 3.0)
    st = sun_tint(sun[1])
    scatter = [scatter[i] * mix(1.0, 2.30, golden) + sunT[i] * st[i] * golden * band * 0.075
               + sunT[i] * st[i] * golden * pow(sat(mu), 6.0) * 0.25 for i in range(3)]

    horizon = pow(1.0 - sat(d[1]), 4.0)
    scatter = [scatter[i] + sunT[i] * (0.42, 0.30, 0.24)[i] * horizon * 0.055 for i in range(3)]

    night = [mix(0.0135, 0.0340, zenith), mix(0.0225, 0.0560, zenith), mix(0.0510, 0.1150, zenith)]
    night = [night[i] + (0.050, 0.075, 0.130)[i] * horizon * 0.55 for i in range(3)]

    dayW = day_factor(sun[1])
    res = [mix(night[i], scatter[i], dayW) for i in range(3)]
    dimf = sat(1.0 - sun[1] * 3.0) * dayW * 0.6
    res = [mix(res[i], res[i] * (0.72, 0.75, 0.82)[i], dimf) for i in range(3)]
    grey = luma(res)
    res = [mix(res[i], grey * (0.62, 0.66, 0.72)[i], rain * 0.75) for i in range(3)]
    return tuple(max(0.0, c) for c in res)

def sky_ambient(n, sun, rain=0.0):
    upness = n[1] * 0.5 + 0.5
    day = day_factor(sun[1])
    zenith = atmosphere((0.0, 1.0, 0.0), sun, rain)
    horizon = atmosphere(norm((n[0], 0.04, n[2])), sun, rain)
    ground = vmul((0.055, 0.05, 0.042), 0.35 + day)
    amb = [mix(horizon[i], zenith[i], sat(n[1] * 1.2 + 0.25)) for i in range(3)]
    amb = [mix(amb[i], ground[i], sat(-n[1] * 1.4)) for i in range(3)]
    amb = vmul(tuple(amb), mix(0.72, 1.18, upness))
    amb = vmul(amb, 0.72 + 0.28 * day)
    amb = vmul(amb, mix(2.15, 1.0, day))
    g = math.exp(-pow(sat(sun[1]) * 3.4, 1.5)) * sstep(-0.10, 0.02, sun[1])
    st = sun_tint(sun[1])
    amb = [amb[i] + st[i] * g * 0.055 for i in range(3)]
    return amb

def shade_surface(albedo, n, v, sun, roughness=0.7, metallic=0.0, f0base=0.04, lightmap_sky=1.0, torch=0.0, emissive=0.0):
    key = light_color(sun[1])
    NoL = sat(dot(n, sun))
    diff = NoL
    f0 = mix(f0base, luma(albedo), metallic)
    kD = (1 - f0) * (1 - metallic)
    direct = [albedo[i] * diff * kD * key[i] for i in range(3)]
    amb = sky_ambient(n, sun)
    amb = [amb[i] * albedo[i] * mix(0.55, 1.0, sat(roughness)) for i in range(3)]
    col = [direct[i] + amb[i] * mix(0.055, 1.0, sstep(0.0, 1.0, lightmap_sky)) for i in range(3)]
    col = [col[i] + albedo[i] * torch for i in range(3)]
    col = [col[i] + albedo[i] * emissive * 5.0 * EMISSIVE_STRENGTH for i in range(3)]
    return tuple(col)

def tonemap_aces(x):
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return tuple(sat((xi * (a * xi + b)) / (xi * (c * xi + d) + e)) for xi in x)

def tonemap_aces_hue(c):
    per = tonemap_aces(c)
    l = luma(c)
    mapped_l = tonemap_aces((l, l, l))[0]
    ratio = mapped_l / max(l, 1e-4)
    kept = tuple(min(1.0, x * ratio) for x in c)
    return tuple(mix(per[i], kept[i], 0.55) for i in range(3))

def apply_saturation(c, s):
    return tuple(mix(luma(c), ci, s) for ci in c)

def contrast_curve(c, amount):
    return tuple(sat((ci - 0.5) * amount + 0.5) for ci in c)

def grade(c):
    l = luma(c)
    shadowW = 1.0 - sstep(0.0, 0.45, l)
    highW = sstep(0.45, 1.0, l)
    cool = (-0.012, 0.004, 0.030)
    warm = (0.030, 0.011, -0.016)
    c = [c[i] + cool[i] * shadowW + warm[i] * highW for i in range(3)]
    c = apply_saturation(tuple(c), SATURATION)
    c = contrast_curve(c, CONTRAST)
    c = list(c)
    c[0] *= 1.0 + WHITE_BALANCE * 0.35
    c[2] *= 1.0 - WHITE_BALANCE * 0.35
    return tuple(sat(x) for x in c)

def to_srgb(c): return tuple(pow(max(x, 0.0), 1.0 / 2.2) for x in c)

# ---------------- render the chart ----------------
def sky_value(direction, sun_y):
    sun = norm((0.0, sun_y, -1.0))
    return atmosphere(norm(direction), sun)

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lighting_chart.png'
    W, BAND = 384, 36
    times = [('NOON', 0.95), ('AFTERNOON', 0.45), ('SUNSET', 0.06),
             ('DUSK', -0.02), ('NIGHT', -0.55), ('MIDNIGHT', -0.95)]
    albedos = [(0.35, 0.33, 0.30), (0.11, 0.24, 0.07), (0.62, 0.58, 0.48),
               (0.09, 0.09, 0.10), (0.26, 0.09, 0.07), (0.75, 0.70, 0.60)]

    img = []
    stats = []
    for name, sun_y in times:
        sun = norm((0.0, sun_y, -0.85))
        hdr_rows, ldr_rows = [], []
        for y in range(BAND):
            hdr_row, ldr_row = [], []
            for x in range(W):
                u = x / (W - 1)
                v = y / (BAND - 1)
                if v < 0.5:
                    direction = norm((u * 1.8 - 0.9, 1.0 - v * 2.0, -1.0))
                    c = atmosphere(direction, sun)
                else:
                    alb = albedos[int(u * len(albedos)) % len(albedos)]
                    c = shade_surface(alb, (0.0, 1.0, 0.0), (0.0, 0.4, 1.0), sun)
                hdr_row.append(c)
                ldr_row.append(to_srgb(grade(tonemap_aces_hue(vmul(c, EXPOSURE)))))
            hdr_rows.append(hdr_row)
            ldr_rows.append(ldr_row)
        img.extend(ldr_rows)

        lum = sorted(luma(p) for row in hdr_rows for p in row)
        ml = sorted(luma(p) for row in ldr_rows for p in row)
        stats.append((name, sun_y, lum[len(lum) // 2], lum[int(len(lum) * 0.97)], lum[-1],
                      ml[len(ml) // 2], ml[-1], sum(1 for v in ml if v > 0.985) / len(ml)))

    H = len(img)
    with open('/tmp/chart.ppm', 'wb') as f:
        f.write(b'P6\n%d %d\n255\n' % (W, H))
        buf = bytearray()
        for row in img:
            for p in row:
                buf += bytes((int(sat(p[0]) * 255), int(sat(p[1]) * 255), int(sat(p[2]) * 255)))
        f.write(bytes(buf))
    os.system('convert /tmp/chart.ppm ' + out)

    print(f'{"time":<10}{"sunY":>7}{"HDR p50":>10}{"HDR p97":>10}{"HDR max":>10}'
          f'{"LDR p50":>10}{"LDR max":>10}{"clipped":>10}')
    for srow in stats:
        print(f'{srow[0]:<10}{srow[1]:>7.2f}{srow[2]:>10.3f}{srow[3]:>10.3f}{srow[4]:>10.3f}'
              f'{srow[5]:>10.3f}{srow[6]:>10.3f}{srow[7]*100:>9.2f}%')
    print('chart written to', out)


if __name__ == '__main__':
    main()
