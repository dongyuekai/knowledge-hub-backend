# RAG 多文档检索

`curl-read.md` 只发了一篇 SOP，召回的 chunk 都来自同一篇，看不出混合检索有没有跨文档排序。

本文件：关掉审核 → 一次发布 4 篇不同主题 → 测 `POST /rag/search` 和 `POST /ai/chat`。

前提：

1. `.env` 设 `DOCUMENT_REQUIRE_APPROVAL=false` 并**重启**应用（改完不重启仍会走待审）
2. Postgres / Mongo / Redis / RabbitMQ / Elasticsearch 已起；对话还需要 DashScope Key
3. 预置账号 `user` / `123456`（需权限码 `document:create`、`search`）

免审后 `POST /documents` 带 `"status": 1` 会直接发布并投 MQ。索引是异步的，发完等十几秒再搜。

```bash
export BASE=http://localhost:3000
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"123456"}' | jq -r '.accessToken')
```

---

## 1. 发布 4 篇（不同主题，便于对 sources.documentTitle）

正文太长，不能写进 `-d '{...}'` 再粘贴：编辑器会把 `content` 那一行折开展示，复制时会在折行处截断（你看到的就是断在「做小流」），zsh 等不到闭合的 `'` 就会出现 `quote>`。已经卡在那里时 **Ctrl+C**。正文放在 `test-files/`，curl 用 `-d @文件` 读，和上传 PDF 的 `@./test-files/...` 一样。

```bash
# ① 生产灰度发布
curl -s -X POST "$BASE/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @./test-files/rag-canary.json | jq '{id, title, status}'

# ② 新员工入职
curl -s -X POST "$BASE/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @./test-files/rag-onboarding.json | jq '{id, title, status}'

# ③ 故障应急与值班
curl -s -X POST "$BASE/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @./test-files/rag-incident.json | jq '{id, title, status}'

# ④ 知识库可见性
curl -s -X POST "$BASE/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @./test-files/rag-visibility.json | jq '{id, title, status}'
```

期望每篇 `status=1`。若报「开启审核时请先创建草稿」，说明免审开关没生效，检查 `.env` 并重启。

```bash
sleep 20
```

分块 + 向量写入大约十几秒；日志里出现 `ES 批量索引成功` 再搜更稳。

---

## 2. `POST /rag/search`（只召回，不调 LLM）

看 `documentTitle` 是否来自**不同文档**，不要只盯 chunk 条数。

```bash
# 应对上「生产灰度发布…」；换说法里没有「灰度发布」四字
curl -s -X POST "$BASE/rag/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"上线前如何做金丝雀或小流量验证？","topK":8}' \
  | jq

# 应对上「新员工入职指南」
curl -s -X POST "$BASE/rag/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"新员工第一周要装什么、VPN 连不上找谁","topK":8}' \
  | jq 

# 应对上「故障应急与值班」；指挥应是王芳，不是发布窗口的李明
curl -s -X POST "$BASE/rag/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"P0 故障谁指挥、要不要先回滚","topK":8}' \
  | jq 

# 跨文档：灰度职责 vs 故障指挥，topK 里应出现至少两篇 title
curl -s -X POST "$BASE/rag/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"生产出故障是找李明还是找值班经理？","topK":8}' \
  | jq 
```

---

## 3. `POST /ai/chat`（召回后再生成）

```bash
curl -s -X POST "$BASE/ai/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"上线前如何做金丝雀或小流量验证？","topK":5}' \
  | jq

curl -s -X POST "$BASE/ai/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"P0 故障谁指挥？和日常发布的李明是不是同一人？","topK":5}' \
  | jq

期望：回答能区分「发布放行李明」和「故障指挥王芳」；`sources` 里出现不止一个 `documentTitle`。

仍全是同一篇、或 `hits=[]`：看 pipeline / ES 日志；确认四篇都是 `status=1`，且 embedding 没有整批失败。
