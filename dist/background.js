/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/openai/_shims/MultipartBody.mjs":
/*!******************************************************!*\
  !*** ./node_modules/openai/_shims/MultipartBody.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MultipartBody: () => (/* binding */ MultipartBody)
/* harmony export */ });
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */
class MultipartBody {
    constructor(body) {
        this.body = body;
    }
    get [Symbol.toStringTag]() {
        return 'MultipartBody';
    }
}
//# sourceMappingURL=MultipartBody.mjs.map

/***/ }),

/***/ "./node_modules/openai/_shims/index.mjs":
/*!**********************************************!*\
  !*** ./node_modules/openai/_shims/index.mjs ***!
  \**********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Blob: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.Blob),
/* harmony export */   File: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.File),
/* harmony export */   FormData: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.FormData),
/* harmony export */   Headers: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.Headers),
/* harmony export */   ReadableStream: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.ReadableStream),
/* harmony export */   Request: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.Request),
/* harmony export */   Response: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.Response),
/* harmony export */   auto: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.auto),
/* harmony export */   fetch: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.fetch),
/* harmony export */   fileFromPath: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.fileFromPath),
/* harmony export */   getDefaultAgent: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.getDefaultAgent),
/* harmony export */   getMultipartRequestOptions: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.getMultipartRequestOptions),
/* harmony export */   isFsReadStream: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.isFsReadStream),
/* harmony export */   kind: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.kind),
/* harmony export */   setShims: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.setShims)
/* harmony export */ });
/* harmony import */ var _registry_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./registry.mjs */ "./node_modules/openai/_shims/registry.mjs");
/* harmony import */ var openai_shims_auto_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! openai/_shims/auto/runtime */ "./node_modules/openai/_shims/web-runtime.mjs");
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */


if (!_registry_mjs__WEBPACK_IMPORTED_MODULE_0__.kind) _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.setShims(openai_shims_auto_runtime__WEBPACK_IMPORTED_MODULE_1__.getRuntime(), { auto: true });



/***/ }),

/***/ "./node_modules/openai/_shims/registry.mjs":
/*!*************************************************!*\
  !*** ./node_modules/openai/_shims/registry.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Blob: () => (/* binding */ Blob),
/* harmony export */   File: () => (/* binding */ File),
/* harmony export */   FormData: () => (/* binding */ FormData),
/* harmony export */   Headers: () => (/* binding */ Headers),
/* harmony export */   ReadableStream: () => (/* binding */ ReadableStream),
/* harmony export */   Request: () => (/* binding */ Request),
/* harmony export */   Response: () => (/* binding */ Response),
/* harmony export */   auto: () => (/* binding */ auto),
/* harmony export */   fetch: () => (/* binding */ fetch),
/* harmony export */   fileFromPath: () => (/* binding */ fileFromPath),
/* harmony export */   getDefaultAgent: () => (/* binding */ getDefaultAgent),
/* harmony export */   getMultipartRequestOptions: () => (/* binding */ getMultipartRequestOptions),
/* harmony export */   isFsReadStream: () => (/* binding */ isFsReadStream),
/* harmony export */   kind: () => (/* binding */ kind),
/* harmony export */   setShims: () => (/* binding */ setShims)
/* harmony export */ });
let auto = false;
let kind = undefined;
let fetch = undefined;
let Request = undefined;
let Response = undefined;
let Headers = undefined;
let FormData = undefined;
let Blob = undefined;
let File = undefined;
let ReadableStream = undefined;
let getMultipartRequestOptions = undefined;
let getDefaultAgent = undefined;
let fileFromPath = undefined;
let isFsReadStream = undefined;
function setShims(shims, options = { auto: false }) {
    if (auto) {
        throw new Error(`you must \`import 'openai/shims/${shims.kind}'\` before importing anything else from openai`);
    }
    if (kind) {
        throw new Error(`can't \`import 'openai/shims/${shims.kind}'\` after \`import 'openai/shims/${kind}'\``);
    }
    auto = options.auto;
    kind = shims.kind;
    fetch = shims.fetch;
    Request = shims.Request;
    Response = shims.Response;
    Headers = shims.Headers;
    FormData = shims.FormData;
    Blob = shims.Blob;
    File = shims.File;
    ReadableStream = shims.ReadableStream;
    getMultipartRequestOptions = shims.getMultipartRequestOptions;
    getDefaultAgent = shims.getDefaultAgent;
    fileFromPath = shims.fileFromPath;
    isFsReadStream = shims.isFsReadStream;
}
//# sourceMappingURL=registry.mjs.map

/***/ }),

/***/ "./node_modules/openai/_shims/web-runtime.mjs":
/*!****************************************************!*\
  !*** ./node_modules/openai/_shims/web-runtime.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntime: () => (/* binding */ getRuntime)
/* harmony export */ });
/* harmony import */ var _MultipartBody_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./MultipartBody.mjs */ "./node_modules/openai/_shims/MultipartBody.mjs");

function getRuntime({ manuallyImported } = {}) {
    const recommendation = manuallyImported ?
        `You may need to use polyfills`
        : `Add one of these imports before your first \`import … from 'openai'\`:
- \`import 'openai/shims/node'\` (if you're running on Node)
- \`import 'openai/shims/web'\` (otherwise)
`;
    let _fetch, _Request, _Response, _Headers;
    try {
        // @ts-ignore
        _fetch = fetch;
        // @ts-ignore
        _Request = Request;
        // @ts-ignore
        _Response = Response;
        // @ts-ignore
        _Headers = Headers;
    }
    catch (error) {
        throw new Error(`this environment is missing the following Web Fetch API type: ${error.message}. ${recommendation}`);
    }
    return {
        kind: 'web',
        fetch: _fetch,
        Request: _Request,
        Response: _Response,
        Headers: _Headers,
        FormData: 
        // @ts-ignore
        typeof FormData !== 'undefined' ? FormData : (class FormData {
            // @ts-ignore
            constructor() {
                throw new Error(`file uploads aren't supported in this environment yet as 'FormData' is undefined. ${recommendation}`);
            }
        }),
        Blob: typeof Blob !== 'undefined' ? Blob : (class Blob {
            constructor() {
                throw new Error(`file uploads aren't supported in this environment yet as 'Blob' is undefined. ${recommendation}`);
            }
        }),
        File: 
        // @ts-ignore
        typeof File !== 'undefined' ? File : (class File {
            // @ts-ignore
            constructor() {
                throw new Error(`file uploads aren't supported in this environment yet as 'File' is undefined. ${recommendation}`);
            }
        }),
        ReadableStream: 
        // @ts-ignore
        typeof ReadableStream !== 'undefined' ? ReadableStream : (class ReadableStream {
            // @ts-ignore
            constructor() {
                throw new Error(`streaming isn't supported in this environment yet as 'ReadableStream' is undefined. ${recommendation}`);
            }
        }),
        getMultipartRequestOptions: async (
        // @ts-ignore
        form, opts) => ({
            ...opts,
            body: new _MultipartBody_mjs__WEBPACK_IMPORTED_MODULE_0__.MultipartBody(form),
        }),
        getDefaultAgent: (url) => undefined,
        fileFromPath: () => {
            throw new Error('The `fileFromPath` function is only supported in Node. See the README for more details: https://www.github.com/openai/openai-node#file-uploads');
        },
        isFsReadStream: (value) => false,
    };
}
//# sourceMappingURL=web-runtime.mjs.map

/***/ }),

/***/ "./node_modules/openai/_vendor/partial-json-parser/parser.mjs":
/*!********************************************************************!*\
  !*** ./node_modules/openai/_vendor/partial-json-parser/parser.mjs ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MalformedJSON: () => (/* binding */ MalformedJSON),
/* harmony export */   PartialJSON: () => (/* binding */ PartialJSON),
/* harmony export */   partialParse: () => (/* binding */ partialParse)
/* harmony export */ });
const STR = 0b000000001;
const NUM = 0b000000010;
const ARR = 0b000000100;
const OBJ = 0b000001000;
const NULL = 0b000010000;
const BOOL = 0b000100000;
const NAN = 0b001000000;
const INFINITY = 0b010000000;
const MINUS_INFINITY = 0b100000000;
const INF = INFINITY | MINUS_INFINITY;
const SPECIAL = NULL | BOOL | INF | NAN;
const ATOM = STR | NUM | SPECIAL;
const COLLECTION = ARR | OBJ;
const ALL = ATOM | COLLECTION;
const Allow = {
    STR,
    NUM,
    ARR,
    OBJ,
    NULL,
    BOOL,
    NAN,
    INFINITY,
    MINUS_INFINITY,
    INF,
    SPECIAL,
    ATOM,
    COLLECTION,
    ALL,
};
// The JSON string segment was unable to be parsed completely
class PartialJSON extends Error {
}
class MalformedJSON extends Error {
}
/**
 * Parse incomplete JSON
 * @param {string} jsonString Partial JSON to be parsed
 * @param {number} allowPartial Specify what types are allowed to be partial, see {@link Allow} for details
 * @returns The parsed JSON
 * @throws {PartialJSON} If the JSON is incomplete (related to the `allow` parameter)
 * @throws {MalformedJSON} If the JSON is malformed
 */
function parseJSON(jsonString, allowPartial = Allow.ALL) {
    if (typeof jsonString !== 'string') {
        throw new TypeError(`expecting str, got ${typeof jsonString}`);
    }
    if (!jsonString.trim()) {
        throw new Error(`${jsonString} is empty`);
    }
    return _parseJSON(jsonString.trim(), allowPartial);
}
const _parseJSON = (jsonString, allow) => {
    const length = jsonString.length;
    let index = 0;
    const markPartialJSON = (msg) => {
        throw new PartialJSON(`${msg} at position ${index}`);
    };
    const throwMalformedError = (msg) => {
        throw new MalformedJSON(`${msg} at position ${index}`);
    };
    const parseAny = () => {
        skipBlank();
        if (index >= length)
            markPartialJSON('Unexpected end of input');
        if (jsonString[index] === '"')
            return parseStr();
        if (jsonString[index] === '{')
            return parseObj();
        if (jsonString[index] === '[')
            return parseArr();
        if (jsonString.substring(index, index + 4) === 'null' ||
            (Allow.NULL & allow && length - index < 4 && 'null'.startsWith(jsonString.substring(index)))) {
            index += 4;
            return null;
        }
        if (jsonString.substring(index, index + 4) === 'true' ||
            (Allow.BOOL & allow && length - index < 4 && 'true'.startsWith(jsonString.substring(index)))) {
            index += 4;
            return true;
        }
        if (jsonString.substring(index, index + 5) === 'false' ||
            (Allow.BOOL & allow && length - index < 5 && 'false'.startsWith(jsonString.substring(index)))) {
            index += 5;
            return false;
        }
        if (jsonString.substring(index, index + 8) === 'Infinity' ||
            (Allow.INFINITY & allow && length - index < 8 && 'Infinity'.startsWith(jsonString.substring(index)))) {
            index += 8;
            return Infinity;
        }
        if (jsonString.substring(index, index + 9) === '-Infinity' ||
            (Allow.MINUS_INFINITY & allow &&
                1 < length - index &&
                length - index < 9 &&
                '-Infinity'.startsWith(jsonString.substring(index)))) {
            index += 9;
            return -Infinity;
        }
        if (jsonString.substring(index, index + 3) === 'NaN' ||
            (Allow.NAN & allow && length - index < 3 && 'NaN'.startsWith(jsonString.substring(index)))) {
            index += 3;
            return NaN;
        }
        return parseNum();
    };
    const parseStr = () => {
        const start = index;
        let escape = false;
        index++; // skip initial quote
        while (index < length && (jsonString[index] !== '"' || (escape && jsonString[index - 1] === '\\'))) {
            escape = jsonString[index] === '\\' ? !escape : false;
            index++;
        }
        if (jsonString.charAt(index) == '"') {
            try {
                return JSON.parse(jsonString.substring(start, ++index - Number(escape)));
            }
            catch (e) {
                throwMalformedError(String(e));
            }
        }
        else if (Allow.STR & allow) {
            try {
                return JSON.parse(jsonString.substring(start, index - Number(escape)) + '"');
            }
            catch (e) {
                // SyntaxError: Invalid escape sequence
                return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf('\\')) + '"');
            }
        }
        markPartialJSON('Unterminated string literal');
    };
    const parseObj = () => {
        index++; // skip initial brace
        skipBlank();
        const obj = {};
        try {
            while (jsonString[index] !== '}') {
                skipBlank();
                if (index >= length && Allow.OBJ & allow)
                    return obj;
                const key = parseStr();
                skipBlank();
                index++; // skip colon
                try {
                    const value = parseAny();
                    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
                }
                catch (e) {
                    if (Allow.OBJ & allow)
                        return obj;
                    else
                        throw e;
                }
                skipBlank();
                if (jsonString[index] === ',')
                    index++; // skip comma
            }
        }
        catch (e) {
            if (Allow.OBJ & allow)
                return obj;
            else
                markPartialJSON("Expected '}' at end of object");
        }
        index++; // skip final brace
        return obj;
    };
    const parseArr = () => {
        index++; // skip initial bracket
        const arr = [];
        try {
            while (jsonString[index] !== ']') {
                arr.push(parseAny());
                skipBlank();
                if (jsonString[index] === ',') {
                    index++; // skip comma
                }
            }
        }
        catch (e) {
            if (Allow.ARR & allow) {
                return arr;
            }
            markPartialJSON("Expected ']' at end of array");
        }
        index++; // skip final bracket
        return arr;
    };
    const parseNum = () => {
        if (index === 0) {
            if (jsonString === '-' && Allow.NUM & allow)
                markPartialJSON("Not sure what '-' is");
            try {
                return JSON.parse(jsonString);
            }
            catch (e) {
                if (Allow.NUM & allow) {
                    try {
                        if ('.' === jsonString[jsonString.length - 1])
                            return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf('.')));
                        return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf('e')));
                    }
                    catch (e) { }
                }
                throwMalformedError(String(e));
            }
        }
        const start = index;
        if (jsonString[index] === '-')
            index++;
        while (jsonString[index] && !',]}'.includes(jsonString[index]))
            index++;
        if (index == length && !(Allow.NUM & allow))
            markPartialJSON('Unterminated number literal');
        try {
            return JSON.parse(jsonString.substring(start, index));
        }
        catch (e) {
            if (jsonString.substring(start, index) === '-' && Allow.NUM & allow)
                markPartialJSON("Not sure what '-' is");
            try {
                return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf('e')));
            }
            catch (e) {
                throwMalformedError(String(e));
            }
        }
    };
    const skipBlank = () => {
        while (index < length && ' \n\r\t'.includes(jsonString[index])) {
            index++;
        }
    };
    return parseAny();
};
// using this function with malformed JSON is undefined behavior
const partialParse = (input) => parseJSON(input, Allow.ALL ^ Allow.NUM);

//# sourceMappingURL=parser.mjs.map

/***/ }),

/***/ "./node_modules/openai/core.mjs":
/*!**************************************!*\
  !*** ./node_modules/openai/core.mjs ***!
  \**************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   APIClient: () => (/* binding */ APIClient),
/* harmony export */   APIPromise: () => (/* binding */ APIPromise),
/* harmony export */   AbstractPage: () => (/* binding */ AbstractPage),
/* harmony export */   PagePromise: () => (/* binding */ PagePromise),
/* harmony export */   castToError: () => (/* binding */ castToError),
/* harmony export */   coerceBoolean: () => (/* binding */ coerceBoolean),
/* harmony export */   coerceFloat: () => (/* binding */ coerceFloat),
/* harmony export */   coerceInteger: () => (/* binding */ coerceInteger),
/* harmony export */   createForm: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_1__.createForm),
/* harmony export */   createResponseHeaders: () => (/* binding */ createResponseHeaders),
/* harmony export */   debug: () => (/* binding */ debug),
/* harmony export */   ensurePresent: () => (/* binding */ ensurePresent),
/* harmony export */   getHeader: () => (/* binding */ getHeader),
/* harmony export */   getRequiredHeader: () => (/* binding */ getRequiredHeader),
/* harmony export */   hasOwn: () => (/* binding */ hasOwn),
/* harmony export */   isEmptyObj: () => (/* binding */ isEmptyObj),
/* harmony export */   isHeadersProtocol: () => (/* binding */ isHeadersProtocol),
/* harmony export */   isObj: () => (/* binding */ isObj),
/* harmony export */   isRequestOptions: () => (/* binding */ isRequestOptions),
/* harmony export */   isRunningInBrowser: () => (/* binding */ isRunningInBrowser),
/* harmony export */   maybeCoerceBoolean: () => (/* binding */ maybeCoerceBoolean),
/* harmony export */   maybeCoerceFloat: () => (/* binding */ maybeCoerceFloat),
/* harmony export */   maybeCoerceInteger: () => (/* binding */ maybeCoerceInteger),
/* harmony export */   maybeMultipartFormRequestOptions: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_1__.maybeMultipartFormRequestOptions),
/* harmony export */   multipartFormRequestOptions: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions),
/* harmony export */   readEnv: () => (/* binding */ readEnv),
/* harmony export */   safeJSON: () => (/* binding */ safeJSON),
/* harmony export */   sleep: () => (/* binding */ sleep),
/* harmony export */   toBase64: () => (/* binding */ toBase64)
/* harmony export */ });
/* harmony import */ var _version_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./version.mjs */ "./node_modules/openai/version.mjs");
/* harmony import */ var _streaming_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./streaming.mjs */ "./node_modules/openai/streaming.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/openai/_shims/index.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/openai/uploads.mjs");
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractPage_client;






async function defaultParseResponse(props) {
    const { response } = props;
    if (props.options.stream) {
        debug('response', response.status, response.url, response.headers, response.body);
        // Note: there is an invariant here that isn't represented in the type system
        // that if you set `stream: true` the response type must also be `Stream<T>`
        if (props.options.__streamClass) {
            return props.options.__streamClass.fromSSEResponse(response, props.controller);
        }
        return _streaming_mjs__WEBPACK_IMPORTED_MODULE_2__.Stream.fromSSEResponse(response, props.controller);
    }
    // fetch refuses to read the body when the status code is 204.
    if (response.status === 204) {
        return null;
    }
    if (props.options.__binaryResponse) {
        return response;
    }
    const contentType = response.headers.get('content-type');
    const isJSON = contentType?.includes('application/json') || contentType?.includes('application/vnd.api+json');
    if (isJSON) {
        const json = await response.json();
        debug('response', response.status, response.url, response.headers, json);
        return _addRequestID(json, response);
    }
    const text = await response.text();
    debug('response', response.status, response.url, response.headers, text);
    // TODO handle blob, arraybuffer, other content types, etc.
    return text;
}
function _addRequestID(value, response) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }
    return Object.defineProperty(value, '_request_id', {
        value: response.headers.get('x-request-id'),
        enumerable: false,
    });
}
/**
 * A subclass of `Promise` providing additional helper methods
 * for interacting with the SDK.
 */
class APIPromise extends Promise {
    constructor(responsePromise, parseResponse = defaultParseResponse) {
        super((resolve) => {
            // this is maybe a bit weird but this has to be a no-op to not implicitly
            // parse the response body; instead .then, .catch, .finally are overridden
            // to parse the response
            resolve(null);
        });
        this.responsePromise = responsePromise;
        this.parseResponse = parseResponse;
    }
    _thenUnwrap(transform) {
        return new APIPromise(this.responsePromise, async (props) => _addRequestID(transform(await this.parseResponse(props), props), props.response));
    }
    /**
     * Gets the raw `Response` instance instead of parsing the response
     * data.
     *
     * If you want to parse the response body but still get the `Response`
     * instance, you can use {@link withResponse()}.
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` if you can,
     * or add one of these imports before your first `import … from 'openai'`:
     * - `import 'openai/shims/node'` (if you're running on Node)
     * - `import 'openai/shims/web'` (otherwise)
     */
    asResponse() {
        return this.responsePromise.then((p) => p.response);
    }
    /**
     * Gets the parsed response data, the raw `Response` instance and the ID of the request,
     * returned via the X-Request-ID header which is useful for debugging requests and reporting
     * issues to OpenAI.
     *
     * If you just want to get the raw `Response` instance without parsing it,
     * you can use {@link asResponse()}.
     *
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` if you can,
     * or add one of these imports before your first `import … from 'openai'`:
     * - `import 'openai/shims/node'` (if you're running on Node)
     * - `import 'openai/shims/web'` (otherwise)
     */
    async withResponse() {
        const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
        return { data, response, request_id: response.headers.get('x-request-id') };
    }
    parse() {
        if (!this.parsedPromise) {
            this.parsedPromise = this.responsePromise.then(this.parseResponse);
        }
        return this.parsedPromise;
    }
    then(onfulfilled, onrejected) {
        return this.parse().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
        return this.parse().catch(onrejected);
    }
    finally(onfinally) {
        return this.parse().finally(onfinally);
    }
}
class APIClient {
    constructor({ baseURL, maxRetries = 2, timeout = 600000, // 10 minutes
    httpAgent, fetch: overriddenFetch, }) {
        this.baseURL = baseURL;
        this.maxRetries = validatePositiveInteger('maxRetries', maxRetries);
        this.timeout = validatePositiveInteger('timeout', timeout);
        this.httpAgent = httpAgent;
        this.fetch = overriddenFetch ?? _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.fetch;
    }
    authHeaders(opts) {
        return {};
    }
    /**
     * Override this to add your own default headers, for example:
     *
     *  {
     *    ...super.defaultHeaders(),
     *    Authorization: 'Bearer 123',
     *  }
     */
    defaultHeaders(opts) {
        return {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': this.getUserAgent(),
            ...getPlatformHeaders(),
            ...this.authHeaders(opts),
        };
    }
    /**
     * Override this to add your own headers validation:
     */
    validateHeaders(headers, customHeaders) { }
    defaultIdempotencyKey() {
        return `stainless-node-retry-${uuid4()}`;
    }
    get(path, opts) {
        return this.methodRequest('get', path, opts);
    }
    post(path, opts) {
        return this.methodRequest('post', path, opts);
    }
    patch(path, opts) {
        return this.methodRequest('patch', path, opts);
    }
    put(path, opts) {
        return this.methodRequest('put', path, opts);
    }
    delete(path, opts) {
        return this.methodRequest('delete', path, opts);
    }
    methodRequest(method, path, opts) {
        return this.request(Promise.resolve(opts).then(async (opts) => {
            const body = opts && (0,_uploads_mjs__WEBPACK_IMPORTED_MODULE_1__.isBlobLike)(opts?.body) ? new DataView(await opts.body.arrayBuffer())
                : opts?.body instanceof DataView ? opts.body
                    : opts?.body instanceof ArrayBuffer ? new DataView(opts.body)
                        : opts && ArrayBuffer.isView(opts?.body) ? new DataView(opts.body.buffer)
                            : opts?.body;
            return { method, path, ...opts, body };
        }));
    }
    getAPIList(path, Page, opts) {
        return this.requestAPIList(Page, { method: 'get', path, ...opts });
    }
    calculateContentLength(body) {
        if (typeof body === 'string') {
            if (typeof Buffer !== 'undefined') {
                return Buffer.byteLength(body, 'utf8').toString();
            }
            if (typeof TextEncoder !== 'undefined') {
                const encoder = new TextEncoder();
                const encoded = encoder.encode(body);
                return encoded.length.toString();
            }
        }
        else if (ArrayBuffer.isView(body)) {
            return body.byteLength.toString();
        }
        return null;
    }
    buildRequest(options, { retryCount = 0 } = {}) {
        options = { ...options };
        const { method, path, query, headers: headers = {} } = options;
        const body = ArrayBuffer.isView(options.body) || (options.__binaryRequest && typeof options.body === 'string') ?
            options.body
            : (0,_uploads_mjs__WEBPACK_IMPORTED_MODULE_1__.isMultipartBody)(options.body) ? options.body.body
                : options.body ? JSON.stringify(options.body, null, 2)
                    : null;
        const contentLength = this.calculateContentLength(body);
        const url = this.buildURL(path, query);
        if ('timeout' in options)
            validatePositiveInteger('timeout', options.timeout);
        options.timeout = options.timeout ?? this.timeout;
        const httpAgent = options.httpAgent ?? this.httpAgent ?? (0,_shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.getDefaultAgent)(url);
        const minAgentTimeout = options.timeout + 1000;
        if (typeof httpAgent?.options?.timeout === 'number' &&
            minAgentTimeout > (httpAgent.options.timeout ?? 0)) {
            // Allow any given request to bump our agent active socket timeout.
            // This may seem strange, but leaking active sockets should be rare and not particularly problematic,
            // and without mutating agent we would need to create more of them.
            // This tradeoff optimizes for performance.
            httpAgent.options.timeout = minAgentTimeout;
        }
        if (this.idempotencyHeader && method !== 'get') {
            if (!options.idempotencyKey)
                options.idempotencyKey = this.defaultIdempotencyKey();
            headers[this.idempotencyHeader] = options.idempotencyKey;
        }
        const reqHeaders = this.buildHeaders({ options, headers, contentLength, retryCount });
        const req = {
            method,
            ...(body && { body: body }),
            headers: reqHeaders,
            ...(httpAgent && { agent: httpAgent }),
            // @ts-ignore node-fetch uses a custom AbortSignal type that is
            // not compatible with standard web types
            signal: options.signal ?? null,
        };
        return { req, url, timeout: options.timeout };
    }
    buildHeaders({ options, headers, contentLength, retryCount, }) {
        const reqHeaders = {};
        if (contentLength) {
            reqHeaders['content-length'] = contentLength;
        }
        const defaultHeaders = this.defaultHeaders(options);
        applyHeadersMut(reqHeaders, defaultHeaders);
        applyHeadersMut(reqHeaders, headers);
        // let builtin fetch set the Content-Type for multipart bodies
        if ((0,_uploads_mjs__WEBPACK_IMPORTED_MODULE_1__.isMultipartBody)(options.body) && _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.kind !== 'node') {
            delete reqHeaders['content-type'];
        }
        // Don't set theses headers if they were already set or removed through default headers or by the caller.
        // We check `defaultHeaders` and `headers`, which can contain nulls, instead of `reqHeaders` to account
        // for the removal case.
        if (getHeader(defaultHeaders, 'x-stainless-retry-count') === undefined &&
            getHeader(headers, 'x-stainless-retry-count') === undefined) {
            reqHeaders['x-stainless-retry-count'] = String(retryCount);
        }
        if (getHeader(defaultHeaders, 'x-stainless-timeout') === undefined &&
            getHeader(headers, 'x-stainless-timeout') === undefined &&
            options.timeout) {
            reqHeaders['x-stainless-timeout'] = String(options.timeout);
        }
        this.validateHeaders(reqHeaders, headers);
        return reqHeaders;
    }
    /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
     */
    async prepareOptions(options) { }
    /**
     * Used as a callback for mutating the given `RequestInit` object.
     *
     * This is useful for cases where you want to add certain headers based off of
     * the request properties, e.g. `method` or `url`.
     */
    async prepareRequest(request, { url, options }) { }
    parseHeaders(headers) {
        return (!headers ? {}
            : Symbol.iterator in headers ?
                Object.fromEntries(Array.from(headers).map((header) => [...header]))
                : { ...headers });
    }
    makeStatusError(status, error, message, headers) {
        return _error_mjs__WEBPACK_IMPORTED_MODULE_3__.APIError.generate(status, error, message, headers);
    }
    request(options, remainingRetries = null) {
        return new APIPromise(this.makeRequest(options, remainingRetries));
    }
    async makeRequest(optionsInput, retriesRemaining) {
        const options = await optionsInput;
        const maxRetries = options.maxRetries ?? this.maxRetries;
        if (retriesRemaining == null) {
            retriesRemaining = maxRetries;
        }
        await this.prepareOptions(options);
        const { req, url, timeout } = this.buildRequest(options, { retryCount: maxRetries - retriesRemaining });
        await this.prepareRequest(req, { url, options });
        debug('request', url, options, req.headers);
        if (options.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.APIUserAbortError();
        }
        const controller = new AbortController();
        const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
        if (response instanceof Error) {
            if (options.signal?.aborted) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.APIUserAbortError();
            }
            if (retriesRemaining) {
                return this.retryRequest(options, retriesRemaining);
            }
            if (response.name === 'AbortError') {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.APIConnectionTimeoutError();
            }
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.APIConnectionError({ cause: response });
        }
        const responseHeaders = createResponseHeaders(response.headers);
        if (!response.ok) {
            if (retriesRemaining && this.shouldRetry(response)) {
                const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
                debug(`response (error; ${retryMessage})`, response.status, url, responseHeaders);
                return this.retryRequest(options, retriesRemaining, responseHeaders);
            }
            const errText = await response.text().catch((e) => castToError(e).message);
            const errJSON = safeJSON(errText);
            const errMessage = errJSON ? undefined : errText;
            const retryMessage = retriesRemaining ? `(error; no more retries left)` : `(error; not retryable)`;
            debug(`response (error; ${retryMessage})`, response.status, url, responseHeaders, errMessage);
            const err = this.makeStatusError(response.status, errJSON, errMessage, responseHeaders);
            throw err;
        }
        return { response, options, controller };
    }
    requestAPIList(Page, options) {
        const request = this.makeRequest(options, null);
        return new PagePromise(this, request, Page);
    }
    buildURL(path, query) {
        const url = isAbsoluteURL(path) ?
            new URL(path)
            : new URL(this.baseURL + (this.baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));
        const defaultQuery = this.defaultQuery();
        if (!isEmptyObj(defaultQuery)) {
            query = { ...defaultQuery, ...query };
        }
        if (typeof query === 'object' && query && !Array.isArray(query)) {
            url.search = this.stringifyQuery(query);
        }
        return url.toString();
    }
    stringifyQuery(query) {
        return Object.entries(query)
            .filter(([_, value]) => typeof value !== 'undefined')
            .map(([key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            }
            if (value === null) {
                return `${encodeURIComponent(key)}=`;
            }
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError(`Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
        })
            .join('&');
    }
    async fetchWithTimeout(url, init, ms, controller) {
        const { signal, ...options } = init || {};
        if (signal)
            signal.addEventListener('abort', () => controller.abort());
        const timeout = setTimeout(() => controller.abort(), ms);
        const fetchOptions = {
            signal: controller.signal,
            ...options,
        };
        if (fetchOptions.method) {
            // Custom methods like 'patch' need to be uppercased
            // See https://github.com/nodejs/undici/issues/2294
            fetchOptions.method = fetchOptions.method.toUpperCase();
        }
        return (
        // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
        this.fetch.call(undefined, url, fetchOptions).finally(() => {
            clearTimeout(timeout);
        }));
    }
    shouldRetry(response) {
        // Note this is not a standard header.
        const shouldRetryHeader = response.headers.get('x-should-retry');
        // If the server explicitly says whether or not to retry, obey.
        if (shouldRetryHeader === 'true')
            return true;
        if (shouldRetryHeader === 'false')
            return false;
        // Retry on request timeouts.
        if (response.status === 408)
            return true;
        // Retry on lock timeouts.
        if (response.status === 409)
            return true;
        // Retry on rate limits.
        if (response.status === 429)
            return true;
        // Retry internal errors.
        if (response.status >= 500)
            return true;
        return false;
    }
    async retryRequest(options, retriesRemaining, responseHeaders) {
        let timeoutMillis;
        // Note the `retry-after-ms` header may not be standard, but is a good idea and we'd like proactive support for it.
        const retryAfterMillisHeader = responseHeaders?.['retry-after-ms'];
        if (retryAfterMillisHeader) {
            const timeoutMs = parseFloat(retryAfterMillisHeader);
            if (!Number.isNaN(timeoutMs)) {
                timeoutMillis = timeoutMs;
            }
        }
        // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
        const retryAfterHeader = responseHeaders?.['retry-after'];
        if (retryAfterHeader && !timeoutMillis) {
            const timeoutSeconds = parseFloat(retryAfterHeader);
            if (!Number.isNaN(timeoutSeconds)) {
                timeoutMillis = timeoutSeconds * 1000;
            }
            else {
                timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
            }
        }
        // If the API asks us to wait a certain amount of time (and it's a reasonable amount),
        // just do what it says, but otherwise calculate a default
        if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1000)) {
            const maxRetries = options.maxRetries ?? this.maxRetries;
            timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
        }
        await sleep(timeoutMillis);
        return this.makeRequest(options, retriesRemaining - 1);
    }
    calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
        const initialRetryDelay = 0.5;
        const maxRetryDelay = 8.0;
        const numRetries = maxRetries - retriesRemaining;
        // Apply exponential backoff, but not more than the max.
        const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
        // Apply some jitter, take up to at most 25 percent of the retry time.
        const jitter = 1 - Math.random() * 0.25;
        return sleepSeconds * jitter * 1000;
    }
    getUserAgent() {
        return `${this.constructor.name}/JS ${_version_mjs__WEBPACK_IMPORTED_MODULE_4__.VERSION}`;
    }
}
class AbstractPage {
    constructor(client, response, body, options) {
        _AbstractPage_client.set(this, void 0);
        __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
        this.options = options;
        this.response = response;
        this.body = body;
    }
    hasNextPage() {
        const items = this.getPaginatedItems();
        if (!items.length)
            return false;
        return this.nextPageInfo() != null;
    }
    async getNextPage() {
        const nextInfo = this.nextPageInfo();
        if (!nextInfo) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError('No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.');
        }
        const nextOptions = { ...this.options };
        if ('params' in nextInfo && typeof nextOptions.query === 'object') {
            nextOptions.query = { ...nextOptions.query, ...nextInfo.params };
        }
        else if ('url' in nextInfo) {
            const params = [...Object.entries(nextOptions.query || {}), ...nextInfo.url.searchParams.entries()];
            for (const [key, value] of params) {
                nextInfo.url.searchParams.set(key, value);
            }
            nextOptions.query = undefined;
            nextOptions.path = nextInfo.url.toString();
        }
        return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
    }
    async *iterPages() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let page = this;
        yield page;
        while (page.hasNextPage()) {
            page = await page.getNextPage();
            yield page;
        }
    }
    async *[(_AbstractPage_client = new WeakMap(), Symbol.asyncIterator)]() {
        for await (const page of this.iterPages()) {
            for (const item of page.getPaginatedItems()) {
                yield item;
            }
        }
    }
}
/**
 * This subclass of Promise will resolve to an instantiated Page once the request completes.
 *
 * It also implements AsyncIterable to allow auto-paginating iteration on an unawaited list call, eg:
 *
 *    for await (const item of client.items.list()) {
 *      console.log(item)
 *    }
 */
class PagePromise extends APIPromise {
    constructor(client, request, Page) {
        super(request, async (props) => new Page(client, props.response, await defaultParseResponse(props), props.options));
    }
    /**
     * Allow auto-paginating iteration on an unawaited list call, eg:
     *
     *    for await (const item of client.items.list()) {
     *      console.log(item)
     *    }
     */
    async *[Symbol.asyncIterator]() {
        const page = await this;
        for await (const item of page) {
            yield item;
        }
    }
}
const createResponseHeaders = (headers) => {
    return new Proxy(Object.fromEntries(
    // @ts-ignore
    headers.entries()), {
        get(target, name) {
            const key = name.toString();
            return target[key.toLowerCase()] || target[key];
        },
    });
};
// This is required so that we can determine if a given object matches the RequestOptions
// type at runtime. While this requires duplication, it is enforced by the TypeScript
// compiler such that any missing / extraneous keys will cause an error.
const requestOptionsKeys = {
    method: true,
    path: true,
    query: true,
    body: true,
    headers: true,
    maxRetries: true,
    stream: true,
    timeout: true,
    httpAgent: true,
    signal: true,
    idempotencyKey: true,
    __metadata: true,
    __binaryRequest: true,
    __binaryResponse: true,
    __streamClass: true,
};
const isRequestOptions = (obj) => {
    return (typeof obj === 'object' &&
        obj !== null &&
        !isEmptyObj(obj) &&
        Object.keys(obj).every((k) => hasOwn(requestOptionsKeys, k)));
};
const getPlatformProperties = () => {
    if (typeof Deno !== 'undefined' && Deno.build != null) {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': _version_mjs__WEBPACK_IMPORTED_MODULE_4__.VERSION,
            'X-Stainless-OS': normalizePlatform(Deno.build.os),
            'X-Stainless-Arch': normalizeArch(Deno.build.arch),
            'X-Stainless-Runtime': 'deno',
            'X-Stainless-Runtime-Version': typeof Deno.version === 'string' ? Deno.version : Deno.version?.deno ?? 'unknown',
        };
    }
    if (typeof EdgeRuntime !== 'undefined') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': _version_mjs__WEBPACK_IMPORTED_MODULE_4__.VERSION,
            'X-Stainless-OS': 'Unknown',
            'X-Stainless-Arch': `other:${EdgeRuntime}`,
            'X-Stainless-Runtime': 'edge',
            'X-Stainless-Runtime-Version': process.version,
        };
    }
    // Check if Node.js
    if (Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': _version_mjs__WEBPACK_IMPORTED_MODULE_4__.VERSION,
            'X-Stainless-OS': normalizePlatform(process.platform),
            'X-Stainless-Arch': normalizeArch(process.arch),
            'X-Stainless-Runtime': 'node',
            'X-Stainless-Runtime-Version': process.version,
        };
    }
    const browserInfo = getBrowserInfo();
    if (browserInfo) {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': _version_mjs__WEBPACK_IMPORTED_MODULE_4__.VERSION,
            'X-Stainless-OS': 'Unknown',
            'X-Stainless-Arch': 'unknown',
            'X-Stainless-Runtime': `browser:${browserInfo.browser}`,
            'X-Stainless-Runtime-Version': browserInfo.version,
        };
    }
    // TODO add support for Cloudflare workers, etc.
    return {
        'X-Stainless-Lang': 'js',
        'X-Stainless-Package-Version': _version_mjs__WEBPACK_IMPORTED_MODULE_4__.VERSION,
        'X-Stainless-OS': 'Unknown',
        'X-Stainless-Arch': 'unknown',
        'X-Stainless-Runtime': 'unknown',
        'X-Stainless-Runtime-Version': 'unknown',
    };
};
// Note: modified from https://github.com/JS-DevTools/host-environment/blob/b1ab79ecde37db5d6e163c050e54fe7d287d7c92/src/isomorphic.browser.ts
function getBrowserInfo() {
    if (typeof navigator === 'undefined' || !navigator) {
        return null;
    }
    // NOTE: The order matters here!
    const browserPatterns = [
        { key: 'edge', pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'ie', pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'ie', pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'chrome', pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'firefox', pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'safari', pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ },
    ];
    // Find the FIRST matching browser
    for (const { key, pattern } of browserPatterns) {
        const match = pattern.exec(navigator.userAgent);
        if (match) {
            const major = match[1] || 0;
            const minor = match[2] || 0;
            const patch = match[3] || 0;
            return { browser: key, version: `${major}.${minor}.${patch}` };
        }
    }
    return null;
}
const normalizeArch = (arch) => {
    // Node docs:
    // - https://nodejs.org/api/process.html#processarch
    // Deno docs:
    // - https://doc.deno.land/deno/stable/~/Deno.build
    if (arch === 'x32')
        return 'x32';
    if (arch === 'x86_64' || arch === 'x64')
        return 'x64';
    if (arch === 'arm')
        return 'arm';
    if (arch === 'aarch64' || arch === 'arm64')
        return 'arm64';
    if (arch)
        return `other:${arch}`;
    return 'unknown';
};
const normalizePlatform = (platform) => {
    // Node platforms:
    // - https://nodejs.org/api/process.html#processplatform
    // Deno platforms:
    // - https://doc.deno.land/deno/stable/~/Deno.build
    // - https://github.com/denoland/deno/issues/14799
    platform = platform.toLowerCase();
    // NOTE: this iOS check is untested and may not work
    // Node does not work natively on IOS, there is a fork at
    // https://github.com/nodejs-mobile/nodejs-mobile
    // however it is unknown at the time of writing how to detect if it is running
    if (platform.includes('ios'))
        return 'iOS';
    if (platform === 'android')
        return 'Android';
    if (platform === 'darwin')
        return 'MacOS';
    if (platform === 'win32')
        return 'Windows';
    if (platform === 'freebsd')
        return 'FreeBSD';
    if (platform === 'openbsd')
        return 'OpenBSD';
    if (platform === 'linux')
        return 'Linux';
    if (platform)
        return `Other:${platform}`;
    return 'Unknown';
};
let _platformHeaders;
const getPlatformHeaders = () => {
    return (_platformHeaders ?? (_platformHeaders = getPlatformProperties()));
};
const safeJSON = (text) => {
    try {
        return JSON.parse(text);
    }
    catch (err) {
        return undefined;
    }
};
// https://url.spec.whatwg.org/#url-scheme-string
const startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
const isAbsoluteURL = (url) => {
    return startsWithSchemeRegexp.test(url);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const validatePositiveInteger = (name, n) => {
    if (typeof n !== 'number' || !Number.isInteger(n)) {
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError(`${name} must be an integer`);
    }
    if (n < 0) {
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError(`${name} must be a positive integer`);
    }
    return n;
};
const castToError = (err) => {
    if (err instanceof Error)
        return err;
    if (typeof err === 'object' && err !== null) {
        try {
            return new Error(JSON.stringify(err));
        }
        catch { }
    }
    return new Error(err);
};
const ensurePresent = (value) => {
    if (value == null)
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError(`Expected a value to be given but received ${value} instead.`);
    return value;
};
/**
 * Read an environment variable.
 *
 * Trims beginning and trailing whitespace.
 *
 * Will return undefined if the environment variable doesn't exist or cannot be accessed.
 */
const readEnv = (env) => {
    if (typeof process !== 'undefined') {
        return "MISSING_ENV_VAR"?.[env]?.trim() ?? undefined;
    }
    if (typeof Deno !== 'undefined') {
        return Deno.env?.get?.(env)?.trim();
    }
    return undefined;
};
const coerceInteger = (value) => {
    if (typeof value === 'number')
        return Math.round(value);
    if (typeof value === 'string')
        return parseInt(value, 10);
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
const coerceFloat = (value) => {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string')
        return parseFloat(value);
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
const coerceBoolean = (value) => {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return value === 'true';
    return Boolean(value);
};
const maybeCoerceInteger = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return coerceInteger(value);
};
const maybeCoerceFloat = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return coerceFloat(value);
};
const maybeCoerceBoolean = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return coerceBoolean(value);
};
// https://stackoverflow.com/a/34491287
function isEmptyObj(obj) {
    if (!obj)
        return true;
    for (const _k in obj)
        return false;
    return true;
}
// https://eslint.org/docs/latest/rules/no-prototype-builtins
function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
/**
 * Copies headers from "newHeaders" onto "targetHeaders",
 * using lower-case for all properties,
 * ignoring any keys with undefined values,
 * and deleting any keys with null values.
 */
function applyHeadersMut(targetHeaders, newHeaders) {
    for (const k in newHeaders) {
        if (!hasOwn(newHeaders, k))
            continue;
        const lowerKey = k.toLowerCase();
        if (!lowerKey)
            continue;
        const val = newHeaders[k];
        if (val === null) {
            delete targetHeaders[lowerKey];
        }
        else if (val !== undefined) {
            targetHeaders[lowerKey] = val;
        }
    }
}
const SENSITIVE_HEADERS = new Set(['authorization', 'api-key']);
function debug(action, ...args) {
    if (typeof process !== 'undefined' && "MISSING_ENV_VAR"?.['DEBUG'] === 'true') {
        const modifiedArgs = args.map((arg) => {
            if (!arg) {
                return arg;
            }
            // Check for sensitive headers in request body 'headers' object
            if (arg['headers']) {
                // clone so we don't mutate
                const modifiedArg = { ...arg, headers: { ...arg['headers'] } };
                for (const header in arg['headers']) {
                    if (SENSITIVE_HEADERS.has(header.toLowerCase())) {
                        modifiedArg['headers'][header] = 'REDACTED';
                    }
                }
                return modifiedArg;
            }
            let modifiedArg = null;
            // Check for sensitive headers in headers object
            for (const header in arg) {
                if (SENSITIVE_HEADERS.has(header.toLowerCase())) {
                    // avoid making a copy until we need to
                    modifiedArg ?? (modifiedArg = { ...arg });
                    modifiedArg[header] = 'REDACTED';
                }
            }
            return modifiedArg ?? arg;
        });
        console.log(`OpenAI:DEBUG:${action}`, ...modifiedArgs);
    }
}
/**
 * https://stackoverflow.com/a/2117523
 */
const uuid4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
const isRunningInBrowser = () => {
    return (
    // @ts-ignore
    typeof window !== 'undefined' &&
        // @ts-ignore
        typeof window.document !== 'undefined' &&
        // @ts-ignore
        typeof navigator !== 'undefined');
};
const isHeadersProtocol = (headers) => {
    return typeof headers?.get === 'function';
};
const getRequiredHeader = (headers, header) => {
    const foundHeader = getHeader(headers, header);
    if (foundHeader === undefined) {
        throw new Error(`Could not find ${header} header`);
    }
    return foundHeader;
};
const getHeader = (headers, header) => {
    const lowerCasedHeader = header.toLowerCase();
    if (isHeadersProtocol(headers)) {
        // to deal with the case where the header looks like Stainless-Event-Id
        const intercapsHeader = header[0]?.toUpperCase() +
            header.substring(1).replace(/([^\w])(\w)/g, (_m, g1, g2) => g1 + g2.toUpperCase());
        for (const key of [header, lowerCasedHeader, header.toUpperCase(), intercapsHeader]) {
            const value = headers.get(key);
            if (value) {
                return value;
            }
        }
    }
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerCasedHeader) {
            if (Array.isArray(value)) {
                if (value.length <= 1)
                    return value[0];
                console.warn(`Received ${value.length} entries for the ${header} header, using the first entry.`);
                return value[0];
            }
            return value;
        }
    }
    return undefined;
};
/**
 * Encodes a string to Base64 format.
 */
const toBase64 = (str) => {
    if (!str)
        return '';
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str).toString('base64');
    }
    if (typeof btoa !== 'undefined') {
        return btoa(str);
    }
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.OpenAIError('Cannot generate b64 string; Expected `Buffer` or `btoa` to be defined');
};
function isObj(obj) {
    return obj != null && typeof obj === 'object' && !Array.isArray(obj);
}
//# sourceMappingURL=core.mjs.map

/***/ }),

/***/ "./node_modules/openai/error.mjs":
/*!***************************************!*\
  !*** ./node_modules/openai/error.mjs ***!
  \***************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   APIConnectionError: () => (/* binding */ APIConnectionError),
/* harmony export */   APIConnectionTimeoutError: () => (/* binding */ APIConnectionTimeoutError),
/* harmony export */   APIError: () => (/* binding */ APIError),
/* harmony export */   APIUserAbortError: () => (/* binding */ APIUserAbortError),
/* harmony export */   AuthenticationError: () => (/* binding */ AuthenticationError),
/* harmony export */   BadRequestError: () => (/* binding */ BadRequestError),
/* harmony export */   ConflictError: () => (/* binding */ ConflictError),
/* harmony export */   ContentFilterFinishReasonError: () => (/* binding */ ContentFilterFinishReasonError),
/* harmony export */   InternalServerError: () => (/* binding */ InternalServerError),
/* harmony export */   LengthFinishReasonError: () => (/* binding */ LengthFinishReasonError),
/* harmony export */   NotFoundError: () => (/* binding */ NotFoundError),
/* harmony export */   OpenAIError: () => (/* binding */ OpenAIError),
/* harmony export */   PermissionDeniedError: () => (/* binding */ PermissionDeniedError),
/* harmony export */   RateLimitError: () => (/* binding */ RateLimitError),
/* harmony export */   UnprocessableEntityError: () => (/* binding */ UnprocessableEntityError)
/* harmony export */ });
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/openai/core.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class OpenAIError extends Error {
}
class APIError extends OpenAIError {
    constructor(status, error, message, headers) {
        super(`${APIError.makeMessage(status, error, message)}`);
        this.status = status;
        this.headers = headers;
        this.request_id = headers?.['x-request-id'];
        this.error = error;
        const data = error;
        this.code = data?.['code'];
        this.param = data?.['param'];
        this.type = data?.['type'];
    }
    static makeMessage(status, error, message) {
        const msg = error?.message ?
            typeof error.message === 'string' ?
                error.message
                : JSON.stringify(error.message)
            : error ? JSON.stringify(error)
                : message;
        if (status && msg) {
            return `${status} ${msg}`;
        }
        if (status) {
            return `${status} status code (no body)`;
        }
        if (msg) {
            return msg;
        }
        return '(no status code or body)';
    }
    static generate(status, errorResponse, message, headers) {
        if (!status || !headers) {
            return new APIConnectionError({ message, cause: (0,_core_mjs__WEBPACK_IMPORTED_MODULE_0__.castToError)(errorResponse) });
        }
        const error = errorResponse?.['error'];
        if (status === 400) {
            return new BadRequestError(status, error, message, headers);
        }
        if (status === 401) {
            return new AuthenticationError(status, error, message, headers);
        }
        if (status === 403) {
            return new PermissionDeniedError(status, error, message, headers);
        }
        if (status === 404) {
            return new NotFoundError(status, error, message, headers);
        }
        if (status === 409) {
            return new ConflictError(status, error, message, headers);
        }
        if (status === 422) {
            return new UnprocessableEntityError(status, error, message, headers);
        }
        if (status === 429) {
            return new RateLimitError(status, error, message, headers);
        }
        if (status >= 500) {
            return new InternalServerError(status, error, message, headers);
        }
        return new APIError(status, error, message, headers);
    }
}
class APIUserAbortError extends APIError {
    constructor({ message } = {}) {
        super(undefined, undefined, message || 'Request was aborted.', undefined);
    }
}
class APIConnectionError extends APIError {
    constructor({ message, cause }) {
        super(undefined, undefined, message || 'Connection error.', undefined);
        // in some environments the 'cause' property is already declared
        // @ts-ignore
        if (cause)
            this.cause = cause;
    }
}
class APIConnectionTimeoutError extends APIConnectionError {
    constructor({ message } = {}) {
        super({ message: message ?? 'Request timed out.' });
    }
}
class BadRequestError extends APIError {
}
class AuthenticationError extends APIError {
}
class PermissionDeniedError extends APIError {
}
class NotFoundError extends APIError {
}
class ConflictError extends APIError {
}
class UnprocessableEntityError extends APIError {
}
class RateLimitError extends APIError {
}
class InternalServerError extends APIError {
}
class LengthFinishReasonError extends OpenAIError {
    constructor() {
        super(`Could not parse response content as the length limit was reached`);
    }
}
class ContentFilterFinishReasonError extends OpenAIError {
    constructor() {
        super(`Could not parse response content as the request was rejected by the content filter`);
    }
}
//# sourceMappingURL=error.mjs.map

/***/ }),

/***/ "./node_modules/openai/index.mjs":
/*!***************************************!*\
  !*** ./node_modules/openai/index.mjs ***!
  \***************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   APIConnectionError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionError),
/* harmony export */   APIConnectionTimeoutError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionTimeoutError),
/* harmony export */   APIError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError),
/* harmony export */   APIUserAbortError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError),
/* harmony export */   AuthenticationError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.AuthenticationError),
/* harmony export */   AzureOpenAI: () => (/* binding */ AzureOpenAI),
/* harmony export */   BadRequestError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.BadRequestError),
/* harmony export */   ConflictError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.ConflictError),
/* harmony export */   InternalServerError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.InternalServerError),
/* harmony export */   NotFoundError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.NotFoundError),
/* harmony export */   OpenAI: () => (/* binding */ OpenAI),
/* harmony export */   OpenAIError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError),
/* harmony export */   PermissionDeniedError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.PermissionDeniedError),
/* harmony export */   RateLimitError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.RateLimitError),
/* harmony export */   UnprocessableEntityError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.UnprocessableEntityError),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   fileFromPath: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_16__.fileFromPath),
/* harmony export */   toFile: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_15__.toFile)
/* harmony export */ });
/* harmony import */ var _internal_qs_index_mjs__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./internal/qs/index.mjs */ "./node_modules/openai/internal/qs/stringify.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/openai/uploads.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/openai/_shims/index.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./resources/completions.mjs */ "./node_modules/openai/resources/completions.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./resources/chat/chat.mjs */ "./node_modules/openai/resources/chat/chat.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./resources/embeddings.mjs */ "./node_modules/openai/resources/embeddings.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./resources/files.mjs */ "./node_modules/openai/resources/files.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./resources/images.mjs */ "./node_modules/openai/resources/images.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./resources/audio/audio.mjs */ "./node_modules/openai/resources/audio/audio.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./resources/moderations.mjs */ "./node_modules/openai/resources/moderations.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./resources/models.mjs */ "./node_modules/openai/resources/models.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./resources/fine-tuning/fine-tuning.mjs */ "./node_modules/openai/resources/fine-tuning/fine-tuning.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./resources/beta/beta.mjs */ "./node_modules/openai/resources/beta/beta.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./resources/batches.mjs */ "./node_modules/openai/resources/batches.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./resources/uploads/uploads.mjs */ "./node_modules/openai/resources/uploads/uploads.mjs");
/* harmony import */ var _resources_chat_completions_completions_mjs__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./resources/chat/completions/completions.mjs */ "./node_modules/openai/resources/chat/completions/completions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _a;



















/**
 * API Client for interfacing with the OpenAI API.
 */
class OpenAI extends _core_mjs__WEBPACK_IMPORTED_MODULE_0__.APIClient {
    /**
     * API Client for interfacing with the OpenAI API.
     *
     * @param {string | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? undefined]
     * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
     * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
     * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
     * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
     */
    constructor({ baseURL = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('OPENAI_BASE_URL'), apiKey = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('OPENAI_API_KEY'), organization = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('OPENAI_ORG_ID') ?? null, project = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('OPENAI_PROJECT_ID') ?? null, ...opts } = {}) {
        if (apiKey === undefined) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError("The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).");
        }
        const options = {
            apiKey,
            organization,
            project,
            ...opts,
            baseURL: baseURL || `https://api.openai.com/v1`,
        };
        if (!options.dangerouslyAllowBrowser && _core_mjs__WEBPACK_IMPORTED_MODULE_0__.isRunningInBrowser()) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew OpenAI({ apiKey, dangerouslyAllowBrowser: true });\n\nhttps://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety\n");
        }
        super({
            baseURL: options.baseURL,
            timeout: options.timeout ?? 600000 /* 10 minutes */,
            httpAgent: options.httpAgent,
            maxRetries: options.maxRetries,
            fetch: options.fetch,
        });
        this.completions = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__.Completions(this);
        this.chat = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__.Chat(this);
        this.embeddings = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__.Embeddings(this);
        this.files = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.Files(this);
        this.images = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__.Images(this);
        this.audio = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__.Audio(this);
        this.moderations = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__.Moderations(this);
        this.models = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__.Models(this);
        this.fineTuning = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_10__.FineTuning(this);
        this.beta = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__.Beta(this);
        this.batches = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__.Batches(this);
        this.uploads = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__.Uploads(this);
        this._options = options;
        this.apiKey = apiKey;
        this.organization = organization;
        this.project = project;
    }
    defaultQuery() {
        return this._options.defaultQuery;
    }
    defaultHeaders(opts) {
        return {
            ...super.defaultHeaders(opts),
            'OpenAI-Organization': this.organization,
            'OpenAI-Project': this.project,
            ...this._options.defaultHeaders,
        };
    }
    authHeaders(opts) {
        return { Authorization: `Bearer ${this.apiKey}` };
    }
    stringifyQuery(query) {
        return _internal_qs_index_mjs__WEBPACK_IMPORTED_MODULE_14__.stringify(query, { arrayFormat: 'brackets' });
    }
}
_a = OpenAI;
OpenAI.OpenAI = _a;
OpenAI.DEFAULT_TIMEOUT = 600000; // 10 minutes
OpenAI.OpenAIError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError;
OpenAI.APIError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError;
OpenAI.APIConnectionError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionError;
OpenAI.APIConnectionTimeoutError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionTimeoutError;
OpenAI.APIUserAbortError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError;
OpenAI.NotFoundError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.NotFoundError;
OpenAI.ConflictError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.ConflictError;
OpenAI.RateLimitError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.RateLimitError;
OpenAI.BadRequestError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.BadRequestError;
OpenAI.AuthenticationError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.AuthenticationError;
OpenAI.InternalServerError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.InternalServerError;
OpenAI.PermissionDeniedError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.PermissionDeniedError;
OpenAI.UnprocessableEntityError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.UnprocessableEntityError;
OpenAI.toFile = _uploads_mjs__WEBPACK_IMPORTED_MODULE_15__.toFile;
OpenAI.fileFromPath = _uploads_mjs__WEBPACK_IMPORTED_MODULE_16__.fileFromPath;
OpenAI.Completions = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__.Completions;
OpenAI.Chat = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__.Chat;
OpenAI.ChatCompletionsPage = _resources_chat_completions_completions_mjs__WEBPACK_IMPORTED_MODULE_17__.ChatCompletionsPage;
OpenAI.Embeddings = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__.Embeddings;
OpenAI.Files = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.Files;
OpenAI.FileObjectsPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.FileObjectsPage;
OpenAI.Images = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__.Images;
OpenAI.Audio = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__.Audio;
OpenAI.Moderations = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__.Moderations;
OpenAI.Models = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__.Models;
OpenAI.ModelsPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__.ModelsPage;
OpenAI.FineTuning = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_10__.FineTuning;
OpenAI.Beta = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__.Beta;
OpenAI.Batches = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__.Batches;
OpenAI.BatchesPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__.BatchesPage;
OpenAI.Uploads = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__.Uploads;
/** API Client for interfacing with the Azure OpenAI API. */
class AzureOpenAI extends OpenAI {
    /**
     * API Client for interfacing with the Azure OpenAI API.
     *
     * @param {string | undefined} [opts.apiVersion=process.env['OPENAI_API_VERSION'] ?? undefined]
     * @param {string | undefined} [opts.endpoint=process.env['AZURE_OPENAI_ENDPOINT'] ?? undefined] - Your Azure endpoint, including the resource, e.g. `https://example-resource.azure.openai.com/`
     * @param {string | undefined} [opts.apiKey=process.env['AZURE_OPENAI_API_KEY'] ?? undefined]
     * @param {string | undefined} opts.deployment - A model deployment, if given, sets the base client URL to include `/deployments/{deployment}`.
     * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
     * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL']] - Sets the base URL for the API, e.g. `https://example-resource.azure.openai.com/openai/`.
     * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
     */
    constructor({ baseURL = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('OPENAI_BASE_URL'), apiKey = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('AZURE_OPENAI_API_KEY'), apiVersion = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('OPENAI_API_VERSION'), endpoint, deployment, azureADTokenProvider, dangerouslyAllowBrowser, ...opts } = {}) {
        if (!apiVersion) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError("The OPENAI_API_VERSION environment variable is missing or empty; either provide it, or instantiate the AzureOpenAI client with an apiVersion option, like new AzureOpenAI({ apiVersion: 'My API Version' }).");
        }
        if (typeof azureADTokenProvider === 'function') {
            dangerouslyAllowBrowser = true;
        }
        if (!azureADTokenProvider && !apiKey) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError('Missing credentials. Please pass one of `apiKey` and `azureADTokenProvider`, or set the `AZURE_OPENAI_API_KEY` environment variable.');
        }
        if (azureADTokenProvider && apiKey) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError('The `apiKey` and `azureADTokenProvider` arguments are mutually exclusive; only one can be passed at a time.');
        }
        // define a sentinel value to avoid any typing issues
        apiKey ?? (apiKey = API_KEY_SENTINEL);
        opts.defaultQuery = { ...opts.defaultQuery, 'api-version': apiVersion };
        if (!baseURL) {
            if (!endpoint) {
                endpoint = "MISSING_ENV_VAR"['AZURE_OPENAI_ENDPOINT'];
            }
            if (!endpoint) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError('Must provide one of the `baseURL` or `endpoint` arguments, or the `AZURE_OPENAI_ENDPOINT` environment variable');
            }
            baseURL = `${endpoint}/openai`;
        }
        else {
            if (endpoint) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError('baseURL and endpoint are mutually exclusive');
            }
        }
        super({
            apiKey,
            baseURL,
            ...opts,
            ...(dangerouslyAllowBrowser !== undefined ? { dangerouslyAllowBrowser } : {}),
        });
        this.apiVersion = '';
        this._azureADTokenProvider = azureADTokenProvider;
        this.apiVersion = apiVersion;
        this.deploymentName = deployment;
    }
    buildRequest(options, props = {}) {
        if (_deployments_endpoints.has(options.path) && options.method === 'post' && options.body !== undefined) {
            if (!_core_mjs__WEBPACK_IMPORTED_MODULE_0__.isObj(options.body)) {
                throw new Error('Expected request body to be an object');
            }
            const model = this.deploymentName || options.body['model'] || options.__metadata?.['model'];
            if (model !== undefined && !this.baseURL.includes('/deployments')) {
                options.path = `/deployments/${model}${options.path}`;
            }
        }
        return super.buildRequest(options, props);
    }
    async _getAzureADToken() {
        if (typeof this._azureADTokenProvider === 'function') {
            const token = await this._azureADTokenProvider();
            if (!token || typeof token !== 'string') {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`Expected 'azureADTokenProvider' argument to return a string but it returned ${token}`);
            }
            return token;
        }
        return undefined;
    }
    authHeaders(opts) {
        return {};
    }
    async prepareOptions(opts) {
        /**
         * The user should provide a bearer token provider if they want
         * to use Azure AD authentication. The user shouldn't set the
         * Authorization header manually because the header is overwritten
         * with the Azure AD token if a bearer token provider is provided.
         */
        if (opts.headers?.['api-key']) {
            return super.prepareOptions(opts);
        }
        const token = await this._getAzureADToken();
        opts.headers ?? (opts.headers = {});
        if (token) {
            opts.headers['Authorization'] = `Bearer ${token}`;
        }
        else if (this.apiKey !== API_KEY_SENTINEL) {
            opts.headers['api-key'] = this.apiKey;
        }
        else {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError('Unable to handle auth');
        }
        return super.prepareOptions(opts);
    }
}
const _deployments_endpoints = new Set([
    '/completions',
    '/chat/completions',
    '/embeddings',
    '/audio/transcriptions',
    '/audio/translations',
    '/audio/speech',
    '/images/generations',
]);
const API_KEY_SENTINEL = '<Missing Key>';


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OpenAI);
//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/openai/internal/decoders/line.mjs":
/*!********************************************************!*\
  !*** ./node_modules/openai/internal/decoders/line.mjs ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LineDecoder: () => (/* binding */ LineDecoder)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../error.mjs */ "./node_modules/openai/error.mjs");
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _LineDecoder_carriageReturnIndex;

/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */
class LineDecoder {
    constructor() {
        _LineDecoder_carriageReturnIndex.set(this, void 0);
        this.buffer = new Uint8Array();
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    decode(chunk) {
        if (chunk == null) {
            return [];
        }
        const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
            : typeof chunk === 'string' ? new TextEncoder().encode(chunk)
                : chunk;
        let newData = new Uint8Array(this.buffer.length + binaryChunk.length);
        newData.set(this.buffer);
        newData.set(binaryChunk, this.buffer.length);
        this.buffer = newData;
        const lines = [];
        let patternIndex;
        while ((patternIndex = findNewlineIndex(this.buffer, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
            if (patternIndex.carriage && __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
                // skip until we either get a corresponding `\n`, a new `\r` or nothing
                __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
                continue;
            }
            // we got double \r or \rtext\n
            if (__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null &&
                (patternIndex.index !== __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
                lines.push(this.decodeText(this.buffer.slice(0, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
                this.buffer = this.buffer.slice(__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"));
                __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
                continue;
            }
            const endIndex = __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
            const line = this.decodeText(this.buffer.slice(0, endIndex));
            lines.push(line);
            this.buffer = this.buffer.slice(patternIndex.index);
            __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        }
        return lines;
    }
    decodeText(bytes) {
        if (bytes == null)
            return '';
        if (typeof bytes === 'string')
            return bytes;
        // Node:
        if (typeof Buffer !== 'undefined') {
            if (bytes instanceof Buffer) {
                return bytes.toString();
            }
            if (bytes instanceof Uint8Array) {
                return Buffer.from(bytes).toString();
            }
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(`Unexpected: received non-Uint8Array (${bytes.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`);
        }
        // Browser
        if (typeof TextDecoder !== 'undefined') {
            if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
                this.textDecoder ?? (this.textDecoder = new TextDecoder('utf8'));
                return this.textDecoder.decode(bytes);
            }
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(`Unexpected: received non-Uint8Array/ArrayBuffer (${bytes.constructor.name}) in a web platform. Please report this error.`);
        }
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(`Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.`);
    }
    flush() {
        if (!this.buffer.length) {
            return [];
        }
        return this.decode('\n');
    }
}
_LineDecoder_carriageReturnIndex = new WeakMap();
// prettier-ignore
LineDecoder.NEWLINE_CHARS = new Set(['\n', '\r']);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
/**
 * This function searches the buffer for the end patterns, (\r or \n)
 * and returns an object with the index preceding the matched newline and the
 * index after the newline char. `null` is returned if no new line is found.
 *
 * ```ts
 * findNewLineIndex('abc\ndef') -> { preceding: 2, index: 3 }
 * ```
 */
function findNewlineIndex(buffer, startIndex) {
    const newline = 0x0a; // \n
    const carriage = 0x0d; // \r
    for (let i = startIndex ?? 0; i < buffer.length; i++) {
        if (buffer[i] === newline) {
            return { preceding: i, index: i + 1, carriage: false };
        }
        if (buffer[i] === carriage) {
            return { preceding: i, index: i + 1, carriage: true };
        }
    }
    return null;
}
//# sourceMappingURL=line.mjs.map

/***/ }),

/***/ "./node_modules/openai/internal/qs/formats.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/internal/qs/formats.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RFC1738: () => (/* binding */ RFC1738),
/* harmony export */   RFC3986: () => (/* binding */ RFC3986),
/* harmony export */   default_format: () => (/* binding */ default_format),
/* harmony export */   formatters: () => (/* binding */ formatters)
/* harmony export */ });
const default_format = 'RFC3986';
const formatters = {
    RFC1738: (v) => String(v).replace(/%20/g, '+'),
    RFC3986: (v) => String(v),
};
const RFC1738 = 'RFC1738';
const RFC3986 = 'RFC3986';
//# sourceMappingURL=formats.mjs.map

/***/ }),

/***/ "./node_modules/openai/internal/qs/stringify.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/openai/internal/qs/stringify.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   stringify: () => (/* binding */ stringify)
/* harmony export */ });
/* harmony import */ var _utils_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.mjs */ "./node_modules/openai/internal/qs/utils.mjs");
/* harmony import */ var _formats_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./formats.mjs */ "./node_modules/openai/internal/qs/formats.mjs");


const has = Object.prototype.hasOwnProperty;
const array_prefix_generators = {
    brackets(prefix) {
        return String(prefix) + '[]';
    },
    comma: 'comma',
    indices(prefix, key) {
        return String(prefix) + '[' + key + ']';
    },
    repeat(prefix) {
        return String(prefix);
    },
};
const is_array = Array.isArray;
const push = Array.prototype.push;
const push_to_array = function (arr, value_or_array) {
    push.apply(arr, is_array(value_or_array) ? value_or_array : [value_or_array]);
};
const to_ISO = Date.prototype.toISOString;
const defaults = {
    addQueryPrefix: false,
    allowDots: false,
    allowEmptyArrays: false,
    arrayFormat: 'indices',
    charset: 'utf-8',
    charsetSentinel: false,
    delimiter: '&',
    encode: true,
    encodeDotInKeys: false,
    encoder: _utils_mjs__WEBPACK_IMPORTED_MODULE_0__.encode,
    encodeValuesOnly: false,
    format: _formats_mjs__WEBPACK_IMPORTED_MODULE_1__.default_format,
    formatter: _formats_mjs__WEBPACK_IMPORTED_MODULE_1__.formatters[_formats_mjs__WEBPACK_IMPORTED_MODULE_1__.default_format],
    /** @deprecated */
    indices: false,
    serializeDate(date) {
        return to_ISO.call(date);
    },
    skipNulls: false,
    strictNullHandling: false,
};
function is_non_nullish_primitive(v) {
    return (typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        typeof v === 'symbol' ||
        typeof v === 'bigint');
}
const sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
    let obj = object;
    let tmp_sc = sideChannel;
    let step = 0;
    let find_flag = false;
    while ((tmp_sc = tmp_sc.get(sentinel)) !== void undefined && !find_flag) {
        // Where object last appeared in the ref tree
        const pos = tmp_sc.get(object);
        step += 1;
        if (typeof pos !== 'undefined') {
            if (pos === step) {
                throw new RangeError('Cyclic object value');
            }
            else {
                find_flag = true; // Break while
            }
        }
        if (typeof tmp_sc.get(sentinel) === 'undefined') {
            step = 0;
        }
    }
    if (typeof filter === 'function') {
        obj = filter(prefix, obj);
    }
    else if (obj instanceof Date) {
        obj = serializeDate?.(obj);
    }
    else if (generateArrayPrefix === 'comma' && is_array(obj)) {
        obj = (0,_utils_mjs__WEBPACK_IMPORTED_MODULE_0__.maybe_map)(obj, function (value) {
            if (value instanceof Date) {
                return serializeDate?.(value);
            }
            return value;
        });
    }
    if (obj === null) {
        if (strictNullHandling) {
            return encoder && !encodeValuesOnly ?
                // @ts-expect-error
                encoder(prefix, defaults.encoder, charset, 'key', format)
                : prefix;
        }
        obj = '';
    }
    if (is_non_nullish_primitive(obj) || (0,_utils_mjs__WEBPACK_IMPORTED_MODULE_0__.is_buffer)(obj)) {
        if (encoder) {
            const key_value = encodeValuesOnly ? prefix
                // @ts-expect-error
                : encoder(prefix, defaults.encoder, charset, 'key', format);
            return [
                formatter?.(key_value) +
                    '=' +
                    // @ts-expect-error
                    formatter?.(encoder(obj, defaults.encoder, charset, 'value', format)),
            ];
        }
        return [formatter?.(prefix) + '=' + formatter?.(String(obj))];
    }
    const values = [];
    if (typeof obj === 'undefined') {
        return values;
    }
    let obj_keys;
    if (generateArrayPrefix === 'comma' && is_array(obj)) {
        // we need to join elements in
        if (encodeValuesOnly && encoder) {
            // @ts-expect-error values only
            obj = (0,_utils_mjs__WEBPACK_IMPORTED_MODULE_0__.maybe_map)(obj, encoder);
        }
        obj_keys = [{ value: obj.length > 0 ? obj.join(',') || null : void undefined }];
    }
    else if (is_array(filter)) {
        obj_keys = filter;
    }
    else {
        const keys = Object.keys(obj);
        obj_keys = sort ? keys.sort(sort) : keys;
    }
    const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, '%2E') : String(prefix);
    const adjusted_prefix = commaRoundTrip && is_array(obj) && obj.length === 1 ? encoded_prefix + '[]' : encoded_prefix;
    if (allowEmptyArrays && is_array(obj) && obj.length === 0) {
        return adjusted_prefix + '[]';
    }
    for (let j = 0; j < obj_keys.length; ++j) {
        const key = obj_keys[j];
        const value = 
        // @ts-ignore
        typeof key === 'object' && typeof key.value !== 'undefined' ? key.value : obj[key];
        if (skipNulls && value === null) {
            continue;
        }
        // @ts-ignore
        const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, '%2E') : key;
        const key_prefix = is_array(obj) ?
            typeof generateArrayPrefix === 'function' ?
                generateArrayPrefix(adjusted_prefix, encoded_key)
                : adjusted_prefix
            : adjusted_prefix + (allowDots ? '.' + encoded_key : '[' + encoded_key + ']');
        sideChannel.set(object, step);
        const valueSideChannel = new WeakMap();
        valueSideChannel.set(sentinel, sideChannel);
        push_to_array(values, inner_stringify(value, key_prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, 
        // @ts-ignore
        generateArrayPrefix === 'comma' && encodeValuesOnly && is_array(obj) ? null : encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, valueSideChannel));
    }
    return values;
}
function normalize_stringify_options(opts = defaults) {
    if (typeof opts.allowEmptyArrays !== 'undefined' && typeof opts.allowEmptyArrays !== 'boolean') {
        throw new TypeError('`allowEmptyArrays` option can only be `true` or `false`, when provided');
    }
    if (typeof opts.encodeDotInKeys !== 'undefined' && typeof opts.encodeDotInKeys !== 'boolean') {
        throw new TypeError('`encodeDotInKeys` option can only be `true` or `false`, when provided');
    }
    if (opts.encoder !== null && typeof opts.encoder !== 'undefined' && typeof opts.encoder !== 'function') {
        throw new TypeError('Encoder has to be a function.');
    }
    const charset = opts.charset || defaults.charset;
    if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
        throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
    }
    let format = _formats_mjs__WEBPACK_IMPORTED_MODULE_1__.default_format;
    if (typeof opts.format !== 'undefined') {
        if (!has.call(_formats_mjs__WEBPACK_IMPORTED_MODULE_1__.formatters, opts.format)) {
            throw new TypeError('Unknown format option provided.');
        }
        format = opts.format;
    }
    const formatter = _formats_mjs__WEBPACK_IMPORTED_MODULE_1__.formatters[format];
    let filter = defaults.filter;
    if (typeof opts.filter === 'function' || is_array(opts.filter)) {
        filter = opts.filter;
    }
    let arrayFormat;
    if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
        arrayFormat = opts.arrayFormat;
    }
    else if ('indices' in opts) {
        arrayFormat = opts.indices ? 'indices' : 'repeat';
    }
    else {
        arrayFormat = defaults.arrayFormat;
    }
    if ('commaRoundTrip' in opts && typeof opts.commaRoundTrip !== 'boolean') {
        throw new TypeError('`commaRoundTrip` must be a boolean, or absent');
    }
    const allowDots = typeof opts.allowDots === 'undefined' ?
        !!opts.encodeDotInKeys === true ?
            true
            : defaults.allowDots
        : !!opts.allowDots;
    return {
        addQueryPrefix: typeof opts.addQueryPrefix === 'boolean' ? opts.addQueryPrefix : defaults.addQueryPrefix,
        // @ts-ignore
        allowDots: allowDots,
        allowEmptyArrays: typeof opts.allowEmptyArrays === 'boolean' ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
        arrayFormat: arrayFormat,
        charset: charset,
        charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
        commaRoundTrip: !!opts.commaRoundTrip,
        delimiter: typeof opts.delimiter === 'undefined' ? defaults.delimiter : opts.delimiter,
        encode: typeof opts.encode === 'boolean' ? opts.encode : defaults.encode,
        encodeDotInKeys: typeof opts.encodeDotInKeys === 'boolean' ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
        encoder: typeof opts.encoder === 'function' ? opts.encoder : defaults.encoder,
        encodeValuesOnly: typeof opts.encodeValuesOnly === 'boolean' ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
        filter: filter,
        format: format,
        formatter: formatter,
        serializeDate: typeof opts.serializeDate === 'function' ? opts.serializeDate : defaults.serializeDate,
        skipNulls: typeof opts.skipNulls === 'boolean' ? opts.skipNulls : defaults.skipNulls,
        // @ts-ignore
        sort: typeof opts.sort === 'function' ? opts.sort : null,
        strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling,
    };
}
function stringify(object, opts = {}) {
    let obj = object;
    const options = normalize_stringify_options(opts);
    let obj_keys;
    let filter;
    if (typeof options.filter === 'function') {
        filter = options.filter;
        obj = filter('', obj);
    }
    else if (is_array(options.filter)) {
        filter = options.filter;
        obj_keys = filter;
    }
    const keys = [];
    if (typeof obj !== 'object' || obj === null) {
        return '';
    }
    const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
    const commaRoundTrip = generateArrayPrefix === 'comma' && options.commaRoundTrip;
    if (!obj_keys) {
        obj_keys = Object.keys(obj);
    }
    if (options.sort) {
        obj_keys.sort(options.sort);
    }
    const sideChannel = new WeakMap();
    for (let i = 0; i < obj_keys.length; ++i) {
        const key = obj_keys[i];
        if (options.skipNulls && obj[key] === null) {
            continue;
        }
        push_to_array(keys, inner_stringify(obj[key], key, 
        // @ts-expect-error
        generateArrayPrefix, commaRoundTrip, options.allowEmptyArrays, options.strictNullHandling, options.skipNulls, options.encodeDotInKeys, options.encode ? options.encoder : null, options.filter, options.sort, options.allowDots, options.serializeDate, options.format, options.formatter, options.encodeValuesOnly, options.charset, sideChannel));
    }
    const joined = keys.join(options.delimiter);
    let prefix = options.addQueryPrefix === true ? '?' : '';
    if (options.charsetSentinel) {
        if (options.charset === 'iso-8859-1') {
            // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
            prefix += 'utf8=%26%2310003%3B&';
        }
        else {
            // encodeURIComponent('✓')
            prefix += 'utf8=%E2%9C%93&';
        }
    }
    return joined.length > 0 ? prefix + joined : '';
}
//# sourceMappingURL=stringify.mjs.map

/***/ }),

/***/ "./node_modules/openai/internal/qs/utils.mjs":
/*!***************************************************!*\
  !*** ./node_modules/openai/internal/qs/utils.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   assign_single_source: () => (/* binding */ assign_single_source),
/* harmony export */   combine: () => (/* binding */ combine),
/* harmony export */   compact: () => (/* binding */ compact),
/* harmony export */   decode: () => (/* binding */ decode),
/* harmony export */   encode: () => (/* binding */ encode),
/* harmony export */   is_buffer: () => (/* binding */ is_buffer),
/* harmony export */   is_regexp: () => (/* binding */ is_regexp),
/* harmony export */   maybe_map: () => (/* binding */ maybe_map),
/* harmony export */   merge: () => (/* binding */ merge)
/* harmony export */ });
/* harmony import */ var _formats_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./formats.mjs */ "./node_modules/openai/internal/qs/formats.mjs");

const has = Object.prototype.hasOwnProperty;
const is_array = Array.isArray;
const hex_table = (() => {
    const array = [];
    for (let i = 0; i < 256; ++i) {
        array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
    }
    return array;
})();
function compact_queue(queue) {
    while (queue.length > 1) {
        const item = queue.pop();
        if (!item)
            continue;
        const obj = item.obj[item.prop];
        if (is_array(obj)) {
            const compacted = [];
            for (let j = 0; j < obj.length; ++j) {
                if (typeof obj[j] !== 'undefined') {
                    compacted.push(obj[j]);
                }
            }
            // @ts-ignore
            item.obj[item.prop] = compacted;
        }
    }
}
function array_to_object(source, options) {
    const obj = options && options.plainObjects ? Object.create(null) : {};
    for (let i = 0; i < source.length; ++i) {
        if (typeof source[i] !== 'undefined') {
            obj[i] = source[i];
        }
    }
    return obj;
}
function merge(target, source, options = {}) {
    if (!source) {
        return target;
    }
    if (typeof source !== 'object') {
        if (is_array(target)) {
            target.push(source);
        }
        else if (target && typeof target === 'object') {
            if ((options && (options.plainObjects || options.allowPrototypes)) ||
                !has.call(Object.prototype, source)) {
                target[source] = true;
            }
        }
        else {
            return [target, source];
        }
        return target;
    }
    if (!target || typeof target !== 'object') {
        return [target].concat(source);
    }
    let mergeTarget = target;
    if (is_array(target) && !is_array(source)) {
        // @ts-ignore
        mergeTarget = array_to_object(target, options);
    }
    if (is_array(target) && is_array(source)) {
        source.forEach(function (item, i) {
            if (has.call(target, i)) {
                const targetItem = target[i];
                if (targetItem && typeof targetItem === 'object' && item && typeof item === 'object') {
                    target[i] = merge(targetItem, item, options);
                }
                else {
                    target.push(item);
                }
            }
            else {
                target[i] = item;
            }
        });
        return target;
    }
    return Object.keys(source).reduce(function (acc, key) {
        const value = source[key];
        if (has.call(acc, key)) {
            acc[key] = merge(acc[key], value, options);
        }
        else {
            acc[key] = value;
        }
        return acc;
    }, mergeTarget);
}
function assign_single_source(target, source) {
    return Object.keys(source).reduce(function (acc, key) {
        acc[key] = source[key];
        return acc;
    }, target);
}
function decode(str, _, charset) {
    const strWithoutPlus = str.replace(/\+/g, ' ');
    if (charset === 'iso-8859-1') {
        // unescape never throws, no try...catch needed:
        return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
    }
    // utf-8
    try {
        return decodeURIComponent(strWithoutPlus);
    }
    catch (e) {
        return strWithoutPlus;
    }
}
const limit = 1024;
const encode = (str, _defaultEncoder, charset, _kind, format) => {
    // This code was originally written by Brian White for the io.js core querystring library.
    // It has been adapted here for stricter adherence to RFC 3986
    if (str.length === 0) {
        return str;
    }
    let string = str;
    if (typeof str === 'symbol') {
        string = Symbol.prototype.toString.call(str);
    }
    else if (typeof str !== 'string') {
        string = String(str);
    }
    if (charset === 'iso-8859-1') {
        return escape(string).replace(/%u[0-9a-f]{4}/gi, function ($0) {
            return '%26%23' + parseInt($0.slice(2), 16) + '%3B';
        });
    }
    let out = '';
    for (let j = 0; j < string.length; j += limit) {
        const segment = string.length >= limit ? string.slice(j, j + limit) : string;
        const arr = [];
        for (let i = 0; i < segment.length; ++i) {
            let c = segment.charCodeAt(i);
            if (c === 0x2d || // -
                c === 0x2e || // .
                c === 0x5f || // _
                c === 0x7e || // ~
                (c >= 0x30 && c <= 0x39) || // 0-9
                (c >= 0x41 && c <= 0x5a) || // a-z
                (c >= 0x61 && c <= 0x7a) || // A-Z
                (format === _formats_mjs__WEBPACK_IMPORTED_MODULE_0__.RFC1738 && (c === 0x28 || c === 0x29)) // ( )
            ) {
                arr[arr.length] = segment.charAt(i);
                continue;
            }
            if (c < 0x80) {
                arr[arr.length] = hex_table[c];
                continue;
            }
            if (c < 0x800) {
                arr[arr.length] = hex_table[0xc0 | (c >> 6)] + hex_table[0x80 | (c & 0x3f)];
                continue;
            }
            if (c < 0xd800 || c >= 0xe000) {
                arr[arr.length] =
                    hex_table[0xe0 | (c >> 12)] + hex_table[0x80 | ((c >> 6) & 0x3f)] + hex_table[0x80 | (c & 0x3f)];
                continue;
            }
            i += 1;
            c = 0x10000 + (((c & 0x3ff) << 10) | (segment.charCodeAt(i) & 0x3ff));
            arr[arr.length] =
                hex_table[0xf0 | (c >> 18)] +
                    hex_table[0x80 | ((c >> 12) & 0x3f)] +
                    hex_table[0x80 | ((c >> 6) & 0x3f)] +
                    hex_table[0x80 | (c & 0x3f)];
        }
        out += arr.join('');
    }
    return out;
};
function compact(value) {
    const queue = [{ obj: { o: value }, prop: 'o' }];
    const refs = [];
    for (let i = 0; i < queue.length; ++i) {
        const item = queue[i];
        // @ts-ignore
        const obj = item.obj[item.prop];
        const keys = Object.keys(obj);
        for (let j = 0; j < keys.length; ++j) {
            const key = keys[j];
            const val = obj[key];
            if (typeof val === 'object' && val !== null && refs.indexOf(val) === -1) {
                queue.push({ obj: obj, prop: key });
                refs.push(val);
            }
        }
    }
    compact_queue(queue);
    return value;
}
function is_regexp(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
}
function is_buffer(obj) {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function combine(a, b) {
    return [].concat(a, b);
}
function maybe_map(val, fn) {
    if (is_array(val)) {
        const mapped = [];
        for (let i = 0; i < val.length; i += 1) {
            mapped.push(fn(val[i]));
        }
        return mapped;
    }
    return fn(val);
}
//# sourceMappingURL=utils.mjs.map

/***/ }),

/***/ "./node_modules/openai/internal/stream-utils.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/openai/internal/stream-utils.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ReadableStreamToAsyncIterable: () => (/* binding */ ReadableStreamToAsyncIterable)
/* harmony export */ });
/**
 * Most browsers don't yet have async iterable support for ReadableStream,
 * and Node has a very different way of reading bytes from its "ReadableStream".
 *
 * This polyfill was pulled from https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */
function ReadableStreamToAsyncIterable(stream) {
    if (stream[Symbol.asyncIterator])
        return stream;
    const reader = stream.getReader();
    return {
        async next() {
            try {
                const result = await reader.read();
                if (result?.done)
                    reader.releaseLock(); // release lock when stream becomes closed
                return result;
            }
            catch (e) {
                reader.releaseLock(); // release lock when stream becomes errored
                throw e;
            }
        },
        async return() {
            const cancelPromise = reader.cancel();
            reader.releaseLock();
            await cancelPromise;
            return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}
//# sourceMappingURL=stream-utils.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/AbstractChatCompletionRunner.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/openai/lib/AbstractChatCompletionRunner.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractChatCompletionRunner: () => (/* binding */ AbstractChatCompletionRunner)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _RunnableFunction_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./RunnableFunction.mjs */ "./node_modules/openai/lib/RunnableFunction.mjs");
/* harmony import */ var _chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./chatCompletionUtils.mjs */ "./node_modules/openai/lib/chatCompletionUtils.mjs");
/* harmony import */ var _EventStream_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./EventStream.mjs */ "./node_modules/openai/lib/EventStream.mjs");
/* harmony import */ var _lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/parser.mjs */ "./node_modules/openai/lib/parser.mjs");
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractChatCompletionRunner_instances, _AbstractChatCompletionRunner_getFinalContent, _AbstractChatCompletionRunner_getFinalMessage, _AbstractChatCompletionRunner_getFinalFunctionCall, _AbstractChatCompletionRunner_getFinalFunctionCallResult, _AbstractChatCompletionRunner_calculateTotalUsage, _AbstractChatCompletionRunner_validateParams, _AbstractChatCompletionRunner_stringifyFunctionCallResult;





const DEFAULT_MAX_CHAT_COMPLETIONS = 10;
class AbstractChatCompletionRunner extends _EventStream_mjs__WEBPACK_IMPORTED_MODULE_0__.EventStream {
    constructor() {
        super(...arguments);
        _AbstractChatCompletionRunner_instances.add(this);
        this._chatCompletions = [];
        this.messages = [];
    }
    _addChatCompletion(chatCompletion) {
        this._chatCompletions.push(chatCompletion);
        this._emit('chatCompletion', chatCompletion);
        const message = chatCompletion.choices[0]?.message;
        if (message)
            this._addMessage(message);
        return chatCompletion;
    }
    _addMessage(message, emit = true) {
        if (!('content' in message))
            message.content = null;
        this.messages.push(message);
        if (emit) {
            this._emit('message', message);
            if (((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isFunctionMessage)(message) || (0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isToolMessage)(message)) && message.content) {
                // Note, this assumes that {role: 'tool', content: …} is always the result of a call of tool of type=function.
                this._emit('functionCallResult', message.content);
            }
            else if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isAssistantMessage)(message) && message.function_call) {
                this._emit('functionCall', message.function_call);
            }
            else if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isAssistantMessage)(message) && message.tool_calls) {
                for (const tool_call of message.tool_calls) {
                    if (tool_call.type === 'function') {
                        this._emit('functionCall', tool_call.function);
                    }
                }
            }
        }
    }
    /**
     * @returns a promise that resolves with the final ChatCompletion, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
     */
    async finalChatCompletion() {
        await this.done();
        const completion = this._chatCompletions[this._chatCompletions.length - 1];
        if (!completion)
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError('stream ended without producing a ChatCompletion');
        return completion;
    }
    /**
     * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    async finalContent() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    }
    /**
     * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
     * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    async finalMessage() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    }
    /**
     * @returns a promise that resolves with the content of the final FunctionCall, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    async finalFunctionCall() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCall).call(this);
    }
    async finalFunctionCallResult() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCallResult).call(this);
    }
    async totalUsage() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
    }
    allChatCompletions() {
        return [...this._chatCompletions];
    }
    _emitFinal() {
        const completion = this._chatCompletions[this._chatCompletions.length - 1];
        if (completion)
            this._emit('finalChatCompletion', completion);
        const finalMessage = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
        if (finalMessage)
            this._emit('finalMessage', finalMessage);
        const finalContent = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
        if (finalContent)
            this._emit('finalContent', finalContent);
        const finalFunctionCall = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCall).call(this);
        if (finalFunctionCall)
            this._emit('finalFunctionCall', finalFunctionCall);
        const finalFunctionCallResult = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCallResult).call(this);
        if (finalFunctionCallResult != null)
            this._emit('finalFunctionCallResult', finalFunctionCallResult);
        if (this._chatCompletions.some((c) => c.usage)) {
            this._emit('totalUsage', __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
        }
    }
    async _createChatCompletion(client, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_validateParams).call(this, params);
        const chatCompletion = await client.chat.completions.create({ ...params, stream: false }, { ...options, signal: this.controller.signal });
        this._connected();
        return this._addChatCompletion((0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.parseChatCompletion)(chatCompletion, params));
    }
    async _runChatCompletion(client, params, options) {
        for (const message of params.messages) {
            this._addMessage(message, false);
        }
        return await this._createChatCompletion(client, params, options);
    }
    async _runFunctions(client, params, options) {
        const role = 'function';
        const { function_call = 'auto', stream, ...restParams } = params;
        const singleFunctionToCall = typeof function_call !== 'string' && function_call?.name;
        const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
        const functionsByName = {};
        for (const f of params.functions) {
            functionsByName[f.name || f.function.name] = f;
        }
        const functions = params.functions.map((f) => ({
            name: f.name || f.function.name,
            parameters: f.parameters,
            description: f.description,
        }));
        for (const message of params.messages) {
            this._addMessage(message, false);
        }
        for (let i = 0; i < maxChatCompletions; ++i) {
            const chatCompletion = await this._createChatCompletion(client, {
                ...restParams,
                function_call,
                functions,
                messages: [...this.messages],
            }, options);
            const message = chatCompletion.choices[0]?.message;
            if (!message) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError(`missing message in ChatCompletion response`);
            }
            if (!message.function_call)
                return;
            const { name, arguments: args } = message.function_call;
            const fn = functionsByName[name];
            if (!fn) {
                const content = `Invalid function_call: ${JSON.stringify(name)}. Available options are: ${functions
                    .map((f) => JSON.stringify(f.name))
                    .join(', ')}. Please try again`;
                this._addMessage({ role, name, content });
                continue;
            }
            else if (singleFunctionToCall && singleFunctionToCall !== name) {
                const content = `Invalid function_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
                this._addMessage({ role, name, content });
                continue;
            }
            let parsed;
            try {
                parsed = (0,_RunnableFunction_mjs__WEBPACK_IMPORTED_MODULE_4__.isRunnableFunctionWithParse)(fn) ? await fn.parse(args) : args;
            }
            catch (error) {
                this._addMessage({
                    role,
                    name,
                    content: error instanceof Error ? error.message : String(error),
                });
                continue;
            }
            // @ts-expect-error it can't rule out `never` type.
            const rawContent = await fn.function(parsed, this);
            const content = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
            this._addMessage({ role, name, content });
            if (singleFunctionToCall)
                return;
        }
    }
    async _runTools(client, params, options) {
        const role = 'tool';
        const { tool_choice = 'auto', stream, ...restParams } = params;
        const singleFunctionToCall = typeof tool_choice !== 'string' && tool_choice?.function?.name;
        const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
        // TODO(someday): clean this logic up
        const inputTools = params.tools.map((tool) => {
            if ((0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.isAutoParsableTool)(tool)) {
                if (!tool.$callback) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError('Tool given to `.runTools()` that does not have an associated function');
                }
                return {
                    type: 'function',
                    function: {
                        function: tool.$callback,
                        name: tool.function.name,
                        description: tool.function.description || '',
                        parameters: tool.function.parameters,
                        parse: tool.$parseRaw,
                        strict: true,
                    },
                };
            }
            return tool;
        });
        const functionsByName = {};
        for (const f of inputTools) {
            if (f.type === 'function') {
                functionsByName[f.function.name || f.function.function.name] = f.function;
            }
        }
        const tools = 'tools' in params ?
            inputTools.map((t) => t.type === 'function' ?
                {
                    type: 'function',
                    function: {
                        name: t.function.name || t.function.function.name,
                        parameters: t.function.parameters,
                        description: t.function.description,
                        strict: t.function.strict,
                    },
                }
                : t)
            : undefined;
        for (const message of params.messages) {
            this._addMessage(message, false);
        }
        for (let i = 0; i < maxChatCompletions; ++i) {
            const chatCompletion = await this._createChatCompletion(client, {
                ...restParams,
                tool_choice,
                tools,
                messages: [...this.messages],
            }, options);
            const message = chatCompletion.choices[0]?.message;
            if (!message) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError(`missing message in ChatCompletion response`);
            }
            if (!message.tool_calls?.length) {
                return;
            }
            for (const tool_call of message.tool_calls) {
                if (tool_call.type !== 'function')
                    continue;
                const tool_call_id = tool_call.id;
                const { name, arguments: args } = tool_call.function;
                const fn = functionsByName[name];
                if (!fn) {
                    const content = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${Object.keys(functionsByName)
                        .map((name) => JSON.stringify(name))
                        .join(', ')}. Please try again`;
                    this._addMessage({ role, tool_call_id, content });
                    continue;
                }
                else if (singleFunctionToCall && singleFunctionToCall !== name) {
                    const content = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
                    this._addMessage({ role, tool_call_id, content });
                    continue;
                }
                let parsed;
                try {
                    parsed = (0,_RunnableFunction_mjs__WEBPACK_IMPORTED_MODULE_4__.isRunnableFunctionWithParse)(fn) ? await fn.parse(args) : args;
                }
                catch (error) {
                    const content = error instanceof Error ? error.message : String(error);
                    this._addMessage({ role, tool_call_id, content });
                    continue;
                }
                // @ts-expect-error it can't rule out `never` type.
                const rawContent = await fn.function(parsed, this);
                const content = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
                this._addMessage({ role, tool_call_id, content });
                if (singleFunctionToCall) {
                    return;
                }
            }
        }
        return;
    }
}
_AbstractChatCompletionRunner_instances = new WeakSet(), _AbstractChatCompletionRunner_getFinalContent = function _AbstractChatCompletionRunner_getFinalContent() {
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
}, _AbstractChatCompletionRunner_getFinalMessage = function _AbstractChatCompletionRunner_getFinalMessage() {
    let i = this.messages.length;
    while (i-- > 0) {
        const message = this.messages[i];
        if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isAssistantMessage)(message)) {
            const { function_call, ...rest } = message;
            // TODO: support audio here
            const ret = {
                ...rest,
                content: message.content ?? null,
                refusal: message.refusal ?? null,
            };
            if (function_call) {
                ret.function_call = function_call;
            }
            return ret;
        }
    }
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError('stream ended without producing a ChatCompletionMessage with role=assistant');
}, _AbstractChatCompletionRunner_getFinalFunctionCall = function _AbstractChatCompletionRunner_getFinalFunctionCall() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
        const message = this.messages[i];
        if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isAssistantMessage)(message) && message?.function_call) {
            return message.function_call;
        }
        if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isAssistantMessage)(message) && message?.tool_calls?.length) {
            return message.tool_calls.at(-1)?.function;
        }
    }
    return;
}, _AbstractChatCompletionRunner_getFinalFunctionCallResult = function _AbstractChatCompletionRunner_getFinalFunctionCallResult() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
        const message = this.messages[i];
        if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isFunctionMessage)(message) && message.content != null) {
            return message.content;
        }
        if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isToolMessage)(message) &&
            message.content != null &&
            typeof message.content === 'string' &&
            this.messages.some((x) => x.role === 'assistant' &&
                x.tool_calls?.some((y) => y.type === 'function' && y.id === message.tool_call_id))) {
            return message.content;
        }
    }
    return;
}, _AbstractChatCompletionRunner_calculateTotalUsage = function _AbstractChatCompletionRunner_calculateTotalUsage() {
    const total = {
        completion_tokens: 0,
        prompt_tokens: 0,
        total_tokens: 0,
    };
    for (const { usage } of this._chatCompletions) {
        if (usage) {
            total.completion_tokens += usage.completion_tokens;
            total.prompt_tokens += usage.prompt_tokens;
            total.total_tokens += usage.total_tokens;
        }
    }
    return total;
}, _AbstractChatCompletionRunner_validateParams = function _AbstractChatCompletionRunner_validateParams(params) {
    if (params.n != null && params.n > 1) {
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError('ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.');
    }
}, _AbstractChatCompletionRunner_stringifyFunctionCallResult = function _AbstractChatCompletionRunner_stringifyFunctionCallResult(rawContent) {
    return (typeof rawContent === 'string' ? rawContent
        : rawContent === undefined ? 'undefined'
            : JSON.stringify(rawContent));
};
//# sourceMappingURL=AbstractChatCompletionRunner.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/AssistantStream.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/lib/AssistantStream.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AssistantStream: () => (/* binding */ AssistantStream)
/* harmony export */ });
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _streaming_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../streaming.mjs */ "./node_modules/openai/streaming.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _EventStream_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./EventStream.mjs */ "./node_modules/openai/lib/EventStream.mjs");
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _AssistantStream_instances, _AssistantStream_events, _AssistantStream_runStepSnapshots, _AssistantStream_messageSnapshots, _AssistantStream_messageSnapshot, _AssistantStream_finalRun, _AssistantStream_currentContentIndex, _AssistantStream_currentContent, _AssistantStream_currentToolCallIndex, _AssistantStream_currentToolCall, _AssistantStream_currentEvent, _AssistantStream_currentRunSnapshot, _AssistantStream_currentRunStepSnapshot, _AssistantStream_addEvent, _AssistantStream_endRequest, _AssistantStream_handleMessage, _AssistantStream_handleRunStep, _AssistantStream_handleEvent, _AssistantStream_accumulateRunStep, _AssistantStream_accumulateMessage, _AssistantStream_accumulateContent, _AssistantStream_handleRun;




class AssistantStream extends _EventStream_mjs__WEBPACK_IMPORTED_MODULE_0__.EventStream {
    constructor() {
        super(...arguments);
        _AssistantStream_instances.add(this);
        //Track all events in a single list for reference
        _AssistantStream_events.set(this, []);
        //Used to accumulate deltas
        //We are accumulating many types so the value here is not strict
        _AssistantStream_runStepSnapshots.set(this, {});
        _AssistantStream_messageSnapshots.set(this, {});
        _AssistantStream_messageSnapshot.set(this, void 0);
        _AssistantStream_finalRun.set(this, void 0);
        _AssistantStream_currentContentIndex.set(this, void 0);
        _AssistantStream_currentContent.set(this, void 0);
        _AssistantStream_currentToolCallIndex.set(this, void 0);
        _AssistantStream_currentToolCall.set(this, void 0);
        //For current snapshot methods
        _AssistantStream_currentEvent.set(this, void 0);
        _AssistantStream_currentRunSnapshot.set(this, void 0);
        _AssistantStream_currentRunStepSnapshot.set(this, void 0);
    }
    [(_AssistantStream_events = new WeakMap(), _AssistantStream_runStepSnapshots = new WeakMap(), _AssistantStream_messageSnapshots = new WeakMap(), _AssistantStream_messageSnapshot = new WeakMap(), _AssistantStream_finalRun = new WeakMap(), _AssistantStream_currentContentIndex = new WeakMap(), _AssistantStream_currentContent = new WeakMap(), _AssistantStream_currentToolCallIndex = new WeakMap(), _AssistantStream_currentToolCall = new WeakMap(), _AssistantStream_currentEvent = new WeakMap(), _AssistantStream_currentRunSnapshot = new WeakMap(), _AssistantStream_currentRunStepSnapshot = new WeakMap(), _AssistantStream_instances = new WeakSet(), Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        //Catch all for passing along all events
        this.on('event', (event) => {
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(event);
            }
            else {
                pushQueue.push(event);
            }
        });
        this.on('end', () => {
            done = true;
            for (const reader of readQueue) {
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async () => {
                if (!pushQueue.length) {
                    if (done) {
                        return { value: undefined, done: true };
                    }
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk) => (chunk ? { value: chunk, done: false } : { value: undefined, done: true }));
                }
                const chunk = pushQueue.shift();
                return { value: chunk, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    static fromReadableStream(stream) {
        const runner = new AssistantStream();
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        this._connected();
        const stream = _streaming_mjs__WEBPACK_IMPORTED_MODULE_1__.Stream.fromReadableStream(readableStream, this.controller);
        for await (const event of stream) {
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    toReadableStream() {
        const stream = new _streaming_mjs__WEBPACK_IMPORTED_MODULE_1__.Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
    static createToolAssistantStream(threadId, runId, runs, params, options) {
        const runner = new AssistantStream();
        runner._run(() => runner._runToolAssistantStream(threadId, runId, runs, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    async _createToolAssistantStream(run, threadId, runId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await run.submitToolOutputs(threadId, runId, body, {
            ...options,
            signal: this.controller.signal,
        });
        this._connected();
        for await (const event of stream) {
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static createThreadAssistantStream(params, thread, options) {
        const runner = new AssistantStream();
        runner._run(() => runner._threadAssistantStream(params, thread, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    static createAssistantStream(threadId, runs, params, options) {
        const runner = new AssistantStream();
        runner._run(() => runner._runAssistantStream(threadId, runs, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    currentEvent() {
        return __classPrivateFieldGet(this, _AssistantStream_currentEvent, "f");
    }
    currentRun() {
        return __classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f");
    }
    currentMessageSnapshot() {
        return __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f");
    }
    currentRunStepSnapshot() {
        return __classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f");
    }
    async finalRunSteps() {
        await this.done();
        return Object.values(__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f"));
    }
    async finalMessages() {
        await this.done();
        return Object.values(__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f"));
    }
    async finalRun() {
        await this.done();
        if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
            throw Error('Final run was not received.');
        return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
    }
    async _createThreadAssistantStream(thread, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await thread.createAndRun(body, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    async _createAssistantStream(run, threadId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await run.create(threadId, body, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static accumulateDelta(acc, delta) {
        for (const [key, deltaValue] of Object.entries(delta)) {
            if (!acc.hasOwnProperty(key)) {
                acc[key] = deltaValue;
                continue;
            }
            let accValue = acc[key];
            if (accValue === null || accValue === undefined) {
                acc[key] = deltaValue;
                continue;
            }
            // We don't accumulate these special properties
            if (key === 'index' || key === 'type') {
                acc[key] = deltaValue;
                continue;
            }
            // Type-specific accumulation logic
            if (typeof accValue === 'string' && typeof deltaValue === 'string') {
                accValue += deltaValue;
            }
            else if (typeof accValue === 'number' && typeof deltaValue === 'number') {
                accValue += deltaValue;
            }
            else if (_core_mjs__WEBPACK_IMPORTED_MODULE_3__.isObj(accValue) && _core_mjs__WEBPACK_IMPORTED_MODULE_3__.isObj(deltaValue)) {
                accValue = this.accumulateDelta(accValue, deltaValue);
            }
            else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
                if (accValue.every((x) => typeof x === 'string' || typeof x === 'number')) {
                    accValue.push(...deltaValue); // Use spread syntax for efficient addition
                    continue;
                }
                for (const deltaEntry of deltaValue) {
                    if (!_core_mjs__WEBPACK_IMPORTED_MODULE_3__.isObj(deltaEntry)) {
                        throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
                    }
                    const index = deltaEntry['index'];
                    if (index == null) {
                        console.error(deltaEntry);
                        throw new Error('Expected array delta entry to have an `index` property');
                    }
                    if (typeof index !== 'number') {
                        throw new Error(`Expected array delta entry \`index\` property to be a number but got ${index}`);
                    }
                    const accEntry = accValue[index];
                    if (accEntry == null) {
                        accValue.push(deltaEntry);
                    }
                    else {
                        accValue[index] = this.accumulateDelta(accEntry, deltaEntry);
                    }
                }
                continue;
            }
            else {
                throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
            }
            acc[key] = accValue;
        }
        return acc;
    }
    _addRun(run) {
        return run;
    }
    async _threadAssistantStream(params, thread, options) {
        return await this._createThreadAssistantStream(thread, params, options);
    }
    async _runAssistantStream(threadId, runs, params, options) {
        return await this._createAssistantStream(runs, threadId, params, options);
    }
    async _runToolAssistantStream(threadId, runId, runs, params, options) {
        return await this._createToolAssistantStream(runs, threadId, runId, params, options);
    }
}
_AssistantStream_addEvent = function _AssistantStream_addEvent(event) {
    if (this.ended)
        return;
    __classPrivateFieldSet(this, _AssistantStream_currentEvent, event, "f");
    __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
    switch (event.event) {
        case 'thread.created':
            //No action on this event.
            break;
        case 'thread.run.created':
        case 'thread.run.queued':
        case 'thread.run.in_progress':
        case 'thread.run.requires_action':
        case 'thread.run.completed':
        case 'thread.run.incomplete':
        case 'thread.run.failed':
        case 'thread.run.cancelling':
        case 'thread.run.cancelled':
        case 'thread.run.expired':
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
            break;
        case 'thread.run.step.created':
        case 'thread.run.step.in_progress':
        case 'thread.run.step.delta':
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
            break;
        case 'thread.message.created':
        case 'thread.message.in_progress':
        case 'thread.message.delta':
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
            break;
        case 'error':
            //This is included for completeness, but errors are processed in the SSE event processing so this should not occur
            throw new Error('Encountered an error event in event processing - errors should be processed earlier');
        default:
            assertNever(event);
    }
}, _AssistantStream_endRequest = function _AssistantStream_endRequest() {
    if (this.ended) {
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_2__.OpenAIError(`stream has ended, this shouldn't happen`);
    }
    if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
        throw Error('Final run has not been received');
    return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
}, _AssistantStream_handleMessage = function _AssistantStream_handleMessage(event) {
    const [accumulatedMessage, newContent] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
    __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
    __classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
    for (const content of newContent) {
        const snapshotContent = accumulatedMessage.content[content.index];
        if (snapshotContent?.type == 'text') {
            this._emit('textCreated', snapshotContent.text);
        }
    }
    switch (event.event) {
        case 'thread.message.created':
            this._emit('messageCreated', event.data);
            break;
        case 'thread.message.in_progress':
            break;
        case 'thread.message.delta':
            this._emit('messageDelta', event.data.delta, accumulatedMessage);
            if (event.data.delta.content) {
                for (const content of event.data.delta.content) {
                    //If it is text delta, emit a text delta event
                    if (content.type == 'text' && content.text) {
                        let textDelta = content.text;
                        let snapshot = accumulatedMessage.content[content.index];
                        if (snapshot && snapshot.type == 'text') {
                            this._emit('textDelta', textDelta, snapshot.text);
                        }
                        else {
                            throw Error('The snapshot associated with this text delta is not text or missing');
                        }
                    }
                    if (content.index != __classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")) {
                        //See if we have in progress content
                        if (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f")) {
                            switch (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").type) {
                                case 'text':
                                    this._emit('textDone', __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                                    break;
                                case 'image_file':
                                    this._emit('imageFileDone', __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                                    break;
                            }
                        }
                        __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, content.index, "f");
                    }
                    __classPrivateFieldSet(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
                }
            }
            break;
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            //We emit the latest content we were working on on completion (including incomplete)
            if (__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f") !== undefined) {
                const currentContent = event.data.content[__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")];
                if (currentContent) {
                    switch (currentContent.type) {
                        case 'image_file':
                            this._emit('imageFileDone', currentContent.image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                            break;
                        case 'text':
                            this._emit('textDone', currentContent.text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                            break;
                    }
                }
            }
            if (__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f")) {
                this._emit('messageDone', event.data);
            }
            __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, undefined, "f");
    }
}, _AssistantStream_handleRunStep = function _AssistantStream_handleRunStep(event) {
    const accumulatedRunStep = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
    __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
    switch (event.event) {
        case 'thread.run.step.created':
            this._emit('runStepCreated', event.data);
            break;
        case 'thread.run.step.delta':
            const delta = event.data.delta;
            if (delta.step_details &&
                delta.step_details.type == 'tool_calls' &&
                delta.step_details.tool_calls &&
                accumulatedRunStep.step_details.type == 'tool_calls') {
                for (const toolCall of delta.step_details.tool_calls) {
                    if (toolCall.index == __classPrivateFieldGet(this, _AssistantStream_currentToolCallIndex, "f")) {
                        this._emit('toolCallDelta', toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
                    }
                    else {
                        if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                            this._emit('toolCallDone', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                        }
                        __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
                        __classPrivateFieldSet(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
                        if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"))
                            this._emit('toolCallCreated', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                    }
                }
            }
            this._emit('runStepDelta', event.data.delta, accumulatedRunStep);
            break;
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
            __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, undefined, "f");
            const details = event.data.step_details;
            if (details.type == 'tool_calls') {
                if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                    this._emit('toolCallDone', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                    __classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
                }
            }
            this._emit('runStepDone', event.data, accumulatedRunStep);
            break;
        case 'thread.run.step.in_progress':
            break;
    }
}, _AssistantStream_handleEvent = function _AssistantStream_handleEvent(event) {
    __classPrivateFieldGet(this, _AssistantStream_events, "f").push(event);
    this._emit('event', event);
}, _AssistantStream_accumulateRunStep = function _AssistantStream_accumulateRunStep(event) {
    switch (event.event) {
        case 'thread.run.step.created':
            __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
            return event.data;
        case 'thread.run.step.delta':
            let snapshot = __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
            if (!snapshot) {
                throw Error('Received a RunStepDelta before creation of a snapshot');
            }
            let data = event.data;
            if (data.delta) {
                const accumulated = AssistantStream.accumulateDelta(snapshot, data.delta);
                __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
            }
            return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
        case 'thread.run.step.in_progress':
            __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
            break;
    }
    if (__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id])
        return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    throw new Error('No snapshot available');
}, _AssistantStream_accumulateMessage = function _AssistantStream_accumulateMessage(event, snapshot) {
    let newContent = [];
    switch (event.event) {
        case 'thread.message.created':
            //On creation the snapshot is just the initial message
            return [event.data, newContent];
        case 'thread.message.delta':
            if (!snapshot) {
                throw Error('Received a delta with no existing snapshot (there should be one from message creation)');
            }
            let data = event.data;
            //If this delta does not have content, nothing to process
            if (data.delta.content) {
                for (const contentElement of data.delta.content) {
                    if (contentElement.index in snapshot.content) {
                        let currentContent = snapshot.content[contentElement.index];
                        snapshot.content[contentElement.index] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent);
                    }
                    else {
                        snapshot.content[contentElement.index] = contentElement;
                        // This is a new element
                        newContent.push(contentElement);
                    }
                }
            }
            return [snapshot, newContent];
        case 'thread.message.in_progress':
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            //No changes on other thread events
            if (snapshot) {
                return [snapshot, newContent];
            }
            else {
                throw Error('Received thread message event with no existing snapshot');
            }
    }
    throw Error('Tried to accumulate a non-message event');
}, _AssistantStream_accumulateContent = function _AssistantStream_accumulateContent(contentElement, currentContent) {
    return AssistantStream.accumulateDelta(currentContent, contentElement);
}, _AssistantStream_handleRun = function _AssistantStream_handleRun(event) {
    __classPrivateFieldSet(this, _AssistantStream_currentRunSnapshot, event.data, "f");
    switch (event.event) {
        case 'thread.run.created':
            break;
        case 'thread.run.queued':
            break;
        case 'thread.run.in_progress':
            break;
        case 'thread.run.requires_action':
        case 'thread.run.cancelled':
        case 'thread.run.failed':
        case 'thread.run.completed':
        case 'thread.run.expired':
            __classPrivateFieldSet(this, _AssistantStream_finalRun, event.data, "f");
            if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                this._emit('toolCallDone', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                __classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
            }
            break;
        case 'thread.run.cancelling':
            break;
    }
};
function assertNever(_x) { }
//# sourceMappingURL=AssistantStream.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/ChatCompletionRunner.mjs":
/*!**********************************************************!*\
  !*** ./node_modules/openai/lib/ChatCompletionRunner.mjs ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatCompletionRunner: () => (/* binding */ ChatCompletionRunner)
/* harmony export */ });
/* harmony import */ var _AbstractChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractChatCompletionRunner.mjs */ "./node_modules/openai/lib/AbstractChatCompletionRunner.mjs");
/* harmony import */ var _chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./chatCompletionUtils.mjs */ "./node_modules/openai/lib/chatCompletionUtils.mjs");


class ChatCompletionRunner extends _AbstractChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_0__.AbstractChatCompletionRunner {
    /** @deprecated - please use `runTools` instead. */
    static runFunctions(client, params, options) {
        const runner = new ChatCompletionRunner();
        const opts = {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'runFunctions' },
        };
        runner._run(() => runner._runFunctions(client, params, opts));
        return runner;
    }
    static runTools(client, params, options) {
        const runner = new ChatCompletionRunner();
        const opts = {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'runTools' },
        };
        runner._run(() => runner._runTools(client, params, opts));
        return runner;
    }
    _addMessage(message, emit = true) {
        super._addMessage(message, emit);
        if ((0,_chatCompletionUtils_mjs__WEBPACK_IMPORTED_MODULE_1__.isAssistantMessage)(message) && message.content) {
            this._emit('content', message.content);
        }
    }
}
//# sourceMappingURL=ChatCompletionRunner.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/ChatCompletionStream.mjs":
/*!**********************************************************!*\
  !*** ./node_modules/openai/lib/ChatCompletionStream.mjs ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatCompletionStream: () => (/* binding */ ChatCompletionStream)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _AbstractChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractChatCompletionRunner.mjs */ "./node_modules/openai/lib/AbstractChatCompletionRunner.mjs");
/* harmony import */ var _streaming_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../streaming.mjs */ "./node_modules/openai/streaming.mjs");
/* harmony import */ var _lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/parser.mjs */ "./node_modules/openai/lib/parser.mjs");
/* harmony import */ var _vendor_partial_json_parser_parser_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../_vendor/partial-json-parser/parser.mjs */ "./node_modules/openai/_vendor/partial-json-parser/parser.mjs");
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ChatCompletionStream_instances, _ChatCompletionStream_params, _ChatCompletionStream_choiceEventStates, _ChatCompletionStream_currentChatCompletionSnapshot, _ChatCompletionStream_beginRequest, _ChatCompletionStream_getChoiceEventState, _ChatCompletionStream_addChunk, _ChatCompletionStream_emitToolCallDoneEvent, _ChatCompletionStream_emitContentDoneEvents, _ChatCompletionStream_endRequest, _ChatCompletionStream_getAutoParseableResponseFormat, _ChatCompletionStream_accumulateChatCompletion;





class ChatCompletionStream extends _AbstractChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_0__.AbstractChatCompletionRunner {
    constructor(params) {
        super();
        _ChatCompletionStream_instances.add(this);
        _ChatCompletionStream_params.set(this, void 0);
        _ChatCompletionStream_choiceEventStates.set(this, void 0);
        _ChatCompletionStream_currentChatCompletionSnapshot.set(this, void 0);
        __classPrivateFieldSet(this, _ChatCompletionStream_params, params, "f");
        __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
    }
    get currentChatCompletionSnapshot() {
        return __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    }
    /**
     * Intended for use on the frontend, consuming a stream produced with
     * `.toReadableStream()` on the backend.
     *
     * Note that messages sent to the model do not appear in `.on('message')`
     * in this context.
     */
    static fromReadableStream(stream) {
        const runner = new ChatCompletionStream(null);
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    static createChatCompletion(client, params, options) {
        const runner = new ChatCompletionStream(params);
        runner._run(() => runner._runChatCompletion(client, { ...params, stream: true }, { ...options, headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' } }));
        return runner;
    }
    async _createChatCompletion(client, params, options) {
        super._createChatCompletion;
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
        const stream = await client.chat.completions.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const chunk of stream) {
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError();
        }
        return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
        this._connected();
        const stream = _streaming_mjs__WEBPACK_IMPORTED_MODULE_2__.Stream.fromReadableStream(readableStream, this.controller);
        let chatId;
        for await (const chunk of stream) {
            if (chatId && chatId !== chunk.id) {
                // A new request has been made.
                this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
            }
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
            chatId = chunk.id;
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError();
        }
        return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    [(_ChatCompletionStream_params = new WeakMap(), _ChatCompletionStream_choiceEventStates = new WeakMap(), _ChatCompletionStream_currentChatCompletionSnapshot = new WeakMap(), _ChatCompletionStream_instances = new WeakSet(), _ChatCompletionStream_beginRequest = function _ChatCompletionStream_beginRequest() {
        if (this.ended)
            return;
        __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
    }, _ChatCompletionStream_getChoiceEventState = function _ChatCompletionStream_getChoiceEventState(choice) {
        let state = __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index];
        if (state) {
            return state;
        }
        state = {
            content_done: false,
            refusal_done: false,
            logprobs_content_done: false,
            logprobs_refusal_done: false,
            done_tool_calls: new Set(),
            current_tool_call_index: null,
        };
        __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index] = state;
        return state;
    }, _ChatCompletionStream_addChunk = function _ChatCompletionStream_addChunk(chunk) {
        if (this.ended)
            return;
        const completion = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
        this._emit('chunk', chunk, completion);
        for (const choice of chunk.choices) {
            const choiceSnapshot = completion.choices[choice.index];
            if (choice.delta.content != null &&
                choiceSnapshot.message?.role === 'assistant' &&
                choiceSnapshot.message?.content) {
                this._emit('content', choice.delta.content, choiceSnapshot.message.content);
                this._emit('content.delta', {
                    delta: choice.delta.content,
                    snapshot: choiceSnapshot.message.content,
                    parsed: choiceSnapshot.message.parsed,
                });
            }
            if (choice.delta.refusal != null &&
                choiceSnapshot.message?.role === 'assistant' &&
                choiceSnapshot.message?.refusal) {
                this._emit('refusal.delta', {
                    delta: choice.delta.refusal,
                    snapshot: choiceSnapshot.message.refusal,
                });
            }
            if (choice.logprobs?.content != null && choiceSnapshot.message?.role === 'assistant') {
                this._emit('logprobs.content.delta', {
                    content: choice.logprobs?.content,
                    snapshot: choiceSnapshot.logprobs?.content ?? [],
                });
            }
            if (choice.logprobs?.refusal != null && choiceSnapshot.message?.role === 'assistant') {
                this._emit('logprobs.refusal.delta', {
                    refusal: choice.logprobs?.refusal,
                    snapshot: choiceSnapshot.logprobs?.refusal ?? [],
                });
            }
            const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
            if (choiceSnapshot.finish_reason) {
                __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
                if (state.current_tool_call_index != null) {
                    __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
                }
            }
            for (const toolCall of choice.delta.tool_calls ?? []) {
                if (state.current_tool_call_index !== toolCall.index) {
                    __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
                    // new tool call started, the previous one is done
                    if (state.current_tool_call_index != null) {
                        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
                    }
                }
                state.current_tool_call_index = toolCall.index;
            }
            for (const toolCallDelta of choice.delta.tool_calls ?? []) {
                const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallDelta.index];
                if (!toolCallSnapshot?.type) {
                    continue;
                }
                if (toolCallSnapshot?.type === 'function') {
                    this._emit('tool_calls.function.arguments.delta', {
                        name: toolCallSnapshot.function?.name,
                        index: toolCallDelta.index,
                        arguments: toolCallSnapshot.function.arguments,
                        parsed_arguments: toolCallSnapshot.function.parsed_arguments,
                        arguments_delta: toolCallDelta.function?.arguments ?? '',
                    });
                }
                else {
                    assertNever(toolCallSnapshot?.type);
                }
            }
        }
    }, _ChatCompletionStream_emitToolCallDoneEvent = function _ChatCompletionStream_emitToolCallDoneEvent(choiceSnapshot, toolCallIndex) {
        const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
        if (state.done_tool_calls.has(toolCallIndex)) {
            // we've already fired the done event
            return;
        }
        const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallIndex];
        if (!toolCallSnapshot) {
            throw new Error('no tool call snapshot');
        }
        if (!toolCallSnapshot.type) {
            throw new Error('tool call snapshot missing `type`');
        }
        if (toolCallSnapshot.type === 'function') {
            const inputTool = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.tools?.find((tool) => tool.type === 'function' && tool.function.name === toolCallSnapshot.function.name);
            this._emit('tool_calls.function.arguments.done', {
                name: toolCallSnapshot.function.name,
                index: toolCallIndex,
                arguments: toolCallSnapshot.function.arguments,
                parsed_arguments: (0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.isAutoParsableTool)(inputTool) ? inputTool.$parseRaw(toolCallSnapshot.function.arguments)
                    : inputTool?.function.strict ? JSON.parse(toolCallSnapshot.function.arguments)
                        : null,
            });
        }
        else {
            assertNever(toolCallSnapshot.type);
        }
    }, _ChatCompletionStream_emitContentDoneEvents = function _ChatCompletionStream_emitContentDoneEvents(choiceSnapshot) {
        const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
        if (choiceSnapshot.message.content && !state.content_done) {
            state.content_done = true;
            const responseFormat = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this);
            this._emit('content.done', {
                content: choiceSnapshot.message.content,
                parsed: responseFormat ? responseFormat.$parseRaw(choiceSnapshot.message.content) : null,
            });
        }
        if (choiceSnapshot.message.refusal && !state.refusal_done) {
            state.refusal_done = true;
            this._emit('refusal.done', { refusal: choiceSnapshot.message.refusal });
        }
        if (choiceSnapshot.logprobs?.content && !state.logprobs_content_done) {
            state.logprobs_content_done = true;
            this._emit('logprobs.content.done', { content: choiceSnapshot.logprobs.content });
        }
        if (choiceSnapshot.logprobs?.refusal && !state.logprobs_refusal_done) {
            state.logprobs_refusal_done = true;
            this._emit('logprobs.refusal.done', { refusal: choiceSnapshot.logprobs.refusal });
        }
    }, _ChatCompletionStream_endRequest = function _ChatCompletionStream_endRequest() {
        if (this.ended) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`stream has ended, this shouldn't happen`);
        }
        const snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
        if (!snapshot) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`request ended without sending any chunks`);
        }
        __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
        __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
        return finalizeChatCompletion(snapshot, __classPrivateFieldGet(this, _ChatCompletionStream_params, "f"));
    }, _ChatCompletionStream_getAutoParseableResponseFormat = function _ChatCompletionStream_getAutoParseableResponseFormat() {
        const responseFormat = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.response_format;
        if ((0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.isAutoParsableResponseFormat)(responseFormat)) {
            return responseFormat;
        }
        return null;
    }, _ChatCompletionStream_accumulateChatCompletion = function _ChatCompletionStream_accumulateChatCompletion(chunk) {
        var _a, _b, _c, _d;
        let snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
        const { choices, ...rest } = chunk;
        if (!snapshot) {
            snapshot = __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, {
                ...rest,
                choices: [],
            }, "f");
        }
        else {
            Object.assign(snapshot, rest);
        }
        for (const { delta, finish_reason, index, logprobs = null, ...other } of chunk.choices) {
            let choice = snapshot.choices[index];
            if (!choice) {
                choice = snapshot.choices[index] = { finish_reason, index, message: {}, logprobs, ...other };
            }
            if (logprobs) {
                if (!choice.logprobs) {
                    choice.logprobs = Object.assign({}, logprobs);
                }
                else {
                    const { content, refusal, ...rest } = logprobs;
                    assertIsEmpty(rest);
                    Object.assign(choice.logprobs, rest);
                    if (content) {
                        (_a = choice.logprobs).content ?? (_a.content = []);
                        choice.logprobs.content.push(...content);
                    }
                    if (refusal) {
                        (_b = choice.logprobs).refusal ?? (_b.refusal = []);
                        choice.logprobs.refusal.push(...refusal);
                    }
                }
            }
            if (finish_reason) {
                choice.finish_reason = finish_reason;
                if (__classPrivateFieldGet(this, _ChatCompletionStream_params, "f") && (0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.hasAutoParseableInput)(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"))) {
                    if (finish_reason === 'length') {
                        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.LengthFinishReasonError();
                    }
                    if (finish_reason === 'content_filter') {
                        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.ContentFilterFinishReasonError();
                    }
                }
            }
            Object.assign(choice, other);
            if (!delta)
                continue; // Shouldn't happen; just in case.
            const { content, refusal, function_call, role, tool_calls, ...rest } = delta;
            assertIsEmpty(rest);
            Object.assign(choice.message, rest);
            if (refusal) {
                choice.message.refusal = (choice.message.refusal || '') + refusal;
            }
            if (role)
                choice.message.role = role;
            if (function_call) {
                if (!choice.message.function_call) {
                    choice.message.function_call = function_call;
                }
                else {
                    if (function_call.name)
                        choice.message.function_call.name = function_call.name;
                    if (function_call.arguments) {
                        (_c = choice.message.function_call).arguments ?? (_c.arguments = '');
                        choice.message.function_call.arguments += function_call.arguments;
                    }
                }
            }
            if (content) {
                choice.message.content = (choice.message.content || '') + content;
                if (!choice.message.refusal && __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this)) {
                    choice.message.parsed = (0,_vendor_partial_json_parser_parser_mjs__WEBPACK_IMPORTED_MODULE_4__.partialParse)(choice.message.content);
                }
            }
            if (tool_calls) {
                if (!choice.message.tool_calls)
                    choice.message.tool_calls = [];
                for (const { index, id, type, function: fn, ...rest } of tool_calls) {
                    const tool_call = ((_d = choice.message.tool_calls)[index] ?? (_d[index] = {}));
                    Object.assign(tool_call, rest);
                    if (id)
                        tool_call.id = id;
                    if (type)
                        tool_call.type = type;
                    if (fn)
                        tool_call.function ?? (tool_call.function = { name: fn.name ?? '', arguments: '' });
                    if (fn?.name)
                        tool_call.function.name = fn.name;
                    if (fn?.arguments) {
                        tool_call.function.arguments += fn.arguments;
                        if ((0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.shouldParseToolCall)(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"), tool_call)) {
                            tool_call.function.parsed_arguments = (0,_vendor_partial_json_parser_parser_mjs__WEBPACK_IMPORTED_MODULE_4__.partialParse)(tool_call.function.arguments);
                        }
                    }
                }
            }
        }
        return snapshot;
    }, Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        this.on('chunk', (chunk) => {
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(chunk);
            }
            else {
                pushQueue.push(chunk);
            }
        });
        this.on('end', () => {
            done = true;
            for (const reader of readQueue) {
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async () => {
                if (!pushQueue.length) {
                    if (done) {
                        return { value: undefined, done: true };
                    }
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk) => (chunk ? { value: chunk, done: false } : { value: undefined, done: true }));
                }
                const chunk = pushQueue.shift();
                return { value: chunk, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    toReadableStream() {
        const stream = new _streaming_mjs__WEBPACK_IMPORTED_MODULE_2__.Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
}
function finalizeChatCompletion(snapshot, params) {
    const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
    const completion = {
        ...rest,
        id,
        choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest }) => {
            if (!finish_reason) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing finish_reason for choice ${index}`);
            }
            const { content = null, function_call, tool_calls, ...messageRest } = message;
            const role = message.role; // this is what we expect; in theory it could be different which would make our types a slight lie but would be fine.
            if (!role) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing role for choice ${index}`);
            }
            if (function_call) {
                const { arguments: args, name } = function_call;
                if (args == null) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing function_call.arguments for choice ${index}`);
                }
                if (!name) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing function_call.name for choice ${index}`);
                }
                return {
                    ...choiceRest,
                    message: {
                        content,
                        function_call: { arguments: args, name },
                        role,
                        refusal: message.refusal ?? null,
                    },
                    finish_reason,
                    index,
                    logprobs,
                };
            }
            if (tool_calls) {
                return {
                    ...choiceRest,
                    index,
                    finish_reason,
                    logprobs,
                    message: {
                        ...messageRest,
                        role,
                        content,
                        refusal: message.refusal ?? null,
                        tool_calls: tool_calls.map((tool_call, i) => {
                            const { function: fn, type, id, ...toolRest } = tool_call;
                            const { arguments: args, name, ...fnRest } = fn || {};
                            if (id == null) {
                                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing choices[${index}].tool_calls[${i}].id\n${str(snapshot)}`);
                            }
                            if (type == null) {
                                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing choices[${index}].tool_calls[${i}].type\n${str(snapshot)}`);
                            }
                            if (name == null) {
                                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name\n${str(snapshot)}`);
                            }
                            if (args == null) {
                                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments\n${str(snapshot)}`);
                            }
                            return { ...toolRest, id, type, function: { ...fnRest, name, arguments: args } };
                        }),
                    },
                };
            }
            return {
                ...choiceRest,
                message: { ...messageRest, content, role, refusal: message.refusal ?? null },
                finish_reason,
                index,
                logprobs,
            };
        }),
        created,
        model,
        object: 'chat.completion',
        ...(system_fingerprint ? { system_fingerprint } : {}),
    };
    return (0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_3__.maybeParseChatCompletion)(completion, params);
}
function str(x) {
    return JSON.stringify(x);
}
/**
 * Ensures the given argument is an empty object, useful for
 * asserting that all known properties on an object have been
 * destructured.
 */
function assertIsEmpty(obj) {
    return;
}
function assertNever(_x) { }
//# sourceMappingURL=ChatCompletionStream.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/ChatCompletionStreamingRunner.mjs":
/*!*******************************************************************!*\
  !*** ./node_modules/openai/lib/ChatCompletionStreamingRunner.mjs ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatCompletionStreamingRunner: () => (/* binding */ ChatCompletionStreamingRunner)
/* harmony export */ });
/* harmony import */ var _ChatCompletionStream_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ChatCompletionStream.mjs */ "./node_modules/openai/lib/ChatCompletionStream.mjs");

class ChatCompletionStreamingRunner extends _ChatCompletionStream_mjs__WEBPACK_IMPORTED_MODULE_0__.ChatCompletionStream {
    static fromReadableStream(stream) {
        const runner = new ChatCompletionStreamingRunner(null);
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    /** @deprecated - please use `runTools` instead. */
    static runFunctions(client, params, options) {
        const runner = new ChatCompletionStreamingRunner(null);
        const opts = {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'runFunctions' },
        };
        runner._run(() => runner._runFunctions(client, params, opts));
        return runner;
    }
    static runTools(client, params, options) {
        const runner = new ChatCompletionStreamingRunner(
        // @ts-expect-error TODO these types are incompatible
        params);
        const opts = {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'runTools' },
        };
        runner._run(() => runner._runTools(client, params, opts));
        return runner;
    }
}
//# sourceMappingURL=ChatCompletionStreamingRunner.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/EventStream.mjs":
/*!*************************************************!*\
  !*** ./node_modules/openai/lib/EventStream.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EventStream: () => (/* binding */ EventStream)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _EventStream_instances, _EventStream_connectedPromise, _EventStream_resolveConnectedPromise, _EventStream_rejectConnectedPromise, _EventStream_endPromise, _EventStream_resolveEndPromise, _EventStream_rejectEndPromise, _EventStream_listeners, _EventStream_ended, _EventStream_errored, _EventStream_aborted, _EventStream_catchingPromiseCreated, _EventStream_handleError;

class EventStream {
    constructor() {
        _EventStream_instances.add(this);
        this.controller = new AbortController();
        _EventStream_connectedPromise.set(this, void 0);
        _EventStream_resolveConnectedPromise.set(this, () => { });
        _EventStream_rejectConnectedPromise.set(this, () => { });
        _EventStream_endPromise.set(this, void 0);
        _EventStream_resolveEndPromise.set(this, () => { });
        _EventStream_rejectEndPromise.set(this, () => { });
        _EventStream_listeners.set(this, {});
        _EventStream_ended.set(this, false);
        _EventStream_errored.set(this, false);
        _EventStream_aborted.set(this, false);
        _EventStream_catchingPromiseCreated.set(this, false);
        __classPrivateFieldSet(this, _EventStream_connectedPromise, new Promise((resolve, reject) => {
            __classPrivateFieldSet(this, _EventStream_resolveConnectedPromise, resolve, "f");
            __classPrivateFieldSet(this, _EventStream_rejectConnectedPromise, reject, "f");
        }), "f");
        __classPrivateFieldSet(this, _EventStream_endPromise, new Promise((resolve, reject) => {
            __classPrivateFieldSet(this, _EventStream_resolveEndPromise, resolve, "f");
            __classPrivateFieldSet(this, _EventStream_rejectEndPromise, reject, "f");
        }), "f");
        // Don't let these promises cause unhandled rejection errors.
        // we will manually cause an unhandled rejection error later
        // if the user hasn't registered any error listener or called
        // any promise-returning method.
        __classPrivateFieldGet(this, _EventStream_connectedPromise, "f").catch(() => { });
        __classPrivateFieldGet(this, _EventStream_endPromise, "f").catch(() => { });
    }
    _run(executor) {
        // Unfortunately if we call `executor()` immediately we get runtime errors about
        // references to `this` before the `super()` constructor call returns.
        setTimeout(() => {
            executor().then(() => {
                this._emitFinal();
                this._emit('end');
            }, __classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_handleError).bind(this));
        }, 0);
    }
    _connected() {
        if (this.ended)
            return;
        __classPrivateFieldGet(this, _EventStream_resolveConnectedPromise, "f").call(this);
        this._emit('connect');
    }
    get ended() {
        return __classPrivateFieldGet(this, _EventStream_ended, "f");
    }
    get errored() {
        return __classPrivateFieldGet(this, _EventStream_errored, "f");
    }
    get aborted() {
        return __classPrivateFieldGet(this, _EventStream_aborted, "f");
    }
    abort() {
        this.controller.abort();
    }
    /**
     * Adds the listener function to the end of the listeners array for the event.
     * No checks are made to see if the listener has already been added. Multiple calls passing
     * the same combination of event and listener will result in the listener being added, and
     * called, multiple times.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    on(event, listener) {
        const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
        listeners.push({ listener });
        return this;
    }
    /**
     * Removes the specified listener from the listener array for the event.
     * off() will remove, at most, one instance of a listener from the listener array. If any single
     * listener has been added multiple times to the listener array for the specified event, then
     * off() must be called multiple times to remove each instance.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    off(event, listener) {
        const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
        if (!listeners)
            return this;
        const index = listeners.findIndex((l) => l.listener === listener);
        if (index >= 0)
            listeners.splice(index, 1);
        return this;
    }
    /**
     * Adds a one-time listener function for the event. The next time the event is triggered,
     * this listener is removed and then invoked.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    once(event, listener) {
        const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
        listeners.push({ listener, once: true });
        return this;
    }
    /**
     * This is similar to `.once()`, but returns a Promise that resolves the next time
     * the event is triggered, instead of calling a listener callback.
     * @returns a Promise that resolves the next time given event is triggered,
     * or rejects if an error is emitted.  (If you request the 'error' event,
     * returns a promise that resolves with the error).
     *
     * Example:
     *
     *   const message = await stream.emitted('message') // rejects if the stream errors
     */
    emitted(event) {
        return new Promise((resolve, reject) => {
            __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
            if (event !== 'error')
                this.once('error', reject);
            this.once(event, resolve);
        });
    }
    async done() {
        __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
        await __classPrivateFieldGet(this, _EventStream_endPromise, "f");
    }
    _emit(event, ...args) {
        // make sure we don't emit any events after end
        if (__classPrivateFieldGet(this, _EventStream_ended, "f")) {
            return;
        }
        if (event === 'end') {
            __classPrivateFieldSet(this, _EventStream_ended, true, "f");
            __classPrivateFieldGet(this, _EventStream_resolveEndPromise, "f").call(this);
        }
        const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
        if (listeners) {
            __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
            listeners.forEach(({ listener }) => listener(...args));
        }
        if (event === 'abort') {
            const error = args[0];
            if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
                Promise.reject(error);
            }
            __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
            __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
            this._emit('end');
            return;
        }
        if (event === 'error') {
            // NOTE: _emit('error', error) should only be called from #handleError().
            const error = args[0];
            if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
                // Trigger an unhandled rejection if the user hasn't registered any error handlers.
                // If you are seeing stack traces here, make sure to handle errors via either:
                // - runner.on('error', () => ...)
                // - await runner.done()
                // - await runner.finalChatCompletion()
                // - etc.
                Promise.reject(error);
            }
            __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
            __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
            this._emit('end');
        }
    }
    _emitFinal() { }
}
_EventStream_connectedPromise = new WeakMap(), _EventStream_resolveConnectedPromise = new WeakMap(), _EventStream_rejectConnectedPromise = new WeakMap(), _EventStream_endPromise = new WeakMap(), _EventStream_resolveEndPromise = new WeakMap(), _EventStream_rejectEndPromise = new WeakMap(), _EventStream_listeners = new WeakMap(), _EventStream_ended = new WeakMap(), _EventStream_errored = new WeakMap(), _EventStream_aborted = new WeakMap(), _EventStream_catchingPromiseCreated = new WeakMap(), _EventStream_instances = new WeakSet(), _EventStream_handleError = function _EventStream_handleError(error) {
    __classPrivateFieldSet(this, _EventStream_errored, true, "f");
    if (error instanceof Error && error.name === 'AbortError') {
        error = new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.APIUserAbortError();
    }
    if (error instanceof _error_mjs__WEBPACK_IMPORTED_MODULE_0__.APIUserAbortError) {
        __classPrivateFieldSet(this, _EventStream_aborted, true, "f");
        return this._emit('abort', error);
    }
    if (error instanceof _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError) {
        return this._emit('error', error);
    }
    if (error instanceof Error) {
        const openAIError = new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(error.message);
        // @ts-ignore
        openAIError.cause = error;
        return this._emit('error', openAIError);
    }
    return this._emit('error', new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(String(error)));
};
//# sourceMappingURL=EventStream.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/RunnableFunction.mjs":
/*!******************************************************!*\
  !*** ./node_modules/openai/lib/RunnableFunction.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ParsingFunction: () => (/* binding */ ParsingFunction),
/* harmony export */   ParsingToolFunction: () => (/* binding */ ParsingToolFunction),
/* harmony export */   isRunnableFunctionWithParse: () => (/* binding */ isRunnableFunctionWithParse)
/* harmony export */ });
function isRunnableFunctionWithParse(fn) {
    return typeof fn.parse === 'function';
}
/**
 * This is helper class for passing a `function` and `parse` where the `function`
 * argument type matches the `parse` return type.
 *
 * @deprecated - please use ParsingToolFunction instead.
 */
class ParsingFunction {
    constructor(input) {
        this.function = input.function;
        this.parse = input.parse;
        this.parameters = input.parameters;
        this.description = input.description;
        this.name = input.name;
    }
}
/**
 * This is helper class for passing a `function` and `parse` where the `function`
 * argument type matches the `parse` return type.
 */
class ParsingToolFunction {
    constructor(input) {
        this.type = 'function';
        this.function = input;
    }
}
//# sourceMappingURL=RunnableFunction.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/Util.mjs":
/*!******************************************!*\
  !*** ./node_modules/openai/lib/Util.mjs ***!
  \******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   allSettledWithThrow: () => (/* binding */ allSettledWithThrow)
/* harmony export */ });
/**
 * Like `Promise.allSettled()` but throws an error if any promises are rejected.
 */
const allSettledWithThrow = async (promises) => {
    const results = await Promise.allSettled(promises);
    const rejected = results.filter((result) => result.status === 'rejected');
    if (rejected.length) {
        for (const result of rejected) {
            console.error(result.reason);
        }
        throw new Error(`${rejected.length} promise(s) failed - see the above errors`);
    }
    // Note: TS was complaining about using `.filter().map()` here for some reason
    const values = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            values.push(result.value);
        }
    }
    return values;
};
//# sourceMappingURL=Util.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/chatCompletionUtils.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/openai/lib/chatCompletionUtils.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isAssistantMessage: () => (/* binding */ isAssistantMessage),
/* harmony export */   isFunctionMessage: () => (/* binding */ isFunctionMessage),
/* harmony export */   isPresent: () => (/* binding */ isPresent),
/* harmony export */   isToolMessage: () => (/* binding */ isToolMessage)
/* harmony export */ });
const isAssistantMessage = (message) => {
    return message?.role === 'assistant';
};
const isFunctionMessage = (message) => {
    return message?.role === 'function';
};
const isToolMessage = (message) => {
    return message?.role === 'tool';
};
function isPresent(obj) {
    return obj != null;
}
//# sourceMappingURL=chatCompletionUtils.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/parser.mjs":
/*!********************************************!*\
  !*** ./node_modules/openai/lib/parser.mjs ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hasAutoParseableInput: () => (/* binding */ hasAutoParseableInput),
/* harmony export */   isAutoParsableResponseFormat: () => (/* binding */ isAutoParsableResponseFormat),
/* harmony export */   isAutoParsableTool: () => (/* binding */ isAutoParsableTool),
/* harmony export */   makeParseableResponseFormat: () => (/* binding */ makeParseableResponseFormat),
/* harmony export */   makeParseableTool: () => (/* binding */ makeParseableTool),
/* harmony export */   maybeParseChatCompletion: () => (/* binding */ maybeParseChatCompletion),
/* harmony export */   parseChatCompletion: () => (/* binding */ parseChatCompletion),
/* harmony export */   shouldParseToolCall: () => (/* binding */ shouldParseToolCall),
/* harmony export */   validateInputTools: () => (/* binding */ validateInputTools)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");

function makeParseableResponseFormat(response_format, parser) {
    const obj = { ...response_format };
    Object.defineProperties(obj, {
        $brand: {
            value: 'auto-parseable-response-format',
            enumerable: false,
        },
        $parseRaw: {
            value: parser,
            enumerable: false,
        },
    });
    return obj;
}
function isAutoParsableResponseFormat(response_format) {
    return response_format?.['$brand'] === 'auto-parseable-response-format';
}
function makeParseableTool(tool, { parser, callback, }) {
    const obj = { ...tool };
    Object.defineProperties(obj, {
        $brand: {
            value: 'auto-parseable-tool',
            enumerable: false,
        },
        $parseRaw: {
            value: parser,
            enumerable: false,
        },
        $callback: {
            value: callback,
            enumerable: false,
        },
    });
    return obj;
}
function isAutoParsableTool(tool) {
    return tool?.['$brand'] === 'auto-parseable-tool';
}
function maybeParseChatCompletion(completion, params) {
    if (!params || !hasAutoParseableInput(params)) {
        return {
            ...completion,
            choices: completion.choices.map((choice) => ({
                ...choice,
                message: { ...choice.message, parsed: null, tool_calls: choice.message.tool_calls ?? [] },
            })),
        };
    }
    return parseChatCompletion(completion, params);
}
function parseChatCompletion(completion, params) {
    const choices = completion.choices.map((choice) => {
        if (choice.finish_reason === 'length') {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.LengthFinishReasonError();
        }
        if (choice.finish_reason === 'content_filter') {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.ContentFilterFinishReasonError();
        }
        return {
            ...choice,
            message: {
                ...choice.message,
                tool_calls: choice.message.tool_calls?.map((toolCall) => parseToolCall(params, toolCall)) ?? [],
                parsed: choice.message.content && !choice.message.refusal ?
                    parseResponseFormat(params, choice.message.content)
                    : null,
            },
        };
    });
    return { ...completion, choices };
}
function parseResponseFormat(params, content) {
    if (params.response_format?.type !== 'json_schema') {
        return null;
    }
    if (params.response_format?.type === 'json_schema') {
        if ('$parseRaw' in params.response_format) {
            const response_format = params.response_format;
            return response_format.$parseRaw(content);
        }
        return JSON.parse(content);
    }
    return null;
}
function parseToolCall(params, toolCall) {
    const inputTool = params.tools?.find((inputTool) => inputTool.function?.name === toolCall.function.name);
    return {
        ...toolCall,
        function: {
            ...toolCall.function,
            parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.function.arguments)
                : inputTool?.function.strict ? JSON.parse(toolCall.function.arguments)
                    : null,
        },
    };
}
function shouldParseToolCall(params, toolCall) {
    if (!params) {
        return false;
    }
    const inputTool = params.tools?.find((inputTool) => inputTool.function?.name === toolCall.function.name);
    return isAutoParsableTool(inputTool) || inputTool?.function.strict || false;
}
function hasAutoParseableInput(params) {
    if (isAutoParsableResponseFormat(params.response_format)) {
        return true;
    }
    return (params.tools?.some((t) => isAutoParsableTool(t) || (t.type === 'function' && t.function.strict === true)) ?? false);
}
function validateInputTools(tools) {
    for (const tool of tools ?? []) {
        if (tool.type !== 'function') {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
        }
        if (tool.function.strict !== true) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_0__.OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
        }
    }
}
//# sourceMappingURL=parser.mjs.map

/***/ }),

/***/ "./node_modules/openai/pagination.mjs":
/*!********************************************!*\
  !*** ./node_modules/openai/pagination.mjs ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CursorPage: () => (/* binding */ CursorPage),
/* harmony export */   Page: () => (/* binding */ Page)
/* harmony export */ });
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/openai/core.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */
class Page extends _core_mjs__WEBPACK_IMPORTED_MODULE_0__.AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.data = body.data || [];
        this.object = body.object;
    }
    getPaginatedItems() {
        return this.data ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    /**
     * This page represents a response that isn't actually paginated at the API level
     * so there will never be any next page params.
     */
    nextPageParams() {
        return null;
    }
    nextPageInfo() {
        return null;
    }
}
class CursorPage extends _core_mjs__WEBPACK_IMPORTED_MODULE_0__.AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.data = body.data || [];
        this.has_more = body.has_more || false;
    }
    getPaginatedItems() {
        return this.data ?? [];
    }
    hasNextPage() {
        if (this.has_more === false) {
            return false;
        }
        return super.hasNextPage();
    }
    // @deprecated Please use `nextPageInfo()` instead
    nextPageParams() {
        const info = this.nextPageInfo();
        if (!info)
            return null;
        if ('params' in info)
            return info.params;
        const params = Object.fromEntries(info.url.searchParams);
        if (!Object.keys(params).length)
            return null;
        return params;
    }
    nextPageInfo() {
        const data = this.getPaginatedItems();
        if (!data.length) {
            return null;
        }
        const id = data[data.length - 1]?.id;
        if (!id) {
            return null;
        }
        return { params: { after: id } };
    }
}
//# sourceMappingURL=pagination.mjs.map

/***/ }),

/***/ "./node_modules/openai/resource.mjs":
/*!******************************************!*\
  !*** ./node_modules/openai/resource.mjs ***!
  \******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   APIResource: () => (/* binding */ APIResource)
/* harmony export */ });
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
class APIResource {
    constructor(client) {
        this._client = client;
    }
}
//# sourceMappingURL=resource.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/audio/audio.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/openai/resources/audio/audio.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Audio: () => (/* binding */ Audio)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _speech_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./speech.mjs */ "./node_modules/openai/resources/audio/speech.mjs");
/* harmony import */ var _transcriptions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./transcriptions.mjs */ "./node_modules/openai/resources/audio/transcriptions.mjs");
/* harmony import */ var _translations_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./translations.mjs */ "./node_modules/openai/resources/audio/translations.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.







class Audio extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.transcriptions = new _transcriptions_mjs__WEBPACK_IMPORTED_MODULE_1__.Transcriptions(this._client);
        this.translations = new _translations_mjs__WEBPACK_IMPORTED_MODULE_2__.Translations(this._client);
        this.speech = new _speech_mjs__WEBPACK_IMPORTED_MODULE_3__.Speech(this._client);
    }
}
Audio.Transcriptions = _transcriptions_mjs__WEBPACK_IMPORTED_MODULE_1__.Transcriptions;
Audio.Translations = _translations_mjs__WEBPACK_IMPORTED_MODULE_2__.Translations;
Audio.Speech = _speech_mjs__WEBPACK_IMPORTED_MODULE_3__.Speech;
//# sourceMappingURL=audio.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/audio/speech.mjs":
/*!********************************************************!*\
  !*** ./node_modules/openai/resources/audio/speech.mjs ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Speech: () => (/* binding */ Speech)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Speech extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Generates audio from the input text.
     */
    create(body, options) {
        return this._client.post('/audio/speech', {
            body,
            ...options,
            headers: { Accept: 'application/octet-stream', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=speech.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/audio/transcriptions.mjs":
/*!****************************************************************!*\
  !*** ./node_modules/openai/resources/audio/transcriptions.mjs ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Transcriptions: () => (/* binding */ Transcriptions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Transcriptions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    create(body, options) {
        return this._client.post('/audio/transcriptions', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options, __metadata: { model: body.model } }));
    }
}
//# sourceMappingURL=transcriptions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/audio/translations.mjs":
/*!**************************************************************!*\
  !*** ./node_modules/openai/resources/audio/translations.mjs ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Translations: () => (/* binding */ Translations)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Translations extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    create(body, options) {
        return this._client.post('/audio/translations', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options, __metadata: { model: body.model } }));
    }
}
//# sourceMappingURL=translations.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/batches.mjs":
/*!***************************************************!*\
  !*** ./node_modules/openai/resources/batches.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Batches: () => (/* binding */ Batches),
/* harmony export */   BatchesPage: () => (/* binding */ BatchesPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Batches extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Creates and executes a batch from an uploaded file of requests
     */
    create(body, options) {
        return this._client.post('/batches', { body, ...options });
    }
    /**
     * Retrieves a batch.
     */
    retrieve(batchId, options) {
        return this._client.get(`/batches/${batchId}`, options);
    }
    list(query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/batches', BatchesPage, { query, ...options });
    }
    /**
     * Cancels an in-progress batch. The batch will be in status `cancelling` for up to
     * 10 minutes, before changing to `cancelled`, where it will have partial results
     * (if any) available in the output file.
     */
    cancel(batchId, options) {
        return this._client.post(`/batches/${batchId}/cancel`, options);
    }
}
class BatchesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
Batches.BatchesPage = BatchesPage;
//# sourceMappingURL=batches.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/assistants.mjs":
/*!***********************************************************!*\
  !*** ./node_modules/openai/resources/beta/assistants.mjs ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Assistants: () => (/* binding */ Assistants),
/* harmony export */   AssistantsPage: () => (/* binding */ AssistantsPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Assistants extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Create an assistant with a model and instructions.
     */
    create(body, options) {
        return this._client.post('/assistants', {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Retrieves an assistant.
     */
    retrieve(assistantId, options) {
        return this._client.get(`/assistants/${assistantId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Modifies an assistant.
     */
    update(assistantId, body, options) {
        return this._client.post(`/assistants/${assistantId}`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    list(query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/assistants', AssistantsPage, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Delete an assistant.
     */
    del(assistantId, options) {
        return this._client.delete(`/assistants/${assistantId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
class AssistantsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
Assistants.AssistantsPage = AssistantsPage;
//# sourceMappingURL=assistants.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/beta.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/resources/beta/beta.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Beta: () => (/* binding */ Beta)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _assistants_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./assistants.mjs */ "./node_modules/openai/resources/beta/assistants.mjs");
/* harmony import */ var _chat_chat_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./chat/chat.mjs */ "./node_modules/openai/resources/beta/chat/chat.mjs");
/* harmony import */ var _realtime_realtime_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./realtime/realtime.mjs */ "./node_modules/openai/resources/beta/realtime/realtime.mjs");
/* harmony import */ var _threads_threads_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./threads/threads.mjs */ "./node_modules/openai/resources/beta/threads/threads.mjs");
/* harmony import */ var _vector_stores_vector_stores_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./vector-stores/vector-stores.mjs */ "./node_modules/openai/resources/beta/vector-stores/vector-stores.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.











class Beta extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.realtime = new _realtime_realtime_mjs__WEBPACK_IMPORTED_MODULE_1__.Realtime(this._client);
        this.vectorStores = new _vector_stores_vector_stores_mjs__WEBPACK_IMPORTED_MODULE_2__.VectorStores(this._client);
        this.chat = new _chat_chat_mjs__WEBPACK_IMPORTED_MODULE_3__.Chat(this._client);
        this.assistants = new _assistants_mjs__WEBPACK_IMPORTED_MODULE_4__.Assistants(this._client);
        this.threads = new _threads_threads_mjs__WEBPACK_IMPORTED_MODULE_5__.Threads(this._client);
    }
}
Beta.Realtime = _realtime_realtime_mjs__WEBPACK_IMPORTED_MODULE_1__.Realtime;
Beta.VectorStores = _vector_stores_vector_stores_mjs__WEBPACK_IMPORTED_MODULE_2__.VectorStores;
Beta.VectorStoresPage = _vector_stores_vector_stores_mjs__WEBPACK_IMPORTED_MODULE_2__.VectorStoresPage;
Beta.Assistants = _assistants_mjs__WEBPACK_IMPORTED_MODULE_4__.Assistants;
Beta.AssistantsPage = _assistants_mjs__WEBPACK_IMPORTED_MODULE_4__.AssistantsPage;
Beta.Threads = _threads_threads_mjs__WEBPACK_IMPORTED_MODULE_5__.Threads;
//# sourceMappingURL=beta.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/chat/chat.mjs":
/*!**********************************************************!*\
  !*** ./node_modules/openai/resources/beta/chat/chat.mjs ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Chat: () => (/* binding */ Chat)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _completions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./completions.mjs */ "./node_modules/openai/resources/beta/chat/completions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Chat extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.completions = new _completions_mjs__WEBPACK_IMPORTED_MODULE_1__.Completions(this._client);
    }
}
(function (Chat) {
    Chat.Completions = _completions_mjs__WEBPACK_IMPORTED_MODULE_1__.Completions;
})(Chat || (Chat = {}));
//# sourceMappingURL=chat.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/chat/completions.mjs":
/*!*****************************************************************!*\
  !*** ./node_modules/openai/resources/beta/chat/completions.mjs ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatCompletionRunner: () => (/* reexport safe */ _lib_ChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_3__.ChatCompletionRunner),
/* harmony export */   ChatCompletionStream: () => (/* reexport safe */ _lib_ChatCompletionStream_mjs__WEBPACK_IMPORTED_MODULE_2__.ChatCompletionStream),
/* harmony export */   ChatCompletionStreamingRunner: () => (/* reexport safe */ _lib_ChatCompletionStreamingRunner_mjs__WEBPACK_IMPORTED_MODULE_0__.ChatCompletionStreamingRunner),
/* harmony export */   Completions: () => (/* binding */ Completions),
/* harmony export */   ParsingFunction: () => (/* reexport safe */ _lib_RunnableFunction_mjs__WEBPACK_IMPORTED_MODULE_1__.ParsingFunction),
/* harmony export */   ParsingToolFunction: () => (/* reexport safe */ _lib_RunnableFunction_mjs__WEBPACK_IMPORTED_MODULE_1__.ParsingToolFunction)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _lib_ChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../lib/ChatCompletionRunner.mjs */ "./node_modules/openai/lib/ChatCompletionRunner.mjs");
/* harmony import */ var _lib_ChatCompletionStreamingRunner_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../lib/ChatCompletionStreamingRunner.mjs */ "./node_modules/openai/lib/ChatCompletionStreamingRunner.mjs");
/* harmony import */ var _lib_ChatCompletionStream_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../lib/ChatCompletionStream.mjs */ "./node_modules/openai/lib/ChatCompletionStream.mjs");
/* harmony import */ var _lib_parser_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../../lib/parser.mjs */ "./node_modules/openai/lib/parser.mjs");
/* harmony import */ var _lib_RunnableFunction_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../lib/RunnableFunction.mjs */ "./node_modules/openai/lib/RunnableFunction.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.









class Completions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_4__.APIResource {
    parse(body, options) {
        (0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_5__.validateInputTools)(body.tools);
        return this._client.chat.completions
            .create(body, {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'beta.chat.completions.parse',
            },
        })
            ._thenUnwrap((completion) => (0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_5__.parseChatCompletion)(completion, body));
    }
    runFunctions(body, options) {
        if (body.stream) {
            return _lib_ChatCompletionStreamingRunner_mjs__WEBPACK_IMPORTED_MODULE_0__.ChatCompletionStreamingRunner.runFunctions(this._client, body, options);
        }
        return _lib_ChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_3__.ChatCompletionRunner.runFunctions(this._client, body, options);
    }
    runTools(body, options) {
        if (body.stream) {
            return _lib_ChatCompletionStreamingRunner_mjs__WEBPACK_IMPORTED_MODULE_0__.ChatCompletionStreamingRunner.runTools(this._client, body, options);
        }
        return _lib_ChatCompletionRunner_mjs__WEBPACK_IMPORTED_MODULE_3__.ChatCompletionRunner.runTools(this._client, body, options);
    }
    /**
     * Creates a chat completion stream
     */
    stream(body, options) {
        return _lib_ChatCompletionStream_mjs__WEBPACK_IMPORTED_MODULE_2__.ChatCompletionStream.createChatCompletion(this._client, body, options);
    }
}
//# sourceMappingURL=completions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/realtime/realtime.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/openai/resources/beta/realtime/realtime.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Realtime: () => (/* binding */ Realtime)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _sessions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sessions.mjs */ "./node_modules/openai/resources/beta/realtime/sessions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Realtime extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.sessions = new _sessions_mjs__WEBPACK_IMPORTED_MODULE_1__.Sessions(this._client);
    }
}
Realtime.Sessions = _sessions_mjs__WEBPACK_IMPORTED_MODULE_1__.Sessions;
//# sourceMappingURL=realtime.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/realtime/sessions.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/openai/resources/beta/realtime/sessions.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Sessions: () => (/* binding */ Sessions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Sessions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Create an ephemeral API token for use in client-side applications with the
     * Realtime API. Can be configured with the same session parameters as the
     * `session.update` client event.
     *
     * It responds with a session object, plus a `client_secret` key which contains a
     * usable ephemeral API token that can be used to authenticate browser clients for
     * the Realtime API.
     */
    create(body, options) {
        return this._client.post('/realtime/sessions', {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
//# sourceMappingURL=sessions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/threads/messages.mjs":
/*!*****************************************************************!*\
  !*** ./node_modules/openai/resources/beta/threads/messages.mjs ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Messages: () => (/* binding */ Messages),
/* harmony export */   MessagesPage: () => (/* binding */ MessagesPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Messages extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Create a message.
     */
    create(threadId, body, options) {
        return this._client.post(`/threads/${threadId}/messages`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Retrieve a message.
     */
    retrieve(threadId, messageId, options) {
        return this._client.get(`/threads/${threadId}/messages/${messageId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Modifies a message.
     */
    update(threadId, messageId, body, options) {
        return this._client.post(`/threads/${threadId}/messages/${messageId}`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    list(threadId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list(threadId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/messages`, MessagesPage, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Deletes a message.
     */
    del(threadId, messageId, options) {
        return this._client.delete(`/threads/${threadId}/messages/${messageId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
class MessagesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
Messages.MessagesPage = MessagesPage;
//# sourceMappingURL=messages.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/threads/runs/runs.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/openai/resources/beta/threads/runs/runs.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Runs: () => (/* binding */ Runs),
/* harmony export */   RunsPage: () => (/* binding */ RunsPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _lib_AssistantStream_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../../lib/AssistantStream.mjs */ "./node_modules/openai/lib/AssistantStream.mjs");
/* harmony import */ var _steps_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./steps.mjs */ "./node_modules/openai/resources/beta/threads/runs/steps.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.







class Runs extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.steps = new _steps_mjs__WEBPACK_IMPORTED_MODULE_1__.Steps(this._client);
    }
    create(threadId, params, options) {
        const { include, ...body } = params;
        return this._client.post(`/threads/${threadId}/runs`, {
            query: { include },
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
            stream: params.stream ?? false,
        });
    }
    /**
     * Retrieves a run.
     */
    retrieve(threadId, runId, options) {
        return this._client.get(`/threads/${threadId}/runs/${runId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Modifies a run.
     */
    update(threadId, runId, body, options) {
        return this._client.post(`/threads/${threadId}/runs/${runId}`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    list(threadId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.isRequestOptions)(query)) {
            return this.list(threadId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/runs`, RunsPage, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Cancels a run that is `in_progress`.
     */
    cancel(threadId, runId, options) {
        return this._client.post(`/threads/${threadId}/runs/${runId}/cancel`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * A helper to create a run an poll for a terminal state. More information on Run
     * lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async createAndPoll(threadId, body, options) {
        const run = await this.create(threadId, body, options);
        return await this.poll(threadId, run.id, options);
    }
    /**
     * Create a Run stream
     *
     * @deprecated use `stream` instead
     */
    createAndStream(threadId, body, options) {
        return _lib_AssistantStream_mjs__WEBPACK_IMPORTED_MODULE_3__.AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    /**
     * A helper to poll a run status until it reaches a terminal state. More
     * information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async poll(threadId, runId, options) {
        const headers = { ...options?.headers, 'X-Stainless-Poll-Helper': 'true' };
        if (options?.pollIntervalMs) {
            headers['X-Stainless-Custom-Poll-Interval'] = options.pollIntervalMs.toString();
        }
        while (true) {
            const { data: run, response } = await this.retrieve(threadId, runId, {
                ...options,
                headers: { ...options?.headers, ...headers },
            }).withResponse();
            switch (run.status) {
                //If we are in any sort of intermediate state we poll
                case 'queued':
                case 'in_progress':
                case 'cancelling':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    }
                    else {
                        const headerInterval = response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.sleep)(sleepInterval);
                    break;
                //We return the run in any terminal state.
                case 'requires_action':
                case 'incomplete':
                case 'cancelled':
                case 'completed':
                case 'failed':
                case 'expired':
                    return run;
            }
        }
    }
    /**
     * Create a Run stream
     */
    stream(threadId, body, options) {
        return _lib_AssistantStream_mjs__WEBPACK_IMPORTED_MODULE_3__.AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    submitToolOutputs(threadId, runId, body, options) {
        return this._client.post(`/threads/${threadId}/runs/${runId}/submit_tool_outputs`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
            stream: body.stream ?? false,
        });
    }
    /**
     * A helper to submit a tool output to a run and poll for a terminal run state.
     * More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async submitToolOutputsAndPoll(threadId, runId, body, options) {
        const run = await this.submitToolOutputs(threadId, runId, body, options);
        return await this.poll(threadId, run.id, options);
    }
    /**
     * Submit the tool outputs from a previous run and stream the run to a terminal
     * state. More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    submitToolOutputsStream(threadId, runId, body, options) {
        return _lib_AssistantStream_mjs__WEBPACK_IMPORTED_MODULE_3__.AssistantStream.createToolAssistantStream(threadId, runId, this._client.beta.threads.runs, body, options);
    }
}
class RunsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__.CursorPage {
}
Runs.RunsPage = RunsPage;
Runs.Steps = _steps_mjs__WEBPACK_IMPORTED_MODULE_1__.Steps;
Runs.RunStepsPage = _steps_mjs__WEBPACK_IMPORTED_MODULE_1__.RunStepsPage;
//# sourceMappingURL=runs.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/threads/runs/steps.mjs":
/*!*******************************************************************!*\
  !*** ./node_modules/openai/resources/beta/threads/runs/steps.mjs ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RunStepsPage: () => (/* binding */ RunStepsPage),
/* harmony export */   Steps: () => (/* binding */ Steps)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Steps extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    retrieve(threadId, runId, stepId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.retrieve(threadId, runId, stepId, {}, query);
        }
        return this._client.get(`/threads/${threadId}/runs/${runId}/steps/${stepId}`, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    list(threadId, runId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list(threadId, runId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/runs/${runId}/steps`, RunStepsPage, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
class RunStepsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
Steps.RunStepsPage = RunStepsPage;
//# sourceMappingURL=steps.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/threads/threads.mjs":
/*!****************************************************************!*\
  !*** ./node_modules/openai/resources/beta/threads/threads.mjs ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Threads: () => (/* binding */ Threads)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _lib_AssistantStream_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../../lib/AssistantStream.mjs */ "./node_modules/openai/lib/AssistantStream.mjs");
/* harmony import */ var _messages_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./messages.mjs */ "./node_modules/openai/resources/beta/threads/messages.mjs");
/* harmony import */ var _runs_runs_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./runs/runs.mjs */ "./node_modules/openai/resources/beta/threads/runs/runs.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.







class Threads extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.runs = new _runs_runs_mjs__WEBPACK_IMPORTED_MODULE_1__.Runs(this._client);
        this.messages = new _messages_mjs__WEBPACK_IMPORTED_MODULE_2__.Messages(this._client);
    }
    create(body = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_3__.isRequestOptions)(body)) {
            return this.create({}, body);
        }
        return this._client.post('/threads', {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Retrieves a thread.
     */
    retrieve(threadId, options) {
        return this._client.get(`/threads/${threadId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Modifies a thread.
     */
    update(threadId, body, options) {
        return this._client.post(`/threads/${threadId}`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Delete a thread.
     */
    del(threadId, options) {
        return this._client.delete(`/threads/${threadId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    createAndRun(body, options) {
        return this._client.post('/threads/runs', {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
            stream: body.stream ?? false,
        });
    }
    /**
     * A helper to create a thread, start a run and then poll for a terminal state.
     * More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async createAndRunPoll(body, options) {
        const run = await this.createAndRun(body, options);
        return await this.runs.poll(run.thread_id, run.id, options);
    }
    /**
     * Create a thread and stream the run back
     */
    createAndRunStream(body, options) {
        return _lib_AssistantStream_mjs__WEBPACK_IMPORTED_MODULE_4__.AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options);
    }
}
Threads.Runs = _runs_runs_mjs__WEBPACK_IMPORTED_MODULE_1__.Runs;
Threads.RunsPage = _runs_runs_mjs__WEBPACK_IMPORTED_MODULE_1__.RunsPage;
Threads.Messages = _messages_mjs__WEBPACK_IMPORTED_MODULE_2__.Messages;
Threads.MessagesPage = _messages_mjs__WEBPACK_IMPORTED_MODULE_2__.MessagesPage;
//# sourceMappingURL=threads.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/vector-stores/file-batches.mjs":
/*!***************************************************************************!*\
  !*** ./node_modules/openai/resources/beta/vector-stores/file-batches.mjs ***!
  \***************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FileBatches: () => (/* binding */ FileBatches),
/* harmony export */   VectorStoreFilesPage: () => (/* reexport safe */ _files_mjs__WEBPACK_IMPORTED_MODULE_2__.VectorStoreFilesPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _lib_Util_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../lib/Util.mjs */ "./node_modules/openai/lib/Util.mjs");
/* harmony import */ var _files_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./files.mjs */ "./node_modules/openai/resources/beta/vector-stores/files.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.





class FileBatches extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Create a vector store file batch.
     */
    create(vectorStoreId, body, options) {
        return this._client.post(`/vector_stores/${vectorStoreId}/file_batches`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Retrieves a vector store file batch.
     */
    retrieve(vectorStoreId, batchId, options) {
        return this._client.get(`/vector_stores/${vectorStoreId}/file_batches/${batchId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Cancel a vector store file batch. This attempts to cancel the processing of
     * files in this batch as soon as possible.
     */
    cancel(vectorStoreId, batchId, options) {
        return this._client.post(`/vector_stores/${vectorStoreId}/file_batches/${batchId}/cancel`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Create a vector store batch and poll until all files have been processed.
     */
    async createAndPoll(vectorStoreId, body, options) {
        const batch = await this.create(vectorStoreId, body);
        return await this.poll(vectorStoreId, batch.id, options);
    }
    listFiles(vectorStoreId, batchId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.listFiles(vectorStoreId, batchId, {}, query);
        }
        return this._client.getAPIList(`/vector_stores/${vectorStoreId}/file_batches/${batchId}/files`, _files_mjs__WEBPACK_IMPORTED_MODULE_2__.VectorStoreFilesPage, { query, ...options, headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers } });
    }
    /**
     * Wait for the given file batch to be processed.
     *
     * Note: this will return even if one of the files failed to process, you need to
     * check batch.file_counts.failed_count to handle this case.
     */
    async poll(vectorStoreId, batchId, options) {
        const headers = { ...options?.headers, 'X-Stainless-Poll-Helper': 'true' };
        if (options?.pollIntervalMs) {
            headers['X-Stainless-Custom-Poll-Interval'] = options.pollIntervalMs.toString();
        }
        while (true) {
            const { data: batch, response } = await this.retrieve(vectorStoreId, batchId, {
                ...options,
                headers,
            }).withResponse();
            switch (batch.status) {
                case 'in_progress':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    }
                    else {
                        const headerInterval = response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.sleep)(sleepInterval);
                    break;
                case 'failed':
                case 'cancelled':
                case 'completed':
                    return batch;
            }
        }
    }
    /**
     * Uploads the given files concurrently and then creates a vector store file batch.
     *
     * The concurrency limit is configurable using the `maxConcurrency` parameter.
     */
    async uploadAndPoll(vectorStoreId, { files, fileIds = [] }, options) {
        if (files == null || files.length == 0) {
            throw new Error(`No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`);
        }
        const configuredConcurrency = options?.maxConcurrency ?? 5;
        // We cap the number of workers at the number of files (so we don't start any unnecessary workers)
        const concurrencyLimit = Math.min(configuredConcurrency, files.length);
        const client = this._client;
        const fileIterator = files.values();
        const allFileIds = [...fileIds];
        // This code is based on this design. The libraries don't accommodate our environment limits.
        // https://stackoverflow.com/questions/40639432/what-is-the-best-way-to-limit-concurrency-when-using-es6s-promise-all
        async function processFiles(iterator) {
            for (let item of iterator) {
                const fileObj = await client.files.create({ file: item, purpose: 'assistants' }, options);
                allFileIds.push(fileObj.id);
            }
        }
        // Start workers to process results
        const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);
        // Wait for all processing to complete.
        await (0,_lib_Util_mjs__WEBPACK_IMPORTED_MODULE_3__.allSettledWithThrow)(workers);
        return await this.createAndPoll(vectorStoreId, {
            file_ids: allFileIds,
        });
    }
}

//# sourceMappingURL=file-batches.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/vector-stores/files.mjs":
/*!********************************************************************!*\
  !*** ./node_modules/openai/resources/beta/vector-stores/files.mjs ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Files: () => (/* binding */ Files),
/* harmony export */   VectorStoreFilesPage: () => (/* binding */ VectorStoreFilesPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Files extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Create a vector store file by attaching a
     * [File](https://platform.openai.com/docs/api-reference/files) to a
     * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object).
     */
    create(vectorStoreId, body, options) {
        return this._client.post(`/vector_stores/${vectorStoreId}/files`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Retrieves a vector store file.
     */
    retrieve(vectorStoreId, fileId, options) {
        return this._client.get(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    list(vectorStoreId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list(vectorStoreId, {}, query);
        }
        return this._client.getAPIList(`/vector_stores/${vectorStoreId}/files`, VectorStoreFilesPage, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Delete a vector store file. This will remove the file from the vector store but
     * the file itself will not be deleted. To delete the file, use the
     * [delete file](https://platform.openai.com/docs/api-reference/files/delete)
     * endpoint.
     */
    del(vectorStoreId, fileId, options) {
        return this._client.delete(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Attach a file to the given vector store and wait for it to be processed.
     */
    async createAndPoll(vectorStoreId, body, options) {
        const file = await this.create(vectorStoreId, body, options);
        return await this.poll(vectorStoreId, file.id, options);
    }
    /**
     * Wait for the vector store file to finish processing.
     *
     * Note: this will return even if the file failed to process, you need to check
     * file.last_error and file.status to handle these cases
     */
    async poll(vectorStoreId, fileId, options) {
        const headers = { ...options?.headers, 'X-Stainless-Poll-Helper': 'true' };
        if (options?.pollIntervalMs) {
            headers['X-Stainless-Custom-Poll-Interval'] = options.pollIntervalMs.toString();
        }
        while (true) {
            const fileResponse = await this.retrieve(vectorStoreId, fileId, {
                ...options,
                headers,
            }).withResponse();
            const file = fileResponse.data;
            switch (file.status) {
                case 'in_progress':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    }
                    else {
                        const headerInterval = fileResponse.response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.sleep)(sleepInterval);
                    break;
                case 'failed':
                case 'completed':
                    return file;
            }
        }
    }
    /**
     * Upload a file to the `files` API and then attach it to the given vector store.
     *
     * Note the file will be asynchronously processed (you can use the alternative
     * polling helper method to wait for processing to complete).
     */
    async upload(vectorStoreId, file, options) {
        const fileInfo = await this._client.files.create({ file: file, purpose: 'assistants' }, options);
        return this.create(vectorStoreId, { file_id: fileInfo.id }, options);
    }
    /**
     * Add a file to a vector store and poll until processing is complete.
     */
    async uploadAndPoll(vectorStoreId, file, options) {
        const fileInfo = await this.upload(vectorStoreId, file, options);
        return await this.poll(vectorStoreId, fileInfo.id, options);
    }
}
class VectorStoreFilesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
Files.VectorStoreFilesPage = VectorStoreFilesPage;
//# sourceMappingURL=files.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/vector-stores/vector-stores.mjs":
/*!****************************************************************************!*\
  !*** ./node_modules/openai/resources/beta/vector-stores/vector-stores.mjs ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VectorStores: () => (/* binding */ VectorStores),
/* harmony export */   VectorStoresPage: () => (/* binding */ VectorStoresPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _file_batches_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./file-batches.mjs */ "./node_modules/openai/resources/beta/vector-stores/file-batches.mjs");
/* harmony import */ var _files_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./files.mjs */ "./node_modules/openai/resources/beta/vector-stores/files.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.







class VectorStores extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.files = new _files_mjs__WEBPACK_IMPORTED_MODULE_1__.Files(this._client);
        this.fileBatches = new _file_batches_mjs__WEBPACK_IMPORTED_MODULE_2__.FileBatches(this._client);
    }
    /**
     * Create a vector store.
     */
    create(body, options) {
        return this._client.post('/vector_stores', {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Retrieves a vector store.
     */
    retrieve(vectorStoreId, options) {
        return this._client.get(`/vector_stores/${vectorStoreId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Modifies a vector store.
     */
    update(vectorStoreId, body, options) {
        return this._client.post(`/vector_stores/${vectorStoreId}`, {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    list(query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_3__.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/vector_stores', VectorStoresPage, {
            query,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
    /**
     * Delete a vector store.
     */
    del(vectorStoreId, options) {
        return this._client.delete(`/vector_stores/${vectorStoreId}`, {
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
class VectorStoresPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__.CursorPage {
}
VectorStores.VectorStoresPage = VectorStoresPage;
VectorStores.Files = _files_mjs__WEBPACK_IMPORTED_MODULE_1__.Files;
VectorStores.VectorStoreFilesPage = _files_mjs__WEBPACK_IMPORTED_MODULE_1__.VectorStoreFilesPage;
VectorStores.FileBatches = _file_batches_mjs__WEBPACK_IMPORTED_MODULE_2__.FileBatches;
//# sourceMappingURL=vector-stores.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/chat/chat.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/resources/chat/chat.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Chat: () => (/* binding */ Chat)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _completions_completions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./completions/completions.mjs */ "./node_modules/openai/resources/chat/completions/completions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Chat extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.completions = new _completions_completions_mjs__WEBPACK_IMPORTED_MODULE_1__.Completions(this._client);
    }
}
Chat.Completions = _completions_completions_mjs__WEBPACK_IMPORTED_MODULE_1__.Completions;
Chat.ChatCompletionsPage = _completions_completions_mjs__WEBPACK_IMPORTED_MODULE_1__.ChatCompletionsPage;
//# sourceMappingURL=chat.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/chat/completions/completions.mjs":
/*!************************************************************************!*\
  !*** ./node_modules/openai/resources/chat/completions/completions.mjs ***!
  \************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatCompletionStoreMessagesPage: () => (/* binding */ ChatCompletionStoreMessagesPage),
/* harmony export */   ChatCompletionsPage: () => (/* binding */ ChatCompletionsPage),
/* harmony export */   Completions: () => (/* binding */ Completions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _messages_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./messages.mjs */ "./node_modules/openai/resources/chat/completions/messages.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.





class Completions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.messages = new _messages_mjs__WEBPACK_IMPORTED_MODULE_1__.Messages(this._client);
    }
    create(body, options) {
        return this._client.post('/chat/completions', { body, ...options, stream: body.stream ?? false });
    }
    /**
     * Get a stored chat completion. Only chat completions that have been created with
     * the `store` parameter set to `true` will be returned.
     */
    retrieve(completionId, options) {
        return this._client.get(`/chat/completions/${completionId}`, options);
    }
    /**
     * Modify a stored chat completion. Only chat completions that have been created
     * with the `store` parameter set to `true` can be modified. Currently, the only
     * supported modification is to update the `metadata` field.
     */
    update(completionId, body, options) {
        return this._client.post(`/chat/completions/${completionId}`, { body, ...options });
    }
    list(query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/chat/completions', ChatCompletionsPage, { query, ...options });
    }
    /**
     * Delete a stored chat completion. Only chat completions that have been created
     * with the `store` parameter set to `true` can be deleted.
     */
    del(completionId, options) {
        return this._client.delete(`/chat/completions/${completionId}`, options);
    }
}
class ChatCompletionsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_3__.CursorPage {
}
class ChatCompletionStoreMessagesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_3__.CursorPage {
}
Completions.ChatCompletionsPage = ChatCompletionsPage;
Completions.Messages = _messages_mjs__WEBPACK_IMPORTED_MODULE_1__.Messages;
//# sourceMappingURL=completions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/chat/completions/messages.mjs":
/*!*********************************************************************!*\
  !*** ./node_modules/openai/resources/chat/completions/messages.mjs ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatCompletionStoreMessagesPage: () => (/* reexport safe */ _completions_mjs__WEBPACK_IMPORTED_MODULE_2__.ChatCompletionStoreMessagesPage),
/* harmony export */   Messages: () => (/* binding */ Messages)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _completions_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./completions.mjs */ "./node_modules/openai/resources/chat/completions/completions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Messages extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    list(completionId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list(completionId, {}, query);
        }
        return this._client.getAPIList(`/chat/completions/${completionId}/messages`, _completions_mjs__WEBPACK_IMPORTED_MODULE_2__.ChatCompletionStoreMessagesPage, { query, ...options });
    }
}

//# sourceMappingURL=messages.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/completions.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/openai/resources/completions.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Completions: () => (/* binding */ Completions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Completions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    create(body, options) {
        return this._client.post('/completions', { body, ...options, stream: body.stream ?? false });
    }
}
//# sourceMappingURL=completions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/embeddings.mjs":
/*!******************************************************!*\
  !*** ./node_modules/openai/resources/embeddings.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Embeddings: () => (/* binding */ Embeddings)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Embeddings extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Creates an embedding vector representing the input text.
     */
    create(body, options) {
        return this._client.post('/embeddings', { body, ...options });
    }
}
//# sourceMappingURL=embeddings.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/files.mjs":
/*!*************************************************!*\
  !*** ./node_modules/openai/resources/files.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FileObjectsPage: () => (/* binding */ FileObjectsPage),
/* harmony export */   Files: () => (/* binding */ Files)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/openai/uploads.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.






class Files extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Upload a file that can be used across various endpoints. Individual files can be
     * up to 512 MB, and the size of all files uploaded by one organization can be up
     * to 100 GB.
     *
     * The Assistants API supports files up to 2 million tokens and of specific file
     * types. See the
     * [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools) for
     * details.
     *
     * The Fine-tuning API only supports `.jsonl` files. The input also has certain
     * required formats for fine-tuning
     * [chat](https://platform.openai.com/docs/api-reference/fine-tuning/chat-input) or
     * [completions](https://platform.openai.com/docs/api-reference/fine-tuning/completions-input)
     * models.
     *
     * The Batch API only supports `.jsonl` files up to 200 MB in size. The input also
     * has a specific required
     * [format](https://platform.openai.com/docs/api-reference/batch/request-input).
     *
     * Please [contact us](https://help.openai.com/) if you need to increase these
     * storage limits.
     */
    create(body, options) {
        return this._client.post('/files', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
    /**
     * Returns information about a specific file.
     */
    retrieve(fileId, options) {
        return this._client.get(`/files/${fileId}`, options);
    }
    list(query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/files', FileObjectsPage, { query, ...options });
    }
    /**
     * Delete a file.
     */
    del(fileId, options) {
        return this._client.delete(`/files/${fileId}`, options);
    }
    /**
     * Returns the contents of the specified file.
     */
    content(fileId, options) {
        return this._client.get(`/files/${fileId}/content`, {
            ...options,
            headers: { Accept: 'application/binary', ...options?.headers },
            __binaryResponse: true,
        });
    }
    /**
     * Returns the contents of the specified file.
     *
     * @deprecated The `.content()` method should be used instead
     */
    retrieveContent(fileId, options) {
        return this._client.get(`/files/${fileId}/content`, options);
    }
    /**
     * Waits for the given file to be processed, default timeout is 30 mins.
     */
    async waitForProcessing(id, { pollInterval = 5000, maxWait = 30 * 60 * 1000 } = {}) {
        const TERMINAL_STATES = new Set(['processed', 'error', 'deleted']);
        const start = Date.now();
        let file = await this.retrieve(id);
        while (!file.status || !TERMINAL_STATES.has(file.status)) {
            await (0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.sleep)(pollInterval);
            file = await this.retrieve(id);
            if (Date.now() - start > maxWait) {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.APIConnectionTimeoutError({
                    message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`,
                });
            }
        }
        return file;
    }
}
class FileObjectsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__.CursorPage {
}
Files.FileObjectsPage = FileObjectsPage;
//# sourceMappingURL=files.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/fine-tuning/fine-tuning.mjs":
/*!*******************************************************************!*\
  !*** ./node_modules/openai/resources/fine-tuning/fine-tuning.mjs ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FineTuning: () => (/* binding */ FineTuning)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _jobs_jobs_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./jobs/jobs.mjs */ "./node_modules/openai/resources/fine-tuning/jobs/jobs.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class FineTuning extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.jobs = new _jobs_jobs_mjs__WEBPACK_IMPORTED_MODULE_1__.Jobs(this._client);
    }
}
FineTuning.Jobs = _jobs_jobs_mjs__WEBPACK_IMPORTED_MODULE_1__.Jobs;
FineTuning.FineTuningJobsPage = _jobs_jobs_mjs__WEBPACK_IMPORTED_MODULE_1__.FineTuningJobsPage;
FineTuning.FineTuningJobEventsPage = _jobs_jobs_mjs__WEBPACK_IMPORTED_MODULE_1__.FineTuningJobEventsPage;
//# sourceMappingURL=fine-tuning.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs":
/*!************************************************************************!*\
  !*** ./node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs ***!
  \************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Checkpoints: () => (/* binding */ Checkpoints),
/* harmony export */   FineTuningJobCheckpointsPage: () => (/* binding */ FineTuningJobCheckpointsPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Checkpoints extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    list(fineTuningJobId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list(fineTuningJobId, {}, query);
        }
        return this._client.getAPIList(`/fine_tuning/jobs/${fineTuningJobId}/checkpoints`, FineTuningJobCheckpointsPage, { query, ...options });
    }
}
class FineTuningJobCheckpointsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
Checkpoints.FineTuningJobCheckpointsPage = FineTuningJobCheckpointsPage;
//# sourceMappingURL=checkpoints.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/fine-tuning/jobs/jobs.mjs":
/*!*****************************************************************!*\
  !*** ./node_modules/openai/resources/fine-tuning/jobs/jobs.mjs ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FineTuningJobEventsPage: () => (/* binding */ FineTuningJobEventsPage),
/* harmony export */   FineTuningJobsPage: () => (/* binding */ FineTuningJobsPage),
/* harmony export */   Jobs: () => (/* binding */ Jobs)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _checkpoints_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./checkpoints.mjs */ "./node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.





class Jobs extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.checkpoints = new _checkpoints_mjs__WEBPACK_IMPORTED_MODULE_1__.Checkpoints(this._client);
    }
    /**
     * Creates a fine-tuning job which begins the process of creating a new model from
     * a given dataset.
     *
     * Response includes details of the enqueued job including job status and the name
     * of the fine-tuned models once complete.
     *
     * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
     */
    create(body, options) {
        return this._client.post('/fine_tuning/jobs', { body, ...options });
    }
    /**
     * Get info about a fine-tuning job.
     *
     * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
     */
    retrieve(fineTuningJobId, options) {
        return this._client.get(`/fine_tuning/jobs/${fineTuningJobId}`, options);
    }
    list(query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/fine_tuning/jobs', FineTuningJobsPage, { query, ...options });
    }
    /**
     * Immediately cancel a fine-tune job.
     */
    cancel(fineTuningJobId, options) {
        return this._client.post(`/fine_tuning/jobs/${fineTuningJobId}/cancel`, options);
    }
    listEvents(fineTuningJobId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.isRequestOptions)(query)) {
            return this.listEvents(fineTuningJobId, {}, query);
        }
        return this._client.getAPIList(`/fine_tuning/jobs/${fineTuningJobId}/events`, FineTuningJobEventsPage, {
            query,
            ...options,
        });
    }
}
class FineTuningJobsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_3__.CursorPage {
}
class FineTuningJobEventsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_3__.CursorPage {
}
Jobs.FineTuningJobsPage = FineTuningJobsPage;
Jobs.FineTuningJobEventsPage = FineTuningJobEventsPage;
Jobs.Checkpoints = _checkpoints_mjs__WEBPACK_IMPORTED_MODULE_1__.Checkpoints;
Jobs.FineTuningJobCheckpointsPage = _checkpoints_mjs__WEBPACK_IMPORTED_MODULE_1__.FineTuningJobCheckpointsPage;
//# sourceMappingURL=jobs.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/images.mjs":
/*!**************************************************!*\
  !*** ./node_modules/openai/resources/images.mjs ***!
  \**************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Images: () => (/* binding */ Images)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/openai/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Images extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Creates a variation of a given image.
     */
    createVariation(body, options) {
        return this._client.post('/images/variations', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
    /**
     * Creates an edited or extended image given an original image and a prompt.
     */
    edit(body, options) {
        return this._client.post('/images/edits', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
    /**
     * Creates an image given a prompt.
     */
    generate(body, options) {
        return this._client.post('/images/generations', { body, ...options });
    }
}
//# sourceMappingURL=images.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/models.mjs":
/*!**************************************************!*\
  !*** ./node_modules/openai/resources/models.mjs ***!
  \**************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Models: () => (/* binding */ Models),
/* harmony export */   ModelsPage: () => (/* binding */ ModelsPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Models extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Retrieves a model instance, providing basic information about the model such as
     * the owner and permissioning.
     */
    retrieve(model, options) {
        return this._client.get(`/models/${model}`, options);
    }
    /**
     * Lists the currently available models, and provides basic information about each
     * one such as the owner and availability.
     */
    list(options) {
        return this._client.getAPIList('/models', ModelsPage, options);
    }
    /**
     * Delete a fine-tuned model. You must have the Owner role in your organization to
     * delete a model.
     */
    del(model, options) {
        return this._client.delete(`/models/${model}`, options);
    }
}
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */
class ModelsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_1__.Page {
}
Models.ModelsPage = ModelsPage;
//# sourceMappingURL=models.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/moderations.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/openai/resources/moderations.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Moderations: () => (/* binding */ Moderations)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Moderations extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Classifies if text and/or image inputs are potentially harmful. Learn more in
     * the [moderation guide](https://platform.openai.com/docs/guides/moderation).
     */
    create(body, options) {
        return this._client.post('/moderations', { body, ...options });
    }
}
//# sourceMappingURL=moderations.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/uploads/parts.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/openai/resources/uploads/parts.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Parts: () => (/* binding */ Parts)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Parts extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Adds a
     * [Part](https://platform.openai.com/docs/api-reference/uploads/part-object) to an
     * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object.
     * A Part represents a chunk of bytes from the file you are trying to upload.
     *
     * Each Part can be at most 64 MB, and you can add Parts until you hit the Upload
     * maximum of 8 GB.
     *
     * It is possible to add multiple Parts in parallel. You can decide the intended
     * order of the Parts when you
     * [complete the Upload](https://platform.openai.com/docs/api-reference/uploads/complete).
     */
    create(uploadId, body, options) {
        return this._client.post(`/uploads/${uploadId}/parts`, _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
}
//# sourceMappingURL=parts.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/uploads/uploads.mjs":
/*!***********************************************************!*\
  !*** ./node_modules/openai/resources/uploads/uploads.mjs ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Uploads: () => (/* binding */ Uploads)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _parts_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./parts.mjs */ "./node_modules/openai/resources/uploads/parts.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Uploads extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.parts = new _parts_mjs__WEBPACK_IMPORTED_MODULE_1__.Parts(this._client);
    }
    /**
     * Creates an intermediate
     * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object
     * that you can add
     * [Parts](https://platform.openai.com/docs/api-reference/uploads/part-object) to.
     * Currently, an Upload can accept at most 8 GB in total and expires after an hour
     * after you create it.
     *
     * Once you complete the Upload, we will create a
     * [File](https://platform.openai.com/docs/api-reference/files/object) object that
     * contains all the parts you uploaded. This File is usable in the rest of our
     * platform as a regular File object.
     *
     * For certain `purpose`s, the correct `mime_type` must be specified. Please refer
     * to documentation for the supported MIME types for your use case:
     *
     * - [Assistants](https://platform.openai.com/docs/assistants/tools/file-search#supported-files)
     *
     * For guidance on the proper filename extensions for each purpose, please follow
     * the documentation on
     * [creating a File](https://platform.openai.com/docs/api-reference/files/create).
     */
    create(body, options) {
        return this._client.post('/uploads', { body, ...options });
    }
    /**
     * Cancels the Upload. No Parts may be added after an Upload is cancelled.
     */
    cancel(uploadId, options) {
        return this._client.post(`/uploads/${uploadId}/cancel`, options);
    }
    /**
     * Completes the
     * [Upload](https://platform.openai.com/docs/api-reference/uploads/object).
     *
     * Within the returned Upload object, there is a nested
     * [File](https://platform.openai.com/docs/api-reference/files/object) object that
     * is ready to use in the rest of the platform.
     *
     * You can specify the order of the Parts by passing in an ordered list of the Part
     * IDs.
     *
     * The number of bytes uploaded upon completion must match the number of bytes
     * initially specified when creating the Upload object. No Parts may be added after
     * an Upload is completed.
     */
    complete(uploadId, body, options) {
        return this._client.post(`/uploads/${uploadId}/complete`, { body, ...options });
    }
}
Uploads.Parts = _parts_mjs__WEBPACK_IMPORTED_MODULE_1__.Parts;
//# sourceMappingURL=uploads.mjs.map

/***/ }),

/***/ "./node_modules/openai/streaming.mjs":
/*!*******************************************!*\
  !*** ./node_modules/openai/streaming.mjs ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Stream: () => (/* binding */ Stream),
/* harmony export */   _decodeChunks: () => (/* binding */ _decodeChunks),
/* harmony export */   _iterSSEMessages: () => (/* binding */ _iterSSEMessages)
/* harmony export */ });
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/openai/_shims/index.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./internal/decoders/line.mjs */ "./node_modules/openai/internal/decoders/line.mjs");
/* harmony import */ var _internal_stream_utils_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./internal/stream-utils.mjs */ "./node_modules/openai/internal/stream-utils.mjs");





class Stream {
    constructor(iterator, controller) {
        this.iterator = iterator;
        this.controller = controller;
    }
    static fromSSEResponse(response, controller) {
        let consumed = false;
        async function* iterator() {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const sse of _iterSSEMessages(response, controller)) {
                    if (done)
                        continue;
                    if (sse.data.startsWith('[DONE]')) {
                        done = true;
                        continue;
                    }
                    if (sse.event === null) {
                        let data;
                        try {
                            data = JSON.parse(sse.data);
                        }
                        catch (e) {
                            console.error(`Could not parse message into JSON:`, sse.data);
                            console.error(`From chunk:`, sse.raw);
                            throw e;
                        }
                        if (data && data.error) {
                            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError(undefined, data.error, undefined, undefined);
                        }
                        yield data;
                    }
                    else {
                        let data;
                        try {
                            data = JSON.parse(sse.data);
                        }
                        catch (e) {
                            console.error(`Could not parse message into JSON:`, sse.data);
                            console.error(`From chunk:`, sse.raw);
                            throw e;
                        }
                        // TODO: Is this where the error should be thrown?
                        if (sse.event == 'error') {
                            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError(undefined, data.error, data.message, undefined);
                        }
                        yield { event: sse.event, data: data };
                    }
                }
                done = true;
            }
            catch (e) {
                // If the user calls `stream.controller.abort()`, we should exit without throwing.
                if (e instanceof Error && e.name === 'AbortError')
                    return;
                throw e;
            }
            finally {
                // If the user `break`s, abort the ongoing request.
                if (!done)
                    controller.abort();
            }
        }
        return new Stream(iterator, controller);
    }
    /**
     * Generates a Stream from a newline-separated ReadableStream
     * where each item is a JSON value.
     */
    static fromReadableStream(readableStream, controller) {
        let consumed = false;
        async function* iterLines() {
            const lineDecoder = new _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_2__.LineDecoder();
            const iter = (0,_internal_stream_utils_mjs__WEBPACK_IMPORTED_MODULE_3__.ReadableStreamToAsyncIterable)(readableStream);
            for await (const chunk of iter) {
                for (const line of lineDecoder.decode(chunk)) {
                    yield line;
                }
            }
            for (const line of lineDecoder.flush()) {
                yield line;
            }
        }
        async function* iterator() {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const line of iterLines()) {
                    if (done)
                        continue;
                    if (line)
                        yield JSON.parse(line);
                }
                done = true;
            }
            catch (e) {
                // If the user calls `stream.controller.abort()`, we should exit without throwing.
                if (e instanceof Error && e.name === 'AbortError')
                    return;
                throw e;
            }
            finally {
                // If the user `break`s, abort the ongoing request.
                if (!done)
                    controller.abort();
            }
        }
        return new Stream(iterator, controller);
    }
    [Symbol.asyncIterator]() {
        return this.iterator();
    }
    /**
     * Splits the stream into two streams which can be
     * independently read from at different speeds.
     */
    tee() {
        const left = [];
        const right = [];
        const iterator = this.iterator();
        const teeIterator = (queue) => {
            return {
                next: () => {
                    if (queue.length === 0) {
                        const result = iterator.next();
                        left.push(result);
                        right.push(result);
                    }
                    return queue.shift();
                },
            };
        };
        return [
            new Stream(() => teeIterator(left), this.controller),
            new Stream(() => teeIterator(right), this.controller),
        ];
    }
    /**
     * Converts this stream to a newline-separated ReadableStream of
     * JSON stringified values in the stream
     * which can be turned back into a Stream with `Stream.fromReadableStream()`.
     */
    toReadableStream() {
        const self = this;
        let iter;
        const encoder = new TextEncoder();
        return new _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.ReadableStream({
            async start() {
                iter = self[Symbol.asyncIterator]();
            },
            async pull(ctrl) {
                try {
                    const { value, done } = await iter.next();
                    if (done)
                        return ctrl.close();
                    const bytes = encoder.encode(JSON.stringify(value) + '\n');
                    ctrl.enqueue(bytes);
                }
                catch (err) {
                    ctrl.error(err);
                }
            },
            async cancel() {
                await iter.return?.();
            },
        });
    }
}
async function* _iterSSEMessages(response, controller) {
    if (!response.body) {
        controller.abort();
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`Attempted to iterate over a response with no body`);
    }
    const sseDecoder = new SSEDecoder();
    const lineDecoder = new _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_2__.LineDecoder();
    const iter = (0,_internal_stream_utils_mjs__WEBPACK_IMPORTED_MODULE_3__.ReadableStreamToAsyncIterable)(response.body);
    for await (const sseChunk of iterSSEChunks(iter)) {
        for (const line of lineDecoder.decode(sseChunk)) {
            const sse = sseDecoder.decode(line);
            if (sse)
                yield sse;
        }
    }
    for (const line of lineDecoder.flush()) {
        const sse = sseDecoder.decode(line);
        if (sse)
            yield sse;
    }
}
/**
 * Given an async iterable iterator, iterates over it and yields full
 * SSE chunks, i.e. yields when a double new-line is encountered.
 */
async function* iterSSEChunks(iterator) {
    let data = new Uint8Array();
    for await (const chunk of iterator) {
        if (chunk == null) {
            continue;
        }
        const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
            : typeof chunk === 'string' ? new TextEncoder().encode(chunk)
                : chunk;
        let newData = new Uint8Array(data.length + binaryChunk.length);
        newData.set(data);
        newData.set(binaryChunk, data.length);
        data = newData;
        let patternIndex;
        while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
            yield data.slice(0, patternIndex);
            data = data.slice(patternIndex);
        }
    }
    if (data.length > 0) {
        yield data;
    }
}
function findDoubleNewlineIndex(buffer) {
    // This function searches the buffer for the end patterns (\r\r, \n\n, \r\n\r\n)
    // and returns the index right after the first occurrence of any pattern,
    // or -1 if none of the patterns are found.
    const newline = 0x0a; // \n
    const carriage = 0x0d; // \r
    for (let i = 0; i < buffer.length - 2; i++) {
        if (buffer[i] === newline && buffer[i + 1] === newline) {
            // \n\n
            return i + 2;
        }
        if (buffer[i] === carriage && buffer[i + 1] === carriage) {
            // \r\r
            return i + 2;
        }
        if (buffer[i] === carriage &&
            buffer[i + 1] === newline &&
            i + 3 < buffer.length &&
            buffer[i + 2] === carriage &&
            buffer[i + 3] === newline) {
            // \r\n\r\n
            return i + 4;
        }
    }
    return -1;
}
class SSEDecoder {
    constructor() {
        this.event = null;
        this.data = [];
        this.chunks = [];
    }
    decode(line) {
        if (line.endsWith('\r')) {
            line = line.substring(0, line.length - 1);
        }
        if (!line) {
            // empty line and we didn't previously encounter any messages
            if (!this.event && !this.data.length)
                return null;
            const sse = {
                event: this.event,
                data: this.data.join('\n'),
                raw: this.chunks,
            };
            this.event = null;
            this.data = [];
            this.chunks = [];
            return sse;
        }
        this.chunks.push(line);
        if (line.startsWith(':')) {
            return null;
        }
        let [fieldname, _, value] = partition(line, ':');
        if (value.startsWith(' ')) {
            value = value.substring(1);
        }
        if (fieldname === 'event') {
            this.event = value;
        }
        else if (fieldname === 'data') {
            this.data.push(value);
        }
        return null;
    }
}
/** This is an internal helper function that's just used for testing */
function _decodeChunks(chunks, { flush } = { flush: false }) {
    const decoder = new _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_2__.LineDecoder();
    const lines = [];
    for (const chunk of chunks) {
        lines.push(...decoder.decode(chunk));
    }
    if (flush) {
        lines.push(...decoder.flush());
    }
    return lines;
}
function partition(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index !== -1) {
        return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
    }
    return [str, '', ''];
}
//# sourceMappingURL=streaming.mjs.map

/***/ }),

/***/ "./node_modules/openai/uploads.mjs":
/*!*****************************************!*\
  !*** ./node_modules/openai/uploads.mjs ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createForm: () => (/* binding */ createForm),
/* harmony export */   fileFromPath: () => (/* reexport safe */ _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.fileFromPath),
/* harmony export */   isBlobLike: () => (/* binding */ isBlobLike),
/* harmony export */   isFileLike: () => (/* binding */ isFileLike),
/* harmony export */   isMultipartBody: () => (/* binding */ isMultipartBody),
/* harmony export */   isResponseLike: () => (/* binding */ isResponseLike),
/* harmony export */   isUploadable: () => (/* binding */ isUploadable),
/* harmony export */   maybeMultipartFormRequestOptions: () => (/* binding */ maybeMultipartFormRequestOptions),
/* harmony export */   multipartFormRequestOptions: () => (/* binding */ multipartFormRequestOptions),
/* harmony export */   toFile: () => (/* binding */ toFile)
/* harmony export */ });
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/openai/_shims/index.mjs");


const isResponseLike = (value) => value != null &&
    typeof value === 'object' &&
    typeof value.url === 'string' &&
    typeof value.blob === 'function';
const isFileLike = (value) => value != null &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    typeof value.lastModified === 'number' &&
    isBlobLike(value);
/**
 * The BlobLike type omits arrayBuffer() because @types/node-fetch@^2.6.4 lacks it; but this check
 * adds the arrayBuffer() method type because it is available and used at runtime
 */
const isBlobLike = (value) => value != null &&
    typeof value === 'object' &&
    typeof value.size === 'number' &&
    typeof value.type === 'string' &&
    typeof value.text === 'function' &&
    typeof value.slice === 'function' &&
    typeof value.arrayBuffer === 'function';
const isUploadable = (value) => {
    return isFileLike(value) || isResponseLike(value) || (0,_shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.isFsReadStream)(value);
};
/**
 * Helper for creating a {@link File} to pass to an SDK upload method from a variety of different data formats
 * @param value the raw content of the file.  Can be an {@link Uploadable}, {@link BlobLikePart}, or {@link AsyncIterable} of {@link BlobLikePart}s
 * @param {string=} name the name of the file. If omitted, toFile will try to determine a file name from bits if possible
 * @param {Object=} options additional properties
 * @param {string=} options.type the MIME type of the content
 * @param {number=} options.lastModified the last modified timestamp
 * @returns a {@link File} with the given properties
 */
async function toFile(value, name, options) {
    // If it's a promise, resolve it.
    value = await value;
    // If we've been given a `File` we don't need to do anything
    if (isFileLike(value)) {
        return value;
    }
    if (isResponseLike(value)) {
        const blob = await value.blob();
        name || (name = new URL(value.url).pathname.split(/[\\/]/).pop() ?? 'unknown_file');
        // we need to convert the `Blob` into an array buffer because the `Blob` class
        // that `node-fetch` defines is incompatible with the web standard which results
        // in `new File` interpreting it as a string instead of binary data.
        const data = isBlobLike(blob) ? [(await blob.arrayBuffer())] : [blob];
        return new _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.File(data, name, options);
    }
    const bits = await getBytes(value);
    name || (name = getName(value) ?? 'unknown_file');
    if (!options?.type) {
        const type = bits[0]?.type;
        if (typeof type === 'string') {
            options = { ...options, type };
        }
    }
    return new _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.File(bits, name, options);
}
async function getBytes(value) {
    let parts = [];
    if (typeof value === 'string' ||
        ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
        value instanceof ArrayBuffer) {
        parts.push(value);
    }
    else if (isBlobLike(value)) {
        parts.push(await value.arrayBuffer());
    }
    else if (isAsyncIterableIterator(value) // includes Readable, ReadableStream, etc.
    ) {
        for await (const chunk of value) {
            parts.push(chunk); // TODO, consider validating?
        }
    }
    else {
        throw new Error(`Unexpected data type: ${typeof value}; constructor: ${value?.constructor
            ?.name}; props: ${propsForError(value)}`);
    }
    return parts;
}
function propsForError(value) {
    const props = Object.getOwnPropertyNames(value);
    return `[${props.map((p) => `"${p}"`).join(', ')}]`;
}
function getName(value) {
    return (getStringFromMaybeBuffer(value.name) ||
        getStringFromMaybeBuffer(value.filename) ||
        // For fs.ReadStream
        getStringFromMaybeBuffer(value.path)?.split(/[\\/]/).pop());
}
const getStringFromMaybeBuffer = (x) => {
    if (typeof x === 'string')
        return x;
    if (typeof Buffer !== 'undefined' && x instanceof Buffer)
        return String(x);
    return undefined;
};
const isAsyncIterableIterator = (value) => value != null && typeof value === 'object' && typeof value[Symbol.asyncIterator] === 'function';
const isMultipartBody = (body) => body && typeof body === 'object' && body.body && body[Symbol.toStringTag] === 'MultipartBody';
/**
 * Returns a multipart/form-data request if any part of the given request body contains a File / Blob value.
 * Otherwise returns the request as is.
 */
const maybeMultipartFormRequestOptions = async (opts) => {
    if (!hasUploadableValue(opts.body))
        return opts;
    const form = await createForm(opts.body);
    return (0,_shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.getMultipartRequestOptions)(form, opts);
};
const multipartFormRequestOptions = async (opts) => {
    const form = await createForm(opts.body);
    return (0,_shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.getMultipartRequestOptions)(form, opts);
};
const createForm = async (body) => {
    const form = new _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.FormData();
    await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
    return form;
};
const hasUploadableValue = (value) => {
    if (isUploadable(value))
        return true;
    if (Array.isArray(value))
        return value.some(hasUploadableValue);
    if (value && typeof value === 'object') {
        for (const k in value) {
            if (hasUploadableValue(value[k]))
                return true;
        }
    }
    return false;
};
const addFormValue = async (form, key, value) => {
    if (value === undefined)
        return;
    if (value == null) {
        throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
    }
    // TODO: make nested formats configurable
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        form.append(key, String(value));
    }
    else if (isUploadable(value)) {
        const file = await toFile(value);
        form.append(key, file);
    }
    else if (Array.isArray(value)) {
        await Promise.all(value.map((entry) => addFormValue(form, key + '[]', entry)));
    }
    else if (typeof value === 'object') {
        await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)));
    }
    else {
        throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
    }
};
//# sourceMappingURL=uploads.mjs.map

/***/ }),

/***/ "./node_modules/openai/version.mjs":
/*!*****************************************!*\
  !*** ./node_modules/openai/version.mjs ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VERSION: () => (/* binding */ VERSION)
/* harmony export */ });
const VERSION = '4.85.1'; // x-release-please-version
//# sourceMappingURL=version.mjs.map

/***/ }),

/***/ "./src/llm.ts":
/*!********************!*\
  !*** ./src/llm.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleLLMRequest: () => (/* binding */ handleLLMRequest)
/* harmony export */ });
/* harmony import */ var openai__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! openai */ "./node_modules/openai/index.mjs");


// 初始化 OpenAI 客户端
const openai = new openai__WEBPACK_IMPORTED_MODULE_0__["default"]({
  apiKey: "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",
  baseURL: "https://integrate.api.nvidia.com/v1",
  dangerouslyAllowBrowser: true
});

// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
async function handleLLMRequest(body) {
  const handler =  true ? handleOllamaRequest : 0;
  const response = await handler(body);
  const jsonData = extractJsonFromResponse(response);
  return [response, jsonData];
}

// 处理 Ollama 请求。Ollama 安装后需要把 launchctl setenv OLLAMA_ORIGINS "*" 加入到 .bashrc 中
async function handleOllamaRequest(body) {
  const response = await fetch(`${"http://localhost:11434"}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "deepseek-r1",
      prompt: body.prompt,
      stream: false,
      temperature: 0.3,
      top_p: 0.9
    })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  return result.response;
}

// 处理 OpenAI 请求
async function handleOpenAIRequest(body) {
  const completion = await openai.chat.completions.create({
    model: "deepseek-ai/deepseek-r1",
    messages: [{
      role: "user",
      content: body.prompt
    }],
    temperature: 0.3,
    top_p: 0.9
  });
  return completion.choices[0].message.content || '';
}

// 新增：从响应文本中提取 JSON 数据
function extractJsonFromResponse(response) {
  let jsonData = [];
  try {
    // 首先尝试直接解析整个响应
    try {
      const directParse = JSON.parse(response.trim());
      return Array.isArray(directParse) ? directParse : [directParse];
    } catch (e) {
      // 如果直接解析失败，继续尝试其他方法
    }

    // 尝试从响应中查找 JSON 代码块
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[1].trim());
      jsonData = Array.isArray(parsedData) ? parsedData : [parsedData];
    } else {
      // 尝试查找可能的 JSON 字符串（方括号或大括号开头和结尾）
      const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/;
      const potentialJson = response.match(jsonRegex);
      if (potentialJson) {
        const parsedData = JSON.parse(potentialJson[1].trim());
        jsonData = Array.isArray(parsedData) ? parsedData : [parsedData];
      }
    }
  } catch (e) {
    console.warn('Failed to parse JSON from LLM response:', e);
  }
  return jsonData;
}

/***/ }),

/***/ "./src/messageDealing.ts":
/*!*******************************!*\
  !*** ./src/messageDealing.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   analyzeMessages: () => (/* binding */ analyzeMessages),
/* harmony export */   reviewMessageByLLMAndSendToBot: () => (/* binding */ reviewMessageByLLMAndSendToBot)
/* harmony export */ });
/* harmony import */ var _llm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./llm */ "./src/llm.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/utils.ts");



// 整理所有消息，发送给 LLM 分析，然后推送给 bot
async function analyzeMessages(data, config) {
  const {
    username
  } = config;
  // Todo: 从 bckgournd->storage 传参 中获取 concernedItems
  const concernedItems = (await chrome.storage.local.get('concernedItems')).concernedItems || [{
    text: 'recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况（关键词：recording/RCV mobile/BE dependencies，必须同时包含"recording"和"BE"相关关键词）'
  }, {
    text: '聊到关于公司政策，也可以是政策相关的八卦消息'
  }, {
    text: 'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）'
  }, {
    text: '任何明确 @我 的消息，或者提到我的名字的消息'
  }];
  console.log(data, concernedItems, await chrome.storage.local.get('concernedItems'));
  // 插入调试数据
  // data.unshift({
  //   groupName: 'Recording Test',
  //   groupId: '123',
  //   posts: [
  //     { creator: 'Sophia (Jinmei) Lin', time: '2025-02-13 00:00:00', text: 'Recording project BE dependencies completed' }
  //   ]
  // });
  // data.unshift({
  //   groupName: '大群',
  //   groupId: '2578219014',
  //   posts: [
  //     { creator: 'Colin Liu', time: '2025-02-14 00:00:00', text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。' }
  //   ]
  // });
  // data.splice(2);
  // console.log(data);

  if (true) {
    // 拆分单条发送 LLM
    chrome.storage.local.set({
      ollamaAnalysisProgress: {
        total: data.length,
        lastAnalyzedIndex: 0,
        lastAnalyzedTime: new Date().toISOString()
      }
    });
    data.forEach(async (item, index) => await setTimeout(async () => {
      console.log(`--开始分析第 ${index + 1}/${data.length} 条消息--`);
      const message = `<message_group team_name="${item.groupName}" team_id="${item.groupId}">${item.posts.map(post => `
            <message_content sender="${post.creator}" datetime="${post.time}">${post.text}</message_content>`).join('')}
        </message_group>`;
      const prompt = `
        我的名字是：${username} （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

        ---- 这是我收到的最近聊条消息开始 ----
        ${message}
        ---- 这是我收到的最近聊条消息结束 ----

        ---- 以下是我的需求和你需要返回的内容定义 ----
        你是一个很细心的项目经理，请仔细阅读并认真分析以上消息，执行以下三步的任务：
        1. 请仔细阅读 message_group 里的每条聊天消息，判断里面的 message_content 是否有符合以下规则其中一条：
            ${concernedItems.map((item, i) => `- 规则${i + 1}: ${item.text}`).join('\n          ')}
        2. 对 message_group 中有符合规则的消息，请提取以下字段（只提取原文，即便文字很多，不做删减不做修改不做翻译，并保留原有格式）：
            - message_content消息原文及其对应发送者sender和发送时间datetime, 还有message_group中的 team_name, team_id, 以及符合的规则x
        3. 对 message_group 中刚有符合规则的消息，每条生成对应的这 4 个新字段：
            - matched_rule: 上面第一步的符合到的规则x的原文内容
            - filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
            - summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文
            - reply_advice: 针对这条消息的上下文，给出回复建议，回复用的语言跟随上下文聊天语言。如果觉得这条消息不需要回复，请回复空字符串

        将任务输出的数据进行如下验证：
        1. 以严格JSON格式输出，仅包含匹配的消息。如果没有匹配任何规则，输出空[]数组：
            [{
            "message_content": "{message_content}",
            "sender": "{sender}",
            "matched_rule": "所符合的规则的内容",
            "filter_reason": "",
            "team_name": "{team_name}",
            "team_id": "{team_id}",
            "team_url": "https://app.ringcentral.com/messages/{team_id}",
            "summary": "请总结上下文到这里",
            "reply_advice": "建议的回复填入此",
            "datetime": "{datetime}",
            }]
        2. 再次检查下即将输出的内容，是否有重复记录，如果发现重复记录（message_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
        `;
      await sendMessageToLLM(prompt);
      chrome.storage.local.set({
        ollamaAnalysisProgress: {
          total: data.length,
          lastAnalyzedIndex: index + 1,
          lastAnalyzedTime: new Date().toISOString()
        }
      });
    }, 3 * 60 * 1000 * index + 1));
  } else {}
}
const sendMessageToLLM = async prompt => {
  console.log('Sending prompt to Ollama:', prompt);
  try {
    // 检查是否在 background script 环境中
    const isBackground = typeof window === 'undefined';
    if (isBackground) {
      // 在 background script 中直接调用处理函数
      const response = await reviewMessageByLLMAndSendToBot({
        prompt
      });
      return response;
    } else {
      // 在 content script 或其他环境中使用 message passing
      const response = await chrome.runtime.sendMessage({
        type: 'LLM_REQUEST',
        data: {
          body: {
            prompt: prompt
          }
        }
      });
      if (response.data) {
        console.log("LLM's response:", response.data);
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.showToast)('Analysis complete, please check the console', 'success');
        return response.data;
      } else {
        const error = new Error('Received invalid response format from LLM');
        console.error("Unexpected response format:", response);
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__.showToast)(error.message, 'error');
        throw error;
      }
    }
  } catch (error) {
    console.error("Error in sendMessageToLLM:", error);
    (0,_utils__WEBPACK_IMPORTED_MODULE_1__.showToast)(`Error: ${error.message}`, 'error');
  }
};

// 整合处理请求以及推送 bot 消息
async function reviewMessageByLLMAndSendToBot(body) {
  try {
    const {
      concernedItems
    } = await chrome.storage.local.get('concernedItems');
    const [raw, jsonArray] = await (0,_llm__WEBPACK_IMPORTED_MODULE_0__.handleLLMRequest)(body);
    console.log('LLM response:', raw);
    console.log('LLM jsonArray:', jsonArray);
    if (jsonArray && jsonArray.length > 0) {
      jsonArray.forEach(async json => {
        let matched_rule = json.matched_rule;
        if (true) {
          // 先进行 LLM 审核
          const reviewPrompt = `消息内容：${json.message_content}
                    请审核以上消息是否符合这些过滤规则中的任意一条：
                    ${concernedItems.map((item, i) => `- 规则${i + 1}: ${item.text}`).join('\n                    ')}

                    如果符合规则，请直接返回符合的规则原文，不要包含其他内容。如果不符合任何规则，请返回"不通过"。
                  `;
          console.log('reviewPrompt', reviewPrompt);
          const [reviewResponseRaw] = await (0,_llm__WEBPACK_IMPORTED_MODULE_0__.handleLLMRequest)({
            prompt: reviewPrompt
          });
          console.log('reviewResponseRaw', reviewResponseRaw);
          const reviewResponse = reviewResponseRaw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          if (reviewResponse.includes('不通过')) {
            return; // 审核不通过直接跳过
          }
          matched_rule = reviewResponse.length < 100 ? reviewResponse : matched_rule;
        }
        sendBotMessage({
          matched_rule,
          team_name: json.team_name,
          team_id: json.team_id,
          sender: json.sender,
          message_content: json.message_content,
          summary: json.summary,
          reply_advice: json.reply_advice
        }).catch(console.error);
      });
    }
    return raw;
  } catch (error) {
    console.error('LLM error:', error);
    return {
      error: error.message,
      details: `Failed to connect to ${"local"} service`
    };
  }
}

/***/ }),

/***/ "./src/utils.ts":
/*!**********************!*\
  !*** ./src/utils.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   formatDate: () => (/* binding */ formatDate),
/* harmony export */   showToast: () => (/* binding */ showToast),
/* harmony export */   transformGroupLinks: () => (/* binding */ transformGroupLinks),
/* harmony export */   transformPostLinks: () => (/* binding */ transformPostLinks),
/* harmony export */   uniqBy: () => (/* binding */ uniqBy)
/* harmony export */ });
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function uniqBy(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const keyValue = item[key];
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
}
function showToast(message, type, onClose) {
  // 获取或创建容器元素
  const container = document.getElementById('radar-poc-result');

  // 移除现有的 Toast 元素
  const existingToast = container.querySelector('.radar-poc-toast');
  if (existingToast) {
    container.removeChild(existingToast);
  }

  // 创建新的 Toast 元素
  const toast = document.createElement('div');
  toast.className = `radar-poc-toast radar-poc-toast-${type}`;
  const toastInner = document.createElement('div');
  toastInner.className = 'radar-poc-toast-inner';
  toastInner.textContent = message;
  toast.appendChild(toastInner);
  container.appendChild(toast);

  // 设置定时器在 3 秒后关闭 Toast
  const timer = setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  }, 3000);

  // 返回一个函数以便手动关闭 Toast
  return () => {
    clearTimeout(timer);
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  };
}
function transformGroupLinks(inputString) {
  const groupLinkPattern = /\[group:(.+):(\d+)\]/g;
  const transformedString = inputString.replace(groupLinkPattern, (match, groupName, groupId) => {
    return `[${groupName}](/messages/${groupId})`;
  });
  return transformedString;
}
function transformPostLinks(inputString) {
  const postLinkPattern = /\[post:(\d+)\]/g;
  let index = 1;
  const transformedString = inputString.replace(postLinkPattern, (match, postId) => {
    return `[[${index++}]](/l${window.location.pathname}/${postId})`;
  });
  return transformedString;
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***************************!*\
  !*** ./src/background.ts ***!
  \***************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createRingCentralTab: () => (/* binding */ createRingCentralTab),
/* harmony export */   findRingCentralTab: () => (/* binding */ findRingCentralTab),
/* harmony export */   startScheduledCheck: () => (/* binding */ startScheduledCheck),
/* harmony export */   stopScheduledCheck: () => (/* binding */ stopScheduledCheck),
/* harmony export */   waitForTabLoad: () => (/* binding */ waitForTabLoad)
/* harmony export */ });
/* harmony import */ var _messageDealing__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./messageDealing */ "./src/messageDealing.ts");

const scheduledInterval = 120; // 每2小时执行一次

console.log('Background script loaded');

// 扩展安装或更新时，立即创建定时任务
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');

  // 初始化配置
  chrome.storage.local.remove('scheduleActive');
  chrome.storage.local.remove('ollamaAnalysisProgress');

  // 获取并清理过期的 concernedItems
  const storage = await chrome.storage.local.get('concernedItems');
  if (storage.concernedItems) {
    // 过滤掉过期的项目
    const validItems = storage.concernedItems.filter(item => {
      return !item.expiredAt || new Date(item.expiredAt) > new Date();
    });

    // 如果有项目被过滤掉，更新存储
    if (validItems.length !== storage.concernedItems.length) {
      await chrome.storage.local.set({
        concernedItems: validItems
      });
    }
  }

  // 如果没有 concernedItems 或已清空，设置默认值
  if (!storage.concernedItems || storage.concernedItems.length === 0) {
    chrome.storage.local.set({
      concernedItems: [{
        text: '聊到关于公司政策，也可以是政策相关的八卦消息'
      }, {
        text: '任何明确 @我 的消息，或者提到我的名字的消息'
      }]
    });
  }

  // 查找并刷新 RingCentral 标签页
  try {
    const rcTab = await findRingCentralTab();
    if (rcTab && rcTab.id) {
      await chrome.tabs.reload(rcTab.id);
      console.log('RingCentral tab refreshed');

      // 延迟获取 RC Radar 配置
      chrome.storage.local.set({
        config: (await getConfigFromWebpage()) || {
          selectGroupNames: "",
          enableMessage: true,
          enableSms: false,
          enableVoicemail: false,
          enableCallTranscript: false,
          enableCalendar: false,
          enableCandidateQuestions: false,
          selectFolderGroupIds: "",
          username: "",
          extensionId: "",
          apiKey: "",
          model: "4o"
        }
      });
    }
  } catch (error) {
    console.error('Failed to refresh RingCentral tab:', error);
  }
});

// 监听定时任务
chrome.alarms.onAlarm.addListener(alarm => {
  console.log('alarm', alarm);
  if (alarm.name === 'checkMessages') {
    console.log('Running scheduled message check...');
    runScheduledTask();
  }
});

// 原来的监听器简化为：
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('Background received message:', request);

  // 如果不是 background 定时程序，会从页面发送请求到这里执行
  if (request.type === 'LLM_REQUEST') {
    const {
      body
    } = request.data;
    console.log('Sending request to LLM:', body);
    const raw = await (0,_messageDealing__WEBPACK_IMPORTED_MODULE_0__.reviewMessageByLLMAndSendToBot)(body);
    sendResponse({
      data: raw
    });
    return true;
  }
  if (request.type === 'CONTROL_SCHEDULED_CHECK') {
    if (request.action === 'start') {
      startScheduledCheck();
      sendResponse({
        status: 'started'
      });
    } else if (request.action === 'stop') {
      stopScheduledCheck();
      sendResponse({
        status: 'stopped'
      });
    }
    return true;
  }
});

// 启动定时任务
let timerFirstRunAlarms = null;
function startScheduledCheck() {
  timerFirstRunAlarms = setTimeout(() => {
    runScheduledTask(); // 立即执行一次
  }, 10000);
  chrome.alarms.create('checkMessages', {
    periodInMinutes: scheduledInterval
  });
  chrome.storage.local.set({
    scheduleActive: true
  });
  console.log('Scheduled message check started');
}

// 停止定时任务
function stopScheduledCheck() {
  clearTimeout(timerFirstRunAlarms);
  chrome.alarms.clear('checkMessages');
  chrome.storage.local.set({
    scheduleActive: false
  });
  console.log('Scheduled message check stopped');
}

// 定时抓取分析消息
async function runScheduledTask() {
  try {
    // 查找或创建 RingCentral 标签页
    let rcTab = await findRingCentralTab();
    if (!rcTab) {
      rcTab = await createRingCentralTab();
      // 等待页面加载完成
      await waitForTabLoad(rcTab.id);
    }
    let {
      config
    } = await chrome.storage.local.get(['config']);
    if (!config) config = await getConfigFromWebpage();
    const startTime = new Date(Date.now() - (scheduledInterval + 5) * 60 * 1000);

    // 尝试发送消息，如果失败则重试
    const response = await sendMessageWithRetry(rcTab.id, {
      type: 'FETCH_USER_DATA',
      startTime,
      config
    });
    await (0,_messageDealing__WEBPACK_IMPORTED_MODULE_0__.analyzeMessages)(response.data, config);
  } catch (error) {
    console.error('Background task error:', error);
  }
}

// 查找已打开的 RingCentral 标签页
async function findRingCentralTab() {
  const tabs = await chrome.tabs.query({
    url: "*://app.ringcentral.com/*"
  });
  return tabs[0];
}

// 创建新的 RingCentral 标签页
async function createRingCentralTab() {
  return await chrome.tabs.create({
    url: "https://app.ringcentral.com/video",
    active: false
  });
}

// 等待标签页加载完成
function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // 给页面一些额外时间来初始化 content script
        setTimeout(resolve, 1000);
      }
    });
  });
}

// 带重试机制的消息发送函数
function sendMessageWithRetry(tabId, message) {
  let maxRetries = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 3;
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const trySendMessage = () => {
      attempts++;
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          console.log(`Attempt ${attempts} failed:`, chrome.runtime.lastError);
          if (attempts < maxRetries) {
            setTimeout(trySendMessage, 5000); // 5秒后重试
          } else {
            reject(new Error('Failed to send message after multiple attempts'));
          }
        } else {
          if (response && !response.error) {
            resolve(response);
          } else {
            reject(new Error('Failed to fetch user data: ' + response?.error));
          }
        }
      });
    };
    trySendMessage();
  });
}
async function getConfigFromWebpage() {
  let rcTab = await findRingCentralTab();
  if (!rcTab) {
    rcTab = await createRingCentralTab();
    // 等待页面加载完成
    await waitForTabLoad(rcTab.id);
  }
  try {
    const response = await sendMessageWithRetry(rcTab.id, {
      type: 'GET_CONFIG'
    });
    return response.config;
  } catch (error) {
    console.error('Failed to get config:', error);
    return null;
  }
}
})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBLGtCQUFrQixtREFBVztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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SyxFQUFFO0lBQ1JBLEtBQUssR0FBRyxNQUFNOEIsb0JBQW9CLENBQUMsQ0FBQztJQUNwQztJQUNBLE1BQU1DLGNBQWMsQ0FBQy9CLEtBQUssQ0FBQ0UsRUFBRSxDQUFDO0VBQ2xDO0VBRUEsSUFBSTtJQUNBLE1BQU1uSyxRQUFRLEdBQUcsTUFBTW1NLG9CQUFvQixDQUFDbEMsS0FBSyxDQUFDRSxFQUFFLEVBQUU7TUFDbEQvRSxJQUFJLEVBQUU7SUFDVixDQUFDLENBQUM7SUFDRixPQUFPcEYsUUFBUSxDQUFDOEMsTUFBTTtFQUMxQixDQUFDLENBQUMsT0FBT3VDLEtBQUssRUFBRTtJQUNaNUMsT0FBTyxDQUFDNEMsS0FBSyxDQUFDLHVCQUF1QixFQUFFQSxLQUFLLENBQUM7SUFDN0MsT0FBTyxJQUFJO0VBQ2Y7QUFDSixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9fc2hpbXMvTXVsdGlwYXJ0Qm9keS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9fc2hpbXMvaW5kZXgubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvX3NoaW1zL3JlZ2lzdHJ5Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL19zaGltcy93ZWItcnVudGltZS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9fdmVuZG9yL3BhcnRpYWwtanNvbi1wYXJzZXIvcGFyc2VyLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2NvcmUubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvZXJyb3IubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvaW5kZXgubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvaW50ZXJuYWwvZGVjb2RlcnMvbGluZS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9pbnRlcm5hbC9xcy9mb3JtYXRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2ludGVybmFsL3FzL3N0cmluZ2lmeS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9pbnRlcm5hbC9xcy91dGlscy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9pbnRlcm5hbC9zdHJlYW0tdXRpbHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL0Fzc2lzdGFudFN0cmVhbS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvQ2hhdENvbXBsZXRpb25SdW5uZXIubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL0NoYXRDb21wbGV0aW9uU3RyZWFtLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9DaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lci5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvRXZlbnRTdHJlYW0ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL1J1bm5hYmxlRnVuY3Rpb24ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL1V0aWwubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL2NoYXRDb21wbGV0aW9uVXRpbHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL3BhcnNlci5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9wYWdpbmF0aW9uLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9hdWRpby9hdWRpby5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYXVkaW8vc3BlZWNoLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9hdWRpby90cmFuc2NyaXB0aW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYXVkaW8vdHJhbnNsYXRpb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iYXRjaGVzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL2Fzc2lzdGFudHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvYmV0YS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS9jaGF0L2NoYXQubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvY2hhdC9jb21wbGV0aW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS9yZWFsdGltZS9yZWFsdGltZS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS9yZWFsdGltZS9zZXNzaW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS90aHJlYWRzL21lc3NhZ2VzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3RocmVhZHMvcnVucy9ydW5zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3RocmVhZHMvcnVucy9zdGVwcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS90aHJlYWRzL3RocmVhZHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdmVjdG9yLXN0b3Jlcy9maWxlLWJhdGNoZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdmVjdG9yLXN0b3Jlcy9maWxlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS92ZWN0b3Itc3RvcmVzL3ZlY3Rvci1zdG9yZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2NoYXQvY2hhdC5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvY2hhdC9jb21wbGV0aW9ucy9jb21wbGV0aW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvY2hhdC9jb21wbGV0aW9ucy9tZXNzYWdlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvY29tcGxldGlvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2VtYmVkZGluZ3MubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2ZpbGVzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9maW5lLXR1bmluZy9maW5lLXR1bmluZy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvZmluZS10dW5pbmcvam9icy9jaGVja3BvaW50cy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvZmluZS10dW5pbmcvam9icy9qb2JzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9pbWFnZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL21vZGVscy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvbW9kZXJhdGlvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL3VwbG9hZHMvcGFydHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL3VwbG9hZHMvdXBsb2Fkcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9zdHJlYW1pbmcubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvdXBsb2Fkcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS92ZXJzaW9uLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9zcmMvbGxtLnRzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL3NyYy9tZXNzYWdlRGVhbGluZy50cyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9zcmMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vc3JjL2JhY2tncm91bmQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEaXNjbGFpbWVyOiBtb2R1bGVzIGluIF9zaGltcyBhcmVuJ3QgaW50ZW5kZWQgdG8gYmUgaW1wb3J0ZWQgYnkgU0RLIHVzZXJzLlxuICovXG5leHBvcnQgY2xhc3MgTXVsdGlwYXJ0Qm9keSB7XG4gICAgY29uc3RydWN0b3IoYm9keSkge1xuICAgICAgICB0aGlzLmJvZHkgPSBib2R5O1xuICAgIH1cbiAgICBnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7XG4gICAgICAgIHJldHVybiAnTXVsdGlwYXJ0Qm9keSc7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9TXVsdGlwYXJ0Qm9keS5tanMubWFwIiwiLyoqXG4gKiBEaXNjbGFpbWVyOiBtb2R1bGVzIGluIF9zaGltcyBhcmVuJ3QgaW50ZW5kZWQgdG8gYmUgaW1wb3J0ZWQgYnkgU0RLIHVzZXJzLlxuICovXG5pbXBvcnQgKiBhcyBzaGltcyBmcm9tICcuL3JlZ2lzdHJ5Lm1qcyc7XG5pbXBvcnQgKiBhcyBhdXRvIGZyb20gJ29wZW5haS9fc2hpbXMvYXV0by9ydW50aW1lJztcbmlmICghc2hpbXMua2luZCkgc2hpbXMuc2V0U2hpbXMoYXV0by5nZXRSdW50aW1lKCksIHsgYXV0bzogdHJ1ZSB9KTtcbmV4cG9ydCAqIGZyb20gJy4vcmVnaXN0cnkubWpzJztcbiIsImV4cG9ydCBsZXQgYXV0byA9IGZhbHNlO1xuZXhwb3J0IGxldCBraW5kID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBmZXRjaCA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgUmVxdWVzdCA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgUmVzcG9uc2UgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IEhlYWRlcnMgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IEZvcm1EYXRhID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBCbG9iID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBGaWxlID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBSZWFkYWJsZVN0cmVhbSA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnMgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IGdldERlZmF1bHRBZ2VudCA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgZmlsZUZyb21QYXRoID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBpc0ZzUmVhZFN0cmVhbSA9IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiBzZXRTaGltcyhzaGltcywgb3B0aW9ucyA9IHsgYXV0bzogZmFsc2UgfSkge1xuICAgIGlmIChhdXRvKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgeW91IG11c3QgXFxgaW1wb3J0ICdvcGVuYWkvc2hpbXMvJHtzaGltcy5raW5kfSdcXGAgYmVmb3JlIGltcG9ydGluZyBhbnl0aGluZyBlbHNlIGZyb20gb3BlbmFpYCk7XG4gICAgfVxuICAgIGlmIChraW5kKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgY2FuJ3QgXFxgaW1wb3J0ICdvcGVuYWkvc2hpbXMvJHtzaGltcy5raW5kfSdcXGAgYWZ0ZXIgXFxgaW1wb3J0ICdvcGVuYWkvc2hpbXMvJHtraW5kfSdcXGBgKTtcbiAgICB9XG4gICAgYXV0byA9IG9wdGlvbnMuYXV0bztcbiAgICBraW5kID0gc2hpbXMua2luZDtcbiAgICBmZXRjaCA9IHNoaW1zLmZldGNoO1xuICAgIFJlcXVlc3QgPSBzaGltcy5SZXF1ZXN0O1xuICAgIFJlc3BvbnNlID0gc2hpbXMuUmVzcG9uc2U7XG4gICAgSGVhZGVycyA9IHNoaW1zLkhlYWRlcnM7XG4gICAgRm9ybURhdGEgPSBzaGltcy5Gb3JtRGF0YTtcbiAgICBCbG9iID0gc2hpbXMuQmxvYjtcbiAgICBGaWxlID0gc2hpbXMuRmlsZTtcbiAgICBSZWFkYWJsZVN0cmVhbSA9IHNoaW1zLlJlYWRhYmxlU3RyZWFtO1xuICAgIGdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zID0gc2hpbXMuZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnM7XG4gICAgZ2V0RGVmYXVsdEFnZW50ID0gc2hpbXMuZ2V0RGVmYXVsdEFnZW50O1xuICAgIGZpbGVGcm9tUGF0aCA9IHNoaW1zLmZpbGVGcm9tUGF0aDtcbiAgICBpc0ZzUmVhZFN0cmVhbSA9IHNoaW1zLmlzRnNSZWFkU3RyZWFtO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmVnaXN0cnkubWpzLm1hcCIsImltcG9ydCB7IE11bHRpcGFydEJvZHkgfSBmcm9tIFwiLi9NdWx0aXBhcnRCb2R5Lm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGdldFJ1bnRpbWUoeyBtYW51YWxseUltcG9ydGVkIH0gPSB7fSkge1xuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9uID0gbWFudWFsbHlJbXBvcnRlZCA/XG4gICAgICAgIGBZb3UgbWF5IG5lZWQgdG8gdXNlIHBvbHlmaWxsc2BcbiAgICAgICAgOiBgQWRkIG9uZSBvZiB0aGVzZSBpbXBvcnRzIGJlZm9yZSB5b3VyIGZpcnN0IFxcYGltcG9ydCDigKYgZnJvbSAnb3BlbmFpJ1xcYDpcbi0gXFxgaW1wb3J0ICdvcGVuYWkvc2hpbXMvbm9kZSdcXGAgKGlmIHlvdSdyZSBydW5uaW5nIG9uIE5vZGUpXG4tIFxcYGltcG9ydCAnb3BlbmFpL3NoaW1zL3dlYidcXGAgKG90aGVyd2lzZSlcbmA7XG4gICAgbGV0IF9mZXRjaCwgX1JlcXVlc3QsIF9SZXNwb25zZSwgX0hlYWRlcnM7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBfZmV0Y2ggPSBmZXRjaDtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBfUmVxdWVzdCA9IFJlcXVlc3Q7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgX1Jlc3BvbnNlID0gUmVzcG9uc2U7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgX0hlYWRlcnMgPSBIZWFkZXJzO1xuICAgIH1cbiAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGVudmlyb25tZW50IGlzIG1pc3NpbmcgdGhlIGZvbGxvd2luZyBXZWIgRmV0Y2ggQVBJIHR5cGU6ICR7ZXJyb3IubWVzc2FnZX0uICR7cmVjb21tZW5kYXRpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6ICd3ZWInLFxuICAgICAgICBmZXRjaDogX2ZldGNoLFxuICAgICAgICBSZXF1ZXN0OiBfUmVxdWVzdCxcbiAgICAgICAgUmVzcG9uc2U6IF9SZXNwb25zZSxcbiAgICAgICAgSGVhZGVyczogX0hlYWRlcnMsXG4gICAgICAgIEZvcm1EYXRhOiBcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICB0eXBlb2YgRm9ybURhdGEgIT09ICd1bmRlZmluZWQnID8gRm9ybURhdGEgOiAoY2xhc3MgRm9ybURhdGEge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmaWxlIHVwbG9hZHMgYXJlbid0IHN1cHBvcnRlZCBpbiB0aGlzIGVudmlyb25tZW50IHlldCBhcyAnRm9ybURhdGEnIGlzIHVuZGVmaW5lZC4gJHtyZWNvbW1lbmRhdGlvbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIEJsb2I6IHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJyA/IEJsb2IgOiAoY2xhc3MgQmxvYiB7XG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZpbGUgdXBsb2FkcyBhcmVuJ3Qgc3VwcG9ydGVkIGluIHRoaXMgZW52aXJvbm1lbnQgeWV0IGFzICdCbG9iJyBpcyB1bmRlZmluZWQuICR7cmVjb21tZW5kYXRpb259YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBGaWxlOiBcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICB0eXBlb2YgRmlsZSAhPT0gJ3VuZGVmaW5lZCcgPyBGaWxlIDogKGNsYXNzIEZpbGUge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmaWxlIHVwbG9hZHMgYXJlbid0IHN1cHBvcnRlZCBpbiB0aGlzIGVudmlyb25tZW50IHlldCBhcyAnRmlsZScgaXMgdW5kZWZpbmVkLiAke3JlY29tbWVuZGF0aW9ufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgUmVhZGFibGVTdHJlYW06IFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHR5cGVvZiBSZWFkYWJsZVN0cmVhbSAhPT0gJ3VuZGVmaW5lZCcgPyBSZWFkYWJsZVN0cmVhbSA6IChjbGFzcyBSZWFkYWJsZVN0cmVhbSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHN0cmVhbWluZyBpc24ndCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudCB5ZXQgYXMgJ1JlYWRhYmxlU3RyZWFtJyBpcyB1bmRlZmluZWQuICR7cmVjb21tZW5kYXRpb259YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBnZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9uczogYXN5bmMgKFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGZvcm0sIG9wdHMpID0+ICh7XG4gICAgICAgICAgICAuLi5vcHRzLFxuICAgICAgICAgICAgYm9keTogbmV3IE11bHRpcGFydEJvZHkoZm9ybSksXG4gICAgICAgIH0pLFxuICAgICAgICBnZXREZWZhdWx0QWdlbnQ6ICh1cmwpID0+IHVuZGVmaW5lZCxcbiAgICAgICAgZmlsZUZyb21QYXRoOiAoKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBgZmlsZUZyb21QYXRoYCBmdW5jdGlvbiBpcyBvbmx5IHN1cHBvcnRlZCBpbiBOb2RlLiBTZWUgdGhlIFJFQURNRSBmb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL3d3dy5naXRodWIuY29tL29wZW5haS9vcGVuYWktbm9kZSNmaWxlLXVwbG9hZHMnKTtcbiAgICAgICAgfSxcbiAgICAgICAgaXNGc1JlYWRTdHJlYW06ICh2YWx1ZSkgPT4gZmFsc2UsXG4gICAgfTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXdlYi1ydW50aW1lLm1qcy5tYXAiLCJjb25zdCBTVFIgPSAwYjAwMDAwMDAwMTtcbmNvbnN0IE5VTSA9IDBiMDAwMDAwMDEwO1xuY29uc3QgQVJSID0gMGIwMDAwMDAxMDA7XG5jb25zdCBPQkogPSAwYjAwMDAwMTAwMDtcbmNvbnN0IE5VTEwgPSAwYjAwMDAxMDAwMDtcbmNvbnN0IEJPT0wgPSAwYjAwMDEwMDAwMDtcbmNvbnN0IE5BTiA9IDBiMDAxMDAwMDAwO1xuY29uc3QgSU5GSU5JVFkgPSAwYjAxMDAwMDAwMDtcbmNvbnN0IE1JTlVTX0lORklOSVRZID0gMGIxMDAwMDAwMDA7XG5jb25zdCBJTkYgPSBJTkZJTklUWSB8IE1JTlVTX0lORklOSVRZO1xuY29uc3QgU1BFQ0lBTCA9IE5VTEwgfCBCT09MIHwgSU5GIHwgTkFOO1xuY29uc3QgQVRPTSA9IFNUUiB8IE5VTSB8IFNQRUNJQUw7XG5jb25zdCBDT0xMRUNUSU9OID0gQVJSIHwgT0JKO1xuY29uc3QgQUxMID0gQVRPTSB8IENPTExFQ1RJT047XG5jb25zdCBBbGxvdyA9IHtcbiAgICBTVFIsXG4gICAgTlVNLFxuICAgIEFSUixcbiAgICBPQkosXG4gICAgTlVMTCxcbiAgICBCT09MLFxuICAgIE5BTixcbiAgICBJTkZJTklUWSxcbiAgICBNSU5VU19JTkZJTklUWSxcbiAgICBJTkYsXG4gICAgU1BFQ0lBTCxcbiAgICBBVE9NLFxuICAgIENPTExFQ1RJT04sXG4gICAgQUxMLFxufTtcbi8vIFRoZSBKU09OIHN0cmluZyBzZWdtZW50IHdhcyB1bmFibGUgdG8gYmUgcGFyc2VkIGNvbXBsZXRlbHlcbmNsYXNzIFBhcnRpYWxKU09OIGV4dGVuZHMgRXJyb3Ige1xufVxuY2xhc3MgTWFsZm9ybWVkSlNPTiBleHRlbmRzIEVycm9yIHtcbn1cbi8qKlxuICogUGFyc2UgaW5jb21wbGV0ZSBKU09OXG4gKiBAcGFyYW0ge3N0cmluZ30ganNvblN0cmluZyBQYXJ0aWFsIEpTT04gdG8gYmUgcGFyc2VkXG4gKiBAcGFyYW0ge251bWJlcn0gYWxsb3dQYXJ0aWFsIFNwZWNpZnkgd2hhdCB0eXBlcyBhcmUgYWxsb3dlZCB0byBiZSBwYXJ0aWFsLCBzZWUge0BsaW5rIEFsbG93fSBmb3IgZGV0YWlsc1xuICogQHJldHVybnMgVGhlIHBhcnNlZCBKU09OXG4gKiBAdGhyb3dzIHtQYXJ0aWFsSlNPTn0gSWYgdGhlIEpTT04gaXMgaW5jb21wbGV0ZSAocmVsYXRlZCB0byB0aGUgYGFsbG93YCBwYXJhbWV0ZXIpXG4gKiBAdGhyb3dzIHtNYWxmb3JtZWRKU09OfSBJZiB0aGUgSlNPTiBpcyBtYWxmb3JtZWRcbiAqL1xuZnVuY3Rpb24gcGFyc2VKU09OKGpzb25TdHJpbmcsIGFsbG93UGFydGlhbCA9IEFsbG93LkFMTCkge1xuICAgIGlmICh0eXBlb2YganNvblN0cmluZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgZXhwZWN0aW5nIHN0ciwgZ290ICR7dHlwZW9mIGpzb25TdHJpbmd9YCk7XG4gICAgfVxuICAgIGlmICghanNvblN0cmluZy50cmltKCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2pzb25TdHJpbmd9IGlzIGVtcHR5YCk7XG4gICAgfVxuICAgIHJldHVybiBfcGFyc2VKU09OKGpzb25TdHJpbmcudHJpbSgpLCBhbGxvd1BhcnRpYWwpO1xufVxuY29uc3QgX3BhcnNlSlNPTiA9IChqc29uU3RyaW5nLCBhbGxvdykgPT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGpzb25TdHJpbmcubGVuZ3RoO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgbWFya1BhcnRpYWxKU09OID0gKG1zZykgPT4ge1xuICAgICAgICB0aHJvdyBuZXcgUGFydGlhbEpTT04oYCR7bXNnfSBhdCBwb3NpdGlvbiAke2luZGV4fWApO1xuICAgIH07XG4gICAgY29uc3QgdGhyb3dNYWxmb3JtZWRFcnJvciA9IChtc2cpID0+IHtcbiAgICAgICAgdGhyb3cgbmV3IE1hbGZvcm1lZEpTT04oYCR7bXNnfSBhdCBwb3NpdGlvbiAke2luZGV4fWApO1xuICAgIH07XG4gICAgY29uc3QgcGFyc2VBbnkgPSAoKSA9PiB7XG4gICAgICAgIHNraXBCbGFuaygpO1xuICAgICAgICBpZiAoaW5kZXggPj0gbGVuZ3RoKVxuICAgICAgICAgICAgbWFya1BhcnRpYWxKU09OKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCcpO1xuICAgICAgICBpZiAoanNvblN0cmluZ1tpbmRleF0gPT09ICdcIicpXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VTdHIoKTtcbiAgICAgICAgaWYgKGpzb25TdHJpbmdbaW5kZXhdID09PSAneycpXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VPYmooKTtcbiAgICAgICAgaWYgKGpzb25TdHJpbmdbaW5kZXhdID09PSAnWycpXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VBcnIoKTtcbiAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDQpID09PSAnbnVsbCcgfHxcbiAgICAgICAgICAgIChBbGxvdy5OVUxMICYgYWxsb3cgJiYgbGVuZ3RoIC0gaW5kZXggPCA0ICYmICdudWxsJy5zdGFydHNXaXRoKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4KSkpKSB7XG4gICAgICAgICAgICBpbmRleCArPSA0O1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDQpID09PSAndHJ1ZScgfHxcbiAgICAgICAgICAgIChBbGxvdy5CT09MICYgYWxsb3cgJiYgbGVuZ3RoIC0gaW5kZXggPCA0ICYmICd0cnVlJy5zdGFydHNXaXRoKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4KSkpKSB7XG4gICAgICAgICAgICBpbmRleCArPSA0O1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDUpID09PSAnZmFsc2UnIHx8XG4gICAgICAgICAgICAoQWxsb3cuQk9PTCAmIGFsbG93ICYmIGxlbmd0aCAtIGluZGV4IDwgNSAmJiAnZmFsc2UnLnN0YXJ0c1dpdGgoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgpKSkpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDgpID09PSAnSW5maW5pdHknIHx8XG4gICAgICAgICAgICAoQWxsb3cuSU5GSU5JVFkgJiBhbGxvdyAmJiBsZW5ndGggLSBpbmRleCA8IDggJiYgJ0luZmluaXR5Jy5zdGFydHNXaXRoKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4KSkpKSB7XG4gICAgICAgICAgICBpbmRleCArPSA4O1xuICAgICAgICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyA5KSA9PT0gJy1JbmZpbml0eScgfHxcbiAgICAgICAgICAgIChBbGxvdy5NSU5VU19JTkZJTklUWSAmIGFsbG93ICYmXG4gICAgICAgICAgICAgICAgMSA8IGxlbmd0aCAtIGluZGV4ICYmXG4gICAgICAgICAgICAgICAgbGVuZ3RoIC0gaW5kZXggPCA5ICYmXG4gICAgICAgICAgICAgICAgJy1JbmZpbml0eScuc3RhcnRzV2l0aChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCkpKSkge1xuICAgICAgICAgICAgaW5kZXggKz0gOTtcbiAgICAgICAgICAgIHJldHVybiAtSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDMpID09PSAnTmFOJyB8fFxuICAgICAgICAgICAgKEFsbG93Lk5BTiAmIGFsbG93ICYmIGxlbmd0aCAtIGluZGV4IDwgMyAmJiAnTmFOJy5zdGFydHNXaXRoKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4KSkpKSB7XG4gICAgICAgICAgICBpbmRleCArPSAzO1xuICAgICAgICAgICAgcmV0dXJuIE5hTjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGFyc2VOdW0oKTtcbiAgICB9O1xuICAgIGNvbnN0IHBhcnNlU3RyID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBzdGFydCA9IGluZGV4O1xuICAgICAgICBsZXQgZXNjYXBlID0gZmFsc2U7XG4gICAgICAgIGluZGV4Kys7IC8vIHNraXAgaW5pdGlhbCBxdW90ZVxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGggJiYgKGpzb25TdHJpbmdbaW5kZXhdICE9PSAnXCInIHx8IChlc2NhcGUgJiYganNvblN0cmluZ1tpbmRleCAtIDFdID09PSAnXFxcXCcpKSkge1xuICAgICAgICAgICAgZXNjYXBlID0ganNvblN0cmluZ1tpbmRleF0gPT09ICdcXFxcJyA/ICFlc2NhcGUgOiBmYWxzZTtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpzb25TdHJpbmcuY2hhckF0KGluZGV4KSA9PSAnXCInKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCArK2luZGV4IC0gTnVtYmVyKGVzY2FwZSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dNYWxmb3JtZWRFcnJvcihTdHJpbmcoZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKEFsbG93LlNUUiAmIGFsbG93KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBpbmRleCAtIE51bWJlcihlc2NhcGUpKSArICdcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBTeW50YXhFcnJvcjogSW52YWxpZCBlc2NhcGUgc2VxdWVuY2VcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZyhzdGFydCwganNvblN0cmluZy5sYXN0SW5kZXhPZignXFxcXCcpKSArICdcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG1hcmtQYXJ0aWFsSlNPTignVW50ZXJtaW5hdGVkIHN0cmluZyBsaXRlcmFsJyk7XG4gICAgfTtcbiAgICBjb25zdCBwYXJzZU9iaiA9ICgpID0+IHtcbiAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBpbml0aWFsIGJyYWNlXG4gICAgICAgIHNraXBCbGFuaygpO1xuICAgICAgICBjb25zdCBvYmogPSB7fTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdoaWxlIChqc29uU3RyaW5nW2luZGV4XSAhPT0gJ30nKSB7XG4gICAgICAgICAgICAgICAgc2tpcEJsYW5rKCk7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID49IGxlbmd0aCAmJiBBbGxvdy5PQkogJiBhbGxvdylcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBwYXJzZVN0cigpO1xuICAgICAgICAgICAgICAgIHNraXBCbGFuaygpO1xuICAgICAgICAgICAgICAgIGluZGV4Kys7IC8vIHNraXAgY29sb25cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHBhcnNlQW55KCk7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwgeyB2YWx1ZSwgd3JpdGFibGU6IHRydWUsIGVudW1lcmFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKEFsbG93Lk9CSiAmIGFsbG93KVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2tpcEJsYW5rKCk7XG4gICAgICAgICAgICAgICAgaWYgKGpzb25TdHJpbmdbaW5kZXhdID09PSAnLCcpXG4gICAgICAgICAgICAgICAgICAgIGluZGV4Kys7IC8vIHNraXAgY29tbWFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKEFsbG93Lk9CSiAmIGFsbG93KVxuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgbWFya1BhcnRpYWxKU09OKFwiRXhwZWN0ZWQgJ30nIGF0IGVuZCBvZiBvYmplY3RcIik7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBmaW5hbCBicmFjZVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH07XG4gICAgY29uc3QgcGFyc2VBcnIgPSAoKSA9PiB7XG4gICAgICAgIGluZGV4Kys7IC8vIHNraXAgaW5pdGlhbCBicmFja2V0XG4gICAgICAgIGNvbnN0IGFyciA9IFtdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2hpbGUgKGpzb25TdHJpbmdbaW5kZXhdICE9PSAnXScpIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChwYXJzZUFueSgpKTtcbiAgICAgICAgICAgICAgICBza2lwQmxhbmsoKTtcbiAgICAgICAgICAgICAgICBpZiAoanNvblN0cmluZ1tpbmRleF0gPT09ICcsJykge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCsrOyAvLyBza2lwIGNvbW1hXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoQWxsb3cuQVJSICYgYWxsb3cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWFya1BhcnRpYWxKU09OKFwiRXhwZWN0ZWQgJ10nIGF0IGVuZCBvZiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrOyAvLyBza2lwIGZpbmFsIGJyYWNrZXRcbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9O1xuICAgIGNvbnN0IHBhcnNlTnVtID0gKCkgPT4ge1xuICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIGlmIChqc29uU3RyaW5nID09PSAnLScgJiYgQWxsb3cuTlVNICYgYWxsb3cpXG4gICAgICAgICAgICAgICAgbWFya1BhcnRpYWxKU09OKFwiTm90IHN1cmUgd2hhdCAnLScgaXNcIik7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoQWxsb3cuTlVNICYgYWxsb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgnLicgPT09IGpzb25TdHJpbmdbanNvblN0cmluZy5sZW5ndGggLSAxXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZygwLCBqc29uU3RyaW5nLmxhc3RJbmRleE9mKCcuJykpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKDAsIGpzb25TdHJpbmcubGFzdEluZGV4T2YoJ2UnKSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3dNYWxmb3JtZWRFcnJvcihTdHJpbmcoZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gaW5kZXg7XG4gICAgICAgIGlmIChqc29uU3RyaW5nW2luZGV4XSA9PT0gJy0nKVxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgd2hpbGUgKGpzb25TdHJpbmdbaW5kZXhdICYmICEnLF19Jy5pbmNsdWRlcyhqc29uU3RyaW5nW2luZGV4XSkpXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICBpZiAoaW5kZXggPT0gbGVuZ3RoICYmICEoQWxsb3cuTlVNICYgYWxsb3cpKVxuICAgICAgICAgICAgbWFya1BhcnRpYWxKU09OKCdVbnRlcm1pbmF0ZWQgbnVtYmVyIGxpdGVyYWwnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBpbmRleCkpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGluZGV4KSA9PT0gJy0nICYmIEFsbG93Lk5VTSAmIGFsbG93KVxuICAgICAgICAgICAgICAgIG1hcmtQYXJ0aWFsSlNPTihcIk5vdCBzdXJlIHdoYXQgJy0nIGlzXCIpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZyhzdGFydCwganNvblN0cmluZy5sYXN0SW5kZXhPZignZScpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRocm93TWFsZm9ybWVkRXJyb3IoU3RyaW5nKGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3Qgc2tpcEJsYW5rID0gKCkgPT4ge1xuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGggJiYgJyBcXG5cXHJcXHQnLmluY2x1ZGVzKGpzb25TdHJpbmdbaW5kZXhdKSkge1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIHBhcnNlQW55KCk7XG59O1xuLy8gdXNpbmcgdGhpcyBmdW5jdGlvbiB3aXRoIG1hbGZvcm1lZCBKU09OIGlzIHVuZGVmaW5lZCBiZWhhdmlvclxuY29uc3QgcGFydGlhbFBhcnNlID0gKGlucHV0KSA9PiBwYXJzZUpTT04oaW5wdXQsIEFsbG93LkFMTCBeIEFsbG93Lk5VTSk7XG5leHBvcnQgeyBwYXJ0aWFsUGFyc2UsIFBhcnRpYWxKU09OLCBNYWxmb3JtZWRKU09OIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYXJzZXIubWpzLm1hcCIsInZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcbn07XG52YXIgX19jbGFzc1ByaXZhdGVGaWVsZEdldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZEdldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xufTtcbnZhciBfQWJzdHJhY3RQYWdlX2NsaWVudDtcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tIFwiLi92ZXJzaW9uLm1qc1wiO1xuaW1wb3J0IHsgU3RyZWFtIH0gZnJvbSBcIi4vc3RyZWFtaW5nLm1qc1wiO1xuaW1wb3J0IHsgT3BlbkFJRXJyb3IsIEFQSUVycm9yLCBBUElDb25uZWN0aW9uRXJyb3IsIEFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3IsIEFQSVVzZXJBYm9ydEVycm9yLCB9IGZyb20gXCIuL2Vycm9yLm1qc1wiO1xuaW1wb3J0IHsga2luZCBhcyBzaGltc0tpbmQsIGdldERlZmF1bHRBZ2VudCwgZmV0Y2gsIH0gZnJvbSBcIi4vX3NoaW1zL2luZGV4Lm1qc1wiO1xuaW1wb3J0IHsgaXNCbG9iTGlrZSwgaXNNdWx0aXBhcnRCb2R5IH0gZnJvbSBcIi4vdXBsb2Fkcy5tanNcIjtcbmV4cG9ydCB7IG1heWJlTXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zLCBtdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMsIGNyZWF0ZUZvcm0sIH0gZnJvbSBcIi4vdXBsb2Fkcy5tanNcIjtcbmFzeW5jIGZ1bmN0aW9uIGRlZmF1bHRQYXJzZVJlc3BvbnNlKHByb3BzKSB7XG4gICAgY29uc3QgeyByZXNwb25zZSB9ID0gcHJvcHM7XG4gICAgaWYgKHByb3BzLm9wdGlvbnMuc3RyZWFtKSB7XG4gICAgICAgIGRlYnVnKCdyZXNwb25zZScsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2UudXJsLCByZXNwb25zZS5oZWFkZXJzLCByZXNwb25zZS5ib2R5KTtcbiAgICAgICAgLy8gTm90ZTogdGhlcmUgaXMgYW4gaW52YXJpYW50IGhlcmUgdGhhdCBpc24ndCByZXByZXNlbnRlZCBpbiB0aGUgdHlwZSBzeXN0ZW1cbiAgICAgICAgLy8gdGhhdCBpZiB5b3Ugc2V0IGBzdHJlYW06IHRydWVgIHRoZSByZXNwb25zZSB0eXBlIG11c3QgYWxzbyBiZSBgU3RyZWFtPFQ+YFxuICAgICAgICBpZiAocHJvcHMub3B0aW9ucy5fX3N0cmVhbUNsYXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvcHMub3B0aW9ucy5fX3N0cmVhbUNsYXNzLmZyb21TU0VSZXNwb25zZShyZXNwb25zZSwgcHJvcHMuY29udHJvbGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFN0cmVhbS5mcm9tU1NFUmVzcG9uc2UocmVzcG9uc2UsIHByb3BzLmNvbnRyb2xsZXIpO1xuICAgIH1cbiAgICAvLyBmZXRjaCByZWZ1c2VzIHRvIHJlYWQgdGhlIGJvZHkgd2hlbiB0aGUgc3RhdHVzIGNvZGUgaXMgMjA0LlxuICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwNCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKHByb3BzLm9wdGlvbnMuX19iaW5hcnlSZXNwb25zZSkge1xuICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoJ2NvbnRlbnQtdHlwZScpO1xuICAgIGNvbnN0IGlzSlNPTiA9IGNvbnRlbnRUeXBlPy5pbmNsdWRlcygnYXBwbGljYXRpb24vanNvbicpIHx8IGNvbnRlbnRUeXBlPy5pbmNsdWRlcygnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJyk7XG4gICAgaWYgKGlzSlNPTikge1xuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICBkZWJ1ZygncmVzcG9uc2UnLCByZXNwb25zZS5zdGF0dXMsIHJlc3BvbnNlLnVybCwgcmVzcG9uc2UuaGVhZGVycywganNvbik7XG4gICAgICAgIHJldHVybiBfYWRkUmVxdWVzdElEKGpzb24sIHJlc3BvbnNlKTtcbiAgICB9XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICBkZWJ1ZygncmVzcG9uc2UnLCByZXNwb25zZS5zdGF0dXMsIHJlc3BvbnNlLnVybCwgcmVzcG9uc2UuaGVhZGVycywgdGV4dCk7XG4gICAgLy8gVE9ETyBoYW5kbGUgYmxvYiwgYXJyYXlidWZmZXIsIG90aGVyIGNvbnRlbnQgdHlwZXMsIGV0Yy5cbiAgICByZXR1cm4gdGV4dDtcbn1cbmZ1bmN0aW9uIF9hZGRSZXF1ZXN0SUQodmFsdWUsIHJlc3BvbnNlKSB7XG4gICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh2YWx1ZSwgJ19yZXF1ZXN0X2lkJywge1xuICAgICAgICB2YWx1ZTogcmVzcG9uc2UuaGVhZGVycy5nZXQoJ3gtcmVxdWVzdC1pZCcpLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICB9KTtcbn1cbi8qKlxuICogQSBzdWJjbGFzcyBvZiBgUHJvbWlzZWAgcHJvdmlkaW5nIGFkZGl0aW9uYWwgaGVscGVyIG1ldGhvZHNcbiAqIGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBTREsuXG4gKi9cbmV4cG9ydCBjbGFzcyBBUElQcm9taXNlIGV4dGVuZHMgUHJvbWlzZSB7XG4gICAgY29uc3RydWN0b3IocmVzcG9uc2VQcm9taXNlLCBwYXJzZVJlc3BvbnNlID0gZGVmYXVsdFBhcnNlUmVzcG9uc2UpIHtcbiAgICAgICAgc3VwZXIoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgbWF5YmUgYSBiaXQgd2VpcmQgYnV0IHRoaXMgaGFzIHRvIGJlIGEgbm8tb3AgdG8gbm90IGltcGxpY2l0bHlcbiAgICAgICAgICAgIC8vIHBhcnNlIHRoZSByZXNwb25zZSBib2R5OyBpbnN0ZWFkIC50aGVuLCAuY2F0Y2gsIC5maW5hbGx5IGFyZSBvdmVycmlkZGVuXG4gICAgICAgICAgICAvLyB0byBwYXJzZSB0aGUgcmVzcG9uc2VcbiAgICAgICAgICAgIHJlc29sdmUobnVsbCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlc3BvbnNlUHJvbWlzZSA9IHJlc3BvbnNlUHJvbWlzZTtcbiAgICAgICAgdGhpcy5wYXJzZVJlc3BvbnNlID0gcGFyc2VSZXNwb25zZTtcbiAgICB9XG4gICAgX3RoZW5VbndyYXAodHJhbnNmb3JtKSB7XG4gICAgICAgIHJldHVybiBuZXcgQVBJUHJvbWlzZSh0aGlzLnJlc3BvbnNlUHJvbWlzZSwgYXN5bmMgKHByb3BzKSA9PiBfYWRkUmVxdWVzdElEKHRyYW5zZm9ybShhd2FpdCB0aGlzLnBhcnNlUmVzcG9uc2UocHJvcHMpLCBwcm9wcyksIHByb3BzLnJlc3BvbnNlKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHJhdyBgUmVzcG9uc2VgIGluc3RhbmNlIGluc3RlYWQgb2YgcGFyc2luZyB0aGUgcmVzcG9uc2VcbiAgICAgKiBkYXRhLlxuICAgICAqXG4gICAgICogSWYgeW91IHdhbnQgdG8gcGFyc2UgdGhlIHJlc3BvbnNlIGJvZHkgYnV0IHN0aWxsIGdldCB0aGUgYFJlc3BvbnNlYFxuICAgICAqIGluc3RhbmNlLCB5b3UgY2FuIHVzZSB7QGxpbmsgd2l0aFJlc3BvbnNlKCl9LlxuICAgICAqXG4gICAgICog8J+RiyBHZXR0aW5nIHRoZSB3cm9uZyBUeXBlU2NyaXB0IHR5cGUgZm9yIGBSZXNwb25zZWA/XG4gICAgICogVHJ5IHNldHRpbmcgYFwibW9kdWxlUmVzb2x1dGlvblwiOiBcIk5vZGVOZXh0XCJgIGlmIHlvdSBjYW4sXG4gICAgICogb3IgYWRkIG9uZSBvZiB0aGVzZSBpbXBvcnRzIGJlZm9yZSB5b3VyIGZpcnN0IGBpbXBvcnQg4oCmIGZyb20gJ29wZW5haSdgOlxuICAgICAqIC0gYGltcG9ydCAnb3BlbmFpL3NoaW1zL25vZGUnYCAoaWYgeW91J3JlIHJ1bm5pbmcgb24gTm9kZSlcbiAgICAgKiAtIGBpbXBvcnQgJ29wZW5haS9zaGltcy93ZWInYCAob3RoZXJ3aXNlKVxuICAgICAqL1xuICAgIGFzUmVzcG9uc2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlc3BvbnNlUHJvbWlzZS50aGVuKChwKSA9PiBwLnJlc3BvbnNlKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgcGFyc2VkIHJlc3BvbnNlIGRhdGEsIHRoZSByYXcgYFJlc3BvbnNlYCBpbnN0YW5jZSBhbmQgdGhlIElEIG9mIHRoZSByZXF1ZXN0LFxuICAgICAqIHJldHVybmVkIHZpYSB0aGUgWC1SZXF1ZXN0LUlEIGhlYWRlciB3aGljaCBpcyB1c2VmdWwgZm9yIGRlYnVnZ2luZyByZXF1ZXN0cyBhbmQgcmVwb3J0aW5nXG4gICAgICogaXNzdWVzIHRvIE9wZW5BSS5cbiAgICAgKlxuICAgICAqIElmIHlvdSBqdXN0IHdhbnQgdG8gZ2V0IHRoZSByYXcgYFJlc3BvbnNlYCBpbnN0YW5jZSB3aXRob3V0IHBhcnNpbmcgaXQsXG4gICAgICogeW91IGNhbiB1c2Uge0BsaW5rIGFzUmVzcG9uc2UoKX0uXG4gICAgICpcbiAgICAgKlxuICAgICAqIPCfkYsgR2V0dGluZyB0aGUgd3JvbmcgVHlwZVNjcmlwdCB0eXBlIGZvciBgUmVzcG9uc2VgP1xuICAgICAqIFRyeSBzZXR0aW5nIGBcIm1vZHVsZVJlc29sdXRpb25cIjogXCJOb2RlTmV4dFwiYCBpZiB5b3UgY2FuLFxuICAgICAqIG9yIGFkZCBvbmUgb2YgdGhlc2UgaW1wb3J0cyBiZWZvcmUgeW91ciBmaXJzdCBgaW1wb3J0IOKApiBmcm9tICdvcGVuYWknYDpcbiAgICAgKiAtIGBpbXBvcnQgJ29wZW5haS9zaGltcy9ub2RlJ2AgKGlmIHlvdSdyZSBydW5uaW5nIG9uIE5vZGUpXG4gICAgICogLSBgaW1wb3J0ICdvcGVuYWkvc2hpbXMvd2ViJ2AgKG90aGVyd2lzZSlcbiAgICAgKi9cbiAgICBhc3luYyB3aXRoUmVzcG9uc2UoKSB7XG4gICAgICAgIGNvbnN0IFtkYXRhLCByZXNwb25zZV0gPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5wYXJzZSgpLCB0aGlzLmFzUmVzcG9uc2UoKV0pO1xuICAgICAgICByZXR1cm4geyBkYXRhLCByZXNwb25zZSwgcmVxdWVzdF9pZDogcmVzcG9uc2UuaGVhZGVycy5nZXQoJ3gtcmVxdWVzdC1pZCcpIH07XG4gICAgfVxuICAgIHBhcnNlKCkge1xuICAgICAgICBpZiAoIXRoaXMucGFyc2VkUHJvbWlzZSkge1xuICAgICAgICAgICAgdGhpcy5wYXJzZWRQcm9taXNlID0gdGhpcy5yZXNwb25zZVByb21pc2UudGhlbih0aGlzLnBhcnNlUmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlZFByb21pc2U7XG4gICAgfVxuICAgIHRoZW4ob25mdWxmaWxsZWQsIG9ucmVqZWN0ZWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2UoKS50aGVuKG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKTtcbiAgICB9XG4gICAgY2F0Y2gob25yZWplY3RlZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZSgpLmNhdGNoKG9ucmVqZWN0ZWQpO1xuICAgIH1cbiAgICBmaW5hbGx5KG9uZmluYWxseSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZSgpLmZpbmFsbHkob25maW5hbGx5KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQVBJQ2xpZW50IHtcbiAgICBjb25zdHJ1Y3Rvcih7IGJhc2VVUkwsIG1heFJldHJpZXMgPSAyLCB0aW1lb3V0ID0gNjAwMDAwLCAvLyAxMCBtaW51dGVzXG4gICAgaHR0cEFnZW50LCBmZXRjaDogb3ZlcnJpZGRlbkZldGNoLCB9KSB7XG4gICAgICAgIHRoaXMuYmFzZVVSTCA9IGJhc2VVUkw7XG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IHZhbGlkYXRlUG9zaXRpdmVJbnRlZ2VyKCdtYXhSZXRyaWVzJywgbWF4UmV0cmllcyk7XG4gICAgICAgIHRoaXMudGltZW91dCA9IHZhbGlkYXRlUG9zaXRpdmVJbnRlZ2VyKCd0aW1lb3V0JywgdGltZW91dCk7XG4gICAgICAgIHRoaXMuaHR0cEFnZW50ID0gaHR0cEFnZW50O1xuICAgICAgICB0aGlzLmZldGNoID0gb3ZlcnJpZGRlbkZldGNoID8/IGZldGNoO1xuICAgIH1cbiAgICBhdXRoSGVhZGVycyhvcHRzKSB7XG4gICAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogT3ZlcnJpZGUgdGhpcyB0byBhZGQgeW91ciBvd24gZGVmYXVsdCBoZWFkZXJzLCBmb3IgZXhhbXBsZTpcbiAgICAgKlxuICAgICAqICB7XG4gICAgICogICAgLi4uc3VwZXIuZGVmYXVsdEhlYWRlcnMoKSxcbiAgICAgKiAgICBBdXRob3JpemF0aW9uOiAnQmVhcmVyIDEyMycsXG4gICAgICogIH1cbiAgICAgKi9cbiAgICBkZWZhdWx0SGVhZGVycyhvcHRzKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBBY2NlcHQ6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAnVXNlci1BZ2VudCc6IHRoaXMuZ2V0VXNlckFnZW50KCksXG4gICAgICAgICAgICAuLi5nZXRQbGF0Zm9ybUhlYWRlcnMoKSxcbiAgICAgICAgICAgIC4uLnRoaXMuYXV0aEhlYWRlcnMob3B0cyksXG4gICAgICAgIH07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE92ZXJyaWRlIHRoaXMgdG8gYWRkIHlvdXIgb3duIGhlYWRlcnMgdmFsaWRhdGlvbjpcbiAgICAgKi9cbiAgICB2YWxpZGF0ZUhlYWRlcnMoaGVhZGVycywgY3VzdG9tSGVhZGVycykgeyB9XG4gICAgZGVmYXVsdElkZW1wb3RlbmN5S2V5KCkge1xuICAgICAgICByZXR1cm4gYHN0YWlubGVzcy1ub2RlLXJldHJ5LSR7dXVpZDQoKX1gO1xuICAgIH1cbiAgICBnZXQocGF0aCwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXRob2RSZXF1ZXN0KCdnZXQnLCBwYXRoLCBvcHRzKTtcbiAgICB9XG4gICAgcG9zdChwYXRoLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ldGhvZFJlcXVlc3QoJ3Bvc3QnLCBwYXRoLCBvcHRzKTtcbiAgICB9XG4gICAgcGF0Y2gocGF0aCwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXRob2RSZXF1ZXN0KCdwYXRjaCcsIHBhdGgsIG9wdHMpO1xuICAgIH1cbiAgICBwdXQocGF0aCwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXRob2RSZXF1ZXN0KCdwdXQnLCBwYXRoLCBvcHRzKTtcbiAgICB9XG4gICAgZGVsZXRlKHBhdGgsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWV0aG9kUmVxdWVzdCgnZGVsZXRlJywgcGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIG1ldGhvZFJlcXVlc3QobWV0aG9kLCBwYXRoLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QoUHJvbWlzZS5yZXNvbHZlKG9wdHMpLnRoZW4oYXN5bmMgKG9wdHMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBvcHRzICYmIGlzQmxvYkxpa2Uob3B0cz8uYm9keSkgPyBuZXcgRGF0YVZpZXcoYXdhaXQgb3B0cy5ib2R5LmFycmF5QnVmZmVyKCkpXG4gICAgICAgICAgICAgICAgOiBvcHRzPy5ib2R5IGluc3RhbmNlb2YgRGF0YVZpZXcgPyBvcHRzLmJvZHlcbiAgICAgICAgICAgICAgICAgICAgOiBvcHRzPy5ib2R5IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgPyBuZXcgRGF0YVZpZXcob3B0cy5ib2R5KVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBvcHRzICYmIEFycmF5QnVmZmVyLmlzVmlldyhvcHRzPy5ib2R5KSA/IG5ldyBEYXRhVmlldyhvcHRzLmJvZHkuYnVmZmVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogb3B0cz8uYm9keTtcbiAgICAgICAgICAgIHJldHVybiB7IG1ldGhvZCwgcGF0aCwgLi4ub3B0cywgYm9keSB9O1xuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGdldEFQSUxpc3QocGF0aCwgUGFnZSwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0QVBJTGlzdChQYWdlLCB7IG1ldGhvZDogJ2dldCcsIHBhdGgsIC4uLm9wdHMgfSk7XG4gICAgfVxuICAgIGNhbGN1bGF0ZUNvbnRlbnRMZW5ndGgoYm9keSkge1xuICAgICAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIEJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQnVmZmVyLmJ5dGVMZW5ndGgoYm9keSwgJ3V0ZjgnKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiBUZXh0RW5jb2RlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5jb2RlZCA9IGVuY29kZXIuZW5jb2RlKGJvZHkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlbmNvZGVkLmxlbmd0aC50b1N0cmluZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhib2R5KSkge1xuICAgICAgICAgICAgcmV0dXJuIGJvZHkuYnl0ZUxlbmd0aC50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBidWlsZFJlcXVlc3Qob3B0aW9ucywgeyByZXRyeUNvdW50ID0gMCB9ID0ge30pIHtcbiAgICAgICAgb3B0aW9ucyA9IHsgLi4ub3B0aW9ucyB9O1xuICAgICAgICBjb25zdCB7IG1ldGhvZCwgcGF0aCwgcXVlcnksIGhlYWRlcnM6IGhlYWRlcnMgPSB7fSB9ID0gb3B0aW9ucztcbiAgICAgICAgY29uc3QgYm9keSA9IEFycmF5QnVmZmVyLmlzVmlldyhvcHRpb25zLmJvZHkpIHx8IChvcHRpb25zLl9fYmluYXJ5UmVxdWVzdCAmJiB0eXBlb2Ygb3B0aW9ucy5ib2R5ID09PSAnc3RyaW5nJykgP1xuICAgICAgICAgICAgb3B0aW9ucy5ib2R5XG4gICAgICAgICAgICA6IGlzTXVsdGlwYXJ0Qm9keShvcHRpb25zLmJvZHkpID8gb3B0aW9ucy5ib2R5LmJvZHlcbiAgICAgICAgICAgICAgICA6IG9wdGlvbnMuYm9keSA/IEpTT04uc3RyaW5naWZ5KG9wdGlvbnMuYm9keSwgbnVsbCwgMilcbiAgICAgICAgICAgICAgICAgICAgOiBudWxsO1xuICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gdGhpcy5jYWxjdWxhdGVDb250ZW50TGVuZ3RoKGJvZHkpO1xuICAgICAgICBjb25zdCB1cmwgPSB0aGlzLmJ1aWxkVVJMKHBhdGgsIHF1ZXJ5KTtcbiAgICAgICAgaWYgKCd0aW1lb3V0JyBpbiBvcHRpb25zKVxuICAgICAgICAgICAgdmFsaWRhdGVQb3NpdGl2ZUludGVnZXIoJ3RpbWVvdXQnLCBvcHRpb25zLnRpbWVvdXQpO1xuICAgICAgICBvcHRpb25zLnRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQgPz8gdGhpcy50aW1lb3V0O1xuICAgICAgICBjb25zdCBodHRwQWdlbnQgPSBvcHRpb25zLmh0dHBBZ2VudCA/PyB0aGlzLmh0dHBBZ2VudCA/PyBnZXREZWZhdWx0QWdlbnQodXJsKTtcbiAgICAgICAgY29uc3QgbWluQWdlbnRUaW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0ICsgMTAwMDtcbiAgICAgICAgaWYgKHR5cGVvZiBodHRwQWdlbnQ/Lm9wdGlvbnM/LnRpbWVvdXQgPT09ICdudW1iZXInICYmXG4gICAgICAgICAgICBtaW5BZ2VudFRpbWVvdXQgPiAoaHR0cEFnZW50Lm9wdGlvbnMudGltZW91dCA/PyAwKSkge1xuICAgICAgICAgICAgLy8gQWxsb3cgYW55IGdpdmVuIHJlcXVlc3QgdG8gYnVtcCBvdXIgYWdlbnQgYWN0aXZlIHNvY2tldCB0aW1lb3V0LlxuICAgICAgICAgICAgLy8gVGhpcyBtYXkgc2VlbSBzdHJhbmdlLCBidXQgbGVha2luZyBhY3RpdmUgc29ja2V0cyBzaG91bGQgYmUgcmFyZSBhbmQgbm90IHBhcnRpY3VsYXJseSBwcm9ibGVtYXRpYyxcbiAgICAgICAgICAgIC8vIGFuZCB3aXRob3V0IG11dGF0aW5nIGFnZW50IHdlIHdvdWxkIG5lZWQgdG8gY3JlYXRlIG1vcmUgb2YgdGhlbS5cbiAgICAgICAgICAgIC8vIFRoaXMgdHJhZGVvZmYgb3B0aW1pemVzIGZvciBwZXJmb3JtYW5jZS5cbiAgICAgICAgICAgIGh0dHBBZ2VudC5vcHRpb25zLnRpbWVvdXQgPSBtaW5BZ2VudFRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuaWRlbXBvdGVuY3lIZWFkZXIgJiYgbWV0aG9kICE9PSAnZ2V0Jykge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmlkZW1wb3RlbmN5S2V5KVxuICAgICAgICAgICAgICAgIG9wdGlvbnMuaWRlbXBvdGVuY3lLZXkgPSB0aGlzLmRlZmF1bHRJZGVtcG90ZW5jeUtleSgpO1xuICAgICAgICAgICAgaGVhZGVyc1t0aGlzLmlkZW1wb3RlbmN5SGVhZGVyXSA9IG9wdGlvbnMuaWRlbXBvdGVuY3lLZXk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVxSGVhZGVycyA9IHRoaXMuYnVpbGRIZWFkZXJzKHsgb3B0aW9ucywgaGVhZGVycywgY29udGVudExlbmd0aCwgcmV0cnlDb3VudCB9KTtcbiAgICAgICAgY29uc3QgcmVxID0ge1xuICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgLi4uKGJvZHkgJiYgeyBib2R5OiBib2R5IH0pLFxuICAgICAgICAgICAgaGVhZGVyczogcmVxSGVhZGVycyxcbiAgICAgICAgICAgIC4uLihodHRwQWdlbnQgJiYgeyBhZ2VudDogaHR0cEFnZW50IH0pLFxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZSBub2RlLWZldGNoIHVzZXMgYSBjdXN0b20gQWJvcnRTaWduYWwgdHlwZSB0aGF0IGlzXG4gICAgICAgICAgICAvLyBub3QgY29tcGF0aWJsZSB3aXRoIHN0YW5kYXJkIHdlYiB0eXBlc1xuICAgICAgICAgICAgc2lnbmFsOiBvcHRpb25zLnNpZ25hbCA/PyBudWxsLFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4geyByZXEsIHVybCwgdGltZW91dDogb3B0aW9ucy50aW1lb3V0IH07XG4gICAgfVxuICAgIGJ1aWxkSGVhZGVycyh7IG9wdGlvbnMsIGhlYWRlcnMsIGNvbnRlbnRMZW5ndGgsIHJldHJ5Q291bnQsIH0pIHtcbiAgICAgICAgY29uc3QgcmVxSGVhZGVycyA9IHt9O1xuICAgICAgICBpZiAoY29udGVudExlbmd0aCkge1xuICAgICAgICAgICAgcmVxSGVhZGVyc1snY29udGVudC1sZW5ndGgnXSA9IGNvbnRlbnRMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGVmYXVsdEhlYWRlcnMgPSB0aGlzLmRlZmF1bHRIZWFkZXJzKG9wdGlvbnMpO1xuICAgICAgICBhcHBseUhlYWRlcnNNdXQocmVxSGVhZGVycywgZGVmYXVsdEhlYWRlcnMpO1xuICAgICAgICBhcHBseUhlYWRlcnNNdXQocmVxSGVhZGVycywgaGVhZGVycyk7XG4gICAgICAgIC8vIGxldCBidWlsdGluIGZldGNoIHNldCB0aGUgQ29udGVudC1UeXBlIGZvciBtdWx0aXBhcnQgYm9kaWVzXG4gICAgICAgIGlmIChpc011bHRpcGFydEJvZHkob3B0aW9ucy5ib2R5KSAmJiBzaGltc0tpbmQgIT09ICdub2RlJykge1xuICAgICAgICAgICAgZGVsZXRlIHJlcUhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddO1xuICAgICAgICB9XG4gICAgICAgIC8vIERvbid0IHNldCB0aGVzZXMgaGVhZGVycyBpZiB0aGV5IHdlcmUgYWxyZWFkeSBzZXQgb3IgcmVtb3ZlZCB0aHJvdWdoIGRlZmF1bHQgaGVhZGVycyBvciBieSB0aGUgY2FsbGVyLlxuICAgICAgICAvLyBXZSBjaGVjayBgZGVmYXVsdEhlYWRlcnNgIGFuZCBgaGVhZGVyc2AsIHdoaWNoIGNhbiBjb250YWluIG51bGxzLCBpbnN0ZWFkIG9mIGByZXFIZWFkZXJzYCB0byBhY2NvdW50XG4gICAgICAgIC8vIGZvciB0aGUgcmVtb3ZhbCBjYXNlLlxuICAgICAgICBpZiAoZ2V0SGVhZGVyKGRlZmF1bHRIZWFkZXJzLCAneC1zdGFpbmxlc3MtcmV0cnktY291bnQnKSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBnZXRIZWFkZXIoaGVhZGVycywgJ3gtc3RhaW5sZXNzLXJldHJ5LWNvdW50JykgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVxSGVhZGVyc1sneC1zdGFpbmxlc3MtcmV0cnktY291bnQnXSA9IFN0cmluZyhyZXRyeUNvdW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZ2V0SGVhZGVyKGRlZmF1bHRIZWFkZXJzLCAneC1zdGFpbmxlc3MtdGltZW91dCcpID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIGdldEhlYWRlcihoZWFkZXJzLCAneC1zdGFpbmxlc3MtdGltZW91dCcpID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIG9wdGlvbnMudGltZW91dCkge1xuICAgICAgICAgICAgcmVxSGVhZGVyc1sneC1zdGFpbmxlc3MtdGltZW91dCddID0gU3RyaW5nKG9wdGlvbnMudGltZW91dCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy52YWxpZGF0ZUhlYWRlcnMocmVxSGVhZGVycywgaGVhZGVycyk7XG4gICAgICAgIHJldHVybiByZXFIZWFkZXJzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBVc2VkIGFzIGEgY2FsbGJhY2sgZm9yIG11dGF0aW5nIHRoZSBnaXZlbiBgRmluYWxSZXF1ZXN0T3B0aW9uc2Agb2JqZWN0LlxuICAgICAqL1xuICAgIGFzeW5jIHByZXBhcmVPcHRpb25zKG9wdGlvbnMpIHsgfVxuICAgIC8qKlxuICAgICAqIFVzZWQgYXMgYSBjYWxsYmFjayBmb3IgbXV0YXRpbmcgdGhlIGdpdmVuIGBSZXF1ZXN0SW5pdGAgb2JqZWN0LlxuICAgICAqXG4gICAgICogVGhpcyBpcyB1c2VmdWwgZm9yIGNhc2VzIHdoZXJlIHlvdSB3YW50IHRvIGFkZCBjZXJ0YWluIGhlYWRlcnMgYmFzZWQgb2ZmIG9mXG4gICAgICogdGhlIHJlcXVlc3QgcHJvcGVydGllcywgZS5nLiBgbWV0aG9kYCBvciBgdXJsYC5cbiAgICAgKi9cbiAgICBhc3luYyBwcmVwYXJlUmVxdWVzdChyZXF1ZXN0LCB7IHVybCwgb3B0aW9ucyB9KSB7IH1cbiAgICBwYXJzZUhlYWRlcnMoaGVhZGVycykge1xuICAgICAgICByZXR1cm4gKCFoZWFkZXJzID8ge31cbiAgICAgICAgICAgIDogU3ltYm9sLml0ZXJhdG9yIGluIGhlYWRlcnMgP1xuICAgICAgICAgICAgICAgIE9iamVjdC5mcm9tRW50cmllcyhBcnJheS5mcm9tKGhlYWRlcnMpLm1hcCgoaGVhZGVyKSA9PiBbLi4uaGVhZGVyXSkpXG4gICAgICAgICAgICAgICAgOiB7IC4uLmhlYWRlcnMgfSk7XG4gICAgfVxuICAgIG1ha2VTdGF0dXNFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKSB7XG4gICAgICAgIHJldHVybiBBUElFcnJvci5nZW5lcmF0ZShzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICB9XG4gICAgcmVxdWVzdChvcHRpb25zLCByZW1haW5pbmdSZXRyaWVzID0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbmV3IEFQSVByb21pc2UodGhpcy5tYWtlUmVxdWVzdChvcHRpb25zLCByZW1haW5pbmdSZXRyaWVzKSk7XG4gICAgfVxuICAgIGFzeW5jIG1ha2VSZXF1ZXN0KG9wdGlvbnNJbnB1dCwgcmV0cmllc1JlbWFpbmluZykge1xuICAgICAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgb3B0aW9uc0lucHV0O1xuICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gb3B0aW9ucy5tYXhSZXRyaWVzID8/IHRoaXMubWF4UmV0cmllcztcbiAgICAgICAgaWYgKHJldHJpZXNSZW1haW5pbmcgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0cmllc1JlbWFpbmluZyA9IG1heFJldHJpZXM7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgdGhpcy5wcmVwYXJlT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgY29uc3QgeyByZXEsIHVybCwgdGltZW91dCB9ID0gdGhpcy5idWlsZFJlcXVlc3Qob3B0aW9ucywgeyByZXRyeUNvdW50OiBtYXhSZXRyaWVzIC0gcmV0cmllc1JlbWFpbmluZyB9KTtcbiAgICAgICAgYXdhaXQgdGhpcy5wcmVwYXJlUmVxdWVzdChyZXEsIHsgdXJsLCBvcHRpb25zIH0pO1xuICAgICAgICBkZWJ1ZygncmVxdWVzdCcsIHVybCwgb3B0aW9ucywgcmVxLmhlYWRlcnMpO1xuICAgICAgICBpZiAob3B0aW9ucy5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5mZXRjaFdpdGhUaW1lb3V0KHVybCwgcmVxLCB0aW1lb3V0LCBjb250cm9sbGVyKS5jYXRjaChjYXN0VG9FcnJvcik7XG4gICAgICAgIGlmIChyZXNwb25zZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXRyaWVzUmVtYWluaW5nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0cnlSZXF1ZXN0KG9wdGlvbnMsIHJldHJpZXNSZW1haW5pbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBBUElDb25uZWN0aW9uVGltZW91dEVycm9yKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJQ29ubmVjdGlvbkVycm9yKHsgY2F1c2U6IHJlc3BvbnNlIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlSGVhZGVycyA9IGNyZWF0ZVJlc3BvbnNlSGVhZGVycyhyZXNwb25zZS5oZWFkZXJzKTtcbiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgaWYgKHJldHJpZXNSZW1haW5pbmcgJiYgdGhpcy5zaG91bGRSZXRyeShyZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXRyeU1lc3NhZ2UgPSBgcmV0cnlpbmcsICR7cmV0cmllc1JlbWFpbmluZ30gYXR0ZW1wdHMgcmVtYWluaW5nYDtcbiAgICAgICAgICAgICAgICBkZWJ1ZyhgcmVzcG9uc2UgKGVycm9yOyAke3JldHJ5TWVzc2FnZX0pYCwgcmVzcG9uc2Uuc3RhdHVzLCB1cmwsIHJlc3BvbnNlSGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0cnlSZXF1ZXN0KG9wdGlvbnMsIHJldHJpZXNSZW1haW5pbmcsIHJlc3BvbnNlSGVhZGVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBlcnJUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpLmNhdGNoKChlKSA9PiBjYXN0VG9FcnJvcihlKS5tZXNzYWdlKTtcbiAgICAgICAgICAgIGNvbnN0IGVyckpTT04gPSBzYWZlSlNPTihlcnJUZXh0KTtcbiAgICAgICAgICAgIGNvbnN0IGVyck1lc3NhZ2UgPSBlcnJKU09OID8gdW5kZWZpbmVkIDogZXJyVGV4dDtcbiAgICAgICAgICAgIGNvbnN0IHJldHJ5TWVzc2FnZSA9IHJldHJpZXNSZW1haW5pbmcgPyBgKGVycm9yOyBubyBtb3JlIHJldHJpZXMgbGVmdClgIDogYChlcnJvcjsgbm90IHJldHJ5YWJsZSlgO1xuICAgICAgICAgICAgZGVidWcoYHJlc3BvbnNlIChlcnJvcjsgJHtyZXRyeU1lc3NhZ2V9KWAsIHJlc3BvbnNlLnN0YXR1cywgdXJsLCByZXNwb25zZUhlYWRlcnMsIGVyck1lc3NhZ2UpO1xuICAgICAgICAgICAgY29uc3QgZXJyID0gdGhpcy5tYWtlU3RhdHVzRXJyb3IocmVzcG9uc2Uuc3RhdHVzLCBlcnJKU09OLCBlcnJNZXNzYWdlLCByZXNwb25zZUhlYWRlcnMpO1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHJlc3BvbnNlLCBvcHRpb25zLCBjb250cm9sbGVyIH07XG4gICAgfVxuICAgIHJlcXVlc3RBUElMaXN0KFBhZ2UsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMubWFrZVJlcXVlc3Qob3B0aW9ucywgbnVsbCk7XG4gICAgICAgIHJldHVybiBuZXcgUGFnZVByb21pc2UodGhpcywgcmVxdWVzdCwgUGFnZSk7XG4gICAgfVxuICAgIGJ1aWxkVVJMKHBhdGgsIHF1ZXJ5KSB7XG4gICAgICAgIGNvbnN0IHVybCA9IGlzQWJzb2x1dGVVUkwocGF0aCkgP1xuICAgICAgICAgICAgbmV3IFVSTChwYXRoKVxuICAgICAgICAgICAgOiBuZXcgVVJMKHRoaXMuYmFzZVVSTCArICh0aGlzLmJhc2VVUkwuZW5kc1dpdGgoJy8nKSAmJiBwYXRoLnN0YXJ0c1dpdGgoJy8nKSA/IHBhdGguc2xpY2UoMSkgOiBwYXRoKSk7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRRdWVyeSA9IHRoaXMuZGVmYXVsdFF1ZXJ5KCk7XG4gICAgICAgIGlmICghaXNFbXB0eU9iaihkZWZhdWx0UXVlcnkpKSB7XG4gICAgICAgICAgICBxdWVyeSA9IHsgLi4uZGVmYXVsdFF1ZXJ5LCAuLi5xdWVyeSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgcXVlcnkgPT09ICdvYmplY3QnICYmIHF1ZXJ5ICYmICFBcnJheS5pc0FycmF5KHF1ZXJ5KSkge1xuICAgICAgICAgICAgdXJsLnNlYXJjaCA9IHRoaXMuc3RyaW5naWZ5UXVlcnkocXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1cmwudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgc3RyaW5naWZ5UXVlcnkocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHF1ZXJ5KVxuICAgICAgICAgICAgLmZpbHRlcigoW18sIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgICAgIC5tYXAoKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBgJHtlbmNvZGVVUklDb21wb25lbnQoa2V5KX09JHtlbmNvZGVVUklDb21wb25lbnQodmFsdWUpfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYCR7ZW5jb2RlVVJJQ29tcG9uZW50KGtleSl9PWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYENhbm5vdCBzdHJpbmdpZnkgdHlwZSAke3R5cGVvZiB2YWx1ZX07IEV4cGVjdGVkIHN0cmluZywgbnVtYmVyLCBib29sZWFuLCBvciBudWxsLiBJZiB5b3UgbmVlZCB0byBwYXNzIG5lc3RlZCBxdWVyeSBwYXJhbWV0ZXJzLCB5b3UgY2FuIG1hbnVhbGx5IGVuY29kZSB0aGVtLCBlLmcuIHsgcXVlcnk6IHsgJ2Zvb1trZXkxXSc6IHZhbHVlMSwgJ2Zvb1trZXkyXSc6IHZhbHVlMiB9IH0sIGFuZCBwbGVhc2Ugb3BlbiBhIEdpdEh1YiBpc3N1ZSByZXF1ZXN0aW5nIGJldHRlciBzdXBwb3J0IGZvciB5b3VyIHVzZSBjYXNlLmApO1xuICAgICAgICB9KVxuICAgICAgICAgICAgLmpvaW4oJyYnKTtcbiAgICB9XG4gICAgYXN5bmMgZmV0Y2hXaXRoVGltZW91dCh1cmwsIGluaXQsIG1zLCBjb250cm9sbGVyKSB7XG4gICAgICAgIGNvbnN0IHsgc2lnbmFsLCAuLi5vcHRpb25zIH0gPSBpbml0IHx8IHt9O1xuICAgICAgICBpZiAoc2lnbmFsKVxuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCBtcyk7XG4gICAgICAgIGNvbnN0IGZldGNoT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICB9O1xuICAgICAgICBpZiAoZmV0Y2hPcHRpb25zLm1ldGhvZCkge1xuICAgICAgICAgICAgLy8gQ3VzdG9tIG1ldGhvZHMgbGlrZSAncGF0Y2gnIG5lZWQgdG8gYmUgdXBwZXJjYXNlZFxuICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvdW5kaWNpL2lzc3Vlcy8yMjk0XG4gICAgICAgICAgICBmZXRjaE9wdGlvbnMubWV0aG9kID0gZmV0Y2hPcHRpb25zLm1ldGhvZC50b1VwcGVyQ2FzZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgIC8vIHVzZSB1bmRlZmluZWQgdGhpcyBiaW5kaW5nOyBmZXRjaCBlcnJvcnMgaWYgYm91bmQgdG8gc29tZXRoaW5nIGVsc2UgaW4gYnJvd3Nlci9jbG91ZGZsYXJlXG4gICAgICAgIHRoaXMuZmV0Y2guY2FsbCh1bmRlZmluZWQsIHVybCwgZmV0Y2hPcHRpb25zKS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBzaG91bGRSZXRyeShyZXNwb25zZSkge1xuICAgICAgICAvLyBOb3RlIHRoaXMgaXMgbm90IGEgc3RhbmRhcmQgaGVhZGVyLlxuICAgICAgICBjb25zdCBzaG91bGRSZXRyeUhlYWRlciA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCd4LXNob3VsZC1yZXRyeScpO1xuICAgICAgICAvLyBJZiB0aGUgc2VydmVyIGV4cGxpY2l0bHkgc2F5cyB3aGV0aGVyIG9yIG5vdCB0byByZXRyeSwgb2JleS5cbiAgICAgICAgaWYgKHNob3VsZFJldHJ5SGVhZGVyID09PSAndHJ1ZScpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgaWYgKHNob3VsZFJldHJ5SGVhZGVyID09PSAnZmFsc2UnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAvLyBSZXRyeSBvbiByZXF1ZXN0IHRpbWVvdXRzLlxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDgpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgLy8gUmV0cnkgb24gbG9jayB0aW1lb3V0cy5cbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDA5KVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIC8vIFJldHJ5IG9uIHJhdGUgbGltaXRzLlxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgLy8gUmV0cnkgaW50ZXJuYWwgZXJyb3JzLlxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID49IDUwMClcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGFzeW5jIHJldHJ5UmVxdWVzdChvcHRpb25zLCByZXRyaWVzUmVtYWluaW5nLCByZXNwb25zZUhlYWRlcnMpIHtcbiAgICAgICAgbGV0IHRpbWVvdXRNaWxsaXM7XG4gICAgICAgIC8vIE5vdGUgdGhlIGByZXRyeS1hZnRlci1tc2AgaGVhZGVyIG1heSBub3QgYmUgc3RhbmRhcmQsIGJ1dCBpcyBhIGdvb2QgaWRlYSBhbmQgd2UnZCBsaWtlIHByb2FjdGl2ZSBzdXBwb3J0IGZvciBpdC5cbiAgICAgICAgY29uc3QgcmV0cnlBZnRlck1pbGxpc0hlYWRlciA9IHJlc3BvbnNlSGVhZGVycz8uWydyZXRyeS1hZnRlci1tcyddO1xuICAgICAgICBpZiAocmV0cnlBZnRlck1pbGxpc0hlYWRlcikge1xuICAgICAgICAgICAgY29uc3QgdGltZW91dE1zID0gcGFyc2VGbG9hdChyZXRyeUFmdGVyTWlsbGlzSGVhZGVyKTtcbiAgICAgICAgICAgIGlmICghTnVtYmVyLmlzTmFOKHRpbWVvdXRNcykpIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0TWlsbGlzID0gdGltZW91dE1zO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEFib3V0IHRoZSBSZXRyeS1BZnRlciBoZWFkZXI6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0hUVFAvSGVhZGVycy9SZXRyeS1BZnRlclxuICAgICAgICBjb25zdCByZXRyeUFmdGVySGVhZGVyID0gcmVzcG9uc2VIZWFkZXJzPy5bJ3JldHJ5LWFmdGVyJ107XG4gICAgICAgIGlmIChyZXRyeUFmdGVySGVhZGVyICYmICF0aW1lb3V0TWlsbGlzKSB7XG4gICAgICAgICAgICBjb25zdCB0aW1lb3V0U2Vjb25kcyA9IHBhcnNlRmxvYXQocmV0cnlBZnRlckhlYWRlcik7XG4gICAgICAgICAgICBpZiAoIU51bWJlci5pc05hTih0aW1lb3V0U2Vjb25kcykpIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0TWlsbGlzID0gdGltZW91dFNlY29uZHMgKiAxMDAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGltZW91dE1pbGxpcyA9IERhdGUucGFyc2UocmV0cnlBZnRlckhlYWRlcikgLSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBBUEkgYXNrcyB1cyB0byB3YWl0IGEgY2VydGFpbiBhbW91bnQgb2YgdGltZSAoYW5kIGl0J3MgYSByZWFzb25hYmxlIGFtb3VudCksXG4gICAgICAgIC8vIGp1c3QgZG8gd2hhdCBpdCBzYXlzLCBidXQgb3RoZXJ3aXNlIGNhbGN1bGF0ZSBhIGRlZmF1bHRcbiAgICAgICAgaWYgKCEodGltZW91dE1pbGxpcyAmJiAwIDw9IHRpbWVvdXRNaWxsaXMgJiYgdGltZW91dE1pbGxpcyA8IDYwICogMTAwMCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSBvcHRpb25zLm1heFJldHJpZXMgPz8gdGhpcy5tYXhSZXRyaWVzO1xuICAgICAgICAgICAgdGltZW91dE1pbGxpcyA9IHRoaXMuY2FsY3VsYXRlRGVmYXVsdFJldHJ5VGltZW91dE1pbGxpcyhyZXRyaWVzUmVtYWluaW5nLCBtYXhSZXRyaWVzKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBzbGVlcCh0aW1lb3V0TWlsbGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMubWFrZVJlcXVlc3Qob3B0aW9ucywgcmV0cmllc1JlbWFpbmluZyAtIDEpO1xuICAgIH1cbiAgICBjYWxjdWxhdGVEZWZhdWx0UmV0cnlUaW1lb3V0TWlsbGlzKHJldHJpZXNSZW1haW5pbmcsIG1heFJldHJpZXMpIHtcbiAgICAgICAgY29uc3QgaW5pdGlhbFJldHJ5RGVsYXkgPSAwLjU7XG4gICAgICAgIGNvbnN0IG1heFJldHJ5RGVsYXkgPSA4LjA7XG4gICAgICAgIGNvbnN0IG51bVJldHJpZXMgPSBtYXhSZXRyaWVzIC0gcmV0cmllc1JlbWFpbmluZztcbiAgICAgICAgLy8gQXBwbHkgZXhwb25lbnRpYWwgYmFja29mZiwgYnV0IG5vdCBtb3JlIHRoYW4gdGhlIG1heC5cbiAgICAgICAgY29uc3Qgc2xlZXBTZWNvbmRzID0gTWF0aC5taW4oaW5pdGlhbFJldHJ5RGVsYXkgKiBNYXRoLnBvdygyLCBudW1SZXRyaWVzKSwgbWF4UmV0cnlEZWxheSk7XG4gICAgICAgIC8vIEFwcGx5IHNvbWUgaml0dGVyLCB0YWtlIHVwIHRvIGF0IG1vc3QgMjUgcGVyY2VudCBvZiB0aGUgcmV0cnkgdGltZS5cbiAgICAgICAgY29uc3Qgaml0dGVyID0gMSAtIE1hdGgucmFuZG9tKCkgKiAwLjI1O1xuICAgICAgICByZXR1cm4gc2xlZXBTZWNvbmRzICogaml0dGVyICogMTAwMDtcbiAgICB9XG4gICAgZ2V0VXNlckFnZW50KCkge1xuICAgICAgICByZXR1cm4gYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfS9KUyAke1ZFUlNJT059YDtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJzdHJhY3RQYWdlIHtcbiAgICBjb25zdHJ1Y3RvcihjbGllbnQsIHJlc3BvbnNlLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIF9BYnN0cmFjdFBhZ2VfY2xpZW50LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9BYnN0cmFjdFBhZ2VfY2xpZW50LCBjbGllbnQsIFwiZlwiKTtcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICAgICAgICB0aGlzLmJvZHkgPSBib2R5O1xuICAgIH1cbiAgICBoYXNOZXh0UGFnZSgpIHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmdldFBhZ2luYXRlZEl0ZW1zKCk7XG4gICAgICAgIGlmICghaXRlbXMubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdGhpcy5uZXh0UGFnZUluZm8oKSAhPSBudWxsO1xuICAgIH1cbiAgICBhc3luYyBnZXROZXh0UGFnZSgpIHtcbiAgICAgICAgY29uc3QgbmV4dEluZm8gPSB0aGlzLm5leHRQYWdlSW5mbygpO1xuICAgICAgICBpZiAoIW5leHRJbmZvKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoJ05vIG5leHQgcGFnZSBleHBlY3RlZDsgcGxlYXNlIGNoZWNrIGAuaGFzTmV4dFBhZ2UoKWAgYmVmb3JlIGNhbGxpbmcgYC5nZXROZXh0UGFnZSgpYC4nKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuZXh0T3B0aW9ucyA9IHsgLi4udGhpcy5vcHRpb25zIH07XG4gICAgICAgIGlmICgncGFyYW1zJyBpbiBuZXh0SW5mbyAmJiB0eXBlb2YgbmV4dE9wdGlvbnMucXVlcnkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBuZXh0T3B0aW9ucy5xdWVyeSA9IHsgLi4ubmV4dE9wdGlvbnMucXVlcnksIC4uLm5leHRJbmZvLnBhcmFtcyB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCd1cmwnIGluIG5leHRJbmZvKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBbLi4uT2JqZWN0LmVudHJpZXMobmV4dE9wdGlvbnMucXVlcnkgfHwge30pLCAuLi5uZXh0SW5mby51cmwuc2VhcmNoUGFyYW1zLmVudHJpZXMoKV07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBwYXJhbXMpIHtcbiAgICAgICAgICAgICAgICBuZXh0SW5mby51cmwuc2VhcmNoUGFyYW1zLnNldChrZXksIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5leHRPcHRpb25zLnF1ZXJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgbmV4dE9wdGlvbnMucGF0aCA9IG5leHRJbmZvLnVybC50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhd2FpdCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdFBhZ2VfY2xpZW50LCBcImZcIikucmVxdWVzdEFQSUxpc3QodGhpcy5jb25zdHJ1Y3RvciwgbmV4dE9wdGlvbnMpO1xuICAgIH1cbiAgICBhc3luYyAqaXRlclBhZ2VzKCkge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXRoaXMtYWxpYXNcbiAgICAgICAgbGV0IHBhZ2UgPSB0aGlzO1xuICAgICAgICB5aWVsZCBwYWdlO1xuICAgICAgICB3aGlsZSAocGFnZS5oYXNOZXh0UGFnZSgpKSB7XG4gICAgICAgICAgICBwYWdlID0gYXdhaXQgcGFnZS5nZXROZXh0UGFnZSgpO1xuICAgICAgICAgICAgeWllbGQgcGFnZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyAqWyhfQWJzdHJhY3RQYWdlX2NsaWVudCA9IG5ldyBXZWFrTWFwKCksIFN5bWJvbC5hc3luY0l0ZXJhdG9yKV0oKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgcGFnZSBvZiB0aGlzLml0ZXJQYWdlcygpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcGFnZS5nZXRQYWdpbmF0ZWRJdGVtcygpKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbi8qKlxuICogVGhpcyBzdWJjbGFzcyBvZiBQcm9taXNlIHdpbGwgcmVzb2x2ZSB0byBhbiBpbnN0YW50aWF0ZWQgUGFnZSBvbmNlIHRoZSByZXF1ZXN0IGNvbXBsZXRlcy5cbiAqXG4gKiBJdCBhbHNvIGltcGxlbWVudHMgQXN5bmNJdGVyYWJsZSB0byBhbGxvdyBhdXRvLXBhZ2luYXRpbmcgaXRlcmF0aW9uIG9uIGFuIHVuYXdhaXRlZCBsaXN0IGNhbGwsIGVnOlxuICpcbiAqICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGllbnQuaXRlbXMubGlzdCgpKSB7XG4gKiAgICAgIGNvbnNvbGUubG9nKGl0ZW0pXG4gKiAgICB9XG4gKi9cbmV4cG9ydCBjbGFzcyBQYWdlUHJvbWlzZSBleHRlbmRzIEFQSVByb21pc2Uge1xuICAgIGNvbnN0cnVjdG9yKGNsaWVudCwgcmVxdWVzdCwgUGFnZSkge1xuICAgICAgICBzdXBlcihyZXF1ZXN0LCBhc3luYyAocHJvcHMpID0+IG5ldyBQYWdlKGNsaWVudCwgcHJvcHMucmVzcG9uc2UsIGF3YWl0IGRlZmF1bHRQYXJzZVJlc3BvbnNlKHByb3BzKSwgcHJvcHMub3B0aW9ucykpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBbGxvdyBhdXRvLXBhZ2luYXRpbmcgaXRlcmF0aW9uIG9uIGFuIHVuYXdhaXRlZCBsaXN0IGNhbGwsIGVnOlxuICAgICAqXG4gICAgICogICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsaWVudC5pdGVtcy5saXN0KCkpIHtcbiAgICAgKiAgICAgIGNvbnNvbGUubG9nKGl0ZW0pXG4gICAgICogICAgfVxuICAgICAqL1xuICAgIGFzeW5jICpbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgICBjb25zdCBwYWdlID0gYXdhaXQgdGhpcztcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHBhZ2UpIHtcbiAgICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIH1cbiAgICB9XG59XG5leHBvcnQgY29uc3QgY3JlYXRlUmVzcG9uc2VIZWFkZXJzID0gKGhlYWRlcnMpID0+IHtcbiAgICByZXR1cm4gbmV3IFByb3h5KE9iamVjdC5mcm9tRW50cmllcyhcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgaGVhZGVycy5lbnRyaWVzKCkpLCB7XG4gICAgICAgIGdldCh0YXJnZXQsIG5hbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGtleSA9IG5hbWUudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5LnRvTG93ZXJDYXNlKCldIHx8IHRhcmdldFtrZXldO1xuICAgICAgICB9LFxuICAgIH0pO1xufTtcbi8vIFRoaXMgaXMgcmVxdWlyZWQgc28gdGhhdCB3ZSBjYW4gZGV0ZXJtaW5lIGlmIGEgZ2l2ZW4gb2JqZWN0IG1hdGNoZXMgdGhlIFJlcXVlc3RPcHRpb25zXG4vLyB0eXBlIGF0IHJ1bnRpbWUuIFdoaWxlIHRoaXMgcmVxdWlyZXMgZHVwbGljYXRpb24sIGl0IGlzIGVuZm9yY2VkIGJ5IHRoZSBUeXBlU2NyaXB0XG4vLyBjb21waWxlciBzdWNoIHRoYXQgYW55IG1pc3NpbmcgLyBleHRyYW5lb3VzIGtleXMgd2lsbCBjYXVzZSBhbiBlcnJvci5cbmNvbnN0IHJlcXVlc3RPcHRpb25zS2V5cyA9IHtcbiAgICBtZXRob2Q6IHRydWUsXG4gICAgcGF0aDogdHJ1ZSxcbiAgICBxdWVyeTogdHJ1ZSxcbiAgICBib2R5OiB0cnVlLFxuICAgIGhlYWRlcnM6IHRydWUsXG4gICAgbWF4UmV0cmllczogdHJ1ZSxcbiAgICBzdHJlYW06IHRydWUsXG4gICAgdGltZW91dDogdHJ1ZSxcbiAgICBodHRwQWdlbnQ6IHRydWUsXG4gICAgc2lnbmFsOiB0cnVlLFxuICAgIGlkZW1wb3RlbmN5S2V5OiB0cnVlLFxuICAgIF9fbWV0YWRhdGE6IHRydWUsXG4gICAgX19iaW5hcnlSZXF1ZXN0OiB0cnVlLFxuICAgIF9fYmluYXJ5UmVzcG9uc2U6IHRydWUsXG4gICAgX19zdHJlYW1DbGFzczogdHJ1ZSxcbn07XG5leHBvcnQgY29uc3QgaXNSZXF1ZXN0T3B0aW9ucyA9IChvYmopID0+IHtcbiAgICByZXR1cm4gKHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmXG4gICAgICAgIG9iaiAhPT0gbnVsbCAmJlxuICAgICAgICAhaXNFbXB0eU9iaihvYmopICYmXG4gICAgICAgIE9iamVjdC5rZXlzKG9iaikuZXZlcnkoKGspID0+IGhhc093bihyZXF1ZXN0T3B0aW9uc0tleXMsIGspKSk7XG59O1xuY29uc3QgZ2V0UGxhdGZvcm1Qcm9wZXJ0aWVzID0gKCkgPT4ge1xuICAgIGlmICh0eXBlb2YgRGVubyAhPT0gJ3VuZGVmaW5lZCcgJiYgRGVuby5idWlsZCAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtTGFuZyc6ICdqcycsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUGFja2FnZS1WZXJzaW9uJzogVkVSU0lPTixcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1PUyc6IG5vcm1hbGl6ZVBsYXRmb3JtKERlbm8uYnVpbGQub3MpLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUFyY2gnOiBub3JtYWxpemVBcmNoKERlbm8uYnVpbGQuYXJjaCksXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZSc6ICdkZW5vJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lLVZlcnNpb24nOiB0eXBlb2YgRGVuby52ZXJzaW9uID09PSAnc3RyaW5nJyA/IERlbm8udmVyc2lvbiA6IERlbm8udmVyc2lvbj8uZGVubyA/PyAndW5rbm93bicsXG4gICAgICAgIH07XG4gICAgfVxuICAgIGlmICh0eXBlb2YgRWRnZVJ1bnRpbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtTGFuZyc6ICdqcycsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUGFja2FnZS1WZXJzaW9uJzogVkVSU0lPTixcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1PUyc6ICdVbmtub3duJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1BcmNoJzogYG90aGVyOiR7RWRnZVJ1bnRpbWV9YCxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lJzogJ2VkZ2UnLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUtVmVyc2lvbic6IHByb2Nlc3MudmVyc2lvbixcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLy8gQ2hlY2sgaWYgTm9kZS5qc1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnID8gcHJvY2VzcyA6IDApID09PSAnW29iamVjdCBwcm9jZXNzXScpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1MYW5nJzogJ2pzJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1QYWNrYWdlLVZlcnNpb24nOiBWRVJTSU9OLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLU9TJzogbm9ybWFsaXplUGxhdGZvcm0ocHJvY2Vzcy5wbGF0Zm9ybSksXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtQXJjaCc6IG5vcm1hbGl6ZUFyY2gocHJvY2Vzcy5hcmNoKSxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lJzogJ25vZGUnLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUtVmVyc2lvbic6IHByb2Nlc3MudmVyc2lvbixcbiAgICAgICAgfTtcbiAgICB9XG4gICAgY29uc3QgYnJvd3NlckluZm8gPSBnZXRCcm93c2VySW5mbygpO1xuICAgIGlmIChicm93c2VySW5mbykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUxhbmcnOiAnanMnLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVBhY2thZ2UtVmVyc2lvbic6IFZFUlNJT04sXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtT1MnOiAnVW5rbm93bicsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtQXJjaCc6ICd1bmtub3duJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lJzogYGJyb3dzZXI6JHticm93c2VySW5mby5icm93c2VyfWAsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZS1WZXJzaW9uJzogYnJvd3NlckluZm8udmVyc2lvbixcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLy8gVE9ETyBhZGQgc3VwcG9ydCBmb3IgQ2xvdWRmbGFyZSB3b3JrZXJzLCBldGMuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ1gtU3RhaW5sZXNzLUxhbmcnOiAnanMnLFxuICAgICAgICAnWC1TdGFpbmxlc3MtUGFja2FnZS1WZXJzaW9uJzogVkVSU0lPTixcbiAgICAgICAgJ1gtU3RhaW5sZXNzLU9TJzogJ1Vua25vd24nLFxuICAgICAgICAnWC1TdGFpbmxlc3MtQXJjaCc6ICd1bmtub3duJyxcbiAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUnOiAndW5rbm93bicsXG4gICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lLVZlcnNpb24nOiAndW5rbm93bicsXG4gICAgfTtcbn07XG4vLyBOb3RlOiBtb2RpZmllZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9KUy1EZXZUb29scy9ob3N0LWVudmlyb25tZW50L2Jsb2IvYjFhYjc5ZWNkZTM3ZGI1ZDZlMTYzYzA1MGU1NGZlN2QyODdkN2M5Mi9zcmMvaXNvbW9ycGhpYy5icm93c2VyLnRzXG5mdW5jdGlvbiBnZXRCcm93c2VySW5mbygpIHtcbiAgICBpZiAodHlwZW9mIG5hdmlnYXRvciA9PT0gJ3VuZGVmaW5lZCcgfHwgIW5hdmlnYXRvcikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgLy8gTk9URTogVGhlIG9yZGVyIG1hdHRlcnMgaGVyZSFcbiAgICBjb25zdCBicm93c2VyUGF0dGVybnMgPSBbXG4gICAgICAgIHsga2V5OiAnZWRnZScsIHBhdHRlcm46IC9FZGdlKD86XFxXKyhcXGQrKVxcLihcXGQrKSg/OlxcLihcXGQrKSk/KT8vIH0sXG4gICAgICAgIHsga2V5OiAnaWUnLCBwYXR0ZXJuOiAvTVNJRSg/OlxcVysoXFxkKylcXC4oXFxkKykoPzpcXC4oXFxkKykpPyk/LyB9LFxuICAgICAgICB7IGtleTogJ2llJywgcGF0dGVybjogL1RyaWRlbnQoPzouKnJ2XFw6KFxcZCspXFwuKFxcZCspKD86XFwuKFxcZCspKT8pPy8gfSxcbiAgICAgICAgeyBrZXk6ICdjaHJvbWUnLCBwYXR0ZXJuOiAvQ2hyb21lKD86XFxXKyhcXGQrKVxcLihcXGQrKSg/OlxcLihcXGQrKSk/KT8vIH0sXG4gICAgICAgIHsga2V5OiAnZmlyZWZveCcsIHBhdHRlcm46IC9GaXJlZm94KD86XFxXKyhcXGQrKVxcLihcXGQrKSg/OlxcLihcXGQrKSk/KT8vIH0sXG4gICAgICAgIHsga2V5OiAnc2FmYXJpJywgcGF0dGVybjogLyg/OlZlcnNpb25cXFcrKFxcZCspXFwuKFxcZCspKD86XFwuKFxcZCspKT8pPyg/OlxcVytNb2JpbGVcXFMqKT9cXFcrU2FmYXJpLyB9LFxuICAgIF07XG4gICAgLy8gRmluZCB0aGUgRklSU1QgbWF0Y2hpbmcgYnJvd3NlclxuICAgIGZvciAoY29uc3QgeyBrZXksIHBhdHRlcm4gfSBvZiBicm93c2VyUGF0dGVybnMpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgY29uc3QgbWFqb3IgPSBtYXRjaFsxXSB8fCAwO1xuICAgICAgICAgICAgY29uc3QgbWlub3IgPSBtYXRjaFsyXSB8fCAwO1xuICAgICAgICAgICAgY29uc3QgcGF0Y2ggPSBtYXRjaFszXSB8fCAwO1xuICAgICAgICAgICAgcmV0dXJuIHsgYnJvd3Nlcjoga2V5LCB2ZXJzaW9uOiBgJHttYWpvcn0uJHttaW5vcn0uJHtwYXRjaH1gIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5jb25zdCBub3JtYWxpemVBcmNoID0gKGFyY2gpID0+IHtcbiAgICAvLyBOb2RlIGRvY3M6XG4gICAgLy8gLSBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzYXJjaFxuICAgIC8vIERlbm8gZG9jczpcbiAgICAvLyAtIGh0dHBzOi8vZG9jLmRlbm8ubGFuZC9kZW5vL3N0YWJsZS9+L0Rlbm8uYnVpbGRcbiAgICBpZiAoYXJjaCA9PT0gJ3gzMicpXG4gICAgICAgIHJldHVybiAneDMyJztcbiAgICBpZiAoYXJjaCA9PT0gJ3g4Nl82NCcgfHwgYXJjaCA9PT0gJ3g2NCcpXG4gICAgICAgIHJldHVybiAneDY0JztcbiAgICBpZiAoYXJjaCA9PT0gJ2FybScpXG4gICAgICAgIHJldHVybiAnYXJtJztcbiAgICBpZiAoYXJjaCA9PT0gJ2FhcmNoNjQnIHx8IGFyY2ggPT09ICdhcm02NCcpXG4gICAgICAgIHJldHVybiAnYXJtNjQnO1xuICAgIGlmIChhcmNoKVxuICAgICAgICByZXR1cm4gYG90aGVyOiR7YXJjaH1gO1xuICAgIHJldHVybiAndW5rbm93bic7XG59O1xuY29uc3Qgbm9ybWFsaXplUGxhdGZvcm0gPSAocGxhdGZvcm0pID0+IHtcbiAgICAvLyBOb2RlIHBsYXRmb3JtczpcbiAgICAvLyAtIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NwbGF0Zm9ybVxuICAgIC8vIERlbm8gcGxhdGZvcm1zOlxuICAgIC8vIC0gaHR0cHM6Ly9kb2MuZGVuby5sYW5kL2Rlbm8vc3RhYmxlL34vRGVuby5idWlsZFxuICAgIC8vIC0gaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm8vaXNzdWVzLzE0Nzk5XG4gICAgcGxhdGZvcm0gPSBwbGF0Zm9ybS50b0xvd2VyQ2FzZSgpO1xuICAgIC8vIE5PVEU6IHRoaXMgaU9TIGNoZWNrIGlzIHVudGVzdGVkIGFuZCBtYXkgbm90IHdvcmtcbiAgICAvLyBOb2RlIGRvZXMgbm90IHdvcmsgbmF0aXZlbHkgb24gSU9TLCB0aGVyZSBpcyBhIGZvcmsgYXRcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzLW1vYmlsZS9ub2RlanMtbW9iaWxlXG4gICAgLy8gaG93ZXZlciBpdCBpcyB1bmtub3duIGF0IHRoZSB0aW1lIG9mIHdyaXRpbmcgaG93IHRvIGRldGVjdCBpZiBpdCBpcyBydW5uaW5nXG4gICAgaWYgKHBsYXRmb3JtLmluY2x1ZGVzKCdpb3MnKSlcbiAgICAgICAgcmV0dXJuICdpT1MnO1xuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ2FuZHJvaWQnKVxuICAgICAgICByZXR1cm4gJ0FuZHJvaWQnO1xuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpXG4gICAgICAgIHJldHVybiAnTWFjT1MnO1xuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJylcbiAgICAgICAgcmV0dXJuICdXaW5kb3dzJztcbiAgICBpZiAocGxhdGZvcm0gPT09ICdmcmVlYnNkJylcbiAgICAgICAgcmV0dXJuICdGcmVlQlNEJztcbiAgICBpZiAocGxhdGZvcm0gPT09ICdvcGVuYnNkJylcbiAgICAgICAgcmV0dXJuICdPcGVuQlNEJztcbiAgICBpZiAocGxhdGZvcm0gPT09ICdsaW51eCcpXG4gICAgICAgIHJldHVybiAnTGludXgnO1xuICAgIGlmIChwbGF0Zm9ybSlcbiAgICAgICAgcmV0dXJuIGBPdGhlcjoke3BsYXRmb3JtfWA7XG4gICAgcmV0dXJuICdVbmtub3duJztcbn07XG5sZXQgX3BsYXRmb3JtSGVhZGVycztcbmNvbnN0IGdldFBsYXRmb3JtSGVhZGVycyA9ICgpID0+IHtcbiAgICByZXR1cm4gKF9wbGF0Zm9ybUhlYWRlcnMgPz8gKF9wbGF0Zm9ybUhlYWRlcnMgPSBnZXRQbGF0Zm9ybVByb3BlcnRpZXMoKSkpO1xufTtcbmV4cG9ydCBjb25zdCBzYWZlSlNPTiA9ICh0ZXh0KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCk7XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59O1xuLy8gaHR0cHM6Ly91cmwuc3BlYy53aGF0d2cub3JnLyN1cmwtc2NoZW1lLXN0cmluZ1xuY29uc3Qgc3RhcnRzV2l0aFNjaGVtZVJlZ2V4cCA9IC9eW2Etel1bYS16MC05Ky4tXSo6L2k7XG5jb25zdCBpc0Fic29sdXRlVVJMID0gKHVybCkgPT4ge1xuICAgIHJldHVybiBzdGFydHNXaXRoU2NoZW1lUmVnZXhwLnRlc3QodXJsKTtcbn07XG5leHBvcnQgY29uc3Qgc2xlZXAgPSAobXMpID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG5jb25zdCB2YWxpZGF0ZVBvc2l0aXZlSW50ZWdlciA9IChuYW1lLCBuKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBuICE9PSAnbnVtYmVyJyB8fCAhTnVtYmVyLmlzSW50ZWdlcihuKSkge1xuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYCR7bmFtZX0gbXVzdCBiZSBhbiBpbnRlZ2VyYCk7XG4gICAgfVxuICAgIGlmIChuIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYCR7bmFtZX0gbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXJgKTtcbiAgICB9XG4gICAgcmV0dXJuIG47XG59O1xuZXhwb3J0IGNvbnN0IGNhc3RUb0Vycm9yID0gKGVycikgPT4ge1xuICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcilcbiAgICAgICAgcmV0dXJuIGVycjtcbiAgICBpZiAodHlwZW9mIGVyciA9PT0gJ29iamVjdCcgJiYgZXJyICE9PSBudWxsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEVycm9yKEpTT04uc3RyaW5naWZ5KGVycikpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIHsgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IEVycm9yKGVycik7XG59O1xuZXhwb3J0IGNvbnN0IGVuc3VyZVByZXNlbnQgPSAodmFsdWUpID0+IHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBFeHBlY3RlZCBhIHZhbHVlIHRvIGJlIGdpdmVuIGJ1dCByZWNlaXZlZCAke3ZhbHVlfSBpbnN0ZWFkLmApO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG4vKipcbiAqIFJlYWQgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUuXG4gKlxuICogVHJpbXMgYmVnaW5uaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLlxuICpcbiAqIFdpbGwgcmV0dXJuIHVuZGVmaW5lZCBpZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgZG9lc24ndCBleGlzdCBvciBjYW5ub3QgYmUgYWNjZXNzZWQuXG4gKi9cbmV4cG9ydCBjb25zdCByZWFkRW52ID0gKGVudikgPT4ge1xuICAgIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52Py5bZW52XT8udHJpbSgpID8/IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBEZW5vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gRGVuby5lbnY/LmdldD8uKGVudik/LnRyaW0oKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5leHBvcnQgY29uc3QgY29lcmNlSW50ZWdlciA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKVxuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZCh2YWx1ZSk7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiBwYXJzZUludCh2YWx1ZSwgMTApO1xuICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgQ291bGQgbm90IGNvZXJjZSAke3ZhbHVlfSAodHlwZTogJHt0eXBlb2YgdmFsdWV9KSBpbnRvIGEgbnVtYmVyYCk7XG59O1xuZXhwb3J0IGNvbnN0IGNvZXJjZUZsb2F0ID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpXG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQodmFsdWUpO1xuICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgQ291bGQgbm90IGNvZXJjZSAke3ZhbHVlfSAodHlwZTogJHt0eXBlb2YgdmFsdWV9KSBpbnRvIGEgbnVtYmVyYCk7XG59O1xuZXhwb3J0IGNvbnN0IGNvZXJjZUJvb2xlYW4gPSAodmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpXG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIHZhbHVlID09PSAndHJ1ZSc7XG4gICAgcmV0dXJuIEJvb2xlYW4odmFsdWUpO1xufTtcbmV4cG9ydCBjb25zdCBtYXliZUNvZXJjZUludGVnZXIgPSAodmFsdWUpID0+IHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gY29lcmNlSW50ZWdlcih2YWx1ZSk7XG59O1xuZXhwb3J0IGNvbnN0IG1heWJlQ29lcmNlRmxvYXQgPSAodmFsdWUpID0+IHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gY29lcmNlRmxvYXQodmFsdWUpO1xufTtcbmV4cG9ydCBjb25zdCBtYXliZUNvZXJjZUJvb2xlYW4gPSAodmFsdWUpID0+IHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gY29lcmNlQm9vbGVhbih2YWx1ZSk7XG59O1xuLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM0NDkxMjg3XG5leHBvcnQgZnVuY3Rpb24gaXNFbXB0eU9iaihvYmopIHtcbiAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgZm9yIChjb25zdCBfayBpbiBvYmopXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cbi8vIGh0dHBzOi8vZXNsaW50Lm9yZy9kb2NzL2xhdGVzdC9ydWxlcy9uby1wcm90b3R5cGUtYnVpbHRpbnNcbmV4cG9ydCBmdW5jdGlvbiBoYXNPd24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbn1cbi8qKlxuICogQ29waWVzIGhlYWRlcnMgZnJvbSBcIm5ld0hlYWRlcnNcIiBvbnRvIFwidGFyZ2V0SGVhZGVyc1wiLFxuICogdXNpbmcgbG93ZXItY2FzZSBmb3IgYWxsIHByb3BlcnRpZXMsXG4gKiBpZ25vcmluZyBhbnkga2V5cyB3aXRoIHVuZGVmaW5lZCB2YWx1ZXMsXG4gKiBhbmQgZGVsZXRpbmcgYW55IGtleXMgd2l0aCBudWxsIHZhbHVlcy5cbiAqL1xuZnVuY3Rpb24gYXBwbHlIZWFkZXJzTXV0KHRhcmdldEhlYWRlcnMsIG5ld0hlYWRlcnMpIHtcbiAgICBmb3IgKGNvbnN0IGsgaW4gbmV3SGVhZGVycykge1xuICAgICAgICBpZiAoIWhhc093bihuZXdIZWFkZXJzLCBrKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBsb3dlcktleSA9IGsudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKCFsb3dlcktleSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCB2YWwgPSBuZXdIZWFkZXJzW2tdO1xuICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgICBkZWxldGUgdGFyZ2V0SGVhZGVyc1tsb3dlcktleV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRhcmdldEhlYWRlcnNbbG93ZXJLZXldID0gdmFsO1xuICAgICAgICB9XG4gICAgfVxufVxuY29uc3QgU0VOU0lUSVZFX0hFQURFUlMgPSBuZXcgU2V0KFsnYXV0aG9yaXphdGlvbicsICdhcGkta2V5J10pO1xuZXhwb3J0IGZ1bmN0aW9uIGRlYnVnKGFjdGlvbiwgLi4uYXJncykge1xuICAgIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2Vzcz8uZW52Py5bJ0RFQlVHJ10gPT09ICd0cnVlJykge1xuICAgICAgICBjb25zdCBtb2RpZmllZEFyZ3MgPSBhcmdzLm1hcCgoYXJnKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWFyZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcmc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDaGVjayBmb3Igc2Vuc2l0aXZlIGhlYWRlcnMgaW4gcmVxdWVzdCBib2R5ICdoZWFkZXJzJyBvYmplY3RcbiAgICAgICAgICAgIGlmIChhcmdbJ2hlYWRlcnMnXSkge1xuICAgICAgICAgICAgICAgIC8vIGNsb25lIHNvIHdlIGRvbid0IG11dGF0ZVxuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVkQXJnID0geyAuLi5hcmcsIGhlYWRlcnM6IHsgLi4uYXJnWydoZWFkZXJzJ10gfSB9O1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaGVhZGVyIGluIGFyZ1snaGVhZGVycyddKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChTRU5TSVRJVkVfSEVBREVSUy5oYXMoaGVhZGVyLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RpZmllZEFyZ1snaGVhZGVycyddW2hlYWRlcl0gPSAnUkVEQUNURUQnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtb2RpZmllZEFyZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBtb2RpZmllZEFyZyA9IG51bGw7XG4gICAgICAgICAgICAvLyBDaGVjayBmb3Igc2Vuc2l0aXZlIGhlYWRlcnMgaW4gaGVhZGVycyBvYmplY3RcbiAgICAgICAgICAgIGZvciAoY29uc3QgaGVhZGVyIGluIGFyZykge1xuICAgICAgICAgICAgICAgIGlmIChTRU5TSVRJVkVfSEVBREVSUy5oYXMoaGVhZGVyLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGF2b2lkIG1ha2luZyBhIGNvcHkgdW50aWwgd2UgbmVlZCB0b1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZEFyZyA/PyAobW9kaWZpZWRBcmcgPSB7IC4uLmFyZyB9KTtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWRBcmdbaGVhZGVyXSA9ICdSRURBQ1RFRCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG1vZGlmaWVkQXJnID8/IGFyZztcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBPcGVuQUk6REVCVUc6JHthY3Rpb259YCwgLi4ubW9kaWZpZWRBcmdzKTtcbiAgICB9XG59XG4vKipcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMTE3NTIzXG4gKi9cbmNvbnN0IHV1aWQ0ID0gKCkgPT4ge1xuICAgIHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIChjKSA9PiB7XG4gICAgICAgIGNvbnN0IHIgPSAoTWF0aC5yYW5kb20oKSAqIDE2KSB8IDA7XG4gICAgICAgIGNvbnN0IHYgPSBjID09PSAneCcgPyByIDogKHIgJiAweDMpIHwgMHg4O1xuICAgICAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gICAgfSk7XG59O1xuZXhwb3J0IGNvbnN0IGlzUnVubmluZ0luQnJvd3NlciA9ICgpID0+IHtcbiAgICByZXR1cm4gKFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHR5cGVvZiB3aW5kb3cuZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcpO1xufTtcbmV4cG9ydCBjb25zdCBpc0hlYWRlcnNQcm90b2NvbCA9IChoZWFkZXJzKSA9PiB7XG4gICAgcmV0dXJuIHR5cGVvZiBoZWFkZXJzPy5nZXQgPT09ICdmdW5jdGlvbic7XG59O1xuZXhwb3J0IGNvbnN0IGdldFJlcXVpcmVkSGVhZGVyID0gKGhlYWRlcnMsIGhlYWRlcikgPT4ge1xuICAgIGNvbnN0IGZvdW5kSGVhZGVyID0gZ2V0SGVhZGVyKGhlYWRlcnMsIGhlYWRlcik7XG4gICAgaWYgKGZvdW5kSGVhZGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke2hlYWRlcn0gaGVhZGVyYCk7XG4gICAgfVxuICAgIHJldHVybiBmb3VuZEhlYWRlcjtcbn07XG5leHBvcnQgY29uc3QgZ2V0SGVhZGVyID0gKGhlYWRlcnMsIGhlYWRlcikgPT4ge1xuICAgIGNvbnN0IGxvd2VyQ2FzZWRIZWFkZXIgPSBoZWFkZXIudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoaXNIZWFkZXJzUHJvdG9jb2woaGVhZGVycykpIHtcbiAgICAgICAgLy8gdG8gZGVhbCB3aXRoIHRoZSBjYXNlIHdoZXJlIHRoZSBoZWFkZXIgbG9va3MgbGlrZSBTdGFpbmxlc3MtRXZlbnQtSWRcbiAgICAgICAgY29uc3QgaW50ZXJjYXBzSGVhZGVyID0gaGVhZGVyWzBdPy50b1VwcGVyQ2FzZSgpICtcbiAgICAgICAgICAgIGhlYWRlci5zdWJzdHJpbmcoMSkucmVwbGFjZSgvKFteXFx3XSkoXFx3KS9nLCAoX20sIGcxLCBnMikgPT4gZzEgKyBnMi50b1VwcGVyQ2FzZSgpKTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgW2hlYWRlciwgbG93ZXJDYXNlZEhlYWRlciwgaGVhZGVyLnRvVXBwZXJDYXNlKCksIGludGVyY2Fwc0hlYWRlcl0pIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gaGVhZGVycy5nZXQoa2V5KTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhoZWFkZXJzKSkge1xuICAgICAgICBpZiAoa2V5LnRvTG93ZXJDYXNlKCkgPT09IGxvd2VyQ2FzZWRIZWFkZXIpIHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZS5sZW5ndGggPD0gMSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlWzBdO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgUmVjZWl2ZWQgJHt2YWx1ZS5sZW5ndGh9IGVudHJpZXMgZm9yIHRoZSAke2hlYWRlcn0gaGVhZGVyLCB1c2luZyB0aGUgZmlyc3QgZW50cnkuYCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59O1xuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIHRvIEJhc2U2NCBmb3JtYXQuXG4gKi9cbmV4cG9ydCBjb25zdCB0b0Jhc2U2NCA9IChzdHIpID0+IHtcbiAgICBpZiAoIXN0cilcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIGlmICh0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20oc3RyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYnRvYSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIGJ0b2Eoc3RyKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKCdDYW5ub3QgZ2VuZXJhdGUgYjY0IHN0cmluZzsgRXhwZWN0ZWQgYEJ1ZmZlcmAgb3IgYGJ0b2FgIHRvIGJlIGRlZmluZWQnKTtcbn07XG5leHBvcnQgZnVuY3Rpb24gaXNPYmoob2JqKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KG9iaik7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb3JlLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgY2FzdFRvRXJyb3IgfSBmcm9tIFwiLi9jb3JlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIE9wZW5BSUVycm9yIGV4dGVuZHMgRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIEFQSUVycm9yIGV4dGVuZHMgT3BlbkFJRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpIHtcbiAgICAgICAgc3VwZXIoYCR7QVBJRXJyb3IubWFrZU1lc3NhZ2Uoc3RhdHVzLCBlcnJvciwgbWVzc2FnZSl9YCk7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzO1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBoZWFkZXJzO1xuICAgICAgICB0aGlzLnJlcXVlc3RfaWQgPSBoZWFkZXJzPy5bJ3gtcmVxdWVzdC1pZCddO1xuICAgICAgICB0aGlzLmVycm9yID0gZXJyb3I7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBlcnJvcjtcbiAgICAgICAgdGhpcy5jb2RlID0gZGF0YT8uWydjb2RlJ107XG4gICAgICAgIHRoaXMucGFyYW0gPSBkYXRhPy5bJ3BhcmFtJ107XG4gICAgICAgIHRoaXMudHlwZSA9IGRhdGE/LlsndHlwZSddO1xuICAgIH1cbiAgICBzdGF0aWMgbWFrZU1lc3NhZ2Uoc3RhdHVzLCBlcnJvciwgbWVzc2FnZSkge1xuICAgICAgICBjb25zdCBtc2cgPSBlcnJvcj8ubWVzc2FnZSA/XG4gICAgICAgICAgICB0eXBlb2YgZXJyb3IubWVzc2FnZSA9PT0gJ3N0cmluZycgP1xuICAgICAgICAgICAgICAgIGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICA6IEpTT04uc3RyaW5naWZ5KGVycm9yLm1lc3NhZ2UpXG4gICAgICAgICAgICA6IGVycm9yID8gSlNPTi5zdHJpbmdpZnkoZXJyb3IpXG4gICAgICAgICAgICAgICAgOiBtZXNzYWdlO1xuICAgICAgICBpZiAoc3RhdHVzICYmIG1zZykge1xuICAgICAgICAgICAgcmV0dXJuIGAke3N0YXR1c30gJHttc2d9YDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzKSB7XG4gICAgICAgICAgICByZXR1cm4gYCR7c3RhdHVzfSBzdGF0dXMgY29kZSAobm8gYm9keSlgO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtc2cpIHtcbiAgICAgICAgICAgIHJldHVybiBtc2c7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICcobm8gc3RhdHVzIGNvZGUgb3IgYm9keSknO1xuICAgIH1cbiAgICBzdGF0aWMgZ2VuZXJhdGUoc3RhdHVzLCBlcnJvclJlc3BvbnNlLCBtZXNzYWdlLCBoZWFkZXJzKSB7XG4gICAgICAgIGlmICghc3RhdHVzIHx8ICFoZWFkZXJzKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFQSUNvbm5lY3Rpb25FcnJvcih7IG1lc3NhZ2UsIGNhdXNlOiBjYXN0VG9FcnJvcihlcnJvclJlc3BvbnNlKSB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlcnJvciA9IGVycm9yUmVzcG9uc2U/LlsnZXJyb3InXTtcbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEJhZFJlcXVlc3RFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID09PSA0MDEpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQXV0aGVudGljYXRpb25FcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID09PSA0MDMpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUGVybWlzc2lvbkRlbmllZEVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBOb3RGb3VuZEVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQwOSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBDb25mbGljdEVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQyMikge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBVbnByb2Nlc3NhYmxlRW50aXR5RXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDI5KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJhdGVMaW1pdEVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPj0gNTAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEludGVybmFsU2VydmVyRXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBBUElFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQVBJVXNlckFib3J0RXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBtZXNzYWdlIH0gPSB7fSkge1xuICAgICAgICBzdXBlcih1bmRlZmluZWQsIHVuZGVmaW5lZCwgbWVzc2FnZSB8fCAnUmVxdWVzdCB3YXMgYWJvcnRlZC4nLCB1bmRlZmluZWQpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBUElDb25uZWN0aW9uRXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBtZXNzYWdlLCBjYXVzZSB9KSB7XG4gICAgICAgIHN1cGVyKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBtZXNzYWdlIHx8ICdDb25uZWN0aW9uIGVycm9yLicsIHVuZGVmaW5lZCk7XG4gICAgICAgIC8vIGluIHNvbWUgZW52aXJvbm1lbnRzIHRoZSAnY2F1c2UnIHByb3BlcnR5IGlzIGFscmVhZHkgZGVjbGFyZWRcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBpZiAoY2F1c2UpXG4gICAgICAgICAgICB0aGlzLmNhdXNlID0gY2F1c2U7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3IgZXh0ZW5kcyBBUElDb25uZWN0aW9uRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgbWVzc2FnZSB9ID0ge30pIHtcbiAgICAgICAgc3VwZXIoeyBtZXNzYWdlOiBtZXNzYWdlID8/ICdSZXF1ZXN0IHRpbWVkIG91dC4nIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBCYWRSZXF1ZXN0RXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgQXV0aGVudGljYXRpb25FcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBQZXJtaXNzaW9uRGVuaWVkRXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgTm90Rm91bmRFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBDb25mbGljdEVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIFVucHJvY2Vzc2FibGVFbnRpdHlFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBSYXRlTGltaXRFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBJbnRlcm5hbFNlcnZlckVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIExlbmd0aEZpbmlzaFJlYXNvbkVycm9yIGV4dGVuZHMgT3BlbkFJRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihgQ291bGQgbm90IHBhcnNlIHJlc3BvbnNlIGNvbnRlbnQgYXMgdGhlIGxlbmd0aCBsaW1pdCB3YXMgcmVhY2hlZGApO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDb250ZW50RmlsdGVyRmluaXNoUmVhc29uRXJyb3IgZXh0ZW5kcyBPcGVuQUlFcnJvciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKGBDb3VsZCBub3QgcGFyc2UgcmVzcG9uc2UgY29udGVudCBhcyB0aGUgcmVxdWVzdCB3YXMgcmVqZWN0ZWQgYnkgdGhlIGNvbnRlbnQgZmlsdGVyYCk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXJyb3IubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG52YXIgX2E7XG5pbXBvcnQgKiBhcyBxcyBmcm9tIFwiLi9pbnRlcm5hbC9xcy9pbmRleC5tanNcIjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4vY29yZS5tanNcIjtcbmltcG9ydCAqIGFzIEVycm9ycyBmcm9tIFwiLi9lcnJvci5tanNcIjtcbmltcG9ydCAqIGFzIFBhZ2luYXRpb24gZnJvbSBcIi4vcGFnaW5hdGlvbi5tanNcIjtcbmltcG9ydCAqIGFzIFVwbG9hZHMgZnJvbSBcIi4vdXBsb2Fkcy5tanNcIjtcbmltcG9ydCAqIGFzIEFQSSBmcm9tIFwiLi9yZXNvdXJjZXMvaW5kZXgubWpzXCI7XG5pbXBvcnQgeyBCYXRjaGVzLCBCYXRjaGVzUGFnZSwgfSBmcm9tIFwiLi9yZXNvdXJjZXMvYmF0Y2hlcy5tanNcIjtcbmltcG9ydCB7IENvbXBsZXRpb25zLCB9IGZyb20gXCIuL3Jlc291cmNlcy9jb21wbGV0aW9ucy5tanNcIjtcbmltcG9ydCB7IEVtYmVkZGluZ3MsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2VtYmVkZGluZ3MubWpzXCI7XG5pbXBvcnQgeyBGaWxlT2JqZWN0c1BhZ2UsIEZpbGVzLCB9IGZyb20gXCIuL3Jlc291cmNlcy9maWxlcy5tanNcIjtcbmltcG9ydCB7IEltYWdlcywgfSBmcm9tIFwiLi9yZXNvdXJjZXMvaW1hZ2VzLm1qc1wiO1xuaW1wb3J0IHsgTW9kZWxzLCBNb2RlbHNQYWdlIH0gZnJvbSBcIi4vcmVzb3VyY2VzL21vZGVscy5tanNcIjtcbmltcG9ydCB7IE1vZGVyYXRpb25zLCB9IGZyb20gXCIuL3Jlc291cmNlcy9tb2RlcmF0aW9ucy5tanNcIjtcbmltcG9ydCB7IEF1ZGlvIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2F1ZGlvL2F1ZGlvLm1qc1wiO1xuaW1wb3J0IHsgQmV0YSB9IGZyb20gXCIuL3Jlc291cmNlcy9iZXRhL2JldGEubWpzXCI7XG5pbXBvcnQgeyBDaGF0IH0gZnJvbSBcIi4vcmVzb3VyY2VzL2NoYXQvY2hhdC5tanNcIjtcbmltcG9ydCB7IEZpbmVUdW5pbmcgfSBmcm9tIFwiLi9yZXNvdXJjZXMvZmluZS10dW5pbmcvZmluZS10dW5pbmcubWpzXCI7XG5pbXBvcnQgeyBVcGxvYWRzIGFzIFVwbG9hZHNBUElVcGxvYWRzLCB9IGZyb20gXCIuL3Jlc291cmNlcy91cGxvYWRzL3VwbG9hZHMubWpzXCI7XG5pbXBvcnQgeyBDaGF0Q29tcGxldGlvbnNQYWdlLCB9IGZyb20gXCIuL3Jlc291cmNlcy9jaGF0L2NvbXBsZXRpb25zL2NvbXBsZXRpb25zLm1qc1wiO1xuLyoqXG4gKiBBUEkgQ2xpZW50IGZvciBpbnRlcmZhY2luZyB3aXRoIHRoZSBPcGVuQUkgQVBJLlxuICovXG5leHBvcnQgY2xhc3MgT3BlbkFJIGV4dGVuZHMgQ29yZS5BUElDbGllbnQge1xuICAgIC8qKlxuICAgICAqIEFQSSBDbGllbnQgZm9yIGludGVyZmFjaW5nIHdpdGggdGhlIE9wZW5BSSBBUEkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IHVuZGVmaW5lZH0gW29wdHMuYXBpS2V5PXByb2Nlc3MuZW52WydPUEVOQUlfQVBJX0tFWSddID8/IHVuZGVmaW5lZF1cbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IG51bGwgfCB1bmRlZmluZWR9IFtvcHRzLm9yZ2FuaXphdGlvbj1wcm9jZXNzLmVudlsnT1BFTkFJX09SR19JRCddID8/IG51bGxdXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkfSBbb3B0cy5wcm9qZWN0PXByb2Nlc3MuZW52WydPUEVOQUlfUFJPSkVDVF9JRCddID8/IG51bGxdXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRzLmJhc2VVUkw9cHJvY2Vzcy5lbnZbJ09QRU5BSV9CQVNFX1VSTCddID8/IGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjFdIC0gT3ZlcnJpZGUgdGhlIGRlZmF1bHQgYmFzZSBVUkwgZm9yIHRoZSBBUEkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnRpbWVvdXQ9MTAgbWludXRlc10gLSBUaGUgbWF4aW11bSBhbW91bnQgb2YgdGltZSAoaW4gbWlsbGlzZWNvbmRzKSB0aGUgY2xpZW50IHdpbGwgd2FpdCBmb3IgYSByZXNwb25zZSBiZWZvcmUgdGltaW5nIG91dC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaHR0cEFnZW50XSAtIEFuIEhUVFAgYWdlbnQgdXNlZCB0byBtYW5hZ2UgSFRUUChzKSBjb25uZWN0aW9ucy5cbiAgICAgKiBAcGFyYW0ge0NvcmUuRmV0Y2h9IFtvcHRzLmZldGNoXSAtIFNwZWNpZnkgYSBjdXN0b20gYGZldGNoYCBmdW5jdGlvbiBpbXBsZW1lbnRhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdHMubWF4UmV0cmllcz0yXSAtIFRoZSBtYXhpbXVtIG51bWJlciBvZiB0aW1lcyB0aGUgY2xpZW50IHdpbGwgcmV0cnkgYSByZXF1ZXN0LlxuICAgICAqIEBwYXJhbSB7Q29yZS5IZWFkZXJzfSBvcHRzLmRlZmF1bHRIZWFkZXJzIC0gRGVmYXVsdCBoZWFkZXJzIHRvIGluY2x1ZGUgd2l0aCBldmVyeSByZXF1ZXN0IHRvIHRoZSBBUEkuXG4gICAgICogQHBhcmFtIHtDb3JlLkRlZmF1bHRRdWVyeX0gb3B0cy5kZWZhdWx0UXVlcnkgLSBEZWZhdWx0IHF1ZXJ5IHBhcmFtZXRlcnMgdG8gaW5jbHVkZSB3aXRoIGV2ZXJ5IHJlcXVlc3QgdG8gdGhlIEFQSS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRhbmdlcm91c2x5QWxsb3dCcm93c2VyPWZhbHNlXSAtIEJ5IGRlZmF1bHQsIGNsaWVudC1zaWRlIHVzZSBvZiB0aGlzIGxpYnJhcnkgaXMgbm90IGFsbG93ZWQsIGFzIGl0IHJpc2tzIGV4cG9zaW5nIHlvdXIgc2VjcmV0IEFQSSBjcmVkZW50aWFscyB0byBhdHRhY2tlcnMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeyBiYXNlVVJMID0gQ29yZS5yZWFkRW52KCdPUEVOQUlfQkFTRV9VUkwnKSwgYXBpS2V5ID0gQ29yZS5yZWFkRW52KCdPUEVOQUlfQVBJX0tFWScpLCBvcmdhbml6YXRpb24gPSBDb3JlLnJlYWRFbnYoJ09QRU5BSV9PUkdfSUQnKSA/PyBudWxsLCBwcm9qZWN0ID0gQ29yZS5yZWFkRW52KCdPUEVOQUlfUFJPSkVDVF9JRCcpID8/IG51bGwsIC4uLm9wdHMgfSA9IHt9KSB7XG4gICAgICAgIGlmIChhcGlLZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcihcIlRoZSBPUEVOQUlfQVBJX0tFWSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBtaXNzaW5nIG9yIGVtcHR5OyBlaXRoZXIgcHJvdmlkZSBpdCwgb3IgaW5zdGFudGlhdGUgdGhlIE9wZW5BSSBjbGllbnQgd2l0aCBhbiBhcGlLZXkgb3B0aW9uLCBsaWtlIG5ldyBPcGVuQUkoeyBhcGlLZXk6ICdNeSBBUEkgS2V5JyB9KS5cIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGFwaUtleSxcbiAgICAgICAgICAgIG9yZ2FuaXphdGlvbixcbiAgICAgICAgICAgIHByb2plY3QsXG4gICAgICAgICAgICAuLi5vcHRzLFxuICAgICAgICAgICAgYmFzZVVSTDogYmFzZVVSTCB8fCBgaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MWAsXG4gICAgICAgIH07XG4gICAgICAgIGlmICghb3B0aW9ucy5kYW5nZXJvdXNseUFsbG93QnJvd3NlciAmJiBDb3JlLmlzUnVubmluZ0luQnJvd3NlcigpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKFwiSXQgbG9va3MgbGlrZSB5b3UncmUgcnVubmluZyBpbiBhIGJyb3dzZXItbGlrZSBlbnZpcm9ubWVudC5cXG5cXG5UaGlzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQsIGFzIGl0IHJpc2tzIGV4cG9zaW5nIHlvdXIgc2VjcmV0IEFQSSBjcmVkZW50aWFscyB0byBhdHRhY2tlcnMuXFxuSWYgeW91IHVuZGVyc3RhbmQgdGhlIHJpc2tzIGFuZCBoYXZlIGFwcHJvcHJpYXRlIG1pdGlnYXRpb25zIGluIHBsYWNlLFxcbnlvdSBjYW4gc2V0IHRoZSBgZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXJgIG9wdGlvbiB0byBgdHJ1ZWAsIGUuZy4sXFxuXFxubmV3IE9wZW5BSSh7IGFwaUtleSwgZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXI6IHRydWUgfSk7XFxuXFxuaHR0cHM6Ly9oZWxwLm9wZW5haS5jb20vZW4vYXJ0aWNsZXMvNTExMjU5NS1iZXN0LXByYWN0aWNlcy1mb3ItYXBpLWtleS1zYWZldHlcXG5cIik7XG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIoe1xuICAgICAgICAgICAgYmFzZVVSTDogb3B0aW9ucy5iYXNlVVJMLFxuICAgICAgICAgICAgdGltZW91dDogb3B0aW9ucy50aW1lb3V0ID8/IDYwMDAwMCAvKiAxMCBtaW51dGVzICovLFxuICAgICAgICAgICAgaHR0cEFnZW50OiBvcHRpb25zLmh0dHBBZ2VudCxcbiAgICAgICAgICAgIG1heFJldHJpZXM6IG9wdGlvbnMubWF4UmV0cmllcyxcbiAgICAgICAgICAgIGZldGNoOiBvcHRpb25zLmZldGNoLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb21wbGV0aW9ucyA9IG5ldyBBUEkuQ29tcGxldGlvbnModGhpcyk7XG4gICAgICAgIHRoaXMuY2hhdCA9IG5ldyBBUEkuQ2hhdCh0aGlzKTtcbiAgICAgICAgdGhpcy5lbWJlZGRpbmdzID0gbmV3IEFQSS5FbWJlZGRpbmdzKHRoaXMpO1xuICAgICAgICB0aGlzLmZpbGVzID0gbmV3IEFQSS5GaWxlcyh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZXMgPSBuZXcgQVBJLkltYWdlcyh0aGlzKTtcbiAgICAgICAgdGhpcy5hdWRpbyA9IG5ldyBBUEkuQXVkaW8odGhpcyk7XG4gICAgICAgIHRoaXMubW9kZXJhdGlvbnMgPSBuZXcgQVBJLk1vZGVyYXRpb25zKHRoaXMpO1xuICAgICAgICB0aGlzLm1vZGVscyA9IG5ldyBBUEkuTW9kZWxzKHRoaXMpO1xuICAgICAgICB0aGlzLmZpbmVUdW5pbmcgPSBuZXcgQVBJLkZpbmVUdW5pbmcodGhpcyk7XG4gICAgICAgIHRoaXMuYmV0YSA9IG5ldyBBUEkuQmV0YSh0aGlzKTtcbiAgICAgICAgdGhpcy5iYXRjaGVzID0gbmV3IEFQSS5CYXRjaGVzKHRoaXMpO1xuICAgICAgICB0aGlzLnVwbG9hZHMgPSBuZXcgQVBJLlVwbG9hZHModGhpcyk7XG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICB0aGlzLmFwaUtleSA9IGFwaUtleTtcbiAgICAgICAgdGhpcy5vcmdhbml6YXRpb24gPSBvcmdhbml6YXRpb247XG4gICAgICAgIHRoaXMucHJvamVjdCA9IHByb2plY3Q7XG4gICAgfVxuICAgIGRlZmF1bHRRdWVyeSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29wdGlvbnMuZGVmYXVsdFF1ZXJ5O1xuICAgIH1cbiAgICBkZWZhdWx0SGVhZGVycyhvcHRzKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5zdXBlci5kZWZhdWx0SGVhZGVycyhvcHRzKSxcbiAgICAgICAgICAgICdPcGVuQUktT3JnYW5pemF0aW9uJzogdGhpcy5vcmdhbml6YXRpb24sXG4gICAgICAgICAgICAnT3BlbkFJLVByb2plY3QnOiB0aGlzLnByb2plY3QsXG4gICAgICAgICAgICAuLi50aGlzLl9vcHRpb25zLmRlZmF1bHRIZWFkZXJzLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBhdXRoSGVhZGVycyhvcHRzKSB7XG4gICAgICAgIHJldHVybiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLmFwaUtleX1gIH07XG4gICAgfVxuICAgIHN0cmluZ2lmeVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgICAgIHJldHVybiBxcy5zdHJpbmdpZnkocXVlcnksIHsgYXJyYXlGb3JtYXQ6ICdicmFja2V0cycgfSk7XG4gICAgfVxufVxuX2EgPSBPcGVuQUk7XG5PcGVuQUkuT3BlbkFJID0gX2E7XG5PcGVuQUkuREVGQVVMVF9USU1FT1VUID0gNjAwMDAwOyAvLyAxMCBtaW51dGVzXG5PcGVuQUkuT3BlbkFJRXJyb3IgPSBFcnJvcnMuT3BlbkFJRXJyb3I7XG5PcGVuQUkuQVBJRXJyb3IgPSBFcnJvcnMuQVBJRXJyb3I7XG5PcGVuQUkuQVBJQ29ubmVjdGlvbkVycm9yID0gRXJyb3JzLkFQSUNvbm5lY3Rpb25FcnJvcjtcbk9wZW5BSS5BUElDb25uZWN0aW9uVGltZW91dEVycm9yID0gRXJyb3JzLkFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3I7XG5PcGVuQUkuQVBJVXNlckFib3J0RXJyb3IgPSBFcnJvcnMuQVBJVXNlckFib3J0RXJyb3I7XG5PcGVuQUkuTm90Rm91bmRFcnJvciA9IEVycm9ycy5Ob3RGb3VuZEVycm9yO1xuT3BlbkFJLkNvbmZsaWN0RXJyb3IgPSBFcnJvcnMuQ29uZmxpY3RFcnJvcjtcbk9wZW5BSS5SYXRlTGltaXRFcnJvciA9IEVycm9ycy5SYXRlTGltaXRFcnJvcjtcbk9wZW5BSS5CYWRSZXF1ZXN0RXJyb3IgPSBFcnJvcnMuQmFkUmVxdWVzdEVycm9yO1xuT3BlbkFJLkF1dGhlbnRpY2F0aW9uRXJyb3IgPSBFcnJvcnMuQXV0aGVudGljYXRpb25FcnJvcjtcbk9wZW5BSS5JbnRlcm5hbFNlcnZlckVycm9yID0gRXJyb3JzLkludGVybmFsU2VydmVyRXJyb3I7XG5PcGVuQUkuUGVybWlzc2lvbkRlbmllZEVycm9yID0gRXJyb3JzLlBlcm1pc3Npb25EZW5pZWRFcnJvcjtcbk9wZW5BSS5VbnByb2Nlc3NhYmxlRW50aXR5RXJyb3IgPSBFcnJvcnMuVW5wcm9jZXNzYWJsZUVudGl0eUVycm9yO1xuT3BlbkFJLnRvRmlsZSA9IFVwbG9hZHMudG9GaWxlO1xuT3BlbkFJLmZpbGVGcm9tUGF0aCA9IFVwbG9hZHMuZmlsZUZyb21QYXRoO1xuT3BlbkFJLkNvbXBsZXRpb25zID0gQ29tcGxldGlvbnM7XG5PcGVuQUkuQ2hhdCA9IENoYXQ7XG5PcGVuQUkuQ2hhdENvbXBsZXRpb25zUGFnZSA9IENoYXRDb21wbGV0aW9uc1BhZ2U7XG5PcGVuQUkuRW1iZWRkaW5ncyA9IEVtYmVkZGluZ3M7XG5PcGVuQUkuRmlsZXMgPSBGaWxlcztcbk9wZW5BSS5GaWxlT2JqZWN0c1BhZ2UgPSBGaWxlT2JqZWN0c1BhZ2U7XG5PcGVuQUkuSW1hZ2VzID0gSW1hZ2VzO1xuT3BlbkFJLkF1ZGlvID0gQXVkaW87XG5PcGVuQUkuTW9kZXJhdGlvbnMgPSBNb2RlcmF0aW9ucztcbk9wZW5BSS5Nb2RlbHMgPSBNb2RlbHM7XG5PcGVuQUkuTW9kZWxzUGFnZSA9IE1vZGVsc1BhZ2U7XG5PcGVuQUkuRmluZVR1bmluZyA9IEZpbmVUdW5pbmc7XG5PcGVuQUkuQmV0YSA9IEJldGE7XG5PcGVuQUkuQmF0Y2hlcyA9IEJhdGNoZXM7XG5PcGVuQUkuQmF0Y2hlc1BhZ2UgPSBCYXRjaGVzUGFnZTtcbk9wZW5BSS5VcGxvYWRzID0gVXBsb2Fkc0FQSVVwbG9hZHM7XG4vKiogQVBJIENsaWVudCBmb3IgaW50ZXJmYWNpbmcgd2l0aCB0aGUgQXp1cmUgT3BlbkFJIEFQSS4gKi9cbmV4cG9ydCBjbGFzcyBBenVyZU9wZW5BSSBleHRlbmRzIE9wZW5BSSB7XG4gICAgLyoqXG4gICAgICogQVBJIENsaWVudCBmb3IgaW50ZXJmYWNpbmcgd2l0aCB0aGUgQXp1cmUgT3BlbkFJIEFQSS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgdW5kZWZpbmVkfSBbb3B0cy5hcGlWZXJzaW9uPXByb2Nlc3MuZW52WydPUEVOQUlfQVBJX1ZFUlNJT04nXSA/PyB1bmRlZmluZWRdXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCB1bmRlZmluZWR9IFtvcHRzLmVuZHBvaW50PXByb2Nlc3MuZW52WydBWlVSRV9PUEVOQUlfRU5EUE9JTlQnXSA/PyB1bmRlZmluZWRdIC0gWW91ciBBenVyZSBlbmRwb2ludCwgaW5jbHVkaW5nIHRoZSByZXNvdXJjZSwgZS5nLiBgaHR0cHM6Ly9leGFtcGxlLXJlc291cmNlLmF6dXJlLm9wZW5haS5jb20vYFxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgdW5kZWZpbmVkfSBbb3B0cy5hcGlLZXk9cHJvY2Vzcy5lbnZbJ0FaVVJFX09QRU5BSV9BUElfS0VZJ10gPz8gdW5kZWZpbmVkXVxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgdW5kZWZpbmVkfSBvcHRzLmRlcGxveW1lbnQgLSBBIG1vZGVsIGRlcGxveW1lbnQsIGlmIGdpdmVuLCBzZXRzIHRoZSBiYXNlIGNsaWVudCBVUkwgdG8gaW5jbHVkZSBgL2RlcGxveW1lbnRzL3tkZXBsb3ltZW50fWAuXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkfSBbb3B0cy5vcmdhbml6YXRpb249cHJvY2Vzcy5lbnZbJ09QRU5BSV9PUkdfSUQnXSA/PyBudWxsXVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0cy5iYXNlVVJMPXByb2Nlc3MuZW52WydPUEVOQUlfQkFTRV9VUkwnXV0gLSBTZXRzIHRoZSBiYXNlIFVSTCBmb3IgdGhlIEFQSSwgZS5nLiBgaHR0cHM6Ly9leGFtcGxlLXJlc291cmNlLmF6dXJlLm9wZW5haS5jb20vb3BlbmFpL2AuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnRpbWVvdXQ9MTAgbWludXRlc10gLSBUaGUgbWF4aW11bSBhbW91bnQgb2YgdGltZSAoaW4gbWlsbGlzZWNvbmRzKSB0aGUgY2xpZW50IHdpbGwgd2FpdCBmb3IgYSByZXNwb25zZSBiZWZvcmUgdGltaW5nIG91dC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaHR0cEFnZW50XSAtIEFuIEhUVFAgYWdlbnQgdXNlZCB0byBtYW5hZ2UgSFRUUChzKSBjb25uZWN0aW9ucy5cbiAgICAgKiBAcGFyYW0ge0NvcmUuRmV0Y2h9IFtvcHRzLmZldGNoXSAtIFNwZWNpZnkgYSBjdXN0b20gYGZldGNoYCBmdW5jdGlvbiBpbXBsZW1lbnRhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdHMubWF4UmV0cmllcz0yXSAtIFRoZSBtYXhpbXVtIG51bWJlciBvZiB0aW1lcyB0aGUgY2xpZW50IHdpbGwgcmV0cnkgYSByZXF1ZXN0LlxuICAgICAqIEBwYXJhbSB7Q29yZS5IZWFkZXJzfSBvcHRzLmRlZmF1bHRIZWFkZXJzIC0gRGVmYXVsdCBoZWFkZXJzIHRvIGluY2x1ZGUgd2l0aCBldmVyeSByZXF1ZXN0IHRvIHRoZSBBUEkuXG4gICAgICogQHBhcmFtIHtDb3JlLkRlZmF1bHRRdWVyeX0gb3B0cy5kZWZhdWx0UXVlcnkgLSBEZWZhdWx0IHF1ZXJ5IHBhcmFtZXRlcnMgdG8gaW5jbHVkZSB3aXRoIGV2ZXJ5IHJlcXVlc3QgdG8gdGhlIEFQSS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRhbmdlcm91c2x5QWxsb3dCcm93c2VyPWZhbHNlXSAtIEJ5IGRlZmF1bHQsIGNsaWVudC1zaWRlIHVzZSBvZiB0aGlzIGxpYnJhcnkgaXMgbm90IGFsbG93ZWQsIGFzIGl0IHJpc2tzIGV4cG9zaW5nIHlvdXIgc2VjcmV0IEFQSSBjcmVkZW50aWFscyB0byBhdHRhY2tlcnMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeyBiYXNlVVJMID0gQ29yZS5yZWFkRW52KCdPUEVOQUlfQkFTRV9VUkwnKSwgYXBpS2V5ID0gQ29yZS5yZWFkRW52KCdBWlVSRV9PUEVOQUlfQVBJX0tFWScpLCBhcGlWZXJzaW9uID0gQ29yZS5yZWFkRW52KCdPUEVOQUlfQVBJX1ZFUlNJT04nKSwgZW5kcG9pbnQsIGRlcGxveW1lbnQsIGF6dXJlQURUb2tlblByb3ZpZGVyLCBkYW5nZXJvdXNseUFsbG93QnJvd3NlciwgLi4ub3B0cyB9ID0ge30pIHtcbiAgICAgICAgaWYgKCFhcGlWZXJzaW9uKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKFwiVGhlIE9QRU5BSV9BUElfVkVSU0lPTiBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBtaXNzaW5nIG9yIGVtcHR5OyBlaXRoZXIgcHJvdmlkZSBpdCwgb3IgaW5zdGFudGlhdGUgdGhlIEF6dXJlT3BlbkFJIGNsaWVudCB3aXRoIGFuIGFwaVZlcnNpb24gb3B0aW9uLCBsaWtlIG5ldyBBenVyZU9wZW5BSSh7IGFwaVZlcnNpb246ICdNeSBBUEkgVmVyc2lvbicgfSkuXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgYXp1cmVBRFRva2VuUHJvdmlkZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGRhbmdlcm91c2x5QWxsb3dCcm93c2VyID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWF6dXJlQURUb2tlblByb3ZpZGVyICYmICFhcGlLZXkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoJ01pc3NpbmcgY3JlZGVudGlhbHMuIFBsZWFzZSBwYXNzIG9uZSBvZiBgYXBpS2V5YCBhbmQgYGF6dXJlQURUb2tlblByb3ZpZGVyYCwgb3Igc2V0IHRoZSBgQVpVUkVfT1BFTkFJX0FQSV9LRVlgIGVudmlyb25tZW50IHZhcmlhYmxlLicpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhenVyZUFEVG9rZW5Qcm92aWRlciAmJiBhcGlLZXkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoJ1RoZSBgYXBpS2V5YCBhbmQgYGF6dXJlQURUb2tlblByb3ZpZGVyYCBhcmd1bWVudHMgYXJlIG11dHVhbGx5IGV4Y2x1c2l2ZTsgb25seSBvbmUgY2FuIGJlIHBhc3NlZCBhdCBhIHRpbWUuJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGVmaW5lIGEgc2VudGluZWwgdmFsdWUgdG8gYXZvaWQgYW55IHR5cGluZyBpc3N1ZXNcbiAgICAgICAgYXBpS2V5ID8/IChhcGlLZXkgPSBBUElfS0VZX1NFTlRJTkVMKTtcbiAgICAgICAgb3B0cy5kZWZhdWx0UXVlcnkgPSB7IC4uLm9wdHMuZGVmYXVsdFF1ZXJ5LCAnYXBpLXZlcnNpb24nOiBhcGlWZXJzaW9uIH07XG4gICAgICAgIGlmICghYmFzZVVSTCkge1xuICAgICAgICAgICAgaWYgKCFlbmRwb2ludCkge1xuICAgICAgICAgICAgICAgIGVuZHBvaW50ID0gcHJvY2Vzcy5lbnZbJ0FaVVJFX09QRU5BSV9FTkRQT0lOVCddO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFlbmRwb2ludCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoJ011c3QgcHJvdmlkZSBvbmUgb2YgdGhlIGBiYXNlVVJMYCBvciBgZW5kcG9pbnRgIGFyZ3VtZW50cywgb3IgdGhlIGBBWlVSRV9PUEVOQUlfRU5EUE9JTlRgIGVudmlyb25tZW50IHZhcmlhYmxlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiYXNlVVJMID0gYCR7ZW5kcG9pbnR9L29wZW5haWA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoZW5kcG9pbnQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKCdiYXNlVVJMIGFuZCBlbmRwb2ludCBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIoe1xuICAgICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgICAgYmFzZVVSTCxcbiAgICAgICAgICAgIC4uLm9wdHMsXG4gICAgICAgICAgICAuLi4oZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXIgIT09IHVuZGVmaW5lZCA/IHsgZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXIgfSA6IHt9KSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYXBpVmVyc2lvbiA9ICcnO1xuICAgICAgICB0aGlzLl9henVyZUFEVG9rZW5Qcm92aWRlciA9IGF6dXJlQURUb2tlblByb3ZpZGVyO1xuICAgICAgICB0aGlzLmFwaVZlcnNpb24gPSBhcGlWZXJzaW9uO1xuICAgICAgICB0aGlzLmRlcGxveW1lbnROYW1lID0gZGVwbG95bWVudDtcbiAgICB9XG4gICAgYnVpbGRSZXF1ZXN0KG9wdGlvbnMsIHByb3BzID0ge30pIHtcbiAgICAgICAgaWYgKF9kZXBsb3ltZW50c19lbmRwb2ludHMuaGFzKG9wdGlvbnMucGF0aCkgJiYgb3B0aW9ucy5tZXRob2QgPT09ICdwb3N0JyAmJiBvcHRpb25zLmJvZHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKCFDb3JlLmlzT2JqKG9wdGlvbnMuYm9keSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHJlcXVlc3QgYm9keSB0byBiZSBhbiBvYmplY3QnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5kZXBsb3ltZW50TmFtZSB8fCBvcHRpb25zLmJvZHlbJ21vZGVsJ10gfHwgb3B0aW9ucy5fX21ldGFkYXRhPy5bJ21vZGVsJ107XG4gICAgICAgICAgICBpZiAobW9kZWwgIT09IHVuZGVmaW5lZCAmJiAhdGhpcy5iYXNlVVJMLmluY2x1ZGVzKCcvZGVwbG95bWVudHMnKSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMucGF0aCA9IGAvZGVwbG95bWVudHMvJHttb2RlbH0ke29wdGlvbnMucGF0aH1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdXBlci5idWlsZFJlcXVlc3Qob3B0aW9ucywgcHJvcHMpO1xuICAgIH1cbiAgICBhc3luYyBfZ2V0QXp1cmVBRFRva2VuKCkge1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2F6dXJlQURUb2tlblByb3ZpZGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IGF3YWl0IHRoaXMuX2F6dXJlQURUb2tlblByb3ZpZGVyKCk7XG4gICAgICAgICAgICBpZiAoIXRva2VuIHx8IHR5cGVvZiB0b2tlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKGBFeHBlY3RlZCAnYXp1cmVBRFRva2VuUHJvdmlkZXInIGFyZ3VtZW50IHRvIHJldHVybiBhIHN0cmluZyBidXQgaXQgcmV0dXJuZWQgJHt0b2tlbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBhdXRoSGVhZGVycyhvcHRzKSB7XG4gICAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gICAgYXN5bmMgcHJlcGFyZU9wdGlvbnMob3B0cykge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHVzZXIgc2hvdWxkIHByb3ZpZGUgYSBiZWFyZXIgdG9rZW4gcHJvdmlkZXIgaWYgdGhleSB3YW50XG4gICAgICAgICAqIHRvIHVzZSBBenVyZSBBRCBhdXRoZW50aWNhdGlvbi4gVGhlIHVzZXIgc2hvdWxkbid0IHNldCB0aGVcbiAgICAgICAgICogQXV0aG9yaXphdGlvbiBoZWFkZXIgbWFudWFsbHkgYmVjYXVzZSB0aGUgaGVhZGVyIGlzIG92ZXJ3cml0dGVuXG4gICAgICAgICAqIHdpdGggdGhlIEF6dXJlIEFEIHRva2VuIGlmIGEgYmVhcmVyIHRva2VuIHByb3ZpZGVyIGlzIHByb3ZpZGVkLlxuICAgICAgICAgKi9cbiAgICAgICAgaWYgKG9wdHMuaGVhZGVycz8uWydhcGkta2V5J10pIHtcbiAgICAgICAgICAgIHJldHVybiBzdXBlci5wcmVwYXJlT3B0aW9ucyhvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0b2tlbiA9IGF3YWl0IHRoaXMuX2dldEF6dXJlQURUb2tlbigpO1xuICAgICAgICBvcHRzLmhlYWRlcnMgPz8gKG9wdHMuaGVhZGVycyA9IHt9KTtcbiAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICBvcHRzLmhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHt0b2tlbn1gO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuYXBpS2V5ICE9PSBBUElfS0VZX1NFTlRJTkVMKSB7XG4gICAgICAgICAgICBvcHRzLmhlYWRlcnNbJ2FwaS1rZXknXSA9IHRoaXMuYXBpS2V5O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcignVW5hYmxlIHRvIGhhbmRsZSBhdXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1cGVyLnByZXBhcmVPcHRpb25zKG9wdHMpO1xuICAgIH1cbn1cbmNvbnN0IF9kZXBsb3ltZW50c19lbmRwb2ludHMgPSBuZXcgU2V0KFtcbiAgICAnL2NvbXBsZXRpb25zJyxcbiAgICAnL2NoYXQvY29tcGxldGlvbnMnLFxuICAgICcvZW1iZWRkaW5ncycsXG4gICAgJy9hdWRpby90cmFuc2NyaXB0aW9ucycsXG4gICAgJy9hdWRpby90cmFuc2xhdGlvbnMnLFxuICAgICcvYXVkaW8vc3BlZWNoJyxcbiAgICAnL2ltYWdlcy9nZW5lcmF0aW9ucycsXG5dKTtcbmNvbnN0IEFQSV9LRVlfU0VOVElORUwgPSAnPE1pc3NpbmcgS2V5Pic7XG5leHBvcnQgeyB0b0ZpbGUsIGZpbGVGcm9tUGF0aCB9IGZyb20gXCIuL3VwbG9hZHMubWpzXCI7XG5leHBvcnQgeyBPcGVuQUlFcnJvciwgQVBJRXJyb3IsIEFQSUNvbm5lY3Rpb25FcnJvciwgQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvciwgQVBJVXNlckFib3J0RXJyb3IsIE5vdEZvdW5kRXJyb3IsIENvbmZsaWN0RXJyb3IsIFJhdGVMaW1pdEVycm9yLCBCYWRSZXF1ZXN0RXJyb3IsIEF1dGhlbnRpY2F0aW9uRXJyb3IsIEludGVybmFsU2VydmVyRXJyb3IsIFBlcm1pc3Npb25EZW5pZWRFcnJvciwgVW5wcm9jZXNzYWJsZUVudGl0eUVycm9yLCB9IGZyb20gXCIuL2Vycm9yLm1qc1wiO1xuZXhwb3J0IGRlZmF1bHQgT3BlbkFJO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubWpzLm1hcCIsInZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcbn07XG52YXIgX19jbGFzc1ByaXZhdGVGaWVsZEdldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZEdldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xufTtcbnZhciBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleDtcbmltcG9ydCB7IE9wZW5BSUVycm9yIH0gZnJvbSBcIi4uLy4uL2Vycm9yLm1qc1wiO1xuLyoqXG4gKiBBIHJlLWltcGxlbWVudGF0aW9uIG9mIGh0dHB4J3MgYExpbmVEZWNvZGVyYCBpbiBQeXRob24gdGhhdCBoYW5kbGVzIGluY3JlbWVudGFsbHlcbiAqIHJlYWRpbmcgbGluZXMgZnJvbSB0ZXh0LlxuICpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9lbmNvZGUvaHR0cHgvYmxvYi85MjAzMzNlYTk4MTE4ZTljZjYxN2YyNDY5MDVkN2IyMDI1MTA5NDFjL2h0dHB4L19kZWNvZGVycy5weSNMMjU4XG4gKi9cbmV4cG9ydCBjbGFzcyBMaW5lRGVjb2RlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KCk7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIG51bGwsIFwiZlwiKTtcbiAgICB9XG4gICAgZGVjb2RlKGNodW5rKSB7XG4gICAgICAgIGlmIChjaHVuayA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYmluYXJ5Q2h1bmsgPSBjaHVuayBpbnN0YW5jZW9mIEFycmF5QnVmZmVyID8gbmV3IFVpbnQ4QXJyYXkoY2h1bmspXG4gICAgICAgICAgICA6IHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycgPyBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoY2h1bmspXG4gICAgICAgICAgICAgICAgOiBjaHVuaztcbiAgICAgICAgbGV0IG5ld0RhdGEgPSBuZXcgVWludDhBcnJheSh0aGlzLmJ1ZmZlci5sZW5ndGggKyBiaW5hcnlDaHVuay5sZW5ndGgpO1xuICAgICAgICBuZXdEYXRhLnNldCh0aGlzLmJ1ZmZlcik7XG4gICAgICAgIG5ld0RhdGEuc2V0KGJpbmFyeUNodW5rLCB0aGlzLmJ1ZmZlci5sZW5ndGgpO1xuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ld0RhdGE7XG4gICAgICAgIGNvbnN0IGxpbmVzID0gW107XG4gICAgICAgIGxldCBwYXR0ZXJuSW5kZXg7XG4gICAgICAgIHdoaWxlICgocGF0dGVybkluZGV4ID0gZmluZE5ld2xpbmVJbmRleCh0aGlzLmJ1ZmZlciwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpKSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKHBhdHRlcm5JbmRleC5jYXJyaWFnZSAmJiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIHNraXAgdW50aWwgd2UgZWl0aGVyIGdldCBhIGNvcnJlc3BvbmRpbmcgYFxcbmAsIGEgbmV3IGBcXHJgIG9yIG5vdGhpbmdcbiAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBwYXR0ZXJuSW5kZXguaW5kZXgsIFwiZlwiKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHdlIGdvdCBkb3VibGUgXFxyIG9yIFxccnRleHRcXG5cbiAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikgIT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgIChwYXR0ZXJuSW5kZXguaW5kZXggIT09IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSArIDEgfHwgcGF0dGVybkluZGV4LmNhcnJpYWdlKSkge1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2godGhpcy5kZWNvZGVUZXh0KHRoaXMuYnVmZmVyLnNsaWNlKDAsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSAtIDEpKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5idWZmZXIgPSB0aGlzLmJ1ZmZlci5zbGljZShfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikpO1xuICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIG51bGwsIFwiZlwiKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGVuZEluZGV4ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpICE9PSBudWxsID8gcGF0dGVybkluZGV4LnByZWNlZGluZyAtIDEgOiBwYXR0ZXJuSW5kZXgucHJlY2VkaW5nO1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IHRoaXMuZGVjb2RlVGV4dCh0aGlzLmJ1ZmZlci5zbGljZSgwLCBlbmRJbmRleCkpO1xuICAgICAgICAgICAgbGluZXMucHVzaChsaW5lKTtcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyID0gdGhpcy5idWZmZXIuc2xpY2UocGF0dGVybkluZGV4LmluZGV4KTtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIG51bGwsIFwiZlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGluZXM7XG4gICAgfVxuICAgIGRlY29kZVRleHQoYnl0ZXMpIHtcbiAgICAgICAgaWYgKGJ5dGVzID09IG51bGwpXG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIGlmICh0eXBlb2YgYnl0ZXMgPT09ICdzdHJpbmcnKVxuICAgICAgICAgICAgcmV0dXJuIGJ5dGVzO1xuICAgICAgICAvLyBOb2RlOlxuICAgICAgICBpZiAodHlwZW9mIEJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChieXRlcyBpbnN0YW5jZW9mIEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBieXRlcy50b1N0cmluZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJ5dGVzIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShieXRlcykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgVW5leHBlY3RlZDogcmVjZWl2ZWQgbm9uLVVpbnQ4QXJyYXkgKCR7Ynl0ZXMuY29uc3RydWN0b3IubmFtZX0pIHN0cmVhbSBjaHVuayBpbiBhbiBlbnZpcm9ubWVudCB3aXRoIGEgZ2xvYmFsIFwiQnVmZmVyXCIgZGVmaW5lZCwgd2hpY2ggdGhpcyBsaWJyYXJ5IGFzc3VtZXMgdG8gYmUgTm9kZS4gUGxlYXNlIHJlcG9ydCB0aGlzIGVycm9yLmApO1xuICAgICAgICB9XG4gICAgICAgIC8vIEJyb3dzZXJcbiAgICAgICAgaWYgKHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChieXRlcyBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgfHwgYnl0ZXMgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dERlY29kZXIgPz8gKHRoaXMudGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoJ3V0ZjgnKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudGV4dERlY29kZXIuZGVjb2RlKGJ5dGVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgVW5leHBlY3RlZDogcmVjZWl2ZWQgbm9uLVVpbnQ4QXJyYXkvQXJyYXlCdWZmZXIgKCR7Ynl0ZXMuY29uc3RydWN0b3IubmFtZX0pIGluIGEgd2ViIHBsYXRmb3JtLiBQbGVhc2UgcmVwb3J0IHRoaXMgZXJyb3IuYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBVbmV4cGVjdGVkOiBuZWl0aGVyIEJ1ZmZlciBub3IgVGV4dERlY29kZXIgYXJlIGF2YWlsYWJsZSBhcyBnbG9iYWxzLiBQbGVhc2UgcmVwb3J0IHRoaXMgZXJyb3IuYCk7XG4gICAgfVxuICAgIGZsdXNoKCkge1xuICAgICAgICBpZiAoIXRoaXMuYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmRlY29kZSgnXFxuJyk7XG4gICAgfVxufVxuX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXggPSBuZXcgV2Vha01hcCgpO1xuLy8gcHJldHRpZXItaWdub3JlXG5MaW5lRGVjb2Rlci5ORVdMSU5FX0NIQVJTID0gbmV3IFNldChbJ1xcbicsICdcXHInXSk7XG5MaW5lRGVjb2Rlci5ORVdMSU5FX1JFR0VYUCA9IC9cXHJcXG58W1xcblxccl0vZztcbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzZWFyY2hlcyB0aGUgYnVmZmVyIGZvciB0aGUgZW5kIHBhdHRlcm5zLCAoXFxyIG9yIFxcbilcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHRoZSBpbmRleCBwcmVjZWRpbmcgdGhlIG1hdGNoZWQgbmV3bGluZSBhbmQgdGhlXG4gKiBpbmRleCBhZnRlciB0aGUgbmV3bGluZSBjaGFyLiBgbnVsbGAgaXMgcmV0dXJuZWQgaWYgbm8gbmV3IGxpbmUgaXMgZm91bmQuXG4gKlxuICogYGBgdHNcbiAqIGZpbmROZXdMaW5lSW5kZXgoJ2FiY1xcbmRlZicpIC0+IHsgcHJlY2VkaW5nOiAyLCBpbmRleDogMyB9XG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gZmluZE5ld2xpbmVJbmRleChidWZmZXIsIHN0YXJ0SW5kZXgpIHtcbiAgICBjb25zdCBuZXdsaW5lID0gMHgwYTsgLy8gXFxuXG4gICAgY29uc3QgY2FycmlhZ2UgPSAweDBkOyAvLyBcXHJcbiAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleCA/PyAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChidWZmZXJbaV0gPT09IG5ld2xpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHByZWNlZGluZzogaSwgaW5kZXg6IGkgKyAxLCBjYXJyaWFnZTogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYnVmZmVyW2ldID09PSBjYXJyaWFnZSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgcHJlY2VkaW5nOiBpLCBpbmRleDogaSArIDEsIGNhcnJpYWdlOiB0cnVlIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1saW5lLm1qcy5tYXAiLCJleHBvcnQgY29uc3QgZGVmYXVsdF9mb3JtYXQgPSAnUkZDMzk4Nic7XG5leHBvcnQgY29uc3QgZm9ybWF0dGVycyA9IHtcbiAgICBSRkMxNzM4OiAodikgPT4gU3RyaW5nKHYpLnJlcGxhY2UoLyUyMC9nLCAnKycpLFxuICAgIFJGQzM5ODY6ICh2KSA9PiBTdHJpbmcodiksXG59O1xuZXhwb3J0IGNvbnN0IFJGQzE3MzggPSAnUkZDMTczOCc7XG5leHBvcnQgY29uc3QgUkZDMzk4NiA9ICdSRkMzOTg2Jztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZvcm1hdHMubWpzLm1hcCIsImltcG9ydCB7IGVuY29kZSwgaXNfYnVmZmVyLCBtYXliZV9tYXAgfSBmcm9tIFwiLi91dGlscy5tanNcIjtcbmltcG9ydCB7IGRlZmF1bHRfZm9ybWF0LCBmb3JtYXR0ZXJzIH0gZnJvbSBcIi4vZm9ybWF0cy5tanNcIjtcbmNvbnN0IGhhcyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5jb25zdCBhcnJheV9wcmVmaXhfZ2VuZXJhdG9ycyA9IHtcbiAgICBicmFja2V0cyhwcmVmaXgpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZyhwcmVmaXgpICsgJ1tdJztcbiAgICB9LFxuICAgIGNvbW1hOiAnY29tbWEnLFxuICAgIGluZGljZXMocHJlZml4LCBrZXkpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZyhwcmVmaXgpICsgJ1snICsga2V5ICsgJ10nO1xuICAgIH0sXG4gICAgcmVwZWF0KHByZWZpeCkge1xuICAgICAgICByZXR1cm4gU3RyaW5nKHByZWZpeCk7XG4gICAgfSxcbn07XG5jb25zdCBpc19hcnJheSA9IEFycmF5LmlzQXJyYXk7XG5jb25zdCBwdXNoID0gQXJyYXkucHJvdG90eXBlLnB1c2g7XG5jb25zdCBwdXNoX3RvX2FycmF5ID0gZnVuY3Rpb24gKGFyciwgdmFsdWVfb3JfYXJyYXkpIHtcbiAgICBwdXNoLmFwcGx5KGFyciwgaXNfYXJyYXkodmFsdWVfb3JfYXJyYXkpID8gdmFsdWVfb3JfYXJyYXkgOiBbdmFsdWVfb3JfYXJyYXldKTtcbn07XG5jb25zdCB0b19JU08gPSBEYXRlLnByb3RvdHlwZS50b0lTT1N0cmluZztcbmNvbnN0IGRlZmF1bHRzID0ge1xuICAgIGFkZFF1ZXJ5UHJlZml4OiBmYWxzZSxcbiAgICBhbGxvd0RvdHM6IGZhbHNlLFxuICAgIGFsbG93RW1wdHlBcnJheXM6IGZhbHNlLFxuICAgIGFycmF5Rm9ybWF0OiAnaW5kaWNlcycsXG4gICAgY2hhcnNldDogJ3V0Zi04JyxcbiAgICBjaGFyc2V0U2VudGluZWw6IGZhbHNlLFxuICAgIGRlbGltaXRlcjogJyYnLFxuICAgIGVuY29kZTogdHJ1ZSxcbiAgICBlbmNvZGVEb3RJbktleXM6IGZhbHNlLFxuICAgIGVuY29kZXI6IGVuY29kZSxcbiAgICBlbmNvZGVWYWx1ZXNPbmx5OiBmYWxzZSxcbiAgICBmb3JtYXQ6IGRlZmF1bHRfZm9ybWF0LFxuICAgIGZvcm1hdHRlcjogZm9ybWF0dGVyc1tkZWZhdWx0X2Zvcm1hdF0sXG4gICAgLyoqIEBkZXByZWNhdGVkICovXG4gICAgaW5kaWNlczogZmFsc2UsXG4gICAgc2VyaWFsaXplRGF0ZShkYXRlKSB7XG4gICAgICAgIHJldHVybiB0b19JU08uY2FsbChkYXRlKTtcbiAgICB9LFxuICAgIHNraXBOdWxsczogZmFsc2UsXG4gICAgc3RyaWN0TnVsbEhhbmRsaW5nOiBmYWxzZSxcbn07XG5mdW5jdGlvbiBpc19ub25fbnVsbGlzaF9wcmltaXRpdmUodikge1xuICAgIHJldHVybiAodHlwZW9mIHYgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgIHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fFxuICAgICAgICB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgIHR5cGVvZiB2ID09PSAnc3ltYm9sJyB8fFxuICAgICAgICB0eXBlb2YgdiA9PT0gJ2JpZ2ludCcpO1xufVxuY29uc3Qgc2VudGluZWwgPSB7fTtcbmZ1bmN0aW9uIGlubmVyX3N0cmluZ2lmeShvYmplY3QsIHByZWZpeCwgZ2VuZXJhdGVBcnJheVByZWZpeCwgY29tbWFSb3VuZFRyaXAsIGFsbG93RW1wdHlBcnJheXMsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGVEb3RJbktleXMsIGVuY29kZXIsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzLCBzZXJpYWxpemVEYXRlLCBmb3JtYXQsIGZvcm1hdHRlciwgZW5jb2RlVmFsdWVzT25seSwgY2hhcnNldCwgc2lkZUNoYW5uZWwpIHtcbiAgICBsZXQgb2JqID0gb2JqZWN0O1xuICAgIGxldCB0bXBfc2MgPSBzaWRlQ2hhbm5lbDtcbiAgICBsZXQgc3RlcCA9IDA7XG4gICAgbGV0IGZpbmRfZmxhZyA9IGZhbHNlO1xuICAgIHdoaWxlICgodG1wX3NjID0gdG1wX3NjLmdldChzZW50aW5lbCkpICE9PSB2b2lkIHVuZGVmaW5lZCAmJiAhZmluZF9mbGFnKSB7XG4gICAgICAgIC8vIFdoZXJlIG9iamVjdCBsYXN0IGFwcGVhcmVkIGluIHRoZSByZWYgdHJlZVxuICAgICAgICBjb25zdCBwb3MgPSB0bXBfc2MuZ2V0KG9iamVjdCk7XG4gICAgICAgIHN0ZXAgKz0gMTtcbiAgICAgICAgaWYgKHR5cGVvZiBwb3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAocG9zID09PSBzdGVwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0N5Y2xpYyBvYmplY3QgdmFsdWUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmRfZmxhZyA9IHRydWU7IC8vIEJyZWFrIHdoaWxlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB0bXBfc2MuZ2V0KHNlbnRpbmVsKSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHN0ZXAgPSAwO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG9iaiA9IGZpbHRlcihwcmVmaXgsIG9iaik7XG4gICAgfVxuICAgIGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgb2JqID0gc2VyaWFsaXplRGF0ZT8uKG9iaik7XG4gICAgfVxuICAgIGVsc2UgaWYgKGdlbmVyYXRlQXJyYXlQcmVmaXggPT09ICdjb21tYScgJiYgaXNfYXJyYXkob2JqKSkge1xuICAgICAgICBvYmogPSBtYXliZV9tYXAob2JqLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VyaWFsaXplRGF0ZT8uKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgaWYgKHN0cmljdE51bGxIYW5kbGluZykge1xuICAgICAgICAgICAgcmV0dXJuIGVuY29kZXIgJiYgIWVuY29kZVZhbHVlc09ubHkgP1xuICAgICAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgICAgICAgICBlbmNvZGVyKHByZWZpeCwgZGVmYXVsdHMuZW5jb2RlciwgY2hhcnNldCwgJ2tleScsIGZvcm1hdClcbiAgICAgICAgICAgICAgICA6IHByZWZpeDtcbiAgICAgICAgfVxuICAgICAgICBvYmogPSAnJztcbiAgICB9XG4gICAgaWYgKGlzX25vbl9udWxsaXNoX3ByaW1pdGl2ZShvYmopIHx8IGlzX2J1ZmZlcihvYmopKSB7XG4gICAgICAgIGlmIChlbmNvZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBrZXlfdmFsdWUgPSBlbmNvZGVWYWx1ZXNPbmx5ID8gcHJlZml4XG4gICAgICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICAgICAgICAgIDogZW5jb2RlcihwcmVmaXgsIGRlZmF1bHRzLmVuY29kZXIsIGNoYXJzZXQsICdrZXknLCBmb3JtYXQpO1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZXI/LihrZXlfdmFsdWUpICtcbiAgICAgICAgICAgICAgICAgICAgJz0nICtcbiAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICAgICAgICAgICAgICBmb3JtYXR0ZXI/LihlbmNvZGVyKG9iaiwgZGVmYXVsdHMuZW5jb2RlciwgY2hhcnNldCwgJ3ZhbHVlJywgZm9ybWF0KSksXG4gICAgICAgICAgICBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbZm9ybWF0dGVyPy4ocHJlZml4KSArICc9JyArIGZvcm1hdHRlcj8uKFN0cmluZyhvYmopKV07XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlcyA9IFtdO1xuICAgIGlmICh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gdmFsdWVzO1xuICAgIH1cbiAgICBsZXQgb2JqX2tleXM7XG4gICAgaWYgKGdlbmVyYXRlQXJyYXlQcmVmaXggPT09ICdjb21tYScgJiYgaXNfYXJyYXkob2JqKSkge1xuICAgICAgICAvLyB3ZSBuZWVkIHRvIGpvaW4gZWxlbWVudHMgaW5cbiAgICAgICAgaWYgKGVuY29kZVZhbHVlc09ubHkgJiYgZW5jb2Rlcikge1xuICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciB2YWx1ZXMgb25seVxuICAgICAgICAgICAgb2JqID0gbWF5YmVfbWFwKG9iaiwgZW5jb2Rlcik7XG4gICAgICAgIH1cbiAgICAgICAgb2JqX2tleXMgPSBbeyB2YWx1ZTogb2JqLmxlbmd0aCA+IDAgPyBvYmouam9pbignLCcpIHx8IG51bGwgOiB2b2lkIHVuZGVmaW5lZCB9XTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNfYXJyYXkoZmlsdGVyKSkge1xuICAgICAgICBvYmpfa2V5cyA9IGZpbHRlcjtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICBvYmpfa2V5cyA9IHNvcnQgPyBrZXlzLnNvcnQoc29ydCkgOiBrZXlzO1xuICAgIH1cbiAgICBjb25zdCBlbmNvZGVkX3ByZWZpeCA9IGVuY29kZURvdEluS2V5cyA/IFN0cmluZyhwcmVmaXgpLnJlcGxhY2UoL1xcLi9nLCAnJTJFJykgOiBTdHJpbmcocHJlZml4KTtcbiAgICBjb25zdCBhZGp1c3RlZF9wcmVmaXggPSBjb21tYVJvdW5kVHJpcCAmJiBpc19hcnJheShvYmopICYmIG9iai5sZW5ndGggPT09IDEgPyBlbmNvZGVkX3ByZWZpeCArICdbXScgOiBlbmNvZGVkX3ByZWZpeDtcbiAgICBpZiAoYWxsb3dFbXB0eUFycmF5cyAmJiBpc19hcnJheShvYmopICYmIG9iai5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGFkanVzdGVkX3ByZWZpeCArICdbXSc7XG4gICAgfVxuICAgIGZvciAobGV0IGogPSAwOyBqIDwgb2JqX2tleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgY29uc3Qga2V5ID0gb2JqX2tleXNbal07XG4gICAgICAgIGNvbnN0IHZhbHVlID0gXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdHlwZW9mIGtleSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGtleS52YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgPyBrZXkudmFsdWUgOiBvYmpba2V5XTtcbiAgICAgICAgaWYgKHNraXBOdWxscyAmJiB2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBjb25zdCBlbmNvZGVkX2tleSA9IGFsbG93RG90cyAmJiBlbmNvZGVEb3RJbktleXMgPyBrZXkucmVwbGFjZSgvXFwuL2csICclMkUnKSA6IGtleTtcbiAgICAgICAgY29uc3Qga2V5X3ByZWZpeCA9IGlzX2FycmF5KG9iaikgP1xuICAgICAgICAgICAgdHlwZW9mIGdlbmVyYXRlQXJyYXlQcmVmaXggPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgICAgICAgIGdlbmVyYXRlQXJyYXlQcmVmaXgoYWRqdXN0ZWRfcHJlZml4LCBlbmNvZGVkX2tleSlcbiAgICAgICAgICAgICAgICA6IGFkanVzdGVkX3ByZWZpeFxuICAgICAgICAgICAgOiBhZGp1c3RlZF9wcmVmaXggKyAoYWxsb3dEb3RzID8gJy4nICsgZW5jb2RlZF9rZXkgOiAnWycgKyBlbmNvZGVkX2tleSArICddJyk7XG4gICAgICAgIHNpZGVDaGFubmVsLnNldChvYmplY3QsIHN0ZXApO1xuICAgICAgICBjb25zdCB2YWx1ZVNpZGVDaGFubmVsID0gbmV3IFdlYWtNYXAoKTtcbiAgICAgICAgdmFsdWVTaWRlQ2hhbm5lbC5zZXQoc2VudGluZWwsIHNpZGVDaGFubmVsKTtcbiAgICAgICAgcHVzaF90b19hcnJheSh2YWx1ZXMsIGlubmVyX3N0cmluZ2lmeSh2YWx1ZSwga2V5X3ByZWZpeCwgZ2VuZXJhdGVBcnJheVByZWZpeCwgY29tbWFSb3VuZFRyaXAsIGFsbG93RW1wdHlBcnJheXMsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGVEb3RJbktleXMsIFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGdlbmVyYXRlQXJyYXlQcmVmaXggPT09ICdjb21tYScgJiYgZW5jb2RlVmFsdWVzT25seSAmJiBpc19hcnJheShvYmopID8gbnVsbCA6IGVuY29kZXIsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzLCBzZXJpYWxpemVEYXRlLCBmb3JtYXQsIGZvcm1hdHRlciwgZW5jb2RlVmFsdWVzT25seSwgY2hhcnNldCwgdmFsdWVTaWRlQ2hhbm5lbCkpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xufVxuZnVuY3Rpb24gbm9ybWFsaXplX3N0cmluZ2lmeV9vcHRpb25zKG9wdHMgPSBkZWZhdWx0cykge1xuICAgIGlmICh0eXBlb2Ygb3B0cy5hbGxvd0VtcHR5QXJyYXlzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygb3B0cy5hbGxvd0VtcHR5QXJyYXlzICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGFsbG93RW1wdHlBcnJheXNgIG9wdGlvbiBjYW4gb25seSBiZSBgdHJ1ZWAgb3IgYGZhbHNlYCwgd2hlbiBwcm92aWRlZCcpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIG9wdHMuZW5jb2RlRG90SW5LZXlzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygb3B0cy5lbmNvZGVEb3RJbktleXMgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdgZW5jb2RlRG90SW5LZXlzYCBvcHRpb24gY2FuIG9ubHkgYmUgYHRydWVgIG9yIGBmYWxzZWAsIHdoZW4gcHJvdmlkZWQnKTtcbiAgICB9XG4gICAgaWYgKG9wdHMuZW5jb2RlciAhPT0gbnVsbCAmJiB0eXBlb2Ygb3B0cy5lbmNvZGVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygb3B0cy5lbmNvZGVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0VuY29kZXIgaGFzIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuICAgIGNvbnN0IGNoYXJzZXQgPSBvcHRzLmNoYXJzZXQgfHwgZGVmYXVsdHMuY2hhcnNldDtcbiAgICBpZiAodHlwZW9mIG9wdHMuY2hhcnNldCAhPT0gJ3VuZGVmaW5lZCcgJiYgb3B0cy5jaGFyc2V0ICE9PSAndXRmLTgnICYmIG9wdHMuY2hhcnNldCAhPT0gJ2lzby04ODU5LTEnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBjaGFyc2V0IG9wdGlvbiBtdXN0IGJlIGVpdGhlciB1dGYtOCwgaXNvLTg4NTktMSwgb3IgdW5kZWZpbmVkJyk7XG4gICAgfVxuICAgIGxldCBmb3JtYXQgPSBkZWZhdWx0X2Zvcm1hdDtcbiAgICBpZiAodHlwZW9mIG9wdHMuZm9ybWF0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAoIWhhcy5jYWxsKGZvcm1hdHRlcnMsIG9wdHMuZm9ybWF0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBmb3JtYXQgb3B0aW9uIHByb3ZpZGVkLicpO1xuICAgICAgICB9XG4gICAgICAgIGZvcm1hdCA9IG9wdHMuZm9ybWF0O1xuICAgIH1cbiAgICBjb25zdCBmb3JtYXR0ZXIgPSBmb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgbGV0IGZpbHRlciA9IGRlZmF1bHRzLmZpbHRlcjtcbiAgICBpZiAodHlwZW9mIG9wdHMuZmlsdGVyID09PSAnZnVuY3Rpb24nIHx8IGlzX2FycmF5KG9wdHMuZmlsdGVyKSkge1xuICAgICAgICBmaWx0ZXIgPSBvcHRzLmZpbHRlcjtcbiAgICB9XG4gICAgbGV0IGFycmF5Rm9ybWF0O1xuICAgIGlmIChvcHRzLmFycmF5Rm9ybWF0ICYmIG9wdHMuYXJyYXlGb3JtYXQgaW4gYXJyYXlfcHJlZml4X2dlbmVyYXRvcnMpIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBvcHRzLmFycmF5Rm9ybWF0O1xuICAgIH1cbiAgICBlbHNlIGlmICgnaW5kaWNlcycgaW4gb3B0cykge1xuICAgICAgICBhcnJheUZvcm1hdCA9IG9wdHMuaW5kaWNlcyA/ICdpbmRpY2VzJyA6ICdyZXBlYXQnO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBkZWZhdWx0cy5hcnJheUZvcm1hdDtcbiAgICB9XG4gICAgaWYgKCdjb21tYVJvdW5kVHJpcCcgaW4gb3B0cyAmJiB0eXBlb2Ygb3B0cy5jb21tYVJvdW5kVHJpcCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2Bjb21tYVJvdW5kVHJpcGAgbXVzdCBiZSBhIGJvb2xlYW4sIG9yIGFic2VudCcpO1xuICAgIH1cbiAgICBjb25zdCBhbGxvd0RvdHMgPSB0eXBlb2Ygb3B0cy5hbGxvd0RvdHMgPT09ICd1bmRlZmluZWQnID9cbiAgICAgICAgISFvcHRzLmVuY29kZURvdEluS2V5cyA9PT0gdHJ1ZSA/XG4gICAgICAgICAgICB0cnVlXG4gICAgICAgICAgICA6IGRlZmF1bHRzLmFsbG93RG90c1xuICAgICAgICA6ICEhb3B0cy5hbGxvd0RvdHM7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWRkUXVlcnlQcmVmaXg6IHR5cGVvZiBvcHRzLmFkZFF1ZXJ5UHJlZml4ID09PSAnYm9vbGVhbicgPyBvcHRzLmFkZFF1ZXJ5UHJlZml4IDogZGVmYXVsdHMuYWRkUXVlcnlQcmVmaXgsXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgYWxsb3dEb3RzOiBhbGxvd0RvdHMsXG4gICAgICAgIGFsbG93RW1wdHlBcnJheXM6IHR5cGVvZiBvcHRzLmFsbG93RW1wdHlBcnJheXMgPT09ICdib29sZWFuJyA/ICEhb3B0cy5hbGxvd0VtcHR5QXJyYXlzIDogZGVmYXVsdHMuYWxsb3dFbXB0eUFycmF5cyxcbiAgICAgICAgYXJyYXlGb3JtYXQ6IGFycmF5Rm9ybWF0LFxuICAgICAgICBjaGFyc2V0OiBjaGFyc2V0LFxuICAgICAgICBjaGFyc2V0U2VudGluZWw6IHR5cGVvZiBvcHRzLmNoYXJzZXRTZW50aW5lbCA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5jaGFyc2V0U2VudGluZWwgOiBkZWZhdWx0cy5jaGFyc2V0U2VudGluZWwsXG4gICAgICAgIGNvbW1hUm91bmRUcmlwOiAhIW9wdHMuY29tbWFSb3VuZFRyaXAsXG4gICAgICAgIGRlbGltaXRlcjogdHlwZW9mIG9wdHMuZGVsaW1pdGVyID09PSAndW5kZWZpbmVkJyA/IGRlZmF1bHRzLmRlbGltaXRlciA6IG9wdHMuZGVsaW1pdGVyLFxuICAgICAgICBlbmNvZGU6IHR5cGVvZiBvcHRzLmVuY29kZSA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5lbmNvZGUgOiBkZWZhdWx0cy5lbmNvZGUsXG4gICAgICAgIGVuY29kZURvdEluS2V5czogdHlwZW9mIG9wdHMuZW5jb2RlRG90SW5LZXlzID09PSAnYm9vbGVhbicgPyBvcHRzLmVuY29kZURvdEluS2V5cyA6IGRlZmF1bHRzLmVuY29kZURvdEluS2V5cyxcbiAgICAgICAgZW5jb2RlcjogdHlwZW9mIG9wdHMuZW5jb2RlciA9PT0gJ2Z1bmN0aW9uJyA/IG9wdHMuZW5jb2RlciA6IGRlZmF1bHRzLmVuY29kZXIsXG4gICAgICAgIGVuY29kZVZhbHVlc09ubHk6IHR5cGVvZiBvcHRzLmVuY29kZVZhbHVlc09ubHkgPT09ICdib29sZWFuJyA/IG9wdHMuZW5jb2RlVmFsdWVzT25seSA6IGRlZmF1bHRzLmVuY29kZVZhbHVlc09ubHksXG4gICAgICAgIGZpbHRlcjogZmlsdGVyLFxuICAgICAgICBmb3JtYXQ6IGZvcm1hdCxcbiAgICAgICAgZm9ybWF0dGVyOiBmb3JtYXR0ZXIsXG4gICAgICAgIHNlcmlhbGl6ZURhdGU6IHR5cGVvZiBvcHRzLnNlcmlhbGl6ZURhdGUgPT09ICdmdW5jdGlvbicgPyBvcHRzLnNlcmlhbGl6ZURhdGUgOiBkZWZhdWx0cy5zZXJpYWxpemVEYXRlLFxuICAgICAgICBza2lwTnVsbHM6IHR5cGVvZiBvcHRzLnNraXBOdWxscyA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5za2lwTnVsbHMgOiBkZWZhdWx0cy5za2lwTnVsbHMsXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgc29ydDogdHlwZW9mIG9wdHMuc29ydCA9PT0gJ2Z1bmN0aW9uJyA/IG9wdHMuc29ydCA6IG51bGwsXG4gICAgICAgIHN0cmljdE51bGxIYW5kbGluZzogdHlwZW9mIG9wdHMuc3RyaWN0TnVsbEhhbmRsaW5nID09PSAnYm9vbGVhbicgPyBvcHRzLnN0cmljdE51bGxIYW5kbGluZyA6IGRlZmF1bHRzLnN0cmljdE51bGxIYW5kbGluZyxcbiAgICB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ2lmeShvYmplY3QsIG9wdHMgPSB7fSkge1xuICAgIGxldCBvYmogPSBvYmplY3Q7XG4gICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZV9zdHJpbmdpZnlfb3B0aW9ucyhvcHRzKTtcbiAgICBsZXQgb2JqX2tleXM7XG4gICAgbGV0IGZpbHRlcjtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgICAgICBvYmogPSBmaWx0ZXIoJycsIG9iaik7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzX2FycmF5KG9wdGlvbnMuZmlsdGVyKSkge1xuICAgICAgICBmaWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcbiAgICAgICAgb2JqX2tleXMgPSBmaWx0ZXI7XG4gICAgfVxuICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgY29uc3QgZ2VuZXJhdGVBcnJheVByZWZpeCA9IGFycmF5X3ByZWZpeF9nZW5lcmF0b3JzW29wdGlvbnMuYXJyYXlGb3JtYXRdO1xuICAgIGNvbnN0IGNvbW1hUm91bmRUcmlwID0gZ2VuZXJhdGVBcnJheVByZWZpeCA9PT0gJ2NvbW1hJyAmJiBvcHRpb25zLmNvbW1hUm91bmRUcmlwO1xuICAgIGlmICghb2JqX2tleXMpIHtcbiAgICAgICAgb2JqX2tleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy5zb3J0KSB7XG4gICAgICAgIG9ial9rZXlzLnNvcnQob3B0aW9ucy5zb3J0KTtcbiAgICB9XG4gICAgY29uc3Qgc2lkZUNoYW5uZWwgPSBuZXcgV2Vha01hcCgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2JqX2tleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3Qga2V5ID0gb2JqX2tleXNbaV07XG4gICAgICAgIGlmIChvcHRpb25zLnNraXBOdWxscyAmJiBvYmpba2V5XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgcHVzaF90b19hcnJheShrZXlzLCBpbm5lcl9zdHJpbmdpZnkob2JqW2tleV0sIGtleSwgXG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgZ2VuZXJhdGVBcnJheVByZWZpeCwgY29tbWFSb3VuZFRyaXAsIG9wdGlvbnMuYWxsb3dFbXB0eUFycmF5cywgb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcsIG9wdGlvbnMuc2tpcE51bGxzLCBvcHRpb25zLmVuY29kZURvdEluS2V5cywgb3B0aW9ucy5lbmNvZGUgPyBvcHRpb25zLmVuY29kZXIgOiBudWxsLCBvcHRpb25zLmZpbHRlciwgb3B0aW9ucy5zb3J0LCBvcHRpb25zLmFsbG93RG90cywgb3B0aW9ucy5zZXJpYWxpemVEYXRlLCBvcHRpb25zLmZvcm1hdCwgb3B0aW9ucy5mb3JtYXR0ZXIsIG9wdGlvbnMuZW5jb2RlVmFsdWVzT25seSwgb3B0aW9ucy5jaGFyc2V0LCBzaWRlQ2hhbm5lbCkpO1xuICAgIH1cbiAgICBjb25zdCBqb2luZWQgPSBrZXlzLmpvaW4ob3B0aW9ucy5kZWxpbWl0ZXIpO1xuICAgIGxldCBwcmVmaXggPSBvcHRpb25zLmFkZFF1ZXJ5UHJlZml4ID09PSB0cnVlID8gJz8nIDogJyc7XG4gICAgaWYgKG9wdGlvbnMuY2hhcnNldFNlbnRpbmVsKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmNoYXJzZXQgPT09ICdpc28tODg1OS0xJykge1xuICAgICAgICAgICAgLy8gZW5jb2RlVVJJQ29tcG9uZW50KCcmIzEwMDAzOycpLCB0aGUgXCJudW1lcmljIGVudGl0eVwiIHJlcHJlc2VudGF0aW9uIG9mIGEgY2hlY2ttYXJrXG4gICAgICAgICAgICBwcmVmaXggKz0gJ3V0Zjg9JTI2JTIzMTAwMDMlM0ImJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIGVuY29kZVVSSUNvbXBvbmVudCgn4pyTJylcbiAgICAgICAgICAgIHByZWZpeCArPSAndXRmOD0lRTIlOUMlOTMmJztcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gam9pbmVkLmxlbmd0aCA+IDAgPyBwcmVmaXggKyBqb2luZWQgOiAnJztcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0cmluZ2lmeS5tanMubWFwIiwiaW1wb3J0IHsgUkZDMTczOCB9IGZyb20gXCIuL2Zvcm1hdHMubWpzXCI7XG5jb25zdCBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuY29uc3QgaXNfYXJyYXkgPSBBcnJheS5pc0FycmF5O1xuY29uc3QgaGV4X3RhYmxlID0gKCgpID0+IHtcbiAgICBjb25zdCBhcnJheSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjU2OyArK2kpIHtcbiAgICAgICAgYXJyYXkucHVzaCgnJScgKyAoKGkgPCAxNiA/ICcwJyA6ICcnKSArIGkudG9TdHJpbmcoMTYpKS50b1VwcGVyQ2FzZSgpKTtcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5O1xufSkoKTtcbmZ1bmN0aW9uIGNvbXBhY3RfcXVldWUocXVldWUpIHtcbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCBpdGVtID0gcXVldWUucG9wKCk7XG4gICAgICAgIGlmICghaXRlbSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBvYmogPSBpdGVtLm9ialtpdGVtLnByb3BdO1xuICAgICAgICBpZiAoaXNfYXJyYXkob2JqKSkge1xuICAgICAgICAgICAgY29uc3QgY29tcGFjdGVkID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG9iai5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqW2pdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICBjb21wYWN0ZWQucHVzaChvYmpbal0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGl0ZW0ub2JqW2l0ZW0ucHJvcF0gPSBjb21wYWN0ZWQ7XG4gICAgICAgIH1cbiAgICB9XG59XG5mdW5jdGlvbiBhcnJheV90b19vYmplY3Qoc291cmNlLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgb2JqID0gb3B0aW9ucyAmJiBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZS5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAodHlwZW9mIHNvdXJjZVtpXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9ialtpXSA9IHNvdXJjZVtpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlKHRhcmdldCwgc291cmNlLCBvcHRpb25zID0ge30pIHtcbiAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHNvdXJjZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKGlzX2FycmF5KHRhcmdldCkpIHtcbiAgICAgICAgICAgIHRhcmdldC5wdXNoKHNvdXJjZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGFyZ2V0ICYmIHR5cGVvZiB0YXJnZXQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAoKG9wdGlvbnMgJiYgKG9wdGlvbnMucGxhaW5PYmplY3RzIHx8IG9wdGlvbnMuYWxsb3dQcm90b3R5cGVzKSkgfHxcbiAgICAgICAgICAgICAgICAhaGFzLmNhbGwoT2JqZWN0LnByb3RvdHlwZSwgc291cmNlKSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtzb3VyY2VdID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbdGFyZ2V0LCBzb3VyY2VdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuICAgIGlmICghdGFyZ2V0IHx8IHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBbdGFyZ2V0XS5jb25jYXQoc291cmNlKTtcbiAgICB9XG4gICAgbGV0IG1lcmdlVGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGlmIChpc19hcnJheSh0YXJnZXQpICYmICFpc19hcnJheShzb3VyY2UpKSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgbWVyZ2VUYXJnZXQgPSBhcnJheV90b19vYmplY3QodGFyZ2V0LCBvcHRpb25zKTtcbiAgICB9XG4gICAgaWYgKGlzX2FycmF5KHRhcmdldCkgJiYgaXNfYXJyYXkoc291cmNlKSkge1xuICAgICAgICBzb3VyY2UuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSwgaSkge1xuICAgICAgICAgICAgaWYgKGhhcy5jYWxsKHRhcmdldCwgaSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRJdGVtID0gdGFyZ2V0W2ldO1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRJdGVtICYmIHR5cGVvZiB0YXJnZXRJdGVtID09PSAnb2JqZWN0JyAmJiBpdGVtICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbaV0gPSBtZXJnZSh0YXJnZXRJdGVtLCBpdGVtLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldC5wdXNoKGl0ZW0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRhcmdldFtpXSA9IGl0ZW07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc291cmNlKS5yZWR1Y2UoZnVuY3Rpb24gKGFjYywga2V5KSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gc291cmNlW2tleV07XG4gICAgICAgIGlmIChoYXMuY2FsbChhY2MsIGtleSkpIHtcbiAgICAgICAgICAgIGFjY1trZXldID0gbWVyZ2UoYWNjW2tleV0sIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFjY1trZXldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCBtZXJnZVRhcmdldCk7XG59XG5leHBvcnQgZnVuY3Rpb24gYXNzaWduX3NpbmdsZV9zb3VyY2UodGFyZ2V0LCBzb3VyY2UpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc291cmNlKS5yZWR1Y2UoZnVuY3Rpb24gKGFjYywga2V5KSB7XG4gICAgICAgIGFjY1trZXldID0gc291cmNlW2tleV07XG4gICAgICAgIHJldHVybiBhY2M7XG4gICAgfSwgdGFyZ2V0KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGUoc3RyLCBfLCBjaGFyc2V0KSB7XG4gICAgY29uc3Qgc3RyV2l0aG91dFBsdXMgPSBzdHIucmVwbGFjZSgvXFwrL2csICcgJyk7XG4gICAgaWYgKGNoYXJzZXQgPT09ICdpc28tODg1OS0xJykge1xuICAgICAgICAvLyB1bmVzY2FwZSBuZXZlciB0aHJvd3MsIG5vIHRyeS4uLmNhdGNoIG5lZWRlZDpcbiAgICAgICAgcmV0dXJuIHN0cldpdGhvdXRQbHVzLnJlcGxhY2UoLyVbMC05YS1mXXsyfS9naSwgdW5lc2NhcGUpO1xuICAgIH1cbiAgICAvLyB1dGYtOFxuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyV2l0aG91dFBsdXMpO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gc3RyV2l0aG91dFBsdXM7XG4gICAgfVxufVxuY29uc3QgbGltaXQgPSAxMDI0O1xuZXhwb3J0IGNvbnN0IGVuY29kZSA9IChzdHIsIF9kZWZhdWx0RW5jb2RlciwgY2hhcnNldCwgX2tpbmQsIGZvcm1hdCkgPT4ge1xuICAgIC8vIFRoaXMgY29kZSB3YXMgb3JpZ2luYWxseSB3cml0dGVuIGJ5IEJyaWFuIFdoaXRlIGZvciB0aGUgaW8uanMgY29yZSBxdWVyeXN0cmluZyBsaWJyYXJ5LlxuICAgIC8vIEl0IGhhcyBiZWVuIGFkYXB0ZWQgaGVyZSBmb3Igc3RyaWN0ZXIgYWRoZXJlbmNlIHRvIFJGQyAzOTg2XG4gICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbGV0IHN0cmluZyA9IHN0cjtcbiAgICBpZiAodHlwZW9mIHN0ciA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgICAgc3RyaW5nID0gU3ltYm9sLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cik7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHN0cmluZyA9IFN0cmluZyhzdHIpO1xuICAgIH1cbiAgICBpZiAoY2hhcnNldCA9PT0gJ2lzby04ODU5LTEnKSB7XG4gICAgICAgIHJldHVybiBlc2NhcGUoc3RyaW5nKS5yZXBsYWNlKC8ldVswLTlhLWZdezR9L2dpLCBmdW5jdGlvbiAoJDApIHtcbiAgICAgICAgICAgIHJldHVybiAnJTI2JTIzJyArIHBhcnNlSW50KCQwLnNsaWNlKDIpLCAxNikgKyAnJTNCJztcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxldCBvdXQgPSAnJztcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHN0cmluZy5sZW5ndGg7IGogKz0gbGltaXQpIHtcbiAgICAgICAgY29uc3Qgc2VnbWVudCA9IHN0cmluZy5sZW5ndGggPj0gbGltaXQgPyBzdHJpbmcuc2xpY2UoaiwgaiArIGxpbWl0KSA6IHN0cmluZztcbiAgICAgICAgY29uc3QgYXJyID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudC5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IGMgPSBzZWdtZW50LmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAoYyA9PT0gMHgyZCB8fCAvLyAtXG4gICAgICAgICAgICAgICAgYyA9PT0gMHgyZSB8fCAvLyAuXG4gICAgICAgICAgICAgICAgYyA9PT0gMHg1ZiB8fCAvLyBfXG4gICAgICAgICAgICAgICAgYyA9PT0gMHg3ZSB8fCAvLyB+XG4gICAgICAgICAgICAgICAgKGMgPj0gMHgzMCAmJiBjIDw9IDB4MzkpIHx8IC8vIDAtOVxuICAgICAgICAgICAgICAgIChjID49IDB4NDEgJiYgYyA8PSAweDVhKSB8fCAvLyBhLXpcbiAgICAgICAgICAgICAgICAoYyA+PSAweDYxICYmIGMgPD0gMHg3YSkgfHwgLy8gQS1aXG4gICAgICAgICAgICAgICAgKGZvcm1hdCA9PT0gUkZDMTczOCAmJiAoYyA9PT0gMHgyOCB8fCBjID09PSAweDI5KSkgLy8gKCApXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBhcnJbYXJyLmxlbmd0aF0gPSBzZWdtZW50LmNoYXJBdChpKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjIDwgMHg4MCkge1xuICAgICAgICAgICAgICAgIGFyclthcnIubGVuZ3RoXSA9IGhleF90YWJsZVtjXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjIDwgMHg4MDApIHtcbiAgICAgICAgICAgICAgICBhcnJbYXJyLmxlbmd0aF0gPSBoZXhfdGFibGVbMHhjMCB8IChjID4+IDYpXSArIGhleF90YWJsZVsweDgwIHwgKGMgJiAweDNmKV07XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYyA8IDB4ZDgwMCB8fCBjID49IDB4ZTAwMCkge1xuICAgICAgICAgICAgICAgIGFyclthcnIubGVuZ3RoXSA9XG4gICAgICAgICAgICAgICAgICAgIGhleF90YWJsZVsweGUwIHwgKGMgPj4gMTIpXSArIGhleF90YWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzZildICsgaGV4X3RhYmxlWzB4ODAgfCAoYyAmIDB4M2YpXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICAgIGMgPSAweDEwMDAwICsgKCgoYyAmIDB4M2ZmKSA8PCAxMCkgfCAoc2VnbWVudC5jaGFyQ29kZUF0KGkpICYgMHgzZmYpKTtcbiAgICAgICAgICAgIGFyclthcnIubGVuZ3RoXSA9XG4gICAgICAgICAgICAgICAgaGV4X3RhYmxlWzB4ZjAgfCAoYyA+PiAxOCldICtcbiAgICAgICAgICAgICAgICAgICAgaGV4X3RhYmxlWzB4ODAgfCAoKGMgPj4gMTIpICYgMHgzZildICtcbiAgICAgICAgICAgICAgICAgICAgaGV4X3RhYmxlWzB4ODAgfCAoKGMgPj4gNikgJiAweDNmKV0gK1xuICAgICAgICAgICAgICAgICAgICBoZXhfdGFibGVbMHg4MCB8IChjICYgMHgzZildO1xuICAgICAgICB9XG4gICAgICAgIG91dCArPSBhcnIuam9pbignJyk7XG4gICAgfVxuICAgIHJldHVybiBvdXQ7XG59O1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhY3QodmFsdWUpIHtcbiAgICBjb25zdCBxdWV1ZSA9IFt7IG9iajogeyBvOiB2YWx1ZSB9LCBwcm9wOiAnbycgfV07XG4gICAgY29uc3QgcmVmcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IHF1ZXVlW2ldO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNvbnN0IG9iaiA9IGl0ZW0ub2JqW2l0ZW0ucHJvcF07XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgIGNvbnN0IGtleSA9IGtleXNbal07XG4gICAgICAgICAgICBjb25zdCB2YWwgPSBvYmpba2V5XTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiB2YWwgIT09IG51bGwgJiYgcmVmcy5pbmRleE9mKHZhbCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcXVldWUucHVzaCh7IG9iajogb2JqLCBwcm9wOiBrZXkgfSk7XG4gICAgICAgICAgICAgICAgcmVmcy5wdXNoKHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29tcGFjdF9xdWV1ZShxdWV1ZSk7XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGlzX3JlZ2V4cChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGlzX2J1ZmZlcihvYmopIHtcbiAgICBpZiAoIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiAhIShvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlcihvYmopKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjb21iaW5lKGEsIGIpIHtcbiAgICByZXR1cm4gW10uY29uY2F0KGEsIGIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1heWJlX21hcCh2YWwsIGZuKSB7XG4gICAgaWYgKGlzX2FycmF5KHZhbCkpIHtcbiAgICAgICAgY29uc3QgbWFwcGVkID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBtYXBwZWQucHVzaChmbih2YWxbaV0pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgIH1cbiAgICByZXR1cm4gZm4odmFsKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXV0aWxzLm1qcy5tYXAiLCIvKipcbiAqIE1vc3QgYnJvd3NlcnMgZG9uJ3QgeWV0IGhhdmUgYXN5bmMgaXRlcmFibGUgc3VwcG9ydCBmb3IgUmVhZGFibGVTdHJlYW0sXG4gKiBhbmQgTm9kZSBoYXMgYSB2ZXJ5IGRpZmZlcmVudCB3YXkgb2YgcmVhZGluZyBieXRlcyBmcm9tIGl0cyBcIlJlYWRhYmxlU3RyZWFtXCIuXG4gKlxuICogVGhpcyBwb2x5ZmlsbCB3YXMgcHVsbGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL01hdHRpYXNCdWVsZW5zL3dlYi1zdHJlYW1zLXBvbHlmaWxsL3B1bGwvMTIyI2lzc3VlY29tbWVudC0xNjI3MzU0NDkwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBSZWFkYWJsZVN0cmVhbVRvQXN5bmNJdGVyYWJsZShzdHJlYW0pIHtcbiAgICBpZiAoc3RyZWFtW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSlcbiAgICAgICAgcmV0dXJuIHN0cmVhbTtcbiAgICBjb25zdCByZWFkZXIgPSBzdHJlYW0uZ2V0UmVhZGVyKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgYXN5bmMgbmV4dCgpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0Py5kb25lKVxuICAgICAgICAgICAgICAgICAgICByZWFkZXIucmVsZWFzZUxvY2soKTsgLy8gcmVsZWFzZSBsb2NrIHdoZW4gc3RyZWFtIGJlY29tZXMgY2xvc2VkXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlbGVhc2VMb2NrKCk7IC8vIHJlbGVhc2UgbG9jayB3aGVuIHN0cmVhbSBiZWNvbWVzIGVycm9yZWRcbiAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhc3luYyByZXR1cm4oKSB7XG4gICAgICAgICAgICBjb25zdCBjYW5jZWxQcm9taXNlID0gcmVhZGVyLmNhbmNlbCgpO1xuICAgICAgICAgICAgcmVhZGVyLnJlbGVhc2VMb2NrKCk7XG4gICAgICAgICAgICBhd2FpdCBjYW5jZWxQcm9taXNlO1xuICAgICAgICAgICAgcmV0dXJuIHsgZG9uZTogdHJ1ZSwgdmFsdWU6IHVuZGVmaW5lZCB9O1xuICAgICAgICB9LFxuICAgICAgICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG4gICAgfTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0cmVhbS11dGlscy5tanMubWFwIiwidmFyIF9fY2xhc3NQcml2YXRlRmllbGRHZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRHZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcbn07XG52YXIgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbENvbnRlbnQsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsTWVzc2FnZSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGwsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9jYWxjdWxhdGVUb3RhbFVzYWdlLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl92YWxpZGF0ZVBhcmFtcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfc3RyaW5naWZ5RnVuY3Rpb25DYWxsUmVzdWx0O1xuaW1wb3J0IHsgT3BlbkFJRXJyb3IgfSBmcm9tIFwiLi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgeyBpc1J1bm5hYmxlRnVuY3Rpb25XaXRoUGFyc2UsIH0gZnJvbSBcIi4vUnVubmFibGVGdW5jdGlvbi5tanNcIjtcbmltcG9ydCB7IGlzQXNzaXN0YW50TWVzc2FnZSwgaXNGdW5jdGlvbk1lc3NhZ2UsIGlzVG9vbE1lc3NhZ2UgfSBmcm9tIFwiLi9jaGF0Q29tcGxldGlvblV0aWxzLm1qc1wiO1xuaW1wb3J0IHsgRXZlbnRTdHJlYW0gfSBmcm9tIFwiLi9FdmVudFN0cmVhbS5tanNcIjtcbmltcG9ydCB7IGlzQXV0b1BhcnNhYmxlVG9vbCwgcGFyc2VDaGF0Q29tcGxldGlvbiB9IGZyb20gXCIuLi9saWIvcGFyc2VyLm1qc1wiO1xuY29uc3QgREVGQVVMVF9NQVhfQ0hBVF9DT01QTEVUSU9OUyA9IDEwO1xuZXhwb3J0IGNsYXNzIEFic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIgZXh0ZW5kcyBFdmVudFN0cmVhbSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcy5hZGQodGhpcyk7XG4gICAgICAgIHRoaXMuX2NoYXRDb21wbGV0aW9ucyA9IFtdO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gW107XG4gICAgfVxuICAgIF9hZGRDaGF0Q29tcGxldGlvbihjaGF0Q29tcGxldGlvbikge1xuICAgICAgICB0aGlzLl9jaGF0Q29tcGxldGlvbnMucHVzaChjaGF0Q29tcGxldGlvbik7XG4gICAgICAgIHRoaXMuX2VtaXQoJ2NoYXRDb21wbGV0aW9uJywgY2hhdENvbXBsZXRpb24pO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gY2hhdENvbXBsZXRpb24uY2hvaWNlc1swXT8ubWVzc2FnZTtcbiAgICAgICAgaWYgKG1lc3NhZ2UpXG4gICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gY2hhdENvbXBsZXRpb247XG4gICAgfVxuICAgIF9hZGRNZXNzYWdlKG1lc3NhZ2UsIGVtaXQgPSB0cnVlKSB7XG4gICAgICAgIGlmICghKCdjb250ZW50JyBpbiBtZXNzYWdlKSlcbiAgICAgICAgICAgIG1lc3NhZ2UuY29udGVudCA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgaWYgKGVtaXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ21lc3NhZ2UnLCBtZXNzYWdlKTtcbiAgICAgICAgICAgIGlmICgoaXNGdW5jdGlvbk1lc3NhZ2UobWVzc2FnZSkgfHwgaXNUb29sTWVzc2FnZShtZXNzYWdlKSkgJiYgbWVzc2FnZS5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gTm90ZSwgdGhpcyBhc3N1bWVzIHRoYXQge3JvbGU6ICd0b29sJywgY29udGVudDog4oCmfSBpcyBhbHdheXMgdGhlIHJlc3VsdCBvZiBhIGNhbGwgb2YgdG9vbCBvZiB0eXBlPWZ1bmN0aW9uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2Z1bmN0aW9uQ2FsbFJlc3VsdCcsIG1lc3NhZ2UuY29udGVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0Fzc2lzdGFudE1lc3NhZ2UobWVzc2FnZSkgJiYgbWVzc2FnZS5mdW5jdGlvbl9jYWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnZnVuY3Rpb25DYWxsJywgbWVzc2FnZS5mdW5jdGlvbl9jYWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGlzQXNzaXN0YW50TWVzc2FnZShtZXNzYWdlKSAmJiBtZXNzYWdlLnRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2xfY2FsbCBvZiBtZXNzYWdlLnRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2xfY2FsbC50eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdmdW5jdGlvbkNhbGwnLCB0b29sX2NhbGwuZnVuY3Rpb24pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGZpbmFsIENoYXRDb21wbGV0aW9uLCBvciByZWplY3RzXG4gICAgICogaWYgYW4gZXJyb3Igb2NjdXJyZWQgb3IgdGhlIHN0cmVhbSBlbmRlZCBwcmVtYXR1cmVseSB3aXRob3V0IHByb2R1Y2luZyBhIENoYXRDb21wbGV0aW9uLlxuICAgICAqL1xuICAgIGFzeW5jIGZpbmFsQ2hhdENvbXBsZXRpb24oKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICBjb25zdCBjb21wbGV0aW9uID0gdGhpcy5fY2hhdENvbXBsZXRpb25zW3RoaXMuX2NoYXRDb21wbGV0aW9ucy5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKCFjb21wbGV0aW9uKVxuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKCdzdHJlYW0gZW5kZWQgd2l0aG91dCBwcm9kdWNpbmcgYSBDaGF0Q29tcGxldGlvbicpO1xuICAgICAgICByZXR1cm4gY29tcGxldGlvbjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQHJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgY29udGVudCBvZiB0aGUgZmluYWwgQ2hhdENvbXBsZXRpb25NZXNzYWdlLCBvciByZWplY3RzXG4gICAgICogaWYgYW4gZXJyb3Igb2NjdXJyZWQgb3IgdGhlIHN0cmVhbSBlbmRlZCBwcmVtYXR1cmVseSB3aXRob3V0IHByb2R1Y2luZyBhIENoYXRDb21wbGV0aW9uTWVzc2FnZS5cbiAgICAgKi9cbiAgICBhc3luYyBmaW5hbENvbnRlbnQoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbENvbnRlbnQpLmNhbGwodGhpcyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHRoZSBmaW5hbCBhc3Npc3RhbnQgQ2hhdENvbXBsZXRpb25NZXNzYWdlIHJlc3BvbnNlLFxuICAgICAqIG9yIHJlamVjdHMgaWYgYW4gZXJyb3Igb2NjdXJyZWQgb3IgdGhlIHN0cmVhbSBlbmRlZCBwcmVtYXR1cmVseSB3aXRob3V0IHByb2R1Y2luZyBhIENoYXRDb21wbGV0aW9uTWVzc2FnZS5cbiAgICAgKi9cbiAgICBhc3luYyBmaW5hbE1lc3NhZ2UoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbE1lc3NhZ2UpLmNhbGwodGhpcyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGNvbnRlbnQgb2YgdGhlIGZpbmFsIEZ1bmN0aW9uQ2FsbCwgb3IgcmVqZWN0c1xuICAgICAqIGlmIGFuIGVycm9yIG9jY3VycmVkIG9yIHRoZSBzdHJlYW0gZW5kZWQgcHJlbWF0dXJlbHkgd2l0aG91dCBwcm9kdWNpbmcgYSBDaGF0Q29tcGxldGlvbk1lc3NhZ2UuXG4gICAgICovXG4gICAgYXN5bmMgZmluYWxGdW5jdGlvbkNhbGwoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbCkuY2FsbCh0aGlzKTtcbiAgICB9XG4gICAgYXN5bmMgZmluYWxGdW5jdGlvbkNhbGxSZXN1bHQoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCkuY2FsbCh0aGlzKTtcbiAgICB9XG4gICAgYXN5bmMgdG90YWxVc2FnZSgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2NhbGN1bGF0ZVRvdGFsVXNhZ2UpLmNhbGwodGhpcyk7XG4gICAgfVxuICAgIGFsbENoYXRDb21wbGV0aW9ucygpIHtcbiAgICAgICAgcmV0dXJuIFsuLi50aGlzLl9jaGF0Q29tcGxldGlvbnNdO1xuICAgIH1cbiAgICBfZW1pdEZpbmFsKCkge1xuICAgICAgICBjb25zdCBjb21wbGV0aW9uID0gdGhpcy5fY2hhdENvbXBsZXRpb25zW3RoaXMuX2NoYXRDb21wbGV0aW9ucy5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKGNvbXBsZXRpb24pXG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdmaW5hbENoYXRDb21wbGV0aW9uJywgY29tcGxldGlvbik7XG4gICAgICAgIGNvbnN0IGZpbmFsTWVzc2FnZSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxNZXNzYWdlKS5jYWxsKHRoaXMpO1xuICAgICAgICBpZiAoZmluYWxNZXNzYWdlKVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZmluYWxNZXNzYWdlJywgZmluYWxNZXNzYWdlKTtcbiAgICAgICAgY29uc3QgZmluYWxDb250ZW50ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbENvbnRlbnQpLmNhbGwodGhpcyk7XG4gICAgICAgIGlmIChmaW5hbENvbnRlbnQpXG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdmaW5hbENvbnRlbnQnLCBmaW5hbENvbnRlbnQpO1xuICAgICAgICBjb25zdCBmaW5hbEZ1bmN0aW9uQ2FsbCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGwpLmNhbGwodGhpcyk7XG4gICAgICAgIGlmIChmaW5hbEZ1bmN0aW9uQ2FsbClcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ZpbmFsRnVuY3Rpb25DYWxsJywgZmluYWxGdW5jdGlvbkNhbGwpO1xuICAgICAgICBjb25zdCBmaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGxSZXN1bHQpLmNhbGwodGhpcyk7XG4gICAgICAgIGlmIChmaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCAhPSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZmluYWxGdW5jdGlvbkNhbGxSZXN1bHQnLCBmaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCk7XG4gICAgICAgIGlmICh0aGlzLl9jaGF0Q29tcGxldGlvbnMuc29tZSgoYykgPT4gYy51c2FnZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3RvdGFsVXNhZ2UnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2NhbGN1bGF0ZVRvdGFsVXNhZ2UpLmNhbGwodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIF9jcmVhdGVDaGF0Q29tcGxldGlvbihjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3ZhbGlkYXRlUGFyYW1zKS5jYWxsKHRoaXMsIHBhcmFtcyk7XG4gICAgICAgIGNvbnN0IGNoYXRDb21wbGV0aW9uID0gYXdhaXQgY2xpZW50LmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKHsgLi4ucGFyYW1zLCBzdHJlYW06IGZhbHNlIH0sIHsgLi4ub3B0aW9ucywgc2lnbmFsOiB0aGlzLmNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoYXRDb21wbGV0aW9uKHBhcnNlQ2hhdENvbXBsZXRpb24oY2hhdENvbXBsZXRpb24sIHBhcmFtcykpO1xuICAgIH1cbiAgICBhc3luYyBfcnVuQ2hhdENvbXBsZXRpb24oY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgZm9yIChjb25zdCBtZXNzYWdlIG9mIHBhcmFtcy5tZXNzYWdlcykge1xuICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZShtZXNzYWdlLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX2NyZWF0ZUNoYXRDb21wbGV0aW9uKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgICB9XG4gICAgYXN5bmMgX3J1bkZ1bmN0aW9ucyhjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCByb2xlID0gJ2Z1bmN0aW9uJztcbiAgICAgICAgY29uc3QgeyBmdW5jdGlvbl9jYWxsID0gJ2F1dG8nLCBzdHJlYW0sIC4uLnJlc3RQYXJhbXMgfSA9IHBhcmFtcztcbiAgICAgICAgY29uc3Qgc2luZ2xlRnVuY3Rpb25Ub0NhbGwgPSB0eXBlb2YgZnVuY3Rpb25fY2FsbCAhPT0gJ3N0cmluZycgJiYgZnVuY3Rpb25fY2FsbD8ubmFtZTtcbiAgICAgICAgY29uc3QgeyBtYXhDaGF0Q29tcGxldGlvbnMgPSBERUZBVUxUX01BWF9DSEFUX0NPTVBMRVRJT05TIH0gPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICBjb25zdCBmdW5jdGlvbnNCeU5hbWUgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBmIG9mIHBhcmFtcy5mdW5jdGlvbnMpIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uc0J5TmFtZVtmLm5hbWUgfHwgZi5mdW5jdGlvbi5uYW1lXSA9IGY7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVuY3Rpb25zID0gcGFyYW1zLmZ1bmN0aW9ucy5tYXAoKGYpID0+ICh7XG4gICAgICAgICAgICBuYW1lOiBmLm5hbWUgfHwgZi5mdW5jdGlvbi5uYW1lLFxuICAgICAgICAgICAgcGFyYW1ldGVyczogZi5wYXJhbWV0ZXJzLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGYuZGVzY3JpcHRpb24sXG4gICAgICAgIH0pKTtcbiAgICAgICAgZm9yIChjb25zdCBtZXNzYWdlIG9mIHBhcmFtcy5tZXNzYWdlcykge1xuICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZShtZXNzYWdlLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhDaGF0Q29tcGxldGlvbnM7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY2hhdENvbXBsZXRpb24gPSBhd2FpdCB0aGlzLl9jcmVhdGVDaGF0Q29tcGxldGlvbihjbGllbnQsIHtcbiAgICAgICAgICAgICAgICAuLi5yZXN0UGFyYW1zLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uX2NhbGwsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25zLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbLi4udGhpcy5tZXNzYWdlc10sXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjaGF0Q29tcGxldGlvbi5jaG9pY2VzWzBdPy5tZXNzYWdlO1xuICAgICAgICAgICAgaWYgKCFtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIG1lc3NhZ2UgaW4gQ2hhdENvbXBsZXRpb24gcmVzcG9uc2VgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbWVzc2FnZS5mdW5jdGlvbl9jYWxsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IHsgbmFtZSwgYXJndW1lbnRzOiBhcmdzIH0gPSBtZXNzYWdlLmZ1bmN0aW9uX2NhbGw7XG4gICAgICAgICAgICBjb25zdCBmbiA9IGZ1bmN0aW9uc0J5TmFtZVtuYW1lXTtcbiAgICAgICAgICAgIGlmICghZm4pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYEludmFsaWQgZnVuY3Rpb25fY2FsbDogJHtKU09OLnN0cmluZ2lmeShuYW1lKX0uIEF2YWlsYWJsZSBvcHRpb25zIGFyZTogJHtmdW5jdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgLm1hcCgoZikgPT4gSlNPTi5zdHJpbmdpZnkoZi5uYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9LiBQbGVhc2UgdHJ5IGFnYWluYDtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgbmFtZSwgY29udGVudCB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHNpbmdsZUZ1bmN0aW9uVG9DYWxsICYmIHNpbmdsZUZ1bmN0aW9uVG9DYWxsICE9PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGBJbnZhbGlkIGZ1bmN0aW9uX2NhbGw6ICR7SlNPTi5zdHJpbmdpZnkobmFtZSl9LiAke0pTT04uc3RyaW5naWZ5KHNpbmdsZUZ1bmN0aW9uVG9DYWxsKX0gcmVxdWVzdGVkLiBQbGVhc2UgdHJ5IGFnYWluYDtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgbmFtZSwgY29udGVudCB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBwYXJzZWQ7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBhcnNlZCA9IGlzUnVubmFibGVGdW5jdGlvbldpdGhQYXJzZShmbikgPyBhd2FpdCBmbi5wYXJzZShhcmdzKSA6IGFyZ3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICAgICAgcm9sZSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBpdCBjYW4ndCBydWxlIG91dCBgbmV2ZXJgIHR5cGUuXG4gICAgICAgICAgICBjb25zdCByYXdDb250ZW50ID0gYXdhaXQgZm4uZnVuY3Rpb24ocGFyc2VkLCB0aGlzKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3N0cmluZ2lmeUZ1bmN0aW9uQ2FsbFJlc3VsdCkuY2FsbCh0aGlzLCByYXdDb250ZW50KTtcbiAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCBuYW1lLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgaWYgKHNpbmdsZUZ1bmN0aW9uVG9DYWxsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBfcnVuVG9vbHMoY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgcm9sZSA9ICd0b29sJztcbiAgICAgICAgY29uc3QgeyB0b29sX2Nob2ljZSA9ICdhdXRvJywgc3RyZWFtLCAuLi5yZXN0UGFyYW1zIH0gPSBwYXJhbXM7XG4gICAgICAgIGNvbnN0IHNpbmdsZUZ1bmN0aW9uVG9DYWxsID0gdHlwZW9mIHRvb2xfY2hvaWNlICE9PSAnc3RyaW5nJyAmJiB0b29sX2Nob2ljZT8uZnVuY3Rpb24/Lm5hbWU7XG4gICAgICAgIGNvbnN0IHsgbWF4Q2hhdENvbXBsZXRpb25zID0gREVGQVVMVF9NQVhfQ0hBVF9DT01QTEVUSU9OUyB9ID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgLy8gVE9ETyhzb21lZGF5KTogY2xlYW4gdGhpcyBsb2dpYyB1cFxuICAgICAgICBjb25zdCBpbnB1dFRvb2xzID0gcGFyYW1zLnRvb2xzLm1hcCgodG9vbCkgPT4ge1xuICAgICAgICAgICAgaWYgKGlzQXV0b1BhcnNhYmxlVG9vbCh0b29sKSkge1xuICAgICAgICAgICAgICAgIGlmICghdG9vbC4kY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKCdUb29sIGdpdmVuIHRvIGAucnVuVG9vbHMoKWAgdGhhdCBkb2VzIG5vdCBoYXZlIGFuIGFzc29jaWF0ZWQgZnVuY3Rpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uOiB0b29sLiRjYWxsYmFjayxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wuZnVuY3Rpb24ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmZ1bmN0aW9uLmRlc2NyaXB0aW9uIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyczogdG9vbC5mdW5jdGlvbi5wYXJhbWV0ZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2U6IHRvb2wuJHBhcnNlUmF3LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyaWN0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdG9vbDtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uc0J5TmFtZSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGYgb2YgaW5wdXRUb29scykge1xuICAgICAgICAgICAgaWYgKGYudHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uc0J5TmFtZVtmLmZ1bmN0aW9uLm5hbWUgfHwgZi5mdW5jdGlvbi5mdW5jdGlvbi5uYW1lXSA9IGYuZnVuY3Rpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdG9vbHMgPSAndG9vbHMnIGluIHBhcmFtcyA/XG4gICAgICAgICAgICBpbnB1dFRvb2xzLm1hcCgodCkgPT4gdC50eXBlID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0LmZ1bmN0aW9uLm5hbWUgfHwgdC5mdW5jdGlvbi5mdW5jdGlvbi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyczogdC5mdW5jdGlvbi5wYXJhbWV0ZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHQuZnVuY3Rpb24uZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJpY3Q6IHQuZnVuY3Rpb24uc3RyaWN0LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA6IHQpXG4gICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgZm9yIChjb25zdCBtZXNzYWdlIG9mIHBhcmFtcy5tZXNzYWdlcykge1xuICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZShtZXNzYWdlLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhDaGF0Q29tcGxldGlvbnM7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY2hhdENvbXBsZXRpb24gPSBhd2FpdCB0aGlzLl9jcmVhdGVDaGF0Q29tcGxldGlvbihjbGllbnQsIHtcbiAgICAgICAgICAgICAgICAuLi5yZXN0UGFyYW1zLFxuICAgICAgICAgICAgICAgIHRvb2xfY2hvaWNlLFxuICAgICAgICAgICAgICAgIHRvb2xzLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbLi4udGhpcy5tZXNzYWdlc10sXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjaGF0Q29tcGxldGlvbi5jaG9pY2VzWzBdPy5tZXNzYWdlO1xuICAgICAgICAgICAgaWYgKCFtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIG1lc3NhZ2UgaW4gQ2hhdENvbXBsZXRpb24gcmVzcG9uc2VgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbWVzc2FnZS50b29sX2NhbGxzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2xfY2FsbCBvZiBtZXNzYWdlLnRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAodG9vbF9jYWxsLnR5cGUgIT09ICdmdW5jdGlvbicpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xfY2FsbF9pZCA9IHRvb2xfY2FsbC5pZDtcbiAgICAgICAgICAgICAgICBjb25zdCB7IG5hbWUsIGFyZ3VtZW50czogYXJncyB9ID0gdG9vbF9jYWxsLmZ1bmN0aW9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZuID0gZnVuY3Rpb25zQnlOYW1lW25hbWVdO1xuICAgICAgICAgICAgICAgIGlmICghZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGBJbnZhbGlkIHRvb2xfY2FsbDogJHtKU09OLnN0cmluZ2lmeShuYW1lKX0uIEF2YWlsYWJsZSBvcHRpb25zIGFyZTogJHtPYmplY3Qua2V5cyhmdW5jdGlvbnNCeU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChuYW1lKSA9PiBKU09OLnN0cmluZ2lmeShuYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfS4gUGxlYXNlIHRyeSBhZ2FpbmA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCB0b29sX2NhbGxfaWQsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzaW5nbGVGdW5jdGlvblRvQ2FsbCAmJiBzaW5nbGVGdW5jdGlvblRvQ2FsbCAhPT0gbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYEludmFsaWQgdG9vbF9jYWxsOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfS4gJHtKU09OLnN0cmluZ2lmeShzaW5nbGVGdW5jdGlvblRvQ2FsbCl9IHJlcXVlc3RlZC4gUGxlYXNlIHRyeSBhZ2FpbmA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCB0b29sX2NhbGxfaWQsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsZXQgcGFyc2VkO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcnNlZCA9IGlzUnVubmFibGVGdW5jdGlvbldpdGhQYXJzZShmbikgPyBhd2FpdCBmbi5wYXJzZShhcmdzKSA6IGFyZ3M7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgdG9vbF9jYWxsX2lkLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBpdCBjYW4ndCBydWxlIG91dCBgbmV2ZXJgIHR5cGUuXG4gICAgICAgICAgICAgICAgY29uc3QgcmF3Q29udGVudCA9IGF3YWl0IGZuLmZ1bmN0aW9uKHBhcnNlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfc3RyaW5naWZ5RnVuY3Rpb25DYWxsUmVzdWx0KS5jYWxsKHRoaXMsIHJhd0NvbnRlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCB0b29sX2NhbGxfaWQsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHNpbmdsZUZ1bmN0aW9uVG9DYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbn1cbl9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcyA9IG5ldyBXZWFrU2V0KCksIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsQ29udGVudCA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsQ29udGVudCgpIHtcbiAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbE1lc3NhZ2UpLmNhbGwodGhpcykuY29udGVudCA/PyBudWxsO1xufSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxNZXNzYWdlID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxNZXNzYWdlKCkge1xuICAgIGxldCBpID0gdGhpcy5tZXNzYWdlcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSA+IDApIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZXNbaV07XG4gICAgICAgIGlmIChpc0Fzc2lzdGFudE1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgZnVuY3Rpb25fY2FsbCwgLi4ucmVzdCB9ID0gbWVzc2FnZTtcbiAgICAgICAgICAgIC8vIFRPRE86IHN1cHBvcnQgYXVkaW8gaGVyZVxuICAgICAgICAgICAgY29uc3QgcmV0ID0ge1xuICAgICAgICAgICAgICAgIC4uLnJlc3QsXG4gICAgICAgICAgICAgICAgY29udGVudDogbWVzc2FnZS5jb250ZW50ID8/IG51bGwsXG4gICAgICAgICAgICAgICAgcmVmdXNhbDogbWVzc2FnZS5yZWZ1c2FsID8/IG51bGwsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGZ1bmN0aW9uX2NhbGwpIHtcbiAgICAgICAgICAgICAgICByZXQuZnVuY3Rpb25fY2FsbCA9IGZ1bmN0aW9uX2NhbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcignc3RyZWFtIGVuZGVkIHdpdGhvdXQgcHJvZHVjaW5nIGEgQ2hhdENvbXBsZXRpb25NZXNzYWdlIHdpdGggcm9sZT1hc3Npc3RhbnQnKTtcbn0sIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGwoKSB7XG4gICAgZm9yIChsZXQgaSA9IHRoaXMubWVzc2FnZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZXNbaV07XG4gICAgICAgIGlmIChpc0Fzc2lzdGFudE1lc3NhZ2UobWVzc2FnZSkgJiYgbWVzc2FnZT8uZnVuY3Rpb25fY2FsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG1lc3NhZ2UuZnVuY3Rpb25fY2FsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNBc3Npc3RhbnRNZXNzYWdlKG1lc3NhZ2UpICYmIG1lc3NhZ2U/LnRvb2xfY2FsbHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIG1lc3NhZ2UudG9vbF9jYWxscy5hdCgtMSk/LmZ1bmN0aW9uO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybjtcbn0sIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0ID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGxSZXN1bHQoKSB7XG4gICAgZm9yIChsZXQgaSA9IHRoaXMubWVzc2FnZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZXNbaV07XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uTWVzc2FnZShtZXNzYWdlKSAmJiBtZXNzYWdlLmNvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG1lc3NhZ2UuY29udGVudDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNUb29sTWVzc2FnZShtZXNzYWdlKSAmJlxuICAgICAgICAgICAgbWVzc2FnZS5jb250ZW50ICE9IG51bGwgJiZcbiAgICAgICAgICAgIHR5cGVvZiBtZXNzYWdlLmNvbnRlbnQgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnNvbWUoKHgpID0+IHgucm9sZSA9PT0gJ2Fzc2lzdGFudCcgJiZcbiAgICAgICAgICAgICAgICB4LnRvb2xfY2FsbHM/LnNvbWUoKHkpID0+IHkudHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJiB5LmlkID09PSBtZXNzYWdlLnRvb2xfY2FsbF9pZCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gbWVzc2FnZS5jb250ZW50O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybjtcbn0sIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2NhbGN1bGF0ZVRvdGFsVXNhZ2UgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9jYWxjdWxhdGVUb3RhbFVzYWdlKCkge1xuICAgIGNvbnN0IHRvdGFsID0ge1xuICAgICAgICBjb21wbGV0aW9uX3Rva2VuczogMCxcbiAgICAgICAgcHJvbXB0X3Rva2VuczogMCxcbiAgICAgICAgdG90YWxfdG9rZW5zOiAwLFxuICAgIH07XG4gICAgZm9yIChjb25zdCB7IHVzYWdlIH0gb2YgdGhpcy5fY2hhdENvbXBsZXRpb25zKSB7XG4gICAgICAgIGlmICh1c2FnZSkge1xuICAgICAgICAgICAgdG90YWwuY29tcGxldGlvbl90b2tlbnMgKz0gdXNhZ2UuY29tcGxldGlvbl90b2tlbnM7XG4gICAgICAgICAgICB0b3RhbC5wcm9tcHRfdG9rZW5zICs9IHVzYWdlLnByb21wdF90b2tlbnM7XG4gICAgICAgICAgICB0b3RhbC50b3RhbF90b2tlbnMgKz0gdXNhZ2UudG90YWxfdG9rZW5zO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0b3RhbDtcbn0sIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3ZhbGlkYXRlUGFyYW1zID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfdmFsaWRhdGVQYXJhbXMocGFyYW1zKSB7XG4gICAgaWYgKHBhcmFtcy5uICE9IG51bGwgJiYgcGFyYW1zLm4gPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcignQ2hhdENvbXBsZXRpb24gY29udmVuaWVuY2UgaGVscGVycyBvbmx5IHN1cHBvcnQgbj0xIGF0IHRoaXMgdGltZS4gVG8gdXNlIG4+MSwgcGxlYXNlIHVzZSBjaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSgpIGRpcmVjdGx5LicpO1xuICAgIH1cbn0sIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3N0cmluZ2lmeUZ1bmN0aW9uQ2FsbFJlc3VsdCA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3N0cmluZ2lmeUZ1bmN0aW9uQ2FsbFJlc3VsdChyYXdDb250ZW50KSB7XG4gICAgcmV0dXJuICh0eXBlb2YgcmF3Q29udGVudCA9PT0gJ3N0cmluZycgPyByYXdDb250ZW50XG4gICAgICAgIDogcmF3Q29udGVudCA9PT0gdW5kZWZpbmVkID8gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgIDogSlNPTi5zdHJpbmdpZnkocmF3Q29udGVudCkpO1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUFic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIubWpzLm1hcCIsInZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XG59O1xudmFyIF9fY2xhc3NQcml2YXRlRmllbGRTZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRTZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xufTtcbnZhciBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgX0Fzc2lzdGFudFN0cmVhbV9ldmVudHMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3RzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4LCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbEluZGV4LCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50RXZlbnQsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blNuYXBzaG90LCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TdGVwU25hcHNob3QsIF9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQsIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVNZXNzYWdlLCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1blN0ZXAsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlRXZlbnQsIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZVJ1blN0ZXAsIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZU1lc3NhZ2UsIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZUNvbnRlbnQsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IFN0cmVhbSB9IGZyb20gXCIuLi9zdHJlYW1pbmcubWpzXCI7XG5pbXBvcnQgeyBBUElVc2VyQWJvcnRFcnJvciwgT3BlbkFJRXJyb3IgfSBmcm9tIFwiLi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgeyBFdmVudFN0cmVhbSB9IGZyb20gXCIuL0V2ZW50U3RyZWFtLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEFzc2lzdGFudFN0cmVhbSBleHRlbmRzIEV2ZW50U3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMuYWRkKHRoaXMpO1xuICAgICAgICAvL1RyYWNrIGFsbCBldmVudHMgaW4gYSBzaW5nbGUgbGlzdCBmb3IgcmVmZXJlbmNlXG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fZXZlbnRzLnNldCh0aGlzLCBbXSk7XG4gICAgICAgIC8vVXNlZCB0byBhY2N1bXVsYXRlIGRlbHRhc1xuICAgICAgICAvL1dlIGFyZSBhY2N1bXVsYXRpbmcgbWFueSB0eXBlcyBzbyB0aGUgdmFsdWUgaGVyZSBpcyBub3Qgc3RyaWN0XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cy5zZXQodGhpcywge30pO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdHMuc2V0KHRoaXMsIHt9KTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3Quc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4uc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGxJbmRleC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIC8vRm9yIGN1cnJlbnQgc25hcHNob3QgbWV0aG9kc1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRFdmVudC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU25hcHNob3Quc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blN0ZXBTbmFwc2hvdC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICB9XG4gICAgWyhfQXNzaXN0YW50U3RyZWFtX2V2ZW50cyA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cyA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90cyA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbEluZGV4ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRFdmVudCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blNuYXBzaG90ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU3RlcFNuYXBzaG90ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMgPSBuZXcgV2Vha1NldCgpLCBTeW1ib2wuYXN5bmNJdGVyYXRvcildKCkge1xuICAgICAgICBjb25zdCBwdXNoUXVldWUgPSBbXTtcbiAgICAgICAgY29uc3QgcmVhZFF1ZXVlID0gW107XG4gICAgICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgICAgIC8vQ2F0Y2ggYWxsIGZvciBwYXNzaW5nIGFsb25nIGFsbCBldmVudHNcbiAgICAgICAgdGhpcy5vbignZXZlbnQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWRlciA9IHJlYWRRdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKHJlYWRlcikge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZXNvbHZlKGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHB1c2hRdWV1ZS5wdXNoKGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlc29sdmUodW5kZWZpbmVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlYWRRdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbignYWJvcnQnLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVhZGVyIG9mIHJlYWRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlYWRRdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVhZGVyIG9mIHJlYWRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlYWRRdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5leHQ6IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXB1c2hRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gcmVhZFF1ZXVlLnB1c2goeyByZXNvbHZlLCByZWplY3QgfSkpLnRoZW4oKGNodW5rKSA9PiAoY2h1bmsgPyB7IHZhbHVlOiBjaHVuaywgZG9uZTogZmFsc2UgfSA6IHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGNodW5rID0gcHVzaFF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IGNodW5rLCBkb25lOiBmYWxzZSB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJldHVybjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cbiAgICBzdGF0aWMgZnJvbVJlYWRhYmxlU3RyZWFtKHN0cmVhbSkge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQXNzaXN0YW50U3RyZWFtKCk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fZnJvbVJlYWRhYmxlU3RyZWFtKHN0cmVhbSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBhc3luYyBfZnJvbVJlYWRhYmxlU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBTdHJlYW0uZnJvbVJlYWRhYmxlU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCB0aGlzLmNvbnRyb2xsZXIpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGV2ZW50IG9mIHN0cmVhbSkge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQpLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdHJlYW0uY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRSdW4oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgfVxuICAgIHRvUmVhZGFibGVTdHJlYW0oKSB7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IG5ldyBTdHJlYW0odGhpc1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0uYmluZCh0aGlzKSwgdGhpcy5jb250cm9sbGVyKTtcbiAgICAgICAgcmV0dXJuIHN0cmVhbS50b1JlYWRhYmxlU3RyZWFtKCk7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGVUb29sQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5JZCwgcnVucywgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBBc3Npc3RhbnRTdHJlYW0oKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5Ub29sQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5JZCwgcnVucywgcGFyYW1zLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdzdHJlYW0nIH0sXG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgYXN5bmMgX2NyZWF0ZVRvb2xBc3Npc3RhbnRTdHJlYW0ocnVuLCB0aHJlYWRJZCwgcnVuSWQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBib2R5ID0geyAuLi5wYXJhbXMsIHN0cmVhbTogdHJ1ZSB9O1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBydW4uc3VibWl0VG9vbE91dHB1dHModGhyZWFkSWQsIHJ1bklkLCBib2R5LCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgc2lnbmFsOiB0aGlzLmNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2Ygc3RyZWFtKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmVhbS5jb250cm9sbGVyLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZFJ1bihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICB9XG4gICAgc3RhdGljIGNyZWF0ZVRocmVhZEFzc2lzdGFudFN0cmVhbShwYXJhbXMsIHRocmVhZCwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQXNzaXN0YW50U3RyZWFtKCk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fdGhyZWFkQXNzaXN0YW50U3RyZWFtKHBhcmFtcywgdGhyZWFkLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdzdHJlYW0nIH0sXG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgc3RhdGljIGNyZWF0ZUFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVucywgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBBc3Npc3RhbnRTdHJlYW0oKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5Bc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bnMsIHBhcmFtcywge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAnc3RyZWFtJyB9LFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIGN1cnJlbnRFdmVudCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50RXZlbnQsIFwiZlwiKTtcbiAgICB9XG4gICAgY3VycmVudFJ1bigpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU25hcHNob3QsIFwiZlwiKTtcbiAgICB9XG4gICAgY3VycmVudE1lc3NhZ2VTbmFwc2hvdCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKTtcbiAgICB9XG4gICAgY3VycmVudFJ1blN0ZXBTbmFwc2hvdCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU3RlcFNuYXBzaG90LCBcImZcIik7XG4gICAgfVxuICAgIGFzeW5jIGZpbmFsUnVuU3RlcHMoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpKTtcbiAgICB9XG4gICAgYXN5bmMgZmluYWxNZXNzYWdlcygpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3RzLCBcImZcIikpO1xuICAgIH1cbiAgICBhc3luYyBmaW5hbFJ1bigpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIGlmICghX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLCBcImZcIikpXG4gICAgICAgICAgICB0aHJvdyBFcnJvcignRmluYWwgcnVuIHdhcyBub3QgcmVjZWl2ZWQuJyk7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4sIFwiZlwiKTtcbiAgICB9XG4gICAgYXN5bmMgX2NyZWF0ZVRocmVhZEFzc2lzdGFudFN0cmVhbSh0aHJlYWQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBib2R5ID0geyAuLi5wYXJhbXMsIHN0cmVhbTogdHJ1ZSB9O1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCB0aHJlYWQuY3JlYXRlQW5kUnVuKGJvZHksIHsgLi4ub3B0aW9ucywgc2lnbmFsOiB0aGlzLmNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBldmVudCBvZiBzdHJlYW0pIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50KS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyZWFtLmNvbnRyb2xsZXIuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkUnVuKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgIH1cbiAgICBhc3luYyBfY3JlYXRlQXNzaXN0YW50U3RyZWFtKHJ1biwgdGhyZWFkSWQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBib2R5ID0geyAuLi5wYXJhbXMsIHN0cmVhbTogdHJ1ZSB9O1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBydW4uY3JlYXRlKHRocmVhZElkLCBib2R5LCB7IC4uLm9wdGlvbnMsIHNpZ25hbDogdGhpcy5jb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2Ygc3RyZWFtKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmVhbS5jb250cm9sbGVyLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZFJ1bihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICB9XG4gICAgc3RhdGljIGFjY3VtdWxhdGVEZWx0YShhY2MsIGRlbHRhKSB7XG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgZGVsdGFWYWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZGVsdGEpKSB7XG4gICAgICAgICAgICBpZiAoIWFjYy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgYWNjW2tleV0gPSBkZWx0YVZhbHVlO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGFjY1ZhbHVlID0gYWNjW2tleV07XG4gICAgICAgICAgICBpZiAoYWNjVmFsdWUgPT09IG51bGwgfHwgYWNjVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGFjY1trZXldID0gZGVsdGFWYWx1ZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFdlIGRvbid0IGFjY3VtdWxhdGUgdGhlc2Ugc3BlY2lhbCBwcm9wZXJ0aWVzXG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnaW5kZXgnIHx8IGtleSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgICAgICAgYWNjW2tleV0gPSBkZWx0YVZhbHVlO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVHlwZS1zcGVjaWZpYyBhY2N1bXVsYXRpb24gbG9naWNcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYWNjVmFsdWUgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBkZWx0YVZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGFjY1ZhbHVlICs9IGRlbHRhVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgYWNjVmFsdWUgPT09ICdudW1iZXInICYmIHR5cGVvZiBkZWx0YVZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIGFjY1ZhbHVlICs9IGRlbHRhVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChDb3JlLmlzT2JqKGFjY1ZhbHVlKSAmJiBDb3JlLmlzT2JqKGRlbHRhVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgYWNjVmFsdWUgPSB0aGlzLmFjY3VtdWxhdGVEZWx0YShhY2NWYWx1ZSwgZGVsdGFWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFjY1ZhbHVlKSAmJiBBcnJheS5pc0FycmF5KGRlbHRhVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFjY1ZhbHVlLmV2ZXJ5KCh4KSA9PiB0eXBlb2YgeCA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHggPT09ICdudW1iZXInKSkge1xuICAgICAgICAgICAgICAgICAgICBhY2NWYWx1ZS5wdXNoKC4uLmRlbHRhVmFsdWUpOyAvLyBVc2Ugc3ByZWFkIHN5bnRheCBmb3IgZWZmaWNpZW50IGFkZGl0aW9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRlbHRhRW50cnkgb2YgZGVsdGFWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIUNvcmUuaXNPYmooZGVsdGFFbnRyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYXJyYXkgZGVsdGEgZW50cnkgdG8gYmUgYW4gb2JqZWN0IGJ1dCBnb3Q6ICR7ZGVsdGFFbnRyeX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IGRlbHRhRW50cnlbJ2luZGV4J107XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGRlbHRhRW50cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBhcnJheSBkZWx0YSBlbnRyeSB0byBoYXZlIGFuIGBpbmRleGAgcHJvcGVydHknKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhcnJheSBkZWx0YSBlbnRyeSBcXGBpbmRleFxcYCBwcm9wZXJ0eSB0byBiZSBhIG51bWJlciBidXQgZ290ICR7aW5kZXh9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWNjRW50cnkgPSBhY2NWYWx1ZVtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY2NFbnRyeSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NWYWx1ZS5wdXNoKGRlbHRhRW50cnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjVmFsdWVbaW5kZXhdID0gdGhpcy5hY2N1bXVsYXRlRGVsdGEoYWNjRW50cnksIGRlbHRhRW50cnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFVuaGFuZGxlZCByZWNvcmQgdHlwZTogJHtrZXl9LCBkZWx0YVZhbHVlOiAke2RlbHRhVmFsdWV9LCBhY2NWYWx1ZTogJHthY2NWYWx1ZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjY1trZXldID0gYWNjVmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICB9XG4gICAgX2FkZFJ1bihydW4pIHtcbiAgICAgICAgcmV0dXJuIHJ1bjtcbiAgICB9XG4gICAgYXN5bmMgX3RocmVhZEFzc2lzdGFudFN0cmVhbShwYXJhbXMsIHRocmVhZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5fY3JlYXRlVGhyZWFkQXNzaXN0YW50U3RyZWFtKHRocmVhZCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgICB9XG4gICAgYXN5bmMgX3J1bkFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVucywgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLl9jcmVhdGVBc3Npc3RhbnRTdHJlYW0ocnVucywgdGhyZWFkSWQsIHBhcmFtcywgb3B0aW9ucyk7XG4gICAgfVxuICAgIGFzeW5jIF9ydW5Ub29sQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5JZCwgcnVucywgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLl9jcmVhdGVUb29sQXNzaXN0YW50U3RyZWFtKHJ1bnMsIHRocmVhZElkLCBydW5JZCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgICB9XG59XG5fQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50ID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudChldmVudCkge1xuICAgIGlmICh0aGlzLmVuZGVkKVxuICAgICAgICByZXR1cm47XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRFdmVudCwgZXZlbnQsIFwiZlwiKTtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVFdmVudCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgICBjYXNlICd0aHJlYWQuY3JlYXRlZCc6XG4gICAgICAgICAgICAvL05vIGFjdGlvbiBvbiB0aGlzIGV2ZW50LlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY3JlYXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4ucXVldWVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5pbl9wcm9ncmVzcyc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4ucmVxdWlyZXNfYWN0aW9uJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmluY29tcGxldGUnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmZhaWxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY2FuY2VsbGluZyc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY2FuY2VsbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5leHBpcmVkJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1bikuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNyZWF0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuaW5fcHJvZ3Jlc3MnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZGVsdGEnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmZhaWxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jYW5jZWxsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZXhwaXJlZCc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW5TdGVwKS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5jcmVhdGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuaW5fcHJvZ3Jlc3MnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5kZWx0YSc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmluY29tcGxldGUnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlTWVzc2FnZSkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgLy9UaGlzIGlzIGluY2x1ZGVkIGZvciBjb21wbGV0ZW5lc3MsIGJ1dCBlcnJvcnMgYXJlIHByb2Nlc3NlZCBpbiB0aGUgU1NFIGV2ZW50IHByb2Nlc3Npbmcgc28gdGhpcyBzaG91bGQgbm90IG9jY3VyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0VuY291bnRlcmVkIGFuIGVycm9yIGV2ZW50IGluIGV2ZW50IHByb2Nlc3NpbmcgLSBlcnJvcnMgc2hvdWxkIGJlIHByb2Nlc3NlZCBlYXJsaWVyJyk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBhc3NlcnROZXZlcihldmVudCk7XG4gICAgfVxufSwgX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0ID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0KCkge1xuICAgIGlmICh0aGlzLmVuZGVkKSB7XG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgc3RyZWFtIGhhcyBlbmRlZCwgdGhpcyBzaG91bGRuJ3QgaGFwcGVuYCk7XG4gICAgfVxuICAgIGlmICghX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLCBcImZcIikpXG4gICAgICAgIHRocm93IEVycm9yKCdGaW5hbCBydW4gaGFzIG5vdCBiZWVuIHJlY2VpdmVkJyk7XG4gICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biwgXCJmXCIpO1xufSwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVNZXNzYWdlID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVNZXNzYWdlKGV2ZW50KSB7XG4gICAgY29uc3QgW2FjY3VtdWxhdGVkTWVzc2FnZSwgbmV3Q29udGVudF0gPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlTWVzc2FnZSkuY2FsbCh0aGlzLCBldmVudCwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpKTtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBhY2N1bXVsYXRlZE1lc3NhZ2UsIFwiZlwiKTtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90cywgXCJmXCIpW2FjY3VtdWxhdGVkTWVzc2FnZS5pZF0gPSBhY2N1bXVsYXRlZE1lc3NhZ2U7XG4gICAgZm9yIChjb25zdCBjb250ZW50IG9mIG5ld0NvbnRlbnQpIHtcbiAgICAgICAgY29uc3Qgc25hcHNob3RDb250ZW50ID0gYWNjdW11bGF0ZWRNZXNzYWdlLmNvbnRlbnRbY29udGVudC5pbmRleF07XG4gICAgICAgIGlmIChzbmFwc2hvdENvbnRlbnQ/LnR5cGUgPT0gJ3RleHQnKSB7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCd0ZXh0Q3JlYXRlZCcsIHNuYXBzaG90Q29udGVudC50ZXh0KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmNyZWF0ZWQnOlxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnbWVzc2FnZUNyZWF0ZWQnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5pbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuZGVsdGEnOlxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnbWVzc2FnZURlbHRhJywgZXZlbnQuZGF0YS5kZWx0YSwgYWNjdW11bGF0ZWRNZXNzYWdlKTtcbiAgICAgICAgICAgIGlmIChldmVudC5kYXRhLmRlbHRhLmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbnRlbnQgb2YgZXZlbnQuZGF0YS5kZWx0YS5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vSWYgaXQgaXMgdGV4dCBkZWx0YSwgZW1pdCBhIHRleHQgZGVsdGEgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlbnQudHlwZSA9PSAndGV4dCcgJiYgY29udGVudC50ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGV4dERlbHRhID0gY29udGVudC50ZXh0O1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNuYXBzaG90ID0gYWNjdW11bGF0ZWRNZXNzYWdlLmNvbnRlbnRbY29udGVudC5pbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc25hcHNob3QgJiYgc25hcHNob3QudHlwZSA9PSAndGV4dCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0ZXh0RGVsdGEnLCB0ZXh0RGVsdGEsIHNuYXBzaG90LnRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1RoZSBzbmFwc2hvdCBhc3NvY2lhdGVkIHdpdGggdGhpcyB0ZXh0IGRlbHRhIGlzIG5vdCB0ZXh0IG9yIG1pc3NpbmcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoY29udGVudC5pbmRleCAhPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL1NlZSBpZiB3ZSBoYXZlIGluIHByb2dyZXNzIGNvbnRlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LCBcImZcIikudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICd0ZXh0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3RleHREb25lJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LCBcImZcIikudGV4dCwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdpbWFnZV9maWxlJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ltYWdlRmlsZURvbmUnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQsIFwiZlwiKS5pbWFnZV9maWxlLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXgsIGNvbnRlbnQuaW5kZXgsIFwiZlwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQsIGFjY3VtdWxhdGVkTWVzc2FnZS5jb250ZW50W2NvbnRlbnQuaW5kZXhdLCBcImZcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmluY29tcGxldGUnOlxuICAgICAgICAgICAgLy9XZSBlbWl0IHRoZSBsYXRlc3QgY29udGVudCB3ZSB3ZXJlIHdvcmtpbmcgb24gb24gY29tcGxldGlvbiAoaW5jbHVkaW5nIGluY29tcGxldGUpXG4gICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXgsIFwiZlwiKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudENvbnRlbnQgPSBldmVudC5kYXRhLmNvbnRlbnRbX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXgsIFwiZlwiKV07XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoY3VycmVudENvbnRlbnQudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW1hZ2VfZmlsZSc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnaW1hZ2VGaWxlRG9uZScsIGN1cnJlbnRDb250ZW50LmltYWdlX2ZpbGUsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICd0ZXh0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0ZXh0RG9uZScsIGN1cnJlbnRDb250ZW50LnRleHQsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnbWVzc2FnZURvbmUnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIHVuZGVmaW5lZCwgXCJmXCIpO1xuICAgIH1cbn0sIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuU3RlcCA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuU3RlcChldmVudCkge1xuICAgIGNvbnN0IGFjY3VtdWxhdGVkUnVuU3RlcCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVSdW5TdGVwKS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blN0ZXBTbmFwc2hvdCwgYWNjdW11bGF0ZWRSdW5TdGVwLCBcImZcIik7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY3JlYXRlZCc6XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdydW5TdGVwQ3JlYXRlZCcsIGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5kZWx0YSc6XG4gICAgICAgICAgICBjb25zdCBkZWx0YSA9IGV2ZW50LmRhdGEuZGVsdGE7XG4gICAgICAgICAgICBpZiAoZGVsdGEuc3RlcF9kZXRhaWxzICYmXG4gICAgICAgICAgICAgICAgZGVsdGEuc3RlcF9kZXRhaWxzLnR5cGUgPT0gJ3Rvb2xfY2FsbHMnICYmXG4gICAgICAgICAgICAgICAgZGVsdGEuc3RlcF9kZXRhaWxzLnRvb2xfY2FsbHMgJiZcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZFJ1blN0ZXAuc3RlcF9kZXRhaWxzLnR5cGUgPT0gJ3Rvb2xfY2FsbHMnKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0b29sQ2FsbCBvZiBkZWx0YS5zdGVwX2RldGFpbHMudG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9vbENhbGwuaW5kZXggPT0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbEluZGV4LCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xDYWxsRGVsdGEnLCB0b29sQ2FsbCwgYWNjdW11bGF0ZWRSdW5TdGVwLnN0ZXBfZGV0YWlscy50b29sX2NhbGxzW3Rvb2xDYWxsLmluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbENhbGxEb25lJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGxJbmRleCwgdG9vbENhbGwuaW5kZXgsIFwiZlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIGFjY3VtdWxhdGVkUnVuU3RlcC5zdGVwX2RldGFpbHMudG9vbF9jYWxsc1t0b29sQ2FsbC5pbmRleF0sIFwiZlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbENhbGxDcmVhdGVkJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3J1blN0ZXBEZWx0YScsIGV2ZW50LmRhdGEuZGVsdGEsIGFjY3VtdWxhdGVkUnVuU3RlcCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5mYWlsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY2FuY2VsbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmV4cGlyZWQnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TdGVwU25hcHNob3QsIHVuZGVmaW5lZCwgXCJmXCIpO1xuICAgICAgICAgICAgY29uc3QgZGV0YWlscyA9IGV2ZW50LmRhdGEuc3RlcF9kZXRhaWxzO1xuICAgICAgICAgICAgaWYgKGRldGFpbHMudHlwZSA9PSAndG9vbF9jYWxscycpIHtcbiAgICAgICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xDYWxsRG9uZScsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIHVuZGVmaW5lZCwgXCJmXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3J1blN0ZXBEb25lJywgZXZlbnQuZGF0YSwgYWNjdW11bGF0ZWRSdW5TdGVwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufSwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVFdmVudCA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlRXZlbnQoZXZlbnQpIHtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fZXZlbnRzLCBcImZcIikucHVzaChldmVudCk7XG4gICAgdGhpcy5fZW1pdCgnZXZlbnQnLCBldmVudCk7XG59LCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVSdW5TdGVwID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlUnVuU3RlcChldmVudCkge1xuICAgIHN3aXRjaCAoZXZlbnQuZXZlbnQpIHtcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNyZWF0ZWQnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXSA9IGV2ZW50LmRhdGE7XG4gICAgICAgICAgICByZXR1cm4gZXZlbnQuZGF0YTtcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmRlbHRhJzpcbiAgICAgICAgICAgIGxldCBzbmFwc2hvdCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF07XG4gICAgICAgICAgICBpZiAoIXNuYXBzaG90KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1JlY2VpdmVkIGEgUnVuU3RlcERlbHRhIGJlZm9yZSBjcmVhdGlvbiBvZiBhIHNuYXBzaG90Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGV2ZW50LmRhdGE7XG4gICAgICAgICAgICBpZiAoZGF0YS5kZWx0YSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFjY3VtdWxhdGVkID0gQXNzaXN0YW50U3RyZWFtLmFjY3VtdWxhdGVEZWx0YShzbmFwc2hvdCwgZGF0YS5kZWx0YSk7XG4gICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXSA9IGFjY3VtdWxhdGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF07XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZmFpbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNhbmNlbGxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5leHBpcmVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmluX3Byb2dyZXNzJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF0gPSBldmVudC5kYXRhO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdKVxuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHNuYXBzaG90IGF2YWlsYWJsZScpO1xufSwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlTWVzc2FnZSA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZU1lc3NhZ2UoZXZlbnQsIHNuYXBzaG90KSB7XG4gICAgbGV0IG5ld0NvbnRlbnQgPSBbXTtcbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmNyZWF0ZWQnOlxuICAgICAgICAgICAgLy9PbiBjcmVhdGlvbiB0aGUgc25hcHNob3QgaXMganVzdCB0aGUgaW5pdGlhbCBtZXNzYWdlXG4gICAgICAgICAgICByZXR1cm4gW2V2ZW50LmRhdGEsIG5ld0NvbnRlbnRdO1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5kZWx0YSc6XG4gICAgICAgICAgICBpZiAoIXNuYXBzaG90KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1JlY2VpdmVkIGEgZGVsdGEgd2l0aCBubyBleGlzdGluZyBzbmFwc2hvdCAodGhlcmUgc2hvdWxkIGJlIG9uZSBmcm9tIG1lc3NhZ2UgY3JlYXRpb24pJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGV2ZW50LmRhdGE7XG4gICAgICAgICAgICAvL0lmIHRoaXMgZGVsdGEgZG9lcyBub3QgaGF2ZSBjb250ZW50LCBub3RoaW5nIHRvIHByb2Nlc3NcbiAgICAgICAgICAgIGlmIChkYXRhLmRlbHRhLmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbnRlbnRFbGVtZW50IG9mIGRhdGEuZGVsdGEuY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29udGVudEVsZW1lbnQuaW5kZXggaW4gc25hcHNob3QuY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRDb250ZW50ID0gc25hcHNob3QuY29udGVudFtjb250ZW50RWxlbWVudC5pbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdC5jb250ZW50W2NvbnRlbnRFbGVtZW50LmluZGV4XSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVDb250ZW50KS5jYWxsKHRoaXMsIGNvbnRlbnRFbGVtZW50LCBjdXJyZW50Q29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdC5jb250ZW50W2NvbnRlbnRFbGVtZW50LmluZGV4XSA9IGNvbnRlbnRFbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBhIG5ldyBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDb250ZW50LnB1c2goY29udGVudEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFtzbmFwc2hvdCwgbmV3Q29udGVudF07XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmluX3Byb2dyZXNzJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuaW5jb21wbGV0ZSc6XG4gICAgICAgICAgICAvL05vIGNoYW5nZXMgb24gb3RoZXIgdGhyZWFkIGV2ZW50c1xuICAgICAgICAgICAgaWYgKHNuYXBzaG90KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtzbmFwc2hvdCwgbmV3Q29udGVudF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcignUmVjZWl2ZWQgdGhyZWFkIG1lc3NhZ2UgZXZlbnQgd2l0aCBubyBleGlzdGluZyBzbmFwc2hvdCcpO1xuICAgICAgICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBFcnJvcignVHJpZWQgdG8gYWNjdW11bGF0ZSBhIG5vbi1tZXNzYWdlIGV2ZW50Jyk7XG59LCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVDb250ZW50ID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlQ29udGVudChjb250ZW50RWxlbWVudCwgY3VycmVudENvbnRlbnQpIHtcbiAgICByZXR1cm4gQXNzaXN0YW50U3RyZWFtLmFjY3VtdWxhdGVEZWx0YShjdXJyZW50Q29udGVudCwgY29udGVudEVsZW1lbnQpO1xufSwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW4gPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1bihldmVudCkge1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU25hcHNob3QsIGV2ZW50LmRhdGEsIFwiZlwiKTtcbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY3JlYXRlZCc6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5xdWV1ZWQnOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4ucmVxdWlyZXNfYWN0aW9uJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jYW5jZWxsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmZhaWxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5leHBpcmVkJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biwgZXZlbnQuZGF0YSwgXCJmXCIpO1xuICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xDYWxsRG9uZScsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgdW5kZWZpbmVkLCBcImZcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jYW5jZWxsaW5nJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn07XG5mdW5jdGlvbiBhc3NlcnROZXZlcihfeCkgeyB9XG4vLyMgc291cmNlTWFwcGluZ1VSTD1Bc3Npc3RhbnRTdHJlYW0ubWpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIsIH0gZnJvbSBcIi4vQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lci5tanNcIjtcbmltcG9ydCB7IGlzQXNzaXN0YW50TWVzc2FnZSB9IGZyb20gXCIuL2NoYXRDb21wbGV0aW9uVXRpbHMubWpzXCI7XG5leHBvcnQgY2xhc3MgQ2hhdENvbXBsZXRpb25SdW5uZXIgZXh0ZW5kcyBBYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyIHtcbiAgICAvKiogQGRlcHJlY2F0ZWQgLSBwbGVhc2UgdXNlIGBydW5Ub29sc2AgaW5zdGVhZC4gKi9cbiAgICBzdGF0aWMgcnVuRnVuY3Rpb25zKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblJ1bm5lcigpO1xuICAgICAgICBjb25zdCBvcHRzID0ge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAncnVuRnVuY3Rpb25zJyB9LFxuICAgICAgICB9O1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1bkZ1bmN0aW9ucyhjbGllbnQsIHBhcmFtcywgb3B0cykpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBzdGF0aWMgcnVuVG9vbHMoY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uUnVubmVyKCk7XG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdydW5Ub29scycgfSxcbiAgICAgICAgfTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5Ub29scyhjbGllbnQsIHBhcmFtcywgb3B0cykpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBfYWRkTWVzc2FnZShtZXNzYWdlLCBlbWl0ID0gdHJ1ZSkge1xuICAgICAgICBzdXBlci5fYWRkTWVzc2FnZShtZXNzYWdlLCBlbWl0KTtcbiAgICAgICAgaWYgKGlzQXNzaXN0YW50TWVzc2FnZShtZXNzYWdlKSAmJiBtZXNzYWdlLmNvbnRlbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2NvbnRlbnQnLCBtZXNzYWdlLmNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Q2hhdENvbXBsZXRpb25SdW5uZXIubWpzLm1hcCIsInZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcbn07XG52YXIgX19jbGFzc1ByaXZhdGVGaWVsZEdldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZEdldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xufTtcbnZhciBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2JlZ2luUmVxdWVzdCwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldENob2ljZUV2ZW50U3RhdGUsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hZGRDaHVuaywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRUb29sQ2FsbERvbmVFdmVudCwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRDb250ZW50RG9uZUV2ZW50cywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VuZFJlcXVlc3QsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRBdXRvUGFyc2VhYmxlUmVzcG9uc2VGb3JtYXQsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hY2N1bXVsYXRlQ2hhdENvbXBsZXRpb247XG5pbXBvcnQgeyBPcGVuQUlFcnJvciwgQVBJVXNlckFib3J0RXJyb3IsIExlbmd0aEZpbmlzaFJlYXNvbkVycm9yLCBDb250ZW50RmlsdGVyRmluaXNoUmVhc29uRXJyb3IsIH0gZnJvbSBcIi4uL2Vycm9yLm1qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lciwgfSBmcm9tIFwiLi9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyLm1qc1wiO1xuaW1wb3J0IHsgU3RyZWFtIH0gZnJvbSBcIi4uL3N0cmVhbWluZy5tanNcIjtcbmltcG9ydCB7IGhhc0F1dG9QYXJzZWFibGVJbnB1dCwgaXNBdXRvUGFyc2FibGVSZXNwb25zZUZvcm1hdCwgaXNBdXRvUGFyc2FibGVUb29sLCBtYXliZVBhcnNlQ2hhdENvbXBsZXRpb24sIHNob3VsZFBhcnNlVG9vbENhbGwsIH0gZnJvbSBcIi4uL2xpYi9wYXJzZXIubWpzXCI7XG5pbXBvcnQgeyBwYXJ0aWFsUGFyc2UgfSBmcm9tIFwiLi4vX3ZlbmRvci9wYXJ0aWFsLWpzb24tcGFyc2VyL3BhcnNlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDaGF0Q29tcGxldGlvblN0cmVhbSBleHRlbmRzIEFic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIge1xuICAgIGNvbnN0cnVjdG9yKHBhcmFtcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLmFkZCh0aGlzKTtcbiAgICAgICAgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcy5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzLnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3Quc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgcGFyYW1zLCBcImZcIik7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzLCBbXSwgXCJmXCIpO1xuICAgIH1cbiAgICBnZXQgY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwgXCJmXCIpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBJbnRlbmRlZCBmb3IgdXNlIG9uIHRoZSBmcm9udGVuZCwgY29uc3VtaW5nIGEgc3RyZWFtIHByb2R1Y2VkIHdpdGhcbiAgICAgKiBgLnRvUmVhZGFibGVTdHJlYW0oKWAgb24gdGhlIGJhY2tlbmQuXG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgbWVzc2FnZXMgc2VudCB0byB0aGUgbW9kZWwgZG8gbm90IGFwcGVhciBpbiBgLm9uKCdtZXNzYWdlJylgXG4gICAgICogaW4gdGhpcyBjb250ZXh0LlxuICAgICAqL1xuICAgIHN0YXRpYyBmcm9tUmVhZGFibGVTdHJlYW0oc3RyZWFtKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblN0cmVhbShudWxsKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9mcm9tUmVhZGFibGVTdHJlYW0oc3RyZWFtKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGVDaGF0Q29tcGxldGlvbihjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25TdHJlYW0ocGFyYW1zKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5DaGF0Q29tcGxldGlvbihjbGllbnQsIHsgLi4ucGFyYW1zLCBzdHJlYW06IHRydWUgfSwgeyAuLi5vcHRpb25zLCBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3N0cmVhbScgfSB9KSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIGFzeW5jIF9jcmVhdGVDaGF0Q29tcGxldGlvbihjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBzdXBlci5fY3JlYXRlQ2hhdENvbXBsZXRpb247XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9iZWdpblJlcXVlc3QpLmNhbGwodGhpcyk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IGNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7IC4uLnBhcmFtcywgc3RyZWFtOiB0cnVlIH0sIHsgLi4ub3B0aW9ucywgc2lnbmFsOiB0aGlzLmNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBzdHJlYW0pIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hZGRDaHVuaykuY2FsbCh0aGlzLCBjaHVuayk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmVhbS5jb250cm9sbGVyLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoYXRDb21wbGV0aW9uKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICB9XG4gICAgYXN5bmMgX2Zyb21SZWFkYWJsZVN0cmVhbShyZWFkYWJsZVN0cmVhbSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYmVnaW5SZXF1ZXN0KS5jYWxsKHRoaXMpO1xuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gU3RyZWFtLmZyb21SZWFkYWJsZVN0cmVhbShyZWFkYWJsZVN0cmVhbSwgdGhpcy5jb250cm9sbGVyKTtcbiAgICAgICAgbGV0IGNoYXRJZDtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBzdHJlYW0pIHtcbiAgICAgICAgICAgIGlmIChjaGF0SWQgJiYgY2hhdElkICE9PSBjaHVuay5pZCkge1xuICAgICAgICAgICAgICAgIC8vIEEgbmV3IHJlcXVlc3QgaGFzIGJlZW4gbWFkZS5cbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRDaGF0Q29tcGxldGlvbihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWRkQ2h1bmspLmNhbGwodGhpcywgY2h1bmspO1xuICAgICAgICAgICAgY2hhdElkID0gY2h1bmsuaWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmVhbS5jb250cm9sbGVyLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoYXRDb21wbGV0aW9uKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICB9XG4gICAgWyhfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zID0gbmV3IFdlYWtNYXAoKSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzID0gbmV3IFdlYWtNYXAoKSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90ID0gbmV3IFdlYWtNYXAoKSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcyA9IG5ldyBXZWFrU2V0KCksIF9DaGF0Q29tcGxldGlvblN0cmVhbV9iZWdpblJlcXVlc3QgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYmVnaW5SZXF1ZXN0KCkge1xuICAgICAgICBpZiAodGhpcy5lbmRlZClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIHVuZGVmaW5lZCwgXCJmXCIpO1xuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRDaG9pY2VFdmVudFN0YXRlID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldENob2ljZUV2ZW50U3RhdGUoY2hvaWNlKSB7XG4gICAgICAgIGxldCBzdGF0ZSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzLCBcImZcIilbY2hvaWNlLmluZGV4XTtcbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUgPSB7XG4gICAgICAgICAgICBjb250ZW50X2RvbmU6IGZhbHNlLFxuICAgICAgICAgICAgcmVmdXNhbF9kb25lOiBmYWxzZSxcbiAgICAgICAgICAgIGxvZ3Byb2JzX2NvbnRlbnRfZG9uZTogZmFsc2UsXG4gICAgICAgICAgICBsb2dwcm9ic19yZWZ1c2FsX2RvbmU6IGZhbHNlLFxuICAgICAgICAgICAgZG9uZV90b29sX2NhbGxzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBjdXJyZW50X3Rvb2xfY2FsbF9pbmRleDogbnVsbCxcbiAgICAgICAgfTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMsIFwiZlwiKVtjaG9pY2UuaW5kZXhdID0gc3RhdGU7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWRkQ2h1bmsgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWRkQ2h1bmsoY2h1bmspIHtcbiAgICAgICAgaWYgKHRoaXMuZW5kZWQpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb24gPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWNjdW11bGF0ZUNoYXRDb21wbGV0aW9uKS5jYWxsKHRoaXMsIGNodW5rKTtcbiAgICAgICAgdGhpcy5fZW1pdCgnY2h1bmsnLCBjaHVuaywgY29tcGxldGlvbik7XG4gICAgICAgIGZvciAoY29uc3QgY2hvaWNlIG9mIGNodW5rLmNob2ljZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNob2ljZVNuYXBzaG90ID0gY29tcGxldGlvbi5jaG9pY2VzW2Nob2ljZS5pbmRleF07XG4gICAgICAgICAgICBpZiAoY2hvaWNlLmRlbHRhLmNvbnRlbnQgIT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2U/LnJvbGUgPT09ICdhc3Npc3RhbnQnICYmXG4gICAgICAgICAgICAgICAgY2hvaWNlU25hcHNob3QubWVzc2FnZT8uY29udGVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2NvbnRlbnQnLCBjaG9pY2UuZGVsdGEuY29udGVudCwgY2hvaWNlU25hcHNob3QubWVzc2FnZS5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdjb250ZW50LmRlbHRhJywge1xuICAgICAgICAgICAgICAgICAgICBkZWx0YTogY2hvaWNlLmRlbHRhLmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIHNuYXBzaG90OiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlZDogY2hvaWNlU25hcHNob3QubWVzc2FnZS5wYXJzZWQsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2hvaWNlLmRlbHRhLnJlZnVzYWwgIT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2U/LnJvbGUgPT09ICdhc3Npc3RhbnQnICYmXG4gICAgICAgICAgICAgICAgY2hvaWNlU25hcHNob3QubWVzc2FnZT8ucmVmdXNhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3JlZnVzYWwuZGVsdGEnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRlbHRhOiBjaG9pY2UuZGVsdGEucmVmdXNhbCxcbiAgICAgICAgICAgICAgICAgICAgc25hcHNob3Q6IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UucmVmdXNhbCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjaG9pY2UubG9ncHJvYnM/LmNvbnRlbnQgIT0gbnVsbCAmJiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlPy5yb2xlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2xvZ3Byb2JzLmNvbnRlbnQuZGVsdGEnLCB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNob2ljZS5sb2dwcm9icz8uY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgc25hcHNob3Q6IGNob2ljZVNuYXBzaG90LmxvZ3Byb2JzPy5jb250ZW50ID8/IFtdLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNob2ljZS5sb2dwcm9icz8ucmVmdXNhbCAhPSBudWxsICYmIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2U/LnJvbGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnbG9ncHJvYnMucmVmdXNhbC5kZWx0YScsIHtcbiAgICAgICAgICAgICAgICAgICAgcmVmdXNhbDogY2hvaWNlLmxvZ3Byb2JzPy5yZWZ1c2FsLFxuICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdDogY2hvaWNlU25hcHNob3QubG9ncHJvYnM/LnJlZnVzYWwgPz8gW10sXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzdGF0ZSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRDaG9pY2VFdmVudFN0YXRlKS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90KTtcbiAgICAgICAgICAgIGlmIChjaG9pY2VTbmFwc2hvdC5maW5pc2hfcmVhc29uKSB7XG4gICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRDb250ZW50RG9uZUV2ZW50cykuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLmN1cnJlbnRfdG9vbF9jYWxsX2luZGV4ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRUb29sQ2FsbERvbmVFdmVudCkuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCwgc3RhdGUuY3VycmVudF90b29sX2NhbGxfaW5kZXgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbENhbGwgb2YgY2hvaWNlLmRlbHRhLnRvb2xfY2FsbHMgPz8gW10pIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGUuY3VycmVudF90b29sX2NhbGxfaW5kZXggIT09IHRvb2xDYWxsLmluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0Q29udGVudERvbmVFdmVudHMpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QpO1xuICAgICAgICAgICAgICAgICAgICAvLyBuZXcgdG9vbCBjYWxsIHN0YXJ0ZWQsIHRoZSBwcmV2aW91cyBvbmUgaXMgZG9uZVxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdGUuY3VycmVudF90b29sX2NhbGxfaW5kZXggIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRUb29sQ2FsbERvbmVFdmVudCkuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCwgc3RhdGUuY3VycmVudF90b29sX2NhbGxfaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN0YXRlLmN1cnJlbnRfdG9vbF9jYWxsX2luZGV4ID0gdG9vbENhbGwuaW5kZXg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2xDYWxsRGVsdGEgb2YgY2hvaWNlLmRlbHRhLnRvb2xfY2FsbHMgPz8gW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29sQ2FsbFNuYXBzaG90ID0gY2hvaWNlU25hcHNob3QubWVzc2FnZS50b29sX2NhbGxzPy5bdG9vbENhbGxEZWx0YS5pbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCF0b29sQ2FsbFNuYXBzaG90Py50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodG9vbENhbGxTbmFwc2hvdD8udHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sX2NhbGxzLmZ1bmN0aW9uLmFyZ3VtZW50cy5kZWx0YScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24/Lm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogdG9vbENhbGxEZWx0YS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50czogdG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5hcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZWRfYXJndW1lbnRzOiB0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLnBhcnNlZF9hcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHNfZGVsdGE6IHRvb2xDYWxsRGVsdGEuZnVuY3Rpb24/LmFyZ3VtZW50cyA/PyAnJyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnROZXZlcih0b29sQ2FsbFNuYXBzaG90Py50eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdFRvb2xDYWxsRG9uZUV2ZW50ID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRUb29sQ2FsbERvbmVFdmVudChjaG9pY2VTbmFwc2hvdCwgdG9vbENhbGxJbmRleCkge1xuICAgICAgICBjb25zdCBzdGF0ZSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRDaG9pY2VFdmVudFN0YXRlKS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90KTtcbiAgICAgICAgaWYgKHN0YXRlLmRvbmVfdG9vbF9jYWxscy5oYXModG9vbENhbGxJbmRleCkpIHtcbiAgICAgICAgICAgIC8vIHdlJ3ZlIGFscmVhZHkgZmlyZWQgdGhlIGRvbmUgZXZlbnRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0b29sQ2FsbFNuYXBzaG90ID0gY2hvaWNlU25hcHNob3QubWVzc2FnZS50b29sX2NhbGxzPy5bdG9vbENhbGxJbmRleF07XG4gICAgICAgIGlmICghdG9vbENhbGxTbmFwc2hvdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyB0b29sIGNhbGwgc25hcHNob3QnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRvb2xDYWxsU25hcHNob3QudHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0b29sIGNhbGwgc25hcHNob3QgbWlzc2luZyBgdHlwZWAnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9vbENhbGxTbmFwc2hvdC50eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dFRvb2wgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIFwiZlwiKT8udG9vbHM/LmZpbmQoKHRvb2wpID0+IHRvb2wudHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0b29sLmZ1bmN0aW9uLm5hbWUgPT09IHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24ubmFtZSk7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sX2NhbGxzLmZ1bmN0aW9uLmFyZ3VtZW50cy5kb25lJywge1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24ubmFtZSxcbiAgICAgICAgICAgICAgICBpbmRleDogdG9vbENhbGxJbmRleCxcbiAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24uYXJndW1lbnRzLFxuICAgICAgICAgICAgICAgIHBhcnNlZF9hcmd1bWVudHM6IGlzQXV0b1BhcnNhYmxlVG9vbChpbnB1dFRvb2wpID8gaW5wdXRUb29sLiRwYXJzZVJhdyh0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLmFyZ3VtZW50cylcbiAgICAgICAgICAgICAgICAgICAgOiBpbnB1dFRvb2w/LmZ1bmN0aW9uLnN0cmljdCA/IEpTT04ucGFyc2UodG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5hcmd1bWVudHMpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFzc2VydE5ldmVyKHRvb2xDYWxsU25hcHNob3QudHlwZSk7XG4gICAgICAgIH1cbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdENvbnRlbnREb25lRXZlbnRzID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRDb250ZW50RG9uZUV2ZW50cyhjaG9pY2VTbmFwc2hvdCkge1xuICAgICAgICBjb25zdCBzdGF0ZSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRDaG9pY2VFdmVudFN0YXRlKS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90KTtcbiAgICAgICAgaWYgKGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UuY29udGVudCAmJiAhc3RhdGUuY29udGVudF9kb25lKSB7XG4gICAgICAgICAgICBzdGF0ZS5jb250ZW50X2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VGb3JtYXQgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0QXV0b1BhcnNlYWJsZVJlc3BvbnNlRm9ybWF0KS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnY29udGVudC5kb25lJywge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UuY29udGVudCxcbiAgICAgICAgICAgICAgICBwYXJzZWQ6IHJlc3BvbnNlRm9ybWF0ID8gcmVzcG9uc2VGb3JtYXQuJHBhcnNlUmF3KGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UuY29udGVudCkgOiBudWxsLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UucmVmdXNhbCAmJiAhc3RhdGUucmVmdXNhbF9kb25lKSB7XG4gICAgICAgICAgICBzdGF0ZS5yZWZ1c2FsX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgncmVmdXNhbC5kb25lJywgeyByZWZ1c2FsOiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLnJlZnVzYWwgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNob2ljZVNuYXBzaG90LmxvZ3Byb2JzPy5jb250ZW50ICYmICFzdGF0ZS5sb2dwcm9ic19jb250ZW50X2RvbmUpIHtcbiAgICAgICAgICAgIHN0YXRlLmxvZ3Byb2JzX2NvbnRlbnRfZG9uZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdsb2dwcm9icy5jb250ZW50LmRvbmUnLCB7IGNvbnRlbnQ6IGNob2ljZVNuYXBzaG90LmxvZ3Byb2JzLmNvbnRlbnQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNob2ljZVNuYXBzaG90LmxvZ3Byb2JzPy5yZWZ1c2FsICYmICFzdGF0ZS5sb2dwcm9ic19yZWZ1c2FsX2RvbmUpIHtcbiAgICAgICAgICAgIHN0YXRlLmxvZ3Byb2JzX3JlZnVzYWxfZG9uZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdsb2dwcm9icy5yZWZ1c2FsLmRvbmUnLCB7IHJlZnVzYWw6IGNob2ljZVNuYXBzaG90LmxvZ3Byb2JzLnJlZnVzYWwgfSk7XG4gICAgICAgIH1cbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW5kUmVxdWVzdCA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbmRSZXF1ZXN0KCkge1xuICAgICAgICBpZiAodGhpcy5lbmRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBzdHJlYW0gaGFzIGVuZGVkLCB0aGlzIHNob3VsZG4ndCBoYXBwZW5gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzbmFwc2hvdCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCBcImZcIik7XG4gICAgICAgIGlmICghc25hcHNob3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgcmVxdWVzdCBlbmRlZCB3aXRob3V0IHNlbmRpbmcgYW55IGNodW5rc2ApO1xuICAgICAgICB9XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCB1bmRlZmluZWQsIFwiZlwiKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMsIFtdLCBcImZcIik7XG4gICAgICAgIHJldHVybiBmaW5hbGl6ZUNoYXRDb21wbGV0aW9uKHNuYXBzaG90LCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIFwiZlwiKSk7XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldEF1dG9QYXJzZWFibGVSZXNwb25zZUZvcm1hdCA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRBdXRvUGFyc2VhYmxlUmVzcG9uc2VGb3JtYXQoKSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlRm9ybWF0ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBcImZcIik/LnJlc3BvbnNlX2Zvcm1hdDtcbiAgICAgICAgaWYgKGlzQXV0b1BhcnNhYmxlUmVzcG9uc2VGb3JtYXQocmVzcG9uc2VGb3JtYXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VGb3JtYXQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FjY3VtdWxhdGVDaGF0Q29tcGxldGlvbiA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hY2N1bXVsYXRlQ2hhdENvbXBsZXRpb24oY2h1bmspIHtcbiAgICAgICAgdmFyIF9hLCBfYiwgX2MsIF9kO1xuICAgICAgICBsZXQgc25hcHNob3QgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwgXCJmXCIpO1xuICAgICAgICBjb25zdCB7IGNob2ljZXMsIC4uLnJlc3QgfSA9IGNodW5rO1xuICAgICAgICBpZiAoIXNuYXBzaG90KSB7XG4gICAgICAgICAgICBzbmFwc2hvdCA9IF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCB7XG4gICAgICAgICAgICAgICAgLi4ucmVzdCxcbiAgICAgICAgICAgICAgICBjaG9pY2VzOiBbXSxcbiAgICAgICAgICAgIH0sIFwiZlwiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oc25hcHNob3QsIHJlc3QpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgeyBkZWx0YSwgZmluaXNoX3JlYXNvbiwgaW5kZXgsIGxvZ3Byb2JzID0gbnVsbCwgLi4ub3RoZXIgfSBvZiBjaHVuay5jaG9pY2VzKSB7XG4gICAgICAgICAgICBsZXQgY2hvaWNlID0gc25hcHNob3QuY2hvaWNlc1tpbmRleF07XG4gICAgICAgICAgICBpZiAoIWNob2ljZSkge1xuICAgICAgICAgICAgICAgIGNob2ljZSA9IHNuYXBzaG90LmNob2ljZXNbaW5kZXhdID0geyBmaW5pc2hfcmVhc29uLCBpbmRleCwgbWVzc2FnZToge30sIGxvZ3Byb2JzLCAuLi5vdGhlciB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxvZ3Byb2JzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjaG9pY2UubG9ncHJvYnMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hvaWNlLmxvZ3Byb2JzID0gT2JqZWN0LmFzc2lnbih7fSwgbG9ncHJvYnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCByZWZ1c2FsLCAuLi5yZXN0IH0gPSBsb2dwcm9icztcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0SXNFbXB0eShyZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjaG9pY2UubG9ncHJvYnMsIHJlc3QpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgKF9hID0gY2hvaWNlLmxvZ3Byb2JzKS5jb250ZW50ID8/IChfYS5jb250ZW50ID0gW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlLmxvZ3Byb2JzLmNvbnRlbnQucHVzaCguLi5jb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVmdXNhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgKF9iID0gY2hvaWNlLmxvZ3Byb2JzKS5yZWZ1c2FsID8/IChfYi5yZWZ1c2FsID0gW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlLmxvZ3Byb2JzLnJlZnVzYWwucHVzaCguLi5yZWZ1c2FsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmaW5pc2hfcmVhc29uKSB7XG4gICAgICAgICAgICAgICAgY2hvaWNlLmZpbmlzaF9yZWFzb24gPSBmaW5pc2hfcmVhc29uO1xuICAgICAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIFwiZlwiKSAmJiBoYXNBdXRvUGFyc2VhYmxlSW5wdXQoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBcImZcIikpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaW5pc2hfcmVhc29uID09PSAnbGVuZ3RoJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IExlbmd0aEZpbmlzaFJlYXNvbkVycm9yKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbmlzaF9yZWFzb24gPT09ICdjb250ZW50X2ZpbHRlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBDb250ZW50RmlsdGVyRmluaXNoUmVhc29uRXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY2hvaWNlLCBvdGhlcik7XG4gICAgICAgICAgICBpZiAoIWRlbHRhKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvLyBTaG91bGRuJ3QgaGFwcGVuOyBqdXN0IGluIGNhc2UuXG4gICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHJlZnVzYWwsIGZ1bmN0aW9uX2NhbGwsIHJvbGUsIHRvb2xfY2FsbHMsIC4uLnJlc3QgfSA9IGRlbHRhO1xuICAgICAgICAgICAgYXNzZXJ0SXNFbXB0eShyZXN0KTtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY2hvaWNlLm1lc3NhZ2UsIHJlc3QpO1xuICAgICAgICAgICAgaWYgKHJlZnVzYWwpIHtcbiAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5yZWZ1c2FsID0gKGNob2ljZS5tZXNzYWdlLnJlZnVzYWwgfHwgJycpICsgcmVmdXNhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyb2xlKVxuICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLnJvbGUgPSByb2xlO1xuICAgICAgICAgICAgaWYgKGZ1bmN0aW9uX2NhbGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNob2ljZS5tZXNzYWdlLmZ1bmN0aW9uX2NhbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UuZnVuY3Rpb25fY2FsbCA9IGZ1bmN0aW9uX2NhbGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnVuY3Rpb25fY2FsbC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UuZnVuY3Rpb25fY2FsbC5uYW1lID0gZnVuY3Rpb25fY2FsbC5uYW1lO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnVuY3Rpb25fY2FsbC5hcmd1bWVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChfYyA9IGNob2ljZS5tZXNzYWdlLmZ1bmN0aW9uX2NhbGwpLmFyZ3VtZW50cyA/PyAoX2MuYXJndW1lbnRzID0gJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UuZnVuY3Rpb25fY2FsbC5hcmd1bWVudHMgKz0gZnVuY3Rpb25fY2FsbC5hcmd1bWVudHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY29udGVudCkge1xuICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLmNvbnRlbnQgPSAoY2hvaWNlLm1lc3NhZ2UuY29udGVudCB8fCAnJykgKyBjb250ZW50O1xuICAgICAgICAgICAgICAgIGlmICghY2hvaWNlLm1lc3NhZ2UucmVmdXNhbCAmJiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0QXV0b1BhcnNlYWJsZVJlc3BvbnNlRm9ybWF0KS5jYWxsKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLnBhcnNlZCA9IHBhcnRpYWxQYXJzZShjaG9pY2UubWVzc2FnZS5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgIGlmICghY2hvaWNlLm1lc3NhZ2UudG9vbF9jYWxscylcbiAgICAgICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UudG9vbF9jYWxscyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgeyBpbmRleCwgaWQsIHR5cGUsIGZ1bmN0aW9uOiBmbiwgLi4ucmVzdCB9IG9mIHRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9vbF9jYWxsID0gKChfZCA9IGNob2ljZS5tZXNzYWdlLnRvb2xfY2FsbHMpW2luZGV4XSA/PyAoX2RbaW5kZXhdID0ge30pKTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbih0b29sX2NhbGwsIHJlc3QpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGwuaWQgPSBpZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUpXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGwudHlwZSA9IHR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmbilcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbC5mdW5jdGlvbiA/PyAodG9vbF9jYWxsLmZ1bmN0aW9uID0geyBuYW1lOiBmbi5uYW1lID8/ICcnLCBhcmd1bWVudHM6ICcnIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm4/Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGwuZnVuY3Rpb24ubmFtZSA9IGZuLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmbj8uYXJndW1lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGwuZnVuY3Rpb24uYXJndW1lbnRzICs9IGZuLmFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaG91bGRQYXJzZVRvb2xDYWxsKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgXCJmXCIpLCB0b29sX2NhbGwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsLmZ1bmN0aW9uLnBhcnNlZF9hcmd1bWVudHMgPSBwYXJ0aWFsUGFyc2UodG9vbF9jYWxsLmZ1bmN0aW9uLmFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNuYXBzaG90O1xuICAgIH0sIFN5bWJvbC5hc3luY0l0ZXJhdG9yKV0oKSB7XG4gICAgICAgIGNvbnN0IHB1c2hRdWV1ZSA9IFtdO1xuICAgICAgICBjb25zdCByZWFkUXVldWUgPSBbXTtcbiAgICAgICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5vbignY2h1bmsnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWRlciA9IHJlYWRRdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKHJlYWRlcikge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZXNvbHZlKGNodW5rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHB1c2hRdWV1ZS5wdXNoKGNodW5rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlc29sdmUodW5kZWZpbmVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlYWRRdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbignYWJvcnQnLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVhZGVyIG9mIHJlYWRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlYWRRdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVhZGVyIG9mIHJlYWRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlYWRRdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5leHQ6IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXB1c2hRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gcmVhZFF1ZXVlLnB1c2goeyByZXNvbHZlLCByZWplY3QgfSkpLnRoZW4oKGNodW5rKSA9PiAoY2h1bmsgPyB7IHZhbHVlOiBjaHVuaywgZG9uZTogZmFsc2UgfSA6IHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGNodW5rID0gcHVzaFF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IGNodW5rLCBkb25lOiBmYWxzZSB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJldHVybjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cbiAgICB0b1JlYWRhYmxlU3RyZWFtKCkge1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBuZXcgU3RyZWFtKHRoaXNbU3ltYm9sLmFzeW5jSXRlcmF0b3JdLmJpbmQodGhpcyksIHRoaXMuY29udHJvbGxlcik7XG4gICAgICAgIHJldHVybiBzdHJlYW0udG9SZWFkYWJsZVN0cmVhbSgpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIGZpbmFsaXplQ2hhdENvbXBsZXRpb24oc25hcHNob3QsIHBhcmFtcykge1xuICAgIGNvbnN0IHsgaWQsIGNob2ljZXMsIGNyZWF0ZWQsIG1vZGVsLCBzeXN0ZW1fZmluZ2VycHJpbnQsIC4uLnJlc3QgfSA9IHNuYXBzaG90O1xuICAgIGNvbnN0IGNvbXBsZXRpb24gPSB7XG4gICAgICAgIC4uLnJlc3QsXG4gICAgICAgIGlkLFxuICAgICAgICBjaG9pY2VzOiBjaG9pY2VzLm1hcCgoeyBtZXNzYWdlLCBmaW5pc2hfcmVhc29uLCBpbmRleCwgbG9ncHJvYnMsIC4uLmNob2ljZVJlc3QgfSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFmaW5pc2hfcmVhc29uKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGZpbmlzaF9yZWFzb24gZm9yIGNob2ljZSAke2luZGV4fWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50ID0gbnVsbCwgZnVuY3Rpb25fY2FsbCwgdG9vbF9jYWxscywgLi4ubWVzc2FnZVJlc3QgfSA9IG1lc3NhZ2U7XG4gICAgICAgICAgICBjb25zdCByb2xlID0gbWVzc2FnZS5yb2xlOyAvLyB0aGlzIGlzIHdoYXQgd2UgZXhwZWN0OyBpbiB0aGVvcnkgaXQgY291bGQgYmUgZGlmZmVyZW50IHdoaWNoIHdvdWxkIG1ha2Ugb3VyIHR5cGVzIGEgc2xpZ2h0IGxpZSBidXQgd291bGQgYmUgZmluZS5cbiAgICAgICAgICAgIGlmICghcm9sZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyByb2xlIGZvciBjaG9pY2UgJHtpbmRleH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmdW5jdGlvbl9jYWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBhcmd1bWVudHM6IGFyZ3MsIG5hbWUgfSA9IGZ1bmN0aW9uX2NhbGw7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgZnVuY3Rpb25fY2FsbC5hcmd1bWVudHMgZm9yIGNob2ljZSAke2luZGV4fWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGZ1bmN0aW9uX2NhbGwubmFtZSBmb3IgY2hvaWNlICR7aW5kZXh9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmNob2ljZVJlc3QsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbl9jYWxsOiB7IGFyZ3VtZW50czogYXJncywgbmFtZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgcm9sZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZnVzYWw6IG1lc3NhZ2UucmVmdXNhbCA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBmaW5pc2hfcmVhc29uLFxuICAgICAgICAgICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgbG9ncHJvYnMsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgLi4uY2hvaWNlUmVzdCxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaF9yZWFzb24sXG4gICAgICAgICAgICAgICAgICAgIGxvZ3Byb2JzLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5tZXNzYWdlUmVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVmdXNhbDogbWVzc2FnZS5yZWZ1c2FsID8/IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGxzOiB0b29sX2NhbGxzLm1hcCgodG9vbF9jYWxsLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBmdW5jdGlvbjogZm4sIHR5cGUsIGlkLCAuLi50b29sUmVzdCB9ID0gdG9vbF9jYWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgYXJndW1lbnRzOiBhcmdzLCBuYW1lLCAuLi5mblJlc3QgfSA9IGZuIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBjaG9pY2VzWyR7aW5kZXh9XS50b29sX2NhbGxzWyR7aX1dLmlkXFxuJHtzdHIoc25hcHNob3QpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBjaG9pY2VzWyR7aW5kZXh9XS50b29sX2NhbGxzWyR7aX1dLnR5cGVcXG4ke3N0cihzbmFwc2hvdCl9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGNob2ljZXNbJHtpbmRleH1dLnRvb2xfY2FsbHNbJHtpfV0uZnVuY3Rpb24ubmFtZVxcbiR7c3RyKHNuYXBzaG90KX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgY2hvaWNlc1ske2luZGV4fV0udG9vbF9jYWxsc1ske2l9XS5mdW5jdGlvbi5hcmd1bWVudHNcXG4ke3N0cihzbmFwc2hvdCl9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLnRvb2xSZXN0LCBpZCwgdHlwZSwgZnVuY3Rpb246IHsgLi4uZm5SZXN0LCBuYW1lLCBhcmd1bWVudHM6IGFyZ3MgfSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4uY2hvaWNlUmVzdCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiB7IC4uLm1lc3NhZ2VSZXN0LCBjb250ZW50LCByb2xlLCByZWZ1c2FsOiBtZXNzYWdlLnJlZnVzYWwgPz8gbnVsbCB9LFxuICAgICAgICAgICAgICAgIGZpbmlzaF9yZWFzb24sXG4gICAgICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICAgICAgbG9ncHJvYnMsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICAgICAgY3JlYXRlZCxcbiAgICAgICAgbW9kZWwsXG4gICAgICAgIG9iamVjdDogJ2NoYXQuY29tcGxldGlvbicsXG4gICAgICAgIC4uLihzeXN0ZW1fZmluZ2VycHJpbnQgPyB7IHN5c3RlbV9maW5nZXJwcmludCB9IDoge30pLFxuICAgIH07XG4gICAgcmV0dXJuIG1heWJlUGFyc2VDaGF0Q29tcGxldGlvbihjb21wbGV0aW9uLCBwYXJhbXMpO1xufVxuZnVuY3Rpb24gc3RyKHgpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeCk7XG59XG4vKipcbiAqIEVuc3VyZXMgdGhlIGdpdmVuIGFyZ3VtZW50IGlzIGFuIGVtcHR5IG9iamVjdCwgdXNlZnVsIGZvclxuICogYXNzZXJ0aW5nIHRoYXQgYWxsIGtub3duIHByb3BlcnRpZXMgb24gYW4gb2JqZWN0IGhhdmUgYmVlblxuICogZGVzdHJ1Y3R1cmVkLlxuICovXG5mdW5jdGlvbiBhc3NlcnRJc0VtcHR5KG9iaikge1xuICAgIHJldHVybjtcbn1cbmZ1bmN0aW9uIGFzc2VydE5ldmVyKF94KSB7IH1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUNoYXRDb21wbGV0aW9uU3RyZWFtLm1qcy5tYXAiLCJpbXBvcnQgeyBDaGF0Q29tcGxldGlvblN0cmVhbSB9IGZyb20gXCIuL0NoYXRDb21wbGV0aW9uU3RyZWFtLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyIGV4dGVuZHMgQ2hhdENvbXBsZXRpb25TdHJlYW0ge1xuICAgIHN0YXRpYyBmcm9tUmVhZGFibGVTdHJlYW0oc3RyZWFtKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lcihudWxsKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9mcm9tUmVhZGFibGVTdHJlYW0oc3RyZWFtKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIC8qKiBAZGVwcmVjYXRlZCAtIHBsZWFzZSB1c2UgYHJ1blRvb2xzYCBpbnN0ZWFkLiAqL1xuICAgIHN0YXRpYyBydW5GdW5jdGlvbnMoY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyKG51bGwpO1xuICAgICAgICBjb25zdCBvcHRzID0ge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAncnVuRnVuY3Rpb25zJyB9LFxuICAgICAgICB9O1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1bkZ1bmN0aW9ucyhjbGllbnQsIHBhcmFtcywgb3B0cykpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBzdGF0aWMgcnVuVG9vbHMoY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyKFxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIFRPRE8gdGhlc2UgdHlwZXMgYXJlIGluY29tcGF0aWJsZVxuICAgICAgICBwYXJhbXMpO1xuICAgICAgICBjb25zdCBvcHRzID0ge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAncnVuVG9vbHMnIH0sXG4gICAgICAgIH07XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuVG9vbHMoY2xpZW50LCBwYXJhbXMsIG9wdHMpKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1DaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lci5tanMubWFwIiwidmFyIF9fY2xhc3NQcml2YXRlRmllbGRTZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRTZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xufTtcbnZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XG59O1xudmFyIF9FdmVudFN0cmVhbV9pbnN0YW5jZXMsIF9FdmVudFN0cmVhbV9jb25uZWN0ZWRQcm9taXNlLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUNvbm5lY3RlZFByb21pc2UsIF9FdmVudFN0cmVhbV9yZWplY3RDb25uZWN0ZWRQcm9taXNlLCBfRXZlbnRTdHJlYW1fZW5kUHJvbWlzZSwgX0V2ZW50U3RyZWFtX3Jlc29sdmVFbmRQcm9taXNlLCBfRXZlbnRTdHJlYW1fcmVqZWN0RW5kUHJvbWlzZSwgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgX0V2ZW50U3RyZWFtX2VuZGVkLCBfRXZlbnRTdHJlYW1fZXJyb3JlZCwgX0V2ZW50U3RyZWFtX2Fib3J0ZWQsIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkLCBfRXZlbnRTdHJlYW1faGFuZGxlRXJyb3I7XG5pbXBvcnQgeyBBUElVc2VyQWJvcnRFcnJvciwgT3BlbkFJRXJyb3IgfSBmcm9tIFwiLi4vZXJyb3IubWpzXCI7XG5leHBvcnQgY2xhc3MgRXZlbnRTdHJlYW0ge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBfRXZlbnRTdHJlYW1faW5zdGFuY2VzLmFkZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgICBfRXZlbnRTdHJlYW1fY29ubmVjdGVkUHJvbWlzZS5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX3Jlc29sdmVDb25uZWN0ZWRQcm9taXNlLnNldCh0aGlzLCAoKSA9PiB7IH0pO1xuICAgICAgICBfRXZlbnRTdHJlYW1fcmVqZWN0Q29ubmVjdGVkUHJvbWlzZS5zZXQodGhpcywgKCkgPT4geyB9KTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2VuZFByb21pc2Uuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9yZXNvbHZlRW5kUHJvbWlzZS5zZXQodGhpcywgKCkgPT4geyB9KTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX3JlamVjdEVuZFByb21pc2Uuc2V0KHRoaXMsICgpID0+IHsgfSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMuc2V0KHRoaXMsIHt9KTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2VuZGVkLnNldCh0aGlzLCBmYWxzZSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9lcnJvcmVkLnNldCh0aGlzLCBmYWxzZSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9hYm9ydGVkLnNldCh0aGlzLCBmYWxzZSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkLnNldCh0aGlzLCBmYWxzZSk7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2Nvbm5lY3RlZFByb21pc2UsIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX3Jlc29sdmVDb25uZWN0ZWRQcm9taXNlLCByZXNvbHZlLCBcImZcIik7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZWplY3RDb25uZWN0ZWRQcm9taXNlLCByZWplY3QsIFwiZlwiKTtcbiAgICAgICAgfSksIFwiZlwiKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fZW5kUHJvbWlzZSwgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUVuZFByb21pc2UsIHJlc29sdmUsIFwiZlwiKTtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX3JlamVjdEVuZFByb21pc2UsIHJlamVjdCwgXCJmXCIpO1xuICAgICAgICB9KSwgXCJmXCIpO1xuICAgICAgICAvLyBEb24ndCBsZXQgdGhlc2UgcHJvbWlzZXMgY2F1c2UgdW5oYW5kbGVkIHJlamVjdGlvbiBlcnJvcnMuXG4gICAgICAgIC8vIHdlIHdpbGwgbWFudWFsbHkgY2F1c2UgYW4gdW5oYW5kbGVkIHJlamVjdGlvbiBlcnJvciBsYXRlclxuICAgICAgICAvLyBpZiB0aGUgdXNlciBoYXNuJ3QgcmVnaXN0ZXJlZCBhbnkgZXJyb3IgbGlzdGVuZXIgb3IgY2FsbGVkXG4gICAgICAgIC8vIGFueSBwcm9taXNlLXJldHVybmluZyBtZXRob2QuXG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2Nvbm5lY3RlZFByb21pc2UsIFwiZlwiKS5jYXRjaCgoKSA9PiB7IH0pO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lbmRQcm9taXNlLCBcImZcIikuY2F0Y2goKCkgPT4geyB9KTtcbiAgICB9XG4gICAgX3J1bihleGVjdXRvcikge1xuICAgICAgICAvLyBVbmZvcnR1bmF0ZWx5IGlmIHdlIGNhbGwgYGV4ZWN1dG9yKClgIGltbWVkaWF0ZWx5IHdlIGdldCBydW50aW1lIGVycm9ycyBhYm91dFxuICAgICAgICAvLyByZWZlcmVuY2VzIHRvIGB0aGlzYCBiZWZvcmUgdGhlIGBzdXBlcigpYCBjb25zdHJ1Y3RvciBjYWxsIHJldHVybnMuXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgZXhlY3V0b3IoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0RmluYWwoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdlbmQnKTtcbiAgICAgICAgICAgIH0sIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9FdmVudFN0cmVhbV9oYW5kbGVFcnJvcikuYmluZCh0aGlzKSk7XG4gICAgICAgIH0sIDApO1xuICAgIH1cbiAgICBfY29ubmVjdGVkKCkge1xuICAgICAgICBpZiAodGhpcy5lbmRlZClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUNvbm5lY3RlZFByb21pc2UsIFwiZlwiKS5jYWxsKHRoaXMpO1xuICAgICAgICB0aGlzLl9lbWl0KCdjb25uZWN0Jyk7XG4gICAgfVxuICAgIGdldCBlbmRlZCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2VuZGVkLCBcImZcIik7XG4gICAgfVxuICAgIGdldCBlcnJvcmVkKCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fZXJyb3JlZCwgXCJmXCIpO1xuICAgIH1cbiAgICBnZXQgYWJvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2Fib3J0ZWQsIFwiZlwiKTtcbiAgICB9XG4gICAgYWJvcnQoKSB7XG4gICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBZGRzIHRoZSBsaXN0ZW5lciBmdW5jdGlvbiB0byB0aGUgZW5kIG9mIHRoZSBsaXN0ZW5lcnMgYXJyYXkgZm9yIHRoZSBldmVudC5cbiAgICAgKiBObyBjaGVja3MgYXJlIG1hZGUgdG8gc2VlIGlmIHRoZSBsaXN0ZW5lciBoYXMgYWxyZWFkeSBiZWVuIGFkZGVkLiBNdWx0aXBsZSBjYWxscyBwYXNzaW5nXG4gICAgICogdGhlIHNhbWUgY29tYmluYXRpb24gb2YgZXZlbnQgYW5kIGxpc3RlbmVyIHdpbGwgcmVzdWx0IGluIHRoZSBsaXN0ZW5lciBiZWluZyBhZGRlZCwgYW5kXG4gICAgICogY2FsbGVkLCBtdWx0aXBsZSB0aW1lcy5cbiAgICAgKiBAcmV0dXJucyB0aGlzIENoYXRDb21wbGV0aW9uU3RyZWFtLCBzbyB0aGF0IGNhbGxzIGNhbiBiZSBjaGFpbmVkXG4gICAgICovXG4gICAgb24oZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XSB8fCAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdID0gW10pO1xuICAgICAgICBsaXN0ZW5lcnMucHVzaCh7IGxpc3RlbmVyIH0pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUgc3BlY2lmaWVkIGxpc3RlbmVyIGZyb20gdGhlIGxpc3RlbmVyIGFycmF5IGZvciB0aGUgZXZlbnQuXG4gICAgICogb2ZmKCkgd2lsbCByZW1vdmUsIGF0IG1vc3QsIG9uZSBpbnN0YW5jZSBvZiBhIGxpc3RlbmVyIGZyb20gdGhlIGxpc3RlbmVyIGFycmF5LiBJZiBhbnkgc2luZ2xlXG4gICAgICogbGlzdGVuZXIgaGFzIGJlZW4gYWRkZWQgbXVsdGlwbGUgdGltZXMgdG8gdGhlIGxpc3RlbmVyIGFycmF5IGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50LCB0aGVuXG4gICAgICogb2ZmKCkgbXVzdCBiZSBjYWxsZWQgbXVsdGlwbGUgdGltZXMgdG8gcmVtb3ZlIGVhY2ggaW5zdGFuY2UuXG4gICAgICogQHJldHVybnMgdGhpcyBDaGF0Q29tcGxldGlvblN0cmVhbSwgc28gdGhhdCBjYWxscyBjYW4gYmUgY2hhaW5lZFxuICAgICAqL1xuICAgIG9mZihldmVudCwgbGlzdGVuZXIpIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdO1xuICAgICAgICBpZiAoIWxpc3RlbmVycylcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBjb25zdCBpbmRleCA9IGxpc3RlbmVycy5maW5kSW5kZXgoKGwpID0+IGwubGlzdGVuZXIgPT09IGxpc3RlbmVyKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDApXG4gICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBvbmUtdGltZSBsaXN0ZW5lciBmdW5jdGlvbiBmb3IgdGhlIGV2ZW50LiBUaGUgbmV4dCB0aW1lIHRoZSBldmVudCBpcyB0cmlnZ2VyZWQsXG4gICAgICogdGhpcyBsaXN0ZW5lciBpcyByZW1vdmVkIGFuZCB0aGVuIGludm9rZWQuXG4gICAgICogQHJldHVybnMgdGhpcyBDaGF0Q29tcGxldGlvblN0cmVhbSwgc28gdGhhdCBjYWxscyBjYW4gYmUgY2hhaW5lZFxuICAgICAqL1xuICAgIG9uY2UoZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XSB8fCAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdID0gW10pO1xuICAgICAgICBsaXN0ZW5lcnMucHVzaCh7IGxpc3RlbmVyLCBvbmNlOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogVGhpcyBpcyBzaW1pbGFyIHRvIGAub25jZSgpYCwgYnV0IHJldHVybnMgYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdGhlIG5leHQgdGltZVxuICAgICAqIHRoZSBldmVudCBpcyB0cmlnZ2VyZWQsIGluc3RlYWQgb2YgY2FsbGluZyBhIGxpc3RlbmVyIGNhbGxiYWNrLlxuICAgICAqIEByZXR1cm5zIGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRoZSBuZXh0IHRpbWUgZ2l2ZW4gZXZlbnQgaXMgdHJpZ2dlcmVkLFxuICAgICAqIG9yIHJlamVjdHMgaWYgYW4gZXJyb3IgaXMgZW1pdHRlZC4gIChJZiB5b3UgcmVxdWVzdCB0aGUgJ2Vycm9yJyBldmVudCxcbiAgICAgKiByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGVycm9yKS5cbiAgICAgKlxuICAgICAqIEV4YW1wbGU6XG4gICAgICpcbiAgICAgKiAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBzdHJlYW0uZW1pdHRlZCgnbWVzc2FnZScpIC8vIHJlamVjdHMgaWYgdGhlIHN0cmVhbSBlcnJvcnNcbiAgICAgKi9cbiAgICBlbWl0dGVkKGV2ZW50KSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkLCB0cnVlLCBcImZcIik7XG4gICAgICAgICAgICBpZiAoZXZlbnQgIT09ICdlcnJvcicpXG4gICAgICAgICAgICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIHJlamVjdCk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoZXZlbnQsIHJlc29sdmUpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgYXN5bmMgZG9uZSgpIHtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZCwgdHJ1ZSwgXCJmXCIpO1xuICAgICAgICBhd2FpdCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lbmRQcm9taXNlLCBcImZcIik7XG4gICAgfVxuICAgIF9lbWl0KGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICAgIC8vIG1ha2Ugc3VyZSB3ZSBkb24ndCBlbWl0IGFueSBldmVudHMgYWZ0ZXIgZW5kXG4gICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lbmRlZCwgXCJmXCIpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2ZW50ID09PSAnZW5kJykge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fZW5kZWQsIHRydWUsIFwiZlwiKTtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX3Jlc29sdmVFbmRQcm9taXNlLCBcImZcIikuY2FsbCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF07XG4gICAgICAgIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XSA9IGxpc3RlbmVycy5maWx0ZXIoKGwpID0+ICFsLm9uY2UpO1xuICAgICAgICAgICAgbGlzdGVuZXJzLmZvckVhY2goKHsgbGlzdGVuZXIgfSkgPT4gbGlzdGVuZXIoLi4uYXJncykpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudCA9PT0gJ2Fib3J0Jykge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBhcmdzWzBdO1xuICAgICAgICAgICAgaWYgKCFfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkLCBcImZcIikgJiYgIWxpc3RlbmVycz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVqZWN0Q29ubmVjdGVkUHJvbWlzZSwgXCJmXCIpLmNhbGwodGhpcywgZXJyb3IpO1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVqZWN0RW5kUHJvbWlzZSwgXCJmXCIpLmNhbGwodGhpcywgZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZW5kJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2ZW50ID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICAvLyBOT1RFOiBfZW1pdCgnZXJyb3InLCBlcnJvcikgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gI2hhbmRsZUVycm9yKCkuXG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAoIV9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQsIFwiZlwiKSAmJiAhbGlzdGVuZXJzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBUcmlnZ2VyIGFuIHVuaGFuZGxlZCByZWplY3Rpb24gaWYgdGhlIHVzZXIgaGFzbid0IHJlZ2lzdGVyZWQgYW55IGVycm9yIGhhbmRsZXJzLlxuICAgICAgICAgICAgICAgIC8vIElmIHlvdSBhcmUgc2VlaW5nIHN0YWNrIHRyYWNlcyBoZXJlLCBtYWtlIHN1cmUgdG8gaGFuZGxlIGVycm9ycyB2aWEgZWl0aGVyOlxuICAgICAgICAgICAgICAgIC8vIC0gcnVubmVyLm9uKCdlcnJvcicsICgpID0+IC4uLilcbiAgICAgICAgICAgICAgICAvLyAtIGF3YWl0IHJ1bm5lci5kb25lKClcbiAgICAgICAgICAgICAgICAvLyAtIGF3YWl0IHJ1bm5lci5maW5hbENoYXRDb21wbGV0aW9uKClcbiAgICAgICAgICAgICAgICAvLyAtIGV0Yy5cbiAgICAgICAgICAgICAgICBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZWplY3RDb25uZWN0ZWRQcm9taXNlLCBcImZcIikuY2FsbCh0aGlzLCBlcnJvcik7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZWplY3RFbmRQcm9taXNlLCBcImZcIikuY2FsbCh0aGlzLCBlcnJvcik7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdlbmQnKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfZW1pdEZpbmFsKCkgeyB9XG59XG5fRXZlbnRTdHJlYW1fY29ubmVjdGVkUHJvbWlzZSA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9yZXNvbHZlQ29ubmVjdGVkUHJvbWlzZSA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9yZWplY3RDb25uZWN0ZWRQcm9taXNlID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2VuZFByb21pc2UgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUVuZFByb21pc2UgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fcmVqZWN0RW5kUHJvbWlzZSA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fZW5kZWQgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fZXJyb3JlZCA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9hYm9ydGVkID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1faW5zdGFuY2VzID0gbmV3IFdlYWtTZXQoKSwgX0V2ZW50U3RyZWFtX2hhbmRsZUVycm9yID0gZnVuY3Rpb24gX0V2ZW50U3RyZWFtX2hhbmRsZUVycm9yKGVycm9yKSB7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fZXJyb3JlZCwgdHJ1ZSwgXCJmXCIpO1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yICYmIGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuICAgICAgICBlcnJvciA9IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgIH1cbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBBUElVc2VyQWJvcnRFcnJvcikge1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9hYm9ydGVkLCB0cnVlLCBcImZcIik7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbWl0KCdhYm9ydCcsIGVycm9yKTtcbiAgICB9XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgT3BlbkFJRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VtaXQoJ2Vycm9yJywgZXJyb3IpO1xuICAgIH1cbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBjb25zdCBvcGVuQUlFcnJvciA9IG5ldyBPcGVuQUlFcnJvcihlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBvcGVuQUlFcnJvci5jYXVzZSA9IGVycm9yO1xuICAgICAgICByZXR1cm4gdGhpcy5fZW1pdCgnZXJyb3InLCBvcGVuQUlFcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9lbWl0KCdlcnJvcicsIG5ldyBPcGVuQUlFcnJvcihTdHJpbmcoZXJyb3IpKSk7XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RXZlbnRTdHJlYW0ubWpzLm1hcCIsImV4cG9ydCBmdW5jdGlvbiBpc1J1bm5hYmxlRnVuY3Rpb25XaXRoUGFyc2UoZm4pIHtcbiAgICByZXR1cm4gdHlwZW9mIGZuLnBhcnNlID09PSAnZnVuY3Rpb24nO1xufVxuLyoqXG4gKiBUaGlzIGlzIGhlbHBlciBjbGFzcyBmb3IgcGFzc2luZyBhIGBmdW5jdGlvbmAgYW5kIGBwYXJzZWAgd2hlcmUgdGhlIGBmdW5jdGlvbmBcbiAqIGFyZ3VtZW50IHR5cGUgbWF0Y2hlcyB0aGUgYHBhcnNlYCByZXR1cm4gdHlwZS5cbiAqXG4gKiBAZGVwcmVjYXRlZCAtIHBsZWFzZSB1c2UgUGFyc2luZ1Rvb2xGdW5jdGlvbiBpbnN0ZWFkLlxuICovXG5leHBvcnQgY2xhc3MgUGFyc2luZ0Z1bmN0aW9uIHtcbiAgICBjb25zdHJ1Y3RvcihpbnB1dCkge1xuICAgICAgICB0aGlzLmZ1bmN0aW9uID0gaW5wdXQuZnVuY3Rpb247XG4gICAgICAgIHRoaXMucGFyc2UgPSBpbnB1dC5wYXJzZTtcbiAgICAgICAgdGhpcy5wYXJhbWV0ZXJzID0gaW5wdXQucGFyYW1ldGVycztcbiAgICAgICAgdGhpcy5kZXNjcmlwdGlvbiA9IGlucHV0LmRlc2NyaXB0aW9uO1xuICAgICAgICB0aGlzLm5hbWUgPSBpbnB1dC5uYW1lO1xuICAgIH1cbn1cbi8qKlxuICogVGhpcyBpcyBoZWxwZXIgY2xhc3MgZm9yIHBhc3NpbmcgYSBgZnVuY3Rpb25gIGFuZCBgcGFyc2VgIHdoZXJlIHRoZSBgZnVuY3Rpb25gXG4gKiBhcmd1bWVudCB0eXBlIG1hdGNoZXMgdGhlIGBwYXJzZWAgcmV0dXJuIHR5cGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXJzaW5nVG9vbEZ1bmN0aW9uIHtcbiAgICBjb25zdHJ1Y3RvcihpbnB1dCkge1xuICAgICAgICB0aGlzLnR5cGUgPSAnZnVuY3Rpb24nO1xuICAgICAgICB0aGlzLmZ1bmN0aW9uID0gaW5wdXQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9UnVubmFibGVGdW5jdGlvbi5tanMubWFwIiwiLyoqXG4gKiBMaWtlIGBQcm9taXNlLmFsbFNldHRsZWQoKWAgYnV0IHRocm93cyBhbiBlcnJvciBpZiBhbnkgcHJvbWlzZXMgYXJlIHJlamVjdGVkLlxuICovXG5leHBvcnQgY29uc3QgYWxsU2V0dGxlZFdpdGhUaHJvdyA9IGFzeW5jIChwcm9taXNlcykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQocHJvbWlzZXMpO1xuICAgIGNvbnN0IHJlamVjdGVkID0gcmVzdWx0cy5maWx0ZXIoKHJlc3VsdCkgPT4gcmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJyk7XG4gICAgaWYgKHJlamVjdGVkLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZWplY3RlZCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihyZXN1bHQucmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cmVqZWN0ZWQubGVuZ3RofSBwcm9taXNlKHMpIGZhaWxlZCAtIHNlZSB0aGUgYWJvdmUgZXJyb3JzYCk7XG4gICAgfVxuICAgIC8vIE5vdGU6IFRTIHdhcyBjb21wbGFpbmluZyBhYm91dCB1c2luZyBgLmZpbHRlcigpLm1hcCgpYCBoZXJlIGZvciBzb21lIHJlYXNvblxuICAgIGNvbnN0IHZhbHVlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnKSB7XG4gICAgICAgICAgICB2YWx1ZXMucHVzaChyZXN1bHQudmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9VXRpbC5tanMubWFwIiwiZXhwb3J0IGNvbnN0IGlzQXNzaXN0YW50TWVzc2FnZSA9IChtZXNzYWdlKSA9PiB7XG4gICAgcmV0dXJuIG1lc3NhZ2U/LnJvbGUgPT09ICdhc3Npc3RhbnQnO1xufTtcbmV4cG9ydCBjb25zdCBpc0Z1bmN0aW9uTWVzc2FnZSA9IChtZXNzYWdlKSA9PiB7XG4gICAgcmV0dXJuIG1lc3NhZ2U/LnJvbGUgPT09ICdmdW5jdGlvbic7XG59O1xuZXhwb3J0IGNvbnN0IGlzVG9vbE1lc3NhZ2UgPSAobWVzc2FnZSkgPT4ge1xuICAgIHJldHVybiBtZXNzYWdlPy5yb2xlID09PSAndG9vbCc7XG59O1xuZXhwb3J0IGZ1bmN0aW9uIGlzUHJlc2VudChvYmopIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGw7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jaGF0Q29tcGxldGlvblV0aWxzLm1qcy5tYXAiLCJpbXBvcnQgeyBDb250ZW50RmlsdGVyRmluaXNoUmVhc29uRXJyb3IsIExlbmd0aEZpbmlzaFJlYXNvbkVycm9yLCBPcGVuQUlFcnJvciB9IGZyb20gXCIuLi9lcnJvci5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBtYWtlUGFyc2VhYmxlUmVzcG9uc2VGb3JtYXQocmVzcG9uc2VfZm9ybWF0LCBwYXJzZXIpIHtcbiAgICBjb25zdCBvYmogPSB7IC4uLnJlc3BvbnNlX2Zvcm1hdCB9O1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKG9iaiwge1xuICAgICAgICAkYnJhbmQ6IHtcbiAgICAgICAgICAgIHZhbHVlOiAnYXV0by1wYXJzZWFibGUtcmVzcG9uc2UtZm9ybWF0JyxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICAkcGFyc2VSYXc6IHtcbiAgICAgICAgICAgIHZhbHVlOiBwYXJzZXIsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGlzQXV0b1BhcnNhYmxlUmVzcG9uc2VGb3JtYXQocmVzcG9uc2VfZm9ybWF0KSB7XG4gICAgcmV0dXJuIHJlc3BvbnNlX2Zvcm1hdD8uWyckYnJhbmQnXSA9PT0gJ2F1dG8tcGFyc2VhYmxlLXJlc3BvbnNlLWZvcm1hdCc7XG59XG5leHBvcnQgZnVuY3Rpb24gbWFrZVBhcnNlYWJsZVRvb2wodG9vbCwgeyBwYXJzZXIsIGNhbGxiYWNrLCB9KSB7XG4gICAgY29uc3Qgb2JqID0geyAuLi50b29sIH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMob2JqLCB7XG4gICAgICAgICRicmFuZDoge1xuICAgICAgICAgICAgdmFsdWU6ICdhdXRvLXBhcnNlYWJsZS10b29sJyxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICAkcGFyc2VSYXc6IHtcbiAgICAgICAgICAgIHZhbHVlOiBwYXJzZXIsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgJGNhbGxiYWNrOiB7XG4gICAgICAgICAgICB2YWx1ZTogY2FsbGJhY2ssXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGlzQXV0b1BhcnNhYmxlVG9vbCh0b29sKSB7XG4gICAgcmV0dXJuIHRvb2w/LlsnJGJyYW5kJ10gPT09ICdhdXRvLXBhcnNlYWJsZS10b29sJztcbn1cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVBhcnNlQ2hhdENvbXBsZXRpb24oY29tcGxldGlvbiwgcGFyYW1zKSB7XG4gICAgaWYgKCFwYXJhbXMgfHwgIWhhc0F1dG9QYXJzZWFibGVJbnB1dChwYXJhbXMpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5jb21wbGV0aW9uLFxuICAgICAgICAgICAgY2hvaWNlczogY29tcGxldGlvbi5jaG9pY2VzLm1hcCgoY2hvaWNlKSA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLmNob2ljZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiB7IC4uLmNob2ljZS5tZXNzYWdlLCBwYXJzZWQ6IG51bGwsIHRvb2xfY2FsbHM6IGNob2ljZS5tZXNzYWdlLnRvb2xfY2FsbHMgPz8gW10gfSxcbiAgICAgICAgICAgIH0pKSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlQ2hhdENvbXBsZXRpb24oY29tcGxldGlvbiwgcGFyYW1zKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNoYXRDb21wbGV0aW9uKGNvbXBsZXRpb24sIHBhcmFtcykge1xuICAgIGNvbnN0IGNob2ljZXMgPSBjb21wbGV0aW9uLmNob2ljZXMubWFwKChjaG9pY2UpID0+IHtcbiAgICAgICAgaWYgKGNob2ljZS5maW5pc2hfcmVhc29uID09PSAnbGVuZ3RoJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IExlbmd0aEZpbmlzaFJlYXNvbkVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNob2ljZS5maW5pc2hfcmVhc29uID09PSAnY29udGVudF9maWx0ZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQ29udGVudEZpbHRlckZpbmlzaFJlYXNvbkVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmNob2ljZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgICAgICAuLi5jaG9pY2UubWVzc2FnZSxcbiAgICAgICAgICAgICAgICB0b29sX2NhbGxzOiBjaG9pY2UubWVzc2FnZS50b29sX2NhbGxzPy5tYXAoKHRvb2xDYWxsKSA9PiBwYXJzZVRvb2xDYWxsKHBhcmFtcywgdG9vbENhbGwpKSA/PyBbXSxcbiAgICAgICAgICAgICAgICBwYXJzZWQ6IGNob2ljZS5tZXNzYWdlLmNvbnRlbnQgJiYgIWNob2ljZS5tZXNzYWdlLnJlZnVzYWwgP1xuICAgICAgICAgICAgICAgICAgICBwYXJzZVJlc3BvbnNlRm9ybWF0KHBhcmFtcywgY2hvaWNlLm1lc3NhZ2UuY29udGVudClcbiAgICAgICAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4geyAuLi5jb21wbGV0aW9uLCBjaG9pY2VzIH07XG59XG5mdW5jdGlvbiBwYXJzZVJlc3BvbnNlRm9ybWF0KHBhcmFtcywgY29udGVudCkge1xuICAgIGlmIChwYXJhbXMucmVzcG9uc2VfZm9ybWF0Py50eXBlICE9PSAnanNvbl9zY2hlbWEnKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAocGFyYW1zLnJlc3BvbnNlX2Zvcm1hdD8udHlwZSA9PT0gJ2pzb25fc2NoZW1hJykge1xuICAgICAgICBpZiAoJyRwYXJzZVJhdycgaW4gcGFyYW1zLnJlc3BvbnNlX2Zvcm1hdCkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VfZm9ybWF0ID0gcGFyYW1zLnJlc3BvbnNlX2Zvcm1hdDtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZV9mb3JtYXQuJHBhcnNlUmF3KGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbmZ1bmN0aW9uIHBhcnNlVG9vbENhbGwocGFyYW1zLCB0b29sQ2FsbCkge1xuICAgIGNvbnN0IGlucHV0VG9vbCA9IHBhcmFtcy50b29scz8uZmluZCgoaW5wdXRUb29sKSA9PiBpbnB1dFRvb2wuZnVuY3Rpb24/Lm5hbWUgPT09IHRvb2xDYWxsLmZ1bmN0aW9uLm5hbWUpO1xuICAgIHJldHVybiB7XG4gICAgICAgIC4uLnRvb2xDYWxsLFxuICAgICAgICBmdW5jdGlvbjoge1xuICAgICAgICAgICAgLi4udG9vbENhbGwuZnVuY3Rpb24sXG4gICAgICAgICAgICBwYXJzZWRfYXJndW1lbnRzOiBpc0F1dG9QYXJzYWJsZVRvb2woaW5wdXRUb29sKSA/IGlucHV0VG9vbC4kcGFyc2VSYXcodG9vbENhbGwuZnVuY3Rpb24uYXJndW1lbnRzKVxuICAgICAgICAgICAgICAgIDogaW5wdXRUb29sPy5mdW5jdGlvbi5zdHJpY3QgPyBKU09OLnBhcnNlKHRvb2xDYWxsLmZ1bmN0aW9uLmFyZ3VtZW50cylcbiAgICAgICAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgICB9LFxuICAgIH07XG59XG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkUGFyc2VUb29sQ2FsbChwYXJhbXMsIHRvb2xDYWxsKSB7XG4gICAgaWYgKCFwYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBpbnB1dFRvb2wgPSBwYXJhbXMudG9vbHM/LmZpbmQoKGlucHV0VG9vbCkgPT4gaW5wdXRUb29sLmZ1bmN0aW9uPy5uYW1lID09PSB0b29sQ2FsbC5mdW5jdGlvbi5uYW1lKTtcbiAgICByZXR1cm4gaXNBdXRvUGFyc2FibGVUb29sKGlucHV0VG9vbCkgfHwgaW5wdXRUb29sPy5mdW5jdGlvbi5zdHJpY3QgfHwgZmFsc2U7XG59XG5leHBvcnQgZnVuY3Rpb24gaGFzQXV0b1BhcnNlYWJsZUlucHV0KHBhcmFtcykge1xuICAgIGlmIChpc0F1dG9QYXJzYWJsZVJlc3BvbnNlRm9ybWF0KHBhcmFtcy5yZXNwb25zZV9mb3JtYXQpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gKHBhcmFtcy50b29scz8uc29tZSgodCkgPT4gaXNBdXRvUGFyc2FibGVUb29sKHQpIHx8ICh0LnR5cGUgPT09ICdmdW5jdGlvbicgJiYgdC5mdW5jdGlvbi5zdHJpY3QgPT09IHRydWUpKSA/PyBmYWxzZSk7XG59XG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVJbnB1dFRvb2xzKHRvb2xzKSB7XG4gICAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xzID8/IFtdKSB7XG4gICAgICAgIGlmICh0b29sLnR5cGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgQ3VycmVudGx5IG9ubHkgXFxgZnVuY3Rpb25cXGAgdG9vbCB0eXBlcyBzdXBwb3J0IGF1dG8tcGFyc2luZzsgUmVjZWl2ZWQgXFxgJHt0b29sLnR5cGV9XFxgYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRvb2wuZnVuY3Rpb24uc3RyaWN0ICE9PSB0cnVlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYFRoZSBcXGAke3Rvb2wuZnVuY3Rpb24ubmFtZX1cXGAgdG9vbCBpcyBub3QgbWFya2VkIHdpdGggXFxgc3RyaWN0OiB0cnVlXFxgLiBPbmx5IHN0cmljdCBmdW5jdGlvbiB0b29scyBjYW4gYmUgYXV0by1wYXJzZWRgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBhcnNlci5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFic3RyYWN0UGFnZSB9IGZyb20gXCIuL2NvcmUubWpzXCI7XG4vKipcbiAqIE5vdGU6IG5vIHBhZ2luYXRpb24gYWN0dWFsbHkgb2NjdXJzIHlldCwgdGhpcyBpcyBmb3IgZm9yd2FyZHMtY29tcGF0aWJpbGl0eS5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhZ2UgZXh0ZW5kcyBBYnN0cmFjdFBhZ2Uge1xuICAgIGNvbnN0cnVjdG9yKGNsaWVudCwgcmVzcG9uc2UsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIoY2xpZW50LCByZXNwb25zZSwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuZGF0YSA9IGJvZHkuZGF0YSB8fCBbXTtcbiAgICAgICAgdGhpcy5vYmplY3QgPSBib2R5Lm9iamVjdDtcbiAgICB9XG4gICAgZ2V0UGFnaW5hdGVkSXRlbXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEgPz8gW107XG4gICAgfVxuICAgIC8vIEBkZXByZWNhdGVkIFBsZWFzZSB1c2UgYG5leHRQYWdlSW5mbygpYCBpbnN0ZWFkXG4gICAgLyoqXG4gICAgICogVGhpcyBwYWdlIHJlcHJlc2VudHMgYSByZXNwb25zZSB0aGF0IGlzbid0IGFjdHVhbGx5IHBhZ2luYXRlZCBhdCB0aGUgQVBJIGxldmVsXG4gICAgICogc28gdGhlcmUgd2lsbCBuZXZlciBiZSBhbnkgbmV4dCBwYWdlIHBhcmFtcy5cbiAgICAgKi9cbiAgICBuZXh0UGFnZVBhcmFtcygpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIG5leHRQYWdlSW5mbygpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEN1cnNvclBhZ2UgZXh0ZW5kcyBBYnN0cmFjdFBhZ2Uge1xuICAgIGNvbnN0cnVjdG9yKGNsaWVudCwgcmVzcG9uc2UsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIoY2xpZW50LCByZXNwb25zZSwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuZGF0YSA9IGJvZHkuZGF0YSB8fCBbXTtcbiAgICAgICAgdGhpcy5oYXNfbW9yZSA9IGJvZHkuaGFzX21vcmUgfHwgZmFsc2U7XG4gICAgfVxuICAgIGdldFBhZ2luYXRlZEl0ZW1zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhID8/IFtdO1xuICAgIH1cbiAgICBoYXNOZXh0UGFnZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzX21vcmUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1cGVyLmhhc05leHRQYWdlKCk7XG4gICAgfVxuICAgIC8vIEBkZXByZWNhdGVkIFBsZWFzZSB1c2UgYG5leHRQYWdlSW5mbygpYCBpbnN0ZWFkXG4gICAgbmV4dFBhZ2VQYXJhbXMoKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSB0aGlzLm5leHRQYWdlSW5mbygpO1xuICAgICAgICBpZiAoIWluZm8pXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKCdwYXJhbXMnIGluIGluZm8pXG4gICAgICAgICAgICByZXR1cm4gaW5mby5wYXJhbXM7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IE9iamVjdC5mcm9tRW50cmllcyhpbmZvLnVybC5zZWFyY2hQYXJhbXMpO1xuICAgICAgICBpZiAoIU9iamVjdC5rZXlzKHBhcmFtcykubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuICAgIG5leHRQYWdlSW5mbygpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZ2V0UGFnaW5hdGVkSXRlbXMoKTtcbiAgICAgICAgaWYgKCFkYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaWQgPSBkYXRhW2RhdGEubGVuZ3RoIC0gMV0/LmlkO1xuICAgICAgICBpZiAoIWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBwYXJhbXM6IHsgYWZ0ZXI6IGlkIH0gfTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYWdpbmF0aW9uLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuZXhwb3J0IGNsYXNzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcihjbGllbnQpIHtcbiAgICAgICAgdGhpcy5fY2xpZW50ID0gY2xpZW50O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlc291cmNlLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBTcGVlY2hBUEkgZnJvbSBcIi4vc3BlZWNoLm1qc1wiO1xuaW1wb3J0IHsgU3BlZWNoIH0gZnJvbSBcIi4vc3BlZWNoLm1qc1wiO1xuaW1wb3J0ICogYXMgVHJhbnNjcmlwdGlvbnNBUEkgZnJvbSBcIi4vdHJhbnNjcmlwdGlvbnMubWpzXCI7XG5pbXBvcnQgeyBUcmFuc2NyaXB0aW9ucywgfSBmcm9tIFwiLi90cmFuc2NyaXB0aW9ucy5tanNcIjtcbmltcG9ydCAqIGFzIFRyYW5zbGF0aW9uc0FQSSBmcm9tIFwiLi90cmFuc2xhdGlvbnMubWpzXCI7XG5pbXBvcnQgeyBUcmFuc2xhdGlvbnMsIH0gZnJvbSBcIi4vdHJhbnNsYXRpb25zLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEF1ZGlvIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLnRyYW5zY3JpcHRpb25zID0gbmV3IFRyYW5zY3JpcHRpb25zQVBJLlRyYW5zY3JpcHRpb25zKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMudHJhbnNsYXRpb25zID0gbmV3IFRyYW5zbGF0aW9uc0FQSS5UcmFuc2xhdGlvbnModGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy5zcGVlY2ggPSBuZXcgU3BlZWNoQVBJLlNwZWVjaCh0aGlzLl9jbGllbnQpO1xuICAgIH1cbn1cbkF1ZGlvLlRyYW5zY3JpcHRpb25zID0gVHJhbnNjcmlwdGlvbnM7XG5BdWRpby5UcmFuc2xhdGlvbnMgPSBUcmFuc2xhdGlvbnM7XG5BdWRpby5TcGVlY2ggPSBTcGVlY2g7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1hdWRpby5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFNwZWVjaCBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYXVkaW8gZnJvbSB0aGUgaW5wdXQgdGV4dC5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9hdWRpby9zcGVlY2gnLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgQWNjZXB0OiAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICAgICAgX19iaW5hcnlSZXNwb25zZTogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3BlZWNoLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuLi8uLi9jb3JlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFRyYW5zY3JpcHRpb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2F1ZGlvL3RyYW5zY3JpcHRpb25zJywgQ29yZS5tdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMoeyBib2R5LCAuLi5vcHRpb25zLCBfX21ldGFkYXRhOiB7IG1vZGVsOiBib2R5Lm1vZGVsIH0gfSkpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXRyYW5zY3JpcHRpb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuLi8uLi9jb3JlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFRyYW5zbGF0aW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9hdWRpby90cmFuc2xhdGlvbnMnLCBDb3JlLm11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyh7IGJvZHksIC4uLm9wdGlvbnMsIF9fbWV0YWRhdGE6IHsgbW9kZWw6IGJvZHkubW9kZWwgfSB9KSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dHJhbnNsYXRpb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgQmF0Y2hlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCBleGVjdXRlcyBhIGJhdGNoIGZyb20gYW4gdXBsb2FkZWQgZmlsZSBvZiByZXF1ZXN0c1xuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2JhdGNoZXMnLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIGJhdGNoLlxuICAgICAqL1xuICAgIHJldHJpZXZlKGJhdGNoSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9iYXRjaGVzLyR7YmF0Y2hJZH1gLCBvcHRpb25zKTtcbiAgICB9XG4gICAgbGlzdChxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL2JhdGNoZXMnLCBCYXRjaGVzUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FuY2VscyBhbiBpbi1wcm9ncmVzcyBiYXRjaC4gVGhlIGJhdGNoIHdpbGwgYmUgaW4gc3RhdHVzIGBjYW5jZWxsaW5nYCBmb3IgdXAgdG9cbiAgICAgKiAxMCBtaW51dGVzLCBiZWZvcmUgY2hhbmdpbmcgdG8gYGNhbmNlbGxlZGAsIHdoZXJlIGl0IHdpbGwgaGF2ZSBwYXJ0aWFsIHJlc3VsdHNcbiAgICAgKiAoaWYgYW55KSBhdmFpbGFibGUgaW4gdGhlIG91dHB1dCBmaWxlLlxuICAgICAqL1xuICAgIGNhbmNlbChiYXRjaElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL2JhdGNoZXMvJHtiYXRjaElkfS9jYW5jZWxgLCBvcHRpb25zKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQmF0Y2hlc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkJhdGNoZXMuQmF0Y2hlc1BhZ2UgPSBCYXRjaGVzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWJhdGNoZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBBc3Npc3RhbnRzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBhc3Npc3RhbnQgd2l0aCBhIG1vZGVsIGFuZCBpbnN0cnVjdGlvbnMuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvYXNzaXN0YW50cycsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhbiBhc3Npc3RhbnQuXG4gICAgICovXG4gICAgcmV0cmlldmUoYXNzaXN0YW50SWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9hc3Npc3RhbnRzLyR7YXNzaXN0YW50SWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBNb2RpZmllcyBhbiBhc3Npc3RhbnQuXG4gICAgICovXG4gICAgdXBkYXRlKGFzc2lzdGFudElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL2Fzc2lzdGFudHMvJHthc3Npc3RhbnRJZH1gLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsaXN0KHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvYXNzaXN0YW50cycsIEFzc2lzdGFudHNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGFuIGFzc2lzdGFudC5cbiAgICAgKi9cbiAgICBkZWwoYXNzaXN0YW50SWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC9hc3Npc3RhbnRzLyR7YXNzaXN0YW50SWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBc3Npc3RhbnRzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuQXNzaXN0YW50cy5Bc3Npc3RhbnRzUGFnZSA9IEFzc2lzdGFudHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXNzaXN0YW50cy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQXNzaXN0YW50c0FQSSBmcm9tIFwiLi9hc3Npc3RhbnRzLm1qc1wiO1xuaW1wb3J0ICogYXMgQ2hhdEFQSSBmcm9tIFwiLi9jaGF0L2NoYXQubWpzXCI7XG5pbXBvcnQgeyBBc3Npc3RhbnRzLCBBc3Npc3RhbnRzUGFnZSwgfSBmcm9tIFwiLi9hc3Npc3RhbnRzLm1qc1wiO1xuaW1wb3J0ICogYXMgUmVhbHRpbWVBUEkgZnJvbSBcIi4vcmVhbHRpbWUvcmVhbHRpbWUubWpzXCI7XG5pbXBvcnQgeyBSZWFsdGltZSB9IGZyb20gXCIuL3JlYWx0aW1lL3JlYWx0aW1lLm1qc1wiO1xuaW1wb3J0ICogYXMgVGhyZWFkc0FQSSBmcm9tIFwiLi90aHJlYWRzL3RocmVhZHMubWpzXCI7XG5pbXBvcnQgeyBUaHJlYWRzLCB9IGZyb20gXCIuL3RocmVhZHMvdGhyZWFkcy5tanNcIjtcbmltcG9ydCAqIGFzIFZlY3RvclN0b3Jlc0FQSSBmcm9tIFwiLi92ZWN0b3Itc3RvcmVzL3ZlY3Rvci1zdG9yZXMubWpzXCI7XG5pbXBvcnQgeyBWZWN0b3JTdG9yZXMsIFZlY3RvclN0b3Jlc1BhZ2UsIH0gZnJvbSBcIi4vdmVjdG9yLXN0b3Jlcy92ZWN0b3Itc3RvcmVzLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdCB9IGZyb20gXCIuL2NoYXQvY2hhdC5tanNcIjtcbmV4cG9ydCBjbGFzcyBCZXRhIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLnJlYWx0aW1lID0gbmV3IFJlYWx0aW1lQVBJLlJlYWx0aW1lKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMudmVjdG9yU3RvcmVzID0gbmV3IFZlY3RvclN0b3Jlc0FQSS5WZWN0b3JTdG9yZXModGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy5jaGF0ID0gbmV3IENoYXRBUEkuQ2hhdCh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLmFzc2lzdGFudHMgPSBuZXcgQXNzaXN0YW50c0FQSS5Bc3Npc3RhbnRzKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMudGhyZWFkcyA9IG5ldyBUaHJlYWRzQVBJLlRocmVhZHModGhpcy5fY2xpZW50KTtcbiAgICB9XG59XG5CZXRhLlJlYWx0aW1lID0gUmVhbHRpbWU7XG5CZXRhLlZlY3RvclN0b3JlcyA9IFZlY3RvclN0b3JlcztcbkJldGEuVmVjdG9yU3RvcmVzUGFnZSA9IFZlY3RvclN0b3Jlc1BhZ2U7XG5CZXRhLkFzc2lzdGFudHMgPSBBc3Npc3RhbnRzO1xuQmV0YS5Bc3Npc3RhbnRzUGFnZSA9IEFzc2lzdGFudHNQYWdlO1xuQmV0YS5UaHJlYWRzID0gVGhyZWFkcztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWJldGEubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIENvbXBsZXRpb25zQVBJIGZyb20gXCIuL2NvbXBsZXRpb25zLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENoYXQgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuY29tcGxldGlvbnMgPSBuZXcgQ29tcGxldGlvbnNBUEkuQ29tcGxldGlvbnModGhpcy5fY2xpZW50KTtcbiAgICB9XG59XG4oZnVuY3Rpb24gKENoYXQpIHtcbiAgICBDaGF0LkNvbXBsZXRpb25zID0gQ29tcGxldGlvbnNBUEkuQ29tcGxldGlvbnM7XG59KShDaGF0IHx8IChDaGF0ID0ge30pKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNoYXQubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IENoYXRDb21wbGV0aW9uUnVubmVyIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9DaGF0Q29tcGxldGlvblJ1bm5lci5tanNcIjtcbmltcG9ydCB7IENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLCB9IGZyb20gXCIuLi8uLi8uLi9saWIvQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIubWpzXCI7XG5pbXBvcnQgeyBDaGF0Q29tcGxldGlvblN0cmVhbSB9IGZyb20gXCIuLi8uLi8uLi9saWIvQ2hhdENvbXBsZXRpb25TdHJlYW0ubWpzXCI7XG5pbXBvcnQgeyBwYXJzZUNoYXRDb21wbGV0aW9uLCB2YWxpZGF0ZUlucHV0VG9vbHMgfSBmcm9tIFwiLi4vLi4vLi4vbGliL3BhcnNlci5tanNcIjtcbmV4cG9ydCB7IENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLCB9IGZyb20gXCIuLi8uLi8uLi9saWIvQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIubWpzXCI7XG5leHBvcnQgeyBQYXJzaW5nRnVuY3Rpb24sIFBhcnNpbmdUb29sRnVuY3Rpb24sIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9SdW5uYWJsZUZ1bmN0aW9uLm1qc1wiO1xuZXhwb3J0IHsgQ2hhdENvbXBsZXRpb25TdHJlYW0gfSBmcm9tIFwiLi4vLi4vLi4vbGliL0NoYXRDb21wbGV0aW9uU3RyZWFtLm1qc1wiO1xuZXhwb3J0IHsgQ2hhdENvbXBsZXRpb25SdW5uZXIsIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9DaGF0Q29tcGxldGlvblJ1bm5lci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb21wbGV0aW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBwYXJzZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHZhbGlkYXRlSW5wdXRUb29scyhib2R5LnRvb2xzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5jaGF0LmNvbXBsZXRpb25zXG4gICAgICAgICAgICAuY3JlYXRlKGJvZHksIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgLi4ub3B0aW9ucz8uaGVhZGVycyxcbiAgICAgICAgICAgICAgICAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdiZXRhLmNoYXQuY29tcGxldGlvbnMucGFyc2UnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgICAgICAgIC5fdGhlblVud3JhcCgoY29tcGxldGlvbikgPT4gcGFyc2VDaGF0Q29tcGxldGlvbihjb21wbGV0aW9uLCBib2R5KSk7XG4gICAgfVxuICAgIHJ1bkZ1bmN0aW9ucyhib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChib2R5LnN0cmVhbSkge1xuICAgICAgICAgICAgcmV0dXJuIENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLnJ1bkZ1bmN0aW9ucyh0aGlzLl9jbGllbnQsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDaGF0Q29tcGxldGlvblJ1bm5lci5ydW5GdW5jdGlvbnModGhpcy5fY2xpZW50LCBib2R5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcnVuVG9vbHMoYm9keSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoYm9keS5zdHJlYW0pIHtcbiAgICAgICAgICAgIHJldHVybiBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lci5ydW5Ub29scyh0aGlzLl9jbGllbnQsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDaGF0Q29tcGxldGlvblJ1bm5lci5ydW5Ub29scyh0aGlzLl9jbGllbnQsIGJvZHksIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgY2hhdCBjb21wbGV0aW9uIHN0cmVhbVxuICAgICAqL1xuICAgIHN0cmVhbShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBDaGF0Q29tcGxldGlvblN0cmVhbS5jcmVhdGVDaGF0Q29tcGxldGlvbih0aGlzLl9jbGllbnQsIGJvZHksIG9wdGlvbnMpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbXBsZXRpb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBTZXNzaW9uc0FQSSBmcm9tIFwiLi9zZXNzaW9ucy5tanNcIjtcbmltcG9ydCB7IFNlc3Npb25zLCB9IGZyb20gXCIuL3Nlc3Npb25zLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFJlYWx0aW1lIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLnNlc3Npb25zID0gbmV3IFNlc3Npb25zQVBJLlNlc3Npb25zKHRoaXMuX2NsaWVudCk7XG4gICAgfVxufVxuUmVhbHRpbWUuU2Vzc2lvbnMgPSBTZXNzaW9ucztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlYWx0aW1lLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5leHBvcnQgY2xhc3MgU2Vzc2lvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGVwaGVtZXJhbCBBUEkgdG9rZW4gZm9yIHVzZSBpbiBjbGllbnQtc2lkZSBhcHBsaWNhdGlvbnMgd2l0aCB0aGVcbiAgICAgKiBSZWFsdGltZSBBUEkuIENhbiBiZSBjb25maWd1cmVkIHdpdGggdGhlIHNhbWUgc2Vzc2lvbiBwYXJhbWV0ZXJzIGFzIHRoZVxuICAgICAqIGBzZXNzaW9uLnVwZGF0ZWAgY2xpZW50IGV2ZW50LlxuICAgICAqXG4gICAgICogSXQgcmVzcG9uZHMgd2l0aCBhIHNlc3Npb24gb2JqZWN0LCBwbHVzIGEgYGNsaWVudF9zZWNyZXRgIGtleSB3aGljaCBjb250YWlucyBhXG4gICAgICogdXNhYmxlIGVwaGVtZXJhbCBBUEkgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byBhdXRoZW50aWNhdGUgYnJvd3NlciBjbGllbnRzIGZvclxuICAgICAqIHRoZSBSZWFsdGltZSBBUEkuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvcmVhbHRpbWUvc2Vzc2lvbnMnLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXNlc3Npb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgTWVzc2FnZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbWVzc2FnZS5cbiAgICAgKi9cbiAgICBjcmVhdGUodGhyZWFkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9tZXNzYWdlc2AsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlIGEgbWVzc2FnZS5cbiAgICAgKi9cbiAgICByZXRyaWV2ZSh0aHJlYWRJZCwgbWVzc2FnZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1vZGlmaWVzIGEgbWVzc2FnZS5cbiAgICAgKi9cbiAgICB1cGRhdGUodGhyZWFkSWQsIG1lc3NhZ2VJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWAsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxpc3QodGhyZWFkSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHRocmVhZElkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vbWVzc2FnZXNgLCBNZXNzYWdlc1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGVzIGEgbWVzc2FnZS5cbiAgICAgKi9cbiAgICBkZWwodGhyZWFkSWQsIG1lc3NhZ2VJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL3RocmVhZHMvJHt0aHJlYWRJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBNZXNzYWdlc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbk1lc3NhZ2VzLk1lc3NhZ2VzUGFnZSA9IE1lc3NhZ2VzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1lc3NhZ2VzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBBc3Npc3RhbnRTdHJlYW0gfSBmcm9tIFwiLi4vLi4vLi4vLi4vbGliL0Fzc2lzdGFudFN0cmVhbS5tanNcIjtcbmltcG9ydCB7IHNsZWVwIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgKiBhcyBTdGVwc0FQSSBmcm9tIFwiLi9zdGVwcy5tanNcIjtcbmltcG9ydCB7IFJ1blN0ZXBzUGFnZSwgU3RlcHMsIH0gZnJvbSBcIi4vc3RlcHMubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgUnVucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5zdGVwcyA9IG5ldyBTdGVwc0FQSS5TdGVwcyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbiAgICBjcmVhdGUodGhyZWFkSWQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCB7IGluY2x1ZGUsIC4uLmJvZHkgfSA9IHBhcmFtcztcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zYCwge1xuICAgICAgICAgICAgcXVlcnk6IHsgaW5jbHVkZSB9LFxuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICAgICAgc3RyZWFtOiBwYXJhbXMuc3RyZWFtID8/IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgcnVuLlxuICAgICAqL1xuICAgIHJldHJpZXZlKHRocmVhZElkLCBydW5JZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVucy8ke3J1bklkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTW9kaWZpZXMgYSBydW4uXG4gICAgICovXG4gICAgdXBkYXRlKHRocmVhZElkLCBydW5JZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnMvJHtydW5JZH1gLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsaXN0KHRocmVhZElkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh0aHJlYWRJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnNgLCBSdW5zUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbmNlbHMgYSBydW4gdGhhdCBpcyBgaW5fcHJvZ3Jlc3NgLlxuICAgICAqL1xuICAgIGNhbmNlbCh0aHJlYWRJZCwgcnVuSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zLyR7cnVuSWR9L2NhbmNlbGAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQSBoZWxwZXIgdG8gY3JlYXRlIGEgcnVuIGFuIHBvbGwgZm9yIGEgdGVybWluYWwgc3RhdGUuIE1vcmUgaW5mb3JtYXRpb24gb24gUnVuXG4gICAgICogbGlmZWN5Y2xlcyBjYW4gYmUgZm91bmQgaGVyZTpcbiAgICAgKiBodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL2hvdy1pdC13b3Jrcy9ydW5zLWFuZC1ydW4tc3RlcHNcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVBbmRQb2xsKHRocmVhZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1biA9IGF3YWl0IHRoaXMuY3JlYXRlKHRocmVhZElkLCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucG9sbCh0aHJlYWRJZCwgcnVuLmlkLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgUnVuIHN0cmVhbVxuICAgICAqXG4gICAgICogQGRlcHJlY2F0ZWQgdXNlIGBzdHJlYW1gIGluc3RlYWRcbiAgICAgKi9cbiAgICBjcmVhdGVBbmRTdHJlYW0odGhyZWFkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIEFzc2lzdGFudFN0cmVhbS5jcmVhdGVBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHRoaXMuX2NsaWVudC5iZXRhLnRocmVhZHMucnVucywgYm9keSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEEgaGVscGVyIHRvIHBvbGwgYSBydW4gc3RhdHVzIHVudGlsIGl0IHJlYWNoZXMgYSB0ZXJtaW5hbCBzdGF0ZS4gTW9yZVxuICAgICAqIGluZm9ybWF0aW9uIG9uIFJ1biBsaWZlY3ljbGVzIGNhbiBiZSBmb3VuZCBoZXJlOlxuICAgICAqIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvaG93LWl0LXdvcmtzL3J1bnMtYW5kLXJ1bi1zdGVwc1xuICAgICAqL1xuICAgIGFzeW5jIHBvbGwodGhyZWFkSWQsIHJ1bklkLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1Qb2xsLUhlbHBlcic6ICd0cnVlJyB9O1xuICAgICAgICBpZiAob3B0aW9ucz8ucG9sbEludGVydmFsTXMpIHtcbiAgICAgICAgICAgIGhlYWRlcnNbJ1gtU3RhaW5sZXNzLUN1c3RvbS1Qb2xsLUludGVydmFsJ10gPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogcnVuLCByZXNwb25zZSB9ID0gYXdhaXQgdGhpcy5yZXRyaWV2ZSh0aHJlYWRJZCwgcnVuSWQsIHtcbiAgICAgICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgLi4uaGVhZGVycyB9LFxuICAgICAgICAgICAgfSkud2l0aFJlc3BvbnNlKCk7XG4gICAgICAgICAgICBzd2l0Y2ggKHJ1bi5zdGF0dXMpIHtcbiAgICAgICAgICAgICAgICAvL0lmIHdlIGFyZSBpbiBhbnkgc29ydCBvZiBpbnRlcm1lZGlhdGUgc3RhdGUgd2UgcG9sbFxuICAgICAgICAgICAgICAgIGNhc2UgJ3F1ZXVlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2NhbmNlbGxpbmcnOlxuICAgICAgICAgICAgICAgICAgICBsZXQgc2xlZXBJbnRlcnZhbCA9IDUwMDA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zPy5wb2xsSW50ZXJ2YWxNcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2xlZXBJbnRlcnZhbCA9IG9wdGlvbnMucG9sbEludGVydmFsTXM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJJbnRlcnZhbCA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdvcGVuYWktcG9sbC1hZnRlci1tcycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhlYWRlckludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVySW50ZXJ2YWxNcyA9IHBhcnNlSW50KGhlYWRlckludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGhlYWRlckludGVydmFsTXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNsZWVwSW50ZXJ2YWwgPSBoZWFkZXJJbnRlcnZhbE1zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzbGVlcChzbGVlcEludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgLy9XZSByZXR1cm4gdGhlIHJ1biBpbiBhbnkgdGVybWluYWwgc3RhdGUuXG4gICAgICAgICAgICAgICAgY2FzZSAncmVxdWlyZXNfYWN0aW9uJzpcbiAgICAgICAgICAgICAgICBjYXNlICdpbmNvbXBsZXRlJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjYW5jZWxsZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbXBsZXRlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdleHBpcmVkJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ1bjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBSdW4gc3RyZWFtXG4gICAgICovXG4gICAgc3RyZWFtKHRocmVhZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBBc3Npc3RhbnRTdHJlYW0uY3JlYXRlQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCB0aGlzLl9jbGllbnQuYmV0YS50aHJlYWRzLnJ1bnMsIGJvZHksIG9wdGlvbnMpO1xuICAgIH1cbiAgICBzdWJtaXRUb29sT3V0cHV0cyh0aHJlYWRJZCwgcnVuSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zLyR7cnVuSWR9L3N1Ym1pdF90b29sX291dHB1dHNgLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgICAgICBzdHJlYW06IGJvZHkuc3RyZWFtID8/IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQSBoZWxwZXIgdG8gc3VibWl0IGEgdG9vbCBvdXRwdXQgdG8gYSBydW4gYW5kIHBvbGwgZm9yIGEgdGVybWluYWwgcnVuIHN0YXRlLlxuICAgICAqIE1vcmUgaW5mb3JtYXRpb24gb24gUnVuIGxpZmVjeWNsZXMgY2FuIGJlIGZvdW5kIGhlcmU6XG4gICAgICogaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy9ob3ctaXQtd29ya3MvcnVucy1hbmQtcnVuLXN0ZXBzXG4gICAgICovXG4gICAgYXN5bmMgc3VibWl0VG9vbE91dHB1dHNBbmRQb2xsKHRocmVhZElkLCBydW5JZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW4gPSBhd2FpdCB0aGlzLnN1Ym1pdFRvb2xPdXRwdXRzKHRocmVhZElkLCBydW5JZCwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnBvbGwodGhyZWFkSWQsIHJ1bi5pZCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFN1Ym1pdCB0aGUgdG9vbCBvdXRwdXRzIGZyb20gYSBwcmV2aW91cyBydW4gYW5kIHN0cmVhbSB0aGUgcnVuIHRvIGEgdGVybWluYWxcbiAgICAgKiBzdGF0ZS4gTW9yZSBpbmZvcm1hdGlvbiBvbiBSdW4gbGlmZWN5Y2xlcyBjYW4gYmUgZm91bmQgaGVyZTpcbiAgICAgKiBodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL2hvdy1pdC13b3Jrcy9ydW5zLWFuZC1ydW4tc3RlcHNcbiAgICAgKi9cbiAgICBzdWJtaXRUb29sT3V0cHV0c1N0cmVhbSh0aHJlYWRJZCwgcnVuSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIEFzc2lzdGFudFN0cmVhbS5jcmVhdGVUb29sQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5JZCwgdGhpcy5fY2xpZW50LmJldGEudGhyZWFkcy5ydW5zLCBib2R5LCBvcHRpb25zKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUnVuc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cblJ1bnMuUnVuc1BhZ2UgPSBSdW5zUGFnZTtcblJ1bnMuU3RlcHMgPSBTdGVwcztcblJ1bnMuUnVuU3RlcHNQYWdlID0gUnVuU3RlcHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cnVucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFN0ZXBzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIHJldHJpZXZlKHRocmVhZElkLCBydW5JZCwgc3RlcElkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0cmlldmUodGhyZWFkSWQsIHJ1bklkLCBzdGVwSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnMvJHtydW5JZH0vc3RlcHMvJHtzdGVwSWR9YCwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxpc3QodGhyZWFkSWQsIHJ1bklkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh0aHJlYWRJZCwgcnVuSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zLyR7cnVuSWR9L3N0ZXBzYCwgUnVuU3RlcHNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUnVuU3RlcHNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5TdGVwcy5SdW5TdGVwc1BhZ2UgPSBSdW5TdGVwc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdGVwcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQXNzaXN0YW50U3RyZWFtIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9Bc3Npc3RhbnRTdHJlYW0ubWpzXCI7XG5pbXBvcnQgKiBhcyBNZXNzYWdlc0FQSSBmcm9tIFwiLi9tZXNzYWdlcy5tanNcIjtcbmltcG9ydCB7IE1lc3NhZ2VzLCBNZXNzYWdlc1BhZ2UsIH0gZnJvbSBcIi4vbWVzc2FnZXMubWpzXCI7XG5pbXBvcnQgKiBhcyBSdW5zQVBJIGZyb20gXCIuL3J1bnMvcnVucy5tanNcIjtcbmltcG9ydCB7IFJ1bnMsIFJ1bnNQYWdlLCB9IGZyb20gXCIuL3J1bnMvcnVucy5tanNcIjtcbmV4cG9ydCBjbGFzcyBUaHJlYWRzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLnJ1bnMgPSBuZXcgUnVuc0FQSS5SdW5zKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBuZXcgTWVzc2FnZXNBUEkuTWVzc2FnZXModGhpcy5fY2xpZW50KTtcbiAgICB9XG4gICAgY3JlYXRlKGJvZHkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhib2R5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlKHt9LCBib2R5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy90aHJlYWRzJywge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgdGhyZWFkLlxuICAgICAqL1xuICAgIHJldHJpZXZlKHRocmVhZElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdGhyZWFkcy8ke3RocmVhZElkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTW9kaWZpZXMgYSB0aHJlYWQuXG4gICAgICovXG4gICAgdXBkYXRlKHRocmVhZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH1gLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSB0aHJlYWQuXG4gICAgICovXG4gICAgZGVsKHRocmVhZElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvdGhyZWFkcy8ke3RocmVhZElkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgY3JlYXRlQW5kUnVuKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvdGhyZWFkcy9ydW5zJywge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICAgICAgc3RyZWFtOiBib2R5LnN0cmVhbSA/PyBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEEgaGVscGVyIHRvIGNyZWF0ZSBhIHRocmVhZCwgc3RhcnQgYSBydW4gYW5kIHRoZW4gcG9sbCBmb3IgYSB0ZXJtaW5hbCBzdGF0ZS5cbiAgICAgKiBNb3JlIGluZm9ybWF0aW9uIG9uIFJ1biBsaWZlY3ljbGVzIGNhbiBiZSBmb3VuZCBoZXJlOlxuICAgICAqIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvaG93LWl0LXdvcmtzL3J1bnMtYW5kLXJ1bi1zdGVwc1xuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUFuZFJ1blBvbGwoYm9keSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW4gPSBhd2FpdCB0aGlzLmNyZWF0ZUFuZFJ1bihib2R5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucnVucy5wb2xsKHJ1bi50aHJlYWRfaWQsIHJ1bi5pZCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIHRocmVhZCBhbmQgc3RyZWFtIHRoZSBydW4gYmFja1xuICAgICAqL1xuICAgIGNyZWF0ZUFuZFJ1blN0cmVhbShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBBc3Npc3RhbnRTdHJlYW0uY3JlYXRlVGhyZWFkQXNzaXN0YW50U3RyZWFtKGJvZHksIHRoaXMuX2NsaWVudC5iZXRhLnRocmVhZHMsIG9wdGlvbnMpO1xuICAgIH1cbn1cblRocmVhZHMuUnVucyA9IFJ1bnM7XG5UaHJlYWRzLlJ1bnNQYWdlID0gUnVuc1BhZ2U7XG5UaHJlYWRzLk1lc3NhZ2VzID0gTWVzc2FnZXM7XG5UaHJlYWRzLk1lc3NhZ2VzUGFnZSA9IE1lc3NhZ2VzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXRocmVhZHMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IHNsZWVwIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBhbGxTZXR0bGVkV2l0aFRocm93IH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9VdGlsLm1qc1wiO1xuaW1wb3J0IHsgVmVjdG9yU3RvcmVGaWxlc1BhZ2UgfSBmcm9tIFwiLi9maWxlcy5tanNcIjtcbmV4cG9ydCBjbGFzcyBGaWxlQmF0Y2hlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSB2ZWN0b3Igc3RvcmUgZmlsZSBiYXRjaC5cbiAgICAgKi9cbiAgICBjcmVhdGUodmVjdG9yU3RvcmVJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZV9iYXRjaGVzYCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgdmVjdG9yIHN0b3JlIGZpbGUgYmF0Y2guXG4gICAgICovXG4gICAgcmV0cmlldmUodmVjdG9yU3RvcmVJZCwgYmF0Y2hJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlX2JhdGNoZXMvJHtiYXRjaElkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FuY2VsIGEgdmVjdG9yIHN0b3JlIGZpbGUgYmF0Y2guIFRoaXMgYXR0ZW1wdHMgdG8gY2FuY2VsIHRoZSBwcm9jZXNzaW5nIG9mXG4gICAgICogZmlsZXMgaW4gdGhpcyBiYXRjaCBhcyBzb29uIGFzIHBvc3NpYmxlLlxuICAgICAqL1xuICAgIGNhbmNlbCh2ZWN0b3JTdG9yZUlkLCBiYXRjaElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlX2JhdGNoZXMvJHtiYXRjaElkfS9jYW5jZWxgLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIHZlY3RvciBzdG9yZSBiYXRjaCBhbmQgcG9sbCB1bnRpbCBhbGwgZmlsZXMgaGF2ZSBiZWVuIHByb2Nlc3NlZC5cbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVBbmRQb2xsKHZlY3RvclN0b3JlSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSBhd2FpdCB0aGlzLmNyZWF0ZSh2ZWN0b3JTdG9yZUlkLCBib2R5KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucG9sbCh2ZWN0b3JTdG9yZUlkLCBiYXRjaC5pZCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGxpc3RGaWxlcyh2ZWN0b3JTdG9yZUlkLCBiYXRjaElkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdEZpbGVzKHZlY3RvclN0b3JlSWQsIGJhdGNoSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVfYmF0Y2hlcy8ke2JhdGNoSWR9L2ZpbGVzYCwgVmVjdG9yU3RvcmVGaWxlc1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMsIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0gfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdhaXQgZm9yIHRoZSBnaXZlbiBmaWxlIGJhdGNoIHRvIGJlIHByb2Nlc3NlZC5cbiAgICAgKlxuICAgICAqIE5vdGU6IHRoaXMgd2lsbCByZXR1cm4gZXZlbiBpZiBvbmUgb2YgdGhlIGZpbGVzIGZhaWxlZCB0byBwcm9jZXNzLCB5b3UgbmVlZCB0b1xuICAgICAqIGNoZWNrIGJhdGNoLmZpbGVfY291bnRzLmZhaWxlZF9jb3VudCB0byBoYW5kbGUgdGhpcyBjYXNlLlxuICAgICAqL1xuICAgIGFzeW5jIHBvbGwodmVjdG9yU3RvcmVJZCwgYmF0Y2hJZCwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBoZWFkZXJzID0geyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtUG9sbC1IZWxwZXInOiAndHJ1ZScgfTtcbiAgICAgICAgaWYgKG9wdGlvbnM/LnBvbGxJbnRlcnZhbE1zKSB7XG4gICAgICAgICAgICBoZWFkZXJzWydYLVN0YWlubGVzcy1DdXN0b20tUG9sbC1JbnRlcnZhbCddID0gb3B0aW9ucy5wb2xsSW50ZXJ2YWxNcy50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBjb25zdCB7IGRhdGE6IGJhdGNoLCByZXNwb25zZSB9ID0gYXdhaXQgdGhpcy5yZXRyaWV2ZSh2ZWN0b3JTdG9yZUlkLCBiYXRjaElkLCB7XG4gICAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICAgfSkud2l0aFJlc3BvbnNlKCk7XG4gICAgICAgICAgICBzd2l0Y2ggKGJhdGNoLnN0YXR1cykge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2luX3Byb2dyZXNzJzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNsZWVwSW50ZXJ2YWwgPSA1MDAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucz8ucG9sbEludGVydmFsTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNsZWVwSW50ZXJ2YWwgPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVySW50ZXJ2YWwgPSByZXNwb25zZS5oZWFkZXJzLmdldCgnb3BlbmFpLXBvbGwtYWZ0ZXItbXMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoZWFkZXJJbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlckludGVydmFsTXMgPSBwYXJzZUludChoZWFkZXJJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihoZWFkZXJJbnRlcnZhbE1zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbGVlcEludGVydmFsID0gaGVhZGVySW50ZXJ2YWxNcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAoc2xlZXBJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2ZhaWxlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY2FuY2VsbGVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wbGV0ZWQnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmF0Y2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogVXBsb2FkcyB0aGUgZ2l2ZW4gZmlsZXMgY29uY3VycmVudGx5IGFuZCB0aGVuIGNyZWF0ZXMgYSB2ZWN0b3Igc3RvcmUgZmlsZSBiYXRjaC5cbiAgICAgKlxuICAgICAqIFRoZSBjb25jdXJyZW5jeSBsaW1pdCBpcyBjb25maWd1cmFibGUgdXNpbmcgdGhlIGBtYXhDb25jdXJyZW5jeWAgcGFyYW1ldGVyLlxuICAgICAqL1xuICAgIGFzeW5jIHVwbG9hZEFuZFBvbGwodmVjdG9yU3RvcmVJZCwgeyBmaWxlcywgZmlsZUlkcyA9IFtdIH0sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGZpbGVzID09IG51bGwgfHwgZmlsZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gXFxgZmlsZXNcXGAgcHJvdmlkZWQgdG8gcHJvY2Vzcy4gSWYgeW91J3ZlIGFscmVhZHkgdXBsb2FkZWQgZmlsZXMgeW91IHNob3VsZCB1c2UgXFxgLmNyZWF0ZUFuZFBvbGwoKVxcYCBpbnN0ZWFkYCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29uZmlndXJlZENvbmN1cnJlbmN5ID0gb3B0aW9ucz8ubWF4Q29uY3VycmVuY3kgPz8gNTtcbiAgICAgICAgLy8gV2UgY2FwIHRoZSBudW1iZXIgb2Ygd29ya2VycyBhdCB0aGUgbnVtYmVyIG9mIGZpbGVzIChzbyB3ZSBkb24ndCBzdGFydCBhbnkgdW5uZWNlc3Nhcnkgd29ya2VycylcbiAgICAgICAgY29uc3QgY29uY3VycmVuY3lMaW1pdCA9IE1hdGgubWluKGNvbmZpZ3VyZWRDb25jdXJyZW5jeSwgZmlsZXMubGVuZ3RoKTtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gdGhpcy5fY2xpZW50O1xuICAgICAgICBjb25zdCBmaWxlSXRlcmF0b3IgPSBmaWxlcy52YWx1ZXMoKTtcbiAgICAgICAgY29uc3QgYWxsRmlsZUlkcyA9IFsuLi5maWxlSWRzXTtcbiAgICAgICAgLy8gVGhpcyBjb2RlIGlzIGJhc2VkIG9uIHRoaXMgZGVzaWduLiBUaGUgbGlicmFyaWVzIGRvbid0IGFjY29tbW9kYXRlIG91ciBlbnZpcm9ubWVudCBsaW1pdHMuXG4gICAgICAgIC8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQwNjM5NDMyL3doYXQtaXMtdGhlLWJlc3Qtd2F5LXRvLWxpbWl0LWNvbmN1cnJlbmN5LXdoZW4tdXNpbmctZXM2cy1wcm9taXNlLWFsbFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzRmlsZXMoaXRlcmF0b3IpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGl0ZW0gb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlT2JqID0gYXdhaXQgY2xpZW50LmZpbGVzLmNyZWF0ZSh7IGZpbGU6IGl0ZW0sIHB1cnBvc2U6ICdhc3Npc3RhbnRzJyB9LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBhbGxGaWxlSWRzLnB1c2goZmlsZU9iai5pZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gU3RhcnQgd29ya2VycyB0byBwcm9jZXNzIHJlc3VsdHNcbiAgICAgICAgY29uc3Qgd29ya2VycyA9IEFycmF5KGNvbmN1cnJlbmN5TGltaXQpLmZpbGwoZmlsZUl0ZXJhdG9yKS5tYXAocHJvY2Vzc0ZpbGVzKTtcbiAgICAgICAgLy8gV2FpdCBmb3IgYWxsIHByb2Nlc3NpbmcgdG8gY29tcGxldGUuXG4gICAgICAgIGF3YWl0IGFsbFNldHRsZWRXaXRoVGhyb3cod29ya2Vycyk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNyZWF0ZUFuZFBvbGwodmVjdG9yU3RvcmVJZCwge1xuICAgICAgICAgICAgZmlsZV9pZHM6IGFsbEZpbGVJZHMsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCB7IFZlY3RvclN0b3JlRmlsZXNQYWdlIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlLWJhdGNoZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IHNsZWVwLCBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgRmlsZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgdmVjdG9yIHN0b3JlIGZpbGUgYnkgYXR0YWNoaW5nIGFcbiAgICAgKiBbRmlsZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maWxlcykgdG8gYVxuICAgICAqIFt2ZWN0b3Igc3RvcmVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdmVjdG9yLXN0b3Jlcy9vYmplY3QpLlxuICAgICAqL1xuICAgIGNyZWF0ZSh2ZWN0b3JTdG9yZUlkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlc2AsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHZlY3RvciBzdG9yZSBmaWxlLlxuICAgICAqL1xuICAgIHJldHJpZXZlKHZlY3RvclN0b3JlSWQsIGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlcy8ke2ZpbGVJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxpc3QodmVjdG9yU3RvcmVJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3QodmVjdG9yU3RvcmVJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZXNgLCBWZWN0b3JTdG9yZUZpbGVzUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIHZlY3RvciBzdG9yZSBmaWxlLiBUaGlzIHdpbGwgcmVtb3ZlIHRoZSBmaWxlIGZyb20gdGhlIHZlY3RvciBzdG9yZSBidXRcbiAgICAgKiB0aGUgZmlsZSBpdHNlbGYgd2lsbCBub3QgYmUgZGVsZXRlZC4gVG8gZGVsZXRlIHRoZSBmaWxlLCB1c2UgdGhlXG4gICAgICogW2RlbGV0ZSBmaWxlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbGVzL2RlbGV0ZSlcbiAgICAgKiBlbmRwb2ludC5cbiAgICAgKi9cbiAgICBkZWwodmVjdG9yU3RvcmVJZCwgZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVzLyR7ZmlsZUlkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQXR0YWNoIGEgZmlsZSB0byB0aGUgZ2l2ZW4gdmVjdG9yIHN0b3JlIGFuZCB3YWl0IGZvciBpdCB0byBiZSBwcm9jZXNzZWQuXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlQW5kUG9sbCh2ZWN0b3JTdG9yZUlkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmNyZWF0ZSh2ZWN0b3JTdG9yZUlkLCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucG9sbCh2ZWN0b3JTdG9yZUlkLCBmaWxlLmlkLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogV2FpdCBmb3IgdGhlIHZlY3RvciBzdG9yZSBmaWxlIHRvIGZpbmlzaCBwcm9jZXNzaW5nLlxuICAgICAqXG4gICAgICogTm90ZTogdGhpcyB3aWxsIHJldHVybiBldmVuIGlmIHRoZSBmaWxlIGZhaWxlZCB0byBwcm9jZXNzLCB5b3UgbmVlZCB0byBjaGVja1xuICAgICAqIGZpbGUubGFzdF9lcnJvciBhbmQgZmlsZS5zdGF0dXMgdG8gaGFuZGxlIHRoZXNlIGNhc2VzXG4gICAgICovXG4gICAgYXN5bmMgcG9sbCh2ZWN0b3JTdG9yZUlkLCBmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLVBvbGwtSGVscGVyJzogJ3RydWUnIH07XG4gICAgICAgIGlmIChvcHRpb25zPy5wb2xsSW50ZXJ2YWxNcykge1xuICAgICAgICAgICAgaGVhZGVyc1snWC1TdGFpbmxlc3MtQ3VzdG9tLVBvbGwtSW50ZXJ2YWwnXSA9IG9wdGlvbnMucG9sbEludGVydmFsTXMudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZVJlc3BvbnNlID0gYXdhaXQgdGhpcy5yZXRyaWV2ZSh2ZWN0b3JTdG9yZUlkLCBmaWxlSWQsIHtcbiAgICAgICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICB9KS53aXRoUmVzcG9uc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBmaWxlUmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIHN3aXRjaCAoZmlsZS5zdGF0dXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdpbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICAgICAgICAgIGxldCBzbGVlcEludGVydmFsID0gNTAwMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnM/LnBvbGxJbnRlcnZhbE1zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzbGVlcEludGVydmFsID0gb3B0aW9ucy5wb2xsSW50ZXJ2YWxNcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlckludGVydmFsID0gZmlsZVJlc3BvbnNlLnJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdvcGVuYWktcG9sbC1hZnRlci1tcycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhlYWRlckludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVySW50ZXJ2YWxNcyA9IHBhcnNlSW50KGhlYWRlckludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGhlYWRlckludGVydmFsTXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNsZWVwSW50ZXJ2YWwgPSBoZWFkZXJJbnRlcnZhbE1zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzbGVlcChzbGVlcEludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wbGV0ZWQnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBVcGxvYWQgYSBmaWxlIHRvIHRoZSBgZmlsZXNgIEFQSSBhbmQgdGhlbiBhdHRhY2ggaXQgdG8gdGhlIGdpdmVuIHZlY3RvciBzdG9yZS5cbiAgICAgKlxuICAgICAqIE5vdGUgdGhlIGZpbGUgd2lsbCBiZSBhc3luY2hyb25vdXNseSBwcm9jZXNzZWQgKHlvdSBjYW4gdXNlIHRoZSBhbHRlcm5hdGl2ZVxuICAgICAqIHBvbGxpbmcgaGVscGVyIG1ldGhvZCB0byB3YWl0IGZvciBwcm9jZXNzaW5nIHRvIGNvbXBsZXRlKS5cbiAgICAgKi9cbiAgICBhc3luYyB1cGxvYWQodmVjdG9yU3RvcmVJZCwgZmlsZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IHRoaXMuX2NsaWVudC5maWxlcy5jcmVhdGUoeyBmaWxlOiBmaWxlLCBwdXJwb3NlOiAnYXNzaXN0YW50cycgfSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZSh2ZWN0b3JTdG9yZUlkLCB7IGZpbGVfaWQ6IGZpbGVJbmZvLmlkIH0sIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBZGQgYSBmaWxlIHRvIGEgdmVjdG9yIHN0b3JlIGFuZCBwb2xsIHVudGlsIHByb2Nlc3NpbmcgaXMgY29tcGxldGUuXG4gICAgICovXG4gICAgYXN5bmMgdXBsb2FkQW5kUG9sbCh2ZWN0b3JTdG9yZUlkLCBmaWxlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGZpbGVJbmZvID0gYXdhaXQgdGhpcy51cGxvYWQodmVjdG9yU3RvcmVJZCwgZmlsZSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnBvbGwodmVjdG9yU3RvcmVJZCwgZmlsZUluZm8uaWQsIG9wdGlvbnMpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBWZWN0b3JTdG9yZUZpbGVzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuRmlsZXMuVmVjdG9yU3RvcmVGaWxlc1BhZ2UgPSBWZWN0b3JTdG9yZUZpbGVzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGVzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgKiBhcyBGaWxlQmF0Y2hlc0FQSSBmcm9tIFwiLi9maWxlLWJhdGNoZXMubWpzXCI7XG5pbXBvcnQgeyBGaWxlQmF0Y2hlcywgfSBmcm9tIFwiLi9maWxlLWJhdGNoZXMubWpzXCI7XG5pbXBvcnQgKiBhcyBGaWxlc0FQSSBmcm9tIFwiLi9maWxlcy5tanNcIjtcbmltcG9ydCB7IEZpbGVzLCBWZWN0b3JTdG9yZUZpbGVzUGFnZSwgfSBmcm9tIFwiLi9maWxlcy5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBWZWN0b3JTdG9yZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuZmlsZXMgPSBuZXcgRmlsZXNBUEkuRmlsZXModGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy5maWxlQmF0Y2hlcyA9IG5ldyBGaWxlQmF0Y2hlc0FQSS5GaWxlQmF0Y2hlcyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSB2ZWN0b3Igc3RvcmUuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvdmVjdG9yX3N0b3JlcycsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHZlY3RvciBzdG9yZS5cbiAgICAgKi9cbiAgICByZXRyaWV2ZSh2ZWN0b3JTdG9yZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBNb2RpZmllcyBhIHZlY3RvciBzdG9yZS5cbiAgICAgKi9cbiAgICB1cGRhdGUodmVjdG9yU3RvcmVJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH1gLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsaXN0KHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvdmVjdG9yX3N0b3JlcycsIFZlY3RvclN0b3Jlc1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSB2ZWN0b3Igc3RvcmUuXG4gICAgICovXG4gICAgZGVsKHZlY3RvclN0b3JlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFZlY3RvclN0b3Jlc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cblZlY3RvclN0b3Jlcy5WZWN0b3JTdG9yZXNQYWdlID0gVmVjdG9yU3RvcmVzUGFnZTtcblZlY3RvclN0b3Jlcy5GaWxlcyA9IEZpbGVzO1xuVmVjdG9yU3RvcmVzLlZlY3RvclN0b3JlRmlsZXNQYWdlID0gVmVjdG9yU3RvcmVGaWxlc1BhZ2U7XG5WZWN0b3JTdG9yZXMuRmlsZUJhdGNoZXMgPSBGaWxlQmF0Y2hlcztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXZlY3Rvci1zdG9yZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIENvbXBsZXRpb25zQVBJIGZyb20gXCIuL2NvbXBsZXRpb25zL2NvbXBsZXRpb25zLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25zUGFnZSwgQ29tcGxldGlvbnMsIH0gZnJvbSBcIi4vY29tcGxldGlvbnMvY29tcGxldGlvbnMubWpzXCI7XG5leHBvcnQgY2xhc3MgQ2hhdCBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5jb21wbGV0aW9ucyA9IG5ldyBDb21wbGV0aW9uc0FQSS5Db21wbGV0aW9ucyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbn1cbkNoYXQuQ29tcGxldGlvbnMgPSBDb21wbGV0aW9ucztcbkNoYXQuQ2hhdENvbXBsZXRpb25zUGFnZSA9IENoYXRDb21wbGV0aW9uc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jaGF0Lm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgKiBhcyBNZXNzYWdlc0FQSSBmcm9tIFwiLi9tZXNzYWdlcy5tanNcIjtcbmltcG9ydCB7IE1lc3NhZ2VzIH0gZnJvbSBcIi4vbWVzc2FnZXMubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29tcGxldGlvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBuZXcgTWVzc2FnZXNBUEkuTWVzc2FnZXModGhpcy5fY2xpZW50KTtcbiAgICB9XG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvY2hhdC9jb21wbGV0aW9ucycsIHsgYm9keSwgLi4ub3B0aW9ucywgc3RyZWFtOiBib2R5LnN0cmVhbSA/PyBmYWxzZSB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2V0IGEgc3RvcmVkIGNoYXQgY29tcGxldGlvbi4gT25seSBjaGF0IGNvbXBsZXRpb25zIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWQgd2l0aFxuICAgICAqIHRoZSBgc3RvcmVgIHBhcmFtZXRlciBzZXQgdG8gYHRydWVgIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAgICovXG4gICAgcmV0cmlldmUoY29tcGxldGlvbklkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvY2hhdC9jb21wbGV0aW9ucy8ke2NvbXBsZXRpb25JZH1gLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTW9kaWZ5IGEgc3RvcmVkIGNoYXQgY29tcGxldGlvbi4gT25seSBjaGF0IGNvbXBsZXRpb25zIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWRcbiAgICAgKiB3aXRoIHRoZSBgc3RvcmVgIHBhcmFtZXRlciBzZXQgdG8gYHRydWVgIGNhbiBiZSBtb2RpZmllZC4gQ3VycmVudGx5LCB0aGUgb25seVxuICAgICAqIHN1cHBvcnRlZCBtb2RpZmljYXRpb24gaXMgdG8gdXBkYXRlIHRoZSBgbWV0YWRhdGFgIGZpZWxkLlxuICAgICAqL1xuICAgIHVwZGF0ZShjb21wbGV0aW9uSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvY2hhdC9jb21wbGV0aW9ucy8ke2NvbXBsZXRpb25JZH1gLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIGxpc3QocXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3Qoe30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy9jaGF0L2NvbXBsZXRpb25zJywgQ2hhdENvbXBsZXRpb25zUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGEgc3RvcmVkIGNoYXQgY29tcGxldGlvbi4gT25seSBjaGF0IGNvbXBsZXRpb25zIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWRcbiAgICAgKiB3aXRoIHRoZSBgc3RvcmVgIHBhcmFtZXRlciBzZXQgdG8gYHRydWVgIGNhbiBiZSBkZWxldGVkLlxuICAgICAqL1xuICAgIGRlbChjb21wbGV0aW9uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC9jaGF0L2NvbXBsZXRpb25zLyR7Y29tcGxldGlvbklkfWAsIG9wdGlvbnMpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDaGF0Q29tcGxldGlvbnNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5leHBvcnQgY2xhc3MgQ2hhdENvbXBsZXRpb25TdG9yZU1lc3NhZ2VzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuQ29tcGxldGlvbnMuQ2hhdENvbXBsZXRpb25zUGFnZSA9IENoYXRDb21wbGV0aW9uc1BhZ2U7XG5Db21wbGV0aW9ucy5NZXNzYWdlcyA9IE1lc3NhZ2VzO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29tcGxldGlvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IENoYXRDb21wbGV0aW9uU3RvcmVNZXNzYWdlc1BhZ2UgfSBmcm9tIFwiLi9jb21wbGV0aW9ucy5tanNcIjtcbmV4cG9ydCBjbGFzcyBNZXNzYWdlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBsaXN0KGNvbXBsZXRpb25JZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3QoY29tcGxldGlvbklkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL2NoYXQvY29tcGxldGlvbnMvJHtjb21wbGV0aW9uSWR9L21lc3NhZ2VzYCwgQ2hhdENvbXBsZXRpb25TdG9yZU1lc3NhZ2VzUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG59XG5leHBvcnQgeyBDaGF0Q29tcGxldGlvblN0b3JlTWVzc2FnZXNQYWdlIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tZXNzYWdlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2NvbXBsZXRpb25zJywgeyBib2R5LCAuLi5vcHRpb25zLCBzdHJlYW06IGJvZHkuc3RyZWFtID8/IGZhbHNlIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbXBsZXRpb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5leHBvcnQgY2xhc3MgRW1iZWRkaW5ncyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGVtYmVkZGluZyB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSBpbnB1dCB0ZXh0LlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2VtYmVkZGluZ3MnLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZW1iZWRkaW5ncy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgc2xlZXAgfSBmcm9tIFwiLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3IgfSBmcm9tIFwiLi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEZpbGVzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIFVwbG9hZCBhIGZpbGUgdGhhdCBjYW4gYmUgdXNlZCBhY3Jvc3MgdmFyaW91cyBlbmRwb2ludHMuIEluZGl2aWR1YWwgZmlsZXMgY2FuIGJlXG4gICAgICogdXAgdG8gNTEyIE1CLCBhbmQgdGhlIHNpemUgb2YgYWxsIGZpbGVzIHVwbG9hZGVkIGJ5IG9uZSBvcmdhbml6YXRpb24gY2FuIGJlIHVwXG4gICAgICogdG8gMTAwIEdCLlxuICAgICAqXG4gICAgICogVGhlIEFzc2lzdGFudHMgQVBJIHN1cHBvcnRzIGZpbGVzIHVwIHRvIDIgbWlsbGlvbiB0b2tlbnMgYW5kIG9mIHNwZWNpZmljIGZpbGVcbiAgICAgKiB0eXBlcy4gU2VlIHRoZVxuICAgICAqIFtBc3Npc3RhbnRzIFRvb2xzIGd1aWRlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL3Rvb2xzKSBmb3JcbiAgICAgKiBkZXRhaWxzLlxuICAgICAqXG4gICAgICogVGhlIEZpbmUtdHVuaW5nIEFQSSBvbmx5IHN1cHBvcnRzIGAuanNvbmxgIGZpbGVzLiBUaGUgaW5wdXQgYWxzbyBoYXMgY2VydGFpblxuICAgICAqIHJlcXVpcmVkIGZvcm1hdHMgZm9yIGZpbmUtdHVuaW5nXG4gICAgICogW2NoYXRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmluZS10dW5pbmcvY2hhdC1pbnB1dCkgb3JcbiAgICAgKiBbY29tcGxldGlvbnNdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmluZS10dW5pbmcvY29tcGxldGlvbnMtaW5wdXQpXG4gICAgICogbW9kZWxzLlxuICAgICAqXG4gICAgICogVGhlIEJhdGNoIEFQSSBvbmx5IHN1cHBvcnRzIGAuanNvbmxgIGZpbGVzIHVwIHRvIDIwMCBNQiBpbiBzaXplLiBUaGUgaW5wdXQgYWxzb1xuICAgICAqIGhhcyBhIHNwZWNpZmljIHJlcXVpcmVkXG4gICAgICogW2Zvcm1hdF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9iYXRjaC9yZXF1ZXN0LWlucHV0KS5cbiAgICAgKlxuICAgICAqIFBsZWFzZSBbY29udGFjdCB1c10oaHR0cHM6Ly9oZWxwLm9wZW5haS5jb20vKSBpZiB5b3UgbmVlZCB0byBpbmNyZWFzZSB0aGVzZVxuICAgICAqIHN0b3JhZ2UgbGltaXRzLlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2ZpbGVzJywgQ29yZS5tdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMoeyBib2R5LCAuLi5vcHRpb25zIH0pKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCBhIHNwZWNpZmljIGZpbGUuXG4gICAgICovXG4gICAgcmV0cmlldmUoZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvZmlsZXMvJHtmaWxlSWR9YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGxpc3QocXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3Qoe30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy9maWxlcycsIEZpbGVPYmplY3RzUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGEgZmlsZS5cbiAgICAgKi9cbiAgICBkZWwoZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvZmlsZXMvJHtmaWxlSWR9YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGNvbnRlbnRzIG9mIHRoZSBzcGVjaWZpZWQgZmlsZS5cbiAgICAgKi9cbiAgICBjb250ZW50KGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2ZpbGVzLyR7ZmlsZUlkfS9jb250ZW50YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgQWNjZXB0OiAnYXBwbGljYXRpb24vYmluYXJ5JywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICAgICAgX19iaW5hcnlSZXNwb25zZTogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGNvbnRlbnRzIG9mIHRoZSBzcGVjaWZpZWQgZmlsZS5cbiAgICAgKlxuICAgICAqIEBkZXByZWNhdGVkIFRoZSBgLmNvbnRlbnQoKWAgbWV0aG9kIHNob3VsZCBiZSB1c2VkIGluc3RlYWRcbiAgICAgKi9cbiAgICByZXRyaWV2ZUNvbnRlbnQoZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvZmlsZXMvJHtmaWxlSWR9L2NvbnRlbnRgLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogV2FpdHMgZm9yIHRoZSBnaXZlbiBmaWxlIHRvIGJlIHByb2Nlc3NlZCwgZGVmYXVsdCB0aW1lb3V0IGlzIDMwIG1pbnMuXG4gICAgICovXG4gICAgYXN5bmMgd2FpdEZvclByb2Nlc3NpbmcoaWQsIHsgcG9sbEludGVydmFsID0gNTAwMCwgbWF4V2FpdCA9IDMwICogNjAgKiAxMDAwIH0gPSB7fSkge1xuICAgICAgICBjb25zdCBURVJNSU5BTF9TVEFURVMgPSBuZXcgU2V0KFsncHJvY2Vzc2VkJywgJ2Vycm9yJywgJ2RlbGV0ZWQnXSk7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgbGV0IGZpbGUgPSBhd2FpdCB0aGlzLnJldHJpZXZlKGlkKTtcbiAgICAgICAgd2hpbGUgKCFmaWxlLnN0YXR1cyB8fCAhVEVSTUlOQUxfU1RBVEVTLmhhcyhmaWxlLnN0YXR1cykpIHtcbiAgICAgICAgICAgIGF3YWl0IHNsZWVwKHBvbGxJbnRlcnZhbCk7XG4gICAgICAgICAgICBmaWxlID0gYXdhaXQgdGhpcy5yZXRyaWV2ZShpZCk7XG4gICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0ID4gbWF4V2FpdCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBBUElDb25uZWN0aW9uVGltZW91dEVycm9yKHtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEdpdmluZyB1cCBvbiB3YWl0aW5nIGZvciBmaWxlICR7aWR9IHRvIGZpbmlzaCBwcm9jZXNzaW5nIGFmdGVyICR7bWF4V2FpdH0gbWlsbGlzZWNvbmRzLmAsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEZpbGVPYmplY3RzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuRmlsZXMuRmlsZU9iamVjdHNQYWdlID0gRmlsZU9iamVjdHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIEpvYnNBUEkgZnJvbSBcIi4vam9icy9qb2JzLm1qc1wiO1xuaW1wb3J0IHsgRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2UsIEZpbmVUdW5pbmdKb2JzUGFnZSwgSm9icywgfSBmcm9tIFwiLi9qb2JzL2pvYnMubWpzXCI7XG5leHBvcnQgY2xhc3MgRmluZVR1bmluZyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5qb2JzID0gbmV3IEpvYnNBUEkuSm9icyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbn1cbkZpbmVUdW5pbmcuSm9icyA9IEpvYnM7XG5GaW5lVHVuaW5nLkZpbmVUdW5pbmdKb2JzUGFnZSA9IEZpbmVUdW5pbmdKb2JzUGFnZTtcbkZpbmVUdW5pbmcuRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2UgPSBGaW5lVHVuaW5nSm9iRXZlbnRzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbmUtdHVuaW5nLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgQ2hlY2twb2ludHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgbGlzdChmaW5lVHVuaW5nSm9iSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KGZpbmVUdW5pbmdKb2JJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC9maW5lX3R1bmluZy9qb2JzLyR7ZmluZVR1bmluZ0pvYklkfS9jaGVja3BvaW50c2AsIEZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkNoZWNrcG9pbnRzLkZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2UgPSBGaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hlY2twb2ludHMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCAqIGFzIENoZWNrcG9pbnRzQVBJIGZyb20gXCIuL2NoZWNrcG9pbnRzLm1qc1wiO1xuaW1wb3J0IHsgQ2hlY2twb2ludHMsIEZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2UsIH0gZnJvbSBcIi4vY2hlY2twb2ludHMubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgSm9icyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5jaGVja3BvaW50cyA9IG5ldyBDaGVja3BvaW50c0FQSS5DaGVja3BvaW50cyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZmluZS10dW5pbmcgam9iIHdoaWNoIGJlZ2lucyB0aGUgcHJvY2VzcyBvZiBjcmVhdGluZyBhIG5ldyBtb2RlbCBmcm9tXG4gICAgICogYSBnaXZlbiBkYXRhc2V0LlxuICAgICAqXG4gICAgICogUmVzcG9uc2UgaW5jbHVkZXMgZGV0YWlscyBvZiB0aGUgZW5xdWV1ZWQgam9iIGluY2x1ZGluZyBqb2Igc3RhdHVzIGFuZCB0aGUgbmFtZVxuICAgICAqIG9mIHRoZSBmaW5lLXR1bmVkIG1vZGVscyBvbmNlIGNvbXBsZXRlLlxuICAgICAqXG4gICAgICogW0xlYXJuIG1vcmUgYWJvdXQgZmluZS10dW5pbmddKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2d1aWRlcy9maW5lLXR1bmluZylcbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9maW5lX3R1bmluZy9qb2JzJywgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZXQgaW5mbyBhYm91dCBhIGZpbmUtdHVuaW5nIGpvYi5cbiAgICAgKlxuICAgICAqIFtMZWFybiBtb3JlIGFib3V0IGZpbmUtdHVuaW5nXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9ndWlkZXMvZmluZS10dW5pbmcpXG4gICAgICovXG4gICAgcmV0cmlldmUoZmluZVR1bmluZ0pvYklkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvZmluZV90dW5pbmcvam9icy8ke2ZpbmVUdW5pbmdKb2JJZH1gLCBvcHRpb25zKTtcbiAgICB9XG4gICAgbGlzdChxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL2ZpbmVfdHVuaW5nL2pvYnMnLCBGaW5lVHVuaW5nSm9ic1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEltbWVkaWF0ZWx5IGNhbmNlbCBhIGZpbmUtdHVuZSBqb2IuXG4gICAgICovXG4gICAgY2FuY2VsKGZpbmVUdW5pbmdKb2JJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC9maW5lX3R1bmluZy9qb2JzLyR7ZmluZVR1bmluZ0pvYklkfS9jYW5jZWxgLCBvcHRpb25zKTtcbiAgICB9XG4gICAgbGlzdEV2ZW50cyhmaW5lVHVuaW5nSm9iSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0RXZlbnRzKGZpbmVUdW5pbmdKb2JJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC9maW5lX3R1bmluZy9qb2JzLyR7ZmluZVR1bmluZ0pvYklkfS9ldmVudHNgLCBGaW5lVHVuaW5nSm9iRXZlbnRzUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgRmluZVR1bmluZ0pvYnNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5leHBvcnQgY2xhc3MgRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkpvYnMuRmluZVR1bmluZ0pvYnNQYWdlID0gRmluZVR1bmluZ0pvYnNQYWdlO1xuSm9icy5GaW5lVHVuaW5nSm9iRXZlbnRzUGFnZSA9IEZpbmVUdW5pbmdKb2JFdmVudHNQYWdlO1xuSm9icy5DaGVja3BvaW50cyA9IENoZWNrcG9pbnRzO1xuSm9icy5GaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlID0gRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWpvYnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4uL2NvcmUubWpzXCI7XG5leHBvcnQgY2xhc3MgSW1hZ2VzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSB2YXJpYXRpb24gb2YgYSBnaXZlbiBpbWFnZS5cbiAgICAgKi9cbiAgICBjcmVhdGVWYXJpYXRpb24oYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9pbWFnZXMvdmFyaWF0aW9ucycsIENvcmUubXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zKHsgYm9keSwgLi4ub3B0aW9ucyB9KSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gZWRpdGVkIG9yIGV4dGVuZGVkIGltYWdlIGdpdmVuIGFuIG9yaWdpbmFsIGltYWdlIGFuZCBhIHByb21wdC5cbiAgICAgKi9cbiAgICBlZGl0KGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvaW1hZ2VzL2VkaXRzJywgQ29yZS5tdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMoeyBib2R5LCAuLi5vcHRpb25zIH0pKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBpbWFnZSBnaXZlbiBhIHByb21wdC5cbiAgICAgKi9cbiAgICBnZW5lcmF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2ltYWdlcy9nZW5lcmF0aW9ucycsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbWFnZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IFBhZ2UgfSBmcm9tIFwiLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBNb2RlbHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgbW9kZWwgaW5zdGFuY2UsIHByb3ZpZGluZyBiYXNpYyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbW9kZWwgc3VjaCBhc1xuICAgICAqIHRoZSBvd25lciBhbmQgcGVybWlzc2lvbmluZy5cbiAgICAgKi9cbiAgICByZXRyaWV2ZShtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL21vZGVscy8ke21vZGVsfWAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMaXN0cyB0aGUgY3VycmVudGx5IGF2YWlsYWJsZSBtb2RlbHMsIGFuZCBwcm92aWRlcyBiYXNpYyBpbmZvcm1hdGlvbiBhYm91dCBlYWNoXG4gICAgICogb25lIHN1Y2ggYXMgdGhlIG93bmVyIGFuZCBhdmFpbGFiaWxpdHkuXG4gICAgICovXG4gICAgbGlzdChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL21vZGVscycsIE1vZGVsc1BhZ2UsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSBmaW5lLXR1bmVkIG1vZGVsLiBZb3UgbXVzdCBoYXZlIHRoZSBPd25lciByb2xlIGluIHlvdXIgb3JnYW5pemF0aW9uIHRvXG4gICAgICogZGVsZXRlIGEgbW9kZWwuXG4gICAgICovXG4gICAgZGVsKG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvbW9kZWxzLyR7bW9kZWx9YCwgb3B0aW9ucyk7XG4gICAgfVxufVxuLyoqXG4gKiBOb3RlOiBubyBwYWdpbmF0aW9uIGFjdHVhbGx5IG9jY3VycyB5ZXQsIHRoaXMgaXMgZm9yIGZvcndhcmRzLWNvbXBhdGliaWxpdHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2RlbHNQYWdlIGV4dGVuZHMgUGFnZSB7XG59XG5Nb2RlbHMuTW9kZWxzUGFnZSA9IE1vZGVsc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tb2RlbHMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBNb2RlcmF0aW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDbGFzc2lmaWVzIGlmIHRleHQgYW5kL29yIGltYWdlIGlucHV0cyBhcmUgcG90ZW50aWFsbHkgaGFybWZ1bC4gTGVhcm4gbW9yZSBpblxuICAgICAqIHRoZSBbbW9kZXJhdGlvbiBndWlkZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvZ3VpZGVzL21vZGVyYXRpb24pLlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL21vZGVyYXRpb25zJywgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1vZGVyYXRpb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuLi8uLi9jb3JlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFBhcnRzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIEFkZHMgYVxuICAgICAqIFtQYXJ0XShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3VwbG9hZHMvcGFydC1vYmplY3QpIHRvIGFuXG4gICAgICogW1VwbG9hZF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS91cGxvYWRzL29iamVjdCkgb2JqZWN0LlxuICAgICAqIEEgUGFydCByZXByZXNlbnRzIGEgY2h1bmsgb2YgYnl0ZXMgZnJvbSB0aGUgZmlsZSB5b3UgYXJlIHRyeWluZyB0byB1cGxvYWQuXG4gICAgICpcbiAgICAgKiBFYWNoIFBhcnQgY2FuIGJlIGF0IG1vc3QgNjQgTUIsIGFuZCB5b3UgY2FuIGFkZCBQYXJ0cyB1bnRpbCB5b3UgaGl0IHRoZSBVcGxvYWRcbiAgICAgKiBtYXhpbXVtIG9mIDggR0IuXG4gICAgICpcbiAgICAgKiBJdCBpcyBwb3NzaWJsZSB0byBhZGQgbXVsdGlwbGUgUGFydHMgaW4gcGFyYWxsZWwuIFlvdSBjYW4gZGVjaWRlIHRoZSBpbnRlbmRlZFxuICAgICAqIG9yZGVyIG9mIHRoZSBQYXJ0cyB3aGVuIHlvdVxuICAgICAqIFtjb21wbGV0ZSB0aGUgVXBsb2FkXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3VwbG9hZHMvY29tcGxldGUpLlxuICAgICAqL1xuICAgIGNyZWF0ZSh1cGxvYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC91cGxvYWRzLyR7dXBsb2FkSWR9L3BhcnRzYCwgQ29yZS5tdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMoeyBib2R5LCAuLi5vcHRpb25zIH0pKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYXJ0cy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgUGFydHNBUEkgZnJvbSBcIi4vcGFydHMubWpzXCI7XG5pbXBvcnQgeyBQYXJ0cyB9IGZyb20gXCIuL3BhcnRzLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFVwbG9hZHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMucGFydHMgPSBuZXcgUGFydHNBUEkuUGFydHModGhpcy5fY2xpZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBpbnRlcm1lZGlhdGVcbiAgICAgKiBbVXBsb2FkXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3VwbG9hZHMvb2JqZWN0KSBvYmplY3RcbiAgICAgKiB0aGF0IHlvdSBjYW4gYWRkXG4gICAgICogW1BhcnRzXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3VwbG9hZHMvcGFydC1vYmplY3QpIHRvLlxuICAgICAqIEN1cnJlbnRseSwgYW4gVXBsb2FkIGNhbiBhY2NlcHQgYXQgbW9zdCA4IEdCIGluIHRvdGFsIGFuZCBleHBpcmVzIGFmdGVyIGFuIGhvdXJcbiAgICAgKiBhZnRlciB5b3UgY3JlYXRlIGl0LlxuICAgICAqXG4gICAgICogT25jZSB5b3UgY29tcGxldGUgdGhlIFVwbG9hZCwgd2Ugd2lsbCBjcmVhdGUgYVxuICAgICAqIFtGaWxlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbGVzL29iamVjdCkgb2JqZWN0IHRoYXRcbiAgICAgKiBjb250YWlucyBhbGwgdGhlIHBhcnRzIHlvdSB1cGxvYWRlZC4gVGhpcyBGaWxlIGlzIHVzYWJsZSBpbiB0aGUgcmVzdCBvZiBvdXJcbiAgICAgKiBwbGF0Zm9ybSBhcyBhIHJlZ3VsYXIgRmlsZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBGb3IgY2VydGFpbiBgcHVycG9zZWBzLCB0aGUgY29ycmVjdCBgbWltZV90eXBlYCBtdXN0IGJlIHNwZWNpZmllZC4gUGxlYXNlIHJlZmVyXG4gICAgICogdG8gZG9jdW1lbnRhdGlvbiBmb3IgdGhlIHN1cHBvcnRlZCBNSU1FIHR5cGVzIGZvciB5b3VyIHVzZSBjYXNlOlxuICAgICAqXG4gICAgICogLSBbQXNzaXN0YW50c10oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy90b29scy9maWxlLXNlYXJjaCNzdXBwb3J0ZWQtZmlsZXMpXG4gICAgICpcbiAgICAgKiBGb3IgZ3VpZGFuY2Ugb24gdGhlIHByb3BlciBmaWxlbmFtZSBleHRlbnNpb25zIGZvciBlYWNoIHB1cnBvc2UsIHBsZWFzZSBmb2xsb3dcbiAgICAgKiB0aGUgZG9jdW1lbnRhdGlvbiBvblxuICAgICAqIFtjcmVhdGluZyBhIEZpbGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmlsZXMvY3JlYXRlKS5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy91cGxvYWRzJywgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYW5jZWxzIHRoZSBVcGxvYWQuIE5vIFBhcnRzIG1heSBiZSBhZGRlZCBhZnRlciBhbiBVcGxvYWQgaXMgY2FuY2VsbGVkLlxuICAgICAqL1xuICAgIGNhbmNlbCh1cGxvYWRJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC91cGxvYWRzLyR7dXBsb2FkSWR9L2NhbmNlbGAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDb21wbGV0ZXMgdGhlXG4gICAgICogW1VwbG9hZF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS91cGxvYWRzL29iamVjdCkuXG4gICAgICpcbiAgICAgKiBXaXRoaW4gdGhlIHJldHVybmVkIFVwbG9hZCBvYmplY3QsIHRoZXJlIGlzIGEgbmVzdGVkXG4gICAgICogW0ZpbGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmlsZXMvb2JqZWN0KSBvYmplY3QgdGhhdFxuICAgICAqIGlzIHJlYWR5IHRvIHVzZSBpbiB0aGUgcmVzdCBvZiB0aGUgcGxhdGZvcm0uXG4gICAgICpcbiAgICAgKiBZb3UgY2FuIHNwZWNpZnkgdGhlIG9yZGVyIG9mIHRoZSBQYXJ0cyBieSBwYXNzaW5nIGluIGFuIG9yZGVyZWQgbGlzdCBvZiB0aGUgUGFydFxuICAgICAqIElEcy5cbiAgICAgKlxuICAgICAqIFRoZSBudW1iZXIgb2YgYnl0ZXMgdXBsb2FkZWQgdXBvbiBjb21wbGV0aW9uIG11c3QgbWF0Y2ggdGhlIG51bWJlciBvZiBieXRlc1xuICAgICAqIGluaXRpYWxseSBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyB0aGUgVXBsb2FkIG9iamVjdC4gTm8gUGFydHMgbWF5IGJlIGFkZGVkIGFmdGVyXG4gICAgICogYW4gVXBsb2FkIGlzIGNvbXBsZXRlZC5cbiAgICAgKi9cbiAgICBjb21wbGV0ZSh1cGxvYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC91cGxvYWRzLyR7dXBsb2FkSWR9L2NvbXBsZXRlYCwgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbn1cblVwbG9hZHMuUGFydHMgPSBQYXJ0cztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXVwbG9hZHMubWpzLm1hcCIsImltcG9ydCB7IFJlYWRhYmxlU3RyZWFtIH0gZnJvbSBcIi4vX3NoaW1zL2luZGV4Lm1qc1wiO1xuaW1wb3J0IHsgT3BlbkFJRXJyb3IgfSBmcm9tIFwiLi9lcnJvci5tanNcIjtcbmltcG9ydCB7IExpbmVEZWNvZGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvZGVjb2RlcnMvbGluZS5tanNcIjtcbmltcG9ydCB7IFJlYWRhYmxlU3RyZWFtVG9Bc3luY0l0ZXJhYmxlIH0gZnJvbSBcIi4vaW50ZXJuYWwvc3RyZWFtLXV0aWxzLm1qc1wiO1xuaW1wb3J0IHsgQVBJRXJyb3IgfSBmcm9tIFwiLi9lcnJvci5tanNcIjtcbmV4cG9ydCBjbGFzcyBTdHJlYW0ge1xuICAgIGNvbnN0cnVjdG9yKGl0ZXJhdG9yLCBjb250cm9sbGVyKSB7XG4gICAgICAgIHRoaXMuaXRlcmF0b3IgPSBpdGVyYXRvcjtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyID0gY29udHJvbGxlcjtcbiAgICB9XG4gICAgc3RhdGljIGZyb21TU0VSZXNwb25zZShyZXNwb25zZSwgY29udHJvbGxlcikge1xuICAgICAgICBsZXQgY29uc3VtZWQgPSBmYWxzZTtcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24qIGl0ZXJhdG9yKCkge1xuICAgICAgICAgICAgaWYgKGNvbnN1bWVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgaXRlcmF0ZSBvdmVyIGEgY29uc3VtZWQgc3RyZWFtLCB1c2UgYC50ZWUoKWAgdG8gc3BsaXQgdGhlIHN0cmVhbS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN1bWVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc3NlIG9mIF9pdGVyU1NFTWVzc2FnZXMocmVzcG9uc2UsIGNvbnRyb2xsZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb25lKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzc2UuZGF0YS5zdGFydHNXaXRoKCdbRE9ORV0nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoc3NlLmV2ZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IEpTT04ucGFyc2Uoc3NlLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBDb3VsZCBub3QgcGFyc2UgbWVzc2FnZSBpbnRvIEpTT046YCwgc3NlLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZyb20gY2h1bms6YCwgc3NlLnJhdyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQVBJRXJyb3IodW5kZWZpbmVkLCBkYXRhLmVycm9yLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB5aWVsZCBkYXRhO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHNzZS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgQ291bGQgbm90IHBhcnNlIG1lc3NhZ2UgaW50byBKU09OOmAsIHNzZS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGcm9tIGNodW5rOmAsIHNzZS5yYXcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBJcyB0aGlzIHdoZXJlIHRoZSBlcnJvciBzaG91bGQgYmUgdGhyb3duP1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNzZS5ldmVudCA9PSAnZXJyb3InKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEFQSUVycm9yKHVuZGVmaW5lZCwgZGF0YS5lcnJvciwgZGF0YS5tZXNzYWdlLCB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgeWllbGQgeyBldmVudDogc3NlLmV2ZW50LCBkYXRhOiBkYXRhIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSB1c2VyIGNhbGxzIGBzdHJlYW0uY29udHJvbGxlci5hYm9ydCgpYCwgd2Ugc2hvdWxkIGV4aXQgd2l0aG91dCB0aHJvd2luZy5cbiAgICAgICAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yICYmIGUubmFtZSA9PT0gJ0Fib3J0RXJyb3InKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSB1c2VyIGBicmVha2BzLCBhYm9ydCB0aGUgb25nb2luZyByZXF1ZXN0LlxuICAgICAgICAgICAgICAgIGlmICghZG9uZSlcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgU3RyZWFtKGl0ZXJhdG9yLCBjb250cm9sbGVyKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGEgU3RyZWFtIGZyb20gYSBuZXdsaW5lLXNlcGFyYXRlZCBSZWFkYWJsZVN0cmVhbVxuICAgICAqIHdoZXJlIGVhY2ggaXRlbSBpcyBhIEpTT04gdmFsdWUuXG4gICAgICovXG4gICAgc3RhdGljIGZyb21SZWFkYWJsZVN0cmVhbShyZWFkYWJsZVN0cmVhbSwgY29udHJvbGxlcikge1xuICAgICAgICBsZXQgY29uc3VtZWQgPSBmYWxzZTtcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24qIGl0ZXJMaW5lcygpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVEZWNvZGVyID0gbmV3IExpbmVEZWNvZGVyKCk7XG4gICAgICAgICAgICBjb25zdCBpdGVyID0gUmVhZGFibGVTdHJlYW1Ub0FzeW5jSXRlcmFibGUocmVhZGFibGVTdHJlYW0pO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBpdGVyKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVEZWNvZGVyLmRlY29kZShjaHVuaykpIHtcbiAgICAgICAgICAgICAgICAgICAgeWllbGQgbGluZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZURlY29kZXIuZmx1c2goKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIGxpbmU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24qIGl0ZXJhdG9yKCkge1xuICAgICAgICAgICAgaWYgKGNvbnN1bWVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgaXRlcmF0ZSBvdmVyIGEgY29uc3VtZWQgc3RyZWFtLCB1c2UgYC50ZWUoKWAgdG8gc3BsaXQgdGhlIHN0cmVhbS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN1bWVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgbGluZSBvZiBpdGVyTGluZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9uZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGluZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHlpZWxkIEpTT04ucGFyc2UobGluZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgdXNlciBjYWxscyBgc3RyZWFtLmNvbnRyb2xsZXIuYWJvcnQoKWAsIHdlIHNob3VsZCBleGl0IHdpdGhvdXQgdGhyb3dpbmcuXG4gICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09ICdBYm9ydEVycm9yJylcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgdXNlciBgYnJlYWtgcywgYWJvcnQgdGhlIG9uZ29pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgICBpZiAoIWRvbmUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFN0cmVhbShpdGVyYXRvciwgY29udHJvbGxlcik7XG4gICAgfVxuICAgIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLml0ZXJhdG9yKCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNwbGl0cyB0aGUgc3RyZWFtIGludG8gdHdvIHN0cmVhbXMgd2hpY2ggY2FuIGJlXG4gICAgICogaW5kZXBlbmRlbnRseSByZWFkIGZyb20gYXQgZGlmZmVyZW50IHNwZWVkcy5cbiAgICAgKi9cbiAgICB0ZWUoKSB7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBbXTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBbXTtcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdG9yKCk7XG4gICAgICAgIGNvbnN0IHRlZUl0ZXJhdG9yID0gKHF1ZXVlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGVmdC5wdXNoKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByaWdodC5wdXNoKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBuZXcgU3RyZWFtKCgpID0+IHRlZUl0ZXJhdG9yKGxlZnQpLCB0aGlzLmNvbnRyb2xsZXIpLFxuICAgICAgICAgICAgbmV3IFN0cmVhbSgoKSA9PiB0ZWVJdGVyYXRvcihyaWdodCksIHRoaXMuY29udHJvbGxlciksXG4gICAgICAgIF07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoaXMgc3RyZWFtIHRvIGEgbmV3bGluZS1zZXBhcmF0ZWQgUmVhZGFibGVTdHJlYW0gb2ZcbiAgICAgKiBKU09OIHN0cmluZ2lmaWVkIHZhbHVlcyBpbiB0aGUgc3RyZWFtXG4gICAgICogd2hpY2ggY2FuIGJlIHR1cm5lZCBiYWNrIGludG8gYSBTdHJlYW0gd2l0aCBgU3RyZWFtLmZyb21SZWFkYWJsZVN0cmVhbSgpYC5cbiAgICAgKi9cbiAgICB0b1JlYWRhYmxlU3RyZWFtKCkge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAgICAgbGV0IGl0ZXI7XG4gICAgICAgIGNvbnN0IGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWFkYWJsZVN0cmVhbSh7XG4gICAgICAgICAgICBhc3luYyBzdGFydCgpIHtcbiAgICAgICAgICAgICAgICBpdGVyID0gc2VsZltTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3luYyBwdWxsKGN0cmwpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCBpdGVyLm5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbmUpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3RybC5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBieXRlcyA9IGVuY29kZXIuZW5jb2RlKEpTT04uc3RyaW5naWZ5KHZhbHVlKSArICdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgY3RybC5lbnF1ZXVlKGJ5dGVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjdHJsLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzeW5jIGNhbmNlbCgpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBpdGVyLnJldHVybj8uKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIF9pdGVyU1NFTWVzc2FnZXMocmVzcG9uc2UsIGNvbnRyb2xsZXIpIHtcbiAgICBpZiAoIXJlc3BvbnNlLmJvZHkpIHtcbiAgICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYEF0dGVtcHRlZCB0byBpdGVyYXRlIG92ZXIgYSByZXNwb25zZSB3aXRoIG5vIGJvZHlgKTtcbiAgICB9XG4gICAgY29uc3Qgc3NlRGVjb2RlciA9IG5ldyBTU0VEZWNvZGVyKCk7XG4gICAgY29uc3QgbGluZURlY29kZXIgPSBuZXcgTGluZURlY29kZXIoKTtcbiAgICBjb25zdCBpdGVyID0gUmVhZGFibGVTdHJlYW1Ub0FzeW5jSXRlcmFibGUocmVzcG9uc2UuYm9keSk7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzc2VDaHVuayBvZiBpdGVyU1NFQ2h1bmtzKGl0ZXIpKSB7XG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lRGVjb2Rlci5kZWNvZGUoc3NlQ2h1bmspKSB7XG4gICAgICAgICAgICBjb25zdCBzc2UgPSBzc2VEZWNvZGVyLmRlY29kZShsaW5lKTtcbiAgICAgICAgICAgIGlmIChzc2UpXG4gICAgICAgICAgICAgICAgeWllbGQgc3NlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lRGVjb2Rlci5mbHVzaCgpKSB7XG4gICAgICAgIGNvbnN0IHNzZSA9IHNzZURlY29kZXIuZGVjb2RlKGxpbmUpO1xuICAgICAgICBpZiAoc3NlKVxuICAgICAgICAgICAgeWllbGQgc3NlO1xuICAgIH1cbn1cbi8qKlxuICogR2l2ZW4gYW4gYXN5bmMgaXRlcmFibGUgaXRlcmF0b3IsIGl0ZXJhdGVzIG92ZXIgaXQgYW5kIHlpZWxkcyBmdWxsXG4gKiBTU0UgY2h1bmtzLCBpLmUuIHlpZWxkcyB3aGVuIGEgZG91YmxlIG5ldy1saW5lIGlzIGVuY291bnRlcmVkLlxuICovXG5hc3luYyBmdW5jdGlvbiogaXRlclNTRUNodW5rcyhpdGVyYXRvcikge1xuICAgIGxldCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoKTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIGl0ZXJhdG9yKSB7XG4gICAgICAgIGlmIChjaHVuayA9PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBiaW5hcnlDaHVuayA9IGNodW5rIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgPyBuZXcgVWludDhBcnJheShjaHVuaylcbiAgICAgICAgICAgIDogdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJyA/IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShjaHVuaylcbiAgICAgICAgICAgICAgICA6IGNodW5rO1xuICAgICAgICBsZXQgbmV3RGF0YSA9IG5ldyBVaW50OEFycmF5KGRhdGEubGVuZ3RoICsgYmluYXJ5Q2h1bmsubGVuZ3RoKTtcbiAgICAgICAgbmV3RGF0YS5zZXQoZGF0YSk7XG4gICAgICAgIG5ld0RhdGEuc2V0KGJpbmFyeUNodW5rLCBkYXRhLmxlbmd0aCk7XG4gICAgICAgIGRhdGEgPSBuZXdEYXRhO1xuICAgICAgICBsZXQgcGF0dGVybkluZGV4O1xuICAgICAgICB3aGlsZSAoKHBhdHRlcm5JbmRleCA9IGZpbmREb3VibGVOZXdsaW5lSW5kZXgoZGF0YSkpICE9PSAtMSkge1xuICAgICAgICAgICAgeWllbGQgZGF0YS5zbGljZSgwLCBwYXR0ZXJuSW5kZXgpO1xuICAgICAgICAgICAgZGF0YSA9IGRhdGEuc2xpY2UocGF0dGVybkluZGV4KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHlpZWxkIGRhdGE7XG4gICAgfVxufVxuZnVuY3Rpb24gZmluZERvdWJsZU5ld2xpbmVJbmRleChidWZmZXIpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNlYXJjaGVzIHRoZSBidWZmZXIgZm9yIHRoZSBlbmQgcGF0dGVybnMgKFxcclxcciwgXFxuXFxuLCBcXHJcXG5cXHJcXG4pXG4gICAgLy8gYW5kIHJldHVybnMgdGhlIGluZGV4IHJpZ2h0IGFmdGVyIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGFueSBwYXR0ZXJuLFxuICAgIC8vIG9yIC0xIGlmIG5vbmUgb2YgdGhlIHBhdHRlcm5zIGFyZSBmb3VuZC5cbiAgICBjb25zdCBuZXdsaW5lID0gMHgwYTsgLy8gXFxuXG4gICAgY29uc3QgY2FycmlhZ2UgPSAweDBkOyAvLyBcXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGggLSAyOyBpKyspIHtcbiAgICAgICAgaWYgKGJ1ZmZlcltpXSA9PT0gbmV3bGluZSAmJiBidWZmZXJbaSArIDFdID09PSBuZXdsaW5lKSB7XG4gICAgICAgICAgICAvLyBcXG5cXG5cbiAgICAgICAgICAgIHJldHVybiBpICsgMjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYnVmZmVyW2ldID09PSBjYXJyaWFnZSAmJiBidWZmZXJbaSArIDFdID09PSBjYXJyaWFnZSkge1xuICAgICAgICAgICAgLy8gXFxyXFxyXG4gICAgICAgICAgICByZXR1cm4gaSArIDI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJ1ZmZlcltpXSA9PT0gY2FycmlhZ2UgJiZcbiAgICAgICAgICAgIGJ1ZmZlcltpICsgMV0gPT09IG5ld2xpbmUgJiZcbiAgICAgICAgICAgIGkgKyAzIDwgYnVmZmVyLmxlbmd0aCAmJlxuICAgICAgICAgICAgYnVmZmVyW2kgKyAyXSA9PT0gY2FycmlhZ2UgJiZcbiAgICAgICAgICAgIGJ1ZmZlcltpICsgM10gPT09IG5ld2xpbmUpIHtcbiAgICAgICAgICAgIC8vIFxcclxcblxcclxcblxuICAgICAgICAgICAgcmV0dXJuIGkgKyA0O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbn1cbmNsYXNzIFNTRURlY29kZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50ID0gbnVsbDtcbiAgICAgICAgdGhpcy5kYXRhID0gW107XG4gICAgICAgIHRoaXMuY2h1bmtzID0gW107XG4gICAgfVxuICAgIGRlY29kZShsaW5lKSB7XG4gICAgICAgIGlmIChsaW5lLmVuZHNXaXRoKCdcXHInKSkge1xuICAgICAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyaW5nKDAsIGxpbmUubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFsaW5lKSB7XG4gICAgICAgICAgICAvLyBlbXB0eSBsaW5lIGFuZCB3ZSBkaWRuJ3QgcHJldmlvdXNseSBlbmNvdW50ZXIgYW55IG1lc3NhZ2VzXG4gICAgICAgICAgICBpZiAoIXRoaXMuZXZlbnQgJiYgIXRoaXMuZGF0YS5sZW5ndGgpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCBzc2UgPSB7XG4gICAgICAgICAgICAgICAgZXZlbnQ6IHRoaXMuZXZlbnQsXG4gICAgICAgICAgICAgICAgZGF0YTogdGhpcy5kYXRhLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgICAgIHJhdzogdGhpcy5jaHVua3MsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5ldmVudCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuY2h1bmtzID0gW107XG4gICAgICAgICAgICByZXR1cm4gc3NlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2h1bmtzLnB1c2gobGluZSk7XG4gICAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJzonKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IFtmaWVsZG5hbWUsIF8sIHZhbHVlXSA9IHBhcnRpdGlvbihsaW5lLCAnOicpO1xuICAgICAgICBpZiAodmFsdWUuc3RhcnRzV2l0aCgnICcpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnN1YnN0cmluZygxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmllbGRuYW1lID09PSAnZXZlbnQnKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZmllbGRuYW1lID09PSAnZGF0YScpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG4vKiogVGhpcyBpcyBhbiBpbnRlcm5hbCBoZWxwZXIgZnVuY3Rpb24gdGhhdCdzIGp1c3QgdXNlZCBmb3IgdGVzdGluZyAqL1xuZXhwb3J0IGZ1bmN0aW9uIF9kZWNvZGVDaHVua3MoY2h1bmtzLCB7IGZsdXNoIH0gPSB7IGZsdXNoOiBmYWxzZSB9KSB7XG4gICAgY29uc3QgZGVjb2RlciA9IG5ldyBMaW5lRGVjb2RlcigpO1xuICAgIGNvbnN0IGxpbmVzID0gW107XG4gICAgZm9yIChjb25zdCBjaHVuayBvZiBjaHVua3MpIHtcbiAgICAgICAgbGluZXMucHVzaCguLi5kZWNvZGVyLmRlY29kZShjaHVuaykpO1xuICAgIH1cbiAgICBpZiAoZmx1c2gpIHtcbiAgICAgICAgbGluZXMucHVzaCguLi5kZWNvZGVyLmZsdXNoKCkpO1xuICAgIH1cbiAgICByZXR1cm4gbGluZXM7XG59XG5mdW5jdGlvbiBwYXJ0aXRpb24oc3RyLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBpbmRleCA9IHN0ci5pbmRleE9mKGRlbGltaXRlcik7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gW3N0ci5zdWJzdHJpbmcoMCwgaW5kZXgpLCBkZWxpbWl0ZXIsIHN0ci5zdWJzdHJpbmcoaW5kZXggKyBkZWxpbWl0ZXIubGVuZ3RoKV07XG4gICAgfVxuICAgIHJldHVybiBbc3RyLCAnJywgJyddO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3RyZWFtaW5nLm1qcy5tYXAiLCJpbXBvcnQgeyBGb3JtRGF0YSwgRmlsZSwgZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnMsIGlzRnNSZWFkU3RyZWFtLCB9IGZyb20gXCIuL19zaGltcy9pbmRleC5tanNcIjtcbmV4cG9ydCB7IGZpbGVGcm9tUGF0aCB9IGZyb20gXCIuL19zaGltcy9pbmRleC5tanNcIjtcbmV4cG9ydCBjb25zdCBpc1Jlc3BvbnNlTGlrZSA9ICh2YWx1ZSkgPT4gdmFsdWUgIT0gbnVsbCAmJlxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2YgdmFsdWUudXJsID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiB2YWx1ZS5ibG9iID09PSAnZnVuY3Rpb24nO1xuZXhwb3J0IGNvbnN0IGlzRmlsZUxpa2UgPSAodmFsdWUpID0+IHZhbHVlICE9IG51bGwgJiZcbiAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIHZhbHVlLm5hbWUgPT09ICdzdHJpbmcnICYmXG4gICAgdHlwZW9mIHZhbHVlLmxhc3RNb2RpZmllZCA9PT0gJ251bWJlcicgJiZcbiAgICBpc0Jsb2JMaWtlKHZhbHVlKTtcbi8qKlxuICogVGhlIEJsb2JMaWtlIHR5cGUgb21pdHMgYXJyYXlCdWZmZXIoKSBiZWNhdXNlIEB0eXBlcy9ub2RlLWZldGNoQF4yLjYuNCBsYWNrcyBpdDsgYnV0IHRoaXMgY2hlY2tcbiAqIGFkZHMgdGhlIGFycmF5QnVmZmVyKCkgbWV0aG9kIHR5cGUgYmVjYXVzZSBpdCBpcyBhdmFpbGFibGUgYW5kIHVzZWQgYXQgcnVudGltZVxuICovXG5leHBvcnQgY29uc3QgaXNCbG9iTGlrZSA9ICh2YWx1ZSkgPT4gdmFsdWUgIT0gbnVsbCAmJlxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2YgdmFsdWUuc2l6ZSA9PT0gJ251bWJlcicgJiZcbiAgICB0eXBlb2YgdmFsdWUudHlwZSA9PT0gJ3N0cmluZycgJiZcbiAgICB0eXBlb2YgdmFsdWUudGV4dCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiB2YWx1ZS5zbGljZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiB2YWx1ZS5hcnJheUJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJztcbmV4cG9ydCBjb25zdCBpc1VwbG9hZGFibGUgPSAodmFsdWUpID0+IHtcbiAgICByZXR1cm4gaXNGaWxlTGlrZSh2YWx1ZSkgfHwgaXNSZXNwb25zZUxpa2UodmFsdWUpIHx8IGlzRnNSZWFkU3RyZWFtKHZhbHVlKTtcbn07XG4vKipcbiAqIEhlbHBlciBmb3IgY3JlYXRpbmcgYSB7QGxpbmsgRmlsZX0gdG8gcGFzcyB0byBhbiBTREsgdXBsb2FkIG1ldGhvZCBmcm9tIGEgdmFyaWV0eSBvZiBkaWZmZXJlbnQgZGF0YSBmb3JtYXRzXG4gKiBAcGFyYW0gdmFsdWUgdGhlIHJhdyBjb250ZW50IG9mIHRoZSBmaWxlLiAgQ2FuIGJlIGFuIHtAbGluayBVcGxvYWRhYmxlfSwge0BsaW5rIEJsb2JMaWtlUGFydH0sIG9yIHtAbGluayBBc3luY0l0ZXJhYmxlfSBvZiB7QGxpbmsgQmxvYkxpa2VQYXJ0fXNcbiAqIEBwYXJhbSB7c3RyaW5nPX0gbmFtZSB0aGUgbmFtZSBvZiB0aGUgZmlsZS4gSWYgb21pdHRlZCwgdG9GaWxlIHdpbGwgdHJ5IHRvIGRldGVybWluZSBhIGZpbGUgbmFtZSBmcm9tIGJpdHMgaWYgcG9zc2libGVcbiAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0aW9ucyBhZGRpdGlvbmFsIHByb3BlcnRpZXNcbiAqIEBwYXJhbSB7c3RyaW5nPX0gb3B0aW9ucy50eXBlIHRoZSBNSU1FIHR5cGUgb2YgdGhlIGNvbnRlbnRcbiAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0aW9ucy5sYXN0TW9kaWZpZWQgdGhlIGxhc3QgbW9kaWZpZWQgdGltZXN0YW1wXG4gKiBAcmV0dXJucyBhIHtAbGluayBGaWxlfSB3aXRoIHRoZSBnaXZlbiBwcm9wZXJ0aWVzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0b0ZpbGUodmFsdWUsIG5hbWUsIG9wdGlvbnMpIHtcbiAgICAvLyBJZiBpdCdzIGEgcHJvbWlzZSwgcmVzb2x2ZSBpdC5cbiAgICB2YWx1ZSA9IGF3YWl0IHZhbHVlO1xuICAgIC8vIElmIHdlJ3ZlIGJlZW4gZ2l2ZW4gYSBgRmlsZWAgd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZ1xuICAgIGlmIChpc0ZpbGVMaWtlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChpc1Jlc3BvbnNlTGlrZSh2YWx1ZSkpIHtcbiAgICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IHZhbHVlLmJsb2IoKTtcbiAgICAgICAgbmFtZSB8fCAobmFtZSA9IG5ldyBVUkwodmFsdWUudXJsKS5wYXRobmFtZS5zcGxpdCgvW1xcXFwvXS8pLnBvcCgpID8/ICd1bmtub3duX2ZpbGUnKTtcbiAgICAgICAgLy8gd2UgbmVlZCB0byBjb252ZXJ0IHRoZSBgQmxvYmAgaW50byBhbiBhcnJheSBidWZmZXIgYmVjYXVzZSB0aGUgYEJsb2JgIGNsYXNzXG4gICAgICAgIC8vIHRoYXQgYG5vZGUtZmV0Y2hgIGRlZmluZXMgaXMgaW5jb21wYXRpYmxlIHdpdGggdGhlIHdlYiBzdGFuZGFyZCB3aGljaCByZXN1bHRzXG4gICAgICAgIC8vIGluIGBuZXcgRmlsZWAgaW50ZXJwcmV0aW5nIGl0IGFzIGEgc3RyaW5nIGluc3RlYWQgb2YgYmluYXJ5IGRhdGEuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBpc0Jsb2JMaWtlKGJsb2IpID8gWyhhd2FpdCBibG9iLmFycmF5QnVmZmVyKCkpXSA6IFtibG9iXTtcbiAgICAgICAgcmV0dXJuIG5ldyBGaWxlKGRhdGEsIG5hbWUsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBjb25zdCBiaXRzID0gYXdhaXQgZ2V0Qnl0ZXModmFsdWUpO1xuICAgIG5hbWUgfHwgKG5hbWUgPSBnZXROYW1lKHZhbHVlKSA/PyAndW5rbm93bl9maWxlJyk7XG4gICAgaWYgKCFvcHRpb25zPy50eXBlKSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBiaXRzWzBdPy50eXBlO1xuICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBvcHRpb25zID0geyAuLi5vcHRpb25zLCB0eXBlIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBGaWxlKGJpdHMsIG5hbWUsIG9wdGlvbnMpO1xufVxuYXN5bmMgZnVuY3Rpb24gZ2V0Qnl0ZXModmFsdWUpIHtcbiAgICBsZXQgcGFydHMgPSBbXTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fFxuICAgICAgICBBcnJheUJ1ZmZlci5pc1ZpZXcodmFsdWUpIHx8IC8vIGluY2x1ZGVzIFVpbnQ4QXJyYXksIEJ1ZmZlciwgZXRjLlxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICAgIHBhcnRzLnB1c2godmFsdWUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc0Jsb2JMaWtlKHZhbHVlKSkge1xuICAgICAgICBwYXJ0cy5wdXNoKGF3YWl0IHZhbHVlLmFycmF5QnVmZmVyKCkpO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc0FzeW5jSXRlcmFibGVJdGVyYXRvcih2YWx1ZSkgLy8gaW5jbHVkZXMgUmVhZGFibGUsIFJlYWRhYmxlU3RyZWFtLCBldGMuXG4gICAgKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgIHBhcnRzLnB1c2goY2h1bmspOyAvLyBUT0RPLCBjb25zaWRlciB2YWxpZGF0aW5nP1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgZGF0YSB0eXBlOiAke3R5cGVvZiB2YWx1ZX07IGNvbnN0cnVjdG9yOiAke3ZhbHVlPy5jb25zdHJ1Y3RvclxuICAgICAgICAgICAgPy5uYW1lfTsgcHJvcHM6ICR7cHJvcHNGb3JFcnJvcih2YWx1ZSl9YCk7XG4gICAgfVxuICAgIHJldHVybiBwYXJ0cztcbn1cbmZ1bmN0aW9uIHByb3BzRm9yRXJyb3IodmFsdWUpIHtcbiAgICBjb25zdCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgICByZXR1cm4gYFske3Byb3BzLm1hcCgocCkgPT4gYFwiJHtwfVwiYCkuam9pbignLCAnKX1dYDtcbn1cbmZ1bmN0aW9uIGdldE5hbWUodmFsdWUpIHtcbiAgICByZXR1cm4gKGdldFN0cmluZ0Zyb21NYXliZUJ1ZmZlcih2YWx1ZS5uYW1lKSB8fFxuICAgICAgICBnZXRTdHJpbmdGcm9tTWF5YmVCdWZmZXIodmFsdWUuZmlsZW5hbWUpIHx8XG4gICAgICAgIC8vIEZvciBmcy5SZWFkU3RyZWFtXG4gICAgICAgIGdldFN0cmluZ0Zyb21NYXliZUJ1ZmZlcih2YWx1ZS5wYXRoKT8uc3BsaXQoL1tcXFxcL10vKS5wb3AoKSk7XG59XG5jb25zdCBnZXRTdHJpbmdGcm9tTWF5YmVCdWZmZXIgPSAoeCkgPT4ge1xuICAgIGlmICh0eXBlb2YgeCA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiB4O1xuICAgIGlmICh0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB4IGluc3RhbmNlb2YgQnVmZmVyKVxuICAgICAgICByZXR1cm4gU3RyaW5nKHgpO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG59O1xuY29uc3QgaXNBc3luY0l0ZXJhYmxlSXRlcmF0b3IgPSAodmFsdWUpID0+IHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsdWVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID09PSAnZnVuY3Rpb24nO1xuZXhwb3J0IGNvbnN0IGlzTXVsdGlwYXJ0Qm9keSA9IChib2R5KSA9PiBib2R5ICYmIHR5cGVvZiBib2R5ID09PSAnb2JqZWN0JyAmJiBib2R5LmJvZHkgJiYgYm9keVtTeW1ib2wudG9TdHJpbmdUYWddID09PSAnTXVsdGlwYXJ0Qm9keSc7XG4vKipcbiAqIFJldHVybnMgYSBtdWx0aXBhcnQvZm9ybS1kYXRhIHJlcXVlc3QgaWYgYW55IHBhcnQgb2YgdGhlIGdpdmVuIHJlcXVlc3QgYm9keSBjb250YWlucyBhIEZpbGUgLyBCbG9iIHZhbHVlLlxuICogT3RoZXJ3aXNlIHJldHVybnMgdGhlIHJlcXVlc3QgYXMgaXMuXG4gKi9cbmV4cG9ydCBjb25zdCBtYXliZU11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyA9IGFzeW5jIChvcHRzKSA9PiB7XG4gICAgaWYgKCFoYXNVcGxvYWRhYmxlVmFsdWUob3B0cy5ib2R5KSlcbiAgICAgICAgcmV0dXJuIG9wdHM7XG4gICAgY29uc3QgZm9ybSA9IGF3YWl0IGNyZWF0ZUZvcm0ob3B0cy5ib2R5KTtcbiAgICByZXR1cm4gZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnMoZm9ybSwgb3B0cyk7XG59O1xuZXhwb3J0IGNvbnN0IG11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyA9IGFzeW5jIChvcHRzKSA9PiB7XG4gICAgY29uc3QgZm9ybSA9IGF3YWl0IGNyZWF0ZUZvcm0ob3B0cy5ib2R5KTtcbiAgICByZXR1cm4gZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnMoZm9ybSwgb3B0cyk7XG59O1xuZXhwb3J0IGNvbnN0IGNyZWF0ZUZvcm0gPSBhc3luYyAoYm9keSkgPT4ge1xuICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyhib2R5IHx8IHt9KS5tYXAoKFtrZXksIHZhbHVlXSkgPT4gYWRkRm9ybVZhbHVlKGZvcm0sIGtleSwgdmFsdWUpKSk7XG4gICAgcmV0dXJuIGZvcm07XG59O1xuY29uc3QgaGFzVXBsb2FkYWJsZVZhbHVlID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKGlzVXBsb2FkYWJsZSh2YWx1ZSkpXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSlcbiAgICAgICAgcmV0dXJuIHZhbHVlLnNvbWUoaGFzVXBsb2FkYWJsZVZhbHVlKTtcbiAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBmb3IgKGNvbnN0IGsgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChoYXNVcGxvYWRhYmxlVmFsdWUodmFsdWVba10pKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5jb25zdCBhZGRGb3JtVmFsdWUgPSBhc3luYyAoZm9ybSwga2V5LCB2YWx1ZSkgPT4ge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICByZXR1cm47XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUmVjZWl2ZWQgbnVsbCBmb3IgXCIke2tleX1cIjsgdG8gcGFzcyBudWxsIGluIEZvcm1EYXRhLCB5b3UgbXVzdCB1c2UgdGhlIHN0cmluZyAnbnVsbCdgKTtcbiAgICB9XG4gICAgLy8gVE9ETzogbWFrZSBuZXN0ZWQgZm9ybWF0cyBjb25maWd1cmFibGVcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIGZvcm0uYXBwZW5kKGtleSwgU3RyaW5nKHZhbHVlKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzVXBsb2FkYWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRvRmlsZSh2YWx1ZSk7XG4gICAgICAgIGZvcm0uYXBwZW5kKGtleSwgZmlsZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHZhbHVlLm1hcCgoZW50cnkpID0+IGFkZEZvcm1WYWx1ZShmb3JtLCBrZXkgKyAnW10nLCBlbnRyeSkpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh2YWx1ZSkubWFwKChbbmFtZSwgcHJvcF0pID0+IGFkZEZvcm1WYWx1ZShmb3JtLCBgJHtrZXl9WyR7bmFtZX1dYCwgcHJvcCkpKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEludmFsaWQgdmFsdWUgZ2l2ZW4gdG8gZm9ybSwgZXhwZWN0ZWQgYSBzdHJpbmcsIG51bWJlciwgYm9vbGVhbiwgb2JqZWN0LCBBcnJheSwgRmlsZSBvciBCbG9iIGJ1dCBnb3QgJHt2YWx1ZX0gaW5zdGVhZGApO1xuICAgIH1cbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD11cGxvYWRzLm1qcy5tYXAiLCJleHBvcnQgY29uc3QgVkVSU0lPTiA9ICc0Ljg1LjEnOyAvLyB4LXJlbGVhc2UtcGxlYXNlLXZlcnNpb25cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXZlcnNpb24ubWpzLm1hcCIsImltcG9ydCBPcGVuQUkgZnJvbSAnb3BlbmFpJztcblxuLy8g5Yid5aeL5YyWIE9wZW5BSSDlrqLmiLfnq69cbmNvbnN0IG9wZW5haSA9IG5ldyBPcGVuQUkoe1xuICAgIGFwaUtleTogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVksXG4gICAgYmFzZVVSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCxcbiAgICBkYW5nZXJvdXNseUFsbG93QnJvd3NlcjogdHJ1ZVxufSk7XG5cbi8vIOagueaNruS4jeWQjCBMTE0g5pyN5Yqh5aSE55CGIExMTSDor7fmsYLvvIzlubbmj5Dlj5YgSlNPTiDmlbDmja5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVMTE1SZXF1ZXN0KGJvZHk6IGFueSk6IFByb21pc2U8W3N0cmluZywgYW55W11dPiB7XG4gICAgY29uc3QgaGFuZGxlciA9IHByb2Nlc3MuZW52LkxMTV9UWVBFID09PSAnbG9jYWwnID8gaGFuZGxlT2xsYW1hUmVxdWVzdCA6IGhhbmRsZU9wZW5BSVJlcXVlc3Q7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBoYW5kbGVyKGJvZHkpO1xuICAgIGNvbnN0IGpzb25EYXRhID0gZXh0cmFjdEpzb25Gcm9tUmVzcG9uc2UocmVzcG9uc2UpO1xuICAgIHJldHVybiBbcmVzcG9uc2UsIGpzb25EYXRhXTtcbn1cblxuLy8g5aSE55CGIE9sbGFtYSDor7fmsYLjgIJPbGxhbWEg5a6J6KOF5ZCO6ZyA6KaB5oqKIGxhdW5jaGN0bCBzZXRlbnYgT0xMQU1BX09SSUdJTlMgXCIqXCIg5Yqg5YWl5YiwIC5iYXNocmMg5LitXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVPbGxhbWFSZXF1ZXN0KGJvZHk6IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkx9L2FwaS9nZW5lcmF0ZWAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG1vZGVsOiBwcm9jZXNzLmVudi5PTExBTUFfTU9ERUwsXG4gICAgICAgICAgICBwcm9tcHQ6IGJvZHkucHJvbXB0LFxuICAgICAgICAgICAgc3RyZWFtOiBmYWxzZSxcbiAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICAgICAgICB0b3BfcDogMC45XG4gICAgICAgIH0pXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCBlcnJvciEgc3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgcmV0dXJuIHJlc3VsdC5yZXNwb25zZTtcbn1cblxuLy8g5aSE55CGIE9wZW5BSSDor7fmsYJcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZU9wZW5BSVJlcXVlc3QoYm9keTogYW55KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBjb21wbGV0aW9uID0gYXdhaXQgb3BlbmFpLmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKHtcbiAgICAgICAgbW9kZWw6IHByb2Nlc3MuZW52Lk9QRU5BSV9NT0RFTCxcbiAgICAgICAgbWVzc2FnZXM6IFt7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiBib2R5LnByb21wdCB9XSxcbiAgICAgICAgdGVtcGVyYXR1cmU6IDAuMyxcbiAgICAgICAgdG9wX3A6IDAuOVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGNvbXBsZXRpb24uY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQgfHwgJyc7XG59XG5cbi8vIOaWsOWinu+8muS7juWTjeW6lOaWh+acrOS4reaPkOWPliBKU09OIOaVsOaNrlxuZnVuY3Rpb24gZXh0cmFjdEpzb25Gcm9tUmVzcG9uc2UocmVzcG9uc2U6IHN0cmluZyk6IGFueVtdIHtcbiAgICBsZXQganNvbkRhdGE6IGFueVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g6aaW5YWI5bCd6K+V55u05o6l6Kej5p6Q5pW05Liq5ZON5bqUXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkaXJlY3RQYXJzZSA9IEpTT04ucGFyc2UocmVzcG9uc2UudHJpbSgpKTtcbiAgICAgICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KGRpcmVjdFBhcnNlKSA/IGRpcmVjdFBhcnNlIDogW2RpcmVjdFBhcnNlXTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8g5aaC5p6c55u05o6l6Kej5p6Q5aSx6LSl77yM57un57ut5bCd6K+V5YW25LuW5pa55rOVXG4gICAgICAgIH1cblxuICAgICAgICAvLyDlsJ3or5Xku47lk43lupTkuK3mn6Xmib4gSlNPTiDku6PnoIHlnZdcbiAgICAgICAgY29uc3QganNvbk1hdGNoID0gcmVzcG9uc2UubWF0Y2goL2BgYCg/Ompzb24pP1xccyooW1xcc1xcU10qPylcXHMqYGBgLyk7XG4gICAgICAgIGlmIChqc29uTWF0Y2gpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZERhdGEgPSBKU09OLnBhcnNlKGpzb25NYXRjaFsxXS50cmltKCkpO1xuICAgICAgICAgICAganNvbkRhdGEgPSBBcnJheS5pc0FycmF5KHBhcnNlZERhdGEpID8gcGFyc2VkRGF0YSA6IFtwYXJzZWREYXRhXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIOWwneivleafpeaJvuWPr+iDveeahCBKU09OIOWtl+espuS4su+8iOaWueaLrOWPt+aIluWkp+aLrOWPt+W8gOWktOWSjOe7k+Wwvu+8iVxuICAgICAgICAgICAgY29uc3QganNvblJlZ2V4ID0gLyhcXFtbXFxzXFxTXSpcXF18XFx7W1xcc1xcU10qXFx9KS87XG4gICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxKc29uID0gcmVzcG9uc2UubWF0Y2goanNvblJlZ2V4KTtcbiAgICAgICAgICAgIGlmIChwb3RlbnRpYWxKc29uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UocG90ZW50aWFsSnNvblsxXS50cmltKCkpO1xuICAgICAgICAgICAgICAgIGpzb25EYXRhID0gQXJyYXkuaXNBcnJheShwYXJzZWREYXRhKSA/IHBhcnNlZERhdGEgOiBbcGFyc2VkRGF0YV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHBhcnNlIEpTT04gZnJvbSBMTE0gcmVzcG9uc2U6JywgZSk7XG4gICAgfVxuICAgIHJldHVybiBqc29uRGF0YTtcbn1cbiIsImltcG9ydCB7IElDb25maWcgfSBmcm9tICcuL2NvbmZpZyc7XG5pbXBvcnQgeyBoYW5kbGVMTE1SZXF1ZXN0IH0gZnJvbSAnLi9sbG0nO1xuaW1wb3J0IHsgc2hvd1RvYXN0IH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOaVtOeQhuaJgOaciea2iOaBr++8jOWPkemAgee7mSBMTE0g5YiG5p6Q77yM54S25ZCO5o6o6YCB57uZIGJvdFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFuYWx5emVNZXNzYWdlcyAoZGF0YTogYW55W10sIGNvbmZpZzogSUNvbmZpZykge1xuICAgIGNvbnN0IHsgdXNlcm5hbWUgfSA9IGNvbmZpZztcbiAgICAvLyBUb2RvOiDku44gYmNrZ291cm5kLT5zdG9yYWdlIOS8oOWPgiDkuK3ojrflj5YgY29uY2VybmVkSXRlbXNcbiAgICBjb25zdCBjb25jZXJuZWRJdGVtczoge3RleHQ6IHN0cmluZ31bXSA9IChhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ2NvbmNlcm5lZEl0ZW1zJykpLmNvbmNlcm5lZEl0ZW1zIHx8IFtcbiAgICAgICAge3RleHQ6J3JlY29yZGluZyDpobnnm67lnKggUkNWIG1vYmlsZSDkuK3nmoTnm7jlhbPkv6Hmga/vvIznibnliKvmmK8gQkUg5L6d6LWW6YOo5YiG55qE5a6M5oiQ5oOF5Ya177yI5YWz6ZSu6K+N77yacmVjb3JkaW5nL1JDViBtb2JpbGUvQkUgZGVwZW5kZW5jaWVz77yM5b+F6aG75ZCM5pe25YyF5ZCrXCJyZWNvcmRpbmdcIuWSjFwiQkVcIuebuOWFs+WFs+mUruivje+8iSd9LFxuICAgICAgICB7dGV4dDon6IGK5Yiw5YWz5LqO5YWs5Y+45pS/562W77yM5Lmf5Y+v5Lul5piv5pS/562W55u45YWz55qE5YWr5Y2m5raI5oGvJ30sXG4gICAgICAgIHt0ZXh0OidTb3BoaWEgKEppbm1laSkgTGluIOWPkemAgeeahOaJgOaciea2iOaBr++8iOWPqumcgOimgeajgOafpeWPkemAgeiAheaYr+WQpuWujOWFqOWMuemFje+8iSd9LFxuICAgICAgICB7dGV4dDon5Lu75L2V5piO56GuIEDmiJEg55qE5raI5oGv77yM5oiW6ICF5o+Q5Yiw5oiR55qE5ZCN5a2X55qE5raI5oGvJ30sXG4gICAgXTtcbiAgICBjb25zb2xlLmxvZyhkYXRhLCBjb25jZXJuZWRJdGVtcywgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KCdjb25jZXJuZWRJdGVtcycpKTtcbiAgICAvLyDmj5LlhaXosIPor5XmlbDmja5cbiAgICAvLyBkYXRhLnVuc2hpZnQoe1xuICAgIC8vICAgZ3JvdXBOYW1lOiAnUmVjb3JkaW5nIFRlc3QnLFxuICAgIC8vICAgZ3JvdXBJZDogJzEyMycsXG4gICAgLy8gICBwb3N0czogW1xuICAgIC8vICAgICB7IGNyZWF0b3I6ICdTb3BoaWEgKEppbm1laSkgTGluJywgdGltZTogJzIwMjUtMDItMTMgMDA6MDA6MDAnLCB0ZXh0OiAnUmVjb3JkaW5nIHByb2plY3QgQkUgZGVwZW5kZW5jaWVzIGNvbXBsZXRlZCcgfVxuICAgIC8vICAgXVxuICAgIC8vIH0pO1xuICAgIC8vIGRhdGEudW5zaGlmdCh7XG4gICAgLy8gICBncm91cE5hbWU6ICflpKfnvqQnLFxuICAgIC8vICAgZ3JvdXBJZDogJzI1NzgyMTkwMTQnLFxuICAgIC8vICAgcG9zdHM6IFtcbiAgICAvLyAgICAgeyBjcmVhdG9yOiAnQ29saW4gTGl1JywgdGltZTogJzIwMjUtMDItMTQgMDA6MDA6MDAnLCB0ZXh0OiAnQFRlYW0g5bqU6KaB5rGC77yM5aSn5a625rOo5oSP5LiA5LiL5Yiw5YWs5Y+45pe25YCZ55qE5LiK5LiL54+t5pe26Ze077yM6Iez5bCR5L+d5oyBOOS4quWwj+aXtuWcqOWFrOWPuOeahOaXtumXtO+8jOaXoOeJueauiuaDheWGteS4jeimgeS4reWcuuemu+W8gO+8jOiwouiwouWQhOS9jSDjgIInIH1cbiAgICAvLyAgIF1cbiAgICAvLyB9KTtcbiAgICAvLyBkYXRhLnNwbGljZSgyKTtcbiAgICAvLyBjb25zb2xlLmxvZyhkYXRhKTtcblxuICAgIGlmIChwcm9jZXNzLmVudi5MTE1fVFlQRSA9PT0gJ2xvY2FsJykge1xuICAgIC8vIOaLhuWIhuWNleadoeWPkemAgSBMTE1cbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICBvbGxhbWFBbmFseXNpc1Byb2dyZXNzOiB7XG4gICAgICAgIHRvdGFsOiBkYXRhLmxlbmd0aCxcbiAgICAgICAgbGFzdEFuYWx5emVkSW5kZXg6IDAsXG4gICAgICAgIGxhc3RBbmFseXplZFRpbWU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgZGF0YS5mb3JFYWNoKGFzeW5jIChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IGF3YWl0IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhgLS3lvIDlp4vliIbmnpDnrKwgJHtpbmRleCsxfS8ke2RhdGEubGVuZ3RofSDmnaHmtojmga8tLWApO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gYDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIiR7aXRlbS5ncm91cE5hbWV9XCIgdGVhbV9pZD1cIiR7aXRlbS5ncm91cElkfVwiPiR7aXRlbS5wb3N0cy5tYXAoKHBvc3Q6YW55KSA9PiBgXG4gICAgICAgICAgICA8bWVzc2FnZV9jb250ZW50IHNlbmRlcj1cIiR7cG9zdC5jcmVhdG9yfVwiIGRhdGV0aW1lPVwiJHtwb3N0LnRpbWV9XCI+JHtwb3N0LnRleHR9PC9tZXNzYWdlX2NvbnRlbnQ+YCkuam9pbignJyl9XG4gICAgICAgIDwvbWVzc2FnZV9ncm91cD5gXG4gICAgICAgIGNvbnN0IHByb21wdCA9IGBcbiAgICAgICAg5oiR55qE5ZCN5a2X5piv77yaJHt1c2VybmFtZX0g77yI5aaC5p6c6L+H5ruk6KeE5YiZ5Lit5raI5oGv55qE5YaF5a65IG1lc3NhZ2VfY29udGVudCDmnInmj5DliLDmiJHvvIzlj6/kvZzkuLrliKTmlq3mtojmga/mmK/lkKbmnIlA5oiR77yM5Y2z5L6/5piv5LiN5bim5aeT5rCPQOWQjeWtl+mDqOWIhiDkuZ/op4bkuLrmj5Dlj4rvvIzmjpLpmaQgc2VuZGVyIOaYr+aIkeeahOa2iOaBr++8iVxuXG4gICAgICAgIC0tLS0g6L+Z5piv5oiR5pS25Yiw55qE5pyA6L+R6IGK5p2h5raI5oGv5byA5aeLIC0tLS1cbiAgICAgICAgJHttZXNzYWdlfVxuICAgICAgICAtLS0tIOi/meaYr+aIkeaUtuWIsOeahOacgOi/keiBiuadoea2iOaBr+e7k+adnyAtLS0tXG5cbiAgICAgICAgLS0tLSDku6XkuIvmmK/miJHnmoTpnIDmsYLlkozkvaDpnIDopoHov5Tlm57nmoTlhoXlrrnlrprkuYkgLS0tLVxuICAgICAgICDkvaDmmK/kuIDkuKrlvojnu4blv4PnmoTpobnnm67nu4/nkIbvvIzor7fku5Tnu4bpmIXor7vlubborqTnnJ/liIbmnpDku6XkuIrmtojmga/vvIzmiafooYzku6XkuIvkuInmraXnmoTku7vliqHvvJpcbiAgICAgICAgMS4g6K+35LuU57uG6ZiF6K+7IG1lc3NhZ2VfZ3JvdXAg6YeM55qE5q+P5p2h6IGK5aSp5raI5oGv77yM5Yik5pat6YeM6Z2i55qEIG1lc3NhZ2VfY29udGVudCDmmK/lkKbmnInnrKblkIjku6XkuIvop4TliJnlhbbkuK3kuIDmnaHvvJpcbiAgICAgICAgICAgICR7Y29uY2VybmVkSXRlbXMubWFwKChpdGVtOmFueSwgaTpudW1iZXIpID0+IGAtIOinhOWImSR7aSsxfTogJHtpdGVtLnRleHR9YCkuam9pbignXFxuICAgICAgICAgICcpfVxuICAgICAgICAyLiDlr7kgbWVzc2FnZV9ncm91cCDkuK3mnInnrKblkIjop4TliJnnmoTmtojmga/vvIzor7fmj5Dlj5bku6XkuIvlrZfmrrXvvIjlj6rmj5Dlj5bljp/mlofvvIzljbPkvr/mloflrZflvojlpJrvvIzkuI3lgZrliKDlh4/kuI3lgZrkv67mlLnkuI3lgZrnv7vor5HvvIzlubbkv53nlZnljp/mnInmoLzlvI/vvInvvJpcbiAgICAgICAgICAgIC0gbWVzc2FnZV9jb250ZW505raI5oGv5Y6f5paH5Y+K5YW25a+55bqU5Y+R6YCB6ICFc2VuZGVy5ZKM5Y+R6YCB5pe26Ze0ZGF0ZXRpbWUsIOi/mOaciW1lc3NhZ2VfZ3JvdXDkuK3nmoQgdGVhbV9uYW1lLCB0ZWFtX2lkLCDku6Xlj4rnrKblkIjnmoTop4TliJl4XG4gICAgICAgIDMuIOWvuSBtZXNzYWdlX2dyb3VwIOS4reWImuacieespuWQiOinhOWImeeahOa2iOaBr++8jOavj+adoeeUn+aIkOWvueW6lOeahOi/mSA0IOS4quaWsOWtl+aute+8mlxuICAgICAgICAgICAgLSBtYXRjaGVkX3J1bGU6IOS4iumdouesrOS4gOatpeeahOespuWQiOWIsOeahOinhOWImXjnmoTljp/mloflhoXlrrlcbiAgICAgICAgICAgIC0gZmlsdGVyX3JlYXNvbjog6YCJ5oup6L+Z5p2h5raI5oGv6L+H5ruk5Ye65p2l55qE5Y6f5Zug77yM5Y+v5Lul55So5Lit5paH6KGo6L6+XG4gICAgICAgICAgICAtIHN1bW1hcnk6IOWvuei/meadoea2iOaBr+aJgOWcqOeahCBtZXNzYWdlX2dyb3VwIOeahOWFtuS7lua2iOaBr+eahOS4iuS4i+aWh+WBmuWHuuaAu+e7k+W5tumAguW9k+eahOaOqOeQhuS4uuS7gOS5iHNlbmRlcuS8muWPkeWHuui/meS4qua2iOaBr+OAguivt+S4jeimgeeVmeepuu+8jOi/memHjOWPr+S7peeUqOS4reaWh1xuICAgICAgICAgICAgLSByZXBseV9hZHZpY2U6IOmSiOWvuei/meadoea2iOaBr+eahOS4iuS4i+aWh++8jOe7meWHuuWbnuWkjeW7uuiuru+8jOWbnuWkjeeUqOeahOivreiogOi3n+maj+S4iuS4i+aWh+iBiuWkqeivreiogOOAguWmguaenOinieW+l+i/meadoea2iOaBr+S4jemcgOimgeWbnuWkje+8jOivt+WbnuWkjeepuuWtl+espuS4slxuXG4gICAgICAgIOWwhuS7u+WKoei+k+WHuueahOaVsOaNrui/m+ihjOWmguS4i+mqjOivge+8mlxuICAgICAgICAxLiDku6XkuKXmoLxKU09O5qC85byP6L6T5Ye677yM5LuF5YyF5ZCr5Yy56YWN55qE5raI5oGv44CC5aaC5p6c5rKh5pyJ5Yy56YWN5Lu75L2V6KeE5YiZ77yM6L6T5Ye656m6W13mlbDnu4TvvJpcbiAgICAgICAgICAgIFt7XG4gICAgICAgICAgICBcIm1lc3NhZ2VfY29udGVudFwiOiBcInttZXNzYWdlX2NvbnRlbnR9XCIsXG4gICAgICAgICAgICBcInNlbmRlclwiOiBcIntzZW5kZXJ9XCIsXG4gICAgICAgICAgICBcIm1hdGNoZWRfcnVsZVwiOiBcIuaJgOespuWQiOeahOinhOWImeeahOWGheWuuVwiLFxuICAgICAgICAgICAgXCJmaWx0ZXJfcmVhc29uXCI6IFwiXCIsXG4gICAgICAgICAgICBcInRlYW1fbmFtZVwiOiBcInt0ZWFtX25hbWV9XCIsXG4gICAgICAgICAgICBcInRlYW1faWRcIjogXCJ7dGVhbV9pZH1cIixcbiAgICAgICAgICAgIFwidGVhbV91cmxcIjogXCJodHRwczovL2FwcC5yaW5nY2VudHJhbC5jb20vbWVzc2FnZXMve3RlYW1faWR9XCIsXG4gICAgICAgICAgICBcInN1bW1hcnlcIjogXCLor7fmgLvnu5PkuIrkuIvmlofliLDov5nph4xcIixcbiAgICAgICAgICAgIFwicmVwbHlfYWR2aWNlXCI6IFwi5bu66K6u55qE5Zue5aSN5aGr5YWl5q2kXCIsXG4gICAgICAgICAgICBcImRhdGV0aW1lXCI6IFwie2RhdGV0aW1lfVwiLFxuICAgICAgICAgICAgfV1cbiAgICAgICAgMi4g5YaN5qyh5qOA5p+l5LiL5Y2z5bCG6L6T5Ye655qE5YaF5a6577yM5piv5ZCm5pyJ6YeN5aSN6K6w5b2V77yM5aaC5p6c5Y+R546w6YeN5aSN6K6w5b2V77yIbWVzc2FnZV9jb250ZW5044CBdGVhbV9pZCDlkowgZGF0ZXRpbWUg6YO955u45ZCM77yJ77yM5L+d55WZ5pe26Ze06L6D5paw55qE6YKj5p2h6K6w5b2V77yM5Yig6Zmk6YeN5aSN55qE6K6w5b2VXG4gICAgICAgIGBcbiAgICAgICAgYXdhaXQgc2VuZE1lc3NhZ2VUb0xMTShwcm9tcHQpO1xuICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICBvbGxhbWFBbmFseXNpc1Byb2dyZXNzOiB7XG4gICAgICAgICAgICB0b3RhbDogZGF0YS5sZW5ndGgsXG4gICAgICAgICAgICBsYXN0QW5hbHl6ZWRJbmRleDogaW5kZXggKyAxLFxuICAgICAgICAgICAgbGFzdEFuYWx5emVkVGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSwgMyAqIDYwICogMTAwMCAqIGluZGV4ICsgMSkpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAvLyDlkIjlubblj5HpgIEgTExNXG4gICAgY29uc3QgbWVzc2FnZXMgPSBkYXRhLnJlZHVjZSgoYWNjLCBpdGVtKSA9PiBgJHthY2N9XFxuXG4gICAgICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIiR7aXRlbS5ncm91cE5hbWV9XCIgdGVhbV9pZD1cIiR7aXRlbS5ncm91cElkfVwiPiR7aXRlbS5wb3N0cy5tYXAoKHBvc3Q6YW55KSA9PiBgXG4gICAgICAgIDxtZXNzYWdlX2NvbnRlbnQgc2VuZGVyPVwiJHtwb3N0LmNyZWF0b3J9XCIgZGF0ZXRpbWU9XCIke3Bvc3QudGltZX1cIj4ke3Bvc3QudGV4dH08L21lc3NhZ2VfY29udGVudD5gKS5qb2luKCcnKX1cbiAgICAgICAgPC9tZXNzYWdlX2dyb3VwPmAsICc8bWVzc2FnZXM+JykgXG4gICAgICAgIC8vIOWinuWKoOiwg+ivleaVsOaNrvCfkYdcbiAgICAgICAgKyBgXFxuXFxuICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIlJlY29yZGluZyBUZXN0XCIgdGVhbV9pZD1cIjEyM1wiPlxuICAgICAgICA8bWVzc2FnZV9jb250ZW50IHNlbmRlcj1cIlNvcGhpYSAoSmlubWVpKSBMaW5cIiBkYXRldGltZT1cIjIwMjUtMDItMTMgMDA6MDA6MDBcIj5SZWNvcmRpbmcgcHJvamVjdCBCRSBkZXBlbmRlbmNpZXMgY29tcGxldGVkPC9tZXNzYWdlX2NvbnRlbnQ+XG4gICAgICAgIDwvbWVzc2FnZV9ncm91cD5gXG4gICAgICAgICsgYFxcblxcbiAgICA8bWVzc2FnZV9ncm91cCB0ZWFtX25hbWU9XCLlpKfnvqRcIiB0ZWFtX2lkPVwiMzIxXCI+XG4gICAgICAgIDxtZXNzYWdlX2NvbnRlbnQgc2VuZGVyPVwiQ29saW4gTGl1XCIgZGF0ZXRpbWU9XCIyMDI1LTAyLTE0IDAwOjAwOjAwXCI+QFRlYW0g5bqU6KaB5rGC77yM5aSn5a625rOo5oSP5LiA5LiL5Yiw5YWs5Y+45pe25YCZ55qE5LiK5LiL54+t5pe26Ze077yM6Iez5bCR5L+d5oyBOOS4quWwj+aXtuWcqOWFrOWPuOeahOaXtumXtO+8jOaXoOeJueauiuaDheWGteS4jeimgeS4reWcuuemu+W8gO+8jOiwouiwouWQhOS9jSDjgII8L21lc3NhZ2VfY29udGVudD5cbiAgICAgICAgPC9tZXNzYWdlX2dyb3VwPmBcbiAgICAgICAgKyAnXFxuICAgIDwvbWVzc2FnZXM+JztcblxuICAgIGNvbnN0IHByb21wdCA9IGBcbiAgICAgICAg5oiR55qE5ZCN5a2X5piv77yaJHt1c2VybmFtZX0g77yI5aaC5p6c6L+H5ruk6KeE5YiZ5Lit5raI5oGv55qE5YaF5a65IG1lc3NhZ2VfY29udGVudCDmnInmj5DliLDmiJHvvIzlj6/kvZzkuLrliKTmlq3mtojmga/mmK/lkKbmnIlA5oiR77yM5Y2z5L6/5piv5LiN5bim5aeT5rCPQOWQjeWtl+mDqOWIhiDkuZ/op4bkuLrmj5Dlj4rvvIzmjpLpmaQgc2VuZGVyIOaYr+aIkeeahOa2iOaBr++8iVxuXG4gICAgICAgIC0tLS0g6L+Z5piv5oiR5pS25Yiw55qE5pyA6L+R6IGK5p2h5raI5oGv5byA5aeLIC0tLS1cbiAgICAgICAgJHttZXNzYWdlc31cbiAgICAgICAgLS0tLSDov5nmmK/miJHmlLbliLDnmoTmnIDov5HogYrmnaHmtojmga/nu5PmnZ8gLS0tLVxuXG4gICAgICAgIOavj+adoSBtZXNzYWdlX2dyb3VwIOmDveaYr+WQjOS4gOS4que+pOe7hOeahOa2iOaBr+mbhuWQiO+8jOWFtuS4reWPr+iDveWMheWQq+S6huWkmuadoeS4jeWQjOS6uuWPkeeahCBtZXNzYWdlX2NvbnRlbnTvvIzkuI3lkIznmoQgbWVzc2FnZV9ncm91cCDkuI3nm7jlhbPogZTjgIJcbiAgICAgICAg5L2g5piv5LiA5Liq5b6I57uG5b+D55qE6aG555uu57uP55CG77yM6K+36K6k55yf5YiG5p6Q5Lul5LiK5raI5oGv77yM5bm25oyJ54Wn5Lul5LiL6KaB5rGC6L+U5Zue5pWw5o2u44CCXG5cbiAgICAgICAgLS0tLSDku6XkuIvmmK/miJHnmoTpnIDmsYLlkozkvaDpnIDopoHov5Tlm57nmoTlhoXlrrnlrprkuYkgLS0tLVxuICAgICAgICDorqnmiJHku6zmnaXkuIDkuKrkuIDkuKrmn6XnnIsgbWVzc2FnZV9ncm91cO+8jOW5tuS4lOmSiOWvueavj+S4qiBtZXNzYWdlX2dyb3VwIOmDveaJp+ihjOS7peS4i+S4ieatpeeahOS7u+WKoe+8mlxuICAgICAgICAxLiDor7fku5Tnu4bpmIXor7sgbWVzc2FnZV9ncm91cCDph4znmoTmr4/mnaHogYrlpKnmtojmga/vvIzliKTmlq3ph4zpnaLnmoQgbWVzc2FnZV9jb250ZW50IOaYr+WQpuacieespuWQiOS7peS4i+inhOWImeWFtuS4reS4gOadoeOAguWmguaenOayoeacieWImei3s+i/h+W5tuafpeeci+S4i+S4gOS4qiBtZXNzYWdlX2dyb3Vw77yaXG4gICAgICAgICR7Y29uY2VybmVkSXRlbXMubWFwKChpdGVtOmFueSwgaTpudW1iZXIpID0+IGAtIOinhOWImSR7aSsxfTogJHtpdGVtLnRleHR9YCkuam9pbignXFxuICAgICAgICAnKX1cbiAgICAgICAgMi4g5a+5IG1lc3NhZ2VfZ3JvdXAg5Lit5pyJ56ym5ZCI6KeE5YiZ55qE5raI5oGv77yM6K+35o+Q5Y+W5Lul5LiL5a2X5q6177yI5Y+q5o+Q5Y+W5Y6f5paH77yM5Y2z5L6/5paH5a2X5b6I5aSa77yM5LiN5YGa5Yig5YeP5LiN5YGa5L+u5pS55LiN5YGa57+76K+R77yM5bm25L+d55WZ5Y6f5pyJ5qC85byP77yJ77yaXG4gICAgICAgIC0gbWVzc2FnZV9jb250ZW50IOa2iOaBr+WOn+aWh+WPiuWFtuWvueW6lOWPkemAgeiAhXNlbmRlcuWSjOWPkemAgeaXtumXtGRhdGV0aW1lLCDov5jmnIltZXNzYWdlX2dyb3Vw5Lit55qEIHRlYW1fbmFtZSwgdGVhbV9pZCwg5Lul5Y+K56ym5ZCI55qE6KeE5YiZeFxuICAgICAgICAzLiDlr7kgbWVzc2FnZV9ncm91cCDkuK3liJrmnInnrKblkIjop4TliJnnmoTmtojmga/vvIzmr4/mnaHnlJ/miJDlr7nlupTnmoTov5kgMyDkuKrmlrDlrZfmrrXvvJpcbiAgICAgICAgLSBtYXRjaGVkX3J1bGU6IOS4iumdouesrOS4gOatpeeahOespuWQiOWIsOeahOinhOWImXjnmoTljp/mloflhoXlrrlcbiAgICAgICAgLSBmaWx0ZXJfcmVhc29uOiDpgInmi6nov5nmnaHmtojmga/ov4fmu6Tlh7rmnaXnmoTljp/lm6DvvIzlj6/ku6XnlKjkuK3mlofooajovr5cbiAgICAgICAgLSBzdW1tYXJ5OiDlr7nov5nmnaHmtojmga/miYDlnKjnmoQgbWVzc2FnZV9ncm91cCDnmoTlhbbku5bmtojmga/nmoTkuIrkuIvmloflgZrlh7rmgLvnu5PlubbpgILlvZPnmoTmjqjnkIbkuLrku4DkuYhzZW5kZXLkvJrlj5Hlh7rov5nkuKrmtojmga/jgILor7fkuI3opoHnlZnnqbrvvIzov5nph4zlj6/ku6XnlKjkuK3mlodcbiAgICAgICAgLSByZXBseV9hZHZpY2U6IOmSiOWvuei/meadoea2iOaBr+eahOS4iuS4i+aWh++8jOe7meWHuuWbnuWkjeW7uuiuru+8jOWbnuWkjeeUqOeahOivreiogOi3n+maj+S4iuS4i+aWh+iBiuWkqeivreiogOOAguWmguaenOinieW+l+i/meadoea2iOaBr+S4jemcgOimgeWbnuWkje+8jOivt+WbnuWkjeepuuWtl+espuS4slxuICAgICAgICDnu5PmnZ/lvZPliY0gbWVzc2FnZV9ncm91cCDnmoTkuInmraXku7vliqHlkI7vvIzlvIDlp4vpgY3ljobkuIvkuIDkuKogbWVzc2FnZV9ncm91cO+8jOebtOWIsOaJgOaciSBtZXNzYWdlX2dyb3VwIOmDvemBjeWOhuWujOaIkOOAglxuXG4gICAgICAgIOWwhuS7u+WKoei+k+WHuueahOaVsOaNrui/m+ihjOWmguS4i+mqjOivge+8mlxuICAgICAgICAxLiDku6XkuKXmoLxKU09O5qC85byP6L6T5Ye677yM5LuF5YyF5ZCr5Yy56YWN55qE5raI5oGv44CC5aaC5p6c5rKh5pyJ5Yy56YWN5Lu75L2V6KeE5YiZ77yM6L6T5Ye656m6W13mlbDnu4TvvJpcbiAgICAgICAgW3tcbiAgICAgICAgICAgIFwibWVzc2FnZV9jb250ZW50XCI6IFwie21lc3NhZ2VfY29udGVudH1cIixcbiAgICAgICAgICAgIFwic2VuZGVyXCI6IFwie3NlbmRlcn1cIixcbiAgICAgICAgICAgIFwibWF0Y2hlZF9ydWxlXCI6IFwi5omA56ym5ZCI55qE6KeE5YiZ55qE5YaF5a65XCIsXG4gICAgICAgICAgICBcImZpbHRlcl9yZWFzb25cIjogXCJcIixcbiAgICAgICAgICAgIFwidGVhbV9uYW1lXCI6IFwie3RlYW1fbmFtZX1cIixcbiAgICAgICAgICAgIFwidGVhbV9pZFwiOiBcInt0ZWFtX2lkfVwiLFxuICAgICAgICAgICAgXCJ0ZWFtX3VybFwiOiBcImh0dHBzOi8vYXBwLnJpbmdjZW50cmFsLmNvbS9tZXNzYWdlcy97dGVhbV9pZH1cIixcbiAgICAgICAgICAgIFwic3VtbWFyeVwiOiBcIuivt+aAu+e7k+S4iuS4i+aWh+WIsOi/memHjFwiLFxuICAgICAgICAgICAgXCJyZXBseV9hZHZpY2VcIjogXCLlu7rorq7nmoTlm57lpI3loavlhaXmraRcIixcbiAgICAgICAgICAgIFwiZGF0ZXRpbWVcIjogXCJ7ZGF0ZXRpbWV9XCIsXG4gICAgICAgIH1dXG4gICAgICAgIDIuIOWGjeasoeajgOafpeS4i+WNs+Wwhui+k+WHuueahOWGheWuue+8jOaYr+WQpuaciemHjeWkjeiusOW9le+8jOWmguaenOWPkeeOsOmHjeWkjeiusOW9le+8iG1lc3NhZ2VfY29udGVudOOAgXRlYW1faWQg5ZKMIGRhdGV0aW1lIOmDveebuOWQjO+8ie+8jOS/neeVmeaXtumXtOi+g+aWsOeahOmCo+adoeiusOW9le+8jOWIoOmZpOmHjeWkjeeahOiusOW9lVxuICAgIGBcbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICBvbGxhbWFBbmFseXNpc1Byb2dyZXNzOiB7XG4gICAgICAgIHRvdGFsOiAxLFxuICAgICAgICBsYXN0QW5hbHl6ZWRJbmRleDogMCxcbiAgICAgICAgbGFzdEFuYWx5emVkVGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhd2FpdCBzZW5kTWVzc2FnZVRvTExNKHByb21wdCk7XG4gICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcbiAgICAgICAgb2xsYW1hQW5hbHlzaXNQcm9ncmVzczoge1xuICAgICAgICB0b3RhbDogMSxcbiAgICAgICAgbGFzdEFuYWx5emVkSW5kZXg6IDEsXG4gICAgICAgIGxhc3RBbmFseXplZFRpbWU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgfVxufVxuXG5jb25zdCBzZW5kTWVzc2FnZVRvTExNID0gYXN5bmMgKHByb21wdDogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1NlbmRpbmcgcHJvbXB0IHRvIE9sbGFtYTonLCBwcm9tcHQpO1xuICAgIHRyeSB7XG4gICAgICAgIC8vIOajgOafpeaYr+WQpuWcqCBiYWNrZ3JvdW5kIHNjcmlwdCDnjq/looPkuK1cbiAgICAgICAgY29uc3QgaXNCYWNrZ3JvdW5kID0gdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCc7XG4gICAgICAgIGlmIChpc0JhY2tncm91bmQpIHtcbiAgICAgICAgICAgIC8vIOWcqCBiYWNrZ3JvdW5kIHNjcmlwdCDkuK3nm7TmjqXosIPnlKjlpITnkIblh73mlbBcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmV2aWV3TWVzc2FnZUJ5TExNQW5kU2VuZFRvQm90KHsgcHJvbXB0IH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5ZyoIGNvbnRlbnQgc2NyaXB0IOaIluWFtuS7lueOr+Wig+S4reS9v+eUqCBtZXNzYWdlIHBhc3NpbmdcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdMTE1fUkVRVUVTVCcsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBib2R5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IHByb21wdFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJMTE0ncyByZXNwb25zZTpcIiwgcmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCdBbmFseXNpcyBjb21wbGV0ZSwgcGxlYXNlIGNoZWNrIHRoZSBjb25zb2xlJywgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1JlY2VpdmVkIGludmFsaWQgcmVzcG9uc2UgZm9ybWF0IGZyb20gTExNJyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlVuZXhwZWN0ZWQgcmVzcG9uc2UgZm9ybWF0OlwiLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KGVycm9yLm1lc3NhZ2UsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHNlbmRNZXNzYWdlVG9MTE06XCIsIGVycm9yKTtcbiAgICAgICAgc2hvd1RvYXN0KGBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsICdlcnJvcicpO1xuICAgIH1cbn07XG5cbi8vIOaVtOWQiOWkhOeQhuivt+axguS7peWPiuaOqOmAgSBib3Qg5raI5oGvXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmV2aWV3TWVzc2FnZUJ5TExNQW5kU2VuZFRvQm90KGJvZHk6IGFueSkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgY29uY2VybmVkSXRlbXMgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgnY29uY2VybmVkSXRlbXMnKTtcbiAgICAgICAgY29uc3QgW3JhdywganNvbkFycmF5XSA9IGF3YWl0IGhhbmRsZUxMTVJlcXVlc3QoYm9keSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdMTE0gcmVzcG9uc2U6JywgcmF3KTtcbiAgICAgICAgY29uc29sZS5sb2coJ0xMTSBqc29uQXJyYXk6JywganNvbkFycmF5KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChqc29uQXJyYXkgJiYganNvbkFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGpzb25BcnJheS5mb3JFYWNoKGFzeW5jIGpzb24gPT4ge1xuICAgICAgICAgICAgICAgIGxldCBtYXRjaGVkX3J1bGUgPSBqc29uLm1hdGNoZWRfcnVsZTtcbiAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgICAgICAgICAvLyDlhYjov5vooYwgTExNIOWuoeaguFxuICAgICAgICAgICAgICAgICAgY29uc3QgcmV2aWV3UHJvbXB0ID0gYOa2iOaBr+WGheWuue+8miR7anNvbi5tZXNzYWdlX2NvbnRlbnR9XG4gICAgICAgICAgICAgICAgICAgIOivt+WuoeaguOS7peS4iua2iOaBr+aYr+WQpuespuWQiOi/meS6m+i/h+a7pOinhOWImeS4reeahOS7u+aEj+S4gOadoe+8mlxuICAgICAgICAgICAgICAgICAgICAke2NvbmNlcm5lZEl0ZW1zLm1hcCgoaXRlbTphbnksIGk6bnVtYmVyKSA9PiBgLSDop4TliJkke2krMX06ICR7aXRlbS50ZXh0fWApLmpvaW4oJ1xcbiAgICAgICAgICAgICAgICAgICAgJyl9XG5cbiAgICAgICAgICAgICAgICAgICAg5aaC5p6c56ym5ZCI6KeE5YiZ77yM6K+355u05o6l6L+U5Zue56ym5ZCI55qE6KeE5YiZ5Y6f5paH77yM5LiN6KaB5YyF5ZCr5YW25LuW5YaF5a6544CC5aaC5p6c5LiN56ym5ZCI5Lu75L2V6KeE5YiZ77yM6K+36L+U5ZueXCLkuI3pgJrov4dcIuOAglxuICAgICAgICAgICAgICAgICAgYDtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZXZpZXdQcm9tcHQnLCByZXZpZXdQcm9tcHQpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgW3Jldmlld1Jlc3BvbnNlUmF3XSA9IGF3YWl0IGhhbmRsZUxMTVJlcXVlc3QoeyBwcm9tcHQ6IHJldmlld1Byb21wdCB9KTtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZXZpZXdSZXNwb25zZVJhdycsIHJldmlld1Jlc3BvbnNlUmF3KTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmlld1Jlc3BvbnNlID0gcmV2aWV3UmVzcG9uc2VSYXcucmVwbGFjZSgvPHRoaW5rPltcXHNcXFNdKj88XFwvdGhpbms+L2csICcnKS50cmltKClcbiAgICAgICAgICAgICAgICAgIGlmIChyZXZpZXdSZXNwb25zZS5pbmNsdWRlcygn5LiN6YCa6L+HJykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAvLyDlrqHmoLjkuI3pgJrov4fnm7TmjqXot7Pov4dcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIG1hdGNoZWRfcnVsZSA9IHJldmlld1Jlc3BvbnNlLmxlbmd0aCA8IDEwMCA/IHJldmlld1Jlc3BvbnNlIDogbWF0Y2hlZF9ydWxlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzZW5kQm90TWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZWRfcnVsZSxcbiAgICAgICAgICAgICAgICAgICAgdGVhbV9uYW1lOiBqc29uLnRlYW1fbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdGVhbV9pZDoganNvbi50ZWFtX2lkLFxuICAgICAgICAgICAgICAgICAgICBzZW5kZXI6IGpzb24uc2VuZGVyLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlX2NvbnRlbnQ6IGpzb24ubWVzc2FnZV9jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBqc29uLnN1bW1hcnksXG4gICAgICAgICAgICAgICAgICAgIHJlcGx5X2FkdmljZToganNvbi5yZXBseV9hZHZpY2VcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByYXdcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdMTE0gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgZGV0YWlsczogYEZhaWxlZCB0byBjb25uZWN0IHRvICR7cHJvY2Vzcy5lbnYuTExNX1RZUEV9IHNlcnZpY2VgXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG5cbiAgLy8g56e76Zmk546w5pyJ55qEIFRvYXN0IOWFg+e0oFxuICBjb25zdCBleGlzdGluZ1RvYXN0ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5yYWRhci1wb2MtdG9hc3QnKTtcbiAgaWYgKGV4aXN0aW5nVG9hc3QpIHtcbiAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQoZXhpc3RpbmdUb2FzdCk7XG4gIH1cblxuICAvLyDliJvlu7rmlrDnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9IGByYWRhci1wb2MtdG9hc3QgcmFkYXItcG9jLXRvYXN0LSR7dHlwZX1gO1xuXG4gIGNvbnN0IHRvYXN0SW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3RJbm5lci5jbGFzc05hbWUgPSAncmFkYXItcG9jLXRvYXN0LWlubmVyJztcbiAgdG9hc3RJbm5lci50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cbiAgdG9hc3QuYXBwZW5kQ2hpbGQodG9hc3RJbm5lcik7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XG5cbiAgLy8g6K6+572u5a6a5pe25Zmo5ZyoIDMg56eS5ZCO5YWz6ZetIFRvYXN0XG4gIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9LCAzMDAwKTtcblxuICAvLyDov5Tlm57kuIDkuKrlh73mlbDku6Xkvr/miYvliqjlhbPpl60gVG9hc3RcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgIGlmIChjb250YWluZXIuY29udGFpbnModG9hc3QpKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgIH1cbiAgICBpZiAob25DbG9zZSkge1xuICAgICAgb25DbG9zZSgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUdyb3VwTGlua3MoaW5wdXRTdHJpbmc6IHN0cmluZykge1xuICBjb25zdCBncm91cExpbmtQYXR0ZXJuID0gL1xcW2dyb3VwOiguKyk6KFxcZCspXFxdL2c7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShncm91cExpbmtQYXR0ZXJuLCAobWF0Y2gsIGdyb3VwTmFtZSwgZ3JvdXBJZCkgPT4ge1xuICAgIHJldHVybiBgWyR7Z3JvdXBOYW1lfV0oL21lc3NhZ2VzLyR7Z3JvdXBJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybVBvc3RMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IHBvc3RMaW5rUGF0dGVybiA9IC9cXFtwb3N0OihcXGQrKVxcXS9nO1xuICBsZXQgaW5kZXggPSAxO1xuICBjb25zdCB0cmFuc2Zvcm1lZFN0cmluZyA9IGlucHV0U3RyaW5nLnJlcGxhY2UocG9zdExpbmtQYXR0ZXJuLCAobWF0Y2gsIHBvc3RJZCkgPT4ge1xuICAgIHJldHVybiBgW1ske2luZGV4Kyt9XV0oL2wke3dpbmRvdy5sb2NhdGlvbi5wYXRobmFtZX0vJHtwb3N0SWR9KWA7XG4gIH0pO1xuICByZXR1cm4gdHJhbnNmb3JtZWRTdHJpbmc7XG59XG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IGFuYWx5emVNZXNzYWdlcywgcmV2aWV3TWVzc2FnZUJ5TExNQW5kU2VuZFRvQm90IH0gZnJvbSAnLi9tZXNzYWdlRGVhbGluZyc7XG5jb25zdCBzY2hlZHVsZWRJbnRlcnZhbCA9IDEyMDsgIC8vIOavjzLlsI/ml7bmiafooYzkuIDmrKFcblxuY29uc29sZS5sb2coJ0JhY2tncm91bmQgc2NyaXB0IGxvYWRlZCcpO1xuXG4vLyDmianlsZXlronoo4XmiJbmm7TmlrDml7bvvIznq4vljbPliJvlu7rlrprml7bku7vliqFcbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnRXh0ZW5zaW9uIGluc3RhbGxlZC91cGRhdGVkJyk7XG5cbiAgICAvLyDliJ3lp4vljJbphY3nva5cbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoJ3NjaGVkdWxlQWN0aXZlJyk7XG4gICAgY2hyb21lLnN0b3JhZ2UubG9jYWwucmVtb3ZlKCdvbGxhbWFBbmFseXNpc1Byb2dyZXNzJyk7XG4gICAgXG4gICAgLy8g6I635Y+W5bm25riF55CG6L+H5pyf55qEIGNvbmNlcm5lZEl0ZW1zXG4gICAgY29uc3Qgc3RvcmFnZSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgnY29uY2VybmVkSXRlbXMnKTtcbiAgICBpZiAoc3RvcmFnZS5jb25jZXJuZWRJdGVtcykge1xuICAgICAgICAvLyDov4fmu6Tmjonov4fmnJ/nmoTpobnnm65cbiAgICAgICAgY29uc3QgdmFsaWRJdGVtcyA9IHN0b3JhZ2UuY29uY2VybmVkSXRlbXMuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgICAgICAgcmV0dXJuICFpdGVtLmV4cGlyZWRBdCB8fCBuZXcgRGF0ZShpdGVtLmV4cGlyZWRBdCkgPiBuZXcgRGF0ZSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWmguaenOaciemhueebruiiq+i/h+a7pOaOie+8jOabtOaWsOWtmOWCqFxuICAgICAgICBpZiAodmFsaWRJdGVtcy5sZW5ndGggIT09IHN0b3JhZ2UuY29uY2VybmVkSXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBjb25jZXJuZWRJdGVtczogdmFsaWRJdGVtcyB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDlpoLmnpzmsqHmnIkgY29uY2VybmVkSXRlbXMg5oiW5bey5riF56m677yM6K6+572u6buY6K6k5YC8XG4gICAgaWYgKCFzdG9yYWdlLmNvbmNlcm5lZEl0ZW1zIHx8IHN0b3JhZ2UuY29uY2VybmVkSXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7Y29uY2VybmVkSXRlbXM6IFtcbiAgICAgICAgICAgIHt0ZXh0OifogYrliLDlhbPkuo7lhazlj7jmlL/nrZbvvIzkuZ/lj6/ku6XmmK/mlL/nrZbnm7jlhbPnmoTlhavljabmtojmga8nfSxcbiAgICAgICAgICAgIHt0ZXh0Oifku7vkvZXmmI7noa4gQOaIkSDnmoTmtojmga/vvIzmiJbogIXmj5DliLDmiJHnmoTlkI3lrZfnmoTmtojmga8nfSxcbiAgICAgICAgXX0pO1xuICAgIH1cblxuICAgIC8vIOafpeaJvuW5tuWIt+aWsCBSaW5nQ2VudHJhbCDmoIfnrb7pobVcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByY1RhYiA9IGF3YWl0IGZpbmRSaW5nQ2VudHJhbFRhYigpO1xuICAgICAgICBpZiAocmNUYWIgJiYgcmNUYWIuaWQpIHtcbiAgICAgICAgICAgIGF3YWl0IGNocm9tZS50YWJzLnJlbG9hZChyY1RhYi5pZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmluZ0NlbnRyYWwgdGFiIHJlZnJlc2hlZCcpO1xuXG4gICAgICAgICAgICAvLyDlu7bov5/ojrflj5YgUkMgUmFkYXIg6YWN572uXG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICAgICAgICAgIGNvbmZpZzogYXdhaXQgZ2V0Q29uZmlnRnJvbVdlYnBhZ2UoKSB8fCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdEdyb3VwTmFtZXM6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZU1lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZVNtczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZVZvaWNlbWFpbDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZUNhbGxUcmFuc2NyaXB0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlQ2FsZW5kYXI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVDYW5kaWRhdGVRdWVzdGlvbnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RGb2xkZXJHcm91cElkczogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgdXNlcm5hbWU6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIGV4dGVuc2lvbklkOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICBhcGlLZXk6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsOiBcIjRvXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gcmVmcmVzaCBSaW5nQ2VudHJhbCB0YWI6JywgZXJyb3IpO1xuICAgIH1cbn0pO1xuXG4vLyDnm5HlkKzlrprml7bku7vliqFcbmNocm9tZS5hbGFybXMub25BbGFybS5hZGRMaXN0ZW5lcigoYWxhcm0pID0+IHtcbiAgICBjb25zb2xlLmxvZygnYWxhcm0nLCBhbGFybSk7XG4gICAgaWYgKGFsYXJtLm5hbWUgPT09ICdjaGVja01lc3NhZ2VzJykge1xuICAgICAgICBjb25zb2xlLmxvZygnUnVubmluZyBzY2hlZHVsZWQgbWVzc2FnZSBjaGVjay4uLicpO1xuICAgICAgICBydW5TY2hlZHVsZWRUYXNrKCk7XG4gICAgfVxufSk7XG5cbi8vIOWOn+adpeeahOebkeWQrOWZqOeugOWMluS4uu+8mlxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGFzeW5jIChyZXF1ZXN0LCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmVkIG1lc3NhZ2U6JywgcmVxdWVzdCk7XG5cbiAgICAvLyDlpoLmnpzkuI3mmK8gYmFja2dyb3VuZCDlrprml7bnqIvluo/vvIzkvJrku47pobXpnaLlj5HpgIHor7fmsYLliLDov5nph4zmiafooYxcbiAgICBpZiAocmVxdWVzdC50eXBlID09PSAnTExNX1JFUVVFU1QnKSB7XG4gICAgICAgIGNvbnN0IHsgYm9keSB9ID0gcmVxdWVzdC5kYXRhO1xuICAgICAgICBjb25zb2xlLmxvZygnU2VuZGluZyByZXF1ZXN0IHRvIExMTTonLCBib2R5KTtcbiAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgcmV2aWV3TWVzc2FnZUJ5TExNQW5kU2VuZFRvQm90KGJvZHkpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBkYXRhOiByYXcgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0LnR5cGUgPT09ICdDT05UUk9MX1NDSEVEVUxFRF9DSEVDSycpIHtcbiAgICAgICAgaWYgKHJlcXVlc3QuYWN0aW9uID09PSAnc3RhcnQnKSB7XG4gICAgICAgICAgICBzdGFydFNjaGVkdWxlZENoZWNrKCk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdGF0dXM6ICdzdGFydGVkJyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ3N0b3AnKSB7XG4gICAgICAgICAgICBzdG9wU2NoZWR1bGVkQ2hlY2soKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN0YXR1czogJ3N0b3BwZWQnIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn0pO1xuXG4vLyDlkK/liqjlrprml7bku7vliqFcbmxldCB0aW1lckZpcnN0UnVuQWxhcm1zOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0U2NoZWR1bGVkQ2hlY2soKSB7XG4gICAgdGltZXJGaXJzdFJ1bkFsYXJtcyA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBydW5TY2hlZHVsZWRUYXNrKCk7IC8vIOeri+WNs+aJp+ihjOS4gOasoVxuICAgIH0sIDEwMDAwKTtcbiAgICBjaHJvbWUuYWxhcm1zLmNyZWF0ZSgnY2hlY2tNZXNzYWdlcycsIHtcbiAgICAgICAgcGVyaW9kSW5NaW51dGVzOiBzY2hlZHVsZWRJbnRlcnZhbFxuICAgIH0pO1xuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHNjaGVkdWxlQWN0aXZlOiB0cnVlIH0pO1xuICAgIGNvbnNvbGUubG9nKCdTY2hlZHVsZWQgbWVzc2FnZSBjaGVjayBzdGFydGVkJyk7XG59XG5cbi8vIOWBnOatouWumuaXtuS7u+WKoVxuZXhwb3J0IGZ1bmN0aW9uIHN0b3BTY2hlZHVsZWRDaGVjaygpIHtcbiAgICBjbGVhclRpbWVvdXQodGltZXJGaXJzdFJ1bkFsYXJtcyk7XG4gICAgY2hyb21lLmFsYXJtcy5jbGVhcignY2hlY2tNZXNzYWdlcycpO1xuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHNjaGVkdWxlQWN0aXZlOiBmYWxzZSB9KTtcbiAgICBjb25zb2xlLmxvZygnU2NoZWR1bGVkIG1lc3NhZ2UgY2hlY2sgc3RvcHBlZCcpO1xufVxuXG4vLyDlrprml7bmipPlj5bliIbmnpDmtojmga9cbmFzeW5jIGZ1bmN0aW9uIHJ1blNjaGVkdWxlZFRhc2soKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g5p+l5om+5oiW5Yib5bu6IFJpbmdDZW50cmFsIOagh+etvumhtVxuICAgICAgICBsZXQgcmNUYWIgPSBhd2FpdCBmaW5kUmluZ0NlbnRyYWxUYWIoKTtcbiAgICAgICAgaWYgKCFyY1RhYikge1xuICAgICAgICAgICAgcmNUYWIgPSBhd2FpdCBjcmVhdGVSaW5nQ2VudHJhbFRhYigpO1xuICAgICAgICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICAgICAgICBhd2FpdCB3YWl0Rm9yVGFiTG9hZChyY1RhYi5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgeyBjb25maWcgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2NvbmZpZyddKVxuICAgICAgICBpZiAoIWNvbmZpZykgY29uZmlnID0gYXdhaXQgZ2V0Q29uZmlnRnJvbVdlYnBhZ2UoKTtcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIChzY2hlZHVsZWRJbnRlcnZhbCArIDUpICogNjAgKiAxMDAwKTtcblxuICAgICAgICAvLyDlsJ3or5Xlj5HpgIHmtojmga/vvIzlpoLmnpzlpLHotKXliJnph43or5VcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZW5kTWVzc2FnZVdpdGhSZXRyeShyY1RhYi5pZCwge1xuICAgICAgICAgICAgdHlwZTogJ0ZFVENIX1VTRVJfREFUQScsXG4gICAgICAgICAgICBzdGFydFRpbWUsXG4gICAgICAgICAgICBjb25maWdcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IGFuYWx5emVNZXNzYWdlcyhyZXNwb25zZS5kYXRhLCBjb25maWcpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0JhY2tncm91bmQgdGFzayBlcnJvcjonLCBlcnJvcik7XG4gICAgfVxufVxuXG4vLyDmn6Xmib7lt7LmiZPlvIDnmoQgUmluZ0NlbnRyYWwg5qCH562+6aG1XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZFJpbmdDZW50cmFsVGFiKCkge1xuICAgIGNvbnN0IHRhYnMgPSBhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7XG4gICAgICAgIHVybDogXCIqOi8vYXBwLnJpbmdjZW50cmFsLmNvbS8qXCJcbiAgICB9KTtcbiAgICByZXR1cm4gdGFic1swXTtcbn1cblxuLy8g5Yib5bu65paw55qEIFJpbmdDZW50cmFsIOagh+etvumhtVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVJpbmdDZW50cmFsVGFiKCkge1xuICAgIHJldHVybiBhd2FpdCBjaHJvbWUudGFicy5jcmVhdGUoe1xuICAgICAgICB1cmw6IFwiaHR0cHM6Ly9hcHAucmluZ2NlbnRyYWwuY29tL3ZpZGVvXCIsXG4gICAgICAgIGFjdGl2ZTogZmFsc2VcbiAgICB9KTtcbn1cblxuLy8g562J5b6F5qCH562+6aG15Yqg6L295a6M5oiQXG5leHBvcnQgZnVuY3Rpb24gd2FpdEZvclRhYkxvYWQodGFiSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjaHJvbWUudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoZnVuY3Rpb24gbGlzdGVuZXIodXBkYXRlZFRhYklkLCBpbmZvKSB7XG4gICAgICAgICAgICBpZiAodXBkYXRlZFRhYklkID09PSB0YWJJZCAmJiBpbmZvLnN0YXR1cyA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLm9uVXBkYXRlZC5yZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgLy8g57uZ6aG16Z2i5LiA5Lqb6aKd5aSW5pe26Ze05p2l5Yid5aeL5YyWIGNvbnRlbnQgc2NyaXB0XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChyZXNvbHZlLCAxMDAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbi8vIOW4pumHjeivleacuuWItueahOa2iOaBr+WPkemAgeWHveaVsFxuZnVuY3Rpb24gc2VuZE1lc3NhZ2VXaXRoUmV0cnkodGFiSWQ6IG51bWJlciwgbWVzc2FnZTogYW55LCBtYXhSZXRyaWVzID0gMyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgbGV0IGF0dGVtcHRzID0gMDtcblxuICAgICAgICBjb25zdCB0cnlTZW5kTWVzc2FnZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGF0dGVtcHRzKys7XG4gICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJJZCwgbWVzc2FnZSwgcmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEF0dGVtcHQgJHthdHRlbXB0c30gZmFpbGVkOmAsIGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRlbXB0cyA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQodHJ5U2VuZE1lc3NhZ2UsIDUwMDApOyAvLyA156eS5ZCO6YeN6K+VXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdGYWlsZWQgdG8gc2VuZCBtZXNzYWdlIGFmdGVyIG11bHRpcGxlIGF0dGVtcHRzJykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmICFyZXNwb25zZS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggdXNlciBkYXRhOiAnICsgcmVzcG9uc2U/LmVycm9yKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0cnlTZW5kTWVzc2FnZSgpO1xuICAgIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDb25maWdGcm9tV2VicGFnZSgpIHtcbiAgICBsZXQgcmNUYWIgPSBhd2FpdCBmaW5kUmluZ0NlbnRyYWxUYWIoKTtcbiAgICBpZiAoIXJjVGFiKSB7XG4gICAgICAgIHJjVGFiID0gYXdhaXQgY3JlYXRlUmluZ0NlbnRyYWxUYWIoKTtcbiAgICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICAgIGF3YWl0IHdhaXRGb3JUYWJMb2FkKHJjVGFiLmlkKTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZW5kTWVzc2FnZVdpdGhSZXRyeShyY1RhYi5pZCwge1xuICAgICAgICAgICAgdHlwZTogJ0dFVF9DT05GSUcnXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzcG9uc2UuY29uZmlnO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgY29uZmlnOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufSAiXSwibmFtZXMiOlsiT3BlbkFJIiwib3BlbmFpIiwiYXBpS2V5IiwicHJvY2VzcyIsImVudiIsIk9QRU5BSV9BUElfS0VZIiwiYmFzZVVSTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJkYW5nZXJvdXNseUFsbG93QnJvd3NlciIsImhhbmRsZUxMTVJlcXVlc3QiLCJib2R5IiwiaGFuZGxlciIsIkxMTV9UWVBFIiwiaGFuZGxlT2xsYW1hUmVxdWVzdCIsImhhbmRsZU9wZW5BSVJlcXVlc3QiLCJyZXNwb25zZSIsImpzb25EYXRhIiwiZXh0cmFjdEpzb25Gcm9tUmVzcG9uc2UiLCJmZXRjaCIsIk9MTEFNQV9CQVNFX1VSTCIsIm1ldGhvZCIsImhlYWRlcnMiLCJKU09OIiwic3RyaW5naWZ5IiwibW9kZWwiLCJPTExBTUFfTU9ERUwiLCJwcm9tcHQiLCJzdHJlYW0iLCJ0ZW1wZXJhdHVyZSIsInRvcF9wIiwib2siLCJFcnJvciIsInN0YXR1cyIsInJlc3VsdCIsImpzb24iLCJjb21wbGV0aW9uIiwiY2hhdCIsImNvbXBsZXRpb25zIiwiY3JlYXRlIiwiT1BFTkFJX01PREVMIiwibWVzc2FnZXMiLCJyb2xlIiwiY29udGVudCIsImNob2ljZXMiLCJtZXNzYWdlIiwiZGlyZWN0UGFyc2UiLCJwYXJzZSIsInRyaW0iLCJBcnJheSIsImlzQXJyYXkiLCJlIiwianNvbk1hdGNoIiwibWF0Y2giLCJwYXJzZWREYXRhIiwianNvblJlZ2V4IiwicG90ZW50aWFsSnNvbiIsImNvbnNvbGUiLCJ3YXJuIiwic2hvd1RvYXN0IiwiYW5hbHl6ZU1lc3NhZ2VzIiwiZGF0YSIsImNvbmZpZyIsInVzZXJuYW1lIiwiY29uY2VybmVkSXRlbXMiLCJjaHJvbWUiLCJzdG9yYWdlIiwibG9jYWwiLCJnZXQiLCJ0ZXh0IiwibG9nIiwic2V0Iiwib2xsYW1hQW5hbHlzaXNQcm9ncmVzcyIsInRvdGFsIiwibGVuZ3RoIiwibGFzdEFuYWx5emVkSW5kZXgiLCJsYXN0QW5hbHl6ZWRUaW1lIiwiRGF0ZSIsInRvSVNPU3RyaW5nIiwiZm9yRWFjaCIsIml0ZW0iLCJpbmRleCIsInNldFRpbWVvdXQiLCJncm91cE5hbWUiLCJncm91cElkIiwicG9zdHMiLCJtYXAiLCJwb3N0IiwiY3JlYXRvciIsInRpbWUiLCJqb2luIiwiaSIsInNlbmRNZXNzYWdlVG9MTE0iLCJyZWR1Y2UiLCJhY2MiLCJpc0JhY2tncm91bmQiLCJ3aW5kb3ciLCJyZXZpZXdNZXNzYWdlQnlMTE1BbmRTZW5kVG9Cb3QiLCJydW50aW1lIiwic2VuZE1lc3NhZ2UiLCJ0eXBlIiwiZXJyb3IiLCJyYXciLCJqc29uQXJyYXkiLCJtYXRjaGVkX3J1bGUiLCJMTE1fUkVWSUVXX0JFRk9SRV9TRU5EIiwicmV2aWV3UHJvbXB0IiwibWVzc2FnZV9jb250ZW50IiwicmV2aWV3UmVzcG9uc2VSYXciLCJyZXZpZXdSZXNwb25zZSIsInJlcGxhY2UiLCJpbmNsdWRlcyIsInNlbmRCb3RNZXNzYWdlIiwidGVhbV9uYW1lIiwidGVhbV9pZCIsInNlbmRlciIsInN1bW1hcnkiLCJyZXBseV9hZHZpY2UiLCJjYXRjaCIsImRldGFpbHMiLCJmb3JtYXREYXRlIiwiZGF0ZVN0cmluZyIsImRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsImtleSIsInNlZW4iLCJTZXQiLCJmaWx0ZXIiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwiZXhpc3RpbmdUb2FzdCIsInF1ZXJ5U2VsZWN0b3IiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJ0ZXh0Q29udGVudCIsImFwcGVuZENoaWxkIiwidGltZXIiLCJjb250YWlucyIsImNsZWFyVGltZW91dCIsInRyYW5zZm9ybUdyb3VwTGlua3MiLCJpbnB1dFN0cmluZyIsImdyb3VwTGlua1BhdHRlcm4iLCJ0cmFuc2Zvcm1lZFN0cmluZyIsInRyYW5zZm9ybVBvc3RMaW5rcyIsInBvc3RMaW5rUGF0dGVybiIsInBvc3RJZCIsImxvY2F0aW9uIiwicGF0aG5hbWUiLCJzY2hlZHVsZWRJbnRlcnZhbCIsIm9uSW5zdGFsbGVkIiwiYWRkTGlzdGVuZXIiLCJyZW1vdmUiLCJ2YWxpZEl0ZW1zIiwiZXhwaXJlZEF0IiwicmNUYWIiLCJmaW5kUmluZ0NlbnRyYWxUYWIiLCJpZCIsInRhYnMiLCJyZWxvYWQiLCJnZXRDb25maWdGcm9tV2VicGFnZSIsInNlbGVjdEdyb3VwTmFtZXMiLCJlbmFibGVNZXNzYWdlIiwiZW5hYmxlU21zIiwiZW5hYmxlVm9pY2VtYWlsIiwiZW5hYmxlQ2FsbFRyYW5zY3JpcHQiLCJlbmFibGVDYWxlbmRhciIsImVuYWJsZUNhbmRpZGF0ZVF1ZXN0aW9ucyIsInNlbGVjdEZvbGRlckdyb3VwSWRzIiwiZXh0ZW5zaW9uSWQiLCJhbGFybXMiLCJvbkFsYXJtIiwiYWxhcm0iLCJuYW1lIiwicnVuU2NoZWR1bGVkVGFzayIsIm9uTWVzc2FnZSIsInJlcXVlc3QiLCJzZW5kUmVzcG9uc2UiLCJhY3Rpb24iLCJzdGFydFNjaGVkdWxlZENoZWNrIiwic3RvcFNjaGVkdWxlZENoZWNrIiwidGltZXJGaXJzdFJ1bkFsYXJtcyIsInBlcmlvZEluTWludXRlcyIsInNjaGVkdWxlQWN0aXZlIiwiY2xlYXIiLCJjcmVhdGVSaW5nQ2VudHJhbFRhYiIsIndhaXRGb3JUYWJMb2FkIiwic3RhcnRUaW1lIiwibm93Iiwic2VuZE1lc3NhZ2VXaXRoUmV0cnkiLCJxdWVyeSIsInVybCIsImFjdGl2ZSIsInRhYklkIiwiUHJvbWlzZSIsInJlc29sdmUiLCJvblVwZGF0ZWQiLCJsaXN0ZW5lciIsInVwZGF0ZWRUYWJJZCIsImluZm8iLCJyZW1vdmVMaXN0ZW5lciIsIm1heFJldHJpZXMiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJyZWplY3QiLCJhdHRlbXB0cyIsInRyeVNlbmRNZXNzYWdlIiwibGFzdEVycm9yIl0sInNvdXJjZVJvb3QiOiIifQ==