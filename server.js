const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// script của bạn
const scripts = {
  "abc123": `
-- =====================================================================
-- 0. ANTI-DUPLICATE (FIX TRIỆT ĐỂ CHO WAVE / SOLARA)
-- =====================================================================
-- Dự phòng môi trường: Nếu getgenv() của Wave bị hỏng thì tự lùi về _G
local env = (type(getgenv) == "function" and getgenv()) or _G or shared

if env.ZiliHub_Loaded then
    warn("[ZILI NOTIFY] Script is already running! Execution blocked to prevent crash.")
    
    -- Dùng trick tạo Event ảo để ép dừng luồng script vĩnh viễn
    -- Đảm bảo 100% ngắt được script trên mọi loại Executor mà không văng lỗi đỏ
    local freezeThread = Instance.new("BindableEvent")
    freezeThread.Event:Wait() 
    return 
end

env.ZiliHub_Loaded = true

-- =====================================================================
-- 1. BUNDLER SYSTEM (Allows Executor to understand 'require')
-- =====================================================================
local __modules = {}
local __cache = {}

local original_require = require

local function require(path)
    if typeof(path) == "Instance" then
        return original_require(path)
    end

    if __cache[path] then return __cache[path] end
    local loader = __modules[path]
    if not loader then error("Error: Module not found -> " .. tostring(path)) end
    local result = loader()
    __cache[path] = result
    return result
end

-- =====================================================================
-- 2. MODULE PACKAGING (All logic packed into one file)
-- =====================================================================

-- 📦 MODULE: Config/ConfigManager
__modules["Config/ConfigManager"] = function()
    local ConfigManager = {}
    local HttpService  = game:GetService("HttpService")
    local TweenService = game:GetService("TweenService")
    local ConfigFolder = "Zili_Hub"

    if isfolder and not isfolder(ConfigFolder) then makefolder(ConfigFolder) end

    -- =====================================================================
    -- Keys có .Value cần lưu (dropdown / textbox)
    -- =====================================================================
    local VALUE_KEYS = {
        -- Fishing page
        "Config_SelectBait",
        "Config_SellFish",
        "Config_BuyItems",
        "Config_CraftBait",
        "Config_FruitRarity",
        "Config_FruitSelect",
        "Config_Webhook",
        -- Lobby page
        "Config_TargetRace",
        "Config_SelectedHub",
        "Config_SelectedSea",
        "Config_PSCode",
    }

    function ConfigManager.Init(UI, AutoStatsData, TogglesData)

        -- ── Notification ──────────────────────────────────────────────
        local function ShowNotify(titleText, contentText)
            local sg = Instance.new("ScreenGui")
            sg.Name = "ZiliConfigNotify"
            if gethui then sg.Parent = gethui() else sg.Parent = game:GetService("CoreGui") end

            local notif = Instance.new("Frame", sg)
            notif.Size         = UDim2.new(0, 270, 0, 68)
            notif.Position     = UDim2.new(1, 290, 1, -88)
            notif.AnchorPoint  = Vector2.new(1, 1)
            notif.BackgroundColor3 = Color3.fromRGB(10, 11, 24)   -- BG1
            notif.BorderSizePixel  = 0
            Instance.new("UICorner", notif).CornerRadius = UDim.new(0, 9)

            -- Gold left accent bar
            local accent = Instance.new("Frame", notif)
            accent.Size              = UDim2.new(0, 3, 0.7, 0)
            accent.Position          = UDim2.new(0, 0, 0.15, 0)
            accent.BackgroundColor3  = Color3.fromRGB(201, 148, 58)  -- GOLD
            accent.BorderSizePixel   = 0
            Instance.new("UICorner", accent).CornerRadius = UDim.new(0, 2)

            -- Outer border stroke
            local stroke = Instance.new("UIStroke", notif)
            stroke.Color       = Color3.fromRGB(201, 148, 58)  -- GOLD
            stroke.Thickness   = 1.5
            stroke.Transparency = 0.2

            -- Top-left subtle glow bg strip
            local topBar = Instance.new("Frame", notif)
            topBar.Size              = UDim2.new(1, 0, 0, 26)
            topBar.BackgroundColor3  = Color3.fromRGB(14, 15, 32)  -- BG2
            topBar.BorderSizePixel   = 0
            Instance.new("UICorner", topBar).CornerRadius = UDim.new(0, 9)
            -- extend bottom corners of topBar
            local topBarExt = Instance.new("Frame", topBar)
            topBarExt.Size             = UDim2.new(1, 0, 0, 9)
            topBarExt.Position         = UDim2.new(0, 0, 1, -9)
            topBarExt.BackgroundColor3 = Color3.fromRGB(14, 15, 32)
            topBarExt.BorderSizePixel  = 0

            local title = Instance.new("TextLabel", notif)
            title.Size                = UDim2.new(1, -22, 0, 22)
            title.Position            = UDim2.new(0, 14, 0, 3)
            title.BackgroundTransparency = 1
            title.Text                = titleText
            title.TextColor3          = Color3.fromRGB(240, 190, 104)  -- GOLD2
            title.Font                = Enum.Font.GothamBold
            title.TextSize            = 13
            title.TextXAlignment      = Enum.TextXAlignment.Left

            local content = Instance.new("TextLabel", notif)
            content.Size              = UDim2.new(1, -22, 0, 36)
            content.Position          = UDim2.new(0, 14, 0, 28)
            content.BackgroundTransparency = 1
            content.Text              = contentText
            content.TextColor3        = Color3.fromRGB(237, 232, 218)  -- TEXT1
            content.Font              = Enum.Font.GothamSemibold
            content.TextSize          = 12
            content.TextXAlignment    = Enum.TextXAlignment.Left
            content.TextWrapped       = true

            -- Slide in from right
            TweenService:Create(notif, TweenInfo.new(0.45, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
                {Position = UDim2.new(1, -14, 1, -88)}):Play()

            task.delay(3, function()
                local fade = TweenService:Create(notif,
                    TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
                    {Position = UDim2.new(1, 290, 1, -88), BackgroundTransparency = 1})
                fade:Play()
                fade.Completed:Connect(function() sg:Destroy() end)
            end)
        end

        -- ── Deep-copy helper ──────────────────────────────────────────
        local function DeepCopy(v)
            if type(v) == "table" then
                local t = {}
                for k, val in pairs(v) do t[k] = DeepCopy(val) end
                return t
            end
            return v
        end

        -- ── Save ──────────────────────────────────────────────────────
        local function GetCurrentSettings()
            local settings = { Stats = {}, Toggles = {}, Values = {} }

            -- Stats (AutoStatsData)
            if AutoStatsData then
                for stat, data in pairs(AutoStatsData) do
                    local currentCap = data.Cap
                    if data.Box and data.Box.Text ~= "" then
                        currentCap = tonumber(data.Box.Text) or currentCap
                    end
                    settings.Stats[stat] = { Active = data.Active, Cap = currentCap }
                end
            end

            -- Toggles  Active state
            if TogglesData then
                for key, data in pairs(TogglesData) do
                    settings.Toggles[key] = data.Active or false
                end
            end

            -- Values (dropdown / textbox) – lưu riêng để dễ restore
            if TogglesData then
                for _, key in ipairs(VALUE_KEYS) do
                    local data = TogglesData[key]
                    if data and data.Value ~= nil then
                        local v = DeepCopy(data.Value)
                        -- sanitise multi-select: bỏ các key false/nil, chỉ giữ true
                        if type(v) == "table" then
                            local clean = {}
                            for k, val in pairs(v) do if val == true then clean[k] = true end end
                            v = clean
                        end
                        settings.Values[key] = v
                    end
                end
            end

            return settings
        end

        -- ── Restore ───────────────────────────────────────────────────
        -- Pill toggle exact colors (must match MainHub constants)
        local BG5   = Color3.fromRGB(8, 9, 20)
        local GOLDD = Color3.fromRGB(50, 37, 12)
        local GOLD2 = Color3.fromRGB(240, 190, 104)
        local GOLD3 = Color3.fromRGB(122, 90, 30)
        local TEXT3 = Color3.fromRGB(80, 75, 100)
        local GREEN = Color3.fromRGB(56, 190, 110)
        local GOLD  = Color3.fromRGB(201, 148, 58)

        local function ApplySettings(settings)

            -- ── Stats ─────────────────────────────────────────────────
            if settings.Stats and AutoStatsData then
                for statName, savedData in pairs(settings.Stats) do
                    local data = AutoStatsData[statName]
                    if data then
                        data.Active = savedData.Active or false
                        data.Cap    = savedData.Cap    or 0
                        if data.Box then
                            data.Box.Text = data.Cap > 0 and tostring(data.Cap) or ""
                        end
                        -- Colors matched exactly to addStats.lua logic
                        local tColor   = data.Active and Color3.fromRGB(120,90,0)   or BG5
                        local sColor   = data.Active and GOLD2                       or GOLD3
                        local txtColor = data.Active and Color3.fromRGB(10,8,2)     or GOLD2
                        if data.Btn then
                            TweenService:Create(data.Btn, TweenInfo.new(0.2), {BackgroundColor3=tColor}):Play()
                            data.Btn.TextColor3 = txtColor
                            data.Btn.Text = data.Active and "● Adding..." or "Auto Add"
                        end
                        if data.Strk then
                            TweenService:Create(data.Strk, TweenInfo.new(0.2), {Color=sColor}):Play()
                        end
                    end
                end
            end

            -- ── Values: restore TRƯỚC Toggles ────────────────────────
            if settings.Values and TogglesData then
                for _, key in ipairs(VALUE_KEYS) do
                    local saved = settings.Values[key]
                    local data  = TogglesData[key]
                    if saved ~= nil and data then
                        data.Value = DeepCopy(saved)
                        -- Callback cập nhật UI (dropdown badge, buy items checkmarks, etc.)
                        if data.Callback then
                            pcall(function() data.Callback(data.Value) end)
                        end
                    end
                end
            end

            -- ── Toggles: restore Active + visual + callback ───────────
            if settings.Toggles and TogglesData then
                for toggleName, savedState in pairs(settings.Toggles) do
                    local data = TogglesData[toggleName]
                    if not data then continue end

                    -- Always apply (không skip khi giá trị giống nhau vì UI chưa đúng)
                    data.Active = savedState == true

                    local on = data.Active

                    -- Pill toggle: Btn, Strk, Thumb
                    if data.Btn then
                        TweenService:Create(data.Btn, TweenInfo.new(0.2),
                            {BackgroundColor3 = on and GOLDD or BG5}):Play()
                    end
                    if data.Strk then
                        TweenService:Create(data.Strk, TweenInfo.new(0.2),
                            {Color = on and GOLD2 or GOLD3}):Play()
                    end
                    if data.Thumb then
                        TweenService:Create(data.Thumb, TweenInfo.new(0.2), {
                            BackgroundColor3 = on and GOLD2 or TEXT3,
                            Position         = on and UDim2.new(1,-20,0.5,-8) or UDim2.new(0,4,0.5,-8),
                        }):Play()
                    end

                    -- Special: AutoFishMerchant có MasterBar riêng
                    if data.MasterBar then
                        TweenService:Create(data.MasterBar, TweenInfo.new(0.35),
                            {BackgroundColor3 = on and GREEN or GOLD}):Play()
                    end

                    -- Callback (start/stop module, etc.) — chỉ gọi nếu cần
                    if data.Callback then
                        pcall(function() data.Callback(on) end)
                    end
                end
            end
            -- ── Lobby Values: restore race, hub, sea, PS code ────────────
            if settings.Values and TogglesData then
                -- TargetRace
                local raceVal = settings.Values["Config_TargetRace"]
                if type(raceVal) == "string" and raceVal ~= "" then
                    getgenv().TargetRace = raceVal
                    -- visual update handled by caller (SyncDropdownUI)
                end
                -- SelectedHub
                local hubVal = settings.Values["Config_SelectedHub"]
                if type(hubVal) == "string" and hubVal ~= "" then
                    getgenv().SelectedHub = hubVal
                end
                -- SelectedSea
                local seaVal = settings.Values["Config_SelectedSea"]
                if type(seaVal) == "string" and seaVal ~= "" then
                    getgenv().SelectedSea = seaVal
                end
                -- PSCode
                local psVal = settings.Values["Config_PSCode"]
                if type(psVal) == "string" then
                    getgenv().PSCode = psVal
                    -- sync textbox if present via TogglesData ref
                    local psData = TogglesData["Config_PSCode"]
                    if psData and psData.HeadBtn then
                        psData.HeadBtn.Text = psVal
                    end
                end
            end
        end
        local function SyncDropdownUI()
            if not TogglesData then return end
            for _, key in ipairs(VALUE_KEYS) do
                local data = TogglesData[key]
                if not data or data.Value == nil then continue end
                if type(data.Value) == "table" then
                    if data.Callback then
                        pcall(function() data.Callback(data.Value) end)
                    elseif data.HeadBtn then
                        local ct = 0
                        for _, v in pairs(data.Value) do if v then ct = ct + 1 end end
                        data.HeadBtn.Text = ct > 0 and (ct .. " Selected") or "Select..."
                    end
                else
                    if data.HeadBtn then
                        data.HeadBtn.Text = tostring(data.Value ~= "" and data.Value or "Select...")
                    end
                end
            end

            -- ── Lobby: Race buttons ────────────────────────────────────
            pcall(function()
                local rData = TogglesData["Config_TargetRace"]
                if rData and rData.UpdateFn then rData.UpdateFn() end
            end)
            -- ── Lobby: Hub buttons ─────────────────────────────────────
            pcall(function()
                local hData = TogglesData["Config_SelectedHub"]
                if hData and hData.UpdateFn then hData.UpdateFn() end
            end)
            -- ── Lobby: Sea toggles ─────────────────────────────────────
            pcall(function()
                local sea = getgenv().SelectedSea or "Sea 1"
                for _, kv in ipairs({{"Sea1Toggle", sea=="Sea 1"}, {"Sea2Toggle", sea=="Sea 2"}}) do
                    local key, on = kv[1], kv[2]
                    local d = TogglesData[key]
                    if not d then continue end
                    d.Active = on
                    if d.Btn  then TweenService:Create(d.Btn,  TweenInfo.new(0.2), {BackgroundColor3=on and GOLDD or BG5}):Play() end
                    if d.Strk then TweenService:Create(d.Strk, TweenInfo.new(0.2), {Color=on and GOLD2 or GOLD3}):Play() end
                    if d.Thumb then TweenService:Create(d.Thumb, TweenInfo.new(0.2), {
                        BackgroundColor3=on and GOLD2 or TEXT3,
                        Position=on and UDim2.new(1,-20,0.5,-8) or UDim2.new(0,4,0.5,-8),
                    }):Play() end
                end
            end)
        end

        -- ── Refresh config list ───────────────────────────────────────
        local function Refresh()
            if not UI.ConfigList then return end
            for _, child in ipairs(UI.ConfigList:GetChildren()) do
                if child:IsA("TextButton") then child:Destroy() end
            end
            local files = {}
            pcall(function() files = listfiles(ConfigFolder) end)
            for _, filePath in ipairs(files) do
                pcall(function()
                    local fileName = filePath:match("([^/\\]+)%.json$")
                    if not fileName then return end
                    local btn = Instance.new("TextButton", UI.ConfigList)
                    btn.Size = UDim2.new(1, -10, 0, 35)
                    btn.BackgroundColor3 = Color3.fromRGB(45, 45, 45)
                    btn.Text = " 📄 " .. fileName .. ".json"
                    btn.TextColor3 = Color3.fromRGB(255, 255, 255)
                    btn.Font = Enum.Font.GothamSemibold; btn.TextSize = 14; btn.ZIndex = 15
                    Instance.new("UICorner", btn).CornerRadius = UDim.new(0, 6)
                    btn.MouseButton1Click:Connect(function()
                        if UI.ConfigNameBox then UI.ConfigNameBox.Text = fileName end
                        for _, c in ipairs(UI.ConfigList:GetChildren()) do
                            if c:IsA("TextButton") then c.BackgroundColor3 = Color3.fromRGB(45, 45, 45) end
                        end
                        btn.BackgroundColor3 = Color3.fromRGB(100, 160, 225)
                    end)
                end)
            end
        end

        -- ── Buttons ───────────────────────────────────────────────────
        UI.CreateBtn.MouseButton1Click:Connect(function()
            if not UI.ConfigNameBox or UI.ConfigNameBox.Text == "" then return end
            local name = UI.ConfigNameBox.Text
            writefile(ConfigFolder.."/"..name..".json", HttpService:JSONEncode(GetCurrentSettings()))
            Refresh()
            ShowNotify("✅ Create Config", "Created: " .. name)
        end)

        UI.SaveBtn.MouseButton1Click:Connect(function()
            if not UI.ConfigNameBox or UI.ConfigNameBox.Text == "" then return end
            local name = UI.ConfigNameBox.Text
            writefile(ConfigFolder.."/"..name..".json", HttpService:JSONEncode(GetCurrentSettings()))
            ShowNotify("💾 Save Config", "Saved: " .. name)
        end)

        UI.LoadBtn.MouseButton1Click:Connect(function()
            if not UI.ConfigNameBox or UI.ConfigNameBox.Text == "" then return end
            local path = ConfigFolder.."/"..UI.ConfigNameBox.Text..".json"
            if isfile(path) then
                local ok, decoded = pcall(function() return HttpService:JSONDecode(readfile(path)) end)
                if ok then
                    ApplySettings(decoded)
                    SyncDropdownUI()
                    ShowNotify("📂 Load Config", "Loaded: " .. UI.ConfigNameBox.Text)
                end
            end
        end)

        UI.DeleteBtn.MouseButton1Click:Connect(function()
            if not UI.ConfigNameBox or UI.ConfigNameBox.Text == "" then return end
            local path = ConfigFolder.."/"..UI.ConfigNameBox.Text..".json"
            if isfile(path) then
                delfile(path); Refresh()
                ShowNotify("🗑 Delete Config", "Deleted: " .. UI.ConfigNameBox.Text)
                UI.ConfigNameBox.Text = ""
            end
        end)

        UI.RefreshBtn.MouseButton1Click:Connect(Refresh)

        if UI.SetAutoLoadBtn then
            UI.SetAutoLoadBtn.MouseButton1Click:Connect(function()
                if not UI.ConfigNameBox or UI.ConfigNameBox.Text == "" then return end
                local name = UI.ConfigNameBox.Text
                writefile(ConfigFolder.."/autoload.txt", name)
                ShowNotify("⭐ Auto Load Set", "Will auto load: " .. name)
            end)
        end

        -- ── Auto load on start ────────────────────────────────────────
        local autoLoadPath = ConfigFolder.."/autoload.txt"
        if isfile(autoLoadPath) then
            local ok, autoLoadName = pcall(function() return readfile(autoLoadPath) end)
            if ok and autoLoadName and autoLoadName ~= "" then
                local path = ConfigFolder.."/"..autoLoadName..".json"
                if isfile(path) then
                    local ok2, decoded = pcall(function() return HttpService:JSONDecode(readfile(path)) end)
                    if ok2 then
                        ApplySettings(decoded)
                        SyncDropdownUI()
                        if UI.ConfigNameBox then UI.ConfigNameBox.Text = autoLoadName end
                        ShowNotify("⚡ Auto Loaded", "Config: " .. autoLoadName)
                    end
                end
            end
        end

        Refresh()
    end

    return ConfigManager
end


-- 📦 MODULE: IslandData.lua
__modules["Island/IslandData"] = function()
    local IslandData = {
        ["???? Shrine"] = Vector3.new(-7348.86, 3.27, -14950.54), -- co
        ["A Rock"] = Vector3.new(2534.69, 7.33, -8370.14), -- co
        ["Coco Island"] = Vector3.new(-3086.87, 94.54, -11755.48), -- co
        ["Colosseum"] = Vector3.new(-2031.47, 6.85, -7666.31), -- co
        ["Fishman Cave"] = Vector3.new(1842.72, 3.84, -12170.62), -- co
        ["Fishman Islands"] = Vector3.new(1791.87, -94.83, -12327.67),   
        ["Gravito's Fort"] = Vector3.new(264.84, 7.64, -11477.32), -- co
        ["Island Of Zou"] = Vector3.new(-3121.06, 11.73, -5256.59), -- co
        ["Kori Island"] = Vector3.new(-4266.8, 169.48, -2976.2), -- co
        ["Land of the Sky"] = Vector3.new(3452.06, 1438.24, -9077.78), -- co
        ["Logue Town"] = Vector3.new(-6587.53, 7.22, -7674.48), -- co
        ["Marine Base G-1"] = Vector3.new(-5996.11, 57.24, -11489.15), -- co
        ["Marine Fort F-1"] = Vector3.new(424.6, 19.45, -4479.89), -- co
        ["Mysterious Cliff"] = Vector3.new(78.64, 412.74, -8280.99), -- co
        ["Orange Town"] = Vector3.new(-4456.83, 5.3, -6640.93), -- co
        ["Restaurant Baratie"] = Vector3.new(-2949.38, 6.31, -6696.07), -- co
        ["Reverse Mountain"] = Vector3.new(-8001.37, 52.22, -8571.84), -- co
        ["Roca Island"] = Vector3.new(1532.26, 155.38, -6573.02), -- co
        ["Sandora"] = Vector3.new(-1540.96, 3.97, -3352.63), -- co
        ["Shark Park"] = Vector3.new(-1583.31, 12.29, -10076.3), -- co 
        ["Shell's Town"] = Vector3.new(-1337.18, 4.12, -5025.98), -- co
        ["Sphinx Island"] = Vector3.new(-4015.28, 41.28, -9154.84), -- co
        ["Town of Beginnings"] = Vector3.new(-522.6, 8.07, -3396) -- co
    }

    return IslandData
end

-- 📦 MODULE: BypassAnticheat.lua (ULTIMATE EDITION + EXECUTOR TRACKER)
__modules["BYPASS ANTICHEAT"] = function()
    local Bypass = {}
    local cloneref = cloneref or function(obj) return obj end

    local Players = cloneref(game:GetService("Players"))
    local ReplicatedStorage = cloneref(game:GetService("ReplicatedStorage"))
    local VirtualUser = cloneref(game:GetService("VirtualUser"))
    local LocalPlayer = Players.LocalPlayer

    -- ==========================================
    -- 0. EXECUTOR TRACKER & CAPABILITY SCANNER
    -- ==========================================
    local function VerifyExecutorCapabilities()
        -- Track the executor's name
        local executorName = "Unknown Executor"
        if type(identifyexecutor) == "function" then
            local success, name = pcall(identifyexecutor)
            if success and name then
                executorName = name
            end
        end

        -- Scan for required high-tier bypassing functions
        local missingFunctions = {}
        if type(hookmetamethod) ~= "function" then table.insert(missingFunctions, "hookmetamethod") end
        if type(hookfunction) ~= "function" then table.insert(missingFunctions, "hookfunction") end
        if type(getrawmetatable) ~= "function" then table.insert(missingFunctions, "getrawmetatable") end
        if type(setreadonly) ~= "function" then table.insert(missingFunctions, "setreadonly") end
        if type(getnamecallmethod) ~= "function" then table.insert(missingFunctions, "getnamecallmethod") end
        if type(newcclosure) ~= "function" then table.insert(missingFunctions, "newcclosure") end

        -- If the executor lacks power, kick the player immediately
        if #missingFunctions > 0 then
            local missingList = table.concat(missingFunctions, "\n- ")
            local kickMessage = string.format(
                "\n[ZILI SECURITY: FATAL ERROR]\n\nYour executor [%s] is absolutely terrible and incapable of running this script!\n\nIt failed the Anti-Cheat Bypass capability check because it is missing the following critical functions:\n- %s\n\nPlease get a real executor to prevent your account from being banned.",
                executorName,
                missingList
            )
            
            warn("[ZILI SECURITY] Kicked player due to garbage executor: " .. executorName)
            LocalPlayer:Kick(kickMessage)
            
            -- Yield the script forever to prevent any further execution
            task.wait(9e9) 
        end
        
        print(string.format("[ZILI SECURITY] Executor Verified: [%s]. All bypass functions are supported!", executorName))
    end

    -- ==========================================
    -- DEEP SCAN HELPER FUNCTION
    -- ==========================================
    -- Recursive Deep Scan: Detects malicious keywords in tables without causing Stack Overflows
    local function isSuspiciousData(data, visited)
        visited = visited or {}
        
        if type(data) == "table" then
            if visited[data] then return false end
            visited[data] = true
            
            for key, value in pairs(data) do
                if isSuspiciousData(key, visited) or isSuspiciousData(value, visited) then
                    return true
                end
            end
        elseif type(data) == "string" then
            local lowerStr = string.lower(data)
            local blacklist = {
                "hack", "exploit", "banned", "illegal", 
                "shadowbanned", "cheat", "injector"
            }
            
            for _, word in ipairs(blacklist) do
                if string.find(lowerStr, word) then
                    return true
                end
            end
        end
        return false
    end

    function Bypass.Init()
        -- Step 0: Check if the executor is trash before doing anything else
        VerifyExecutorCapabilities()

        -- ==========================================
        -- 1. ENHANCED ANTI-AFK & STAMINA SPOOFER
        -- ==========================================
        
        -- Priority 1: Disable Idled connection if supported by executor
        pcall(function()
            for _, conn in pairs(getconnections(LocalPlayer.Idled)) do
                conn:Disable()
            end
        end)
        
        -- Priority 2: VirtualUser fallback
        LocalPlayer.Idled:Connect(function()
            VirtualUser:CaptureController()
            VirtualUser:ClickButton2(Vector2.new())
        end)

        local function PreventSitting(character)
        local humanoid = character:WaitForChild("Humanoid", 5)
        if humanoid then
            humanoid:SetStateEnabled(Enum.HumanoidStateType.Seated, false)
            if humanoid.Sit then humanoid.Sit = false; humanoid.Jump = true end
        end
    end
    if LocalPlayer.Character then PreventSitting(LocalPlayer.Character) end
    LocalPlayer.CharacterAdded:Connect(PreventSitting)

        -- ==========================================
        -- 2. DIRECT FUNCTION HOOKS (KICK/BAN)
        -- ==========================================
        
        local oldKick
        oldKick = hookfunction(LocalPlayer.Kick, newcclosure(function(self, ...)
            warn("[ZILI SECURITY] Blocked direct Kick() attempt from the client!")
            return nil
        end))

        -- ==========================================
        -- 3. METAMETHOD HOOKS (__namecall)
        -- ==========================================
        local gm = getrawmetatable(game)
        setreadonly(gm, false)
        
        local oldNamecall
        oldNamecall = hookmetamethod(game, "__namecall", newcclosure(function(self, ...)
            local method = getnamecallmethod()
            if not self then return oldNamecall(self, ...) end

            -- 🛑 A. Prevent Namecall Kicks
            if self == LocalPlayer and (method == "Kick" or method == "kick") then
                warn("[ZILI SECURITY] Blocked Namecall Kick() attempt!")
                return nil 
            end

            -- 🛑 B. Block game from tagging the player as Banned/Flagged
            if self == LocalPlayer and method == "SetAttribute" then
                local args = {...}
                if type(args[1]) == "string" then
                    local attr = string.lower(args[1])
                    if attr == "banned" or attr == "kick" or attr == "flagged" or string.find(attr, "shadowbanned") then
                        warn("[ZILI SECURITY] Blocked SetAttribute ban tag!")
                        return nil 
                    end
                end
            end

            -- 🕵️ C. Intercept Remote Invocations (Deep Scan payload)
            if method == "FireServer" or method == "InvokeServer" then
                local name = tostring(self.Name)

                -- Allow ping requests to bypass server heartbeat checks
                if name == "pingClient" then
                    return oldNamecall(self, ...)
                end

                -- Deep scan arguments for malicious AntiCheat logs
                local args = {...}
                if isSuspiciousData(args) then
                    warn("[ZILI SECURITY] Intercepted and blocked malicious Remote payload via Namecall: " .. name)
                    return nil
                end
            end

            return oldNamecall(self, ...)
        end))
        setreadonly(gm, true)

        -- ==========================================
        -- 4. LOW-LEVEL FIRESERVER HOOK (OPTIMIZED)
        -- ==========================================
        local RemoteEvent = Instance.new("RemoteEvent")
        local oldFireServer
        
        oldFireServer = hookfunction(RemoteEvent.FireServer, newcclosure(function(self, ...)
            if not self then return oldFireServer(self, ...) end
            
            local name = tostring(self.Name)
            if name == "pingClient" then
                return oldFireServer(self, ...)
            end

            -- Final check layer using Deep Scan
            local args = {...}
            if isSuspiciousData(args) then
                warn("[ZILI SECURITY] Intercepted malicious FireServer call: " .. name)
                return nil
            end

            return oldFireServer(self, ...)
        end))

        print("[ZILI SECURITY] Anti-Cheat Bypass Initialized Successfully !!!")
    end

    return Bypass
end

-- 📦 MODULE: TweenToIsland.lua (BẢN FULL HOÀN CHỈNH - KHÔNG CẦN CHỈNH SỬA GÌ THÊM)
__modules["Island/TWEEN TO ISLAND"] = function()
    local Tween = {}
    local Players = game:GetService("Players")
    local RunService = game:GetService("RunService")
    local Workspace = game:GetService("Workspace")

    local LocalPlayer = Players.LocalPlayer
    local MAX_SPEED = 90
    local lastMerchantCheckMinute = -1
    Tween.IsTeleporting = false
    Tween.MoveConn = nil
    Tween.NoclipConn = nil 
    Tween.FakeFloor = nil
    Tween.Notify = function(title, content, duration) end

    local VEC_ZERO = Vector3.new(0, 0, 0)
    local OFFSET_FAKEFLOOR = CFrame.new(0, -3.05, 0)

    local function getRoot()
        local char = LocalPlayer.Character
        if char and char:FindFirstChild("HumanoidRootPart") then
            return char.HumanoidRootPart
        end
        return nil
    end

    function Tween.Stop()
        Tween.IsTeleporting = false
        if Tween.MoveConn then Tween.MoveConn:Disconnect(); Tween.MoveConn = nil end
        if Tween.NoclipConn then Tween.NoclipConn:Disconnect(); Tween.NoclipConn = nil end

        local root = getRoot()
        if root then
            for _, v in pairs(root:GetChildren()) do 
                if v.Name == "ZILI_AntiGravity" then v:Destroy() end 
            end
            root.Velocity = VEC_ZERO
        end
        if Tween.FakeFloor then Tween.FakeFloor:Destroy(); Tween.FakeFloor = nil end
    end

    function Tween.Start(targetData)
        Tween.Stop()
        Tween.IsTeleporting = true
        
        Tween.NoclipConn = RunService.Stepped:Connect(function()
            if Tween.IsTeleporting and LocalPlayer.Character then
                for _, part in pairs(LocalPlayer.Character:GetDescendants()) do
                    if part:IsA("BasePart") then part.CanCollide = false end
                end
            end
        end)

        local route = {}
        local finalDest = type(targetData) == "table" and targetData[#targetData] or targetData
        local initialRoot = getRoot()
        if not initialRoot then return end

        local function isPortalPos(pos)
            return pos.Y < -20 and pos.Y > -500
        end

        -- KỊCH BẢN 1: VÀO ĐẢO NGƯỜI CÁ
        if initialRoot.Position.Y > -1000 and finalDest.Y < -1000 then
            table.insert(route, {
                pos = Vector3.new(1842.72, -50, -12170.62), 
                isPortal = true,
                isFishmanIn = true,
                isFishmanExit = false,
                msg = "Entering Cave... Heading to Whirlpool"
            })
        end

        -- KỊCH BẢN 2: RA ĐẢO NGƯỜI CÁ
        if initialRoot.Position.Y < -1000 and finalDest.Y > -1000 then
            table.insert(route, {
                pos = Vector3.new(8585.12, -2138.84, -17087.38), 
                isPortal = true, 
                isFishmanIn = false,
                isFishmanExit = true,
                msg = "Leaving Cave... Heading to Exit Portal"
            })
        end

        -- KỊCH BẢN 3: CÁC ĐIỂM CÒN LẠI
        if type(targetData) == "table" then
            for i, pos in ipairs(targetData) do
                local isP = (i < #targetData) or isPortalPos(pos)
                table.insert(route, {
                    pos = pos, isPortal = isP, isFishmanIn = false, isFishmanExit = false,
                    msg = isP and "Heading to Portal..." or "Heading to final destination..."
                })
            end
        else
            local isP = isPortalPos(targetData)
            table.insert(route, {
                pos = targetData, isPortal = isP, isFishmanIn = false, isFishmanExit = false,
                msg = isP and "Heading to Portal..." or "Heading to destination..."
            })
        end

        local function flyTo(stepData, onComplete)
            local root = getRoot()
            local waitTime = 0
            while not root and waitTime < 10 do
                task.wait(0.5)
                waitTime = waitTime + 0.5
                root = getRoot()
            end
            
            if not Tween.IsTeleporting or not root then Tween.Stop(); return end

            if not Tween.FakeFloor then 
                Tween.FakeFloor = Instance.new("Part")
                Tween.FakeFloor.Name = "ZILI_FakeFloor"
                Tween.FakeFloor.Size = Vector3.new(15, 2, 15)
                Tween.FakeFloor.Anchored = true
                Tween.FakeFloor.Transparency = 1 
                Tween.FakeFloor.Parent = Workspace
            end

            local antiGravity = root:FindFirstChild("ZILI_AntiGravity") or Instance.new("BodyVelocity")
            antiGravity.Name = "ZILI_AntiGravity"
            antiGravity.MaxForce = Vector3.new(9e9, 9e9, 9e9)
            antiGravity.Velocity = VEC_ZERO
            antiGravity.Parent = root

            local targetPos = stepData.pos

            Tween.MoveConn = RunService.Heartbeat:Connect(function(deltaTime)
                if not Tween.IsTeleporting or not root.Parent then Tween.Stop(); return end

                if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                root.Velocity = VEC_ZERO

                local currentPos = root.Position
                local distXZ = (Vector2.new(targetPos.X, targetPos.Z) - Vector2.new(currentPos.X, currentPos.Z)).Magnitude
                local max_step = math.min(MAX_SPEED * deltaTime, 120)

                -- ÉP Y = 7.33 NẾU KHÔNG PHẢI ĐẢO NGƯỜI CÁ (bay an toàn)
                if not stepData.isFishmanIn and not stepData.isFishmanExit then
                    if math.abs(currentPos.Y - 7.33) > 10 and distXZ > 50 then
                        Tween.MoveConn:Disconnect()
                        task.spawn(function()
                            root.CFrame = CFrame.new(currentPos.X, 7.33, currentPos.Z)
                            task.wait(0.2)
                            flyTo(stepData, onComplete)
                        end)
                        return
                    end
                end

                -- ĐẾN GẦN MỤC TIÊU (Dưới 30 studs)
                if distXZ < 30 then 
                    Tween.MoveConn:Disconnect()
                    
                    task.spawn(function()
                        local waited = 0
                        
                        -- ==========================================================
                        -- LOGIC 1: CỔNG RA ĐẢO NGƯỜI CÁ (Xoay mặt -> Đi tới lọt qua cổng)
                        -- ==========================================================
                        if stepData.isFishmanExit then
                            root.CFrame = CFrame.lookAt(root.Position, targetPos)
                            task.wait(0.1)
                            
                            while waited < 20 do
                                if not Tween.IsTeleporting or not root then break end
                                if (root.Position - targetPos).Magnitude > 200 then break end
                                
                                root.CFrame = root.CFrame * CFrame.new(0, 0, -3)
                                if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                                
                                task.wait(0.15)
                                waited = waited + 0.15
                            end

                        -- ==========================================================
                        -- LOGIC 2: CỔNG VÀO HOẶC PORTAL (Nhích qua lại 1 stud để lấy va chạm)
                        -- ==========================================================
                        elseif stepData.isPortal or stepData.isFishmanIn then
                            local toggle = 1 
                            while waited < 20 do
                                if not Tween.IsTeleporting or not root then break end
                                if (root.Position - targetPos).Magnitude > 200 then break end
                                
                                local wiggle = toggle * 1
                                root.CFrame = CFrame.new(targetPos.X + wiggle, targetPos.Y, targetPos.Z + wiggle)
                                if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                                
                                toggle = toggle * -1
                                task.wait(0.3)
                                waited = waited + 0.3
                            end
                            task.wait(1.5)

                        -- ==========================================================
                        -- LOGIC 3: ĐIỂM ĐẾN BÌNH THƯỜNG (Đứng im tại tâm)
                        -- ==========================================================
                        else
                            root.CFrame = CFrame.new(targetPos.X, targetPos.Y, targetPos.Z)
                            if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                            task.wait(0.2)
                        end

                        if onComplete then onComplete() end
                    end)
                else
                    -- BAY ĐẾN MỤC TIÊU
                    local safeY = (stepData.isFishmanIn or stepData.isFishmanExit) and targetPos.Y or 7.33
                    local activeTarget = Vector3.new(targetPos.X, safeY, targetPos.Z)
                    local dir = (activeTarget - currentPos).Unit
                    root.CFrame = CFrame.new(currentPos + dir * math.min(max_step, (activeTarget - currentPos).Magnitude))
                end
            end)
        end

        local function processRoute(index)
            if not Tween.IsTeleporting then return end
            if index > #route then
                Tween.Notify("Success", "Arrived at destination!", 3)
                Tween.Stop() 
                return
            end

            local step = route[index]
            if step.msg then Tween.Notify("Traveling", step.msg, 3) end

            flyTo(step, function()
                processRoute(index + 1) 
            end)
        end

        processRoute(1)
    end

    return Tween
end

-- 📦 MODULE: AutoFarmLevel.lua
__modules["Farm/AutoFarmLevel"] = function()
    local isLvlFarmOn = {}
    local Players = game:GetService("Players")
    local RunService = game:GetService("RunService")
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local Player = Players.LocalPlayer

    local QuestFunc = require(ReplicatedStorage:WaitForChild("Modules"):WaitForChild("NPCInteractions"):WaitForChild("QuestFunctions"))
    local TweenToIsland = require("Island/TWEEN TO ISLAND")

    _G.LureFarm = false

    -- ================= CÀI ĐẶT FARM =================
    local CenterPoint = Vector3.new(7719.22, -2176.84, -17308.71)
    local SearchRadius = 150 
    local HoverHeight = 7.7
    local MoveSpeed = 65    
    local GatherWaitTime = 1.5 

    -- ================= CÀI ĐẶT AUTO QUEST =================
    local TargetMobName = "Fishman Karate User" 
    local QuestNPC_Pos =  Vector3.new(7731.41, -2175.84, -17222.65)
    local QuestName = "Becky" 
    -- ======================================================

    local TargetCFrame = nil
    local TaggedMobs = {}
    local GatherStartTime = 0 

    local isTakingQuest = false
    local isInteracting = false 
    local LastQuestCheck = 0
    local CurrentlyHasQuest = false
    local IsReadyToAttack = false

    local CurrentTargetMob = nil 
    local WaitUntil = 0 
    local LastHoverPos = nil

    local Events   = ReplicatedStorage:WaitForChild("Events", 5)
    local TakeStam = Events and Events:WaitForChild("takestam", 5)

    local isSpoofingStamina = false
    local function StartStaminaSpoof()
        if isSpoofingStamina then return end
        isSpoofingStamina = true
        task.spawn(function()
            while isSpoofingStamina and task.wait(0.05) do
                if TakeStam and TakeStam.Parent then
                    pcall(function() TakeStam:FireServer(0.545, "dash") end)
                else break end
            end
        end)
    end
    
    local function StopStaminaSpoof() isSpoofingStamina = false end

    local function UnequipWeapons()
        pcall(function()
            local char = Player.Character
            if char then
                local tool = char:FindFirstChildOfClass("Tool")
                if tool then
                    char.Humanoid:UnequipTools()
                end
            end
        end)
    end

    local function CheckAndEquipWeapon()
        local char = Player.Character
        if char and not char:FindFirstChildOfClass("Tool") then
            for _, tool in pairs(Player.Backpack:GetChildren()) do
                if tool:IsA("Tool") then 
                    char.Humanoid:EquipTool(tool)
                    break
                end
            end
        end
    end

    local function GetPlayerLevel()
        local lvl = 0
        pcall(function()
            local statsFolder = ReplicatedStorage:FindFirstChild("Stats" .. Player.Name)
            if statsFolder then
                local innerStats = statsFolder:FindFirstChild("Stats")
                if innerStats then
                    local levelObj = innerStats:FindFirstChild("Level")
                    if levelObj then
                        lvl = tonumber(levelObj.Value)
                        if not lvl or lvl == 0 then
                            lvl = tonumber(string.match(tostring(levelObj.Value), "%d+"))
                        end
                    end
                end
            end
        end)
        if not lvl or lvl == 0 then lvl = 190 end 
        return lvl
    end

    local function AutoClickUI(chatGui)
        pcall(function()
            if not chatGui:FindFirstChild("Frame") then return end
            
            local btns = {"go", "Go", "endChat", "Accept", "Yes", "Next", "Continue", "Okay", "Set", "Take"}
            for _, btnName in pairs(btns) do
                local btn = chatGui.Frame:FindFirstChild(btnName)
                if btn and btn.Visible and getconnections then
                    for _, conn in pairs(getconnections(btn.MouseButton1Click)) do conn:Fire() end
                    for _, conn in pairs(getconnections(btn.Activated)) do pcall(function() conn:Fire() end) end
                end
            end

            for _, v in pairs(chatGui.Frame:GetDescendants()) do
                if v:IsA("TextButton") and v.Visible then
                    local txt = string.lower(v.Text)
                    if txt:match("yes") or txt:match("set") or txt:match("accept") or txt:match("sure") or txt:match("okay") or txt:match("next") or txt:match("continue") or txt:match("take") or txt:match("go") then
                        if getconnections then
                            for _, conn in pairs(getconnections(v.MouseButton1Click)) do conn:Fire() end
                            for _, conn in pairs(getconnections(v.Activated)) do pcall(function() conn:Fire() end) end
                        end
                    end
                end
            end
        end)
    end

    task.spawn(function()
        local CombatRegister = ReplicatedStorage:WaitForChild("Events"):WaitForChild("CombatRegister")
        local currentCombo = 1 
        
        while true do
            local attackDelay = 0.3 -- Tốc độ mặc định giữa các nhát chém
            
            if _G.LureFarm and not isTakingQuest and not isInteracting and IsReadyToAttack then
                local char = Player.Character
                if char and char:GetAttribute("SpawnLoaded") and not Player.PlayerGui:FindFirstChild("NPCCHAT") then
                    pcall(function()
                        CheckAndEquipWeapon() 
                        
                        local tool = char:FindFirstChildOfClass("Tool")
                        local weaponName = tool and tool.Name or "Melee"
                        
                        -- CHỈ CÓ ĐÒN 5 LÀ AIR (ĐỂ LẤY HIỆU ỨNG SLAM ĐẬP ĐẤT)
                        local state = (currentCombo == 5) and "Air" or "Ground"
                        local animFolder = ReplicatedStorage:WaitForChild("CombatAnimations"):FindFirstChild(weaponName) or ReplicatedStorage:WaitForChild("CombatAnimations"):WaitForChild("Melee")
                        local animName = (state == "Air") and "AirPunch"..currentCombo or "Punch"..currentCombo
                        local fakeAnim = animFolder:FindFirstChild(animName) or animFolder:GetChildren()[1]

                        local enemiesToHit = {}
                        local primaryCFrame = nil
                        
                        -- TÌM QUÁI
                        if CurrentTargetMob then
                            table.insert(enemiesToHit, CurrentTargetMob.PrimaryPart)
                            primaryCFrame = CurrentTargetMob.PrimaryPart.CFrame
                        else
                            local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
                            for _, m in pairs(folder:GetChildren()) do
                                if m.Name:match(TargetMobName) and m:IsA("Model") and m.PrimaryPart and m:FindFirstChild("Humanoid") and m.Humanoid.Health > 0 then
                                    if (m.PrimaryPart.Position - char.PrimaryPart.Position).Magnitude <= 30 then 
                                        table.insert(enemiesToHit, m.PrimaryPart) 
                                        if not primaryCFrame then primaryCFrame = m.PrimaryPart.CFrame end
                                    end
                                end
                            end
                        end

                        if #enemiesToHit > 0 then
                            -- Bắn lệnh vung vũ khí
                            task.spawn(function()
                                pcall(function()
                                    CombatRegister:InvokeServer({
                                        [1] = "swingsfx",
                                        [2] = weaponName,
                                        [3] = currentCombo,
                                        [4] = state,
                                        [5] = false,
                                        [6] = fakeAnim,
                                        [7] = 2,
                                        [8] = 1.5
                                    })
                                end)
                            end)

                            -- Bắn lệnh gây sát thương
                            task.spawn(function()
                                pcall(function()
                                    CombatRegister:InvokeServer({
                                        [1] = "damage",
                                        [2] = enemiesToHit,
                                        [3] = weaponName,
                                        [4] = { [1] = currentCombo, [2] = state, [3] = weaponName },
                                        [5] = true,
                                        [6] = primaryCFrame,
                                        ["aircombo"] = state
                                    })
                                end)
                            end)

                            -- XỬ LÝ NHỊP ĐÁNH (CHỐNG BỊ SERVER KHÓA SÁT THƯƠNG)
                            if currentCombo == 5 then
                                attackDelay = 0.7 -- Nhát 5 (Slam) xong phải nghỉ xả hơi một chút như người thật
                                currentCombo = 1  -- Reset lại combo
                            else
                                currentCombo = currentCombo + 1
                            end
                        end
                    end)
                end
            else
                currentCombo = 1
            end
            
            -- Chờ theo thời gian đã tính toán ở trên
            task.wait(attackDelay) 
        end
    end)

    local function CheckQuestStatus()
        local hasQuest = false
        pcall(function()
            local statsFolder = ReplicatedStorage:FindFirstChild("Stats" .. Player.Name)
            if statsFolder then
                local questFolder = statsFolder:FindFirstChild("Quest")
                if questFolder and questFolder:FindFirstChild("CurrentQuest") then
                    local cq = tostring(questFolder.CurrentQuest.Value):gsub("%s+", ""):lower()
                    if cq ~= "" and cq ~= "none" and cq ~= "nil" and cq ~= "0" then
                        hasQuest = true
                        return
                    end
                end
                
                local innerStats = statsFolder:FindFirstChild("Stats")
                if innerStats then
                    local innerQuest = innerStats:FindFirstChild("Quest")
                    if innerQuest and innerQuest:FindFirstChild("CurrentQuest") then
                        local cq = tostring(innerQuest.CurrentQuest.Value):gsub("%s+", ""):lower()
                        if cq ~= "" and cq ~= "none" and cq ~= "nil" and cq ~= "0" then
                            hasQuest = true
                        end
                    end
                end
            end
        end)
        return hasQuest
    end

    local function StopAttacking()
        IsReadyToAttack = false
        _G.HoldingBlockKey = false
        _G.blocking = false
        _G.canuse = false 
        _G.midM1 = false
    end

    local function ForceClearStun()
        pcall(function()
            local char = Player.Character
            if char then
                _G.canuse = true
                if char:FindFirstChild("Humanoid") then
                    char.Humanoid.WalkSpeed = 16
                end
                for _, v in pairs(char:GetChildren()) do
                    if v:IsA("ObjectValue") and (v.Name == "Value" or v.Name == "Stun" or v.Name == "Action") then
                        v:Destroy()
                    end
                end
            end
        end)
    end

    local function GetLureTarget()
        if tick() < WaitUntil then return "WAITING" end

        if CurrentTargetMob and CurrentTargetMob.Parent and CurrentTargetMob:FindFirstChild("Humanoid") then
            local hum = CurrentTargetMob.Humanoid
            if hum.Health < hum.MaxHealth and hum.Health > 0 then
                WaitUntil = tick() + 1.5
                CurrentTargetMob = nil
                return "WAITING"
            end
        end

        local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
        local bestMob, minDist = nil, math.huge
        local rootPos = Player.Character and Player.Character.PrimaryPart and Player.Character.PrimaryPart.Position or CenterPoint
        
        for _, v in pairs(folder:GetChildren()) do
            if v.Name:match(TargetMobName) and v:IsA("Model") and v.PrimaryPart and v:FindFirstChild("Humanoid") then
                if v.Humanoid.Health > 0 and v.Humanoid.Health == v.Humanoid.MaxHealth then
                    local distToCenter = (v.PrimaryPart.Position - CenterPoint).Magnitude
                    if distToCenter <= SearchRadius then
                        local distToPlayer = (v.PrimaryPart.Position - rootPos).Magnitude
                        if distToPlayer < minDist then
                            minDist = distToPlayer
                            bestMob = v
                        end
                    end
                end
            end
        end
        
        CurrentTargetMob = bestMob
        return bestMob
    end

    task.spawn(function()
        while true do
            if _G.LureFarm then
            pcall(function()
                local char = Player.Character
                if not char then return end
                
                local root = char:FindFirstChild("HumanoidRootPart")
                local hum = char:FindFirstChild("Humanoid")

                if not root or not hum or hum.Health <= 0 then
                    TargetCFrame = nil 
                    isTakingQuest = false
                    isInteracting = false
                    return
                end

                if not char:GetAttribute("SpawnLoaded") then
                    TargetCFrame = nil
                    StopAttacking()
                    task.wait(5) 
                    
                    if char and char.Parent and hum.Health > 0 then
                        char:SetAttribute("SpawnLoaded", true)
                    end
                    return 
                end

                local isFarFromIsland = (root.Position.Y > -1000) or ((root.Position - CenterPoint).Magnitude > 600)
                if isFarFromIsland then
                    StopAttacking()
                    UnequipWeapons()
                    TargetCFrame = nil 
                    if not TweenToIsland.IsTeleporting then
                        if root.Position.Y > -1000 then
                            TweenToIsland.Start(Vector3.new(1791.87, -94.83, -12327.67)) 
                        else
                            TweenToIsland.Start(CenterPoint) 
                        end
                    end
                    return
                else
                    if TweenToIsland.IsTeleporting then TweenToIsland.Stop() end
                end
                
                local currentLvl = GetPlayerLevel()

                if not _G.AlreadySetFishmanSpawn then
                    local SetSpawnCoords = Vector3.new(7974.69, -2152.84, -17074.41)
                    local distToIsland = (root.Position - CenterPoint).Magnitude
                    
                    if distToIsland < 2000 then
                        StopAttacking()
                        UnequipWeapons()
                        
                        local standPos = SetSpawnCoords + Vector3.new(0, 0, 4)
                        TargetCFrame = CFrame.new(standPos, SetSpawnCoords)
                        
                        if (root.Position - standPos).Magnitude < 6 then
                            TargetCFrame = nil
                            
                            local targetPrompt = nil
                            local waitForNpc = tick()
                            
                            while tick() - waitForNpc < 15 do
                                root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                root.Velocity = Vector3.new(0,0,0)
                                root.RotVelocity = Vector3.new(0,0,0)
                                
                                for _, prompt in pairs(workspace:GetDescendants()) do
                                    if prompt:IsA("ProximityPrompt") and prompt.Parent and prompt.Parent:IsA("BasePart") then
                                        if (prompt.Parent.Position - SetSpawnCoords).Magnitude <= 20 then
                                            targetPrompt = prompt
                                            break
                                        end
                                    end
                                end
                                if targetPrompt then break end 
                                task.wait(0.5)
                            end
                            
                            if targetPrompt then
                                fireproximityprompt(targetPrompt)
                                
                                local waitAppear = tick()
                                while tick() - waitAppear < 3 do
                                    root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                    root.Velocity = Vector3.new(0,0,0)
                                    if Player.PlayerGui:FindFirstChild("NPCCHAT") then break end
                                    task.wait(0.2)
                                end
                                
                                local waitChatClose = tick()
                                while tick() - waitChatClose < 8 do 
                                    root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                    root.Velocity = Vector3.new(0,0,0)
                                    
                                    local chatGui = Player.PlayerGui:FindFirstChild("NPCCHAT")
                                    if not chatGui then break end 
                                    
                                    AutoClickUI(chatGui)
                                    task.wait(0.4) 
                                end
                                
                                _G.AlreadySetFishmanSpawn = true
                                TargetCFrame = nil
                                task.wait(2)
                            end
                        end
                        return 
                    end
                end
                
                if tick() - LastQuestCheck > 2 then
                    LastQuestCheck = tick()
                    CurrentlyHasQuest = CheckQuestStatus()
                end

                if currentLvl >= 190 then
                    if not CurrentlyHasQuest and not isTakingQuest then
                        isTakingQuest = true
                    end
                else
                    isTakingQuest = false 
                end

                if isTakingQuest then
                    StopAttacking() 
                    local currentPos = root.Position
                    
                    if not isInteracting then
                        local standPos = QuestNPC_Pos + Vector3.new(0, 0, 4) 
                        TargetCFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                        
                        local distToNPC = (Vector3.new(currentPos.X, 0, currentPos.Z) - Vector3.new(standPos.X, 0, standPos.Z)).Magnitude
                        
                        if distToNPC <= 4 and math.abs(currentPos.Y - standPos.Y) <= 15 then
                            isInteracting = true 
                            TargetCFrame = nil   
                            
                            UnequipWeapons()
                            task.wait(0.2) 
                            
                            pcall(function() QuestFunc:QuestHandle(QuestName, "takequest") end)
                            
                            pcall(function()
                                for _, prompt in pairs(workspace:GetDescendants()) do
                                    if prompt:IsA("ProximityPrompt") then
                                        if prompt.Parent and (prompt.Parent.Position - root.Position).Magnitude <= 20 then
                                            fireproximityprompt(prompt)
                                        end
                                    end
                                end
                            end)
                            
                            local waitAppear = tick()
                            while tick() - waitAppear < 2 do
                                root.CFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                                root.Velocity = Vector3.new(0,0,0)
                                if Player.PlayerGui:FindFirstChild("NPCCHAT") then break end
                                task.wait(0.2)
                            end
                            
                            local waitChatClose = tick()
                            while tick() - waitChatClose < 8 do 
                                root.CFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                                root.Velocity = Vector3.new(0,0,0)
                                
                                local chatGui = Player.PlayerGui:FindFirstChild("NPCCHAT")
                                if not chatGui then break end 
                                
                                AutoClickUI(chatGui)
                                task.wait(0.3) 
                            end
                            
                            ForceClearStun()
                            CurrentlyHasQuest = CheckQuestStatus()
                            isInteracting = false
                            isTakingQuest = false 
                            LastQuestCheck = tick() 
                        end
                    end
                    return 
                end

                local mobToLure = GetLureTarget()
                
                if mobToLure == "WAITING" then
                    IsReadyToAttack = false
                    if LastHoverPos then
                        TargetCFrame = CFrame.new(LastHoverPos) * CFrame.Angles(math.rad(-90), 0, 0)
                    end
                elseif mobToLure then
                    GatherStartTime = 0 
                    local targetPos = mobToLure.PrimaryPart.Position
                    local hoverPos = targetPos + Vector3.new(0, HoverHeight, 0)
                    LastHoverPos = hoverPos
                    TargetCFrame = CFrame.new(hoverPos) * CFrame.Angles(math.rad(-90), 0, 0)
                    
                    local dist = (root.Position - hoverPos).Magnitude
                    if dist <= 6 then 
                        IsReadyToAttack = true
                    else
                        IsReadyToAttack = false
                    end
                else
                    LastHoverPos = nil
                    local centerHover = CenterPoint + Vector3.new(0, HoverHeight, 0)
                    TargetCFrame = CFrame.new(centerHover) * CFrame.Angles(math.rad(-90), 0, 0)
                    
                    local distToCenter = (root.Position - centerHover).Magnitude
                    if distToCenter <= 4 then
                        if GatherStartTime == 0 then GatherStartTime = tick() end
                        
                        if tick() - GatherStartTime >= GatherWaitTime then
                            local canAttack = false
                            local hasFullHpMob = false
                            
                            local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
                            for _, m in pairs(folder:GetChildren()) do
                                if m.Name:match(TargetMobName) and m:IsA("Model") and m.PrimaryPart and m:FindFirstChild("Humanoid") and m.Humanoid.Health > 0 then
                                    if m.Humanoid.Health == m.Humanoid.MaxHealth and (m.PrimaryPart.Position - CenterPoint).Magnitude <= SearchRadius then
                                        hasFullHpMob = true
                                    end
                                    
                                    if (m.PrimaryPart.Position - root.Position).Magnitude <= 30 then 
                                        canAttack = true
                                        TaggedMobs[m] = tick() 
                                    end
                                end
                            end
                            
                            if not hasFullHpMob then
                                IsReadyToAttack = canAttack
                            else
                                IsReadyToAttack = false 
                            end
                        else
                            IsReadyToAttack = false
                        end
                    else
                        GatherStartTime = 0
                        IsReadyToAttack = false
                    end
                end
            end)
            end
            task.wait(0.01) 
        end
    end)

    task.spawn(function()
        while true do
            if _G.LureFarm then 
            pcall(function()
                local char = Player.Character
                if not char then return end
                
                local root = char:FindFirstChild("HumanoidRootPart")
                local hum = char:FindFirstChild("Humanoid")

                if not root or not hum or hum.Health <= 0 or not char:GetAttribute("SpawnLoaded") or TweenToIsland.IsTeleporting then
                    if root then
                        local bv = root:FindFirstChild("FloatForce")
                        if bv then bv:Destroy() end
                    end
                    if hum then hum.PlatformStand = false end
                    return 
                end
                
                root.Anchored = false
                
                if isInteracting or Player.PlayerGui:FindFirstChild("NPCCHAT") then
                    hum.PlatformStand = false 
                    local bv = root:FindFirstChild("FloatForce")
                    if bv then bv:Destroy() end
                else
                    hum.PlatformStand = true 
                    local bv = root:FindFirstChild("FloatForce")
                    if not bv then
                        bv = Instance.new("BodyVelocity")
                        bv.Name = "FloatForce"
                        bv.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
                        bv.Velocity = Vector3.new(0, 0, 0)
                        bv.Parent = root
                    end
                end

                local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
                if folder then
                    for _, v in pairs(folder:GetChildren()) do
                        if v.Name:match(TargetMobName) and v:IsA("Model") and v.PrimaryPart and v:FindFirstChild("Humanoid") then
                            if v.Humanoid.Health > 0 then
                                if v.PrimaryPart.Size.X < 25 then
                                    v.PrimaryPart.Size = Vector3.new(30, 30, 30) 
                                end
                                v.PrimaryPart.CanCollide = false
                            else
                                if TaggedMobs[v] then TaggedMobs[v] = nil end
                            end
                        end
                    end
                end
            end)
            end
            task.wait(1) 
        end
    end)

    RunService.Stepped:Connect(function()
        if _G.LureFarm then
            local char = Player.Character
            if char then
                local isTweening = TweenToIsland.IsTeleporting
                local isReadyToFarm = char:GetAttribute("SpawnLoaded") and not isInteracting
                
                if isTweening or isReadyToFarm then
                    for _, part in pairs(char:GetChildren()) do
                        if part:IsA("BasePart") and part.CanCollide then
                            part.CanCollide = false
                        end
                    end
                end
            end
        end
    end)

    RunService.Heartbeat:Connect(function(dt)
        if not _G.LureFarm then return end
        if TweenToIsland.IsTeleporting then return end 
        
        local char = Player.Character
        local root = char and char:FindFirstChild("HumanoidRootPart")
        
        if root and TargetCFrame and char:GetAttribute("SpawnLoaded") then
            local currentPos = root.Position
            local targetPos = TargetCFrame.Position
            local dist = (currentPos - targetPos).Magnitude
            
            if dist > 0.5 then
                local dir = (targetPos - currentPos).Unit
                local step = dir * MoveSpeed * dt
                
                if step.Magnitude >= dist then
                    root.CFrame = TargetCFrame
                else
                    root.CFrame = CFrame.new(currentPos + step) * TargetCFrame.Rotation
                end
            else
                root.CFrame = TargetCFrame
            end
        end
    end)

        function isLvlFarmOn.Toggle(state)
        _G.LureFarm = state
        if state then
            -- BẬT giả mạo Stamina khi bắt đầu farm để chống giật lùi (Rubberband)
            StartStaminaSpoof()
        else
            -- TẮT giả mạo Stamina khi ngừng farm
            StopStaminaSpoof()
            
            StopAttacking()
            UnequipWeapons()
            ForceClearStun() 
        if TweenToIsland.IsTeleporting then TweenToIsland.Stop() end
             local char = Player.Character
            if char then
                if char:FindFirstChild("HumanoidRootPart") then
                    local bv = char.HumanoidRootPart:FindFirstChild("FloatForce")
                     if bv then bv:Destroy() end
                    end
                    if char:FindFirstChild("Humanoid") then char.Humanoid.PlatformStand = false end
                    end
         end
     end

    return isLvlFarmOn
end

-- 📦 MODULE: AutoGetBuso.lua (NHẢY THẲNG TỚI QUEST - GIỮ NGUYÊN HOÀN TOÀN LOGIC CỦA FEN)
__modules["Farm/AutoGetBuso"] = function()
    local isBusoFarmOn = {}
    local Players = game:GetService("Players")
    local RunService = game:GetService("RunService")
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local VirtualInputManager = game:GetService("VirtualInputManager") 
    local Workspace = game:GetService("Workspace")
    local Player = Players.LocalPlayer

    local CurrentBackpack = nil
    local AttackHandler = nil

    local QuestFunc = require(ReplicatedStorage:WaitForChild("Modules"):WaitForChild("NPCInteractions"):WaitForChild("QuestFunctions"))
    -- Đã vứt TweenToIsland để không bị dính cái lỗi cắm đầu xuống biển Y=7.33 nữa

    _G.BusoFarm = false

    -- ================= CÀI ĐẶT TỌA ĐỘ VÀ THÔNG SỐ =================
    local Zou_Spawn_Pos = Vector3.new(-3121.05, 11.73, -5256.59) 

    local Kori_Center = Vector3.new(-4441.97, 56.48, -2949.36)
    local ShellTown_Center = Vector3.new(-1337.18, 4.12, -5025.98)
    
    local SearchRadius = 350 
    local HoverHeight = 10.2 
    local MoveSpeed = 90    
    local GatherWaitTime = 1.5 

    local TargetMobName = "Yeti" 
    local QuestNPC_Pos =  Vector3.new(-4245.19, 169.48, -2990.06)
    local QuestName = "Ray" 

    -- ================= BIẾN TRẠNG THÁI =================
    local TargetCFrame = nil
    local GatherStartTime = 0 
    local IsReadyToAttack = false

    local isTakingQuest = false
    local isInteracting = false 
    local LastQuestCheck = 0
    local CurrentlyHasQuest = false
    local HasTakenQuest = false
    local HasSetZouSpawn = false
    local QuestFinished = false

    local CurrentTargetMob = nil 
    local WaitUntil = 0 
    local LastHoverPos = nil

    local function UnequipWeapons()
        pcall(function()
            local char = Player.Character
            if char then
                local tool = char:FindFirstChildOfClass("Tool")
                if tool then char.Humanoid:UnequipTools() end
            end
        end)
    end

    local function CheckAndEquipWeapon()
        local char = Player.Character
        if not char then return end
        if char:FindFirstChildOfClass("Tool") then return end 

        local bp = Player:FindFirstChild("Backpack")
        if not bp then return end

        local tools = bp:GetChildren()
        local weaponToEquip = nil

        for _, tool in pairs(tools) do
            if tool:IsA("Tool") then
                local name = tool.Name:lower()
                if name:match("sword") or name:match("blade") or name:match("katana") or name:match("pipe") then
                    weaponToEquip = tool; break
                end
            end
        end

        if not weaponToEquip then
            for _, tool in pairs(tools) do
                if tool:IsA("Tool") and not tool.Name:lower():match("combat") and not tool.Name:lower():match("melee") then
                    weaponToEquip = tool; break
                end
            end
        end

        if not weaponToEquip then
            for _, tool in pairs(tools) do
                if tool:IsA("Tool") then weaponToEquip = tool; break end
            end
        end

        if weaponToEquip then char.Humanoid:EquipTool(weaponToEquip) end
    end

    local function AutoClickUI(chatGui)
        pcall(function()
            if not chatGui:FindFirstChild("Frame") then return end
            
            local btns = {"go", "Go", "endChat", "Accept", "Yes", "Next", "Continue", "Okay", "Set", "Take"}
            for _, btnName in pairs(btns) do
                local btn = chatGui.Frame:FindFirstChild(btnName)
                if btn and btn.Visible and getconnections then
                    for _, conn in pairs(getconnections(btn.MouseButton1Click)) do conn:Fire() end
                    for _, conn in pairs(getconnections(btn.Activated)) do pcall(function() conn:Fire() end) end
                end
            end

            for _, v in pairs(chatGui.Frame:GetDescendants()) do
                if v:IsA("TextButton") and v.Visible then
                    local txt = string.lower(v.Text)
                    if txt:match("yes") or txt:match("set") or txt:match("accept") or txt:match("sure") or txt:match("okay") or txt:match("next") or txt:match("continue") or txt:match("take") or txt:match("go") then
                        if getconnections then
                            for _, conn in pairs(getconnections(v.MouseButton1Click)) do conn:Fire() end
                            for _, conn in pairs(getconnections(v.Activated)) do pcall(function() conn:Fire() end) end
                        end
                    end
                end
            end
        end)
    end

    local function CheckQuestStatus()
        local hasQuest = false
        pcall(function()
            local statsFolder = ReplicatedStorage:FindFirstChild("Stats" .. Player.Name)
            if statsFolder then
                local questFolder = statsFolder:FindFirstChild("Quest")
                if questFolder and questFolder:FindFirstChild("CurrentQuest") then
                    local cq = tostring(questFolder.CurrentQuest.Value):gsub("%s+", ""):lower()
                    if cq ~= "" and cq ~= "none" and cq ~= "nil" and cq ~= "0" then hasQuest = true return end
                end
            end
        end)
        return hasQuest
    end

    local function ForceClearStun()
        pcall(function()
            local char = Player.Character
            if not char then return end
            
            _G.canuse = true
            _G.midM1 = false
            _G.blocking = false
            
            local hum = char:FindFirstChild("Humanoid")
            if hum then
                if hum.WalkSpeed < 16 then hum.WalkSpeed = 16 end
                if hum.Sit then hum.Sit = false end
            end

            for _, v in pairs(char:GetDescendants()) do
                if v:IsA("BoolValue") then
                    local name = v.Name:lower()
                    if name:match("stun") or name:match("busy") or name:match("action") or name:match("ragdoll") or name:match("cant") or name:match("paralyze") or name:match("attack") or name:match("hit") then
                        if v.Value == true then v.Value = false end
                    end
                elseif v:IsA("NumberValue") or v:IsA("IntValue") then
                    local name = v.Name:lower()
                    if name:match("stun") or name:match("busy") then
                        if v.Value > 0 then v.Value = 0 end
                    end
                end
            end
        end)
    end

    local function StopAttacking()
        IsReadyToAttack = false
        _G.HoldingBlockKey = false
        _G.blocking = false
        _G.canuse = false 
        _G.midM1 = false
        pcall(function() VirtualInputManager:SendKeyEvent(false, Enum.KeyCode.Space, false, game) end)
        
        task.spawn(function()
            pcall(function()
                local char = Player.Character
                local tool = char and char:FindFirstChildOfClass("Tool")
                local weaponName = tool and tool.Name or "Melee"
                ReplicatedStorage:WaitForChild("Events"):WaitForChild("Block"):InvokeServer(false, weaponName, false)
            end)
        end)
    end

    local function GetLureTarget()
        if tick() < WaitUntil then return "WAITING" end

        if CurrentTargetMob and CurrentTargetMob.Parent and CurrentTargetMob:FindFirstChild("Humanoid") then
            local hum = CurrentTargetMob.Humanoid
            if hum.Health < hum.MaxHealth and hum.Health > 0 then
                WaitUntil = tick() + 1.5 
                CurrentTargetMob = nil
                return "WAITING"
            end
        end

        local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
        local bestMob, minDist = nil, math.huge
        local rootPos = Player.Character and Player.Character.PrimaryPart and Player.Character.PrimaryPart.Position or Kori_Center
        
        for _, v in pairs(folder:GetChildren()) do
            if string.find(v.Name, TargetMobName) and v:IsA("Model") and v.PrimaryPart and v:FindFirstChild("Humanoid") then
                if v.Humanoid.Health > 0 and v.Humanoid.Health == v.Humanoid.MaxHealth then
                    local distToCenter = (v.PrimaryPart.Position - Kori_Center).Magnitude
                    if distToCenter <= SearchRadius then
                        local distToPlayer = (v.PrimaryPart.Position - rootPos).Magnitude
                        if distToPlayer < minDist then
                            minDist = distToPlayer
                            bestMob = v
                        end
                    end
                end
            end
        end
        
        CurrentTargetMob = bestMob
        return bestMob
    end

    -- ================= LUỒNG TỔNG CỦA GAME =================
    task.spawn(function()
        while true do
            if _G.BusoFarm then
            pcall(function()
                local char = Player.Character
                if not char then return end
                local root = char:FindFirstChild("HumanoidRootPart")
                local hum = char:FindFirstChild("Humanoid")

                if not root or not hum or hum.Health <= 0 then TargetCFrame = nil; isTakingQuest = false; isInteracting = false; return end

                if not char:GetAttribute("SpawnLoaded") then
                    TargetCFrame = nil; StopAttacking(); task.wait(5) 
                    if char and char.Parent and hum.Health > 0 then char:SetAttribute("SpawnLoaded", true) end
                    return 
                end

                if tick() - LastQuestCheck > 2 then
                    LastQuestCheck = tick(); CurrentlyHasQuest = CheckQuestStatus()
                end

                -- ================= [PHASE POST-QUEST]: VỀ SHELL TOWN =================
                if QuestFinished then
                    local SetSpawnCoords = ShellTown_Center
                    local targetRobo = nil
                    
                    if workspace:FindFirstChild("NPCs") then
                        for _, npc in pairs(workspace.NPCs:GetChildren()) do
                            if npc.Name == "Robo" and npc:FindFirstChild("HumanoidRootPart") then
                                if (npc.HumanoidRootPart.Position - ShellTown_Center).Magnitude <= 500 then
                                    SetSpawnCoords = npc.HumanoidRootPart.Position
                                    targetRobo = npc
                                    break
                                end
                            end
                        end
                    end

                    local distToShellTown = (root.Position - SetSpawnCoords).Magnitude
                    
                    if distToShellTown > 100 then
                        StopAttacking(); UnequipWeapons()
                        TargetCFrame = CFrame.new(SetSpawnCoords) -- BAY THẲNG
                        return
                    else
                        StopAttacking(); UnequipWeapons()
                        
                        local standPos = SetSpawnCoords + Vector3.new(0, 0, 4)
                        TargetCFrame = CFrame.new(standPos, SetSpawnCoords)
                        
                        if (root.Position - standPos).Magnitude < 6 then
                            TargetCFrame = nil
                            task.wait(3)
                            local targetPrompt = nil
                            local waitForNpc = tick()
                            
                            while tick() - waitForNpc < 15 do
                                root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                root.Velocity = Vector3.new(0,0,0)
                                root.RotVelocity = Vector3.new(0,0,0)
                                
                                if targetRobo then
                                    for _, prompt in pairs(targetRobo:GetDescendants()) do
                                        if prompt:IsA("ProximityPrompt") then
                                            targetPrompt = prompt
                                            break
                                        end
                                    end
                                end
                                
                                if not targetPrompt then
                                    for _, prompt in pairs(workspace:GetDescendants()) do
                                        if prompt:IsA("ProximityPrompt") and prompt.Parent and prompt.Parent:IsA("BasePart") then
                                            if (prompt.Parent.Position - SetSpawnCoords).Magnitude <= 10 then
                                                local model = prompt:FindFirstAncestorOfClass("Model")
                                                if model then
                                                    local mName = string.lower(model.Name)
                                                    if not (mName:match("compass") or mName:match("eternal")) then
                                                        targetPrompt = prompt; break
                                                    end
                                                end
                                            end
                                        end
                                    end
                                end
                                
                                if targetPrompt then break end 
                                task.wait(0.5)
                            end
                        
                            if targetPrompt then
                                fireproximityprompt(targetPrompt)
                                local waitAppear = tick()
                                while tick() - waitAppear < 3 do
                                    root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                    root.Velocity = Vector3.new(0,0,0)
                                    if Player.PlayerGui:FindFirstChild("NPCCHAT") then break end
                                    task.wait(0.2)
                                end
                                
                                local waitChatClose = tick()
                                while tick() - waitChatClose < 8 do 
                                    root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                    root.Velocity = Vector3.new(0,0,0)
                                    local chatGui = Player.PlayerGui:FindFirstChild("NPCCHAT")
                                    if not chatGui then break end 
                                    AutoClickUI(chatGui)
                                    task.wait(0.4) 
                                end
                                
                                _G.BusoFarm = false
                                TargetCFrame = nil
                                StopAttacking(); UnequipWeapons()
                                pcall(function()
                                    if hum then hum.PlatformStand = false end
                                    local bv = root:FindFirstChild("FloatForce")
                                    if bv then bv:Destroy() end
                                end)
                                print("✅ Quest Done!!")
                                return
                            end
                        end
                        return 
                    end
                end

                -- ================= [PHASE 1]: ZOU SPAWN =================
                if not HasSetZouSpawn then
                    local SetSpawnCoords = Zou_Spawn_Pos
                    local targetRobo = nil
                    
                    if workspace:FindFirstChild("NPCs") then
                        for _, npc in pairs(workspace.NPCs:GetChildren()) do
                            if npc.Name == "Robo" and npc:FindFirstChild("HumanoidRootPart") then
                                if (npc.HumanoidRootPart.Position - Zou_Spawn_Pos).Magnitude <= 500 then
                                    SetSpawnCoords = npc.HumanoidRootPart.Position
                                    targetRobo = npc
                                    break
                                end
                            end
                        end
                    end

                    local distToZou = (root.Position - SetSpawnCoords).Magnitude
                    
                    if distToZou > 100 then
                        StopAttacking(); UnequipWeapons()
                        TargetCFrame = CFrame.new(SetSpawnCoords) -- BAY THẲNG XUYÊN ĐỊA HÌNH
                        return
                    else
                        StopAttacking(); UnequipWeapons()
                        
                        local standPos = SetSpawnCoords + Vector3.new(0, 0, 4)
                        TargetCFrame = CFrame.new(standPos, SetSpawnCoords)
                        
                        if (root.Position - standPos).Magnitude < 6 then
                            TargetCFrame = nil
                            task.wait(3)
                            local targetPrompt = nil
                            local waitForNpc = tick()
                            
                            while tick() - waitForNpc < 15 do
                                root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                root.Velocity = Vector3.new(0,0,0)
                                root.RotVelocity = Vector3.new(0,0,0)
                                
                                if targetRobo then
                                    for _, prompt in pairs(targetRobo:GetDescendants()) do
                                        if prompt:IsA("ProximityPrompt") then
                                            targetPrompt = prompt; break
                                        end
                                    end
                                end
                                
                                if not targetPrompt then
                                    for _, prompt in pairs(workspace:GetDescendants()) do
                                        if prompt:IsA("ProximityPrompt") and prompt.Parent and prompt.Parent:IsA("BasePart") then
                                            if (prompt.Parent.Position - SetSpawnCoords).Magnitude <= 10 then
                                                local model = prompt:FindFirstAncestorOfClass("Model")
                                                if model then
                                                    local mName = string.lower(model.Name)
                                                    if not (mName:match("compass") or mName:match("eternal")) then
                                                        targetPrompt = prompt; break
                                                    end
                                                end
                                            end
                                        end
                                    end
                                end
                                
                                if targetPrompt then break end 
                                task.wait(0.5)
                            end
                       
                            if targetPrompt then
                                fireproximityprompt(targetPrompt)
                                local waitAppear = tick()
                                while tick() - waitAppear < 3 do
                                    root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                    root.Velocity = Vector3.new(0,0,0)
                                    if Player.PlayerGui:FindFirstChild("NPCCHAT") then break end
                                    task.wait(0.2)
                                end
                                
                                local waitChatClose = tick()
                                while tick() - waitChatClose < 8 do 
                                    root.CFrame = CFrame.new(standPos, SetSpawnCoords)
                                    root.Velocity = Vector3.new(0,0,0)
                                    local chatGui = Player.PlayerGui:FindFirstChild("NPCCHAT")
                                    if not chatGui then break end 
                                    AutoClickUI(chatGui)
                                    task.wait(0.4) 
                                end
                                
                                HasSetZouSpawn = true
                                TargetCFrame = nil
                                task.wait(2)
                            end
                        end
                        return 
                    end
                end

                -- ================= [PHASE 2]: BAY THẲNG TỚI KORI =================
                local isFarFromIsland = (root.Position.Y < -500) or ((root.Position - Kori_Center).Magnitude > 300)
                if isFarFromIsland then
                    StopAttacking(); UnequipWeapons()
                    TargetCFrame = CFrame.new(Kori_Center) -- BAY XÉO LÊN TRỜI, BỎ VỤ LẶN XUỐNG BIỂN
                    return
                end
                
                -- ================= [PHASE 3]: CHECK VÀ LẤY QUEST =================
                if CurrentlyHasQuest then 
                    HasTakenQuest = true
                    isTakingQuest = false
                elseif HasTakenQuest and not CurrentlyHasQuest then 
                    HasTakenQuest = false
                    QuestFinished = true
                    return
                elseif not HasTakenQuest and not QuestFinished then 
                    isTakingQuest = true 
                end

                if isTakingQuest then
                    StopAttacking() 
                    local currentPos = root.Position
                    local standPos = QuestNPC_Pos + Vector3.new(0, 0, 4) 

                    -- [FIX YÊU CẦU]: NHẢY THẲNG (TELEPORT) TỚI QUEST, KHÔNG TWEEN HAY BAY TỪ TỪ NỮA
                    local distToQuest = (currentPos - standPos).Magnitude
                    if distToQuest > 10 then
                        TargetCFrame = nil -- Tắt chế độ bay từ từ
                        root.CFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                        task.wait(0.1) -- Delay siêu nhỏ để game load
                        return
                    end

                    if not isInteracting then
                        TargetCFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                        local distToNPC = (Vector3.new(currentPos.X, 0, currentPos.Z) - Vector3.new(standPos.X, 0, standPos.Z)).Magnitude
                        
                        if distToNPC <= 6 and math.abs(currentPos.Y - standPos.Y) <= 15 then
                            isInteracting = true
                            TargetCFrame = nil 
                            
                            UnequipWeapons()
                            task.wait(0.2) 
                            pcall(function() QuestFunc:QuestHandle(QuestName, "takequest") end)
                            
                            pcall(function()
                                for _, prompt in pairs(workspace:GetDescendants()) do
                                    if prompt:IsA("ProximityPrompt") then
                                        if prompt.Parent and (prompt.Parent.Position - root.Position).Magnitude <= 20 then
                                            fireproximityprompt(prompt)
                                        end
                                    end
                                end
                            end)

                            local waitAppear = tick()
                            while tick() - waitAppear < 2 do
                                root.CFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                                root.Velocity = Vector3.new(0,0,0)
                                if Player.PlayerGui:FindFirstChild("NPCCHAT") then break end
                                task.wait(0.2)
                            end

                            local waitChatClose = tick()
                            while tick() - waitChatClose < 8 do 
                                root.CFrame = CFrame.new(standPos, Vector3.new(QuestNPC_Pos.X, standPos.Y, QuestNPC_Pos.Z))
                                root.Velocity = Vector3.new(0,0,0)
                                
                                local chatGui = Player.PlayerGui:FindFirstChild("NPCCHAT")
                                if not chatGui then break end 
                                AutoClickUI(chatGui)
                                task.wait(0.3) 
                            end
                            
                            ForceClearStun()
                            CurrentlyHasQuest = CheckQuestStatus()
                            isInteracting = false; isTakingQuest = false; LastQuestCheck = tick() 
                        end
                    end
                    return 
                end

                -- ================= [PHASE 4]: TÌM QUÁI VÀ GOM =================
                local mobToLure = GetLureTarget()
                
                if mobToLure == "WAITING" then
                    IsReadyToAttack = false
                    if LastHoverPos then
                        TargetCFrame = CFrame.new(LastHoverPos) * CFrame.Angles(math.rad(-90), 0, 0)
                    end
                elseif mobToLure then
                    GatherStartTime = 0 
                    local targetPos = mobToLure.PrimaryPart.Position
                    local hoverPos = targetPos + Vector3.new(0, HoverHeight, 0)
                    LastHoverPos = hoverPos
                    TargetCFrame = CFrame.new(hoverPos) * CFrame.Angles(math.rad(-90), 0, 0)
                    
                    local dist = (root.Position - hoverPos).Magnitude
                    if dist <= 15 then 
                        IsReadyToAttack = true
                    else
                        IsReadyToAttack = false
                    end
                else
                    LastHoverPos = nil
                    local centerHover = Kori_Center + Vector3.new(0, HoverHeight, 0)
                    TargetCFrame = CFrame.new(centerHover) * CFrame.Angles(math.rad(-90), 0, 0)
                    
                    local distToCenter = (root.Position - centerHover).Magnitude
                    if distToCenter <= 4 then
                        if GatherStartTime == 0 then GatherStartTime = tick() end
                        
                        if tick() - GatherStartTime >= GatherWaitTime then
                            local canAttack = false
                            local hasFullHpMob = false
                            
                            local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
                            for _, m in pairs(folder:GetChildren()) do
                                if m.Name:match(TargetMobName) and m:IsA("Model") and m.PrimaryPart and m:FindFirstChild("Humanoid") and m.Humanoid.Health > 0 then
                                    if m.Humanoid.Health == m.Humanoid.MaxHealth and (m.PrimaryPart.Position - Kori_Center).Magnitude <= SearchRadius then
                                        hasFullHpMob = true
                                    end
                                    if (m.PrimaryPart.Position - root.Position).Magnitude <= 35 then 
                                        canAttack = true
                                    end
                                end
                            end
                            
                            if not hasFullHpMob or canAttack then
                                IsReadyToAttack = canAttack
                            else
                                IsReadyToAttack = false 
                            end
                        else
                            IsReadyToAttack = false
                        end
                    else
                        GatherStartTime = 0
                        IsReadyToAttack = false
                    end
                end
            end)
            end
            task.wait(0.01) 
        end
    end)

    -- ================= VÒNG LẶP CHIẾN ĐẤU =================
    task.spawn(function()
        local CombatRegister = ReplicatedStorage:WaitForChild("Events"):WaitForChild("CombatRegister")
        local BlockEvent = ReplicatedStorage:WaitForChild("Events"):WaitForChild("Block")
        local currentCombo = 1 
        
        while true do
            local attackDelay = 0.43 
            
            if _G.BusoFarm and not isTakingQuest and not isInteracting and IsReadyToAttack then
                local char = Player.Character
                if char and char:GetAttribute("SpawnLoaded") and not Player.PlayerGui:FindFirstChild("NPCCHAT") then
                    pcall(function()
                        CheckAndEquipWeapon() 
                        
                        local tool = char:FindFirstChildOfClass("Tool")
                        local weaponName = tool and tool.Name or "Melee"
                        
                        task.spawn(function() pcall(function() BlockEvent:InvokeServer(true, weaponName, false) end) end)
                        
                        local state = (currentCombo == 5) and "Air" or "Ground"
                        local animFolder = ReplicatedStorage:WaitForChild("CombatAnimations"):FindFirstChild(weaponName) or ReplicatedStorage:WaitForChild("CombatAnimations"):WaitForChild("Melee")
                        local animName = (state == "Air") and "AirPunch"..currentCombo or "Punch"..currentCombo
                        local fakeAnim = animFolder:FindFirstChild(animName) or animFolder:GetChildren()[1]

                        local enemiesToHit = {}
                        local primaryCFrame = nil
                        
                        if CurrentTargetMob then
                            table.insert(enemiesToHit, CurrentTargetMob.PrimaryPart)
                            primaryCFrame = CurrentTargetMob.PrimaryPart.CFrame
                        else
                            local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
                            for _, m in pairs(folder:GetChildren()) do
                                if m.Name:match(TargetMobName) and m:IsA("Model") and m.PrimaryPart and m:FindFirstChild("Humanoid") and m.Humanoid.Health > 0 then
                                    if (m.PrimaryPart.Position - char.PrimaryPart.Position).Magnitude <= 35 then 
                                        table.insert(enemiesToHit, m.PrimaryPart) 
                                        if not primaryCFrame then primaryCFrame = m.PrimaryPart.CFrame end
                                    end
                                end
                            end
                        end

                        if #enemiesToHit > 0 then
                            task.spawn(function()
                                pcall(function()
                                    CombatRegister:InvokeServer({[1]="swingsfx", [2]=weaponName, [3]=currentCombo, [4]=state, [5]=false, [6]=fakeAnim, [7]=2, [8]=1.5})
                                end)
                            end)

                            task.spawn(function()
                                pcall(function()
                                    CombatRegister:InvokeServer({[1]="damage", [2]=enemiesToHit, [3]=weaponName, [4]={[1]=currentCombo, [2]=state, [3]=weaponName}, [5]=true, [6]=primaryCFrame, ["aircombo"]=state})
                                end)
                            end)

                            if currentCombo == 5 then
                                attackDelay = 0.7 
                                currentCombo = 1  
                            else
                                currentCombo = currentCombo + 1
                            end
                        end
                    end)
                end
            else
                currentCombo = 1
                task.spawn(function()
                    pcall(function()
                        local char = Player.Character
                        local tool = char and char:FindFirstChildOfClass("Tool")
                        local weaponName = tool and tool.Name or "Melee"
                        BlockEvent:InvokeServer(false, weaponName, false)
                    end)
                end)
            end
            task.wait(attackDelay) 
        end
    end)

    task.spawn(function()
        while true do
            if _G.BusoFarm then 
            pcall(function()
                local char = Player.Character
                if not char then return end
                
                local root = char:FindFirstChild("HumanoidRootPart")
                local hum = char:FindFirstChild("Humanoid")

                if not root or not hum or hum.Health <= 0 or not char:GetAttribute("SpawnLoaded") then
                    if root then
                        local bv = root:FindFirstChild("FloatForce")
                        if bv then bv:Destroy() end
                    end
                    if hum then hum.PlatformStand = false end
                    return 
                end
                
                root.Anchored = false
                
                if isInteracting or Player.PlayerGui:FindFirstChild("NPCCHAT") then
                    hum.PlatformStand = false 
                    local bv = root:FindFirstChild("FloatForce")
                    if bv then bv:Destroy() end
                else
                    hum.PlatformStand = true 
                    local bv = root:FindFirstChild("FloatForce")
                    if not bv then
                        bv = Instance.new("BodyVelocity")
                        bv.Name = "FloatForce"
                        bv.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
                        bv.Velocity = Vector3.new(0, 0, 0)
                        bv.Parent = root
                    end
                end

                local folder = workspace:FindFirstChild("Enemies") or workspace:FindFirstChild("Mob") or workspace:FindFirstChild("NPCs") or workspace
                if folder then
                    for _, v in pairs(folder:GetChildren()) do
                        if string.find(v.Name, TargetMobName) and v:IsA("Model") and v.PrimaryPart and v:FindFirstChild("Humanoid") then
                            if v.Humanoid.Health > 0 then
                                if v.PrimaryPart.Size.X < 25 then v.PrimaryPart.Size = Vector3.new(30, 30, 30) end
                                v.PrimaryPart.CanCollide = false
                            end
                        end
                    end
                end
            end)
            end
            task.wait(1) 
        end
    end)

    RunService.Stepped:Connect(function()
        if _G.BusoFarm then
            local char = Player.Character
            if char then
                ForceClearStun()
                local isReadyToFarm = char:GetAttribute("SpawnLoaded") and not isInteracting
                
                if isReadyToFarm then
                    for _, part in pairs(char:GetChildren()) do
                        if part:IsA("BasePart") and part.CanCollide then part.CanCollide = false end
                    end
                end
            end
        end
    end)

    RunService.Heartbeat:Connect(function(dt)
        if not _G.BusoFarm then return end
        
        local char = Player.Character
        local root = char and char:FindFirstChild("HumanoidRootPart")
        
        if root and TargetCFrame and char:GetAttribute("SpawnLoaded") then
            local currentPos = root.Position
            local targetPos = TargetCFrame.Position
            local dist = (currentPos - targetPos).Magnitude
            
            if dist > 0.5 then
                local dir = (targetPos - currentPos).Unit
                -- DÙNG MOVESPEED SIÊU TỐC BAY XUYÊN ĐỊA HÌNH
                local step = dir * MoveSpeed * dt
                if step.Magnitude >= dist then root.CFrame = TargetCFrame
                else root.CFrame = CFrame.new(currentPos + step) * TargetCFrame.Rotation end
            else
                root.CFrame = TargetCFrame
            end
        end
    end)

    function isBusoFarmOn.Toggle(state)
        _G.BusoFarm = state
        if not state then
            StopAttacking()
            UnequipWeapons()
            ForceClearStun() 
            
            local char = Player.Character
            if char then
                if char:FindFirstChild("HumanoidRootPart") then
                    local bv = char.HumanoidRootPart:FindFirstChild("FloatForce")
                    if bv then bv:Destroy() end
                end
                if char:FindFirstChild("Humanoid") then char.Humanoid.PlatformStand = false end
            end
            HasTakenQuest = false; HasSetZouSpawn = false; CurrentTargetMob = nil; QuestFinished = false
        else
            HasSetZouSpawn = false 
            CurrentlyHasQuest = CheckQuestStatus()
            if CurrentlyHasQuest then HasTakenQuest = true; isTakingQuest = false end
        end
    end

    return isBusoFarmOn
end

-- 📦 MODULE: AutoGeppo.lua (FIX LỖI ĐỨNG IM & TỐI ƯU HOÀN TOÀN)
__modules["Farm/AutoGeppo"] = function()
    local AutoGeppoModule = {}
    
    local Players = game:GetService("Players")
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local Workspace = game:GetService("Workspace")
    local RunService = game:GetService("RunService")
    local LocalPlayer = Players.LocalPlayer

    _G.AutoGeppo = false

    -- Tọa độ YI trên Coco Island
    local Target_Pos = Vector3.new(-3086.87, 94.54, -11755.48) 
    -- Tọa độ Cổng TP Người Cá
    local Fishman_Portal = Vector3.new(8585.12, -2138.84, -17087.38)

    -- TẠO NỀN ẢO TỐI ƯU CHO LAG/MINIMIZE (Size bự 25x2x25)
    local FakeFloor = Instance.new("Part")
    FakeFloor.Name = "Geppo_FakeFloor"
    FakeFloor.Size = Vector3.new(25, 2, 25)
    FakeFloor.Anchored = true
    FakeFloor.CanCollide = true
    FakeFloor.Transparency = 1
    FakeFloor.Parent = nil

    -- BIẾN QUẢN LÝ TWEEN NỘI BỘ (Chống Memory Leak)
    local TweenConn = nil
    local IsTweening = false
    local IsDropping = false

    -- =========================================
    -- HỆ THỐNG TWEEN BAY MƯỢT TRỰC TIẾP
    -- =========================================
    local function StopTween()
        IsTweening = false
        IsDropping = false
        if TweenConn then 
            TweenConn:Disconnect()
            TweenConn = nil 
        end
        local char = LocalPlayer.Character
        if char and char:FindFirstChild("HumanoidRootPart") then
            local root = char.HumanoidRootPart
            for _, v in pairs(root:GetChildren()) do 
                if v.Name == "ZILI_AntiGravity" then v:Destroy() end 
            end
            root.Velocity = Vector3.new(0, 0, 0)
        end
        if FakeFloor.Parent then FakeFloor.Parent = nil end
    end

    local function StartTween(targetPos, isPortal)
        if IsTweening or IsDropping then return end
        local char = LocalPlayer.Character
        local root = char and char:FindFirstChild("HumanoidRootPart")
        if not root then return end

        IsTweening = true
        FakeFloor.Parent = Workspace

        local antiGravity = root:FindFirstChild("ZILI_AntiGravity") or Instance.new("BodyVelocity")
        antiGravity.Name = "ZILI_AntiGravity"
        antiGravity.MaxForce = Vector3.new(9e9, 9e9, 9e9)
        antiGravity.Velocity = Vector3.new(0, 0, 0)
        antiGravity.Parent = root

        local MAX_SPEED = 90
        -- Khoá mục tiêu cách mặt đất 30 stud để xé gió bay ngang
        local flyTarget = Vector3.new(targetPos.X, targetPos.Y + 30, targetPos.Z)
        local isDiving = false 

        TweenConn = RunService.Heartbeat:Connect(function(deltaTime)
            if not IsTweening or not root or not root.Parent then StopTween(); return end
            
            -- Ép Noclip xuyên tường liên tục trong lúc bay
            for _, part in pairs(char:GetDescendants()) do
                if part:IsA("BasePart") and part.CanCollide then 
                    part.CanCollide = false 
                end
            end

            FakeFloor.CFrame = root.CFrame * CFrame.new(0, -3.2, 0) 
            root.Velocity = Vector3.new(0, 0, 0)

            local currentPos = root.Position
            local activeTarget = isDiving and targetPos or flyTarget
            
            local distXZ = (Vector2.new(activeTarget.X, activeTarget.Z) - Vector2.new(currentPos.X, currentPos.Z)).Magnitude
            local dist3D = (activeTarget - currentPos).Magnitude

            -- [CHỐNG LAG/MINIMIZE]: Bù bước nhảy bất chấp FPS
            local max_step = MAX_SPEED * deltaTime
            if max_step > 150 then max_step = 150 end 
            local step = math.min(max_step, dist3D)

            if not isDiving then
                if distXZ < 15 then 
                    isDiving = true -- Tới ngay đỉnh thì chúi đầu cắm xuống
                else
                    local dir = (activeTarget - currentPos).Unit
                    -- Dùng CFrame.lookAt để nhân vật nhìn thẳng về hướng đang bay
                    root.CFrame = CFrame.lookAt(currentPos + dir * step, activeTarget)
                end
            else
                if dist3D < 3 then 
                    -- ĐÃ ĐẾN ĐÍCH!
                    if isPortal then
                        -- Ngắt kết nối bay ngang, chuyển sang chế độ lặn xuống từ từ (Giữ nguyên AntiGravity)
                        IsTweening = false
                        if TweenConn then TweenConn:Disconnect(); TweenConn = nil end
                        IsDropping = true
                        
                        task.spawn(function()
                            local waited = 0
                            while waited < 4 do
                                if not root or not root.Parent or not _G.AutoGeppo then break end
                                root.CFrame = root.CFrame * CFrame.new(0, -0.5, 0)
                                root.Velocity = Vector3.new(0, 0, 0)
                                task.wait(0.5)
                                waited = waited + 0.5
                            end
                            StopTween() -- Đã xuống xong, gỡ AntiGravity
                        end)
                    else
                        StopTween()
                        if root and root.Parent then root.CFrame = CFrame.new(targetPos) end
                    end
                else
                    local dir = (activeTarget - currentPos).Unit
                    root.CFrame = CFrame.lookAt(currentPos + dir * step, activeTarget)
                end
            end
        end)
    end

    -- =========================================
    -- HÀM TỰ ĐỘNG CLICK GUI CHAT
    -- =========================================
    local function AutoClickUI(chatGui)
        pcall(function()
            if not chatGui:FindFirstChild("Frame") then return end
            
            local btns = {"go", "Go", "endChat", "Accept", "Yes", "Next", "Continue", "Okay", "Set", "Take", "Learn", "Buy"}
            for _, btnName in pairs(btns) do
                local btn = chatGui.Frame:FindFirstChild(btnName)
                if btn and btn.Visible and getconnections then
                    for _, conn in pairs(getconnections(btn.MouseButton1Click)) do conn:Fire() end
                    for _, conn in pairs(getconnections(btn.Activated)) do pcall(function() conn:Fire() end) end
                end
            end

            for _, v in pairs(chatGui.Frame:GetDescendants()) do
                if v:IsA("TextButton") and v.Visible then
                    local txt = string.lower(v.Text)
                    if txt:match("yes") or txt:match("set") or txt:match("accept") or txt:match("sure") or txt:match("okay") or txt:match("next") or txt:match("continue") or txt:match("take") or txt:match("go") or txt:match("learn") or txt:match("buy") then
                        if getconnections then
                            for _, conn in pairs(getconnections(v.MouseButton1Click)) do conn:Fire() end
                            for _, conn in pairs(getconnections(v.Activated)) do pcall(function() conn:Fire() end) end
                        end
                    end
                end
            end
        end)
    end

    -- =========================================
    -- VÒNG LẶP XỬ LÝ CHÍNH
    -- =========================================
    task.spawn(function()
        while true do
            if _G.AutoGeppo then
                pcall(function()
                    local char = LocalPlayer.Character
                    if char and char:FindFirstChild("HumanoidRootPart") then
                        local root = char.HumanoidRootPart
                        local currentPos = root.Position
                        
                        -- 1. DETECTED ĐANG Ở DƯỚI ĐẢO NGƯỜI CÁ
                        if currentPos.Y < -1000 and Target_Pos.Y > -500 then
                            -- [FIX]: Bỏ hết mấy cái điều kiện Y thừa thãi đi, cứ xa cổng là múc!
                            local distToPortal = (currentPos - Fishman_Portal).Magnitude
                            
                            if distToPortal > 15 then
                                if not IsTweening and not IsDropping then
                                    StartTween(Fishman_Portal, true)
                                end
                            end
                            return -- Luôn dừng chu kỳ ở đây để chờ qua đảo mới
                        end

                        -- 2. BAY ĐẾN NPC MUA GEPPO (Khi đã ngoi lên trên)
                        if not IsDropping then
                            local dist = (currentPos - Target_Pos).Magnitude
                            if dist > 20 then
                                if not IsTweening then
                                    StartTween(Target_Pos, false)
                                end
                            else
                                -- ĐÃ TỚI NƠI
                                if IsTweening then StopTween() end
                                
                                -- Đứng cách tọa độ gốc 4 stud để không kẹt vào NPC
                                local standPos = Target_Pos + Vector3.new(0, 0, 4) 
                                local lookAtPos = Vector3.new(Target_Pos.X, standPos.Y, Target_Pos.Z)
                                
                                -- Kích hoạt Proximity Prompt
                                pcall(function()
                                    for _, prompt in pairs(Workspace:GetDescendants()) do
                                        if prompt:IsA("ProximityPrompt") then
                                            if prompt.Parent and (prompt.Parent.Position - root.Position).Magnitude <= 20 then
                                                fireproximityprompt(prompt)
                                            end
                                        end
                                    end
                                end)

                                -- CHỜ BẢNG CHAT XUẤT HIỆN
                                local waitAppear = tick()
                                while tick() - waitAppear < 2 and _G.AutoGeppo do
                                    root.CFrame = CFrame.lookAt(standPos, lookAtPos)
                                    root.Velocity = Vector3.new(0,0,0)
                                    if LocalPlayer.PlayerGui:FindFirstChild("NPCCHAT") then break end
                                    task.wait(0.2)
                                end

                                -- SPAM CLICK GIAO DIỆN CHAT 
                                local waitChatClose = tick()
                                while tick() - waitChatClose < 8 and _G.AutoGeppo do 
                                    root.CFrame = CFrame.lookAt(standPos, lookAtPos)
                                    root.Velocity = Vector3.new(0,0,0)
                                    
                                    local chatGui = LocalPlayer.PlayerGui:FindFirstChild("NPCCHAT")
                                    if not chatGui then break end 
                                    
                                    AutoClickUI(chatGui)
                                    task.wait(0.3) 
                                end
                                
                                task.wait(0.5)
                                
                                -- GỬI REQUEST TRỰC TIẾP
                                pcall(function()
                                    local args = { [1] = "skyWalkTrainer" }
                                    ReplicatedStorage:WaitForChild("Events"):WaitForChild("learnStyle"):FireServer(unpack(args))
                                end)
                                
                                -- Xong việc thì tắt
                                AutoGeppoModule.Toggle(false)
                            end
                        end
                    end
                end)
            else
                -- Tắt Auto -> Dọn dẹp
                if IsTweening or IsDropping then StopTween() end
            end
            task.wait(0.1) -- Vòng lặp nghỉ 0.1s cho mát CPU
        end
    end)

    -- HÀM BẬT/TẮT TỪ GIAO DIỆN
    function AutoGeppoModule.Toggle(state)
        _G.AutoGeppo = state
        if not state then
            StopTween()
        end
    end

    return AutoGeppoModule
end

-- 📦 MODULE: Farm/AutoFishMerchant
__modules["Farm/AutoFishMerchant"] = function()
    local AutoFishMerchant = {}

    -- =====================================================================
    -- SERVICES
    -- =====================================================================
    local Players           = game:GetService("Players")
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local HttpService       = game:GetService("HttpService")
    local VirtualUser       = game:GetService("VirtualUser")
    local RunService        = game:GetService("RunService")
    local workspace         = game:GetService("Workspace")
    local LocalPlayer       = Players.LocalPlayer

    -- =====================================================================
    -- CONSTANTS
    -- =====================================================================
    local MAX_SPEED        = 90
    local VEC_ZERO         = Vector3.new(0, 0, 0)
    local OFFSET_FAKEFLOOR = CFrame.new(0, -3.05, 0)
    local DT_CAP           = 0.08 

    local Cords = {
        Sell  = Vector3.new(-1328.47,  4.07, -4977.97),
        Buy   = Vector3.new(-1342.98,  4.12, -4985.11),
        Craft = Vector3.new(-1376.32,  4.12, -5063.43),
    }

    local FishLists = {
        Leg    = {"Anglerfish","Golden Polka Puffer","Golden Ribbon Angelfish","Golden Tigerfin","Swordfish","Jack-O'-Bite","Dark Skeletal Shark"},
        Rare   = {"Candy Corn Squid","Exotic Tigerfin","Crimson Polka Puffer","Fangfish","Crimson Snapper","Zebra Ribbon Angelfish"},
        Common = {"Blue-Lip Grouper","Tigerfin"},
    }

    local RodsPriority   = {"Devil Fruit Rod","Lovestruck Rod","Merchants Banana Rod","ODM Rod","Jack-O'Rod","Angler Rod","Epic Fishing Rod","Rare Fishing Rod","Common Fishing Rod","Fishing Rod"}
    local TitlesPriority = {"Novice Fisherman","Skilled Fisherman","Master Fisherman","Godly Fisherman"}

    -- =====================================================================
    -- RUNTIME STATE
    -- =====================================================================
    local _Configs = {
        CraftLeg     = false,
        CraftRare    = false,
        EquipRod     = true,
        EquipTitle   = true,
        BuyBait      = false,
        SellCommon   = false,
        SellRare     = false,
        SellLeg      = false,
        AutoMerchant = false,
    }

    local ItemsToBuy = {}

    _G.AutoFishing           = false
    _G.TargetBait            = nil   
    _G.KnownMerchantPos      = nil
    _G.MerchantProcessed     = false
    _G.MerchantSpawnTime     = 0
    _G.LastShopRefreshPeriod = -1

    local _lastShopPeriod = -1

    -- =====================================================================
    -- ANTI-AFK & ANTI-SIT
    -- =====================================================================
    pcall(function()
        for _, conn in pairs(getconnections(LocalPlayer.Idled)) do conn:Disable() end
    end)
    if _G.AntiAfkConnection then _G.AntiAfkConnection:Disconnect() end
    _G.AntiAfkConnection = LocalPlayer.Idled:Connect(function()
        VirtualUser:CaptureController()
        VirtualUser:ClickButton2(Vector2.new())
    end)

    local function PreventSitting(character)
        local humanoid = character:WaitForChild("Humanoid", 5)
        if humanoid then
            humanoid:SetStateEnabled(Enum.HumanoidStateType.Seated, false)
            if humanoid.Sit then humanoid.Sit = false; humanoid.Jump = true end
        end
    end
    if LocalPlayer.Character then PreventSitting(LocalPlayer.Character) end
    LocalPlayer.CharacterAdded:Connect(PreventSitting)

    -- =====================================================================
    -- REMOTES & SPOOF
    -- =====================================================================
    local FishingRemote = ReplicatedStorage:WaitForChild("Fishing", 5)
    if FishingRemote then
        FishingRemote = FishingRemote:WaitForChild("Remotes", 5):WaitForChild("Action", 5)
    end

    local Events   = ReplicatedStorage:WaitForChild("Events", 5)
    local TakeStam = Events and Events:WaitForChild("takestam", 5)

    local isSpoofingStamina = false
    local function StartStaminaSpoof()
        if isSpoofingStamina then return end
        isSpoofingStamina = true
        task.spawn(function()
            while isSpoofingStamina and task.wait(0.05) do
                if TakeStam and TakeStam.Parent then
                    pcall(function() TakeStam:FireServer(0.545, "dash") end)
                else break end
            end
        end)
    end
    local function StopStaminaSpoof() isSpoofingStamina = false end

    -- =====================================================================
    -- HELPERS
    -- =====================================================================
    local function getRoot()
        local char = LocalPlayer.Character
        if char and char:FindFirstChild("HumanoidRootPart") then return char.HumanoidRootPart end
        return nil
    end

    local function GetInventory()
        local invStat = ReplicatedStorage:FindFirstChild("Stats" .. LocalPlayer.Name)
        if not invStat then return nil end
        local invVal = invStat:FindFirstChild("Inventory")
        if invVal and invVal:FindFirstChild("Inventory") then
            local ok, res = pcall(function() return HttpService:JSONDecode(invVal.Inventory.Value) end)
            return ok and res or nil
        end
        return nil
    end

    local function GetMyBobble()
        local myName = LocalPlayer.Name
        for _, area in pairs({workspace, LocalPlayer.Character}) do
            if area then
                for _, obj in pairs(area:GetDescendants()) do
                    if string.find(obj.Name, myName) and obj:GetAttribute("Caught") == true then
                        return obj
                    end
                end
            end
        end
        return nil
    end

    local function EquipPhysicalRod(rodName)
        local char = LocalPlayer.Character
        if not char then return false end
        if char:FindFirstChild(rodName) then return true end
        local backpack = LocalPlayer:FindFirstChild("Backpack")
        if backpack and backpack:FindFirstChild(rodName) then
            char.Humanoid:EquipTool(backpack[rodName])
            task.wait(0.3); return true
        end
        -- Rod is in JSON inventory but not spawned physically yet
        -- (GBO uses custom inventory — server equip via Tools remote already done)
        local inv = GetInventory()
        if inv and (inv[rodName] or 0) > 0 then return true end
        return false
    end

    local _rodBuyPos = Vector3.new(-1343.85, 4.12, -4979.27)
    local _justBoughtRod = false  -- flag → RunLoop sẽ continue sau khi mua rod

    local function BuyFishingRodIfNeeded(inventory)
        if not inventory then return end
        for _, rodName in ipairs(RodsPriority) do
            if (inventory[rodName] or 0) > 0 then _justBoughtRod = false; return end
        end
        -- Không có rod nào → mua Fishing Rod
        _justBoughtRod  = true
        _cachedRodName  = nil   -- bắt buộc reset cache để AutoEquipRodSilent gọi lại equip
        TweenToPosAndWait(_rodBuyPos)
        if not _G.AutoFishing then return end
        pcall(function()
            ReplicatedStorage:WaitForChild("Events"):WaitForChild("Shop"):InvokeServer(
                workspace:WaitForChild("BuyableItems"):WaitForChild("Fishing Rod"), 1
            )
        end)
        task.wait(3)   -- chờ server xử lý và cập nhật inventory JSON
    end

    local _cachedRodName = nil
    local function AutoEquipRodSilent()
        local inventory = GetInventory()
        if not inventory then return _cachedRodName end
        for _, rodName in ipairs(RodsPriority) do
            if inventory[rodName] and inventory[rodName] > 0 then
                if rodName ~= _cachedRodName then
                    pcall(function() ReplicatedStorage:WaitForChild("Events"):WaitForChild("Tools"):InvokeServer("equip", rodName) end)
                    _cachedRodName = rodName
                    task.wait(0.5) -- [SỬA LỖI LOGIC 3]: Đợi 0.5s cho Server bỏ cái cần mới vào Balo rồi mới chạy tiếp
                end
                return rodName
            end
        end
        _cachedRodName = nil
        return nil
    end

    local function AutoEquipTitleSilent()
        task.spawn(function()
            for _, titleName in ipairs(TitlesPriority) do
                pcall(function() ReplicatedStorage:WaitForChild("Events"):WaitForChild("Titles"):InvokeServer(titleName) end)
                task.wait(0.1)
            end
        end)
    end

    local BAIT_FALLBACK = {
        ["Legendary Fish Bait"] = {"Legendary Fish Bait", "Rare Fish Bait", "Common Fish Bait"},
        ["Rare Fish Bait"]      = {"Rare Fish Bait", "Common Fish Bait"},
        ["Common Fish Bait"]    = {"Common Fish Bait"},
    }
    local function ResolveBait(inv)
        local preferred = _G.PreferredBait
        if not preferred then return nil end
        local chain = BAIT_FALLBACK[preferred]
        if not chain then return preferred end
        for _, bait in ipairs(chain) do
            if (inv[bait] or 0) > 0 then return bait end
        end
        return nil  
    end

    -- =====================================================================
    -- TWEEN SYSTEM
    -- =====================================================================
    local Tween = { IsTeleporting = false, MoveConn = nil, NoclipConn = nil, FakeFloor = nil }

    function Tween.Stop()
        Tween.IsTeleporting = false
        StopStaminaSpoof()
        if Tween.MoveConn   then Tween.MoveConn:Disconnect();   Tween.MoveConn   = nil end
        if Tween.NoclipConn then Tween.NoclipConn:Disconnect(); Tween.NoclipConn = nil end
        local root = getRoot()
        if root then
            root.Anchored = false 
            for _, v in pairs(root:GetChildren()) do
                if v.Name == "ZILI_AntiGravity" then v:Destroy() end
            end
            root.Velocity = VEC_ZERO
        end
        if Tween.FakeFloor then Tween.FakeFloor:Destroy(); Tween.FakeFloor = nil end
    end

    function Tween.Start(finalDest, onComplete, opts)
        opts = opts or {}
        Tween.Stop()
        Tween.IsTeleporting = true
        StartStaminaSpoof()

        Tween.NoclipConn = RunService.Stepped:Connect(function()
            if Tween.IsTeleporting and LocalPlayer.Character then
                for _, part in pairs(LocalPlayer.Character:GetDescendants()) do
                    if part:IsA("BasePart") then part.CanCollide = false end
                end
            end
        end)

        local route       = {}
        local initialRoot = getRoot()
        if not initialRoot then Tween.Stop(); return end

        local function isPortalPos(pos) return pos.Y < -20 and pos.Y > -500 end

        if initialRoot.Position.Y > -1000 and finalDest.Y < -1000 then
            table.insert(route, {pos=Vector3.new(1842.72,-50,-12170.62), isPortal=true, isFishmanIn=true,  isFishmanExit=false, isMerchant=false})
        end
        if initialRoot.Position.Y < -1000 and finalDest.Y > -1000 then
            table.insert(route, {pos=Vector3.new(8585.12,-2138.84,-17087.38), isPortal=true, isFishmanIn=false, isFishmanExit=true, isMerchant=false})
        end
        table.insert(route, {
            pos         = finalDest,
            isPortal    = isPortalPos(finalDest),
            isFishmanIn = false, isFishmanExit = false,
            isMerchant  = opts.isMerchant or false,
        })

        local function flyTo(stepData, onStepComplete)
            local root = getRoot()
            local wt = 0
            while not root and wt < 10 do task.wait(0.5); wt = wt + 0.5; root = getRoot() end
            if not Tween.IsTeleporting or not root then Tween.Stop(); return end

            if not Tween.FakeFloor then
                Tween.FakeFloor             = Instance.new("Part")
                Tween.FakeFloor.Name        = "ZILI_FakeFloor"
                Tween.FakeFloor.Size        = Vector3.new(15, 2, 15)
                Tween.FakeFloor.Anchored    = true
                Tween.FakeFloor.Transparency = 1
                Tween.FakeFloor.Parent      = workspace
            end

            local ag       = root:FindFirstChild("ZILI_AntiGravity") or Instance.new("BodyVelocity")
            ag.Name        = "ZILI_AntiGravity"
            ag.MaxForce    = Vector3.new(9e9, 9e9, 9e9)
            ag.Velocity    = VEC_ZERO
            ag.Parent      = root
            local targetPos = stepData.pos

            local flyY
            if stepData.isMerchant then
                flyY = math.max(targetPos.Y, 4)
            elseif stepData.isFishmanIn or stepData.isFishmanExit then
                flyY = targetPos.Y
            else
                flyY = 7.33
            end

            Tween.MoveConn = RunService.Heartbeat:Connect(function(rawDt)
                if not Tween.IsTeleporting or not root.Parent then Tween.Stop(); return end
                local dt = math.min(rawDt, DT_CAP)

                if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                root.Velocity = VEC_ZERO

                local cur    = root.Position
                local distXZ = (Vector2.new(targetPos.X, targetPos.Z) - Vector2.new(cur.X, cur.Z)).Magnitude

                if not stepData.isMerchant and not stepData.isFishmanIn and not stepData.isFishmanExit then
                    if math.abs(cur.Y - 7.33) > 10 and distXZ > 50 then
                        Tween.MoveConn:Disconnect()
                        task.spawn(function()
                            root.CFrame = CFrame.new(cur.X, 7.33, cur.Z)
                            task.wait(0.2)
                            flyTo(stepData, onStepComplete)
                        end)
                        return
                    end
                end

                local arrived
                if stepData.isMerchant then
                    arrived = (cur - targetPos).Magnitude < 25
                else
                    arrived = distXZ < 30
                end

                if arrived then
                    Tween.MoveConn:Disconnect()
                    task.spawn(function()
                        local waited = 0
                        if stepData.isFishmanExit then
                            root.CFrame = CFrame.lookAt(root.Position, targetPos)
                            task.wait(0.1)
                            while waited < 20 do
                                if not Tween.IsTeleporting or not root then break end
                                if (root.Position - targetPos).Magnitude > 200 then break end
                                root.CFrame = root.CFrame * CFrame.new(0, 0, -3)
                                if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                                task.wait(0.15); waited = waited + 0.15
                            end
                        elseif stepData.isPortal or stepData.isFishmanIn then
                            local toggle = 1
                            while waited < 20 do
                                if not Tween.IsTeleporting or not root then break end
                                if (root.Position - targetPos).Magnitude > 200 then break end
                                root.CFrame = CFrame.new(targetPos.X + toggle, targetPos.Y, targetPos.Z + toggle)
                                if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                                toggle = toggle * -1; task.wait(0.3); waited = waited + 0.3
                            end
                            task.wait(1.5)
                        elseif stepData.isMerchant then
                            -- Fix3: snap character close to merchant and anchor immediately
                            -- so server cannot pull it back before BuyItemsFromMerchant runs
                            local landPos = Vector3.new(targetPos.X + 3, targetPos.Y, targetPos.Z + 3)
                            root.CFrame = CFrame.new(landPos)
                            if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                            root.Anchored = true   -- Fix1: lock in place before onStepComplete
                            task.wait(0.3)
                            -- Fix3: verify character wasn't pulled away during the wait
                            if (root.Position - landPos).Magnitude > 30 then
                                -- Server pulled us back — unanchor, retry flyTo from new position
                                root.Anchored = false
                                task.wait(0.3)
                                flyTo(stepData, onStepComplete)
                                return
                            end
                        else
                            root.CFrame = CFrame.new(targetPos.X, targetPos.Y, targetPos.Z)
                            if Tween.FakeFloor then Tween.FakeFloor.CFrame = root.CFrame * OFFSET_FAKEFLOOR end
                            task.wait(0.2)
                            -- Fix3: verify arrival for non-merchant paths too
                            if (root.Position - targetPos).Magnitude > 60 then
                                -- Pulled back by server — retry
                                task.wait(0.2)
                                flyTo(stepData, onStepComplete)
                                return
                            end
                        end
                        if onStepComplete then onStepComplete() end
                    end)
                else
                    local maxS = math.min(MAX_SPEED * dt, 8) 
                    local safeY = flyY
                    local tgt   = Vector3.new(targetPos.X, safeY, targetPos.Z)
                    local diff  = tgt - cur
                    local dist  = diff.Magnitude
                    if dist > 0 then
                        root.CFrame = CFrame.new(cur + diff.Unit * math.min(maxS, dist))
                    end
                end
            end)
        end

        local function processRoute(idx)
            if not Tween.IsTeleporting then return end
            if idx > #route then Tween.Stop(); if onComplete then onComplete() end; return end
            flyTo(route[idx], function() processRoute(idx + 1) end)
        end
        processRoute(1)
    end

    function TweenToPosAndWait(targetPos, opts)
        local isDone = false
        Tween.Start(targetPos, function() isDone = true end, opts)
        while not isDone and _G.AutoFishing do
            if not Tween.IsTeleporting and not isDone then break end
            task.wait(0.2)
        end
        if not _G.AutoFishing then Tween.Stop() end
    end

    -- =====================================================================
    -- SELL / CRAFT
    -- =====================================================================
    local function AutoSellSilent(fishList)
        local inventory = GetInventory()
        if not inventory then return false end
        local shouldSell = false
        for _, name in ipairs(fishList) do if (inventory[name] or 0) > 0 then shouldSell = true; break end end
        if not shouldSell then return false end

        -- Helper: đọc peli hiện tại, trả về số (0 nếu lỗi)
        local function getCurrentPeli()
            local val = 0
            pcall(function()
                local n = ReplicatedStorage:FindFirstChild("Stats"..LocalPlayer.Name)
                n = n and n:FindFirstChild("Stats")
                n = n and n:FindFirstChild("Peli")
                if n then val = n.Value end
            end)
            return val
        end

        -- Không bay nếu peli đã >= 1M trước khi đi
        if getCurrentPeli() >= 1000000 then return false end

        TweenToPosAndWait(Cords.Sell)
        if not _G.AutoFishing then return false end

        inventory = GetInventory()
        if not inventory then return false end

        for _, fishName in ipairs(fishList) do
            local count = inventory[fishName] or 0
            if count > 0 then
                for i = 1, count do
                    if not _G.AutoFishing then break end
                    -- Check peli TRƯỚC khi bán con cá này
                    if getCurrentPeli() >= 1000000 then return true end
                    pcall(function()
                        ReplicatedStorage:WaitForChild("FishingShopRemote"):InvokeServer(unpack({{
                            ["Fish"]=fishName, ["All"]=false, ["Method"]="SellFish"
                        }}))
                    end)
                    -- Đợi server cập nhật peli (0.1s quá ngắn, server chưa kịp cộng tiền)
                    task.wait(0.5)
                    -- Check lại ngay sau khi sell + wait — nếu vừa chạm 1M thì dừng
                    if getCurrentPeli() >= 1000000 then return true end
                end
            end
        end
        return true
    end

    local function AutoCraftSilent(blueprintType, extraDataKey, fishList, minCount, countPerCraft)
        minCount      = minCount      or 1
        countPerCraft = countPerCraft or 1   -- số cá dùng mỗi lần craft (rare = 2)
        local inventory = GetInventory()
        if not inventory then return false end
        local craftedAny = false
        for _, fishName in ipairs(fishList) do
            local count = inventory[fishName] or 0
            if count >= minCount then
                if not craftedAny then
                    TweenToPosAndWait(Cords.Craft)
                    craftedAny = true
                    if not _G.AutoFishing then return false end
                end
                -- Craft từng batch countPerCraft con — tránh gửi dư cá lên server
                local batches = math.floor(count / countPerCraft)
                for _ = 1, batches do
                    if not _G.AutoFishing then return false end
                    pcall(function()
                        ReplicatedStorage:WaitForChild("CraftingRemote"):InvokeServer(unpack({{
                            ["BlueprintItem"]=blueprintType, ["Method"]="Craft",
                            ["ExtraData"]={[extraDataKey]=fishName}, ["Count"]=countPerCraft,
                        }}))
                    end)
                    task.wait(0.5)
                end
            end
        end
        return craftedAny
    end

    -- =====================================================================
    -- MERCHANT
    -- =====================================================================
    local function AutoClickMerchantUI()
        local chatGui = LocalPlayer.PlayerGui:FindFirstChild("NPCCHAT")
        if not chatGui then return end
        local frame = chatGui:FindFirstChild("Frame") or chatGui:FindFirstChildWhichIsA("Frame", true)
        if not frame then return end
        pcall(function()
            for _, v in pairs(frame:GetDescendants()) do
                if v:IsA("TextButton") and v.Visible then
                    local txt = string.lower(v.Text or "")
                    local isAction = txt == "..." or txt == "go" or txt:match("yes") or txt:match("accept")
                        or txt:match("next") or txt:match("take") or txt:match("continue")
                        or txt:match("okay") or txt:match("set") or txt == "end"
                        or v.Name:lower():match("go") or v.Name:lower():match("continue")
                        or v.Name:lower():match("accept") or v.Name == "..."
                    if isAction and getconnections then
                        for _, c in pairs(getconnections(v.MouseButton1Click)) do pcall(function() c:Fire() end) end
                        for _, c in pairs(getconnections(v.Activated))         do pcall(function() c:Fire() end) end
                    end
                end
            end
        end)
    end

    local _MerchantDetectConn1 = nil
    local _MerchantDetectConn2 = nil
    local _MerchantAttrConn    = nil

    local function SetupMerchantDetection()
        if _MerchantDetectConn1 then _MerchantDetectConn1:Disconnect(); _MerchantDetectConn1 = nil end
        if _MerchantDetectConn2 then _MerchantDetectConn2:Disconnect(); _MerchantDetectConn2 = nil end
        if _MerchantAttrConn    then _MerchantAttrConn:Disconnect();    _MerchantAttrConn    = nil end

        local compassGuider = ReplicatedStorage:FindFirstChild("CompassGuider")
        if not compassGuider then
            task.delay(5, SetupMerchantDetection)
            return
        end

        local function hookMerchantValue(merchantObj)
            if not merchantObj or merchantObj.Name ~= "Traveling Merchant" then return end
            if _MerchantAttrConn then _MerchantAttrConn:Disconnect() end

            _MerchantAttrConn = merchantObj:GetPropertyChangedSignal("Value"):Connect(function()
                local v = merchantObj.Value
                if typeof(v) ~= "Vector3" then return end

                if v.Magnitude > 10 then
                    if not _G.KnownMerchantPos or (_G.KnownMerchantPos - v).Magnitude > 5 then
                        _G.KnownMerchantPos  = v
                        _G.MerchantSpawnTime = os.time()
                        _G.MerchantProcessed = false
                        _lastShopPeriod      = -1   
                    end
                else
                    _G.KnownMerchantPos  = nil
                    _G.MerchantProcessed = false
                    _G.MerchantSpawnTime = 0
                    _lastShopPeriod      = -1
                end
            end)
        end

        _MerchantDetectConn1 = compassGuider.ChildAdded:Connect(function(child)
            if child.Name ~= "Traveling Merchant" then return end
            task.wait(0.2)  
            hookMerchantValue(child)
            local v = child.Value
            if typeof(v) == "Vector3" and v.Magnitude > 10 then
                _G.KnownMerchantPos  = v
                _G.MerchantSpawnTime = os.time()
                _G.MerchantProcessed = false
                _lastShopPeriod      = -1
            end
        end)

        _MerchantDetectConn2 = compassGuider.ChildRemoved:Connect(function(child)
            if child.Name ~= "Traveling Merchant" then return end
            _G.KnownMerchantPos  = nil
            _G.MerchantProcessed = false
            _G.MerchantSpawnTime = 0
            _lastShopPeriod      = -1
            if _MerchantAttrConn then _MerchantAttrConn:Disconnect(); _MerchantAttrConn = nil end
        end)

        local existing = compassGuider:FindFirstChild("Traveling Merchant")
        if existing then
            hookMerchantValue(existing)

            local v = existing.Value
            if typeof(v) == "Vector3" and v.Magnitude > 10 then
                local npcActive = false
                for _, folder in pairs({workspace, workspace:FindFirstChild("NPCs"), workspace:FindFirstChild("Merchants")}) do
                    if folder then
                        for _, npc in ipairs(folder:GetChildren()) do
                            if npc.Name == "Traveling Merchant" or npc.Name == "Merchant" then
                                npcActive = true; break
                            end
                        end
                    end
                    if npcActive then break end
                end

                if npcActive then
                    _G.KnownMerchantPos  = v
                    _G.MerchantSpawnTime = os.time()  
                    _G.MerchantProcessed = false
                    _lastShopPeriod      = -1
                end
            end
        end
    end

    task.spawn(SetupMerchantDetection)

    local function SendMerchantWebhook(shopData, boughtData)
        local url = _G.WebhookUrl or ""
        if url == "" then return end

        local function Fmt(n)
            n = tostring(n)
            while true do local k; n,k=string.gsub(n,"^(-?%d+)(%d%d%d)","%1,%2"); if k==0 then break end end
            return n
        end

        local currentPeli = "0"
        pcall(function()
            local s = ReplicatedStorage:FindFirstChild("Stats"..LocalPlayer.Name)
            if s and s.Stats and s.Stats.Peli then currentPeli = Fmt(s.Stats.Peli.Value) end
        end)

        local Rarity = {
            ["All Seeing Shamrock"]="Mythic",["Mythical Fruit Chest"]="Mythic",
            ["Legendary Fruit Chest"]="Legendary",["Tropical Parrot"]="Legendary",["Coffin Boat"]="Legendary",["Striker"]="Legendary",["Hoverboard"]="Legendary",["Legendary Fish Bait"]="Legendary",["Merchants Banana Rod"]="Legendary",["Knight's Gauntlet"]="Legendary",["Crab Cutlass"]="Legendary",["Bisento"]="Legendary",["Kessui"]="Legendary",["Raiui"]="Legendary",
            ["Hunter's Journal"]="Epic",["Jitte"]="Epic",["Crimson Nightcoat"]="Epic",["Sea-Breeze Haori"]="Epic",["Spirit Color Essence"]="Epic",["Raylo's Outfit"]="Epic",["Blossom Skirt"]="Epic",["Desert Merchant Outfit"]="Epic",["Sea-Breeze Skirt"]="Epic",["Tari's Karoo Coat"]="Epic",
            ["Thrilled Ship"]="Rare",["Spare Fruit Bag"]="Rare",["Rare Fruit Chest"]="Rare",["Bomi's Log Pose"]="Rare",["Gravity Blade"]="Rare",["Race Reroll"]="Rare",["Dark Root"]="Rare",["Rare Fish Bait"]="Rare",["Golden Staff"]="Rare",["Golden Hook"]="Rare",
            ["Karoo Mount"]="Uncommon",["Special Tailor Token"]="Uncommon",["SP Reset Essence"]="Common",
        }
        local UI = {
            Mythic    = {Title="🍆 Mythic",    Icon="🔮"},
            Legendary = {Title="🔥 Legendary", Icon="🔸"},
            Epic      = {Title="🟣 Epic",       Icon="🔹"},
            Rare      = {Title="🔵 Rare",       Icon="🔹"},
            Uncommon  = {Title="🟢 Uncommon",   Icon="▫️"},
            Common    = {Title="⚪ Common",      Icon="▫️"},
        }

        local grouped = {Mythic={},Legendary={},Epic={},Rare={},Uncommon={},Common={}}
        local total, totalVal = 0, 0
        for name, data in pairs(shopData) do
            total = total + 1
            local p = type(data.Price)=="string" and tonumber((data.Price:gsub(",",""))) or tonumber(data.Price) or 0
            totalVal = totalVal + p
            table.insert(grouped[Rarity[name] or "Common"], {Name=name,Stock=data.Stock,Price=Fmt(p)})
        end

        local hidden = "||"..LocalPlayer.Name.."||"
        local T3     = string.rep(string.char(96),3)
        local fields, order = {}, {"Mythic","Legendary","Epic","Rare","Uncommon","Common"}
        for _,r in ipairs(order) do
            if #grouped[r] > 0 then
                table.insert(fields,{["name"]=UI[r].Title.." ("..#grouped[r]..")",["value"]="** **",["inline"]=false})
                for _,item in ipairs(grouped[r]) do
                    table.insert(fields,{["name"]=UI[r].Icon.." "..item.Name,["value"]=string.format("%s\nStock: %s\nPrice: %s Peli\n%s",T3,tostring(item.Stock),item.Price,T3),["inline"]=true})
                end
            end
        end

        local bLines, hasMythic, hasBought = "", false, false
        for name, amt in pairs(boughtData) do
            bLines  = bLines..string.format("+ %s x%d\n",name,amt)
            hasBought = true
            if (Rarity[name] or "Common")=="Mythic" then hasMythic=true end
        end
        if hasBought then table.insert(fields,{["name"]="\n✅ **PURCHASED ITEMS:**",["value"]=string.format("%sdiff\n%s%s",T3,bLines,T3),["inline"]=false}) end

        local color = hasMythic and 10494192 or hasBought and 65280 or 16711680
        local embeds, cur, idx = {}, {}, 1
        local function flush()
            local e={["color"]=color}
            if idx==1 then
                e["author"]      = {["name"]="🛒 TRAVELING MERCHANT",["icon_url"]="https://tr.rbxcdn.com/3932789139a04a9d70081d9f8e874cc6/150/150/Image/Png"}
                e["description"] = "**Player info:**\n🤰 User: "..hidden.."\n💰 Peli: "..currentPeli.."\n\n**📊 Summary:** "..total.." items | "..Fmt(totalVal).." Peli total"
            end
            if #cur>0 then e["fields"]=cur end
            table.insert(embeds,e); cur={}; idx=idx+1
        end
        for _,f in ipairs(fields) do table.insert(cur,f); if #cur==25 then flush() end end
        if #cur>0 or idx==1 then flush() end
        embeds[#embeds]["footer"] = {["text"]="ZILI HUB | "..os.date("%d/%m/%Y %H:%M:%S")}

        local payload = {["embeds"]=embeds}
        if hasMythic then payload["content"]="@everyone\n🟣 **ALERT: SUCCESSFULLY PURCHASED A MYTHIC ITEM!**"; payload["allowed_mentions"]={["parse"]={"everyone"}} end

        local req = (syn and syn.request) or (http and http.request) or http_request or (fluxus and fluxus.request) or request
        if req then pcall(function() req({Url=url,Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode(payload)}) end) end
    end

    local function FindNearbyMerchant(rPart, maxRadius)
        maxRadius = maxRadius or 80 
        for _, folder in pairs({workspace, workspace:FindFirstChild("NPCs"), workspace:FindFirstChild("Merchants")}) do
            if folder then
                for _, npc in ipairs(folder:GetChildren()) do
                    if npc.Name == "Traveling Merchant" or npc.Name == "Merchant" then
                        local mr = npc:FindFirstChild("HumanoidRootPart")
                        if mr and (mr.Position - rPart.Position).Magnitude <= maxRadius then
                            return npc, mr.Position
                        end
                    end
                end
            end
        end
        return nil, nil
    end

    local function BuyItemsFromMerchant(npc)
        local questR    = ReplicatedStorage:WaitForChild("Events"):WaitForChild("Quest")
        local merchantR = ReplicatedStorage:WaitForChild("Events"):WaitForChild("TravelingMerchentRemote")
        local root      = getRoot()

        -- root.Anchored is already set to true by flyTo's isMerchant arrived block (Fix1)
        -- Keep it anchored for the entire transaction duration

        -- Fix2: fire proximity prompt up to 3 times with a small gap
        -- At low FPS the first fire may not register server-side
        if root and npc then
            for attempt = 1, 3 do
                pcall(function()
                    for _, p in pairs(npc:GetDescendants()) do
                        if p:IsA("ProximityPrompt") then fireproximityprompt(p) end
                    end
                end)
                task.wait(0.4)
                -- If NPCCHAT already opened, stop retrying
                if LocalPlayer.PlayerGui:FindFirstChild("NPCCHAT") then break end
            end
        end

        -- Fix2: retry questR:InvokeServer up to 3 times instead of once
        for attempt = 1, 3 do
            pcall(function() questR:InvokeServer({ [1] = { [1] = "npcChat", [2] = true } }) end)
            task.wait(0.3)
            if LocalPlayer.PlayerGui:FindFirstChild("NPCCHAT") then break end
        end

        -- Fix2: wait for MerchentShop, clicking buttons without Visible check
        -- At 10 FPS minimized, v.Visible may return false even though button exists
        local shopGui = nil
        local deadline = tick() + 15
        while tick() < deadline and _G.AutoFishing do
            -- Click all candidate buttons regardless of Visible state
            local chatGui = LocalPlayer.PlayerGui:FindFirstChild("NPCCHAT")
            if chatGui then
                local frame = chatGui:FindFirstChild("Frame") or chatGui:FindFirstChildWhichIsA("Frame", true)
                if frame then
                    pcall(function()
                        for _, v in pairs(frame:GetDescendants()) do
                            if v:IsA("TextButton") then  -- removed v.Visible check
                                local txt = string.lower(v.Text or "")
                                local isAction = txt == "..." or txt == "go" or txt:match("yes") or txt:match("accept")
                                    or txt:match("next") or txt:match("take") or txt:match("continue")
                                    or txt:match("okay") or txt:match("set") or txt == "end"
                                    or v.Name:lower():match("go") or v.Name:lower():match("continue")
                                    or v.Name:lower():match("accept") or v.Name == "..."
                                if isAction and getconnections then
                                    for _, c in pairs(getconnections(v.MouseButton1Click)) do pcall(function() c:Fire() end) end
                                    for _, c in pairs(getconnections(v.Activated))         do pcall(function() c:Fire() end) end
                                end
                            end
                        end
                    end)
                end
            end
            task.wait(0.4)
            shopGui = LocalPlayer.PlayerGui:FindFirstChild("MerchentShop")
            if shopGui then break end
            -- Fix2: if chat closed without opening shop, retry questR
            if not chatGui and not shopGui then
                pcall(function() questR:InvokeServer({ [1] = { [1] = "npcChat", [2] = true } }) end)
                task.wait(0.5)
            end
        end

        if not shopGui then
            if root then root.Anchored = false end
            return
        end
        task.wait(0.3)

        local seed = shopGui:GetAttribute("Seed")
        if not seed then
            if root then root.Anchored = false end
            return
        end

        local shopData, container = {}, nil
        local listGUI = shopGui:FindFirstChild("List", true)
        container = listGUI and listGUI:FindFirstChild("Redeemables") or listGUI
        if container then
            for _, obj in ipairs(container:GetChildren()) do
                if obj:IsA("GuiObject") and obj.Name~="Template" and obj.Name~="UIListLayout" and obj.Name~="UIPadding" then
                    local al = obj:FindFirstChild("Amount",true); local pl = obj:FindFirstChild("Price",true)
                    if al and pl then
                        local s = tonumber(al.Text:match("%d+")) or 0
                        if not shopData[obj.Name] then shopData[obj.Name]={Stock=s,Price=pl.Text} end
                    end
                end
            end
        end

        local boughtData = {}
        for _, itemName in ipairs(ItemsToBuy) do
            local info = shopData[itemName]
            if info and info.Stock > 0 then
                for _ = 1, info.Stock do
                    local ok = pcall(function() return merchantR:InvokeServer(itemName, seed) end)
                    if ok then boughtData[itemName] = (boughtData[itemName] or 0) + 1 end
                    task.wait(1)
                    pcall(function()
                        if LocalPlayer.PlayerGui:FindFirstChild("PromptQuestion") then
                            LocalPlayer.PlayerGui.PromptQuestion:Destroy()
                        end
                    end)
                end
            end
        end

        task.wait(1)
        pcall(function() merchantR:InvokeServer("Close") end)
        task.spawn(function() SendMerchantWebhook(shopData, boughtData) end)

        if root then root.Anchored = false end
    end

    local BUY_PRIORITY = {
        "All Seeing Shamrock", "Mythical Fruit Chest", "Legendary Fruit Chest",
        "Legendary Fish Bait", "Rare Fruit Chest",
    }

    local function SyncConfigs(TogglesData)
        local baitVal = TogglesData["Config_SelectBait"] and TogglesData["Config_SelectBait"].Value
        _G.PreferredBait = (type(baitVal)=="string" and baitVal~="") and baitVal or nil

        local sell = TogglesData["Config_SellFish"] and TogglesData["Config_SellFish"].Value or {}
        _Configs.SellCommon = sell["Common Fish"]    == true
        _Configs.SellRare   = sell["Rare Fish"]      == true
        _Configs.SellLeg    = sell["Legendary Fish"] == true

        local craft = TogglesData["Config_CraftBait"] and TogglesData["Config_CraftBait"].Value or {}
        _Configs.CraftLeg  = craft["Legendary Bait"] == true
        _Configs.CraftRare = craft["Rare Bait"]      == true

        local buy = TogglesData["Config_BuyItems"] and TogglesData["Config_BuyItems"].Value or {}
        local buySet = {}
        for name, on in pairs(buy) do if on then buySet[name] = true end end
        ItemsToBuy = {}
        for _, name in ipairs(BUY_PRIORITY) do
            if buySet[name] then table.insert(ItemsToBuy, name); buySet[name] = nil end
        end
        for name in pairs(buySet) do table.insert(ItemsToBuy, name) end  

        _Configs.AutoMerchant = #ItemsToBuy > 0
        -- BuyBait dựa vào PreferredBait (bait user chọn), không phải TargetBait (bait hiện resolve được)
        -- Nếu user chọn Common Fish Bait thì luôn mua, kể cả khi inventory đang trống
        _Configs.BuyBait = (_G.PreferredBait == "Common Fish Bait")
    end

    -- =====================================================================
    -- MAIN LOOP
    -- Priority: 0=mua rod → 1=merchant → 2=equip rod+title → 3=mua mồi → 4=bán+craft → 5=câu
    -- =====================================================================
    local function RunLoop(TogglesData)
        while _G.AutoFishing do
            task.wait(1)
            SyncConfigs(TogglesData)   -- sets _G.PreferredBait, _Configs.*

            if not FishingRemote then task.wait(2); continue end

            local char  = LocalPlayer.Character
            local hum   = char and char:FindFirstChild("Humanoid")
            local rPart = char and char:FindFirstChild("HumanoidRootPart")
            if not char or not rPart or not hum or hum.Health <= 0 then
                task.wait(2); continue
            end

            pcall(function() ReplicatedStorage.Events.takestam:FireServer(0.545, "dash") end)

            -- ════════════════════════════════════════════════════════════════
            -- PRIORITY 0: MUA ROD (block tất cả, mua + equip luôn trong hàm)
            -- ════════════════════════════════════════════════════════════════
            local invForRod = GetInventory()
            _justBoughtRod  = false
            BuyFishingRodIfNeeded(invForRod)
            if not _G.AutoFishing then break end
            if _justBoughtRod then continue end  -- vừa mua+equip xong → re-check từ đầu

            -- ════════════════════════════════════════════════════════════════
            -- PRIORITY 1: TRAVELING MERCHANT
            -- ════════════════════════════════════════════════════════════════
            if _Configs.AutoMerchant then
                local curMin = tonumber(os.date("%M")) or 0
                -- Reset processed flag khi qua mốc :00 hoặc :30
                if curMin == 0 or curMin == 30 then
                    if _lastShopPeriod ~= curMin then
                        _lastShopPeriod = curMin
                        if _G.KnownMerchantPos then _G.MerchantProcessed = false end
                    end
                else
                    _lastShopPeriod = -1
                end

                -- Despawn guard: 10 phút
                if _G.KnownMerchantPos then
                    if os.time() - (_G.MerchantSpawnTime or 0) >= 600 then
                        _G.KnownMerchantPos  = nil
                        _G.MerchantProcessed = false
                        _G.MerchantSpawnTime = 0
                        _lastShopPeriod      = -1
                    end
                end

                if _G.KnownMerchantPos and not _G.MerchantProcessed then
                    local mPos = _G.KnownMerchantPos
                    TweenToPosAndWait(mPos, {isMerchant = true})
                    if _G.AutoFishing then
                        local foundNpc = FindNearbyMerchant(rPart, 80)
                        if not foundNpc then
                            task.wait(1)
                            local root = getRoot()
                            if root then
                                root.CFrame = CFrame.new(mPos + Vector3.new(0, 2, 0))
                                task.wait(0.5)
                            end
                            foundNpc = FindNearbyMerchant(rPart, 100)
                        end
                        if foundNpc then
                            BuyItemsFromMerchant(foundNpc)
                            _G.MerchantProcessed = true
                            TweenToPosAndWait(mPos + Vector3.new(20, 0, 20))
                        else
                            _G.MerchantProcessed = true
                        end
                    end
                end
            end

            if not _G.AutoFishing then break end

            -- ════════════════════════════════════════════════════════════════
            -- PRIORITY 2: EQUIP ROD + TITLE
            -- ════════════════════════════════════════════════════════════════
            local rodName = "Fishing Rod"
            if _Configs.EquipRod then
                rodName = AutoEquipRodSilent() or "Fishing Rod"
            end
            if _Configs.EquipTitle then AutoEquipTitleSilent() end

            -- ════════════════════════════════════════════════════════════════
            -- PRIORITY 3: MUA MỒI
            -- Dùng _G.PreferredBait (user đã chọn) không phải _G.TargetBait
            -- để đảm bảo fresh acc không có bait vẫn đi mua
            -- ════════════════════════════════════════════════════════════════
            if _Configs.BuyBait then   -- true khi PreferredBait == "Common Fish Bait"
                local invCheck = GetInventory() or {}
                if (invCheck["Common Fish Bait"] or 0) < 1 then
                    TweenToPosAndWait(Cords.Buy)
                    if _G.AutoFishing then
                        pcall(function()
                            ReplicatedStorage.Events.Shop:InvokeServer(
                                workspace.BuyableItems["Common Fish Bait"],
                                _G.FishBuyAmount or 50
                            )
                        end)
                        task.wait(1)
                    end
                end
            end

            if not _G.AutoFishing then break end

            -- ════════════════════════════════════════════════════════════════
            -- PRIORITY 4: BÁN CÁ + CRAFT MỒI
            -- ════════════════════════════════════════════════════════════════
            if _Configs.SellCommon then AutoSellSilent(FishLists.Common) end
            if _Configs.SellRare   then AutoSellSilent(FishLists.Rare)   end
            if _Configs.SellLeg    then AutoSellSilent(FishLists.Leg)    end

            if _Configs.CraftLeg  then AutoCraftSilent("Legendary Fish Bait","Legendary Fish",FishLists.Leg,  1, 1) end
            if _Configs.CraftRare then AutoCraftSilent("Rare Fish Bait",     "Rare Fish",     FishLists.Rare, 2, 2) end

            if not _G.AutoFishing then break end

            -- ════════════════════════════════════════════════════════════════
            -- PRIORITY 5: CÂU CÁ (ưu tiên thấp nhất)
            -- ════════════════════════════════════════════════════════════════
            -- Resolve bait ngay trước câu để dùng inventory mới nhất
            local invFish = GetInventory() or {}
            _G.TargetBait = ResolveBait(invFish)
            if not _G.TargetBait then continue end   -- không có bait nào → bỏ qua, vòng sau kiểm tra lại

            -- Phải có rod vật lý trước khi throw
            if not EquipPhysicalRod(rodName) then continue end

            pcall(function()
                local castPos = rPart.Position + (rPart.CFrame.LookVector * 30) - Vector3.new(0, 15, 0)
                FishingRemote:InvokeServer({["Goal"]=castPos,["Action"]="Throw",["Bait"]=_G.TargetBait})
                task.wait(1.2)
                pcall(function() FishingRemote:InvokeServer({["Action"]="Landed"}) end)

                local bobble, waited = nil, 0
                while waited < 30 and _G.AutoFishing do
                    bobble = GetMyBobble(); if bobble then break end
                    task.wait(0.2); waited = waited + 0.2
                end

                if bobble and _G.AutoFishing then
                    local mm   = bobble:GetAttribute("MoveMultiplier") or 1
                    local seed = bobble:GetAttribute("Seed") or tick()
                    local rng  = Random.new(seed)
                    local tool = char:FindFirstChildOfClass("Tool")
                    local acc  = (tool and tool:GetAttribute("Acceleration")) or 1
                    if acc <= 0 then acc = 1 end

                    local jumps = rng:NextInteger(2, 5) * mm
                    local delay = 0
                    if mm >= 1.2 then      delay = jumps * (math.random(18,25)/10 / acc)
                    elseif mm >= 1.0 then  delay = jumps * (math.random(10,14)/10 / acc)
                    else                   delay = jumps * (math.random(4, 8)/10  / acc) end

                    local uid = (LocalPlayer.UserId % 100) / 100
                    local t   = (5.5 + delay) + (math.random(20,50)/100 + uid)

                    if mm >= 1.2 then
                        if t < 11.5 then t = math.random(1150,1250)/100 end
                        if t > 15.5 then t = math.random(1450,1550)/100 end
                    elseif mm >= 1.0 then
                        if t < 9.5  then t = math.random(900, 1000)/100 end
                        if t > 11.5 then t = math.random(1050,1150)/100 end
                    else
                        if t < 5.5  then t = math.random(450, 550)/100  end
                        if t > 8.0  then t = math.random(750, 850)/100  end
                    end

                    task.wait(t)

                    if _G.AutoFishing then
                        if FishingRemote:InvokeServer({["Action"]="Reel"}) then
                            task.wait(0.3)
                            FishingRemote:InvokeServer({["Action"]="HookReturning"})
                            task.wait(0.4)
                            FishingRemote:InvokeServer({["Action"]="Cancel"})
                        else
                            FishingRemote:InvokeServer({["Action"]="Cancel"})
                        end
                    end
                else
                    FishingRemote:InvokeServer({["Action"]="Cancel"})
                end

                task.wait(0.1)
                if char:FindFirstChild("Humanoid") then char.Humanoid:UnequipTools() end
                task.wait(0.1)
            end)
        end

        Tween.Stop()
    end

    -- =====================================================================
    -- PUBLIC API
    -- =====================================================================
    function AutoFishMerchant.Start(TogglesData)
        if _G.AutoFishing then return end
        _G.AutoFishing = true
        task.spawn(function() RunLoop(TogglesData) end)
    end

    function AutoFishMerchant.Stop()
        _G.AutoFishing = false
        Tween.Stop()
    end

    return AutoFishMerchant
end

-- 📦 MODULE: Farm/AutoFruitManager (BULLETPROOF FIXED)
__modules["Farm/AutoFruitManager"] = function()
    local AutoFruitManager = {}

    local Players           = game:GetService("Players")
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local LocalPlayer       = Players.LocalPlayer

    -- =====================================================================
    -- FRUIT LISTS 
    -- =====================================================================
    local RARITY_ORDER = { Common = 1, Rare = 2, Epic = 3, Legendary = 4, Mythic = 5 }

    local FRUIT_RARITY = {
        Spin  = "Common", Suke   = "Common", Kilo  = "Common", Heal   = "Common",
        Bari  = "Rare",   Mero   = "Rare",   Horo  = "Rare",   Bomb   = "Rare",  Gomu = "Rare",
        Kira  = "Epic",   Spring = "Epic",   Yomi  = "Epic",
        Pika  = "Legendary", Mera  = "Legendary", Yami  = "Legendary", Smoke = "Legendary",
        Kage  = "Legendary", Paw   = "Legendary", Goru  = "Legendary", Yuki  = "Legendary",
        Magu  = "Legendary", Suna  = "Legendary", Goro  = "Legendary", Hie   = "Legendary",
        Gura  = "Legendary", Zushi = "Legendary",
        Dragon= "Mythic", Soul   = "Mythic", Mochi = "Mythic",
        Venom = "Mythic", Tori   = "Mythic", Pteranodon= "Mythic",
        Ope   = "Mythic", Buddha = "Mythic",
    }

    local Events       = ReplicatedStorage:WaitForChild("Events", 10)
    local FruitStorage = Events and Events:WaitForChild("FruitStorage", 10)
    local ToolsRemote  = Events and Events:WaitForChild("Tools", 10)

    -- =====================================================================
    -- HELPERS (FIXED)
    -- =====================================================================
    -- Lấy trái cây ở cả trong TÚI và TRÊN TAY
    local function GetFruits()
        local fruits = {}
        -- Tìm trên tay trước
        if LocalPlayer.Character then
            for _, tool in ipairs(LocalPlayer.Character:GetChildren()) do
                if tool:IsA("Tool") and FRUIT_RARITY[tool.Name] then
                    table.insert(fruits, tool)
                end
            end
        end
        -- Tìm trong túi
        local backpack = LocalPlayer:FindFirstChild("Backpack")
        if backpack then
            for _, tool in ipairs(backpack:GetChildren()) do
                if tool:IsA("Tool") and FRUIT_RARITY[tool.Name] then
                    table.insert(fruits, tool)
                end
            end
        end
        return fruits
    end

    local function getNilTool(name)
        if not getnilinstances then return nil end
        for _, v in next, getnilinstances() do
            if v.ClassName == "Tool" and v.Name == name then return v end
        end
        return nil
    end

    -- Đã fix: Chống crash khi UI trả về String thay vì Table
    local function GetMinKeepLevel(selectedRarity)
        if type(selectedRarity) == "string" then
            return RARITY_ORDER[selectedRarity] or 0
        elseif type(selectedRarity) == "table" then
            local minLevel = 99
            for rarity, selected in pairs(selectedRarity) do
                if selected and RARITY_ORDER[rarity] then
                    minLevel = math.min(minLevel, RARITY_ORDER[rarity])
                end
            end
            return minLevel == 99 and 0 or minLevel
        end
        return 0
    end

    -- Hàm tự động cầm vũ khí/trái cây lên tay
    local function EquipTool(tool)
        local char = LocalPlayer.Character
        if char and char:FindFirstChild("Humanoid") and tool.Parent ~= char then
            char.Humanoid:EquipTool(tool)
            task.wait(0.3) -- Đợi server nhận diện đã cầm
        end
    end

    -- =====================================================================
    -- CORE LOGIC
    -- =====================================================================
    local function DoAutoStore()
        local fruits = GetFruits()
        if #fruits == 0 then return end

        local rarityFilter = getgenv().Config_FruitRarity or "Common"
        local specificFruit = getgenv().Config_FruitSelect or ""

        local minLevel = GetMinKeepLevel(rarityFilter)
        
        for _, tool in ipairs(fruits) do
            local level = RARITY_ORDER[FRUIT_RARITY[tool.Name] or "Common"] or 1
            local shouldStore = false

            if specificFruit ~= "" then
                shouldStore = string.find(string.lower(specificFruit), string.lower(tool.Name)) ~= nil
            elseif minLevel > 0 then
                shouldStore = level >= minLevel
            else
                shouldStore = true
            end

            if shouldStore and FruitStorage then
                EquipTool(tool) -- BẮT BUỘC EQUIP TRƯỚC KHI STORE
                pcall(function() FruitStorage:InvokeServer(true) end)
                task.wait(0.8)
            end
        end
    end

    local function DoAutoDrop()
        local fruits = GetFruits()
        if #fruits == 0 then return end

        local rarityFilter = getgenv().Config_FruitRarity or "Common"
        local specificFruit = getgenv().Config_FruitSelect or ""
        local minKeepLevel = GetMinKeepLevel(rarityFilter)

        for _, tool in ipairs(fruits) do
            local level = RARITY_ORDER[FRUIT_RARITY[tool.Name] or "Common"] or 1
            local shouldDrop = false

            if specificFruit ~= "" and string.find(string.lower(specificFruit), string.lower(tool.Name)) ~= nil then
                shouldDrop = false -- Không vứt trái đang được target
            elseif minKeepLevel > 0 then
                shouldDrop = level < minKeepLevel -- Drop nếu cùi bắp hơn mức chọn
            else
                shouldDrop = true
            end

            if shouldDrop and ToolsRemote then
                EquipTool(tool) -- BẮT BUỘC EQUIP TRƯỚC KHI DROP
                local toolObj = LocalPlayer.Character:FindFirstChild(tool.Name) or getNilTool(tool.Name)
                if toolObj then
                    pcall(function() ToolsRemote:InvokeServer("drop", toolObj) end)
                    task.wait(0.5)
                end
            end
        end
    end

    -- =====================================================================
    -- MAIN LOOP
    -- =====================================================================
    local _running = false

    function AutoFruitManager.Start()
        if _running then return end
        _running = true

        task.spawn(function()
            while _running do
                task.wait(1.5) 
                
                -- Fix: Quét qua getgenv() để đảm bảo đồng bộ với UI Toggle
                if getgenv().AutoStoreFruit then
                    pcall(DoAutoStore)
                end

                if getgenv().AutoDropFruit then
                    pcall(DoAutoDrop)
                end
            end
        end)
    end

    function AutoFruitManager.Stop()
        _running = false
    end

    return AutoFruitManager
end

-- 📦 MODULE: Esp.lua
__modules["Island/Esp"] = function()
    local Esp = {}
    local Workspace = game:GetService("Workspace")
    local Players = game:GetService("Players")

    local ESP_Holder = Workspace:FindFirstChild("ZILI_ESP_Holder") or Instance.new("Folder", Workspace)
    ESP_Holder.Name = "ZILI_ESP_Holder"

    function Esp.Toggle(isActive, islandsData)
        ESP_Holder:ClearAllChildren()
        if not isActive then return end
        
        for name, posData in pairs(islandsData) do
            local pos = type(posData) == "table" and posData[#posData] or posData
            local p = Instance.new("Part", ESP_Holder)
            p.Anchored = true; p.Transparency = 1; p.Position = pos; p.CanCollide = false
            
            local bg = Instance.new("BillboardGui", p)
            bg.AlwaysOnTop = true; bg.Size = UDim2.new(0, 200, 0, 50)
            
            local lb = Instance.new("TextLabel", bg)
            lb.Size = UDim2.new(1, 0, 1, 0); lb.BackgroundTransparency = 1
            lb.TextColor3 = Color3.fromRGB(255, 215, 0); lb.Font = Enum.Font.Arcade; lb.TextSize = 15
            lb.Text = name
            
            task.spawn(function()
                while p.Parent and isActive do
                    local char = Players.LocalPlayer.Character
                    local root = char and char:FindFirstChild("HumanoidRootPart")
                    if root then
                        local dist = (root.Position - pos).Magnitude
                        lb.Text = string.format("%s\n[%.0f m]", name, dist)
                    end
                    task.wait(0.5)
                end
            end)
        end
    end
    return Esp
end

-- 📦 MODULE: Stats/addStats
__modules["Stats/addStats"] = function()
    local addStats = {}
    
    local Players = game:GetService("Players")
    local TweenService = game:GetService("TweenService")

    function addStats.Start(AutoStatsData)
        
        -- [BỘ LỌC THÔNG MINH]: Xóa dấu cách để đọc chuẩn tên stat game GPO
        local function GetCurrentStat(statName)
            local val = 0
            local cleanName = statName:gsub("%s+", "") -- Chuyển "Devil Fruit" -> "DevilFruit"
            
            pcall(function()
                local repStats = game:GetService("ReplicatedStorage"):FindFirstChild("Stats" .. Players.LocalPlayer.Name)
                if repStats then
                    local innerStats = repStats:FindFirstChild("Stats")
                    if innerStats then
                        if innerStats:FindFirstChild(statName) then
                            val = tonumber(innerStats[statName].Value)
                        elseif innerStats:FindFirstChild(cleanName) then
                            val = tonumber(innerStats[cleanName].Value)
                        end
                    end
                    
                    if not val or val == 0 then
                        if repStats:FindFirstChild(statName) then
                            val = tonumber(repStats[statName].Value)
                        elseif repStats:FindFirstChild(cleanName) then
                            val = tonumber(repStats[cleanName].Value)
                        end
                    end
                end
                
                if not val or val == 0 then
                    local ls = Players.LocalPlayer:FindFirstChild("leaderstats")
                    if ls then
                        if ls:FindFirstChild(statName) then 
                            val = tonumber(ls[statName].Value)
                        elseif ls:FindFirstChild(cleanName) then 
                            val = tonumber(ls[cleanName].Value) 
                        end
                    end
                end
            end)
            return val or 0
        end

        task.spawn(function()
            local rep = game:GetService("ReplicatedStorage")
            local statsEvent = rep:FindFirstChild("Events") and rep.Events:FindFirstChild("stats")
            
            while true do
                if statsEvent then
                    for statName, data in pairs(AutoStatsData) do
                        if data.Active then
                            local currentStat = GetCurrentStat(statName)
                            
                            if data.Cap == 0 or currentStat < data.Cap then
                                pcall(function()
                                    -- Gửi lệnh cộng điểm lên server
                                    statsEvent:FireServer(statName, nil, 1)
                                end)
                                
                                -- [TÍNH NĂNG MỚI]: HIỂN THỊ TIẾN ĐỘ TRỰC TIẾP LÊN NÚT
                                if data.Btn then
                                    local capText = data.Cap > 0 and tostring(data.Cap) or "Max"
                                    data.Btn.Text = "(" .. tostring(currentStat) .. "/" .. capText .. ")"
                                end
                            else
                                -- Tự tắt nút, trả về màu cũ khi đầy
                                data.Active = false
                                if data.Btn and data.Strk then
                                    TweenService:Create(data.Btn, TweenInfo.new(0.2), {BackgroundColor3 = Color3.fromRGB(120, 90, 0)}):Play()
                                    TweenService:Create(data.Strk, TweenInfo.new(0.2), {Color = Color3.fromRGB(160, 120, 0)}):Play()
                                    data.Btn.TextColor3 = Color3.fromRGB(255, 255, 255)
                                    data.Btn.Text = "Auto Add"
                                end
                            end
                        end
                    end
                end
                task.wait(0.1) -- Tốc độ đếm điểm
            end
        end)
    end

    return addStats
end

-- =====================================================================
-- GET BETTER OUT | MAIN HUB  (Main UI & Logic Integration)
-- =====================================================================

local Bypass        = require("BYPASS ANTICHEAT")
local Esp           = require("Island/Esp")
local TweenSys      = require("Island/TWEEN TO ISLAND")
local IslandData    = require("Island/IslandData")
local AutoFarmLevel = require("Farm/AutoFarmLevel")
local AutoGetBuso   = require("Farm/AutoGetBuso")
local AutoGeppoFunc = require("Farm/AutoGeppo")
local AutoFishMerchantModule = require("Farm/AutoFishMerchant")
local AutoFruitManagerModule = require("Farm/AutoFruitManager")
local AutoStats     = require("Stats/addStats")

pcall(function() if Bypass and Bypass.Init then Bypass.Init() end end)
pcall(function()
    if TweenSys then
        TweenSys.Notify = function(title, content, duration) end
    end
end)

-- =====================================================================
-- SERVICES & LOCALS
-- =====================================================================
local UIS         = game:GetService("UserInputService")
local TweenService= game:GetService("TweenService")
local Players     = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local HttpService = game:GetService("HttpService")

-- =====================================================================
-- SCREEN GUI
-- =====================================================================
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = HttpService:GenerateGUID(false)
ScreenGui.ResetOnSpawn = false
ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
if gethui then
    ScreenGui.Parent = gethui()
elseif syn and syn.protect_gui then
    syn.protect_gui(ScreenGui); ScreenGui.Parent = CoreGui
else
    ScreenGui.Parent = CoreGui:FindFirstChild("RobloxGui") or CoreGui
end
if gethui then ScreenGui.Parent = gethui() else ScreenGui.Parent = game.CoreGui end

-- =====================================================================
-- HELPERS
-- =====================================================================
local C = Color3.fromRGB
local function NEW(cls, props, parent)
    local i = Instance.new(cls)
    for k,v in pairs(props) do i[k]=v end
    if parent then i.Parent = parent end
    return i
end
local function CORNER(r, p) return NEW("UICorner",{CornerRadius=UDim.new(0,r)},p) end
local function STROKE(col, thick, trans, p)
    return NEW("UIStroke",{Color=col,Thickness=thick,Transparency=trans or 0},p)
end
local function TWEEN(obj, t, props)
    TweenService:Create(obj, TweenInfo.new(t, Enum.EasingStyle.Quad), props):Play()
end
local function TWEEN_BACK(obj, t, props)
    TweenService:Create(obj, TweenInfo.new(t, Enum.EasingStyle.Back, Enum.EasingDirection.Out), props):Play()
end

-- Color palette
local BG0   = C(7,  8, 18)   -- deepest bg
local BG1   = C(10, 11, 24)  -- main panel
local BG2   = C(14, 15, 32)  -- sidebar
local BG3   = C(18, 20, 42)  -- card bg
local BG4   = C(22, 25, 52)  -- card hover
local BG5   = C(8,  9, 20)   -- input bg
local GOLD  = C(201,148,58)
local GOLD2 = C(240,190,104)
local GOLD3 = C(122, 90, 30)
local GOLDD = C(50, 37, 12)   -- dark gold (toggle ON bg)
local TEXT1 = C(237,232,218)
local TEXT2 = C(160,155,180)
local TEXT3 = C(80, 75,100)
local RED   = C(200, 55, 55)
local GREEN = C(56, 190,110)

-- =====================================================================
-- ICON DRAW SYSTEM (SVG-style, pure Frames)
-- =====================================================================
local function DrawIcon(parent, iconName, px, py, sz, col)
    sz  = sz  or 14
    col = col or TEXT2
    local c = NEW("Frame",{
        Size=UDim2.new(0,sz,0,sz),
        Position=UDim2.new(0,px,0,py),
        BackgroundTransparency=1, BorderSizePixel=0
    }, parent)

    -- filled rounded rect
    local function RR(x,y,w,h,r,clr)
        local f=NEW("Frame",{Size=UDim2.new(0,w,0,h),Position=UDim2.new(0,x,0,y),
            BackgroundColor3=clr or col,BorderSizePixel=0},c)
        CORNER(r,f); return f
    end
    -- line from (x1,y1) to (x2,y2), rotates around its own center
    local function L(x1,y1,x2,y2,th,clr)
        local dx=x2-x1; local dy=y2-y1
        local len=math.sqrt(dx*dx+dy*dy)
        if len<0.5 then return end
        local ang=math.deg(math.atan2(dy,dx))
        local f=NEW("Frame",{
            Size=UDim2.new(0,len,0,th or 2),
            Position=UDim2.new(0,(x1+x2)/2,0,(y1+y2)/2),
            AnchorPoint=Vector2.new(0.5,0.5),
            BackgroundColor3=clr or col,
            BorderSizePixel=0, Rotation=ang
        },c)
        CORNER(1,f); return f
    end
    -- circle dot
    local function Dot(cx,cy,d,clr)
        return RR(cx-d/2,cy-d/2,d,d,d/2,clr)
    end
    -- circle ring (stroke only)
    local function Ring(cx,cy,d,sw,clr)
        local f=NEW("Frame",{
            Size=UDim2.new(0,d,0,d),
            Position=UDim2.new(0,cx-d/2,0,cy-d/2),
            BackgroundTransparency=1,BorderSizePixel=0
        },c)
        CORNER(d/2,f); STROKE(clr or col,sw or 1.5,0,f); return f
    end

    local s=sz

    -- ── TAB ICONS ──────────────────────────────────────────────────
    if iconName=="home" then
        -- Roof (two slopes + eave)
        L(s*.5,s*.06, s*.02,s*.5,  1.5)   -- left slope
        L(s*.5,s*.06, s*.98,s*.5,  1.5)   -- right slope
        L(s*.02,s*.5, s*.98,s*.5,  1.5)   -- eave
        -- Body
        RR(s*.15,s*.48, s*.7,s*.5, 2)
        -- Door
        RR(s*.38,s*.67, s*.24,s*.32, 1)

    elseif iconName=="sword" then
        L(s*.72,s*.04, s*.12,s*.72, 2)    -- blade
        L(s*.22,s*.38, s*.58,s*.64, 1.5)  -- crossguard
        L(s*.62,s*.65, s*.9, s*.9,  2)    -- handle
        Dot(s*.9,s*.9, s*.18)              -- pommel

    elseif iconName=="globe" then
        Ring(s*.5,s*.5, s*.96, 1.5)        -- outer ring
        L(s*.02,s*.5,  s*.98,s*.5, 1.5)   -- equator
        L(s*.5, s*.02, s*.5, s*.98,1.5)   -- meridian
        -- curved meridians (approximate with short lines)
        L(s*.3,s*.06, s*.3,s*.94, 1)      -- left arc hint
        L(s*.7,s*.06, s*.7,s*.94, 1)      -- right arc hint

    elseif iconName=="fish" then
        -- Body
        local b=NEW("Frame",{Size=UDim2.new(0,s*.68,0,s*.55),
            Position=UDim2.new(0,0,0,s*.225),
            BackgroundColor3=col,BorderSizePixel=0},c)
        CORNER(s*.28,b)
        -- Tail V
        L(s*.62,s*.5,  s*.97,s*.07, 2)
        L(s*.62,s*.5,  s*.97,s*.93, 2)
        -- Tail center
        L(s*.62,s*.5,  s*.98,s*.5,  1.5)
        -- Eye
        Dot(s*.14,s*.47, s*.14)

    elseif iconName=="chart" then
        -- Three bars (short, mid, tall)
        RR(s*.04,  s*.5,  s*.22,s*.5,  2)
        RR(s*.38,  s*.22, s*.22,s*.78, 2)
        RR(s*.73,  s*.0,  s*.22,s*1.0, 2)
        -- baseline
        L(0,s*1.0-1, s,s*1.0-1, 1.5)

    elseif iconName=="gear" then
        -- Body ring
        Ring(s*.5,s*.5, s*.56, 1.5)
        -- Center hole
        Dot(s*.5,s*.5, s*.2)
        -- 4 straight teeth
        RR(s*.43,0,       s*.14,s*.2,  1)
        RR(s*.43,s*.8,    s*.14,s*.2,  1)
        RR(0,    s*.43,   s*.2, s*.14, 1)
        RR(s*.8, s*.43,   s*.2, s*.14, 1)
        -- 4 diagonal teeth
        L(s*.14,s*.14, s*.3,s*.3,  3)
        L(s*.86,s*.14, s*.7,s*.3,  3)
        L(s*.14,s*.86, s*.3,s*.7,  3)
        L(s*.86,s*.86, s*.7,s*.7,  3)

    -- ── CARD HEADER ICONS ─────────────────────────────────────────
    elseif iconName=="shield" then
        -- Outer shield
        local sh=NEW("Frame",{Size=UDim2.new(0,s*.88,0,s*.9),
            Position=UDim2.new(0,s*.06,0,s*.05),
            BackgroundTransparency=1,BorderSizePixel=0},c)
        CORNER(s*.22,sh); STROKE(col,1.5,0,sh)
        -- Inner cross
        L(s*.5,s*.28, s*.5,s*.72, 1.5)
        L(s*.28,s*.5, s*.72,s*.5, 1.5)

    elseif iconName=="lightning" then
        L(s*.66,s*.04, s*.32,s*.52, 2)    -- top stroke
        L(s*.32,s*.52, s*.68,s*.52, 1.5)  -- middle
        L(s*.68,s*.52, s*.34,s*.96, 2)    -- bottom stroke

    elseif iconName=="eye" then
        -- Outer oval
        local e=NEW("Frame",{Size=UDim2.new(0,s*.96,0,s*.56),
            Position=UDim2.new(0,s*.02,0,s*.22),
            BackgroundTransparency=1,BorderSizePixel=0},c)
        CORNER(s*.28,e); STROKE(col,1.5,0,e)
        -- Pupil
        Dot(s*.5,s*.5, s*.28)

    elseif iconName=="fist" then
        -- Knuckles (3 bumps top)
        RR(s*.08, s*.18, s*.22,s*.22, 3)
        RR(s*.38, s*.12, s*.22,s*.22, 3)
        RR(s*.68, s*.18, s*.22,s*.22, 3)
        -- Main fist body
        RR(s*.06, s*.35, s*.88,s*.58, 4)

    elseif iconName=="wave" then
        -- Sine-wave approximation (4 line segments)
        L(0,     s*.5,  s*.25,s*.18, 2)
        L(s*.25, s*.18, s*.5, s*.82, 2)
        L(s*.5,  s*.82, s*.75,s*.18, 2)
        L(s*.75, s*.18, s*1.0,s*.5,  2)

    elseif iconName=="fruit" then
        -- Apple circle
        Dot(s*.5,s*.58, s*.8)
        -- Stem
        RR(s*.46,s*.04, s*.08,s*.18, 1)
        -- Leaf
        L(s*.5,s*.1, s*.74,s*.02, 1.5)

    end

    return c
end

-- Tween tất cả frames + strokes trong icon container (dùng cho tab active/inactive)
local function TweenIcon(iconContainer, clr, t)
    for _,f in ipairs(iconContainer:GetDescendants()) do
        if f:IsA("Frame") then
            TWEEN(f, t, {BackgroundColor3=clr})
        elseif f:IsA("UIStroke") then
            TWEEN(f, t, {Color=clr})
        end
    end
end

-- Toggle helper
local function MakePillToggle(parent, posX, posY, w, h, configKey, onCallback)
    local pill = NEW("TextButton",{
        Size=UDim2.new(0,w or 44,0,h or 24), Position=UDim2.new(0,posX,0,posY),
        BackgroundColor3=BG5, Text="", AutoButtonColor=false
    }, parent)
    CORNER(20, pill)
    local strk = STROKE(GOLD3, 1, 0, pill)
    local thumb = NEW("Frame",{
        Size=UDim2.new(0,16,0,16), Position=UDim2.new(0,4,0.5,-8),
        BackgroundColor3=TEXT3, BorderSizePixel=0
    }, pill)
    CORNER(20, thumb)

    TogglesData[configKey] = TogglesData[configKey] or {Active=false,Btn=pill,Strk=strk}
    TogglesData[configKey].Btn  = pill
    TogglesData[configKey].Strk = strk
    if onCallback then TogglesData[configKey].Callback = onCallback end

    pill.MouseButton1Click:Connect(function()
        local d = TogglesData[configKey]
        d.Active = not d.Active
        local on = d.Active
        TWEEN(pill,  0.22, {BackgroundColor3 = on and GOLDD or BG5})
        TWEEN(strk,  0.22, {Color = on and GOLD2 or GOLD3})
        TWEEN(thumb, 0.22, {
            BackgroundColor3 = on and GOLD2 or TEXT3,
            Position = on and UDim2.new(1,-20,0.5,-8) or UDim2.new(0,4,0.5,-8)
        })
        if d.Callback then d.Callback(on) end
    end)
    return pill, strk, thumb
end

-- =====================================================================
-- MINI LOGO (Minimized state)
-- =====================================================================
local MiniLogo = NEW("ImageButton",{
    Size=UDim2.new(0,54,0,54), Position=UDim2.new(0,50,0.5,-27),
    Image="rbxassetid://108561234878560",
    BackgroundColor3=BG3, BackgroundTransparency=0,
    Visible=false, ZIndex=999
}, ScreenGui)
CORNER(27, MiniLogo)
STROKE(GOLD, 2.5, 0, MiniLogo)

local dM,dStM,sPM
MiniLogo.InputBegan:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then dM=true;dStM=i.Position;sPM=MiniLogo.Position end end)
UIS.InputChanged:Connect(function(i) if dM and i.UserInputType==Enum.UserInputType.MouseMovement then local d=i.Position-dStM;MiniLogo.Position=UDim2.new(sPM.X.Scale,sPM.X.Offset+d.X,sPM.Y.Scale,sPM.Y.Offset+d.Y) end end)
UIS.InputEnded:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then dM=false end end)

-- =====================================================================
-- MAIN FRAME
-- =====================================================================
local MainFrame = NEW("CanvasGroup",{
    Size=UDim2.new(0,720,0,520), Position=UDim2.new(0.5,-360,0.5,-230),
    BackgroundColor3=BG1, BorderSizePixel=0, ClipsDescendants=true
}, ScreenGui)
CORNER(12, MainFrame)
STROKE(GOLD, 1.5, 0.1, MainFrame)

-- =====================================================================
-- TOP BAR
-- =====================================================================
local TopBar = NEW("Frame",{
    Size=UDim2.new(1,0,0,46), BackgroundColor3=BG2, BorderSizePixel=0
}, MainFrame)
CORNER(12, TopBar)
-- extend bottom corners
NEW("Frame",{Size=UDim2.new(1,0,0,14),Position=UDim2.new(0,0,1,-14),BackgroundColor3=BG2,BorderSizePixel=0}, TopBar)
-- gold bottom line
NEW("Frame",{Size=UDim2.new(0.6,0,0,1),Position=UDim2.new(0.2,0,1,-1),BackgroundColor3=GOLD,BorderSizePixel=0,BackgroundTransparency=0.6}, TopBar)

-- Logo badge
local LogoBadge = NEW("Frame",{
    Size=UDim2.new(0,30,0,30), Position=UDim2.new(0,12,0.5,-15),
    BackgroundColor3=BG3
}, TopBar)
CORNER(8, LogoBadge)
STROKE(GOLD, 1.5, 0.4, LogoBadge)
NEW("ImageLabel",{
    Size=UDim2.new(0,22,0,22), Position=UDim2.new(0.5,-11,0.5,-11),
    Image="rbxassetid://108561234878560", BackgroundTransparency=1
}, LogoBadge)

-- Title
local Title = NEW("TextLabel",{
    Text="Zili Hub  |  GBO", Position=UDim2.new(0,50,0,0),
    Size=UDim2.new(0,260,1,0), TextColor3=GOLD2,
    Font=Enum.Font.GothamBold, TextSize=13, BackgroundTransparency=1,
    TextXAlignment=Enum.TextXAlignment.Left
}, TopBar)

-- Version badge
local VerBadge = NEW("TextLabel",{
    Text="v2.4.0  ·  PREMIUM",
    Position=UDim2.new(0,50,0,0), Size=UDim2.new(0,180,1,0),
    TextColor3=TEXT3, Font=Enum.Font.GothamBold, TextSize=9,
    BackgroundTransparency=1, TextXAlignment=Enum.TextXAlignment.Left
}, TopBar)
-- shift version to below title
VerBadge.Position = UDim2.new(0,50,1,-16)
VerBadge.Size = UDim2.new(0,200,0,12)

-- Control buttons
local function MakeCtrlBtn(text, posX, col)
    local btn = NEW("TextButton",{
        Text=text, Position=UDim2.new(1,posX,0.5,0),
        AnchorPoint=Vector2.new(0,0.5),
        Size=UDim2.new(0,26,0,26), TextColor3=col,
        TextSize=12, BackgroundColor3=BG3,
        Font=Enum.Font.GothamBold, AutoButtonColor=false
    }, TopBar)
    CORNER(6, btn)
    STROKE(col, 1, 0.6, btn)
    btn.MouseEnter:Connect(function() TWEEN(btn,0.15,{BackgroundColor3=BG4,TextColor3=C(255,255,255)}) end)
    btn.MouseLeave:Connect(function() TWEEN(btn,0.15,{BackgroundColor3=BG3,TextColor3=col}) end)
    return btn
end
local MinBtn   = MakeCtrlBtn("—", -64, TEXT2)
local CloseBtn = MakeCtrlBtn("✕", -32, RED)

-- =====================================================================
-- SIDEBAR
-- =====================================================================
local Sidebar = NEW("Frame",{
    Size=UDim2.new(0,178,1,-46), Position=UDim2.new(0,0,0,46),
    BackgroundColor3=BG2, BorderSizePixel=0
}, MainFrame)
CORNER(12, Sidebar)
-- right divider
NEW("Frame",{Size=UDim2.new(0,1,1,0),Position=UDim2.new(1,-1,0,0),BackgroundColor3=GOLD,BackgroundTransparency=0.82,BorderSizePixel=0}, Sidebar)

-- User card
local UserCard = NEW("Frame",{
    Size=UDim2.new(1,-16,0,60), Position=UDim2.new(0,8,1,-68),
    BackgroundColor3=BG3
}, Sidebar)
CORNER(10, UserCard)
STROKE(GOLD, 1, 0.65, UserCard)
-- gold top accent on user card
NEW("Frame",{Size=UDim2.new(1,0,0,2),Position=UDim2.new(0,0,0,0),BackgroundColor3=GOLD,BorderSizePixel=0,BackgroundTransparency=0.5}, UserCard)
CORNER(10, UserCard:FindFirstChildOfClass("Frame"))

local UserImg = NEW("ImageLabel",{
    Size=UDim2.new(0,38,0,38), Position=UDim2.new(0,10,0.5,-19),
    BackgroundColor3=BG4
}, UserCard)
CORNER(19, UserImg)
STROKE(GOLD, 1.5, 0.3, UserImg)
pcall(function() UserImg.Image=Players:GetUserThumbnailAsync(LocalPlayer.UserId,Enum.ThumbnailType.HeadShot,Enum.ThumbnailSize.Size420x420) end)

NEW("TextLabel",{
    Text=LocalPlayer.DisplayName,
    Position=UDim2.new(0,55,0,10), Size=UDim2.new(1,-59,0,18),
    TextColor3=TEXT1, Font=Enum.Font.GothamBold, TextSize=12,
    BackgroundTransparency=1, TextXAlignment=Enum.TextXAlignment.Left
}, UserCard)
NEW("TextLabel",{
    Text="⭐  Premium",
    Position=UDim2.new(0,55,0,30), Size=UDim2.new(1,-59,0,14),
    TextColor3=GOLD2, Font=Enum.Font.GothamBold, TextSize=10,
    BackgroundTransparency=1, TextXAlignment=Enum.TextXAlignment.Left
}, UserCard)

-- TAB SCROLL
local TabScroll = NEW("ScrollingFrame",{
    Size=UDim2.new(1,-8,1,-80), Position=UDim2.new(0,4,0,6),
    BackgroundTransparency=1, ScrollBarThickness=0,
    AutomaticCanvasSize=Enum.AutomaticSize.Y,
    CanvasSize=UDim2.new(0,0,0,0), ClipsDescendants=true
}, Sidebar)
local TabLayout = NEW("UIListLayout",{
    HorizontalAlignment=Enum.HorizontalAlignment.Center,
    Padding=UDim.new(0,2), SortOrder=Enum.SortOrder.LayoutOrder
}, TabScroll)
NEW("UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8)}, TabScroll)

-- Tab section separator helper
local function TabSep(label)
    local f = NEW("Frame",{Size=UDim2.new(0,160,0,20),BackgroundTransparency=1}, TabScroll)
    local line = NEW("Frame",{Size=UDim2.new(1,-60,0,1),Position=UDim2.new(0,0,0.5,0),BackgroundColor3=C(30,28,55),BorderSizePixel=0}, f)
    NEW("Frame",{Size=UDim2.new(1,-60,0,1),Position=UDim2.new(1,-0,0.5,0),BackgroundColor3=C(30,28,55),BorderSizePixel=0}, f) -- right side
    NEW("TextLabel",{
        Text=label, Size=UDim2.new(0,60,1,0), Position=UDim2.new(0.5,-30,0,0),
        BackgroundTransparency=1, TextColor3=TEXT3, Font=Enum.Font.GothamBold,
        TextSize=8, TextXAlignment=Enum.TextXAlignment.Center
    }, f)
    return f
end

-- PAGE CONTAINER
local PageContainer = NEW("Frame",{
    Size=UDim2.new(1,-178,1,-46), Position=UDim2.new(0,178,0,46),
    BackgroundTransparency=1
}, MainFrame)

-- Tab system
local Tabs={} local Pages={} local SelectedTab=nil local SelectedPage=nil

local TAB_ICONS = {
    ["Main"]              = "home",
    ["Auto Farm"]         = "sword",
    ["Travel"]            = "globe",
    ["Fishing + Merchant"]= "fish",
    ["Stats"]             = "chart",
    ["Config"]            = "gear",
}

local function AddTab(name)
    local iconName = TAB_ICONS[name] or "home"
    local btn = NEW("TextButton",{
        Size=UDim2.new(0,162,0,36), BackgroundTransparency=1,
        Text="", TextColor3=TEXT3,
        Font=Enum.Font.GothamSemibold, TextSize=12,
        AutoButtonColor=false, TextXAlignment=Enum.TextXAlignment.Left
    }, TabScroll)
    CORNER(7, btn)
    btn.BackgroundColor3 = BG3

    -- left accent bar — sits at very left edge, BEHIND icon
    local accent = NEW("Frame",{
        Size=UDim2.new(0,3,0.6,0), Position=UDim2.new(0,0,0.2,0),
        BackgroundColor3=GOLD2, BorderSizePixel=0, Visible=false
    }, btn)
    CORNER(2, accent)

    -- SVG-style icon (centered vertically in 36px button)
    local iconContainer = DrawIcon(btn, iconName, 10, 11, 14, TEXT3)

    -- name label (offset right of icon)
    local nameLbl = NEW("TextLabel",{
        Text=name, Size=UDim2.new(1,-38,1,0), Position=UDim2.new(0,36,0,0),
        BackgroundTransparency=1, TextColor3=TEXT3,
        Font=Enum.Font.GothamSemibold, TextSize=12,
        TextXAlignment=Enum.TextXAlignment.Left
    }, btn)

    local page = NEW("ScrollingFrame",{
        Size=UDim2.new(1,0,1,0), BackgroundTransparency=1,
        Visible=false, Name=name.."Page",
        ScrollBarThickness=3, ScrollBarImageColor3=GOLD,
        ClipsDescendants=true
    }, PageContainer)

    Tabs[name]=btn; Pages[name]=page

    btn.MouseEnter:Connect(function()
        if SelectedTab~=btn then
            TWEEN(nameLbl,0.15,{TextColor3=TEXT1})
            TWEEN(btn,0.15,{BackgroundTransparency=0.88})
        end
    end)
    btn.MouseLeave:Connect(function()
        if SelectedTab~=btn then
            TWEEN(nameLbl,0.15,{TextColor3=TEXT3})
            TWEEN(btn,0.15,{BackgroundTransparency=1})
        end
    end)
    btn.MouseButton1Click:Connect(function()
        if SelectedTab then
            TWEEN(SelectedTab,0.18,{BackgroundTransparency=1})
            -- reset name label color of previous tab
            local lbls = {}
            for _,c in ipairs(SelectedTab:GetChildren()) do if c:IsA("TextLabel") then table.insert(lbls,c) end end
            if lbls[1] then TWEEN(lbls[1],0.18,{TextColor3=TEXT3}); lbls[1].Font=Enum.Font.GothamSemibold end
            -- reset previous icon color
            for _,child in ipairs(SelectedTab:GetChildren()) do
                if child:IsA("Frame") and child~=accent then TweenIcon(child,TEXT3,0.18) end
            end
            -- hide previous accent bar
            local prevAccent = SelectedTab:FindFirstChild("Frame")
            if prevAccent then prevAccent.Visible=false end
            if SelectedPage then SelectedPage.Visible=false end
        end
        SelectedTab=btn; SelectedPage=page
        TWEEN(btn,0.18,{BackgroundTransparency=0.82})
        TWEEN(nameLbl,0.18,{TextColor3=GOLD2})
        nameLbl.Font=Enum.Font.GothamBold
        TweenIcon(iconContainer,GOLD2,0.18)
        accent.Visible=true; page.Visible=true
    end)
    if SelectedTab==nil then
        btn.BackgroundTransparency=0.82
        nameLbl.TextColor3=GOLD2; nameLbl.Font=Enum.Font.GothamBold
        TweenIcon(iconContainer,GOLD2,0)
        SelectedTab=btn; SelectedPage=page; page.Visible=true; accent.Visible=true
    end
    return page
end

-- Build tabs with section separators
local MainPage   = AddTab("Main")
                   TabSep("FARM")
local AutoFarmPage= AddTab("Auto Farm")
                   TabSep("WORLD")
local TravelPage  = AddTab("Travel")
local FishingPage = AddTab("Fishing + Merchant")
                   TabSep("DATA")
local StatsPage   = AddTab("Stats")
local ConfigPage  = AddTab("Config")

-- =====================================================================
-- SHARED DATA
-- =====================================================================
local TogglesData = {}

-- =====================================================================
-- CARD BUILDER HELPERS
-- =====================================================================
local function MakeCard(parent, h, layoutOrder)
    local f = NEW("Frame",{
        Size=UDim2.new(1,-24,0,h), BackgroundColor3=BG3,
        LayoutOrder=layoutOrder or 0, ClipsDescendants=true
    }, parent)
    CORNER(9, f)
    STROKE(GOLD, 1, 0.8, f)
    return f
end

local function CardHeader(card, iconName, label)
    -- top gradient bar
    local bar = NEW("Frame",{
        Size=UDim2.new(1,0,0,28), BackgroundColor3=C(20,22,46)
    }, card)
    CORNER(9, bar)
    NEW("Frame",{Size=UDim2.new(1,0,0,12),Position=UDim2.new(0,0,1,-12),BackgroundColor3=C(20,22,46),BorderSizePixel=0}, bar)
    -- gold left stripe in header
    NEW("Frame",{Size=UDim2.new(0,3,0.6,0),Position=UDim2.new(0,0,0.2,0),BackgroundColor3=GOLD,BorderSizePixel=0}, bar)
    CORNER(2, bar:FindFirstChild("Frame"))
    -- SVG-style icon (sz=12, centered in 28px bar → y=(28-12)/2=8)
    DrawIcon(bar, iconName, 8, 8, 12, GOLD)
    NEW("TextLabel",{
        Text=label, Size=UDim2.new(1,-40,1,0), Position=UDim2.new(0,32,0,0),
        BackgroundTransparency=1, TextColor3=GOLD3, Font=Enum.Font.GothamBold,
        TextSize=10, TextXAlignment=Enum.TextXAlignment.Left
    }, bar)
    return bar
end

local function RowDivider(card, posY)
    NEW("Frame",{
        Size=UDim2.new(1,-24,0,1), Position=UDim2.new(0,12,0,posY),
        BackgroundColor3=C(25,24,50), BorderSizePixel=0
    }, card)
end

local function RowLabel(card, mainText, subText, posY)
    NEW("TextLabel",{
        Text=mainText, Size=UDim2.new(0.62,0,0,22), Position=UDim2.new(0,14,0,posY),
        BackgroundTransparency=1, TextColor3=TEXT1, Font=Enum.Font.GothamSemibold,
        TextSize=14, TextXAlignment=Enum.TextXAlignment.Left
    }, card)
    if subText then
        NEW("TextLabel",{
            Text=subText, Size=UDim2.new(0.68,0,0,14), Position=UDim2.new(0,14,0,posY+22),
            BackgroundTransparency=1, TextColor3=GOLD3, Font=Enum.Font.GothamBold,
            TextSize=10, TextXAlignment=Enum.TextXAlignment.Left
        }, card)
    end
end

-- Pill toggle factory for cards
local function CardToggle(card, posY, configKey, callback)
    local pill = NEW("TextButton",{
        Size=UDim2.new(0,44,0,24), Position=UDim2.new(1,-56,0,posY),
        BackgroundColor3=BG5, Text="", AutoButtonColor=false
    }, card)
    CORNER(20, pill)
    local strk = STROKE(GOLD3, 1, 0, pill)
    local thumb = NEW("Frame",{
        Size=UDim2.new(0,16,0,16), Position=UDim2.new(0,4,0.5,-8),
        BackgroundColor3=TEXT3, BorderSizePixel=0
    }, pill)
    CORNER(20, thumb)

    TogglesData[configKey] = {Active=false, Btn=pill, Strk=strk, Thumb=thumb, Callback=callback or function() end}

    pill.MouseButton1Click:Connect(function()
        local d = TogglesData[configKey]
        d.Active = not d.Active
        local on = d.Active
        TWEEN(pill,  0.22, {BackgroundColor3=on and GOLDD or BG5})
        TWEEN(strk,  0.22, {Color=on and GOLD2 or GOLD3})
        TWEEN(thumb, 0.22, {
            BackgroundColor3=on and GOLD2 or TEXT3,
            Position=on and UDim2.new(1,-20,0.5,-8) or UDim2.new(0,4,0.5,-8)
        })
        if d.Callback then d.Callback(on) end
    end)
    return pill, strk, thumb
end

-- Page layout helper
local function PageLayout(page, padTop, gap)
    local l = NEW("UIListLayout",{
        SortOrder=Enum.SortOrder.LayoutOrder, HorizontalAlignment=Enum.HorizontalAlignment.Center,
        Padding=UDim.new(0,gap or 10)
    }, page)
    NEW("UIPadding",{PaddingTop=UDim.new(0,padTop or 14),PaddingLeft=UDim.new(0,0),PaddingRight=UDim.new(0,0),PaddingBottom=UDim.new(0,14)}, page)
    return l
end

-- =====================================================================
-- ██████  MAIN PAGE
-- =====================================================================
PageLayout(MainPage, 14, 10)

-- Status card
local statusH = 72
local statusCard = MakeCard(MainPage, statusH, 1)
CardHeader(statusCard, "shield", "HUB STATUS")
-- gold top-cap line
NEW("Frame",{Size=UDim2.new(1,0,0,2),Position=UDim2.new(0,0,0,0),BackgroundColor3=GOLD,BorderSizePixel=0,BackgroundTransparency=0.5}, statusCard)
NEW("TextLabel",{
    Text="Connected  ·  GET BETTER OUT",
    Size=UDim2.new(0.65,0,0,18), Position=UDim2.new(0,14,0,34),
    BackgroundTransparency=1, TextColor3=GREEN,
    Font=Enum.Font.GothamBold, TextSize=12, TextXAlignment=Enum.TextXAlignment.Left
}, statusCard)
NEW("TextLabel",{
    Text="Zili Hub  ·  v2.4.0  ·  Premium Build",
    Size=UDim2.new(1,-20,0,13), Position=UDim2.new(0,14,0,54),
    BackgroundTransparency=1, TextColor3=TEXT3,
    Font=Enum.Font.Gotham, TextSize=10, TextXAlignment=Enum.TextXAlignment.Left
}, statusCard)
-- ping badge
local pingBadge = NEW("TextLabel",{
    Text="◉  LIVE", Size=UDim2.new(0,70,0,22), Position=UDim2.new(1,-82,0,34),
    BackgroundColor3=C(10,30,18), TextColor3=GREEN,
    Font=Enum.Font.GothamBold, TextSize=11, TextXAlignment=Enum.TextXAlignment.Center
}, statusCard)
CORNER(5, pingBadge)
STROKE(GREEN, 1, 0.5, pingBadge)

-- Quick overview (3x2 grid of status dots)
local quickH = 118
local quickCard = MakeCard(MainPage, quickH, 2)
CardHeader(quickCard, "lightning", "QUICK STATUS")

local QT_DATA = {
    {"Auto Farm","AutoFarmLevel",10,34},  {"Auto Buso","AutoBuso",120,34},  {"Auto Geppo","AutoGeppo",230,34},
    {"Auto Fish","AutoFishMerchant",10,76},{"Island ESP","ESP_Island",120,76},{"Travel","TravelActive",230,76},
}
local quickDots = {}
for _,qt in ipairs(QT_DATA) do
    local label,key,px,py = qt[1],qt[2],qt[3],qt[4]
    local box = NEW("Frame",{
        Size=UDim2.new(0,102,0,32), Position=UDim2.new(0,px,0,py),
        BackgroundColor3=BG5
    }, quickCard)
    CORNER(6, box)
    STROKE(C(30,28,55), 1, 0, box)
    NEW("TextLabel",{
        Text=label, Size=UDim2.new(1,-22,1,0), Position=UDim2.new(0,8,0,0),
        BackgroundTransparency=1, TextColor3=TEXT2, Font=Enum.Font.GothamSemibold,
        TextSize=11, TextXAlignment=Enum.TextXAlignment.Left
    }, box)
    local dot = NEW("Frame",{
        Size=UDim2.new(0,8,0,8), Position=UDim2.new(1,-14,0.5,-4),
        BackgroundColor3=C(50,48,72), BorderSizePixel=0
    }, box)
    CORNER(4, dot)
    quickDots[key] = dot
end

-- Live sync loop - cập nhật dots mỗi 0.3s
task.spawn(function()
    while task.wait(0.3) do
        for key,dot in pairs(quickDots) do
            if dot and dot.Parent then
                local on = TogglesData[key] and TogglesData[key].Active
                TWEEN(dot, 0.2, {BackgroundColor3 = on and GOLD2 or C(50,48,72)})
            end
        end
    end
end)

-- ESP / Visuals card
local espH = 148
local espCard = MakeCard(MainPage, espH, 3)
CardHeader(espCard, "eye", "VISUALS & ESP")

local ESP_ROWS = {
    {"Island ESP",  32, "ESP_Island",  function(s) if Esp and IslandData then Esp.Toggle(s,IslandData) end end},
    {"Player ESP",  70, "ESP_Player",  function() end},
    {"Item ESP",   108, "ESP_Item",    function() end},
}
for _,row in ipairs(ESP_ROWS) do
    local lbl,py,key,cb = row[1],row[2],row[3],row[4]
    RowLabel(espCard, lbl, nil, py)
    if py > 32 then RowDivider(espCard, py-2) end
    CardToggle(espCard, py, key, cb)
end

-- =====================================================================
-- ██████  AUTO FARM PAGE
-- =====================================================================
PageLayout(AutoFarmPage, 14, 10)

-- Level Farm card
local lfH = 144
local lfCard = MakeCard(AutoFarmPage, lfH, 1)
CardHeader(lfCard, "sword", "LEVEL FARM")
RowLabel(lfCard, "Start Level Farm", "Auto kills enemies · respawns", 34)

local StartFarmToggle, SFToggleStroke, SFThumb = CardToggle(lfCard, 44, "AutoFarmLevel", function(state)
    AutoFarmLevel.Toggle(state)
    if state then warn("Auto Farming Level On ..") else warn("Auto Farming Level Off ..") end
end)

RowDivider(lfCard, 80)
RowLabel(lfCard, "Auto Farm Level for Fishing", "< 375 → Farm  ·  ≥ 375 → Fish", 84)

-- Helper: đọc level hiện tại của player
local function GetPlayerLevel()
    local level = 0
    pcall(function()
        local statsFolder = game:GetService("ReplicatedStorage"):FindFirstChild("Stats" .. LocalPlayer.Name)
        local statsNode   = statsFolder and statsFolder:FindFirstChild("Stats")
        local levelNode   = statsNode   and statsNode:FindFirstChild("Level")
        if levelNode then level = levelNode.Value end
    end)
    return level
end

-- Helper: bật/tắt toggle theo state (không trigger click, set trực tiếp)
local function SetToggle(key, state)
    local d = TogglesData[key]
    if not d or d.Active == state then return end
    d.Active = state
    local on = state
    TWEEN(d.Btn,  0.22, {BackgroundColor3 = on and GOLDD or BG5})
    TWEEN(d.Strk, 0.22, {Color           = on and GOLD2 or GOLD3})
    local thumbFrame = d.Btn:FindFirstChildOfClass("Frame")
    if thumbFrame then
        TWEEN(thumbFrame, 0.22, {
            BackgroundColor3 = on and GOLD2 or TEXT3,
            Position         = on and UDim2.new(1,-20,0.5,-8) or UDim2.new(0,4,0.5,-8)
        })
    end
    -- FishMasterBar animation for AutoFishMerchant
    if key == "AutoFishMerchant" and FishMasterBar then
        TWEEN(FishMasterBar, 0.35, {BackgroundColor3 = on and GREEN or GOLD})
    end
    if d.Callback then d.Callback(state) end
end

local _, AFFStroke, AFFThumb = CardToggle(lfCard, 96, "AutoFarmForFishing", function(state)
    if not state then
        -- Khi tắt: dừng cả 2
        SetToggle("AutoFarmLevel",    false)
        SetToggle("AutoFishMerchant", false)
    else
        -- Khi bật: check level ngay lập tức, không chờ 3s
        task.spawn(function()
            local level = GetPlayerLevel()
            if level < 375 then
                SetToggle("AutoFarmLevel",    true)
                SetToggle("AutoFishMerchant", false)
            else
                SetToggle("AutoFarmLevel",    false)
                SetToggle("AutoFishMerchant", true)
            end
        end)
    end
end)

-- Background loop: kiểm tra level mỗi 3s khi AFF đang bật
task.spawn(function()
    while true do
        task.wait(3)
        if not TogglesData["AutoFarmForFishing"] or not TogglesData["AutoFarmForFishing"].Active then
            continue
        end
        local level = GetPlayerLevel()
        if level < 375 then
            SetToggle("AutoFarmLevel",     true)
            SetToggle("AutoFishMerchant",  false)
        else
            SetToggle("AutoFarmLevel",     false)
            SetToggle("AutoFishMerchant",  true)
        end
    end
end)

-- Misc Farm card
local mfH = 148
local mfCard = MakeCard(AutoFarmPage, mfH, 2)
CardHeader(mfCard, "fist", "MISC FARM")

-- Gamepass badge
local gpBadge = NEW("TextLabel",{
    Text="GAMEPASS", Size=UDim2.new(0,72,0,16), Position=UDim2.new(1,-84,0,7),
    BackgroundColor3=GOLDD, TextColor3=GOLD2,
    Font=Enum.Font.GothamBold, TextSize=8, TextXAlignment=Enum.TextXAlignment.Center
}, mfCard)
CORNER(4, gpBadge)
STROKE(GOLD3, 1, 0, gpBadge)

local MISC_ROWS = {
    {"Auto Get Buso",  "REQ → LVL 80  ·  25,000 PELI",  36, "AutoBuso",  function(s) if AutoGetBuso then AutoGetBuso.Toggle(s) end end},
    {"Auto Get Geppo", "REQ → LVL 125  ·  50,000 PELI", 96, "AutoGeppo", nil},
}
for i,row in ipairs(MISC_ROWS) do
    local label,req,py,key,baseCb = row[1],row[2],row[3],row[4],row[5]
    RowLabel(mfCard, label, req, py)
    if i > 1 then RowDivider(mfCard, py-2) end
    local btn,strk,thumb = CardToggle(mfCard, py+8, key, baseCb)
    -- Geppo auto-off logic
    if key=="AutoGeppo" then
        TogglesData[key].Callback = function(state)
            if AutoGeppoFunc then AutoGeppoFunc.Toggle(state) end
            if state then
                task.spawn(function()
                    while _G.AutoGeppo do task.wait(0.5) end
                    if TogglesData[key].Active then
                        TogglesData[key].Active=false
                        TWEEN(btn,0.2,{BackgroundColor3=BG5}); TWEEN(strk,0.2,{Color=GOLD3})
                        TWEEN(thumb,0.2,{BackgroundColor3=TEXT3,Position=UDim2.new(0,4,0.5,-8)})
                    end
                end)
            end
        end
    end
end

-- =====================================================================
-- ██████  TRAVEL PAGE
-- =====================================================================
PageLayout(TravelPage, 14, 10)

-- Island Teleport card (no Force Stop - use toggle to stop)
local tpH = 148
local tpCard = MakeCard(TravelPage, tpH, 1)
tpCard.ZIndex = 5
CardHeader(tpCard, "globe", "ISLAND TELEPORT")

-- Target Island label
RowLabel(tpCard, "Target Island", "Select destination", 36)
-- Search box
local SearchBox = NEW("TextBox",{
    Size=UDim2.new(0,172,0,30), Position=UDim2.new(1,-186,0,42),
    BackgroundColor3=BG5, Text="", PlaceholderText="Search Island...",
    TextColor3=GOLD2, Font=Enum.Font.GothamSemibold, TextSize=12,
    ClearTextOnFocus=true, ZIndex=6
}, tpCard)
CORNER(7, SearchBox)
local BoxStroke = STROKE(GOLD3, 1, 0, SearchBox)
SearchBox.Focused:Connect(function() TWEEN(BoxStroke,0.2,{Color=GOLD2}) end)
SearchBox.FocusLost:Connect(function() TWEEN(BoxStroke,0.2,{Color=GOLD3}) end)

-- Dropdown — parented to ScreenGui so it overlays everything
local DropdownScroll = NEW("ScrollingFrame",{
    Size=UDim2.new(0,172,0,150), Position=UDim2.new(0,0,0,0),
    BackgroundColor3=BG0, BorderSizePixel=0,
    ScrollBarThickness=2, Visible=false, ZIndex=200,
    ScrollBarImageColor3=GOLD,
    AutomaticCanvasSize=Enum.AutomaticSize.Y, CanvasSize=UDim2.new(0,0,0,0)
}, ScreenGui)
CORNER(7, DropdownScroll)
STROKE(GOLD3, 1, 0, DropdownScroll)
local DropLayout = NEW("UIListLayout",{HorizontalAlignment=Enum.HorizontalAlignment.Center,Padding=UDim.new(0,2)}, DropdownScroll)
NEW("UIPadding",{PaddingTop=UDim.new(0,4)}, DropdownScroll)

local Islands={}
if IslandData then for n,_ in pairs(IslandData) do table.insert(Islands,n) end; table.sort(Islands) end
local IslandButtons={}
for _,islandName in ipairs(Islands) do
    local btn=NEW("TextButton",{
        Size=UDim2.new(1,-8,0,26), BackgroundTransparency=1, ZIndex=201,
        Text="  "..islandName, TextColor3=TEXT2,
        Font=Enum.Font.Gotham, TextSize=12, TextXAlignment=Enum.TextXAlignment.Left
    }, DropdownScroll)
    CORNER(4, btn)
    btn.MouseEnter:Connect(function() TWEEN(btn,0.12,{BackgroundTransparency=0.85,BackgroundColor3=BG4,TextColor3=GOLD2}); btn.Font=Enum.Font.GothamBold end)
    btn.MouseLeave:Connect(function() TWEEN(btn,0.12,{BackgroundTransparency=1,TextColor3=TEXT2}); btn.Font=Enum.Font.Gotham end)
    btn.MouseButton1Click:Connect(function() SearchBox.Text=string.gsub(btn.Text,"^%s*(.-)%s*$","%1"); DropdownScroll.Visible=false end)
    table.insert(IslandButtons, btn)
end

SearchBox.Focused:Connect(function()
    -- Position below SearchBox using AbsolutePosition
    local ap = SearchBox.AbsolutePosition
    local as = SearchBox.AbsoluteSize
    DropdownScroll.Position = UDim2.new(0, ap.X, 0, ap.Y + as.Y + 2)
    DropdownScroll.Size = UDim2.new(0, as.X, 0, 150)
    DropdownScroll.Visible = true
end)
SearchBox:GetPropertyChangedSignal("Text"):Connect(function()
    local s=string.lower(SearchBox.Text); local cs=string.gsub(s,"'","")
    for _,b in ipairs(IslandButtons) do
        local n=string.lower(string.gsub(b.Text,"^%s*(.-)%s*$","%1")); local cn=string.gsub(n,"'","")
        b.Visible = s=="" or string.find(cn,cs,1,true) and true or false
    end
end)
local Mouse=LocalPlayer:GetMouse()
UIS.InputBegan:Connect(function(inp)
    if inp.UserInputType==Enum.UserInputType.MouseButton1 then
        local mx,my=Mouse.X,Mouse.Y
        local dp,ds=DropdownScroll.AbsolutePosition,DropdownScroll.AbsoluteSize
        local bp,bs=SearchBox.AbsolutePosition,SearchBox.AbsoluteSize
        local inD=mx>=dp.X and mx<=dp.X+ds.X and my>=dp.Y and my<=dp.Y+ds.Y
        local inB=mx>=bp.X and mx<=bp.X+bs.X and my>=bp.Y and my<=bp.Y+bs.Y
        if not inD and not inB then DropdownScroll.Visible=false end
    end
end)

-- Start Travel row
RowDivider(tpCard, 104)
RowLabel(tpCard, "Start Travel", "Navigate automatically", 110)
local ToggleBtn = NEW("TextButton",{
    Size=UDim2.new(0,44,0,24), Position=UDim2.new(1,-58,0,112),
    BackgroundColor3=BG5, Text="", AutoButtonColor=false
}, tpCard)
CORNER(20, ToggleBtn)
local ToggleStroke = STROKE(GOLD3, 1, 0, ToggleBtn)
local TravelThumb = NEW("Frame",{Size=UDim2.new(0,16,0,16),Position=UDim2.new(0,4,0.5,-8),BackgroundColor3=TEXT3,BorderSizePixel=0}, ToggleBtn)
CORNER(20, TravelThumb)
ToggleBtn.MouseButton1Click:Connect(function()
    if not TweenSys then return end
    if TweenSys.IsTeleporting then
        TweenSys.Stop()
        TWEEN(ToggleBtn,0.2,{BackgroundColor3=BG5}); TWEEN(ToggleStroke,0.2,{Color=GOLD3})
        TWEEN(TravelThumb,0.2,{BackgroundColor3=TEXT3,Position=UDim2.new(0,4,0.5,-8)})
    else
        local td=IslandData and IslandData[SearchBox.Text]; if not td then return end
        TweenSys.Start(td)
        TWEEN(ToggleBtn,0.2,{BackgroundColor3=GOLDD}); TWEEN(ToggleStroke,0.2,{Color=GOLD2})
        TWEEN(TravelThumb,0.2,{BackgroundColor3=GOLD2,Position=UDim2.new(1,-20,0.5,-8)})
    end
end)

-- Auto 2nd Sea card
local sea2Card = MakeCard(TravelPage, 90, 2)
CardHeader(sea2Card, "wave", "AUTO 2ND SEA")

RowLabel(sea2Card, "Auto Enter 2nd Sea", "Auto travel to 2nd sea portal", 32)
CardToggle(sea2Card, 40, "Auto2ndSea", function(state)
    _G.Auto2ndSea = state
end)
RowDivider(sea2Card, 72)
-- info label
NEW("TextLabel",{
    Text="Requires Level 700+  ·  Finish all quests",
    Size=UDim2.new(1,-24,0,14), Position=UDim2.new(0,14,0,76),
    BackgroundTransparency=1, TextColor3=GOLD3,
    Font=Enum.Font.GothamBold, TextSize=10, TextXAlignment=Enum.TextXAlignment.Left
}, sea2Card)

-- Dummy ESP references for compat
local EspSectionFrame=NEW("Frame",{Size=UDim2.new(0,0,0,0),BackgroundTransparency=1,Visible=false},TravelPage)
local EspToggleBtn=NEW("TextButton",{Text=""},EspSectionFrame)
local EspToggleStroke=NEW("UIStroke",{},EspToggleBtn)
local EspThumb=NEW("Frame",{},EspToggleBtn)
EspToggleBtn.MouseButton1Click:Connect(function() end)

-- =====================================================================
-- ██████  FISHING + MERCHANT PAGE
-- =====================================================================
PageLayout(FishingPage, 14, 10)

-- Master toggle card - taller for better text
local fmH = 80
local fmCard = MakeCard(FishingPage, fmH, 1)
CardHeader(fmCard, "fish", "FISHING + MERCHANT FARM")

local FishMasterBar = NEW("Frame",{
    Size=UDim2.new(0,3,1,0), Position=UDim2.new(0,0,0,0),
    BackgroundColor3=GOLD, BorderSizePixel=0
}, fmCard)
CORNER(2, FishMasterBar)

-- main label
NEW("TextLabel",{
    Text="Enable Auto Fishing + Merchant",
    Size=UDim2.new(0.75,0,0,20), Position=UDim2.new(0,14,0,32),
    BackgroundTransparency=1, TextColor3=TEXT1,
    Font=Enum.Font.GothamSemibold, TextSize=14, TextXAlignment=Enum.TextXAlignment.Left
}, fmCard)
-- sub label
NEW("TextLabel",{
    Text="Auto catch  ·  sell  ·  restock bait in loop",
    Size=UDim2.new(0.75,0,0,14), Position=UDim2.new(0,14,0,52),
    BackgroundTransparency=1, TextColor3=TEXT2,
    Font=Enum.Font.Gotham, TextSize=11, TextXAlignment=Enum.TextXAlignment.Left
}, fmCard)

local StartFishToggle = NEW("TextButton",{
    Size=UDim2.new(0,44,0,24), Position=UDim2.new(1,-56,0,40),
    BackgroundColor3=BG5, Text="", AutoButtonColor=false
}, fmCard)
CORNER(20, StartFishToggle)
local FishToggleStroke = STROKE(GOLD3, 1, 0, StartFishToggle)
local FishThumb = NEW("Frame",{Size=UDim2.new(0,16,0,16),Position=UDim2.new(0,4,0.5,-8),BackgroundColor3=TEXT3,BorderSizePixel=0}, StartFishToggle)
CORNER(20, FishThumb)

TogglesData["AutoFishMerchant"] ={
    Active = false, Btn = StartFishToggle, Strk = FishToggleStroke,
    Thumb = FishThumb, MasterBar = FishMasterBar,
    Callback = function(state)
        _G.AutoFishMerchant = state
        if state then
            AutoFishMerchantModule.Start(TogglesData)
        else
            AutoFishMerchantModule.Stop()
        end
    end
}
StartFishToggle.MouseButton1Click:Connect(function()
    local d=TogglesData["AutoFishMerchant"]; d.Active=not d.Active; local on=d.Active
    TWEEN(StartFishToggle,0.22,{BackgroundColor3=on and GOLDD or BG5})
    TWEEN(FishToggleStroke,0.22,{Color=on and GOLD2 or GOLD3})
    TWEEN(FishThumb,0.22,{BackgroundColor3=on and GOLD2 or TEXT3, Position=on and UDim2.new(1,-20,0.5,-8) or UDim2.new(0,4,0.5,-8)})
    TWEEN(FishMasterBar,0.35,{BackgroundColor3=on and GREEN or GOLD})
    if d.Callback then d.Callback(on) end
end)

-- Live stats row - 4 columns: Mythic Chest | Leg. Fish | Peli | Bait
local fsH = 80
local fsCard = MakeCard(FishingPage, fsH, 2)
fsCard.BackgroundColor3 = BG0
STROKE(C(25,23,48), 1, 0, fsCard:FindFirstChildOfClass("UIStroke"))

local FISH_STATS = {
    {"🎁","MYTHIC CHEST","—",   6, "MythicChest"},
    {"🐟","LEG. BAIT",  "—", 116, "LegBait"},
    {"💰","PELI",       "0", 226, "Peli"},
    {"🎣","BAIT",       "—", 336, "Bait"},
}
local FishStatValues = {}
for _,fs in ipairs(FISH_STATS) do
    local ico,lbl,val,px,key = fs[1],fs[2],fs[3],fs[4],fs[5]
    if px>6 then
        NEW("Frame",{Size=UDim2.new(0,1,0.55,0),Position=UDim2.new(0,px-6,0.225,0),BackgroundColor3=C(30,28,55),BorderSizePixel=0}, fsCard)
    end
    -- emoji icon — Font.Legacy bắt buộc để emoji hiện đúng
    NEW("TextLabel",{Text=ico,Size=UDim2.new(0,100,0,20),Position=UDim2.new(0,px,0,6),BackgroundTransparency=1,Font=Enum.Font.Legacy,TextSize=18,TextXAlignment=Enum.TextXAlignment.Center}, fsCard)
    -- value number — lưu ref để update live
    local valLbl = NEW("TextLabel",{Text=val,Size=UDim2.new(0,100,0,20),Position=UDim2.new(0,px,0,24),BackgroundTransparency=1,TextColor3=GOLD2,Font=Enum.Font.GothamBold,TextSize=15,TextXAlignment=Enum.TextXAlignment.Center}, fsCard)
    -- label under
    NEW("TextLabel",{Text=lbl,Size=UDim2.new(0,100,0,14),Position=UDim2.new(0,px,0,46),BackgroundTransparency=1,TextColor3=TEXT2,Font=Enum.Font.GothamBold,TextSize=9,TextXAlignment=Enum.TextXAlignment.Center}, fsCard)
    FishStatValues[key] = valLbl
end

-- Live stat update — 2s interval, tự dừng khi card bị destroy (không leak)
task.spawn(function()
    while fsCard and fsCard.Parent do
        task.wait(2)
        pcall(function()
            local statFolder = game:GetService("ReplicatedStorage"):FindFirstChild("Stats" .. LocalPlayer.Name)
            if not statFolder then return end

            -- Decode inventory JSON một lần duy nhất mỗi tick
            local inv = {}
            local invNode = statFolder:FindFirstChild("Inventory")
            invNode = invNode and invNode:FindFirstChild("Inventory")
            if invNode then
                local ok, decoded = pcall(function() return HttpService:JSONDecode(invNode.Value) end)
                if ok and type(decoded)=="table" then inv = decoded end
            end

            -- Mythical Fruit Chest
            if FishStatValues["MythicChest"] then
                FishStatValues["MythicChest"].Text = tostring(inv["Mythical Fruit Chest"] or 0)
            end
            -- Legendary Fish Bait
            if FishStatValues["LegBait"] then
                FishStatValues["LegBait"].Text = tostring(inv["Legendary Fish Bait"] or 0)
            end
            -- Peli
            if FishStatValues["Peli"] then
                local statsNode = statFolder:FindFirstChild("Stats")
                local peliNode  = statsNode and statsNode:FindFirstChild("Peli")
                FishStatValues["Peli"].Text = peliNode and tostring(peliNode.Value) or "0"
            end
            -- Bait hiện tại đang dùng
            if FishStatValues["Bait"] then
                local bait = _G.TargetBait or "Common Fish Bait"
                FishStatValues["Bait"].Text = tostring(inv[bait] or 0)
            end
        end)
    end
end)

-- Config card
local fcH = 428
local ConfigFishFrame = MakeCard(FishingPage, fcH, 3)
CardHeader(ConfigFishFrame, "gear", "CONFIGURATION")

-- Dropdown factory (unchanged logic)
local function CreateDropdown(parent, titleText, options, defaultSelect, posY, configKey, isMulti, showSearch)
    local lbl=NEW("TextLabel",{
        Size=UDim2.new(0,150,0,20),Position=UDim2.new(0,12,0,posY),
        BackgroundTransparency=1,Text=titleText,TextColor3=TEXT1,
        Font=Enum.Font.GothamSemibold,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
    },parent)

    local headBtn=NEW("TextButton",{
        Size=UDim2.new(0,158,0,24),Position=UDim2.new(1,-170,0,posY-2),
        BackgroundColor3=BG5,TextColor3=GOLD2,Font=Enum.Font.GothamSemibold,TextSize=11,
        Text=isMulti and "Select..." or (defaultSelect or "Select..."),AutoButtonColor=false
    },parent)
    CORNER(5,headBtn)
    local headStroke=STROKE(GOLD3,1,0,headBtn)

    -- dropScroll parented to ScreenGui so it's NEVER clipped by cards
    local dropScroll=NEW("ScrollingFrame",{
        Size=UDim2.new(0,158,0,0),   -- height set dynamically
        Position=UDim2.new(0,0,0,0), -- position set when opened
        BackgroundColor3=BG0,BorderSizePixel=0,ScrollBarThickness=2,
        Visible=false,ZIndex=200,ScrollBarImageColor3=GOLD,
        AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(0,0,0,0)
    },ScreenGui)
    CORNER(5,dropScroll)
    STROKE(GOLD3,1,0,dropScroll)
    NEW("UIListLayout",{HorizontalAlignment=Enum.HorizontalAlignment.Center,Padding=UDim.new(0,2)},dropScroll)
    NEW("UIPadding",{PaddingTop=UDim.new(0,3)},dropScroll)

    local searchInput
    if showSearch then
        searchInput=NEW("TextBox",{
            Size=UDim2.new(1,-6,0,22),BackgroundTransparency=1,
            Text="",PlaceholderText="Search...",TextColor3=TEXT1,
            Font=Enum.Font.Gotham,TextSize=11,PlaceholderColor3=TEXT3,ZIndex=201
        },dropScroll)
    end

    -- Init value
    local initVal = isMulti and {} or nil
    TogglesData[configKey]={Value=initVal, Callback=function() end, HeadBtn=headBtn}
    if not isMulti and (defaultSelect == nil or defaultSelect == "") then
        headBtn.Text = "Select..."
    end

    local function openDrop()
        -- Calculate absolute position of headBtn to place dropScroll just below it
        local absPos  = headBtn.AbsolutePosition
        local absSize = headBtn.AbsoluteSize
        local maxH    = 150 -- max visible height of list
        dropScroll.Position = UDim2.new(0, absPos.X, 0, absPos.Y + absSize.Y + 2)
        dropScroll.Size     = UDim2.new(0, absSize.X, 0, maxH)
        dropScroll.Visible  = true
        TWEEN(headStroke,0.15,{Color=GOLD2})
        if showSearch and searchInput then searchInput:CaptureFocus() end
    end

    local function closeDrop()
        dropScroll.Visible = false
        TWEEN(headStroke,0.15,{Color=GOLD3})
    end

    headBtn.MouseButton1Click:Connect(function()
        if dropScroll.Visible then closeDrop() else openDrop() end
    end)

    -- Close when clicking outside
    UIS.InputBegan:Connect(function(inp)
        if inp.UserInputType == Enum.UserInputType.MouseButton1 and dropScroll.Visible then
            local mx, my = inp.Position.X, inp.Position.Y
            local dp, ds = dropScroll.AbsolutePosition, dropScroll.AbsoluteSize
            local bp, bs = headBtn.AbsolutePosition, headBtn.AbsoluteSize
            local inDrop = mx>=dp.X and mx<=dp.X+ds.X and my>=dp.Y and my<=dp.Y+ds.Y
            local inHead = mx>=bp.X and mx<=bp.X+bs.X and my>=bp.Y and my<=bp.Y+bs.Y
            if not inDrop and not inHead then closeDrop() end
        end
    end)

    local function refreshList()
        local ft = showSearch and searchInput and searchInput.Text:lower() or ""
        for _,b in ipairs(dropScroll:GetChildren()) do if b:IsA("TextButton") then b.Visible=false end end
        for _,opt in ipairs(options) do
            local b=dropScroll:FindFirstChild(opt)
            if b and opt:lower():find(ft,1,true) then b.Visible=true end
        end
    end
    if showSearch and searchInput then searchInput:GetPropertyChangedSignal("Text"):Connect(refreshList) end

    for _,opt in ipairs(options) do
        local btn=NEW("TextButton",{
            Size=UDim2.new(1,-6,0,24),BackgroundTransparency=1,ZIndex=201,
            Text="  "..opt,Font=Enum.Font.Gotham,TextSize=12,
            TextXAlignment=Enum.TextXAlignment.Left,Name=opt,AutoButtonColor=false
        },dropScroll)
        CORNER(3,btn)
        btn.TextColor3=TEXT2

        btn.MouseEnter:Connect(function() TWEEN(btn,0.1,{BackgroundTransparency=0.85,BackgroundColor3=BG4,TextColor3=GOLD2}); btn.Font=Enum.Font.GothamSemibold end)
        btn.MouseLeave:Connect(function()
            local isSel = isMulti and TogglesData[configKey].Value[opt] or (not isMulti and TogglesData[configKey].Value==opt)
            if not isSel then TWEEN(btn,0.1,{BackgroundTransparency=1,TextColor3=TEXT2}); btn.Font=Enum.Font.Gotham end
        end)

        btn.MouseButton1Click:Connect(function()
            if isMulti then
                local cur=TogglesData[configKey].Value; cur[opt]=not cur[opt]
                if cur[opt] then
                    TWEEN(btn,0.1,{TextColor3=GOLD2}); btn.Font=Enum.Font.GothamBold
                    if not btn:FindFirstChild("TickMark") then
                        NEW("TextLabel",{Name="TickMark",Text="✓",TextColor3=GOLD2,TextXAlignment=Enum.TextXAlignment.Right,Size=UDim2.new(1,-5,1,0),BackgroundTransparency=1,Font=Enum.Font.GothamBold,TextSize=12,ZIndex=202},btn)
                    end
                else
                    TWEEN(btn,0.1,{TextColor3=TEXT2}); btn.Font=Enum.Font.Gotham
                    if btn:FindFirstChild("TickMark") then btn.TickMark:Destroy() end
                end
                local ct=0; for _,v in pairs(cur) do if v then ct=ct+1 end end
                headBtn.Text = ct>0 and (ct.." Selected") or "Select..."
                TogglesData[configKey].Callback(cur)
            else
                for _,ob in ipairs(dropScroll:GetChildren()) do
                    if ob:IsA("TextButton") then TWEEN(ob,0.1,{TextColor3=TEXT2}); ob.Font=Enum.Font.Gotham end
                end
                TWEEN(btn,0.1,{TextColor3=GOLD2}); btn.Font=Enum.Font.GothamBold
                headBtn.Text=opt
                closeDrop()
                TogglesData[configKey].Value=opt; TogglesData[configKey].Callback(opt)
            end
        end)
    end
end

-- ── BAIT (single select, no default) ──
local baitOpts={"Common Fish Bait","Rare Fish Bait","Legendary Fish Bait"}
CreateDropdown(ConfigFishFrame,"Auto Select Bait",baitOpts,nil,34,"Config_SelectBait",false,false)

-- ── SELL FISH (multi, no default) ──
local sellOpts={"Common Fish","Rare Fish","Legendary Fish"}
CreateDropdown(ConfigFishFrame,"Auto Sell Fish",sellOpts,nil,78,"Config_SellFish",true,false)

-- ── AUTO BUY ITEMS (multi + always-visible search, full rarity list) ──
do
    local BUY_ITEMS_SORTED = {
        -- Mythic
        "All Seeing Shamrock","Mythical Fruit Chest",
        -- Legendary
        "Legendary Fruit Chest","Legendary Fish Bait","Merchants Banana Rod",
        "Knight's Gauntlet","Crab Cutlass","Bisento","Kessui","Raiui",
        "Tropical Parrot","Coffin Boat","Striker","Hoverboard",
        -- Epic
        "Hunter's Journal","Jitte","Spirit Color Essence",
        "Crimson Nightcoat","Sea-Breeze Haori","Raylo's Outfit",
        "Blossom Skirt","Desert Merchant Outfit","Sea-Breeze Skirt","Tari's Karoo Coat",
        -- Rare
        "Race Reroll","Rare Fruit Chest","Spare Fruit Bag","Bomi's Log Pose",
        "Gravity Blade","Dark Root","Rare Fish Bait","Golden Staff","Golden Hook","Thrilled Ship",
        -- Uncommon / Common
        "Karoo Mount","Special Tailor Token","SP Reset Essence",
    }
    local ITEM_RARITY = {
        ["All Seeing Shamrock"]="* Mythic",["Mythical Fruit Chest"]="* Mythic",
        ["Legendary Fruit Chest"]="+ Legendary",["Legendary Fish Bait"]="+ Legendary",
        ["Merchants Banana Rod"]="+ Legendary",["Knight's Gauntlet"]="+ Legendary",
        ["Crab Cutlass"]="+ Legendary",["Bisento"]="+ Legendary",
        ["Kessui"]="+ Legendary",["Raiui"]="+ Legendary",
        ["Tropical Parrot"]="+ Legendary",["Coffin Boat"]="+ Legendary",
        ["Striker"]="+ Legendary",["Hoverboard"]="+ Legendary",
        ["Hunter's Journal"]="# Epic",["Jitte"]="# Epic",
        ["Spirit Color Essence"]="# Epic",["Crimson Nightcoat"]="# Epic",
        ["Sea-Breeze Haori"]="# Epic",["Raylo's Outfit"]="# Epic",
        ["Blossom Skirt"]="# Epic",["Desert Merchant Outfit"]="# Epic",
        ["Sea-Breeze Skirt"]="# Epic",["Tari's Karoo Coat"]="# Epic",
        ["Race Reroll"]="- Rare",["Rare Fruit Chest"]="- Rare",
        ["Spare Fruit Bag"]="- Rare",["Bomi's Log Pose"]="- Rare",
        ["Gravity Blade"]="- Rare",["Dark Root"]="- Rare",
        ["Rare Fish Bait"]="- Rare",["Golden Staff"]="- Rare",
        ["Golden Hook"]="- Rare",["Thrilled Ship"]="- Rare",
        ["Karoo Mount"]="Uncommon",["Special Tailor Token"]="Uncommon",
        ["SP Reset Essence"]="Common",
    }
    local RARITY_COLOR = {
        ["* Mythic"]=C(220,80,255),  ["+ Legendary"]=C(255,185,50),
        ["# Epic"]=C(160,80,255),    ["- Rare"]=C(80,140,255),
        ["Uncommon"]=C(80,210,120),  ["Common"]=C(180,175,195),
    }
    -- LayoutOrder theo rarity để UIListLayout sort đúng thứ tự
    local RARITY_ORDER = {
        ["* Mythic"]=1, ["+ Legendary"]=2, ["# Epic"]=3,
        ["- Rare"]=4,   ["Uncommon"]=5,    ["Common"]=6,
    }

    -- label
    NEW("TextLabel",{
        Size=UDim2.new(0,150,0,20),Position=UDim2.new(0,12,0,122),
        BackgroundTransparency=1,Text="Auto Buy Items",TextColor3=TEXT1,
        Font=Enum.Font.GothamSemibold,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
    },ConfigFishFrame)

    -- count badge (shows N Selected)
    local buyCountBadge = NEW("TextLabel",{
        Size=UDim2.new(0,158,0,24),Position=UDim2.new(1,-170,0,120),
        BackgroundColor3=BG5,TextColor3=TEXT3,
        Font=Enum.Font.GothamBold,TextSize=11,Text="Select items...",
        TextXAlignment=Enum.TextXAlignment.Center
    },ConfigFishFrame)
    CORNER(5,buyCountBadge)
    STROKE(GOLD3,1,0,buyCountBadge)

    -- search box — xóa khi click vào, giữ nguyên khi blur
    local buySearchBox = NEW("TextBox",{
        Size=UDim2.new(1,-24,0,26),Position=UDim2.new(0,12,0,150),
        BackgroundColor3=BG5,PlaceholderText="  Search items...",
        Text="",TextColor3=GOLD2,Font=Enum.Font.GothamSemibold,TextSize=11,
        ClearTextOnFocus=false, MultiLine=false
    },ConfigFishFrame)
    CORNER(6,buySearchBox)
    local buySearchStroke = STROKE(GOLD3,1,0,buySearchBox)
    -- Xóa text khi click vào (focused) để gõ filter mới
    buySearchBox.Focused:Connect(function()
        buySearchBox.Text = ""
        TWEEN(buySearchStroke,0.15,{Color=GOLD2})
    end)
    buySearchBox.FocusLost:Connect(function()
        TWEEN(buySearchStroke,0.15,{Color=GOLD3})
    end)

    -- scrolling list — UIListLayout sort theo LayoutOrder (rarity)
    local buyList = NEW("ScrollingFrame",{
        Size=UDim2.new(1,-24,0,120),Position=UDim2.new(0,12,0,182),
        BackgroundColor3=BG0,BorderSizePixel=0,
        ScrollBarThickness=2,ScrollBarImageColor3=GOLD,
        AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(0,0,0,0)
    },ConfigFishFrame)
    CORNER(6,buyList)
    STROKE(GOLD3,1,0,buyList)
    NEW("UIListLayout",{
        HorizontalAlignment=Enum.HorizontalAlignment.Center,
        Padding=UDim.new(0,2),
        SortOrder=Enum.SortOrder.LayoutOrder  -- sort theo rarity order
    },buyList)
    NEW("UIPadding",{PaddingTop=UDim.new(0,4),PaddingBottom=UDim.new(0,4)},buyList)

    -- init toggledata
    TogglesData["Config_BuyItems"] = {Value={}, Callback=function() end}

    local buyBtns = {}
    local SyncBuyItemsUI  -- forward declare (defined after loop so closures capture it)

    for idx,itemName in ipairs(BUY_ITEMS_SORTED) do
        local rarLabel = ITEM_RARITY[itemName] or "# Epic"
        local rarColor = RARITY_COLOR[rarLabel] or C(160,80,255)
        local rarOrder = RARITY_ORDER[rarLabel] or 3
        local row = NEW("Frame",{
            Size=UDim2.new(1,-6,0,26),BackgroundColor3=BG3,
            Name=itemName,BorderSizePixel=0,
            LayoutOrder = rarOrder * 1000 + idx
        },buyList)
        CORNER(4,row)

        -- rarity tag
        NEW("TextLabel",{
            Text=rarLabel,Size=UDim2.new(0,80,1,0),Position=UDim2.new(0,6,0,0),
            BackgroundTransparency=1,TextColor3=rarColor,
            Font=Enum.Font.GothamBold,TextSize=9,TextXAlignment=Enum.TextXAlignment.Left
        },row)
        -- item name
        local nameLabel = NEW("TextLabel",{
            Text=itemName,Size=UDim2.new(1,-110,1,0),Position=UDim2.new(0,82,0,0),
            BackgroundTransparency=1,TextColor3=TEXT2,
            Font=Enum.Font.Gotham,TextSize=11,TextXAlignment=Enum.TextXAlignment.Left
        },row)
        -- checkmark
        local check = NEW("TextLabel",{
            Text="",Size=UDim2.new(0,20,1,0),Position=UDim2.new(1,-22,0,0),
            BackgroundTransparency=1,TextColor3=GOLD2,
            Font=Enum.Font.GothamBold,TextSize=13,TextXAlignment=Enum.TextXAlignment.Center
        },row)

        local rowBtn = NEW("TextButton",{
            Size=UDim2.new(1,0,1,0),BackgroundTransparency=1,
            Text="",AutoButtonColor=false
        },row)

        rowBtn.MouseEnter:Connect(function() TWEEN(row,0.1,{BackgroundColor3=BG4}) end)
        rowBtn.MouseLeave:Connect(function() TWEEN(row,0.1,{BackgroundColor3=BG3}) end)
        rowBtn.MouseButton1Click:Connect(function()
            local cur = TogglesData["Config_BuyItems"].Value
            cur[itemName] = not (cur[itemName] == true)  -- toggle true/nil (avoid false noise in save)
            if SyncBuyItemsUI then SyncBuyItemsUI() end
        end)

        -- store refs for load/sync
        buyBtns[itemName] = {frame=row, check=check, nameLabel=nameLabel}
    end

    -- ── Unified UI sync (used by click handler AND config load) ──
    SyncBuyItemsUI = function(value)
        local cur = value or TogglesData["Config_BuyItems"].Value
        local ct = 0
        for name, refs in pairs(buyBtns) do
            local selected = type(cur)=="table" and cur[name]==true
            if selected then
                ct = ct + 1
                refs.check.Text = "✓"
                refs.nameLabel.TextColor3 = GOLD2
                refs.nameLabel.Font = Enum.Font.GothamBold
            else
                refs.check.Text = ""
                refs.nameLabel.TextColor3 = TEXT2
                refs.nameLabel.Font = Enum.Font.Gotham
            end
        end
        buyCountBadge.Text = ct > 0 and (ct .. " Selected") or "Select items..."
        buyCountBadge.TextColor3 = ct > 0 and GOLD2 or TEXT3
    end
    -- Expose HeadBtn and Callback so ConfigManager can sync after load
    TogglesData["Config_BuyItems"].HeadBtn  = buyCountBadge
    TogglesData["Config_BuyItems"].Callback = SyncBuyItemsUI

    -- search filter
    buySearchBox:GetPropertyChangedSignal("Text"):Connect(function()
        local ft = buySearchBox.Text:lower()
        for name, row in pairs(buyBtns) do
            row.Visible = ft=="" or name:lower():find(ft,1,true)~=nil
        end
    end)
end

-- ── CRAFT BAIT (multi, no default) ──
local craftOpts={"Rare Fish Bait","Legendary Fish Bait"}
CreateDropdown(ConfigFishFrame,"Auto Craft Bait",craftOpts,nil,318,"Config_CraftBait",true,false)

-- ── BAIT BUY AMOUNT ──
_G.FishBuyAmount = 50
NEW("TextLabel",{
    Size=UDim2.new(0,150,0,20),Position=UDim2.new(0,12,0,354),
    BackgroundTransparency=1,Text="Bait Buy Amount",TextColor3=TEXT1,
    Font=Enum.Font.GothamSemibold,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
},ConfigFishFrame)
local buyAmtFrame = NEW("Frame",{
    Size=UDim2.new(0,158,0,24),Position=UDim2.new(1,-170,0,352),
    BackgroundColor3=BG5
},ConfigFishFrame)
CORNER(5,buyAmtFrame)
local buyAmtStroke = STROKE(GOLD3,1,0,buyAmtFrame)
local buyAmtBox = NEW("TextBox",{
    Size=UDim2.new(1,-16,1,0),Position=UDim2.new(0,8,0,0),
    BackgroundTransparency=1,Text="50",PlaceholderText="50",
    TextColor3=GOLD2,Font=Enum.Font.GothamSemibold,TextSize=12,
    ClearTextOnFocus=false
},buyAmtFrame)
buyAmtBox.Focused:Connect(function() TWEEN(buyAmtStroke,0.15,{Color=GOLD2}) end)
buyAmtBox.FocusLost:Connect(function()
    local v = tonumber(buyAmtBox.Text)
    if v and v > 0 then
        _G.FishBuyAmount = math.floor(v)
    else
        buyAmtBox.Text = tostring(_G.FishBuyAmount)
    end
    TWEEN(buyAmtStroke,0.15,{Color=GOLD3})
end)

-- ==========================================
-- Ô NHẬP DISCORD WEBHOOK (Dùng chuẩn UI mới)
-- ==========================================
NEW("TextLabel",{
    Size=UDim2.new(0,150,0,20),Position=UDim2.new(0,12,0,392),
    BackgroundTransparency=1,Text="Discord Webhook",TextColor3=TEXT1,
    Font=Enum.Font.GothamSemibold,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
}, ConfigFishFrame)

local boxFrameWH = NEW("Frame",{
    Size=UDim2.new(0,158,0,24),Position=UDim2.new(1,-170,0,390),
    BackgroundColor3=BG5
}, ConfigFishFrame)
CORNER(5, boxFrameWH)
local boxStrokeWH = STROKE(GOLD3, 1, 0, boxFrameWH)

local textBoxWH = NEW("TextBox",{
    Size=UDim2.new(1,-16,1,0),Position=UDim2.new(0,8,0,0),
    BackgroundTransparency=1,Text="",PlaceholderText="https://discord...",
    TextColor3=TEXT1,PlaceholderColor3=TEXT3,
    Font=Enum.Font.Gotham,TextSize=10,TextXAlignment=Enum.TextXAlignment.Left,
    ClearTextOnFocus=false,ClipsDescendants=true
}, boxFrameWH)

TogglesData["Config_Webhook"] = { Value = "" }

-- Xử lý khi dán link xong (Chớp viền vàng báo thành công)
textBoxWH.FocusLost:Connect(function()
    local txt = textBoxWH.Text
    _G.WebhookUrl = txt
    TogglesData["Config_Webhook"].Value = txt
    
    TWEEN(boxStrokeWH, 0.15, {Color=GOLD2})
    task.wait(0.2)
    TWEEN(boxStrokeWH, 0.2, {Color=GOLD3})
end)

-- ── AUTO STORE / DROP FRUIT CARD ──
local fruitCardH = 392
local fruitCard = MakeCard(FishingPage, fruitCardH, 4)
CardHeader(fruitCard, "fruit", "FRUIT MANAGEMENT")

-- Auto Store Fruit row
RowLabel(fruitCard, "Auto Store Fruit", "Auto store fruit to inventory", 34)
CardToggle(fruitCard, 44, "AutoStoreFruit", function(state)
    _G.AutoStoreFruit = state
    -- Đảm bảo module đang chạy khi bật bất kỳ toggle nào
    if state and AutoFruitManagerModule then
        AutoFruitManagerModule.Start(TogglesData)
    end
end)
RowDivider(fruitCard, 82)

-- Auto Drop Fruit row
RowLabel(fruitCard, "Auto Drop Fruit", "Drop fruit when inventory full", 88)
CardToggle(fruitCard, 98, "AutoDropFruit", function(state)
    _G.AutoDropFruit = state
    if state and AutoFruitManagerModule then
        AutoFruitManagerModule.Start(TogglesData)
    end
end)
RowDivider(fruitCard, 132)

-- Fruit Rarity Filter (multi-select dropdown — opens as overlay)
local RARITY_OPTS = {"Common", "Rare", "Epic", "Legendary", "Mythic"}
CreateDropdown(fruitCard, "Fruit Rarity Filter", RARITY_OPTS, nil, 138, "Config_FruitRarity", true, false)

-- ── Select Fruit — inline list (style giống Auto Buy Items) ──
-- Fruit data khớp với FRUIT_RARITY trong AutoFruitManager (tool name = key)
local FRUIT_SORTED = {
    -- Mythic
    {name="Dragon",      rarity="* Mythic"},  {name="Soul",        rarity="* Mythic"},
    {name="Mochi",       rarity="* Mythic"},  {name="Venom",       rarity="* Mythic"},
    {name="Tori",        rarity="* Mythic"},  {name="Pteranodon",  rarity="* Mythic"},
    {name="Ope",         rarity="* Mythic"},  {name="Buddha",      rarity="* Mythic"},
    -- Legendary
    {name="Pika",        rarity="+ Legendary"},{name="Mera",       rarity="+ Legendary"},
    {name="Yami",        rarity="+ Legendary"},{name="Smoke",      rarity="+ Legendary"},
    {name="Kage",        rarity="+ Legendary"},{name="Paw",        rarity="+ Legendary"},
    {name="Goru",        rarity="+ Legendary"},{name="Yuki",       rarity="+ Legendary"},
    {name="Magu",        rarity="+ Legendary"},{name="Suna",       rarity="+ Legendary"},
    {name="Goro",        rarity="+ Legendary"},{name="Hie",        rarity="+ Legendary"},
    {name="Gura",        rarity="+ Legendary"},{name="Zushi",      rarity="+ Legendary"},
    -- Epic
    {name="Kira",        rarity="# Epic"},     {name="Spring",     rarity="# Epic"},
    {name="Yomi",        rarity="# Epic"},
    -- Rare
    {name="Bari",        rarity="- Rare"},     {name="Mero",       rarity="- Rare"},
    {name="Horo",        rarity="- Rare"},     {name="Bomb",       rarity="- Rare"},
    {name="Gomu",        rarity="- Rare"},
    -- Common
    {name="Spin",        rarity="Common"},     {name="Suke",       rarity="Common"},
    {name="Kilo",        rarity="Common"},     {name="Heal",       rarity="Common"},
}
local FRUIT_RAR_COLOR = {
    ["* Mythic"]=C(220,80,255), ["+ Legendary"]=C(255,185,50),
    ["# Epic"]=C(160,80,255),   ["- Rare"]=C(80,140,255),
    ["Common"]=C(180,175,195),
}
local FRUIT_RAR_ORDER = {["* Mythic"]=1,["+ Legendary"]=2,["# Epic"]=3,["- Rare"]=4,["Common"]=5}

-- label + count badge
NEW("TextLabel",{
    Size=UDim2.new(0,120,0,20),Position=UDim2.new(0,12,0,176),
    BackgroundTransparency=1,Text="Select Fruit",TextColor3=TEXT1,
    Font=Enum.Font.GothamSemibold,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
},fruitCard)
local fruitCountBadge = NEW("TextLabel",{
    Size=UDim2.new(0,140,0,22),Position=UDim2.new(1,-152,0,177),
    BackgroundColor3=BG5,TextColor3=TEXT3,
    Font=Enum.Font.GothamBold,TextSize=11,Text="None selected",
    TextXAlignment=Enum.TextXAlignment.Center
},fruitCard)
CORNER(5,fruitCountBadge)
STROKE(GOLD3,1,0,fruitCountBadge)

-- search box — ở TRÊN list (không trong UIListLayout)
local fruitSearch = NEW("TextBox",{
    Size=UDim2.new(1,-24,0,26),Position=UDim2.new(0,12,0,204),
    BackgroundColor3=BG5,PlaceholderText="  Search fruit...",
    Text="",TextColor3=GOLD2,Font=Enum.Font.GothamSemibold,TextSize=11,
    ClearTextOnFocus=false
},fruitCard)
CORNER(6,fruitSearch)
local fruitSearchStroke = STROKE(GOLD3,1,0,fruitSearch)
fruitSearch.Focused:Connect(function()
    fruitSearch.Text = ""
    TWEEN(fruitSearchStroke,0.15,{Color=GOLD2})
end)
fruitSearch.FocusLost:Connect(function()
    TWEEN(fruitSearchStroke,0.15,{Color=GOLD3})
end)

-- scrolling list — fixed height, items scroll inside
local fruitList = NEW("ScrollingFrame",{
    Size=UDim2.new(1,-24,0,140),Position=UDim2.new(0,12,0,236),
    BackgroundColor3=BG0,BorderSizePixel=0,
    ScrollBarThickness=2,ScrollBarImageColor3=GOLD,
    AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(0,0,0,0)
},fruitCard)
CORNER(6,fruitList)
STROKE(GOLD3,1,0,fruitList)
NEW("UIListLayout",{
    HorizontalAlignment=Enum.HorizontalAlignment.Center,
    Padding=UDim.new(0,2), SortOrder=Enum.SortOrder.LayoutOrder
},fruitList)
NEW("UIPadding",{PaddingTop=UDim.new(0,4),PaddingBottom=UDim.new(0,4)},fruitList)

TogglesData["Config_FruitSelect"] = {Value="", Callback=function() end}

local fruitRows = {}
local selectedFruitName = nil

for idx,ft in ipairs(FRUIT_SORTED) do
    local rarColor = FRUIT_RAR_COLOR[ft.rarity] or C(180,175,195)
    local rarOrder = (FRUIT_RAR_ORDER[ft.rarity] or 5) * 100 + idx
    local row = NEW("Frame",{
        Size=UDim2.new(1,-6,0,26),BackgroundColor3=BG3,
        Name=ft.name,BorderSizePixel=0,LayoutOrder=rarOrder
    },fruitList)
    CORNER(4,row)

    NEW("TextLabel",{
        Text=ft.rarity,Size=UDim2.new(0,80,1,0),Position=UDim2.new(0,6,0,0),
        BackgroundTransparency=1,TextColor3=rarColor,
        Font=Enum.Font.GothamBold,TextSize=9,TextXAlignment=Enum.TextXAlignment.Left
    },row)
    local nameLabel = NEW("TextLabel",{
        Text=ft.name,Size=UDim2.new(1,-108,1,0),Position=UDim2.new(0,84,0,0),
        BackgroundTransparency=1,TextColor3=TEXT2,
        Font=Enum.Font.Gotham,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
    },row)
    local checkLbl = NEW("TextLabel",{
        Text="",Size=UDim2.new(0,20,1,0),Position=UDim2.new(1,-22,0,0),
        BackgroundTransparency=1,TextColor3=GOLD2,
        Font=Enum.Font.GothamBold,TextSize=13,TextXAlignment=Enum.TextXAlignment.Center
    },row)
    local rowBtn = NEW("TextButton",{
        Size=UDim2.new(1,0,1,0),BackgroundTransparency=1,
        Text="",AutoButtonColor=false
    },row)

    rowBtn.MouseEnter:Connect(function() TWEEN(row,0.1,{BackgroundColor3=BG4}) end)
    rowBtn.MouseLeave:Connect(function()
        TWEEN(row,0.1,{BackgroundColor3=(selectedFruitName==ft.name) and C(25,22,48) or BG3})
    end)
    rowBtn.MouseButton1Click:Connect(function()
        -- deselect current
        if selectedFruitName and fruitRows[selectedFruitName] then
            local prev = fruitRows[selectedFruitName]
            prev.check.Text = ""
            TWEEN(prev.name,0.1,{TextColor3=TEXT2})
            prev.name.Font = Enum.Font.Gotham
            TWEEN(prev.row,0.1,{BackgroundColor3=BG3})
        end
        if selectedFruitName == ft.name then
            -- click lại → deselect
            selectedFruitName = nil
            TogglesData["Config_FruitSelect"].Value = ""
            fruitCountBadge.Text = "None selected"
            fruitCountBadge.TextColor3 = TEXT3
        else
            selectedFruitName = ft.name
            TogglesData["Config_FruitSelect"].Value = ft.name
            checkLbl.Text = "✓"
            TWEEN(nameLabel,0.1,{TextColor3=GOLD2})
            nameLabel.Font = Enum.Font.GothamBold
            TWEEN(row,0.1,{BackgroundColor3=C(25,22,48)})
            fruitCountBadge.Text = ft.name
            fruitCountBadge.TextColor3 = rarColor
        end
    end)

    fruitRows[ft.name] = {row=row, name=nameLabel, check=checkLbl}
end

-- search filter
fruitSearch:GetPropertyChangedSignal("Text"):Connect(function()
    local ft = fruitSearch.Text:lower()
    for name, refs in pairs(fruitRows) do
        refs.row.Visible = ft == "" or name:lower():find(ft, 1, true) ~= nil
    end
end)

-- Tăng card height để chứa inline list
-- fruitCard height set via fruitCardH = 392 above

-- =====================================================================
-- ██████  STATS PAGE
-- =====================================================================
PageLayout(StatsPage, 14, 8)

local AutoStatsData = {}

local function CreateStatRow(statName, layoutOrder)
    local row = MakeCard(StatsPage, 52, layoutOrder)

    -- stat name
    NEW("TextLabel",{
        Text=statName, Size=UDim2.new(0.52,0,1,0), Position=UDim2.new(0,14,0,0),
        BackgroundTransparency=1, TextColor3=TEXT1,
        Font=Enum.Font.GothamBold, TextSize=14, TextXAlignment=Enum.TextXAlignment.Left
    }, row)

    -- auto add button
    local addBtn=NEW("TextButton",{
        Size=UDim2.new(0,100,0,26), Position=UDim2.new(1,-218,0.5,-13),
        BackgroundColor3=BG5, Text="Auto Add",
        TextColor3=GOLD2, Font=Enum.Font.GothamBold, TextSize=12,
        AutoButtonColor=false
    }, row)
    CORNER(6, addBtn)
    local btnStroke=STROKE(GOLD3,1,0,addBtn)

    -- max cap input
    local capBox=NEW("TextBox",{
        Size=UDim2.new(0,100,0,26), Position=UDim2.new(1,-108,0.5,-13),
        BackgroundColor3=BG5, Text="", PlaceholderText="Max Cap...",
        TextColor3=GOLD2, Font=Enum.Font.GothamSemibold, TextSize=12
    }, row)
    CORNER(6, capBox)
    local boxStroke=STROKE(GOLD3,1,0,capBox)

    capBox.Focused:Connect(function() TWEEN(boxStroke,0.2,{Color=GOLD2}) end)
    capBox.FocusLost:Connect(function()
        TWEEN(boxStroke,0.2,{Color=GOLD3})
        local v=tonumber(capBox.Text)
        if v then AutoStatsData[statName].Cap=v else AutoStatsData[statName].Cap=0; capBox.Text="" end
    end)

    AutoStatsData[statName]={Active=false,Cap=0,Btn=addBtn,Strk=btnStroke,Box=capBox}
    addBtn.MouseButton1Click:Connect(function()
        local d=AutoStatsData[statName]; d.Active=not d.Active
        TWEEN(addBtn,0.2,{BackgroundColor3=d.Active and GOLDD or BG5})
        TWEEN(btnStroke,0.2,{Color=d.Active and GOLD2 or GOLD3})
        addBtn.TextColor3=d.Active and C(10,8,2) or GOLD2
        addBtn.Text=d.Active and "● Adding..." or "Auto Add"
    end)
end

local StatList={"Strength","Stamina","Defense","Gun Mastery","Sword Mastery","Devil Fruit","Fighting Style Mastery"}
for idx,sName in ipairs(StatList) do CreateStatRow(sName, idx) end

pcall(function()
    local L=require("Stats/addStats")
    if L and L.Start then L.Start(AutoStatsData) end
end)

-- =====================================================================
-- ██████  CONFIG PAGE
-- =====================================================================
PageLayout(ConfigPage, 14, 10)

-- Config header card
local cfgHeaderCard = MakeCard(ConfigPage, 42, 0)
cfgHeaderCard.BackgroundColor3 = C(16,18,42)
NEW("TextLabel",{
    Text="⚙  CONFIG MANAGER",
    Size=UDim2.new(0.6,0,1,0), Position=UDim2.new(0,14,0,0),
    BackgroundTransparency=1, TextColor3=GOLD2,
    Font=Enum.Font.GothamBold, TextSize=14, TextXAlignment=Enum.TextXAlignment.Left
}, cfgHeaderCard)
NEW("TextLabel",{
    Text="Save & load your session settings",
    Size=UDim2.new(0.55,0,1,0), Position=UDim2.new(0.45,0,0,0),
    BackgroundTransparency=1, TextColor3=TEXT3,
    Font=Enum.Font.Gotham, TextSize=11, TextXAlignment=Enum.TextXAlignment.Right
}, cfgHeaderCard)

local cfgContainer = NEW("Frame",{
    Size=UDim2.new(1,-24,0,390), BackgroundTransparency=1, LayoutOrder=1
}, ConfigPage)
-- Horizontal layout for the two panels
NEW("UIListLayout",{
    FillDirection=Enum.FillDirection.Horizontal,
    HorizontalAlignment=Enum.HorizontalAlignment.Left,
    VerticalAlignment=Enum.VerticalAlignment.Top,
    Padding=UDim.new(0,10),
    SortOrder=Enum.SortOrder.LayoutOrder
}, cfgContainer)

-- ── LEFT PANEL: File list ──
local LeftPanel = NEW("Frame",{
    Size=UDim2.new(0,238,1,0),
    BackgroundColor3=BG3, LayoutOrder=0
}, cfgContainer)
CORNER(9, LeftPanel)
STROKE(GOLD, 1, 0.65, LeftPanel)

local lpHead = NEW("Frame",{Size=UDim2.new(1,0,0,34),BackgroundColor3=C(15,17,40)}, LeftPanel)
CORNER(9, lpHead)
NEW("Frame",{Size=UDim2.new(1,0,0,15),Position=UDim2.new(0,0,1,-15),BackgroundColor3=C(15,17,40),BorderSizePixel=0},lpHead)
NEW("Frame",{Size=UDim2.new(1,0,0,2),Position=UDim2.new(0,0,0,0),BackgroundColor3=GOLD,BorderSizePixel=0,BackgroundTransparency=0.5},lpHead)
NEW("TextLabel",{
    Text="⊟  SAVED CONFIGS",
    Size=UDim2.new(1,-10,1,0),Position=UDim2.new(0,14,0,0),
    BackgroundTransparency=1,TextColor3=GOLD2,Font=Enum.Font.GothamBold,
    TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
},lpHead)

local SearchBoxConfig = NEW("TextBox",{
    Size=UDim2.new(1,-16,0,32), Position=UDim2.new(0,8,0,40),
    BackgroundColor3=BG5, PlaceholderText="  Search configs...",
    Text="", TextColor3=GOLD2, Font=Enum.Font.GothamSemibold, TextSize=13
}, LeftPanel)
CORNER(7, SearchBoxConfig)
local SearchStrokeConfig = STROKE(C(50,40,15),1,0,SearchBoxConfig)
SearchBoxConfig.Focused:Connect(function() TWEEN(SearchStrokeConfig,0.2,{Color=GOLD2}) end)
SearchBoxConfig.FocusLost:Connect(function() TWEEN(SearchStrokeConfig,0.2,{Color=C(50,40,15)}) end)

local ConfigList = NEW("ScrollingFrame",{
    Size=UDim2.new(1,-16,1,-84), Position=UDim2.new(0,8,0,80),
    BackgroundColor3=BG0, ScrollBarThickness=3, ScrollBarImageColor3=GOLD,
    BorderSizePixel=0
}, LeftPanel)
CORNER(7, ConfigList)
STROKE(C(30,25,10),1,0,ConfigList)
local ListLayout = NEW("UIListLayout",{SortOrder=Enum.SortOrder.LayoutOrder,Padding=UDim.new(0,5),HorizontalAlignment=Enum.HorizontalAlignment.Center},ConfigList)
NEW("UIPadding",{PaddingTop=UDim.new(0,6),PaddingBottom=UDim.new(0,6)},ConfigList)

-- ── RIGHT PANEL: Actions ──
local RightPanel = NEW("Frame",{
    Size=UDim2.new(1,-248,1,0),
    BackgroundColor3=BG3, LayoutOrder=1
}, cfgContainer)
CORNER(9, RightPanel)
STROKE(GOLD, 1, 0.65, RightPanel)

local rpHead = NEW("Frame",{Size=UDim2.new(1,0,0,34),BackgroundColor3=C(15,17,40)},RightPanel)
CORNER(9,rpHead)
NEW("Frame",{Size=UDim2.new(1,0,0,15),Position=UDim2.new(0,0,1,-15),BackgroundColor3=C(15,17,40),BorderSizePixel=0},rpHead)
NEW("Frame",{Size=UDim2.new(1,0,0,2),Position=UDim2.new(0,0,0,0),BackgroundColor3=GOLD,BorderSizePixel=0,BackgroundTransparency=0.5},rpHead)
NEW("TextLabel",{
    Text="▷  ACTIONS",
    Size=UDim2.new(1,-10,1,0),Position=UDim2.new(0,14,0,0),
    BackgroundTransparency=1,TextColor3=GOLD2,Font=Enum.Font.GothamBold,
    TextSize=12,TextXAlignment=Enum.TextXAlignment.Left
},rpHead)

local RightLayout = NEW("UIListLayout",{
    SortOrder=Enum.SortOrder.LayoutOrder,Padding=UDim.new(0,7),
    HorizontalAlignment=Enum.HorizontalAlignment.Center
},RightPanel)
NEW("UIPadding",{PaddingTop=UDim.new(0,0),PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)},RightPanel)

local ConfigNameBox = NEW("TextBox",{
    Size=UDim2.new(1,0,0,36), BackgroundColor3=BG5,
    PlaceholderText="  Config name...", Text="",
    TextColor3=GOLD2, Font=Enum.Font.GothamSemibold, TextSize=13
}, RightPanel)
CORNER(7, ConfigNameBox)
local NameStroke = STROKE(GOLD3,1,0,ConfigNameBox)
ConfigNameBox.Focused:Connect(function() TWEEN(NameStroke,0.2,{Color=GOLD2}) end)
ConfigNameBox.FocusLost:Connect(function() TWEEN(NameStroke,0.2,{Color=GOLD3}) end)

NEW("Frame",{Size=UDim2.new(1,0,0,1),BackgroundColor3=C(30,28,55),BorderSizePixel=0},RightPanel)

local function CreateActionBtn(label, bgCol, hoverCol, strokeCol)
    local btn = NEW("TextButton",{
        Size=UDim2.new(1,0,0,36), BackgroundColor3=bgCol,
        Text=label, TextColor3=TEXT1,
        Font=Enum.Font.GothamBold, TextSize=13, AutoButtonColor=false
    }, RightPanel)
    CORNER(7, btn)
    STROKE(strokeCol, 1, 0.05, btn)
    btn.MouseEnter:Connect(function() TWEEN(btn,0.15,{BackgroundColor3=hoverCol}) end)
    btn.MouseLeave:Connect(function() TWEEN(btn,0.15,{BackgroundColor3=bgCol}) end)
    return btn
end

local CreateBtn      = CreateActionBtn("📄  Create Config",  C(12,42,12),  C(18,62,18),  C(40,170,40))
local SaveBtn        = CreateActionBtn("💾  Save Config",     C(14,16,42),  C(20,24,62),  C(75,75,155))
local LoadBtn        = CreateActionBtn("📂  Load Config",     C(12,24,54),  C(16,34,72),  C(58,100,190))
local RefreshBtn     = CreateActionBtn("🔄  Refresh List",   C(10,32,38),  C(14,44,54),  C(48,122,135))
local SetAutoLoadBtn = CreateActionBtn("⭐  Set Auto Load",  C(42,32,8),   C(58,44,10),  C(190,140,30))
local DeleteBtn      = CreateActionBtn("🗑️  Delete Config",  C(58,12,12),  C(80,18,18),  C(210,55,55))

pcall(function()
    local CL=require("Config/ConfigManager")
    if CL and CL.Init then
        CL.Init({
            ConfigNameBox=ConfigNameBox,ConfigList=ConfigList,
            CreateBtn=CreateBtn,SaveBtn=SaveBtn,LoadBtn=LoadBtn,
            RefreshBtn=RefreshBtn,SetAutoLoadBtn=SetAutoLoadBtn,
            DeleteBtn=DeleteBtn,SearchBox=SearchBoxConfig
        }, AutoStatsData, TogglesData)
    end
end)

-- =====================================================================
-- START AUTO FRUIT MANAGER (module already required at top)
-- =====================================================================
if AutoFruitManagerModule and AutoFruitManagerModule.Start then
    AutoFruitManagerModule.Start(TogglesData)
end

-- =====================================================================
-- MINIMIZE ANIMATION
-- =====================================================================
local function ToggleHub(isVisible)
    if not isVisible then
        TWEEN_BACK(MainFrame,0,{}) -- cancel active tweens
        TweenService:Create(MainFrame,TweenInfo.new(0.4,Enum.EasingStyle.Quart,Enum.EasingDirection.In),{Position=MiniLogo.Position,Size=UDim2.new(0,0,0,0),GroupTransparency=1}):Play()
        task.wait(0.4); MainFrame.Visible=false; MiniLogo.Visible=true
    else
        MiniLogo.Visible=false; MainFrame.Visible=true
        MainFrame.Position=MiniLogo.Position; MainFrame.Size=UDim2.new(0,0,0,0); MainFrame.GroupTransparency=1
        TweenService:Create(MainFrame,TweenInfo.new(0.55,Enum.EasingStyle.Back,Enum.EasingDirection.Out),{Position=UDim2.new(0.5,-360,0.5,-230),Size=UDim2.new(0,720,0,460),GroupTransparency=0}):Play()
    end
end

MinBtn.MouseButton1Click:Connect(function() ToggleHub(false) end)
MiniLogo.MouseButton1Click:Connect(function() ToggleHub(true) end)

CloseBtn.MouseButton1Click:Connect(function()
    d = false
    getgenv().ZiliHub_Loaded = false

    local mStroke = MainFrame:FindFirstChildOfClass("UIStroke")

    -- ── PHASE 1: RED FLASH (0.1s) ──
    TWEEN(CloseBtn, 0.06, {TextColor3 = C(255,40,40)})
    if mStroke then
        TWEEN(mStroke, 0.06, {Color=C(255,40,40), Thickness=3})
    end
    -- Red overlay flash on entire panel
    local redOverlay = NEW("Frame",{
        Size=UDim2.new(1,0,1,0), BackgroundColor3=C(200,20,20),
        BackgroundTransparency=0.85, ZIndex=100, BorderSizePixel=0
    }, MainFrame)
    CORNER(10, redOverlay)
    task.wait(0.06)
    TWEEN(redOverlay, 0.08, {BackgroundTransparency=1})

    -- ── PHASE 2: GLITCH (0.18s) ──
    local origPos = MainFrame.Position
    local ox, oy = origPos.X.Offset, origPos.Y.Offset
    local glitchSeq = {-8, 6, -10, 9, -4, 7, -3, 2, 0}
    for _, dx in ipairs(glitchSeq) do
        -- random vertical micro-shift for glitch feel
        local dy = math.random(-2, 2)
        TweenService:Create(MainFrame, TweenInfo.new(0.02, Enum.EasingStyle.Linear), {
            Position = UDim2.new(origPos.X.Scale, ox+dx, origPos.Y.Scale, oy+dy)
        }):Play()
        task.wait(0.02)
    end

    -- ── PHASE 3: SCANLINE SWEEP (0.12s) ──
    local scanLine = NEW("Frame",{
        Size=UDim2.new(1,0,0,3), Position=UDim2.new(0,0,0,0),
        BackgroundColor3=C(255,80,80), BackgroundTransparency=0.2,
        ZIndex=101, BorderSizePixel=0
    }, MainFrame)
    -- sweep from top to bottom
    TweenService:Create(scanLine, TweenInfo.new(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
        Position = UDim2.new(0,0,1,-3),
        BackgroundTransparency=0.7
    }):Play()
    task.wait(0.12)

    -- ── PHASE 4: SPAWN MULTI-RING PARTICLES ──
    local cx = MainFrame.AbsolutePosition.X + MainFrame.AbsoluteSize.X/2
    local cy = MainFrame.AbsolutePosition.Y + MainFrame.AbsoluteSize.Y/2
    local allParticles = {}

    -- Ring 1: 8 large GOLD fragments (corners + edges)
    local ring1dirs = {{-1,-1},{0,-1},{1,-1},{-1,0},{1,0},{-1,1},{0,1},{1,1}}
    for _, dir in ipairs(ring1dirs) do
        local sz = math.random(12,20)
        local frag = NEW("Frame",{
            Size=UDim2.new(0,sz,0,sz),
            Position=UDim2.new(0, cx-sz/2+dir[1]*12, 0, cy-sz/2+dir[2]*12),
            BackgroundColor3=GOLD2, BorderSizePixel=0, ZIndex=102
        }, ScreenGui)
        CORNER(math.random(2,5), frag)
        table.insert(allParticles, {
            frag=frag, dir=dir,
            dist=math.random(200,300), speed=0.55, color=GOLD2
        })
    end

    -- Ring 2: 12 medium RED sparks at diagonal angles
    for i=1,12 do
        local angle = (i/12) * math.pi * 2
        local dir = {math.cos(angle), math.sin(angle)}
        local sz = math.random(5,9)
        local frag = NEW("Frame",{
            Size=UDim2.new(0,sz,0,sz),
            Position=UDim2.new(0, cx-sz/2+dir[1]*8, 0, cy-sz/2+dir[2]*8),
            BackgroundColor3=C(220,60,60), BorderSizePixel=0, ZIndex=103
        }, ScreenGui)
        CORNER(2, frag)
        table.insert(allParticles, {
            frag=frag, dir=dir,
            dist=math.random(150,260), speed=0.4, color=C(220,60,60)
        })
    end

    -- Ring 3: 16 tiny WHITE sparks, random spread
    for i=1,16 do
        local angle = (i/16) * math.pi * 2 + math.random()*0.3
        local dir = {math.cos(angle), math.sin(angle)}
        local sz = math.random(3,5)
        local frag = NEW("Frame",{
            Size=UDim2.new(0,sz,0,sz),
            Position=UDim2.new(0, cx-sz/2, 0, cy-sz/2),
            BackgroundColor3=C(255,240,200), BorderSizePixel=0, ZIndex=104
        }, ScreenGui)
        CORNER(2, frag)
        table.insert(allParticles, {
            frag=frag, dir=dir,
            dist=math.random(80,180), speed=0.3, color=C(255,240,200)
        })
    end

    -- Shockwave ring (expanding circle outline)
    local shockwave = NEW("Frame",{
        Size=UDim2.new(0,10,0,10),
        Position=UDim2.new(0, cx-5, 0, cy-5),
        BackgroundTransparency=1, ZIndex=105, BorderSizePixel=0
    }, ScreenGui)
    CORNER(5, shockwave)
    local shockStroke = STROKE(GOLD, 2.5, 0, shockwave)

    -- Inner glow burst
    local glowBurst = NEW("Frame",{
        Size=UDim2.new(0,20,0,20),
        Position=UDim2.new(0, cx-10, 0, cy-10),
        BackgroundColor3=C(255,220,120), BackgroundTransparency=0.3,
        ZIndex=102, BorderSizePixel=0
    }, ScreenGui)
    CORNER(10, glowBurst)

    -- ── PHASE 5: ALL SIMULTANEOUS EXPLOSIONS ──

    -- Panel implode to center
    TweenService:Create(MainFrame, TweenInfo.new(0.4, Enum.EasingStyle.Back, Enum.EasingDirection.In), {
        Position = UDim2.new(origPos.X.Scale, ox + MainFrame.AbsoluteSize.X/2 - 10,
                             origPos.Y.Scale, oy + MainFrame.AbsoluteSize.Y/2 - 10),
        Size = UDim2.new(0,20,0,20),
        GroupTransparency = 1
    }):Play()

    -- Shockwave expand
    TweenService:Create(shockwave, TweenInfo.new(0.55, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
        Size=UDim2.new(0,500,0,500),
        Position=UDim2.new(0, cx-250, 0, cy-250),
    }):Play()
    TweenService:Create(shockStroke, TweenInfo.new(0.55, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
        Transparency=1, Thickness=0.5
    }):Play()

    -- Glow burst expand + fade
    TweenService:Create(glowBurst, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
        Size=UDim2.new(0,120,0,120),
        Position=UDim2.new(0, cx-60, 0, cy-60),
        BackgroundTransparency=1
    }):Play()

    -- All particles fly out
    for _, p in ipairs(allParticles) do
        local tx = cx + p.dir[1] * p.dist
        local ty = cy + p.dir[2] * p.dist
        -- stagger by ring (speed difference)
        TweenService:Create(p.frag, TweenInfo.new(p.speed, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
            Position = UDim2.new(0, tx, 0, ty),
            Size = UDim2.new(0,2,0,2),
            BackgroundTransparency = 1
        }):Play()
    end

    task.wait(0.58)

    -- ── PHASE 6: CLEANUP ──
    for _, p in ipairs(allParticles) do
        if p.frag and p.frag.Parent then p.frag:Destroy() end
    end
    if shockwave and shockwave.Parent then shockwave:Destroy() end
    if glowBurst and glowBurst.Parent then glowBurst:Destroy() end
    ScreenGui:Destroy()
end)

-- Drag
local d,dS,sP
TopBar.InputBegan:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then d=true;dS=i.Position;sP=MainFrame.Position end end)
UIS.InputChanged:Connect(function(i) if d and i.UserInputType==Enum.UserInputType.MouseMovement then local delta=i.Position-dS;MainFrame.Position=UDim2.new(sP.X.Scale,sP.X.Offset+delta.X,sP.Y.Scale,sP.Y.Offset+delta.Y) end end)
UIS.InputEnded:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then d=false end end)

-- =====================================================================
-- 🛡️ ZILI HUB COMPATIBILITY SCANNER
-- =====================================================================
local function RunExecutorDiagnostics()
    local env=getgenv and getgenv() or _G
    local name="Unknown Engine"
    if type(identifyexecutor)=="function" then pcall(function() name=identifyexecutor() end) end

    local critical={"hookmetamethod","hookfunction","getrawmetatable","setreadonly","getnamecallmethod","newcclosure"}
    local missing={}
    for _,v in ipairs(critical) do if type(env[v])~="function" then table.insert(missing,v) end end
    if #missing>0 then
        game.Players.LocalPlayer:Kick(string.format("\n[ZILI SECURITY: FATAL ERROR]\n\nExecutor [%s] missing:\n- %s\n\nPlease upgrade your executor.",name,table.concat(missing,"\n- ")))
        task.wait(9e9); return
    end

    local deps={"hookmetamethod","hookfunction","getrawmetatable","setreadonly","getnamecallmethod","newcclosure","cloneref","fireproximityprompt","getconnections","readfile","writefile","isfile","makefolder","isfolder","getgenv","identifyexecutor","setclipboard","request"}
    local sup=0
    for _,v in ipairs(deps) do
        if type(env[v])=="function" or (v=="request" and (type(env.request)=="function" or type(env.http)=="table")) then sup=sup+1 end
    end
    local pct=math.floor((sup/#deps)*100)

    local TS=game:GetService("TweenService")
    local sg=NEW("ScreenGui",{Name="ZiliDiagnostic"},game:GetService("CoreGui") or LocalPlayer:WaitForChild("PlayerGui"))
    local frame=NEW("Frame",{Size=UDim2.new(0,268,0,104),Position=UDim2.new(1,20,1,-228),BackgroundColor3=BG1,BorderSizePixel=0},sg)
    CORNER(8,frame)
    STROKE(GOLD,1.5,0,frame)

    NEW("TextLabel",{Text="⚡  ZILI HUB COMPATIBILITY",Size=UDim2.new(1,-20,0,24),Position=UDim2.new(0,12,0,6),BackgroundTransparency=1,TextColor3=GOLD2,Font=Enum.Font.GothamBold,TextSize=12,TextXAlignment=Enum.TextXAlignment.Left},frame)
    NEW("TextLabel",{Text="Executor: "..name,Size=UDim2.new(1,-20,0,18),Position=UDim2.new(0,12,0,28),BackgroundTransparency=1,TextColor3=TEXT2,Font=Enum.Font.GothamMedium,TextSize=11,TextXAlignment=Enum.TextXAlignment.Left},frame)

    local barBg=NEW("Frame",{Size=UDim2.new(1,-24,0,5),Position=UDim2.new(0,12,0,56),BackgroundColor3=C(20,18,42)},frame); CORNER(3,barBg)
    local barFill=NEW("Frame",{Size=UDim2.new(0,0,1,0),BackgroundColor3=GOLD},barBg); CORNER(3,barFill)
    NEW("TextLabel",{Text="Support Score: "..pct.."%",Size=UDim2.new(1,-20,0,18),Position=UDim2.new(0,12,0,68),BackgroundTransparency=1,TextColor3=TEXT2,Font=Enum.Font.GothamSemibold,TextSize=11,TextXAlignment=Enum.TextXAlignment.Left},frame)

    TS:Create(frame,TweenInfo.new(0.55,Enum.EasingStyle.Back,Enum.EasingDirection.Out),{Position=UDim2.new(1,-288,1,-228)}):Play()
    task.wait(0.55)
    TS:Create(barFill,TweenInfo.new(1.2,Enum.EasingStyle.Quart,Enum.EasingDirection.Out),{Size=UDim2.new(pct/100,0,1,0)}):Play()
    task.delay(7,function()
        TS:Create(frame,TweenInfo.new(0.5,Enum.EasingStyle.Back,Enum.EasingDirection.In),{Position=UDim2.new(1,20,1,-228)}):Play()
        task.wait(0.5); sg:Destroy()
    end)
end

task.spawn(RunExecutorDiagnostics)

`
};

// encode đơn giản
function encode(str, key) {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    let k = key.charCodeAt(i % key.length);
    let c = str.charCodeAt(i);
    result += String.fromCharCode(c ^ k);
  }
  return result;
}

// API chính
app.get("/scripts/:id", (req, res) => {
  const id = req.params.id;

  if (!scripts[id]) return res.send("");

  // chặn người mở bằng trình duyệt
  const ua = req.headers["user-agent"];
  if (!ua || !ua.includes("Roblox")) {
    return res.send("access denied");
  }

  const encoded = encode(scripts[id], "my_secret");

  const loader = `
  local function d(s,k)
    local r={}
    for i=1,#s do
      local c=s:byte(i)
      local k2=k:byte((i%#k)+1)
      r[i]=string.char(bit32.bxor(c,k2))
    end
    return table.concat(r)
  end
  loadstring(d(${JSON.stringify(encoded)}, "my_secret"))()
  `;

  res.send(loader);
});

app.listen(PORT, () => {
  console.log("Server running...");
});
