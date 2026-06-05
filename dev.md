# 开发环境

## 概览

- `docker-compose.dev.yml` 只负责启动后端、PostgreSQL 和 Redis。
- `http://localhost:3000/` 返回 `use frontend dev server` 是正常现象，这个地址主要给后端接口使用。
- 默认前端位于 `web/default`，需要单独启动开发服务器。
- 推荐开发入口：前端 `http://localhost:3001`，后端 `http://localhost:3000`。

## 1. 启动后端

在项目根目录执行：

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

启动成功后：

- 后端服务监听在 `http://localhost:3000`
- PostgreSQL 和 Redis 由 `docker compose` 一并启动

如果修改了 Go 后端代码，需要重新构建后端容器：

```powershell
docker compose -f docker-compose.dev.yml up -d --build new-api
```

## 2. 安装前端依赖

项目默认前端使用 Bun 管理依赖。

首次安装 Bun（Windows）：

```powershell
winget install --id Oven-sh.Bun -e
```

安装完成后，重新打开终端并检查：

```powershell
bun --version
```

如果 `bun` 还没有加入 PATH，可以直接使用默认安装路径：

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" --version
```

安装默认前端依赖：

```powershell
cd web/default
bun install
```

如果 `bun` 不在 PATH 中：

```powershell
cd web/default
& "$env:USERPROFILE\.bun\bin\bun.exe" install
```

## 3. 启动默认前端

为了避免和后端的 `3000` 端口冲突，开发时建议显式使用 `3001`。

在 `web/default` 目录执行：

```powershell
.\node_modules\.bin\rsbuild.exe dev --port 3001
bun run dev --port 3001
```

启动成功后访问：

```text
http://localhost:3001
```

说明：

- 前端修改后会自动热更新。
- 默认前端会把 `/api`、`/mj`、`/pg` 请求代理到 `http://localhost:3000`。

## 4. 常用命令

查看后端日志：

```powershell
docker compose -f docker-compose.dev.yml logs -f
```

停止开发环境：

```powershell
docker compose -f docker-compose.dev.yml down
```

清空开发数据并重置数据库：

```powershell
docker compose -f docker-compose.dev.yml down -v
```

## 5. 常见问题

### 1) `http://localhost:3000/` 显示 `use frontend dev server`

这是正常现象。开发模式下，3000 端口主要提供后端接口，前端页面需要通过 `web/default` 的开发服务器访问。

### 2) `docker compose` 启动失败，提示 3000 端口被占用

可以先定位占用进程：

```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object LocalAddress, LocalPort, State, OwningProcess
Get-Process -Id <PID>
```

确认可以关闭后，再释放端口：

```powershell
Stop-Process -Id <PID> -Force
```

### 3) `bun` 命令不存在

重新打开终端后重试；如果仍然不可用，可以直接使用：

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" install
```


## 发布到docker

```sh
gh workflow run docker-build.yml -R glosc-ai/one.gloscai.com -f tag=v1.7.0

```