---
title: 一次图片嵌入失败的解剖
date: 2026-08-18
env: python-docx
sample: Elsevier PDF
tag: 排障
summary: 期刊 PDF 提取的 JPEG 嵌入 docx 报 UnrecognizedImageError。根因 Adobe APP14 头，python-docx 只认 JFIF，PIL 转存即愈。
obs: 报错信息只指到门口，真正的根因常在文件头的两个字节里。
---

从 Elsevier 期刊 PDF（PyMuPDF 提取）得到的图片，嵌进 python-docx 时报 `UnrecognizedImageError`。

根因在文件头：这些图是 **Adobe APP14 型 JPEG**，文件头为 `ffd8 ffee`（常伴随 CMYK）。python-docx 只认标准 JFIF 头 `ffd8 ffe0 / ffe1`。PIL 能正常打开（报 mode RGB），问题只在 python-docx 的头识别这一步。

解决办法一句话：

```
Image.open(p).convert('RGB').save(out, 'JPEG', quality=90)
```

转存成标准 JPEG 再嵌入即可。中文字体用 `run.font.name='Times New Roman'` 配合 `rFonts` 的 `w:eastAsia='宋体'` 设置。

> 一句话：报错信息只指到门口，真正的根因常在文件头的两个字节里。
