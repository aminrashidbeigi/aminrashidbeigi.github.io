---
title: "چند وقت پیش فایل‌های Protocol Buffer پروژه‌ای رو…"
date: 2024-08-19T19:33:13Z
slug: "telegram-40"
tags:
- "protobuf"
categories:
- "کانال تلگرام"
topics:
- engineering
telegram: "https://t.me/aminrbg/40"
---

چند وقت پیش فایل‌های Protocol Buffer پروژه‌ای رو مرتب‌ می‌کردم که دیدم این دو فیلد در بین چندین message پروژه تکرار شده:

```
message A {
    ...
    int64 seconds = n;
    int64 nano_seconds = m;
    ...
}
```

با توجه به این که این دو خط عیناً تکرار شده بود، یک message تعریف کردم و به جای اون دوتا فیلد از message جدید استفاده کردم:

```
message Timestamp {
    int64 seconds = 1;
    int64 nano_seconds = 2;
}
message A {
    ...
    Timestamp timestamp_utc = p;
    ...
}
```

بعداً متوجه شدم که `Timestamp` هم یکی از تایپ‌هاییه که به صورت استاندارد تعریف شده و نیازی نیست خودمون تعریف کنیم. به همین خاطر message‌ها رو به دوباره بازنویسی کردم:

```
import "google/protobuf/timestamp.proto";

message A {
    ...
    google.protobuf.Timestamp timestamp = p;
    ...
}
```

جدا از `Timestamp`، تایپ‌های `Empty` و `Duration` هم از بین تایپ‌های از پیش تعریف شدهٔ protobuf خیلی پرکاربرد هستن. لیست کامل این تایپ‌ها رو هم می‌تونید [اینجا](https://protobuf.dev/reference/protobuf/google.protobuf/) ببینید.
