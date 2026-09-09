# RBAC / 权限 / 团队测试 curl

含：Permission 树 CRUD、角色/用户绑权限、`@RequirePermission()`、团队管理。

鉴权见 `curl-auth.md`。管理员 `admin` 拥有全部 `system:*` 权限。

```bash
export BASE=http://localhost:3000

curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}' | jq -r '.accessToken'

ADMIN_TOKEN='替换成 admin accessToken'
```

---

## 1. 当前用户权限（auth/me）

登录后 `userInfo` 含 `roles` 与 `permissions`：

```bash
curl -s "$BASE/auth/me" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{roles: .roles, permissions: .permissions}'
```

---

## 2. 权限树

```bash
curl -s "$BASE/permissions/tree" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s "$BASE/permissions/list" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s "$BASE/permissions/page?page=1&pageSize=20&keyword=document" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

```bash
curl -s -X POST "$BASE/permissions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "permissionName": "导出文档",
    "permissionCode": "document:export",
    "permissionType": 2,
    "parentId": "4000000000000000002",
    "sort": 6
  }' | jq

PERM_ID='替换成返回 id'

curl -s -X PUT "$BASE/permissions/${PERM_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"permissionName": "导出文档 v2"}' | jq

curl -s -X DELETE "$BASE/permissions/${PERM_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

---

## 3. 角色绑权限

```bash
# 审核员角色 id = 2000000000000000002
curl -s "$BASE/roles/2000000000000000002/permissions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s -X PUT "$BASE/roles/2000000000000000002/permissions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"permissionIds": ["4000000000000000011", "356031788818108416"]}' | jq
```

---

## 4. 用户直接绑权限

```bash
curl -s "$BASE/users/1000000000000000003/permissions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s -X PUT "$BASE/users/1000000000000000003/permissions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"permissionIds": ["4000000000000000012"]}' | jq
```

---

## 5. 团队管理

团队树公开（无需登录）：

```bash
curl -s "$BASE/teams/tree" | jq
```

管理接口需 admin + `system:team`：

```bash
curl -s "$BASE/teams/page?page=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s -X POST "$BASE/teams" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"teamName":"前端组","teamCode":"FE","parentId":"8000000000000000001"}' | jq
```

---

未安装 `jq` 时去掉 `| jq` 即可。

用户 CRUD 见 `curl-users.md`。
