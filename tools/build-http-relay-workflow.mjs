import fs from 'node:fs';
import yaml from 'js-yaml';

// Deterministic YAML assembly: standalone Python sources are embedded verbatim.
const directory = 'src/scheduled-messages/dify/';
const validate = fs.readFileSync(`${directory}http-relay/validate.py`, 'utf8');
const response = fs.readFileSync(`${directory}http-relay/response.py`, 'utf8');
const nodes = [];
const edges = [];
const node = (id, data, x, y) => nodes.push({ id, type: 'custom', width: 260, height: 160,
  position: { x, y }, positionAbsolute: { x, y }, sourcePosition: 'right', targetPosition: 'left', data: { selected: false, ...data } });
const edge = (source, target, sourceHandle = 'source') => edges.push({ id: `${source}-${sourceHandle}-${target}`, source, target,
  sourceHandle, targetHandle: 'target', type: 'custom', data: { sourceType: nodes.find(n => n.id === source).data.type,
    targetType: nodes.find(n => n.id === target).data.type, isInIteration: false, isInLoop: false } });
const outputs = fields => Object.fromEntries(fields.map(name => [name, { type: 'string', children: null }]));
const vars = map => Object.entries(map).map(([variable, value_selector]) => ({ variable, value_selector }));
const switchData = (title, selector, value) => ({ type: 'if-else', title, cases: [{ case_id: 'true', logical_operator: 'and',
  conditions: [{ id: 'equals', variable_selector: selector, comparison_operator: 'is', value, varType: 'string' }] }] });
const receiptFields = ['requestId', 'transportOk', 'statusCode', 'responseBody', 'errorCode'];
node('start', { type: 'start', title: 'Request', variables: [{ variable: 'request_json', label: 'request_json', type: 'paragraph', required: true, max_length: 100000, options: [] }] }, 0, 0);
node('validate', { type: 'code', title: 'Validate target, method and headers', code_language: 'python3', code: validate,
  variables: vars({ request_json: ['start', 'request_json'], allowed_routes_json: ['env', 'ALLOWED_ROUTES_JSON'] }),
  outputs: outputs(['ok', 'request_id', 'url', 'method', 'headers', 'body', 'error_code']) }, 300, 0);
node('valid', switchData('Validated?', ['validate', 'ok'], 'true'), 600, 0);
node('method', switchData('GET or POST', ['validate', 'method'], 'GET'), 900, 0);
for (const [index, method] of ['get', 'post', 'rejected'].entries()) {
  const y = index * 250;
  if (method !== 'rejected') node(method, { type: 'http-request', title: method.toUpperCase(), method,
    url: '{{#validate.url#}}', authorization: { type: 'no-auth' }, headers: '{{#validate.headers#}}', params: '',
    body: { type: method === 'get' ? 'none' : 'raw-text', data: method === 'get' ? [] : [{ key: '', type: 'text', value: '{{#validate.body#}}' }] },
    timeout: { connect: 10, read: 30, write: 10 }, ssl_verify: true,
    retry_config: { retry_enabled: false, max_retries: 0, retry_interval: 1000 },
    // No default-value error strategy: it can replace real 4xx outputs with status 0.
    // With retry disabled, HTTP responses reach the receipt node; network failure leaves the workflow unconfirmed.
    }, 1200, y);
  const variables = { request_id: ['validate', 'request_id'], request_json: ['start', 'request_json'] };
  if (method === 'rejected') variables.validation_error = ['validate', 'error_code'];
  else { variables.status_code = [method, 'status_code']; variables.body = [method, 'body']; }
  node(`${method}_receipt`, { type: 'code', title: 'Bounded transport receipt', code_language: 'python3', code: response,
    variables: vars(variables), outputs: outputs(receiptFields) }, 1500, y);
  node(`${method}_end`, { type: 'end', title: 'Return', outputs: receiptFields.map(variable => ({ variable,
    value_selector: [`${method}_receipt`, variable], value_type: 'string' })) }, 1800, y);
  if (method !== 'rejected') edge(method, `${method}_receipt`);
  edge(`${method}_receipt`, `${method}_end`);
}
edge('start', 'validate'); edge('validate', 'valid'); edge('valid', 'method', 'true');
edge('valid', 'rejected_receipt', 'false'); edge('method', 'get', 'true'); edge('method', 'post', 'false');
const standard = ['content-type', 'accept'];
const routes = [
  { origin: 'http://10.32.56.212:3210', path: '/api/v1/agent-tasks/execute', methods: ['POST'], allowedHeaders: [...standard, 'authorization', 'x-user-id', 'x-request-id'] },
  ...['http://task.xmnup.com', 'https://task.xmnup.com', 'https://api.multica.ai'].map(origin => ({ origin,
    pathPrefix: '/api/webhooks/autopilots/', methods: ['POST'], allowedHeaders: [...standard, 'idempotency-key'] })),
];
const workflow = { app: { name: 'Personal AI HTTP Relay', description: 'Generic bounded GET/POST transport. No LLM, provider logic or stored downstream keys.',
  icon: '🛰️', icon_background: '#E8F3FF', mode: 'workflow', use_icon_as_answer_icon: false }, dependencies: [], kind: 'app', version: '0.1.1',
  workflow: { conversation_variables: [], environment_variables: [{ id: 'relay-routes', name: 'ALLOWED_ROUTES_JSON', value_type: 'string',
    value: JSON.stringify(routes), description: 'Operator-controlled exact origins, paths/prefixes, methods and per-route header allowlists. GET requires an explicit route.' }],
  features: { file_upload: { enabled: false }, opening_statement: '', retriever_resource: { enabled: false }, sensitive_word_avoidance: { enabled: false },
    speech_to_text: { enabled: false }, suggested_questions: [], suggested_questions_after_answer: { enabled: false }, text_to_speech: { enabled: false } },
  graph: { nodes, edges, viewport: { x: 0, y: 0, zoom: 0.6 } } } };
fs.writeFileSync(`${directory}http-relay.yml`, '# Generated by node tools/build-http-relay-workflow.mjs\n' + yaml.dump(workflow, { lineWidth: -1, noRefs: true }));
