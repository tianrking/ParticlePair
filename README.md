# ParticlePair

> 将一次性配对秘密隐入动态粒子云，并通过相机连续帧恢复的实验性光学带外配对协议。

![Status: Experimental](https://img.shields.io/badge/status-experimental-f97316)
![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-0f766e)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![Node](https://img.shields.io/badge/Node-%3E%3D22.13-339933)

![ParticlePair preview](public/og.png)

ParticlePair is a source-available optical out-of-band pairing experiment. A sender encodes a 128-bit one-time secret into an animated particle cloud; a camera receiver recovers it from opposite modulation phases, corrects limited bit errors, and rejects frames that fail integrity validation.


## 重要声明

- ParticlePair 是独立设计的实验协议，不兼容、不隶属于，也不是对 Apple Watch 私有配对协议的逆向实现。
- 项目尚未接受生产级密码学或硬件安全审计。
- 当前自动化测试验证了协议封装、纠错、CRC拒绝和页面构建；真实双设备相机路径已经实现，但尚未在大规模设备矩阵上完成标定。
- 本仓库是 **source-available（源码可见）**，不是 OSI 定义的开源软件。
- 仅允许 [PolyForm Noncommercial 1.0.0](LICENSE) 覆盖的非商业用途。任何商业使用都需要单独书面授权，参见 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)。

## 工作原理

```text
128-bit one-time secret
          │
          ▼
  protocol frame + CRC-16
          │
          ▼
 Hamming(12,8) error correction
          │
          ▼
 252 bits mapped into an 18×18 grid
          │
          ▼
 opposite luminance phases in particle cloud
          │ camera frame differencing
          ▼
 sync → decode → correct → CRC verify → release secret
```

人眼主要看到持续旋转、呼吸和聚散的粒子云。机器将两个相反相位的画面相减，抵消静态背景与大部分整体曝光偏移，再利用边界同步图案判断差分相位的正负，恢复内部数据位。

## 已实现能力

- 生成或输入 16 字节（128 位）一次性秘密；
- 21 字节 Particle Code v1 协议帧；
- CRC-16/CCITT-FALSE 完整性检查；
- Hamming(12,8) 单比特纠错；
- 18×18 光学网格与非对称相位同步边界；
- 300ms 双相亮度调制；
- Canvas 2D 粒子云渲染；
- 浏览器摄像头接收；
- 中心裁剪、下采样、曝光漂移抵消和同步相关检测；
- 注入多处独立码字错误的本机闭环测试；
- 响应式中文实验界面；
- Cloudflare Worker / Sites 生产构建。

## 快速开始

### 环境

- Node.js 22.13 或更高版本；
- npm；
- 支持 Canvas、Web Crypto 和 `getUserMedia()` 的现代浏览器；
- 真实扫描需要 HTTPS 或浏览器认可的本地安全上下文。

### 安装与运行

```bash
git clone https://github.com/<your-account>/particle-pair.git
cd particle-pair
npm install
npm run dev
```

打开终端显示的本地地址。

### 本机闭环测试

1. 点击“生成新秘密”；
2. 点击“闭环自检”；
3. 程序会主动翻转三个属于不同 Hamming 码字的数据位；
4. 解码器应纠正错误并通过 CRC 校验；
5. 解码结果必须与发送秘密一致。

### 双设备相机扫描

1. 在第一台设备上打开页面并保持粒子云可见；
2. 建议先把“调制强度”提高到 80% 以上；
3. 在第二台带摄像头的设备上打开同一页面；
4. 点击“打开摄像头扫描”并授予相机权限；
5. 将第一台设备的粒子云完整对准取景框；
6. 保持距离、角度和曝光稳定，等待同步和 CRC 校验完成。

不同屏幕刷新率、PWM、相机滚动快门、自动曝光和浏览器帧率都会影响结果。当前实现是可运行的研究原型，不承诺跨设备即插即用。

## Particle Code v1

ParticlePair 是项目名称；Particle Code v1 是当前承载数据的光学帧协议名称。

### 数据包

```text
21-byte packet
├─ magic          1 byte   0xA7
├─ version        1 byte   0x01
├─ secret length  1 byte   0x10
├─ pairing secret 16 bytes
└─ CRC-16         2 bytes

21 bytes × Hamming(12,8) = 252 optical bits
```

### 光学布局

- 总网格：18×18，共 324 个单元；
- 外边界：68 个相位与帧同步单元；
- 内部区域：16×16，共 256 个单元；
- 有效编码：252 位；
- 剩余单元：4 位确定性填充。

外圈使用非对称同步序列，使接收端能够在不知道当前显示相位的情况下判断差分符号。当前扫描器假定发送画面保持预期方向，不处理 90° 旋转或镜像。

### 纠错能力

每个原始字节独立编码为一个 Hamming(12,8) 码字。实现可修正每个码字中的一个翻转位。CRC-16 用于拒绝未被纠错覆盖的损坏，但 CRC 不是密码学认证码。

## 安全模型

| 边界 | 当前状态 |
| --- | --- |
| 密钥材料 | 通过浏览器 Web Crypto 生成 128 位随机值 |
| 光学传输 | 双相差分调制，带有限纠错和 CRC |
| 数据加密 | 不提供 |
| 防重放 | 演示中未实现到期时间和已用秘密存储 |
| 设备认证 | 光学秘密仅提供后续认证所需材料 |
| 后续链路 | 生产系统必须另行实现经过认证的密钥交换 |
| 安全审计 | 未完成 |

生产实现至少还需要：

1. 为秘密添加短有效期、会话标识和使用次数限制；
2. 对已使用秘密进行安全的重放检测；
3. 使用 SPAKE2、X25519 配合认证数据，或其他经过审查的握手协议；
4. 把长期私钥放在适当的硬件或系统密钥存储中；
5. 对相机输入、协议解析和拒绝服务边界进行模糊测试；
6. 完成真实设备攻击测试和独立安全审计。

详细报告方式参见 [SECURITY.md](SECURITY.md)。

## 验证

```bash
npm run lint
npx tsc --noEmit
npm test
```

`npm test` 会运行：

- 干净光学帧的编码/解码往返；
- 三个独立 Hamming 码字的单比特纠错；
- 超出纠错预算后的 CRC 拒绝；
- 生产构建；
- 服务端产品页面渲染检查。

GitHub Actions 配置位于 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。

## 已知限制

- 尚无透视变换或自动角点检测，扫描时依赖用户手动对准；
- 当前不识别 90° 旋转或镜像输入；
- 没有针对不同屏幕色域和相机白平衡的自动校准；
- 装饰粒子运动仍会向差分信号引入噪声；
- Hamming 只能修正每个码字中的一个错误；
- 未实现时间戳、会话绑定和防重放状态；
- 浏览器后台节流会破坏稳定相位；
- 当前协议没有向后兼容承诺；
- 尚未形成公开的真实设备成功率数据集。

## 路线图

- [ ] 自动检测光学码边界与透视校正；
- [ ] 旋转、镜像检测与方向恢复；
- [ ] 相机曝光和屏幕刷新率标定流程；
- [ ] 软判决解码与更强的纠删码；
- [ ] 协议时间戳、nonce 和防重放状态；
- [ ] Android CameraX 原生接收器；
- [ ] 与 BLE/Wi-Fi 认证握手的参考集成；
- [ ] 多设备测试矩阵与可复现测量工具；
- [ ] 独立安全审计。

## 项目结构

```text
app/          页面、元数据与全局视觉样式
components/   粒子发送端、摄像头扫描器和实验界面
lib/          CRC、Hamming、协议封装和光学布局
tests/        协议与服务端渲染测试
worker/       Cloudflare Worker / Sites 入口
public/       社交分享图片与静态资源
```

## 贡献

兼容性测试、论文资料、问题报告和测量数据均有价值。由于项目保留单独商业授权的可能性，目前不自动接受未签署贡献协议的代码。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证与商业使用

Copyright © 2026 tianrking.

代码以 [PolyForm Noncommercial License 1.0.0](LICENSE) 提供：

- 允许许可证覆盖的个人研究、学习、实验和非商业修改；
- 允许符合许可证条件的非商业再分发；
- 不授予商业产品、付费服务、商业硬件、商业 SDK 或其他商业目的使用权；
- 商业使用必须获得 copyright holder 的单独书面授权。

必须保留 [NOTICE](NOTICE)。商业授权说明见 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)。许可证正文优先于 README 中的摘要。

## 研究参考

ParticlePair 的实现是独立设计，但屏幕—相机通信领域已有重要研究和工程项目：

- [HiLight — Real-Time Screen-Camera Communication Behind Any Scene](https://dartnets.cs.dartmouth.edu/hilight)
- [ChromaCode — A Fully Imperceptible Screen-Camera Communication System](https://walleve.github.io/ChromaCode/)
- [libcimbar — Color Icon Matrix Barcodes](https://github.com/sz3/libcimbar)
- [TXQR — Transfer data via animated QR codes](https://github.com/divan/txqr)

这些项目仅作为研究背景；ParticlePair 不复制它们的协议格式，也不声称与任何商业设备的私有配对协议兼容。
