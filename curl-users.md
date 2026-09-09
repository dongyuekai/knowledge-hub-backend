# 用户管理测试 curl

含：User CRUD、角色分配、Role CRUD、个人资料/改密/统计。

权限树、细粒度鉴权、团队管理见 `curl-rbac.md`。

需 `admin` 账号 JWT。鉴权见 `curl-auth.md`。

```bash
export BASE=http://localhost:3000

curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}' | jq -r '.accessToken'

ADMIN_TOKEN='替换成 admin accessToken'

curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"123456"}' | jq -r '.accessToken'

USER_TOKEN='替换成 user accessToken'
```

---

## 1. 角色管理（CRUD）

```bash
# 列表（分配前查看）
curl -s "$BASE/roles/list" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# 创建
curl -s -X POST "$BASE/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"roleName":"内容编辑","roleCode":"ROLE_EDITOR","description":"可编辑内容"}' | jq

# 查询 / 更新 / 删除
ROLE_ID='替换成角色 id'

curl -s "$BASE/roles/${ROLE_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s -X PUT "$BASE/roles/${ROLE_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"roleName":"内容编辑 v2","description":"更新描述"}' | jq

curl -s -X DELETE "$BASE/roles/${ROLE_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

---

## 2. 用户分页 / CRUD

```bash
curl -s "$BASE/users/page?page=1&pageSize=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s "$BASE/users/page?keyword=user&roleCode=ROLE_USER&status=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

```bash
curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "editor01",
    "password": "123456",
    "email": "editor01@company.com",
    "realName": "编辑小王",
    "roleCodes": ["ROLE_USER", "ROLE_REVIEWER"]
  }' | jq
```

```bash
NEW_USER_ID='替换成返回的 id'

curl -s "$BASE/users/${NEW_USER_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s -X PUT "$BASE/users/${NEW_USER_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"realName": "编辑小王 v2", "status": 1}' | jq

curl -s -X DELETE "$BASE/users/${NEW_USER_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

---

## 3. 角色分配（全量替换）

```bash
curl -s "$BASE/users/1000000000000000002/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

curl -s -X PUT "$BASE/users/1000000000000000002/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"roleCodes": ["ROLE_REVIEWER"]}' | jq
```

---

## 4. 当前用户：资料 / 改密 / 统计

```bash
curl -s -X PUT "$BASE/users/me" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"realName":"普通用户","avatar":"https://example.com/avatar.png"}' | jq

curl -s -X PUT "$BASE/users/password/change" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"oldPassword":"123456","newPassword":"654321"}' | jq

curl -s "$BASE/users/me/stats" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

---

## 5. 管理员重置用户密码

```bash
curl -s -X PUT "$BASE/users/1000000000000000003/password/reset" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"newPassword":"123456"}' | jq
```

---

未安装 `jq` 时去掉 `| jq` 即可。
