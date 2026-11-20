-- SimDeck – BeamNG.drive <-> Stream Deck bridge (game engine side)
-- Sends the vehicle state via UDP to the Stream Deck plugin (127.0.0.1:47010)
-- and receives commands from the plugin (127.0.0.1:47011).

local M = {}

local VERSION = "dev" -- replaced by the build script
local PLUGIN_PORT = 47010
local LISTEN_PORT = 47011
local HOST = "127.0.0.1"
local INTERVAL = 0.1 -- seconds between state requests

local socket = require("socket")
local udp = nil
local timer = 0
local homeSet = false

local function logI(msg) if log then log("I", "simdeck", msg) end end

local function openSocket()
  if udp then return end
  udp = socket.udp()
  udp:settimeout(0)
  local ok, err = udp:setsockname(HOST, LISTEN_PORT)
  if not ok then
    logI("Could not open port " .. LISTEN_PORT .. ": " .. tostring(err))
  else
    logI("SimDeck " .. VERSION .. " active (state -> " .. PLUGIN_PORT .. ", commands <- " .. LISTEN_PORT .. ")")
  end
end

local function getVeh()
  local ok, veh = pcall(function()
    if be and be.getPlayerVehicle then return be:getPlayerVehicle(0) end
  end)
  if ok and veh then return veh end
  if getPlayerVehicle then
    ok, veh = pcall(getPlayerVehicle, 0)
    if ok then return veh end
  end
  return nil
end

-- gets the vehicle extension (loading it if needed) into the local variable "m"
local ENSURE = 'local m = rawget(_G, "simdeckVehicle") or (extensions and extensions.simdeckVehicle) '
  .. 'if not m then extensions.load("simdeckVehicle") m = rawget(_G, "simdeckVehicle") or extensions.simdeckVehicle end '

---------------------------------------------------------------------------
-- The game's input actions.
-- Instead of guessing, we trigger exactly the action that is also bound to
-- the keyboard (e.g. Alt+S = "toggle4WDStatus"). Its code comes from the
-- input system or directly from the game's action files.
-- Action ids: https://documentation.beamng.com/modding/input/default-keyboard-bindings/
---------------------------------------------------------------------------
local actionCache, actionCacheVeh = nil, nil

local function readActionFile(path, into, vehicleSpecific)
  if not jsonReadFile then return end
  local ok, data = pcall(jsonReadFile, path)
  if ok and type(data) == "table" then
    for id, a in pairs(data) do
      if type(a) == "table" and into[id] == nil then
        if vehicleSpecific then a.cat = a.cat or "vehicle_specific"; a._vehicle = true end
        into[id] = a
      end
    end
  end
end

local function findFiles(dir, pattern)
  if not FS or not FS.findFiles then return {} end
  local ok, files = pcall(function() return FS:findFiles(dir, pattern, 0, false, false) end)
  if ok and type(files) == "table" then return files end
  return {}
end

local function vehicleDir(veh)
  if not veh then return nil end
  for _, fn in ipairs({ "getJBeamFilename", "getField" }) do
    local ok, r = pcall(function()
      if fn == "getField" then return veh:getField("JBeam", "0") end
      return veh[fn](veh)
    end)
    if ok and type(r) == "string" and r ~= "" then return r end
  end
  return nil
end

local function getActions(veh)
  local vdir = vehicleDir(veh)
  if actionCache and actionCacheVeh == vdir then return actionCache end
  local res = {}
  -- 1) active actions from the input system (includes vehicle-specific ones)
  local ia = rawget(_G, "core_input_actions") or (extensions and extensions.core_input_actions)
  if ia then
    for _, fn in ipairs({ "getActiveActions", "getActions", "getAllActions" }) do
      if type(ia[fn]) == "function" then
        local ok, r = pcall(ia[fn])
        if ok and type(r) == "table" and next(r) then
          for id, a in pairs(r) do if type(a) == "table" then res[id] = a end end
          break
        end
      end
    end
  end
  -- 2) vehicle-specific action files
  if vdir then
    for _, f in ipairs(findFiles("/vehicles/" .. vdir .. "/", "input_actions*.json")) do readActionFile(f, res, true) end
  end
  -- 3) the game's general action files
  for _, f in ipairs(findFiles("/lua/ge/extensions/core/input/actions/", "*.json")) do readActionFile(f, res) end
  readActionFile("/lua/ge/extensions/core/input/actions/input_actions.json", res)

  actionCache, actionCacheVeh = res, vdir
  return res
end

-- replaces placeholders the same way the game's input system does
-- (https://documentation.beamng.com/modding/input/actions/)
local function fillPlaceholders(code, value, veh)
  local vid = 0
  if veh then pcall(function() vid = veh:getID() end) end
  local rep = {
    VALUE = tostring(value), FILTERTYPE = "2", PLAYER = "0", ANGLE = "0",
    LOCKTYPE = "0", OSCLOCKHP = "0", VEHICLEID = tostring(vid),
  }
  return (code:gsub("%f[%w_]([%u_]+)%f[^%w_]", function(w) return rep[w] or w end))
end

local function runCode(code, ctx, veh, value)
  if type(code) ~= "string" or code == "" then return false end
  code = fillPlaceholders(code, value, veh)
  local prefix = ""
  ctx = tostring(ctx or "tlua")
  if ctx == "tlua" or ctx == "elua" or ctx == "ge" or ctx == "ts" then
    local f = (loadstring or load)(prefix .. code)
    if not f then return false end
    local ok, err = pcall(f)
    if not ok then logI("Error in action: " .. tostring(err)) end
    return ok
  elseif ctx == "vlua" or ctx == "bvlua" then
    if not veh then return false end
    veh:queueLuaCommand(prefix .. code)
    return true
  end
  return false
end

local function ctxOf(a)
  return a.ctx or (a._vehicle and "vlua") or "tlua"
end

-- trigger an action like a key. phase: "down", "up" or "tap" (press + release)
local function triggerAction(id, veh, phase, a)
  a = a or getActions(veh)[id]
  if type(a) ~= "table" then return false end
  local ctx = ctxOf(a)
  local ok = false
  if phase ~= "up" then
    if a.onDown then ok = runCode(a.onDown, ctx, veh, 1) or ok end
    if a.onChange then ok = runCode(a.onChange, ctx, veh, 1) or ok end
  end
  if phase ~= "down" then
    if a.onChange then ok = runCode(a.onChange, ctx, veh, 0) or ok end
    if a.onUp then ok = runCode(a.onUp, ctx, veh, 0) or ok end
  end
  if ok then logI("Action triggered: " .. id .. " (" .. phase .. ")") end
  return ok
end

-- find a vehicle-specific action by keywords (e.g. rockets)
local function findVehicleAction(veh, words)
  for id, a in pairs(getActions(veh)) do
    if type(a) == "table" and (a._vehicle or a.cat == "vehicle_specific" or a.actionMap == "VehicleSpecific") then
      local h = string.lower(id .. " " .. tostring(a.title) .. " " .. tostring(a.desc))
      for _, w in ipairs(words) do
        if h:find(w, 1, true) then return id, a end
      end
    end
  end
  return nil
end

---------------------------------------------------------------------------
-- Mapping Stream Deck key -> game action
-- actions: the game's action ids (tried in this order)
-- vlua:    fallback code for vehicle Lua if no action was found
-- ge:      fallback code for game engine Lua
-- If none of these is set or all fail, the vehicle extension handles the command.
---------------------------------------------------------------------------
local MAP = {
  drive     = { actions = { "toggle4WDStatus" } },
  range     = { actions = { "toggleRangeStatus" } },
  esc       = { actions = { "toggleESCMode" } },
  repair    = { vlua = "if recovery and recovery.recoverInPlace then recovery.recoverInPlace() else obj:requestReset(RESET_PHYSICS) end" },
  home_save = { actions = { "saveHome" }, vlua = "recovery.saveHome()" },
  home_load = { actions = { "loadHome" }, vlua = "recovery.loadHome()" },
  camera    = { actions = { "switch_camera_next" }, ge = "core_camera.setVehicleCameraByIndexOffset(0, 1)" },
  nos       = { actions = { "toggleNitrousOxide" } },
  selector  = { actions = { "vehicle_selector" } },
  walk      = { actions = { "toggleWalkingMode" } },
  -- rocket: held; vehicle's own action first, otherwise electrics value "jato" (vehicle extension)
  rocket    = { hold = true, vehicleWords = { "jato", "rocket", "rakete", "thruster", "booster" } },
}

local function handleMapped(action, veh, phase)
  local m = MAP[action]
  if not m then return false end
  local p = m.hold and phase or "tap"
  if not m.hold and phase == "up" then return true end
  if m.vehicleWords then
    local id, a = findVehicleAction(veh, m.vehicleWords)
    if id and triggerAction(id, veh, p, a) then return true end
  end
  for _, id in ipairs(m.actions or {}) do
    if triggerAction(id, veh, p) then return true end
  end
  if phase == "up" then return false end
  if m.vlua then
    veh:queueLuaCommand(m.vlua)
    logI("Direct call (vehicle): " .. m.vlua)
    return true
  end
  if m.ge then
    if runCode(m.ge, "tlua", veh, 1) then
      logI("Direct call (GE): " .. m.ge)
      return true
    end
  end
  logI("No game action found for '" .. action .. "' - using vehicle extension")
  return false
end

local function dumpActions(veh)
  actionCache = nil
  local acts = getActions(veh)
  local n = 0
  for _ in pairs(acts) do n = n + 1 end
  logI("==== SimDeck " .. VERSION .. " diagnostics (GE) ====")
  logI("Vehicle folder: " .. tostring(vehicleDir(veh)) .. ", known actions: " .. n)
  local ids = {}
  for id, a in pairs(acts) do
    local h = string.lower(id .. " " .. tostring(a.title) .. " " .. tostring(a.cat))
    if h:find("4wd") or h:find("range") or h:find("diff") or h:find("esc") or h:find("home")
      or h:find("transfer") or h:find("lock") or h:find("awd") or h:find("camera_next")
      or h:find("recover") or h:find("jato") or h:find("nitrous") or h:find("walking")
      or h:find("vehicle_selector") or tostring(a.cat) == "vehicle_specific" or a._vehicle then
      ids[#ids + 1] = id
    end
  end
  table.sort(ids)
  for _, id in ipairs(ids) do
    local a = acts[id]
    logI(string.format("action %s | ctx=%s | cat=%s | onDown=%s | onChange=%s",
      id, tostring(a.ctx), tostring(a.cat), tostring(a.onDown), tostring(a.onChange)))
  end
end

local function handleCommand(data)
  -- format: "<phase> <action>", e.g. "down signal_left"
  local phase, action = string.match(data, "^(%a+)%s+([%w_]+)$")
  if not phase then return end
  local veh = getVeh()
  if not veh then return end

  if phase == "down" and action == "dump" then pcall(dumpActions, veh) end
  if MAP[action] then
    local ok, handled = pcall(handleMapped, action, veh, phase)
    if not ok then logI("Error in '" .. action .. "': " .. tostring(handled)) end
    if action == "home_save" and phase == "down" and ok and handled then homeSet = true end
    if ok and handled then return end
  end

  veh:queueLuaCommand(ENSURE .. string.format('if m then m.command(%q, %q) end', action, phase))
end

local function send(str)
  if udp then udp:sendto(str, HOST, PLUGIN_PORT) end
end

local function onUpdate(dtReal)
  if not udp then openSocket() end
  if not udp then return end

  for _ = 1, 20 do
    local data = udp:receive()
    if not data then break end
    local ok, err = pcall(handleCommand, data)
    if not ok then logI("Command error: " .. tostring(err)) end
  end

  timer = timer + (dtReal or 0)
  if timer < INTERVAL then return end
  timer = 0

  local veh = getVeh()
  if veh then
    veh:queueLuaCommand(ENSURE .. 'if m then m.report() end')
  else
    send('{"game":"beamng","veh":false,"modVersion":"' .. VERSION .. '"}')
  end
end

-- called by the vehicle extension
local function onVehicleData(json)
  local extra = ',"modVersion":"' .. VERSION .. '"' .. (homeSet and ',"home":true' or "")
  json = json:gsub("}%s*$", extra .. "}")
  send(json)
end

-- vehicle changed: re-read the action list
local function onVehicleSwitched() actionCache = nil end
local function onVehicleSpawned() actionCache = nil end

local function onExtensionLoaded()
  openSocket()
end

local function onExtensionUnloaded()
  if udp then udp:close() udp = nil end
end

M.onUpdate = onUpdate
M.onVehicleData = onVehicleData
M.onVehicleSwitched = onVehicleSwitched
M.onVehicleSpawned = onVehicleSpawned
M._handle = handleCommand -- for tests
M.onExtensionLoaded = onExtensionLoaded
M.onExtensionUnloaded = onExtensionUnloaded

return M
