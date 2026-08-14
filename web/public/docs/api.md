# 管理 API 使用文档


## 基础信息

- Base URL：使用当前站点地址，例如 `https://one.gloscai.com`
- 认证方式：任选其一
  - `Authorization: Bearer <ADMIN_API_KEY>`
  - `X-Admin-Api-Key: <ADMIN_API_KEY>`
- 返回格式：所有接口返回统一 JSON
- 分页上限：`page_size` 最大为 `100`
- 时间格式：Unix 秒级时间戳

## 权限范围

| Scope             | 可访问接口                           | 数据         |
| ----------------- | ------------------------------------ | ------------ |
| `users`           | `GET /api/admin-api/users`           | 注册用户列表 |
| `payments`        | `GET /api/admin-api/payments`        | 支付日志     |
| `usage_logs`      | `GET /api/admin-api/usage-logs`      | 使用日志     |
| `models`          | `GET /api/admin-api/models`          | 模型列表     |
| `model_call_logs` | `GET /api/admin-api/model-call-logs` | 模型调用日志 |

如果 Key 没有对应 Scope，接口会返回未授权错误。

## 通用请求参数

以下参数适用于所有数据接口：

| 参数              | 类型   | 说明                             |
| ----------------- | ------ | -------------------------------- |
| `p`               | number | 页码，从 `1` 开始                |
| `page_size`       | number | 每页数量，最大 `100`             |
| `keyword`         | string | 关键词筛选，不同接口匹配字段不同 |
| `start_timestamp` | number | 开始时间，Unix 秒                |
| `end_timestamp`   | number | 结束时间，Unix 秒                |
| `sort_by`         | string | 排序字段，见各接口说明           |
| `sort_order`      | string | `asc` 或 `desc`，默认 `desc`     |

兼容参数：

- `start_time` 等价于 `start_timestamp`
- `end_time` 等价于 `end_timestamp`

## 通用响应格式

成功响应：

```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 100,
    "total": 123,
    "items": []
  }
}
```

失败响应：

```json
{
  "success": false,
  "message": "invalid admin api key"
}
```

## 认证示例

使用 Bearer Token：

```bash
curl "$BASE_URL/api/admin-api/users?p=1&page_size=100" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

使用 `X-Admin-Api-Key`：

```bash
curl "$BASE_URL/api/admin-api/users?p=1&page_size=100" \
  -H "X-Admin-Api-Key: $ADMIN_API_KEY"
```

## 注册用户列表

接口：

```http
GET /api/admin-api/users
```

所需 Scope：

```text
users
```

时间筛选字段：

- `created_at`

关键词匹配：

- `id`
- `username`
- `email`
- `display_name`

支持排序字段：

| sort_by         | 说明         |
| --------------- | ------------ |
| `id`            | 用户 ID      |
| `created_at`    | 注册时间     |
| `last_login_at` | 最后登录时间 |
| `quota`         | 当前额度     |
| `used_quota`    | 已用额度     |
| `request_count` | 请求次数     |
| `username`      | 用户名       |
| `display_name`  | 显示名称     |
| `role`          | 用户角色     |
| `status`        | 用户状态     |

示例：

```bash
curl "$BASE_URL/api/admin-api/users?p=1&page_size=100&keyword=alice&start_timestamp=1717200000&end_timestamp=1719791999&sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

## 支付日志

接口：

```http
GET /api/admin-api/payments
```

所需 Scope：

```text
payments
```

时间筛选字段：

- `create_time`

额外筛选参数：

| 参数             | 类型   | 说明     |
| ---------------- | ------ | -------- |
| `payment_method` | string | 支付方式 |
| `status`         | string | 支付状态 |

关键词匹配：

- `id`
- `user_id`
- `trade_no`
- `username`

支持排序字段：

| sort_by         | 说明        |
| --------------- | ----------- |
| `id`            | 支付日志 ID |
| `create_time`   | 创建时间    |
| `complete_time` | 完成时间    |
| `amount`        | 充值额度    |
| `money`         | 支付金额    |
| `status`        | 支付状态    |

示例：

```bash
curl "$BASE_URL/api/admin-api/payments?p=1&page_size=100&status=success&payment_method=stripe&sort_by=complete_time&sort_order=desc" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

## 使用日志

接口：

```http
GET /api/admin-api/usage-logs
```

所需 Scope：

```text
usage_logs
```

时间筛选字段：

- `created_at`

额外筛选参数：

| 参数                  | 类型   | 说明                                                |
| --------------------- | ------ | --------------------------------------------------- |
| `type`                | number | 日志类型，`0` 表示全部                              |
| `model_name`          | string | 模型名称，支持精确匹配；包含 `%` 时按 LIKE 模式匹配 |
| `username`            | string | 用户名，支持精确匹配；包含 `%` 时按 LIKE 模式匹配   |
| `token_name`          | string | API Key 名称                                        |
| `channel`             | number | 渠道 ID                                             |
| `group`               | string | 分组                                                |
| `request_id`          | string | 请求 ID                                             |
| `upstream_request_id` | string | 上游请求 ID                                         |

日志类型：

| type | 说明 |
| ---- | ---- |
| `0`  | 全部 |
| `1`  | 充值 |
| `2`  | 消费 |
| `3`  | 管理 |
| `4`  | 系统 |
| `5`  | 错误 |
| `6`  | 退款 |

支持排序字段：

| sort_by             | 说明       |
| ------------------- | ---------- |
| `id`                | 日志 ID    |
| `created_at`        | 创建时间   |
| `user_id`           | 用户 ID    |
| `username`          | 用户名     |
| `model_name`        | 模型名称   |
| `prompt_tokens`     | 输入 Token |
| `completion_tokens` | 输出 Token |
| `quota`             | 消耗额度   |
| `use_time`          | 用时       |
| `channel`           | 渠道 ID    |
| `type`              | 日志类型   |

示例：

```bash
curl "$BASE_URL/api/admin-api/usage-logs?p=1&page_size=100&type=2&model_name=gpt-4o&sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

## 模型列表

接口：

```http
GET /api/admin-api/models
```

所需 Scope：

```text
models
```

时间筛选字段：

- `created_time`

额外筛选参数：

| 参数            | 类型   | 说明                         |
| --------------- | ------ | ---------------------------- |
| `vendor`        | string | 供应商 ID 或供应商名称关键词 |
| `tag`           | string | 标签；`__empty__` 表示无标签 |
| `status`        | number | 模型状态                     |
| `sync_official` | number | 是否同步官方模型信息         |

关键词匹配：

- `model_name`
- `description`
- `tags`

支持排序字段：

| sort_by         | 说明             |
| --------------- | ---------------- |
| `id`            | 模型 ID          |
| `model_name`    | 模型名称         |
| `created_time`  | 创建时间         |
| `updated_time`  | 更新时间         |
| `status`        | 状态             |
| `vendor_id`     | 供应商 ID        |
| `sync_official` | 是否同步官方信息 |

示例：

```bash
curl "$BASE_URL/api/admin-api/models?p=1&page_size=100&keyword=gpt&tag=text&status=1&sort_by=model_name&sort_order=asc" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

## 模型调用日志

接口：

```http
GET /api/admin-api/model-call-logs
```

所需 Scope：

```text
model_call_logs
```

时间筛选字段：

- `created_at`

额外筛选参数：

| 参数     | 类型   | 说明                       |
| -------- | ------ | -------------------------- |
| `status` | string | `success`、`failed` 或空值 |

关键词匹配：

- `id`
- `user_id`
- `username`
- `model_name`
- `request_id`

支持排序字段：

| sort_by             | 说明       |
| ------------------- | ---------- |
| `id`                | 日志 ID    |
| `created_at`        | 创建时间   |
| `user_id`           | 用户 ID    |
| `model_name`        | 模型名称   |
| `prompt_tokens`     | 输入 Token |
| `completion_tokens` | 输出 Token |
| `quota`             | 消耗额度   |

示例：

```bash
curl "$BASE_URL/api/admin-api/model-call-logs?p=1&page_size=100&status=failed&keyword=gpt&sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

## JavaScript 示例

```ts
const baseURL = 'https://one.example.com'
const adminAPIKey = process.env.ADMIN_API_KEY!

async function listUsers() {
  const params = new URLSearchParams({
    p: '1',
    page_size: '100',
    sort_by: 'created_at',
    sort_order: 'desc',
  })

  const res = await fetch(`${baseURL}/api/admin-api/users?${params}`, {
    headers: {
      Authorization: `Bearer ${adminAPIKey}`,
    },
  })

  const body = await res.json()
  if (!body.success) {
    throw new Error(body.message || 'Request failed')
  }
  return body.data.items
}
```

## Python 示例

```python
import os
import requests

base_url = "https://one.example.com"
admin_api_key = os.environ["ADMIN_API_KEY"]

response = requests.get(
    f"{base_url}/api/admin-api/model-call-logs",
    headers={"Authorization": f"Bearer {admin_api_key}"},
    params={
        "p": 1,
        "page_size": 100,
        "status": "success",
        "sort_by": "created_at",
        "sort_order": "desc",
    },
    timeout=30,
)
response.raise_for_status()
body = response.json()

if not body.get("success"):
    raise RuntimeError(body.get("message") or "Request failed")

items = body["data"]["items"]
```

## 安全建议

- 为不同外部系统创建不同 Key，不要共用一个全权限 Key。
- 只勾选外部系统实际需要的 Scope。
- 给临时集成设置过期时间。
- Key 明文只显示一次，泄露后请立即删除并重新创建。
- 不要把 Key 写入前端代码、公开仓库或日志。
- 通过 HTTPS 调用管理 API。
