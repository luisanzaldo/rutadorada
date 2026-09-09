#!/usr/bin/env python3
"""Regenera el subconjunto de Material Symbols con solo los iconos que se usan.

Por que existe: la fuente completa pesa 3,7 MB —el 90% de todo el peso de fuentes
del sitio— para dar unos 4.200 iconos de los que se usan 23. El subconjunto pesa
17 KB.

Por que es un .py y no un .mjs como el resto de scripts: subsetear una fuente
variable con ligaduras es trabajo de fontTools, que es Python. Se ejecuta a mano y
muy de vez en cuando, igual que prune-r2-images.mjs.

    pip install fonttools brotli uharfbuzz
    python3 scripts/subset-icon-font.py --check     # solo comprueba
    python3 scripts/subset-icon-font.py             # regenera

LA TRAMPA, si alguien vuelve aqui: estos iconos no se piden por codepoint sino
escribiendo su nombre —<span class="material-symbols-outlined">star</span>— y la
fuente lo convierte con una ligadura de la feature `rlig`. Subsetear con
`--text="star speed ..."` NO funciona: el cierre de GSUB ve que desde las letras
a-z se puede formar CUALQUIER ligadura y conserva casi todos los iconos (medido:
5.870 de 6.492 glifos, 3,57 MB). Hay que desactivar ese cierre con
`--no-layout-closure` y nombrar los glifos uno a uno.
"""

import argparse, hashlib, pathlib, re, subprocess, sys, tempfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE_ORIGINAL = 'public/fonts/material-symbols-outlined-variable.woff2'
PATRON = re.compile(r'material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*<')


def iconos_en_el_codigo() -> set[str]:
    """Los iconos que aparecen en componentes, paginas y cuerpos de notas.

    Se leen los markdown de git y no la base: son la misma cosa mientras el CI
    reconcilie, y asi el script no necesita credenciales para el caso normal.
    """
    encontrados = set()
    for carpeta in ['src/components', 'src/layouts', 'src/pages', 'src/lib', 'src/content/posts']:
        for f in (RAIZ / carpeta).rglob('*'):
            if f.is_file():
                encontrados |= set(PATRON.findall(f.read_text(errors='ignore')))
    return encontrados


def fuente_completa(destino: pathlib.Path) -> pathlib.Path:
    """Recupera la fuente original del historial de git.

    No vive ya en el arbol de trabajo —es justo lo que este script elimina— pero
    el historial la conserva, y en este repositorio el historial no se reescribe.
    """
    commit = subprocess.run(
        ['git', 'rev-list', '-1', 'HEAD', '--', FUENTE_ORIGINAL],
        cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
    if not commit:
        sys.exit(f'No encuentro {FUENTE_ORIGINAL} en el historial de git.')
    # Ese commit es normalmente el que la borro, asi que el contenido esta en su
    # padre; pero si todavia no se ha commiteado el borrado, esta en el commit
    # mismo. Se prueban los dos para que el script funcione en ambos momentos.
    for ref in (f'{commit}^:{FUENTE_ORIGINAL}', f'{commit}:{FUENTE_ORIGINAL}'):
        r = subprocess.run(['git', 'show', ref], cwd=RAIZ, capture_output=True)
        if r.returncode == 0 and r.stdout:
            destino.write_bytes(r.stdout)
            return destino
    sys.exit(f'No pude recuperar {FUENTE_ORIGINAL} del historial de git.')


def subconjunto_actual() -> pathlib.Path | None:
    encontrados = sorted((RAIZ / 'public/fonts').glob('material-symbols-subset-*.woff2'))
    return encontrados[0] if encontrados else None


def glifos_de(ruta: pathlib.Path) -> set[str]:
    from fontTools.ttLib import TTFont
    return set(TTFont(ruta).getGlyphOrder())


def comprobar(iconos: set[str]) -> int:
    """Falla si el sitio usa un icono que el subconjunto no trae.

    Es el fallo que este montaje hace posible y que no da error en ninguna parte:
    el icono simplemente no se dibuja.
    """
    actual = subconjunto_actual()
    if not actual:
        print('No hay ningun subconjunto en public/fonts.'); return 1
    faltan = sorted(iconos - glifos_de(actual))
    print(f'{actual.name}: {actual.stat().st_size:,} bytes')
    print(f'iconos usados por el sitio: {len(iconos)}')
    if faltan:
        print(f'*** FALTAN {len(faltan)} en la fuente: {", ".join(faltan)}')
        print('    Regenera con: python3 scripts/subset-icon-font.py')
        return 1
    print('OK: la fuente cubre todos los iconos que el sitio usa.')
    return 0


def verificar_ligaduras(original: pathlib.Path, subset: pathlib.Path, iconos: list[str]) -> None:
    """Moldea cada nombre con HarfBuzz y exige el mismo glifo que el original.

    Comprobar que el glifo existe no basta: lo que puede romperse al subsetear son
    las reglas de ligadura, y sin ellas el navegador escribe la palabra 'star' en
    vez de dibujar la estrella.
    """
    try:
        import uharfbuzz as hb
        from fontTools.ttLib import TTFont
    except ImportError:
        print('  (sin uharfbuzz: me salto la verificacion de ligaduras)'); return

    def a_ttf(src, dst):
        f = TTFont(src); f.flavor = None; f.save(dst); return dst

    with tempfile.TemporaryDirectory() as tmp:
        t = pathlib.Path(tmp)
        o_ttf, s_ttf = a_ttf(original, t / 'o.ttf'), a_ttf(subset, t / 's.ttf')
        n_o, n_s = TTFont(o_ttf).getGlyphOrder(), TTFont(s_ttf).getGlyphOrder()

        def moldear(ruta, texto, nombres):
            face = hb.Face(hb.Blob.from_file_path(str(ruta)))
            buf = hb.Buffer(); buf.add_str(texto); buf.guess_segment_properties()
            hb.shape(hb.Font(face), buf)
            return [nombres[i.codepoint] for i in buf.glyph_infos]

        fallos = [ic for ic in iconos
                  if moldear(s_ttf, ic, n_s) != moldear(o_ttf, ic, n_o) != [ic]]
        if fallos:
            sys.exit(f'*** Las ligaduras no sobreviven para: {", ".join(fallos)}')
        print(f'  ligaduras verificadas con HarfBuzz: {len(iconos)}/{len(iconos)}')


def regenerar(iconos: set[str]) -> int:
    from fontTools.subset import main as pyftsubset
    lista = sorted(iconos)

    with tempfile.TemporaryDirectory() as tmp:
        t = pathlib.Path(tmp)
        original = fuente_completa(t / 'original.woff2')
        salida = t / 'subset.woff2'
        print(f'fuente original: {original.stat().st_size:,} bytes')

        pyftsubset([
            str(original),
            f'--output-file={salida}',
            '--flavor=woff2',
            '--layout-features+=rlig,rclt',
            '--no-layout-closure',      # sin esto el subconjunto pesa 3,57 MB
            '--glyph-names',
            f'--text={" ".join(lista)}',
            f'--glyphs={",".join(lista)}',
        ])

        verificar_ligaduras(original, salida, lista)

        datos = salida.read_bytes()
        h = hashlib.sha256(datos).hexdigest()[:8]
        destino = RAIZ / 'public/fonts' / f'material-symbols-subset-{h}.woff2'

        for viejo in (RAIZ / 'public/fonts').glob('material-symbols-subset-*.woff2'):
            if viejo != destino:
                viejo.unlink()
        destino.write_bytes(datos)

    print(f'\nescrito {destino.name}: {len(datos):,} bytes · {len(lista)} iconos')
    apuntar_css_a(destino.name)
    return 0


def apuntar_css_a(nombre: str) -> None:
    """Deja el @font-face apuntando al archivo recien escrito.

    Lo hace el script y no una mano humana porque el nombre lleva un hash: si el
    CSS se queda apuntando al anterior, el navegador recibe un 404 y el sitio se
    queda sin ningun icono, sin error en ninguna parte.
    """
    css = RAIZ / 'src/styles/global.css'
    t = css.read_text()
    patron = re.compile(r"(src: url\(')/fonts/material-symbols-subset-[0-9a-f]+\.woff2('\) format\('woff2'\);)")
    nuevo, n = patron.subn(rf"\g<1>/fonts/{nombre}\g<2>", t)
    if n != 1:
        sys.exit(f'*** No pude actualizar el @font-face en {css} ({n} coincidencias). '
                 f"Ponlo a mano: src: url('/fonts/{nombre}') format('woff2');")
    css.write_text(nuevo)
    print(f'src/styles/global.css apuntando a {nombre}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--check', action='store_true',
                    help='solo comprueba que la fuente cubra los iconos en uso')
    args = ap.parse_args()
    iconos = iconos_en_el_codigo()
    sys.exit(comprobar(iconos) if args.check else regenerar(iconos))
