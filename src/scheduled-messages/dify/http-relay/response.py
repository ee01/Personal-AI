"""Bounded transport receipt. Provider business acceptance belongs to Apps Script."""
import json
import re
from urllib.parse import urlsplit


def main(request_id: str, status_code=0, body: str = '', request_json: str = '', validation_error: str = '') -> dict:
    result = {'requestId': request_id, 'transportOk': 'false', 'statusCode': '0', 'responseBody': '', 'errorCode': 'transport_unconfirmed'}
    if validation_error:
        result['errorCode'] = 'validation_rejected'
        return result
    try:
        status = int(status_code or 0)
        result['statusCode'] = str(status)
        if not 100 <= status <= 599:
            return result
        if len(body) > 100000:
            result['errorCode'] = 'response_too_large'
            return result
        # Only JSON receipts go back to Jira. HTML error pages never enter a callback URL.
        parsed = json.loads(body) if body else {}
        request = json.loads(request_json)
        secrets = []
        sensitive = re.compile(r'authorization|password|token|secret|jwt|api.?key|webhook', re.I)

        def collect(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if sensitive.search(key) and isinstance(item, str) and item:
                        secrets.append(item)
                        if item.lower().startswith('bearer '):
                            secrets.append(item[7:])
                    else:
                        collect(item)
            elif isinstance(value, list):
                for item in value:
                    collect(item)

        collect(request.get('headers', {}))
        try:
            collect(json.loads(request.get('body', '') or '{}'))
        except Exception:
            pass
        target = request.get('url', '')
        secrets.append(target)
        if '/api/webhooks/autopilots/' in urlsplit(target).path:
            secrets.append(urlsplit(target).path.rsplit('/', 1)[-1])

        def redact(value):
            if isinstance(value, dict):
                return {key: '[redacted]' if sensitive.search(key) else redact(item) for key, item in value.items()}
            if isinstance(value, list):
                return [redact(item) for item in value]
            if isinstance(value, str):
                for secret in secrets:
                    if secret:
                        value = value.replace(secret, '[redacted]')
            return value

        receipt = json.dumps(redact(parsed), ensure_ascii=True, separators=(',', ':'))
        if len(receipt) > 2048:
            result['errorCode'] = 'response_too_large'
            return result
        result.update(transportOk='true', responseBody=receipt, errorCode='')
        return result
    except Exception:
        # Preserve HTTP 4xx rejection classification even for a non-JSON error body.
        if result['statusCode'].startswith('4'):
            result.update(transportOk='true', responseBody='{}', errorCode='')
        return result
