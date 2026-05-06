# Development Workflow

> This file extends [common/git-workflow.md](./git-workflow.md) with the full feature development process that happens before git operations.

The Feature Implementation Workflow describes the development pipeline: research, planning, TDD, code review, and then committing to git.

## Feature Implementation Workflow

0. **Research & Reuse** _(mandatory before any new implementation)_
   - **GitHub code search first:** Run `gh search repos` and `gh search code` to find existing implementations, templates, and patterns before writing anything new.
   - **Library docs second:** Use Context7 or primary vendor docs to confirm API behavior, package usage, and version-specific details before implementing.
   - **Exa only when the first two are insufficient:** Use Exa for broader web research or discovery after GitHub search and primary docs.
   - **Check package registries:** Search npm, PyPI, crates.io, and other registries before writing utility code. Prefer battle-tested libraries over hand-rolled solutions.
   - **Search for adaptable implementations:** Look for open-source projects that solve 80%+ of the problem and can be forked, ported, or wrapped.
   - Prefer adopting or porting a proven approach over writing net-new code when it meets the requirement.

1. **Plan First**
   - Use **planner** agent to create implementation plan
   - Generate planning docs before coding: PRD, architecture, system_design, tech_doc, task_list
   - Identify dependencies and risks
   - Break down into phases

2. **TDD Approach**
   - Use **tdd-guide** agent
   - Write tests first (RED)
   - Implement to pass tests (GREEN)
   - Refactor (IMPROVE)
   - Verify 80%+ coverage

3. **Goal-Driven Execution**（可驗證目標格式）

   把命令式指令轉換為可驗證的成功標準，再開始實作：

   | 命令式（禁止直接執行） | 轉換為可驗證目標 |
   |----------------------|----------------|
   | "加入驗證" | "寫測試覆蓋驗證失敗情境，再讓測試通過" |
   | "修復 Bug" | "寫一個能重現該 Bug 的測試，再讓測試通過" |
   | "重構 X" | "確認重構前後測試均通過" |
   | "優化查詢" | "量測當前回應時間，定義目標值，驗證達成" |

   多步驟任務必須列出計畫格式：
   ```
   1. [步驟] → verify: [具體驗證方式]
   2. [步驟] → verify: [具體驗證方式]
   3. [步驟] → verify: [具體驗證方式]
   ```

   > 「優化」「改善」「修好」都是命令式指令。收到這類需求時，必須先與使用者確認驗證標準，再開始實作。

3. **Code Review**
   - Use **code-reviewer** agent immediately after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

4. **Commit & Push**
   - Detailed commit messages
   - Follow conventional commits format
   - See [git-workflow.md](./git-workflow.md) for commit message format and PR process
