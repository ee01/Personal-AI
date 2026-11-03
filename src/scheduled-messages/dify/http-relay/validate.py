"""Pure validation used verbatim by the Dify Code node; never performs network I/O."""
import json
import re
from urllib.parse import urlsplit, unquote


def main(request_json: str, allowed_routes_json: str) -> dict:
    result = {'ok': 'false', 'request_id': '', 'url': '', 'method': '', 'headers': '', 'body': '', 'error_code': 'validation_rejected'}
    try:
        if len(request_json) > 100000:
            return result
        request = json.loads(request_json)
        request_id = request.get('requestId', '')
        if not isinstance(request_id, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,512}', request_id):
            return result
        result['request_id'] = request_id
        if request.get('version') != 1:
            return result
        method = str(request.get('method', '')).upper()
        if method not in ('GET', 'POST'):
            return result
        url = request.get('url', '')
        if not isinstance(url, str) or len(url) > 4096 or re.search(r'[\s\\\x00-\x1f\x7f]', url):
            return result
        parsed = urlsplit(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
            return result
        origin = parsed.scheme + '://' + parsed.netloc.lower()
        path = parsed.path or '/'
        # Reject escaped/path traversal ambiguities before matching an operator-controlled route.
        if unquote(path) != path or any(part in ('.', '..') for part in path.split('/')):
            return result
        headers = request.get('headers', {})
        body = request.get('body', '')
        if not isinstance(headers, dict) or not isinstance(body, str) or (method == 'GET' and body):
            return result
        routes = json.loads(allowed_routes_json)
        matches = [route for route in routes if route.get('origin') == origin
                   and method in route.get('methods', [])
                   and ((route.get('path') == path) or
                        (route.get('pathPrefix', '').endswith('/') and path.startswith(route['pathPrefix'])))]
        if len(matches) != 1:
            return result
        allowed = {name.lower() for name in matches[0].get('allowedHeaders', [])}
        forbidden = {'host', 'cookie', 'connection', 'content-length', 'transfer-encoding', 'proxy-authorization', 'forwarded'}
        lines = []
        seen = set()
        for key, value in headers.items():
            name = key.lower()
            if name in seen or name not in allowed or name in forbidden or name.startswith('x-forwarded-'):
                return result
            if not re.fullmatch(r'[A-Za-z0-9-]+', key) or not isinstance(value, str) or re.search(r'[\r\n\x00-\x1f\x7f]', value):
                return result
            seen.add(name)
            lines.append(key + ': ' + value)
        result.update(ok='true', url=url, method=method, headers='\n'.join(lines), body=body, error_code='')
        return result
    except Exception:
        # No URL, key or payload in error output.
        return result
