---
title: 吊销检查引发的安装悬案
date: 2026-08-12
env: Windows + Git Bash
sample: GitHub raw
tag: 安装
summary: curl 抓 raw.githubusercontent 反复报 CRYPT_E_REVOCATION_OFFLINE。换托管 Python 的 urllib（OpenSSL 不做 Windows 吊销检查）一次通过。
obs: 同一份代码，换一条 TLS 栈，结论完全不同——排查时先怀疑环境，再怀疑自己。
---

从 GitHub 安装技能时，`curl` 抓 `raw.githubusercontent.com` 反复报 `CRYPT_E_REVOCATION_OFFLINE`，`curl` 还偶发 `error 23` 写文件失败。

根因是 **Windows schannel 的证书吊销检查**在离线/受限网络下会卡死。托管 Python 用的是 OpenSSL，不做 Windows 的吊销检查，所以换用它抓取原始文件一次通过：

```
urllib.request.urlopen(url).read()
```

配套坑：Git Bash 的 `/tmp` 与 Windows 原生 Python 解析的 `/tmp` 不是同一目录。文件要写到明确的 Windows 绝对路径（如 `C:/Users/wsj19/...`），两边才能一致访问。

> 一句话：同一份代码，换一条 TLS 栈，结论完全不同——排查时先怀疑环境，再怀疑自己。
