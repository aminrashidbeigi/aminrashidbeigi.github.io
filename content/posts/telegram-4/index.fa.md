---
title: "You Cannot Have Exactly-Once Delivery"
date: 2023-10-30T22:27:41Z
slug: "you-cannot-have-exactly-once-delivery"
tags:
- "distributed systems"
categories:
- "کانال تلگرام"
topics:
- engineering
telegram: "https://t.me/aminrbg/4"
---

نویسنده می‌گه که توی دنیای سیستم‌های توزیع‌شده، این که تضمین کنیم یک پیام دقیقاً یک بار به دست گیرنده برسه افسانه‌ای بیش نیست. چون از طرفی برای این که مطمئن باشیم پیام به دست گیرنده رسیده، باید acknowledge بگیریم. حالا اگر ack نگیریم احتمالاً باید فرض کنیم که پیام نرسیده و پس میایم retry می‌کنیم. از طرف دیگه ممکنه واقعا رسیده باشه و ack به دست ما نرسیده باشه. در این حالت با retry کردن پیام چند بار به دست گیرنده می‌رسه.

معمولاً به جای روش ارسال پیام به صورت exactly-once، از دو شیوهٔ at-most-once و at-least-once استفاده می‌شه. البته برای بیشتر کاربردها از at-least-once استفاده می‌کنیم که مطمئن باشیم پیام مورد نظر حداقل یک بار به دست گیرنده رسیده. توی این حالت برای این که مشکلی پیش نیاد، توی طراحی‌هامون باید اصل idempotency رعایت شده باشه. idempotent بودن هم به این معنیه که اگر یک درخواست رو چندین بار تکرار کنیم، خروجی‌های یکسانی داشته باشیم و سیستم با تکرار درخواست‌ها توی استیت‌های متفاوتی قرار نگیره.

<strong>🔗</strong>  [**لینک**](https://bravenewgeek.com/you-cannot-have-exactly-once-delivery/) [**مقاله**](https://bravenewgeek.com/you-cannot-have-exactly-once-delivery/)
