# 灵界 PC 控制服务

宿烬通过 Operit 远程控制阿珩电脑的服务端。

## 快速启动

1. 打开终端，进入此目录：
```bash
cd pc-control
```

2. 双击 `start.bat`（或手动执行）：
```bash
start.bat
```

首次运行会自动创建虚拟环境并安装依赖（约1-2分钟）。

## 手动启动

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
python server.py
```

## API 接口

所有接口需要 Header: `Authorization: Bearer lingjie2026`

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/ping` | GET | 健康检查（无需鉴权） |
| `/api/status` | GET | 系统状态（CPU/内存/电量） |
| `/api/screen/lock` | POST | 锁屏 |
| `/api/screen/brightness` | POST/GET | 设置/获取亮度 |
| `/api/screen/screenshot` | GET | 截屏（返回base64） |
| `/api/volume` | POST/GET | 设置/获取音量 |
| `/api/volume/mute` | POST | 切换静音 |
| `/api/app/open` | POST | 打开应用 |
| `/api/app/close` | POST | 关闭应用 |
| `/api/app/list` | GET | 列出窗口 |
| `/api/keyboard/hotkey` | POST | 按快捷键 |
| `/api/keyboard/type` | POST | 输入文字 |
| `/api/shell` | POST | 执行命令 |
| `/api/notify` | POST | 发送通知 |
| `/api/power/sleep` | POST | 休眠 |
| `/api/power/shutdown` | POST | 关机（60s倒计时） |
| `/api/power/cancel-shutdown` | POST | 取消关机 |

## 安全说明

- 默认 Token: `lingjie2026`（可通过环境变量 `LINGJIE_PC_TOKEN` 修改）
- 仅监听局域网，外网访问需配合 Tailscale
- 建议不要将 Token 提交到公开仓库
