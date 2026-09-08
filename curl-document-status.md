# 文档状态流转测试 curl

默认测试环境：`DOCUMENT_REQUIRE_APPROVAL=true`（`.env` 不设置即为 true）。

| status | 名称 | 说明 |
|--------|------|------|
| 0 | Draft | 草稿，不进索引 |
| 1 | Published | 已发布，写入 RAG/Search/KG |
| 2 | Archived | 已归档，清索引、保留正文 |
| 3 | PendingReview | 待审核，不进索引 |

## 状态流转（审核模式）

Draft ──publish/submit──► PendingReview ──approve──► Published
PendingReview ──reject──► Draft
Published ──archive──────► Archived
Published ──save-draft───► Draft
Published ──改内容 + submit──► PendingReview（清旧索引，通过后写新索引）

---

## 一、审核发布主流程

export BASE=http://localhost:3000

### 1. 上传 PDF 并解析为草稿

依赖：RustFS（`docker compose up -d rustfs`）。PDF 解析后写入 Mongo 正文，原文件上传 RustFS，返回 `fileUrl`。

curl -s -X POST "$BASE/documents/upload/parse" \
  -F 'file=@./test-files/02-production-release-sop.pdf' \
  -F 'authorId=10001' \
  -F 'createBy=10001' \
  -F 'tags=审核流测试,SOP' | jq '{documentId, title, status, fileExtension, contentLength, contentPreview}'

DOC_ID='替换成返回的 documentId'

可选：查看解析后的完整正文

curl -s "$BASE/documents/${DOC_ID}" | jq '{id, title, status, contentLength: (.content | length)}'

### 2. 提交发布 → status=3，不投索引

# PUT publish 与 POST reviews/submit 在需审核模式下效果相同
curl -s -X PUT "$BASE/documents/${DOC_ID}/publish" | jq '{id, status}'

### 3. 查看待审任务

curl -s "$BASE/documents/${DOC_ID}/reviews/current" | jq
curl -s "$BASE/documents/reviews/tasks?status=pending" | jq
curl -s "$BASE/documents/reviews/tasks/pending-count" | jq

TASK_ID='替换成 reviews/current 或 tasks 列表里的 id'

### 4. 审核通过 → status=1 + 写入索引

curl -s -X POST "$BASE/documents/reviews/tasks/${TASK_ID}/approve" \
  -H 'Content-Type: application/json' \
  -d '{
    "reviewComment": "内容符合规范，准予发布",
    "reviewerId": "20001",
    "reviewerName": "审核员张三"
  }' | jq '{id, status, publishTime}'

### 5. 已发布文档修改后再提审

curl -s -X PATCH "$BASE/documents/${DOC_ID}" \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "# 生产发布 SOP v2\n\n已发布文档修改后需重新审核。",
    "updateBy": "10001"
  }' | jq '{id, status}'

curl -s -X POST "$BASE/documents/${DOC_ID}/reviews/submit" | jq '{id, status}'

> 已发布文档再次提审时会**清掉旧索引**，审核通过后再写入新索引。

### 6. 审核驳回 → status=0

curl -s "$BASE/documents/reviews/tasks?status=pending" | jq '.items[0].id'
TASK_ID='替换成待审 task id'

curl -s -X POST "$BASE/documents/reviews/tasks/${TASK_ID}/reject" \
  -H 'Content-Type: application/json' \
  -d '{
    "reviewComment": "请补充操作步骤与负责人信息",
    "reviewerId": "20001",
    "reviewerName": "审核员张三"
  }' | jq '{id, status}'

### 7. 审核历史

curl -s "$BASE/documents/${DOC_ID}/reviews/history" | jq

---

## 二、已发布后的状态变更

# 归档 → status=2，清索引
curl -s -X PUT "$BASE/documents/${DOC_ID}/archive" | jq '{id, status}'

# 保存为草稿 → status=0，清索引
curl -s -X PUT "$BASE/documents/${DOC_ID}/save-draft" | jq '{id, status}'

# 软删除（任意状态；已发布会同时清 RAG/Search/KG）
curl -s -X DELETE "$BASE/documents/${DOC_ID}" | jq

---

## 三、边界校验

# status=3 时不可编辑，期望 400
curl -s -X PATCH "$BASE/documents/${DOC_ID}" \
  -H 'Content-Type: application/json' \
  -d '{"title": "试图修改标题"}' | jq

# 按状态筛选列表
curl -s "$BASE/documents?status=3&page=1&pageSize=5" | jq '.items[] | {id, title, status}'

---

## 四、免审模式（可选）

`.env` 设 `DOCUMENT_REQUIRE_APPROVAL=false` 并重启后，`PUT publish` 直接 → Published(1) 并投索引，无审核步骤。一般不必单独测，与主流程差异仅在于 publish 跳过 PendingReview。

curl -s -X PUT "$BASE/documents/${DOC_ID}/publish" | jq '{id, status, publishTime}'

---

未安装 `jq` 时去掉 `| jq` 即可。

本地全新初始化：删除 Postgres 数据卷后 `docker compose up -d`，`init.sql` 会自动创建 `kh_document` 与 `kh_document_review`。
