#!/usr/bin/env python3
"""Builds the release files into dist/:

  dist/SimDeck.streamDeckPlugin         – Stream Deck plugin (double-click to install)
  dist/simdeck_beamng_v<version>.zip    – BeamNG.drive mod (drop into the mods folder)
  dist/release-notes.md                 – notes for this version, taken from CHANGELOG.md

The single source of the version number is the VERSION file. It is written into
the plugin manifest and the mod while packaging (the sources stay unchanged).

Usage:  python3 scripts/build.py            (only needs the Python standard library)
"""
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLUGIN_DIR = ROOT / "plugin" / "de.simdeck.plugin.sdPlugin"
MOD_DIR = ROOT / "beamng-mod"
DIST = ROOT / "dist"

# files that never belong into a release
SKIP = {"simdeck.log", ".DS_Store", "Thumbs.db"}


def read_version() -> str:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        sys.exit(f"VERSION must look like 1.2.3, got {version!r}")
    return version


def files_under(base: pathlib.Path):
    for path in sorted(base.rglob("*")):
        if path.is_file() and path.name not in SKIP:
            yield path


def build_plugin(version: str) -> pathlib.Path:
    out = DIST / "SimDeck.streamDeckPlugin"
    manifest = json.loads((PLUGIN_DIR / "manifest.json").read_text(encoding="utf-8"))
    manifest["Version"] = f"{version}.0"  # Stream Deck uses four parts
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files_under(PLUGIN_DIR):
            arcname = (pathlib.Path(PLUGIN_DIR.name) / path.relative_to(PLUGIN_DIR)).as_posix()
            if path.name == "manifest.json" and path.parent == PLUGIN_DIR:
                zf.writestr(arcname, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
            else:
                zf.write(path, arcname)
    return out


def build_mod(version: str) -> pathlib.Path:
    out = DIST / f"simdeck_beamng_v{version}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files_under(MOD_DIR):
            arcname = path.relative_to(MOD_DIR).as_posix()
            if path.suffix == ".lua":
                text = path.read_text(encoding="utf-8")
                text = re.sub(r'local VERSION = "[^"]*"', f'local VERSION = "{version}"', text)
                zf.writestr(arcname, text)
            else:
                zf.write(path, arcname)
    return out


def release_notes(version: str) -> pathlib.Path:
    """Copies the "## <version>" section of CHANGELOG.md into dist/release-notes.md."""
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    match = re.search(rf"^## \[?{re.escape(version)}\]?.*?$(.*?)(?=^## |\Z)", changelog, re.M | re.S)
    body = match.group(1).strip() if match else "See CHANGELOG.md."
    install = (
        "\n\n### Installation\n"
        "1. **Stream Deck plugin:** double-click `SimDeck.streamDeckPlugin`.\n"
        f"2. **BeamNG mod:** put `simdeck_beamng_v{version}.zip` as it is (do not unzip) into your BeamNG `mods` folder "
        "and remove older `simdeck_beamng*.zip` files.\n"
        "3. **Assetto Corsa:** nothing to install.\n\n"
        "Full guide: see the README."
    )
    out = DIST / "release-notes.md"
    out.write_text(body + install + "\n", encoding="utf-8")
    return out


def main():
    version = read_version()
    DIST.mkdir(exist_ok=True)
    for old in DIST.iterdir():
        old.unlink()
    for path in (build_plugin(version), build_mod(version), release_notes(version)):
        print(f"built {path.relative_to(ROOT)}")
    print(f"version {version}")


if __name__ == "__main__":
    main()
