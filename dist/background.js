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

/***/ "./src/api.ts":
/*!********************!*\
  !*** ./src/api.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   customQuery: () => (/* binding */ customQuery),
/* harmony export */   delete_indexing: () => (/* binding */ delete_indexing),
/* harmony export */   fetchDifyServer: () => (/* binding */ fetchDifyServer),
/* harmony export */   fetchLastIndexTime: () => (/* binding */ fetchLastIndexTime),
/* harmony export */   fetchRadarPocServer: () => (/* binding */ fetchRadarPocServer),
/* harmony export */   genTopics: () => (/* binding */ genTopics),
/* harmony export */   globalQuery: () => (/* binding */ globalQuery),
/* harmony export */   increment: () => (/* binding */ increment),
/* harmony export */   indexing: () => (/* binding */ indexing),
/* harmony export */   sendDataToOllama: () => (/* binding */ sendDataToOllama),
/* harmony export */   sendToOllama: () => (/* binding */ sendToOllama),
/* harmony export */   showToast: () => (/* binding */ showToast),
/* harmony export */   trendingTopics: () => (/* binding */ trendingTopics)
/* harmony export */ });
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./constants */ "./src/constants.ts");
/* harmony import */ var _llm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./llm */ "./src/llm.ts");


function fetchRadarPocServer(path, body) {
  const url = _constants__WEBPACK_IMPORTED_MODULE_0__.SERVER_HOST + path;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(async response => {
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }).then(data => {
    return data;
  });
}
function genTopics(config) {
  const {
    username,
    extensionId,
    model
  } = config;
  const body = {
    username: username,
    extension_id: extensionId,
    model: model
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.GEN_TOPICS, body);
}
function trendingTopics(config) {
  const {
    username,
    extensionId,
    model
  } = config;
  const body = {
    username: username,
    extension_id: extensionId,
    model: model
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.TRENDING_TOPICS, body);
}
function customQuery(query, config) {
  const {
    username,
    extensionId,
    model
  } = config;
  const body = {
    username: username,
    extension_id: extensionId,
    model: model,
    query: query
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.QUERY, body);
}
function globalQuery(query, config) {
  const {
    username,
    extensionId,
    model
  } = config;
  const body = {
    username: username,
    extension_id: extensionId,
    model: model,
    query: query
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.GLOBAL_QUERY, body);
}
function fetchLastIndexTime(config) {
  const {
    username,
    extensionId
  } = config;
  const body = {
    username: username,
    extension_id: extensionId
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.LATEST_INDEX_TIME, body);
}
function indexing(data, config) {
  const {
    username,
    extensionId,
    model
  } = config;
  if (!data || data.length === 0) {
    return Promise.reject(new Error('No data provided'));
  }
  const body = {
    username,
    extension_id: extensionId,
    model,
    data
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.INDEXING, body);
}
function increment(data, config) {
  const {
    username,
    extensionId,
    model
  } = config;
  if (!data || data.length === 0) {
    return Promise.reject(new Error('No data provided'));
  }
  const body = {
    username,
    extension_id: extensionId,
    model,
    data
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.INCREMENT, body);
}
function delete_indexing(config) {
  const {
    username,
    extensionId
  } = config;
  const body = {
    username,
    extension_id: extensionId
  };
  return fetchRadarPocServer(_constants__WEBPACK_IMPORTED_MODULE_0__.API_PATH.DELETE, body);
}
function fetchDifyServer(query, config) {
  const url = 'https://lap2-api-dev.int.rclabenv.com/v1/completion-messages';
  const {
    username,
    apiKey
  } = config;
  const data = {
    inputs: {
      query: JSON.stringify(query),
      username: username
    },
    response_mode: 'blocking',
    user: username
  };
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }).then(response => response.json()).then(data => {
    return data.answer;
  }).catch(error => {
    return error.message || 'Https error';
  });
}
function sendDataToOllama(data, config) {
  const {
    username
  } = config;
  const concerned_part = JSON.parse(config.concernedItems || JSON.stringify(['recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况（关键词：recording/RCV mobile/BE dependencies，必须同时包含"recording"和"BE"相关关键词）', '聊到关于公司政策，也可以是政策相关的八卦消息', 'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）', '任何明确 @我 的消息，或者提到我的名字的消息']));
  console.log(data);
  // 插入调试数据
  data.unshift({
    groupName: 'Recording Test',
    groupId: '123',
    posts: [{
      creator: 'Sophia (Jinmei) Lin',
      time: '2025-02-13 00:00:00',
      text: 'Recording project BE dependencies completed'
    }]
  });
  data.unshift({
    groupName: '大群',
    groupId: '321',
    posts: [{
      creator: 'Colin Liu',
      time: '2025-02-14 00:00:00',
      text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。'
    }]
  });
  data.splice(3);
  console.log(data);
  if (true) {
    // 拆分单条发送 LLM
    data.forEach((item, index) => setTimeout(() => {
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
          ${concerned_part.map((item, i) => `- 规则${i + 1}: ${item}`).join('\n          ')}
        2. 对 message_group 中刚有符合规则的消息，请提取以下字段（只提取原文，不做修改不做翻译）：
          - message_content消息原文及其对应发送者sender和发送时间datetime, 还有message_group中的 team_name, team_id, 以及符合的规则x
        3. 对 message_group 中刚有符合规则的消息，每条生成对应的这 3 个新字段：
          - matched_rule: 上面第一步的符合到的规则x的原文内容
          - filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
          - summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文

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
            "datetime": "{datetime}",
          }]
        2. 再次检查下即将输出的内容，是否有重复记录，如果发现重复记录（message_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
      `;
      sendToOllama(prompt);
    }, 3 * 60 * 1000 * index + 1));
  } else {}
}
const sendToOllama = async prompt => {
  console.log('Sending prompt to Ollama:', prompt);
  try {
    // 检查是否在 background script 环境中
    const isBackground = typeof window === 'undefined';
    if (isBackground) {
      // 在 background script 中直接调用处理函数
      const data = await (0,_llm__WEBPACK_IMPORTED_MODULE_1__.handleLLMRequest)({
        prompt
      });
      console.log("Ollama's response:", data.response);
      return data;
    } else {
      // 在 content script 或其他环境中使用 message passing
      chrome.runtime.sendMessage({
        type: 'OLLAMA_REQUEST',
        data: {
          body: {
            prompt: prompt
          }
        }
      }, response => {
        console.log('sendToOllama-response', response);
        if (response.error) {
          console.error("Error sending to Ollama:", response.error);
          console.error("Additional details:", response.details || 'No details');
          if (response.rawResponse) {
            console.log("Raw response from Ollama:", response.rawResponse);
          }
          showToast(`Failed to connect to Ollama: ${response.error}`, 'error');
          return;
        }
        if (response.data && response.data.response) {
          console.log("Ollama's response:", response.data.response);
          showToast('Analysis complete, please check the console', 'success');
        } else {
          console.error("Unexpected response format:", response);
          showToast('Received invalid response format from Ollama', 'error');
        }
      });
    }
  } catch (error) {
    console.error("Error in sendToOllama:", error);
    showToast(`Error: ${error.message}`, 'error');
  }
};
const showToast = (message, type) => {
  window.showToast?.(message, type);
};

/***/ }),

/***/ "./src/constants.ts":
/*!**************************!*\
  !*** ./src/constants.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   API_PATH: () => (/* binding */ API_PATH),
/* harmony export */   CONFIG_LOCAL_STORAGE_KEY: () => (/* binding */ CONFIG_LOCAL_STORAGE_KEY),
/* harmony export */   RADAR_POC_CANDIDATE_QUESTIONS: () => (/* binding */ RADAR_POC_CANDIDATE_QUESTIONS),
/* harmony export */   RADAR_POC_RESULT_LISTS: () => (/* binding */ RADAR_POC_RESULT_LISTS),
/* harmony export */   SERVER_HOST: () => (/* binding */ SERVER_HOST)
/* harmony export */ });
// export const SERVER_HOST = 'https://radar-poc.int.rclabenv.com:8443';
const SERVER_HOST = 'http://localhost:6333';
const API_PATH = {
  GEN_TOPICS: '/v1/gen/topics',
  QUERY: '/v1/query',
  GLOBAL_QUERY: '/v1/global_query',
  LATEST_INDEX_TIME: '/v1/fetch_latest_index_time',
  INDEXING: '/v1/indexing',
  INCREMENT: '/v1/update_indexing',
  DELETE: '/v1/delete',
  TRENDING_TOPICS: '/v1/trending/topics'
};
const CONFIG_LOCAL_STORAGE_KEY = 'RADAR_POC_CONFIG';
const RADAR_POC_RESULT_LISTS = 'RADAR_POC_RESULT_LISTS';
const RADAR_POC_CANDIDATE_QUESTIONS = 'RADAR_POC_CANDIDATE_QUESTIONS';

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
  return await response.json();
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
  return {
    response: completion.choices[0].message.content
  };
}

// 根据配置选择不同的处理方式
async function handleLLMRequest(body) {
  const handler =  true ? handleOllamaRequest : 0;
  return await handler(body);
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
/* harmony export */   startScheduledCheck: () => (/* binding */ startScheduledCheck),
/* harmony export */   stopScheduledCheck: () => (/* binding */ stopScheduledCheck)
/* harmony export */ });
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./api */ "./src/api.ts");
/* harmony import */ var _llm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./llm */ "./src/llm.ts");


console.log('Background script loaded');

// 扩展安装或更新时，立即创建定时任务
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  chrome.storage.local.set({
    config: {
      recentDays: 1 / 24,
      selectGroupNames: "",
      enableMessage: true,
      enableSms: false,
      enableVoicemail: false,
      enableCallTranscript: false,
      enableCalendar: false,
      enableCandidateQuestions: false,
      selectFolderGroupIds: "",
      username: "Esone Qiu",
      extensionId: "1325046020",
      apiKey: "app-CjA00E2dCpUqlpmqhcRp91gq",
      model: "4o"
    }
  });
  setTimeout(() => {
    runScheduledTask(); // 立即执行一次
  }, 10000);
  // 创建定时任务
  chrome.alarms.create('checkMessages', {
    periodInMinutes: 120
  });
});

// 监听定时任务
chrome.alarms.onAlarm.addListener(alarm => {
  console.log('alarm', alarm);
  if (alarm.name === 'checkMessages') {
    console.log('Running scheduled message check...');
    runScheduledTask();
  }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  if (request.type === 'OLLAMA_REQUEST') {
    const {
      body
    } = request.data;
    console.log('Sending request to LLM:', body);
    (0,_llm__WEBPACK_IMPORTED_MODULE_1__.handleLLMRequest)(body).then(data => {
      console.log('LLM response:', data);
      sendResponse({
        data
      });
    }).catch(error => {
      console.error('LLM error:', error);
      sendResponse({
        error: error.message,
        details: `Failed to connect to ${"local"} service`
      });
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
function startScheduledCheck() {
  chrome.alarms.create('checkMessages', {
    periodInMinutes: 120 // 每2小时执行一次
  });
  console.log('Scheduled message check started');
}

// 停止定时任务
function stopScheduledCheck() {
  chrome.alarms.clear('checkMessages');
  console.log('Scheduled message check stopped');
}

// 定时抓取分析消息
async function runScheduledTask() {
  chrome.storage.local.get(['config'], async result => {
    console.log('chrome.storage.local.result', result);
    if (result.config) {
      const config = result.config;
      const startTime = new Date(Date.now() - config.recentDays * 60 * 60 * 1000);
      try {
        // 查找或创建 RingCentral 标签页
        let rcTab = await findRingCentralTab();
        if (!rcTab) {
          rcTab = await createRingCentralTab();
          // 等待页面加载完成
          await waitForTabLoad(rcTab.id);
        }

        // 尝试发送消息，如果失败则重试
        await sendMessageWithRetry(rcTab.id, {
          type: 'FETCH_USER_DATA',
          startTime,
          config
        });
      } catch (error) {
        console.error('Background task error:', error);
      }
    }
  });
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
            setTimeout(trySendMessage, 1000); // 1秒后重试
          } else {
            reject(new Error('Failed to send message after multiple attempts'));
          }
        } else {
          if (response && response.success) {
            (0,_api__WEBPACK_IMPORTED_MODULE_0__.sendDataToOllama)(response.data, message.config);
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
})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBLGtCQUFrQixtREFBVztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QUFDLENBQUMsQ0FBQztVQUN0QyxDQUFDLE1BQU07WUFDSG5JLE1BQU0sQ0FBQyxJQUFJdkIsS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUM7VUFDdkU7UUFDSixDQUFDLE1BQU07VUFDSCxJQUFJSixRQUFRLElBQUlBLFFBQVEsQ0FBQ2dLLE9BQU8sRUFBRTtZQUM5QnRILHNEQUFnQixDQUFDMUMsUUFBUSxDQUFDTyxJQUFJLEVBQUVrQyxPQUFPLENBQUNoQyxNQUFNLENBQUM7WUFDL0MySSxPQUFPLENBQUNwSixRQUFRLENBQUM7VUFDckIsQ0FBQyxNQUFNO1lBQ0gyQixNQUFNLENBQUMsSUFBSXZCLEtBQUssQ0FBQyw2QkFBNkIsR0FBR0osUUFBUSxFQUFFd0MsS0FBSyxDQUFDLENBQUM7VUFDdEU7UUFDSjtNQUNKLENBQUMsQ0FBQztJQUNOLENBQUM7SUFFRHNILGNBQWMsQ0FBQyxDQUFDO0VBQ3BCLENBQUMsQ0FBQztBQUNOLEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL19zaGltcy9NdWx0aXBhcnRCb2R5Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL19zaGltcy9pbmRleC5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9fc2hpbXMvcmVnaXN0cnkubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvX3NoaW1zL3dlYi1ydW50aW1lLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL192ZW5kb3IvcGFydGlhbC1qc29uLXBhcnNlci9wYXJzZXIubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvY29yZS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9lcnJvci5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9pbmRleC5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9pbnRlcm5hbC9kZWNvZGVycy9saW5lLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2ludGVybmFsL3FzL2Zvcm1hdHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvaW50ZXJuYWwvcXMvc3RyaW5naWZ5Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2ludGVybmFsL3FzL3V0aWxzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2ludGVybmFsL3N0cmVhbS11dGlscy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lci5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvQXNzaXN0YW50U3RyZWFtLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9DaGF0Q29tcGxldGlvblJ1bm5lci5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvQ2hhdENvbXBsZXRpb25TdHJlYW0ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL0NoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9FdmVudFN0cmVhbS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvUnVubmFibGVGdW5jdGlvbi5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvVXRpbC5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvY2hhdENvbXBsZXRpb25VdGlscy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvcGFyc2VyLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3BhZ2luYXRpb24ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2UubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2F1ZGlvL2F1ZGlvLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9hdWRpby9zcGVlY2gubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2F1ZGlvL3RyYW5zY3JpcHRpb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9hdWRpby90cmFuc2xhdGlvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JhdGNoZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvYXNzaXN0YW50cy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS9iZXRhLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL2NoYXQvY2hhdC5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS9jaGF0L2NvbXBsZXRpb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3JlYWx0aW1lL3JlYWx0aW1lLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3JlYWx0aW1lL3Nlc3Npb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3RocmVhZHMvbWVzc2FnZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdGhyZWFkcy9ydW5zL3J1bnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdGhyZWFkcy9ydW5zL3N0ZXBzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3RocmVhZHMvdGhyZWFkcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS92ZWN0b3Itc3RvcmVzL2ZpbGUtYmF0Y2hlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS92ZWN0b3Itc3RvcmVzL2ZpbGVzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3ZlY3Rvci1zdG9yZXMvdmVjdG9yLXN0b3Jlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvY2hhdC9jaGF0Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9jaGF0L2NvbXBsZXRpb25zL2NvbXBsZXRpb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9jaGF0L2NvbXBsZXRpb25zL21lc3NhZ2VzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9jb21wbGV0aW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvZW1iZWRkaW5ncy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvZmlsZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2ZpbmUtdHVuaW5nL2ZpbmUtdHVuaW5nLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9maW5lLXR1bmluZy9qb2JzL2NoZWNrcG9pbnRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9maW5lLXR1bmluZy9qb2JzL2pvYnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2ltYWdlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvbW9kZWxzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9tb2RlcmF0aW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvdXBsb2Fkcy9wYXJ0cy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvdXBsb2Fkcy91cGxvYWRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3N0cmVhbWluZy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS91cGxvYWRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3ZlcnNpb24ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL3NyYy9hcGkudHMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vc3JjL2NvbnN0YW50cy50cyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9zcmMvbGxtLnRzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL3NyYy9iYWNrZ3JvdW5kLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRGlzY2xhaW1lcjogbW9kdWxlcyBpbiBfc2hpbXMgYXJlbid0IGludGVuZGVkIHRvIGJlIGltcG9ydGVkIGJ5IFNESyB1c2Vycy5cbiAqL1xuZXhwb3J0IGNsYXNzIE11bHRpcGFydEJvZHkge1xuICAgIGNvbnN0cnVjdG9yKGJvZHkpIHtcbiAgICAgICAgdGhpcy5ib2R5ID0gYm9keTtcbiAgICB9XG4gICAgZ2V0IFtTeW1ib2wudG9TdHJpbmdUYWddKCkge1xuICAgICAgICByZXR1cm4gJ011bHRpcGFydEJvZHknO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPU11bHRpcGFydEJvZHkubWpzLm1hcCIsIi8qKlxuICogRGlzY2xhaW1lcjogbW9kdWxlcyBpbiBfc2hpbXMgYXJlbid0IGludGVuZGVkIHRvIGJlIGltcG9ydGVkIGJ5IFNESyB1c2Vycy5cbiAqL1xuaW1wb3J0ICogYXMgc2hpbXMgZnJvbSAnLi9yZWdpc3RyeS5tanMnO1xuaW1wb3J0ICogYXMgYXV0byBmcm9tICdvcGVuYWkvX3NoaW1zL2F1dG8vcnVudGltZSc7XG5pZiAoIXNoaW1zLmtpbmQpIHNoaW1zLnNldFNoaW1zKGF1dG8uZ2V0UnVudGltZSgpLCB7IGF1dG86IHRydWUgfSk7XG5leHBvcnQgKiBmcm9tICcuL3JlZ2lzdHJ5Lm1qcyc7XG4iLCJleHBvcnQgbGV0IGF1dG8gPSBmYWxzZTtcbmV4cG9ydCBsZXQga2luZCA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgZmV0Y2ggPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IFJlcXVlc3QgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IFJlc3BvbnNlID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBIZWFkZXJzID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBGb3JtRGF0YSA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgQmxvYiA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgRmlsZSA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgUmVhZGFibGVTdHJlYW0gPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IGdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBnZXREZWZhdWx0QWdlbnQgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IGZpbGVGcm9tUGF0aCA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgaXNGc1JlYWRTdHJlYW0gPSB1bmRlZmluZWQ7XG5leHBvcnQgZnVuY3Rpb24gc2V0U2hpbXMoc2hpbXMsIG9wdGlvbnMgPSB7IGF1dG86IGZhbHNlIH0pIHtcbiAgICBpZiAoYXV0bykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHlvdSBtdXN0IFxcYGltcG9ydCAnb3BlbmFpL3NoaW1zLyR7c2hpbXMua2luZH0nXFxgIGJlZm9yZSBpbXBvcnRpbmcgYW55dGhpbmcgZWxzZSBmcm9tIG9wZW5haWApO1xuICAgIH1cbiAgICBpZiAoa2luZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNhbid0IFxcYGltcG9ydCAnb3BlbmFpL3NoaW1zLyR7c2hpbXMua2luZH0nXFxgIGFmdGVyIFxcYGltcG9ydCAnb3BlbmFpL3NoaW1zLyR7a2luZH0nXFxgYCk7XG4gICAgfVxuICAgIGF1dG8gPSBvcHRpb25zLmF1dG87XG4gICAga2luZCA9IHNoaW1zLmtpbmQ7XG4gICAgZmV0Y2ggPSBzaGltcy5mZXRjaDtcbiAgICBSZXF1ZXN0ID0gc2hpbXMuUmVxdWVzdDtcbiAgICBSZXNwb25zZSA9IHNoaW1zLlJlc3BvbnNlO1xuICAgIEhlYWRlcnMgPSBzaGltcy5IZWFkZXJzO1xuICAgIEZvcm1EYXRhID0gc2hpbXMuRm9ybURhdGE7XG4gICAgQmxvYiA9IHNoaW1zLkJsb2I7XG4gICAgRmlsZSA9IHNoaW1zLkZpbGU7XG4gICAgUmVhZGFibGVTdHJlYW0gPSBzaGltcy5SZWFkYWJsZVN0cmVhbTtcbiAgICBnZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9ucyA9IHNoaW1zLmdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zO1xuICAgIGdldERlZmF1bHRBZ2VudCA9IHNoaW1zLmdldERlZmF1bHRBZ2VudDtcbiAgICBmaWxlRnJvbVBhdGggPSBzaGltcy5maWxlRnJvbVBhdGg7XG4gICAgaXNGc1JlYWRTdHJlYW0gPSBzaGltcy5pc0ZzUmVhZFN0cmVhbTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlZ2lzdHJ5Lm1qcy5tYXAiLCJpbXBvcnQgeyBNdWx0aXBhcnRCb2R5IH0gZnJvbSBcIi4vTXVsdGlwYXJ0Qm9keS5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBnZXRSdW50aW1lKHsgbWFudWFsbHlJbXBvcnRlZCB9ID0ge30pIHtcbiAgICBjb25zdCByZWNvbW1lbmRhdGlvbiA9IG1hbnVhbGx5SW1wb3J0ZWQgP1xuICAgICAgICBgWW91IG1heSBuZWVkIHRvIHVzZSBwb2x5ZmlsbHNgXG4gICAgICAgIDogYEFkZCBvbmUgb2YgdGhlc2UgaW1wb3J0cyBiZWZvcmUgeW91ciBmaXJzdCBcXGBpbXBvcnQg4oCmIGZyb20gJ29wZW5haSdcXGA6XG4tIFxcYGltcG9ydCAnb3BlbmFpL3NoaW1zL25vZGUnXFxgIChpZiB5b3UncmUgcnVubmluZyBvbiBOb2RlKVxuLSBcXGBpbXBvcnQgJ29wZW5haS9zaGltcy93ZWInXFxgIChvdGhlcndpc2UpXG5gO1xuICAgIGxldCBfZmV0Y2gsIF9SZXF1ZXN0LCBfUmVzcG9uc2UsIF9IZWFkZXJzO1xuICAgIHRyeSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgX2ZldGNoID0gZmV0Y2g7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgX1JlcXVlc3QgPSBSZXF1ZXN0O1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIF9SZXNwb25zZSA9IFJlc3BvbnNlO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIF9IZWFkZXJzID0gSGVhZGVycztcbiAgICB9XG4gICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBlbnZpcm9ubWVudCBpcyBtaXNzaW5nIHRoZSBmb2xsb3dpbmcgV2ViIEZldGNoIEFQSSB0eXBlOiAke2Vycm9yLm1lc3NhZ2V9LiAke3JlY29tbWVuZGF0aW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnd2ViJyxcbiAgICAgICAgZmV0Y2g6IF9mZXRjaCxcbiAgICAgICAgUmVxdWVzdDogX1JlcXVlc3QsXG4gICAgICAgIFJlc3BvbnNlOiBfUmVzcG9uc2UsXG4gICAgICAgIEhlYWRlcnM6IF9IZWFkZXJzLFxuICAgICAgICBGb3JtRGF0YTogXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdHlwZW9mIEZvcm1EYXRhICE9PSAndW5kZWZpbmVkJyA/IEZvcm1EYXRhIDogKGNsYXNzIEZvcm1EYXRhIHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmlsZSB1cGxvYWRzIGFyZW4ndCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudCB5ZXQgYXMgJ0Zvcm1EYXRhJyBpcyB1bmRlZmluZWQuICR7cmVjb21tZW5kYXRpb259YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBCbG9iOiB0eXBlb2YgQmxvYiAhPT0gJ3VuZGVmaW5lZCcgPyBCbG9iIDogKGNsYXNzIEJsb2Ige1xuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmaWxlIHVwbG9hZHMgYXJlbid0IHN1cHBvcnRlZCBpbiB0aGlzIGVudmlyb25tZW50IHlldCBhcyAnQmxvYicgaXMgdW5kZWZpbmVkLiAke3JlY29tbWVuZGF0aW9ufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgRmlsZTogXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdHlwZW9mIEZpbGUgIT09ICd1bmRlZmluZWQnID8gRmlsZSA6IChjbGFzcyBGaWxlIHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmlsZSB1cGxvYWRzIGFyZW4ndCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudCB5ZXQgYXMgJ0ZpbGUnIGlzIHVuZGVmaW5lZC4gJHtyZWNvbW1lbmRhdGlvbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIFJlYWRhYmxlU3RyZWFtOiBcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICB0eXBlb2YgUmVhZGFibGVTdHJlYW0gIT09ICd1bmRlZmluZWQnID8gUmVhZGFibGVTdHJlYW0gOiAoY2xhc3MgUmVhZGFibGVTdHJlYW0ge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzdHJlYW1pbmcgaXNuJ3Qgc3VwcG9ydGVkIGluIHRoaXMgZW52aXJvbm1lbnQgeWV0IGFzICdSZWFkYWJsZVN0cmVhbScgaXMgdW5kZWZpbmVkLiAke3JlY29tbWVuZGF0aW9ufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnM6IGFzeW5jIChcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBmb3JtLCBvcHRzKSA9PiAoe1xuICAgICAgICAgICAgLi4ub3B0cyxcbiAgICAgICAgICAgIGJvZHk6IG5ldyBNdWx0aXBhcnRCb2R5KGZvcm0pLFxuICAgICAgICB9KSxcbiAgICAgICAgZ2V0RGVmYXVsdEFnZW50OiAodXJsKSA9PiB1bmRlZmluZWQsXG4gICAgICAgIGZpbGVGcm9tUGF0aDogKCkgPT4ge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYGZpbGVGcm9tUGF0aGAgZnVuY3Rpb24gaXMgb25seSBzdXBwb3J0ZWQgaW4gTm9kZS4gU2VlIHRoZSBSRUFETUUgZm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly93d3cuZ2l0aHViLmNvbS9vcGVuYWkvb3BlbmFpLW5vZGUjZmlsZS11cGxvYWRzJyk7XG4gICAgICAgIH0sXG4gICAgICAgIGlzRnNSZWFkU3RyZWFtOiAodmFsdWUpID0+IGZhbHNlLFxuICAgIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD13ZWItcnVudGltZS5tanMubWFwIiwiY29uc3QgU1RSID0gMGIwMDAwMDAwMDE7XG5jb25zdCBOVU0gPSAwYjAwMDAwMDAxMDtcbmNvbnN0IEFSUiA9IDBiMDAwMDAwMTAwO1xuY29uc3QgT0JKID0gMGIwMDAwMDEwMDA7XG5jb25zdCBOVUxMID0gMGIwMDAwMTAwMDA7XG5jb25zdCBCT09MID0gMGIwMDAxMDAwMDA7XG5jb25zdCBOQU4gPSAwYjAwMTAwMDAwMDtcbmNvbnN0IElORklOSVRZID0gMGIwMTAwMDAwMDA7XG5jb25zdCBNSU5VU19JTkZJTklUWSA9IDBiMTAwMDAwMDAwO1xuY29uc3QgSU5GID0gSU5GSU5JVFkgfCBNSU5VU19JTkZJTklUWTtcbmNvbnN0IFNQRUNJQUwgPSBOVUxMIHwgQk9PTCB8IElORiB8IE5BTjtcbmNvbnN0IEFUT00gPSBTVFIgfCBOVU0gfCBTUEVDSUFMO1xuY29uc3QgQ09MTEVDVElPTiA9IEFSUiB8IE9CSjtcbmNvbnN0IEFMTCA9IEFUT00gfCBDT0xMRUNUSU9OO1xuY29uc3QgQWxsb3cgPSB7XG4gICAgU1RSLFxuICAgIE5VTSxcbiAgICBBUlIsXG4gICAgT0JKLFxuICAgIE5VTEwsXG4gICAgQk9PTCxcbiAgICBOQU4sXG4gICAgSU5GSU5JVFksXG4gICAgTUlOVVNfSU5GSU5JVFksXG4gICAgSU5GLFxuICAgIFNQRUNJQUwsXG4gICAgQVRPTSxcbiAgICBDT0xMRUNUSU9OLFxuICAgIEFMTCxcbn07XG4vLyBUaGUgSlNPTiBzdHJpbmcgc2VnbWVudCB3YXMgdW5hYmxlIHRvIGJlIHBhcnNlZCBjb21wbGV0ZWx5XG5jbGFzcyBQYXJ0aWFsSlNPTiBleHRlbmRzIEVycm9yIHtcbn1cbmNsYXNzIE1hbGZvcm1lZEpTT04gZXh0ZW5kcyBFcnJvciB7XG59XG4vKipcbiAqIFBhcnNlIGluY29tcGxldGUgSlNPTlxuICogQHBhcmFtIHtzdHJpbmd9IGpzb25TdHJpbmcgUGFydGlhbCBKU09OIHRvIGJlIHBhcnNlZFxuICogQHBhcmFtIHtudW1iZXJ9IGFsbG93UGFydGlhbCBTcGVjaWZ5IHdoYXQgdHlwZXMgYXJlIGFsbG93ZWQgdG8gYmUgcGFydGlhbCwgc2VlIHtAbGluayBBbGxvd30gZm9yIGRldGFpbHNcbiAqIEByZXR1cm5zIFRoZSBwYXJzZWQgSlNPTlxuICogQHRocm93cyB7UGFydGlhbEpTT059IElmIHRoZSBKU09OIGlzIGluY29tcGxldGUgKHJlbGF0ZWQgdG8gdGhlIGBhbGxvd2AgcGFyYW1ldGVyKVxuICogQHRocm93cyB7TWFsZm9ybWVkSlNPTn0gSWYgdGhlIEpTT04gaXMgbWFsZm9ybWVkXG4gKi9cbmZ1bmN0aW9uIHBhcnNlSlNPTihqc29uU3RyaW5nLCBhbGxvd1BhcnRpYWwgPSBBbGxvdy5BTEwpIHtcbiAgICBpZiAodHlwZW9mIGpzb25TdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGV4cGVjdGluZyBzdHIsIGdvdCAke3R5cGVvZiBqc29uU3RyaW5nfWApO1xuICAgIH1cbiAgICBpZiAoIWpzb25TdHJpbmcudHJpbSgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtqc29uU3RyaW5nfSBpcyBlbXB0eWApO1xuICAgIH1cbiAgICByZXR1cm4gX3BhcnNlSlNPTihqc29uU3RyaW5nLnRyaW0oKSwgYWxsb3dQYXJ0aWFsKTtcbn1cbmNvbnN0IF9wYXJzZUpTT04gPSAoanNvblN0cmluZywgYWxsb3cpID0+IHtcbiAgICBjb25zdCBsZW5ndGggPSBqc29uU3RyaW5nLmxlbmd0aDtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IG1hcmtQYXJ0aWFsSlNPTiA9IChtc2cpID0+IHtcbiAgICAgICAgdGhyb3cgbmV3IFBhcnRpYWxKU09OKGAke21zZ30gYXQgcG9zaXRpb24gJHtpbmRleH1gKTtcbiAgICB9O1xuICAgIGNvbnN0IHRocm93TWFsZm9ybWVkRXJyb3IgPSAobXNnKSA9PiB7XG4gICAgICAgIHRocm93IG5ldyBNYWxmb3JtZWRKU09OKGAke21zZ30gYXQgcG9zaXRpb24gJHtpbmRleH1gKTtcbiAgICB9O1xuICAgIGNvbnN0IHBhcnNlQW55ID0gKCkgPT4ge1xuICAgICAgICBza2lwQmxhbmsoKTtcbiAgICAgICAgaWYgKGluZGV4ID49IGxlbmd0aClcbiAgICAgICAgICAgIG1hcmtQYXJ0aWFsSlNPTignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQnKTtcbiAgICAgICAgaWYgKGpzb25TdHJpbmdbaW5kZXhdID09PSAnXCInKVxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlU3RyKCk7XG4gICAgICAgIGlmIChqc29uU3RyaW5nW2luZGV4XSA9PT0gJ3snKVxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlT2JqKCk7XG4gICAgICAgIGlmIChqc29uU3RyaW5nW2luZGV4XSA9PT0gJ1snKVxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlQXJyKCk7XG4gICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyA0KSA9PT0gJ251bGwnIHx8XG4gICAgICAgICAgICAoQWxsb3cuTlVMTCAmIGFsbG93ICYmIGxlbmd0aCAtIGluZGV4IDwgNCAmJiAnbnVsbCcuc3RhcnRzV2l0aChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCkpKSkge1xuICAgICAgICAgICAgaW5kZXggKz0gNDtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyA0KSA9PT0gJ3RydWUnIHx8XG4gICAgICAgICAgICAoQWxsb3cuQk9PTCAmIGFsbG93ICYmIGxlbmd0aCAtIGluZGV4IDwgNCAmJiAndHJ1ZScuc3RhcnRzV2l0aChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCkpKSkge1xuICAgICAgICAgICAgaW5kZXggKz0gNDtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyA1KSA9PT0gJ2ZhbHNlJyB8fFxuICAgICAgICAgICAgKEFsbG93LkJPT0wgJiBhbGxvdyAmJiBsZW5ndGggLSBpbmRleCA8IDUgJiYgJ2ZhbHNlJy5zdGFydHNXaXRoKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4KSkpKSB7XG4gICAgICAgICAgICBpbmRleCArPSA1O1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyA4KSA9PT0gJ0luZmluaXR5JyB8fFxuICAgICAgICAgICAgKEFsbG93LklORklOSVRZICYgYWxsb3cgJiYgbGVuZ3RoIC0gaW5kZXggPCA4ICYmICdJbmZpbml0eScuc3RhcnRzV2l0aChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCkpKSkge1xuICAgICAgICAgICAgaW5kZXggKz0gODtcbiAgICAgICAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgOSkgPT09ICctSW5maW5pdHknIHx8XG4gICAgICAgICAgICAoQWxsb3cuTUlOVVNfSU5GSU5JVFkgJiBhbGxvdyAmJlxuICAgICAgICAgICAgICAgIDEgPCBsZW5ndGggLSBpbmRleCAmJlxuICAgICAgICAgICAgICAgIGxlbmd0aCAtIGluZGV4IDwgOSAmJlxuICAgICAgICAgICAgICAgICctSW5maW5pdHknLnN0YXJ0c1dpdGgoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgpKSkpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDk7XG4gICAgICAgICAgICByZXR1cm4gLUluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyAzKSA9PT0gJ05hTicgfHxcbiAgICAgICAgICAgIChBbGxvdy5OQU4gJiBhbGxvdyAmJiBsZW5ndGggLSBpbmRleCA8IDMgJiYgJ05hTicuc3RhcnRzV2l0aChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCkpKSkge1xuICAgICAgICAgICAgaW5kZXggKz0gMztcbiAgICAgICAgICAgIHJldHVybiBOYU47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhcnNlTnVtKCk7XG4gICAgfTtcbiAgICBjb25zdCBwYXJzZVN0ciA9ICgpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBpbmRleDtcbiAgICAgICAgbGV0IGVzY2FwZSA9IGZhbHNlO1xuICAgICAgICBpbmRleCsrOyAvLyBza2lwIGluaXRpYWwgcXVvdGVcbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoICYmIChqc29uU3RyaW5nW2luZGV4XSAhPT0gJ1wiJyB8fCAoZXNjYXBlICYmIGpzb25TdHJpbmdbaW5kZXggLSAxXSA9PT0gJ1xcXFwnKSkpIHtcbiAgICAgICAgICAgIGVzY2FwZSA9IGpzb25TdHJpbmdbaW5kZXhdID09PSAnXFxcXCcgPyAhZXNjYXBlIDogZmFsc2U7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uU3RyaW5nLmNoYXJBdChpbmRleCkgPT0gJ1wiJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZyhzdGFydCwgKytpbmRleCAtIE51bWJlcihlc2NhcGUpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRocm93TWFsZm9ybWVkRXJyb3IoU3RyaW5nKGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChBbGxvdy5TVFIgJiBhbGxvdykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZyhzdGFydCwgaW5kZXggLSBOdW1iZXIoZXNjYXBlKSkgKyAnXCInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gU3ludGF4RXJyb3I6IEludmFsaWQgZXNjYXBlIHNlcXVlbmNlXG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGpzb25TdHJpbmcubGFzdEluZGV4T2YoJ1xcXFwnKSkgKyAnXCInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBtYXJrUGFydGlhbEpTT04oJ1VudGVybWluYXRlZCBzdHJpbmcgbGl0ZXJhbCcpO1xuICAgIH07XG4gICAgY29uc3QgcGFyc2VPYmogPSAoKSA9PiB7XG4gICAgICAgIGluZGV4Kys7IC8vIHNraXAgaW5pdGlhbCBicmFjZVxuICAgICAgICBza2lwQmxhbmsoKTtcbiAgICAgICAgY29uc3Qgb2JqID0ge307XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3aGlsZSAoanNvblN0cmluZ1tpbmRleF0gIT09ICd9Jykge1xuICAgICAgICAgICAgICAgIHNraXBCbGFuaygpO1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSBsZW5ndGggJiYgQWxsb3cuT0JKICYgYWxsb3cpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gcGFyc2VTdHIoKTtcbiAgICAgICAgICAgICAgICBza2lwQmxhbmsoKTtcbiAgICAgICAgICAgICAgICBpbmRleCsrOyAvLyBza2lwIGNvbG9uXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBwYXJzZUFueSgpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHsgdmFsdWUsIHdyaXRhYmxlOiB0cnVlLCBlbnVtZXJhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChBbGxvdy5PQkogJiBhbGxvdylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNraXBCbGFuaygpO1xuICAgICAgICAgICAgICAgIGlmIChqc29uU3RyaW5nW2luZGV4XSA9PT0gJywnKVxuICAgICAgICAgICAgICAgICAgICBpbmRleCsrOyAvLyBza2lwIGNvbW1hXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChBbGxvdy5PQkogJiBhbGxvdylcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIG1hcmtQYXJ0aWFsSlNPTihcIkV4cGVjdGVkICd9JyBhdCBlbmQgb2Ygb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7IC8vIHNraXAgZmluYWwgYnJhY2VcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9O1xuICAgIGNvbnN0IHBhcnNlQXJyID0gKCkgPT4ge1xuICAgICAgICBpbmRleCsrOyAvLyBza2lwIGluaXRpYWwgYnJhY2tldFxuICAgICAgICBjb25zdCBhcnIgPSBbXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdoaWxlIChqc29uU3RyaW5nW2luZGV4XSAhPT0gJ10nKSB7XG4gICAgICAgICAgICAgICAgYXJyLnB1c2gocGFyc2VBbnkoKSk7XG4gICAgICAgICAgICAgICAgc2tpcEJsYW5rKCk7XG4gICAgICAgICAgICAgICAgaWYgKGpzb25TdHJpbmdbaW5kZXhdID09PSAnLCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBjb21tYVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKEFsbG93LkFSUiAmIGFsbG93KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1hcmtQYXJ0aWFsSlNPTihcIkV4cGVjdGVkICddJyBhdCBlbmQgb2YgYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBmaW5hbCBicmFja2V0XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfTtcbiAgICBjb25zdCBwYXJzZU51bSA9ICgpID0+IHtcbiAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICBpZiAoanNvblN0cmluZyA9PT0gJy0nICYmIEFsbG93Lk5VTSAmIGFsbG93KVxuICAgICAgICAgICAgICAgIG1hcmtQYXJ0aWFsSlNPTihcIk5vdCBzdXJlIHdoYXQgJy0nIGlzXCIpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFsbG93Lk5VTSAmIGFsbG93KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoJy4nID09PSBqc29uU3RyaW5nW2pzb25TdHJpbmcubGVuZ3RoIC0gMV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoMCwganNvblN0cmluZy5sYXN0SW5kZXhPZignLicpKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZygwLCBqc29uU3RyaW5nLmxhc3RJbmRleE9mKCdlJykpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZSkgeyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93TWFsZm9ybWVkRXJyb3IoU3RyaW5nKGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdGFydCA9IGluZGV4O1xuICAgICAgICBpZiAoanNvblN0cmluZ1tpbmRleF0gPT09ICctJylcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIHdoaWxlIChqc29uU3RyaW5nW2luZGV4XSAmJiAhJyxdfScuaW5jbHVkZXMoanNvblN0cmluZ1tpbmRleF0pKVxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgaWYgKGluZGV4ID09IGxlbmd0aCAmJiAhKEFsbG93Lk5VTSAmIGFsbG93KSlcbiAgICAgICAgICAgIG1hcmtQYXJ0aWFsSlNPTignVW50ZXJtaW5hdGVkIG51bWJlciBsaXRlcmFsJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLnN1YnN0cmluZyhzdGFydCwgaW5kZXgpKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBpbmRleCkgPT09ICctJyAmJiBBbGxvdy5OVU0gJiBhbGxvdylcbiAgICAgICAgICAgICAgICBtYXJrUGFydGlhbEpTT04oXCJOb3Qgc3VyZSB3aGF0ICctJyBpc1wiKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGpzb25TdHJpbmcubGFzdEluZGV4T2YoJ2UnKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvd01hbGZvcm1lZEVycm9yKFN0cmluZyhlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IHNraXBCbGFuayA9ICgpID0+IHtcbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoICYmICcgXFxuXFxyXFx0Jy5pbmNsdWRlcyhqc29uU3RyaW5nW2luZGV4XSkpIHtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiBwYXJzZUFueSgpO1xufTtcbi8vIHVzaW5nIHRoaXMgZnVuY3Rpb24gd2l0aCBtYWxmb3JtZWQgSlNPTiBpcyB1bmRlZmluZWQgYmVoYXZpb3JcbmNvbnN0IHBhcnRpYWxQYXJzZSA9IChpbnB1dCkgPT4gcGFyc2VKU09OKGlucHV0LCBBbGxvdy5BTEwgXiBBbGxvdy5OVU0pO1xuZXhwb3J0IHsgcGFydGlhbFBhcnNlLCBQYXJ0aWFsSlNPTiwgTWFsZm9ybWVkSlNPTiB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFyc2VyLm1qcy5tYXAiLCJ2YXIgX19jbGFzc1ByaXZhdGVGaWVsZFNldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZFNldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XG59O1xudmFyIF9fY2xhc3NQcml2YXRlRmllbGRHZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRHZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcbn07XG52YXIgX0Fic3RyYWN0UGFnZV9jbGllbnQ7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSBcIi4vdmVyc2lvbi5tanNcIjtcbmltcG9ydCB7IFN0cmVhbSB9IGZyb20gXCIuL3N0cmVhbWluZy5tanNcIjtcbmltcG9ydCB7IE9wZW5BSUVycm9yLCBBUElFcnJvciwgQVBJQ29ubmVjdGlvbkVycm9yLCBBUElDb25uZWN0aW9uVGltZW91dEVycm9yLCBBUElVc2VyQWJvcnRFcnJvciwgfSBmcm9tIFwiLi9lcnJvci5tanNcIjtcbmltcG9ydCB7IGtpbmQgYXMgc2hpbXNLaW5kLCBnZXREZWZhdWx0QWdlbnQsIGZldGNoLCB9IGZyb20gXCIuL19zaGltcy9pbmRleC5tanNcIjtcbmltcG9ydCB7IGlzQmxvYkxpa2UsIGlzTXVsdGlwYXJ0Qm9keSB9IGZyb20gXCIuL3VwbG9hZHMubWpzXCI7XG5leHBvcnQgeyBtYXliZU11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucywgbXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zLCBjcmVhdGVGb3JtLCB9IGZyb20gXCIuL3VwbG9hZHMubWpzXCI7XG5hc3luYyBmdW5jdGlvbiBkZWZhdWx0UGFyc2VSZXNwb25zZShwcm9wcykge1xuICAgIGNvbnN0IHsgcmVzcG9uc2UgfSA9IHByb3BzO1xuICAgIGlmIChwcm9wcy5vcHRpb25zLnN0cmVhbSkge1xuICAgICAgICBkZWJ1ZygncmVzcG9uc2UnLCByZXNwb25zZS5zdGF0dXMsIHJlc3BvbnNlLnVybCwgcmVzcG9uc2UuaGVhZGVycywgcmVzcG9uc2UuYm9keSk7XG4gICAgICAgIC8vIE5vdGU6IHRoZXJlIGlzIGFuIGludmFyaWFudCBoZXJlIHRoYXQgaXNuJ3QgcmVwcmVzZW50ZWQgaW4gdGhlIHR5cGUgc3lzdGVtXG4gICAgICAgIC8vIHRoYXQgaWYgeW91IHNldCBgc3RyZWFtOiB0cnVlYCB0aGUgcmVzcG9uc2UgdHlwZSBtdXN0IGFsc28gYmUgYFN0cmVhbTxUPmBcbiAgICAgICAgaWYgKHByb3BzLm9wdGlvbnMuX19zdHJlYW1DbGFzcykge1xuICAgICAgICAgICAgcmV0dXJuIHByb3BzLm9wdGlvbnMuX19zdHJlYW1DbGFzcy5mcm9tU1NFUmVzcG9uc2UocmVzcG9uc2UsIHByb3BzLmNvbnRyb2xsZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBTdHJlYW0uZnJvbVNTRVJlc3BvbnNlKHJlc3BvbnNlLCBwcm9wcy5jb250cm9sbGVyKTtcbiAgICB9XG4gICAgLy8gZmV0Y2ggcmVmdXNlcyB0byByZWFkIHRoZSBib2R5IHdoZW4gdGhlIHN0YXR1cyBjb2RlIGlzIDIwNC5cbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcm9wcy5vcHRpb25zLl9fYmluYXJ5UmVzcG9uc2UpIHtcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50VHlwZSA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdjb250ZW50LXR5cGUnKTtcbiAgICBjb25zdCBpc0pTT04gPSBjb250ZW50VHlwZT8uaW5jbHVkZXMoJ2FwcGxpY2F0aW9uL2pzb24nKSB8fCBjb250ZW50VHlwZT8uaW5jbHVkZXMoJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbicpO1xuICAgIGlmIChpc0pTT04pIHtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgZGVidWcoJ3Jlc3BvbnNlJywgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZS51cmwsIHJlc3BvbnNlLmhlYWRlcnMsIGpzb24pO1xuICAgICAgICByZXR1cm4gX2FkZFJlcXVlc3RJRChqc29uLCByZXNwb25zZSk7XG4gICAgfVxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgZGVidWcoJ3Jlc3BvbnNlJywgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZS51cmwsIHJlc3BvbnNlLmhlYWRlcnMsIHRleHQpO1xuICAgIC8vIFRPRE8gaGFuZGxlIGJsb2IsIGFycmF5YnVmZmVyLCBvdGhlciBjb250ZW50IHR5cGVzLCBldGMuXG4gICAgcmV0dXJuIHRleHQ7XG59XG5mdW5jdGlvbiBfYWRkUmVxdWVzdElEKHZhbHVlLCByZXNwb25zZSkge1xuICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkodmFsdWUsICdfcmVxdWVzdF9pZCcsIHtcbiAgICAgICAgdmFsdWU6IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCd4LXJlcXVlc3QtaWQnKSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgfSk7XG59XG4vKipcbiAqIEEgc3ViY2xhc3Mgb2YgYFByb21pc2VgIHByb3ZpZGluZyBhZGRpdGlvbmFsIGhlbHBlciBtZXRob2RzXG4gKiBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgU0RLLlxuICovXG5leHBvcnQgY2xhc3MgQVBJUHJvbWlzZSBleHRlbmRzIFByb21pc2Uge1xuICAgIGNvbnN0cnVjdG9yKHJlc3BvbnNlUHJvbWlzZSwgcGFyc2VSZXNwb25zZSA9IGRlZmF1bHRQYXJzZVJlc3BvbnNlKSB7XG4gICAgICAgIHN1cGVyKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAvLyB0aGlzIGlzIG1heWJlIGEgYml0IHdlaXJkIGJ1dCB0aGlzIGhhcyB0byBiZSBhIG5vLW9wIHRvIG5vdCBpbXBsaWNpdGx5XG4gICAgICAgICAgICAvLyBwYXJzZSB0aGUgcmVzcG9uc2UgYm9keTsgaW5zdGVhZCAudGhlbiwgLmNhdGNoLCAuZmluYWxseSBhcmUgb3ZlcnJpZGRlblxuICAgICAgICAgICAgLy8gdG8gcGFyc2UgdGhlIHJlc3BvbnNlXG4gICAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXNwb25zZVByb21pc2UgPSByZXNwb25zZVByb21pc2U7XG4gICAgICAgIHRoaXMucGFyc2VSZXNwb25zZSA9IHBhcnNlUmVzcG9uc2U7XG4gICAgfVxuICAgIF90aGVuVW53cmFwKHRyYW5zZm9ybSkge1xuICAgICAgICByZXR1cm4gbmV3IEFQSVByb21pc2UodGhpcy5yZXNwb25zZVByb21pc2UsIGFzeW5jIChwcm9wcykgPT4gX2FkZFJlcXVlc3RJRCh0cmFuc2Zvcm0oYXdhaXQgdGhpcy5wYXJzZVJlc3BvbnNlKHByb3BzKSwgcHJvcHMpLCBwcm9wcy5yZXNwb25zZSkpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSByYXcgYFJlc3BvbnNlYCBpbnN0YW5jZSBpbnN0ZWFkIG9mIHBhcnNpbmcgdGhlIHJlc3BvbnNlXG4gICAgICogZGF0YS5cbiAgICAgKlxuICAgICAqIElmIHlvdSB3YW50IHRvIHBhcnNlIHRoZSByZXNwb25zZSBib2R5IGJ1dCBzdGlsbCBnZXQgdGhlIGBSZXNwb25zZWBcbiAgICAgKiBpbnN0YW5jZSwgeW91IGNhbiB1c2Uge0BsaW5rIHdpdGhSZXNwb25zZSgpfS5cbiAgICAgKlxuICAgICAqIPCfkYsgR2V0dGluZyB0aGUgd3JvbmcgVHlwZVNjcmlwdCB0eXBlIGZvciBgUmVzcG9uc2VgP1xuICAgICAqIFRyeSBzZXR0aW5nIGBcIm1vZHVsZVJlc29sdXRpb25cIjogXCJOb2RlTmV4dFwiYCBpZiB5b3UgY2FuLFxuICAgICAqIG9yIGFkZCBvbmUgb2YgdGhlc2UgaW1wb3J0cyBiZWZvcmUgeW91ciBmaXJzdCBgaW1wb3J0IOKApiBmcm9tICdvcGVuYWknYDpcbiAgICAgKiAtIGBpbXBvcnQgJ29wZW5haS9zaGltcy9ub2RlJ2AgKGlmIHlvdSdyZSBydW5uaW5nIG9uIE5vZGUpXG4gICAgICogLSBgaW1wb3J0ICdvcGVuYWkvc2hpbXMvd2ViJ2AgKG90aGVyd2lzZSlcbiAgICAgKi9cbiAgICBhc1Jlc3BvbnNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXNwb25zZVByb21pc2UudGhlbigocCkgPT4gcC5yZXNwb25zZSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHBhcnNlZCByZXNwb25zZSBkYXRhLCB0aGUgcmF3IGBSZXNwb25zZWAgaW5zdGFuY2UgYW5kIHRoZSBJRCBvZiB0aGUgcmVxdWVzdCxcbiAgICAgKiByZXR1cm5lZCB2aWEgdGhlIFgtUmVxdWVzdC1JRCBoZWFkZXIgd2hpY2ggaXMgdXNlZnVsIGZvciBkZWJ1Z2dpbmcgcmVxdWVzdHMgYW5kIHJlcG9ydGluZ1xuICAgICAqIGlzc3VlcyB0byBPcGVuQUkuXG4gICAgICpcbiAgICAgKiBJZiB5b3UganVzdCB3YW50IHRvIGdldCB0aGUgcmF3IGBSZXNwb25zZWAgaW5zdGFuY2Ugd2l0aG91dCBwYXJzaW5nIGl0LFxuICAgICAqIHlvdSBjYW4gdXNlIHtAbGluayBhc1Jlc3BvbnNlKCl9LlxuICAgICAqXG4gICAgICpcbiAgICAgKiDwn5GLIEdldHRpbmcgdGhlIHdyb25nIFR5cGVTY3JpcHQgdHlwZSBmb3IgYFJlc3BvbnNlYD9cbiAgICAgKiBUcnkgc2V0dGluZyBgXCJtb2R1bGVSZXNvbHV0aW9uXCI6IFwiTm9kZU5leHRcImAgaWYgeW91IGNhbixcbiAgICAgKiBvciBhZGQgb25lIG9mIHRoZXNlIGltcG9ydHMgYmVmb3JlIHlvdXIgZmlyc3QgYGltcG9ydCDigKYgZnJvbSAnb3BlbmFpJ2A6XG4gICAgICogLSBgaW1wb3J0ICdvcGVuYWkvc2hpbXMvbm9kZSdgIChpZiB5b3UncmUgcnVubmluZyBvbiBOb2RlKVxuICAgICAqIC0gYGltcG9ydCAnb3BlbmFpL3NoaW1zL3dlYidgIChvdGhlcndpc2UpXG4gICAgICovXG4gICAgYXN5bmMgd2l0aFJlc3BvbnNlKCkge1xuICAgICAgICBjb25zdCBbZGF0YSwgcmVzcG9uc2VdID0gYXdhaXQgUHJvbWlzZS5hbGwoW3RoaXMucGFyc2UoKSwgdGhpcy5hc1Jlc3BvbnNlKCldKTtcbiAgICAgICAgcmV0dXJuIHsgZGF0YSwgcmVzcG9uc2UsIHJlcXVlc3RfaWQ6IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCd4LXJlcXVlc3QtaWQnKSB9O1xuICAgIH1cbiAgICBwYXJzZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlZFByb21pc2UpIHtcbiAgICAgICAgICAgIHRoaXMucGFyc2VkUHJvbWlzZSA9IHRoaXMucmVzcG9uc2VQcm9taXNlLnRoZW4odGhpcy5wYXJzZVJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZWRQcm9taXNlO1xuICAgIH1cbiAgICB0aGVuKG9uZnVsZmlsbGVkLCBvbnJlamVjdGVkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlKCkudGhlbihvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCk7XG4gICAgfVxuICAgIGNhdGNoKG9ucmVqZWN0ZWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2UoKS5jYXRjaChvbnJlamVjdGVkKTtcbiAgICB9XG4gICAgZmluYWxseShvbmZpbmFsbHkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2UoKS5maW5hbGx5KG9uZmluYWxseSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFQSUNsaWVudCB7XG4gICAgY29uc3RydWN0b3IoeyBiYXNlVVJMLCBtYXhSZXRyaWVzID0gMiwgdGltZW91dCA9IDYwMDAwMCwgLy8gMTAgbWludXRlc1xuICAgIGh0dHBBZ2VudCwgZmV0Y2g6IG92ZXJyaWRkZW5GZXRjaCwgfSkge1xuICAgICAgICB0aGlzLmJhc2VVUkwgPSBiYXNlVVJMO1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSB2YWxpZGF0ZVBvc2l0aXZlSW50ZWdlcignbWF4UmV0cmllcycsIG1heFJldHJpZXMpO1xuICAgICAgICB0aGlzLnRpbWVvdXQgPSB2YWxpZGF0ZVBvc2l0aXZlSW50ZWdlcigndGltZW91dCcsIHRpbWVvdXQpO1xuICAgICAgICB0aGlzLmh0dHBBZ2VudCA9IGh0dHBBZ2VudDtcbiAgICAgICAgdGhpcy5mZXRjaCA9IG92ZXJyaWRkZW5GZXRjaCA/PyBmZXRjaDtcbiAgICB9XG4gICAgYXV0aEhlYWRlcnMob3B0cykge1xuICAgICAgICByZXR1cm4ge307XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE92ZXJyaWRlIHRoaXMgdG8gYWRkIHlvdXIgb3duIGRlZmF1bHQgaGVhZGVycywgZm9yIGV4YW1wbGU6XG4gICAgICpcbiAgICAgKiAge1xuICAgICAqICAgIC4uLnN1cGVyLmRlZmF1bHRIZWFkZXJzKCksXG4gICAgICogICAgQXV0aG9yaXphdGlvbjogJ0JlYXJlciAxMjMnLFxuICAgICAqICB9XG4gICAgICovXG4gICAgZGVmYXVsdEhlYWRlcnMob3B0cykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgQWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgJ1VzZXItQWdlbnQnOiB0aGlzLmdldFVzZXJBZ2VudCgpLFxuICAgICAgICAgICAgLi4uZ2V0UGxhdGZvcm1IZWFkZXJzKCksXG4gICAgICAgICAgICAuLi50aGlzLmF1dGhIZWFkZXJzKG9wdHMpLFxuICAgICAgICB9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBPdmVycmlkZSB0aGlzIHRvIGFkZCB5b3VyIG93biBoZWFkZXJzIHZhbGlkYXRpb246XG4gICAgICovXG4gICAgdmFsaWRhdGVIZWFkZXJzKGhlYWRlcnMsIGN1c3RvbUhlYWRlcnMpIHsgfVxuICAgIGRlZmF1bHRJZGVtcG90ZW5jeUtleSgpIHtcbiAgICAgICAgcmV0dXJuIGBzdGFpbmxlc3Mtbm9kZS1yZXRyeS0ke3V1aWQ0KCl9YDtcbiAgICB9XG4gICAgZ2V0KHBhdGgsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWV0aG9kUmVxdWVzdCgnZ2V0JywgcGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIHBvc3QocGF0aCwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXRob2RSZXF1ZXN0KCdwb3N0JywgcGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIHBhdGNoKHBhdGgsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWV0aG9kUmVxdWVzdCgncGF0Y2gnLCBwYXRoLCBvcHRzKTtcbiAgICB9XG4gICAgcHV0KHBhdGgsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWV0aG9kUmVxdWVzdCgncHV0JywgcGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIGRlbGV0ZShwYXRoLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ldGhvZFJlcXVlc3QoJ2RlbGV0ZScsIHBhdGgsIG9wdHMpO1xuICAgIH1cbiAgICBtZXRob2RSZXF1ZXN0KG1ldGhvZCwgcGF0aCwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFByb21pc2UucmVzb2x2ZShvcHRzKS50aGVuKGFzeW5jIChvcHRzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gb3B0cyAmJiBpc0Jsb2JMaWtlKG9wdHM/LmJvZHkpID8gbmV3IERhdGFWaWV3KGF3YWl0IG9wdHMuYm9keS5hcnJheUJ1ZmZlcigpKVxuICAgICAgICAgICAgICAgIDogb3B0cz8uYm9keSBpbnN0YW5jZW9mIERhdGFWaWV3ID8gb3B0cy5ib2R5XG4gICAgICAgICAgICAgICAgICAgIDogb3B0cz8uYm9keSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyID8gbmV3IERhdGFWaWV3KG9wdHMuYm9keSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogb3B0cyAmJiBBcnJheUJ1ZmZlci5pc1ZpZXcob3B0cz8uYm9keSkgPyBuZXcgRGF0YVZpZXcob3B0cy5ib2R5LmJ1ZmZlcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IG9wdHM/LmJvZHk7XG4gICAgICAgICAgICByZXR1cm4geyBtZXRob2QsIHBhdGgsIC4uLm9wdHMsIGJvZHkgfTtcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBnZXRBUElMaXN0KHBhdGgsIFBhZ2UsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdEFQSUxpc3QoUGFnZSwgeyBtZXRob2Q6ICdnZXQnLCBwYXRoLCAuLi5vcHRzIH0pO1xuICAgIH1cbiAgICBjYWxjdWxhdGVDb250ZW50TGVuZ3RoKGJvZHkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEJ1ZmZlci5ieXRlTGVuZ3RoKGJvZHksICd1dGY4JykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgVGV4dEVuY29kZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuY29kZWQgPSBlbmNvZGVyLmVuY29kZShib2R5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5jb2RlZC5sZW5ndGgudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoYm9keSkpIHtcbiAgICAgICAgICAgIHJldHVybiBib2R5LmJ5dGVMZW5ndGgudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgYnVpbGRSZXF1ZXN0KG9wdGlvbnMsIHsgcmV0cnlDb3VudCA9IDAgfSA9IHt9KSB7XG4gICAgICAgIG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMgfTtcbiAgICAgICAgY29uc3QgeyBtZXRob2QsIHBhdGgsIHF1ZXJ5LCBoZWFkZXJzOiBoZWFkZXJzID0ge30gfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBBcnJheUJ1ZmZlci5pc1ZpZXcob3B0aW9ucy5ib2R5KSB8fCAob3B0aW9ucy5fX2JpbmFyeVJlcXVlc3QgJiYgdHlwZW9mIG9wdGlvbnMuYm9keSA9PT0gJ3N0cmluZycpID9cbiAgICAgICAgICAgIG9wdGlvbnMuYm9keVxuICAgICAgICAgICAgOiBpc011bHRpcGFydEJvZHkob3B0aW9ucy5ib2R5KSA/IG9wdGlvbnMuYm9keS5ib2R5XG4gICAgICAgICAgICAgICAgOiBvcHRpb25zLmJvZHkgPyBKU09OLnN0cmluZ2lmeShvcHRpb25zLmJvZHksIG51bGwsIDIpXG4gICAgICAgICAgICAgICAgICAgIDogbnVsbDtcbiAgICAgICAgY29uc3QgY29udGVudExlbmd0aCA9IHRoaXMuY2FsY3VsYXRlQ29udGVudExlbmd0aChib2R5KTtcbiAgICAgICAgY29uc3QgdXJsID0gdGhpcy5idWlsZFVSTChwYXRoLCBxdWVyeSk7XG4gICAgICAgIGlmICgndGltZW91dCcgaW4gb3B0aW9ucylcbiAgICAgICAgICAgIHZhbGlkYXRlUG9zaXRpdmVJbnRlZ2VyKCd0aW1lb3V0Jywgb3B0aW9ucy50aW1lb3V0KTtcbiAgICAgICAgb3B0aW9ucy50aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0ID8/IHRoaXMudGltZW91dDtcbiAgICAgICAgY29uc3QgaHR0cEFnZW50ID0gb3B0aW9ucy5odHRwQWdlbnQgPz8gdGhpcy5odHRwQWdlbnQgPz8gZ2V0RGVmYXVsdEFnZW50KHVybCk7XG4gICAgICAgIGNvbnN0IG1pbkFnZW50VGltZW91dCA9IG9wdGlvbnMudGltZW91dCArIDEwMDA7XG4gICAgICAgIGlmICh0eXBlb2YgaHR0cEFnZW50Py5vcHRpb25zPy50aW1lb3V0ID09PSAnbnVtYmVyJyAmJlxuICAgICAgICAgICAgbWluQWdlbnRUaW1lb3V0ID4gKGh0dHBBZ2VudC5vcHRpb25zLnRpbWVvdXQgPz8gMCkpIHtcbiAgICAgICAgICAgIC8vIEFsbG93IGFueSBnaXZlbiByZXF1ZXN0IHRvIGJ1bXAgb3VyIGFnZW50IGFjdGl2ZSBzb2NrZXQgdGltZW91dC5cbiAgICAgICAgICAgIC8vIFRoaXMgbWF5IHNlZW0gc3RyYW5nZSwgYnV0IGxlYWtpbmcgYWN0aXZlIHNvY2tldHMgc2hvdWxkIGJlIHJhcmUgYW5kIG5vdCBwYXJ0aWN1bGFybHkgcHJvYmxlbWF0aWMsXG4gICAgICAgICAgICAvLyBhbmQgd2l0aG91dCBtdXRhdGluZyBhZ2VudCB3ZSB3b3VsZCBuZWVkIHRvIGNyZWF0ZSBtb3JlIG9mIHRoZW0uXG4gICAgICAgICAgICAvLyBUaGlzIHRyYWRlb2ZmIG9wdGltaXplcyBmb3IgcGVyZm9ybWFuY2UuXG4gICAgICAgICAgICBodHRwQWdlbnQub3B0aW9ucy50aW1lb3V0ID0gbWluQWdlbnRUaW1lb3V0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmlkZW1wb3RlbmN5SGVhZGVyICYmIG1ldGhvZCAhPT0gJ2dldCcpIHtcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5pZGVtcG90ZW5jeUtleSlcbiAgICAgICAgICAgICAgICBvcHRpb25zLmlkZW1wb3RlbmN5S2V5ID0gdGhpcy5kZWZhdWx0SWRlbXBvdGVuY3lLZXkoKTtcbiAgICAgICAgICAgIGhlYWRlcnNbdGhpcy5pZGVtcG90ZW5jeUhlYWRlcl0gPSBvcHRpb25zLmlkZW1wb3RlbmN5S2V5O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlcUhlYWRlcnMgPSB0aGlzLmJ1aWxkSGVhZGVycyh7IG9wdGlvbnMsIGhlYWRlcnMsIGNvbnRlbnRMZW5ndGgsIHJldHJ5Q291bnQgfSk7XG4gICAgICAgIGNvbnN0IHJlcSA9IHtcbiAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgIC4uLihib2R5ICYmIHsgYm9keTogYm9keSB9KSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHJlcUhlYWRlcnMsXG4gICAgICAgICAgICAuLi4oaHR0cEFnZW50ICYmIHsgYWdlbnQ6IGh0dHBBZ2VudCB9KSxcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmUgbm9kZS1mZXRjaCB1c2VzIGEgY3VzdG9tIEFib3J0U2lnbmFsIHR5cGUgdGhhdCBpc1xuICAgICAgICAgICAgLy8gbm90IGNvbXBhdGlibGUgd2l0aCBzdGFuZGFyZCB3ZWIgdHlwZXNcbiAgICAgICAgICAgIHNpZ25hbDogb3B0aW9ucy5zaWduYWwgPz8gbnVsbCxcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHsgcmVxLCB1cmwsIHRpbWVvdXQ6IG9wdGlvbnMudGltZW91dCB9O1xuICAgIH1cbiAgICBidWlsZEhlYWRlcnMoeyBvcHRpb25zLCBoZWFkZXJzLCBjb250ZW50TGVuZ3RoLCByZXRyeUNvdW50LCB9KSB7XG4gICAgICAgIGNvbnN0IHJlcUhlYWRlcnMgPSB7fTtcbiAgICAgICAgaWYgKGNvbnRlbnRMZW5ndGgpIHtcbiAgICAgICAgICAgIHJlcUhlYWRlcnNbJ2NvbnRlbnQtbGVuZ3RoJ10gPSBjb250ZW50TGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlZmF1bHRIZWFkZXJzID0gdGhpcy5kZWZhdWx0SGVhZGVycyhvcHRpb25zKTtcbiAgICAgICAgYXBwbHlIZWFkZXJzTXV0KHJlcUhlYWRlcnMsIGRlZmF1bHRIZWFkZXJzKTtcbiAgICAgICAgYXBwbHlIZWFkZXJzTXV0KHJlcUhlYWRlcnMsIGhlYWRlcnMpO1xuICAgICAgICAvLyBsZXQgYnVpbHRpbiBmZXRjaCBzZXQgdGhlIENvbnRlbnQtVHlwZSBmb3IgbXVsdGlwYXJ0IGJvZGllc1xuICAgICAgICBpZiAoaXNNdWx0aXBhcnRCb2R5KG9wdGlvbnMuYm9keSkgJiYgc2hpbXNLaW5kICE9PSAnbm9kZScpIHtcbiAgICAgICAgICAgIGRlbGV0ZSByZXFIZWFkZXJzWydjb250ZW50LXR5cGUnXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBEb24ndCBzZXQgdGhlc2VzIGhlYWRlcnMgaWYgdGhleSB3ZXJlIGFscmVhZHkgc2V0IG9yIHJlbW92ZWQgdGhyb3VnaCBkZWZhdWx0IGhlYWRlcnMgb3IgYnkgdGhlIGNhbGxlci5cbiAgICAgICAgLy8gV2UgY2hlY2sgYGRlZmF1bHRIZWFkZXJzYCBhbmQgYGhlYWRlcnNgLCB3aGljaCBjYW4gY29udGFpbiBudWxscywgaW5zdGVhZCBvZiBgcmVxSGVhZGVyc2AgdG8gYWNjb3VudFxuICAgICAgICAvLyBmb3IgdGhlIHJlbW92YWwgY2FzZS5cbiAgICAgICAgaWYgKGdldEhlYWRlcihkZWZhdWx0SGVhZGVycywgJ3gtc3RhaW5sZXNzLXJldHJ5LWNvdW50JykgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgZ2V0SGVhZGVyKGhlYWRlcnMsICd4LXN0YWlubGVzcy1yZXRyeS1jb3VudCcpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlcUhlYWRlcnNbJ3gtc3RhaW5sZXNzLXJldHJ5LWNvdW50J10gPSBTdHJpbmcocmV0cnlDb3VudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGdldEhlYWRlcihkZWZhdWx0SGVhZGVycywgJ3gtc3RhaW5sZXNzLXRpbWVvdXQnKSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBnZXRIZWFkZXIoaGVhZGVycywgJ3gtc3RhaW5sZXNzLXRpbWVvdXQnKSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBvcHRpb25zLnRpbWVvdXQpIHtcbiAgICAgICAgICAgIHJlcUhlYWRlcnNbJ3gtc3RhaW5sZXNzLXRpbWVvdXQnXSA9IFN0cmluZyhvcHRpb25zLnRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudmFsaWRhdGVIZWFkZXJzKHJlcUhlYWRlcnMsIGhlYWRlcnMpO1xuICAgICAgICByZXR1cm4gcmVxSGVhZGVycztcbiAgICB9XG4gICAgLyoqXG4gICAgICogVXNlZCBhcyBhIGNhbGxiYWNrIGZvciBtdXRhdGluZyB0aGUgZ2l2ZW4gYEZpbmFsUmVxdWVzdE9wdGlvbnNgIG9iamVjdC5cbiAgICAgKi9cbiAgICBhc3luYyBwcmVwYXJlT3B0aW9ucyhvcHRpb25zKSB7IH1cbiAgICAvKipcbiAgICAgKiBVc2VkIGFzIGEgY2FsbGJhY2sgZm9yIG11dGF0aW5nIHRoZSBnaXZlbiBgUmVxdWVzdEluaXRgIG9iamVjdC5cbiAgICAgKlxuICAgICAqIFRoaXMgaXMgdXNlZnVsIGZvciBjYXNlcyB3aGVyZSB5b3Ugd2FudCB0byBhZGQgY2VydGFpbiBoZWFkZXJzIGJhc2VkIG9mZiBvZlxuICAgICAqIHRoZSByZXF1ZXN0IHByb3BlcnRpZXMsIGUuZy4gYG1ldGhvZGAgb3IgYHVybGAuXG4gICAgICovXG4gICAgYXN5bmMgcHJlcGFyZVJlcXVlc3QocmVxdWVzdCwgeyB1cmwsIG9wdGlvbnMgfSkgeyB9XG4gICAgcGFyc2VIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAgICAgcmV0dXJuICghaGVhZGVycyA/IHt9XG4gICAgICAgICAgICA6IFN5bWJvbC5pdGVyYXRvciBpbiBoZWFkZXJzID9cbiAgICAgICAgICAgICAgICBPYmplY3QuZnJvbUVudHJpZXMoQXJyYXkuZnJvbShoZWFkZXJzKS5tYXAoKGhlYWRlcikgPT4gWy4uLmhlYWRlcl0pKVxuICAgICAgICAgICAgICAgIDogeyAuLi5oZWFkZXJzIH0pO1xuICAgIH1cbiAgICBtYWtlU3RhdHVzRXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycykge1xuICAgICAgICByZXR1cm4gQVBJRXJyb3IuZ2VuZXJhdGUoc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgfVxuICAgIHJlcXVlc3Qob3B0aW9ucywgcmVtYWluaW5nUmV0cmllcyA9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBUElQcm9taXNlKHRoaXMubWFrZVJlcXVlc3Qob3B0aW9ucywgcmVtYWluaW5nUmV0cmllcykpO1xuICAgIH1cbiAgICBhc3luYyBtYWtlUmVxdWVzdChvcHRpb25zSW5wdXQsIHJldHJpZXNSZW1haW5pbmcpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IG9wdGlvbnNJbnB1dDtcbiAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IG9wdGlvbnMubWF4UmV0cmllcyA/PyB0aGlzLm1heFJldHJpZXM7XG4gICAgICAgIGlmIChyZXRyaWVzUmVtYWluaW5nID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHJpZXNSZW1haW5pbmcgPSBtYXhSZXRyaWVzO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IHRoaXMucHJlcGFyZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIGNvbnN0IHsgcmVxLCB1cmwsIHRpbWVvdXQgfSA9IHRoaXMuYnVpbGRSZXF1ZXN0KG9wdGlvbnMsIHsgcmV0cnlDb3VudDogbWF4UmV0cmllcyAtIHJldHJpZXNSZW1haW5pbmcgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucHJlcGFyZVJlcXVlc3QocmVxLCB7IHVybCwgb3B0aW9ucyB9KTtcbiAgICAgICAgZGVidWcoJ3JlcXVlc3QnLCB1cmwsIG9wdGlvbnMsIHJlcS5oZWFkZXJzKTtcbiAgICAgICAgaWYgKG9wdGlvbnMuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuZmV0Y2hXaXRoVGltZW91dCh1cmwsIHJlcSwgdGltZW91dCwgY29udHJvbGxlcikuY2F0Y2goY2FzdFRvRXJyb3IpO1xuICAgICAgICBpZiAocmVzcG9uc2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmV0cmllc1JlbWFpbmluZykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHJ5UmVxdWVzdChvcHRpb25zLCByZXRyaWVzUmVtYWluaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSUNvbm5lY3Rpb25FcnJvcih7IGNhdXNlOiByZXNwb25zZSB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNwb25zZUhlYWRlcnMgPSBjcmVhdGVSZXNwb25zZUhlYWRlcnMocmVzcG9uc2UuaGVhZGVycyk7XG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgIGlmIChyZXRyaWVzUmVtYWluaW5nICYmIHRoaXMuc2hvdWxkUmV0cnkocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0cnlNZXNzYWdlID0gYHJldHJ5aW5nLCAke3JldHJpZXNSZW1haW5pbmd9IGF0dGVtcHRzIHJlbWFpbmluZ2A7XG4gICAgICAgICAgICAgICAgZGVidWcoYHJlc3BvbnNlIChlcnJvcjsgJHtyZXRyeU1lc3NhZ2V9KWAsIHJlc3BvbnNlLnN0YXR1cywgdXJsLCByZXNwb25zZUhlYWRlcnMpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHJ5UmVxdWVzdChvcHRpb25zLCByZXRyaWVzUmVtYWluaW5nLCByZXNwb25zZUhlYWRlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZXJyVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoZSkgPT4gY2FzdFRvRXJyb3IoZSkubWVzc2FnZSk7XG4gICAgICAgICAgICBjb25zdCBlcnJKU09OID0gc2FmZUpTT04oZXJyVGV4dCk7XG4gICAgICAgICAgICBjb25zdCBlcnJNZXNzYWdlID0gZXJySlNPTiA/IHVuZGVmaW5lZCA6IGVyclRleHQ7XG4gICAgICAgICAgICBjb25zdCByZXRyeU1lc3NhZ2UgPSByZXRyaWVzUmVtYWluaW5nID8gYChlcnJvcjsgbm8gbW9yZSByZXRyaWVzIGxlZnQpYCA6IGAoZXJyb3I7IG5vdCByZXRyeWFibGUpYDtcbiAgICAgICAgICAgIGRlYnVnKGByZXNwb25zZSAoZXJyb3I7ICR7cmV0cnlNZXNzYWdlfSlgLCByZXNwb25zZS5zdGF0dXMsIHVybCwgcmVzcG9uc2VIZWFkZXJzLCBlcnJNZXNzYWdlKTtcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IHRoaXMubWFrZVN0YXR1c0Vycm9yKHJlc3BvbnNlLnN0YXR1cywgZXJySlNPTiwgZXJyTWVzc2FnZSwgcmVzcG9uc2VIZWFkZXJzKTtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyByZXNwb25zZSwgb3B0aW9ucywgY29udHJvbGxlciB9O1xuICAgIH1cbiAgICByZXF1ZXN0QVBJTGlzdChQYWdlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLm1ha2VSZXF1ZXN0KG9wdGlvbnMsIG51bGwpO1xuICAgICAgICByZXR1cm4gbmV3IFBhZ2VQcm9taXNlKHRoaXMsIHJlcXVlc3QsIFBhZ2UpO1xuICAgIH1cbiAgICBidWlsZFVSTChwYXRoLCBxdWVyeSkge1xuICAgICAgICBjb25zdCB1cmwgPSBpc0Fic29sdXRlVVJMKHBhdGgpID9cbiAgICAgICAgICAgIG5ldyBVUkwocGF0aClcbiAgICAgICAgICAgIDogbmV3IFVSTCh0aGlzLmJhc2VVUkwgKyAodGhpcy5iYXNlVVJMLmVuZHNXaXRoKCcvJykgJiYgcGF0aC5zdGFydHNXaXRoKCcvJykgPyBwYXRoLnNsaWNlKDEpIDogcGF0aCkpO1xuICAgICAgICBjb25zdCBkZWZhdWx0UXVlcnkgPSB0aGlzLmRlZmF1bHRRdWVyeSgpO1xuICAgICAgICBpZiAoIWlzRW1wdHlPYmooZGVmYXVsdFF1ZXJ5KSkge1xuICAgICAgICAgICAgcXVlcnkgPSB7IC4uLmRlZmF1bHRRdWVyeSwgLi4ucXVlcnkgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHF1ZXJ5ID09PSAnb2JqZWN0JyAmJiBxdWVyeSAmJiAhQXJyYXkuaXNBcnJheShxdWVyeSkpIHtcbiAgICAgICAgICAgIHVybC5zZWFyY2ggPSB0aGlzLnN0cmluZ2lmeVF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIHN0cmluZ2lmeVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhxdWVyeSlcbiAgICAgICAgICAgIC5maWx0ZXIoKFtfLCB2YWx1ZV0pID0+IHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgICAgICAubWFwKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYCR7ZW5jb2RlVVJJQ29tcG9uZW50KGtleSl9PSR7ZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlKX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke2VuY29kZVVSSUNvbXBvbmVudChrZXkpfT1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBDYW5ub3Qgc3RyaW5naWZ5IHR5cGUgJHt0eXBlb2YgdmFsdWV9OyBFeHBlY3RlZCBzdHJpbmcsIG51bWJlciwgYm9vbGVhbiwgb3IgbnVsbC4gSWYgeW91IG5lZWQgdG8gcGFzcyBuZXN0ZWQgcXVlcnkgcGFyYW1ldGVycywgeW91IGNhbiBtYW51YWxseSBlbmNvZGUgdGhlbSwgZS5nLiB7IHF1ZXJ5OiB7ICdmb29ba2V5MV0nOiB2YWx1ZTEsICdmb29ba2V5Ml0nOiB2YWx1ZTIgfSB9LCBhbmQgcGxlYXNlIG9wZW4gYSBHaXRIdWIgaXNzdWUgcmVxdWVzdGluZyBiZXR0ZXIgc3VwcG9ydCBmb3IgeW91ciB1c2UgY2FzZS5gKTtcbiAgICAgICAgfSlcbiAgICAgICAgICAgIC5qb2luKCcmJyk7XG4gICAgfVxuICAgIGFzeW5jIGZldGNoV2l0aFRpbWVvdXQodXJsLCBpbml0LCBtcywgY29udHJvbGxlcikge1xuICAgICAgICBjb25zdCB7IHNpZ25hbCwgLi4ub3B0aW9ucyB9ID0gaW5pdCB8fCB7fTtcbiAgICAgICAgaWYgKHNpZ25hbClcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgbXMpO1xuICAgICAgICBjb25zdCBmZXRjaE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGZldGNoT3B0aW9ucy5tZXRob2QpIHtcbiAgICAgICAgICAgIC8vIEN1c3RvbSBtZXRob2RzIGxpa2UgJ3BhdGNoJyBuZWVkIHRvIGJlIHVwcGVyY2FzZWRcbiAgICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL3VuZGljaS9pc3N1ZXMvMjI5NFxuICAgICAgICAgICAgZmV0Y2hPcHRpb25zLm1ldGhvZCA9IGZldGNoT3B0aW9ucy5tZXRob2QudG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAvLyB1c2UgdW5kZWZpbmVkIHRoaXMgYmluZGluZzsgZmV0Y2ggZXJyb3JzIGlmIGJvdW5kIHRvIHNvbWV0aGluZyBlbHNlIGluIGJyb3dzZXIvY2xvdWRmbGFyZVxuICAgICAgICB0aGlzLmZldGNoLmNhbGwodW5kZWZpbmVkLCB1cmwsIGZldGNoT3B0aW9ucykuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgc2hvdWxkUmV0cnkocmVzcG9uc2UpIHtcbiAgICAgICAgLy8gTm90ZSB0aGlzIGlzIG5vdCBhIHN0YW5kYXJkIGhlYWRlci5cbiAgICAgICAgY29uc3Qgc2hvdWxkUmV0cnlIZWFkZXIgPSByZXNwb25zZS5oZWFkZXJzLmdldCgneC1zaG91bGQtcmV0cnknKTtcbiAgICAgICAgLy8gSWYgdGhlIHNlcnZlciBleHBsaWNpdGx5IHNheXMgd2hldGhlciBvciBub3QgdG8gcmV0cnksIG9iZXkuXG4gICAgICAgIGlmIChzaG91bGRSZXRyeUhlYWRlciA9PT0gJ3RydWUnKVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIGlmIChzaG91bGRSZXRyeUhlYWRlciA9PT0gJ2ZhbHNlJylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgLy8gUmV0cnkgb24gcmVxdWVzdCB0aW1lb3V0cy5cbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDA4KVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIC8vIFJldHJ5IG9uIGxvY2sgdGltZW91dHMuXG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwOSlcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAvLyBSZXRyeSBvbiByYXRlIGxpbWl0cy5cbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5KVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIC8vIFJldHJ5IGludGVybmFsIGVycm9ycy5cbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhc3luYyByZXRyeVJlcXVlc3Qob3B0aW9ucywgcmV0cmllc1JlbWFpbmluZywgcmVzcG9uc2VIZWFkZXJzKSB7XG4gICAgICAgIGxldCB0aW1lb3V0TWlsbGlzO1xuICAgICAgICAvLyBOb3RlIHRoZSBgcmV0cnktYWZ0ZXItbXNgIGhlYWRlciBtYXkgbm90IGJlIHN0YW5kYXJkLCBidXQgaXMgYSBnb29kIGlkZWEgYW5kIHdlJ2QgbGlrZSBwcm9hY3RpdmUgc3VwcG9ydCBmb3IgaXQuXG4gICAgICAgIGNvbnN0IHJldHJ5QWZ0ZXJNaWxsaXNIZWFkZXIgPSByZXNwb25zZUhlYWRlcnM/LlsncmV0cnktYWZ0ZXItbXMnXTtcbiAgICAgICAgaWYgKHJldHJ5QWZ0ZXJNaWxsaXNIZWFkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXRNcyA9IHBhcnNlRmxvYXQocmV0cnlBZnRlck1pbGxpc0hlYWRlcik7XG4gICAgICAgICAgICBpZiAoIU51bWJlci5pc05hTih0aW1lb3V0TXMpKSB7XG4gICAgICAgICAgICAgICAgdGltZW91dE1pbGxpcyA9IHRpbWVvdXRNcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBBYm91dCB0aGUgUmV0cnktQWZ0ZXIgaGVhZGVyOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9IVFRQL0hlYWRlcnMvUmV0cnktQWZ0ZXJcbiAgICAgICAgY29uc3QgcmV0cnlBZnRlckhlYWRlciA9IHJlc3BvbnNlSGVhZGVycz8uWydyZXRyeS1hZnRlciddO1xuICAgICAgICBpZiAocmV0cnlBZnRlckhlYWRlciAmJiAhdGltZW91dE1pbGxpcykge1xuICAgICAgICAgICAgY29uc3QgdGltZW91dFNlY29uZHMgPSBwYXJzZUZsb2F0KHJldHJ5QWZ0ZXJIZWFkZXIpO1xuICAgICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4odGltZW91dFNlY29uZHMpKSB7XG4gICAgICAgICAgICAgICAgdGltZW91dE1pbGxpcyA9IHRpbWVvdXRTZWNvbmRzICogMTAwMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRpbWVvdXRNaWxsaXMgPSBEYXRlLnBhcnNlKHJldHJ5QWZ0ZXJIZWFkZXIpIC0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB0aGUgQVBJIGFza3MgdXMgdG8gd2FpdCBhIGNlcnRhaW4gYW1vdW50IG9mIHRpbWUgKGFuZCBpdCdzIGEgcmVhc29uYWJsZSBhbW91bnQpLFxuICAgICAgICAvLyBqdXN0IGRvIHdoYXQgaXQgc2F5cywgYnV0IG90aGVyd2lzZSBjYWxjdWxhdGUgYSBkZWZhdWx0XG4gICAgICAgIGlmICghKHRpbWVvdXRNaWxsaXMgJiYgMCA8PSB0aW1lb3V0TWlsbGlzICYmIHRpbWVvdXRNaWxsaXMgPCA2MCAqIDEwMDApKSB7XG4gICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gb3B0aW9ucy5tYXhSZXRyaWVzID8/IHRoaXMubWF4UmV0cmllcztcbiAgICAgICAgICAgIHRpbWVvdXRNaWxsaXMgPSB0aGlzLmNhbGN1bGF0ZURlZmF1bHRSZXRyeVRpbWVvdXRNaWxsaXMocmV0cmllc1JlbWFpbmluZywgbWF4UmV0cmllcyk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgc2xlZXAodGltZW91dE1pbGxpcyk7XG4gICAgICAgIHJldHVybiB0aGlzLm1ha2VSZXF1ZXN0KG9wdGlvbnMsIHJldHJpZXNSZW1haW5pbmcgLSAxKTtcbiAgICB9XG4gICAgY2FsY3VsYXRlRGVmYXVsdFJldHJ5VGltZW91dE1pbGxpcyhyZXRyaWVzUmVtYWluaW5nLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIGNvbnN0IGluaXRpYWxSZXRyeURlbGF5ID0gMC41O1xuICAgICAgICBjb25zdCBtYXhSZXRyeURlbGF5ID0gOC4wO1xuICAgICAgICBjb25zdCBudW1SZXRyaWVzID0gbWF4UmV0cmllcyAtIHJldHJpZXNSZW1haW5pbmc7XG4gICAgICAgIC8vIEFwcGx5IGV4cG9uZW50aWFsIGJhY2tvZmYsIGJ1dCBub3QgbW9yZSB0aGFuIHRoZSBtYXguXG4gICAgICAgIGNvbnN0IHNsZWVwU2Vjb25kcyA9IE1hdGgubWluKGluaXRpYWxSZXRyeURlbGF5ICogTWF0aC5wb3coMiwgbnVtUmV0cmllcyksIG1heFJldHJ5RGVsYXkpO1xuICAgICAgICAvLyBBcHBseSBzb21lIGppdHRlciwgdGFrZSB1cCB0byBhdCBtb3N0IDI1IHBlcmNlbnQgb2YgdGhlIHJldHJ5IHRpbWUuXG4gICAgICAgIGNvbnN0IGppdHRlciA9IDEgLSBNYXRoLnJhbmRvbSgpICogMC4yNTtcbiAgICAgICAgcmV0dXJuIHNsZWVwU2Vjb25kcyAqIGppdHRlciAqIDEwMDA7XG4gICAgfVxuICAgIGdldFVzZXJBZ2VudCgpIHtcbiAgICAgICAgcmV0dXJuIGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0vSlMgJHtWRVJTSU9OfWA7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFic3RyYWN0UGFnZSB7XG4gICAgY29uc3RydWN0b3IoY2xpZW50LCByZXNwb25zZSwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBfQWJzdHJhY3RQYWdlX2NsaWVudC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQWJzdHJhY3RQYWdlX2NsaWVudCwgY2xpZW50LCBcImZcIik7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMucmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgdGhpcy5ib2R5ID0gYm9keTtcbiAgICB9XG4gICAgaGFzTmV4dFBhZ2UoKSB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5nZXRQYWdpbmF0ZWRJdGVtcygpO1xuICAgICAgICBpZiAoIWl0ZW1zLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRoaXMubmV4dFBhZ2VJbmZvKCkgIT0gbnVsbDtcbiAgICB9XG4gICAgYXN5bmMgZ2V0TmV4dFBhZ2UoKSB7XG4gICAgICAgIGNvbnN0IG5leHRJbmZvID0gdGhpcy5uZXh0UGFnZUluZm8oKTtcbiAgICAgICAgaWYgKCFuZXh0SW5mbykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKCdObyBuZXh0IHBhZ2UgZXhwZWN0ZWQ7IHBsZWFzZSBjaGVjayBgLmhhc05leHRQYWdlKClgIGJlZm9yZSBjYWxsaW5nIGAuZ2V0TmV4dFBhZ2UoKWAuJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbmV4dE9wdGlvbnMgPSB7IC4uLnRoaXMub3B0aW9ucyB9O1xuICAgICAgICBpZiAoJ3BhcmFtcycgaW4gbmV4dEluZm8gJiYgdHlwZW9mIG5leHRPcHRpb25zLnF1ZXJ5ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgbmV4dE9wdGlvbnMucXVlcnkgPSB7IC4uLm5leHRPcHRpb25zLnF1ZXJ5LCAuLi5uZXh0SW5mby5wYXJhbXMgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICgndXJsJyBpbiBuZXh0SW5mbykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gWy4uLk9iamVjdC5lbnRyaWVzKG5leHRPcHRpb25zLnF1ZXJ5IHx8IHt9KSwgLi4ubmV4dEluZm8udXJsLnNlYXJjaFBhcmFtcy5lbnRyaWVzKCldO1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgcGFyYW1zKSB7XG4gICAgICAgICAgICAgICAgbmV4dEluZm8udXJsLnNlYXJjaFBhcmFtcy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXh0T3B0aW9ucy5xdWVyeSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIG5leHRPcHRpb25zLnBhdGggPSBuZXh0SW5mby51cmwudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXdhaXQgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RQYWdlX2NsaWVudCwgXCJmXCIpLnJlcXVlc3RBUElMaXN0KHRoaXMuY29uc3RydWN0b3IsIG5leHRPcHRpb25zKTtcbiAgICB9XG4gICAgYXN5bmMgKml0ZXJQYWdlcygpIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby10aGlzLWFsaWFzXG4gICAgICAgIGxldCBwYWdlID0gdGhpcztcbiAgICAgICAgeWllbGQgcGFnZTtcbiAgICAgICAgd2hpbGUgKHBhZ2UuaGFzTmV4dFBhZ2UoKSkge1xuICAgICAgICAgICAgcGFnZSA9IGF3YWl0IHBhZ2UuZ2V0TmV4dFBhZ2UoKTtcbiAgICAgICAgICAgIHlpZWxkIHBhZ2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgKlsoX0Fic3RyYWN0UGFnZV9jbGllbnQgPSBuZXcgV2Vha01hcCgpLCBTeW1ib2wuYXN5bmNJdGVyYXRvcildKCkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHBhZ2Ugb2YgdGhpcy5pdGVyUGFnZXMoKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHBhZ2UuZ2V0UGFnaW5hdGVkSXRlbXMoKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4vKipcbiAqIFRoaXMgc3ViY2xhc3Mgb2YgUHJvbWlzZSB3aWxsIHJlc29sdmUgdG8gYW4gaW5zdGFudGlhdGVkIFBhZ2Ugb25jZSB0aGUgcmVxdWVzdCBjb21wbGV0ZXMuXG4gKlxuICogSXQgYWxzbyBpbXBsZW1lbnRzIEFzeW5jSXRlcmFibGUgdG8gYWxsb3cgYXV0by1wYWdpbmF0aW5nIGl0ZXJhdGlvbiBvbiBhbiB1bmF3YWl0ZWQgbGlzdCBjYWxsLCBlZzpcbiAqXG4gKiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xpZW50Lml0ZW1zLmxpc3QoKSkge1xuICogICAgICBjb25zb2xlLmxvZyhpdGVtKVxuICogICAgfVxuICovXG5leHBvcnQgY2xhc3MgUGFnZVByb21pc2UgZXh0ZW5kcyBBUElQcm9taXNlIHtcbiAgICBjb25zdHJ1Y3RvcihjbGllbnQsIHJlcXVlc3QsIFBhZ2UpIHtcbiAgICAgICAgc3VwZXIocmVxdWVzdCwgYXN5bmMgKHByb3BzKSA9PiBuZXcgUGFnZShjbGllbnQsIHByb3BzLnJlc3BvbnNlLCBhd2FpdCBkZWZhdWx0UGFyc2VSZXNwb25zZShwcm9wcyksIHByb3BzLm9wdGlvbnMpKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWxsb3cgYXV0by1wYWdpbmF0aW5nIGl0ZXJhdGlvbiBvbiBhbiB1bmF3YWl0ZWQgbGlzdCBjYWxsLCBlZzpcbiAgICAgKlxuICAgICAqICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGllbnQuaXRlbXMubGlzdCgpKSB7XG4gICAgICogICAgICBjb25zb2xlLmxvZyhpdGVtKVxuICAgICAqICAgIH1cbiAgICAgKi9cbiAgICBhc3luYyAqW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgICAgY29uc3QgcGFnZSA9IGF3YWl0IHRoaXM7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBwYWdlKSB7XG4gICAgICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0IGNvbnN0IGNyZWF0ZVJlc3BvbnNlSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm94eShPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGhlYWRlcnMuZW50cmllcygpKSwge1xuICAgICAgICBnZXQodGFyZ2V0LCBuYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBuYW1lLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleS50b0xvd2VyQ2FzZSgpXSB8fCB0YXJnZXRba2V5XTtcbiAgICAgICAgfSxcbiAgICB9KTtcbn07XG4vLyBUaGlzIGlzIHJlcXVpcmVkIHNvIHRoYXQgd2UgY2FuIGRldGVybWluZSBpZiBhIGdpdmVuIG9iamVjdCBtYXRjaGVzIHRoZSBSZXF1ZXN0T3B0aW9uc1xuLy8gdHlwZSBhdCBydW50aW1lLiBXaGlsZSB0aGlzIHJlcXVpcmVzIGR1cGxpY2F0aW9uLCBpdCBpcyBlbmZvcmNlZCBieSB0aGUgVHlwZVNjcmlwdFxuLy8gY29tcGlsZXIgc3VjaCB0aGF0IGFueSBtaXNzaW5nIC8gZXh0cmFuZW91cyBrZXlzIHdpbGwgY2F1c2UgYW4gZXJyb3IuXG5jb25zdCByZXF1ZXN0T3B0aW9uc0tleXMgPSB7XG4gICAgbWV0aG9kOiB0cnVlLFxuICAgIHBhdGg6IHRydWUsXG4gICAgcXVlcnk6IHRydWUsXG4gICAgYm9keTogdHJ1ZSxcbiAgICBoZWFkZXJzOiB0cnVlLFxuICAgIG1heFJldHJpZXM6IHRydWUsXG4gICAgc3RyZWFtOiB0cnVlLFxuICAgIHRpbWVvdXQ6IHRydWUsXG4gICAgaHR0cEFnZW50OiB0cnVlLFxuICAgIHNpZ25hbDogdHJ1ZSxcbiAgICBpZGVtcG90ZW5jeUtleTogdHJ1ZSxcbiAgICBfX21ldGFkYXRhOiB0cnVlLFxuICAgIF9fYmluYXJ5UmVxdWVzdDogdHJ1ZSxcbiAgICBfX2JpbmFyeVJlc3BvbnNlOiB0cnVlLFxuICAgIF9fc3RyZWFtQ2xhc3M6IHRydWUsXG59O1xuZXhwb3J0IGNvbnN0IGlzUmVxdWVzdE9wdGlvbnMgPSAob2JqKSA9PiB7XG4gICAgcmV0dXJuICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJlxuICAgICAgICBvYmogIT09IG51bGwgJiZcbiAgICAgICAgIWlzRW1wdHlPYmoob2JqKSAmJlxuICAgICAgICBPYmplY3Qua2V5cyhvYmopLmV2ZXJ5KChrKSA9PiBoYXNPd24ocmVxdWVzdE9wdGlvbnNLZXlzLCBrKSkpO1xufTtcbmNvbnN0IGdldFBsYXRmb3JtUHJvcGVydGllcyA9ICgpID0+IHtcbiAgICBpZiAodHlwZW9mIERlbm8gIT09ICd1bmRlZmluZWQnICYmIERlbm8uYnVpbGQgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUxhbmcnOiAnanMnLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVBhY2thZ2UtVmVyc2lvbic6IFZFUlNJT04sXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtT1MnOiBub3JtYWxpemVQbGF0Zm9ybShEZW5vLmJ1aWxkLm9zKSxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1BcmNoJzogbm9ybWFsaXplQXJjaChEZW5vLmJ1aWxkLmFyY2gpLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUnOiAnZGVubycsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZS1WZXJzaW9uJzogdHlwZW9mIERlbm8udmVyc2lvbiA9PT0gJ3N0cmluZycgPyBEZW5vLnZlcnNpb24gOiBEZW5vLnZlcnNpb24/LmRlbm8gPz8gJ3Vua25vd24nLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIEVkZ2VSdW50aW1lICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUxhbmcnOiAnanMnLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVBhY2thZ2UtVmVyc2lvbic6IFZFUlNJT04sXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtT1MnOiAnVW5rbm93bicsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtQXJjaCc6IGBvdGhlcjoke0VkZ2VSdW50aW1lfWAsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZSc6ICdlZGdlJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lLVZlcnNpb24nOiBwcm9jZXNzLnZlcnNpb24sXG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIENoZWNrIGlmIE5vZGUuanNcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyA/IHByb2Nlc3MgOiAwKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtTGFuZyc6ICdqcycsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUGFja2FnZS1WZXJzaW9uJzogVkVSU0lPTixcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1PUyc6IG5vcm1hbGl6ZVBsYXRmb3JtKHByb2Nlc3MucGxhdGZvcm0pLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUFyY2gnOiBub3JtYWxpemVBcmNoKHByb2Nlc3MuYXJjaCksXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZSc6ICdub2RlJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lLVZlcnNpb24nOiBwcm9jZXNzLnZlcnNpb24sXG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbnN0IGJyb3dzZXJJbmZvID0gZ2V0QnJvd3NlckluZm8oKTtcbiAgICBpZiAoYnJvd3NlckluZm8pIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1MYW5nJzogJ2pzJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1QYWNrYWdlLVZlcnNpb24nOiBWRVJTSU9OLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLU9TJzogJ1Vua25vd24nLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUFyY2gnOiAndW5rbm93bicsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZSc6IGBicm93c2VyOiR7YnJvd3NlckluZm8uYnJvd3Nlcn1gLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUtVmVyc2lvbic6IGJyb3dzZXJJbmZvLnZlcnNpb24sXG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIFRPRE8gYWRkIHN1cHBvcnQgZm9yIENsb3VkZmxhcmUgd29ya2VycywgZXRjLlxuICAgIHJldHVybiB7XG4gICAgICAgICdYLVN0YWlubGVzcy1MYW5nJzogJ2pzJyxcbiAgICAgICAgJ1gtU3RhaW5sZXNzLVBhY2thZ2UtVmVyc2lvbic6IFZFUlNJT04sXG4gICAgICAgICdYLVN0YWlubGVzcy1PUyc6ICdVbmtub3duJyxcbiAgICAgICAgJ1gtU3RhaW5sZXNzLUFyY2gnOiAndW5rbm93bicsXG4gICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lJzogJ3Vua25vd24nLFxuICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZS1WZXJzaW9uJzogJ3Vua25vd24nLFxuICAgIH07XG59O1xuLy8gTm90ZTogbW9kaWZpZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vSlMtRGV2VG9vbHMvaG9zdC1lbnZpcm9ubWVudC9ibG9iL2IxYWI3OWVjZGUzN2RiNWQ2ZTE2M2MwNTBlNTRmZTdkMjg3ZDdjOTIvc3JjL2lzb21vcnBoaWMuYnJvd3Nlci50c1xuZnVuY3Rpb24gZ2V0QnJvd3NlckluZm8oKSB7XG4gICAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgPT09ICd1bmRlZmluZWQnIHx8ICFuYXZpZ2F0b3IpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIC8vIE5PVEU6IFRoZSBvcmRlciBtYXR0ZXJzIGhlcmUhXG4gICAgY29uc3QgYnJvd3NlclBhdHRlcm5zID0gW1xuICAgICAgICB7IGtleTogJ2VkZ2UnLCBwYXR0ZXJuOiAvRWRnZSg/OlxcVysoXFxkKylcXC4oXFxkKykoPzpcXC4oXFxkKykpPyk/LyB9LFxuICAgICAgICB7IGtleTogJ2llJywgcGF0dGVybjogL01TSUUoPzpcXFcrKFxcZCspXFwuKFxcZCspKD86XFwuKFxcZCspKT8pPy8gfSxcbiAgICAgICAgeyBrZXk6ICdpZScsIHBhdHRlcm46IC9UcmlkZW50KD86LipydlxcOihcXGQrKVxcLihcXGQrKSg/OlxcLihcXGQrKSk/KT8vIH0sXG4gICAgICAgIHsga2V5OiAnY2hyb21lJywgcGF0dGVybjogL0Nocm9tZSg/OlxcVysoXFxkKylcXC4oXFxkKykoPzpcXC4oXFxkKykpPyk/LyB9LFxuICAgICAgICB7IGtleTogJ2ZpcmVmb3gnLCBwYXR0ZXJuOiAvRmlyZWZveCg/OlxcVysoXFxkKylcXC4oXFxkKykoPzpcXC4oXFxkKykpPyk/LyB9LFxuICAgICAgICB7IGtleTogJ3NhZmFyaScsIHBhdHRlcm46IC8oPzpWZXJzaW9uXFxXKyhcXGQrKVxcLihcXGQrKSg/OlxcLihcXGQrKSk/KT8oPzpcXFcrTW9iaWxlXFxTKik/XFxXK1NhZmFyaS8gfSxcbiAgICBdO1xuICAgIC8vIEZpbmQgdGhlIEZJUlNUIG1hdGNoaW5nIGJyb3dzZXJcbiAgICBmb3IgKGNvbnN0IHsga2V5LCBwYXR0ZXJuIH0gb2YgYnJvd3NlclBhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gcGF0dGVybi5leGVjKG5hdmlnYXRvci51c2VyQWdlbnQpO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGNvbnN0IG1ham9yID0gbWF0Y2hbMV0gfHwgMDtcbiAgICAgICAgICAgIGNvbnN0IG1pbm9yID0gbWF0Y2hbMl0gfHwgMDtcbiAgICAgICAgICAgIGNvbnN0IHBhdGNoID0gbWF0Y2hbM10gfHwgMDtcbiAgICAgICAgICAgIHJldHVybiB7IGJyb3dzZXI6IGtleSwgdmVyc2lvbjogYCR7bWFqb3J9LiR7bWlub3J9LiR7cGF0Y2h9YCB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuY29uc3Qgbm9ybWFsaXplQXJjaCA9IChhcmNoKSA9PiB7XG4gICAgLy8gTm9kZSBkb2NzOlxuICAgIC8vIC0gaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc2FyY2hcbiAgICAvLyBEZW5vIGRvY3M6XG4gICAgLy8gLSBodHRwczovL2RvYy5kZW5vLmxhbmQvZGVuby9zdGFibGUvfi9EZW5vLmJ1aWxkXG4gICAgaWYgKGFyY2ggPT09ICd4MzInKVxuICAgICAgICByZXR1cm4gJ3gzMic7XG4gICAgaWYgKGFyY2ggPT09ICd4ODZfNjQnIHx8IGFyY2ggPT09ICd4NjQnKVxuICAgICAgICByZXR1cm4gJ3g2NCc7XG4gICAgaWYgKGFyY2ggPT09ICdhcm0nKVxuICAgICAgICByZXR1cm4gJ2FybSc7XG4gICAgaWYgKGFyY2ggPT09ICdhYXJjaDY0JyB8fCBhcmNoID09PSAnYXJtNjQnKVxuICAgICAgICByZXR1cm4gJ2FybTY0JztcbiAgICBpZiAoYXJjaClcbiAgICAgICAgcmV0dXJuIGBvdGhlcjoke2FyY2h9YDtcbiAgICByZXR1cm4gJ3Vua25vd24nO1xufTtcbmNvbnN0IG5vcm1hbGl6ZVBsYXRmb3JtID0gKHBsYXRmb3JtKSA9PiB7XG4gICAgLy8gTm9kZSBwbGF0Zm9ybXM6XG4gICAgLy8gLSBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzcGxhdGZvcm1cbiAgICAvLyBEZW5vIHBsYXRmb3JtczpcbiAgICAvLyAtIGh0dHBzOi8vZG9jLmRlbm8ubGFuZC9kZW5vL3N0YWJsZS9+L0Rlbm8uYnVpbGRcbiAgICAvLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9kZW5vbGFuZC9kZW5vL2lzc3Vlcy8xNDc5OVxuICAgIHBsYXRmb3JtID0gcGxhdGZvcm0udG9Mb3dlckNhc2UoKTtcbiAgICAvLyBOT1RFOiB0aGlzIGlPUyBjaGVjayBpcyB1bnRlc3RlZCBhbmQgbWF5IG5vdCB3b3JrXG4gICAgLy8gTm9kZSBkb2VzIG5vdCB3b3JrIG5hdGl2ZWx5IG9uIElPUywgdGhlcmUgaXMgYSBmb3JrIGF0XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy1tb2JpbGUvbm9kZWpzLW1vYmlsZVxuICAgIC8vIGhvd2V2ZXIgaXQgaXMgdW5rbm93biBhdCB0aGUgdGltZSBvZiB3cml0aW5nIGhvdyB0byBkZXRlY3QgaWYgaXQgaXMgcnVubmluZ1xuICAgIGlmIChwbGF0Zm9ybS5pbmNsdWRlcygnaW9zJykpXG4gICAgICAgIHJldHVybiAnaU9TJztcbiAgICBpZiAocGxhdGZvcm0gPT09ICdhbmRyb2lkJylcbiAgICAgICAgcmV0dXJuICdBbmRyb2lkJztcbiAgICBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nKVxuICAgICAgICByZXR1cm4gJ01hY09TJztcbiAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpXG4gICAgICAgIHJldHVybiAnV2luZG93cyc7XG4gICAgaWYgKHBsYXRmb3JtID09PSAnZnJlZWJzZCcpXG4gICAgICAgIHJldHVybiAnRnJlZUJTRCc7XG4gICAgaWYgKHBsYXRmb3JtID09PSAnb3BlbmJzZCcpXG4gICAgICAgIHJldHVybiAnT3BlbkJTRCc7XG4gICAgaWYgKHBsYXRmb3JtID09PSAnbGludXgnKVxuICAgICAgICByZXR1cm4gJ0xpbnV4JztcbiAgICBpZiAocGxhdGZvcm0pXG4gICAgICAgIHJldHVybiBgT3RoZXI6JHtwbGF0Zm9ybX1gO1xuICAgIHJldHVybiAnVW5rbm93bic7XG59O1xubGV0IF9wbGF0Zm9ybUhlYWRlcnM7XG5jb25zdCBnZXRQbGF0Zm9ybUhlYWRlcnMgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChfcGxhdGZvcm1IZWFkZXJzID8/IChfcGxhdGZvcm1IZWFkZXJzID0gZ2V0UGxhdGZvcm1Qcm9wZXJ0aWVzKCkpKTtcbn07XG5leHBvcnQgY29uc3Qgc2FmZUpTT04gPSAodGV4dCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpO1xuICAgIH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufTtcbi8vIGh0dHBzOi8vdXJsLnNwZWMud2hhdHdnLm9yZy8jdXJsLXNjaGVtZS1zdHJpbmdcbmNvbnN0IHN0YXJ0c1dpdGhTY2hlbWVSZWdleHAgPSAvXlthLXpdW2EtejAtOSsuLV0qOi9pO1xuY29uc3QgaXNBYnNvbHV0ZVVSTCA9ICh1cmwpID0+IHtcbiAgICByZXR1cm4gc3RhcnRzV2l0aFNjaGVtZVJlZ2V4cC50ZXN0KHVybCk7XG59O1xuZXhwb3J0IGNvbnN0IHNsZWVwID0gKG1zKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuY29uc3QgdmFsaWRhdGVQb3NpdGl2ZUludGVnZXIgPSAobmFtZSwgbikgPT4ge1xuICAgIGlmICh0eXBlb2YgbiAhPT0gJ251bWJlcicgfHwgIU51bWJlci5pc0ludGVnZXIobikpIHtcbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGAke25hbWV9IG11c3QgYmUgYW4gaW50ZWdlcmApO1xuICAgIH1cbiAgICBpZiAobiA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGAke25hbWV9IG11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyYCk7XG4gICAgfVxuICAgIHJldHVybiBuO1xufTtcbmV4cG9ydCBjb25zdCBjYXN0VG9FcnJvciA9IChlcnIpID0+IHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpXG4gICAgICAgIHJldHVybiBlcnI7XG4gICAgaWYgKHR5cGVvZiBlcnIgPT09ICdvYmplY3QnICYmIGVyciAhPT0gbnVsbCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBFcnJvcihKU09OLnN0cmluZ2lmeShlcnIpKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCB7IH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBFcnJvcihlcnIpO1xufTtcbmV4cG9ydCBjb25zdCBlbnN1cmVQcmVzZW50ID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgRXhwZWN0ZWQgYSB2YWx1ZSB0byBiZSBnaXZlbiBidXQgcmVjZWl2ZWQgJHt2YWx1ZX0gaW5zdGVhZC5gKTtcbiAgICByZXR1cm4gdmFsdWU7XG59O1xuLyoqXG4gKiBSZWFkIGFuIGVudmlyb25tZW50IHZhcmlhYmxlLlxuICpcbiAqIFRyaW1zIGJlZ2lubmluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZS5cbiAqXG4gKiBXaWxsIHJldHVybiB1bmRlZmluZWQgaWYgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIGRvZXNuJ3QgZXhpc3Qgb3IgY2Fubm90IGJlIGFjY2Vzc2VkLlxuICovXG5leHBvcnQgY29uc3QgcmVhZEVudiA9IChlbnYpID0+IHtcbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudj8uW2Vudl0/LnRyaW0oKSA/PyB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgRGVubyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIERlbm8uZW52Py5nZXQ/LihlbnYpPy50cmltKCk7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59O1xuZXhwb3J0IGNvbnN0IGNvZXJjZUludGVnZXIgPSAodmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJylcbiAgICAgICAgcmV0dXJuIE1hdGgucm91bmQodmFsdWUpO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4gcGFyc2VJbnQodmFsdWUsIDEwKTtcbiAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYENvdWxkIG5vdCBjb2VyY2UgJHt2YWx1ZX0gKHR5cGU6ICR7dHlwZW9mIHZhbHVlfSkgaW50byBhIG51bWJlcmApO1xufTtcbmV4cG9ydCBjb25zdCBjb2VyY2VGbG9hdCA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KHZhbHVlKTtcbiAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYENvdWxkIG5vdCBjb2VyY2UgJHt2YWx1ZX0gKHR5cGU6ICR7dHlwZW9mIHZhbHVlfSkgaW50byBhIG51bWJlcmApO1xufTtcbmV4cG9ydCBjb25zdCBjb2VyY2VCb29sZWFuID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiB2YWx1ZSA9PT0gJ3RydWUnO1xuICAgIHJldHVybiBCb29sZWFuKHZhbHVlKTtcbn07XG5leHBvcnQgY29uc3QgbWF5YmVDb2VyY2VJbnRlZ2VyID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGNvZXJjZUludGVnZXIodmFsdWUpO1xufTtcbmV4cG9ydCBjb25zdCBtYXliZUNvZXJjZUZsb2F0ID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGNvZXJjZUZsb2F0KHZhbHVlKTtcbn07XG5leHBvcnQgY29uc3QgbWF5YmVDb2VyY2VCb29sZWFuID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGNvZXJjZUJvb2xlYW4odmFsdWUpO1xufTtcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zNDQ5MTI4N1xuZXhwb3J0IGZ1bmN0aW9uIGlzRW1wdHlPYmoob2JqKSB7XG4gICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIGZvciAoY29uc3QgX2sgaW4gb2JqKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG59XG4vLyBodHRwczovL2VzbGludC5vcmcvZG9jcy9sYXRlc3QvcnVsZXMvbm8tcHJvdG90eXBlLWJ1aWx0aW5zXG5leHBvcnQgZnVuY3Rpb24gaGFzT3duKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG59XG4vKipcbiAqIENvcGllcyBoZWFkZXJzIGZyb20gXCJuZXdIZWFkZXJzXCIgb250byBcInRhcmdldEhlYWRlcnNcIixcbiAqIHVzaW5nIGxvd2VyLWNhc2UgZm9yIGFsbCBwcm9wZXJ0aWVzLFxuICogaWdub3JpbmcgYW55IGtleXMgd2l0aCB1bmRlZmluZWQgdmFsdWVzLFxuICogYW5kIGRlbGV0aW5nIGFueSBrZXlzIHdpdGggbnVsbCB2YWx1ZXMuXG4gKi9cbmZ1bmN0aW9uIGFwcGx5SGVhZGVyc011dCh0YXJnZXRIZWFkZXJzLCBuZXdIZWFkZXJzKSB7XG4gICAgZm9yIChjb25zdCBrIGluIG5ld0hlYWRlcnMpIHtcbiAgICAgICAgaWYgKCFoYXNPd24obmV3SGVhZGVycywgaykpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbG93ZXJLZXkgPSBrLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmICghbG93ZXJLZXkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgY29uc3QgdmFsID0gbmV3SGVhZGVyc1trXTtcbiAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZGVsZXRlIHRhcmdldEhlYWRlcnNbbG93ZXJLZXldO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0YXJnZXRIZWFkZXJzW2xvd2VyS2V5XSA9IHZhbDtcbiAgICAgICAgfVxuICAgIH1cbn1cbmNvbnN0IFNFTlNJVElWRV9IRUFERVJTID0gbmV3IFNldChbJ2F1dGhvcml6YXRpb24nLCAnYXBpLWtleSddKTtcbmV4cG9ydCBmdW5jdGlvbiBkZWJ1ZyhhY3Rpb24sIC4uLmFyZ3MpIHtcbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHByb2Nlc3M/LmVudj8uWydERUJVRyddID09PSAndHJ1ZScpIHtcbiAgICAgICAgY29uc3QgbW9kaWZpZWRBcmdzID0gYXJncy5tYXAoKGFyZykgPT4ge1xuICAgICAgICAgICAgaWYgKCFhcmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHNlbnNpdGl2ZSBoZWFkZXJzIGluIHJlcXVlc3QgYm9keSAnaGVhZGVycycgb2JqZWN0XG4gICAgICAgICAgICBpZiAoYXJnWydoZWFkZXJzJ10pIHtcbiAgICAgICAgICAgICAgICAvLyBjbG9uZSBzbyB3ZSBkb24ndCBtdXRhdGVcbiAgICAgICAgICAgICAgICBjb25zdCBtb2RpZmllZEFyZyA9IHsgLi4uYXJnLCBoZWFkZXJzOiB7IC4uLmFyZ1snaGVhZGVycyddIH0gfTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGhlYWRlciBpbiBhcmdbJ2hlYWRlcnMnXSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoU0VOU0lUSVZFX0hFQURFUlMuaGFzKGhlYWRlci50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWRBcmdbJ2hlYWRlcnMnXVtoZWFkZXJdID0gJ1JFREFDVEVEJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kaWZpZWRBcmc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbW9kaWZpZWRBcmcgPSBudWxsO1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHNlbnNpdGl2ZSBoZWFkZXJzIGluIGhlYWRlcnMgb2JqZWN0XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGhlYWRlciBpbiBhcmcpIHtcbiAgICAgICAgICAgICAgICBpZiAoU0VOU0lUSVZFX0hFQURFUlMuaGFzKGhlYWRlci50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBhdm9pZCBtYWtpbmcgYSBjb3B5IHVudGlsIHdlIG5lZWQgdG9cbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWRBcmcgPz8gKG1vZGlmaWVkQXJnID0geyAuLi5hcmcgfSk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkQXJnW2hlYWRlcl0gPSAnUkVEQUNURUQnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtb2RpZmllZEFyZyA/PyBhcmc7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zb2xlLmxvZyhgT3BlbkFJOkRFQlVHOiR7YWN0aW9ufWAsIC4uLm1vZGlmaWVkQXJncyk7XG4gICAgfVxufVxuLyoqXG4gKiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjExNzUyM1xuICovXG5jb25zdCB1dWlkNCA9ICgpID0+IHtcbiAgICByZXR1cm4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCAoYykgPT4ge1xuICAgICAgICBjb25zdCByID0gKE1hdGgucmFuZG9tKCkgKiAxNikgfCAwO1xuICAgICAgICBjb25zdCB2ID0gYyA9PT0gJ3gnID8gciA6IChyICYgMHgzKSB8IDB4ODtcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuICAgIH0pO1xufTtcbmV4cG9ydCBjb25zdCBpc1J1bm5pbmdJbkJyb3dzZXIgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICB0eXBlb2Ygd2luZG93LmRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnKTtcbn07XG5leHBvcnQgY29uc3QgaXNIZWFkZXJzUHJvdG9jb2wgPSAoaGVhZGVycykgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgaGVhZGVycz8uZ2V0ID09PSAnZnVuY3Rpb24nO1xufTtcbmV4cG9ydCBjb25zdCBnZXRSZXF1aXJlZEhlYWRlciA9IChoZWFkZXJzLCBoZWFkZXIpID0+IHtcbiAgICBjb25zdCBmb3VuZEhlYWRlciA9IGdldEhlYWRlcihoZWFkZXJzLCBoZWFkZXIpO1xuICAgIGlmIChmb3VuZEhlYWRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtoZWFkZXJ9IGhlYWRlcmApO1xuICAgIH1cbiAgICByZXR1cm4gZm91bmRIZWFkZXI7XG59O1xuZXhwb3J0IGNvbnN0IGdldEhlYWRlciA9IChoZWFkZXJzLCBoZWFkZXIpID0+IHtcbiAgICBjb25zdCBsb3dlckNhc2VkSGVhZGVyID0gaGVhZGVyLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGlzSGVhZGVyc1Byb3RvY29sKGhlYWRlcnMpKSB7XG4gICAgICAgIC8vIHRvIGRlYWwgd2l0aCB0aGUgY2FzZSB3aGVyZSB0aGUgaGVhZGVyIGxvb2tzIGxpa2UgU3RhaW5sZXNzLUV2ZW50LUlkXG4gICAgICAgIGNvbnN0IGludGVyY2Fwc0hlYWRlciA9IGhlYWRlclswXT8udG9VcHBlckNhc2UoKSArXG4gICAgICAgICAgICBoZWFkZXIuc3Vic3RyaW5nKDEpLnJlcGxhY2UoLyhbXlxcd10pKFxcdykvZywgKF9tLCBnMSwgZzIpID0+IGcxICsgZzIudG9VcHBlckNhc2UoKSk7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIFtoZWFkZXIsIGxvd2VyQ2FzZWRIZWFkZXIsIGhlYWRlci50b1VwcGVyQ2FzZSgpLCBpbnRlcmNhcHNIZWFkZXJdKSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGhlYWRlcnMuZ2V0KGtleSk7XG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaGVhZGVycykpIHtcbiAgICAgICAgaWYgKGtleS50b0xvd2VyQ2FzZSgpID09PSBsb3dlckNhc2VkSGVhZGVyKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUubGVuZ3RoIDw9IDEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVswXTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFJlY2VpdmVkICR7dmFsdWUubGVuZ3RofSBlbnRyaWVzIGZvciB0aGUgJHtoZWFkZXJ9IGhlYWRlciwgdXNpbmcgdGhlIGZpcnN0IGVudHJ5LmApO1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVswXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufTtcbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyB0byBCYXNlNjQgZm9ybWF0LlxuICovXG5leHBvcnQgY29uc3QgdG9CYXNlNjQgPSAoc3RyKSA9PiB7XG4gICAgaWYgKCFzdHIpXG4gICAgICAgIHJldHVybiAnJztcbiAgICBpZiAodHlwZW9mIEJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHN0cikudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGJ0b2EgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBidG9hKHN0cik7XG4gICAgfVxuICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcignQ2Fubm90IGdlbmVyYXRlIGI2NCBzdHJpbmc7IEV4cGVjdGVkIGBCdWZmZXJgIG9yIGBidG9hYCB0byBiZSBkZWZpbmVkJyk7XG59O1xuZXhwb3J0IGZ1bmN0aW9uIGlzT2JqKG9iaikge1xuICAgIHJldHVybiBvYmogIT0gbnVsbCAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShvYmopO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29yZS5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IGNhc3RUb0Vycm9yIH0gZnJvbSBcIi4vY29yZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBPcGVuQUlFcnJvciBleHRlbmRzIEVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBBUElFcnJvciBleHRlbmRzIE9wZW5BSUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKSB7XG4gICAgICAgIHN1cGVyKGAke0FQSUVycm9yLm1ha2VNZXNzYWdlKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UpfWApO1xuICAgICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgICAgdGhpcy5oZWFkZXJzID0gaGVhZGVycztcbiAgICAgICAgdGhpcy5yZXF1ZXN0X2lkID0gaGVhZGVycz8uWyd4LXJlcXVlc3QtaWQnXTtcbiAgICAgICAgdGhpcy5lcnJvciA9IGVycm9yO1xuICAgICAgICBjb25zdCBkYXRhID0gZXJyb3I7XG4gICAgICAgIHRoaXMuY29kZSA9IGRhdGE/LlsnY29kZSddO1xuICAgICAgICB0aGlzLnBhcmFtID0gZGF0YT8uWydwYXJhbSddO1xuICAgICAgICB0aGlzLnR5cGUgPSBkYXRhPy5bJ3R5cGUnXTtcbiAgICB9XG4gICAgc3RhdGljIG1ha2VNZXNzYWdlKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UpIHtcbiAgICAgICAgY29uc3QgbXNnID0gZXJyb3I/Lm1lc3NhZ2UgP1xuICAgICAgICAgICAgdHlwZW9mIGVycm9yLm1lc3NhZ2UgPT09ICdzdHJpbmcnID9cbiAgICAgICAgICAgICAgICBlcnJvci5tZXNzYWdlXG4gICAgICAgICAgICAgICAgOiBKU09OLnN0cmluZ2lmeShlcnJvci5tZXNzYWdlKVxuICAgICAgICAgICAgOiBlcnJvciA/IEpTT04uc3RyaW5naWZ5KGVycm9yKVxuICAgICAgICAgICAgICAgIDogbWVzc2FnZTtcbiAgICAgICAgaWYgKHN0YXR1cyAmJiBtc2cpIHtcbiAgICAgICAgICAgIHJldHVybiBgJHtzdGF0dXN9ICR7bXNnfWA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cykge1xuICAgICAgICAgICAgcmV0dXJuIGAke3N0YXR1c30gc3RhdHVzIGNvZGUgKG5vIGJvZHkpYDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobXNnKSB7XG4gICAgICAgICAgICByZXR1cm4gbXNnO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnKG5vIHN0YXR1cyBjb2RlIG9yIGJvZHkpJztcbiAgICB9XG4gICAgc3RhdGljIGdlbmVyYXRlKHN0YXR1cywgZXJyb3JSZXNwb25zZSwgbWVzc2FnZSwgaGVhZGVycykge1xuICAgICAgICBpZiAoIXN0YXR1cyB8fCAhaGVhZGVycykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBUElDb25uZWN0aW9uRXJyb3IoeyBtZXNzYWdlLCBjYXVzZTogY2FzdFRvRXJyb3IoZXJyb3JSZXNwb25zZSkgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXJyb3IgPSBlcnJvclJlc3BvbnNlPy5bJ2Vycm9yJ107XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQwMCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBCYWRSZXF1ZXN0RXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDAxKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEF1dGhlbnRpY2F0aW9uRXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDAzKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFBlcm1pc3Npb25EZW5pZWRFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTm90Rm91bmRFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID09PSA0MDkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQ29uZmxpY3RFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID09PSA0MjIpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVW5wcm9jZXNzYWJsZUVudGl0eUVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSYXRlTGltaXRFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID49IDUwMCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBJbnRlcm5hbFNlcnZlckVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgQVBJRXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFQSVVzZXJBYm9ydEVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgbWVzc2FnZSB9ID0ge30pIHtcbiAgICAgICAgc3VwZXIodW5kZWZpbmVkLCB1bmRlZmluZWQsIG1lc3NhZ2UgfHwgJ1JlcXVlc3Qgd2FzIGFib3J0ZWQuJywgdW5kZWZpbmVkKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQVBJQ29ubmVjdGlvbkVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgbWVzc2FnZSwgY2F1c2UgfSkge1xuICAgICAgICBzdXBlcih1bmRlZmluZWQsIHVuZGVmaW5lZCwgbWVzc2FnZSB8fCAnQ29ubmVjdGlvbiBlcnJvci4nLCB1bmRlZmluZWQpO1xuICAgICAgICAvLyBpbiBzb21lIGVudmlyb25tZW50cyB0aGUgJ2NhdXNlJyBwcm9wZXJ0eSBpcyBhbHJlYWR5IGRlY2xhcmVkXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKGNhdXNlKVxuICAgICAgICAgICAgdGhpcy5jYXVzZSA9IGNhdXNlO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBUElDb25uZWN0aW9uVGltZW91dEVycm9yIGV4dGVuZHMgQVBJQ29ubmVjdGlvbkVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IG1lc3NhZ2UgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKHsgbWVzc2FnZTogbWVzc2FnZSA/PyAnUmVxdWVzdCB0aW1lZCBvdXQuJyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQmFkUmVxdWVzdEVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIEF1dGhlbnRpY2F0aW9uRXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgUGVybWlzc2lvbkRlbmllZEVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIE5vdEZvdW5kRXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgQ29uZmxpY3RFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBVbnByb2Nlc3NhYmxlRW50aXR5RXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgUmF0ZUxpbWl0RXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgSW50ZXJuYWxTZXJ2ZXJFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBMZW5ndGhGaW5pc2hSZWFzb25FcnJvciBleHRlbmRzIE9wZW5BSUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoYENvdWxkIG5vdCBwYXJzZSByZXNwb25zZSBjb250ZW50IGFzIHRoZSBsZW5ndGggbGltaXQgd2FzIHJlYWNoZWRgKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQ29udGVudEZpbHRlckZpbmlzaFJlYXNvbkVycm9yIGV4dGVuZHMgT3BlbkFJRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihgQ291bGQgbm90IHBhcnNlIHJlc3BvbnNlIGNvbnRlbnQgYXMgdGhlIHJlcXVlc3Qgd2FzIHJlamVjdGVkIGJ5IHRoZSBjb250ZW50IGZpbHRlcmApO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVycm9yLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxudmFyIF9hO1xuaW1wb3J0ICogYXMgcXMgZnJvbSBcIi4vaW50ZXJuYWwvcXMvaW5kZXgubWpzXCI7XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuL2NvcmUubWpzXCI7XG5pbXBvcnQgKiBhcyBFcnJvcnMgZnJvbSBcIi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgKiBhcyBQYWdpbmF0aW9uIGZyb20gXCIuL3BhZ2luYXRpb24ubWpzXCI7XG5pbXBvcnQgKiBhcyBVcGxvYWRzIGZyb20gXCIuL3VwbG9hZHMubWpzXCI7XG5pbXBvcnQgKiBhcyBBUEkgZnJvbSBcIi4vcmVzb3VyY2VzL2luZGV4Lm1qc1wiO1xuaW1wb3J0IHsgQmF0Y2hlcywgQmF0Y2hlc1BhZ2UsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2JhdGNoZXMubWpzXCI7XG5pbXBvcnQgeyBDb21wbGV0aW9ucywgfSBmcm9tIFwiLi9yZXNvdXJjZXMvY29tcGxldGlvbnMubWpzXCI7XG5pbXBvcnQgeyBFbWJlZGRpbmdzLCB9IGZyb20gXCIuL3Jlc291cmNlcy9lbWJlZGRpbmdzLm1qc1wiO1xuaW1wb3J0IHsgRmlsZU9iamVjdHNQYWdlLCBGaWxlcywgfSBmcm9tIFwiLi9yZXNvdXJjZXMvZmlsZXMubWpzXCI7XG5pbXBvcnQgeyBJbWFnZXMsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2ltYWdlcy5tanNcIjtcbmltcG9ydCB7IE1vZGVscywgTW9kZWxzUGFnZSB9IGZyb20gXCIuL3Jlc291cmNlcy9tb2RlbHMubWpzXCI7XG5pbXBvcnQgeyBNb2RlcmF0aW9ucywgfSBmcm9tIFwiLi9yZXNvdXJjZXMvbW9kZXJhdGlvbnMubWpzXCI7XG5pbXBvcnQgeyBBdWRpbyB9IGZyb20gXCIuL3Jlc291cmNlcy9hdWRpby9hdWRpby5tanNcIjtcbmltcG9ydCB7IEJldGEgfSBmcm9tIFwiLi9yZXNvdXJjZXMvYmV0YS9iZXRhLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdCB9IGZyb20gXCIuL3Jlc291cmNlcy9jaGF0L2NoYXQubWpzXCI7XG5pbXBvcnQgeyBGaW5lVHVuaW5nIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2ZpbmUtdHVuaW5nL2ZpbmUtdHVuaW5nLm1qc1wiO1xuaW1wb3J0IHsgVXBsb2FkcyBhcyBVcGxvYWRzQVBJVXBsb2FkcywgfSBmcm9tIFwiLi9yZXNvdXJjZXMvdXBsb2Fkcy91cGxvYWRzLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25zUGFnZSwgfSBmcm9tIFwiLi9yZXNvdXJjZXMvY2hhdC9jb21wbGV0aW9ucy9jb21wbGV0aW9ucy5tanNcIjtcbi8qKlxuICogQVBJIENsaWVudCBmb3IgaW50ZXJmYWNpbmcgd2l0aCB0aGUgT3BlbkFJIEFQSS5cbiAqL1xuZXhwb3J0IGNsYXNzIE9wZW5BSSBleHRlbmRzIENvcmUuQVBJQ2xpZW50IHtcbiAgICAvKipcbiAgICAgKiBBUEkgQ2xpZW50IGZvciBpbnRlcmZhY2luZyB3aXRoIHRoZSBPcGVuQUkgQVBJLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCB1bmRlZmluZWR9IFtvcHRzLmFwaUtleT1wcm9jZXNzLmVudlsnT1BFTkFJX0FQSV9LRVknXSA/PyB1bmRlZmluZWRdXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkfSBbb3B0cy5vcmdhbml6YXRpb249cHJvY2Vzcy5lbnZbJ09QRU5BSV9PUkdfSUQnXSA/PyBudWxsXVxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZH0gW29wdHMucHJvamVjdD1wcm9jZXNzLmVudlsnT1BFTkFJX1BST0pFQ1RfSUQnXSA/PyBudWxsXVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0cy5iYXNlVVJMPXByb2Nlc3MuZW52WydPUEVOQUlfQkFTRV9VUkwnXSA/PyBodHRwczovL2FwaS5vcGVuYWkuY29tL3YxXSAtIE92ZXJyaWRlIHRoZSBkZWZhdWx0IGJhc2UgVVJMIGZvciB0aGUgQVBJLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy50aW1lb3V0PTEwIG1pbnV0ZXNdIC0gVGhlIG1heGltdW0gYW1vdW50IG9mIHRpbWUgKGluIG1pbGxpc2Vjb25kcykgdGhlIGNsaWVudCB3aWxsIHdhaXQgZm9yIGEgcmVzcG9uc2UgYmVmb3JlIHRpbWluZyBvdXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmh0dHBBZ2VudF0gLSBBbiBIVFRQIGFnZW50IHVzZWQgdG8gbWFuYWdlIEhUVFAocykgY29ubmVjdGlvbnMuXG4gICAgICogQHBhcmFtIHtDb3JlLkZldGNofSBbb3B0cy5mZXRjaF0gLSBTcGVjaWZ5IGEgY3VzdG9tIGBmZXRjaGAgZnVuY3Rpb24gaW1wbGVtZW50YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLm1heFJldHJpZXM9Ml0gLSBUaGUgbWF4aW11bSBudW1iZXIgb2YgdGltZXMgdGhlIGNsaWVudCB3aWxsIHJldHJ5IGEgcmVxdWVzdC5cbiAgICAgKiBAcGFyYW0ge0NvcmUuSGVhZGVyc30gb3B0cy5kZWZhdWx0SGVhZGVycyAtIERlZmF1bHQgaGVhZGVycyB0byBpbmNsdWRlIHdpdGggZXZlcnkgcmVxdWVzdCB0byB0aGUgQVBJLlxuICAgICAqIEBwYXJhbSB7Q29yZS5EZWZhdWx0UXVlcnl9IG9wdHMuZGVmYXVsdFF1ZXJ5IC0gRGVmYXVsdCBxdWVyeSBwYXJhbWV0ZXJzIHRvIGluY2x1ZGUgd2l0aCBldmVyeSByZXF1ZXN0IHRvIHRoZSBBUEkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5kYW5nZXJvdXNseUFsbG93QnJvd3Nlcj1mYWxzZV0gLSBCeSBkZWZhdWx0LCBjbGllbnQtc2lkZSB1c2Ugb2YgdGhpcyBsaWJyYXJ5IGlzIG5vdCBhbGxvd2VkLCBhcyBpdCByaXNrcyBleHBvc2luZyB5b3VyIHNlY3JldCBBUEkgY3JlZGVudGlhbHMgdG8gYXR0YWNrZXJzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHsgYmFzZVVSTCA9IENvcmUucmVhZEVudignT1BFTkFJX0JBU0VfVVJMJyksIGFwaUtleSA9IENvcmUucmVhZEVudignT1BFTkFJX0FQSV9LRVknKSwgb3JnYW5pemF0aW9uID0gQ29yZS5yZWFkRW52KCdPUEVOQUlfT1JHX0lEJykgPz8gbnVsbCwgcHJvamVjdCA9IENvcmUucmVhZEVudignT1BFTkFJX1BST0pFQ1RfSUQnKSA/PyBudWxsLCAuLi5vcHRzIH0gPSB7fSkge1xuICAgICAgICBpZiAoYXBpS2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoXCJUaGUgT1BFTkFJX0FQSV9LRVkgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbWlzc2luZyBvciBlbXB0eTsgZWl0aGVyIHByb3ZpZGUgaXQsIG9yIGluc3RhbnRpYXRlIHRoZSBPcGVuQUkgY2xpZW50IHdpdGggYW4gYXBpS2V5IG9wdGlvbiwgbGlrZSBuZXcgT3BlbkFJKHsgYXBpS2V5OiAnTXkgQVBJIEtleScgfSkuXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgICBvcmdhbml6YXRpb24sXG4gICAgICAgICAgICBwcm9qZWN0LFxuICAgICAgICAgICAgLi4ub3B0cyxcbiAgICAgICAgICAgIGJhc2VVUkw6IGJhc2VVUkwgfHwgYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjFgLFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIW9wdGlvbnMuZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXIgJiYgQ29yZS5pc1J1bm5pbmdJbkJyb3dzZXIoKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcihcIkl0IGxvb2tzIGxpa2UgeW91J3JlIHJ1bm5pbmcgaW4gYSBicm93c2VyLWxpa2UgZW52aXJvbm1lbnQuXFxuXFxuVGhpcyBpcyBkaXNhYmxlZCBieSBkZWZhdWx0LCBhcyBpdCByaXNrcyBleHBvc2luZyB5b3VyIHNlY3JldCBBUEkgY3JlZGVudGlhbHMgdG8gYXR0YWNrZXJzLlxcbklmIHlvdSB1bmRlcnN0YW5kIHRoZSByaXNrcyBhbmQgaGF2ZSBhcHByb3ByaWF0ZSBtaXRpZ2F0aW9ucyBpbiBwbGFjZSxcXG55b3UgY2FuIHNldCB0aGUgYGRhbmdlcm91c2x5QWxsb3dCcm93c2VyYCBvcHRpb24gdG8gYHRydWVgLCBlLmcuLFxcblxcbm5ldyBPcGVuQUkoeyBhcGlLZXksIGRhbmdlcm91c2x5QWxsb3dCcm93c2VyOiB0cnVlIH0pO1xcblxcbmh0dHBzOi8vaGVscC5vcGVuYWkuY29tL2VuL2FydGljbGVzLzUxMTI1OTUtYmVzdC1wcmFjdGljZXMtZm9yLWFwaS1rZXktc2FmZXR5XFxuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHN1cGVyKHtcbiAgICAgICAgICAgIGJhc2VVUkw6IG9wdGlvbnMuYmFzZVVSTCxcbiAgICAgICAgICAgIHRpbWVvdXQ6IG9wdGlvbnMudGltZW91dCA/PyA2MDAwMDAgLyogMTAgbWludXRlcyAqLyxcbiAgICAgICAgICAgIGh0dHBBZ2VudDogb3B0aW9ucy5odHRwQWdlbnQsXG4gICAgICAgICAgICBtYXhSZXRyaWVzOiBvcHRpb25zLm1heFJldHJpZXMsXG4gICAgICAgICAgICBmZXRjaDogb3B0aW9ucy5mZXRjaCxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29tcGxldGlvbnMgPSBuZXcgQVBJLkNvbXBsZXRpb25zKHRoaXMpO1xuICAgICAgICB0aGlzLmNoYXQgPSBuZXcgQVBJLkNoYXQodGhpcyk7XG4gICAgICAgIHRoaXMuZW1iZWRkaW5ncyA9IG5ldyBBUEkuRW1iZWRkaW5ncyh0aGlzKTtcbiAgICAgICAgdGhpcy5maWxlcyA9IG5ldyBBUEkuRmlsZXModGhpcyk7XG4gICAgICAgIHRoaXMuaW1hZ2VzID0gbmV3IEFQSS5JbWFnZXModGhpcyk7XG4gICAgICAgIHRoaXMuYXVkaW8gPSBuZXcgQVBJLkF1ZGlvKHRoaXMpO1xuICAgICAgICB0aGlzLm1vZGVyYXRpb25zID0gbmV3IEFQSS5Nb2RlcmF0aW9ucyh0aGlzKTtcbiAgICAgICAgdGhpcy5tb2RlbHMgPSBuZXcgQVBJLk1vZGVscyh0aGlzKTtcbiAgICAgICAgdGhpcy5maW5lVHVuaW5nID0gbmV3IEFQSS5GaW5lVHVuaW5nKHRoaXMpO1xuICAgICAgICB0aGlzLmJldGEgPSBuZXcgQVBJLkJldGEodGhpcyk7XG4gICAgICAgIHRoaXMuYmF0Y2hlcyA9IG5ldyBBUEkuQmF0Y2hlcyh0aGlzKTtcbiAgICAgICAgdGhpcy51cGxvYWRzID0gbmV3IEFQSS5VcGxvYWRzKHRoaXMpO1xuICAgICAgICB0aGlzLl9vcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5hcGlLZXkgPSBhcGlLZXk7XG4gICAgICAgIHRoaXMub3JnYW5pemF0aW9uID0gb3JnYW5pemF0aW9uO1xuICAgICAgICB0aGlzLnByb2plY3QgPSBwcm9qZWN0O1xuICAgIH1cbiAgICBkZWZhdWx0UXVlcnkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vcHRpb25zLmRlZmF1bHRRdWVyeTtcbiAgICB9XG4gICAgZGVmYXVsdEhlYWRlcnMob3B0cykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uc3VwZXIuZGVmYXVsdEhlYWRlcnMob3B0cyksXG4gICAgICAgICAgICAnT3BlbkFJLU9yZ2FuaXphdGlvbic6IHRoaXMub3JnYW5pemF0aW9uLFxuICAgICAgICAgICAgJ09wZW5BSS1Qcm9qZWN0JzogdGhpcy5wcm9qZWN0LFxuICAgICAgICAgICAgLi4udGhpcy5fb3B0aW9ucy5kZWZhdWx0SGVhZGVycyxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgYXV0aEhlYWRlcnMob3B0cykge1xuICAgICAgICByZXR1cm4geyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5hcGlLZXl9YCB9O1xuICAgIH1cbiAgICBzdHJpbmdpZnlRdWVyeShxdWVyeSkge1xuICAgICAgICByZXR1cm4gcXMuc3RyaW5naWZ5KHF1ZXJ5LCB7IGFycmF5Rm9ybWF0OiAnYnJhY2tldHMnIH0pO1xuICAgIH1cbn1cbl9hID0gT3BlbkFJO1xuT3BlbkFJLk9wZW5BSSA9IF9hO1xuT3BlbkFJLkRFRkFVTFRfVElNRU9VVCA9IDYwMDAwMDsgLy8gMTAgbWludXRlc1xuT3BlbkFJLk9wZW5BSUVycm9yID0gRXJyb3JzLk9wZW5BSUVycm9yO1xuT3BlbkFJLkFQSUVycm9yID0gRXJyb3JzLkFQSUVycm9yO1xuT3BlbkFJLkFQSUNvbm5lY3Rpb25FcnJvciA9IEVycm9ycy5BUElDb25uZWN0aW9uRXJyb3I7XG5PcGVuQUkuQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvciA9IEVycm9ycy5BUElDb25uZWN0aW9uVGltZW91dEVycm9yO1xuT3BlbkFJLkFQSVVzZXJBYm9ydEVycm9yID0gRXJyb3JzLkFQSVVzZXJBYm9ydEVycm9yO1xuT3BlbkFJLk5vdEZvdW5kRXJyb3IgPSBFcnJvcnMuTm90Rm91bmRFcnJvcjtcbk9wZW5BSS5Db25mbGljdEVycm9yID0gRXJyb3JzLkNvbmZsaWN0RXJyb3I7XG5PcGVuQUkuUmF0ZUxpbWl0RXJyb3IgPSBFcnJvcnMuUmF0ZUxpbWl0RXJyb3I7XG5PcGVuQUkuQmFkUmVxdWVzdEVycm9yID0gRXJyb3JzLkJhZFJlcXVlc3RFcnJvcjtcbk9wZW5BSS5BdXRoZW50aWNhdGlvbkVycm9yID0gRXJyb3JzLkF1dGhlbnRpY2F0aW9uRXJyb3I7XG5PcGVuQUkuSW50ZXJuYWxTZXJ2ZXJFcnJvciA9IEVycm9ycy5JbnRlcm5hbFNlcnZlckVycm9yO1xuT3BlbkFJLlBlcm1pc3Npb25EZW5pZWRFcnJvciA9IEVycm9ycy5QZXJtaXNzaW9uRGVuaWVkRXJyb3I7XG5PcGVuQUkuVW5wcm9jZXNzYWJsZUVudGl0eUVycm9yID0gRXJyb3JzLlVucHJvY2Vzc2FibGVFbnRpdHlFcnJvcjtcbk9wZW5BSS50b0ZpbGUgPSBVcGxvYWRzLnRvRmlsZTtcbk9wZW5BSS5maWxlRnJvbVBhdGggPSBVcGxvYWRzLmZpbGVGcm9tUGF0aDtcbk9wZW5BSS5Db21wbGV0aW9ucyA9IENvbXBsZXRpb25zO1xuT3BlbkFJLkNoYXQgPSBDaGF0O1xuT3BlbkFJLkNoYXRDb21wbGV0aW9uc1BhZ2UgPSBDaGF0Q29tcGxldGlvbnNQYWdlO1xuT3BlbkFJLkVtYmVkZGluZ3MgPSBFbWJlZGRpbmdzO1xuT3BlbkFJLkZpbGVzID0gRmlsZXM7XG5PcGVuQUkuRmlsZU9iamVjdHNQYWdlID0gRmlsZU9iamVjdHNQYWdlO1xuT3BlbkFJLkltYWdlcyA9IEltYWdlcztcbk9wZW5BSS5BdWRpbyA9IEF1ZGlvO1xuT3BlbkFJLk1vZGVyYXRpb25zID0gTW9kZXJhdGlvbnM7XG5PcGVuQUkuTW9kZWxzID0gTW9kZWxzO1xuT3BlbkFJLk1vZGVsc1BhZ2UgPSBNb2RlbHNQYWdlO1xuT3BlbkFJLkZpbmVUdW5pbmcgPSBGaW5lVHVuaW5nO1xuT3BlbkFJLkJldGEgPSBCZXRhO1xuT3BlbkFJLkJhdGNoZXMgPSBCYXRjaGVzO1xuT3BlbkFJLkJhdGNoZXNQYWdlID0gQmF0Y2hlc1BhZ2U7XG5PcGVuQUkuVXBsb2FkcyA9IFVwbG9hZHNBUElVcGxvYWRzO1xuLyoqIEFQSSBDbGllbnQgZm9yIGludGVyZmFjaW5nIHdpdGggdGhlIEF6dXJlIE9wZW5BSSBBUEkuICovXG5leHBvcnQgY2xhc3MgQXp1cmVPcGVuQUkgZXh0ZW5kcyBPcGVuQUkge1xuICAgIC8qKlxuICAgICAqIEFQSSBDbGllbnQgZm9yIGludGVyZmFjaW5nIHdpdGggdGhlIEF6dXJlIE9wZW5BSSBBUEkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IHVuZGVmaW5lZH0gW29wdHMuYXBpVmVyc2lvbj1wcm9jZXNzLmVudlsnT1BFTkFJX0FQSV9WRVJTSU9OJ10gPz8gdW5kZWZpbmVkXVxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgdW5kZWZpbmVkfSBbb3B0cy5lbmRwb2ludD1wcm9jZXNzLmVudlsnQVpVUkVfT1BFTkFJX0VORFBPSU5UJ10gPz8gdW5kZWZpbmVkXSAtIFlvdXIgQXp1cmUgZW5kcG9pbnQsIGluY2x1ZGluZyB0aGUgcmVzb3VyY2UsIGUuZy4gYGh0dHBzOi8vZXhhbXBsZS1yZXNvdXJjZS5henVyZS5vcGVuYWkuY29tL2BcbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IHVuZGVmaW5lZH0gW29wdHMuYXBpS2V5PXByb2Nlc3MuZW52WydBWlVSRV9PUEVOQUlfQVBJX0tFWSddID8/IHVuZGVmaW5lZF1cbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IHVuZGVmaW5lZH0gb3B0cy5kZXBsb3ltZW50IC0gQSBtb2RlbCBkZXBsb3ltZW50LCBpZiBnaXZlbiwgc2V0cyB0aGUgYmFzZSBjbGllbnQgVVJMIHRvIGluY2x1ZGUgYC9kZXBsb3ltZW50cy97ZGVwbG95bWVudH1gLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZH0gW29wdHMub3JnYW5pemF0aW9uPXByb2Nlc3MuZW52WydPUEVOQUlfT1JHX0lEJ10gPz8gbnVsbF1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdHMuYmFzZVVSTD1wcm9jZXNzLmVudlsnT1BFTkFJX0JBU0VfVVJMJ11dIC0gU2V0cyB0aGUgYmFzZSBVUkwgZm9yIHRoZSBBUEksIGUuZy4gYGh0dHBzOi8vZXhhbXBsZS1yZXNvdXJjZS5henVyZS5vcGVuYWkuY29tL29wZW5haS9gLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy50aW1lb3V0PTEwIG1pbnV0ZXNdIC0gVGhlIG1heGltdW0gYW1vdW50IG9mIHRpbWUgKGluIG1pbGxpc2Vjb25kcykgdGhlIGNsaWVudCB3aWxsIHdhaXQgZm9yIGEgcmVzcG9uc2UgYmVmb3JlIHRpbWluZyBvdXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmh0dHBBZ2VudF0gLSBBbiBIVFRQIGFnZW50IHVzZWQgdG8gbWFuYWdlIEhUVFAocykgY29ubmVjdGlvbnMuXG4gICAgICogQHBhcmFtIHtDb3JlLkZldGNofSBbb3B0cy5mZXRjaF0gLSBTcGVjaWZ5IGEgY3VzdG9tIGBmZXRjaGAgZnVuY3Rpb24gaW1wbGVtZW50YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLm1heFJldHJpZXM9Ml0gLSBUaGUgbWF4aW11bSBudW1iZXIgb2YgdGltZXMgdGhlIGNsaWVudCB3aWxsIHJldHJ5IGEgcmVxdWVzdC5cbiAgICAgKiBAcGFyYW0ge0NvcmUuSGVhZGVyc30gb3B0cy5kZWZhdWx0SGVhZGVycyAtIERlZmF1bHQgaGVhZGVycyB0byBpbmNsdWRlIHdpdGggZXZlcnkgcmVxdWVzdCB0byB0aGUgQVBJLlxuICAgICAqIEBwYXJhbSB7Q29yZS5EZWZhdWx0UXVlcnl9IG9wdHMuZGVmYXVsdFF1ZXJ5IC0gRGVmYXVsdCBxdWVyeSBwYXJhbWV0ZXJzIHRvIGluY2x1ZGUgd2l0aCBldmVyeSByZXF1ZXN0IHRvIHRoZSBBUEkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5kYW5nZXJvdXNseUFsbG93QnJvd3Nlcj1mYWxzZV0gLSBCeSBkZWZhdWx0LCBjbGllbnQtc2lkZSB1c2Ugb2YgdGhpcyBsaWJyYXJ5IGlzIG5vdCBhbGxvd2VkLCBhcyBpdCByaXNrcyBleHBvc2luZyB5b3VyIHNlY3JldCBBUEkgY3JlZGVudGlhbHMgdG8gYXR0YWNrZXJzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHsgYmFzZVVSTCA9IENvcmUucmVhZEVudignT1BFTkFJX0JBU0VfVVJMJyksIGFwaUtleSA9IENvcmUucmVhZEVudignQVpVUkVfT1BFTkFJX0FQSV9LRVknKSwgYXBpVmVyc2lvbiA9IENvcmUucmVhZEVudignT1BFTkFJX0FQSV9WRVJTSU9OJyksIGVuZHBvaW50LCBkZXBsb3ltZW50LCBhenVyZUFEVG9rZW5Qcm92aWRlciwgZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXIsIC4uLm9wdHMgfSA9IHt9KSB7XG4gICAgICAgIGlmICghYXBpVmVyc2lvbikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcihcIlRoZSBPUEVOQUlfQVBJX1ZFUlNJT04gZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbWlzc2luZyBvciBlbXB0eTsgZWl0aGVyIHByb3ZpZGUgaXQsIG9yIGluc3RhbnRpYXRlIHRoZSBBenVyZU9wZW5BSSBjbGllbnQgd2l0aCBhbiBhcGlWZXJzaW9uIG9wdGlvbiwgbGlrZSBuZXcgQXp1cmVPcGVuQUkoeyBhcGlWZXJzaW9uOiAnTXkgQVBJIFZlcnNpb24nIH0pLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGF6dXJlQURUb2tlblByb3ZpZGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBkYW5nZXJvdXNseUFsbG93QnJvd3NlciA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFhenVyZUFEVG9rZW5Qcm92aWRlciAmJiAhYXBpS2V5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKCdNaXNzaW5nIGNyZWRlbnRpYWxzLiBQbGVhc2UgcGFzcyBvbmUgb2YgYGFwaUtleWAgYW5kIGBhenVyZUFEVG9rZW5Qcm92aWRlcmAsIG9yIHNldCB0aGUgYEFaVVJFX09QRU5BSV9BUElfS0VZYCBlbnZpcm9ubWVudCB2YXJpYWJsZS4nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXp1cmVBRFRva2VuUHJvdmlkZXIgJiYgYXBpS2V5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKCdUaGUgYGFwaUtleWAgYW5kIGBhenVyZUFEVG9rZW5Qcm92aWRlcmAgYXJndW1lbnRzIGFyZSBtdXR1YWxseSBleGNsdXNpdmU7IG9ubHkgb25lIGNhbiBiZSBwYXNzZWQgYXQgYSB0aW1lLicpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRlZmluZSBhIHNlbnRpbmVsIHZhbHVlIHRvIGF2b2lkIGFueSB0eXBpbmcgaXNzdWVzXG4gICAgICAgIGFwaUtleSA/PyAoYXBpS2V5ID0gQVBJX0tFWV9TRU5USU5FTCk7XG4gICAgICAgIG9wdHMuZGVmYXVsdFF1ZXJ5ID0geyAuLi5vcHRzLmRlZmF1bHRRdWVyeSwgJ2FwaS12ZXJzaW9uJzogYXBpVmVyc2lvbiB9O1xuICAgICAgICBpZiAoIWJhc2VVUkwpIHtcbiAgICAgICAgICAgIGlmICghZW5kcG9pbnQpIHtcbiAgICAgICAgICAgICAgICBlbmRwb2ludCA9IHByb2Nlc3MuZW52WydBWlVSRV9PUEVOQUlfRU5EUE9JTlQnXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghZW5kcG9pbnQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKCdNdXN0IHByb3ZpZGUgb25lIG9mIHRoZSBgYmFzZVVSTGAgb3IgYGVuZHBvaW50YCBhcmd1bWVudHMsIG9yIHRoZSBgQVpVUkVfT1BFTkFJX0VORFBPSU5UYCBlbnZpcm9ubWVudCB2YXJpYWJsZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmFzZVVSTCA9IGAke2VuZHBvaW50fS9vcGVuYWlgO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGVuZHBvaW50KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcignYmFzZVVSTCBhbmQgZW5kcG9pbnQgYXJlIG11dHVhbGx5IGV4Y2x1c2l2ZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN1cGVyKHtcbiAgICAgICAgICAgIGFwaUtleSxcbiAgICAgICAgICAgIGJhc2VVUkwsXG4gICAgICAgICAgICAuLi5vcHRzLFxuICAgICAgICAgICAgLi4uKGRhbmdlcm91c2x5QWxsb3dCcm93c2VyICE9PSB1bmRlZmluZWQgPyB7IGRhbmdlcm91c2x5QWxsb3dCcm93c2VyIH0gOiB7fSksXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFwaVZlcnNpb24gPSAnJztcbiAgICAgICAgdGhpcy5fYXp1cmVBRFRva2VuUHJvdmlkZXIgPSBhenVyZUFEVG9rZW5Qcm92aWRlcjtcbiAgICAgICAgdGhpcy5hcGlWZXJzaW9uID0gYXBpVmVyc2lvbjtcbiAgICAgICAgdGhpcy5kZXBsb3ltZW50TmFtZSA9IGRlcGxveW1lbnQ7XG4gICAgfVxuICAgIGJ1aWxkUmVxdWVzdChvcHRpb25zLCBwcm9wcyA9IHt9KSB7XG4gICAgICAgIGlmIChfZGVwbG95bWVudHNfZW5kcG9pbnRzLmhhcyhvcHRpb25zLnBhdGgpICYmIG9wdGlvbnMubWV0aG9kID09PSAncG9zdCcgJiYgb3B0aW9ucy5ib2R5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICghQ29yZS5pc09iaihvcHRpb25zLmJvZHkpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCByZXF1ZXN0IGJvZHkgdG8gYmUgYW4gb2JqZWN0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBtb2RlbCA9IHRoaXMuZGVwbG95bWVudE5hbWUgfHwgb3B0aW9ucy5ib2R5Wydtb2RlbCddIHx8IG9wdGlvbnMuX19tZXRhZGF0YT8uWydtb2RlbCddO1xuICAgICAgICAgICAgaWYgKG1vZGVsICE9PSB1bmRlZmluZWQgJiYgIXRoaXMuYmFzZVVSTC5pbmNsdWRlcygnL2RlcGxveW1lbnRzJykpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnBhdGggPSBgL2RlcGxveW1lbnRzLyR7bW9kZWx9JHtvcHRpb25zLnBhdGh9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VwZXIuYnVpbGRSZXF1ZXN0KG9wdGlvbnMsIHByb3BzKTtcbiAgICB9XG4gICAgYXN5bmMgX2dldEF6dXJlQURUb2tlbigpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9henVyZUFEVG9rZW5Qcm92aWRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY29uc3QgdG9rZW4gPSBhd2FpdCB0aGlzLl9henVyZUFEVG9rZW5Qcm92aWRlcigpO1xuICAgICAgICAgICAgaWYgKCF0b2tlbiB8fCB0eXBlb2YgdG9rZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcihgRXhwZWN0ZWQgJ2F6dXJlQURUb2tlblByb3ZpZGVyJyBhcmd1bWVudCB0byByZXR1cm4gYSBzdHJpbmcgYnV0IGl0IHJldHVybmVkICR7dG9rZW59YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgYXV0aEhlYWRlcnMob3B0cykge1xuICAgICAgICByZXR1cm4ge307XG4gICAgfVxuICAgIGFzeW5jIHByZXBhcmVPcHRpb25zKG9wdHMpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB1c2VyIHNob3VsZCBwcm92aWRlIGEgYmVhcmVyIHRva2VuIHByb3ZpZGVyIGlmIHRoZXkgd2FudFxuICAgICAgICAgKiB0byB1c2UgQXp1cmUgQUQgYXV0aGVudGljYXRpb24uIFRoZSB1c2VyIHNob3VsZG4ndCBzZXQgdGhlXG4gICAgICAgICAqIEF1dGhvcml6YXRpb24gaGVhZGVyIG1hbnVhbGx5IGJlY2F1c2UgdGhlIGhlYWRlciBpcyBvdmVyd3JpdHRlblxuICAgICAgICAgKiB3aXRoIHRoZSBBenVyZSBBRCB0b2tlbiBpZiBhIGJlYXJlciB0b2tlbiBwcm92aWRlciBpcyBwcm92aWRlZC5cbiAgICAgICAgICovXG4gICAgICAgIGlmIChvcHRzLmhlYWRlcnM/LlsnYXBpLWtleSddKSB7XG4gICAgICAgICAgICByZXR1cm4gc3VwZXIucHJlcGFyZU9wdGlvbnMob3B0cyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdG9rZW4gPSBhd2FpdCB0aGlzLl9nZXRBenVyZUFEVG9rZW4oKTtcbiAgICAgICAgb3B0cy5oZWFkZXJzID8/IChvcHRzLmhlYWRlcnMgPSB7fSk7XG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgb3B0cy5oZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLmFwaUtleSAhPT0gQVBJX0tFWV9TRU5USU5FTCkge1xuICAgICAgICAgICAgb3B0cy5oZWFkZXJzWydhcGkta2V5J10gPSB0aGlzLmFwaUtleTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoJ1VuYWJsZSB0byBoYW5kbGUgYXV0aCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdXBlci5wcmVwYXJlT3B0aW9ucyhvcHRzKTtcbiAgICB9XG59XG5jb25zdCBfZGVwbG95bWVudHNfZW5kcG9pbnRzID0gbmV3IFNldChbXG4gICAgJy9jb21wbGV0aW9ucycsXG4gICAgJy9jaGF0L2NvbXBsZXRpb25zJyxcbiAgICAnL2VtYmVkZGluZ3MnLFxuICAgICcvYXVkaW8vdHJhbnNjcmlwdGlvbnMnLFxuICAgICcvYXVkaW8vdHJhbnNsYXRpb25zJyxcbiAgICAnL2F1ZGlvL3NwZWVjaCcsXG4gICAgJy9pbWFnZXMvZ2VuZXJhdGlvbnMnLFxuXSk7XG5jb25zdCBBUElfS0VZX1NFTlRJTkVMID0gJzxNaXNzaW5nIEtleT4nO1xuZXhwb3J0IHsgdG9GaWxlLCBmaWxlRnJvbVBhdGggfSBmcm9tIFwiLi91cGxvYWRzLm1qc1wiO1xuZXhwb3J0IHsgT3BlbkFJRXJyb3IsIEFQSUVycm9yLCBBUElDb25uZWN0aW9uRXJyb3IsIEFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3IsIEFQSVVzZXJBYm9ydEVycm9yLCBOb3RGb3VuZEVycm9yLCBDb25mbGljdEVycm9yLCBSYXRlTGltaXRFcnJvciwgQmFkUmVxdWVzdEVycm9yLCBBdXRoZW50aWNhdGlvbkVycm9yLCBJbnRlcm5hbFNlcnZlckVycm9yLCBQZXJtaXNzaW9uRGVuaWVkRXJyb3IsIFVucHJvY2Vzc2FibGVFbnRpdHlFcnJvciwgfSBmcm9tIFwiLi9lcnJvci5tanNcIjtcbmV4cG9ydCBkZWZhdWx0IE9wZW5BSTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4Lm1qcy5tYXAiLCJ2YXIgX19jbGFzc1ByaXZhdGVGaWVsZFNldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZFNldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XG59O1xudmFyIF9fY2xhc3NQcml2YXRlRmllbGRHZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRHZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcbn07XG52YXIgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXg7XG5pbXBvcnQgeyBPcGVuQUlFcnJvciB9IGZyb20gXCIuLi8uLi9lcnJvci5tanNcIjtcbi8qKlxuICogQSByZS1pbXBsZW1lbnRhdGlvbiBvZiBodHRweCdzIGBMaW5lRGVjb2RlcmAgaW4gUHl0aG9uIHRoYXQgaGFuZGxlcyBpbmNyZW1lbnRhbGx5XG4gKiByZWFkaW5nIGxpbmVzIGZyb20gdGV4dC5cbiAqXG4gKiBodHRwczovL2dpdGh1Yi5jb20vZW5jb2RlL2h0dHB4L2Jsb2IvOTIwMzMzZWE5ODExOGU5Y2Y2MTdmMjQ2OTA1ZDdiMjAyNTEwOTQxYy9odHRweC9fZGVjb2RlcnMucHkjTDI1OFxuICovXG5leHBvcnQgY2xhc3MgTGluZURlY29kZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXcgVWludDhBcnJheSgpO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBudWxsLCBcImZcIik7XG4gICAgfVxuICAgIGRlY29kZShjaHVuaykge1xuICAgICAgICBpZiAoY2h1bmsgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJpbmFyeUNodW5rID0gY2h1bmsgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciA/IG5ldyBVaW50OEFycmF5KGNodW5rKVxuICAgICAgICAgICAgOiB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnID8gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGNodW5rKVxuICAgICAgICAgICAgICAgIDogY2h1bms7XG4gICAgICAgIGxldCBuZXdEYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIubGVuZ3RoICsgYmluYXJ5Q2h1bmsubGVuZ3RoKTtcbiAgICAgICAgbmV3RGF0YS5zZXQodGhpcy5idWZmZXIpO1xuICAgICAgICBuZXdEYXRhLnNldChiaW5hcnlDaHVuaywgdGhpcy5idWZmZXIubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXdEYXRhO1xuICAgICAgICBjb25zdCBsaW5lcyA9IFtdO1xuICAgICAgICBsZXQgcGF0dGVybkluZGV4O1xuICAgICAgICB3aGlsZSAoKHBhdHRlcm5JbmRleCA9IGZpbmROZXdsaW5lSW5kZXgodGhpcy5idWZmZXIsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSkpICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChwYXR0ZXJuSW5kZXguY2FycmlhZ2UgJiYgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAvLyBza2lwIHVudGlsIHdlIGVpdGhlciBnZXQgYSBjb3JyZXNwb25kaW5nIGBcXG5gLCBhIG5ldyBgXFxyYCBvciBub3RoaW5nXG4gICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgcGF0dGVybkluZGV4LmluZGV4LCBcImZcIik7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB3ZSBnb3QgZG91YmxlIFxcciBvciBcXHJ0ZXh0XFxuXG4gICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpICE9IG51bGwgJiZcbiAgICAgICAgICAgICAgICAocGF0dGVybkluZGV4LmluZGV4ICE9PSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikgKyAxIHx8IHBhdHRlcm5JbmRleC5jYXJyaWFnZSkpIHtcbiAgICAgICAgICAgICAgICBsaW5lcy5wdXNoKHRoaXMuZGVjb2RlVGV4dCh0aGlzLmJ1ZmZlci5zbGljZSgwLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikgLSAxKSkpO1xuICAgICAgICAgICAgICAgIHRoaXMuYnVmZmVyID0gdGhpcy5idWZmZXIuc2xpY2UoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBudWxsLCBcImZcIik7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBlbmRJbmRleCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSAhPT0gbnVsbCA/IHBhdHRlcm5JbmRleC5wcmVjZWRpbmcgLSAxIDogcGF0dGVybkluZGV4LnByZWNlZGluZztcbiAgICAgICAgICAgIGNvbnN0IGxpbmUgPSB0aGlzLmRlY29kZVRleHQodGhpcy5idWZmZXIuc2xpY2UoMCwgZW5kSW5kZXgpKTtcbiAgICAgICAgICAgIGxpbmVzLnB1c2gobGluZSk7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZlciA9IHRoaXMuYnVmZmVyLnNsaWNlKHBhdHRlcm5JbmRleC5pbmRleCk7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBudWxsLCBcImZcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpbmVzO1xuICAgIH1cbiAgICBkZWNvZGVUZXh0KGJ5dGVzKSB7XG4gICAgICAgIGlmIChieXRlcyA9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICBpZiAodHlwZW9mIGJ5dGVzID09PSAnc3RyaW5nJylcbiAgICAgICAgICAgIHJldHVybiBieXRlcztcbiAgICAgICAgLy8gTm9kZTpcbiAgICAgICAgaWYgKHR5cGVvZiBCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoYnl0ZXMgaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnl0ZXMudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChieXRlcyBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20oYnl0ZXMpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYFVuZXhwZWN0ZWQ6IHJlY2VpdmVkIG5vbi1VaW50OEFycmF5ICgke2J5dGVzLmNvbnN0cnVjdG9yLm5hbWV9KSBzdHJlYW0gY2h1bmsgaW4gYW4gZW52aXJvbm1lbnQgd2l0aCBhIGdsb2JhbCBcIkJ1ZmZlclwiIGRlZmluZWQsIHdoaWNoIHRoaXMgbGlicmFyeSBhc3N1bWVzIHRvIGJlIE5vZGUuIFBsZWFzZSByZXBvcnQgdGhpcyBlcnJvci5gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBCcm93c2VyXG4gICAgICAgIGlmICh0eXBlb2YgVGV4dERlY29kZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoYnl0ZXMgaW5zdGFuY2VvZiBVaW50OEFycmF5IHx8IGJ5dGVzIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHREZWNvZGVyID8/ICh0aGlzLnRleHREZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCd1dGY4JykpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRleHREZWNvZGVyLmRlY29kZShieXRlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYFVuZXhwZWN0ZWQ6IHJlY2VpdmVkIG5vbi1VaW50OEFycmF5L0FycmF5QnVmZmVyICgke2J5dGVzLmNvbnN0cnVjdG9yLm5hbWV9KSBpbiBhIHdlYiBwbGF0Zm9ybS4gUGxlYXNlIHJlcG9ydCB0aGlzIGVycm9yLmApO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgVW5leHBlY3RlZDogbmVpdGhlciBCdWZmZXIgbm9yIFRleHREZWNvZGVyIGFyZSBhdmFpbGFibGUgYXMgZ2xvYmFscy4gUGxlYXNlIHJlcG9ydCB0aGlzIGVycm9yLmApO1xuICAgIH1cbiAgICBmbHVzaCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5kZWNvZGUoJ1xcbicpO1xuICAgIH1cbn1cbl9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4ID0gbmV3IFdlYWtNYXAoKTtcbi8vIHByZXR0aWVyLWlnbm9yZVxuTGluZURlY29kZXIuTkVXTElORV9DSEFSUyA9IG5ldyBTZXQoWydcXG4nLCAnXFxyJ10pO1xuTGluZURlY29kZXIuTkVXTElORV9SRUdFWFAgPSAvXFxyXFxufFtcXG5cXHJdL2c7XG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gc2VhcmNoZXMgdGhlIGJ1ZmZlciBmb3IgdGhlIGVuZCBwYXR0ZXJucywgKFxcciBvciBcXG4pXG4gKiBhbmQgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCB0aGUgaW5kZXggcHJlY2VkaW5nIHRoZSBtYXRjaGVkIG5ld2xpbmUgYW5kIHRoZVxuICogaW5kZXggYWZ0ZXIgdGhlIG5ld2xpbmUgY2hhci4gYG51bGxgIGlzIHJldHVybmVkIGlmIG5vIG5ldyBsaW5lIGlzIGZvdW5kLlxuICpcbiAqIGBgYHRzXG4gKiBmaW5kTmV3TGluZUluZGV4KCdhYmNcXG5kZWYnKSAtPiB7IHByZWNlZGluZzogMiwgaW5kZXg6IDMgfVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGZpbmROZXdsaW5lSW5kZXgoYnVmZmVyLCBzdGFydEluZGV4KSB7XG4gICAgY29uc3QgbmV3bGluZSA9IDB4MGE7IC8vIFxcblxuICAgIGNvbnN0IGNhcnJpYWdlID0gMHgwZDsgLy8gXFxyXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXggPz8gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYnVmZmVyW2ldID09PSBuZXdsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4geyBwcmVjZWRpbmc6IGksIGluZGV4OiBpICsgMSwgY2FycmlhZ2U6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJ1ZmZlcltpXSA9PT0gY2FycmlhZ2UpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHByZWNlZGluZzogaSwgaW5kZXg6IGkgKyAxLCBjYXJyaWFnZTogdHJ1ZSB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bGluZS5tanMubWFwIiwiZXhwb3J0IGNvbnN0IGRlZmF1bHRfZm9ybWF0ID0gJ1JGQzM5ODYnO1xuZXhwb3J0IGNvbnN0IGZvcm1hdHRlcnMgPSB7XG4gICAgUkZDMTczODogKHYpID0+IFN0cmluZyh2KS5yZXBsYWNlKC8lMjAvZywgJysnKSxcbiAgICBSRkMzOTg2OiAodikgPT4gU3RyaW5nKHYpLFxufTtcbmV4cG9ydCBjb25zdCBSRkMxNzM4ID0gJ1JGQzE3MzgnO1xuZXhwb3J0IGNvbnN0IFJGQzM5ODYgPSAnUkZDMzk4Nic7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXRzLm1qcy5tYXAiLCJpbXBvcnQgeyBlbmNvZGUsIGlzX2J1ZmZlciwgbWF5YmVfbWFwIH0gZnJvbSBcIi4vdXRpbHMubWpzXCI7XG5pbXBvcnQgeyBkZWZhdWx0X2Zvcm1hdCwgZm9ybWF0dGVycyB9IGZyb20gXCIuL2Zvcm1hdHMubWpzXCI7XG5jb25zdCBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuY29uc3QgYXJyYXlfcHJlZml4X2dlbmVyYXRvcnMgPSB7XG4gICAgYnJhY2tldHMocHJlZml4KSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcocHJlZml4KSArICdbXSc7XG4gICAgfSxcbiAgICBjb21tYTogJ2NvbW1hJyxcbiAgICBpbmRpY2VzKHByZWZpeCwga2V5KSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcocHJlZml4KSArICdbJyArIGtleSArICddJztcbiAgICB9LFxuICAgIHJlcGVhdChwcmVmaXgpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZyhwcmVmaXgpO1xuICAgIH0sXG59O1xuY29uc3QgaXNfYXJyYXkgPSBBcnJheS5pc0FycmF5O1xuY29uc3QgcHVzaCA9IEFycmF5LnByb3RvdHlwZS5wdXNoO1xuY29uc3QgcHVzaF90b19hcnJheSA9IGZ1bmN0aW9uIChhcnIsIHZhbHVlX29yX2FycmF5KSB7XG4gICAgcHVzaC5hcHBseShhcnIsIGlzX2FycmF5KHZhbHVlX29yX2FycmF5KSA/IHZhbHVlX29yX2FycmF5IDogW3ZhbHVlX29yX2FycmF5XSk7XG59O1xuY29uc3QgdG9fSVNPID0gRGF0ZS5wcm90b3R5cGUudG9JU09TdHJpbmc7XG5jb25zdCBkZWZhdWx0cyA9IHtcbiAgICBhZGRRdWVyeVByZWZpeDogZmFsc2UsXG4gICAgYWxsb3dEb3RzOiBmYWxzZSxcbiAgICBhbGxvd0VtcHR5QXJyYXlzOiBmYWxzZSxcbiAgICBhcnJheUZvcm1hdDogJ2luZGljZXMnLFxuICAgIGNoYXJzZXQ6ICd1dGYtOCcsXG4gICAgY2hhcnNldFNlbnRpbmVsOiBmYWxzZSxcbiAgICBkZWxpbWl0ZXI6ICcmJyxcbiAgICBlbmNvZGU6IHRydWUsXG4gICAgZW5jb2RlRG90SW5LZXlzOiBmYWxzZSxcbiAgICBlbmNvZGVyOiBlbmNvZGUsXG4gICAgZW5jb2RlVmFsdWVzT25seTogZmFsc2UsXG4gICAgZm9ybWF0OiBkZWZhdWx0X2Zvcm1hdCxcbiAgICBmb3JtYXR0ZXI6IGZvcm1hdHRlcnNbZGVmYXVsdF9mb3JtYXRdLFxuICAgIC8qKiBAZGVwcmVjYXRlZCAqL1xuICAgIGluZGljZXM6IGZhbHNlLFxuICAgIHNlcmlhbGl6ZURhdGUoZGF0ZSkge1xuICAgICAgICByZXR1cm4gdG9fSVNPLmNhbGwoZGF0ZSk7XG4gICAgfSxcbiAgICBza2lwTnVsbHM6IGZhbHNlLFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG59O1xuZnVuY3Rpb24gaXNfbm9uX251bGxpc2hfcHJpbWl0aXZlKHYpIHtcbiAgICByZXR1cm4gKHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fFxuICAgICAgICB0eXBlb2YgdiA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgdHlwZW9mIHYgPT09ICdib29sZWFuJyB8fFxuICAgICAgICB0eXBlb2YgdiA9PT0gJ3N5bWJvbCcgfHxcbiAgICAgICAgdHlwZW9mIHYgPT09ICdiaWdpbnQnKTtcbn1cbmNvbnN0IHNlbnRpbmVsID0ge307XG5mdW5jdGlvbiBpbm5lcl9zdHJpbmdpZnkob2JqZWN0LCBwcmVmaXgsIGdlbmVyYXRlQXJyYXlQcmVmaXgsIGNvbW1hUm91bmRUcmlwLCBhbGxvd0VtcHR5QXJyYXlzLCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlRG90SW5LZXlzLCBlbmNvZGVyLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cywgc2VyaWFsaXplRGF0ZSwgZm9ybWF0LCBmb3JtYXR0ZXIsIGVuY29kZVZhbHVlc09ubHksIGNoYXJzZXQsIHNpZGVDaGFubmVsKSB7XG4gICAgbGV0IG9iaiA9IG9iamVjdDtcbiAgICBsZXQgdG1wX3NjID0gc2lkZUNoYW5uZWw7XG4gICAgbGV0IHN0ZXAgPSAwO1xuICAgIGxldCBmaW5kX2ZsYWcgPSBmYWxzZTtcbiAgICB3aGlsZSAoKHRtcF9zYyA9IHRtcF9zYy5nZXQoc2VudGluZWwpKSAhPT0gdm9pZCB1bmRlZmluZWQgJiYgIWZpbmRfZmxhZykge1xuICAgICAgICAvLyBXaGVyZSBvYmplY3QgbGFzdCBhcHBlYXJlZCBpbiB0aGUgcmVmIHRyZWVcbiAgICAgICAgY29uc3QgcG9zID0gdG1wX3NjLmdldChvYmplY3QpO1xuICAgICAgICBzdGVwICs9IDE7XG4gICAgICAgIGlmICh0eXBlb2YgcG9zICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKHBvcyA9PT0gc3RlcCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdDeWNsaWMgb2JqZWN0IHZhbHVlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5kX2ZsYWcgPSB0cnVlOyAvLyBCcmVhayB3aGlsZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgdG1wX3NjLmdldChzZW50aW5lbCkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzdGVwID0gMDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBvYmogPSBmaWx0ZXIocHJlZml4LCBvYmopO1xuICAgIH1cbiAgICBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIG9iaiA9IHNlcmlhbGl6ZURhdGU/LihvYmopO1xuICAgIH1cbiAgICBlbHNlIGlmIChnZW5lcmF0ZUFycmF5UHJlZml4ID09PSAnY29tbWEnICYmIGlzX2FycmF5KG9iaikpIHtcbiAgICAgICAgb2JqID0gbWF5YmVfbWFwKG9iaiwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZURhdGU/Lih2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgICAgIGlmIChzdHJpY3ROdWxsSGFuZGxpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGVyICYmICFlbmNvZGVWYWx1ZXNPbmx5ID9cbiAgICAgICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgICAgICAgICAgZW5jb2RlcihwcmVmaXgsIGRlZmF1bHRzLmVuY29kZXIsIGNoYXJzZXQsICdrZXknLCBmb3JtYXQpXG4gICAgICAgICAgICAgICAgOiBwcmVmaXg7XG4gICAgICAgIH1cbiAgICAgICAgb2JqID0gJyc7XG4gICAgfVxuICAgIGlmIChpc19ub25fbnVsbGlzaF9wcmltaXRpdmUob2JqKSB8fCBpc19idWZmZXIob2JqKSkge1xuICAgICAgICBpZiAoZW5jb2Rlcikge1xuICAgICAgICAgICAgY29uc3Qga2V5X3ZhbHVlID0gZW5jb2RlVmFsdWVzT25seSA/IHByZWZpeFxuICAgICAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgICAgICAgICA6IGVuY29kZXIocHJlZml4LCBkZWZhdWx0cy5lbmNvZGVyLCBjaGFyc2V0LCAna2V5JywgZm9ybWF0KTtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgZm9ybWF0dGVyPy4oa2V5X3ZhbHVlKSArXG4gICAgICAgICAgICAgICAgICAgICc9JyArXG4gICAgICAgICAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0dGVyPy4oZW5jb2RlcihvYmosIGRlZmF1bHRzLmVuY29kZXIsIGNoYXJzZXQsICd2YWx1ZScsIGZvcm1hdCkpLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2Zvcm1hdHRlcj8uKHByZWZpeCkgKyAnPScgKyBmb3JtYXR0ZXI/LihTdHJpbmcob2JqKSldO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZXMgPSBbXTtcbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9XG4gICAgbGV0IG9ial9rZXlzO1xuICAgIGlmIChnZW5lcmF0ZUFycmF5UHJlZml4ID09PSAnY29tbWEnICYmIGlzX2FycmF5KG9iaikpIHtcbiAgICAgICAgLy8gd2UgbmVlZCB0byBqb2luIGVsZW1lbnRzIGluXG4gICAgICAgIGlmIChlbmNvZGVWYWx1ZXNPbmx5ICYmIGVuY29kZXIpIHtcbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgdmFsdWVzIG9ubHlcbiAgICAgICAgICAgIG9iaiA9IG1heWJlX21hcChvYmosIGVuY29kZXIpO1xuICAgICAgICB9XG4gICAgICAgIG9ial9rZXlzID0gW3sgdmFsdWU6IG9iai5sZW5ndGggPiAwID8gb2JqLmpvaW4oJywnKSB8fCBudWxsIDogdm9pZCB1bmRlZmluZWQgfV07XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzX2FycmF5KGZpbHRlcikpIHtcbiAgICAgICAgb2JqX2tleXMgPSBmaWx0ZXI7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgICAgb2JqX2tleXMgPSBzb3J0ID8ga2V5cy5zb3J0KHNvcnQpIDoga2V5cztcbiAgICB9XG4gICAgY29uc3QgZW5jb2RlZF9wcmVmaXggPSBlbmNvZGVEb3RJbktleXMgPyBTdHJpbmcocHJlZml4KS5yZXBsYWNlKC9cXC4vZywgJyUyRScpIDogU3RyaW5nKHByZWZpeCk7XG4gICAgY29uc3QgYWRqdXN0ZWRfcHJlZml4ID0gY29tbWFSb3VuZFRyaXAgJiYgaXNfYXJyYXkob2JqKSAmJiBvYmoubGVuZ3RoID09PSAxID8gZW5jb2RlZF9wcmVmaXggKyAnW10nIDogZW5jb2RlZF9wcmVmaXg7XG4gICAgaWYgKGFsbG93RW1wdHlBcnJheXMgJiYgaXNfYXJyYXkob2JqKSAmJiBvYmoubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBhZGp1c3RlZF9wcmVmaXggKyAnW10nO1xuICAgIH1cbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IG9ial9rZXlzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IG9ial9rZXlzW2pdO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHR5cGVvZiBrZXkgPT09ICdvYmplY3QnICYmIHR5cGVvZiBrZXkudmFsdWUgIT09ICd1bmRlZmluZWQnID8ga2V5LnZhbHVlIDogb2JqW2tleV07XG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgdmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgY29uc3QgZW5jb2RlZF9rZXkgPSBhbGxvd0RvdHMgJiYgZW5jb2RlRG90SW5LZXlzID8ga2V5LnJlcGxhY2UoL1xcLi9nLCAnJTJFJykgOiBrZXk7XG4gICAgICAgIGNvbnN0IGtleV9wcmVmaXggPSBpc19hcnJheShvYmopID9cbiAgICAgICAgICAgIHR5cGVvZiBnZW5lcmF0ZUFycmF5UHJlZml4ID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgICAgICBnZW5lcmF0ZUFycmF5UHJlZml4KGFkanVzdGVkX3ByZWZpeCwgZW5jb2RlZF9rZXkpXG4gICAgICAgICAgICAgICAgOiBhZGp1c3RlZF9wcmVmaXhcbiAgICAgICAgICAgIDogYWRqdXN0ZWRfcHJlZml4ICsgKGFsbG93RG90cyA/ICcuJyArIGVuY29kZWRfa2V5IDogJ1snICsgZW5jb2RlZF9rZXkgKyAnXScpO1xuICAgICAgICBzaWRlQ2hhbm5lbC5zZXQob2JqZWN0LCBzdGVwKTtcbiAgICAgICAgY29uc3QgdmFsdWVTaWRlQ2hhbm5lbCA9IG5ldyBXZWFrTWFwKCk7XG4gICAgICAgIHZhbHVlU2lkZUNoYW5uZWwuc2V0KHNlbnRpbmVsLCBzaWRlQ2hhbm5lbCk7XG4gICAgICAgIHB1c2hfdG9fYXJyYXkodmFsdWVzLCBpbm5lcl9zdHJpbmdpZnkodmFsdWUsIGtleV9wcmVmaXgsIGdlbmVyYXRlQXJyYXlQcmVmaXgsIGNvbW1hUm91bmRUcmlwLCBhbGxvd0VtcHR5QXJyYXlzLCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlRG90SW5LZXlzLCBcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBnZW5lcmF0ZUFycmF5UHJlZml4ID09PSAnY29tbWEnICYmIGVuY29kZVZhbHVlc09ubHkgJiYgaXNfYXJyYXkob2JqKSA/IG51bGwgOiBlbmNvZGVyLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cywgc2VyaWFsaXplRGF0ZSwgZm9ybWF0LCBmb3JtYXR0ZXIsIGVuY29kZVZhbHVlc09ubHksIGNoYXJzZXQsIHZhbHVlU2lkZUNoYW5uZWwpKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZV9zdHJpbmdpZnlfb3B0aW9ucyhvcHRzID0gZGVmYXVsdHMpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMuYWxsb3dFbXB0eUFycmF5cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG9wdHMuYWxsb3dFbXB0eUFycmF5cyAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2BhbGxvd0VtcHR5QXJyYXlzYCBvcHRpb24gY2FuIG9ubHkgYmUgYHRydWVgIG9yIGBmYWxzZWAsIHdoZW4gcHJvdmlkZWQnKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvcHRzLmVuY29kZURvdEluS2V5cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG9wdHMuZW5jb2RlRG90SW5LZXlzICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGVuY29kZURvdEluS2V5c2Agb3B0aW9uIGNhbiBvbmx5IGJlIGB0cnVlYCBvciBgZmFsc2VgLCB3aGVuIHByb3ZpZGVkJyk7XG4gICAgfVxuICAgIGlmIChvcHRzLmVuY29kZXIgIT09IG51bGwgJiYgdHlwZW9mIG9wdHMuZW5jb2RlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG9wdHMuZW5jb2RlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFbmNvZGVyIGhhcyB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cbiAgICBjb25zdCBjaGFyc2V0ID0gb3B0cy5jaGFyc2V0IHx8IGRlZmF1bHRzLmNoYXJzZXQ7XG4gICAgaWYgKHR5cGVvZiBvcHRzLmNoYXJzZXQgIT09ICd1bmRlZmluZWQnICYmIG9wdHMuY2hhcnNldCAhPT0gJ3V0Zi04JyAmJiBvcHRzLmNoYXJzZXQgIT09ICdpc28tODg1OS0xJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgY2hhcnNldCBvcHRpb24gbXVzdCBiZSBlaXRoZXIgdXRmLTgsIGlzby04ODU5LTEsIG9yIHVuZGVmaW5lZCcpO1xuICAgIH1cbiAgICBsZXQgZm9ybWF0ID0gZGVmYXVsdF9mb3JtYXQ7XG4gICAgaWYgKHR5cGVvZiBvcHRzLmZvcm1hdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKCFoYXMuY2FsbChmb3JtYXR0ZXJzLCBvcHRzLmZvcm1hdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZm9ybWF0IG9wdGlvbiBwcm92aWRlZC4nKTtcbiAgICAgICAgfVxuICAgICAgICBmb3JtYXQgPSBvcHRzLmZvcm1hdDtcbiAgICB9XG4gICAgY29uc3QgZm9ybWF0dGVyID0gZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgIGxldCBmaWx0ZXIgPSBkZWZhdWx0cy5maWx0ZXI7XG4gICAgaWYgKHR5cGVvZiBvcHRzLmZpbHRlciA9PT0gJ2Z1bmN0aW9uJyB8fCBpc19hcnJheShvcHRzLmZpbHRlcikpIHtcbiAgICAgICAgZmlsdGVyID0gb3B0cy5maWx0ZXI7XG4gICAgfVxuICAgIGxldCBhcnJheUZvcm1hdDtcbiAgICBpZiAob3B0cy5hcnJheUZvcm1hdCAmJiBvcHRzLmFycmF5Rm9ybWF0IGluIGFycmF5X3ByZWZpeF9nZW5lcmF0b3JzKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0cy5hcnJheUZvcm1hdDtcbiAgICB9XG4gICAgZWxzZSBpZiAoJ2luZGljZXMnIGluIG9wdHMpIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBvcHRzLmluZGljZXMgPyAnaW5kaWNlcycgOiAncmVwZWF0JztcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gZGVmYXVsdHMuYXJyYXlGb3JtYXQ7XG4gICAgfVxuICAgIGlmICgnY29tbWFSb3VuZFRyaXAnIGluIG9wdHMgJiYgdHlwZW9mIG9wdHMuY29tbWFSb3VuZFRyaXAgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdgY29tbWFSb3VuZFRyaXBgIG11c3QgYmUgYSBib29sZWFuLCBvciBhYnNlbnQnKTtcbiAgICB9XG4gICAgY29uc3QgYWxsb3dEb3RzID0gdHlwZW9mIG9wdHMuYWxsb3dEb3RzID09PSAndW5kZWZpbmVkJyA/XG4gICAgICAgICEhb3B0cy5lbmNvZGVEb3RJbktleXMgPT09IHRydWUgP1xuICAgICAgICAgICAgdHJ1ZVxuICAgICAgICAgICAgOiBkZWZhdWx0cy5hbGxvd0RvdHNcbiAgICAgICAgOiAhIW9wdHMuYWxsb3dEb3RzO1xuICAgIHJldHVybiB7XG4gICAgICAgIGFkZFF1ZXJ5UHJlZml4OiB0eXBlb2Ygb3B0cy5hZGRRdWVyeVByZWZpeCA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5hZGRRdWVyeVByZWZpeCA6IGRlZmF1bHRzLmFkZFF1ZXJ5UHJlZml4LFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGFsbG93RG90czogYWxsb3dEb3RzLFxuICAgICAgICBhbGxvd0VtcHR5QXJyYXlzOiB0eXBlb2Ygb3B0cy5hbGxvd0VtcHR5QXJyYXlzID09PSAnYm9vbGVhbicgPyAhIW9wdHMuYWxsb3dFbXB0eUFycmF5cyA6IGRlZmF1bHRzLmFsbG93RW1wdHlBcnJheXMsXG4gICAgICAgIGFycmF5Rm9ybWF0OiBhcnJheUZvcm1hdCxcbiAgICAgICAgY2hhcnNldDogY2hhcnNldCxcbiAgICAgICAgY2hhcnNldFNlbnRpbmVsOiB0eXBlb2Ygb3B0cy5jaGFyc2V0U2VudGluZWwgPT09ICdib29sZWFuJyA/IG9wdHMuY2hhcnNldFNlbnRpbmVsIDogZGVmYXVsdHMuY2hhcnNldFNlbnRpbmVsLFxuICAgICAgICBjb21tYVJvdW5kVHJpcDogISFvcHRzLmNvbW1hUm91bmRUcmlwLFxuICAgICAgICBkZWxpbWl0ZXI6IHR5cGVvZiBvcHRzLmRlbGltaXRlciA9PT0gJ3VuZGVmaW5lZCcgPyBkZWZhdWx0cy5kZWxpbWl0ZXIgOiBvcHRzLmRlbGltaXRlcixcbiAgICAgICAgZW5jb2RlOiB0eXBlb2Ygb3B0cy5lbmNvZGUgPT09ICdib29sZWFuJyA/IG9wdHMuZW5jb2RlIDogZGVmYXVsdHMuZW5jb2RlLFxuICAgICAgICBlbmNvZGVEb3RJbktleXM6IHR5cGVvZiBvcHRzLmVuY29kZURvdEluS2V5cyA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5lbmNvZGVEb3RJbktleXMgOiBkZWZhdWx0cy5lbmNvZGVEb3RJbktleXMsXG4gICAgICAgIGVuY29kZXI6IHR5cGVvZiBvcHRzLmVuY29kZXIgPT09ICdmdW5jdGlvbicgPyBvcHRzLmVuY29kZXIgOiBkZWZhdWx0cy5lbmNvZGVyLFxuICAgICAgICBlbmNvZGVWYWx1ZXNPbmx5OiB0eXBlb2Ygb3B0cy5lbmNvZGVWYWx1ZXNPbmx5ID09PSAnYm9vbGVhbicgPyBvcHRzLmVuY29kZVZhbHVlc09ubHkgOiBkZWZhdWx0cy5lbmNvZGVWYWx1ZXNPbmx5LFxuICAgICAgICBmaWx0ZXI6IGZpbHRlcixcbiAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgIGZvcm1hdHRlcjogZm9ybWF0dGVyLFxuICAgICAgICBzZXJpYWxpemVEYXRlOiB0eXBlb2Ygb3B0cy5zZXJpYWxpemVEYXRlID09PSAnZnVuY3Rpb24nID8gb3B0cy5zZXJpYWxpemVEYXRlIDogZGVmYXVsdHMuc2VyaWFsaXplRGF0ZSxcbiAgICAgICAgc2tpcE51bGxzOiB0eXBlb2Ygb3B0cy5za2lwTnVsbHMgPT09ICdib29sZWFuJyA/IG9wdHMuc2tpcE51bGxzIDogZGVmYXVsdHMuc2tpcE51bGxzLFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHNvcnQ6IHR5cGVvZiBvcHRzLnNvcnQgPT09ICdmdW5jdGlvbicgPyBvcHRzLnNvcnQgOiBudWxsLFxuICAgICAgICBzdHJpY3ROdWxsSGFuZGxpbmc6IHR5cGVvZiBvcHRzLnN0cmljdE51bGxIYW5kbGluZyA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5zdHJpY3ROdWxsSGFuZGxpbmcgOiBkZWZhdWx0cy5zdHJpY3ROdWxsSGFuZGxpbmcsXG4gICAgfTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdpZnkob2JqZWN0LCBvcHRzID0ge30pIHtcbiAgICBsZXQgb2JqID0gb2JqZWN0O1xuICAgIGNvbnN0IG9wdGlvbnMgPSBub3JtYWxpemVfc3RyaW5naWZ5X29wdGlvbnMob3B0cyk7XG4gICAgbGV0IG9ial9rZXlzO1xuICAgIGxldCBmaWx0ZXI7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmaWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcbiAgICAgICAgb2JqID0gZmlsdGVyKCcnLCBvYmopO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc19hcnJheShvcHRpb25zLmZpbHRlcikpIHtcbiAgICAgICAgZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgICAgIG9ial9rZXlzID0gZmlsdGVyO1xuICAgIH1cbiAgICBjb25zdCBrZXlzID0gW107XG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIGNvbnN0IGdlbmVyYXRlQXJyYXlQcmVmaXggPSBhcnJheV9wcmVmaXhfZ2VuZXJhdG9yc1tvcHRpb25zLmFycmF5Rm9ybWF0XTtcbiAgICBjb25zdCBjb21tYVJvdW5kVHJpcCA9IGdlbmVyYXRlQXJyYXlQcmVmaXggPT09ICdjb21tYScgJiYgb3B0aW9ucy5jb21tYVJvdW5kVHJpcDtcbiAgICBpZiAoIW9ial9rZXlzKSB7XG4gICAgICAgIG9ial9rZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMuc29ydCkge1xuICAgICAgICBvYmpfa2V5cy5zb3J0KG9wdGlvbnMuc29ydCk7XG4gICAgfVxuICAgIGNvbnN0IHNpZGVDaGFubmVsID0gbmV3IFdlYWtNYXAoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9ial9rZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IG9ial9rZXlzW2ldO1xuICAgICAgICBpZiAob3B0aW9ucy5za2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHB1c2hfdG9fYXJyYXkoa2V5cywgaW5uZXJfc3RyaW5naWZ5KG9ialtrZXldLCBrZXksIFxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgIGdlbmVyYXRlQXJyYXlQcmVmaXgsIGNvbW1hUm91bmRUcmlwLCBvcHRpb25zLmFsbG93RW1wdHlBcnJheXMsIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nLCBvcHRpb25zLnNraXBOdWxscywgb3B0aW9ucy5lbmNvZGVEb3RJbktleXMsIG9wdGlvbnMuZW5jb2RlID8gb3B0aW9ucy5lbmNvZGVyIDogbnVsbCwgb3B0aW9ucy5maWx0ZXIsIG9wdGlvbnMuc29ydCwgb3B0aW9ucy5hbGxvd0RvdHMsIG9wdGlvbnMuc2VyaWFsaXplRGF0ZSwgb3B0aW9ucy5mb3JtYXQsIG9wdGlvbnMuZm9ybWF0dGVyLCBvcHRpb25zLmVuY29kZVZhbHVlc09ubHksIG9wdGlvbnMuY2hhcnNldCwgc2lkZUNoYW5uZWwpKTtcbiAgICB9XG4gICAgY29uc3Qgam9pbmVkID0ga2V5cy5qb2luKG9wdGlvbnMuZGVsaW1pdGVyKTtcbiAgICBsZXQgcHJlZml4ID0gb3B0aW9ucy5hZGRRdWVyeVByZWZpeCA9PT0gdHJ1ZSA/ICc/JyA6ICcnO1xuICAgIGlmIChvcHRpb25zLmNoYXJzZXRTZW50aW5lbCkge1xuICAgICAgICBpZiAob3B0aW9ucy5jaGFyc2V0ID09PSAnaXNvLTg4NTktMScpIHtcbiAgICAgICAgICAgIC8vIGVuY29kZVVSSUNvbXBvbmVudCgnJiMxMDAwMzsnKSwgdGhlIFwibnVtZXJpYyBlbnRpdHlcIiByZXByZXNlbnRhdGlvbiBvZiBhIGNoZWNrbWFya1xuICAgICAgICAgICAgcHJlZml4ICs9ICd1dGY4PSUyNiUyMzEwMDAzJTNCJic7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBlbmNvZGVVUklDb21wb25lbnQoJ+KckycpXG4gICAgICAgICAgICBwcmVmaXggKz0gJ3V0Zjg9JUUyJTlDJTkzJic7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGpvaW5lZC5sZW5ndGggPiAwID8gcHJlZml4ICsgam9pbmVkIDogJyc7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdHJpbmdpZnkubWpzLm1hcCIsImltcG9ydCB7IFJGQzE3MzggfSBmcm9tIFwiLi9mb3JtYXRzLm1qc1wiO1xuY29uc3QgaGFzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbmNvbnN0IGlzX2FycmF5ID0gQXJyYXkuaXNBcnJheTtcbmNvbnN0IGhleF90YWJsZSA9ICgoKSA9PiB7XG4gICAgY29uc3QgYXJyYXkgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI1NjsgKytpKSB7XG4gICAgICAgIGFycmF5LnB1c2goJyUnICsgKChpIDwgMTYgPyAnMCcgOiAnJykgKyBpLnRvU3RyaW5nKDE2KSkudG9VcHBlckNhc2UoKSk7XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbn0pKCk7XG5mdW5jdGlvbiBjb21wYWN0X3F1ZXVlKHF1ZXVlKSB7XG4gICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IHF1ZXVlLnBvcCgpO1xuICAgICAgICBpZiAoIWl0ZW0pXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgY29uc3Qgb2JqID0gaXRlbS5vYmpbaXRlbS5wcm9wXTtcbiAgICAgICAgaWYgKGlzX2FycmF5KG9iaikpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBhY3RlZCA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBvYmoubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9ialtqXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGFjdGVkLnB1c2gob2JqW2pdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBpdGVtLm9ialtpdGVtLnByb3BdID0gY29tcGFjdGVkO1xuICAgICAgICB9XG4gICAgfVxufVxuZnVuY3Rpb24gYXJyYXlfdG9fb2JqZWN0KHNvdXJjZSwgb3B0aW9ucykge1xuICAgIGNvbnN0IG9iaiA9IG9wdGlvbnMgJiYgb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2UubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzb3VyY2VbaV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvYmpbaV0gPSBzb3VyY2VbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZSh0YXJnZXQsIHNvdXJjZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChpc19hcnJheSh0YXJnZXQpKSB7XG4gICAgICAgICAgICB0YXJnZXQucHVzaChzb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRhcmdldCAmJiB0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaWYgKChvcHRpb25zICYmIChvcHRpb25zLnBsYWluT2JqZWN0cyB8fCBvcHRpb25zLmFsbG93UHJvdG90eXBlcykpIHx8XG4gICAgICAgICAgICAgICAgIWhhcy5jYWxsKE9iamVjdC5wcm90b3R5cGUsIHNvdXJjZSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbc291cmNlXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gW3RhcmdldCwgc291cmNlXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cbiAgICBpZiAoIXRhcmdldCB8fCB0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gW3RhcmdldF0uY29uY2F0KHNvdXJjZSk7XG4gICAgfVxuICAgIGxldCBtZXJnZVRhcmdldCA9IHRhcmdldDtcbiAgICBpZiAoaXNfYXJyYXkodGFyZ2V0KSAmJiAhaXNfYXJyYXkoc291cmNlKSkge1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIG1lcmdlVGFyZ2V0ID0gYXJyYXlfdG9fb2JqZWN0KHRhcmdldCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGlmIChpc19hcnJheSh0YXJnZXQpICYmIGlzX2FycmF5KHNvdXJjZSkpIHtcbiAgICAgICAgc291cmNlLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICAgICAgICAgIGlmIChoYXMuY2FsbCh0YXJnZXQsIGkpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0SXRlbSA9IHRhcmdldFtpXTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SXRlbSAmJiB0eXBlb2YgdGFyZ2V0SXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2ldID0gbWVyZ2UodGFyZ2V0SXRlbSwgaXRlbSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQucHVzaChpdGVtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbaV0gPSBpdGVtO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHNvdXJjZSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHNvdXJjZVtrZXldO1xuICAgICAgICBpZiAoaGFzLmNhbGwoYWNjLCBrZXkpKSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IG1lcmdlKGFjY1trZXldLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhY2M7XG4gICAgfSwgbWVyZ2VUYXJnZXQpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGFzc2lnbl9zaW5nbGVfc291cmNlKHRhcmdldCwgc291cmNlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHNvdXJjZSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgICAgICBhY2Nba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHRhcmdldCk7XG59XG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlKHN0ciwgXywgY2hhcnNldCkge1xuICAgIGNvbnN0IHN0cldpdGhvdXRQbHVzID0gc3RyLnJlcGxhY2UoL1xcKy9nLCAnICcpO1xuICAgIGlmIChjaGFyc2V0ID09PSAnaXNvLTg4NTktMScpIHtcbiAgICAgICAgLy8gdW5lc2NhcGUgbmV2ZXIgdGhyb3dzLCBubyB0cnkuLi5jYXRjaCBuZWVkZWQ6XG4gICAgICAgIHJldHVybiBzdHJXaXRob3V0UGx1cy5yZXBsYWNlKC8lWzAtOWEtZl17Mn0vZ2ksIHVuZXNjYXBlKTtcbiAgICB9XG4gICAgLy8gdXRmLThcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cldpdGhvdXRQbHVzKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHN0cldpdGhvdXRQbHVzO1xuICAgIH1cbn1cbmNvbnN0IGxpbWl0ID0gMTAyNDtcbmV4cG9ydCBjb25zdCBlbmNvZGUgPSAoc3RyLCBfZGVmYXVsdEVuY29kZXIsIGNoYXJzZXQsIF9raW5kLCBmb3JtYXQpID0+IHtcbiAgICAvLyBUaGlzIGNvZGUgd2FzIG9yaWdpbmFsbHkgd3JpdHRlbiBieSBCcmlhbiBXaGl0ZSBmb3IgdGhlIGlvLmpzIGNvcmUgcXVlcnlzdHJpbmcgbGlicmFyeS5cbiAgICAvLyBJdCBoYXMgYmVlbiBhZGFwdGVkIGhlcmUgZm9yIHN0cmljdGVyIGFkaGVyZW5jZSB0byBSRkMgMzk4NlxuICAgIGlmIChzdHIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIGxldCBzdHJpbmcgPSBzdHI7XG4gICAgaWYgKHR5cGVvZiBzdHIgPT09ICdzeW1ib2wnKSB7XG4gICAgICAgIHN0cmluZyA9IFN5bWJvbC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdHIpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xuICAgICAgICBzdHJpbmcgPSBTdHJpbmcoc3RyKTtcbiAgICB9XG4gICAgaWYgKGNoYXJzZXQgPT09ICdpc28tODg1OS0xJykge1xuICAgICAgICByZXR1cm4gZXNjYXBlKHN0cmluZykucmVwbGFjZSgvJXVbMC05YS1mXXs0fS9naSwgZnVuY3Rpb24gKCQwKSB7XG4gICAgICAgICAgICByZXR1cm4gJyUyNiUyMycgKyBwYXJzZUludCgkMC5zbGljZSgyKSwgMTYpICsgJyUzQic7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsZXQgb3V0ID0gJyc7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBzdHJpbmcubGVuZ3RoOyBqICs9IGxpbWl0KSB7XG4gICAgICAgIGNvbnN0IHNlZ21lbnQgPSBzdHJpbmcubGVuZ3RoID49IGxpbWl0ID8gc3RyaW5nLnNsaWNlKGosIGogKyBsaW1pdCkgOiBzdHJpbmc7XG4gICAgICAgIGNvbnN0IGFyciA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnQubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBjID0gc2VnbWVudC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgaWYgKGMgPT09IDB4MmQgfHwgLy8gLVxuICAgICAgICAgICAgICAgIGMgPT09IDB4MmUgfHwgLy8gLlxuICAgICAgICAgICAgICAgIGMgPT09IDB4NWYgfHwgLy8gX1xuICAgICAgICAgICAgICAgIGMgPT09IDB4N2UgfHwgLy8gflxuICAgICAgICAgICAgICAgIChjID49IDB4MzAgJiYgYyA8PSAweDM5KSB8fCAvLyAwLTlcbiAgICAgICAgICAgICAgICAoYyA+PSAweDQxICYmIGMgPD0gMHg1YSkgfHwgLy8gYS16XG4gICAgICAgICAgICAgICAgKGMgPj0gMHg2MSAmJiBjIDw9IDB4N2EpIHx8IC8vIEEtWlxuICAgICAgICAgICAgICAgIChmb3JtYXQgPT09IFJGQzE3MzggJiYgKGMgPT09IDB4MjggfHwgYyA9PT0gMHgyOSkpIC8vICggKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgYXJyW2Fyci5sZW5ndGhdID0gc2VnbWVudC5jaGFyQXQoaSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYyA8IDB4ODApIHtcbiAgICAgICAgICAgICAgICBhcnJbYXJyLmxlbmd0aF0gPSBoZXhfdGFibGVbY107XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYyA8IDB4ODAwKSB7XG4gICAgICAgICAgICAgICAgYXJyW2Fyci5sZW5ndGhdID0gaGV4X3RhYmxlWzB4YzAgfCAoYyA+PiA2KV0gKyBoZXhfdGFibGVbMHg4MCB8IChjICYgMHgzZildO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGMgPCAweGQ4MDAgfHwgYyA+PSAweGUwMDApIHtcbiAgICAgICAgICAgICAgICBhcnJbYXJyLmxlbmd0aF0gPVxuICAgICAgICAgICAgICAgICAgICBoZXhfdGFibGVbMHhlMCB8IChjID4+IDEyKV0gKyBoZXhfdGFibGVbMHg4MCB8ICgoYyA+PiA2KSAmIDB4M2YpXSArIGhleF90YWJsZVsweDgwIHwgKGMgJiAweDNmKV07XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgICBjID0gMHgxMDAwMCArICgoKGMgJiAweDNmZikgPDwgMTApIHwgKHNlZ21lbnQuY2hhckNvZGVBdChpKSAmIDB4M2ZmKSk7XG4gICAgICAgICAgICBhcnJbYXJyLmxlbmd0aF0gPVxuICAgICAgICAgICAgICAgIGhleF90YWJsZVsweGYwIHwgKGMgPj4gMTgpXSArXG4gICAgICAgICAgICAgICAgICAgIGhleF90YWJsZVsweDgwIHwgKChjID4+IDEyKSAmIDB4M2YpXSArXG4gICAgICAgICAgICAgICAgICAgIGhleF90YWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzZildICtcbiAgICAgICAgICAgICAgICAgICAgaGV4X3RhYmxlWzB4ODAgfCAoYyAmIDB4M2YpXTtcbiAgICAgICAgfVxuICAgICAgICBvdXQgKz0gYXJyLmpvaW4oJycpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0O1xufTtcbmV4cG9ydCBmdW5jdGlvbiBjb21wYWN0KHZhbHVlKSB7XG4gICAgY29uc3QgcXVldWUgPSBbeyBvYmo6IHsgbzogdmFsdWUgfSwgcHJvcDogJ28nIH1dO1xuICAgIGNvbnN0IHJlZnMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZVtpXTtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBjb25zdCBvYmogPSBpdGVtLm9ialtpdGVtLnByb3BdO1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBrZXlzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBrZXlzW2pdO1xuICAgICAgICAgICAgY29uc3QgdmFsID0gb2JqW2tleV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ29iamVjdCcgJiYgdmFsICE9PSBudWxsICYmIHJlZnMuaW5kZXhPZih2YWwpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIHF1ZXVlLnB1c2goeyBvYmo6IG9iaiwgcHJvcDoga2V5IH0pO1xuICAgICAgICAgICAgICAgIHJlZnMucHVzaCh2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGNvbXBhY3RfcXVldWUocXVldWUpO1xuICAgIHJldHVybiB2YWx1ZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc19yZWdleHAob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc19idWZmZXIob2JqKSB7XG4gICAgaWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gISEob2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gY29tYmluZShhLCBiKSB7XG4gICAgcmV0dXJuIFtdLmNvbmNhdChhLCBiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtYXliZV9tYXAodmFsLCBmbikge1xuICAgIGlmIChpc19hcnJheSh2YWwpKSB7XG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgbWFwcGVkLnB1c2goZm4odmFsW2ldKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICB9XG4gICAgcmV0dXJuIGZuKHZhbCk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD11dGlscy5tanMubWFwIiwiLyoqXG4gKiBNb3N0IGJyb3dzZXJzIGRvbid0IHlldCBoYXZlIGFzeW5jIGl0ZXJhYmxlIHN1cHBvcnQgZm9yIFJlYWRhYmxlU3RyZWFtLFxuICogYW5kIE5vZGUgaGFzIGEgdmVyeSBkaWZmZXJlbnQgd2F5IG9mIHJlYWRpbmcgYnl0ZXMgZnJvbSBpdHMgXCJSZWFkYWJsZVN0cmVhbVwiLlxuICpcbiAqIFRoaXMgcG9seWZpbGwgd2FzIHB1bGxlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9NYXR0aWFzQnVlbGVucy93ZWItc3RyZWFtcy1wb2x5ZmlsbC9wdWxsLzEyMiNpc3N1ZWNvbW1lbnQtMTYyNzM1NDQ5MFxuICovXG5leHBvcnQgZnVuY3Rpb24gUmVhZGFibGVTdHJlYW1Ub0FzeW5jSXRlcmFibGUoc3RyZWFtKSB7XG4gICAgaWYgKHN0cmVhbVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0pXG4gICAgICAgIHJldHVybiBzdHJlYW07XG4gICAgY29uc3QgcmVhZGVyID0gc3RyZWFtLmdldFJlYWRlcigpO1xuICAgIHJldHVybiB7XG4gICAgICAgIGFzeW5jIG5leHQoKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdD8uZG9uZSlcbiAgICAgICAgICAgICAgICAgICAgcmVhZGVyLnJlbGVhc2VMb2NrKCk7IC8vIHJlbGVhc2UgbG9jayB3aGVuIHN0cmVhbSBiZWNvbWVzIGNsb3NlZFxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZWxlYXNlTG9jaygpOyAvLyByZWxlYXNlIGxvY2sgd2hlbiBzdHJlYW0gYmVjb21lcyBlcnJvcmVkXG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgcmV0dXJuKCkge1xuICAgICAgICAgICAgY29uc3QgY2FuY2VsUHJvbWlzZSA9IHJlYWRlci5jYW5jZWwoKTtcbiAgICAgICAgICAgIHJlYWRlci5yZWxlYXNlTG9jaygpO1xuICAgICAgICAgICAgYXdhaXQgY2FuY2VsUHJvbWlzZTtcbiAgICAgICAgICAgIHJldHVybiB7IGRvbmU6IHRydWUsIHZhbHVlOiB1bmRlZmluZWQgfTtcbiAgICAgICAgfSxcbiAgICAgICAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuICAgIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdHJlYW0tdXRpbHMubWpzLm1hcCIsInZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XG59O1xudmFyIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxDb250ZW50LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbE1lc3NhZ2UsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfY2FsY3VsYXRlVG90YWxVc2FnZSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfdmFsaWRhdGVQYXJhbXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3N0cmluZ2lmeUZ1bmN0aW9uQ2FsbFJlc3VsdDtcbmltcG9ydCB7IE9wZW5BSUVycm9yIH0gZnJvbSBcIi4uL2Vycm9yLm1qc1wiO1xuaW1wb3J0IHsgaXNSdW5uYWJsZUZ1bmN0aW9uV2l0aFBhcnNlLCB9IGZyb20gXCIuL1J1bm5hYmxlRnVuY3Rpb24ubWpzXCI7XG5pbXBvcnQgeyBpc0Fzc2lzdGFudE1lc3NhZ2UsIGlzRnVuY3Rpb25NZXNzYWdlLCBpc1Rvb2xNZXNzYWdlIH0gZnJvbSBcIi4vY2hhdENvbXBsZXRpb25VdGlscy5tanNcIjtcbmltcG9ydCB7IEV2ZW50U3RyZWFtIH0gZnJvbSBcIi4vRXZlbnRTdHJlYW0ubWpzXCI7XG5pbXBvcnQgeyBpc0F1dG9QYXJzYWJsZVRvb2wsIHBhcnNlQ2hhdENvbXBsZXRpb24gfSBmcm9tIFwiLi4vbGliL3BhcnNlci5tanNcIjtcbmNvbnN0IERFRkFVTFRfTUFYX0NIQVRfQ09NUExFVElPTlMgPSAxMDtcbmV4cG9ydCBjbGFzcyBBYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyIGV4dGVuZHMgRXZlbnRTdHJlYW0ge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMuYWRkKHRoaXMpO1xuICAgICAgICB0aGlzLl9jaGF0Q29tcGxldGlvbnMgPSBbXTtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IFtdO1xuICAgIH1cbiAgICBfYWRkQ2hhdENvbXBsZXRpb24oY2hhdENvbXBsZXRpb24pIHtcbiAgICAgICAgdGhpcy5fY2hhdENvbXBsZXRpb25zLnB1c2goY2hhdENvbXBsZXRpb24pO1xuICAgICAgICB0aGlzLl9lbWl0KCdjaGF0Q29tcGxldGlvbicsIGNoYXRDb21wbGV0aW9uKTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNoYXRDb21wbGV0aW9uLmNob2ljZXNbMF0/Lm1lc3NhZ2U7XG4gICAgICAgIGlmIChtZXNzYWdlKVxuICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGNoYXRDb21wbGV0aW9uO1xuICAgIH1cbiAgICBfYWRkTWVzc2FnZShtZXNzYWdlLCBlbWl0ID0gdHJ1ZSkge1xuICAgICAgICBpZiAoISgnY29udGVudCcgaW4gbWVzc2FnZSkpXG4gICAgICAgICAgICBtZXNzYWdlLmNvbnRlbnQgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgIGlmIChlbWl0KSB7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdtZXNzYWdlJywgbWVzc2FnZSk7XG4gICAgICAgICAgICBpZiAoKGlzRnVuY3Rpb25NZXNzYWdlKG1lc3NhZ2UpIHx8IGlzVG9vbE1lc3NhZ2UobWVzc2FnZSkpICYmIG1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICAgICAgICAgIC8vIE5vdGUsIHRoaXMgYXNzdW1lcyB0aGF0IHtyb2xlOiAndG9vbCcsIGNvbnRlbnQ6IOKApn0gaXMgYWx3YXlzIHRoZSByZXN1bHQgb2YgYSBjYWxsIG9mIHRvb2wgb2YgdHlwZT1mdW5jdGlvbi5cbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdmdW5jdGlvbkNhbGxSZXN1bHQnLCBtZXNzYWdlLmNvbnRlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNBc3Npc3RhbnRNZXNzYWdlKG1lc3NhZ2UpICYmIG1lc3NhZ2UuZnVuY3Rpb25fY2FsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2Z1bmN0aW9uQ2FsbCcsIG1lc3NhZ2UuZnVuY3Rpb25fY2FsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0Fzc2lzdGFudE1lc3NhZ2UobWVzc2FnZSkgJiYgbWVzc2FnZS50b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0b29sX2NhbGwgb2YgbWVzc2FnZS50b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b29sX2NhbGwudHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnZnVuY3Rpb25DYWxsJywgdG9vbF9jYWxsLmZ1bmN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBmaW5hbCBDaGF0Q29tcGxldGlvbiwgb3IgcmVqZWN0c1xuICAgICAqIGlmIGFuIGVycm9yIG9jY3VycmVkIG9yIHRoZSBzdHJlYW0gZW5kZWQgcHJlbWF0dXJlbHkgd2l0aG91dCBwcm9kdWNpbmcgYSBDaGF0Q29tcGxldGlvbi5cbiAgICAgKi9cbiAgICBhc3luYyBmaW5hbENoYXRDb21wbGV0aW9uKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgY29uc3QgY29tcGxldGlvbiA9IHRoaXMuX2NoYXRDb21wbGV0aW9uc1t0aGlzLl9jaGF0Q29tcGxldGlvbnMubGVuZ3RoIC0gMV07XG4gICAgICAgIGlmICghY29tcGxldGlvbilcbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcignc3RyZWFtIGVuZGVkIHdpdGhvdXQgcHJvZHVjaW5nIGEgQ2hhdENvbXBsZXRpb24nKTtcbiAgICAgICAgcmV0dXJuIGNvbXBsZXRpb247XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGNvbnRlbnQgb2YgdGhlIGZpbmFsIENoYXRDb21wbGV0aW9uTWVzc2FnZSwgb3IgcmVqZWN0c1xuICAgICAqIGlmIGFuIGVycm9yIG9jY3VycmVkIG9yIHRoZSBzdHJlYW0gZW5kZWQgcHJlbWF0dXJlbHkgd2l0aG91dCBwcm9kdWNpbmcgYSBDaGF0Q29tcGxldGlvbk1lc3NhZ2UuXG4gICAgICovXG4gICAgYXN5bmMgZmluYWxDb250ZW50KCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxDb250ZW50KS5jYWxsKHRoaXMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSB0aGUgZmluYWwgYXNzaXN0YW50IENoYXRDb21wbGV0aW9uTWVzc2FnZSByZXNwb25zZSxcbiAgICAgKiBvciByZWplY3RzIGlmIGFuIGVycm9yIG9jY3VycmVkIG9yIHRoZSBzdHJlYW0gZW5kZWQgcHJlbWF0dXJlbHkgd2l0aG91dCBwcm9kdWNpbmcgYSBDaGF0Q29tcGxldGlvbk1lc3NhZ2UuXG4gICAgICovXG4gICAgYXN5bmMgZmluYWxNZXNzYWdlKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxNZXNzYWdlKS5jYWxsKHRoaXMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBjb250ZW50IG9mIHRoZSBmaW5hbCBGdW5jdGlvbkNhbGwsIG9yIHJlamVjdHNcbiAgICAgKiBpZiBhbiBlcnJvciBvY2N1cnJlZCBvciB0aGUgc3RyZWFtIGVuZGVkIHByZW1hdHVyZWx5IHdpdGhvdXQgcHJvZHVjaW5nIGEgQ2hhdENvbXBsZXRpb25NZXNzYWdlLlxuICAgICAqL1xuICAgIGFzeW5jIGZpbmFsRnVuY3Rpb25DYWxsKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGwpLmNhbGwodGhpcyk7XG4gICAgfVxuICAgIGFzeW5jIGZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0KCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGxSZXN1bHQpLmNhbGwodGhpcyk7XG4gICAgfVxuICAgIGFzeW5jIHRvdGFsVXNhZ2UoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9jYWxjdWxhdGVUb3RhbFVzYWdlKS5jYWxsKHRoaXMpO1xuICAgIH1cbiAgICBhbGxDaGF0Q29tcGxldGlvbnMoKSB7XG4gICAgICAgIHJldHVybiBbLi4udGhpcy5fY2hhdENvbXBsZXRpb25zXTtcbiAgICB9XG4gICAgX2VtaXRGaW5hbCgpIHtcbiAgICAgICAgY29uc3QgY29tcGxldGlvbiA9IHRoaXMuX2NoYXRDb21wbGV0aW9uc1t0aGlzLl9jaGF0Q29tcGxldGlvbnMubGVuZ3RoIC0gMV07XG4gICAgICAgIGlmIChjb21wbGV0aW9uKVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZmluYWxDaGF0Q29tcGxldGlvbicsIGNvbXBsZXRpb24pO1xuICAgICAgICBjb25zdCBmaW5hbE1lc3NhZ2UgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsTWVzc2FnZSkuY2FsbCh0aGlzKTtcbiAgICAgICAgaWYgKGZpbmFsTWVzc2FnZSlcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ZpbmFsTWVzc2FnZScsIGZpbmFsTWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IGZpbmFsQ29udGVudCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxDb250ZW50KS5jYWxsKHRoaXMpO1xuICAgICAgICBpZiAoZmluYWxDb250ZW50KVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZmluYWxDb250ZW50JywgZmluYWxDb250ZW50KTtcbiAgICAgICAgY29uc3QgZmluYWxGdW5jdGlvbkNhbGwgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsKS5jYWxsKHRoaXMpO1xuICAgICAgICBpZiAoZmluYWxGdW5jdGlvbkNhbGwpXG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdmaW5hbEZ1bmN0aW9uQ2FsbCcsIGZpbmFsRnVuY3Rpb25DYWxsKTtcbiAgICAgICAgY29uc3QgZmluYWxGdW5jdGlvbkNhbGxSZXN1bHQgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0KS5jYWxsKHRoaXMpO1xuICAgICAgICBpZiAoZmluYWxGdW5jdGlvbkNhbGxSZXN1bHQgIT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0JywgZmluYWxGdW5jdGlvbkNhbGxSZXN1bHQpO1xuICAgICAgICBpZiAodGhpcy5fY2hhdENvbXBsZXRpb25zLnNvbWUoKGMpID0+IGMudXNhZ2UpKSB7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCd0b3RhbFVzYWdlJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9jYWxjdWxhdGVUb3RhbFVzYWdlKS5jYWxsKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBfY3JlYXRlQ2hhdENvbXBsZXRpb24oY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl92YWxpZGF0ZVBhcmFtcykuY2FsbCh0aGlzLCBwYXJhbXMpO1xuICAgICAgICBjb25zdCBjaGF0Q29tcGxldGlvbiA9IGF3YWl0IGNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7IC4uLnBhcmFtcywgc3RyZWFtOiBmYWxzZSB9LCB7IC4uLm9wdGlvbnMsIHNpZ25hbDogdGhpcy5jb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGF0Q29tcGxldGlvbihwYXJzZUNoYXRDb21wbGV0aW9uKGNoYXRDb21wbGV0aW9uLCBwYXJhbXMpKTtcbiAgICB9XG4gICAgYXN5bmMgX3J1bkNoYXRDb21wbGV0aW9uKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGZvciAoY29uc3QgbWVzc2FnZSBvZiBwYXJhbXMubWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UobWVzc2FnZSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLl9jcmVhdGVDaGF0Q29tcGxldGlvbihjbGllbnQsIHBhcmFtcywgb3B0aW9ucyk7XG4gICAgfVxuICAgIGFzeW5jIF9ydW5GdW5jdGlvbnMoY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgcm9sZSA9ICdmdW5jdGlvbic7XG4gICAgICAgIGNvbnN0IHsgZnVuY3Rpb25fY2FsbCA9ICdhdXRvJywgc3RyZWFtLCAuLi5yZXN0UGFyYW1zIH0gPSBwYXJhbXM7XG4gICAgICAgIGNvbnN0IHNpbmdsZUZ1bmN0aW9uVG9DYWxsID0gdHlwZW9mIGZ1bmN0aW9uX2NhbGwgIT09ICdzdHJpbmcnICYmIGZ1bmN0aW9uX2NhbGw/Lm5hbWU7XG4gICAgICAgIGNvbnN0IHsgbWF4Q2hhdENvbXBsZXRpb25zID0gREVGQVVMVF9NQVhfQ0hBVF9DT01QTEVUSU9OUyB9ID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgY29uc3QgZnVuY3Rpb25zQnlOYW1lID0ge307XG4gICAgICAgIGZvciAoY29uc3QgZiBvZiBwYXJhbXMuZnVuY3Rpb25zKSB7XG4gICAgICAgICAgICBmdW5jdGlvbnNCeU5hbWVbZi5uYW1lIHx8IGYuZnVuY3Rpb24ubmFtZV0gPSBmO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9ucyA9IHBhcmFtcy5mdW5jdGlvbnMubWFwKChmKSA9PiAoe1xuICAgICAgICAgICAgbmFtZTogZi5uYW1lIHx8IGYuZnVuY3Rpb24ubmFtZSxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IGYucGFyYW1ldGVycyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBmLmRlc2NyaXB0aW9uLFxuICAgICAgICB9KSk7XG4gICAgICAgIGZvciAoY29uc3QgbWVzc2FnZSBvZiBwYXJhbXMubWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UobWVzc2FnZSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4Q2hhdENvbXBsZXRpb25zOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXRDb21wbGV0aW9uID0gYXdhaXQgdGhpcy5fY3JlYXRlQ2hhdENvbXBsZXRpb24oY2xpZW50LCB7XG4gICAgICAgICAgICAgICAgLi4ucmVzdFBhcmFtcyxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbl9jYWxsLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9ucyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWy4uLnRoaXMubWVzc2FnZXNdLFxuICAgICAgICAgICAgfSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gY2hhdENvbXBsZXRpb24uY2hvaWNlc1swXT8ubWVzc2FnZTtcbiAgICAgICAgICAgIGlmICghbWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBtZXNzYWdlIGluIENoYXRDb21wbGV0aW9uIHJlc3BvbnNlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UuZnVuY3Rpb25fY2FsbClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBjb25zdCB7IG5hbWUsIGFyZ3VtZW50czogYXJncyB9ID0gbWVzc2FnZS5mdW5jdGlvbl9jYWxsO1xuICAgICAgICAgICAgY29uc3QgZm4gPSBmdW5jdGlvbnNCeU5hbWVbbmFtZV07XG4gICAgICAgICAgICBpZiAoIWZuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGBJbnZhbGlkIGZ1bmN0aW9uX2NhbGw6ICR7SlNPTi5zdHJpbmdpZnkobmFtZSl9LiBBdmFpbGFibGUgb3B0aW9ucyBhcmU6ICR7ZnVuY3Rpb25zXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoKGYpID0+IEpTT04uc3RyaW5naWZ5KGYubmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfS4gUGxlYXNlIHRyeSBhZ2FpbmA7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIG5hbWUsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzaW5nbGVGdW5jdGlvblRvQ2FsbCAmJiBzaW5nbGVGdW5jdGlvblRvQ2FsbCAhPT0gbmFtZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBgSW52YWxpZCBmdW5jdGlvbl9jYWxsOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfS4gJHtKU09OLnN0cmluZ2lmeShzaW5nbGVGdW5jdGlvblRvQ2FsbCl9IHJlcXVlc3RlZC4gUGxlYXNlIHRyeSBhZ2FpbmA7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIG5hbWUsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcGFyc2VkO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwYXJzZWQgPSBpc1J1bm5hYmxlRnVuY3Rpb25XaXRoUGFyc2UoZm4pID8gYXdhaXQgZm4ucGFyc2UoYXJncykgOiBhcmdzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgICAgIHJvbGUsXG4gICAgICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgaXQgY2FuJ3QgcnVsZSBvdXQgYG5ldmVyYCB0eXBlLlxuICAgICAgICAgICAgY29uc3QgcmF3Q29udGVudCA9IGF3YWl0IGZuLmZ1bmN0aW9uKHBhcnNlZCwgdGhpcyk7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9zdHJpbmdpZnlGdW5jdGlvbkNhbGxSZXN1bHQpLmNhbGwodGhpcywgcmF3Q29udGVudCk7XG4gICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgbmFtZSwgY29udGVudCB9KTtcbiAgICAgICAgICAgIGlmIChzaW5nbGVGdW5jdGlvblRvQ2FsbClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgX3J1blRvb2xzKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJvbGUgPSAndG9vbCc7XG4gICAgICAgIGNvbnN0IHsgdG9vbF9jaG9pY2UgPSAnYXV0bycsIHN0cmVhbSwgLi4ucmVzdFBhcmFtcyB9ID0gcGFyYW1zO1xuICAgICAgICBjb25zdCBzaW5nbGVGdW5jdGlvblRvQ2FsbCA9IHR5cGVvZiB0b29sX2Nob2ljZSAhPT0gJ3N0cmluZycgJiYgdG9vbF9jaG9pY2U/LmZ1bmN0aW9uPy5uYW1lO1xuICAgICAgICBjb25zdCB7IG1heENoYXRDb21wbGV0aW9ucyA9IERFRkFVTFRfTUFYX0NIQVRfQ09NUExFVElPTlMgfSA9IG9wdGlvbnMgfHwge307XG4gICAgICAgIC8vIFRPRE8oc29tZWRheSk6IGNsZWFuIHRoaXMgbG9naWMgdXBcbiAgICAgICAgY29uc3QgaW5wdXRUb29scyA9IHBhcmFtcy50b29scy5tYXAoKHRvb2wpID0+IHtcbiAgICAgICAgICAgIGlmIChpc0F1dG9QYXJzYWJsZVRvb2wodG9vbCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRvb2wuJGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcignVG9vbCBnaXZlbiB0byBgLnJ1blRvb2xzKClgIHRoYXQgZG9lcyBub3QgaGF2ZSBhbiBhc3NvY2lhdGVkIGZ1bmN0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbjogdG9vbC4kY2FsbGJhY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0b29sLmZ1bmN0aW9uLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5mdW5jdGlvbi5kZXNjcmlwdGlvbiB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnM6IHRvb2wuZnVuY3Rpb24ucGFyYW1ldGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlOiB0b29sLiRwYXJzZVJhdyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmljdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRvb2w7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBmdW5jdGlvbnNCeU5hbWUgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBmIG9mIGlucHV0VG9vbHMpIHtcbiAgICAgICAgICAgIGlmIChmLnR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbnNCeU5hbWVbZi5mdW5jdGlvbi5uYW1lIHx8IGYuZnVuY3Rpb24uZnVuY3Rpb24ubmFtZV0gPSBmLmZ1bmN0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRvb2xzID0gJ3Rvb2xzJyBpbiBwYXJhbXMgP1xuICAgICAgICAgICAgaW5wdXRUb29scy5tYXAoKHQpID0+IHQudHlwZSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdC5mdW5jdGlvbi5uYW1lIHx8IHQuZnVuY3Rpb24uZnVuY3Rpb24ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnM6IHQuZnVuY3Rpb24ucGFyYW1ldGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0LmZ1bmN0aW9uLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyaWN0OiB0LmZ1bmN0aW9uLnN0cmljdCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgOiB0KVxuICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgIGZvciAoY29uc3QgbWVzc2FnZSBvZiBwYXJhbXMubWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UobWVzc2FnZSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4Q2hhdENvbXBsZXRpb25zOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXRDb21wbGV0aW9uID0gYXdhaXQgdGhpcy5fY3JlYXRlQ2hhdENvbXBsZXRpb24oY2xpZW50LCB7XG4gICAgICAgICAgICAgICAgLi4ucmVzdFBhcmFtcyxcbiAgICAgICAgICAgICAgICB0b29sX2Nob2ljZSxcbiAgICAgICAgICAgICAgICB0b29scyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWy4uLnRoaXMubWVzc2FnZXNdLFxuICAgICAgICAgICAgfSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gY2hhdENvbXBsZXRpb24uY2hvaWNlc1swXT8ubWVzc2FnZTtcbiAgICAgICAgICAgIGlmICghbWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBtZXNzYWdlIGluIENoYXRDb21wbGV0aW9uIHJlc3BvbnNlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UudG9vbF9jYWxscz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sX2NhbGwgb2YgbWVzc2FnZS50b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRvb2xfY2FsbC50eXBlICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29sX2NhbGxfaWQgPSB0b29sX2NhbGwuaWQ7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBuYW1lLCBhcmd1bWVudHM6IGFyZ3MgfSA9IHRvb2xfY2FsbC5mdW5jdGlvbjtcbiAgICAgICAgICAgICAgICBjb25zdCBmbiA9IGZ1bmN0aW9uc0J5TmFtZVtuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIWZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBgSW52YWxpZCB0b29sX2NhbGw6ICR7SlNPTi5zdHJpbmdpZnkobmFtZSl9LiBBdmFpbGFibGUgb3B0aW9ucyBhcmU6ICR7T2JqZWN0LmtleXMoZnVuY3Rpb25zQnlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgobmFtZSkgPT4gSlNPTi5zdHJpbmdpZnkobmFtZSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX0uIFBsZWFzZSB0cnkgYWdhaW5gO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgdG9vbF9jYWxsX2lkLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoc2luZ2xlRnVuY3Rpb25Ub0NhbGwgJiYgc2luZ2xlRnVuY3Rpb25Ub0NhbGwgIT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGBJbnZhbGlkIHRvb2xfY2FsbDogJHtKU09OLnN0cmluZ2lmeShuYW1lKX0uICR7SlNPTi5zdHJpbmdpZnkoc2luZ2xlRnVuY3Rpb25Ub0NhbGwpfSByZXF1ZXN0ZWQuIFBsZWFzZSB0cnkgYWdhaW5gO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgdG9vbF9jYWxsX2lkLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IHBhcnNlZDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBwYXJzZWQgPSBpc1J1bm5hYmxlRnVuY3Rpb25XaXRoUGFyc2UoZm4pID8gYXdhaXQgZm4ucGFyc2UoYXJncykgOiBhcmdzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIHRvb2xfY2FsbF9pZCwgY29udGVudCB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgaXQgY2FuJ3QgcnVsZSBvdXQgYG5ldmVyYCB0eXBlLlxuICAgICAgICAgICAgICAgIGNvbnN0IHJhd0NvbnRlbnQgPSBhd2FpdCBmbi5mdW5jdGlvbihwYXJzZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3N0cmluZ2lmeUZ1bmN0aW9uQ2FsbFJlc3VsdCkuY2FsbCh0aGlzLCByYXdDb250ZW50KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKHsgcm9sZSwgdG9vbF9jYWxsX2lkLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgICAgIGlmIChzaW5nbGVGdW5jdGlvblRvQ2FsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG59XG5fQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMgPSBuZXcgV2Vha1NldCgpLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbENvbnRlbnQgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbENvbnRlbnQoKSB7XG4gICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxNZXNzYWdlKS5jYWxsKHRoaXMpLmNvbnRlbnQgPz8gbnVsbDtcbn0sIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsTWVzc2FnZSA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsTWVzc2FnZSgpIHtcbiAgICBsZXQgaSA9IHRoaXMubWVzc2FnZXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0gPiAwKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VzW2ldO1xuICAgICAgICBpZiAoaXNBc3Npc3RhbnRNZXNzYWdlKG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICBjb25zdCB7IGZ1bmN0aW9uX2NhbGwsIC4uLnJlc3QgfSA9IG1lc3NhZ2U7XG4gICAgICAgICAgICAvLyBUT0RPOiBzdXBwb3J0IGF1ZGlvIGhlcmVcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IHtcbiAgICAgICAgICAgICAgICAuLi5yZXN0LFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2UuY29udGVudCA/PyBudWxsLFxuICAgICAgICAgICAgICAgIHJlZnVzYWw6IG1lc3NhZ2UucmVmdXNhbCA/PyBudWxsLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChmdW5jdGlvbl9jYWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0LmZ1bmN0aW9uX2NhbGwgPSBmdW5jdGlvbl9jYWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoJ3N0cmVhbSBlbmRlZCB3aXRob3V0IHByb2R1Y2luZyBhIENoYXRDb21wbGV0aW9uTWVzc2FnZSB3aXRoIHJvbGU9YXNzaXN0YW50Jyk7XG59LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbCA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsKCkge1xuICAgIGZvciAobGV0IGkgPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VzW2ldO1xuICAgICAgICBpZiAoaXNBc3Npc3RhbnRNZXNzYWdlKG1lc3NhZ2UpICYmIG1lc3NhZ2U/LmZ1bmN0aW9uX2NhbGwpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXNzYWdlLmZ1bmN0aW9uX2NhbGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzQXNzaXN0YW50TWVzc2FnZShtZXNzYWdlKSAmJiBtZXNzYWdlPy50b29sX2NhbGxzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXNzYWdlLnRvb2xfY2FsbHMuYXQoLTEpPy5mdW5jdGlvbjtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm47XG59LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0KCkge1xuICAgIGZvciAobGV0IGkgPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VzW2ldO1xuICAgICAgICBpZiAoaXNGdW5jdGlvbk1lc3NhZ2UobWVzc2FnZSkgJiYgbWVzc2FnZS5jb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXNzYWdlLmNvbnRlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzVG9vbE1lc3NhZ2UobWVzc2FnZSkgJiZcbiAgICAgICAgICAgIG1lc3NhZ2UuY29udGVudCAhPSBudWxsICYmXG4gICAgICAgICAgICB0eXBlb2YgbWVzc2FnZS5jb250ZW50ID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy5zb21lKCh4KSA9PiB4LnJvbGUgPT09ICdhc3Npc3RhbnQnICYmXG4gICAgICAgICAgICAgICAgeC50b29sX2NhbGxzPy5zb21lKCh5KSA9PiB5LnR5cGUgPT09ICdmdW5jdGlvbicgJiYgeS5pZCA9PT0gbWVzc2FnZS50b29sX2NhbGxfaWQpKSkge1xuICAgICAgICAgICAgcmV0dXJuIG1lc3NhZ2UuY29udGVudDtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm47XG59LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9jYWxjdWxhdGVUb3RhbFVzYWdlID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfY2FsY3VsYXRlVG90YWxVc2FnZSgpIHtcbiAgICBjb25zdCB0b3RhbCA9IHtcbiAgICAgICAgY29tcGxldGlvbl90b2tlbnM6IDAsXG4gICAgICAgIHByb21wdF90b2tlbnM6IDAsXG4gICAgICAgIHRvdGFsX3Rva2VuczogMCxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgeyB1c2FnZSB9IG9mIHRoaXMuX2NoYXRDb21wbGV0aW9ucykge1xuICAgICAgICBpZiAodXNhZ2UpIHtcbiAgICAgICAgICAgIHRvdGFsLmNvbXBsZXRpb25fdG9rZW5zICs9IHVzYWdlLmNvbXBsZXRpb25fdG9rZW5zO1xuICAgICAgICAgICAgdG90YWwucHJvbXB0X3Rva2VucyArPSB1c2FnZS5wcm9tcHRfdG9rZW5zO1xuICAgICAgICAgICAgdG90YWwudG90YWxfdG9rZW5zICs9IHVzYWdlLnRvdGFsX3Rva2VucztcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdG90YWw7XG59LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl92YWxpZGF0ZVBhcmFtcyA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3ZhbGlkYXRlUGFyYW1zKHBhcmFtcykge1xuICAgIGlmIChwYXJhbXMubiAhPSBudWxsICYmIHBhcmFtcy5uID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoJ0NoYXRDb21wbGV0aW9uIGNvbnZlbmllbmNlIGhlbHBlcnMgb25seSBzdXBwb3J0IG49MSBhdCB0aGlzIHRpbWUuIFRvIHVzZSBuPjEsIHBsZWFzZSB1c2UgY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoKSBkaXJlY3RseS4nKTtcbiAgICB9XG59LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9zdHJpbmdpZnlGdW5jdGlvbkNhbGxSZXN1bHQgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9zdHJpbmdpZnlGdW5jdGlvbkNhbGxSZXN1bHQocmF3Q29udGVudCkge1xuICAgIHJldHVybiAodHlwZW9mIHJhd0NvbnRlbnQgPT09ICdzdHJpbmcnID8gcmF3Q29udGVudFxuICAgICAgICA6IHJhd0NvbnRlbnQgPT09IHVuZGVmaW5lZCA/ICd1bmRlZmluZWQnXG4gICAgICAgICAgICA6IEpTT04uc3RyaW5naWZ5KHJhd0NvbnRlbnQpKTtcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyLm1qcy5tYXAiLCJ2YXIgX19jbGFzc1ByaXZhdGVGaWVsZEdldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZEdldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xufTtcbnZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcbn07XG52YXIgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIF9Bc3Npc3RhbnRTdHJlYW1fZXZlbnRzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90cywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4sIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleCwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGxJbmRleCwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudEV2ZW50LCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TbmFwc2hvdCwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU3RlcFNuYXBzaG90LCBfQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50LCBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlTWVzc2FnZSwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW5TdGVwLCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZUV2ZW50LCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVSdW5TdGVwLCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVNZXNzYWdlLCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVDb250ZW50LCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1bjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBTdHJlYW0gfSBmcm9tIFwiLi4vc3RyZWFtaW5nLm1qc1wiO1xuaW1wb3J0IHsgQVBJVXNlckFib3J0RXJyb3IsIE9wZW5BSUVycm9yIH0gZnJvbSBcIi4uL2Vycm9yLm1qc1wiO1xuaW1wb3J0IHsgRXZlbnRTdHJlYW0gfSBmcm9tIFwiLi9FdmVudFN0cmVhbS5tanNcIjtcbmV4cG9ydCBjbGFzcyBBc3Npc3RhbnRTdHJlYW0gZXh0ZW5kcyBFdmVudFN0cmVhbSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLmFkZCh0aGlzKTtcbiAgICAgICAgLy9UcmFjayBhbGwgZXZlbnRzIGluIGEgc2luZ2xlIGxpc3QgZm9yIHJlZmVyZW5jZVxuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2V2ZW50cy5zZXQodGhpcywgW10pO1xuICAgICAgICAvL1VzZWQgdG8gYWNjdW11bGF0ZSBkZWx0YXNcbiAgICAgICAgLy9XZSBhcmUgYWNjdW11bGF0aW5nIG1hbnkgdHlwZXMgc28gdGhlIHZhbHVlIGhlcmUgaXMgbm90IHN0cmljdFxuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMuc2V0KHRoaXMsIHt9KTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3RzLnNldCh0aGlzLCB7fSk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXguc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsSW5kZXguc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICAvL0ZvciBjdXJyZW50IHNuYXBzaG90IG1ldGhvZHNcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50RXZlbnQuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blNuYXBzaG90LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TdGVwU25hcHNob3Quc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgfVxuICAgIFsoX0Fzc2lzdGFudFN0cmVhbV9ldmVudHMgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdHMgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4gPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXggPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGxJbmRleCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50RXZlbnQgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TbmFwc2hvdCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blN0ZXBTbmFwc2hvdCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzID0gbmV3IFdlYWtTZXQoKSwgU3ltYm9sLmFzeW5jSXRlcmF0b3IpXSgpIHtcbiAgICAgICAgY29uc3QgcHVzaFF1ZXVlID0gW107XG4gICAgICAgIGNvbnN0IHJlYWRRdWV1ZSA9IFtdO1xuICAgICAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgICAgICAvL0NhdGNoIGFsbCBmb3IgcGFzc2luZyBhbG9uZyBhbGwgZXZlbnRzXG4gICAgICAgIHRoaXMub24oJ2V2ZW50JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZWFkZXIgPSByZWFkUXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgIGlmIChyZWFkZXIpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVzb2x2ZShldmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwdXNoUXVldWUucHVzaChldmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVhZGVyIG9mIHJlYWRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub24oJ2Fib3J0JywgKGVycikgPT4ge1xuICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlYWRlciBvZiByZWFkUXVldWUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlYWRlciBvZiByZWFkUXVldWUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuZXh0OiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwdXNoUXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHJlYWRRdWV1ZS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pKS50aGVuKChjaHVuaykgPT4gKGNodW5rID8geyB2YWx1ZTogY2h1bmssIGRvbmU6IGZhbHNlIH0gOiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IHB1c2hRdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBjaHVuaywgZG9uZTogZmFsc2UgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXR1cm46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgc3RhdGljIGZyb21SZWFkYWJsZVN0cmVhbShzdHJlYW0pIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IEFzc2lzdGFudFN0cmVhbSgpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX2Zyb21SZWFkYWJsZVN0cmVhbShzdHJlYW0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgYXN5bmMgX2Zyb21SZWFkYWJsZVN0cmVhbShyZWFkYWJsZVN0cmVhbSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gU3RyZWFtLmZyb21SZWFkYWJsZVN0cmVhbShyZWFkYWJsZVN0cmVhbSwgdGhpcy5jb250cm9sbGVyKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBldmVudCBvZiBzdHJlYW0pIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50KS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyZWFtLmNvbnRyb2xsZXIuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkUnVuKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgIH1cbiAgICB0b1JlYWRhYmxlU3RyZWFtKCkge1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBuZXcgU3RyZWFtKHRoaXNbU3ltYm9sLmFzeW5jSXRlcmF0b3JdLmJpbmQodGhpcyksIHRoaXMuY29udHJvbGxlcik7XG4gICAgICAgIHJldHVybiBzdHJlYW0udG9SZWFkYWJsZVN0cmVhbSgpO1xuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlVG9vbEFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVuSWQsIHJ1bnMsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQXNzaXN0YW50U3RyZWFtKCk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuVG9vbEFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVuSWQsIHJ1bnMsIHBhcmFtcywge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAnc3RyZWFtJyB9LFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIGFzeW5jIF9jcmVhdGVUb29sQXNzaXN0YW50U3RyZWFtKHJ1biwgdGhyZWFkSWQsIHJ1bklkLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHsgLi4ucGFyYW1zLCBzdHJlYW06IHRydWUgfTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgcnVuLnN1Ym1pdFRvb2xPdXRwdXRzKHRocmVhZElkLCBydW5JZCwgYm9keSwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIHNpZ25hbDogdGhpcy5jb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGV2ZW50IG9mIHN0cmVhbSkge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQpLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdHJlYW0uY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRSdW4oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGVUaHJlYWRBc3Npc3RhbnRTdHJlYW0ocGFyYW1zLCB0aHJlYWQsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IEFzc2lzdGFudFN0cmVhbSgpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3RocmVhZEFzc2lzdGFudFN0cmVhbShwYXJhbXMsIHRocmVhZCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAnc3RyZWFtJyB9LFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGVBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bnMsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQXNzaXN0YW50U3RyZWFtKCk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5zLCBwYXJhbXMsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3N0cmVhbScgfSxcbiAgICAgICAgfSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBjdXJyZW50RXZlbnQoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudEV2ZW50LCBcImZcIik7XG4gICAgfVxuICAgIGN1cnJlbnRSdW4oKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blNuYXBzaG90LCBcImZcIik7XG4gICAgfVxuICAgIGN1cnJlbnRNZXNzYWdlU25hcHNob3QoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIik7XG4gICAgfVxuICAgIGN1cnJlbnRSdW5TdGVwU25hcHNob3QoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blN0ZXBTbmFwc2hvdCwgXCJmXCIpO1xuICAgIH1cbiAgICBhc3luYyBmaW5hbFJ1blN0ZXBzKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKSk7XG4gICAgfVxuICAgIGFzeW5jIGZpbmFsTWVzc2FnZXMoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90cywgXCJmXCIpKTtcbiAgICB9XG4gICAgYXN5bmMgZmluYWxSdW4oKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZG9uZSgpO1xuICAgICAgICBpZiAoIV9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biwgXCJmXCIpKVxuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0ZpbmFsIHJ1biB3YXMgbm90IHJlY2VpdmVkLicpO1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLCBcImZcIik7XG4gICAgfVxuICAgIGFzeW5jIF9jcmVhdGVUaHJlYWRBc3Npc3RhbnRTdHJlYW0odGhyZWFkLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHsgLi4ucGFyYW1zLCBzdHJlYW06IHRydWUgfTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgdGhyZWFkLmNyZWF0ZUFuZFJ1bihib2R5LCB7IC4uLm9wdGlvbnMsIHNpZ25hbDogdGhpcy5jb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2Ygc3RyZWFtKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmVhbS5jb250cm9sbGVyLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZFJ1bihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICB9XG4gICAgYXN5bmMgX2NyZWF0ZUFzc2lzdGFudFN0cmVhbShydW4sIHRocmVhZElkLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHsgLi4ucGFyYW1zLCBzdHJlYW06IHRydWUgfTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgcnVuLmNyZWF0ZSh0aHJlYWRJZCwgYm9keSwgeyAuLi5vcHRpb25zLCBzaWduYWw6IHRoaXMuY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGV2ZW50IG9mIHN0cmVhbSkge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQpLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdHJlYW0uY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRSdW4oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgfVxuICAgIHN0YXRpYyBhY2N1bXVsYXRlRGVsdGEoYWNjLCBkZWx0YSkge1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGRlbHRhVmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRlbHRhKSkge1xuICAgICAgICAgICAgaWYgKCFhY2MuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGFjY1trZXldID0gZGVsdGFWYWx1ZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBhY2NWYWx1ZSA9IGFjY1trZXldO1xuICAgICAgICAgICAgaWYgKGFjY1ZhbHVlID09PSBudWxsIHx8IGFjY1ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBhY2Nba2V5XSA9IGRlbHRhVmFsdWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXZSBkb24ndCBhY2N1bXVsYXRlIHRoZXNlIHNwZWNpYWwgcHJvcGVydGllc1xuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ2luZGV4JyB8fCBrZXkgPT09ICd0eXBlJykge1xuICAgICAgICAgICAgICAgIGFjY1trZXldID0gZGVsdGFWYWx1ZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFR5cGUtc3BlY2lmaWMgYWNjdW11bGF0aW9uIGxvZ2ljXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFjY1ZhbHVlID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgZGVsdGFWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBhY2NWYWx1ZSArPSBkZWx0YVZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIGFjY1ZhbHVlID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgZGVsdGFWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICBhY2NWYWx1ZSArPSBkZWx0YVZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoQ29yZS5pc09iaihhY2NWYWx1ZSkgJiYgQ29yZS5pc09iaihkZWx0YVZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGFjY1ZhbHVlID0gdGhpcy5hY2N1bXVsYXRlRGVsdGEoYWNjVmFsdWUsIGRlbHRhVmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhY2NWYWx1ZSkgJiYgQXJyYXkuaXNBcnJheShkZWx0YVZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGlmIChhY2NWYWx1ZS5ldmVyeSgoeCkgPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB4ID09PSAnbnVtYmVyJykpIHtcbiAgICAgICAgICAgICAgICAgICAgYWNjVmFsdWUucHVzaCguLi5kZWx0YVZhbHVlKTsgLy8gVXNlIHNwcmVhZCBzeW50YXggZm9yIGVmZmljaWVudCBhZGRpdGlvblxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkZWx0YUVudHJ5IG9mIGRlbHRhVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFDb3JlLmlzT2JqKGRlbHRhRW50cnkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGFycmF5IGRlbHRhIGVudHJ5IHRvIGJlIGFuIG9iamVjdCBidXQgZ290OiAke2RlbHRhRW50cnl9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSBkZWx0YUVudHJ5WydpbmRleCddO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihkZWx0YUVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgYXJyYXkgZGVsdGEgZW50cnkgdG8gaGF2ZSBhbiBgaW5kZXhgIHByb3BlcnR5Jyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpbmRleCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYXJyYXkgZGVsdGEgZW50cnkgXFxgaW5kZXhcXGAgcHJvcGVydHkgdG8gYmUgYSBudW1iZXIgYnV0IGdvdCAke2luZGV4fWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFjY0VudHJ5ID0gYWNjVmFsdWVbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWNjRW50cnkgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjVmFsdWUucHVzaChkZWx0YUVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1ZhbHVlW2luZGV4XSA9IHRoaXMuYWNjdW11bGF0ZURlbHRhKGFjY0VudHJ5LCBkZWx0YUVudHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKGBVbmhhbmRsZWQgcmVjb3JkIHR5cGU6ICR7a2V5fSwgZGVsdGFWYWx1ZTogJHtkZWx0YVZhbHVlfSwgYWNjVmFsdWU6ICR7YWNjVmFsdWV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhY2Nba2V5XSA9IGFjY1ZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhY2M7XG4gICAgfVxuICAgIF9hZGRSdW4ocnVuKSB7XG4gICAgICAgIHJldHVybiBydW47XG4gICAgfVxuICAgIGFzeW5jIF90aHJlYWRBc3Npc3RhbnRTdHJlYW0ocGFyYW1zLCB0aHJlYWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX2NyZWF0ZVRocmVhZEFzc2lzdGFudFN0cmVhbSh0aHJlYWQsIHBhcmFtcywgb3B0aW9ucyk7XG4gICAgfVxuICAgIGFzeW5jIF9ydW5Bc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bnMsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5fY3JlYXRlQXNzaXN0YW50U3RyZWFtKHJ1bnMsIHRocmVhZElkLCBwYXJhbXMsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBhc3luYyBfcnVuVG9vbEFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVuSWQsIHJ1bnMsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5fY3JlYXRlVG9vbEFzc2lzdGFudFN0cmVhbShydW5zLCB0aHJlYWRJZCwgcnVuSWQsIHBhcmFtcywgb3B0aW9ucyk7XG4gICAgfVxufVxuX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudCA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5lbmRlZClcbiAgICAgICAgcmV0dXJuO1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50RXZlbnQsIGV2ZW50LCBcImZcIik7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlRXZlbnQpLmNhbGwodGhpcywgZXZlbnQpO1xuICAgIHN3aXRjaCAoZXZlbnQuZXZlbnQpIHtcbiAgICAgICAgY2FzZSAndGhyZWFkLmNyZWF0ZWQnOlxuICAgICAgICAgICAgLy9ObyBhY3Rpb24gb24gdGhpcyBldmVudC5cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNyZWF0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnF1ZXVlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uaW5fcHJvZ3Jlc3MnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnJlcXVpcmVzX2FjdGlvbic6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5pbmNvbXBsZXRlJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5mYWlsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNhbmNlbGxpbmcnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNhbmNlbGxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uZXhwaXJlZCc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW4pLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jcmVhdGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmluX3Byb2dyZXNzJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmRlbHRhJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5mYWlsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY2FuY2VsbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmV4cGlyZWQnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuU3RlcCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuY3JlYXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmluX3Byb2dyZXNzJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuZGVsdGEnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5pbmNvbXBsZXRlJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZU1lc3NhZ2UpLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgIC8vVGhpcyBpcyBpbmNsdWRlZCBmb3IgY29tcGxldGVuZXNzLCBidXQgZXJyb3JzIGFyZSBwcm9jZXNzZWQgaW4gdGhlIFNTRSBldmVudCBwcm9jZXNzaW5nIHNvIHRoaXMgc2hvdWxkIG5vdCBvY2N1clxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFbmNvdW50ZXJlZCBhbiBlcnJvciBldmVudCBpbiBldmVudCBwcm9jZXNzaW5nIC0gZXJyb3JzIHNob3VsZCBiZSBwcm9jZXNzZWQgZWFybGllcicpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYXNzZXJ0TmV2ZXIoZXZlbnQpO1xuICAgIH1cbn0sIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCgpIHtcbiAgICBpZiAodGhpcy5lbmRlZCkge1xuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYHN0cmVhbSBoYXMgZW5kZWQsIHRoaXMgc2hvdWxkbid0IGhhcHBlbmApO1xuICAgIH1cbiAgICBpZiAoIV9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biwgXCJmXCIpKVxuICAgICAgICB0aHJvdyBFcnJvcignRmluYWwgcnVuIGhhcyBub3QgYmVlbiByZWNlaXZlZCcpO1xuICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4sIFwiZlwiKTtcbn0sIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlTWVzc2FnZShldmVudCkge1xuICAgIGNvbnN0IFthY2N1bXVsYXRlZE1lc3NhZ2UsIG5ld0NvbnRlbnRdID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZU1lc3NhZ2UpLmNhbGwodGhpcywgZXZlbnQsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKSk7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgYWNjdW11bGF0ZWRNZXNzYWdlLCBcImZcIik7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdHMsIFwiZlwiKVthY2N1bXVsYXRlZE1lc3NhZ2UuaWRdID0gYWNjdW11bGF0ZWRNZXNzYWdlO1xuICAgIGZvciAoY29uc3QgY29udGVudCBvZiBuZXdDb250ZW50KSB7XG4gICAgICAgIGNvbnN0IHNuYXBzaG90Q29udGVudCA9IGFjY3VtdWxhdGVkTWVzc2FnZS5jb250ZW50W2NvbnRlbnQuaW5kZXhdO1xuICAgICAgICBpZiAoc25hcHNob3RDb250ZW50Py50eXBlID09ICd0ZXh0Jykge1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgndGV4dENyZWF0ZWQnLCBzbmFwc2hvdENvbnRlbnQudGV4dCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5jcmVhdGVkJzpcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ21lc3NhZ2VDcmVhdGVkJywgZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmRlbHRhJzpcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ21lc3NhZ2VEZWx0YScsIGV2ZW50LmRhdGEuZGVsdGEsIGFjY3VtdWxhdGVkTWVzc2FnZSk7XG4gICAgICAgICAgICBpZiAoZXZlbnQuZGF0YS5kZWx0YS5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBjb250ZW50IG9mIGV2ZW50LmRhdGEuZGVsdGEuY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICAvL0lmIGl0IGlzIHRleHQgZGVsdGEsIGVtaXQgYSB0ZXh0IGRlbHRhIGV2ZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50LnR5cGUgPT0gJ3RleHQnICYmIGNvbnRlbnQudGV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRleHREZWx0YSA9IGNvbnRlbnQudGV4dDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzbmFwc2hvdCA9IGFjY3VtdWxhdGVkTWVzc2FnZS5jb250ZW50W2NvbnRlbnQuaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNuYXBzaG90ICYmIHNuYXBzaG90LnR5cGUgPT0gJ3RleHQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndGV4dERlbHRhJywgdGV4dERlbHRhLCBzbmFwc2hvdC50ZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdUaGUgc25hcHNob3QgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdGV4dCBkZWx0YSBpcyBub3QgdGV4dCBvciBtaXNzaW5nJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlbnQuaW5kZXggIT0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXgsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9TZWUgaWYgd2UgaGF2ZSBpbiBwcm9ncmVzcyBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCwgXCJmXCIpLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAndGV4dCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0ZXh0RG9uZScsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCwgXCJmXCIpLnRleHQsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW1hZ2VfZmlsZSc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdpbWFnZUZpbGVEb25lJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LCBcImZcIikuaW1hZ2VfZmlsZSwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4LCBjb250ZW50LmluZGV4LCBcImZcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LCBhY2N1bXVsYXRlZE1lc3NhZ2UuY29udGVudFtjb250ZW50LmluZGV4XSwgXCJmXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5pbmNvbXBsZXRlJzpcbiAgICAgICAgICAgIC8vV2UgZW1pdCB0aGUgbGF0ZXN0IGNvbnRlbnQgd2Ugd2VyZSB3b3JraW5nIG9uIG9uIGNvbXBsZXRpb24gKGluY2x1ZGluZyBpbmNvbXBsZXRlKVxuICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4LCBcImZcIikgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRDb250ZW50ID0gZXZlbnQuZGF0YS5jb250ZW50W19fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4LCBcImZcIildO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Q29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGN1cnJlbnRDb250ZW50LnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2ltYWdlX2ZpbGUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ltYWdlRmlsZURvbmUnLCBjdXJyZW50Q29udGVudC5pbWFnZV9maWxlLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAndGV4dCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndGV4dERvbmUnLCBjdXJyZW50Q29udGVudC50ZXh0LCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ21lc3NhZ2VEb25lJywgZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCB1bmRlZmluZWQsIFwiZlwiKTtcbiAgICB9XG59LCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1blN0ZXAgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1blN0ZXAoZXZlbnQpIHtcbiAgICBjb25zdCBhY2N1bXVsYXRlZFJ1blN0ZXAgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlUnVuU3RlcCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TdGVwU25hcHNob3QsIGFjY3VtdWxhdGVkUnVuU3RlcCwgXCJmXCIpO1xuICAgIHN3aXRjaCAoZXZlbnQuZXZlbnQpIHtcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNyZWF0ZWQnOlxuICAgICAgICAgICAgdGhpcy5fZW1pdCgncnVuU3RlcENyZWF0ZWQnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZGVsdGEnOlxuICAgICAgICAgICAgY29uc3QgZGVsdGEgPSBldmVudC5kYXRhLmRlbHRhO1xuICAgICAgICAgICAgaWYgKGRlbHRhLnN0ZXBfZGV0YWlscyAmJlxuICAgICAgICAgICAgICAgIGRlbHRhLnN0ZXBfZGV0YWlscy50eXBlID09ICd0b29sX2NhbGxzJyAmJlxuICAgICAgICAgICAgICAgIGRlbHRhLnN0ZXBfZGV0YWlscy50b29sX2NhbGxzICYmXG4gICAgICAgICAgICAgICAgYWNjdW11bGF0ZWRSdW5TdGVwLnN0ZXBfZGV0YWlscy50eXBlID09ICd0b29sX2NhbGxzJykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbENhbGwgb2YgZGVsdGEuc3RlcF9kZXRhaWxzLnRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2xDYWxsLmluZGV4ID09IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGxJbmRleCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sQ2FsbERlbHRhJywgdG9vbENhbGwsIGFjY3VtdWxhdGVkUnVuU3RlcC5zdGVwX2RldGFpbHMudG9vbF9jYWxsc1t0b29sQ2FsbC5pbmRleF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xDYWxsRG9uZScsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsSW5kZXgsIHRvb2xDYWxsLmluZGV4LCBcImZcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBhY2N1bXVsYXRlZFJ1blN0ZXAuc3RlcF9kZXRhaWxzLnRvb2xfY2FsbHNbdG9vbENhbGwuaW5kZXhdLCBcImZcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xDYWxsQ3JlYXRlZCcsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdydW5TdGVwRGVsdGEnLCBldmVudC5kYXRhLmRlbHRhLCBhY2N1bXVsYXRlZFJ1blN0ZXApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZmFpbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNhbmNlbGxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5leHBpcmVkJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU3RlcFNuYXBzaG90LCB1bmRlZmluZWQsIFwiZlwiKTtcbiAgICAgICAgICAgIGNvbnN0IGRldGFpbHMgPSBldmVudC5kYXRhLnN0ZXBfZGV0YWlscztcbiAgICAgICAgICAgIGlmIChkZXRhaWxzLnR5cGUgPT0gJ3Rvb2xfY2FsbHMnKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sQ2FsbERvbmUnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCB1bmRlZmluZWQsIFwiZlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdydW5TdGVwRG9uZScsIGV2ZW50LmRhdGEsIGFjY3VtdWxhdGVkUnVuU3RlcCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmluX3Byb2dyZXNzJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn0sIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlRXZlbnQgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZUV2ZW50KGV2ZW50KSB7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2V2ZW50cywgXCJmXCIpLnB1c2goZXZlbnQpO1xuICAgIHRoaXMuX2VtaXQoJ2V2ZW50JywgZXZlbnQpO1xufSwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlUnVuU3RlcCA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZVJ1blN0ZXAoZXZlbnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jcmVhdGVkJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF0gPSBldmVudC5kYXRhO1xuICAgICAgICAgICAgcmV0dXJuIGV2ZW50LmRhdGE7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5kZWx0YSc6XG4gICAgICAgICAgICBsZXQgc25hcHNob3QgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdO1xuICAgICAgICAgICAgaWYgKCFzbmFwc2hvdCkge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdSZWNlaXZlZCBhIFJ1blN0ZXBEZWx0YSBiZWZvcmUgY3JlYXRpb24gb2YgYSBzbmFwc2hvdCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGRhdGEgPSBldmVudC5kYXRhO1xuICAgICAgICAgICAgaWYgKGRhdGEuZGVsdGEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhY2N1bXVsYXRlZCA9IEFzc2lzdGFudFN0cmVhbS5hY2N1bXVsYXRlRGVsdGEoc25hcHNob3QsIGRhdGEuZGVsdGEpO1xuICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF0gPSBhY2N1bXVsYXRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmZhaWxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jYW5jZWxsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZXhwaXJlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5pbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdID0gZXZlbnQuZGF0YTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXSlcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF07XG4gICAgdGhyb3cgbmV3IEVycm9yKCdObyBzbmFwc2hvdCBhdmFpbGFibGUnKTtcbn0sIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZU1lc3NhZ2UgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVNZXNzYWdlKGV2ZW50LCBzbmFwc2hvdCkge1xuICAgIGxldCBuZXdDb250ZW50ID0gW107XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5jcmVhdGVkJzpcbiAgICAgICAgICAgIC8vT24gY3JlYXRpb24gdGhlIHNuYXBzaG90IGlzIGp1c3QgdGhlIGluaXRpYWwgbWVzc2FnZVxuICAgICAgICAgICAgcmV0dXJuIFtldmVudC5kYXRhLCBuZXdDb250ZW50XTtcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuZGVsdGEnOlxuICAgICAgICAgICAgaWYgKCFzbmFwc2hvdCkge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdSZWNlaXZlZCBhIGRlbHRhIHdpdGggbm8gZXhpc3Rpbmcgc25hcHNob3QgKHRoZXJlIHNob3VsZCBiZSBvbmUgZnJvbSBtZXNzYWdlIGNyZWF0aW9uKScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGRhdGEgPSBldmVudC5kYXRhO1xuICAgICAgICAgICAgLy9JZiB0aGlzIGRlbHRhIGRvZXMgbm90IGhhdmUgY29udGVudCwgbm90aGluZyB0byBwcm9jZXNzXG4gICAgICAgICAgICBpZiAoZGF0YS5kZWx0YS5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBjb250ZW50RWxlbWVudCBvZiBkYXRhLmRlbHRhLmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRFbGVtZW50LmluZGV4IGluIHNuYXBzaG90LmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50Q29udGVudCA9IHNuYXBzaG90LmNvbnRlbnRbY29udGVudEVsZW1lbnQuaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgc25hcHNob3QuY29udGVudFtjb250ZW50RWxlbWVudC5pbmRleF0gPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlQ29udGVudCkuY2FsbCh0aGlzLCBjb250ZW50RWxlbWVudCwgY3VycmVudENvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc25hcHNob3QuY29udGVudFtjb250ZW50RWxlbWVudC5pbmRleF0gPSBjb250ZW50RWxlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgYSBuZXcgZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29udGVudC5wdXNoKGNvbnRlbnRFbGVtZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBbc25hcHNob3QsIG5ld0NvbnRlbnRdO1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5pbl9wcm9ncmVzcyc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmluY29tcGxldGUnOlxuICAgICAgICAgICAgLy9ObyBjaGFuZ2VzIG9uIG90aGVyIHRocmVhZCBldmVudHNcbiAgICAgICAgICAgIGlmIChzbmFwc2hvdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBbc25hcHNob3QsIG5ld0NvbnRlbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ1JlY2VpdmVkIHRocmVhZCBtZXNzYWdlIGV2ZW50IHdpdGggbm8gZXhpc3Rpbmcgc25hcHNob3QnKTtcbiAgICAgICAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgRXJyb3IoJ1RyaWVkIHRvIGFjY3VtdWxhdGUgYSBub24tbWVzc2FnZSBldmVudCcpO1xufSwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlQ29udGVudCA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZUNvbnRlbnQoY29udGVudEVsZW1lbnQsIGN1cnJlbnRDb250ZW50KSB7XG4gICAgcmV0dXJuIEFzc2lzdGFudFN0cmVhbS5hY2N1bXVsYXRlRGVsdGEoY3VycmVudENvbnRlbnQsIGNvbnRlbnRFbGVtZW50KTtcbn0sIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW4oZXZlbnQpIHtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blNuYXBzaG90LCBldmVudC5kYXRhLCBcImZcIik7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNyZWF0ZWQnOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4ucXVldWVkJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmluX3Byb2dyZXNzJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnJlcXVpcmVzX2FjdGlvbic6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY2FuY2VsbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5mYWlsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uZXhwaXJlZCc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4sIGV2ZW50LmRhdGEsIFwiZlwiKTtcbiAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sQ2FsbERvbmUnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpO1xuICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIHVuZGVmaW5lZCwgXCJmXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uY2FuY2VsbGluZyc6XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuZnVuY3Rpb24gYXNzZXJ0TmV2ZXIoX3gpIHsgfVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9QXNzaXN0YW50U3RyZWFtLm1qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyLCB9IGZyb20gXCIuL0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIubWpzXCI7XG5pbXBvcnQgeyBpc0Fzc2lzdGFudE1lc3NhZ2UgfSBmcm9tIFwiLi9jaGF0Q29tcGxldGlvblV0aWxzLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENoYXRDb21wbGV0aW9uUnVubmVyIGV4dGVuZHMgQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lciB7XG4gICAgLyoqIEBkZXByZWNhdGVkIC0gcGxlYXNlIHVzZSBgcnVuVG9vbHNgIGluc3RlYWQuICovXG4gICAgc3RhdGljIHJ1bkZ1bmN0aW9ucyhjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25SdW5uZXIoKTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3J1bkZ1bmN0aW9ucycgfSxcbiAgICAgICAgfTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5GdW5jdGlvbnMoY2xpZW50LCBwYXJhbXMsIG9wdHMpKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgc3RhdGljIHJ1blRvb2xzKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblJ1bm5lcigpO1xuICAgICAgICBjb25zdCBvcHRzID0ge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAncnVuVG9vbHMnIH0sXG4gICAgICAgIH07XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuVG9vbHMoY2xpZW50LCBwYXJhbXMsIG9wdHMpKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgX2FkZE1lc3NhZ2UobWVzc2FnZSwgZW1pdCA9IHRydWUpIHtcbiAgICAgICAgc3VwZXIuX2FkZE1lc3NhZ2UobWVzc2FnZSwgZW1pdCk7XG4gICAgICAgIGlmIChpc0Fzc2lzdGFudE1lc3NhZ2UobWVzc2FnZSkgJiYgbWVzc2FnZS5jb250ZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdjb250ZW50JywgbWVzc2FnZS5jb250ZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUNoYXRDb21wbGV0aW9uUnVubmVyLm1qcy5tYXAiLCJ2YXIgX19jbGFzc1ByaXZhdGVGaWVsZFNldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZFNldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XG59O1xudmFyIF9fY2xhc3NQcml2YXRlRmllbGRHZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRHZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcbn07XG52YXIgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9iZWdpblJlcXVlc3QsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRDaG9pY2VFdmVudFN0YXRlLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWRkQ2h1bmssIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0VG9vbENhbGxEb25lRXZlbnQsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0Q29udGVudERvbmVFdmVudHMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbmRSZXF1ZXN0LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0QXV0b1BhcnNlYWJsZVJlc3BvbnNlRm9ybWF0LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWNjdW11bGF0ZUNoYXRDb21wbGV0aW9uO1xuaW1wb3J0IHsgT3BlbkFJRXJyb3IsIEFQSVVzZXJBYm9ydEVycm9yLCBMZW5ndGhGaW5pc2hSZWFzb25FcnJvciwgQ29udGVudEZpbHRlckZpbmlzaFJlYXNvbkVycm9yLCB9IGZyb20gXCIuLi9lcnJvci5tanNcIjtcbmltcG9ydCB7IEFic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIsIH0gZnJvbSBcIi4vQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lci5tanNcIjtcbmltcG9ydCB7IFN0cmVhbSB9IGZyb20gXCIuLi9zdHJlYW1pbmcubWpzXCI7XG5pbXBvcnQgeyBoYXNBdXRvUGFyc2VhYmxlSW5wdXQsIGlzQXV0b1BhcnNhYmxlUmVzcG9uc2VGb3JtYXQsIGlzQXV0b1BhcnNhYmxlVG9vbCwgbWF5YmVQYXJzZUNoYXRDb21wbGV0aW9uLCBzaG91bGRQYXJzZVRvb2xDYWxsLCB9IGZyb20gXCIuLi9saWIvcGFyc2VyLm1qc1wiO1xuaW1wb3J0IHsgcGFydGlhbFBhcnNlIH0gZnJvbSBcIi4uL192ZW5kb3IvcGFydGlhbC1qc29uLXBhcnNlci9wYXJzZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ2hhdENvbXBsZXRpb25TdHJlYW0gZXh0ZW5kcyBBYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyIHtcbiAgICBjb25zdHJ1Y3RvcihwYXJhbXMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcy5hZGQodGhpcyk7XG4gICAgICAgIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcy5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIHBhcmFtcywgXCJmXCIpO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcywgW10sIFwiZlwiKTtcbiAgICB9XG4gICAgZ2V0IGN1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90KCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIFwiZlwiKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSW50ZW5kZWQgZm9yIHVzZSBvbiB0aGUgZnJvbnRlbmQsIGNvbnN1bWluZyBhIHN0cmVhbSBwcm9kdWNlZCB3aXRoXG4gICAgICogYC50b1JlYWRhYmxlU3RyZWFtKClgIG9uIHRoZSBiYWNrZW5kLlxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IG1lc3NhZ2VzIHNlbnQgdG8gdGhlIG1vZGVsIGRvIG5vdCBhcHBlYXIgaW4gYC5vbignbWVzc2FnZScpYFxuICAgICAqIGluIHRoaXMgY29udGV4dC5cbiAgICAgKi9cbiAgICBzdGF0aWMgZnJvbVJlYWRhYmxlU3RyZWFtKHN0cmVhbSkge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25TdHJlYW0obnVsbCk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fZnJvbVJlYWRhYmxlU3RyZWFtKHN0cmVhbSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlQ2hhdENvbXBsZXRpb24oY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uU3RyZWFtKHBhcmFtcyk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuQ2hhdENvbXBsZXRpb24oY2xpZW50LCB7IC4uLnBhcmFtcywgc3RyZWFtOiB0cnVlIH0sIHsgLi4ub3B0aW9ucywgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdzdHJlYW0nIH0gfSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBhc3luYyBfY3JlYXRlQ2hhdENvbXBsZXRpb24oY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIuX2NyZWF0ZUNoYXRDb21wbGV0aW9uO1xuICAgICAgICBjb25zdCBzaWduYWwgPSBvcHRpb25zPy5zaWduYWw7XG4gICAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgICAgIGlmIChzaWduYWwuYWJvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXMuY29udHJvbGxlci5hYm9ydCgpKTtcbiAgICAgICAgfVxuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYmVnaW5SZXF1ZXN0KS5jYWxsKHRoaXMpO1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBjbGllbnQuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoeyAuLi5wYXJhbXMsIHN0cmVhbTogdHJ1ZSB9LCB7IC4uLm9wdGlvbnMsIHNpZ25hbDogdGhpcy5jb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2Ygc3RyZWFtKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWRkQ2h1bmspLmNhbGwodGhpcywgY2h1bmspO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdHJlYW0uY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGF0Q29tcGxldGlvbihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgfVxuICAgIGFzeW5jIF9mcm9tUmVhZGFibGVTdHJlYW0ocmVhZGFibGVTdHJlYW0sIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2JlZ2luUmVxdWVzdCkuY2FsbCh0aGlzKTtcbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IFN0cmVhbS5mcm9tUmVhZGFibGVTdHJlYW0ocmVhZGFibGVTdHJlYW0sIHRoaXMuY29udHJvbGxlcik7XG4gICAgICAgIGxldCBjaGF0SWQ7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2Ygc3RyZWFtKSB7XG4gICAgICAgICAgICBpZiAoY2hhdElkICYmIGNoYXRJZCAhPT0gY2h1bmsuaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBBIG5ldyByZXF1ZXN0IGhhcyBiZWVuIG1hZGUuXG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkQ2hhdENvbXBsZXRpb24oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FkZENodW5rKS5jYWxsKHRoaXMsIGNodW5rKTtcbiAgICAgICAgICAgIGNoYXRJZCA9IGNodW5rLmlkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdHJlYW0uY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGF0Q29tcGxldGlvbihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgfVxuICAgIFsoX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcyA9IG5ldyBXZWFrTWFwKCksIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcyA9IG5ldyBXZWFrTWFwKCksIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCA9IG5ldyBXZWFrTWFwKCksIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMgPSBuZXcgV2Vha1NldCgpLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYmVnaW5SZXF1ZXN0ID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2JlZ2luUmVxdWVzdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5kZWQpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCB1bmRlZmluZWQsIFwiZlwiKTtcbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0Q2hvaWNlRXZlbnRTdGF0ZSA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRDaG9pY2VFdmVudFN0YXRlKGNob2ljZSkge1xuICAgICAgICBsZXQgc3RhdGUgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcywgXCJmXCIpW2Nob2ljZS5pbmRleF07XG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlID0ge1xuICAgICAgICAgICAgY29udGVudF9kb25lOiBmYWxzZSxcbiAgICAgICAgICAgIHJlZnVzYWxfZG9uZTogZmFsc2UsXG4gICAgICAgICAgICBsb2dwcm9ic19jb250ZW50X2RvbmU6IGZhbHNlLFxuICAgICAgICAgICAgbG9ncHJvYnNfcmVmdXNhbF9kb25lOiBmYWxzZSxcbiAgICAgICAgICAgIGRvbmVfdG9vbF9jYWxsczogbmV3IFNldCgpLFxuICAgICAgICAgICAgY3VycmVudF90b29sX2NhbGxfaW5kZXg6IG51bGwsXG4gICAgICAgIH07XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzLCBcImZcIilbY2hvaWNlLmluZGV4XSA9IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FkZENodW5rID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FkZENodW5rKGNodW5rKSB7XG4gICAgICAgIGlmICh0aGlzLmVuZGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBjb21wbGV0aW9uID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FjY3VtdWxhdGVDaGF0Q29tcGxldGlvbikuY2FsbCh0aGlzLCBjaHVuayk7XG4gICAgICAgIHRoaXMuX2VtaXQoJ2NodW5rJywgY2h1bmssIGNvbXBsZXRpb24pO1xuICAgICAgICBmb3IgKGNvbnN0IGNob2ljZSBvZiBjaHVuay5jaG9pY2VzKSB7XG4gICAgICAgICAgICBjb25zdCBjaG9pY2VTbmFwc2hvdCA9IGNvbXBsZXRpb24uY2hvaWNlc1tjaG9pY2UuaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGNob2ljZS5kZWx0YS5jb250ZW50ICE9IG51bGwgJiZcbiAgICAgICAgICAgICAgICBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlPy5yb2xlID09PSAnYXNzaXN0YW50JyAmJlxuICAgICAgICAgICAgICAgIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2U/LmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdjb250ZW50JywgY2hvaWNlLmRlbHRhLmNvbnRlbnQsIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UuY29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnY29udGVudC5kZWx0YScsIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsdGE6IGNob2ljZS5kZWx0YS5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdDogY2hvaWNlU25hcHNob3QubWVzc2FnZS5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBwYXJzZWQ6IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UucGFyc2VkLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNob2ljZS5kZWx0YS5yZWZ1c2FsICE9IG51bGwgJiZcbiAgICAgICAgICAgICAgICBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlPy5yb2xlID09PSAnYXNzaXN0YW50JyAmJlxuICAgICAgICAgICAgICAgIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2U/LnJlZnVzYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdyZWZ1c2FsLmRlbHRhJywge1xuICAgICAgICAgICAgICAgICAgICBkZWx0YTogY2hvaWNlLmRlbHRhLnJlZnVzYWwsXG4gICAgICAgICAgICAgICAgICAgIHNuYXBzaG90OiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLnJlZnVzYWwsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2hvaWNlLmxvZ3Byb2JzPy5jb250ZW50ICE9IG51bGwgJiYgY2hvaWNlU25hcHNob3QubWVzc2FnZT8ucm9sZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdsb2dwcm9icy5jb250ZW50LmRlbHRhJywge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBjaG9pY2UubG9ncHJvYnM/LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIHNuYXBzaG90OiBjaG9pY2VTbmFwc2hvdC5sb2dwcm9icz8uY29udGVudCA/PyBbXSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjaG9pY2UubG9ncHJvYnM/LnJlZnVzYWwgIT0gbnVsbCAmJiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlPy5yb2xlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2xvZ3Byb2JzLnJlZnVzYWwuZGVsdGEnLCB7XG4gICAgICAgICAgICAgICAgICAgIHJlZnVzYWw6IGNob2ljZS5sb2dwcm9icz8ucmVmdXNhbCxcbiAgICAgICAgICAgICAgICAgICAgc25hcHNob3Q6IGNob2ljZVNuYXBzaG90LmxvZ3Byb2JzPy5yZWZ1c2FsID8/IFtdLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0Q2hvaWNlRXZlbnRTdGF0ZSkuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCk7XG4gICAgICAgICAgICBpZiAoY2hvaWNlU25hcHNob3QuZmluaXNoX3JlYXNvbikge1xuICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0Q29udGVudERvbmVFdmVudHMpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QpO1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZS5jdXJyZW50X3Rvb2xfY2FsbF9pbmRleCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0VG9vbENhbGxEb25lRXZlbnQpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QsIHN0YXRlLmN1cnJlbnRfdG9vbF9jYWxsX2luZGV4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2xDYWxsIG9mIGNob2ljZS5kZWx0YS50b29sX2NhbGxzID8/IFtdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLmN1cnJlbnRfdG9vbF9jYWxsX2luZGV4ICE9PSB0b29sQ2FsbC5pbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdENvbnRlbnREb25lRXZlbnRzKS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90KTtcbiAgICAgICAgICAgICAgICAgICAgLy8gbmV3IHRvb2wgY2FsbCBzdGFydGVkLCB0aGUgcHJldmlvdXMgb25lIGlzIGRvbmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRlLmN1cnJlbnRfdG9vbF9jYWxsX2luZGV4ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0VG9vbENhbGxEb25lRXZlbnQpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QsIHN0YXRlLmN1cnJlbnRfdG9vbF9jYWxsX2luZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdGF0ZS5jdXJyZW50X3Rvb2xfY2FsbF9pbmRleCA9IHRvb2xDYWxsLmluZGV4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sQ2FsbERlbHRhIG9mIGNob2ljZS5kZWx0YS50b29sX2NhbGxzID8/IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbENhbGxTbmFwc2hvdCA9IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UudG9vbF9jYWxscz8uW3Rvb2xDYWxsRGVsdGEuaW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmICghdG9vbENhbGxTbmFwc2hvdD8udHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRvb2xDYWxsU25hcHNob3Q/LnR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbF9jYWxscy5mdW5jdGlvbi5hcmd1bWVudHMuZGVsdGEnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uPy5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHRvb2xDYWxsRGVsdGEuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24uYXJndW1lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VkX2FyZ3VtZW50czogdG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5wYXJzZWRfYXJndW1lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJndW1lbnRzX2RlbHRhOiB0b29sQ2FsbERlbHRhLmZ1bmN0aW9uPy5hcmd1bWVudHMgPz8gJycsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0TmV2ZXIodG9vbENhbGxTbmFwc2hvdD8udHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRUb29sQ2FsbERvbmVFdmVudCA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0VG9vbENhbGxEb25lRXZlbnQoY2hvaWNlU25hcHNob3QsIHRvb2xDYWxsSW5kZXgpIHtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0Q2hvaWNlRXZlbnRTdGF0ZSkuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCk7XG4gICAgICAgIGlmIChzdGF0ZS5kb25lX3Rvb2xfY2FsbHMuaGFzKHRvb2xDYWxsSW5kZXgpKSB7XG4gICAgICAgICAgICAvLyB3ZSd2ZSBhbHJlYWR5IGZpcmVkIHRoZSBkb25lIGV2ZW50XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdG9vbENhbGxTbmFwc2hvdCA9IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UudG9vbF9jYWxscz8uW3Rvb2xDYWxsSW5kZXhdO1xuICAgICAgICBpZiAoIXRvb2xDYWxsU25hcHNob3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbm8gdG9vbCBjYWxsIHNuYXBzaG90Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0b29sQ2FsbFNuYXBzaG90LnR5cGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndG9vbCBjYWxsIHNuYXBzaG90IG1pc3NpbmcgYHR5cGVgJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRvb2xDYWxsU25hcHNob3QudHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY29uc3QgaW5wdXRUb29sID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBcImZcIik/LnRvb2xzPy5maW5kKCh0b29sKSA9PiB0b29sLnR5cGUgPT09ICdmdW5jdGlvbicgJiYgdG9vbC5mdW5jdGlvbi5uYW1lID09PSB0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLm5hbWUpO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbF9jYWxscy5mdW5jdGlvbi5hcmd1bWVudHMuZG9uZScsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLm5hbWUsXG4gICAgICAgICAgICAgICAgaW5kZXg6IHRvb2xDYWxsSW5kZXgsXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzOiB0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLmFyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICBwYXJzZWRfYXJndW1lbnRzOiBpc0F1dG9QYXJzYWJsZVRvb2woaW5wdXRUb29sKSA/IGlucHV0VG9vbC4kcGFyc2VSYXcodG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5hcmd1bWVudHMpXG4gICAgICAgICAgICAgICAgICAgIDogaW5wdXRUb29sPy5mdW5jdGlvbi5zdHJpY3QgPyBKU09OLnBhcnNlKHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24uYXJndW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBhc3NlcnROZXZlcih0b29sQ2FsbFNuYXBzaG90LnR5cGUpO1xuICAgICAgICB9XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRDb250ZW50RG9uZUV2ZW50cyA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0Q29udGVudERvbmVFdmVudHMoY2hvaWNlU25hcHNob3QpIHtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0Q2hvaWNlRXZlbnRTdGF0ZSkuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCk7XG4gICAgICAgIGlmIChjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLmNvbnRlbnQgJiYgIXN0YXRlLmNvbnRlbnRfZG9uZSkge1xuICAgICAgICAgICAgc3RhdGUuY29udGVudF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlRm9ybWF0ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldEF1dG9QYXJzZWFibGVSZXNwb25zZUZvcm1hdCkuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2NvbnRlbnQuZG9uZScsIHtcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgcGFyc2VkOiByZXNwb25zZUZvcm1hdCA/IHJlc3BvbnNlRm9ybWF0LiRwYXJzZVJhdyhjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLmNvbnRlbnQpIDogbnVsbCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLnJlZnVzYWwgJiYgIXN0YXRlLnJlZnVzYWxfZG9uZSkge1xuICAgICAgICAgICAgc3RhdGUucmVmdXNhbF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3JlZnVzYWwuZG9uZScsIHsgcmVmdXNhbDogY2hvaWNlU25hcHNob3QubWVzc2FnZS5yZWZ1c2FsIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaG9pY2VTbmFwc2hvdC5sb2dwcm9icz8uY29udGVudCAmJiAhc3RhdGUubG9ncHJvYnNfY29udGVudF9kb25lKSB7XG4gICAgICAgICAgICBzdGF0ZS5sb2dwcm9ic19jb250ZW50X2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnbG9ncHJvYnMuY29udGVudC5kb25lJywgeyBjb250ZW50OiBjaG9pY2VTbmFwc2hvdC5sb2dwcm9icy5jb250ZW50IH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaG9pY2VTbmFwc2hvdC5sb2dwcm9icz8ucmVmdXNhbCAmJiAhc3RhdGUubG9ncHJvYnNfcmVmdXNhbF9kb25lKSB7XG4gICAgICAgICAgICBzdGF0ZS5sb2dwcm9ic19yZWZ1c2FsX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnbG9ncHJvYnMucmVmdXNhbC5kb25lJywgeyByZWZ1c2FsOiBjaG9pY2VTbmFwc2hvdC5sb2dwcm9icy5yZWZ1c2FsIH0pO1xuICAgICAgICB9XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VuZFJlcXVlc3QgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW5kUmVxdWVzdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5kZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgc3RyZWFtIGhhcyBlbmRlZCwgdGhpcyBzaG91bGRuJ3QgaGFwcGVuYCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc25hcHNob3QgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwgXCJmXCIpO1xuICAgICAgICBpZiAoIXNuYXBzaG90KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYHJlcXVlc3QgZW5kZWQgd2l0aG91dCBzZW5kaW5nIGFueSBjaHVua3NgKTtcbiAgICAgICAgfVxuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwgdW5kZWZpbmVkLCBcImZcIik7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2Nob2ljZUV2ZW50U3RhdGVzLCBbXSwgXCJmXCIpO1xuICAgICAgICByZXR1cm4gZmluYWxpemVDaGF0Q29tcGxldGlvbihzbmFwc2hvdCwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBcImZcIikpO1xuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRBdXRvUGFyc2VhYmxlUmVzcG9uc2VGb3JtYXQgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0QXV0b1BhcnNlYWJsZVJlc3BvbnNlRm9ybWF0KCkge1xuICAgICAgICBjb25zdCByZXNwb25zZUZvcm1hdCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgXCJmXCIpPy5yZXNwb25zZV9mb3JtYXQ7XG4gICAgICAgIGlmIChpc0F1dG9QYXJzYWJsZVJlc3BvbnNlRm9ybWF0KHJlc3BvbnNlRm9ybWF0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlRm9ybWF0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hY2N1bXVsYXRlQ2hhdENvbXBsZXRpb24gPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWNjdW11bGF0ZUNoYXRDb21wbGV0aW9uKGNodW5rKSB7XG4gICAgICAgIHZhciBfYSwgX2IsIF9jLCBfZDtcbiAgICAgICAgbGV0IHNuYXBzaG90ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIFwiZlwiKTtcbiAgICAgICAgY29uc3QgeyBjaG9pY2VzLCAuLi5yZXN0IH0gPSBjaHVuaztcbiAgICAgICAgaWYgKCFzbmFwc2hvdCkge1xuICAgICAgICAgICAgc25hcHNob3QgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwge1xuICAgICAgICAgICAgICAgIC4uLnJlc3QsXG4gICAgICAgICAgICAgICAgY2hvaWNlczogW10sXG4gICAgICAgICAgICB9LCBcImZcIik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKHNuYXBzaG90LCByZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHsgZGVsdGEsIGZpbmlzaF9yZWFzb24sIGluZGV4LCBsb2dwcm9icyA9IG51bGwsIC4uLm90aGVyIH0gb2YgY2h1bmsuY2hvaWNlcykge1xuICAgICAgICAgICAgbGV0IGNob2ljZSA9IHNuYXBzaG90LmNob2ljZXNbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFjaG9pY2UpIHtcbiAgICAgICAgICAgICAgICBjaG9pY2UgPSBzbmFwc2hvdC5jaG9pY2VzW2luZGV4XSA9IHsgZmluaXNoX3JlYXNvbiwgaW5kZXgsIG1lc3NhZ2U6IHt9LCBsb2dwcm9icywgLi4ub3RoZXIgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsb2dwcm9icykge1xuICAgICAgICAgICAgICAgIGlmICghY2hvaWNlLmxvZ3Byb2JzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNob2ljZS5sb2dwcm9icyA9IE9iamVjdC5hc3NpZ24oe30sIGxvZ3Byb2JzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgcmVmdXNhbCwgLi4ucmVzdCB9ID0gbG9ncHJvYnM7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydElzRW1wdHkocmVzdCk7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY2hvaWNlLmxvZ3Byb2JzLCByZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChfYSA9IGNob2ljZS5sb2dwcm9icykuY29udGVudCA/PyAoX2EuY29udGVudCA9IFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNob2ljZS5sb2dwcm9icy5jb250ZW50LnB1c2goLi4uY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZnVzYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChfYiA9IGNob2ljZS5sb2dwcm9icykucmVmdXNhbCA/PyAoX2IucmVmdXNhbCA9IFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNob2ljZS5sb2dwcm9icy5yZWZ1c2FsLnB1c2goLi4ucmVmdXNhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZmluaXNoX3JlYXNvbikge1xuICAgICAgICAgICAgICAgIGNob2ljZS5maW5pc2hfcmVhc29uID0gZmluaXNoX3JlYXNvbjtcbiAgICAgICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBcImZcIikgJiYgaGFzQXV0b1BhcnNlYWJsZUlucHV0KF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgXCJmXCIpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmluaXNoX3JlYXNvbiA9PT0gJ2xlbmd0aCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBMZW5ndGhGaW5pc2hSZWFzb25FcnJvcigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaW5pc2hfcmVhc29uID09PSAnY29udGVudF9maWx0ZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQ29udGVudEZpbHRlckZpbmlzaFJlYXNvbkVycm9yKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNob2ljZSwgb3RoZXIpO1xuICAgICAgICAgICAgaWYgKCFkZWx0YSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTsgLy8gU2hvdWxkbid0IGhhcHBlbjsganVzdCBpbiBjYXNlLlxuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCByZWZ1c2FsLCBmdW5jdGlvbl9jYWxsLCByb2xlLCB0b29sX2NhbGxzLCAuLi5yZXN0IH0gPSBkZWx0YTtcbiAgICAgICAgICAgIGFzc2VydElzRW1wdHkocmVzdCk7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNob2ljZS5tZXNzYWdlLCByZXN0KTtcbiAgICAgICAgICAgIGlmIChyZWZ1c2FsKSB7XG4gICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UucmVmdXNhbCA9IChjaG9pY2UubWVzc2FnZS5yZWZ1c2FsIHx8ICcnKSArIHJlZnVzYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocm9sZSlcbiAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5yb2xlID0gcm9sZTtcbiAgICAgICAgICAgIGlmIChmdW5jdGlvbl9jYWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjaG9pY2UubWVzc2FnZS5mdW5jdGlvbl9jYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLmZ1bmN0aW9uX2NhbGwgPSBmdW5jdGlvbl9jYWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZ1bmN0aW9uX2NhbGwubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLmZ1bmN0aW9uX2NhbGwubmFtZSA9IGZ1bmN0aW9uX2NhbGwubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZ1bmN0aW9uX2NhbGwuYXJndW1lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoX2MgPSBjaG9pY2UubWVzc2FnZS5mdW5jdGlvbl9jYWxsKS5hcmd1bWVudHMgPz8gKF9jLmFyZ3VtZW50cyA9ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLmZ1bmN0aW9uX2NhbGwuYXJndW1lbnRzICs9IGZ1bmN0aW9uX2NhbGwuYXJndW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5jb250ZW50ID0gKGNob2ljZS5tZXNzYWdlLmNvbnRlbnQgfHwgJycpICsgY29udGVudDtcbiAgICAgICAgICAgICAgICBpZiAoIWNob2ljZS5tZXNzYWdlLnJlZnVzYWwgJiYgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldEF1dG9QYXJzZWFibGVSZXNwb25zZUZvcm1hdCkuY2FsbCh0aGlzKSkge1xuICAgICAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5wYXJzZWQgPSBwYXJ0aWFsUGFyc2UoY2hvaWNlLm1lc3NhZ2UuY29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNob2ljZS5tZXNzYWdlLnRvb2xfY2FsbHMpXG4gICAgICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLnRvb2xfY2FsbHMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgaW5kZXgsIGlkLCB0eXBlLCBmdW5jdGlvbjogZm4sIC4uLnJlc3QgfSBvZiB0b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xfY2FsbCA9ICgoX2QgPSBjaG9pY2UubWVzc2FnZS50b29sX2NhbGxzKVtpbmRleF0gPz8gKF9kW2luZGV4XSA9IHt9KSk7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24odG9vbF9jYWxsLCByZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsLmlkID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlKVxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm4pXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGwuZnVuY3Rpb24gPz8gKHRvb2xfY2FsbC5mdW5jdGlvbiA9IHsgbmFtZTogZm4ubmFtZSA/PyAnJywgYXJndW1lbnRzOiAnJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZuPy5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsLmZ1bmN0aW9uLm5hbWUgPSBmbi5uYW1lO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm4/LmFyZ3VtZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsLmZ1bmN0aW9uLmFyZ3VtZW50cyArPSBmbi5hcmd1bWVudHM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hvdWxkUGFyc2VUb29sQ2FsbChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIFwiZlwiKSwgdG9vbF9jYWxsKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbC5mdW5jdGlvbi5wYXJzZWRfYXJndW1lbnRzID0gcGFydGlhbFBhcnNlKHRvb2xfY2FsbC5mdW5jdGlvbi5hcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzbmFwc2hvdDtcbiAgICB9LCBTeW1ib2wuYXN5bmNJdGVyYXRvcildKCkge1xuICAgICAgICBjb25zdCBwdXNoUXVldWUgPSBbXTtcbiAgICAgICAgY29uc3QgcmVhZFF1ZXVlID0gW107XG4gICAgICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgICAgIHRoaXMub24oJ2NodW5rJywgKGNodW5rKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZWFkZXIgPSByZWFkUXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgIGlmIChyZWFkZXIpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVzb2x2ZShjaHVuayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwdXNoUXVldWUucHVzaChjaHVuayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVhZGVyIG9mIHJlYWRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub24oJ2Fib3J0JywgKGVycikgPT4ge1xuICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlYWRlciBvZiByZWFkUXVldWUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlYWRlciBvZiByZWFkUXVldWUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWFkUXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuZXh0OiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwdXNoUXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHJlYWRRdWV1ZS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pKS50aGVuKChjaHVuaykgPT4gKGNodW5rID8geyB2YWx1ZTogY2h1bmssIGRvbmU6IGZhbHNlIH0gOiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IHB1c2hRdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBjaHVuaywgZG9uZTogZmFsc2UgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXR1cm46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgdG9SZWFkYWJsZVN0cmVhbSgpIHtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gbmV3IFN0cmVhbSh0aGlzW1N5bWJvbC5hc3luY0l0ZXJhdG9yXS5iaW5kKHRoaXMpLCB0aGlzLmNvbnRyb2xsZXIpO1xuICAgICAgICByZXR1cm4gc3RyZWFtLnRvUmVhZGFibGVTdHJlYW0oKTtcbiAgICB9XG59XG5mdW5jdGlvbiBmaW5hbGl6ZUNoYXRDb21wbGV0aW9uKHNuYXBzaG90LCBwYXJhbXMpIHtcbiAgICBjb25zdCB7IGlkLCBjaG9pY2VzLCBjcmVhdGVkLCBtb2RlbCwgc3lzdGVtX2ZpbmdlcnByaW50LCAuLi5yZXN0IH0gPSBzbmFwc2hvdDtcbiAgICBjb25zdCBjb21wbGV0aW9uID0ge1xuICAgICAgICAuLi5yZXN0LFxuICAgICAgICBpZCxcbiAgICAgICAgY2hvaWNlczogY2hvaWNlcy5tYXAoKHsgbWVzc2FnZSwgZmluaXNoX3JlYXNvbiwgaW5kZXgsIGxvZ3Byb2JzLCAuLi5jaG9pY2VSZXN0IH0pID0+IHtcbiAgICAgICAgICAgIGlmICghZmluaXNoX3JlYXNvbikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBmaW5pc2hfcmVhc29uIGZvciBjaG9pY2UgJHtpbmRleH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCA9IG51bGwsIGZ1bmN0aW9uX2NhbGwsIHRvb2xfY2FsbHMsIC4uLm1lc3NhZ2VSZXN0IH0gPSBtZXNzYWdlO1xuICAgICAgICAgICAgY29uc3Qgcm9sZSA9IG1lc3NhZ2Uucm9sZTsgLy8gdGhpcyBpcyB3aGF0IHdlIGV4cGVjdDsgaW4gdGhlb3J5IGl0IGNvdWxkIGJlIGRpZmZlcmVudCB3aGljaCB3b3VsZCBtYWtlIG91ciB0eXBlcyBhIHNsaWdodCBsaWUgYnV0IHdvdWxkIGJlIGZpbmUuXG4gICAgICAgICAgICBpZiAoIXJvbGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3Npbmcgcm9sZSBmb3IgY2hvaWNlICR7aW5kZXh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25fY2FsbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgYXJndW1lbnRzOiBhcmdzLCBuYW1lIH0gPSBmdW5jdGlvbl9jYWxsO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGZ1bmN0aW9uX2NhbGwuYXJndW1lbnRzIGZvciBjaG9pY2UgJHtpbmRleH1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBmdW5jdGlvbl9jYWxsLm5hbWUgZm9yIGNob2ljZSAke2luZGV4fWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAuLi5jaG9pY2VSZXN0LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb25fY2FsbDogeyBhcmd1bWVudHM6IGFyZ3MsIG5hbWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWZ1c2FsOiBtZXNzYWdlLnJlZnVzYWwgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoX3JlYXNvbixcbiAgICAgICAgICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIGxvZ3Byb2JzLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmNob2ljZVJlc3QsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgICAgICAgICBmaW5pc2hfcmVhc29uLFxuICAgICAgICAgICAgICAgICAgICBsb2dwcm9icyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4ubWVzc2FnZVJlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZnVzYWw6IG1lc3NhZ2UucmVmdXNhbCA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsczogdG9vbF9jYWxscy5tYXAoKHRvb2xfY2FsbCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZnVuY3Rpb246IGZuLCB0eXBlLCBpZCwgLi4udG9vbFJlc3QgfSA9IHRvb2xfY2FsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGFyZ3VtZW50czogYXJncywgbmFtZSwgLi4uZm5SZXN0IH0gPSBmbiB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgY2hvaWNlc1ske2luZGV4fV0udG9vbF9jYWxsc1ske2l9XS5pZFxcbiR7c3RyKHNuYXBzaG90KX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgY2hvaWNlc1ske2luZGV4fV0udG9vbF9jYWxsc1ske2l9XS50eXBlXFxuJHtzdHIoc25hcHNob3QpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBjaG9pY2VzWyR7aW5kZXh9XS50b29sX2NhbGxzWyR7aX1dLmZ1bmN0aW9uLm5hbWVcXG4ke3N0cihzbmFwc2hvdCl9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGNob2ljZXNbJHtpbmRleH1dLnRvb2xfY2FsbHNbJHtpfV0uZnVuY3Rpb24uYXJndW1lbnRzXFxuJHtzdHIoc25hcHNob3QpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyAuLi50b29sUmVzdCwgaWQsIHR5cGUsIGZ1bmN0aW9uOiB7IC4uLmZuUmVzdCwgbmFtZSwgYXJndW1lbnRzOiBhcmdzIH0gfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIC4uLmNob2ljZVJlc3QsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogeyAuLi5tZXNzYWdlUmVzdCwgY29udGVudCwgcm9sZSwgcmVmdXNhbDogbWVzc2FnZS5yZWZ1c2FsID8/IG51bGwgfSxcbiAgICAgICAgICAgICAgICBmaW5pc2hfcmVhc29uLFxuICAgICAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgICAgIGxvZ3Byb2JzLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgICAgIGNyZWF0ZWQsXG4gICAgICAgIG1vZGVsLFxuICAgICAgICBvYmplY3Q6ICdjaGF0LmNvbXBsZXRpb24nLFxuICAgICAgICAuLi4oc3lzdGVtX2ZpbmdlcnByaW50ID8geyBzeXN0ZW1fZmluZ2VycHJpbnQgfSA6IHt9KSxcbiAgICB9O1xuICAgIHJldHVybiBtYXliZVBhcnNlQ2hhdENvbXBsZXRpb24oY29tcGxldGlvbiwgcGFyYW1zKTtcbn1cbmZ1bmN0aW9uIHN0cih4KSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHgpO1xufVxuLyoqXG4gKiBFbnN1cmVzIHRoZSBnaXZlbiBhcmd1bWVudCBpcyBhbiBlbXB0eSBvYmplY3QsIHVzZWZ1bCBmb3JcbiAqIGFzc2VydGluZyB0aGF0IGFsbCBrbm93biBwcm9wZXJ0aWVzIG9uIGFuIG9iamVjdCBoYXZlIGJlZW5cbiAqIGRlc3RydWN0dXJlZC5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0SXNFbXB0eShvYmopIHtcbiAgICByZXR1cm47XG59XG5mdW5jdGlvbiBhc3NlcnROZXZlcihfeCkgeyB9XG4vLyMgc291cmNlTWFwcGluZ1VSTD1DaGF0Q29tcGxldGlvblN0cmVhbS5tanMubWFwIiwiaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25TdHJlYW0gfSBmcm9tIFwiLi9DaGF0Q29tcGxldGlvblN0cmVhbS5tanNcIjtcbmV4cG9ydCBjbGFzcyBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lciBleHRlbmRzIENoYXRDb21wbGV0aW9uU3RyZWFtIHtcbiAgICBzdGF0aWMgZnJvbVJlYWRhYmxlU3RyZWFtKHN0cmVhbSkge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIobnVsbCk7XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fZnJvbVJlYWRhYmxlU3RyZWFtKHN0cmVhbSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICAvKiogQGRlcHJlY2F0ZWQgLSBwbGVhc2UgdXNlIGBydW5Ub29sc2AgaW5zdGVhZC4gKi9cbiAgICBzdGF0aWMgcnVuRnVuY3Rpb25zKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lcihudWxsKTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3J1bkZ1bmN0aW9ucycgfSxcbiAgICAgICAgfTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5GdW5jdGlvbnMoY2xpZW50LCBwYXJhbXMsIG9wdHMpKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgc3RhdGljIHJ1blRvb2xzKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lcihcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBUT0RPIHRoZXNlIHR5cGVzIGFyZSBpbmNvbXBhdGlibGVcbiAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3J1blRvb2xzJyB9LFxuICAgICAgICB9O1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1blRvb2xzKGNsaWVudCwgcGFyYW1zLCBvcHRzKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Q2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIubWpzLm1hcCIsInZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBzZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcbn07XG52YXIgX19jbGFzc1ByaXZhdGVGaWVsZEdldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZEdldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xufTtcbnZhciBfRXZlbnRTdHJlYW1faW5zdGFuY2VzLCBfRXZlbnRTdHJlYW1fY29ubmVjdGVkUHJvbWlzZSwgX0V2ZW50U3RyZWFtX3Jlc29sdmVDb25uZWN0ZWRQcm9taXNlLCBfRXZlbnRTdHJlYW1fcmVqZWN0Q29ubmVjdGVkUHJvbWlzZSwgX0V2ZW50U3RyZWFtX2VuZFByb21pc2UsIF9FdmVudFN0cmVhbV9yZXNvbHZlRW5kUHJvbWlzZSwgX0V2ZW50U3RyZWFtX3JlamVjdEVuZFByb21pc2UsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIF9FdmVudFN0cmVhbV9lbmRlZCwgX0V2ZW50U3RyZWFtX2Vycm9yZWQsIF9FdmVudFN0cmVhbV9hYm9ydGVkLCBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZCwgX0V2ZW50U3RyZWFtX2hhbmRsZUVycm9yO1xuaW1wb3J0IHsgQVBJVXNlckFib3J0RXJyb3IsIE9wZW5BSUVycm9yIH0gZnJvbSBcIi4uL2Vycm9yLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEV2ZW50U3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2luc3RhbmNlcy5hZGQodGhpcyk7XG4gICAgICAgIHRoaXMuY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2Nvbm5lY3RlZFByb21pc2Uuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9yZXNvbHZlQ29ubmVjdGVkUHJvbWlzZS5zZXQodGhpcywgKCkgPT4geyB9KTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX3JlamVjdENvbm5lY3RlZFByb21pc2Uuc2V0KHRoaXMsICgpID0+IHsgfSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9lbmRQcm9taXNlLnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfRXZlbnRTdHJlYW1fcmVzb2x2ZUVuZFByb21pc2Uuc2V0KHRoaXMsICgpID0+IHsgfSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9yZWplY3RFbmRQcm9taXNlLnNldCh0aGlzLCAoKSA9PiB7IH0pO1xuICAgICAgICBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLnNldCh0aGlzLCB7fSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9lbmRlZC5zZXQodGhpcywgZmFsc2UpO1xuICAgICAgICBfRXZlbnRTdHJlYW1fZXJyb3JlZC5zZXQodGhpcywgZmFsc2UpO1xuICAgICAgICBfRXZlbnRTdHJlYW1fYWJvcnRlZC5zZXQodGhpcywgZmFsc2UpO1xuICAgICAgICBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZC5zZXQodGhpcywgZmFsc2UpO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9jb25uZWN0ZWRQcm9taXNlLCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZXNvbHZlQ29ubmVjdGVkUHJvbWlzZSwgcmVzb2x2ZSwgXCJmXCIpO1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVqZWN0Q29ubmVjdGVkUHJvbWlzZSwgcmVqZWN0LCBcImZcIik7XG4gICAgICAgIH0pLCBcImZcIik7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2VuZFByb21pc2UsIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX3Jlc29sdmVFbmRQcm9taXNlLCByZXNvbHZlLCBcImZcIik7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZWplY3RFbmRQcm9taXNlLCByZWplY3QsIFwiZlwiKTtcbiAgICAgICAgfSksIFwiZlwiKTtcbiAgICAgICAgLy8gRG9uJ3QgbGV0IHRoZXNlIHByb21pc2VzIGNhdXNlIHVuaGFuZGxlZCByZWplY3Rpb24gZXJyb3JzLlxuICAgICAgICAvLyB3ZSB3aWxsIG1hbnVhbGx5IGNhdXNlIGFuIHVuaGFuZGxlZCByZWplY3Rpb24gZXJyb3IgbGF0ZXJcbiAgICAgICAgLy8gaWYgdGhlIHVzZXIgaGFzbid0IHJlZ2lzdGVyZWQgYW55IGVycm9yIGxpc3RlbmVyIG9yIGNhbGxlZFxuICAgICAgICAvLyBhbnkgcHJvbWlzZS1yZXR1cm5pbmcgbWV0aG9kLlxuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9jb25uZWN0ZWRQcm9taXNlLCBcImZcIikuY2F0Y2goKCkgPT4geyB9KTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fZW5kUHJvbWlzZSwgXCJmXCIpLmNhdGNoKCgpID0+IHsgfSk7XG4gICAgfVxuICAgIF9ydW4oZXhlY3V0b3IpIHtcbiAgICAgICAgLy8gVW5mb3J0dW5hdGVseSBpZiB3ZSBjYWxsIGBleGVjdXRvcigpYCBpbW1lZGlhdGVseSB3ZSBnZXQgcnVudGltZSBlcnJvcnMgYWJvdXRcbiAgICAgICAgLy8gcmVmZXJlbmNlcyB0byBgdGhpc2AgYmVmb3JlIHRoZSBgc3VwZXIoKWAgY29uc3RydWN0b3IgY2FsbCByZXR1cm5zLlxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGV4ZWN1dG9yKCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdEZpbmFsKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnZW5kJyk7XG4gICAgICAgICAgICB9LCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfRXZlbnRTdHJlYW1faGFuZGxlRXJyb3IpLmJpbmQodGhpcykpO1xuICAgICAgICB9LCAwKTtcbiAgICB9XG4gICAgX2Nvbm5lY3RlZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5kZWQpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX3Jlc29sdmVDb25uZWN0ZWRQcm9taXNlLCBcImZcIikuY2FsbCh0aGlzKTtcbiAgICAgICAgdGhpcy5fZW1pdCgnY29ubmVjdCcpO1xuICAgIH1cbiAgICBnZXQgZW5kZWQoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lbmRlZCwgXCJmXCIpO1xuICAgIH1cbiAgICBnZXQgZXJyb3JlZCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2Vycm9yZWQsIFwiZlwiKTtcbiAgICB9XG4gICAgZ2V0IGFib3J0ZWQoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9hYm9ydGVkLCBcImZcIik7XG4gICAgfVxuICAgIGFib3J0KCkge1xuICAgICAgICB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWRkcyB0aGUgbGlzdGVuZXIgZnVuY3Rpb24gdG8gdGhlIGVuZCBvZiB0aGUgbGlzdGVuZXJzIGFycmF5IGZvciB0aGUgZXZlbnQuXG4gICAgICogTm8gY2hlY2tzIGFyZSBtYWRlIHRvIHNlZSBpZiB0aGUgbGlzdGVuZXIgaGFzIGFscmVhZHkgYmVlbiBhZGRlZC4gTXVsdGlwbGUgY2FsbHMgcGFzc2luZ1xuICAgICAqIHRoZSBzYW1lIGNvbWJpbmF0aW9uIG9mIGV2ZW50IGFuZCBsaXN0ZW5lciB3aWxsIHJlc3VsdCBpbiB0aGUgbGlzdGVuZXIgYmVpbmcgYWRkZWQsIGFuZFxuICAgICAqIGNhbGxlZCwgbXVsdGlwbGUgdGltZXMuXG4gICAgICogQHJldHVybnMgdGhpcyBDaGF0Q29tcGxldGlvblN0cmVhbSwgc28gdGhhdCBjYWxscyBjYW4gYmUgY2hhaW5lZFxuICAgICAqL1xuICAgIG9uKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF0gfHwgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XSA9IFtdKTtcbiAgICAgICAgbGlzdGVuZXJzLnB1c2goeyBsaXN0ZW5lciB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIHNwZWNpZmllZCBsaXN0ZW5lciBmcm9tIHRoZSBsaXN0ZW5lciBhcnJheSBmb3IgdGhlIGV2ZW50LlxuICAgICAqIG9mZigpIHdpbGwgcmVtb3ZlLCBhdCBtb3N0LCBvbmUgaW5zdGFuY2Ugb2YgYSBsaXN0ZW5lciBmcm9tIHRoZSBsaXN0ZW5lciBhcnJheS4gSWYgYW55IHNpbmdsZVxuICAgICAqIGxpc3RlbmVyIGhhcyBiZWVuIGFkZGVkIG11bHRpcGxlIHRpbWVzIHRvIHRoZSBsaXN0ZW5lciBhcnJheSBmb3IgdGhlIHNwZWNpZmllZCBldmVudCwgdGhlblxuICAgICAqIG9mZigpIG11c3QgYmUgY2FsbGVkIG11bHRpcGxlIHRpbWVzIHRvIHJlbW92ZSBlYWNoIGluc3RhbmNlLlxuICAgICAqIEByZXR1cm5zIHRoaXMgQ2hhdENvbXBsZXRpb25TdHJlYW0sIHNvIHRoYXQgY2FsbHMgY2FuIGJlIGNoYWluZWRcbiAgICAgKi9cbiAgICBvZmYoZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XTtcbiAgICAgICAgaWYgKCFsaXN0ZW5lcnMpXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgY29uc3QgaW5kZXggPSBsaXN0ZW5lcnMuZmluZEluZGV4KChsKSA9PiBsLmxpc3RlbmVyID09PSBsaXN0ZW5lcik7XG4gICAgICAgIGlmIChpbmRleCA+PSAwKVxuICAgICAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgb25lLXRpbWUgbGlzdGVuZXIgZnVuY3Rpb24gZm9yIHRoZSBldmVudC4gVGhlIG5leHQgdGltZSB0aGUgZXZlbnQgaXMgdHJpZ2dlcmVkLFxuICAgICAqIHRoaXMgbGlzdGVuZXIgaXMgcmVtb3ZlZCBhbmQgdGhlbiBpbnZva2VkLlxuICAgICAqIEByZXR1cm5zIHRoaXMgQ2hhdENvbXBsZXRpb25TdHJlYW0sIHNvIHRoYXQgY2FsbHMgY2FuIGJlIGNoYWluZWRcbiAgICAgKi9cbiAgICBvbmNlKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF0gfHwgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XSA9IFtdKTtcbiAgICAgICAgbGlzdGVuZXJzLnB1c2goeyBsaXN0ZW5lciwgb25jZTogdHJ1ZSB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgc2ltaWxhciB0byBgLm9uY2UoKWAsIGJ1dCByZXR1cm5zIGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRoZSBuZXh0IHRpbWVcbiAgICAgKiB0aGUgZXZlbnQgaXMgdHJpZ2dlcmVkLCBpbnN0ZWFkIG9mIGNhbGxpbmcgYSBsaXN0ZW5lciBjYWxsYmFjay5cbiAgICAgKiBAcmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB0aGUgbmV4dCB0aW1lIGdpdmVuIGV2ZW50IGlzIHRyaWdnZXJlZCxcbiAgICAgKiBvciByZWplY3RzIGlmIGFuIGVycm9yIGlzIGVtaXR0ZWQuICAoSWYgeW91IHJlcXVlc3QgdGhlICdlcnJvcicgZXZlbnQsXG4gICAgICogcmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBlcnJvcikuXG4gICAgICpcbiAgICAgKiBFeGFtcGxlOlxuICAgICAqXG4gICAgICogICBjb25zdCBtZXNzYWdlID0gYXdhaXQgc3RyZWFtLmVtaXR0ZWQoJ21lc3NhZ2UnKSAvLyByZWplY3RzIGlmIHRoZSBzdHJlYW0gZXJyb3JzXG4gICAgICovXG4gICAgZW1pdHRlZChldmVudCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZCwgdHJ1ZSwgXCJmXCIpO1xuICAgICAgICAgICAgaWYgKGV2ZW50ICE9PSAnZXJyb3InKVxuICAgICAgICAgICAgICAgIHRoaXMub25jZSgnZXJyb3InLCByZWplY3QpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKGV2ZW50LCByZXNvbHZlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIGRvbmUoKSB7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQsIHRydWUsIFwiZlwiKTtcbiAgICAgICAgYXdhaXQgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fZW5kUHJvbWlzZSwgXCJmXCIpO1xuICAgIH1cbiAgICBfZW1pdChldmVudCwgLi4uYXJncykge1xuICAgICAgICAvLyBtYWtlIHN1cmUgd2UgZG9uJ3QgZW1pdCBhbnkgZXZlbnRzIGFmdGVyIGVuZFxuICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fZW5kZWQsIFwiZlwiKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudCA9PT0gJ2VuZCcpIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2VuZGVkLCB0cnVlLCBcImZcIik7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZXNvbHZlRW5kUHJvbWlzZSwgXCJmXCIpLmNhbGwodGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdO1xuICAgICAgICBpZiAobGlzdGVuZXJzKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF0gPSBsaXN0ZW5lcnMuZmlsdGVyKChsKSA9PiAhbC5vbmNlKTtcbiAgICAgICAgICAgIGxpc3RlbmVycy5mb3JFYWNoKCh7IGxpc3RlbmVyIH0pID0+IGxpc3RlbmVyKC4uLmFyZ3MpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQgPT09ICdhYm9ydCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gYXJnc1swXTtcbiAgICAgICAgICAgIGlmICghX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZCwgXCJmXCIpICYmICFsaXN0ZW5lcnM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX3JlamVjdENvbm5lY3RlZFByb21pc2UsIFwiZlwiKS5jYWxsKHRoaXMsIGVycm9yKTtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX3JlamVjdEVuZFByb21pc2UsIFwiZlwiKS5jYWxsKHRoaXMsIGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2VuZCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudCA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgICAgLy8gTk9URTogX2VtaXQoJ2Vycm9yJywgZXJyb3IpIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tICNoYW5kbGVFcnJvcigpLlxuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBhcmdzWzBdO1xuICAgICAgICAgICAgaWYgKCFfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkLCBcImZcIikgJiYgIWxpc3RlbmVycz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gVHJpZ2dlciBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uIGlmIHRoZSB1c2VyIGhhc24ndCByZWdpc3RlcmVkIGFueSBlcnJvciBoYW5kbGVycy5cbiAgICAgICAgICAgICAgICAvLyBJZiB5b3UgYXJlIHNlZWluZyBzdGFjayB0cmFjZXMgaGVyZSwgbWFrZSBzdXJlIHRvIGhhbmRsZSBlcnJvcnMgdmlhIGVpdGhlcjpcbiAgICAgICAgICAgICAgICAvLyAtIHJ1bm5lci5vbignZXJyb3InLCAoKSA9PiAuLi4pXG4gICAgICAgICAgICAgICAgLy8gLSBhd2FpdCBydW5uZXIuZG9uZSgpXG4gICAgICAgICAgICAgICAgLy8gLSBhd2FpdCBydW5uZXIuZmluYWxDaGF0Q29tcGxldGlvbigpXG4gICAgICAgICAgICAgICAgLy8gLSBldGMuXG4gICAgICAgICAgICAgICAgUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVqZWN0Q29ubmVjdGVkUHJvbWlzZSwgXCJmXCIpLmNhbGwodGhpcywgZXJyb3IpO1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVqZWN0RW5kUHJvbWlzZSwgXCJmXCIpLmNhbGwodGhpcywgZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZW5kJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgX2VtaXRGaW5hbCgpIHsgfVxufVxuX0V2ZW50U3RyZWFtX2Nvbm5lY3RlZFByb21pc2UgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUNvbm5lY3RlZFByb21pc2UgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fcmVqZWN0Q29ubmVjdGVkUHJvbWlzZSA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9lbmRQcm9taXNlID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX3Jlc29sdmVFbmRQcm9taXNlID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX3JlamVjdEVuZFByb21pc2UgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2VuZGVkID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2Vycm9yZWQgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fYWJvcnRlZCA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2luc3RhbmNlcyA9IG5ldyBXZWFrU2V0KCksIF9FdmVudFN0cmVhbV9oYW5kbGVFcnJvciA9IGZ1bmN0aW9uIF9FdmVudFN0cmVhbV9oYW5kbGVFcnJvcihlcnJvcikge1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2Vycm9yZWQsIHRydWUsIFwiZlwiKTtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJiBlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcbiAgICAgICAgZXJyb3IgPSBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICB9XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQVBJVXNlckFib3J0RXJyb3IpIHtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fYWJvcnRlZCwgdHJ1ZSwgXCJmXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5fZW1pdCgnYWJvcnQnLCBlcnJvcik7XG4gICAgfVxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIE9wZW5BSUVycm9yKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICB9XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgY29uc3Qgb3BlbkFJRXJyb3IgPSBuZXcgT3BlbkFJRXJyb3IoZXJyb3IubWVzc2FnZSk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgb3BlbkFJRXJyb3IuY2F1c2UgPSBlcnJvcjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VtaXQoJ2Vycm9yJywgb3BlbkFJRXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZW1pdCgnZXJyb3InLCBuZXcgT3BlbkFJRXJyb3IoU3RyaW5nKGVycm9yKSkpO1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUV2ZW50U3RyZWFtLm1qcy5tYXAiLCJleHBvcnQgZnVuY3Rpb24gaXNSdW5uYWJsZUZ1bmN0aW9uV2l0aFBhcnNlKGZuKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBmbi5wYXJzZSA9PT0gJ2Z1bmN0aW9uJztcbn1cbi8qKlxuICogVGhpcyBpcyBoZWxwZXIgY2xhc3MgZm9yIHBhc3NpbmcgYSBgZnVuY3Rpb25gIGFuZCBgcGFyc2VgIHdoZXJlIHRoZSBgZnVuY3Rpb25gXG4gKiBhcmd1bWVudCB0eXBlIG1hdGNoZXMgdGhlIGBwYXJzZWAgcmV0dXJuIHR5cGUuXG4gKlxuICogQGRlcHJlY2F0ZWQgLSBwbGVhc2UgdXNlIFBhcnNpbmdUb29sRnVuY3Rpb24gaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhcnNpbmdGdW5jdGlvbiB7XG4gICAgY29uc3RydWN0b3IoaW5wdXQpIHtcbiAgICAgICAgdGhpcy5mdW5jdGlvbiA9IGlucHV0LmZ1bmN0aW9uO1xuICAgICAgICB0aGlzLnBhcnNlID0gaW5wdXQucGFyc2U7XG4gICAgICAgIHRoaXMucGFyYW1ldGVycyA9IGlucHV0LnBhcmFtZXRlcnM7XG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBpbnB1dC5kZXNjcmlwdGlvbjtcbiAgICAgICAgdGhpcy5uYW1lID0gaW5wdXQubmFtZTtcbiAgICB9XG59XG4vKipcbiAqIFRoaXMgaXMgaGVscGVyIGNsYXNzIGZvciBwYXNzaW5nIGEgYGZ1bmN0aW9uYCBhbmQgYHBhcnNlYCB3aGVyZSB0aGUgYGZ1bmN0aW9uYFxuICogYXJndW1lbnQgdHlwZSBtYXRjaGVzIHRoZSBgcGFyc2VgIHJldHVybiB0eXBlLlxuICovXG5leHBvcnQgY2xhc3MgUGFyc2luZ1Rvb2xGdW5jdGlvbiB7XG4gICAgY29uc3RydWN0b3IoaW5wdXQpIHtcbiAgICAgICAgdGhpcy50eXBlID0gJ2Z1bmN0aW9uJztcbiAgICAgICAgdGhpcy5mdW5jdGlvbiA9IGlucHV0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVJ1bm5hYmxlRnVuY3Rpb24ubWpzLm1hcCIsIi8qKlxuICogTGlrZSBgUHJvbWlzZS5hbGxTZXR0bGVkKClgIGJ1dCB0aHJvd3MgYW4gZXJyb3IgaWYgYW55IHByb21pc2VzIGFyZSByZWplY3RlZC5cbiAqL1xuZXhwb3J0IGNvbnN0IGFsbFNldHRsZWRXaXRoVGhyb3cgPSBhc3luYyAocHJvbWlzZXMpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHByb21pc2VzKTtcbiAgICBjb25zdCByZWplY3RlZCA9IHJlc3VsdHMuZmlsdGVyKChyZXN1bHQpID0+IHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpO1xuICAgIGlmIChyZWplY3RlZC5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVqZWN0ZWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IocmVzdWx0LnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3JlamVjdGVkLmxlbmd0aH0gcHJvbWlzZShzKSBmYWlsZWQgLSBzZWUgdGhlIGFib3ZlIGVycm9yc2ApO1xuICAgIH1cbiAgICAvLyBOb3RlOiBUUyB3YXMgY29tcGxhaW5pbmcgYWJvdXQgdXNpbmcgYC5maWx0ZXIoKS5tYXAoKWAgaGVyZSBmb3Igc29tZSByZWFzb25cbiAgICBjb25zdCB2YWx1ZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJykge1xuICAgICAgICAgICAgdmFsdWVzLnB1c2gocmVzdWx0LnZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVV0aWwubWpzLm1hcCIsImV4cG9ydCBjb25zdCBpc0Fzc2lzdGFudE1lc3NhZ2UgPSAobWVzc2FnZSkgPT4ge1xuICAgIHJldHVybiBtZXNzYWdlPy5yb2xlID09PSAnYXNzaXN0YW50Jztcbn07XG5leHBvcnQgY29uc3QgaXNGdW5jdGlvbk1lc3NhZ2UgPSAobWVzc2FnZSkgPT4ge1xuICAgIHJldHVybiBtZXNzYWdlPy5yb2xlID09PSAnZnVuY3Rpb24nO1xufTtcbmV4cG9ydCBjb25zdCBpc1Rvb2xNZXNzYWdlID0gKG1lc3NhZ2UpID0+IHtcbiAgICByZXR1cm4gbWVzc2FnZT8ucm9sZSA9PT0gJ3Rvb2wnO1xufTtcbmV4cG9ydCBmdW5jdGlvbiBpc1ByZXNlbnQob2JqKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hhdENvbXBsZXRpb25VdGlscy5tanMubWFwIiwiaW1wb3J0IHsgQ29udGVudEZpbHRlckZpbmlzaFJlYXNvbkVycm9yLCBMZW5ndGhGaW5pc2hSZWFzb25FcnJvciwgT3BlbkFJRXJyb3IgfSBmcm9tIFwiLi4vZXJyb3IubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gbWFrZVBhcnNlYWJsZVJlc3BvbnNlRm9ybWF0KHJlc3BvbnNlX2Zvcm1hdCwgcGFyc2VyKSB7XG4gICAgY29uc3Qgb2JqID0geyAuLi5yZXNwb25zZV9mb3JtYXQgfTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhvYmosIHtcbiAgICAgICAgJGJyYW5kOiB7XG4gICAgICAgICAgICB2YWx1ZTogJ2F1dG8tcGFyc2VhYmxlLXJlc3BvbnNlLWZvcm1hdCcsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgJHBhcnNlUmF3OiB7XG4gICAgICAgICAgICB2YWx1ZTogcGFyc2VyLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc0F1dG9QYXJzYWJsZVJlc3BvbnNlRm9ybWF0KHJlc3BvbnNlX2Zvcm1hdCkge1xuICAgIHJldHVybiByZXNwb25zZV9mb3JtYXQ/LlsnJGJyYW5kJ10gPT09ICdhdXRvLXBhcnNlYWJsZS1yZXNwb25zZS1mb3JtYXQnO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQYXJzZWFibGVUb29sKHRvb2wsIHsgcGFyc2VyLCBjYWxsYmFjaywgfSkge1xuICAgIGNvbnN0IG9iaiA9IHsgLi4udG9vbCB9O1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKG9iaiwge1xuICAgICAgICAkYnJhbmQ6IHtcbiAgICAgICAgICAgIHZhbHVlOiAnYXV0by1wYXJzZWFibGUtdG9vbCcsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgJHBhcnNlUmF3OiB7XG4gICAgICAgICAgICB2YWx1ZTogcGFyc2VyLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgICRjYWxsYmFjazoge1xuICAgICAgICAgICAgdmFsdWU6IGNhbGxiYWNrLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc0F1dG9QYXJzYWJsZVRvb2wodG9vbCkge1xuICAgIHJldHVybiB0b29sPy5bJyRicmFuZCddID09PSAnYXV0by1wYXJzZWFibGUtdG9vbCc7XG59XG5leHBvcnQgZnVuY3Rpb24gbWF5YmVQYXJzZUNoYXRDb21wbGV0aW9uKGNvbXBsZXRpb24sIHBhcmFtcykge1xuICAgIGlmICghcGFyYW1zIHx8ICFoYXNBdXRvUGFyc2VhYmxlSW5wdXQocGFyYW1zKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29tcGxldGlvbixcbiAgICAgICAgICAgIGNob2ljZXM6IGNvbXBsZXRpb24uY2hvaWNlcy5tYXAoKGNob2ljZSkgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi5jaG9pY2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogeyAuLi5jaG9pY2UubWVzc2FnZSwgcGFyc2VkOiBudWxsLCB0b29sX2NhbGxzOiBjaG9pY2UubWVzc2FnZS50b29sX2NhbGxzID8/IFtdIH0sXG4gICAgICAgICAgICB9KSksXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBwYXJzZUNoYXRDb21wbGV0aW9uKGNvbXBsZXRpb24sIHBhcmFtcyk7XG59XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDaGF0Q29tcGxldGlvbihjb21wbGV0aW9uLCBwYXJhbXMpIHtcbiAgICBjb25zdCBjaG9pY2VzID0gY29tcGxldGlvbi5jaG9pY2VzLm1hcCgoY2hvaWNlKSA9PiB7XG4gICAgICAgIGlmIChjaG9pY2UuZmluaXNoX3JlYXNvbiA9PT0gJ2xlbmd0aCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBMZW5ndGhGaW5pc2hSZWFzb25FcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaG9pY2UuZmluaXNoX3JlYXNvbiA9PT0gJ2NvbnRlbnRfZmlsdGVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IENvbnRlbnRGaWx0ZXJGaW5pc2hSZWFzb25FcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5jaG9pY2UsXG4gICAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICAgICAgLi4uY2hvaWNlLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgdG9vbF9jYWxsczogY2hvaWNlLm1lc3NhZ2UudG9vbF9jYWxscz8ubWFwKCh0b29sQ2FsbCkgPT4gcGFyc2VUb29sQ2FsbChwYXJhbXMsIHRvb2xDYWxsKSkgPz8gW10sXG4gICAgICAgICAgICAgICAgcGFyc2VkOiBjaG9pY2UubWVzc2FnZS5jb250ZW50ICYmICFjaG9pY2UubWVzc2FnZS5yZWZ1c2FsID9cbiAgICAgICAgICAgICAgICAgICAgcGFyc2VSZXNwb25zZUZvcm1hdChwYXJhbXMsIGNob2ljZS5tZXNzYWdlLmNvbnRlbnQpXG4gICAgICAgICAgICAgICAgICAgIDogbnVsbCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHsgLi4uY29tcGxldGlvbiwgY2hvaWNlcyB9O1xufVxuZnVuY3Rpb24gcGFyc2VSZXNwb25zZUZvcm1hdChwYXJhbXMsIGNvbnRlbnQpIHtcbiAgICBpZiAocGFyYW1zLnJlc3BvbnNlX2Zvcm1hdD8udHlwZSAhPT0gJ2pzb25fc2NoZW1hJykge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKHBhcmFtcy5yZXNwb25zZV9mb3JtYXQ/LnR5cGUgPT09ICdqc29uX3NjaGVtYScpIHtcbiAgICAgICAgaWYgKCckcGFyc2VSYXcnIGluIHBhcmFtcy5yZXNwb25zZV9mb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlX2Zvcm1hdCA9IHBhcmFtcy5yZXNwb25zZV9mb3JtYXQ7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VfZm9ybWF0LiRwYXJzZVJhdyhjb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShjb250ZW50KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5mdW5jdGlvbiBwYXJzZVRvb2xDYWxsKHBhcmFtcywgdG9vbENhbGwpIHtcbiAgICBjb25zdCBpbnB1dFRvb2wgPSBwYXJhbXMudG9vbHM/LmZpbmQoKGlucHV0VG9vbCkgPT4gaW5wdXRUb29sLmZ1bmN0aW9uPy5uYW1lID09PSB0b29sQ2FsbC5mdW5jdGlvbi5uYW1lKTtcbiAgICByZXR1cm4ge1xuICAgICAgICAuLi50b29sQ2FsbCxcbiAgICAgICAgZnVuY3Rpb246IHtcbiAgICAgICAgICAgIC4uLnRvb2xDYWxsLmZ1bmN0aW9uLFxuICAgICAgICAgICAgcGFyc2VkX2FyZ3VtZW50czogaXNBdXRvUGFyc2FibGVUb29sKGlucHV0VG9vbCkgPyBpbnB1dFRvb2wuJHBhcnNlUmF3KHRvb2xDYWxsLmZ1bmN0aW9uLmFyZ3VtZW50cylcbiAgICAgICAgICAgICAgICA6IGlucHV0VG9vbD8uZnVuY3Rpb24uc3RyaWN0ID8gSlNPTi5wYXJzZSh0b29sQ2FsbC5mdW5jdGlvbi5hcmd1bWVudHMpXG4gICAgICAgICAgICAgICAgICAgIDogbnVsbCxcbiAgICAgICAgfSxcbiAgICB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZFBhcnNlVG9vbENhbGwocGFyYW1zLCB0b29sQ2FsbCkge1xuICAgIGlmICghcGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgaW5wdXRUb29sID0gcGFyYW1zLnRvb2xzPy5maW5kKChpbnB1dFRvb2wpID0+IGlucHV0VG9vbC5mdW5jdGlvbj8ubmFtZSA9PT0gdG9vbENhbGwuZnVuY3Rpb24ubmFtZSk7XG4gICAgcmV0dXJuIGlzQXV0b1BhcnNhYmxlVG9vbChpbnB1dFRvb2wpIHx8IGlucHV0VG9vbD8uZnVuY3Rpb24uc3RyaWN0IHx8IGZhbHNlO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGhhc0F1dG9QYXJzZWFibGVJbnB1dChwYXJhbXMpIHtcbiAgICBpZiAoaXNBdXRvUGFyc2FibGVSZXNwb25zZUZvcm1hdChwYXJhbXMucmVzcG9uc2VfZm9ybWF0KSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIChwYXJhbXMudG9vbHM/LnNvbWUoKHQpID0+IGlzQXV0b1BhcnNhYmxlVG9vbCh0KSB8fCAodC50eXBlID09PSAnZnVuY3Rpb24nICYmIHQuZnVuY3Rpb24uc3RyaWN0ID09PSB0cnVlKSkgPz8gZmFsc2UpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlSW5wdXRUb29scyh0b29scykge1xuICAgIGZvciAoY29uc3QgdG9vbCBvZiB0b29scyA/PyBbXSkge1xuICAgICAgICBpZiAodG9vbC50eXBlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYEN1cnJlbnRseSBvbmx5IFxcYGZ1bmN0aW9uXFxgIHRvb2wgdHlwZXMgc3VwcG9ydCBhdXRvLXBhcnNpbmc7IFJlY2VpdmVkIFxcYCR7dG9vbC50eXBlfVxcYGApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0b29sLmZ1bmN0aW9uLnN0cmljdCAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBUaGUgXFxgJHt0b29sLmZ1bmN0aW9uLm5hbWV9XFxgIHRvb2wgaXMgbm90IG1hcmtlZCB3aXRoIFxcYHN0cmljdDogdHJ1ZVxcYC4gT25seSBzdHJpY3QgZnVuY3Rpb24gdG9vbHMgY2FuIGJlIGF1dG8tcGFyc2VkYCk7XG4gICAgICAgIH1cbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYXJzZXIubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBYnN0cmFjdFBhZ2UgfSBmcm9tIFwiLi9jb3JlLm1qc1wiO1xuLyoqXG4gKiBOb3RlOiBubyBwYWdpbmF0aW9uIGFjdHVhbGx5IG9jY3VycyB5ZXQsIHRoaXMgaXMgZm9yIGZvcndhcmRzLWNvbXBhdGliaWxpdHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYWdlIGV4dGVuZHMgQWJzdHJhY3RQYWdlIHtcbiAgICBjb25zdHJ1Y3RvcihjbGllbnQsIHJlc3BvbnNlLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKGNsaWVudCwgcmVzcG9uc2UsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmRhdGEgPSBib2R5LmRhdGEgfHwgW107XG4gICAgICAgIHRoaXMub2JqZWN0ID0gYm9keS5vYmplY3Q7XG4gICAgfVxuICAgIGdldFBhZ2luYXRlZEl0ZW1zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhID8/IFtdO1xuICAgIH1cbiAgICAvLyBAZGVwcmVjYXRlZCBQbGVhc2UgdXNlIGBuZXh0UGFnZUluZm8oKWAgaW5zdGVhZFxuICAgIC8qKlxuICAgICAqIFRoaXMgcGFnZSByZXByZXNlbnRzIGEgcmVzcG9uc2UgdGhhdCBpc24ndCBhY3R1YWxseSBwYWdpbmF0ZWQgYXQgdGhlIEFQSSBsZXZlbFxuICAgICAqIHNvIHRoZXJlIHdpbGwgbmV2ZXIgYmUgYW55IG5leHQgcGFnZSBwYXJhbXMuXG4gICAgICovXG4gICAgbmV4dFBhZ2VQYXJhbXMoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBuZXh0UGFnZUluZm8oKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDdXJzb3JQYWdlIGV4dGVuZHMgQWJzdHJhY3RQYWdlIHtcbiAgICBjb25zdHJ1Y3RvcihjbGllbnQsIHJlc3BvbnNlLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKGNsaWVudCwgcmVzcG9uc2UsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmRhdGEgPSBib2R5LmRhdGEgfHwgW107XG4gICAgICAgIHRoaXMuaGFzX21vcmUgPSBib2R5Lmhhc19tb3JlIHx8IGZhbHNlO1xuICAgIH1cbiAgICBnZXRQYWdpbmF0ZWRJdGVtcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YSA/PyBbXTtcbiAgICB9XG4gICAgaGFzTmV4dFBhZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc19tb3JlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdXBlci5oYXNOZXh0UGFnZSgpO1xuICAgIH1cbiAgICAvLyBAZGVwcmVjYXRlZCBQbGVhc2UgdXNlIGBuZXh0UGFnZUluZm8oKWAgaW5zdGVhZFxuICAgIG5leHRQYWdlUGFyYW1zKCkge1xuICAgICAgICBjb25zdCBpbmZvID0gdGhpcy5uZXh0UGFnZUluZm8oKTtcbiAgICAgICAgaWYgKCFpbmZvKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICgncGFyYW1zJyBpbiBpbmZvKVxuICAgICAgICAgICAgcmV0dXJuIGluZm8ucGFyYW1zO1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBPYmplY3QuZnJvbUVudHJpZXMoaW5mby51cmwuc2VhcmNoUGFyYW1zKTtcbiAgICAgICAgaWYgKCFPYmplY3Qua2V5cyhwYXJhbXMpLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgIH1cbiAgICBuZXh0UGFnZUluZm8oKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmdldFBhZ2luYXRlZEl0ZW1zKCk7XG4gICAgICAgIGlmICghZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGlkID0gZGF0YVtkYXRhLmxlbmd0aCAtIDFdPy5pZDtcbiAgICAgICAgaWYgKCFpZCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgcGFyYW1zOiB7IGFmdGVyOiBpZCB9IH07XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFnaW5hdGlvbi5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmV4cG9ydCBjbGFzcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoY2xpZW50KSB7XG4gICAgICAgIHRoaXMuX2NsaWVudCA9IGNsaWVudDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZXNvdXJjZS5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgU3BlZWNoQVBJIGZyb20gXCIuL3NwZWVjaC5tanNcIjtcbmltcG9ydCB7IFNwZWVjaCB9IGZyb20gXCIuL3NwZWVjaC5tanNcIjtcbmltcG9ydCAqIGFzIFRyYW5zY3JpcHRpb25zQVBJIGZyb20gXCIuL3RyYW5zY3JpcHRpb25zLm1qc1wiO1xuaW1wb3J0IHsgVHJhbnNjcmlwdGlvbnMsIH0gZnJvbSBcIi4vdHJhbnNjcmlwdGlvbnMubWpzXCI7XG5pbXBvcnQgKiBhcyBUcmFuc2xhdGlvbnNBUEkgZnJvbSBcIi4vdHJhbnNsYXRpb25zLm1qc1wiO1xuaW1wb3J0IHsgVHJhbnNsYXRpb25zLCB9IGZyb20gXCIuL3RyYW5zbGF0aW9ucy5tanNcIjtcbmV4cG9ydCBjbGFzcyBBdWRpbyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy50cmFuc2NyaXB0aW9ucyA9IG5ldyBUcmFuc2NyaXB0aW9uc0FQSS5UcmFuc2NyaXB0aW9ucyh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLnRyYW5zbGF0aW9ucyA9IG5ldyBUcmFuc2xhdGlvbnNBUEkuVHJhbnNsYXRpb25zKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMuc3BlZWNoID0gbmV3IFNwZWVjaEFQSS5TcGVlY2godGhpcy5fY2xpZW50KTtcbiAgICB9XG59XG5BdWRpby5UcmFuc2NyaXB0aW9ucyA9IFRyYW5zY3JpcHRpb25zO1xuQXVkaW8uVHJhbnNsYXRpb25zID0gVHJhbnNsYXRpb25zO1xuQXVkaW8uU3BlZWNoID0gU3BlZWNoO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXVkaW8ubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBTcGVlY2ggZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGF1ZGlvIGZyb20gdGhlIGlucHV0IHRleHQuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvYXVkaW8vc3BlZWNoJywge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IEFjY2VwdDogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgICAgIF9fYmluYXJ5UmVzcG9uc2U6IHRydWUsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXNwZWVjaC5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi4vLi4vY29yZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBUcmFuc2NyaXB0aW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9hdWRpby90cmFuc2NyaXB0aW9ucycsIENvcmUubXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zKHsgYm9keSwgLi4ub3B0aW9ucywgX19tZXRhZGF0YTogeyBtb2RlbDogYm9keS5tb2RlbCB9IH0pKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD10cmFuc2NyaXB0aW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi4vLi4vY29yZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBUcmFuc2xhdGlvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvYXVkaW8vdHJhbnNsYXRpb25zJywgQ29yZS5tdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMoeyBib2R5LCAuLi5vcHRpb25zLCBfX21ldGFkYXRhOiB7IG1vZGVsOiBib2R5Lm1vZGVsIH0gfSkpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXRyYW5zbGF0aW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEJhdGNoZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbmQgZXhlY3V0ZXMgYSBiYXRjaCBmcm9tIGFuIHVwbG9hZGVkIGZpbGUgb2YgcmVxdWVzdHNcbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9iYXRjaGVzJywgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSBiYXRjaC5cbiAgICAgKi9cbiAgICByZXRyaWV2ZShiYXRjaElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvYmF0Y2hlcy8ke2JhdGNoSWR9YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGxpc3QocXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3Qoe30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy9iYXRjaGVzJywgQmF0Y2hlc1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbmNlbHMgYW4gaW4tcHJvZ3Jlc3MgYmF0Y2guIFRoZSBiYXRjaCB3aWxsIGJlIGluIHN0YXR1cyBgY2FuY2VsbGluZ2AgZm9yIHVwIHRvXG4gICAgICogMTAgbWludXRlcywgYmVmb3JlIGNoYW5naW5nIHRvIGBjYW5jZWxsZWRgLCB3aGVyZSBpdCB3aWxsIGhhdmUgcGFydGlhbCByZXN1bHRzXG4gICAgICogKGlmIGFueSkgYXZhaWxhYmxlIGluIHRoZSBvdXRwdXQgZmlsZS5cbiAgICAgKi9cbiAgICBjYW5jZWwoYmF0Y2hJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC9iYXRjaGVzLyR7YmF0Y2hJZH0vY2FuY2VsYCwgb3B0aW9ucyk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEJhdGNoZXNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5CYXRjaGVzLkJhdGNoZXNQYWdlID0gQmF0Y2hlc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1iYXRjaGVzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgQXNzaXN0YW50cyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gYXNzaXN0YW50IHdpdGggYSBtb2RlbCBhbmQgaW5zdHJ1Y3Rpb25zLlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2Fzc2lzdGFudHMnLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYW4gYXNzaXN0YW50LlxuICAgICAqL1xuICAgIHJldHJpZXZlKGFzc2lzdGFudElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvYXNzaXN0YW50cy8ke2Fzc2lzdGFudElkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTW9kaWZpZXMgYW4gYXNzaXN0YW50LlxuICAgICAqL1xuICAgIHVwZGF0ZShhc3Npc3RhbnRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC9hc3Npc3RhbnRzLyR7YXNzaXN0YW50SWR9YCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGlzdChxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL2Fzc2lzdGFudHMnLCBBc3Npc3RhbnRzUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhbiBhc3Npc3RhbnQuXG4gICAgICovXG4gICAgZGVsKGFzc2lzdGFudElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvYXNzaXN0YW50cy8ke2Fzc2lzdGFudElkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQXNzaXN0YW50c1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkFzc2lzdGFudHMuQXNzaXN0YW50c1BhZ2UgPSBBc3Npc3RhbnRzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFzc2lzdGFudHMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIEFzc2lzdGFudHNBUEkgZnJvbSBcIi4vYXNzaXN0YW50cy5tanNcIjtcbmltcG9ydCAqIGFzIENoYXRBUEkgZnJvbSBcIi4vY2hhdC9jaGF0Lm1qc1wiO1xuaW1wb3J0IHsgQXNzaXN0YW50cywgQXNzaXN0YW50c1BhZ2UsIH0gZnJvbSBcIi4vYXNzaXN0YW50cy5tanNcIjtcbmltcG9ydCAqIGFzIFJlYWx0aW1lQVBJIGZyb20gXCIuL3JlYWx0aW1lL3JlYWx0aW1lLm1qc1wiO1xuaW1wb3J0IHsgUmVhbHRpbWUgfSBmcm9tIFwiLi9yZWFsdGltZS9yZWFsdGltZS5tanNcIjtcbmltcG9ydCAqIGFzIFRocmVhZHNBUEkgZnJvbSBcIi4vdGhyZWFkcy90aHJlYWRzLm1qc1wiO1xuaW1wb3J0IHsgVGhyZWFkcywgfSBmcm9tIFwiLi90aHJlYWRzL3RocmVhZHMubWpzXCI7XG5pbXBvcnQgKiBhcyBWZWN0b3JTdG9yZXNBUEkgZnJvbSBcIi4vdmVjdG9yLXN0b3Jlcy92ZWN0b3Itc3RvcmVzLm1qc1wiO1xuaW1wb3J0IHsgVmVjdG9yU3RvcmVzLCBWZWN0b3JTdG9yZXNQYWdlLCB9IGZyb20gXCIuL3ZlY3Rvci1zdG9yZXMvdmVjdG9yLXN0b3Jlcy5tanNcIjtcbmltcG9ydCB7IENoYXQgfSBmcm9tIFwiLi9jaGF0L2NoYXQubWpzXCI7XG5leHBvcnQgY2xhc3MgQmV0YSBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5yZWFsdGltZSA9IG5ldyBSZWFsdGltZUFQSS5SZWFsdGltZSh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLnZlY3RvclN0b3JlcyA9IG5ldyBWZWN0b3JTdG9yZXNBUEkuVmVjdG9yU3RvcmVzKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMuY2hhdCA9IG5ldyBDaGF0QVBJLkNoYXQodGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy5hc3Npc3RhbnRzID0gbmV3IEFzc2lzdGFudHNBUEkuQXNzaXN0YW50cyh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLnRocmVhZHMgPSBuZXcgVGhyZWFkc0FQSS5UaHJlYWRzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxufVxuQmV0YS5SZWFsdGltZSA9IFJlYWx0aW1lO1xuQmV0YS5WZWN0b3JTdG9yZXMgPSBWZWN0b3JTdG9yZXM7XG5CZXRhLlZlY3RvclN0b3Jlc1BhZ2UgPSBWZWN0b3JTdG9yZXNQYWdlO1xuQmV0YS5Bc3Npc3RhbnRzID0gQXNzaXN0YW50cztcbkJldGEuQXNzaXN0YW50c1BhZ2UgPSBBc3Npc3RhbnRzUGFnZTtcbkJldGEuVGhyZWFkcyA9IFRocmVhZHM7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1iZXRhLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBDb21wbGV0aW9uc0FQSSBmcm9tIFwiLi9jb21wbGV0aW9ucy5tanNcIjtcbmV4cG9ydCBjbGFzcyBDaGF0IGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25zID0gbmV3IENvbXBsZXRpb25zQVBJLkNvbXBsZXRpb25zKHRoaXMuX2NsaWVudCk7XG4gICAgfVxufVxuKGZ1bmN0aW9uIChDaGF0KSB7XG4gICAgQ2hhdC5Db21wbGV0aW9ucyA9IENvbXBsZXRpb25zQVBJLkNvbXBsZXRpb25zO1xufSkoQ2hhdCB8fCAoQ2hhdCA9IHt9KSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jaGF0Lm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBDaGF0Q29tcGxldGlvblJ1bm5lciB9IGZyb20gXCIuLi8uLi8uLi9saWIvQ2hhdENvbXBsZXRpb25SdW5uZXIubWpzXCI7XG5pbXBvcnQgeyBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lciwgfSBmcm9tIFwiLi4vLi4vLi4vbGliL0NoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25TdHJlYW0gfSBmcm9tIFwiLi4vLi4vLi4vbGliL0NoYXRDb21wbGV0aW9uU3RyZWFtLm1qc1wiO1xuaW1wb3J0IHsgcGFyc2VDaGF0Q29tcGxldGlvbiwgdmFsaWRhdGVJbnB1dFRvb2xzIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9wYXJzZXIubWpzXCI7XG5leHBvcnQgeyBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lciwgfSBmcm9tIFwiLi4vLi4vLi4vbGliL0NoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLm1qc1wiO1xuZXhwb3J0IHsgUGFyc2luZ0Z1bmN0aW9uLCBQYXJzaW5nVG9vbEZ1bmN0aW9uLCB9IGZyb20gXCIuLi8uLi8uLi9saWIvUnVubmFibGVGdW5jdGlvbi5tanNcIjtcbmV4cG9ydCB7IENoYXRDb21wbGV0aW9uU3RyZWFtIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9DaGF0Q29tcGxldGlvblN0cmVhbS5tanNcIjtcbmV4cG9ydCB7IENoYXRDb21wbGV0aW9uUnVubmVyLCB9IGZyb20gXCIuLi8uLi8uLi9saWIvQ2hhdENvbXBsZXRpb25SdW5uZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29tcGxldGlvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgcGFyc2UoYm9keSwgb3B0aW9ucykge1xuICAgICAgICB2YWxpZGF0ZUlucHV0VG9vbHMoYm9keS50b29scyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuY2hhdC5jb21wbGV0aW9uc1xuICAgICAgICAgICAgLmNyZWF0ZShib2R5LCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgIC4uLm9wdGlvbnM/LmhlYWRlcnMsXG4gICAgICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAnYmV0YS5jaGF0LmNvbXBsZXRpb25zLnBhcnNlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICAgICAgICAuX3RoZW5VbndyYXAoKGNvbXBsZXRpb24pID0+IHBhcnNlQ2hhdENvbXBsZXRpb24oY29tcGxldGlvbiwgYm9keSkpO1xuICAgIH1cbiAgICBydW5GdW5jdGlvbnMoYm9keSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoYm9keS5zdHJlYW0pIHtcbiAgICAgICAgICAgIHJldHVybiBDaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lci5ydW5GdW5jdGlvbnModGhpcy5fY2xpZW50LCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gQ2hhdENvbXBsZXRpb25SdW5uZXIucnVuRnVuY3Rpb25zKHRoaXMuX2NsaWVudCwgYm9keSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJ1blRvb2xzKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGJvZHkuc3RyZWFtKSB7XG4gICAgICAgICAgICByZXR1cm4gQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIucnVuVG9vbHModGhpcy5fY2xpZW50LCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gQ2hhdENvbXBsZXRpb25SdW5uZXIucnVuVG9vbHModGhpcy5fY2xpZW50LCBib2R5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGNoYXQgY29tcGxldGlvbiBzdHJlYW1cbiAgICAgKi9cbiAgICBzdHJlYW0oYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gQ2hhdENvbXBsZXRpb25TdHJlYW0uY3JlYXRlQ2hhdENvbXBsZXRpb24odGhpcy5fY2xpZW50LCBib2R5LCBvcHRpb25zKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb21wbGV0aW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgU2Vzc2lvbnNBUEkgZnJvbSBcIi4vc2Vzc2lvbnMubWpzXCI7XG5pbXBvcnQgeyBTZXNzaW9ucywgfSBmcm9tIFwiLi9zZXNzaW9ucy5tanNcIjtcbmV4cG9ydCBjbGFzcyBSZWFsdGltZSBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5zZXNzaW9ucyA9IG5ldyBTZXNzaW9uc0FQSS5TZXNzaW9ucyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbn1cblJlYWx0aW1lLlNlc3Npb25zID0gU2Vzc2lvbnM7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZWFsdGltZS5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFNlc3Npb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBlcGhlbWVyYWwgQVBJIHRva2VuIGZvciB1c2UgaW4gY2xpZW50LXNpZGUgYXBwbGljYXRpb25zIHdpdGggdGhlXG4gICAgICogUmVhbHRpbWUgQVBJLiBDYW4gYmUgY29uZmlndXJlZCB3aXRoIHRoZSBzYW1lIHNlc3Npb24gcGFyYW1ldGVycyBhcyB0aGVcbiAgICAgKiBgc2Vzc2lvbi51cGRhdGVgIGNsaWVudCBldmVudC5cbiAgICAgKlxuICAgICAqIEl0IHJlc3BvbmRzIHdpdGggYSBzZXNzaW9uIG9iamVjdCwgcGx1cyBhIGBjbGllbnRfc2VjcmV0YCBrZXkgd2hpY2ggY29udGFpbnMgYVxuICAgICAqIHVzYWJsZSBlcGhlbWVyYWwgQVBJIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gYXV0aGVudGljYXRlIGJyb3dzZXIgY2xpZW50cyBmb3JcbiAgICAgKiB0aGUgUmVhbHRpbWUgQVBJLlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL3JlYWx0aW1lL3Nlc3Npb25zJywge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zZXNzaW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIE1lc3NhZ2VzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG1lc3NhZ2UuXG4gICAgICovXG4gICAgY3JlYXRlKHRocmVhZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vbWVzc2FnZXNgLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBhIG1lc3NhZ2UuXG4gICAgICovXG4gICAgcmV0cmlldmUodGhyZWFkSWQsIG1lc3NhZ2VJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3RocmVhZHMvJHt0aHJlYWRJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBNb2RpZmllcyBhIG1lc3NhZ2UuXG4gICAgICovXG4gICAgdXBkYXRlKHRocmVhZElkLCBtZXNzYWdlSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsaXN0KHRocmVhZElkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh0aHJlYWRJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L21lc3NhZ2VzYCwgTWVzc2FnZXNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlcyBhIG1lc3NhZ2UuXG4gICAgICovXG4gICAgZGVsKHRocmVhZElkLCBtZXNzYWdlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC90aHJlYWRzLyR7dGhyZWFkSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgTWVzc2FnZXNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5NZXNzYWdlcy5NZXNzYWdlc1BhZ2UgPSBNZXNzYWdlc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tZXNzYWdlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQXNzaXN0YW50U3RyZWFtIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2xpYi9Bc3Npc3RhbnRTdHJlYW0ubWpzXCI7XG5pbXBvcnQgeyBzbGVlcCB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0ICogYXMgU3RlcHNBUEkgZnJvbSBcIi4vc3RlcHMubWpzXCI7XG5pbXBvcnQgeyBSdW5TdGVwc1BhZ2UsIFN0ZXBzLCB9IGZyb20gXCIuL3N0ZXBzLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFJ1bnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuc3RlcHMgPSBuZXcgU3RlcHNBUEkuU3RlcHModGhpcy5fY2xpZW50KTtcbiAgICB9XG4gICAgY3JlYXRlKHRocmVhZElkLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgeyBpbmNsdWRlLCAuLi5ib2R5IH0gPSBwYXJhbXM7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVuc2AsIHtcbiAgICAgICAgICAgIHF1ZXJ5OiB7IGluY2x1ZGUgfSxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgICAgIHN0cmVhbTogcGFyYW1zLnN0cmVhbSA/PyBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHJ1bi5cbiAgICAgKi9cbiAgICByZXRyaWV2ZSh0aHJlYWRJZCwgcnVuSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnMvJHtydW5JZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1vZGlmaWVzIGEgcnVuLlxuICAgICAqL1xuICAgIHVwZGF0ZSh0aHJlYWRJZCwgcnVuSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zLyR7cnVuSWR9YCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGlzdCh0aHJlYWRJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3QodGhyZWFkSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zYCwgUnVuc1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYW5jZWxzIGEgcnVuIHRoYXQgaXMgYGluX3Byb2dyZXNzYC5cbiAgICAgKi9cbiAgICBjYW5jZWwodGhyZWFkSWQsIHJ1bklkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVucy8ke3J1bklkfS9jYW5jZWxgLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEEgaGVscGVyIHRvIGNyZWF0ZSBhIHJ1biBhbiBwb2xsIGZvciBhIHRlcm1pbmFsIHN0YXRlLiBNb3JlIGluZm9ybWF0aW9uIG9uIFJ1blxuICAgICAqIGxpZmVjeWNsZXMgY2FuIGJlIGZvdW5kIGhlcmU6XG4gICAgICogaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy9ob3ctaXQtd29ya3MvcnVucy1hbmQtcnVuLXN0ZXBzXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlQW5kUG9sbCh0aHJlYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW4gPSBhd2FpdCB0aGlzLmNyZWF0ZSh0aHJlYWRJZCwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnBvbGwodGhyZWFkSWQsIHJ1bi5pZCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIFJ1biBzdHJlYW1cbiAgICAgKlxuICAgICAqIEBkZXByZWNhdGVkIHVzZSBgc3RyZWFtYCBpbnN0ZWFkXG4gICAgICovXG4gICAgY3JlYXRlQW5kU3RyZWFtKHRocmVhZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBBc3Npc3RhbnRTdHJlYW0uY3JlYXRlQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCB0aGlzLl9jbGllbnQuYmV0YS50aHJlYWRzLnJ1bnMsIGJvZHksIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBIGhlbHBlciB0byBwb2xsIGEgcnVuIHN0YXR1cyB1bnRpbCBpdCByZWFjaGVzIGEgdGVybWluYWwgc3RhdGUuIE1vcmVcbiAgICAgKiBpbmZvcm1hdGlvbiBvbiBSdW4gbGlmZWN5Y2xlcyBjYW4gYmUgZm91bmQgaGVyZTpcbiAgICAgKiBodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL2hvdy1pdC13b3Jrcy9ydW5zLWFuZC1ydW4tc3RlcHNcbiAgICAgKi9cbiAgICBhc3luYyBwb2xsKHRocmVhZElkLCBydW5JZCwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBoZWFkZXJzID0geyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtUG9sbC1IZWxwZXInOiAndHJ1ZScgfTtcbiAgICAgICAgaWYgKG9wdGlvbnM/LnBvbGxJbnRlcnZhbE1zKSB7XG4gICAgICAgICAgICBoZWFkZXJzWydYLVN0YWlubGVzcy1DdXN0b20tUG9sbC1JbnRlcnZhbCddID0gb3B0aW9ucy5wb2xsSW50ZXJ2YWxNcy50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBjb25zdCB7IGRhdGE6IHJ1biwgcmVzcG9uc2UgfSA9IGF3YWl0IHRoaXMucmV0cmlldmUodGhyZWFkSWQsIHJ1bklkLCB7XG4gICAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsIC4uLmhlYWRlcnMgfSxcbiAgICAgICAgICAgIH0pLndpdGhSZXNwb25zZSgpO1xuICAgICAgICAgICAgc3dpdGNoIChydW4uc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgLy9JZiB3ZSBhcmUgaW4gYW55IHNvcnQgb2YgaW50ZXJtZWRpYXRlIHN0YXRlIHdlIHBvbGxcbiAgICAgICAgICAgICAgICBjYXNlICdxdWV1ZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2luX3Byb2dyZXNzJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjYW5jZWxsaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNsZWVwSW50ZXJ2YWwgPSA1MDAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucz8ucG9sbEludGVydmFsTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNsZWVwSW50ZXJ2YWwgPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVySW50ZXJ2YWwgPSByZXNwb25zZS5oZWFkZXJzLmdldCgnb3BlbmFpLXBvbGwtYWZ0ZXItbXMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoZWFkZXJJbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlckludGVydmFsTXMgPSBwYXJzZUludChoZWFkZXJJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihoZWFkZXJJbnRlcnZhbE1zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbGVlcEludGVydmFsID0gaGVhZGVySW50ZXJ2YWxNcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAoc2xlZXBJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIC8vV2UgcmV0dXJuIHRoZSBydW4gaW4gYW55IHRlcm1pbmFsIHN0YXRlLlxuICAgICAgICAgICAgICAgIGNhc2UgJ3JlcXVpcmVzX2FjdGlvbic6XG4gICAgICAgICAgICAgICAgY2FzZSAnaW5jb21wbGV0ZSc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY2FuY2VsbGVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wbGV0ZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2ZhaWxlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnZXhwaXJlZCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydW47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgUnVuIHN0cmVhbVxuICAgICAqL1xuICAgIHN0cmVhbSh0aHJlYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gQXNzaXN0YW50U3RyZWFtLmNyZWF0ZUFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgdGhpcy5fY2xpZW50LmJldGEudGhyZWFkcy5ydW5zLCBib2R5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgc3VibWl0VG9vbE91dHB1dHModGhyZWFkSWQsIHJ1bklkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVucy8ke3J1bklkfS9zdWJtaXRfdG9vbF9vdXRwdXRzYCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICAgICAgc3RyZWFtOiBib2R5LnN0cmVhbSA/PyBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEEgaGVscGVyIHRvIHN1Ym1pdCBhIHRvb2wgb3V0cHV0IHRvIGEgcnVuIGFuZCBwb2xsIGZvciBhIHRlcm1pbmFsIHJ1biBzdGF0ZS5cbiAgICAgKiBNb3JlIGluZm9ybWF0aW9uIG9uIFJ1biBsaWZlY3ljbGVzIGNhbiBiZSBmb3VuZCBoZXJlOlxuICAgICAqIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvaG93LWl0LXdvcmtzL3J1bnMtYW5kLXJ1bi1zdGVwc1xuICAgICAqL1xuICAgIGFzeW5jIHN1Ym1pdFRvb2xPdXRwdXRzQW5kUG9sbCh0aHJlYWRJZCwgcnVuSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVuID0gYXdhaXQgdGhpcy5zdWJtaXRUb29sT3V0cHV0cyh0aHJlYWRJZCwgcnVuSWQsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wb2xsKHRocmVhZElkLCBydW4uaWQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTdWJtaXQgdGhlIHRvb2wgb3V0cHV0cyBmcm9tIGEgcHJldmlvdXMgcnVuIGFuZCBzdHJlYW0gdGhlIHJ1biB0byBhIHRlcm1pbmFsXG4gICAgICogc3RhdGUuIE1vcmUgaW5mb3JtYXRpb24gb24gUnVuIGxpZmVjeWNsZXMgY2FuIGJlIGZvdW5kIGhlcmU6XG4gICAgICogaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy9ob3ctaXQtd29ya3MvcnVucy1hbmQtcnVuLXN0ZXBzXG4gICAgICovXG4gICAgc3VibWl0VG9vbE91dHB1dHNTdHJlYW0odGhyZWFkSWQsIHJ1bklkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBBc3Npc3RhbnRTdHJlYW0uY3JlYXRlVG9vbEFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVuSWQsIHRoaXMuX2NsaWVudC5iZXRhLnRocmVhZHMucnVucywgYm9keSwgb3B0aW9ucyk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFJ1bnNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5SdW5zLlJ1bnNQYWdlID0gUnVuc1BhZ2U7XG5SdW5zLlN0ZXBzID0gU3RlcHM7XG5SdW5zLlJ1blN0ZXBzUGFnZSA9IFJ1blN0ZXBzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJ1bnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBTdGVwcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICByZXRyaWV2ZSh0aHJlYWRJZCwgcnVuSWQsIHN0ZXBJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHJpZXZlKHRocmVhZElkLCBydW5JZCwgc3RlcElkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zLyR7cnVuSWR9L3N0ZXBzLyR7c3RlcElkfWAsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsaXN0KHRocmVhZElkLCBydW5JZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3QodGhyZWFkSWQsIHJ1bklkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVucy8ke3J1bklkfS9zdGVwc2AsIFJ1blN0ZXBzUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFJ1blN0ZXBzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuU3RlcHMuUnVuU3RlcHNQYWdlID0gUnVuU3RlcHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3RlcHMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEFzc2lzdGFudFN0cmVhbSB9IGZyb20gXCIuLi8uLi8uLi9saWIvQXNzaXN0YW50U3RyZWFtLm1qc1wiO1xuaW1wb3J0ICogYXMgTWVzc2FnZXNBUEkgZnJvbSBcIi4vbWVzc2FnZXMubWpzXCI7XG5pbXBvcnQgeyBNZXNzYWdlcywgTWVzc2FnZXNQYWdlLCB9IGZyb20gXCIuL21lc3NhZ2VzLm1qc1wiO1xuaW1wb3J0ICogYXMgUnVuc0FQSSBmcm9tIFwiLi9ydW5zL3J1bnMubWpzXCI7XG5pbXBvcnQgeyBSdW5zLCBSdW5zUGFnZSwgfSBmcm9tIFwiLi9ydW5zL3J1bnMubWpzXCI7XG5leHBvcnQgY2xhc3MgVGhyZWFkcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5ydW5zID0gbmV3IFJ1bnNBUEkuUnVucyh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VzQVBJLk1lc3NhZ2VzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxuICAgIGNyZWF0ZShib2R5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMoYm9keSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZSh7fSwgYm9keSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvdGhyZWFkcycsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHRocmVhZC5cbiAgICAgKi9cbiAgICByZXRyaWV2ZSh0aHJlYWRJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3RocmVhZHMvJHt0aHJlYWRJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1vZGlmaWVzIGEgdGhyZWFkLlxuICAgICAqL1xuICAgIHVwZGF0ZSh0aHJlYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9YCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGEgdGhyZWFkLlxuICAgICAqL1xuICAgIGRlbCh0aHJlYWRJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL3RocmVhZHMvJHt0aHJlYWRJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNyZWF0ZUFuZFJ1bihib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL3RocmVhZHMvcnVucycsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgICAgIHN0cmVhbTogYm9keS5zdHJlYW0gPz8gZmFsc2UsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBIGhlbHBlciB0byBjcmVhdGUgYSB0aHJlYWQsIHN0YXJ0IGEgcnVuIGFuZCB0aGVuIHBvbGwgZm9yIGEgdGVybWluYWwgc3RhdGUuXG4gICAgICogTW9yZSBpbmZvcm1hdGlvbiBvbiBSdW4gbGlmZWN5Y2xlcyBjYW4gYmUgZm91bmQgaGVyZTpcbiAgICAgKiBodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL2hvdy1pdC13b3Jrcy9ydW5zLWFuZC1ydW4tc3RlcHNcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVBbmRSdW5Qb2xsKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVuID0gYXdhaXQgdGhpcy5jcmVhdGVBbmRSdW4oYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJ1bnMucG9sbChydW4udGhyZWFkX2lkLCBydW4uaWQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSB0aHJlYWQgYW5kIHN0cmVhbSB0aGUgcnVuIGJhY2tcbiAgICAgKi9cbiAgICBjcmVhdGVBbmRSdW5TdHJlYW0oYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gQXNzaXN0YW50U3RyZWFtLmNyZWF0ZVRocmVhZEFzc2lzdGFudFN0cmVhbShib2R5LCB0aGlzLl9jbGllbnQuYmV0YS50aHJlYWRzLCBvcHRpb25zKTtcbiAgICB9XG59XG5UaHJlYWRzLlJ1bnMgPSBSdW5zO1xuVGhyZWFkcy5SdW5zUGFnZSA9IFJ1bnNQYWdlO1xuVGhyZWFkcy5NZXNzYWdlcyA9IE1lc3NhZ2VzO1xuVGhyZWFkcy5NZXNzYWdlc1BhZ2UgPSBNZXNzYWdlc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10aHJlYWRzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBzbGVlcCB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgYWxsU2V0dGxlZFdpdGhUaHJvdyB9IGZyb20gXCIuLi8uLi8uLi9saWIvVXRpbC5tanNcIjtcbmltcG9ydCB7IFZlY3RvclN0b3JlRmlsZXNQYWdlIH0gZnJvbSBcIi4vZmlsZXMubWpzXCI7XG5leHBvcnQgY2xhc3MgRmlsZUJhdGNoZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgdmVjdG9yIHN0b3JlIGZpbGUgYmF0Y2guXG4gICAgICovXG4gICAgY3JlYXRlKHZlY3RvclN0b3JlSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVfYmF0Y2hlc2AsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHZlY3RvciBzdG9yZSBmaWxlIGJhdGNoLlxuICAgICAqL1xuICAgIHJldHJpZXZlKHZlY3RvclN0b3JlSWQsIGJhdGNoSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZV9iYXRjaGVzLyR7YmF0Y2hJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbmNlbCBhIHZlY3RvciBzdG9yZSBmaWxlIGJhdGNoLiBUaGlzIGF0dGVtcHRzIHRvIGNhbmNlbCB0aGUgcHJvY2Vzc2luZyBvZlxuICAgICAqIGZpbGVzIGluIHRoaXMgYmF0Y2ggYXMgc29vbiBhcyBwb3NzaWJsZS5cbiAgICAgKi9cbiAgICBjYW5jZWwodmVjdG9yU3RvcmVJZCwgYmF0Y2hJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZV9iYXRjaGVzLyR7YmF0Y2hJZH0vY2FuY2VsYCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSB2ZWN0b3Igc3RvcmUgYmF0Y2ggYW5kIHBvbGwgdW50aWwgYWxsIGZpbGVzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlQW5kUG9sbCh2ZWN0b3JTdG9yZUlkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoID0gYXdhaXQgdGhpcy5jcmVhdGUodmVjdG9yU3RvcmVJZCwgYm9keSk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnBvbGwodmVjdG9yU3RvcmVJZCwgYmF0Y2guaWQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBsaXN0RmlsZXModmVjdG9yU3RvcmVJZCwgYmF0Y2hJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3RGaWxlcyh2ZWN0b3JTdG9yZUlkLCBiYXRjaElkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlX2JhdGNoZXMvJHtiYXRjaElkfS9maWxlc2AsIFZlY3RvclN0b3JlRmlsZXNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zLCBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9IH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBXYWl0IGZvciB0aGUgZ2l2ZW4gZmlsZSBiYXRjaCB0byBiZSBwcm9jZXNzZWQuXG4gICAgICpcbiAgICAgKiBOb3RlOiB0aGlzIHdpbGwgcmV0dXJuIGV2ZW4gaWYgb25lIG9mIHRoZSBmaWxlcyBmYWlsZWQgdG8gcHJvY2VzcywgeW91IG5lZWQgdG9cbiAgICAgKiBjaGVjayBiYXRjaC5maWxlX2NvdW50cy5mYWlsZWRfY291bnQgdG8gaGFuZGxlIHRoaXMgY2FzZS5cbiAgICAgKi9cbiAgICBhc3luYyBwb2xsKHZlY3RvclN0b3JlSWQsIGJhdGNoSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLVBvbGwtSGVscGVyJzogJ3RydWUnIH07XG4gICAgICAgIGlmIChvcHRpb25zPy5wb2xsSW50ZXJ2YWxNcykge1xuICAgICAgICAgICAgaGVhZGVyc1snWC1TdGFpbmxlc3MtQ3VzdG9tLVBvbGwtSW50ZXJ2YWwnXSA9IG9wdGlvbnMucG9sbEludGVydmFsTXMudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgY29uc3QgeyBkYXRhOiBiYXRjaCwgcmVzcG9uc2UgfSA9IGF3YWl0IHRoaXMucmV0cmlldmUodmVjdG9yU3RvcmVJZCwgYmF0Y2hJZCwge1xuICAgICAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICAgIH0pLndpdGhSZXNwb25zZSgpO1xuICAgICAgICAgICAgc3dpdGNoIChiYXRjaC5zdGF0dXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdpbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICAgICAgICAgIGxldCBzbGVlcEludGVydmFsID0gNTAwMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnM/LnBvbGxJbnRlcnZhbE1zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzbGVlcEludGVydmFsID0gb3B0aW9ucy5wb2xsSW50ZXJ2YWxNcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlckludGVydmFsID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoJ29wZW5haS1wb2xsLWFmdGVyLW1zJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGVhZGVySW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJJbnRlcnZhbE1zID0gcGFyc2VJbnQoaGVhZGVySW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oaGVhZGVySW50ZXJ2YWxNcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2xlZXBJbnRlcnZhbCA9IGhlYWRlckludGVydmFsTXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNsZWVwKHNsZWVwSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdmYWlsZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2NhbmNlbGxlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcGxldGVkJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJhdGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFVwbG9hZHMgdGhlIGdpdmVuIGZpbGVzIGNvbmN1cnJlbnRseSBhbmQgdGhlbiBjcmVhdGVzIGEgdmVjdG9yIHN0b3JlIGZpbGUgYmF0Y2guXG4gICAgICpcbiAgICAgKiBUaGUgY29uY3VycmVuY3kgbGltaXQgaXMgY29uZmlndXJhYmxlIHVzaW5nIHRoZSBgbWF4Q29uY3VycmVuY3lgIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBhc3luYyB1cGxvYWRBbmRQb2xsKHZlY3RvclN0b3JlSWQsIHsgZmlsZXMsIGZpbGVJZHMgPSBbXSB9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChmaWxlcyA9PSBudWxsIHx8IGZpbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIFxcYGZpbGVzXFxgIHByb3ZpZGVkIHRvIHByb2Nlc3MuIElmIHlvdSd2ZSBhbHJlYWR5IHVwbG9hZGVkIGZpbGVzIHlvdSBzaG91bGQgdXNlIFxcYC5jcmVhdGVBbmRQb2xsKClcXGAgaW5zdGVhZGApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbmZpZ3VyZWRDb25jdXJyZW5jeSA9IG9wdGlvbnM/Lm1heENvbmN1cnJlbmN5ID8/IDU7XG4gICAgICAgIC8vIFdlIGNhcCB0aGUgbnVtYmVyIG9mIHdvcmtlcnMgYXQgdGhlIG51bWJlciBvZiBmaWxlcyAoc28gd2UgZG9uJ3Qgc3RhcnQgYW55IHVubmVjZXNzYXJ5IHdvcmtlcnMpXG4gICAgICAgIGNvbnN0IGNvbmN1cnJlbmN5TGltaXQgPSBNYXRoLm1pbihjb25maWd1cmVkQ29uY3VycmVuY3ksIGZpbGVzLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuX2NsaWVudDtcbiAgICAgICAgY29uc3QgZmlsZUl0ZXJhdG9yID0gZmlsZXMudmFsdWVzKCk7XG4gICAgICAgIGNvbnN0IGFsbEZpbGVJZHMgPSBbLi4uZmlsZUlkc107XG4gICAgICAgIC8vIFRoaXMgY29kZSBpcyBiYXNlZCBvbiB0aGlzIGRlc2lnbi4gVGhlIGxpYnJhcmllcyBkb24ndCBhY2NvbW1vZGF0ZSBvdXIgZW52aXJvbm1lbnQgbGltaXRzLlxuICAgICAgICAvLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80MDYzOTQzMi93aGF0LWlzLXRoZS1iZXN0LXdheS10by1saW1pdC1jb25jdXJyZW5jeS13aGVuLXVzaW5nLWVzNnMtcHJvbWlzZS1hbGxcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0ZpbGVzKGl0ZXJhdG9yKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGl0ZXJhdG9yKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZU9iaiA9IGF3YWl0IGNsaWVudC5maWxlcy5jcmVhdGUoeyBmaWxlOiBpdGVtLCBwdXJwb3NlOiAnYXNzaXN0YW50cycgfSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgYWxsRmlsZUlkcy5wdXNoKGZpbGVPYmouaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFN0YXJ0IHdvcmtlcnMgdG8gcHJvY2VzcyByZXN1bHRzXG4gICAgICAgIGNvbnN0IHdvcmtlcnMgPSBBcnJheShjb25jdXJyZW5jeUxpbWl0KS5maWxsKGZpbGVJdGVyYXRvcikubWFwKHByb2Nlc3NGaWxlcyk7XG4gICAgICAgIC8vIFdhaXQgZm9yIGFsbCBwcm9jZXNzaW5nIHRvIGNvbXBsZXRlLlxuICAgICAgICBhd2FpdCBhbGxTZXR0bGVkV2l0aFRocm93KHdvcmtlcnMpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jcmVhdGVBbmRQb2xsKHZlY3RvclN0b3JlSWQsIHtcbiAgICAgICAgICAgIGZpbGVfaWRzOiBhbGxGaWxlSWRzLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgeyBWZWN0b3JTdG9yZUZpbGVzUGFnZSB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZS1iYXRjaGVzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBzbGVlcCwgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEZpbGVzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIHZlY3RvciBzdG9yZSBmaWxlIGJ5IGF0dGFjaGluZyBhXG4gICAgICogW0ZpbGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmlsZXMpIHRvIGFcbiAgICAgKiBbdmVjdG9yIHN0b3JlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3ZlY3Rvci1zdG9yZXMvb2JqZWN0KS5cbiAgICAgKi9cbiAgICBjcmVhdGUodmVjdG9yU3RvcmVJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZXNgLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSB2ZWN0b3Igc3RvcmUgZmlsZS5cbiAgICAgKi9cbiAgICByZXRyaWV2ZSh2ZWN0b3JTdG9yZUlkLCBmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZXMvJHtmaWxlSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsaXN0KHZlY3RvclN0b3JlSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHZlY3RvclN0b3JlSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVzYCwgVmVjdG9yU3RvcmVGaWxlc1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSB2ZWN0b3Igc3RvcmUgZmlsZS4gVGhpcyB3aWxsIHJlbW92ZSB0aGUgZmlsZSBmcm9tIHRoZSB2ZWN0b3Igc3RvcmUgYnV0XG4gICAgICogdGhlIGZpbGUgaXRzZWxmIHdpbGwgbm90IGJlIGRlbGV0ZWQuIFRvIGRlbGV0ZSB0aGUgZmlsZSwgdXNlIHRoZVxuICAgICAqIFtkZWxldGUgZmlsZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maWxlcy9kZWxldGUpXG4gICAgICogZW5kcG9pbnQuXG4gICAgICovXG4gICAgZGVsKHZlY3RvclN0b3JlSWQsIGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlcy8ke2ZpbGVJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEF0dGFjaCBhIGZpbGUgdG8gdGhlIGdpdmVuIHZlY3RvciBzdG9yZSBhbmQgd2FpdCBmb3IgaXQgdG8gYmUgcHJvY2Vzc2VkLlxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUFuZFBvbGwodmVjdG9yU3RvcmVJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5jcmVhdGUodmVjdG9yU3RvcmVJZCwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnBvbGwodmVjdG9yU3RvcmVJZCwgZmlsZS5pZCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdhaXQgZm9yIHRoZSB2ZWN0b3Igc3RvcmUgZmlsZSB0byBmaW5pc2ggcHJvY2Vzc2luZy5cbiAgICAgKlxuICAgICAqIE5vdGU6IHRoaXMgd2lsbCByZXR1cm4gZXZlbiBpZiB0aGUgZmlsZSBmYWlsZWQgdG8gcHJvY2VzcywgeW91IG5lZWQgdG8gY2hlY2tcbiAgICAgKiBmaWxlLmxhc3RfZXJyb3IgYW5kIGZpbGUuc3RhdHVzIHRvIGhhbmRsZSB0aGVzZSBjYXNlc1xuICAgICAqL1xuICAgIGFzeW5jIHBvbGwodmVjdG9yU3RvcmVJZCwgZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1Qb2xsLUhlbHBlcic6ICd0cnVlJyB9O1xuICAgICAgICBpZiAob3B0aW9ucz8ucG9sbEludGVydmFsTXMpIHtcbiAgICAgICAgICAgIGhlYWRlcnNbJ1gtU3RhaW5sZXNzLUN1c3RvbS1Qb2xsLUludGVydmFsJ10gPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVSZXNwb25zZSA9IGF3YWl0IHRoaXMucmV0cmlldmUodmVjdG9yU3RvcmVJZCwgZmlsZUlkLCB7XG4gICAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICAgfSkud2l0aFJlc3BvbnNlKCk7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZmlsZVJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBzd2l0Y2ggKGZpbGUuc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgICAgICAgICBsZXQgc2xlZXBJbnRlcnZhbCA9IDUwMDA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zPy5wb2xsSW50ZXJ2YWxNcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2xlZXBJbnRlcnZhbCA9IG9wdGlvbnMucG9sbEludGVydmFsTXM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJJbnRlcnZhbCA9IGZpbGVSZXNwb25zZS5yZXNwb25zZS5oZWFkZXJzLmdldCgnb3BlbmFpLXBvbGwtYWZ0ZXItbXMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoZWFkZXJJbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlckludGVydmFsTXMgPSBwYXJzZUludChoZWFkZXJJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihoZWFkZXJJbnRlcnZhbE1zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbGVlcEludGVydmFsID0gaGVhZGVySW50ZXJ2YWxNcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAoc2xlZXBJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2ZhaWxlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcGxldGVkJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogVXBsb2FkIGEgZmlsZSB0byB0aGUgYGZpbGVzYCBBUEkgYW5kIHRoZW4gYXR0YWNoIGl0IHRvIHRoZSBnaXZlbiB2ZWN0b3Igc3RvcmUuXG4gICAgICpcbiAgICAgKiBOb3RlIHRoZSBmaWxlIHdpbGwgYmUgYXN5bmNocm9ub3VzbHkgcHJvY2Vzc2VkICh5b3UgY2FuIHVzZSB0aGUgYWx0ZXJuYXRpdmVcbiAgICAgKiBwb2xsaW5nIGhlbHBlciBtZXRob2QgdG8gd2FpdCBmb3IgcHJvY2Vzc2luZyB0byBjb21wbGV0ZSkuXG4gICAgICovXG4gICAgYXN5bmMgdXBsb2FkKHZlY3RvclN0b3JlSWQsIGZpbGUsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZmlsZUluZm8gPSBhd2FpdCB0aGlzLl9jbGllbnQuZmlsZXMuY3JlYXRlKHsgZmlsZTogZmlsZSwgcHVycG9zZTogJ2Fzc2lzdGFudHMnIH0sIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGUodmVjdG9yU3RvcmVJZCwgeyBmaWxlX2lkOiBmaWxlSW5mby5pZCB9LCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWRkIGEgZmlsZSB0byBhIHZlY3RvciBzdG9yZSBhbmQgcG9sbCB1bnRpbCBwcm9jZXNzaW5nIGlzIGNvbXBsZXRlLlxuICAgICAqL1xuICAgIGFzeW5jIHVwbG9hZEFuZFBvbGwodmVjdG9yU3RvcmVJZCwgZmlsZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IHRoaXMudXBsb2FkKHZlY3RvclN0b3JlSWQsIGZpbGUsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wb2xsKHZlY3RvclN0b3JlSWQsIGZpbGVJbmZvLmlkLCBvcHRpb25zKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVmVjdG9yU3RvcmVGaWxlc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkZpbGVzLlZlY3RvclN0b3JlRmlsZXNQYWdlID0gVmVjdG9yU3RvcmVGaWxlc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0ICogYXMgRmlsZUJhdGNoZXNBUEkgZnJvbSBcIi4vZmlsZS1iYXRjaGVzLm1qc1wiO1xuaW1wb3J0IHsgRmlsZUJhdGNoZXMsIH0gZnJvbSBcIi4vZmlsZS1iYXRjaGVzLm1qc1wiO1xuaW1wb3J0ICogYXMgRmlsZXNBUEkgZnJvbSBcIi4vZmlsZXMubWpzXCI7XG5pbXBvcnQgeyBGaWxlcywgVmVjdG9yU3RvcmVGaWxlc1BhZ2UsIH0gZnJvbSBcIi4vZmlsZXMubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgVmVjdG9yU3RvcmVzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmZpbGVzID0gbmV3IEZpbGVzQVBJLkZpbGVzKHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMuZmlsZUJhdGNoZXMgPSBuZXcgRmlsZUJhdGNoZXNBUEkuRmlsZUJhdGNoZXModGhpcy5fY2xpZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgdmVjdG9yIHN0b3JlLlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL3ZlY3Rvcl9zdG9yZXMnLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSB2ZWN0b3Igc3RvcmUuXG4gICAgICovXG4gICAgcmV0cmlldmUodmVjdG9yU3RvcmVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTW9kaWZpZXMgYSB2ZWN0b3Igc3RvcmUuXG4gICAgICovXG4gICAgdXBkYXRlKHZlY3RvclN0b3JlSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9YCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGlzdChxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL3ZlY3Rvcl9zdG9yZXMnLCBWZWN0b3JTdG9yZXNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGEgdmVjdG9yIHN0b3JlLlxuICAgICAqL1xuICAgIGRlbCh2ZWN0b3JTdG9yZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBWZWN0b3JTdG9yZXNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5WZWN0b3JTdG9yZXMuVmVjdG9yU3RvcmVzUGFnZSA9IFZlY3RvclN0b3Jlc1BhZ2U7XG5WZWN0b3JTdG9yZXMuRmlsZXMgPSBGaWxlcztcblZlY3RvclN0b3Jlcy5WZWN0b3JTdG9yZUZpbGVzUGFnZSA9IFZlY3RvclN0b3JlRmlsZXNQYWdlO1xuVmVjdG9yU3RvcmVzLkZpbGVCYXRjaGVzID0gRmlsZUJhdGNoZXM7XG4vLyMgc291cmNlTWFwcGluZ1VSTD12ZWN0b3Itc3RvcmVzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBDb21wbGV0aW9uc0FQSSBmcm9tIFwiLi9jb21wbGV0aW9ucy9jb21wbGV0aW9ucy5tanNcIjtcbmltcG9ydCB7IENoYXRDb21wbGV0aW9uc1BhZ2UsIENvbXBsZXRpb25zLCB9IGZyb20gXCIuL2NvbXBsZXRpb25zL2NvbXBsZXRpb25zLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENoYXQgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuY29tcGxldGlvbnMgPSBuZXcgQ29tcGxldGlvbnNBUEkuQ29tcGxldGlvbnModGhpcy5fY2xpZW50KTtcbiAgICB9XG59XG5DaGF0LkNvbXBsZXRpb25zID0gQ29tcGxldGlvbnM7XG5DaGF0LkNoYXRDb21wbGV0aW9uc1BhZ2UgPSBDaGF0Q29tcGxldGlvbnNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hhdC5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0ICogYXMgTWVzc2FnZXNBUEkgZnJvbSBcIi4vbWVzc2FnZXMubWpzXCI7XG5pbXBvcnQgeyBNZXNzYWdlcyB9IGZyb20gXCIuL21lc3NhZ2VzLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gbmV3IE1lc3NhZ2VzQVBJLk1lc3NhZ2VzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2NoYXQvY29tcGxldGlvbnMnLCB7IGJvZHksIC4uLm9wdGlvbnMsIHN0cmVhbTogYm9keS5zdHJlYW0gPz8gZmFsc2UgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEdldCBhIHN0b3JlZCBjaGF0IGNvbXBsZXRpb24uIE9ubHkgY2hhdCBjb21wbGV0aW9ucyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkIHdpdGhcbiAgICAgKiB0aGUgYHN0b3JlYCBwYXJhbWV0ZXIgc2V0IHRvIGB0cnVlYCB3aWxsIGJlIHJldHVybmVkLlxuICAgICAqL1xuICAgIHJldHJpZXZlKGNvbXBsZXRpb25JZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2NoYXQvY29tcGxldGlvbnMvJHtjb21wbGV0aW9uSWR9YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1vZGlmeSBhIHN0b3JlZCBjaGF0IGNvbXBsZXRpb24uIE9ubHkgY2hhdCBjb21wbGV0aW9ucyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkXG4gICAgICogd2l0aCB0aGUgYHN0b3JlYCBwYXJhbWV0ZXIgc2V0IHRvIGB0cnVlYCBjYW4gYmUgbW9kaWZpZWQuIEN1cnJlbnRseSwgdGhlIG9ubHlcbiAgICAgKiBzdXBwb3J0ZWQgbW9kaWZpY2F0aW9uIGlzIHRvIHVwZGF0ZSB0aGUgYG1ldGFkYXRhYCBmaWVsZC5cbiAgICAgKi9cbiAgICB1cGRhdGUoY29tcGxldGlvbklkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL2NoYXQvY29tcGxldGlvbnMvJHtjb21wbGV0aW9uSWR9YCwgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICBsaXN0KHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvY2hhdC9jb21wbGV0aW9ucycsIENoYXRDb21wbGV0aW9uc1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIHN0b3JlZCBjaGF0IGNvbXBsZXRpb24uIE9ubHkgY2hhdCBjb21wbGV0aW9ucyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkXG4gICAgICogd2l0aCB0aGUgYHN0b3JlYCBwYXJhbWV0ZXIgc2V0IHRvIGB0cnVlYCBjYW4gYmUgZGVsZXRlZC5cbiAgICAgKi9cbiAgICBkZWwoY29tcGxldGlvbklkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvY2hhdC9jb21wbGV0aW9ucy8ke2NvbXBsZXRpb25JZH1gLCBvcHRpb25zKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQ2hhdENvbXBsZXRpb25zUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuZXhwb3J0IGNsYXNzIENoYXRDb21wbGV0aW9uU3RvcmVNZXNzYWdlc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkNvbXBsZXRpb25zLkNoYXRDb21wbGV0aW9uc1BhZ2UgPSBDaGF0Q29tcGxldGlvbnNQYWdlO1xuQ29tcGxldGlvbnMuTWVzc2FnZXMgPSBNZXNzYWdlcztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbXBsZXRpb25zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDaGF0Q29tcGxldGlvblN0b3JlTWVzc2FnZXNQYWdlIH0gZnJvbSBcIi4vY29tcGxldGlvbnMubWpzXCI7XG5leHBvcnQgY2xhc3MgTWVzc2FnZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgbGlzdChjb21wbGV0aW9uSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KGNvbXBsZXRpb25JZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC9jaGF0L2NvbXBsZXRpb25zLyR7Y29tcGxldGlvbklkfS9tZXNzYWdlc2AsIENoYXRDb21wbGV0aW9uU3RvcmVNZXNzYWdlc1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxufVxuZXhwb3J0IHsgQ2hhdENvbXBsZXRpb25TdG9yZU1lc3NhZ2VzUGFnZSB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bWVzc2FnZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb21wbGV0aW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9jb21wbGV0aW9ucycsIHsgYm9keSwgLi4ub3B0aW9ucywgc3RyZWFtOiBib2R5LnN0cmVhbSA/PyBmYWxzZSB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb21wbGV0aW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEVtYmVkZGluZ3MgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBlbWJlZGRpbmcgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgaW5wdXQgdGV4dC5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9lbWJlZGRpbmdzJywgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVtYmVkZGluZ3MubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IHNsZWVwIH0gZnJvbSBcIi4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBBUElDb25uZWN0aW9uVGltZW91dEVycm9yIH0gZnJvbSBcIi4uL2Vycm9yLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBGaWxlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBVcGxvYWQgYSBmaWxlIHRoYXQgY2FuIGJlIHVzZWQgYWNyb3NzIHZhcmlvdXMgZW5kcG9pbnRzLiBJbmRpdmlkdWFsIGZpbGVzIGNhbiBiZVxuICAgICAqIHVwIHRvIDUxMiBNQiwgYW5kIHRoZSBzaXplIG9mIGFsbCBmaWxlcyB1cGxvYWRlZCBieSBvbmUgb3JnYW5pemF0aW9uIGNhbiBiZSB1cFxuICAgICAqIHRvIDEwMCBHQi5cbiAgICAgKlxuICAgICAqIFRoZSBBc3Npc3RhbnRzIEFQSSBzdXBwb3J0cyBmaWxlcyB1cCB0byAyIG1pbGxpb24gdG9rZW5zIGFuZCBvZiBzcGVjaWZpYyBmaWxlXG4gICAgICogdHlwZXMuIFNlZSB0aGVcbiAgICAgKiBbQXNzaXN0YW50cyBUb29scyBndWlkZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy90b29scykgZm9yXG4gICAgICogZGV0YWlscy5cbiAgICAgKlxuICAgICAqIFRoZSBGaW5lLXR1bmluZyBBUEkgb25seSBzdXBwb3J0cyBgLmpzb25sYCBmaWxlcy4gVGhlIGlucHV0IGFsc28gaGFzIGNlcnRhaW5cbiAgICAgKiByZXF1aXJlZCBmb3JtYXRzIGZvciBmaW5lLXR1bmluZ1xuICAgICAqIFtjaGF0XShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbmUtdHVuaW5nL2NoYXQtaW5wdXQpIG9yXG4gICAgICogW2NvbXBsZXRpb25zXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbmUtdHVuaW5nL2NvbXBsZXRpb25zLWlucHV0KVxuICAgICAqIG1vZGVscy5cbiAgICAgKlxuICAgICAqIFRoZSBCYXRjaCBBUEkgb25seSBzdXBwb3J0cyBgLmpzb25sYCBmaWxlcyB1cCB0byAyMDAgTUIgaW4gc2l6ZS4gVGhlIGlucHV0IGFsc29cbiAgICAgKiBoYXMgYSBzcGVjaWZpYyByZXF1aXJlZFxuICAgICAqIFtmb3JtYXRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvYmF0Y2gvcmVxdWVzdC1pbnB1dCkuXG4gICAgICpcbiAgICAgKiBQbGVhc2UgW2NvbnRhY3QgdXNdKGh0dHBzOi8vaGVscC5vcGVuYWkuY29tLykgaWYgeW91IG5lZWQgdG8gaW5jcmVhc2UgdGhlc2VcbiAgICAgKiBzdG9yYWdlIGxpbWl0cy5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9maWxlcycsIENvcmUubXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zKHsgYm9keSwgLi4ub3B0aW9ucyB9KSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgYSBzcGVjaWZpYyBmaWxlLlxuICAgICAqL1xuICAgIHJldHJpZXZlKGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2ZpbGVzLyR7ZmlsZUlkfWAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBsaXN0KHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvZmlsZXMnLCBGaWxlT2JqZWN0c1BhZ2UsIHsgcXVlcnksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIGZpbGUuXG4gICAgICovXG4gICAgZGVsKGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL2ZpbGVzLyR7ZmlsZUlkfWAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBjb250ZW50cyBvZiB0aGUgc3BlY2lmaWVkIGZpbGUuXG4gICAgICovXG4gICAgY29udGVudChmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9maWxlcy8ke2ZpbGVJZH0vY29udGVudGAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IEFjY2VwdDogJ2FwcGxpY2F0aW9uL2JpbmFyeScsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgICAgIF9fYmluYXJ5UmVzcG9uc2U6IHRydWUsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBjb250ZW50cyBvZiB0aGUgc3BlY2lmaWVkIGZpbGUuXG4gICAgICpcbiAgICAgKiBAZGVwcmVjYXRlZCBUaGUgYC5jb250ZW50KClgIG1ldGhvZCBzaG91bGQgYmUgdXNlZCBpbnN0ZWFkXG4gICAgICovXG4gICAgcmV0cmlldmVDb250ZW50KGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2ZpbGVzLyR7ZmlsZUlkfS9jb250ZW50YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdhaXRzIGZvciB0aGUgZ2l2ZW4gZmlsZSB0byBiZSBwcm9jZXNzZWQsIGRlZmF1bHQgdGltZW91dCBpcyAzMCBtaW5zLlxuICAgICAqL1xuICAgIGFzeW5jIHdhaXRGb3JQcm9jZXNzaW5nKGlkLCB7IHBvbGxJbnRlcnZhbCA9IDUwMDAsIG1heFdhaXQgPSAzMCAqIDYwICogMTAwMCB9ID0ge30pIHtcbiAgICAgICAgY29uc3QgVEVSTUlOQUxfU1RBVEVTID0gbmV3IFNldChbJ3Byb2Nlc3NlZCcsICdlcnJvcicsICdkZWxldGVkJ10pO1xuICAgICAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgIGxldCBmaWxlID0gYXdhaXQgdGhpcy5yZXRyaWV2ZShpZCk7XG4gICAgICAgIHdoaWxlICghZmlsZS5zdGF0dXMgfHwgIVRFUk1JTkFMX1NUQVRFUy5oYXMoZmlsZS5zdGF0dXMpKSB7XG4gICAgICAgICAgICBhd2FpdCBzbGVlcChwb2xsSW50ZXJ2YWwpO1xuICAgICAgICAgICAgZmlsZSA9IGF3YWl0IHRoaXMucmV0cmlldmUoaWQpO1xuICAgICAgICAgICAgaWYgKERhdGUubm93KCkgLSBzdGFydCA+IG1heFdhaXQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvcih7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBHaXZpbmcgdXAgb24gd2FpdGluZyBmb3IgZmlsZSAke2lkfSB0byBmaW5pc2ggcHJvY2Vzc2luZyBhZnRlciAke21heFdhaXR9IG1pbGxpc2Vjb25kcy5gLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBGaWxlT2JqZWN0c1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbkZpbGVzLkZpbGVPYmplY3RzUGFnZSA9IEZpbGVPYmplY3RzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGVzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBKb2JzQVBJIGZyb20gXCIuL2pvYnMvam9icy5tanNcIjtcbmltcG9ydCB7IEZpbmVUdW5pbmdKb2JFdmVudHNQYWdlLCBGaW5lVHVuaW5nSm9ic1BhZ2UsIEpvYnMsIH0gZnJvbSBcIi4vam9icy9qb2JzLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEZpbmVUdW5pbmcgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuam9icyA9IG5ldyBKb2JzQVBJLkpvYnModGhpcy5fY2xpZW50KTtcbiAgICB9XG59XG5GaW5lVHVuaW5nLkpvYnMgPSBKb2JzO1xuRmluZVR1bmluZy5GaW5lVHVuaW5nSm9ic1BhZ2UgPSBGaW5lVHVuaW5nSm9ic1BhZ2U7XG5GaW5lVHVuaW5nLkZpbmVUdW5pbmdKb2JFdmVudHNQYWdlID0gRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1maW5lLXR1bmluZy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENoZWNrcG9pbnRzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGxpc3QoZmluZVR1bmluZ0pvYklkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdChmaW5lVHVuaW5nSm9iSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvZmluZV90dW5pbmcvam9icy8ke2ZpbmVUdW5pbmdKb2JJZH0vY2hlY2twb2ludHNgLCBGaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBGaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5DaGVja3BvaW50cy5GaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlID0gRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNoZWNrcG9pbnRzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgKiBhcyBDaGVja3BvaW50c0FQSSBmcm9tIFwiLi9jaGVja3BvaW50cy5tanNcIjtcbmltcG9ydCB7IENoZWNrcG9pbnRzLCBGaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlLCB9IGZyb20gXCIuL2NoZWNrcG9pbnRzLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEpvYnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuY2hlY2twb2ludHMgPSBuZXcgQ2hlY2twb2ludHNBUEkuQ2hlY2twb2ludHModGhpcy5fY2xpZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZpbmUtdHVuaW5nIGpvYiB3aGljaCBiZWdpbnMgdGhlIHByb2Nlc3Mgb2YgY3JlYXRpbmcgYSBuZXcgbW9kZWwgZnJvbVxuICAgICAqIGEgZ2l2ZW4gZGF0YXNldC5cbiAgICAgKlxuICAgICAqIFJlc3BvbnNlIGluY2x1ZGVzIGRldGFpbHMgb2YgdGhlIGVucXVldWVkIGpvYiBpbmNsdWRpbmcgam9iIHN0YXR1cyBhbmQgdGhlIG5hbWVcbiAgICAgKiBvZiB0aGUgZmluZS10dW5lZCBtb2RlbHMgb25jZSBjb21wbGV0ZS5cbiAgICAgKlxuICAgICAqIFtMZWFybiBtb3JlIGFib3V0IGZpbmUtdHVuaW5nXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9ndWlkZXMvZmluZS10dW5pbmcpXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvZmluZV90dW5pbmcvam9icycsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2V0IGluZm8gYWJvdXQgYSBmaW5lLXR1bmluZyBqb2IuXG4gICAgICpcbiAgICAgKiBbTGVhcm4gbW9yZSBhYm91dCBmaW5lLXR1bmluZ10oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvZ3VpZGVzL2ZpbmUtdHVuaW5nKVxuICAgICAqL1xuICAgIHJldHJpZXZlKGZpbmVUdW5pbmdKb2JJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2ZpbmVfdHVuaW5nL2pvYnMvJHtmaW5lVHVuaW5nSm9iSWR9YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGxpc3QocXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3Qoe30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy9maW5lX3R1bmluZy9qb2JzJywgRmluZVR1bmluZ0pvYnNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGVseSBjYW5jZWwgYSBmaW5lLXR1bmUgam9iLlxuICAgICAqL1xuICAgIGNhbmNlbChmaW5lVHVuaW5nSm9iSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvZmluZV90dW5pbmcvam9icy8ke2ZpbmVUdW5pbmdKb2JJZH0vY2FuY2VsYCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGxpc3RFdmVudHMoZmluZVR1bmluZ0pvYklkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdEV2ZW50cyhmaW5lVHVuaW5nSm9iSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvZmluZV90dW5pbmcvam9icy8ke2ZpbmVUdW5pbmdKb2JJZH0vZXZlbnRzYCwgRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEZpbmVUdW5pbmdKb2JzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuZXhwb3J0IGNsYXNzIEZpbmVUdW5pbmdKb2JFdmVudHNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5Kb2JzLkZpbmVUdW5pbmdKb2JzUGFnZSA9IEZpbmVUdW5pbmdKb2JzUGFnZTtcbkpvYnMuRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2UgPSBGaW5lVHVuaW5nSm9iRXZlbnRzUGFnZTtcbkpvYnMuQ2hlY2twb2ludHMgPSBDaGVja3BvaW50cztcbkpvYnMuRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZSA9IEZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1qb2JzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuLi9jb3JlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEltYWdlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgdmFyaWF0aW9uIG9mIGEgZ2l2ZW4gaW1hZ2UuXG4gICAgICovXG4gICAgY3JlYXRlVmFyaWF0aW9uKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvaW1hZ2VzL3ZhcmlhdGlvbnMnLCBDb3JlLm11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyh7IGJvZHksIC4uLm9wdGlvbnMgfSkpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGVkaXRlZCBvciBleHRlbmRlZCBpbWFnZSBnaXZlbiBhbiBvcmlnaW5hbCBpbWFnZSBhbmQgYSBwcm9tcHQuXG4gICAgICovXG4gICAgZWRpdChib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2ltYWdlcy9lZGl0cycsIENvcmUubXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zKHsgYm9keSwgLi4ub3B0aW9ucyB9KSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gaW1hZ2UgZ2l2ZW4gYSBwcm9tcHQuXG4gICAgICovXG4gICAgZ2VuZXJhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9pbWFnZXMvZ2VuZXJhdGlvbnMnLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW1hZ2VzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBQYWdlIH0gZnJvbSBcIi4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgTW9kZWxzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIG1vZGVsIGluc3RhbmNlLCBwcm92aWRpbmcgYmFzaWMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1vZGVsIHN1Y2ggYXNcbiAgICAgKiB0aGUgb3duZXIgYW5kIHBlcm1pc3Npb25pbmcuXG4gICAgICovXG4gICAgcmV0cmlldmUobW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9tb2RlbHMvJHttb2RlbH1gLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTGlzdHMgdGhlIGN1cnJlbnRseSBhdmFpbGFibGUgbW9kZWxzLCBhbmQgcHJvdmlkZXMgYmFzaWMgaW5mb3JtYXRpb24gYWJvdXQgZWFjaFxuICAgICAqIG9uZSBzdWNoIGFzIHRoZSBvd25lciBhbmQgYXZhaWxhYmlsaXR5LlxuICAgICAqL1xuICAgIGxpc3Qob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy9tb2RlbHMnLCBNb2RlbHNQYWdlLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGEgZmluZS10dW5lZCBtb2RlbC4gWW91IG11c3QgaGF2ZSB0aGUgT3duZXIgcm9sZSBpbiB5b3VyIG9yZ2FuaXphdGlvbiB0b1xuICAgICAqIGRlbGV0ZSBhIG1vZGVsLlxuICAgICAqL1xuICAgIGRlbChtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL21vZGVscy8ke21vZGVsfWAsIG9wdGlvbnMpO1xuICAgIH1cbn1cbi8qKlxuICogTm90ZTogbm8gcGFnaW5hdGlvbiBhY3R1YWxseSBvY2N1cnMgeWV0LCB0aGlzIGlzIGZvciBmb3J3YXJkcy1jb21wYXRpYmlsaXR5LlxuICovXG5leHBvcnQgY2xhc3MgTW9kZWxzUGFnZSBleHRlbmRzIFBhZ2Uge1xufVxuTW9kZWxzLk1vZGVsc1BhZ2UgPSBNb2RlbHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bW9kZWxzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5leHBvcnQgY2xhc3MgTW9kZXJhdGlvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ2xhc3NpZmllcyBpZiB0ZXh0IGFuZC9vciBpbWFnZSBpbnB1dHMgYXJlIHBvdGVudGlhbGx5IGhhcm1mdWwuIExlYXJuIG1vcmUgaW5cbiAgICAgKiB0aGUgW21vZGVyYXRpb24gZ3VpZGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2d1aWRlcy9tb2RlcmF0aW9uKS5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9tb2RlcmF0aW9ucycsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tb2RlcmF0aW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi4vLi4vY29yZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBQYXJ0cyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBBZGRzIGFcbiAgICAgKiBbUGFydF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS91cGxvYWRzL3BhcnQtb2JqZWN0KSB0byBhblxuICAgICAqIFtVcGxvYWRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdXBsb2Fkcy9vYmplY3QpIG9iamVjdC5cbiAgICAgKiBBIFBhcnQgcmVwcmVzZW50cyBhIGNodW5rIG9mIGJ5dGVzIGZyb20gdGhlIGZpbGUgeW91IGFyZSB0cnlpbmcgdG8gdXBsb2FkLlxuICAgICAqXG4gICAgICogRWFjaCBQYXJ0IGNhbiBiZSBhdCBtb3N0IDY0IE1CLCBhbmQgeW91IGNhbiBhZGQgUGFydHMgdW50aWwgeW91IGhpdCB0aGUgVXBsb2FkXG4gICAgICogbWF4aW11bSBvZiA4IEdCLlxuICAgICAqXG4gICAgICogSXQgaXMgcG9zc2libGUgdG8gYWRkIG11bHRpcGxlIFBhcnRzIGluIHBhcmFsbGVsLiBZb3UgY2FuIGRlY2lkZSB0aGUgaW50ZW5kZWRcbiAgICAgKiBvcmRlciBvZiB0aGUgUGFydHMgd2hlbiB5b3VcbiAgICAgKiBbY29tcGxldGUgdGhlIFVwbG9hZF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS91cGxvYWRzL2NvbXBsZXRlKS5cbiAgICAgKi9cbiAgICBjcmVhdGUodXBsb2FkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdXBsb2Fkcy8ke3VwbG9hZElkfS9wYXJ0c2AsIENvcmUubXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zKHsgYm9keSwgLi4ub3B0aW9ucyB9KSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFydHMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIFBhcnRzQVBJIGZyb20gXCIuL3BhcnRzLm1qc1wiO1xuaW1wb3J0IHsgUGFydHMgfSBmcm9tIFwiLi9wYXJ0cy5tanNcIjtcbmV4cG9ydCBjbGFzcyBVcGxvYWRzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLnBhcnRzID0gbmV3IFBhcnRzQVBJLlBhcnRzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gaW50ZXJtZWRpYXRlXG4gICAgICogW1VwbG9hZF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS91cGxvYWRzL29iamVjdCkgb2JqZWN0XG4gICAgICogdGhhdCB5b3UgY2FuIGFkZFxuICAgICAqIFtQYXJ0c10oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS91cGxvYWRzL3BhcnQtb2JqZWN0KSB0by5cbiAgICAgKiBDdXJyZW50bHksIGFuIFVwbG9hZCBjYW4gYWNjZXB0IGF0IG1vc3QgOCBHQiBpbiB0b3RhbCBhbmQgZXhwaXJlcyBhZnRlciBhbiBob3VyXG4gICAgICogYWZ0ZXIgeW91IGNyZWF0ZSBpdC5cbiAgICAgKlxuICAgICAqIE9uY2UgeW91IGNvbXBsZXRlIHRoZSBVcGxvYWQsIHdlIHdpbGwgY3JlYXRlIGFcbiAgICAgKiBbRmlsZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maWxlcy9vYmplY3QpIG9iamVjdCB0aGF0XG4gICAgICogY29udGFpbnMgYWxsIHRoZSBwYXJ0cyB5b3UgdXBsb2FkZWQuIFRoaXMgRmlsZSBpcyB1c2FibGUgaW4gdGhlIHJlc3Qgb2Ygb3VyXG4gICAgICogcGxhdGZvcm0gYXMgYSByZWd1bGFyIEZpbGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogRm9yIGNlcnRhaW4gYHB1cnBvc2VgcywgdGhlIGNvcnJlY3QgYG1pbWVfdHlwZWAgbXVzdCBiZSBzcGVjaWZpZWQuIFBsZWFzZSByZWZlclxuICAgICAqIHRvIGRvY3VtZW50YXRpb24gZm9yIHRoZSBzdXBwb3J0ZWQgTUlNRSB0eXBlcyBmb3IgeW91ciB1c2UgY2FzZTpcbiAgICAgKlxuICAgICAqIC0gW0Fzc2lzdGFudHNdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvdG9vbHMvZmlsZS1zZWFyY2gjc3VwcG9ydGVkLWZpbGVzKVxuICAgICAqXG4gICAgICogRm9yIGd1aWRhbmNlIG9uIHRoZSBwcm9wZXIgZmlsZW5hbWUgZXh0ZW5zaW9ucyBmb3IgZWFjaCBwdXJwb3NlLCBwbGVhc2UgZm9sbG93XG4gICAgICogdGhlIGRvY3VtZW50YXRpb24gb25cbiAgICAgKiBbY3JlYXRpbmcgYSBGaWxlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbGVzL2NyZWF0ZSkuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvdXBsb2FkcycsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FuY2VscyB0aGUgVXBsb2FkLiBObyBQYXJ0cyBtYXkgYmUgYWRkZWQgYWZ0ZXIgYW4gVXBsb2FkIGlzIGNhbmNlbGxlZC5cbiAgICAgKi9cbiAgICBjYW5jZWwodXBsb2FkSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdXBsb2Fkcy8ke3VwbG9hZElkfS9jYW5jZWxgLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29tcGxldGVzIHRoZVxuICAgICAqIFtVcGxvYWRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdXBsb2Fkcy9vYmplY3QpLlxuICAgICAqXG4gICAgICogV2l0aGluIHRoZSByZXR1cm5lZCBVcGxvYWQgb2JqZWN0LCB0aGVyZSBpcyBhIG5lc3RlZFxuICAgICAqIFtGaWxlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbGVzL29iamVjdCkgb2JqZWN0IHRoYXRcbiAgICAgKiBpcyByZWFkeSB0byB1c2UgaW4gdGhlIHJlc3Qgb2YgdGhlIHBsYXRmb3JtLlxuICAgICAqXG4gICAgICogWW91IGNhbiBzcGVjaWZ5IHRoZSBvcmRlciBvZiB0aGUgUGFydHMgYnkgcGFzc2luZyBpbiBhbiBvcmRlcmVkIGxpc3Qgb2YgdGhlIFBhcnRcbiAgICAgKiBJRHMuXG4gICAgICpcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGJ5dGVzIHVwbG9hZGVkIHVwb24gY29tcGxldGlvbiBtdXN0IG1hdGNoIHRoZSBudW1iZXIgb2YgYnl0ZXNcbiAgICAgKiBpbml0aWFsbHkgc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgdGhlIFVwbG9hZCBvYmplY3QuIE5vIFBhcnRzIG1heSBiZSBhZGRlZCBhZnRlclxuICAgICAqIGFuIFVwbG9hZCBpcyBjb21wbGV0ZWQuXG4gICAgICovXG4gICAgY29tcGxldGUodXBsb2FkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdXBsb2Fkcy8ke3VwbG9hZElkfS9jb21wbGV0ZWAsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG59XG5VcGxvYWRzLlBhcnRzID0gUGFydHM7XG4vLyMgc291cmNlTWFwcGluZ1VSTD11cGxvYWRzLm1qcy5tYXAiLCJpbXBvcnQgeyBSZWFkYWJsZVN0cmVhbSB9IGZyb20gXCIuL19zaGltcy9pbmRleC5tanNcIjtcbmltcG9ydCB7IE9wZW5BSUVycm9yIH0gZnJvbSBcIi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgeyBMaW5lRGVjb2RlciB9IGZyb20gXCIuL2ludGVybmFsL2RlY29kZXJzL2xpbmUubWpzXCI7XG5pbXBvcnQgeyBSZWFkYWJsZVN0cmVhbVRvQXN5bmNJdGVyYWJsZSB9IGZyb20gXCIuL2ludGVybmFsL3N0cmVhbS11dGlscy5tanNcIjtcbmltcG9ydCB7IEFQSUVycm9yIH0gZnJvbSBcIi4vZXJyb3IubWpzXCI7XG5leHBvcnQgY2xhc3MgU3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcihpdGVyYXRvciwgY29udHJvbGxlcikge1xuICAgICAgICB0aGlzLml0ZXJhdG9yID0gaXRlcmF0b3I7XG4gICAgICAgIHRoaXMuY29udHJvbGxlciA9IGNvbnRyb2xsZXI7XG4gICAgfVxuICAgIHN0YXRpYyBmcm9tU1NFUmVzcG9uc2UocmVzcG9uc2UsIGNvbnRyb2xsZXIpIHtcbiAgICAgICAgbGV0IGNvbnN1bWVkID0gZmFsc2U7XG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uKiBpdGVyYXRvcigpIHtcbiAgICAgICAgICAgIGlmIChjb25zdW1lZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGl0ZXJhdGUgb3ZlciBhIGNvbnN1bWVkIHN0cmVhbSwgdXNlIGAudGVlKClgIHRvIHNwbGl0IHRoZSBzdHJlYW0uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdW1lZCA9IHRydWU7XG4gICAgICAgICAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNzZSBvZiBfaXRlclNTRU1lc3NhZ2VzKHJlc3BvbnNlLCBjb250cm9sbGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9uZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3NlLmRhdGEuc3RhcnRzV2l0aCgnW0RPTkVdJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNzZS5ldmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHNzZS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgQ291bGQgbm90IHBhcnNlIG1lc3NhZ2UgaW50byBKU09OOmAsIHNzZS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGcm9tIGNodW5rOmAsIHNzZS5yYXcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEFQSUVycm9yKHVuZGVmaW5lZCwgZGF0YS5lcnJvciwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgeWllbGQgZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRhO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShzc2UuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkIG5vdCBwYXJzZSBtZXNzYWdlIGludG8gSlNPTjpgLCBzc2UuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRnJvbSBjaHVuazpgLCBzc2UucmF3KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogSXMgdGhpcyB3aGVyZSB0aGUgZXJyb3Igc2hvdWxkIGJlIHRocm93bj9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzc2UuZXZlbnQgPT0gJ2Vycm9yJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBBUElFcnJvcih1bmRlZmluZWQsIGRhdGEuZXJyb3IsIGRhdGEubWVzc2FnZSwgdW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHlpZWxkIHsgZXZlbnQ6IHNzZS5ldmVudCwgZGF0YTogZGF0YSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgdXNlciBjYWxscyBgc3RyZWFtLmNvbnRyb2xsZXIuYWJvcnQoKWAsIHdlIHNob3VsZCBleGl0IHdpdGhvdXQgdGhyb3dpbmcuXG4gICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09ICdBYm9ydEVycm9yJylcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgdXNlciBgYnJlYWtgcywgYWJvcnQgdGhlIG9uZ29pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgICBpZiAoIWRvbmUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFN0cmVhbShpdGVyYXRvciwgY29udHJvbGxlcik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyBhIFN0cmVhbSBmcm9tIGEgbmV3bGluZS1zZXBhcmF0ZWQgUmVhZGFibGVTdHJlYW1cbiAgICAgKiB3aGVyZSBlYWNoIGl0ZW0gaXMgYSBKU09OIHZhbHVlLlxuICAgICAqL1xuICAgIHN0YXRpYyBmcm9tUmVhZGFibGVTdHJlYW0ocmVhZGFibGVTdHJlYW0sIGNvbnRyb2xsZXIpIHtcbiAgICAgICAgbGV0IGNvbnN1bWVkID0gZmFsc2U7XG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uKiBpdGVyTGluZXMoKSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lRGVjb2RlciA9IG5ldyBMaW5lRGVjb2RlcigpO1xuICAgICAgICAgICAgY29uc3QgaXRlciA9IFJlYWRhYmxlU3RyZWFtVG9Bc3luY0l0ZXJhYmxlKHJlYWRhYmxlU3RyZWFtKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgaXRlcikge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lRGVjb2Rlci5kZWNvZGUoY2h1bmspKSB7XG4gICAgICAgICAgICAgICAgICAgIHlpZWxkIGxpbmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVEZWNvZGVyLmZsdXNoKCkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCBsaW5lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uKiBpdGVyYXRvcigpIHtcbiAgICAgICAgICAgIGlmIChjb25zdW1lZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGl0ZXJhdGUgb3ZlciBhIGNvbnN1bWVkIHN0cmVhbSwgdXNlIGAudGVlKClgIHRvIHNwbGl0IHRoZSBzdHJlYW0uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdW1lZCA9IHRydWU7XG4gICAgICAgICAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgaXRlckxpbmVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbmUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpbmUpXG4gICAgICAgICAgICAgICAgICAgICAgICB5aWVsZCBKU09OLnBhcnNlKGxpbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHVzZXIgY2FsbHMgYHN0cmVhbS5jb250cm9sbGVyLmFib3J0KClgLCB3ZSBzaG91bGQgZXhpdCB3aXRob3V0IHRocm93aW5nLlxuICAgICAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IgJiYgZS5uYW1lID09PSAnQWJvcnRFcnJvcicpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmluYWxseSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHVzZXIgYGJyZWFrYHMsIGFib3J0IHRoZSBvbmdvaW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAgICAgaWYgKCFkb25lKVxuICAgICAgICAgICAgICAgICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBTdHJlYW0oaXRlcmF0b3IsIGNvbnRyb2xsZXIpO1xuICAgIH1cbiAgICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pdGVyYXRvcigpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTcGxpdHMgdGhlIHN0cmVhbSBpbnRvIHR3byBzdHJlYW1zIHdoaWNoIGNhbiBiZVxuICAgICAqIGluZGVwZW5kZW50bHkgcmVhZCBmcm9tIGF0IGRpZmZlcmVudCBzcGVlZHMuXG4gICAgICovXG4gICAgdGVlKCkge1xuICAgICAgICBjb25zdCBsZWZ0ID0gW107XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gW107XG4gICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRvcigpO1xuICAgICAgICBjb25zdCB0ZWVJdGVyYXRvciA9IChxdWV1ZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmlnaHQucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgbmV3IFN0cmVhbSgoKSA9PiB0ZWVJdGVyYXRvcihsZWZ0KSwgdGhpcy5jb250cm9sbGVyKSxcbiAgICAgICAgICAgIG5ldyBTdHJlYW0oKCkgPT4gdGVlSXRlcmF0b3IocmlnaHQpLCB0aGlzLmNvbnRyb2xsZXIpLFxuICAgICAgICBdO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGlzIHN0cmVhbSB0byBhIG5ld2xpbmUtc2VwYXJhdGVkIFJlYWRhYmxlU3RyZWFtIG9mXG4gICAgICogSlNPTiBzdHJpbmdpZmllZCB2YWx1ZXMgaW4gdGhlIHN0cmVhbVxuICAgICAqIHdoaWNoIGNhbiBiZSB0dXJuZWQgYmFjayBpbnRvIGEgU3RyZWFtIHdpdGggYFN0cmVhbS5mcm9tUmVhZGFibGVTdHJlYW0oKWAuXG4gICAgICovXG4gICAgdG9SZWFkYWJsZVN0cmVhbSgpIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIGxldCBpdGVyO1xuICAgICAgICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICAgICAgIHJldHVybiBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgICAgICAgICAgYXN5bmMgc3RhcnQoKSB7XG4gICAgICAgICAgICAgICAgaXRlciA9IHNlbGZbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXN5bmMgcHVsbChjdHJsKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyB2YWx1ZSwgZG9uZSB9ID0gYXdhaXQgaXRlci5uZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb25lKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0cmwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnl0ZXMgPSBlbmNvZGVyLmVuY29kZShKU09OLnN0cmluZ2lmeSh2YWx1ZSkgKyAnXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIGN0cmwuZW5xdWV1ZShieXRlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY3RybC5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3luYyBjYW5jZWwoKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgaXRlci5yZXR1cm4/LigpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBfaXRlclNTRU1lc3NhZ2VzKHJlc3BvbnNlLCBjb250cm9sbGVyKSB7XG4gICAgaWYgKCFyZXNwb25zZS5ib2R5KSB7XG4gICAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBBdHRlbXB0ZWQgdG8gaXRlcmF0ZSBvdmVyIGEgcmVzcG9uc2Ugd2l0aCBubyBib2R5YCk7XG4gICAgfVxuICAgIGNvbnN0IHNzZURlY29kZXIgPSBuZXcgU1NFRGVjb2RlcigpO1xuICAgIGNvbnN0IGxpbmVEZWNvZGVyID0gbmV3IExpbmVEZWNvZGVyKCk7XG4gICAgY29uc3QgaXRlciA9IFJlYWRhYmxlU3RyZWFtVG9Bc3luY0l0ZXJhYmxlKHJlc3BvbnNlLmJvZHkpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc3NlQ2h1bmsgb2YgaXRlclNTRUNodW5rcyhpdGVyKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZURlY29kZXIuZGVjb2RlKHNzZUNodW5rKSkge1xuICAgICAgICAgICAgY29uc3Qgc3NlID0gc3NlRGVjb2Rlci5kZWNvZGUobGluZSk7XG4gICAgICAgICAgICBpZiAoc3NlKVxuICAgICAgICAgICAgICAgIHlpZWxkIHNzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZURlY29kZXIuZmx1c2goKSkge1xuICAgICAgICBjb25zdCBzc2UgPSBzc2VEZWNvZGVyLmRlY29kZShsaW5lKTtcbiAgICAgICAgaWYgKHNzZSlcbiAgICAgICAgICAgIHlpZWxkIHNzZTtcbiAgICB9XG59XG4vKipcbiAqIEdpdmVuIGFuIGFzeW5jIGl0ZXJhYmxlIGl0ZXJhdG9yLCBpdGVyYXRlcyBvdmVyIGl0IGFuZCB5aWVsZHMgZnVsbFxuICogU1NFIGNodW5rcywgaS5lLiB5aWVsZHMgd2hlbiBhIGRvdWJsZSBuZXctbGluZSBpcyBlbmNvdW50ZXJlZC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24qIGl0ZXJTU0VDaHVua3MoaXRlcmF0b3IpIHtcbiAgICBsZXQgZGF0YSA9IG5ldyBVaW50OEFycmF5KCk7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBpdGVyYXRvcikge1xuICAgICAgICBpZiAoY2h1bmsgPT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYmluYXJ5Q2h1bmsgPSBjaHVuayBpbnN0YW5jZW9mIEFycmF5QnVmZmVyID8gbmV3IFVpbnQ4QXJyYXkoY2h1bmspXG4gICAgICAgICAgICA6IHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycgPyBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoY2h1bmspXG4gICAgICAgICAgICAgICAgOiBjaHVuaztcbiAgICAgICAgbGV0IG5ld0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmxlbmd0aCArIGJpbmFyeUNodW5rLmxlbmd0aCk7XG4gICAgICAgIG5ld0RhdGEuc2V0KGRhdGEpO1xuICAgICAgICBuZXdEYXRhLnNldChiaW5hcnlDaHVuaywgZGF0YS5sZW5ndGgpO1xuICAgICAgICBkYXRhID0gbmV3RGF0YTtcbiAgICAgICAgbGV0IHBhdHRlcm5JbmRleDtcbiAgICAgICAgd2hpbGUgKChwYXR0ZXJuSW5kZXggPSBmaW5kRG91YmxlTmV3bGluZUluZGV4KGRhdGEpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHlpZWxkIGRhdGEuc2xpY2UoMCwgcGF0dGVybkluZGV4KTtcbiAgICAgICAgICAgIGRhdGEgPSBkYXRhLnNsaWNlKHBhdHRlcm5JbmRleCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGRhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICB5aWVsZCBkYXRhO1xuICAgIH1cbn1cbmZ1bmN0aW9uIGZpbmREb3VibGVOZXdsaW5lSW5kZXgoYnVmZmVyKSB7XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzZWFyY2hlcyB0aGUgYnVmZmVyIGZvciB0aGUgZW5kIHBhdHRlcm5zIChcXHJcXHIsIFxcblxcbiwgXFxyXFxuXFxyXFxuKVxuICAgIC8vIGFuZCByZXR1cm5zIHRoZSBpbmRleCByaWdodCBhZnRlciB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBhbnkgcGF0dGVybixcbiAgICAvLyBvciAtMSBpZiBub25lIG9mIHRoZSBwYXR0ZXJucyBhcmUgZm91bmQuXG4gICAgY29uc3QgbmV3bGluZSA9IDB4MGE7IC8vIFxcblxuICAgIGNvbnN0IGNhcnJpYWdlID0gMHgwZDsgLy8gXFxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICAgIGlmIChidWZmZXJbaV0gPT09IG5ld2xpbmUgJiYgYnVmZmVyW2kgKyAxXSA9PT0gbmV3bGluZSkge1xuICAgICAgICAgICAgLy8gXFxuXFxuXG4gICAgICAgICAgICByZXR1cm4gaSArIDI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJ1ZmZlcltpXSA9PT0gY2FycmlhZ2UgJiYgYnVmZmVyW2kgKyAxXSA9PT0gY2FycmlhZ2UpIHtcbiAgICAgICAgICAgIC8vIFxcclxcclxuICAgICAgICAgICAgcmV0dXJuIGkgKyAyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChidWZmZXJbaV0gPT09IGNhcnJpYWdlICYmXG4gICAgICAgICAgICBidWZmZXJbaSArIDFdID09PSBuZXdsaW5lICYmXG4gICAgICAgICAgICBpICsgMyA8IGJ1ZmZlci5sZW5ndGggJiZcbiAgICAgICAgICAgIGJ1ZmZlcltpICsgMl0gPT09IGNhcnJpYWdlICYmXG4gICAgICAgICAgICBidWZmZXJbaSArIDNdID09PSBuZXdsaW5lKSB7XG4gICAgICAgICAgICAvLyBcXHJcXG5cXHJcXG5cbiAgICAgICAgICAgIHJldHVybiBpICsgNDtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG59XG5jbGFzcyBTU0VEZWNvZGVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtdO1xuICAgICAgICB0aGlzLmNodW5rcyA9IFtdO1xuICAgIH1cbiAgICBkZWNvZGUobGluZSkge1xuICAgICAgICBpZiAobGluZS5lbmRzV2l0aCgnXFxyJykpIHtcbiAgICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cmluZygwLCBsaW5lLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghbGluZSkge1xuICAgICAgICAgICAgLy8gZW1wdHkgbGluZSBhbmQgd2UgZGlkbid0IHByZXZpb3VzbHkgZW5jb3VudGVyIGFueSBtZXNzYWdlc1xuICAgICAgICAgICAgaWYgKCF0aGlzLmV2ZW50ICYmICF0aGlzLmRhdGEubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3Qgc3NlID0ge1xuICAgICAgICAgICAgICAgIGV2ZW50OiB0aGlzLmV2ZW50LFxuICAgICAgICAgICAgICAgIGRhdGE6IHRoaXMuZGF0YS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgICAgICByYXc6IHRoaXMuY2h1bmtzLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5kYXRhID0gW107XG4gICAgICAgICAgICB0aGlzLmNodW5rcyA9IFtdO1xuICAgICAgICAgICAgcmV0dXJuIHNzZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNodW5rcy5wdXNoKGxpbmUpO1xuICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCc6JykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGxldCBbZmllbGRuYW1lLCBfLCB2YWx1ZV0gPSBwYXJ0aXRpb24obGluZSwgJzonKTtcbiAgICAgICAgaWYgKHZhbHVlLnN0YXJ0c1dpdGgoJyAnKSkge1xuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpZWxkbmFtZSA9PT0gJ2V2ZW50Jykge1xuICAgICAgICAgICAgdGhpcy5ldmVudCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGZpZWxkbmFtZSA9PT0gJ2RhdGEnKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGEucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuLyoqIFRoaXMgaXMgYW4gaW50ZXJuYWwgaGVscGVyIGZ1bmN0aW9uIHRoYXQncyBqdXN0IHVzZWQgZm9yIHRlc3RpbmcgKi9cbmV4cG9ydCBmdW5jdGlvbiBfZGVjb2RlQ2h1bmtzKGNodW5rcywgeyBmbHVzaCB9ID0geyBmbHVzaDogZmFsc2UgfSkge1xuICAgIGNvbnN0IGRlY29kZXIgPSBuZXcgTGluZURlY29kZXIoKTtcbiAgICBjb25zdCBsaW5lcyA9IFtdO1xuICAgIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XG4gICAgICAgIGxpbmVzLnB1c2goLi4uZGVjb2Rlci5kZWNvZGUoY2h1bmspKTtcbiAgICB9XG4gICAgaWYgKGZsdXNoKSB7XG4gICAgICAgIGxpbmVzLnB1c2goLi4uZGVjb2Rlci5mbHVzaCgpKTtcbiAgICB9XG4gICAgcmV0dXJuIGxpbmVzO1xufVxuZnVuY3Rpb24gcGFydGl0aW9uKHN0ciwgZGVsaW1pdGVyKSB7XG4gICAgY29uc3QgaW5kZXggPSBzdHIuaW5kZXhPZihkZWxpbWl0ZXIpO1xuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIFtzdHIuc3Vic3RyaW5nKDAsIGluZGV4KSwgZGVsaW1pdGVyLCBzdHIuc3Vic3RyaW5nKGluZGV4ICsgZGVsaW1pdGVyLmxlbmd0aCldO1xuICAgIH1cbiAgICByZXR1cm4gW3N0ciwgJycsICcnXTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0cmVhbWluZy5tanMubWFwIiwiaW1wb3J0IHsgRm9ybURhdGEsIEZpbGUsIGdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zLCBpc0ZzUmVhZFN0cmVhbSwgfSBmcm9tIFwiLi9fc2hpbXMvaW5kZXgubWpzXCI7XG5leHBvcnQgeyBmaWxlRnJvbVBhdGggfSBmcm9tIFwiLi9fc2hpbXMvaW5kZXgubWpzXCI7XG5leHBvcnQgY29uc3QgaXNSZXNwb25zZUxpa2UgPSAodmFsdWUpID0+IHZhbHVlICE9IG51bGwgJiZcbiAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIHZhbHVlLnVybCA9PT0gJ3N0cmluZycgJiZcbiAgICB0eXBlb2YgdmFsdWUuYmxvYiA9PT0gJ2Z1bmN0aW9uJztcbmV4cG9ydCBjb25zdCBpc0ZpbGVMaWtlID0gKHZhbHVlKSA9PiB2YWx1ZSAhPSBudWxsICYmXG4gICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiB2YWx1ZS5uYW1lID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiB2YWx1ZS5sYXN0TW9kaWZpZWQgPT09ICdudW1iZXInICYmXG4gICAgaXNCbG9iTGlrZSh2YWx1ZSk7XG4vKipcbiAqIFRoZSBCbG9iTGlrZSB0eXBlIG9taXRzIGFycmF5QnVmZmVyKCkgYmVjYXVzZSBAdHlwZXMvbm9kZS1mZXRjaEBeMi42LjQgbGFja3MgaXQ7IGJ1dCB0aGlzIGNoZWNrXG4gKiBhZGRzIHRoZSBhcnJheUJ1ZmZlcigpIG1ldGhvZCB0eXBlIGJlY2F1c2UgaXQgaXMgYXZhaWxhYmxlIGFuZCB1c2VkIGF0IHJ1bnRpbWVcbiAqL1xuZXhwb3J0IGNvbnN0IGlzQmxvYkxpa2UgPSAodmFsdWUpID0+IHZhbHVlICE9IG51bGwgJiZcbiAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIHZhbHVlLnNpemUgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIHZhbHVlLnR5cGUgPT09ICdzdHJpbmcnICYmXG4gICAgdHlwZW9mIHZhbHVlLnRleHQgPT09ICdmdW5jdGlvbicgJiZcbiAgICB0eXBlb2YgdmFsdWUuc2xpY2UgPT09ICdmdW5jdGlvbicgJiZcbiAgICB0eXBlb2YgdmFsdWUuYXJyYXlCdWZmZXIgPT09ICdmdW5jdGlvbic7XG5leHBvcnQgY29uc3QgaXNVcGxvYWRhYmxlID0gKHZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIGlzRmlsZUxpa2UodmFsdWUpIHx8IGlzUmVzcG9uc2VMaWtlKHZhbHVlKSB8fCBpc0ZzUmVhZFN0cmVhbSh2YWx1ZSk7XG59O1xuLyoqXG4gKiBIZWxwZXIgZm9yIGNyZWF0aW5nIGEge0BsaW5rIEZpbGV9IHRvIHBhc3MgdG8gYW4gU0RLIHVwbG9hZCBtZXRob2QgZnJvbSBhIHZhcmlldHkgb2YgZGlmZmVyZW50IGRhdGEgZm9ybWF0c1xuICogQHBhcmFtIHZhbHVlIHRoZSByYXcgY29udGVudCBvZiB0aGUgZmlsZS4gIENhbiBiZSBhbiB7QGxpbmsgVXBsb2FkYWJsZX0sIHtAbGluayBCbG9iTGlrZVBhcnR9LCBvciB7QGxpbmsgQXN5bmNJdGVyYWJsZX0gb2Yge0BsaW5rIEJsb2JMaWtlUGFydH1zXG4gKiBAcGFyYW0ge3N0cmluZz19IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGZpbGUuIElmIG9taXR0ZWQsIHRvRmlsZSB3aWxsIHRyeSB0byBkZXRlcm1pbmUgYSBmaWxlIG5hbWUgZnJvbSBiaXRzIGlmIHBvc3NpYmxlXG4gKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnMgYWRkaXRpb25hbCBwcm9wZXJ0aWVzXG4gKiBAcGFyYW0ge3N0cmluZz19IG9wdGlvbnMudHlwZSB0aGUgTUlNRSB0eXBlIG9mIHRoZSBjb250ZW50XG4gKiBAcGFyYW0ge251bWJlcj19IG9wdGlvbnMubGFzdE1vZGlmaWVkIHRoZSBsYXN0IG1vZGlmaWVkIHRpbWVzdGFtcFxuICogQHJldHVybnMgYSB7QGxpbmsgRmlsZX0gd2l0aCB0aGUgZ2l2ZW4gcHJvcGVydGllc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9GaWxlKHZhbHVlLCBuYW1lLCBvcHRpb25zKSB7XG4gICAgLy8gSWYgaXQncyBhIHByb21pc2UsIHJlc29sdmUgaXQuXG4gICAgdmFsdWUgPSBhd2FpdCB2YWx1ZTtcbiAgICAvLyBJZiB3ZSd2ZSBiZWVuIGdpdmVuIGEgYEZpbGVgIHdlIGRvbid0IG5lZWQgdG8gZG8gYW55dGhpbmdcbiAgICBpZiAoaXNGaWxlTGlrZSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICBpZiAoaXNSZXNwb25zZUxpa2UodmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCB2YWx1ZS5ibG9iKCk7XG4gICAgICAgIG5hbWUgfHwgKG5hbWUgPSBuZXcgVVJMKHZhbHVlLnVybCkucGF0aG5hbWUuc3BsaXQoL1tcXFxcL10vKS5wb3AoKSA/PyAndW5rbm93bl9maWxlJyk7XG4gICAgICAgIC8vIHdlIG5lZWQgdG8gY29udmVydCB0aGUgYEJsb2JgIGludG8gYW4gYXJyYXkgYnVmZmVyIGJlY2F1c2UgdGhlIGBCbG9iYCBjbGFzc1xuICAgICAgICAvLyB0aGF0IGBub2RlLWZldGNoYCBkZWZpbmVzIGlzIGluY29tcGF0aWJsZSB3aXRoIHRoZSB3ZWIgc3RhbmRhcmQgd2hpY2ggcmVzdWx0c1xuICAgICAgICAvLyBpbiBgbmV3IEZpbGVgIGludGVycHJldGluZyBpdCBhcyBhIHN0cmluZyBpbnN0ZWFkIG9mIGJpbmFyeSBkYXRhLlxuICAgICAgICBjb25zdCBkYXRhID0gaXNCbG9iTGlrZShibG9iKSA/IFsoYXdhaXQgYmxvYi5hcnJheUJ1ZmZlcigpKV0gOiBbYmxvYl07XG4gICAgICAgIHJldHVybiBuZXcgRmlsZShkYXRhLCBuYW1lLCBvcHRpb25zKTtcbiAgICB9XG4gICAgY29uc3QgYml0cyA9IGF3YWl0IGdldEJ5dGVzKHZhbHVlKTtcbiAgICBuYW1lIHx8IChuYW1lID0gZ2V0TmFtZSh2YWx1ZSkgPz8gJ3Vua25vd25fZmlsZScpO1xuICAgIGlmICghb3B0aW9ucz8udHlwZSkge1xuICAgICAgICBjb25zdCB0eXBlID0gYml0c1swXT8udHlwZTtcbiAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgdHlwZSB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgRmlsZShiaXRzLCBuYW1lLCBvcHRpb25zKTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGdldEJ5dGVzKHZhbHVlKSB7XG4gICAgbGV0IHBhcnRzID0gW107XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgQXJyYXlCdWZmZXIuaXNWaWV3KHZhbHVlKSB8fCAvLyBpbmNsdWRlcyBVaW50OEFycmF5LCBCdWZmZXIsIGV0Yy5cbiAgICAgICAgdmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgICBwYXJ0cy5wdXNoKHZhbHVlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNCbG9iTGlrZSh2YWx1ZSkpIHtcbiAgICAgICAgcGFydHMucHVzaChhd2FpdCB2YWx1ZS5hcnJheUJ1ZmZlcigpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNBc3luY0l0ZXJhYmxlSXRlcmF0b3IodmFsdWUpIC8vIGluY2x1ZGVzIFJlYWRhYmxlLCBSZWFkYWJsZVN0cmVhbSwgZXRjLlxuICAgICkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHZhbHVlKSB7XG4gICAgICAgICAgICBwYXJ0cy5wdXNoKGNodW5rKTsgLy8gVE9ETywgY29uc2lkZXIgdmFsaWRhdGluZz9cbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGRhdGEgdHlwZTogJHt0eXBlb2YgdmFsdWV9OyBjb25zdHJ1Y3RvcjogJHt2YWx1ZT8uY29uc3RydWN0b3JcbiAgICAgICAgICAgID8ubmFtZX07IHByb3BzOiAke3Byb3BzRm9yRXJyb3IodmFsdWUpfWApO1xuICAgIH1cbiAgICByZXR1cm4gcGFydHM7XG59XG5mdW5jdGlvbiBwcm9wc0ZvckVycm9yKHZhbHVlKSB7XG4gICAgY29uc3QgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gICAgcmV0dXJuIGBbJHtwcm9wcy5tYXAoKHApID0+IGBcIiR7cH1cImApLmpvaW4oJywgJyl9XWA7XG59XG5mdW5jdGlvbiBnZXROYW1lKHZhbHVlKSB7XG4gICAgcmV0dXJuIChnZXRTdHJpbmdGcm9tTWF5YmVCdWZmZXIodmFsdWUubmFtZSkgfHxcbiAgICAgICAgZ2V0U3RyaW5nRnJvbU1heWJlQnVmZmVyKHZhbHVlLmZpbGVuYW1lKSB8fFxuICAgICAgICAvLyBGb3IgZnMuUmVhZFN0cmVhbVxuICAgICAgICBnZXRTdHJpbmdGcm9tTWF5YmVCdWZmZXIodmFsdWUucGF0aCk/LnNwbGl0KC9bXFxcXC9dLykucG9wKCkpO1xufVxuY29uc3QgZ2V0U3RyaW5nRnJvbU1heWJlQnVmZmVyID0gKHgpID0+IHtcbiAgICBpZiAodHlwZW9mIHggPT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4geDtcbiAgICBpZiAodHlwZW9mIEJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgeCBpbnN0YW5jZW9mIEJ1ZmZlcilcbiAgICAgICAgcmV0dXJuIFN0cmluZyh4KTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufTtcbmNvbnN0IGlzQXN5bmNJdGVyYWJsZUl0ZXJhdG9yID0gKHZhbHVlKSA9PiB2YWx1ZSAhPSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHZhbHVlW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9PT0gJ2Z1bmN0aW9uJztcbmV4cG9ydCBjb25zdCBpc011bHRpcGFydEJvZHkgPSAoYm9keSkgPT4gYm9keSAmJiB0eXBlb2YgYm9keSA9PT0gJ29iamVjdCcgJiYgYm9keS5ib2R5ICYmIGJvZHlbU3ltYm9sLnRvU3RyaW5nVGFnXSA9PT0gJ011bHRpcGFydEJvZHknO1xuLyoqXG4gKiBSZXR1cm5zIGEgbXVsdGlwYXJ0L2Zvcm0tZGF0YSByZXF1ZXN0IGlmIGFueSBwYXJ0IG9mIHRoZSBnaXZlbiByZXF1ZXN0IGJvZHkgY29udGFpbnMgYSBGaWxlIC8gQmxvYiB2YWx1ZS5cbiAqIE90aGVyd2lzZSByZXR1cm5zIHRoZSByZXF1ZXN0IGFzIGlzLlxuICovXG5leHBvcnQgY29uc3QgbWF5YmVNdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMgPSBhc3luYyAob3B0cykgPT4ge1xuICAgIGlmICghaGFzVXBsb2FkYWJsZVZhbHVlKG9wdHMuYm9keSkpXG4gICAgICAgIHJldHVybiBvcHRzO1xuICAgIGNvbnN0IGZvcm0gPSBhd2FpdCBjcmVhdGVGb3JtKG9wdHMuYm9keSk7XG4gICAgcmV0dXJuIGdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zKGZvcm0sIG9wdHMpO1xufTtcbmV4cG9ydCBjb25zdCBtdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMgPSBhc3luYyAob3B0cykgPT4ge1xuICAgIGNvbnN0IGZvcm0gPSBhd2FpdCBjcmVhdGVGb3JtKG9wdHMuYm9keSk7XG4gICAgcmV0dXJuIGdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zKGZvcm0sIG9wdHMpO1xufTtcbmV4cG9ydCBjb25zdCBjcmVhdGVGb3JtID0gYXN5bmMgKGJvZHkpID0+IHtcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXMoYm9keSB8fCB7fSkubWFwKChba2V5LCB2YWx1ZV0pID0+IGFkZEZvcm1WYWx1ZShmb3JtLCBrZXksIHZhbHVlKSkpO1xuICAgIHJldHVybiBmb3JtO1xufTtcbmNvbnN0IGhhc1VwbG9hZGFibGVWYWx1ZSA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmIChpc1VwbG9hZGFibGUodmFsdWUpKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpXG4gICAgICAgIHJldHVybiB2YWx1ZS5zb21lKGhhc1VwbG9hZGFibGVWYWx1ZSk7XG4gICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZm9yIChjb25zdCBrIGluIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoaGFzVXBsb2FkYWJsZVZhbHVlKHZhbHVlW2tdKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuY29uc3QgYWRkRm9ybVZhbHVlID0gYXN5bmMgKGZvcm0sIGtleSwgdmFsdWUpID0+IHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFJlY2VpdmVkIG51bGwgZm9yIFwiJHtrZXl9XCI7IHRvIHBhc3MgbnVsbCBpbiBGb3JtRGF0YSwgeW91IG11c3QgdXNlIHRoZSBzdHJpbmcgJ251bGwnYCk7XG4gICAgfVxuICAgIC8vIFRPRE86IG1ha2UgbmVzdGVkIGZvcm1hdHMgY29uZmlndXJhYmxlXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICBmb3JtLmFwcGVuZChrZXksIFN0cmluZyh2YWx1ZSkpO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc1VwbG9hZGFibGUodmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0b0ZpbGUodmFsdWUpO1xuICAgICAgICBmb3JtLmFwcGVuZChrZXksIGZpbGUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbCh2YWx1ZS5tYXAoKGVudHJ5KSA9PiBhZGRGb3JtVmFsdWUoZm9ybSwga2V5ICsgJ1tdJywgZW50cnkpKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModmFsdWUpLm1hcCgoW25hbWUsIHByb3BdKSA9PiBhZGRGb3JtVmFsdWUoZm9ybSwgYCR7a2V5fVske25hbWV9XWAsIHByb3ApKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnZhbGlkIHZhbHVlIGdpdmVuIHRvIGZvcm0sIGV4cGVjdGVkIGEgc3RyaW5nLCBudW1iZXIsIGJvb2xlYW4sIG9iamVjdCwgQXJyYXksIEZpbGUgb3IgQmxvYiBidXQgZ290ICR7dmFsdWV9IGluc3RlYWRgKTtcbiAgICB9XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXBsb2Fkcy5tanMubWFwIiwiZXhwb3J0IGNvbnN0IFZFUlNJT04gPSAnNC44NS4xJzsgLy8geC1yZWxlYXNlLXBsZWFzZS12ZXJzaW9uXG4vLyMgc291cmNlTWFwcGluZ1VSTD12ZXJzaW9uLm1qcy5tYXAiLCJpbXBvcnQgeyBTRVJWRVJfSE9TVCwgQVBJX1BBVEggfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBJQ29uZmlnIH0gZnJvbSAnLi9jb25maWcnO1xuaW1wb3J0IHsgaGFuZGxlTExNUmVxdWVzdCB9IGZyb20gJy4vbGxtJztcblxuZXhwb3J0IGZ1bmN0aW9uIGZldGNoUmFkYXJQb2NTZXJ2ZXIocGF0aDogc3RyaW5nLCBib2R5OiBhbnkpIHtcbiAgICBjb25zdCB1cmwgPSBTRVJWRVJfSE9TVCArIHBhdGg7XG4gICAgcmV0dXJuIGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgICAgIH0pXG4gICAgICAudGhlbihhc3luYyByZXNwb25zZSA9PiB7XG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcblxuICAgICAgICAgIGNvbnN0IGVycm9yRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JEYXRhLmRldGFpbCB8fCBgSFRUUCBlcnJvciEgc3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5Ub3BpY3MoY29uZmlnOiBJQ29uZmlnKSB7XG4gICAgY29uc3QgeyB1c2VybmFtZSwgZXh0ZW5zaW9uSWQsIG1vZGVsICB9ID0gY29uZmlnO1xuICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICAgIHVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICAgICAgZXh0ZW5zaW9uX2lkOiBleHRlbnNpb25JZCxcbiAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgIH07XG5cbiAgICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5HRU5fVE9QSUNTLCBib2R5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyZW5kaW5nVG9waWNzKGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCwgbW9kZWwgIH0gPSBjb25maWc7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgICB1c2VybmFtZTogdXNlcm5hbWUsXG4gICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICAgICAgbW9kZWw6IG1vZGVsLFxuICB9O1xuXG4gIHJldHVybiBmZXRjaFJhZGFyUG9jU2VydmVyKEFQSV9QQVRILlRSRU5ESU5HX1RPUElDUywgYm9keSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXN0b21RdWVyeShxdWVyeTogc3RyaW5nLCBjb25maWc6IElDb25maWcpIHtcbiAgICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCwgbW9kZWwgIH0gPSBjb25maWc7XG5cbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAgICB1c2VybmFtZTogdXNlcm5hbWUsXG4gICAgICAgIGV4dGVuc2lvbl9pZDogZXh0ZW5zaW9uSWQsXG4gICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgcXVlcnk6IHF1ZXJ5XG4gICAgfTtcblxuICAgIHJldHVybiBmZXRjaFJhZGFyUG9jU2VydmVyKEFQSV9QQVRILlFVRVJZLCBib2R5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JhbFF1ZXJ5KHF1ZXJ5OiBzdHJpbmcsIGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCwgbW9kZWwgIH0gPSBjb25maWc7XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICAgIHVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICAgIGV4dGVuc2lvbl9pZDogZXh0ZW5zaW9uSWQsXG4gICAgICBtb2RlbDogbW9kZWwsXG4gICAgICBxdWVyeTogcXVlcnlcbiAgfTtcblxuICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5HTE9CQUxfUVVFUlksIGJvZHkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmV0Y2hMYXN0SW5kZXhUaW1lKGNvbmZpZzogSUNvbmZpZykge1xuICAgIGNvbnN0IHsgdXNlcm5hbWUsIGV4dGVuc2lvbklkICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgICAgdXNlcm5hbWU6IHVzZXJuYW1lLFxuICAgICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICAgIH07XG5cbiAgICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5MQVRFU1RfSU5ERVhfVElNRSwgYm9keSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmRleGluZyhkYXRhOiBhbnlbXSwgY29uZmlnOiBJQ29uZmlnKSB7XG4gIGNvbnN0IHsgdXNlcm5hbWUsIGV4dGVuc2lvbklkLCBtb2RlbCAgfSA9IGNvbmZpZztcblxuICBpZiAoIWRhdGEgfHwgZGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ05vIGRhdGEgcHJvdmlkZWQnKSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgICAgdXNlcm5hbWUsXG4gICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICAgICAgbW9kZWwsXG4gICAgICBkYXRhXG4gIH07XG5cbiAgcmV0dXJuIGZldGNoUmFkYXJQb2NTZXJ2ZXIoQVBJX1BBVEguSU5ERVhJTkcsIGJvZHkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5jcmVtZW50KGRhdGE6IGFueVtdLCBjb25maWc6IElDb25maWcpIHtcbiAgY29uc3QgeyB1c2VybmFtZSwgZXh0ZW5zaW9uSWQsIG1vZGVsICB9ID0gY29uZmlnO1xuXG4gIGlmICghZGF0YSB8fCBkYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignTm8gZGF0YSBwcm92aWRlZCcpKTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgICB1c2VybmFtZSxcbiAgICAgIGV4dGVuc2lvbl9pZDogZXh0ZW5zaW9uSWQsXG4gICAgICBtb2RlbCxcbiAgICAgIGRhdGFcbiAgfTtcblxuICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5JTkNSRU1FTlQsIGJvZHkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlX2luZGV4aW5nKGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCAgfSA9IGNvbmZpZztcblxuICBjb25zdCBib2R5ID0ge1xuICAgICAgdXNlcm5hbWUsXG4gICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICB9O1xuXG4gIHJldHVybiBmZXRjaFJhZGFyUG9jU2VydmVyKEFQSV9QQVRILkRFTEVURSwgYm9keSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmZXRjaERpZnlTZXJ2ZXIocXVlcnk6IHN0cmluZ1tdLCBjb25maWc6IElDb25maWcpIHtcbiAgY29uc3QgdXJsID0gJ2h0dHBzOi8vbGFwMi1hcGktZGV2LmludC5yY2xhYmVudi5jb20vdjEvY29tcGxldGlvbi1tZXNzYWdlcyc7XG4gIGNvbnN0IHsgdXNlcm5hbWUsIGFwaUtleSAgfSA9IGNvbmZpZztcblxuICBjb25zdCBkYXRhID0ge1xuICAgIGlucHV0czogeyBxdWVyeTogSlNPTi5zdHJpbmdpZnkocXVlcnkpLCB1c2VybmFtZTogdXNlcm5hbWV9LFxuICAgIHJlc3BvbnNlX21vZGU6ICdibG9ja2luZycsXG4gICAgdXNlcjogdXNlcm5hbWVcbiAgfTtcblxuICByZXR1cm4gZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgaGVhZGVyczoge1xuICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7YXBpS2V5fWAsXG4gICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKVxuICB9KVxuICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gIC50aGVuKGRhdGEgPT4ge1xuICAgIHJldHVybiBkYXRhLmFuc3dlcjtcbiAgfSlcbiAgLmNhdGNoKGVycm9yID0+IHtcbiAgICByZXR1cm4gZXJyb3IubWVzc2FnZSB8fCAnSHR0cHMgZXJyb3InXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VuZERhdGFUb09sbGFtYSAoZGF0YTogYW55W10sIGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lIH0gPSBjb25maWc7XG4gIGNvbnN0IGNvbmNlcm5lZF9wYXJ0OiBzdHJpbmdbXSA9IEpTT04ucGFyc2UoY29uZmlnLmNvbmNlcm5lZEl0ZW1zIHx8IEpTT04uc3RyaW5naWZ5KFtcbiAgICAncmVjb3JkaW5nIOmhueebruWcqCBSQ1YgbW9iaWxlIOS4reeahOebuOWFs+S/oeaBr++8jOeJueWIq+aYryBCRSDkvp3otZbpg6jliIbnmoTlrozmiJDmg4XlhrXvvIjlhbPplK7or43vvJpyZWNvcmRpbmcvUkNWIG1vYmlsZS9CRSBkZXBlbmRlbmNpZXPvvIzlv4XpobvlkIzml7bljIXlkKtcInJlY29yZGluZ1wi5ZKMXCJCRVwi55u45YWz5YWz6ZSu6K+N77yJJyxcbiAgICAn6IGK5Yiw5YWz5LqO5YWs5Y+45pS/562W77yM5Lmf5Y+v5Lul5piv5pS/562W55u45YWz55qE5YWr5Y2m5raI5oGvJyxcbiAgICAnU29waGlhIChKaW5tZWkpIExpbiDlj5HpgIHnmoTmiYDmnInmtojmga/vvIjlj6rpnIDopoHmo4Dmn6Xlj5HpgIHogIXmmK/lkKblrozlhajljLnphY3vvIknLFxuICAgICfku7vkvZXmmI7noa4gQOaIkSDnmoTmtojmga/vvIzmiJbogIXmj5DliLDmiJHnmoTlkI3lrZfnmoTmtojmga8nLFxuICBdKSk7XG4gIGNvbnNvbGUubG9nKGRhdGEpO1xuICAvLyDmj5LlhaXosIPor5XmlbDmja5cbiAgZGF0YS51bnNoaWZ0KHtcbiAgICBncm91cE5hbWU6ICdSZWNvcmRpbmcgVGVzdCcsXG4gICAgZ3JvdXBJZDogJzEyMycsXG4gICAgcG9zdHM6IFtcbiAgICAgIHsgY3JlYXRvcjogJ1NvcGhpYSAoSmlubWVpKSBMaW4nLCB0aW1lOiAnMjAyNS0wMi0xMyAwMDowMDowMCcsIHRleHQ6ICdSZWNvcmRpbmcgcHJvamVjdCBCRSBkZXBlbmRlbmNpZXMgY29tcGxldGVkJyB9XG4gICAgXVxuICB9KTtcbiAgZGF0YS51bnNoaWZ0KHtcbiAgICBncm91cE5hbWU6ICflpKfnvqQnLFxuICAgIGdyb3VwSWQ6ICczMjEnLFxuICAgIHBvc3RzOiBbXG4gICAgICB7IGNyZWF0b3I6ICdDb2xpbiBMaXUnLCB0aW1lOiAnMjAyNS0wMi0xNCAwMDowMDowMCcsIHRleHQ6ICdAVGVhbSDlupTopoHmsYLvvIzlpKflrrbms6jmhI/kuIDkuIvliLDlhazlj7jml7blgJnnmoTkuIrkuIvnj63ml7bpl7TvvIzoh7PlsJHkv53mjIE45Liq5bCP5pe25Zyo5YWs5Y+455qE5pe26Ze077yM5peg54m55q6K5oOF5Ya15LiN6KaB5Lit5Zy656a75byA77yM6LCi6LCi5ZCE5L2NIOOAgicgfVxuICAgIF1cbiAgfSk7XG4gIGRhdGEuc3BsaWNlKDMpO1xuICBjb25zb2xlLmxvZyhkYXRhKTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTExNX1RZUEUgPT09ICdsb2NhbCcpIHtcbiAgICAvLyDmi4bliIbljZXmnaHlj5HpgIEgTExNXG4gICAgZGF0YS5mb3JFYWNoKChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYC0t5byA5aeL5YiG5p6Q56ysICR7aW5kZXgrMX0vJHtkYXRhLmxlbmd0aH0g5p2h5raI5oGvLS1gKTtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgPG1lc3NhZ2VfZ3JvdXAgdGVhbV9uYW1lPVwiJHtpdGVtLmdyb3VwTmFtZX1cIiB0ZWFtX2lkPVwiJHtpdGVtLmdyb3VwSWR9XCI+JHtpdGVtLnBvc3RzLm1hcCgocG9zdDphbnkpID0+IGBcbiAgICAgICAgICA8bWVzc2FnZV9jb250ZW50IHNlbmRlcj1cIiR7cG9zdC5jcmVhdG9yfVwiIGRhdGV0aW1lPVwiJHtwb3N0LnRpbWV9XCI+JHtwb3N0LnRleHR9PC9tZXNzYWdlX2NvbnRlbnQ+YCkuam9pbignJyl9XG4gICAgICAgIDwvbWVzc2FnZV9ncm91cD5gXG4gICAgICBjb25zdCBwcm9tcHQgPSBgXG4gICAgICAgIOaIkeeahOWQjeWtl+aYr++8miR7dXNlcm5hbWV9IO+8iOWmguaenOi/h+a7pOinhOWImeS4rea2iOaBr+eahOWGheWuuSBtZXNzYWdlX2NvbnRlbnQg5pyJ5o+Q5Yiw5oiR77yM5Y+v5L2c5Li65Yik5pat5raI5oGv5piv5ZCm5pyJQOaIke+8jOWNs+S+v+aYr+S4jeW4puWnk+awj0DlkI3lrZfpg6jliIYg5Lmf6KeG5Li65o+Q5Y+K77yM5o6S6ZmkIHNlbmRlciDmmK/miJHnmoTmtojmga/vvIlcblxuICAgICAgICAtLS0tIOi/meaYr+aIkeaUtuWIsOeahOacgOi/keiBiuadoea2iOaBr+W8gOWniyAtLS0tXG4gICAgICAgICR7bWVzc2FnZX1cbiAgICAgICAgLS0tLSDov5nmmK/miJHmlLbliLDnmoTmnIDov5HogYrmnaHmtojmga/nu5PmnZ8gLS0tLVxuXG4gICAgICAgIC0tLS0g5Lul5LiL5piv5oiR55qE6ZyA5rGC5ZKM5L2g6ZyA6KaB6L+U5Zue55qE5YaF5a655a6a5LmJIC0tLS1cbiAgICAgICAg5L2g5piv5LiA5Liq5b6I57uG5b+D55qE6aG555uu57uP55CG77yM6K+35LuU57uG6ZiF6K+75bm26K6k55yf5YiG5p6Q5Lul5LiK5raI5oGv77yM5omn6KGM5Lul5LiL5LiJ5q2l55qE5Lu75Yqh77yaXG4gICAgICAgIDEuIOivt+S7lOe7humYheivuyBtZXNzYWdlX2dyb3VwIOmHjOeahOavj+adoeiBiuWkqea2iOaBr++8jOWIpOaWremHjOmdoueahCBtZXNzYWdlX2NvbnRlbnQg5piv5ZCm5pyJ56ym5ZCI5Lul5LiL6KeE5YiZ5YW25Lit5LiA5p2h77yaXG4gICAgICAgICAgJHtjb25jZXJuZWRfcGFydC5tYXAoKGl0ZW06YW55LCBpOm51bWJlcikgPT4gYC0g6KeE5YiZJHtpKzF9OiAke2l0ZW19YCkuam9pbignXFxuICAgICAgICAgICcpfVxuICAgICAgICAyLiDlr7kgbWVzc2FnZV9ncm91cCDkuK3liJrmnInnrKblkIjop4TliJnnmoTmtojmga/vvIzor7fmj5Dlj5bku6XkuIvlrZfmrrXvvIjlj6rmj5Dlj5bljp/mlofvvIzkuI3lgZrkv67mlLnkuI3lgZrnv7vor5HvvInvvJpcbiAgICAgICAgICAtIG1lc3NhZ2VfY29udGVudOa2iOaBr+WOn+aWh+WPiuWFtuWvueW6lOWPkemAgeiAhXNlbmRlcuWSjOWPkemAgeaXtumXtGRhdGV0aW1lLCDov5jmnIltZXNzYWdlX2dyb3Vw5Lit55qEIHRlYW1fbmFtZSwgdGVhbV9pZCwg5Lul5Y+K56ym5ZCI55qE6KeE5YiZeFxuICAgICAgICAzLiDlr7kgbWVzc2FnZV9ncm91cCDkuK3liJrmnInnrKblkIjop4TliJnnmoTmtojmga/vvIzmr4/mnaHnlJ/miJDlr7nlupTnmoTov5kgMyDkuKrmlrDlrZfmrrXvvJpcbiAgICAgICAgICAtIG1hdGNoZWRfcnVsZTog5LiK6Z2i56ys5LiA5q2l55qE56ym5ZCI5Yiw55qE6KeE5YiZeOeahOWOn+aWh+WGheWuuVxuICAgICAgICAgIC0gZmlsdGVyX3JlYXNvbjog6YCJ5oup6L+Z5p2h5raI5oGv6L+H5ruk5Ye65p2l55qE5Y6f5Zug77yM5Y+v5Lul55So5Lit5paH6KGo6L6+XG4gICAgICAgICAgLSBzdW1tYXJ5OiDlr7nov5nmnaHmtojmga/miYDlnKjnmoQgbWVzc2FnZV9ncm91cCDnmoTlhbbku5bmtojmga/nmoTkuIrkuIvmloflgZrlh7rmgLvnu5PlubbpgILlvZPnmoTmjqjnkIbkuLrku4DkuYhzZW5kZXLkvJrlj5Hlh7rov5nkuKrmtojmga/jgILor7fkuI3opoHnlZnnqbrvvIzov5nph4zlj6/ku6XnlKjkuK3mlodcblxuICAgICAgICDlsIbku7vliqHovpPlh7rnmoTmlbDmja7ov5vooYzlpoLkuIvpqozor4HvvJpcbiAgICAgICAgMS4g5Lul5Lil5qC8SlNPTuagvOW8j+i+k+WHuu+8jOS7heWMheWQq+WMuemFjeeahOa2iOaBr+OAguWmguaenOayoeacieWMuemFjeS7u+S9leinhOWIme+8jOi+k+WHuuepultd5pWw57uE77yaXG4gICAgICAgICAgW3tcbiAgICAgICAgICAgIFwibWVzc2FnZV9jb250ZW50XCI6IFwie21lc3NhZ2VfY29udGVudH1cIixcbiAgICAgICAgICAgIFwic2VuZGVyXCI6IFwie3NlbmRlcn1cIixcbiAgICAgICAgICAgIFwibWF0Y2hlZF9ydWxlXCI6IFwi5omA56ym5ZCI55qE6KeE5YiZ55qE5YaF5a65XCIsXG4gICAgICAgICAgICBcImZpbHRlcl9yZWFzb25cIjogXCJcIixcbiAgICAgICAgICAgIFwidGVhbV9uYW1lXCI6IFwie3RlYW1fbmFtZX1cIixcbiAgICAgICAgICAgIFwidGVhbV9pZFwiOiBcInt0ZWFtX2lkfVwiLFxuICAgICAgICAgICAgXCJ0ZWFtX3VybFwiOiBcImh0dHBzOi8vYXBwLnJpbmdjZW50cmFsLmNvbS9tZXNzYWdlcy97dGVhbV9pZH1cIixcbiAgICAgICAgICAgIFwic3VtbWFyeVwiOiBcIuivt+aAu+e7k+S4iuS4i+aWh+WIsOi/memHjFwiLFxuICAgICAgICAgICAgXCJkYXRldGltZVwiOiBcIntkYXRldGltZX1cIixcbiAgICAgICAgICB9XVxuICAgICAgICAyLiDlho3mrKHmo4Dmn6XkuIvljbPlsIbovpPlh7rnmoTlhoXlrrnvvIzmmK/lkKbmnInph43lpI3orrDlvZXvvIzlpoLmnpzlj5HnjrDph43lpI3orrDlvZXvvIhtZXNzYWdlX2NvbnRlbnTjgIF0ZWFtX2lkIOWSjCBkYXRldGltZSDpg73nm7jlkIzvvInvvIzkv53nlZnml7bpl7TovoPmlrDnmoTpgqPmnaHorrDlvZXvvIzliKDpmaTph43lpI3nmoTorrDlvZVcbiAgICAgIGBcbiAgICAgIHNlbmRUb09sbGFtYShwcm9tcHQpO1xuICAgIH0sIDMgKiA2MCAqIDEwMDAgKiBpbmRleCArIDEpKTtcblxuICB9IGVsc2Uge1xuICAgIC8vIOWQiOW5tuWPkemAgSBMTE1cbiAgICBjb25zdCBtZXNzYWdlcyA9IGRhdGEucmVkdWNlKChhY2MsIGl0ZW0pID0+IGAke2FjY31cXG5cbiAgICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIiR7aXRlbS5ncm91cE5hbWV9XCIgdGVhbV9pZD1cIiR7aXRlbS5ncm91cElkfVwiPiR7aXRlbS5wb3N0cy5tYXAoKHBvc3Q6YW55KSA9PiBgXG4gICAgICAgIDxtZXNzYWdlX2NvbnRlbnQgc2VuZGVyPVwiJHtwb3N0LmNyZWF0b3J9XCIgZGF0ZXRpbWU9XCIke3Bvc3QudGltZX1cIj4ke3Bvc3QudGV4dH08L21lc3NhZ2VfY29udGVudD5gKS5qb2luKCcnKX1cbiAgICAgIDwvbWVzc2FnZV9ncm91cD5gLCAnPG1lc3NhZ2VzPicpIFxuICAgICAgLy8g5aKe5Yqg6LCD6K+V5pWw5o2u8J+Rh1xuICAgICAgKyBgXFxuXFxuICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIlJlY29yZGluZyBUZXN0XCIgdGVhbV9pZD1cIjEyM1wiPlxuICAgICAgICA8bWVzc2FnZV9jb250ZW50IHNlbmRlcj1cIlNvcGhpYSAoSmlubWVpKSBMaW5cIiBkYXRldGltZT1cIjIwMjUtMDItMTMgMDA6MDA6MDBcIj5SZWNvcmRpbmcgcHJvamVjdCBCRSBkZXBlbmRlbmNpZXMgY29tcGxldGVkPC9tZXNzYWdlX2NvbnRlbnQ+XG4gICAgICA8L21lc3NhZ2VfZ3JvdXA+YFxuICAgICAgKyBgXFxuXFxuICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIuWkp+e+pFwiIHRlYW1faWQ9XCIzMjFcIj5cbiAgICAgICAgPG1lc3NhZ2VfY29udGVudCBzZW5kZXI9XCJDb2xpbiBMaXVcIiBkYXRldGltZT1cIjIwMjUtMDItMTQgMDA6MDA6MDBcIj5AVGVhbSDlupTopoHmsYLvvIzlpKflrrbms6jmhI/kuIDkuIvliLDlhazlj7jml7blgJnnmoTkuIrkuIvnj63ml7bpl7TvvIzoh7PlsJHkv53mjIE45Liq5bCP5pe25Zyo5YWs5Y+455qE5pe26Ze077yM5peg54m55q6K5oOF5Ya15LiN6KaB5Lit5Zy656a75byA77yM6LCi6LCi5ZCE5L2NIOOAgjwvbWVzc2FnZV9jb250ZW50PlxuICAgICAgPC9tZXNzYWdlX2dyb3VwPmBcbiAgICAgICsgJ1xcbiAgICA8L21lc3NhZ2VzPic7XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgXG4gICAgICDmiJHnmoTlkI3lrZfmmK/vvJoke3VzZXJuYW1lfSDvvIjlpoLmnpzov4fmu6Top4TliJnkuK3mtojmga/nmoTlhoXlrrkgbWVzc2FnZV9jb250ZW50IOacieaPkOWIsOaIke+8jOWPr+S9nOS4uuWIpOaWrea2iOaBr+aYr+WQpuaciUDmiJHvvIzljbPkvr/mmK/kuI3luKblp5PmsI9A5ZCN5a2X6YOo5YiGIOS5n+inhuS4uuaPkOWPiu+8jOaOkumZpCBzZW5kZXIg5piv5oiR55qE5raI5oGv77yJXG5cbiAgICAgIC0tLS0g6L+Z5piv5oiR5pS25Yiw55qE5pyA6L+R6IGK5p2h5raI5oGv5byA5aeLIC0tLS1cbiAgICAgICR7bWVzc2FnZXN9XG4gICAgICAtLS0tIOi/meaYr+aIkeaUtuWIsOeahOacgOi/keiBiuadoea2iOaBr+e7k+adnyAtLS0tXG5cbiAgICAgIOavj+adoSBtZXNzYWdlX2dyb3VwIOmDveaYr+WQjOS4gOS4que+pOe7hOeahOa2iOaBr+mbhuWQiO+8jOWFtuS4reWPr+iDveWMheWQq+S6huWkmuadoeS4jeWQjOS6uuWPkeeahCBtZXNzYWdlX2NvbnRlbnTvvIzkuI3lkIznmoQgbWVzc2FnZV9ncm91cCDkuI3nm7jlhbPogZTjgIJcbiAgICAgIOS9oOaYr+S4gOS4quW+iOe7huW/g+eahOmhueebrue7j+eQhu+8jOivt+iupOecn+WIhuaekOS7peS4iua2iOaBr++8jOW5tuaMieeFp+S7peS4i+imgeaxgui/lOWbnuaVsOaNruOAglxuXG4gICAgICAtLS0tIOS7peS4i+aYr+aIkeeahOmcgOaxguWSjOS9oOmcgOimgei/lOWbnueahOWGheWuueWumuS5iSAtLS0tXG4gICAgICDorqnmiJHku6zmnaXkuIDkuKrkuIDkuKrmn6XnnIsgbWVzc2FnZV9ncm91cO+8jOW5tuS4lOmSiOWvueavj+S4qiBtZXNzYWdlX2dyb3VwIOmDveaJp+ihjOS7peS4i+S4ieatpeeahOS7u+WKoe+8mlxuICAgICAgMS4g6K+35LuU57uG6ZiF6K+7IG1lc3NhZ2VfZ3JvdXAg6YeM55qE5q+P5p2h6IGK5aSp5raI5oGv77yM5Yik5pat6YeM6Z2i55qEIG1lc3NhZ2VfY29udGVudCDmmK/lkKbmnInnrKblkIjku6XkuIvop4TliJnlhbbkuK3kuIDmnaHjgILlpoLmnpzmsqHmnInliJnot7Pov4flubbmn6XnnIvkuIvkuIDkuKogbWVzc2FnZV9ncm91cO+8mlxuICAgICAgICAke2NvbmNlcm5lZF9wYXJ0Lm1hcCgoaXRlbTphbnksIGk6bnVtYmVyKSA9PiBgLSDop4TliJkke2krMX06ICR7aXRlbX1gKS5qb2luKCdcXG4gICAgICAgICcpfVxuICAgICAgMi4g5a+5IG1lc3NhZ2VfZ3JvdXAg5Lit5Yia5pyJ56ym5ZCI6KeE5YiZ55qE5raI5oGv77yM6K+35o+Q5Y+W5Lul5LiL5a2X5q6177yI5Y+q5o+Q5Y+W5Y6f5paH77yM5LiN5YGa5L+u5pS55LiN5YGa57+76K+R77yJ77yaXG4gICAgICAgIC0gbWVzc2FnZV9jb250ZW505raI5oGv5Y6f5paH5Y+K5YW25a+55bqU5Y+R6YCB6ICFc2VuZGVy5ZKM5Y+R6YCB5pe26Ze0ZGF0ZXRpbWUsIOi/mOaciW1lc3NhZ2VfZ3JvdXDkuK3nmoQgdGVhbV9uYW1lLCB0ZWFtX2lkLCDku6Xlj4rnrKblkIjnmoTop4TliJl4XG4gICAgICAzLiDlr7kgbWVzc2FnZV9ncm91cCDkuK3liJrmnInnrKblkIjop4TliJnnmoTmtojmga/vvIzmr4/mnaHnlJ/miJDlr7nlupTnmoTov5kgMyDkuKrmlrDlrZfmrrXvvJpcbiAgICAgICAgLSBtYXRjaGVkX3J1bGU6IOS4iumdouesrOS4gOatpeeahOespuWQiOWIsOeahOinhOWImXjnmoTljp/mloflhoXlrrlcbiAgICAgICAgLSBmaWx0ZXJfcmVhc29uOiDpgInmi6nov5nmnaHmtojmga/ov4fmu6Tlh7rmnaXnmoTljp/lm6DvvIzlj6/ku6XnlKjkuK3mlofooajovr5cbiAgICAgICAgLSBzdW1tYXJ5OiDlr7nov5nmnaHmtojmga/miYDlnKjnmoQgbWVzc2FnZV9ncm91cCDnmoTlhbbku5bmtojmga/nmoTkuIrkuIvmloflgZrlh7rmgLvnu5PlubbpgILlvZPnmoTmjqjnkIbkuLrku4DkuYhzZW5kZXLkvJrlj5Hlh7rov5nkuKrmtojmga/jgILor7fkuI3opoHnlZnnqbrvvIzov5nph4zlj6/ku6XnlKjkuK3mlodcbiAgICAgIOe7k+adn+W9k+WJjSBtZXNzYWdlX2dyb3VwIOeahOS4ieatpeS7u+WKoeWQju+8jOW8gOWni+mBjeWOhuS4i+S4gOS4qiBtZXNzYWdlX2dyb3Vw77yM55u05Yiw5omA5pyJIG1lc3NhZ2VfZ3JvdXAg6YO96YGN5Y6G5a6M5oiQ44CCXG5cbiAgICAgIOWwhuS7u+WKoei+k+WHuueahOaVsOaNrui/m+ihjOWmguS4i+mqjOivge+8mlxuICAgICAgMS4g5Lul5Lil5qC8SlNPTuagvOW8j+i+k+WHuu+8jOS7heWMheWQq+WMuemFjeeahOa2iOaBr+OAguWmguaenOayoeacieWMuemFjeS7u+S9leinhOWIme+8jOi+k+WHuuepultd5pWw57uE77yaXG4gICAgICAgIFt7XG4gICAgICAgICAgXCJtZXNzYWdlX2NvbnRlbnRcIjogXCJ7bWVzc2FnZV9jb250ZW50fVwiLFxuICAgICAgICAgIFwic2VuZGVyXCI6IFwie3NlbmRlcn1cIixcbiAgICAgICAgICBcIm1hdGNoZWRfcnVsZVwiOiBcIuaJgOespuWQiOeahOinhOWImeeahOWGheWuuVwiLFxuICAgICAgICAgIFwiZmlsdGVyX3JlYXNvblwiOiBcIlwiLFxuICAgICAgICAgIFwidGVhbV9uYW1lXCI6IFwie3RlYW1fbmFtZX1cIixcbiAgICAgICAgICBcInRlYW1faWRcIjogXCJ7dGVhbV9pZH1cIixcbiAgICAgICAgICBcInRlYW1fdXJsXCI6IFwiaHR0cHM6Ly9hcHAucmluZ2NlbnRyYWwuY29tL21lc3NhZ2VzL3t0ZWFtX2lkfVwiLFxuICAgICAgICAgIFwic3VtbWFyeVwiOiBcIuivt+aAu+e7k+S4iuS4i+aWh+WIsOi/memHjFwiLFxuICAgICAgICAgIFwiZGF0ZXRpbWVcIjogXCJ7ZGF0ZXRpbWV9XCIsXG4gICAgICAgIH1dXG4gICAgICAyLiDlho3mrKHmo4Dmn6XkuIvljbPlsIbovpPlh7rnmoTlhoXlrrnvvIzmmK/lkKbmnInph43lpI3orrDlvZXvvIzlpoLmnpzlj5HnjrDph43lpI3orrDlvZXvvIhtZXNzYWdlX2NvbnRlbnTjgIF0ZWFtX2lkIOWSjCBkYXRldGltZSDpg73nm7jlkIzvvInvvIzkv53nlZnml7bpl7TovoPmlrDnmoTpgqPmnaHorrDlvZXvvIzliKDpmaTph43lpI3nmoTorrDlvZVcbiAgICBgXG4gICAgc2VuZFRvT2xsYW1hKHByb21wdCk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHNlbmRUb09sbGFtYSA9IGFzeW5jIChwcm9tcHQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIHByb21wdCB0byBPbGxhbWE6JywgcHJvbXB0KTtcbiAgICB0cnkge1xuICAgICAgICAvLyDmo4Dmn6XmmK/lkKblnKggYmFja2dyb3VuZCBzY3JpcHQg546v5aKD5LitXG4gICAgICAgIGNvbnN0IGlzQmFja2dyb3VuZCA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnO1xuICAgICAgICBpZiAoaXNCYWNrZ3JvdW5kKSB7XG4gICAgICAgICAgICAvLyDlnKggYmFja2dyb3VuZCBzY3JpcHQg5Lit55u05o6l6LCD55So5aSE55CG5Ye95pWwXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgaGFuZGxlTExNUmVxdWVzdCh7IHByb21wdCB9KTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiT2xsYW1hJ3MgcmVzcG9uc2U6XCIsIGRhdGEucmVzcG9uc2UpO1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyDlnKggY29udGVudCBzY3JpcHQg5oiW5YW25LuW546v5aKD5Lit5L2/55SoIG1lc3NhZ2UgcGFzc2luZ1xuICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdPTExBTUFfUkVRVUVTVCcsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBib2R5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IHByb21wdFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgcmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzZW5kVG9PbGxhbWEtcmVzcG9uc2UnLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBzZW5kaW5nIHRvIE9sbGFtYTpcIiwgcmVzcG9uc2UuZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiQWRkaXRpb25hbCBkZXRhaWxzOlwiLCByZXNwb25zZS5kZXRhaWxzIHx8ICdObyBkZXRhaWxzJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5yYXdSZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJSYXcgcmVzcG9uc2UgZnJvbSBPbGxhbWE6XCIsIHJlc3BvbnNlLnJhd1Jlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYEZhaWxlZCB0byBjb25uZWN0IHRvIE9sbGFtYTogJHtyZXNwb25zZS5lcnJvcn1gLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiT2xsYW1hJ3MgcmVzcG9uc2U6XCIsIHJlc3BvbnNlLmRhdGEucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0FuYWx5c2lzIGNvbXBsZXRlLCBwbGVhc2UgY2hlY2sgdGhlIGNvbnNvbGUnLCAnc3VjY2VzcycpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJVbmV4cGVjdGVkIHJlc3BvbnNlIGZvcm1hdDpcIiwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ1JlY2VpdmVkIGludmFsaWQgcmVzcG9uc2UgZm9ybWF0IGZyb20gT2xsYW1hJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gc2VuZFRvT2xsYW1hOlwiLCBlcnJvcik7XG4gICAgICAgIHNob3dUb2FzdChgRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgICB9XG59O1xuXG5leHBvcnQgY29uc3Qgc2hvd1RvYXN0ID0gKG1lc3NhZ2U6IHN0cmluZywgdHlwZTogc3RyaW5nKSA9PiB7XG4gICAgKHdpbmRvdyBhcyBhbnkpLnNob3dUb2FzdD8uKG1lc3NhZ2UsIHR5cGUpO1xufTsiLCIvLyBleHBvcnQgY29uc3QgU0VSVkVSX0hPU1QgPSAnaHR0cHM6Ly9yYWRhci1wb2MuaW50LnJjbGFiZW52LmNvbTo4NDQzJztcbmV4cG9ydCBjb25zdCBTRVJWRVJfSE9TVCA9ICdodHRwOi8vbG9jYWxob3N0OjYzMzMnO1xuXG5leHBvcnQgY29uc3QgQVBJX1BBVEggPSB7XG4gICAgR0VOX1RPUElDUzogJy92MS9nZW4vdG9waWNzJyxcbiAgICBRVUVSWTogJy92MS9xdWVyeScsXG4gICAgR0xPQkFMX1FVRVJZOiAnL3YxL2dsb2JhbF9xdWVyeScsXG4gICAgTEFURVNUX0lOREVYX1RJTUU6ICcvdjEvZmV0Y2hfbGF0ZXN0X2luZGV4X3RpbWUnLFxuICAgIElOREVYSU5HOiAnL3YxL2luZGV4aW5nJyxcbiAgICBJTkNSRU1FTlQ6ICcvdjEvdXBkYXRlX2luZGV4aW5nJyxcbiAgICBERUxFVEU6ICcvdjEvZGVsZXRlJyxcbiAgICBUUkVORElOR19UT1BJQ1M6ICcvdjEvdHJlbmRpbmcvdG9waWNzJyxcbn1cblxuZXhwb3J0IGNvbnN0IENPTkZJR19MT0NBTF9TVE9SQUdFX0tFWSA9ICdSQURBUl9QT0NfQ09ORklHJztcblxuZXhwb3J0IGNvbnN0IFJBREFSX1BPQ19SRVNVTFRfTElTVFMgPSAnUkFEQVJfUE9DX1JFU1VMVF9MSVNUUyc7XG5cbmV4cG9ydCBjb25zdCBSQURBUl9QT0NfQ0FORElEQVRFX1FVRVNUSU9OUyA9ICdSQURBUl9QT0NfQ0FORElEQVRFX1FVRVNUSU9OUyc7IiwiaW1wb3J0IE9wZW5BSSBmcm9tICdvcGVuYWknO1xuXG4vLyDliJ3lp4vljJYgT3BlbkFJIOWuouaIt+err1xuY29uc3Qgb3BlbmFpID0gbmV3IE9wZW5BSSh7XG4gICAgYXBpS2V5OiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSxcbiAgICBiYXNlVVJMOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0JBU0VfVVJMLFxuICAgIGRhbmdlcm91c2x5QWxsb3dCcm93c2VyOiB0cnVlXG59KTtcblxuLy8g5aSE55CGIE9sbGFtYSDor7fmsYLjgIJPbGxhbWEg5a6J6KOF5ZCO6ZyA6KaB5oqKIGxhdW5jaGN0bCBzZXRlbnYgT0xMQU1BX09SSUdJTlMgXCIqXCIg5Yqg5YWl5YiwIC5iYXNocmMg5LitXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVPbGxhbWFSZXF1ZXN0KGJvZHk6IGFueSkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7cHJvY2Vzcy5lbnYuT0xMQU1BX0JBU0VfVVJMfS9hcGkvZ2VuZXJhdGVgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBtb2RlbDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMLFxuICAgICAgICAgICAgcHJvbXB0OiBib2R5LnByb21wdCxcbiAgICAgICAgICAgIHN0cmVhbTogZmFsc2UsXG4gICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC4zLFxuICAgICAgICAgICAgdG9wX3A6IDAuOVxuICAgICAgICB9KVxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgZXJyb3IhIHN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbn1cblxuLy8g5aSE55CGIE9wZW5BSSDor7fmsYJcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZU9wZW5BSVJlcXVlc3QoYm9keTogYW55KSB7XG4gICAgY29uc3QgY29tcGxldGlvbiA9IGF3YWl0IG9wZW5haS5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XG4gICAgICAgIG1vZGVsOiBwcm9jZXNzLmVudi5PUEVOQUlfTU9ERUwsXG4gICAgICAgIG1lc3NhZ2VzOiBbeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogYm9keS5wcm9tcHQgfV0sXG4gICAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICAgIHRvcF9wOiAwLjlcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3BvbnNlOiBjb21wbGV0aW9uLmNob2ljZXNbMF0ubWVzc2FnZS5jb250ZW50XG4gICAgfTtcbn1cblxuLy8g5qC55o2u6YWN572u6YCJ5oup5LiN5ZCM55qE5aSE55CG5pa55byPXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlTExNUmVxdWVzdChib2R5OiBhbnkpIHtcbiAgICBjb25zdCBoYW5kbGVyID0gcHJvY2Vzcy5lbnYuTExNX1RZUEUgPT09ICdsb2NhbCcgPyBoYW5kbGVPbGxhbWFSZXF1ZXN0IDogaGFuZGxlT3BlbkFJUmVxdWVzdDtcbiAgICByZXR1cm4gYXdhaXQgaGFuZGxlcihib2R5KTtcbn0gIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgeyBzZW5kRGF0YVRvT2xsYW1hIH0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHsgaGFuZGxlTExNUmVxdWVzdCB9IGZyb20gJy4vbGxtJztcblxuY29uc29sZS5sb2coJ0JhY2tncm91bmQgc2NyaXB0IGxvYWRlZCcpO1xuXG4vLyDmianlsZXlronoo4XmiJbmm7TmlrDml7bvvIznq4vljbPliJvlu7rlrprml7bku7vliqFcbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnRXh0ZW5zaW9uIGluc3RhbGxlZC91cGRhdGVkJyk7XG4gICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgICByZWNlbnREYXlzOiAxIC8gMjQsXG4gICAgICAgICAgICBzZWxlY3RHcm91cE5hbWVzOiBcIlwiLFxuICAgICAgICAgICAgZW5hYmxlTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgIGVuYWJsZVNtczogZmFsc2UsXG4gICAgICAgICAgICBlbmFibGVWb2ljZW1haWw6IGZhbHNlLFxuICAgICAgICAgICAgZW5hYmxlQ2FsbFRyYW5zY3JpcHQ6IGZhbHNlLFxuICAgICAgICAgICAgZW5hYmxlQ2FsZW5kYXI6IGZhbHNlLFxuICAgICAgICAgICAgZW5hYmxlQ2FuZGlkYXRlUXVlc3Rpb25zOiBmYWxzZSxcbiAgICAgICAgICAgIHNlbGVjdEZvbGRlckdyb3VwSWRzOiBcIlwiLFxuICAgICAgICAgICAgdXNlcm5hbWU6IFwiRXNvbmUgUWl1XCIsXG4gICAgICAgICAgICBleHRlbnNpb25JZDogXCIxMzI1MDQ2MDIwXCIsXG4gICAgICAgICAgICBhcGlLZXk6IFwiYXBwLUNqQTAwRTJkQ3BVcWxwbXFoY1JwOTFncVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiNG9cIlxuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHJ1blNjaGVkdWxlZFRhc2soKTsgLy8g56uL5Y2z5omn6KGM5LiA5qyhXG4gICAgfSwgMTAwMDApO1xuICAgIC8vIOWIm+W7uuWumuaXtuS7u+WKoVxuICAgIGNocm9tZS5hbGFybXMuY3JlYXRlKCdjaGVja01lc3NhZ2VzJywge1xuICAgICAgICBwZXJpb2RJbk1pbnV0ZXM6IDEyMFxuICAgIH0pO1xufSk7XG5cbi8vIOebkeWQrOWumuaXtuS7u+WKoVxuY2hyb21lLmFsYXJtcy5vbkFsYXJtLmFkZExpc3RlbmVyKChhbGFybSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdhbGFybScsIGFsYXJtKTtcbiAgICBpZiAoYWxhcm0ubmFtZSA9PT0gJ2NoZWNrTWVzc2FnZXMnKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdSdW5uaW5nIHNjaGVkdWxlZCBtZXNzYWdlIGNoZWNrLi4uJyk7XG4gICAgICAgIHJ1blNjaGVkdWxlZFRhc2soKTtcbiAgICB9XG59KTtcblxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChyZXF1ZXN0LCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmVkIG1lc3NhZ2U6JywgcmVxdWVzdCk7XG5cbiAgICBpZiAocmVxdWVzdC50eXBlID09PSAnT0xMQU1BX1JFUVVFU1QnKSB7XG4gICAgICAgIGNvbnN0IHsgYm9keSB9ID0gcmVxdWVzdC5kYXRhO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgcmVxdWVzdCB0byBMTE06JywgYm9keSk7XG4gICAgICAgIFxuICAgICAgICBoYW5kbGVMTE1SZXF1ZXN0KGJvZHkpXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnTExNIHJlc3BvbnNlOicsIGRhdGEpO1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IGRhdGEgfSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdMTE0gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogYEZhaWxlZCB0byBjb25uZWN0IHRvICR7cHJvY2Vzcy5lbnYuTExNX1RZUEV9IHNlcnZpY2VgXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0LnR5cGUgPT09ICdDT05UUk9MX1NDSEVEVUxFRF9DSEVDSycpIHtcbiAgICAgICAgaWYgKHJlcXVlc3QuYWN0aW9uID09PSAnc3RhcnQnKSB7XG4gICAgICAgICAgICBzdGFydFNjaGVkdWxlZENoZWNrKCk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdGF0dXM6ICdzdGFydGVkJyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ3N0b3AnKSB7XG4gICAgICAgICAgICBzdG9wU2NoZWR1bGVkQ2hlY2soKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN0YXR1czogJ3N0b3BwZWQnIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn0pO1xuXG4vLyDlkK/liqjlrprml7bku7vliqFcbmV4cG9ydCBmdW5jdGlvbiBzdGFydFNjaGVkdWxlZENoZWNrKCkge1xuICAgIGNocm9tZS5hbGFybXMuY3JlYXRlKCdjaGVja01lc3NhZ2VzJywge1xuICAgICAgICBwZXJpb2RJbk1pbnV0ZXM6IDEyMCAgLy8g5q+PMuWwj+aXtuaJp+ihjOS4gOasoVxuICAgIH0pO1xuICAgIGNvbnNvbGUubG9nKCdTY2hlZHVsZWQgbWVzc2FnZSBjaGVjayBzdGFydGVkJyk7XG59XG5cbi8vIOWBnOatouWumuaXtuS7u+WKoVxuZXhwb3J0IGZ1bmN0aW9uIHN0b3BTY2hlZHVsZWRDaGVjaygpIHtcbiAgICBjaHJvbWUuYWxhcm1zLmNsZWFyKCdjaGVja01lc3NhZ2VzJyk7XG4gICAgY29uc29sZS5sb2coJ1NjaGVkdWxlZCBtZXNzYWdlIGNoZWNrIHN0b3BwZWQnKTtcbn1cblxuLy8g5a6a5pe25oqT5Y+W5YiG5p6Q5raI5oGvXG5hc3luYyBmdW5jdGlvbiBydW5TY2hlZHVsZWRUYXNrKCkge1xuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2NvbmZpZyddLCBhc3luYyAocmVzdWx0KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZXN1bHQnLCByZXN1bHQpO1xuICAgICAgICBpZiAocmVzdWx0LmNvbmZpZykge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnID0gcmVzdWx0LmNvbmZpZztcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5ldyBEYXRlKERhdGUubm93KCkgLSBjb25maWcucmVjZW50RGF5cyAqIDYwICogNjAgKiAxMDAwKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyDmn6Xmib7miJbliJvlu7ogUmluZ0NlbnRyYWwg5qCH562+6aG1XG4gICAgICAgICAgICAgICAgbGV0IHJjVGFiID0gYXdhaXQgZmluZFJpbmdDZW50cmFsVGFiKCk7XG4gICAgICAgICAgICAgICAgaWYgKCFyY1RhYikge1xuICAgICAgICAgICAgICAgICAgICByY1RhYiA9IGF3YWl0IGNyZWF0ZVJpbmdDZW50cmFsVGFiKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIOetieW+hemhtemdouWKoOi9veWujOaIkFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB3YWl0Rm9yVGFiTG9hZChyY1RhYi5pZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8g5bCd6K+V5Y+R6YCB5raI5oGv77yM5aaC5p6c5aSx6LSl5YiZ6YeN6K+VXG4gICAgICAgICAgICAgICAgYXdhaXQgc2VuZE1lc3NhZ2VXaXRoUmV0cnkocmNUYWIuaWQsIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0ZFVENIX1VTRVJfREFUQScsXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0JhY2tncm91bmQgdGFzayBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuLy8g5p+l5om+5bey5omT5byA55qEIFJpbmdDZW50cmFsIOagh+etvumhtVxuYXN5bmMgZnVuY3Rpb24gZmluZFJpbmdDZW50cmFsVGFiKCkge1xuICAgIGNvbnN0IHRhYnMgPSBhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7XG4gICAgICAgIHVybDogXCIqOi8vYXBwLnJpbmdjZW50cmFsLmNvbS8qXCJcbiAgICB9KTtcbiAgICByZXR1cm4gdGFic1swXTtcbn1cblxuLy8g5Yib5bu65paw55qEIFJpbmdDZW50cmFsIOagh+etvumhtVxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlUmluZ0NlbnRyYWxUYWIoKSB7XG4gICAgcmV0dXJuIGF3YWl0IGNocm9tZS50YWJzLmNyZWF0ZSh7XG4gICAgICAgIHVybDogXCJodHRwczovL2FwcC5yaW5nY2VudHJhbC5jb20vdmlkZW9cIixcbiAgICAgICAgYWN0aXZlOiBmYWxzZVxuICAgIH0pO1xufVxuXG4vLyDnrYnlvoXmoIfnrb7pobXliqDovb3lrozmiJBcbmZ1bmN0aW9uIHdhaXRGb3JUYWJMb2FkKHRhYklkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY2hyb21lLnRhYnMub25VcGRhdGVkLmFkZExpc3RlbmVyKGZ1bmN0aW9uIGxpc3RlbmVyKHVwZGF0ZWRUYWJJZCwgaW5mbykge1xuICAgICAgICAgICAgaWYgKHVwZGF0ZWRUYWJJZCA9PT0gdGFiSWQgJiYgaW5mby5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5vblVwZGF0ZWQucmVtb3ZlTGlzdGVuZXIobGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIC8vIOe7memhtemdouS4gOS6m+mineWkluaXtumXtOadpeWIneWni+WMliBjb250ZW50IHNjcmlwdFxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDluKbph43or5XmnLrliLbnmoTmtojmga/lj5HpgIHlh73mlbBcbmZ1bmN0aW9uIHNlbmRNZXNzYWdlV2l0aFJldHJ5KHRhYklkOiBudW1iZXIsIG1lc3NhZ2U6IGFueSwgbWF4UmV0cmllcyA9IDMpOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGxldCBhdHRlbXB0cyA9IDA7XG5cbiAgICAgICAgY29uc3QgdHJ5U2VuZE1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIG1lc3NhZ2UsIHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBBdHRlbXB0ICR7YXR0ZW1wdHN9IGZhaWxlZDpgLCBjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ZW1wdHMgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHRyeVNlbmRNZXNzYWdlLCAxMDAwKTsgLy8gMeenkuWQjumHjeivlVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignRmFpbGVkIHRvIHNlbmQgbWVzc2FnZSBhZnRlciBtdWx0aXBsZSBhdHRlbXB0cycpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kRGF0YVRvT2xsYW1hKHJlc3BvbnNlLmRhdGEsIG1lc3NhZ2UuY29uZmlnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIHVzZXIgZGF0YTogJyArIHJlc3BvbnNlPy5lcnJvcikpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5U2VuZE1lc3NhZ2UoKTtcbiAgICB9KTtcbn0gIl0sIm5hbWVzIjpbIlNFUlZFUl9IT1NUIiwiQVBJX1BBVEgiLCJoYW5kbGVMTE1SZXF1ZXN0IiwiZmV0Y2hSYWRhclBvY1NlcnZlciIsInBhdGgiLCJib2R5IiwidXJsIiwiZmV0Y2giLCJtZXRob2QiLCJoZWFkZXJzIiwiSlNPTiIsInN0cmluZ2lmeSIsInRoZW4iLCJyZXNwb25zZSIsIm9rIiwiZXJyb3JEYXRhIiwianNvbiIsIkVycm9yIiwiZGV0YWlsIiwic3RhdHVzIiwiZGF0YSIsImdlblRvcGljcyIsImNvbmZpZyIsInVzZXJuYW1lIiwiZXh0ZW5zaW9uSWQiLCJtb2RlbCIsImV4dGVuc2lvbl9pZCIsIkdFTl9UT1BJQ1MiLCJ0cmVuZGluZ1RvcGljcyIsIlRSRU5ESU5HX1RPUElDUyIsImN1c3RvbVF1ZXJ5IiwicXVlcnkiLCJRVUVSWSIsImdsb2JhbFF1ZXJ5IiwiR0xPQkFMX1FVRVJZIiwiZmV0Y2hMYXN0SW5kZXhUaW1lIiwiTEFURVNUX0lOREVYX1RJTUUiLCJpbmRleGluZyIsImxlbmd0aCIsIlByb21pc2UiLCJyZWplY3QiLCJJTkRFWElORyIsImluY3JlbWVudCIsIklOQ1JFTUVOVCIsImRlbGV0ZV9pbmRleGluZyIsIkRFTEVURSIsImZldGNoRGlmeVNlcnZlciIsImFwaUtleSIsImlucHV0cyIsInJlc3BvbnNlX21vZGUiLCJ1c2VyIiwiYW5zd2VyIiwiY2F0Y2giLCJlcnJvciIsIm1lc3NhZ2UiLCJzZW5kRGF0YVRvT2xsYW1hIiwiY29uY2VybmVkX3BhcnQiLCJwYXJzZSIsImNvbmNlcm5lZEl0ZW1zIiwiY29uc29sZSIsImxvZyIsInVuc2hpZnQiLCJncm91cE5hbWUiLCJncm91cElkIiwicG9zdHMiLCJjcmVhdG9yIiwidGltZSIsInRleHQiLCJzcGxpY2UiLCJwcm9jZXNzIiwiZW52IiwiTExNX1RZUEUiLCJmb3JFYWNoIiwiaXRlbSIsImluZGV4Iiwic2V0VGltZW91dCIsIm1hcCIsInBvc3QiLCJqb2luIiwicHJvbXB0IiwiaSIsInNlbmRUb09sbGFtYSIsIm1lc3NhZ2VzIiwicmVkdWNlIiwiYWNjIiwiaXNCYWNrZ3JvdW5kIiwid2luZG93IiwiY2hyb21lIiwicnVudGltZSIsInNlbmRNZXNzYWdlIiwidHlwZSIsImRldGFpbHMiLCJyYXdSZXNwb25zZSIsInNob3dUb2FzdCIsIkNPTkZJR19MT0NBTF9TVE9SQUdFX0tFWSIsIlJBREFSX1BPQ19SRVNVTFRfTElTVFMiLCJSQURBUl9QT0NfQ0FORElEQVRFX1FVRVNUSU9OUyIsIk9wZW5BSSIsIm9wZW5haSIsIk9QRU5BSV9BUElfS0VZIiwiYmFzZVVSTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJkYW5nZXJvdXNseUFsbG93QnJvd3NlciIsImhhbmRsZU9sbGFtYVJlcXVlc3QiLCJPTExBTUFfQkFTRV9VUkwiLCJPTExBTUFfTU9ERUwiLCJzdHJlYW0iLCJ0ZW1wZXJhdHVyZSIsInRvcF9wIiwiaGFuZGxlT3BlbkFJUmVxdWVzdCIsImNvbXBsZXRpb24iLCJjaGF0IiwiY29tcGxldGlvbnMiLCJjcmVhdGUiLCJPUEVOQUlfTU9ERUwiLCJyb2xlIiwiY29udGVudCIsImNob2ljZXMiLCJoYW5kbGVyIiwib25JbnN0YWxsZWQiLCJhZGRMaXN0ZW5lciIsInN0b3JhZ2UiLCJsb2NhbCIsInNldCIsInJlY2VudERheXMiLCJzZWxlY3RHcm91cE5hbWVzIiwiZW5hYmxlTWVzc2FnZSIsImVuYWJsZVNtcyIsImVuYWJsZVZvaWNlbWFpbCIsImVuYWJsZUNhbGxUcmFuc2NyaXB0IiwiZW5hYmxlQ2FsZW5kYXIiLCJlbmFibGVDYW5kaWRhdGVRdWVzdGlvbnMiLCJzZWxlY3RGb2xkZXJHcm91cElkcyIsInJ1blNjaGVkdWxlZFRhc2siLCJhbGFybXMiLCJwZXJpb2RJbk1pbnV0ZXMiLCJvbkFsYXJtIiwiYWxhcm0iLCJuYW1lIiwib25NZXNzYWdlIiwicmVxdWVzdCIsInNlbmRlciIsInNlbmRSZXNwb25zZSIsImFjdGlvbiIsInN0YXJ0U2NoZWR1bGVkQ2hlY2siLCJzdG9wU2NoZWR1bGVkQ2hlY2siLCJjbGVhciIsImdldCIsInJlc3VsdCIsInN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJyY1RhYiIsImZpbmRSaW5nQ2VudHJhbFRhYiIsImNyZWF0ZVJpbmdDZW50cmFsVGFiIiwid2FpdEZvclRhYkxvYWQiLCJpZCIsInNlbmRNZXNzYWdlV2l0aFJldHJ5IiwidGFicyIsImFjdGl2ZSIsInRhYklkIiwicmVzb2x2ZSIsIm9uVXBkYXRlZCIsImxpc3RlbmVyIiwidXBkYXRlZFRhYklkIiwiaW5mbyIsInJlbW92ZUxpc3RlbmVyIiwibWF4UmV0cmllcyIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsImF0dGVtcHRzIiwidHJ5U2VuZE1lc3NhZ2UiLCJsYXN0RXJyb3IiLCJzdWNjZXNzIl0sInNvdXJjZVJvb3QiOiIifQ==