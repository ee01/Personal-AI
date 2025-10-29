#!/bin/bash

# 测试创建 Jira Automation Rule
# 使用简化版本：只有 scheduled trigger + webhook，没有 Groovy

# 参数配置
JIRA_URL="https://jira.ringcentral.com"
PROJECT_ID="16552"
USER_KEY="esone.qiu"
WEB_APP_URL="https://script.google.com/macros/s/AKfycbxZ_f0yf4-9FpC1FN6dmoORVDwlHUgUsBh1AlkrIv4Q1p4n4aVx8v7SYAR3zNj5Kaew/exec"
BOT_TOKEN="YOUR_BOT_TOKEN_HERE"

# 生成 payload
PAYLOAD=$(cat <<EOF
{
  "name": "[Personal AI Test] Scheduled Messages Bot Executor",
  "state": "ENABLED",
  "canOtherRuleTrigger": false,
  "notifyOnError": "FIRSTERROR",
  "authorAccountId": "${USER_KEY}",
  "actorAccountId": "${USER_KEY}",
  "trigger": {
    "component": "TRIGGER",
    "schemaVersion": 1,
    "type": "jira.scheduled.trigger",
    "value": {
      "scheduleConfig": {
        "expression": "0 * * * * ?"
      }
    },
    "children": [],
    "conditions": [],
    "optimisedIds": [],
    "newComponent": false
  },
  "components": [
    {
      "component": "ACTION",
      "schemaVersion": 2,
      "type": "jira.issue.outgoing.webhook",
      "value": {
        "url": "${WEB_APP_URL}?action=executeBotMessages&botToken=${BOT_TOKEN}",
        "headers": [],
        "sendIssue": false,
        "contentType": "empty",
        "method": "GET",
        "responseEnabled": false,
        "usedSecretsKeys": []
      },
      "children": [],
      "conditions": [],
      "optimisedIds": [],
      "newComponent": false
    }
  ],
  "projects": [
    {
      "projectId": "${PROJECT_ID}",
      "projectTypeKey": "software"
    }
  ],
  "labels": [],
  "tags": []
}
EOF
)

echo "创建 Jira Automation Rule..."
echo "Payload:"
echo "$PAYLOAD" | jq '.'

echo ""
echo "发送请求..."

# 执行 curl
RESPONSE=$(curl -s -w "\n%{http_code}" "${JIRA_URL}/rest/cb-automation/latest/project/${PROJECT_ID}/rule" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'X-Atlassian-Token: no-check' \
  -H 'Cache-Control: no-cache' \
  --data-raw "$PAYLOAD")

# 分离响应体和状态码
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo ""
echo "HTTP Status Code: $HTTP_CODE"
echo "Response:"
echo "$HTTP_BODY" | jq '.' || echo "$HTTP_BODY"

# 判断是否成功
if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo ""
  echo "✅ Rule 创建成功！"
  
  # 提取 rule ID
  RULE_ID=$(echo "$HTTP_BODY" | jq -r '.id' 2>/dev/null)
  if [ -n "$RULE_ID" ] && [ "$RULE_ID" != "null" ]; then
    echo "Rule ID: $RULE_ID"
    echo "Rule URL: ${JIRA_URL}/secure/AutomationProjectAdminAction!default.jspa?projectKey=MTR#/rule/${RULE_ID}"
    echo ""
    echo "如需删除，请运行："
    echo "curl -X DELETE '${JIRA_URL}/rest/cb-automation/latest/rule/${RULE_ID}' -H 'X-Atlassian-Token: no-check'"
  fi
else
  echo ""
  echo "❌ Rule 创建失败"
fi

