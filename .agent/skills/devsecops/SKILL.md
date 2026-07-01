---
name: devsecops
description: DevSecOps practices covering CI/CD pipeline security, secrets management, container security, IaC security, SAST/DAST integration, and supply chain security. Use when setting up pipelines, writing Dockerfile, IaC, or reviewing CI/CD configs.
origin: cybersecurity-library
source: subdomain devsecops in skills/cybersecurity-library/skills/
tags: [security, devsecops, cicd, docker, iac, sast]
---

# DevSecOps

> 完整技能庫：`skills/cybersecurity-library/devsecops/`（共 ~17 個技能）

## CI/CD Pipeline 安全

### Secrets Management
- [ ] 所有 secret 存 CI/CD secret store（GitHub Secrets / GitLab CI Variables / Vault）
- [ ] `.env` 在 `.gitignore`，`.env.example` 只含 key 名稱（無值）
- [ ] 定期掃描 git history 是否有洩漏（`trufflehog`, `gitleaks`）
- [ ] Secret rotation 週期設定（至少每季）

```bash
# 掃描 git history 中的 secrets
trufflehog git file://. --since-commit HEAD~100
# 或
gitleaks detect --source . --verbose
```

### SAST（靜態分析）整合
- [ ] PR pipeline 跑 SAST（不允許 HIGH 級以上進 main）
- [ ] Dependency 弱點掃描（Dependabot / `npm audit` / `mvn dependency-check`）

```yaml
# GitHub Actions 範例（依實際 CI 工具調整）
- name: SAST Scan
  uses: github/codeql-action/analyze@v2

- name: Dependency Check
  run: mvn org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7
```

### Container Security
- [ ] 使用 non-root user 執行應用（`USER appuser`）
- [ ] Base image 固定版本（不用 `:latest`）
- [ ] 多階段 build 減少 image 攻擊面
- [ ] Image scan（`trivy`, `grype`）整合到 pipeline

```dockerfile
# 安全 Dockerfile 範例結構（依實際 stack 調整）
FROM eclipse-temurin:21-jre-alpine AS runtime  # 固定版本、minimal base
RUN addgroup -S app && adduser -S app -G app   # non-root
USER app
COPY --chown=app:app target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Infrastructure as Code (IaC)
- [ ] Terraform / CloudFormation 跑 `tfsec` / `checkov`
- [ ] 不在 IaC 中 hardcode credentials
- [ ] Least privilege IAM roles（不用 AdministratorAccess）

### Supply Chain Security
- [ ] 鎖定依賴版本（`package-lock.json`, `pom.xml` 明確版本）
- [ ] 驗證 artifact checksum（下載時）
- [ ] 考慮 SBOM（Software Bill of Materials）生成

## 快速掃描

```bash
# 掃描 Dockerfile 安全問題
docker run --rm -v $(pwd):/app hadolint/hadolint hadolint /app/Dockerfile

# 掃描 container image
trivy image myapp:latest --severity HIGH,CRITICAL

# Maven dependency 弱點掃描
mvn org.owasp:dependency-check-maven:check
```

---
*深查：`grep -rl "subdomain: devsecops" skills/cybersecurity-library/skills/` → 17 個技能*
