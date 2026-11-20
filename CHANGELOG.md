# Changelog

All notable changes. The newest version is on top. A new section with a new
number in `VERSION` automatically creates a GitHub release when pushed to `main`.

## 1.5.0

- Plugin is now bilingual (English / German). The language follows the Stream Deck app
  and can be overridden in the key settings.
- ESC mode names are sent as neutral keys by the mod and translated by the plugin.
- Code comments, logs and diagnostics are in English.
- Source code, tests and an automatic release pipeline on GitHub.

## 1.4.1

- ESC key shows the real mode name (Comfort, Normal, Sport, Off …) instead of `table: 0x…`.
- ESC key colour follows the mode: grey = off, blue = comfort, green = normal, red = sport.

## 1.4.0

- Diff locks switch reliably (mode set directly, previous mode remembered).
- 2H / 4H / 4L display reads the drivetrain device again, so it follows every switch.
- New keys: nitrous (NOS), rocket / JATO (hold), vehicle selector, enter / exit vehicle.
- Placeholders in game actions (PLAYER, VEHICLEID, FILTERTYPE …) are filled in like the game does.
- Layout: rear / centre / front lock side by side on page 1; range key removed from the automatic layout.

## 1.3.0

- Uses the official BeamNG action ids (toggle4WDStatus, toggleRangeStatus, toggleESCMode,
  saveHome, loadHome, switch_camera_next).
- Repair in place uses `recovery.recoverInPlace()`.
- "Check connection" shows plugin and mod versions.
- AC: engine brake on Ctrl+4 by default.

## 1.2.0

- New keys: repair, set return point, return to point, next camera.
- 2H → 4H → 4L cycle through the vehicle's own controls.

## 1.1.0

- Two layout pages with reserved slots for "next page", "previous page" and "switch profile".
- New keys: flash high beams, lightbar.

## 1.0.1

- Fixed the registration with the Stream Deck app (keys stayed empty).

## 1.0.0

- First version: BeamNG mod, Stream Deck plugin and Assetto Corsa shared memory bridge.
