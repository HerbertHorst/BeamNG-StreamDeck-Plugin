// Translations (German / English) shared by the plugin (Node.js) and the
// Property Inspector (browser). Written as UMD so both can load the same file.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SimDeckI18n = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STRINGS = {
    en: {
      // ---- key labels: BeamNG
      indicator: "Indicator", hazard: "Hazard", lights: "Lights", lightsOn: "Lights on",
      highBeam: "High beam", fog: "Fog", escOff: "ESC off", lowRange: "LOW", highRange: "HIGH",
      range: "Range", lockR: "Rear lock", lockF: "Front lock", lockC: "Ctr. lock",
      engine: "Engine", engineOn: "Engine on", engineOff: "Engine off", ignition: "Ignition",
      handbrake: "Handbrake", horn: "Horn", flash: "Flash", lightbar: "Lightbar", on: "on",
      repair: "Repair", setPoint: "Set point", pointSet: "Point set", goBack: "Return",
      camera: "Camera", nos: "NOS", nosOn: "NOS on", rocket: "Rocket", vehicles: "Vehicles",
      exitCar: "Exit car",
      // ---- ESC / drive modes
      "mode.off": "Off", "mode.comfort": "Comfort", "mode.eco": "Eco", "mode.wet": "Wet",
      "mode.snow": "Snow", "mode.normal": "Normal", "mode.on": "On", "mode.sport": "Sport",
      "mode.sportplus": "Sport+", "mode.track": "Track", "mode.race": "Race", "mode.drift": "Drift",
      "mode.dynamic": "Dynamic", "mode.offroad": "Offroad", "mode.rally": "Rally",
      // ---- key labels: Assetto Corsa
      off: "OFF", gearbox: "Gearbox", automatic: "automatic", manual: "manual",
      recovery: "Recovery", deploy: "Deploy", brakeBias: "Brake", front: "front", fuel: "Fuel",
      drsOpen: "open", drsReady: "ready", engineBrake: "Eng. brake", setKey: "Set a key",
      // ---- reserved navigation slots
      "res.next": "Next|page", "res.prev": "Previous|page", "res.profile": "Switch|profile",
      keepFree: "(keep free)",
      // ---- function names (Property Inspector dropdown)
      "fn.auto": "Automatic (by position)",
      "fn.bng_signal_left": "Left indicator", "fn.bng_hazard": "Hazard lights",
      "fn.bng_signal_right": "Right indicator", "fn.bng_lowbeam": "Low beam",
      "fn.bng_highbeam": "High beam", "fn.bng_fog": "Fog lights", "fn.bng_esc": "ESC / drive mode",
      "fn.bng_drive": "Drivetrain 2WD/4WD (+H/L)", "fn.bng_range": "Range High/Low",
      "fn.bng_lock_rear": "Rear diff lock", "fn.bng_lock_center": "Center diff lock",
      "fn.bng_lock_front": "Front diff lock", "fn.bng_engine": "Engine start/stop",
      "fn.bng_parkbrake": "Parking brake", "fn.bng_horn": "Horn", "fn.bng_flash": "Flash high beams",
      "fn.bng_lightbar": "Lightbar", "fn.bng_gear": "Gear + km/h (display)",
      "fn.bng_repair": "Repair vehicle (in place)", "fn.bng_home_save": "Set return point",
      "fn.bng_home_load": "Go to return point (+ repair)", "fn.bng_camera": "Next camera",
      "fn.bng_selector": "Vehicle selector (menu)", "fn.bng_walk": "Enter / exit vehicle",
      "fn.bng_nos": "Nitrous (NOS)", "fn.bng_rocket": "Rocket / JATO (hold)",
      "fn.ac_tc": "TC display (press = +)", "fn.ac_tc_up": "TC +", "fn.ac_tc_down": "TC −",
      "fn.ac_abs": "ABS display (press = +)", "fn.ac_abs_up": "ABS +", "fn.ac_abs_down": "ABS −",
      "fn.ac_autoshift": "Automatic gearbox", "fn.ac_mguk_rec": "MGU-K recovery",
      "fn.ac_mguk_del": "MGU-K deployment", "fn.ac_lights": "Lights",
      "fn.ac_sig_left": "Left indicator (CSP)", "fn.ac_sig_right": "Right indicator (CSP)",
      "fn.ac_drs": "DRS", "fn.ac_kers": "KERS", "fn.ac_enginebrake": "Engine brake",
      "fn.ac_bias": "Brake bias (display)", "fn.ac_gear": "Gear + km/h (display)",
      "fn.ac_fuel": "Fuel (display)",
      // ---- Property Inspector
      "pi.function": "Function", "pi.functionTitle": "Function of this key", "pi.page": "Layout page",
      "pi.page1": "Page 1 (main functions)", "pi.page2": "Page 2 (more functions)",
      "pi.autoHint": "\"Automatic\": put this key on all 15 slots (copy & paste). Every position then picks its own function – for the game that is currently running.",
      "pi.groupBng": "BeamNG.drive", "pi.groupBngGeneral": "BeamNG – general",
      "pi.groupAc": "Assetto Corsa", "pi.acKeys": "Assetto Corsa: key bindings",
      "pi.acKeysHint": "Only change these if you changed the bindings in AC. Format e.g. ctrl+shift+t, alt+left, f5, [. Empty = default.",
      "pi.notBound": "not bound", "pi.help": "Help", "pi.status": "Check connection",
      "pi.dump": "BeamNG diagnostics", "pi.resetLevels": "Forget AC levels",
      "pi.dumpHint": "BeamNG diagnostics writes the detected vehicle parts to the BeamNG log (open the console with ~ or ^).",
      "pi.language": "Language", "pi.langAuto": "Automatic (Stream Deck language)",
      "pi.asking": "Asking plugin …", "pi.noAnswer": "No answer from the plugin – please send simdeck.log.",
      "pi.activeGame": "Active game", "pi.none": "none", "pi.pluginVersion": "Plugin version",
      "pi.mod": "BeamNG mod", "pi.modOld": "old (before 1.3)", "pi.version": "version",
      "pi.bridge": "AC bridge", "pi.running": "running", "pi.notRunning": "not running", "pi.data": "data",
      "pi.connected": "connected", "pi.never": "never", "pi.ago": "last seen {s} s ago",
    },
    de: {
      indicator: "Blinker", hazard: "Warnblink.", lights: "Licht", lightsOn: "Licht an",
      highBeam: "Fernlicht", fog: "Nebel", escOff: "ESC aus", lowRange: "LOW", highRange: "HIGH",
      range: "Untersetz.", lockR: "Sperre H", lockF: "Sperre V", lockC: "Sperre M",
      engine: "Motor", engineOn: "Motor an", engineOff: "Motor aus", ignition: "Zündung",
      handbrake: "Handbremse", horn: "Hupe", flash: "Lichthupe", lightbar: "Lightbar", on: "an",
      repair: "Reparieren", setPoint: "Punkt setzen", pointSet: "Punkt gesetzt", goBack: "Zurück",
      camera: "Kamera", nos: "NOS", nosOn: "NOS an", rocket: "Rakete", vehicles: "Fahrzeuge",
      exitCar: "Aussteigen",
      "mode.off": "Aus", "mode.comfort": "Komfort", "mode.eco": "Eco", "mode.wet": "Nass",
      "mode.snow": "Schnee", "mode.normal": "Normal", "mode.on": "An", "mode.sport": "Sport",
      "mode.sportplus": "Sport+", "mode.track": "Track", "mode.race": "Race", "mode.drift": "Drift",
      "mode.dynamic": "Dynamik", "mode.offroad": "Offroad", "mode.rally": "Rally",
      off: "AUS", gearbox: "Getriebe", automatic: "Automatik", manual: "manuell",
      recovery: "Rückgew.", deploy: "Abgabe", brakeBias: "Bremse", front: "vorne", fuel: "Tank",
      drsOpen: "offen", drsReady: "frei", engineBrake: "Motorbr.", setKey: "Taste festlegen",
      "res.next": "Nächste|Seite", "res.prev": "Vorherige|Seite", "res.profile": "Profil|wechseln",
      keepFree: "(frei lassen)",
      "fn.auto": "Automatisch (nach Position)",
      "fn.bng_signal_left": "Blinker links", "fn.bng_hazard": "Warnblinker",
      "fn.bng_signal_right": "Blinker rechts", "fn.bng_lowbeam": "Abblendlicht",
      "fn.bng_highbeam": "Fernlicht", "fn.bng_fog": "Nebelscheinwerfer", "fn.bng_esc": "ESC / Fahrmodus",
      "fn.bng_drive": "Antrieb 2WD/4WD (+H/L)", "fn.bng_range": "Untersetzung High/Low",
      "fn.bng_lock_rear": "Sperre hinten", "fn.bng_lock_center": "Sperre Mitte",
      "fn.bng_lock_front": "Sperre vorne", "fn.bng_engine": "Motor Start/Stopp",
      "fn.bng_parkbrake": "Handbremse", "fn.bng_horn": "Hupe", "fn.bng_flash": "Lichthupe",
      "fn.bng_lightbar": "Rundumleuchte / Lightbar", "fn.bng_gear": "Gang + km/h (Anzeige)",
      "fn.bng_repair": "Auto reparieren (an Ort und Stelle)", "fn.bng_home_save": "Rückkehrpunkt setzen",
      "fn.bng_home_load": "Zum Rückkehrpunkt (+ reparieren)", "fn.bng_camera": "Kamera wechseln",
      "fn.bng_selector": "Fahrzeug wechseln (Menü)", "fn.bng_walk": "Ein-/Aussteigen",
      "fn.bng_nos": "Lachgas / NOS", "fn.bng_rocket": "Rakete / JATO (halten)",
      "fn.ac_tc": "TC Anzeige (Druck = +)", "fn.ac_tc_up": "TC +", "fn.ac_tc_down": "TC −",
      "fn.ac_abs": "ABS Anzeige (Druck = +)", "fn.ac_abs_up": "ABS +", "fn.ac_abs_down": "ABS −",
      "fn.ac_autoshift": "Automatikgetriebe", "fn.ac_mguk_rec": "MGU-K Rückgewinnung",
      "fn.ac_mguk_del": "MGU-K Abgabe", "fn.ac_lights": "Licht",
      "fn.ac_sig_left": "Blinker links (CSP)", "fn.ac_sig_right": "Blinker rechts (CSP)",
      "fn.ac_drs": "DRS", "fn.ac_kers": "KERS", "fn.ac_enginebrake": "Motorbremse",
      "fn.ac_bias": "Bremsbalance (Anzeige)", "fn.ac_gear": "Gang + km/h (Anzeige)",
      "fn.ac_fuel": "Tank (Anzeige)",
      "pi.function": "Funktion", "pi.functionTitle": "Funktion dieser Taste", "pi.page": "Layout-Seite",
      "pi.page1": "Seite 1 (Hauptfunktionen)", "pi.page2": "Seite 2 (weitere Funktionen)",
      "pi.autoHint": "„Automatisch“: Lege die Taste auf alle 15 Felder (kopieren & einfügen). Jede Position bekommt dann selbst die passende Funktion – für das gerade laufende Spiel.",
      "pi.groupBng": "BeamNG.drive", "pi.groupBngGeneral": "BeamNG – Allgemein",
      "pi.groupAc": "Assetto Corsa", "pi.acKeys": "Assetto Corsa: Tastenbelegung",
      "pi.acKeysHint": "Nur ändern, wenn du die Belegung in AC geändert hast. Format z. B. ctrl+shift+t, alt+left, f5, [. Leer = Standard.",
      "pi.notBound": "nicht belegt", "pi.help": "Hilfe", "pi.status": "Verbindung prüfen",
      "pi.dump": "BeamNG-Diagnose", "pi.resetLevels": "AC-Stufen vergessen",
      "pi.dumpHint": "BeamNG-Diagnose schreibt die erkannten Fahrzeugteile ins BeamNG-Log (Konsole mit ~ bzw. ^ öffnen).",
      "pi.language": "Sprache", "pi.langAuto": "Automatisch (Stream-Deck-Sprache)",
      "pi.asking": "Frage Plugin …", "pi.noAnswer": "Keine Antwort vom Plugin – bitte simdeck.log schicken.",
      "pi.activeGame": "Aktives Spiel", "pi.none": "keins", "pi.pluginVersion": "Plugin-Version",
      "pi.mod": "BeamNG-Mod", "pi.modOld": "alt (vor 1.3)", "pi.version": "Version",
      "pi.bridge": "AC-Brücke", "pi.running": "läuft", "pi.notRunning": "läuft nicht", "pi.data": "Daten",
      "pi.connected": "verbunden", "pi.never": "noch nie", "pi.ago": "zuletzt vor {s} s",
    },
  };

  // "auto" follows the Stream Deck app language: German for "de*", English otherwise
  function resolveLang(setting, appLanguage) {
    if (setting === "de" || setting === "en") return setting;
    return String(appLanguage || "").toLowerCase().startsWith("de") ? "de" : "en";
  }

  function t(lang, key, vars) {
    const table = STRINGS[lang] || STRINGS.en;
    let s = table[key];
    if (s === undefined) s = STRINGS.en[key];
    if (s === undefined) s = key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
    return s;
  }

  return { STRINGS, resolveLang, t };
});
