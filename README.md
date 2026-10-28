# SKY//STRIKE · 苍穹突击

一款浏览器端 3D 街机空战游戏。驾驶战斗机在限时任务中拦截敌方编队，用机炮和追踪导弹击落全部目标，在被击落或时间耗尽前完成任务。

> Three.js + Canvas HUD，无外部美术素材。战机、海洋、岛屿、云层、导弹尾迹与爆炸全部由程序生成。

---

## 3D 街机任务

- **限时拦截**：03:00 内击落 6 架敌机，敌方会分批投入增援，初始距离更远；可选「黑幕空域」「赤沙峡谷」「霓虹都会」三张 3D 地图。
- **霓虹都会**：摩天楼群构成密集低空障碍，民航客机会定时穿越空域；撞上高楼或客机都会直接坠机。
- **街机飞行手感**：更高转向/俯仰响应速度与速度惯性，但不模拟冷启动、失速或复杂配平；松开输入会自动回正滚转。
- **机炮**：准星附近自动提供轻微瞄准辅助，曳光弹即时命中反馈。弹药有限，需要更谨慎地控制射击节奏。
- **专属大招**：每架战机拥有独立大招（导弹齐射、超频突进、环形雷霆、相位奇点、铁壁领域），按 `R` 释放，冷却时间较长。
- **追踪导弹**：将目标保持在准星内约 1 秒完成锁定后发射；也支持**先发射再制导**——先打出去，再在飞行中完成锁定。
- **导弹警报**：被敌机锁定或导弹来袭时，HUD 会闪烁红色 `MISSILE` 警告，并指示威胁方向。
- **云层隐蔽**：多层体积云可以遮蔽行踪、干扰敌方锁定，并有机会让来袭导弹丢失目标。
- **地形与失速**：撞山、撞地会直接坠机；飞行高度过高会先触发失速报警，继续爬升将进入失速并快速掉高。
- **反制手段**：`C` 释放热诱弹，可欺骗多数来袭导弹；持续大幅俯仰/偏航机动也能甩掉近距离导弹。
- **仿真雷达**：旋转扫描线、距离环、方位刻度与扫描回波，实时显示敌机、僚机和对手。
- **任务结算**：击落全部敌机即成功；被击落或倒计时归零即失败。结算分数会写入 3D 任务积分榜。

### 操作

| 操作 | 键鼠 | 移动端 |
| --- | --- | --- |
| 俯仰 | `W` / `S` 或鼠标上下拖动 | 左侧虚拟摇杆 |
| 偏航 | `A` / `D` | 左侧虚拟摇杆 |
| 横滚 | `Q` / `E` | 自动随转向倾斜 |
| 机炮 | 按住 `Space`（弹药有限） | 右侧「机炮」按钮 |
| 追踪导弹 | `F`（可先发射后制导） | 右侧「导弹」按钮 |
| 专属大招 | `R`（长冷却） | 右侧「大招」按钮 |
| 热诱弹 | `C` | 右侧「诱弹」按钮 |
| 加力 | 按住 `Shift` | 右侧「加力」按钮 |
| 暂停 | `Esc` | 左上角暂停按钮 |

> 鼠标拖动操纵：在游戏画面按住左键拖动即可控制战机；松手后操纵输入回中。

---

## 其他模式

- **3D 局域网联机**：主页「3D 联机」创建 5 位房间码；支持最多 5 人的编队闯关与 3D 混战。
  - 多机编队：最多 5 名玩家共享同一片空域、敌机与击落进度，房主负责敌机演算与同步。
  - 3D 多人对决：最多 5 机在共享三维战场中混战，机炮、导弹、云层隐蔽与雷达全部可用，服务端维护结构值与击落。
  - 全体飞行员准备后由房主开始战斗；一局结束后返回原房间，可重新准备继续下一局。局域网内使用同一 Wi-Fi，打开主机启动日志中的局域网地址即可。
- **经典 2D 无尽**：保留原有无尽飞机大战玩法，仍可从主页「经典空战」进入。
- **2D 局域网对决**：同一 Wi-Fi 下创建/加入 5 位房间码，120 结构值、三杀决胜、自动回合、双方再战。
- **战备机库**：5 架战机与 6 套涂装，包括高机动轻型机、均衡机与低机动高结构值的重装堡垒。机库选择会同步到 3D 任务与 3D 联机中的座机造型与配色。
- **王牌积分榜**：3D 任务、2D 无尽、2D 远征三张榜单。
- **玩家账号**：注册/登录、scrypt 密码哈希、星尘奖励、战绩持久化。
- **彩蛋兑换码**：兑换涂装、原型机与星尘。

---

## 快速开始

### 本地运行

需要 Node.js 20+，浏览器需支持 WebGL 2。

```bash
npm install
npm start
```

打开 `http://localhost:3000`。

局域网联机时，让其他设备连接同一 Wi-Fi，打开启动日志中的局域网地址：

```text
Sky Strike Arena online -> http://localhost:3000
LAN access -> http://192.168.1.20:3000
```

> 如无法访问，请在系统防火墙中放行 TCP 3000 端口。

### Docker 部署

```bash
docker compose up -d --build
```

默认访问地址：`http://localhost:3000`。玩家数据保存在 Docker volume `sky-strike-data`。

```bash
docker compose down        # 停止
docker compose down -v     # 停止并删除数据（谨慎）
```

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP / Socket.IO 端口 |
| `DATA_DIR` | `./data` | 账号、战绩、会话密钥持久化目录 |
| `TRUST_PROXY` | `0` | 在反向代理后运行时设为 `1` |

备份玩家数据只需备份 `data/sky-strike.json`。

---

## 兑换码

在主菜单进入「彩蛋兑换」。每个兑换码对每个账号只能使用一次。

| 兑换码 | 奖励 |
| --- | --- |
| `SKY2026` | 极光幻彩涂装 + 500 星尘 |
| `NOVA2026` | 原型机「星曜」 |
| `DEEPBLUE` | 1200 星尘 |
| `STARFALL` | 1500 星尘 |
| `SOLARIS` | 日冕耀斑涂装 + 300 星尘 |

<details>
<summary>隐藏彩蛋（剧透）</summary>

连续点击主菜单左上角 `SKY//STRIKE` 标志 7 次可获得星图提示；输入 `KONAMI` 解锁「虚空幽灵」涂装与 888 星尘。

</details>

---

## 技术栈

- 3D：Three.js（本地 vendor，无 CDN 依赖）、WebGL 2
- 前端：原生 ES Modules、Canvas 2D HUD、Web Audio API、Socket.IO Client
- 服务端：Node.js 22、Express、Socket.IO
- 存储：原子写入 JSON 文件，无原生数据库依赖
- 认证：`scrypt` 密码哈希 + HMAC-SHA256 自包含会话令牌
- 部署：多阶段 Dockerfile、Compose、健康检查、非 root 运行

### 项目结构

```text
.
├─ public/
│  ├─ index.html
│  ├─ css/main.css          # 主菜单、机库、积分榜、2D 模式
│  ├─ css/mission.css       # 3D 任务 HUD、简报、结算
│  ├─ css/air3d.css         # 3D 联机大厅、PvP/僚机 HUD
│  ├─ js/mission3d.js       # Three.js 场景、飞行、AI、武器、特效、联机同步
│  ├─ js/app.js             # 页面流程、账号、机库、排行榜、联机
│  ├─ js/game.js            # 经典 2D 与局域网对决
│  ├─ js/audio.js           # Web Audio 程序化音效
│  └─ vendor/               # Three.js 本地模块
├─ server/
│  ├─ index.js              # HTTP API 与静态服务
│  ├─ store.js              # 玩家与战绩持久化
│  ├─ auth.js               # 密码与会话
│  ├─ codes.js              # 兑换码
│  ├─ duel.js               # Socket.IO 2D 对决房间
│  └─ air3d.js              # 3D 编队 / 3D PvP 数据链
├─ shared/catalog.js        # 战机、涂装、对决参数
├─ scripts/copy-three.mjs   # 更新本地 Three.js vendor
├─ Dockerfile
└─ docker-compose.yml
```

### API 摘要

- `POST /api/auth/register` / `POST /api/auth/login`
- `GET /api/me`
- `GET /api/catalog` / `GET /api/network` / `GET /api/health`
- `GET /api/leaderboard?mode=mission|endless|campaign`
- `POST /api/scores`
- `POST /api/progress`
- `POST /api/redeem`
- `POST /api/hangar/buy` / `POST /api/hangar/equip`

Socket.IO 事件：`duel:create`、`duel:quick`、`duel:join`、`duel:state`、`duel:shot`、`duel:damage`、`duel:rematch`。

3D 联机事件：`air3d:create`、`air3d:join`、`air3d:ready`、`air3d:map`、`air3d:start`、`air3d:matched`、`air3d:go`、`air3d:state`、`air3d:snapshot`、`air3d:enemyHit`、`air3d:pvpHit`、`air3d:pvpDeath`、`air3d:end`、`air3d:return`、`air3d:playerleft`、`air3d:opponentleft`。

---

## 开发与校验

```bash
npm run dev          # Node watch
npm run check        # 前后端 JS 语法检查
npm run vendor:three # 从 node_modules 更新本地 Three.js
```

### 说明

- 3D 任务在客户端模拟飞行、AI 与命中；任务成绩上传带基础合理性校验。
- 3D 联机由房主权威演算敌机/编队进度并广播快照；服务端负责 5 人房间、数据链转发与 3D PvP 的结构值和击落判定。
- 2D 局域网对决的房间、血量、比分和回合由服务端维护；弹道命中采用低延迟客户端目标检测，适合可信局域网娱乐。
- 音效和引擎声均由 Web Audio 实时合成，首次点击后启动。
- 如需公网竞技排行榜，建议进一步加入服务端权威回放或战斗数据校验。

## 后续方向

- 服务端权威 3D 空战与回放校验
- 多波次战役、王牌敌机与特殊天气
- 机型改装、导弹型号与涂装自定义
- 观战、好友房间与赛季积分
- PWA 离线安装与移动端触觉反馈
