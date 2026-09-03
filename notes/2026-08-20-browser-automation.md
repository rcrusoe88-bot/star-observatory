---
title: 浏览器自动化：DOM 文本比截图可靠
date: 2026-08-20
env: WorkBuddy + bsk
sample: 微信后台
tag: 自动化
summary: 让 Agent 抓公众号后台数据，canvas 图表页截图持续失败，改用 evaluate 直读 innerText 一次拿到全部数字。
obs: Agent 操作网页，「读 DOM」优先于「看截图」；视觉是给人的，结构是给 Agent 的。
---

让 Agent 去抓微信公众号后台的数据时，遇到一个反直觉的坑：**canvas 图表页用截图拿不到数字**。`bsk screenshot` 在 canvas 区域反复报 `image readback failed`，持久失败。

改用 `bsk evaluate` 直接读 DOM 文本就通了：

```
document.body.innerText
```

一次拿到页面上全部可读数字，比截图再 OCR 稳得多。

另外，左侧子标签用 `bsk click --ref` 偶尔不触发 SPA 路由。稳妥做法是先用 `evaluate` 取真实 href，再 `bsk navigate` 过去。重载标签页后 ref 全部失效，必须先重新 `snapshot`。

> 一句话：Agent 操作网页，「读 DOM」优先于「看截图」；视觉是给人的，结构是给 Agent 的。
