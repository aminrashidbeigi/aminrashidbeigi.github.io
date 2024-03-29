---
title: "چرا به منتور نیاز داریم؟"
description: "احتمالاً تا به حال در مقطعی از مسیر شغلیتون احساس کردین که برای تصمیم‌گیری در مورد یک انتخاب، یک دوراهی و یا حل کردن یک چالش به کمک نیاز دارین. راهنمایی گرفتن از منتور یکی از راه‌حل‌هاست. اما به چه کسی می‌گیم منتور؟ داشتن یک منتور کجاها می‌تونه به ما کمک کنه؟ توی این نوشته سعی شده به این سوال‌ها جواب داده بشه."
date: 2023-12-01T09:37:47+03:30
draft: false
tags:
- منتورشیپ
- اهمیت داشتن منتور
- فواید داشتن منتور
- توسعه مسیر شغلی
categories:
- مسیر شغلی
cover:
    image: /fa/چرا-به-منتور-نیاز-داریم/mentorship-meeting.jpeg
    caption: "تصویر ساخته شده توسط [DALL.E 3](https://openai.com/dall-e-3)"
    alt: "دو نفر در یک جلسه منتورشیپ با هم صحبت می‌کنند."
slug : "چرا-به-منتور-نیاز-داریم"
aliases:
- /fa/blog/چرا-به-منتور-نیاز-داریم
---

## یک تجربه

### پردهٔ اول: برنامه‌نویس جونیور

چندین سال پیش در اوایل تجربه‌ٔ کاریم به عنوان برنامه‌نویس بک‌اند جونیور وارد یک شرکت شدم. غیر از من همهٔ تیم سینیور بودن و قرار بود که من از هم‌تیمی‌های باتجربه‌ترم یاد بگیرم و در کنارشون رشد کنم. بعد از چند ماه، همهٔ افراد تیم فنی شرکت رو ترک کردن و به مدت چند ماه و تا استخدام افراد جدید، من به تنهایی باید پروژه رو پیش می‌بردم. توی این بازه خوشحال بودم که مسئولیت پروژه به کلی به من سپرده شده. اما به مرور با چالش‌های مختلفی مواجه شدم.

تیم مارکتینگ به یک سرویس Push Notification نیاز داشت که تا طول روز چندین میلیون پیام به کاربرها بفرستن. من سرویس رو نوشتم و تست هم کردم و همه چی درست کار می‌کرد. اما وقتی تحویل تیم مارکتینگ دادم مشکلات زیادی پیش اومد. طوری که من هر sprint چند روز رو به حل کردن مشکلات این سرویس اختصاص می‌دادم.

کدی که نوشته بودم به چه شکلی کار می‌کرد؟ تیم مارکتینگ یک فایل شامل چند میلیون شماره رو در یک فرم وارد می‌کردن و من با توجه به قالب پیامی که تعیین کرده بودن، به ترتیب برای تک تک شماره‌ها پوش نوتیفیکشن می‌فرستادم. وقتی همهٔ پیام‌ها فرستاده می‌شد، من response موفقیت‌آمیز و در غیر این صورت خطا برمی‌گردوندم.

سرویس چه مشکلاتی داشت؟

1. با تعداد شماره‌های کم به خوبی کار می‌کرد (چیزی که به صورت local تست کرده بودم) ولی وقتی لیست شماره تلفن‌ها زیاد می‌شد (کاربرد نهایی) requestای که ارسال می‌شد خیلی طول می‌کشید تا response رو بگیره و فرم در حالت loading باقی می‌موند؛ چون باید همهٔ ریکوست‌ها ارسال می‌شد. این مشکل به جایی رسید که درخواست ارسالی timeout می‌شد. راه حل من چی بود؟ افزایش timeout از یک به ده دقیقه (!).
2. بعضی وقت‌ها به دلایلی مثل timeout شدن و یا اختلال شبکه خطا برگردونده می‌شد. وقتی این اتفاق می‌افتاد تیم مارکتینگ نمی‌دونست که الان از این چند میلیون شماره، برای چه تعدادیشون پوش فرستاده شده. در این شرایط راه حل چی بود؟ یا تسک رو تموم شده بدونیم و فایل رو مجدداً آپلود نکنیم که باعث می‌شد تعداد نامعلومی از مشتری‌ها پوش‌ رو دریافت نکنن و به این شکل عملکرد تیم مارکتینگ قابل اندازه‌گیری نبود؛ یا این که از اول فایل رو آپلود کنیم و پوش‌ها رو بفرستیم که باعث می‌شد که تعداد نامشخصی از کاربرها ۲ بار پوش دریافت کنن که این مورد باعث نارضایتی کاربرها، میوت کردن پوش نوتیفیکیشن و در نهایت کاهش اثرگذاری این سرویس می‌شد.

این دو از مشکلات جدی ما بودن که به وجودشون آگاه بودیم ولی به غیر از راه‌حل‌های سطحی، من بلد نبودم چطوری می‌شه مسئله رو به درستی حل کرد.

### پردهٔ دوم: ورود برنامه‌نویس سینیور

بعد از چند ماه یک مهندس نرم‌افزار سینیور به تیم اضافه شد. من وظیفهٔ آنبوردینگ ایشون رو بر عهده داشتم و بخش‌های مختلف پروژه‌ها رو بهش توضیح می‌دادم. وقتی سرویس Push Notification رو براش توضیح دادم چشم‌هاش گرد شد گفت «داره خوب کار می‌کنه؟» من مشکلاتی که بالاتر نوشتم رو بهش توضیح دادم. پرسید «چرا از صف استفاده نکردی؟» من گفتم «صف؟ صف چیه؟» گفت «برو [RabbitMQ](https://www.rabbitmq.com/) رو بخون و با اون پیاده سازی کن». من رفتم و با صف‌ها و امکان فرستادن درخواست به صورت async آشنا شدم و نحوهٔ پیاده‌سازی رو عوض کردم. حالا فایل‌ شماره‌ها زیر ۱ ثانیه آپلود می‌شد و به مرور درخواست‌ها پردازش می‌شدن.

اینجا پررنگ‌ترین نقش هم‌تیمی سینیور من گفتن یک کلمه به من بود. استفاده از «صف». همین یک کلمه باعث کاهش احتمال باگ خوردن، افزایش کیفیت محصول و شاید مهمتر از اون، استرس هر روزه دو نفر (من و مارکتینگ) رو از بین برد.

### پردهٔ سوم: onboarding با کیفیت

بعد از مدتی وارد شرکت دیگری شدم. شرکت جدید بلوغ بیشتری داشت و خیلی ساختارمندتر بود. هر فردی که وارد شرکت می‌شد، در یک بازه یک ماهه دورهٔ [onboarding](https://aminrb.me/onboarding-storytelling/) رو سپری می‌کرد که در این دوره باید مجموعه‌ای از مهارت‌ها رو یاد می‌گرفت تا بتونه وارد تیم‌های محصولی بشه. فرد یک ماه فرصت داشت تا این مهارت‌ها که حدوداً ۲۰ مورد بودن رو یاد بگیره. موضوعاتی مثل مقدمات فرانت‌اند، مقدمات بک‌اند، دیتابیس، مانیتورینگ، آلرتینگ، کوبرنتیس و … که  قسمت خوبی از این موارد برام جدید بودن و در اون یک ماه خیلی فشرده و با تمرکز زیادی روشون وقت گذاشتم. همزمان یک منتور هم داشتم که وظیفهٔ بررسی پیشرفت من در این دوره رو بر عهده داشت. این دوره که برای من یک دورهٔ فشردهٔ منتورشیپ با یک فرد با تجربه بود، باعث شد که دانش مهندسی نرم‌افزار من در اون یک ماه، چندین برابر تجربهٔ کار در شرکت قبلیم گسترش پیدا کنه.

## منتور کیست؟

بر روی تعریف ماهیت منتور اتفاق نظر وجود نداره و بعضاً منتور رو به فردی می‌گن که به باهاش صورت رسمی، مشخص و بلند مدت رابطه منتورشیپ داریم. اما نظر من هر فرد با تجربه‌تری که در یک حوزهٔ خاص به فرد کم‌تجربه‌تر کمک می‌کنه تا توسعه پیدا کنه و یا مسیر شغلیش رو پیش ببره رابطه منتورشیپ دارن. پس مدیرمون، هم‌تیمی باتجربه‌ترمون، یا فرد با تجربه‌تری که باهاش جلسات منتورشیپ می‌ریم می‌تونن نقش منتور رو داشته باشن.

## چرا به منتور نیاز داریم؟

### سرعت بخشیدن به پیشرفت در مسیر شغلی

زمانی که در آستانهٔ شروع یک مسیر شغلی جدید قرار می‌گیریم، اغلب نمی‌‌دونیم که باید روی چه موضوعاتی وقت بذاریم و کدوم منابع می‌تونن مفیدتر باشن. معمولاً شروع می‌کنیم به جستجو کردن، کتاب خوندن، دیدن ویدیو و یا شروع یک دورهٔ آموزشی. این روش بدون شک مفیده و اکثر موضوعاتی که یاد می‌گیریم به همین صورت شروع می‌شه. اما این شیوه می‌تونه مشکلاتی رو هم به همراه داشته باشه. مثلاً ممکنه که منابع درستی با توجه به نیازمون انتخاب نکرده باشیم و به کل مسیر غلطی رو پیش بگیریم. در این مواقع، وجود یک منتور می‌‌تونه خیلی سودمند باشه. منتور می‌تونه کمک زیادی به کسی که یک مسیر شغلی جدید رو شروع کرده بکنه؛ مثل مدیریت محصول، مهندسی نرم‌افزار، یا هر حرفهٔ تخصصی دیگری. حتی ممکنه صرفاً با یک موضوع جدیدی برخورد کرده و به راهنمایی نیاز داشته باشین. به عنوان مثال، فرض کنین که به عنوان یک مهندس نرم‌افزار، وارد تیمی شدین که مسئولیتِ کاهشِ تأخیر در پردازش Queryهای دیتابیس بهش سپرده شده. در این شرایط، یک ساعت مشورت با کسی که پیش‌تر این مسیر رو طی کرده، می‌تونه هفته‌ها و حتی ماه‌ها در وقت شما و تیم صرفه‌جویی کنه.

### گسترش حوزه‌های یادگیری

وقتی در مسیر شغلی خودتون پیش می‌رین، گاهی اوقات بنا به شرایط کاری یا منابع مطالعاتی‌ که دنبالش می‌کنین، ممکنه دیدگاهتون نسبت به مسائل محدود باشه و به موضوعات اصلی‌تر توجه کافی نداشته باشین. منتور در این شرایط کمک می‌کنه که در ابتدا شما رو از موضوعاتی که بهش آگاه نیستین مطلع کنه، و در مرحلهٔ دوم کمک می‌کنه که به صورت واقع‌بینانه‌تری بر روی موضوعات مورد نظر وقت بگذارین.

من اخیراً منتور فردی بودم که حدود یک سال تجربهٔ کاری داشت و هدفش استخدام شدن در شرکت‌های بزرگ تکنولوژی ایران بود. برای این کار برنامه‌ریزی کرده بود تا در زبان برنامه‌نویسی Golang تخصص پیدا کنه. قبل از شروع دوره انتظاراتش رو پرسیدم و گفت که علاقه‌مند به یادگیری عمیق Golang و یاد گرفتن مفاهیم پیچیده‌‌تر این زبان مثل Concurrency هستش. با وجود این که هدف خیلی منطقی و خوبی بود، ولی به تنهایی برای رسیدن به هدفش کافی نبود. توی این دوره در کنار عمیق‌تر شدن در زبان Golang، تلاش کردیم که روی موضوعات مهم دیگری که برنامه‌نویس‌ها روزمرهٔ خودشون رو باهاش سپری می‌کنن کار کنیم؛ مثل استانداردهای کامیت زدن، مسائل امنیتی در کد و مفاهیم اولیه دیتابیس مانند استفاده از index‌ها.

### محدود کردن حوزه‌های یادگیری

در بخش قبل، به اهمیت گسترش حوزه‌های یادگیری به کمک منتور اشاره کردم. از طرفی دیگر مهمه که بتونیم حوزه‌های یادگیری رو به درستی محدود کنیم. ما در عصری زندگی می‌کنیم که منابع باکیفیت بی‌شماری در دسترس هستن، اما همین امر می‌تونه گاهی اوقات باعث سردرگمی و کاهش سرعت رشد ما بشه. گاهی نیاز داریم که تصمیم بگیریم که روی برخی موضوعات و یا منابع وقت نگذاریم. اخیراً با فردی صحبت می‌کردم که هدفش یادگیری همزمان برنامه‌نویسی بک‌اند، فرانت‌اند، تحلیل داده و همچنین ماشین لرنینگ بود. این فرد مشخصاً در تعیین نیازمندی‌هاش و مسیری که باید طی کنه سردرگم شده بود و مشخصاً احتمال موفقیتش خیلی پایین بود و نیاز داشت تا فردی کمکش کنه که بتونه مسیری که می‌خواد طی کنه رو بهتر بشناسه.

### افزایش اعتماد به نفس

یکی از مشکلات رایج بین افرادی که به تازگی یک مسیر جدید رو شروع می‌کنن، کمبود اعتماد به نفسه. مدتی پیش منتور فردی بودم که از دو سال پیش شروع به [یادگیری برنامه‌نویسی](https://aminrb.me/fa/مقدمه-شروع-برنامه-نویسی/) با زبان پایتون کرده بود و در این مدت چندین دوره و ‌Bootcampهای معروف فارسی‌زبان رو گذرونده بود و پس از اتمام هر دوره، دوباره در دورهٔ دیگری شرکت کرده بود. در اولین جلسه‌ای که باهاش داشتم متوجه شدم که او کاملاً توانایی‌های لازم برای شروع کار در سطح جونیور رو داره اما به دلیل نداشتن اعتماد به نفس لازم که قسمتیش به خاطر [دغدغهٔ سن](https://aminrb.me/fa/چه-سنی-برای-شروع-برنامه-نویسی-دیر-است/) بود و قسمتی هم به خاطر نداشتن پیش‌زمینه و تحصیلات مربوط به کامپیوتر، اقدام به حضور در مصاحبه‌های شرکت‌ها نمی‌کرد و همواره در جستجوی دوره‌های جدید بود تا بتونه دانش خودش رو بهبود بده و اعتماد به نفس شرکت کردن در مصاحبه‌ها رو پیدا کنه. در طی جلسات، براش شفاف‌تر شد که حتی افراد خیلی باتجربه‌تر هم ممکنه ده‌ها بار مصاحبه‌ها رو ریجکت بشن و اتفاقاً همین فرآیند، جزوی از مسیر یادگیریه.

### دریافت بازخورد سازنده
  
ما همیشه برای پیشرفت در کارمون به بازخوردهای سازنده نیاز داریم. پذیرش این بازخوردها معمولاً زمانی برامون راحت‌‌تر می‌شه که با افرادی که کار می‌کنیم تضاد منافع نداشته باشیم. منتورها افرادی هستند که می‌تونن بدون هیچ‌گونه تعصبی به کار ما نگاه کنن و بازخوردهای ارزشمندی رو بهمون بدن. همهٔ ما مستقل از میزان حرفه‌ای بودن، تجربه و دانشی که داریم، برای پیشرفت همواره به بازخورد نیاز داریم. برای مثال، من در یک مقطعی از کارم فکر می‌کردم بهترین عملکردم رو دارم. اما بعد از مدتی منتورم بهم بازخورد داد که اگرچه مسائل و مشکلات رو خوب تشخیص می‌دم و به دنبال شفاف‌سازی اون‌ها هستم، اما در دادن راه‌حل برای مشکل موجود خیلی کند عمل می‌کنم و معمولاً صبر می‌کنم که بقیه افراد تیم راه‌حل‌هاشون رو ارائه بدن تا من جمع‌بندی کنم. در صورتی که انتظار می‌رفت با توجه به جایگاهم در تیم، خیلی سریع‌تر راه‌حلی که از نظرم منطقیه رو ارائه بدم و عملاً به راه‌حل‌های افراد جهت بدم. این بازخورد باعث شد تا متوجه موردی بشم که روی عملکرد خودم و تیمم تأثیر می‌ذاشت و خودم احتمالا هرگز متوجهش نمی‌شدم.

### گسترش شبکهٔ ارتباطی

معمولاً منتورها تجربهٔ بیشتری نسبت به شما در حوزهٔ مورد نظر دارن و این تجربه‌های زیاد رابطهٔ مستقیمی با شناختن و کار کردن با افراد مختلف داره. از طرفی به خاطر این که منتورتون زمان خوبی رو باهاتون می‌گذرونه، شناخت عمیقی نسبت بهتون و توانایی‌هاتون پیدا می‌کنه و باعث میشه که در صورت نیاز، شما رو به دیگران معرفی کنه. به این شکل، دایرهٔ ارتباطی شما گسترش پیدا می‌کنه و در آینده می‌تونه خیلی کمک‌کننده کنه.

## جمع‌بندی

داشتن منتور، فارغ از تجربه، دانش و جایگاهی که در مسیر شغلی خود دارین، می‌تونه به شما کمک کنه تا تمرکز بیشتری روی یادگیری مسائل مهم‌تر داشته باشین و از حاشیه‌ها دوری کنین. از طرفی می‌تونه انگیزه و اعتماد به نفستون را افزایش بده و بهتون کمک کنه تا با سرعت و انرژی بیشتری به اهدافتون نزدیک‌تر بشین.

در این نوشته از اهمیت و فواید داشتن منتور نوشتم. در آینده در مورد نحوهٔ پیدا کردن منتور مناسب و ویژگی‌هایی که یک منتور باید داشته باشه می‌نویسم. اگر هم خواستین من به عنوان منتور کمکتون کنم، لطفاً [زمینه‌هایی که می‌تونم کمک کنم](https://aminrb.me/fa/ways-i-help/) رو ببینین و از طریق ایمیل باهام در ارتباط باشین.
