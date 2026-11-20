-- Tests for the BeamNG mod, using small mocks of the BeamNG Lua API.
-- Run from the repository root:  lua5.4 tests/lua/run_tests.lua
-- (BeamNG uses LuaJIT / Lua 5.1; the code avoids anything that differs.)

loadstring = loadstring or load
local failures, passed = 0, 0

local function check(name, cond, detail)
  if cond then passed = passed + 1
  else failures = failures + 1; print("FAIL: " .. name .. (detail and (" -> " .. tostring(detail)) or "")) end
end

local function fresh(module)
  package.loaded[module] = nil
  return dofile(module)
end

---------------------------------------------------------------------------
-- game engine extension
---------------------------------------------------------------------------
local function setupGE(actions)
  package.preload.socket = function() return { udp = function() return {
    settimeout = function() end, setsockname = function() return true end,
    receive = function() return nil end, sendto = function(_, s) LASTSENT = s end, close = function() end } end } end
  package.loaded.socket = nil
  log = function() end
  local veh = { queued = {} }
  function veh:queueLuaCommand(c) self.queued[#self.queued + 1] = c end
  function veh:getJBeamFilename() return "pickup" end
  function veh:getID() return 4711 end
  be = { getPlayerVehicle = function() return veh end }
  core_input_actions = actions and { getActiveActions = function() return actions end } or nil
  FS, jsonReadFile = nil, nil
  local M = fresh("beamng-mod/lua/ge/extensions/simdeck.lua")
  M.onExtensionLoaded()
  return M, veh
end

do -- game actions are triggered with placeholders filled in
  GE_CALLS = {}
  local M, veh = setupGE({
    toggle4WDStatus = { ctx = "vlua", onDown = "toggle4wd()" },
    toggleESCMode = { ctx = "vlua", onDown = "esc()" },
    vehicle_selector = { onDown = "table.insert(GE_CALLS, 'selector PLAYER')" },
    toggleWalkingMode = { onDown = "table.insert(GE_CALLS, 'walk VEHICLEID')" },
    pickup_jato = { title = "JATO", cat = "vehicle_specific", ctx = "vlua", onChange = "electrics.values.jato = VALUE" },
  })
  M._handle("down drive"); M._handle("up drive")
  check("drive triggers toggle4WDStatus once", #veh.queued == 1 and veh.queued[1] == "toggle4wd()", veh.queued[1])
  veh.queued = {}
  M._handle("down esc")
  check("esc triggers toggleESCMode", veh.queued[1] == "esc()", veh.queued[1])
  M._handle("down selector"); M._handle("down walk")
  check("PLAYER placeholder replaced", GE_CALLS[1] == "selector 0", GE_CALLS[1])
  check("VEHICLEID placeholder replaced", GE_CALLS[2] == "walk 4711", GE_CALLS[2])
  veh.queued = {}
  M._handle("down rocket"); M._handle("up rocket")
  check("rocket press uses vehicle action (VALUE=1)", veh.queued[1] == "electrics.values.jato = 1", veh.queued[1])
  check("rocket release (VALUE=0)", veh.queued[2] == "electrics.values.jato = 0", veh.queued[2])
end

do -- fallbacks when the game has no matching action
  local M, veh = setupGE(nil)
  M._handle("down repair")
  check("repair falls back to recoverInPlace", veh.queued[1]:find("recoverInPlace", 1, true) ~= nil, veh.queued[1])
  veh.queued = {}
  M._handle("down home_save")
  check("home_save falls back to recovery.saveHome", veh.queued[1] == "recovery.saveHome()", veh.queued[1])
  veh.queued = {}
  M._handle("down signal_left")
  check("other commands go to the vehicle extension", veh.queued[1]:find('m.command("signal_left", "down")', 1, true) ~= nil)
  M.onVehicleData('{"veh":true}')
  check("state gets mod version + home flag", LASTSENT:find('"modVersion"') and LASTSENT:find('"home":true'), LASTSENT)
end

---------------------------------------------------------------------------
-- vehicle extension
---------------------------------------------------------------------------
local function dev(name, typ, mode, modes)
  local d = { name = name, type = typ, mode = mode, availableModes = modes }
  function d.setMode(self, m) self.mode = m end
  return d
end

local function setupVehicle()
  log = function() end
  electrics = { values = { mode4WD = 1, modeRangeBox = 0, hasESC = 1 } }
  guihooks = { message = function() end }
  controller = { getController = function(n) if n == "esc" then return { toggleESCMode = function() end } end end }
  local D = {
    differential_R = dev("differential_R", "differential", "open", { "open", "locked" }),
    differential_F = dev("differential_F", "differential", "lsd", { "lsd", "locked", "open" }),
    transfercase = dev("transfercase", "splitShaft", "disconnected", { "disconnected", "locked" }),
    rangebox = dev("rangebox", "rangeBox", "high", { "high", "low" }),
  }
  powertrain = { getDevices = function() return D end, setDeviceMode = function(n, m) D[n].mode = m end }
  obj = { queueGameEngineLua = function(_, s) LASTGE = s end }
  local M = fresh("beamng-mod/lua/vehicle/extensions/simdeckVehicle.lua")
  local function state()
    M.report()
    local json = load("return " .. LASTGE:match("onVehicleData%((.*)%) end$"))()
    return json
  end
  return M, D, state
end

do -- diff locks toggle reliably and remember the previous mode
  local M, D = setupVehicle()
  M.command("lock_rear", "down"); check("rear lock on", D.differential_R.mode == "locked")
  M.command("lock_rear", "down"); check("rear lock off", D.differential_R.mode == "open")
  M.command("lock_front", "down"); M.command("lock_front", "down")
  check("front lock returns to lsd", D.differential_F.mode == "lsd", D.differential_F.mode)
end

do -- drivetrain display follows the device, not the (possibly stale) electrics
  local M, D, state = setupVehicle()
  local j = state()
  check("2WD shown although mode4WD=1", j:find('"awd":false', 1, true) ~= nil, j)
  D.transfercase.mode = "locked"; D.rangebox.mode = "low"
  j = state()
  check("4WD shown", j:find('"awd":true', 1, true) ~= nil, j)
  check("low range shown", j:find('"low":true', 1, true) ~= nil, j)
end

do -- ESC mode names are normalised from nested messages / translation keys
  local M, _, state = setupVehicle()
  state() -- hooks guihooks.message
  local cases = {
    { { txt = "vehicle.esc.mode", context = { modeName = { txt = "vehicle.drivingDynamics.mode.comfort" } } }, "vehicle.esc.mode", "comfort" },
    { { txt = "vehicle.esc.mode", context = { modeName = "Sport" } }, "vehicle.esc.mode", "sport" },
    { { txt = "ui.esc.modeChanged", context = { mode = { txt = "esc.modes.off" } } }, "escMode", "off" },
    { { txt = "vehicle.esc.mode", context = { modeName = { txt = "vehicle.esc.regular" } } }, "vehicle.esc.mode", "normal" },
    { "ESC mode: Track", "esc", "track" },
  }
  for _, c in ipairs(cases) do
    guihooks.message(c[1], 2, c[2])
    local j = state()
    check("ESC mode " .. c[3], j:find('"mode":"' .. c[3] .. '"', 1, true) ~= nil, j:match('"esc":{[^}]*}'))
  end
end

do -- rocket fallback holds the jato value
  local M = setupVehicle()
  M.command("rocket", "down"); check("jato on while held", electrics.values.jato == 1)
  M.command("rocket", "up"); check("jato off on release", electrics.values.jato == 0)
end

print(string.format("%d passed, %d failed", passed, failures))
if failures > 0 then os.exit(1) end
