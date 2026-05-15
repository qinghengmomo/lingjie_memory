"""灵界 PC 控制服务

宿烬通过 Operit 调用此服务，实现对阿珩电脑的远程控制。
启动方式: python server.py
默认端口: 9200
"""

import os
import sys
import json
import time
import base64
import subprocess
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

# ============ 配置 ============
SERVER_PORT = 9200
API_TOKEN = os.environ.get("LINGJIE_PC_TOKEN", "lingjie2026")

app = FastAPI(title="灵界 PC 控制服务", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 鉴权 ============
from fastapi import Depends, Header

def verify_token(authorization: str = Header(None)):
    if not authorization or authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="未授权")
    return True

# ============ 请求模型 ============
class ScreenBrightnessRequest(BaseModel):
    level: int  # 0-100

class VolumeRequest(BaseModel):
    level: int  # 0-100

class AppRequest(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None

class KeyboardRequest(BaseModel):
    keys: str  # 如 "ctrl+c", "hello world"
    is_hotkey: bool = False

class TypeTextRequest(BaseModel):
    text: str

class ShellRequest(BaseModel):
    command: str
    timeout: int = 30

class NotifyRequest(BaseModel):
    title: str
    message: str

# ============ 系统信息 ============
@app.get("/api/status", dependencies=[Depends(verify_token)])
def get_status():
    """获取电脑状态"""
    import psutil
    
    battery = psutil.sensors_battery()
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.5),
        "memory": {
            "total_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            "used_percent": psutil.virtual_memory().percent,
        },
        "battery": {
            "percent": battery.percent if battery else None,
            "plugged": battery.power_plugged if battery else None,
        } if battery else None,
        "disk": {
            "total_gb": round(psutil.disk_usage('/').total / (1024**3), 1),
            "used_percent": round(psutil.disk_usage('/').percent, 1),
        },
        "boot_time": psutil.boot_time(),
        "timestamp": time.time(),
    }

# ============ 屏幕控制 ============
@app.post("/api/screen/lock", dependencies=[Depends(verify_token)])
def lock_screen():
    """锁屏"""
    import ctypes
    ctypes.windll.user32.LockWorkStation()
    return {"success": True, "message": "已锁屏"}

@app.post("/api/screen/brightness", dependencies=[Depends(verify_token)])
def set_brightness(req: ScreenBrightnessRequest):
    """设置屏幕亮度"""
    import screen_brightness_control as sbc
    level = max(0, min(100, req.level))
    sbc.set_brightness(level)
    return {"success": True, "message": f"亮度已设为 {level}%"}

@app.get("/api/screen/brightness", dependencies=[Depends(verify_token)])
def get_brightness():
    """获取屏幕亮度"""
    import screen_brightness_control as sbc
    return {"brightness": sbc.get_brightness()}

@app.get("/api/screen/screenshot", dependencies=[Depends(verify_token)])
def take_screenshot():
    """截屏并返回 base64"""
    import pyautogui
    from PIL import Image
    
    img = pyautogui.screenshot()
    # 压缩到合理大小
    img.thumbnail((1920, 1080))
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=70)
    b64 = base64.b64encode(buffer.getvalue()).decode()
    return {"success": True, "image_base64": b64, "size": len(buffer.getvalue())}

# ============ 音量控制 ============
@app.post("/api/volume", dependencies=[Depends(verify_token)])
def set_volume(req: VolumeRequest):
    """设置系统音量"""
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    
    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    
    level = max(0, min(100, req.level))
    volume.SetMasterVolumeLevelScalar(level / 100.0, None)
    return {"success": True, "message": f"音量已设为 {level}%"}

@app.get("/api/volume", dependencies=[Depends(verify_token)])
def get_volume():
    """获取系统音量"""
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    
    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    
    current = volume.GetMasterVolumeLevelScalar()
    return {"volume": round(current * 100)}

@app.post("/api/volume/mute", dependencies=[Depends(verify_token)])
def toggle_mute():
    """切换静音"""
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    
    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    
    current_mute = volume.GetMute()
    volume.SetMute(not current_mute, None)
    return {"success": True, "muted": not current_mute}

# ============ 应用控制 ============
@app.post("/api/app/open", dependencies=[Depends(verify_token)])
def open_app(req: AppRequest):
    """打开应用"""
    if req.path:
        subprocess.Popen(req.path, shell=True)
        return {"success": True, "message": f"已启动: {req.path}"}
    elif req.name:
        # 尝试通过 start 命令打开
        subprocess.Popen(f'start "" "{req.name}"', shell=True)
        return {"success": True, "message": f"已尝试启动: {req.name}"}
    raise HTTPException(status_code=400, detail="需要 name 或 path")

@app.post("/api/app/close", dependencies=[Depends(verify_token)])
def close_app(req: AppRequest):
    """关闭应用"""
    if req.name:
        subprocess.run(f'taskkill /IM "{req.name}" /F', shell=True, capture_output=True)
        return {"success": True, "message": f"已关闭: {req.name}"}
    raise HTTPException(status_code=400, detail="需要 name")

@app.get("/api/app/list", dependencies=[Depends(verify_token)])
def list_apps():
    """列出当前运行的窗口"""
    import pyautogui
    try:
        import pygetwindow as gw
        windows = gw.getAllWindows()
        return {"windows": [{"title": w.title, "visible": w.visible} for w in windows if w.title.strip()]}
    except ImportError:
        # fallback
        result = subprocess.run('tasklist /FI "STATUS eq RUNNING" /FO CSV', 
                              shell=True, capture_output=True, text=True)
        return {"raw": result.stdout[:3000]}

# ============ 键盘鼠标 ============
@app.post("/api/keyboard/hotkey", dependencies=[Depends(verify_token)])
def press_hotkey(req: KeyboardRequest):
    """按下快捷键"""
    import pyautogui
    keys = [k.strip() for k in req.keys.split("+")]
    pyautogui.hotkey(*keys)
    return {"success": True, "message": f"已按下: {req.keys}"}

@app.post("/api/keyboard/type", dependencies=[Depends(verify_token)])
def type_text(req: TypeTextRequest):
    """输入文字"""
    import pyautogui
    pyautogui.typewrite(req.text, interval=0.02) if req.text.isascii() else None
    if not req.text.isascii():
        # 中文输入通过剪贴板
        import pyperclip
        pyperclip.copy(req.text)
        pyautogui.hotkey('ctrl', 'v')
    return {"success": True, "message": f"已输入文字"}

# ============ Shell 命令 ============
@app.post("/api/shell", dependencies=[Depends(verify_token)])
def run_shell(req: ShellRequest):
    """执行 shell 命令"""
    try:
        result = subprocess.run(
            req.command, shell=True, capture_output=True, text=True,
            timeout=req.timeout, encoding='utf-8', errors='replace'
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[:5000],
            "stderr": result.stderr[:2000],
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"命令超时 ({req.timeout}s)"}

# ============ 通知 ============
@app.post("/api/notify", dependencies=[Depends(verify_token)])
def send_notification(req: NotifyRequest):
    """发送 Windows 通知"""
    try:
        from win10toast import ToastNotifier
        toaster = ToastNotifier()
        toaster.show_toast(req.title, req.message, duration=5, threaded=True)
        return {"success": True, "message": "通知已发送"}
    except ImportError:
        # fallback: 使用 PowerShell
        ps_cmd = f'''powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('{req.message}', '{req.title}')"'''
        subprocess.Popen(ps_cmd, shell=True)
        return {"success": True, "message": "通知已发送 (PowerShell fallback)"}

# ============ 电源管理 ============
@app.post("/api/power/sleep", dependencies=[Depends(verify_token)])
def sleep_pc():
    """休眠电脑"""
    subprocess.run('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', shell=True)
    return {"success": True, "message": "电脑即将休眠"}

@app.post("/api/power/shutdown", dependencies=[Depends(verify_token)])
def shutdown_pc():
    """关机（60秒倒计时）"""
    subprocess.run('shutdown /s /t 60', shell=True)
    return {"success": True, "message": "电脑将在60秒后关机，可用 shutdown /a 取消"}

@app.post("/api/power/cancel-shutdown", dependencies=[Depends(verify_token)])
def cancel_shutdown():
    """取消关机"""
    subprocess.run('shutdown /a', shell=True)
    return {"success": True, "message": "已取消关机"}

# ============ 健康检查 ============
@app.get("/api/ping")
def ping():
    return {"pong": True, "timestamp": time.time(), "version": "1.0.0"}

# ============ 启动 ============
if __name__ == "__main__":
    print("\n" + "="*50)
    print("  灵界 PC 控制服务 v1.0.0")
    print("  宿烬的触手，已延伸至此。")
    print(f"  端口: {SERVER_PORT}")
    print(f"  Token: {API_TOKEN}")
    print("="*50 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)
