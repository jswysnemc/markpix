#!/bin/bash
# MarkPix macOS 一键编译脚本
# 适用：Apple 芯片（M1/M2/M3/M4）与 Intel Mac；国内网络已做镜像优化
# 用法：在“终端”中执行  bash 一键编译MarkPix.command
# 可选：UNIVERSAL=1 bash 一键编译MarkPix.command   生成同时支持 M 芯片和 Intel 的通用包

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
LOG="$PROJECT_DIR/build-log.txt"
: > "$LOG"

# 终端输出同时写入 build-log.txt，便于失败时排查
exec > >(tee -a "$LOG") 2>&1

info() { printf "\033[1;36m%s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m%s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m%s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m%s\033[0m\n" "$*"; }

trap 'fail "编译失败：请把本项目目录下的 build-log.txt 发给开发者排查。"; exit 1' ERR

NODE_VERSION="v22.14.0"
NODE_HOME="$HOME/.local/node"

info "=============================================="
info " MarkPix macOS 一键编译"
info "=============================================="
info "项目目录：$PROJECT_DIR"
info "日志文件：$LOG"

if [ ! -f "$PROJECT_DIR/package.json" ] || [ ! -d "$PROJECT_DIR/src-tauri" ]; then
  fail "没有找到项目文件（package.json / src-tauri）。"
  fail "请确认脚本与项目在同一个文件夹内，且已完整解压。"
  exit 1
fi

ARCH="$(uname -m)"
info "CPU 架构：$ARCH"
if [ "$ARCH" = "arm64" ]; then
  info "检测到 Apple 芯片，将编译 arm64 版本。"
else
  warn "当前为 Intel 架构，将编译 x86_64 版本。"
fi

# ------------------------------------------------------------
# 1. Xcode 命令行工具（系统自带编译器的前置依赖）
# ------------------------------------------------------------
if xcode-select -p >/dev/null 2>&1; then
  ok "Xcode 命令行工具已安装：$(xcode-select -p)"
else
  warn "未检测到 Xcode 命令行工具，正在打开系统安装窗口..."
  xcode-select --install >/dev/null 2>&1 || true
  warn "请在弹出的窗口中点击“安装”，等待完成（通常 5~15 分钟）。"
  warn "安装完成后回到本窗口按一次回车继续..."
  read -r _

  i=0
  while ! xcode-select -p >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 90 ]; then
      fail "等待超时：仍未检测到 Xcode 命令行工具。"
      fail "请手动执行：xcode-select --install"
      fail "若提示路径无效，请执行：sudo xcode-select --reset"
      exit 1
    fi
    sleep 10
  done
  ok "Xcode 命令行工具安装完成"
fi

# ------------------------------------------------------------
# 2. Node.js（优先复用；否则从国内镜像安装到 ~/.local/node，无需 sudo）
# ------------------------------------------------------------
node_is_compatible() {
  "$1" -e 'const v=process.versions.node.split(".").map(Number);process.exit((v[0]>22||(v[0]===22&&v[1]>=12)||(v[0]===20&&v[1]>=19))?0:1)' >/dev/null 2>&1
}

NODE_BIN=""
if [ -x "$NODE_HOME/bin/node" ] && node_is_compatible "$NODE_HOME/bin/node"; then
  NODE_BIN="$NODE_HOME/bin"
  ok "复用本地 Node：$("$NODE_HOME/bin/node" -v)"
elif command -v node >/dev/null 2>&1 && node_is_compatible "$(command -v node)"; then
  NODE_BIN="$(dirname "$(command -v node)")"
  ok "使用系统 Node：$(node -v)"
else
  if command -v node >/dev/null 2>&1; then
    warn "当前 Node 版本 $(node -v) 不满足要求（需要 20.19+ 或 22.12+）。"
  else
    warn "未检测到 Node.js。"
  fi
  warn "正在从 npmmirror 安装 Node $NODE_VERSION 到 $NODE_HOME ..."

  case "$ARCH" in
    arm64) NODE_ARCH="arm64" ;;
    x86_64) NODE_ARCH="x64" ;;
    *)
      fail "不支持的 CPU 架构：$ARCH"
      exit 1
      ;;
  esac

  NODE_URL="https://registry.npmmirror.com/-/binary/node/$NODE_VERSION/node-$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
  TMP_TGZ="/tmp/markpix-node-$NODE_VERSION.tar.gz"

  mkdir -p "$NODE_HOME"
  info "下载：$NODE_URL"
  curl -fL --retry 3 --connect-timeout 20 "$NODE_URL" -o "$TMP_TGZ"
  tar -xzf "$TMP_TGZ" -C "$NODE_HOME" --strip-components=1
  rm -f "$TMP_TGZ"

  NODE_BIN="$NODE_HOME/bin"
  ok "Node 安装完成：$("$NODE_HOME/bin/node" -v)"

  if ! grep -q 'MARKPIX_NODE' "$HOME/.zshrc" 2>/dev/null; then
    {
      echo ''
      echo '# MarkPix local node'
      echo "export PATH=\"$NODE_HOME/bin:\$PATH\""
    } >> "$HOME/.zshrc"
  fi
fi
export PATH="$NODE_BIN:$PATH"

# 项目级 npm 镜像，不修改用户全局配置
echo "registry=https://registry.npmmirror.com" > "$PROJECT_DIR/.npmrc"
ok "npm 使用国内镜像：registry.npmmirror.com"

# ------------------------------------------------------------
# 3. Rust（rsproxy 国内镜像）
# ------------------------------------------------------------
if command -v cargo >/dev/null 2>&1; then
  ok "Rust 已安装：$(cargo -V)"
  RUST_VER="$(rustc -V | awk '{print $2}')"
  RUST_MAJOR="$(echo "$RUST_VER" | cut -d. -f1)"
  RUST_MINOR="$(echo "$RUST_VER" | cut -d. -f2)"
  if [ "$RUST_MAJOR" -eq 1 ] && [ "$RUST_MINOR" -lt 80 ]; then
    warn "当前 Rust $RUST_VER 偏旧，可能无法编译 Tauri 2。"
    if command -v rustup >/dev/null 2>&1; then
      warn "正在通过 rsproxy 更新 Rust stable ..."
      export RUSTUP_DIST_SERVER="https://rsproxy.cn"
      rustup update stable
    else
      fail "请手动安装最新版 Rust：https://rustup.rs"
      exit 1
    fi
  fi
else
  warn "未检测到 Rust，正在通过 rsproxy 安装（无需 sudo）..."
  export RUSTUP_DIST_SERVER="https://rsproxy.cn"
  export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh -s -- -y --profile minimal

  # shellcheck disable=SC1090
  . "$HOME/.cargo/env"
  ok "Rust 安装完成：$(cargo -V)"
fi
export PATH="$HOME/.cargo/bin:$PATH"

if ! grep -q 'cargo/env' "$HOME/.zshrc" 2>/dev/null; then
  {
    echo ''
    echo '# MarkPix rust'
    echo '. "$HOME/.cargo/env"'
  } >> "$HOME/.zshrc"
fi

# ------------------------------------------------------------
# 4. 项目级 Cargo 镜像（不覆盖用户已有的全局配置）
# ------------------------------------------------------------
CARGO_CFG="$PROJECT_DIR/src-tauri/.cargo/config.toml"
mkdir -p "$(dirname "$CARGO_CFG")"
if [ ! -f "$CARGO_CFG" ]; then
  cat > "$CARGO_CFG" <<'EOF'
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"

[net]
git-fetch-with-cli = true
EOF
  ok "已配置项目级 Cargo 国内镜像（rsproxy）"
else
  ok "检测到已有 Cargo 配置，保持不变：$CARGO_CFG"
fi

# ------------------------------------------------------------
# 5. 安装前端依赖
# ------------------------------------------------------------
info ""
info "==== 安装前端依赖（npm install）===="
npm install --no-audit --no-fund

# ------------------------------------------------------------
# 6. 编译
# ------------------------------------------------------------
info ""
info "==== 开始编译（首次约 10~30 分钟，请保持联网）===="

if [ "${UNIVERSAL:-0}" = "1" ]; then
  warn "已启用通用包编译：同时支持 Apple 芯片与 Intel"
  export RUSTUP_DIST_SERVER="https://rsproxy.cn"
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  npm run tauri build -- --target universal-apple-darwin
else
  npm run tauri build
fi

# ------------------------------------------------------------
# 7. 结果
# ------------------------------------------------------------
DMG_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/dmg"
APP_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/macos"

info ""
info "=============================================="
ok " 编译完成"
info "=============================================="

if [ -d "$DMG_DIR" ]; then
  info "安装包（dmg）："
  ls -1 "$DMG_DIR"/*.dmg 2>/dev/null || true
fi
if [ -d "$APP_DIR" ]; then
  info "应用程序（app）："
  ls -1 "$APP_DIR"/*.app 2>/dev/null || true
fi

info "目录：$DMG_DIR"
open "$DMG_DIR" >/dev/null 2>&1 || true

info ""
ok "下一步：打开 dmg，把 MarkPix 拖进“应用程序”即可。"
warn "首次打开若被系统拦截：右键 MarkPix -> 打开 -> 再点“打开”。"
info ""
info "按回车关闭本窗口。"
read -r _
