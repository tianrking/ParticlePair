<div align="center">
  <img src="./public/favicon.png" width="88" alt="ParticlePair 标志" />
  <h1>ParticlePair</h1>
  <p><strong>让配对，隐入流动。</strong><br /><sub>OrbitaCero 出品。</sub></p>
  <p>人眼看到鲜亮的旋转星系，相机读出可验证的光学帧。</p>

  <p>
    <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/Language-English-111827?style=for-the-badge" /></a>
    <a href="./README.es.md"><img alt="Español" src="https://img.shields.io/badge/Idioma-Español-B45309?style=for-the-badge" /></a>
    <a href="./README.zh-CN.md"><img alt="简体中文" src="https://img.shields.io/badge/语言-简体中文-0F766E?style=for-the-badge" /></a>
  </p>

  <p>
    <img alt="组织：OrbitaCero" src="https://img.shields.io/badge/organization-OrbitaCero-0F172A?style=flat-square" />
    <a href="https://github.com/tianrking/ParticlePair/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/tianrking/ParticlePair/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
    <a href="#已知限制"><img alt="状态：实验性" src="https://img.shields.io/badge/status-experimental-EA580C?style=flat-square" /></a>
    <a href="./LICENSE"><img alt="源码可用" src="https://img.shields.io/badge/source-available-7C3AED?style=flat-square" /></a>
    <a href="./LICENSE"><img alt="PolyForm 非商业许可" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-0F766E?style=flat-square" /></a>
    <a href="./COMMERCIAL-LICENSE.md"><img alt="商业使用需要授权" src="https://img.shields.io/badge/commercial%20use-license%20required-B91C1C?style=flat-square" /></a>
  </p>

  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftianrking%2FParticlePair&amp;project-name=particle-pair&amp;repository-name=particle-pair"><img src="https://vercel.com/button" alt="一键部署到 Vercel" /></a>
  </p>
</div>

![ParticlePair 预览](./public/readme-preview.png)

> [!IMPORTANT]
> ParticlePair 是**源码可用项目**，不是 OSI 定义的开源软件。任何商业权利都不会自动授予；商业产品、付费服务、SDK、硬件、企业内部商业运营及其他商业用途，必须在使用前取得版权所有者的明确书面许可或另行签署商业许可证。

## 项目简介

ParticlePair 将 128 位一次性配对秘密编码进鲜亮的三臂粒子星系。视觉层使用高饱和电光蓝、紫罗兰与洋红粒子，光学层使用高绿分量的青色载波，使人眼看到的星系与相机读取的通道彼此分离。接收端比较两个相反调制相位，提取机器可读网格，纠正有限的比特错误，并且只在完整性校验通过后释放秘密。

它试图让人看到的是具有氛围感的粒子运动，而软件看到的是可以解码的结构。项目是独立设计的研究原型，不兼容、不隶属于 Apple Watch，也不是对 Apple 私有配对协议的逆向实现。

**快速导航：** [技术栈](#技术栈) · [工作原理](#工作原理) · [快速开始](#快速开始) · [双设备扫描](#双设备相机扫描) · [协议](#particle-code-v1) · [安全模型](#安全模型) · [商业授权](#许可证与商业使用)

## 技术栈

<table>
  <tr>
    <td align="center" width="33%">
      <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2-000000?style=for-the-badge&amp;logo=nextdotjs&amp;logoColor=white" /><br />
      <img alt="React" src="https://img.shields.io/badge/React-19.2-149ECA?style=for-the-badge&amp;logo=react&amp;logoColor=white" /><br />
      <sub><strong>Web 运行时</strong><br />App Router · SSR · 响应式界面</sub>
    </td>
    <td align="center" width="33%">
      <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&amp;logo=typescript&amp;logoColor=white" /><br />
      <img alt="Vite" src="https://img.shields.io/badge/Vite-8.1-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" /><br />
      <sub><strong>语言与构建</strong><br />严格类型 · Vinext · 双构建链</sub>
    </td>
    <td align="center" width="33%">
      <img alt="Canvas 2D" src="https://img.shields.io/badge/Canvas-2D-FF6B35?style=for-the-badge" /><br />
      <img alt="getUserMedia" src="https://img.shields.io/badge/Camera-getUserMedia-0284C7?style=for-the-badge" /><br />
      <sub><strong>光学运行时</strong><br />星系渲染 · 相机视频帧采样</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img alt="Web Crypto" src="https://img.shields.io/badge/Web-Crypto-0F766E?style=for-the-badge" /><br />
      <img alt="128 位秘密" src="https://img.shields.io/badge/Secret-128--bit-115E59?style=for-the-badge" /><br />
      <sub><strong>秘密材料</strong><br />客户端生成 · 不进入服务端 HTML</sub>
    </td>
    <td align="center">
      <img alt="Hamming 12,8" src="https://img.shields.io/badge/FEC-Hamming%2812%2C8%29-7C3AED?style=for-the-badge" /><br />
      <img alt="CRC-16" src="https://img.shields.io/badge/Integrity-CRC--16-D97706?style=for-the-badge" /><br />
      <sub><strong>封装与完整性</strong><br />Particle Code v1 · 校验后释放</sub>
    </td>
    <td align="center">
      <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Ready-000000?style=for-the-badge&amp;logo=vercel&amp;logoColor=white" /><br />
      <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&amp;logo=cloudflareworkers&amp;logoColor=white" /><br />
      <sub><strong>部署</strong><br />原生 Next.js · Worker/Sites</sub>
    </td>
  </tr>
</table>

| 层级 | 当前实现 |
| --- | --- |
| 配对材料 | 浏览器生成的 128 位一次性秘密 |
| 数据包 | 21 字节，包含头部与 CRC-16 |
| 纠错 | Hamming(12,8)，每个码字可纠正一位错误 |
| 光学布局 | 252 个编码位映射到 18×18 网格 |
| 调制 | 高绿分量青色载波的相反相位，每相位 300 ms |
| 渲染 | Canvas 2D、1,050 粒子三臂动态星系 |
| 接收 | `getUserMedia()`、纯绿通道帧差分与同步相关检测 |
| 部署 | Cloudflare Worker/Sites 与 Vercel 原生 Next.js |

## 重要声明

- 本仓库尚未接受生产级密码学、硬件安全或独立安全审计。
- 自动化测试覆盖协议封装、纠错、CRC 拒绝、页面渲染与两条部署构建；它们不能证明大规模真实设备矩阵上的物理链路可靠性。
- 当前扫描器会搜索邻近裁剪比例与偏移、恢复旋转或镜像输入，并通过有限 Homography 候选修正常见梯形畸变；但仍需要按取景框对准，尚不能自动推断任意角点或完成设备标定。
- 仅允许 [PolyForm Noncommercial License 1.0.0](./LICENSE) 覆盖的用途；其他用途参见[商业授权说明](./COMMERCIAL-LICENSE.md)。

## 工作原理

```text
128 位一次性秘密
          │
          ▼  协议帧 + CRC-16
          │
          ▼  Hamming(12,8) 纠错
          │
          ▼  252 位映射到 18×18 网格
          │
          ▼  鲜亮星系中的相反青色载波相位
          │
          ▼  相机纯绿通道连续帧差分
          │
          └─ 同步 → 解码 → 纠错 → CRC 校验 → 释放秘密
```

人眼看到 1,050 颗高饱和粒子沿三条螺旋臂旋转、呼吸、聚集与散开。蓝色、紫罗兰与洋红星系和高绿分量青色光学载波经过有意分层；机器将两个相反相位的纯绿通道画面相减，以抵消装饰场景和大部分整体曝光偏移。非对称外圈用于判断差分符号，内部单元承载编码数据。

## 已实现能力

- 生成或输入 16 字节/128 位一次性秘密。
- 在英文、西班牙文和简体中文之间切换完整界面，并在浏览器本地保存选择。
- 编码 21 字节 Particle Code v1 数据包。
- 通过 CRC-16/CCITT-FALSE 完成完整性检查。
- 对每个 Hamming(12,8) 码字纠正一位错误。
- 在鲜亮的 1,050 粒子三臂 Canvas 2D 星系背后渲染 18×18 光学网格。
- 将红蓝视觉星系与高绿分量青色相机载波分离。
- 通过浏览器相机执行带时间戳的视频帧配对、多比例裁剪搜索、旋转/镜像恢复、软证据累积、曝光漂移抵消和同步相关检测。
- 生成确定性的相反相位 PNG，执行不依赖离屏动画调度的 Canvas 像素闭环测试。
- 在独立码字中注入错误并运行本机闭环测试。
- 同时支持 Cloudflare Worker/Sites 与 Vercel 原生 Next.js 构建。

## 快速开始

### 环境要求

- Node.js 22.13 或更高版本
- npm
- 支持 Canvas、Web Crypto 和 `getUserMedia()` 的现代浏览器

### 浏览器兼容性

- 发送端可运行在当前桌面或移动版 Chrome、Edge、Firefox 和 Safari，只需支持 Canvas 2D 与 Web Crypto。
- 相机接收端还需要 HTTPS 安全上下文和 `getUserMedia()` 权限。iPhone Chrome/Safari、Android Chrome 以及当前桌面浏览器均通过能力检测适配，不依赖浏览器名称判断。
- 扫描器在可用时使用 `requestVideoFrameCallback()`，不可用时会自动回退到 `requestAnimationFrame()`。
- 请使用完整浏览器 App，不要使用微信等应用内置浏览器；扫描时让网页保持在前台。

```bash
git clone https://github.com/tianrking/ParticlePair.git
cd ParticlePair
npm ci
npm run dev
```

打开终端显示的本地地址。

### 本机闭环测试

1. 点击“生成新秘密”。
2. 点击“闭环自检”。
3. 测试会在三个独立 Hamming 码字中各翻转一位。
4. 解码器必须纠正错误、通过 CRC 校验并还原原始秘密。

## 局域网访问

让同一可信局域网内的手机或其他设备访问开发服务器：

```bash
npm run dev:lan
```

在另一台设备上打开终端显示的网络地址，通常是：

```text
http://<电脑局域网IP>:3000
```

- 两台设备必须连接同一个 Wi-Fi/局域网。
- Windows 弹出防火墙提示时，仅允许 Node.js 通过**专用网络**。
- 访客 Wi-Fi 或 AP isolation/客户端隔离可能阻止设备互访。
- 不要把开发服务器直接暴露到公网。

> [!WARNING]
> 普通 LAN HTTP 足以浏览页面、生成并**显示**粒子码；摄像头扫描依赖 `getUserMedia()`，浏览器通常要求 HTTPS 或 `localhost`。完整双设备扫描可让接收端打开 Vercel 等 HTTPS 部署，或者为局域网服务器配置被接收设备信任的 TLS。

## 部署

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftianrking%2FParticlePair&project-name=particle-pair&repository-name=particle-pair)

部署不需要环境变量、数据库或对象存储。[`vercel.json`](./vercel.json) 会选择原生 Next.js 构建，同时保留现有 Vinext/Cloudflare 构建链。

一键部署仍受本仓库许可证约束，**不会**自动授予商业使用权。

## 双设备相机扫描

1. 在发送设备上打开 ParticlePair，并保持完整粒子云可见。
2. 生成秘密，建议把调制强度保持在约 90% 或更高。
3. 在带相机的接收设备上打开 HTTPS ParticlePair 部署。
4. 点击“打开摄像头扫描”并授予相机权限。
5. 将发送端的四个青色光学角标对准接收端方形引导框；外围的矩形手表边框不属于粒子码。
6. 保持距离、角度和曝光稳定，等待同步与 CRC 校验完成。

`SYNC` 表示扣除随机相关底线后的同步证据，不是普通的相机活动进度。无关画面应保持在 0% 附近；超过 30% 才作为同步候选，达到 47% 才可进入多帧解码。只有数据包同时通过 Hamming 解码和 CRC-16 校验，界面才会显示“识别成功”。

接收端初始搜索 61 组裁剪/透视几何。迟滞控制器在同一候选连续稳定 5 次后收敛到 45 组，持续达到解码质量后再收敛到 25 组；质量下降时会在 1 至 2 次观察内重新扩搜。每次换挡都会清除不兼容的历史帧。相机界面仅显示当前阶段、几何数量和本地采样耗时，不包含任何载荷数据。

摄像头 RGB 会投影到保留振幅的青色对手通道 `G - 0.42R - 0.16B`，从而抑制鲜艳的蓝、紫、洋红艺术层，同时不把有效光学脉冲归一化掉。每组反相帧利用已知同步边框的明暗组间距估计自动曝光乘性增益，再依次消除该增益与加性黑电平偏移，最后执行同步、Hamming 纠错和 CRC 校验。界面的 `AE ×` 数值会实时显示补偿倍率。

每个透视候选还携带动态范围健康记录。只有至少两个 RGB 通道同时达到传感器上限，采样点才会被判为高光剪切，从而避免把刻意偏绿的明亮青色载波误报成过曝。青色对手通道的第 10～90 百分位跨度用于识别低对比平场，全通道阴影比例用于识别欠曝。`DR` 显示综合健康度；同步较弱时，接收端会据此给出降低亮度、调整距离或避开背光的具体建议，而不是笼统提示噪声。

已知的交替同步边框同时充当协议内置对焦测试条。算法用整幅画面的第 10～90 百分位青色跨度归一化边框明暗组分离度，因此载荷内部鲜艳的星云亮边无法伪造清晰对焦。`F` 显示边框调制度；当动态范围健康但 `F` 较低时，接收端会建议轻点对焦或稍微拉远，而不会错误归因于曝光或对准。

反相帧配对不再使用固定容差，而是维护最近 15 个帧间隔的时间模型。中位数估计真实相机 FPS，中位绝对偏差衡量抖动，单次后台挂起不会主导结果。稳定高帧率设备会将窗口收紧到 72 ms，低帧率或不规则采样时最多扩展到 145 ms，始终保持相位可分离。`J` 显示毫秒级抖动；节奏不稳定时会明确提示保持页面在前台并关闭省电模式。

界面显示的处理耗时现在覆盖几何采样、RGB 健康分析、八方向变换、曝光拟合和候选排名，而不只是 Canvas 读取。负载控制器只有连续 4 帧超出预算才进入冷却，并改为隔帧处理；时间模型仍观察每一个相机回调。连续 8 次低负载后恢复全帧处理。`L` 显示按处理占空比校正后的利用率，因此冷却状态反映真实平均 CPU 压力，而不是单次已处理帧的成本。

载荷释放还必须通过跨帧方向共识。接收端维护最近 8 个胜出候选在八种旋转/镜像变换上的投票；手持移动造成的相邻裁剪区域切换是允许的，但方向必须取得至少三分之二多数并通过次优方向分差检查。建立锁定至少需要 3 次观察，尝试解码前同一候选至少需要 2 帧软证据，信号丢失会立即清空旧投票。`C` 显示共识强度；洋红色表示方向歧义，并会在 Hamming 与 CRC 之前阻止载荷释放。

“两帧”现在严格表示两张独立源帧，而不是两个 JavaScript 回调。每个几何/方向证据桶会拒绝未变化的正数 `video.currentTime`，即使 `requestAnimationFrame` 再次触发；媒体时间不可用或恒为零时，则采用实测帧间隔 72% 的去相关窗口，并夹紧在 18–55 ms。青色、紫色、洋红色三点 `EVIDENCE` 灯显示独立积累，重复回调不会点亮新节点或推进解码。

软合并器的逐单元置信度现在成为真实解码门槛，而不是闲置遥测。系统检查 252 个编码载荷单元、低于 0.32 置信门槛的总体覆盖、所有滑动 4×4 弱单元窗口，以及四个空间象限的弱点密度。稀疏孤立弱点仍可解码；覆盖低于 72% 或局部窗口弱点达到 75% 时阻止解码。局部窗口达到 62.5% 或某象限明显退化时标记为遮挡，与分散的整体弱覆盖区分。`EVIDENCE` 旁的 `Q` 显示载荷覆盖率，并以绿色、琥珀或星云洋红给出对应引导。

遮挡提示具备方向感知。最弱的规范载荷象限会通过胜出候选的旋转/镜像变换映射回相机观察到的左上、右上、左下或右下；对应的青色取景角会变为洋红星云脉冲，状态文字也直接指出观察画面中的该角。全部八种变换都保持象限一一对应，因此用户处理的是眼前真实角落，而不是解码器内部坐标。

摄像头生命周期由明确状态机管理：空闲、运行、暂停或结束。页面进入后台或轨道暂时 muted 时，会安全停止回调，并清除相位历史、软证据、方向投票、时间/负载模型和未完成的 Fountain 会话。只有页面重新可见、同一轨道仍为 live 且未 muted 时才允许恢复，并从全新同步开始；ended 轨道绝不会被复用，界面会要求明确重新启动扫描。启动失败也会停止已经取得的全部轨道，避免摄像头权限泄漏。

相机调优采用纯能力驱动的渐进增强，绝不构成硬件前提。只有 `getCapabilities()` 明确声明支持连续对焦、曝光或白平衡时，系统才会通过相互隔离的 `applyConstraints()` 调用逐项启用；某一个驱动功能被拒绝不会回滚其他成功项。能力 API 缺失、不完整或抛错时不会调用任何调优约束，直接保留浏览器原生自动模式。只有连续自动对焦确实被接受后，界面才显示 `AF·AE`。

采集分辨率依据实测负载，而不是设备型号。连续 6 次热负载/冷却观察后请求 640×360 ECO，连续 20 次低负载后才请求恢复 1280×720 HD。目标会夹紧在轨道声明的宽高范围内，每次切换都通过 `getSettings()` 验证；被拒绝或表面成功但实际忽略的切换会禁用本会话后续尝试。成功切换会清除全部时序证据并重新计算 object-fit 几何，而光学采样始终保持归一化的 36×36 补丁。`GEO…·HD/ECO` 显示实际采集档位。

屏幕刷新率、PWM、相机滚动快门、自动曝光和浏览器后台节流都会影响结果。当前实现是可运行的研究原型，不承诺免标定跨设备兼容。

## Particle Code v1

ParticlePair 是项目名称，**Particle Code v1** 是当前承载数据的光学帧协议。

### 数据包

```text
21 字节数据包
├── magic          1 字节   0xA7
├── version        1 字节   0x01
├── secret length  1 字节   0x10
├── pairing secret 16 字节
└── CRC-16         2 字节

21 字节 × Hamming(12,8) = 252 个光学位
```

### 光学布局

- 总网格：18×18，共 324 个单元。
- 外边界：68 个相位与帧同步单元。
- 内部区域：16×16，共 256 个单元。
- 有效编码：252 位。
- 剩余单元：4 位确定性填充。

非对称外圈让接收端能够判断差分相位符号，并搜索四种旋转方向和镜像输入。

### 纠错能力

每个原始字节独立编码为一个 Hamming(12,8) 码字，每个码字可修复一位翻转。CRC-16 用于检测并拒绝解码后的校验和不匹配；它既不能保证发现所有损坏，也不是密码学认证码。

## 生成式光学工作室

ParticlePair 已将可靠的光学载荷层与生成式艺术层彻底分离。所有视觉模式共用经过校准的 18×18 互补双相载荷，因此切换艺术皮肤不需要更换摄像头解码器。

- 50 种可选视觉模式，分为宇宙、有机、几何、大气与合成五个系列。
- 13 个生成器家族：旋臂、光幕、涟漪、花瓣、轨道、节点、触手、云雾、编织、晶体、符文、城市与余烬。
- 支持搜索、分类筛选、每模式独立三色光谱、自动展演、选择持久化和沉浸式传输舞台。
- 界面为每种模式解释生成算法、摄像头提取方法与鲁棒性策略。
- 确定性的 Visual Quality Engine 使用固定标准载波渲染，测量鲜艳度、对比度、色相覆盖、运动连续性与综合评分，并将 8×8 色彩—运动指纹和同一渲染家族中最相近的模式比较。当前 50 模式基线为最低 63、平均 72、最低差异度 50；质量低于 60 或差异度低于 40 时审计直接失败。
- 同一渲染家族的变体会改变真实拓扑，而不只是换色：包括圆环数量、花瓣对称性、图网络步长、轨道离心率、编织角度、城市密度、符号结构和粒子流向。
- Visual DNA 将完整光学帧散列为确定性艺术种子。每个载荷都会获得可重复的星座拓扑、轨道偏置、色相相位、八位十六进制视觉校验和，以及类似 `AURORA GATE` 的可读身份。它明确属于装饰而非认证；稀疏星座在两个光学相位中保持共模，也不依赖任何摄像头特殊能力。
- Adaptive Motion Engine 测量真实动画帧率，并通过非对称迟滞在 Ultra、Balanced 与 Efficient 装饰预算之间切换：持续压力下快速降级，恢复时缓慢升级以避免画面来回跳变，忽略后台标签页的长间隔，而且永远不会降低满分辨率光学载波。用户仍可手动覆盖。
- Optical Confidence Aurora 将接收端五个独立层级——采集健康度、同步、几何共识、证据多样性和载荷覆盖——映射为实时光谱诊断。加权分数绝不替代 CRC；它会指出当前最弱层级，并区分采集、对齐、证据收集、退化和完整性就绪状态。
- Camera Channel Lab 覆盖正常、弱光、曝光漂移、失焦、传感器噪声与局部遮挡。只有恢复秘密完全一致并通过 CRC 才计为成功。
- 自适应调制会搜索同时通过正常与曝光漂移信道的最低强度，再增加 8 个百分点安全余量。

装饰运动从不直接承载协议位。静态三色光谱气氛层会在相反相位之间抵消；动态装饰保持稀疏，由 Hamming 与多帧软判决吸收残余误差。

## Particle Code v2：光学喷泉流

v2 严格保持现有 21 字节数据包和 252 位光学容量。128 位秘密被拆为四个 4 字节源块；每个分片携带一个由 15 种系统与奇偶 mask 选择的 XOR 方程。接收端在 GF(2) 上执行高斯消元：任意四个线性独立方程即可恢复秘密，顺序无关，重复方程不会增加秩。

| 字节范围 | 含义 |
|---|---|
| 0–1 | 魔数与协议版本 |
| 2–5 | 32 位会话 ID |
| 6–9 | 签发分钟 |
| 10–12 | 序号、四位方程 mask、块长度 |
| 13–16 | 四字节 XOR 载荷 |
| 17–18 | 源块数量与秘密长度 |
| 19–20 | CRC-16/CCITT-FALSE |

每个字节仍由 Hamming(12,8) 保护。会话十分钟过期、八分钟自动轮换。系统拒绝已完成会话重放、同 mask 冲突方程、未来分片、过期分片与 CRC 错误；最多保留 8 个未完成会话和 32 个已完成重放记录。

三档节奏全部是 300 ms 相位的整数倍：

- Fast：每个方程 600 ms。
- Balanced：每个方程 900 ms，也是默认模式。
- Robust：每个方程 1200 ms，适合低帧率、远距离或复杂光照。

实时方程矩阵会显示参与异或的源块、mask、序列位置、会话 TTL 和“四个独立方程才能恢复”的规则。Canvas Proof 会完整执行渲染、双相采样、Hamming、CRC 与喷泉恢复链路。

## 安全模型

光学恢复后，两台设备会分别使用 SHA-256，从域分隔符、秘密和 v2 Session ID 派生 18 位 Short Authentication String。用户必须比较三个易读词和六位十六进制指纹后再确认对端。只有用户真实核对两块屏幕时，SAS 才能发现误连或对端替换；它不能代替经过审计的认证密钥交换。

| 边界 | 当前状态 |
| --- | --- |
| 秘密材料 | 浏览器 Web Crypto 生成 128 位随机值 |
| 光学传输 | 差分调制，带有限纠错和 CRC |
| 数据加密 | 不提供 |
| 防重放 | 演示中没有到期时间或已用秘密存储 |
| 设备认证 | 光学秘密只为后续认证协议提供材料 |
| 后续链路 | 生产系统必须另行实现经过审计的认证密钥交换 |
| 安全审计 | 未完成 |

生产设计还需要加入有效期、会话绑定、一次性消费、重放检测，采用 SPAKE2、带认证的 X25519 或其他经过审查的握手方案，将长期私钥放入安全存储，并完成解析器模糊测试和独立审计。漏洞报告方式见 [SECURITY.md](./SECURITY.md)。

## 验证

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build:vercel
```

`npm test` 覆盖载波/颜色分离、干净往返解码、独立 Hamming 码字纠错、超出预算后的 CRC 拒绝、Cloudflare/Sites 生产构建以及服务端产品页面渲染检查。最后一条命令验证 Vercel 使用的原生 Next.js 构建路径。

## 已知限制

- 尚无自动边界/角点检测；当前透视恢复是五种形态的有限 Homography 搜索，并非任意四边形估计。
- 比例与偏移搜索范围有限，完整粒子码仍必须处于取景框内。
- 没有屏幕色域、相机白平衡或刷新率自动标定。
- 相机颜色串扰仍可能让少量红蓝装饰星系进入纯绿载波通道。
- Hamming 每个码字只能纠正一位错误。
- 未实现时间戳、会话绑定、已用秘密状态或防重放。
- 极端滚动快门、PWM 或曝光变化仍可能超过纠错预算。
- 实验协议不承诺向后兼容。
- 尚无公开、可复现的跨设备成功率数据集。

## 路线图

- [ ] 在有限 Homography 搜索之上增加自动角点检测与任意四边形精修
- [x] 旋转和镜像恢复
- [ ] 屏幕/相机标定流程
- [ ] 软判决解码与更强的擦除码
- [ ] 时间戳、nonce、会话绑定和防重放状态
- [ ] Android CameraX 原生接收器
- [ ] BLE/Wi-Fi 认证握手参考集成
- [ ] 可复现的多设备基准测试套件
- [ ] 独立安全审计

## 项目结构

```text
app/          页面、元数据与全局视觉样式
components/   粒子发送端、相机扫描器与实验界面
lib/          CRC、Hamming、协议封装和光学布局
tests/        协议与渲染输出验证
worker/       Cloudflare Worker/Sites 入口
public/       社交分享图与静态资源
```

## 贡献

兼容性测试、研究资料、问题报告与可复现测量数据都有价值。由于项目可能提供单独商业授权，在签署适当贡献协议前不会自动接受代码贡献。提交前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证与商业使用

Copyright © 2026 tianrking。

代码依据 [PolyForm Noncommercial License 1.0.0](./LICENSE) 提供。它允许许可条款覆盖的非商业研究、学习、实验、修改与再分发，但**不授予**商业产品、付费服务、创收客户项目、企业内部商业运营、商业硬件、商业 SDK 或其他商业活动中的使用权。

商业使用必须取得版权所有者的明确书面许可，或另行签署能够识别被许可方与授权范围的商业许可证。Fork、部署、Issue 回复、Pull Request、仓库访问或保持沉默均不构成许可。必须保留 [NOTICE](./NOTICE)，并在提出商业咨询前阅读 [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md)。如果本摘要与许可证正文存在差异，以许可证正文为准。

## 研究参考

ParticlePair 为独立设计，以下屏幕—相机通信项目提供了重要研究背景：

- [HiLight — Real-Time Screen-Camera Communication Behind Any Scene](https://dartnets.cs.dartmouth.edu/hilight)
- [ChromaCode — A Fully Imperceptible Screen-Camera Communication System](https://walleve.github.io/ChromaCode/)
- [libcimbar — Color Icon Matrix Barcodes](https://github.com/sz3/libcimbar)
- [TXQR — Transfer data via animated QR codes](https://github.com/divan/txqr)

这些项目仅作为研究背景。ParticlePair 不复制它们的协议格式，也不声称兼容任何商业设备的私有配对协议。
