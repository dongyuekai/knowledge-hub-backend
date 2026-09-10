# 全文检索 / 图谱检索

整体流程：

1. `user` 上传 SOP PDF 解析为草稿（status=0，搜不到）
2. `PUT publish` 进入待审（默认需审核，status=3，仍搜不到）
3. `reviewer` 审核通过 → 已发布（status=1），投递 MQ
4. pipeline 异步写入 ES 全文索引和 Neo4j 图谱（等几秒）
5. `POST /search` 查全文，`GET /graph/search` 查图谱节点

```bash
export BASE=http://localhost:3000
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"123456"}' | jq -r '.accessToken')
REVIEWER_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"reviewer","password":"123456"}' | jq -r '.accessToken')
```

---

## 0. 全流程：创建 → 发布 → 检索

用 `test-files/02-production-release-sop.pdf` 走完整条链路。依赖 RustFS（`docker compose up -d rustfs`）。索引是异步的（MQ → pipeline），发布后等几秒再搜。

### 0.1 上传解析为草稿

```bash
DOC_ID=$(curl -s -X POST "$BASE/documents/upload/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@./test-files/02-production-release-sop.pdf' \
  -F 'tags=SOP,生产发布' | jq -r '.documentId')
echo "DOC_ID=$DOC_ID"
```

### 0.2 发布（默认需审核）

```bash
curl -s -X PUT "$BASE/documents/${DOC_ID}/publish" \
  -H "Authorization: Bearer $TOKEN" | jq '{id, status}'
# 期望 status=3 PendingReview，此时搜不到

TASK_ID=$(curl -s "$BASE/documents/${DOC_ID}/reviews/current" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.id')
echo "TASK_ID=$TASK_ID"

curl -s -X POST "$BASE/documents/reviews/tasks/${TASK_ID}/approve" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reviewComment": "内容符合规范，准予发布"}' | jq '{id, status, publishTime}'
# 期望 status=1 Published，随后投递 MQ 写 ES / Neo4j
```

免审时（`.env` 设 `DOCUMENT_REQUIRE_APPROVAL=false` 并重启）跳过审核，`PUT publish` 直接 `status=1` 并投索引。

### 0.3 等索引（约 3～10 秒，LLM 抽实体时更久）

```bash
sleep 15
```

### 0.4 全文搜索（ES）

```bash
curl -s -X POST "$BASE/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"灰度发布","page":1,"pageSize":10}' | jq
```

期望：`total >= 1`，`items[].title` 能对上刚才那篇；正文命中在 `highlight.content`，不回整篇。

```bash
# 也可用正文里的词
curl -s -X POST "$BASE/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"李明","page":1,"pageSize":10}' | jq '.items[] | {id, title, score, highlight}'
```

仍为空：看应用日志里 pipeline / ES 是否报错；确认 RabbitMQ、ES 容器 healthy。草稿或待审文档不会进索引。

### 0.5 图谱搜索（Neo4j）

```bash
curl -s --get "$BASE/graph/search" \
  --data-urlencode 'keyword=SRE' \
  --data-urlencode 'limit=50' \
  -H "Authorization: Bearer $TOKEN" | jq
```

期望能看到 `label=KnowledgeDocument`（标题命中）；抽实体完成后还会有 `DocumentChunk` / `KnowledgeEntity`（如 SRE 值班工程师、平台工程部、Kubernetes、李明）。图谱为空但 ES 有结果：多半是 Neo4j 未起或抽实体失败，文档节点一般仍会写入。

---

## 1. 全文搜索

查 ES `kh_document`（标题 / 摘要 / **全文**）。命中正文以 `highlight.content` 片段返回，不回整篇。

```bash
curl -s -X POST "$BASE/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"灰度发布","page":1,"pageSize":10}' | jq
```

可选：`categoryId`、`authorId`。

已发布文档改稿后需再次发布（或免审更新）才会刷新索引。旧文档若仍是「前 1000 字」快照，重新发布一次即可索引进全文。

## 2. 知识图谱

```bash
# 关键词检索实体 / 文档 / 块
curl -s --get "$BASE/graph/search" \
  --data-urlencode 'keyword=SRE' \
  --data-urlencode 'limit=50' \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$BASE/graph/nodes?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$BASE/graph/nodes?type=PERSON&limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$BASE/graph/edges?limit=100" \
  -H "Authorization: Bearer $TOKEN" | jq
```

`/graph/search` 匹配实体名/描述、文档标题/摘要、块标题/正文。`/graph/nodes` 为 `KnowledgeEntity` 列表，`/graph/edges` 为 `RELATED_TO`。Neo4j 不可用时返回空数组。
