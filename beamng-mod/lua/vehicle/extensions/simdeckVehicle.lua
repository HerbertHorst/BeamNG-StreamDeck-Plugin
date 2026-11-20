-- SimDeck – vehicle side
-- Reads lights, indicators, ESC, drivetrain (2WD/4WD), range, diff locks, engine,
-- parking brake etc. and executes commands from the Stream Deck.
-- Everything is wrapped in pcall: if a car lacks a feature, the Stream Deck key
-- is simply greyed out.

local M = {}

local lastEscMode = nil      -- last reported ESC / drive mode (normalised key or raw name)
local lastEscModeTime = -1
local prevModes = {}         -- last "unlocked" / "connected" mode per device
local hooked = false
local flashPrev = nil        -- light state before flashing the high beams (fallback path)

---------------------------------------------------------------------------
-- small helpers
---------------------------------------------------------------------------
local function ev() return (electrics and electrics.values) or {} end

local function num(v)
  if type(v) == "boolean" then return v and 1 or 0 end
  return tonumber(v) or 0
end

local function jsonStr(s)
  s = tostring(s)
  s = s:gsub('[%c"\\]', function(c)
    if c == '"' then return '\\"' elseif c == '\\' then return '\\\\' end
    return string.format("\\u%04x", string.byte(c))
  end)
  return '"' .. s .. '"'
end

local function toJson(v)
  local t = type(v)
  if t == "table" then
    local parts = {}
    for k, val in pairs(v) do
      parts[#parts + 1] = jsonStr(k) .. ":" .. toJson(val)
    end
    return "{" .. table.concat(parts, ",") .. "}"
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "0" end
    return (string.format("%.3f", v):gsub("%.?0+$", ""))
  elseif t == "boolean" then
    return v and "true" or "false"
  elseif v == nil then
    return "null"
  end
  return jsonStr(v)
end

local function hasValue(list, val)
  if type(list) ~= "table" then return false end
  for _, x in pairs(list) do if x == val then return true end end
  return false
end

---------------------------------------------------------------------------
-- Capture the ESC / drive mode name (the vehicle controllers announce mode
-- changes via guihooks.message – we listen in there)
---------------------------------------------------------------------------
-- known mode names (endings of translation keys) -> normalised key.
-- The Stream Deck plugin translates these keys into the user's language.
local MODE_NAMES = {
  off = "off", disabled = "off", aus = "off", escoff = "off",
  comfort = "comfort", komfort = "comfort", eco = "eco", wet = "wet", snow = "snow",
  regular = "normal", normal = "normal", default = "normal", street = "normal", on = "on",
  sport = "sport", sportplus = "sportplus", track = "track", race = "race", drift = "drift",
  dynamic = "dynamic", offroad = "offroad", rally = "rally",
}

-- gets a readable name from plain text, a translation key or a nested message object
local function textOf(x, depth)
  depth = depth or 0
  if depth > 4 or x == nil then return nil end
  if type(x) == "string" then
    if x == "" then return nil end
    if not x:find(" ") and x:find("%.") then
      local last = x:match("([^%.]+)$") or x
      local key = string.lower(last):gsub("[^%w]", "")
      return MODE_NAMES[key] or (last:sub(1, 1):upper() .. last:sub(2))
    end
    local tail = x:match(":%s*([^:]+)$")
    if tail then x = tail:gsub("%s+$", "") end
    local key = string.lower(x):gsub("[^%w]", "")
    return MODE_NAMES[key] or x
  end
  if type(x) == "number" or type(x) == "boolean" then return tostring(x) end
  if type(x) == "table" then
    local ctx = type(x.context) == "table" and x.context or {}
    -- fixed order; not ipairs, because a missing field (nil) would end the list early
    local cands = { ctx.modeName, ctx.mode, ctx.name, ctx.driveModeName, ctx.escMode,
                    x.modeName, x.name, x.text, x.txt }
    for i = 1, 9 do
      local t = textOf(cands[i], depth + 1)
      if t then return t end
    end
  end
  return nil
end

local function captureMessage(msg, category)
  local cat = string.lower(tostring(category or ""))
  local isEsc = cat:find("esc") or cat:find("drivemode") or cat:find("tcs")
  if type(msg) == "table" then
    local txt = type(msg.txt) == "string" and string.lower(msg.txt) or ""
    if txt:find("esc") or txt:find("drivemode") then isEsc = true end
  elseif type(msg) == "string" then
    local low = string.lower(msg)
    if low:find("esc") or low:find("drive mode") then isEsc = true end
  end
  if not isEsc then return end
  local text = textOf(msg)
  if text then
    lastEscMode = text
    lastEscModeTime = os.clock()
  end
end

local function hookMessages()
  if hooked or not guihooks or not guihooks.message then return end
  hooked = true
  local orig = guihooks.message
  guihooks.message = function(msg, ttl, category, ...)
    pcall(captureMessage, msg, category)
    return orig(msg, ttl, category, ...)
  end
end

---------------------------------------------------------------------------
-- analyse the drivetrain
---------------------------------------------------------------------------
local function getDevices()
  if not powertrain then return {} end
  local ok, devs = pcall(function() return powertrain.getDevices() end)
  if ok and type(devs) == "table" then return devs end
  return {}
end

local function position(name)
  local n = string.lower(tostring(name or ""))
  if n:find("transfer") or n:find("center") or n:find("centre") or n:match("_c$") then return "C" end
  if n:find("front") or n:match("_f$") or n:match("_f%d$") then return "F" end
  if n:find("rear") or n:match("_r$") or n:match("_r%d$") then return "R" end
  return "C"
end

local function scanDrivetrain()
  local res = { drive = nil, range = nil, lockF = nil, lockR = nil, lockC = nil }
  for name, dev in pairs(getDevices()) do
    if type(dev) == "table" then
      local modes = dev.availableModes
      local dtype = string.lower(tostring(dev.type or ""))
      local dname = dev.name or name
      if dtype == "rangebox" or (hasValue(modes, "low") and hasValue(modes, "high")) then
        res.range = res.range or dev
      end
      if hasValue(modes, "disconnected") then
        res.drive = res.drive or dev
      end
      if hasValue(modes, "locked") then
        local p = position(dname)
        local key = "lock" .. p
        if not res[key] then res[key] = dev end
      end
    end
  end
  return res
end

local function logI(msg) if log then log("I", "simdeck", msg) end end
local cycleDrive, toggleRange, callControllers, nosState, rocketState

-- Switches a drivetrain device. direct = true sets the mode in one step
-- (used for diff locks); otherwise it toggles like the game UI does
-- (powertrain.toggleDeviceMode) and only sets the mode directly as a last resort.
local function setDeviceMode(dev, mode, direct)
  if not dev or not mode or dev.mode == mode then return end
  local name = dev.name
  local modes = type(dev.availableModes) == "table" and #dev.availableModes or 2

  if direct and powertrain and powertrain.setDeviceMode and name then
    if pcall(powertrain.setDeviceMode, name, mode) and dev.mode == mode then
      logI("Mode " .. tostring(name) .. " -> " .. mode .. " (setDeviceMode)")
      return
    end
  end

  if not direct and powertrain and powertrain.toggleDeviceMode and name then
    for _ = 1, math.max(modes, 2) do
      local before = dev.mode
      if not pcall(powertrain.toggleDeviceMode, name) then break end
      if dev.mode == mode then
        logI("Mode " .. tostring(name) .. " -> " .. mode .. " (toggleDeviceMode)")
        return
      end
      if dev.mode == before then
        -- switching is delayed: stop toggling, otherwise it would jump back
        logI("Mode " .. tostring(name) .. ": toggleDeviceMode delayed, target " .. mode)
        return
      end
    end
  end
  if powertrain and powertrain.setDeviceMode and name then
    if pcall(powertrain.setDeviceMode, name, mode) and dev.mode == mode then
      logI("Mode " .. tostring(name) .. " -> " .. mode .. " (setDeviceMode)")
      return
    end
  end
  if dev.setMode then
    pcall(dev.setMode, dev, mode)
    logI("Mode " .. tostring(name) .. " -> " .. mode .. " (direct, result: " .. tostring(dev.mode) .. ")")
  end
end

local function firstOther(modes, exclude)
  if type(modes) ~= "table" then return nil end
  for _, m in ipairs(modes) do if m ~= exclude then return m end end
  return nil
end

---------------------------------------------------------------------------
-- ESC
---------------------------------------------------------------------------
local function getController(name)
  if not controller then return nil end
  local c = nil
  if controller.getController then
    local ok, r = pcall(controller.getController, name)
    if ok then c = r end
  end
  return c
end

local function getEsc()
  local c = getController("esc")
  if c then return c, "esc" end
  c = getController("driveModes")
  if c then return c, "driveModes" end
  return nil
end

local function escState()
  local e = ev()
  local c, kind = getEsc()
  local has = c ~= nil or e.hasESC == 1 or e.hasESC == true
  local name = lastEscMode
  if not name and c then
    for _, f in ipairs({ "getCurrentESCModeName", "getCurrentModeName", "getCurrentDriveModeName" }) do
      if type(c[f]) == "function" then
        local ok, r = pcall(c[f])
        if ok and r then name = textOf(r) if name then break end end
      end
    end
  end
  local active = num(e.escActive) > 0 or num(e.tcsActive) > 0
  return { has = has, mode = name, light = num(e.esc) > 0, active = active, kind = kind }
end

local function toggleEsc()
  local c, kind = getEsc()
  if not c then return end
  local fns = (kind == "esc") and { "toggleESCMode", "toggleESC", "nextESCMode" }
                              or { "nextDriveMode", "toggleDriveMode" }
  for _, f in ipairs(fns) do
    if type(c[f]) == "function" then
      if pcall(c[f]) then return end
    end
  end
end

---------------------------------------------------------------------------
-- report state
---------------------------------------------------------------------------
-- nitrous: BeamNG creates electrics values with "nitrous"/"n2o" in their names
nosState = function(e)
  local has, on = false, false
  for k, v in pairs(e) do
    local lk = string.lower(k)
    if lk:find("nitrous") or lk:find("n2o") then
      has = true
      if (lk:find("active") or lk:find("armed") or lk:find("enabled")) and num(v) > 0 then on = true end
    end
  end
  return { has = has, on = on }
end

-- rockets/JATO: thrusters are controlled by an electrics value (default "jato"),
-- see https://documentation.beamng.com/modding/vehicle/sections/thrusters
rocketState = function(e)
  local has = e.jato ~= nil
  if not has then
    local ok, r = pcall(function() return v and v.data and v.data.thrusters and next(v.data.thrusters) ~= nil end)
    has = ok and r or false
  end
  return { has = has, on = num(e.jato) > 0 }
end

local function report()
  hookMessages()
  local e = ev()
  local dt = scanDrivetrain()
  local esc = escState()

  local lockInfo = function(dev)
    if not dev then return { has = false } end
    return { has = true, on = dev.mode == "locked" }
  end

  local speed = num(e.wheelspeed ~= nil and e.wheelspeed or e.airspeed) * 3.6

  local data = {
    game = "beamng",
    veh = true,
    sigL = num(e.signal_left_input) > 0,
    sigR = num(e.signal_right_input) > 0,
    haz = num(e.hazard_enabled) > 0,
    blinkL = num(e.signal_L) > 0,
    blinkR = num(e.signal_R) > 0,
    lights = num(e.lights_state),
    fog = num(e.fog) > 0,
    esc = esc,
    -- state read directly from the device (follows every switch, whether by mouse, keyboard
    -- or Stream Deck); the 4WD controller's electrics (mode4WD / modeRangeBox) only as fallback
    drive = dt.drive and { has = true, awd = dt.drive.mode ~= "disconnected" }
         or ((e.mode4WD ~= nil) and { has = true, awd = num(e.mode4WD) > 0 } or { has = false }),
    range = dt.range and { has = true, low = dt.range.mode == "low" }
         or ((e.modeRangeBox ~= nil) and { has = true, low = num(e.modeRangeBox) > 0 } or { has = false }),
    lockF = lockInfo(dt.lockF),
    lockR = lockInfo(dt.lockR),
    lockC = lockInfo(dt.lockC),
    engine = num(e.engineRunning) > 0,
    ign = num(e.ignitionLevel),
    pbrake = num(e.parkingbrake),
    gear = tostring(e.gear or e.gearIndex or "N"),
    speed = speed,
    horn = num(e.horn) > 0,
    lightbar = { has = e.lightbar ~= nil, mode = num(e.lightbar) },
    nos = nosState(e),
    rocket = rocketState(e),
  }

  if obj and obj.queueGameEngineLua then
    obj:queueGameEngineLua('local m = rawget(_G, "simdeck") or (extensions and extensions.simdeck) if m then m.onVehicleData('
      .. string.format("%q", toJson(data)) .. ') end')
  end
end

---------------------------------------------------------------------------
-- commands
---------------------------------------------------------------------------
local function toggleLock(dev)
  if not dev then return end
  local key = (dev.name or "?") .. "#lock"
  if dev.mode == "locked" then
    local back = prevModes[key]
    if not back or back == "locked" or not hasValue(dev.availableModes, back) then
      back = firstOther(dev.availableModes, "locked")
    end
    setDeviceMode(dev, back, true)
  else
    prevModes[key] = dev.mode
    setDeviceMode(dev, "locked", true)
  end
end

local function setParkingBrake(value)
  if input and input.event then
    local filter = FILTER_DIRECT or 2
    if pcall(input.event, "parkingbrake", value, filter) then return end
  end
  if input and input.toggleEvent then pcall(input.toggleEvent, "parkingbrake") end
end

local function engineDown()
  local mc = controller and controller.mainController
  if not mc then return end
  if num(ev().engineRunning) > 0 then
    if mc.setEngineIgnition then pcall(mc.setEngineIgnition, false) end
  else
    if mc.setEngineIgnition then pcall(mc.setEngineIgnition, true) end
    if mc.setStarter then pcall(mc.setStarter, true) end
  end
end

local function engineUp()
  local mc = controller and controller.mainController
  if mc and mc.setStarter then pcall(mc.setStarter, false) end
end

-- drivetrain and range as one cycle, so "2L" can never happen
local function connectedMode(dev)
  local key = (dev.name or "?") .. "#drive"
  return prevModes[key] or firstOther(dev.availableModes, "disconnected")
end

local function setDrive(dev, awd)
  if not dev then return end
  if awd and dev.mode == "disconnected" then
    setDeviceMode(dev, connectedMode(dev))
  elseif not awd and dev.mode ~= "disconnected" then
    prevModes[(dev.name or "?") .. "#drive"] = dev.mode
    setDeviceMode(dev, "disconnected")
  end
end

local function setRange(dev, low)
  if not dev then return end
  setDeviceMode(dev, low and "low" or "high")
end

cycleDrive = function()
  local dt = scanDrivetrain()
  local drive, range = dt.drive, dt.range
  local awd = drive == nil or drive.mode ~= "disconnected"
  local low = range ~= nil and range.mode == "low"
  if drive and range then
    if not awd then            -- 2H -> 4H
      setRange(range, false); setDrive(drive, true)
    elseif not low then        -- 4H -> 4L
      setRange(range, true)
    else                       -- 4L -> 2H
      setRange(range, false); setDrive(drive, false)
    end
  elseif drive then            -- only 2WD/4WD
    setDrive(drive, not awd)
  elseif range then            -- permanent AWD: 4H <-> 4L
    setRange(range, not low)
  end
end

toggleRange = function()
  local dt = scanDrivetrain()
  if not dt.range then return end
  local low = dt.range.mode == "low"
  if not low and dt.drive and dt.drive.mode == "disconnected" then
    setDrive(dt.drive, true)   -- low range only with 4WD
  end
  setRange(dt.range, not low)
end

-- calls a function on all controllers of a type (like the game actions do)
callControllers = function(ctype, fname)
  if not controller or type(controller.getControllersByType) ~= "function" then return false end
  local ok, list = pcall(controller.getControllersByType, ctype)
  if not ok or type(list) ~= "table" then return false end
  local called = false
  for _, c in pairs(list) do
    if type(c) == "table" and type(c[fname]) == "function" then
      if pcall(c[fname]) then called = true end
    end
  end
  if called then logI("Controller " .. ctype .. "." .. fname .. " called") end
  return called
end

local handlers = {
  signal_left  = { down = function() electrics.toggle_left_signal() end },
  signal_right = { down = function() electrics.toggle_right_signal() end },
  hazard       = { down = function() electrics.toggle_warn_signal() end },
  lowbeam      = { down = function()
                    local s = num(ev().lights_state)
                    electrics.setLightsState(s == 0 and 1 or 0)
                  end },
  highbeam     = { down = function()
                    local s = num(ev().lights_state)
                    electrics.setLightsState(s == 2 and 1 or 2)
                  end },
  fog          = { down = function() electrics.toggle_fog_lights() end },
  flash        = { down = function()
                    if electrics.light_flash_highbeams then electrics.light_flash_highbeams(true)
                    else flashPrev = num(ev().lights_state); electrics.setLightsState(2) end
                  end,
                   up   = function()
                    if electrics.light_flash_highbeams then electrics.light_flash_highbeams(false)
                    elseif flashPrev then electrics.setLightsState(flashPrev); flashPrev = nil end
                  end },
  lightbar     = { down = function()
                    if electrics.toggle_lightbar_signal then electrics.toggle_lightbar_signal()
                    elseif electrics.set_lightbar_signal then
                      electrics.set_lightbar_signal((num(ev().lightbar) + 1) % 3)
                    end
                  end },
  horn         = { down = function() electrics.horn(true) end,
                   up   = function() electrics.horn(false) end },
  esc          = { down = toggleEsc },
  -- fallback if the game action was not found:
  -- 1) the official 4WD controller, 2) directly on the device
  drive        = { down = function()
                    if callControllers("4wd", "toggle4WD") then return end
                    cycleDrive()
                  end },
  range        = { down = function()
                    if callControllers("4wd", "toggleRange") then return end
                    toggleRange()
                  end },
  rocket       = { down = function() electrics.values.jato = 1 end,
                   up   = function() electrics.values.jato = 0 end },
  lock_front   = { down = function() toggleLock(scanDrivetrain().lockF) end },
  lock_rear    = { down = function() toggleLock(scanDrivetrain().lockR) end },
  lock_center  = { down = function() toggleLock(scanDrivetrain().lockC) end },
  parkbrake    = { down = function()
                    local e = ev()
                    local on = num(e.parkingbrake_input or e.parkingbrake) > 0.5
                    setParkingBrake(on and 0 or 1)
                  end },
  engine       = { down = engineDown, up = engineUp },
  dump         = { down = function() M.dump() end },
}

local function command(action, phase)
  local h = handlers[action]
  if not h then return end
  local fn = h[phase]
  if fn then
    local ok, err = pcall(fn)
    if not ok and log then log("W", "simdeck", "Action " .. action .. " failed: " .. tostring(err)) end
  end
end

-- diagnostics: writes everything relevant to the BeamNG log (open the console with ~)
function M.dump()
  local out = { "==== SimDeck diagnostics (vehicle) ====" }
  for name, dev in pairs(getDevices()) do
    if type(dev) == "table" then
      local modes = type(dev.availableModes) == "table" and table.concat(dev.availableModes, ",") or "-"
      out[#out + 1] = string.format("device %s type=%s mode=%s modes=%s", tostring(dev.name or name), tostring(dev.type), tostring(dev.mode), modes)
    end
  end
  local function fnNames(t)
    local r = {}
    if type(t) == "table" then for k, v in pairs(t) do if type(v) == "function" then r[#r + 1] = k end end end
    table.sort(r)
    return table.concat(r, ",")
  end
  out[#out + 1] = "powertrain functions: " .. fnNames(powertrain)
  out[#out + 1] = "controller functions: " .. fnNames(controller)
  for _, getter in ipairs({ "getAllControllers", "getControllers" }) do
    if controller and type(controller[getter]) == "function" then
      local ok, all = pcall(controller[getter])
      if ok and type(all) == "table" then
        for k, c in pairs(all) do
          local cname = type(c) == "table" and (c.name or c.typeName) or nil
          out[#out + 1] = "controller " .. tostring(cname or k) .. ": " .. fnNames(c)
        end
        break
      end
    end
  end
  local c, kind = getEsc()
  out[#out + 1] = "esc controller: " .. tostring(kind) .. " lastMode=" .. tostring(lastEscMode)
  if c then
    local fns = {}
    for k, v in pairs(c) do if type(v) == "function" then fns[#fns + 1] = k end end
    table.sort(fns)
    out[#out + 1] = "esc functions: " .. table.concat(fns, ",")
  end
  local keys = {}
  for k, v in pairs(ev()) do
    local lk = string.lower(k)
    if lk:find("esc") or lk:find("tcs") or lk:find("signal") or lk:find("light") or lk:find("4wd")
      or lk:find("range") or lk:find("lock") or lk:find("mode") or lk:find("parking") or lk:find("fog") then
      keys[#keys + 1] = k .. "=" .. tostring(v)
    end
  end
  table.sort(keys)
  out[#out + 1] = "electrics: " .. table.concat(keys, " ")
  for _, line in ipairs(out) do
    if log then log("I", "simdeck", line) else print(line) end
  end
end

M.report = report
M.command = command
M.onExtensionLoaded = hookMessages

return M
