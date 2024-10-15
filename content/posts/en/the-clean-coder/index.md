---
title: "My Thoughts on The Clean Coder Book"
date: 2024-06-20T17:31:56+02:00
draft: false
description: "This post shares my thoughts on 'The Clean Coder' by Uncle Bob, focusing on topics that I found particularly interesting or debatable."
categories:
- books
cover:
    image: /the-clean-coder/the-clean-coder.webp
    caption: "Image Generated with [DALL.E 3](https://openai.com/dall-e-3)"
    alt: "The cover image of thoughts on The Clean Coder book."
slug: "the-clean-coder"
---

## Introduction

Some time ago, I was searching for a book related to software but not purely technical, making it easier for me to read. I was looking for something I could enjoy even with a busy mind after work.

After checking my Goodreads to-read list, I decided to read [The Clean Coder](https://amzn.to/3BDCiVJ) and started right away. The book's introduction hooked me, and I ended up reading it to the end.

To clarify, this post is not a review. There are already plenty of reviews for this book. This post is simply some of my thoughts on topics that were particularly interesting or debatable for me.

## Saying No, at Any Cost

For a software engineer or a manager, it's common to face situations where a product manager or stakeholders ask to meet a deadline without enough time or resources. In these situations, many of us, including myself before reading this book, respond with “I will try.”

But this response creates an expectation that might not align with the reality that the task may not meet the deadline. By saying this, we often work overtime or on weekends, accepting significant risks, which I written in more details in the post [Managing Overdue Tasks](/managing-overdue-tasks).

Uncle Bob states in Chapter 2 that you have to say no at any cost. It is not reasonable to say, “Okay, I will try.” However, sometimes the decision is already made, and you cannot alter it. In this scenario, I believe it's more pragmatic to communicate the situation to your manager or stakeholders as much as possible. They might have some incorrect assumptions about the technical details. After that, as engineers, we should try to find and offer alternatives to meet the deadline, even if it means cutting some corners. And to make it clear, by saying cutting corners I don’t mean reducing writing unit tests or deploying carelessly.

## Know the Basics

Over time, the abstraction in software engineering has increased. With higher abstraction, there's much less need to know the basics of our field. If you have a computer science background, you've already studied most of them, but if you're from another field, you're likely to miss some.

Even though I studied computer engineering, I've forgotten a lot and sometimes only remember the titles.

But it's still important to read or review them. Despite hundreds of new ideas in our field each year, we can still improve our thinking and creativity by strengthening our computer knowledge muscles. Maybe there's no need to implement a merge sort for the rest of your life (except in interviews) with new AI tools, but the idea behind merge sort is still valid.

Uncle Bob recommends a list of areas that every software professional should be familiar with:

> - Design patterns. You ought to be able to describe all 24 patterns in the GOF book and have a working knowledge of many of the patterns in the POSA books.
> - Design principles. You should know the SOLID principles and have a good understanding of the component principles.
> - Methods. You should understand XP, Scrum, Lean, Kanban, Waterfall, Structured Analysis, and Structured Design.
> - Disciplines. You should practice TDD, Object-Oriented design, Structured Programming, Continuous Integration, and Pair Programming.
> - Artifacts: You should know how to use: UML, DFDs, Structure Charts, Petri Nets, State Transition Diagrams and Tables, flow charts, and decision tables.

By doing these kinds of exercises, our computer muscles become more powerful, and I believe that at some points in our careers, this will help us.

## Practice at Home, Perform at Your Job

I remember periods in my career when I didn't learn much at work. I got upset and thought it had to be a short-term issue, so I tried to learn on my own. I read books and did some side projects like the [Expedition Diaries](/side-projects/#-expedition-diaries). Although I might not have been wrong, the idea of "Practice at Home, Perform at Your Job" changed my mindset.

Uncle Bob compares programmers to musicians. A musician always practices to learn new things during training and at home, and when performing in a concert, they use their knowledge and skills without expecting to learn new things. As programmers, we should use our knowledge at work and not expect our employer to provide learning opportunities. If they do, that's great. But we shouldn't expect it because they already pay us for doing our job, and it's not their responsibility to teach us.

This changed my mind because now, if I find myself in a situation where I can't learn from my current job, I know it's not my employer’s responsibility. It's mine. By accepting this, I can make better decisions without complaining. I can do side projects, read books, or even change my job.

## Know the Domain of Your Product

Another interesting topic the book discusses, and one that was a reminder for me, is knowing the domain of our team, project, and company. Developers write code for a product. By understanding the product domain and its metrics, it’s easier to collaborate with product people and stakeholders. It gives us the power to make better trade-offs and long-term decisions for the product.

Uncle Bob recommends that when joining a team, you should read some books, talk to experts, or talk to customers to get a better understanding of the domain.

In my experience, product owners and managers prefer to work with developers who understand the domain and help them make better decisions rather than those who just accept everything and act like coding machines. This is a huge benefit for every product team.

## Conclusion

"The Clean Coder" is a simple and easy-to-read book that I enjoyed a lot. Although there were some parts I didn't fully agree with, it offered new and helpful content for me.

If you are a beginner in your career, reading this book can definitely help you. If you are an experienced coder, there are topics that may still interest you.
