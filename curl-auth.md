# 用户鉴权测试 curl

简化方案：**注册后立即可登录**（无邮箱激活）。文档接口默认需 JWT；审核接口需 `ROLE_REVIEWER` 或 `ROLE_ADMIN`。

## 预置测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123456 | 管理员 + 审核员 |
| reviewer | 123456 | 审核员 |
| user | 123456 | 普通用户 |

> 全新库：删除 Postgres 数据卷后 `docker compose up -d`，`init.sql` 会自动建表并插入上述账号。

```bash
export BASE=http://localhost:3000
```

---

## 1. 登录

```bash
curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"123456"}' | jq
```

```bash
TOKEN='替换成 accessToken'
```

审核员登录（用于 approve/reject）：

```bash
curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"reviewer","password":"123456"}' | jq '{accessToken, userInfo}'
```

```bash
REVIEWER_TOKEN='替换成 reviewer 的 accessToken'
```

---

## 2. 当前用户

```bash
curl -s "$BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 3. 注册（默认 ROLE_USER）

```bash
curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "zhangsan",
    "password": "123456",
    "email": "zhangsan@company.com",
    "realName": "张三"
  }' | jq
```

注册成功后用新账号走登录 curl。

---

## 4. 刷新 Token

```bash
REFRESH='替换成 login 返回的 refreshToken'

curl -s -X POST "$BASE/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq '{accessToken, expiresIn}'
```

---

## 5. 审核员 ID 列表

```bash
curl -s "$BASE/auth/reviewer-ids" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | jq
```

---

## 6. 带 Token 调用文档接口（示例）

上传 PDF 创建草稿（普通用户）：

```bash
curl -s -X POST "$BASE/documents/upload/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@./test-files/02-production-release-sop.pdf' \
  -F 'tags=审核流测试,SOP' | jq
```

审核通过（需 reviewer/admin token）：

```bash
TASK_ID='替换成待审任务 id'

curl -s -X POST "$BASE/documents/reviews/tasks/${TASK_ID}/approve" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reviewComment":"内容符合规范，准予发布"}' | jq '{id, status, publishTime}'
```

---

未安装 `jq` 时去掉 `| jq` 即可。

完整文档状态流转见 `curl-document-status.md`（需先 login 拿 token）。
