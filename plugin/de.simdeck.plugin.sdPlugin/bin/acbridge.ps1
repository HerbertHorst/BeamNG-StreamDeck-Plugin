# SimDeck – bridge to Assetto Corsa
# Reads AC's shared memory (acpmf_physics / graphics / static) and prints the
# state as JSON lines on stdout. Accepts commands like "key ctrl+t" on stdin and
# presses the keys via SendInput (scan codes, so it also works in DirectInput games).
#
# Offsets follow the AC shared memory layout (Pack = 4), e.g. as used by sim_info.py
# and CrewChief's ACSData.cs.

$ErrorActionPreference = 'Stop'

$code = @'
using System;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Threading;
using System.Text;
using System.Globalization;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class SimDeckBridge
{
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public INPUTUNION u; }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("user32.dll")]
    static extern uint MapVirtualKey(uint uCode, uint uMapType);

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_EXTENDEDKEY = 0x1;
    const uint KEYEVENTF_KEYUP = 0x2;
    const uint KEYEVENTF_SCANCODE = 0x8;

    static readonly object OutLock = new object();
    static void Out(string s) { lock (OutLock) { Console.Out.WriteLine(s); Console.Out.Flush(); } }

    // ---------------------------------------------------------------- keys
    static int Vk(string n)
    {
        n = n.Trim();
        if (n.Length == 1)
        {
            char c = n[0];
            if (c >= 'a' && c <= 'z') return 0x41 + (c - 'a');
            if (c >= '0' && c <= '9') return 0x30 + (c - '0');
            switch (c)
            {
                case '[': return 0xDB; case ']': return 0xDD; case ';': return 0xBA; case '\'': return 0xDE;
                case ',': return 0xBC; case '.': return 0xBE; case '/': return 0xBF; case '-': return 0xBD;
                case '=': return 0xBB; case '\\': return 0xDC; case '`': return 0xC0;
            }
        }
        if (n.StartsWith("f") && n.Length <= 3)
        {
            int f;
            if (int.TryParse(n.Substring(1), out f) && f >= 1 && f <= 24) return 0x70 + f - 1;
        }
        if (n.StartsWith("num") && n.Length == 4 && char.IsDigit(n[3])) return 0x60 + (n[3] - '0');
        switch (n)
        {
            case "ctrl": case "control": case "strg": return 0xA2;
            case "rctrl": return 0xA3;
            case "shift": return 0xA0;
            case "rshift": return 0xA1;
            case "alt": return 0xA4;
            case "altgr": case "ralt": return 0xA5;
            case "space": case "leertaste": return 0x20;
            case "enter": case "return": return 0x0D;
            case "tab": return 0x09;
            case "esc": case "escape": return 0x1B;
            case "backspace": return 0x08;
            case "up": case "hoch": return 0x26;
            case "down": case "runter": return 0x28;
            case "left": case "links": return 0x25;
            case "right": case "rechts": return 0x27;
            case "insert": case "ins": case "einfg": return 0x2D;
            case "delete": case "del": case "entf": return 0x2E;
            case "home": case "pos1": return 0x24;
            case "end": case "ende": return 0x23;
            case "pageup": case "pgup": return 0x21;
            case "pagedown": case "pgdn": return 0x22;
            case "numplus": return 0x6B;
            case "numminus": return 0x6D;
            case "nummul": return 0x6A;
            case "numdiv": return 0x6F;
            case "plus": return 0xBB;
            case "minus": return 0xBD;
        }
        return -1;
    }

    static bool IsExtended(int vk)
    {
        return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0xA3 || vk == 0xA5 || vk == 0x6F;
    }

    static void KeyEvent(int vk, bool up)
    {
        INPUT[] inp = new INPUT[1];
        inp[0].type = INPUT_KEYBOARD;
        KEYBDINPUT ki = new KEYBDINPUT();
        ki.wVk = 0;
        ki.wScan = (ushort)MapVirtualKey((uint)vk, 0);
        ki.dwFlags = KEYEVENTF_SCANCODE | (up ? KEYEVENTF_KEYUP : 0) | (IsExtended(vk) ? KEYEVENTF_EXTENDEDKEY : 0);
        inp[0].u.ki = ki;
        SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
    }

    static readonly object KeyLock = new object();
    public static void Press(string combo)
    {
        string[] parts = combo.ToLowerInvariant().Split('+');
        List<int> keys = new List<int>();
        foreach (string p in parts)
        {
            if (p.Trim().Length == 0) continue;
            int vk = Vk(p);
            if (vk < 0) { Out("unknown key: " + p); return; }
            keys.Add(vk);
        }
        if (keys.Count == 0) return;
        lock (KeyLock)
        {
            for (int i = 0; i < keys.Count; i++) { KeyEvent(keys[i], false); Thread.Sleep(20); }
            Thread.Sleep(60);
            for (int i = keys.Count - 1; i >= 0; i--) { KeyEvent(keys[i], true); Thread.Sleep(10); }
        }
    }

    // ---------------------------------------------------------------- shared memory
    static MemoryMappedFile phys, gfx, stat;
    static MemoryMappedViewAccessor pa, ga, sa;

    static void Close()
    {
        try { if (pa != null) pa.Dispose(); } catch { }
        try { if (ga != null) ga.Dispose(); } catch { }
        try { if (sa != null) sa.Dispose(); } catch { }
        try { if (phys != null) phys.Dispose(); } catch { }
        try { if (gfx != null) gfx.Dispose(); } catch { }
        try { if (stat != null) stat.Dispose(); } catch { }
        pa = ga = sa = null; phys = gfx = stat = null;
    }

    static bool Open()
    {
        try
        {
            phys = MemoryMappedFile.OpenExisting("Local\\acpmf_physics", MemoryMappedFileRights.Read);
            gfx = MemoryMappedFile.OpenExisting("Local\\acpmf_graphics", MemoryMappedFileRights.Read);
            stat = MemoryMappedFile.OpenExisting("Local\\acpmf_static", MemoryMappedFileRights.Read);
            pa = phys.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            ga = gfx.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            sa = stat.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            return true;
        }
        catch { Close(); return false; }
    }

    static float F(MemoryMappedViewAccessor a, long off) { return a.Capacity >= off + 4 ? a.ReadSingle(off) : 0f; }
    static int I(MemoryMappedViewAccessor a, long off) { return a.Capacity >= off + 4 ? a.ReadInt32(off) : 0; }
    static string W(MemoryMappedViewAccessor a, long off, int chars)
    {
        if (a.Capacity < off + chars * 2) return "";
        byte[] b = new byte[chars * 2];
        a.ReadArray(off, b, 0, b.Length);
        string s = Encoding.Unicode.GetString(b);
        int z = s.IndexOf('\0');
        return z >= 0 ? s.Substring(0, z) : s;
    }
    static string Num(float v)
    {
        if (float.IsNaN(v) || float.IsInfinity(v)) return "0";
        return v.ToString("0.####", CultureInfo.InvariantCulture);
    }
    static string Js(string s)
    {
        StringBuilder sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') { sb.Append('\\'); sb.Append(c); }
            else if (c < 32) sb.Append(' ');
            else sb.Append(c);
        }
        return sb.ToString();
    }

    static string ReadState()
    {
        int status = I(ga, 4);
        bool running = status == 2 || status == 3;
        StringBuilder sb = new StringBuilder();
        sb.Append("{\"game\":\"ac\",\"running\":").Append(running ? "true" : "false");
        sb.Append(",\"status\":").Append(status);
        sb.Append(",\"car\":\"").Append(Js(W(sa, 68, 33))).Append("\"");
        sb.Append(",\"tc\":").Append(Num(F(pa, 204)));
        sb.Append(",\"abs\":").Append(Num(F(pa, 252)));
        sb.Append(",\"gear\":").Append(I(pa, 16));
        sb.Append(",\"speed\":").Append(Num(F(pa, 28)));
        sb.Append(",\"fuel\":").Append(Num(F(pa, 12)));
        sb.Append(",\"maxFuel\":").Append(Num(F(sa, 416)));
        sb.Append(",\"pit\":").Append(I(pa, 248));
        sb.Append(",\"kers\":").Append(Num(F(pa, 256)));
        sb.Append(",\"kersIn\":").Append(Num(F(pa, 260)));
        sb.Append(",\"auto\":").Append(I(pa, 264));
        sb.Append(",\"eb\":").Append(I(pa, 316));
        sb.Append(",\"ersRec\":").Append(I(pa, 320));
        sb.Append(",\"ersPow\":").Append(I(pa, 324));
        sb.Append(",\"drsA\":").Append(I(pa, 340));
        sb.Append(",\"drsE\":").Append(I(pa, 344));
        sb.Append(",\"bias\":").Append(Num(F(pa, 564)));
        sb.Append(",\"hasDRS\":").Append(I(sa, 496) != 0 ? 1 : 0);
        sb.Append(",\"hasERS\":").Append(I(sa, 500) != 0 ? 1 : 0);
        sb.Append(",\"hasKERS\":").Append(I(sa, 504) != 0 ? 1 : 0);
        sb.Append("}");
        return sb.ToString();
    }

    static void InputLoop()
    {
        string line;
        while ((line = Console.In.ReadLine()) != null)
        {
            line = line.Trim();
            if (line.StartsWith("key "))
            {
                string combo = line.Substring(4);
                ThreadPool.QueueUserWorkItem(delegate { try { Press(combo); } catch (Exception e) { Out("key error: " + e.Message); } });
            }
        }
        Environment.Exit(0); // plugin has exited (stdin closed)
    }

    public static void Run()
    {
        Thread t = new Thread(InputLoop);
        t.IsBackground = true;
        t.Start();

        int lastPacket = int.MinValue;
        DateTime lastChange = DateTime.UtcNow;
        DateTime lastTry = DateTime.MinValue;

        while (true)
        {
            try
            {
                if (pa == null)
                {
                    if ((DateTime.UtcNow - lastTry).TotalSeconds >= 2)
                    {
                        lastTry = DateTime.UtcNow;
                        if (Open()) { lastChange = DateTime.UtcNow; lastPacket = int.MinValue; }
                    }
                    if (pa == null) { Out("{\"game\":\"ac\",\"running\":false}"); Thread.Sleep(500); continue; }
                }

                int packet = I(pa, 0) ^ I(ga, 0);
                if (packet != lastPacket) { lastPacket = packet; lastChange = DateTime.UtcNow; }
                else if ((DateTime.UtcNow - lastChange).TotalSeconds > 3)
                {
                    // nothing changes any more: release our handles briefly so we notice when AC has quit
                    Close();
                    lastTry = DateTime.MinValue;
                    continue;
                }
                Out(ReadState());
            }
            catch (Exception e)
            {
                Out("read error: " + e.Message);
                Close();
            }
            Thread.Sleep(100);
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies System.Core
} catch {
    Add-Type -TypeDefinition $code -Language CSharp
}

[SimDeckBridge]::Run()
