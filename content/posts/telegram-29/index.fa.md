---
title: "Popular git config options - Julia Evans"
date: 2024-03-28T16:41:49Z
slug: "popular-git-config-options-julia-evans"
tags:
- "git"
categories:
- "کانال تلگرام"
topics:
- engineering
telegram: "https://t.me/aminrbg/29"
---

تنظیمات و کانفیگ‌های git در یک فایل به آدرس `~/.gitconfig` ذخیره شده. شما می‌تونین تنظیمات دیفالت گیت رو با تغییر این فایل و یا داخل پروژه و به صورت locally تغییر بدین. Julia Evans توی این پست از git configهایی نوشته که احتمالاً شما هم مثل من از خیلی‌هاشون خبر نداشتین که اتفاقاً می‌تونن خیلی هم کاربردی باشن.

چند تا از configهایی که خودم بعد از خوندن این نوشته اعمال کردم:

<strong>- اعمال کانفیگ‌های جداگانه برای کار و پروژه‌های شخصی با includeIf:</strong> من قبلاً برای پروژه‌های مختلف، به صورت local ایمیل‌های جداگانه ست می‌کردم. چندباری هم یادم رفته بود ست کنم و کامیت اشتباه زده بودم. با همچین کانفیگی این مسئله رو میشه حل کرد:

```txt
[includeIf "gitdir:~/code/<work>/"]
path = "~/code/<work>/.gitconfig"
```

<strong>- تغییر الگوریتم diff با diff.algorithm:</strong> برای شما هم پیش اومده که چند خط کد رو جابجا کنید و ببینید که diff کامیت قاطی شده و خوندن تغییراتش هم سخت شده؟ چیزی شبیه به diff زیر:

```txt
-.header {
+.footer {
     margin: 0;
}

-.footer {
+.header {
     margin: 0;
+    color: green;
}
```

حالا با تغییر الگوریتم به صورت `diff.algorithm histogram` میشه این مسئله رو حل کرد تا به تغییرات شکل زیر درآد:

```txt
-.header {
-    margin: 0;
-}
-
.footer {
     margin: 0;
}

+.header {
+    margin: 0;
+    color: green;
+}
```

- یک تغییر دیگه‌ای هم که به نظرم کاربردی اومد، کانفیگ `rebase.autosquash true` بود ولی خودم هنوز ازش استفاده نکردم. اگر تجربهٔ‌ استفاده ازش رو دارید بهم بگین حتماً.

🔗 [**لینک نوشته**](https://jvns.ca/blog/2024/02/16/popular-git-config-options/#merge-conflictstyle-zdiff3)
