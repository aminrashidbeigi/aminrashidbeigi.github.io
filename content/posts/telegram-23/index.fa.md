---
title: "Go v1.22"
date: 2024-02-15T17:48:38Z
slug: "go-v1-22"
tags:
- "go"
categories:
- "کانال تلگرام"
topics:
- engineering
telegram: "https://t.me/aminrbg/23"
---

در روزهای اخیر Go v1.22 عرضه شد. از مهمترین تغییرات این نسخه، اضافه شدن امکان loop زدن بر روی یک integer هستش. مثل کد زیر:

```go

package main

import "fmt"

func main() {
  for i := range 10 {
    fmt.Println(10 - i)
  }
}
```

یک بهبود مهم دیگری که توی این نسخه دادن اینه که تغییراتی روی Garbage Collector صورت گرفته که باعث می‌شه که ۱ تا ۳ درصد در مصرف CPU و حدود ۱ درصد در مصرف مموری صرفه‌جویی بشه.

به نظر ایدهٔ خوبیه که به فکر آپگرید نسخهٔ اپلیکیشنتون به ۱.۲۲ باشین 😉

برای جزئیات بیشتر تغییرات این نسخه [Release Note](https://go.dev/doc/go1.22) رسمی رو بخونین.
