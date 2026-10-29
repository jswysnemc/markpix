# MarkPix

一个现代化的图片标注工具，基于 Tauri + React + TypeScript 构建。

![MarkPix](./.assert/image.png)

## 📌 来源与修改说明

本项目基于开源项目 [jswysnemc/markpix](https://github.com/jswysnemc/markpix)（作者：snemc）修改而来。
原项目采用 MIT License，版权归原作者所有，许可证全文见 [LICENSE](./LICENSE)。

本修改版在原项目基础上做了以下修改：

**光标**
- 修订光标颜色为红色：画布使用红色十字光标，在深浅背景上都更醒目

**方框外框**
- 增加纯白方框外框：矩形描边为近白色（或未设置描边）时显示白色虚线辅助外框，便于在浅色背景上定位；该辅助框仅在编辑界面显示，导出时自动跳过

**引导序号**
- 新增引导序号：序号圆形标记 + 普通箭头，形成 CAD 风格引导注释
- 可调线条粗细、颜色、序号大小、实心/空心、箭头样式、线型
- 序号起始值可自定义（不再只能从 1 开始），快捷键 `N`

**CAD 尺寸标注（v0.6.0）**
参照 ASME Y14.5 / ISO 3098 与空客、波音图纸常用画法，新增 6 种工程图标注工具：
- 线性尺寸 `D`：尺寸线 + 尺寸界线（带间隙与超出量），支持对齐 / 水平 / 垂直三种测量方式
- 角度标注 `G`：以顶点 + 两边取点绘制圆弧尺寸，文字沿分角线方向
- 半径 / 直径 `Y`：过圆心引出线，自动补齐 `R` / `⌀` 前缀，直径标注附带中心标记
- 中心线标记 `K`：孔心十字细实线，可单击放置或拖拽定义大小
- 引线标注 `F`：指向端 + 折线 + 水平基准线 + 注释文字
- 件号气泡 `J`：圆形 / 方框件号 + 指引线，件号自动递增，可手工改写

端点符号支持三种欧美图纸惯例：实心箭头（ASME）、45° 斜线（ISO）、圆点；尺寸文字位置支持线上方（ASME）与居中打断尺寸线（ISO）两种排布。尺寸数值为手工输入，创建后直接弹出输入框，也可在属性面板随时改写（如 `12.5`、`⌀24 H7`、`45°`）。图纸线宽独立于其他标注，默认 1.6 细线，滚轮以 0.2 步长微调。

**保存与样式**
- 保存 / 另存为拆分：保存直接覆盖当前文件，另存为单独选择路径
- 所有工具样式修改后自动保存，下次启动自动恢复

**macOS 构建**
- 新增 macOS 构建支持（GitHub Actions 工作流）

除上述修改外，代码与界面均来自原项目。若需回馈上游，欢迎向上游仓库提交 Issue 或 Pull Request。

## ✨ 功能特性

### 标注工具
- **选择工具** - 选择、移动、缩放标注对象，支持实时编辑属性
- **矩形/椭圆** - 绘制矩形和椭圆形状
- **箭头/直线** - 绘制箭头和直线，支持多种箭头样式（经典、填充三角形、空心三角形）
- **文字工具** - 添加文字标注，支持普通文字和气泡样式（可调节圆角、尾巴方向）
- **画笔工具** - 自由绘制
- **序号标记** - 添加数字或字母序号标记
- **引导序号** - 序号圆形 + 指向箭头，CAD 风格引导注释（快捷键 `N`）
- **CAD 尺寸标注** - 线性尺寸、角度、半径/直径、中心线标记（ASME/ISO 端点符号与尺寸界线）
- **引线与件号** - 引线标注（折线 + 水平基准线 + 注释）与件号气泡（圆形/方框，件号自增）
- **马赛克工具** - 对敏感区域进行马赛克处理
- **裁剪工具** - 裁剪图片（支持拖动或点击两次）

### 编辑功能
- **实时属性编辑** - 选中标注后可实时修改颜色、粗细等属性
- **撤销/重做** - 支持历史记录
- **裁剪双模式** - 可保留裁剪蒙版（绿框参照）或直接应用裁剪结果为新背景
- **文字工具配置持久化** - 字体、字号、颜色、气泡样式等可跨会话保留
- **复制到剪贴板** - 一键复制标注后的图片
- **保存图片** - 导出为 PNG 格式
- **缩放/平移** - 自由查看图片, 使用鼠标中键拖拽平移，鼠标滚轮缩放大小
- **触摸板缩放优化** - 双指滚动用于平移，捏合手势用于缩放（支持的系统/WebView 环境下）

### 自定义功能
- **自定义动作** - 支持配置外部命令（如 OCR、上传图床等），可在设置界面图形化管理
- **主题切换** - 支持浅色/深色/自动（跟随系统），设置自动持久化
- **输出文件配置** - 支持自定义输出文件名模板，使用变量如 `{input_file_base}`、`{YYYY_MM_DD-hh-mm-ss}`

### 界面特性
- **顶部工具栏** - 集成标题栏，空白区域可拖动窗口
- **浮动属性面板** - 选中标注时自动显示属性编辑面板

### 性能优化
- **马赛克效果** - 使用 Kuwahara 滤镜实现油画效果，积分图优化算法保证流畅性

## 🚀 快速开始



### 安装使用

如果你是 archlinux 用户 可以使用 yay 或者 paru 来安装 `paru -S markpix-bin`  或者 `yay -S markpix-bin`
如果你是其他发行版用户 需要先安装依赖，然后在 发布页面下载对应平台的二进制文件或者包



### 环境要求（开发环境）

- Node.js 18+
- pnpm（推荐）或 npm
- Rust 1.70+
- 系统依赖（Linux）：
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf wl-clipboard
  ```

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

### 构建发布

```bash
pnpm tauri build
```

### macOS 构建（GitHub Actions）

仓库内置 `.github/workflows/macos-build.yml`，无需 Mac 电脑：

1. 打开仓库的 **Actions** 页面，左侧选择 **Build macOS**；
2. 点击 **Run workflow**，再点绿色执行按钮；
3. 构建完成后，在该次运行页面底部下载 **Artifacts → MarkPix-macOS-universal**；
4. 解压后得到 dmg，内含同时支持 Apple 芯片与 Intel 的通用包。

未签名版本首次打开时需右键点击应用 -> 选择“打开”。

## 📦 命令行使用

```bash
# 直接打开图片
markpix /path/to/image.png

# 启动即全屏（可与图片路径组合使用）
markpix --fullscreen /path/to/image.png

# 查看帮助
markpix --help
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开图片 |
| `Ctrl+S` | 保存图片 |
| `Ctrl+C` | 复制到剪贴板 |
| `Ctrl+V` | 从剪贴板粘贴 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Delete` | 删除选中标注 |
| `V` | 选择工具 |
| `H` | 手型工具 |
| `R` | 矩形工具 |
| `E` | 椭圆工具 |
| `A` | 箭头工具 |
| `L` | 直线工具 |
| `T` | 文字工具 |
| `B` | 画笔工具 |
| `M` | 序号标记 |
| `N` | 引导序号（序号 + 箭头） |
| `D` | 线性尺寸 |
| `G` | 角度标注 |
| `Y` | 半径 / 直径 |
| `K` | 中心线标记 |
| `F` | 引线标注 |
| `J` | 件号气泡 |
| `U` | 马赛克工具 |
| `C` | 裁剪工具 |

> CAD 标注采用分步取点：按住拖出首段可同时确定起止两点，其后逐点单击；`Esc` 取消未完成的标注，双击已完成的标注可改写尺寸数值。

> macOS 上组合键使用 `Control`（而非 `Command`）。

## 🔧 配置文件

配置文件位于 `~/.config/markpix/config.toml`：

```toml
# 主题设置: light, dark, auto
theme = "auto"

# 输出文件名模板
# 可用变量: {input_file_base}, {input_file}, {YYYY_MM_DD-hh-mm-ss}
output_pattern = "{input_file_base}_{YYYY_MM_DD-hh-mm-ss}_markpix.png"

# 文本工具默认配置（可选）
[text_tool_config]
stroke_color = "#ef4444"
font_size = 18
font_family = "system-ui"
text_style = "normal" # normal / bubble
bubble_stroke = ""
bubble_fill = "transparent"
bubble_tail_position = "left" # left / right

# 自定义动作
[[custom_actions]]
name = "OCR 识别"
command = "tesseract {file} stdout"
icon = "scan"

[[custom_actions]]
name = "上传到图床"
command = "curl -F 'file=@{file}' https://your-image-host.com/upload"
icon = "upload"

[[custom_actions]]
name = "打开所在文件夹"
command = "xdg-open \"$(dirname \"{file}\")\""
icon = "folder"
```

> 💡 也可以在设置界面中图形化管理自定义动作，无需手动编辑配置文件。

## 🛠️ 技术栈

- **前端**: React 19 + TypeScript + Vite
- **UI**: TailwindCSS + Lucide Icons
- **画布**: Konva.js + react-konva
- **状态管理**: Zustand
- **后端**: Tauri 2 + Rust
- **跨平台**: Linux / Windows / macOS

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
