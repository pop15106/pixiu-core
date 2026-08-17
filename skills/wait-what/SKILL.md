---
disable-model-invocation: true
name: wait-what
description: 使用者主動要求「等等這是什麼／重講一次／我沒懂」時使用的零副作用解釋入口。沿用目前 CONTEXT.md vocabulary，以具體例子先行、ASD-STE100 精神重講，不改變任務、Decision 或檔案狀態。
---

# Wait What

## 目的

在不改變目前 workflow 狀態的前提下，把剛才的技術或 domain 概念重新講清楚。

## 規則

1. 優先使用目前 repo `CONTEXT.md` 已定義的 canonical term。
2. 先給一個具體、最小例子，再說抽象規則。
3. 句子短、主詞明確、一次表達一個主要動作。
4. 保留必要技術名詞；第一次出現時立即定義。
5. 不新增 Decision、不 resolve Decision、不 reopen branch。
6. 不修改檔案、不派 agent、不執行 implementation。
7. 解釋完成後回到原任務原狀態。
