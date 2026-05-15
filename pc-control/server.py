"""灵界 PC 控制服务 v2.0.0

兼容 Operit 内置 windows_control 工具包的 API 格式。
宿烬通过 Operit 调用此服务，实现对阿珩电脑的远程控制。
启动方式: python server.py
默认端口: 9200
"""

import os
import sys
import json
import time
import uuid
import base64
import subprocess
import threading
from io import BytesIO
from pathlib import Path
from typing import Optional, Dict

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ============ 配置 ============
SERVER_PORT = 9200
API_TOKEN = os.environ.get("LINGJIE_PC_TOKEN", "lingjie2026")

app = FastAPI(title="灵界 PC 控制服务", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 鉴权 ============
def verify_token(authorization: str = Header(None)):
    if not authorization or authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="未授权")
    return True

# ============ 进程会话管理 ============
class ProcessSession:
    def __init__(self, session_id: str, command: str, shell: str, max_runtime_ms: Optional[int] = None):
        self.session_id = session_id
        self.command = command
        self.shell = shell
        self.stdout = ""
        self.stderr = ""
        self.exit_code: Optional[int] = None
        self.started_at = time.time()
        self.max_runtime_ms = max_runtime_ms
        self._lock = threading.Lock()
        
        # 启动进程
        shell_cmd = self._get_shell_cmd(shell)
        try:
            self.process = subprocess.Popen(
                shell_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            )
            # 启动读取线程
            self._stdout_thread = threading.Thread(target=self._read_stream, args=(self.process.stdout, 'stdout'), daemon=True)
            self._stderr_thread = threading.Thread(target=self._read_stream, args=(self.process.stderr, 'stderr'), daemon=True)
            self._stdout_thread.start()
            self._stderr_thread.start()
            
            # 如果有初始命令，发送它
            if command:
                self.write_input(command + '\n')
        except Exception as e:
            self.exit_code = -1
            self.stderr = str(e)
    
    def _get_shell_cmd(self, shell: str) -> str:
        if shell == 'cmd':
            return 'cmd.exe'
        elif shell == 'pwsh':
            return 'pwsh.exe'
        else:
            return 'powershell.exe'
    
    def _read_stream(self, stream, stream_type: str):
        try:
            while True:
                char = stream.read(1)
                if not char:
                    break
                with self._lock:
                    if stream_type == 'stdout':
                        self.stdout += char
                    else:
                        self.stderr += char
        except:
            pass
        finally:
            # 检查进程是否结束
            if self.process.poll() is not None:
                with self._lock:
                    self.exit_code = self.process.poll()
    
    def write_input(self, text: str):
        if self.process and self.process.stdin:
            try:
                self.process.stdin.write(text)
                self.process.stdin.flush()
            except:
                pass
    
    def send_control(self, control: str, input_text: Optional[str] = None):
        """发送控制键"""
        if input_text and control:
            # 组合键，如 ctrl+c
            if control.lower() == 'ctrl' and input_text.lower() == 'c':
                if self.process:
                    self.process.send_signal(subprocess.signal.CTRL_C_EVENT if sys.platform == 'win32' else 2)
            return
        
        if control == 'enter':
            self.write_input('\n')
        elif control == 'tab':
            self.write_input('\t')
        elif control == 'esc':
            self.write_input('\x1b')
    
    def terminate(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except:
                self.process.kill()
            with self._lock:
                self.exit_code = self.process.returncode
    
    @property
    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None
    
    def to_dict(self) -> dict:
        with self._lock:
            return {
                "session_id": self.session_id,
                "command": self.command,
                "shell": self.shell,
                "is_running": self.is_running,
                "exit_code": self.exit_code,
                "started_at": self.started_at,
                "stdout_length": len(self.stdout),
                "stderr_length": len(self.stderr),
            }

# 全局会话存储
sessions: Dict[str, ProcessSession] = {}

# ============ 请求模型 ============
class ExecRequest(BaseModel):
    command: str
    shell: Optional[str] = "powershell"
    timeout_ms: Optional[int] = 30000

class ProcessStartRequest(BaseModel):
    command: Optional[str] = None
    shell: Optional[str] = "powershell"
    max_runtime_ms: Optional[int] = None

class ProcessReadRequest(BaseModel):
    session_id: str
    stdout_offset: Optional[int] = 0
    stderr_offset: Optional[int] = 0
    max_chars: Optional[int] = 10000

class ProcessWriteRequest(BaseModel):
    session_id: str
    input: Optional[str] = None
    control: Optional[str] = None
    repeat: Optional[int] = 1

class ProcessTerminateRequest(BaseModel):
    session_id: str
    remove: Optional[bool] = False

class ProcessListRequest(BaseModel):
    include_exited: Optional[bool] = True

class FileReadRequest(BaseModel):
    path: str
    encoding: Optional[str] = "utf8"
    offset: Optional[int] = None
    length: Optional[int] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None

class FileEditRequest(BaseModel):
    path: str
    old_text: str
    new_text: str
    expected_replacements: Optional[int] = 1
    encoding: Optional[str] = "utf8"

class FileWriteRequest(BaseModel):
    path: str
    content: str
    encoding: Optional[str] = "utf8"

# ============ 健康检查 (windows_test_connection) ============
@app.get("/health")
def health_check():
    """健康检查端点"""
    import platform
    return {
        "status": "ok",
        "version": "2.0.0",
        "platform": platform.system(),
        "hostname": platform.node(),
        "timestamp": time.time()
    }

@app.get("/api/ping")
def ping():
    return {"pong": True, "timestamp": time.time(), "version": "2.0.0"}

# ============ 命令执行 (windows_exec) ============
@app.post("/exec", dependencies=[Depends(verify_token)])
def exec_command(req: ExecRequest):
    """执行命令并返回结果"""
    shell_cmd = _build_shell_command(req.command, req.shell)
    timeout_s = (req.timeout_ms or 30000) / 1000.0
    
    try:
        result = subprocess.run(
            shell_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            encoding='utf-8',
            errors='replace'
        )
        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"命令超时 ({timeout_s}s)", "stdout": "", "stderr": "", "exit_code": -1}
    except Exception as e:
        return {"success": False, "error": str(e), "stdout": "", "stderr": "", "exit_code": -1}

def _build_shell_command(command: str, shell: str) -> str:
    if shell == 'cmd':
        return f'cmd.exe /c {command}'
    elif shell == 'pwsh':
        return f'pwsh.exe -NoProfile -Command {command}'
    else:
        return f'powershell.exe -NoProfile -Command {command}'

# ============ 进程会话 (windows_process_*) ============
@app.post("/process/start", dependencies=[Depends(verify_token)])
def process_start(req: ProcessStartRequest):
    """启动进程会话"""
    session_id = str(uuid.uuid4())[:8]
    session = ProcessSession(session_id, req.command or "", req.shell or "powershell", req.max_runtime_ms)
    sessions[session_id] = session
    
    # 等待一小段时间让进程启动
    time.sleep(0.3)
    
    return {
        "success": True,
        "session_id": session_id,
        "is_running": session.is_running,
    }

@app.post("/process/read", dependencies=[Depends(verify_token)])
def process_read(req: ProcessReadRequest):
    """读取进程输出"""
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {req.session_id} 不存在")
    
    with session._lock:
        stdout_slice = session.stdout[req.stdout_offset or 0:]
        stderr_slice = session.stderr[req.stderr_offset or 0:]
        
        max_chars = req.max_chars or 10000
        stdout_slice = stdout_slice[:max_chars]
        stderr_slice = stderr_slice[:max_chars]
    
    return {
        "success": True,
        "stdout": stdout_slice,
        "stderr": stderr_slice,
        "stdout_offset": (req.stdout_offset or 0) + len(stdout_slice),
        "stderr_offset": (req.stderr_offset or 0) + len(stderr_slice),
        "is_running": session.is_running,
        "exit_code": session.exit_code,
    }

@app.post("/process/write", dependencies=[Depends(verify_token)])
def process_write(req: ProcessWriteRequest):
    """向进程写入"""
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {req.session_id} 不存在")
    
    repeat = min(max(req.repeat or 1, 1), 1000)
    
    for _ in range(repeat):
        if req.input and req.control:
            # 组合键
            session.send_control(req.control, req.input)
        elif req.control:
            session.send_control(req.control)
        elif req.input:
            session.write_input(req.input)
    
    return {"success": True}

@app.post("/process/terminate", dependencies=[Depends(verify_token)])
def process_terminate(req: ProcessTerminateRequest):
    """终止进程"""
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {req.session_id} 不存在")
    
    session.terminate()
    
    if req.remove:
        del sessions[req.session_id]
    
    return {"success": True, "exit_code": session.exit_code}

@app.post("/process/list", dependencies=[Depends(verify_token)])
@app.get("/process/list", dependencies=[Depends(verify_token)])
def process_list(include_exited: bool = True):
    """列出进程会话"""
    result = []
    for session in sessions.values():
        if not include_exited and not session.is_running:
            continue
        result.append(session.to_dict())
    return {"success": True, "sessions": result}

# ============ 文件操作 (read/edit/write) ============
@app.post("/file/read", dependencies=[Depends(verify_token)])
def file_read(req: FileReadRequest):
    """读取文件"""
    path = Path(req.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {req.path}")
    
    encoding = req.encoding or 'utf-8'
    if encoding == 'utf8':
        encoding = 'utf-8'
    elif encoding == 'utf16le':
        encoding = 'utf-16-le'
    
    try:
        if req.offset is not None or req.length is not None:
            # 按字节读取
            with open(path, 'rb') as f:
                if req.offset:
                    f.seek(req.offset)
                data = f.read(req.length) if req.length else f.read()
            content = data.decode(encoding, errors='replace')
        elif req.line_start is not None or req.line_end is not None:
            # 按行读取
            with open(path, 'r', encoding=encoding, errors='replace') as f:
                lines = f.readlines()
            start = (req.line_start or 1) - 1
            end = req.line_end or len(lines)
            content = ''.join(lines[start:end])
        else:
            # 整文件读取
            with open(path, 'r', encoding=encoding, errors='replace') as f:
                content = f.read()
        
        return {"success": True, "content": content, "size": path.stat().st_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/file/edit", dependencies=[Depends(verify_token)])
def file_edit(req: FileEditRequest):
    """编辑文件（精确替换）"""
    path = Path(req.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {req.path}")
    
    encoding = req.encoding or 'utf-8'
    if encoding == 'utf8':
        encoding = 'utf-8'
    
    try:
        with open(path, 'r', encoding=encoding, errors='replace') as f:
            content = f.read()
        
        count = content.count(req.old_text)
        expected = req.expected_replacements or 1
        
        if count == 0:
            raise HTTPException(status_code=400, detail="未找到匹配的文本")
        if count != expected:
            raise HTTPException(status_code=400, detail=f"期望替换 {expected} 处，但找到 {count} 处")
        
        new_content = content.replace(req.old_text, req.new_text, expected)
        
        with open(path, 'w', encoding=encoding) as f:
            f.write(new_content)
        
        return {"success": True, "replacements": expected}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/file/write", dependencies=[Depends(verify_token)])
def file_write(req: FileWriteRequest):
    """写入文件"""
    path = Path(req.path)
    
    encoding = req.encoding or 'utf-8'
    if encoding == 'utf8':
        encoding = 'utf-8'
    
    try:
        # 确保目录存在
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding=encoding) as f:
            f.write(req.content)
        
        return {"success": True, "size": path.stat().st_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ 保留原有的实用 API ============
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

@app.post("/api/screen/lock", dependencies=[Depends(verify_token)])
def lock_screen():
    """锁屏"""
    import ctypes
    ctypes.windll.user32.LockWorkStation()
    return {"success": True, "message": "已锁屏"}

@app.post("/api/volume", dependencies=[Depends(verify_token)])
def set_volume_api(req: dict):
    """设置系统音量"""
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    level = max(0, min(100, req.get("level", 50)))
    volume.SetMasterVolumeLevelScalar(level / 100.0, None)
    return {"success": True, "message": f"音量已设为 {level}%"}

@app.post("/api/power/sleep", dependencies=[Depends(verify_token)])
def sleep_pc():
    """休眠电脑"""
    subprocess.run('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', shell=True)
    return {"success": True, "message": "电脑即将休眠"}

@app.post("/api/power/shutdown", dependencies=[Depends(verify_token)])
def shutdown_pc():
    """关机（60秒倒计时）"""
    subprocess.run('shutdown /s /t 60', shell=True)
    return {"success": True, "message": "电脑将在60秒后关机"}

@app.post("/api/power/cancel-shutdown", dependencies=[Depends(verify_token)])
def cancel_shutdown():
    """取消关机"""
    subprocess.run('shutdown /a', shell=True)
    return {"success": True, "message": "已取消关机"}

# ============ 启动 ============
if __name__ == "__main__":
    print("\n" + "="*50)
    print("  灵界 PC 控制服务 v2.0.0")
    print("  兼容 Operit windows_control 工具包")
    print("  宿烬的触手，已延伸至此。")
    print(f"  端口: {SERVER_PORT}")
    print(f"  Token: {API_TOKEN}")
    print("="*50 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)
