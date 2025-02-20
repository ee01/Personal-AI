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
/* harmony import */ var _bot__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./bot */ "./src/bot.ts");



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
async function sendDataToOllama(data, config) {
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
  //   groupId: '321',
  //   posts: [
  //     { creator: 'Colin Liu', time: '2025-02-14 00:00:00', text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。' }
  //   ]
  // });
  // data.splice(2);
  console.log(data);
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
      await sendToOllama(prompt);
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
const sendToOllama = async prompt => {
  console.log('Sending prompt to Ollama:', prompt);
  try {
    // 检查是否在 background script 环境中
    const isBackground = typeof window === 'undefined';
    if (isBackground) {
      // 在 background script 中直接调用处理函数
      const [response, jsonArray] = await (0,_llm__WEBPACK_IMPORTED_MODULE_1__.handleLLMRequest)({
        prompt
      });
      console.log("Ollama's response:", response);
      console.log("Ollama's jsonArray:", jsonArray);
      // 发送 bot 消息，遍历数组中的每个项目
      if (jsonArray && jsonArray.length > 0) {
        jsonArray.forEach(json => {
          (0,_bot__WEBPACK_IMPORTED_MODULE_2__.sendBotMessage)({
            matched_rule: json.matched_rule,
            team_name: json.team_name,
            team_id: json.team_id,
            sender: json.sender,
            message_content: json.message_content,
            summary: json.summary
          }).catch(console.error);
        });
      }
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
      if (response.error) {
        console.error("Error sending to Ollama:", response.error);
        console.error("Additional details:", response.details || 'No details');
        if (response.rawResponse) {
          console.log("Raw response from Ollama:", response.rawResponse);
        }
        showToast(`Failed to connect to Ollama: ${response.error}`, 'error');
        throw new Error(response.error);
      }
      if (response.data) {
        console.log("LLM's response:", response.data);
        showToast('Analysis complete, please check the console', 'success');
        return response.data;
      } else {
        const error = new Error('Received invalid response format from LLM');
        console.error("Unexpected response format:", response);
        showToast(error.message, 'error');
        throw error;
      }
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

/***/ "./src/bot.ts":
/*!********************!*\
  !*** ./src/bot.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   sendBotMessage: () => (/* binding */ sendBotMessage)
/* harmony export */ });
const BOT_API_BASE_URL = 'https://botman.int.rclabenv.com/v2';
const BOT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImVzb25lLnFpdUByaW5nY2VudHJhbC5jb20iLCJzZXJ2aWNlIjoiU01fYm90LnNlcnZpY2UiLCJyb2xlIjoiUk9MRV9VU0VSIiwiaWF0IjoxNzM5OTQyMjUyLCJleHAiOjIwNTUzMDIyNTJ9.ieSb3zGIwVhUTqZpkgJipK8ktH4FVJr3vDF0kyQ-4DI";
const BOT_TYPE = "user";
const TEAM_ID = "1497300893698";
async function sendBotMessage(messageData) {
  console.log("Sending bot message:", messageData);
  const username = (await chrome.storage.local.get('config')).config.username;
  const userEmail = username.trim().split(' ').join('.') + '@ringcentral.com';
  const formattedMessage = `**监测到一条您可能关注的消息** (AI可能幻觉 仅供参考)

__关注项__：\`${messageData.matched_rule}\`
__在群__：<a class='at_mention_compose' rel='{"id":${messageData.team_id}}'>@${messageData.team_name}</a>
__发送者__：${messageData.sender}
__原文__：${messageData.message_content}
__上下文__：${messageData.summary}`;
  const payload = BOT_TYPE === 'team' ? {
    mentionList: [userEmail],
    isTeamMention: false,
    teamName: messageData.team_name,
    teamId: TEAM_ID,
    message: formattedMessage,
    skipMentionCheck: true
  } : {
    mention: true,
    email: userEmail,
    emailAutoCorrect: true,
    message: formattedMessage
  };
  try {
    const response = await fetch(`${BOT_API_BASE_URL}/${BOT_TYPE}/message`, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOT_TOKEN}`,
        'bot': '4700372020@37439510.bot.glip.net'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Bot API error: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send bot message:', error);
    throw error;
  }
}

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

// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
async function handleLLMRequest(body) {
  const handler =  true ? handleOllamaRequest : 0;
  const response = await handler(body);
  const jsonData = extractJsonFromResponse(response);
  return [response, jsonData];
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
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./api */ "./src/api.ts");
/* harmony import */ var _llm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./llm */ "./src/llm.ts");
/* harmony import */ var _bot__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./bot */ "./src/bot.ts");



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
      console.log('getConfigFromWebpage', await getConfigFromWebpage());
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  if (request.type === 'LLM_REQUEST') {
    const {
      body
    } = request.data;
    console.log('Sending request to LLM:', body);
    (0,_llm__WEBPACK_IMPORTED_MODULE_1__.handleLLMRequest)(body).then(_ref => {
      let [raw, jsonArray] = _ref;
      console.log('LLM response:', raw);
      console.log('LLM jsonArray:', jsonArray);
      // 发送 bot 消息，遍历数组中的每个项目
      if (jsonArray && jsonArray.length > 0) {
        jsonArray.forEach(json => {
          (0,_bot__WEBPACK_IMPORTED_MODULE_2__.sendBotMessage)({
            matched_rule: json.matched_rule,
            team_name: json.team_name,
            team_id: json.team_id,
            sender: json.sender,
            message_content: json.message_content,
            summary: json.summary
          }).catch(console.error);
        });
      }
      sendResponse({
        data: raw
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
  chrome.storage.local.get(['config'], async result => {
    console.log('chrome.storage.local.result', result);
    if (result.config) {
      const config = result.config;
      const startTime = new Date(Date.now() - (scheduledInterval + 5) * 60 * 1000);
      try {
        // 查找或创建 RingCentral 标签页
        let rcTab = await findRingCentralTab();
        if (!rcTab) {
          rcTab = await createRingCentralTab();
          // 等待页面加载完成
          await waitForTabLoad(rcTab.id);
        }

        // 尝试发送消息，如果失败则重试
        const response = await sendMessageWithRetry(rcTab.id, {
          type: 'FETCH_USER_DATA',
          startTime,
          config
        });
        await (0,_api__WEBPACK_IMPORTED_MODULE_0__.sendDataToOllama)(response.data, config);
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
  const tab = await findRingCentralTab();
  if (!tab) {
    return null;
  }
  try {
    const response = await sendMessageWithRetry(tab.id, {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBLGtCQUFrQixtREFBVztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QUFFO1lBQ3ZCM0ksVUFBVSxDQUFDK0ksY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7VUFDdEMsQ0FBQyxNQUFNO1lBQ0hwTCxNQUFNLENBQUMsSUFBSXZCLEtBQUssQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO1VBQ3ZFO1FBQ0osQ0FBQyxNQUFNO1VBQ0gsSUFBSUosUUFBUSxJQUFJLENBQUNBLFFBQVEsQ0FBQ3dDLEtBQUssRUFBRTtZQUM3QjZKLE9BQU8sQ0FBQ3JNLFFBQVEsQ0FBQztVQUNyQixDQUFDLE1BQU07WUFDSDJCLE1BQU0sQ0FBQyxJQUFJdkIsS0FBSyxDQUFDLDZCQUE2QixHQUFHSixRQUFRLEVBQUV3QyxLQUFLLENBQUMsQ0FBQztVQUN0RTtRQUNKO01BQ0osQ0FBQyxDQUFDO0lBQ04sQ0FBQztJQUVEdUssY0FBYyxDQUFDLENBQUM7RUFDcEIsQ0FBQyxDQUFDO0FBQ047QUFFQSxlQUFlNUMsb0JBQW9CQSxDQUFBLEVBQUc7RUFDbEMsTUFBTThDLEdBQUcsR0FBRyxNQUFNbEQsa0JBQWtCLENBQUMsQ0FBQztFQUN0QyxJQUFJLENBQUNrRCxHQUFHLEVBQUU7SUFDTixPQUFPLElBQUk7RUFDZjtFQUVBLElBQUk7SUFDQSxNQUFNak4sUUFBUSxHQUFHLE1BQU1rTSxvQkFBb0IsQ0FBQ2UsR0FBRyxDQUFDakQsRUFBRSxFQUFFO01BQ2hEdEUsSUFBSSxFQUFFO0lBQ1YsQ0FBQyxDQUFDO0lBQ0YsT0FBTzFGLFFBQVEsQ0FBQ1MsTUFBTTtFQUMxQixDQUFDLENBQUMsT0FBTytCLEtBQUssRUFBRTtJQUNaUyxPQUFPLENBQUNULEtBQUssQ0FBQyx1QkFBdUIsRUFBRUEsS0FBSyxDQUFDO0lBQzdDLE9BQU8sSUFBSTtFQUNmO0FBQ0osQyIsInNvdXJjZXMiOlsid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvX3NoaW1zL011bHRpcGFydEJvZHkubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvX3NoaW1zL2luZGV4Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL19zaGltcy9yZWdpc3RyeS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9fc2hpbXMvd2ViLXJ1bnRpbWUubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvX3ZlbmRvci9wYXJ0aWFsLWpzb24tcGFyc2VyL3BhcnNlci5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9jb3JlLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2Vycm9yLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2luZGV4Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2ludGVybmFsL2RlY29kZXJzL2xpbmUubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvaW50ZXJuYWwvcXMvZm9ybWF0cy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9pbnRlcm5hbC9xcy9zdHJpbmdpZnkubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvaW50ZXJuYWwvcXMvdXRpbHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvaW50ZXJuYWwvc3RyZWFtLXV0aWxzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9Bc3Npc3RhbnRTdHJlYW0ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL0NoYXRDb21wbGV0aW9uUnVubmVyLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9DaGF0Q29tcGxldGlvblN0cmVhbS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9saWIvQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvbGliL0V2ZW50U3RyZWFtLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9SdW5uYWJsZUZ1bmN0aW9uLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9VdGlsLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9jaGF0Q29tcGxldGlvblV0aWxzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL2xpYi9wYXJzZXIubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcGFnaW5hdGlvbi5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZS5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYXVkaW8vYXVkaW8ubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2F1ZGlvL3NwZWVjaC5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYXVkaW8vdHJhbnNjcmlwdGlvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2F1ZGlvL3RyYW5zbGF0aW9ucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmF0Y2hlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS9hc3Npc3RhbnRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL2JldGEubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvY2hhdC9jaGF0Lm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL2NoYXQvY29tcGxldGlvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvcmVhbHRpbWUvcmVhbHRpbWUubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvcmVhbHRpbWUvc2Vzc2lvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdGhyZWFkcy9tZXNzYWdlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS90aHJlYWRzL3J1bnMvcnVucy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvYmV0YS90aHJlYWRzL3J1bnMvc3RlcHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdGhyZWFkcy90aHJlYWRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3ZlY3Rvci1zdG9yZXMvZmlsZS1iYXRjaGVzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9iZXRhL3ZlY3Rvci1zdG9yZXMvZmlsZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2JldGEvdmVjdG9yLXN0b3Jlcy92ZWN0b3Itc3RvcmVzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9jaGF0L2NoYXQubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2NoYXQvY29tcGxldGlvbnMvY29tcGxldGlvbnMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2NoYXQvY29tcGxldGlvbnMvbWVzc2FnZXMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2NvbXBsZXRpb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9lbWJlZGRpbmdzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9maWxlcy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvZmluZS10dW5pbmcvZmluZS10dW5pbmcubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2ZpbmUtdHVuaW5nL2pvYnMvY2hlY2twb2ludHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL2ZpbmUtdHVuaW5nL2pvYnMvam9icy5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vbm9kZV9tb2R1bGVzL29wZW5haS9yZXNvdXJjZXMvaW1hZ2VzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy9tb2RlbHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvcmVzb3VyY2VzL21vZGVyYXRpb25zLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy91cGxvYWRzL3BhcnRzLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3Jlc291cmNlcy91cGxvYWRzL3VwbG9hZHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvc3RyZWFtaW5nLm1qcyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9ub2RlX21vZHVsZXMvb3BlbmFpL3VwbG9hZHMubWpzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL25vZGVfbW9kdWxlcy9vcGVuYWkvdmVyc2lvbi5tanMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vc3JjL2FwaS50cyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9zcmMvYm90LnRzIiwid2VicGFjazovL3JhZGFyLXBvYy1mZS8uL3NyYy9jb25zdGFudHMudHMiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlLy4vc3JjL2xsbS50cyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vcmFkYXItcG9jLWZlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9yYWRhci1wb2MtZmUvLi9zcmMvYmFja2dyb3VuZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERpc2NsYWltZXI6IG1vZHVsZXMgaW4gX3NoaW1zIGFyZW4ndCBpbnRlbmRlZCB0byBiZSBpbXBvcnRlZCBieSBTREsgdXNlcnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBNdWx0aXBhcnRCb2R5IHtcbiAgICBjb25zdHJ1Y3Rvcihib2R5KSB7XG4gICAgICAgIHRoaXMuYm9keSA9IGJvZHk7XG4gICAgfVxuICAgIGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHtcbiAgICAgICAgcmV0dXJuICdNdWx0aXBhcnRCb2R5JztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1NdWx0aXBhcnRCb2R5Lm1qcy5tYXAiLCIvKipcbiAqIERpc2NsYWltZXI6IG1vZHVsZXMgaW4gX3NoaW1zIGFyZW4ndCBpbnRlbmRlZCB0byBiZSBpbXBvcnRlZCBieSBTREsgdXNlcnMuXG4gKi9cbmltcG9ydCAqIGFzIHNoaW1zIGZyb20gJy4vcmVnaXN0cnkubWpzJztcbmltcG9ydCAqIGFzIGF1dG8gZnJvbSAnb3BlbmFpL19zaGltcy9hdXRvL3J1bnRpbWUnO1xuaWYgKCFzaGltcy5raW5kKSBzaGltcy5zZXRTaGltcyhhdXRvLmdldFJ1bnRpbWUoKSwgeyBhdXRvOiB0cnVlIH0pO1xuZXhwb3J0ICogZnJvbSAnLi9yZWdpc3RyeS5tanMnO1xuIiwiZXhwb3J0IGxldCBhdXRvID0gZmFsc2U7XG5leHBvcnQgbGV0IGtpbmQgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IGZldGNoID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBSZXF1ZXN0ID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBSZXNwb25zZSA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgSGVhZGVycyA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgRm9ybURhdGEgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IEJsb2IgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IEZpbGUgPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IFJlYWRhYmxlU3RyZWFtID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBnZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9ucyA9IHVuZGVmaW5lZDtcbmV4cG9ydCBsZXQgZ2V0RGVmYXVsdEFnZW50ID0gdW5kZWZpbmVkO1xuZXhwb3J0IGxldCBmaWxlRnJvbVBhdGggPSB1bmRlZmluZWQ7XG5leHBvcnQgbGV0IGlzRnNSZWFkU3RyZWFtID0gdW5kZWZpbmVkO1xuZXhwb3J0IGZ1bmN0aW9uIHNldFNoaW1zKHNoaW1zLCBvcHRpb25zID0geyBhdXRvOiBmYWxzZSB9KSB7XG4gICAgaWYgKGF1dG8pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB5b3UgbXVzdCBcXGBpbXBvcnQgJ29wZW5haS9zaGltcy8ke3NoaW1zLmtpbmR9J1xcYCBiZWZvcmUgaW1wb3J0aW5nIGFueXRoaW5nIGVsc2UgZnJvbSBvcGVuYWlgKTtcbiAgICB9XG4gICAgaWYgKGtpbmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjYW4ndCBcXGBpbXBvcnQgJ29wZW5haS9zaGltcy8ke3NoaW1zLmtpbmR9J1xcYCBhZnRlciBcXGBpbXBvcnQgJ29wZW5haS9zaGltcy8ke2tpbmR9J1xcYGApO1xuICAgIH1cbiAgICBhdXRvID0gb3B0aW9ucy5hdXRvO1xuICAgIGtpbmQgPSBzaGltcy5raW5kO1xuICAgIGZldGNoID0gc2hpbXMuZmV0Y2g7XG4gICAgUmVxdWVzdCA9IHNoaW1zLlJlcXVlc3Q7XG4gICAgUmVzcG9uc2UgPSBzaGltcy5SZXNwb25zZTtcbiAgICBIZWFkZXJzID0gc2hpbXMuSGVhZGVycztcbiAgICBGb3JtRGF0YSA9IHNoaW1zLkZvcm1EYXRhO1xuICAgIEJsb2IgPSBzaGltcy5CbG9iO1xuICAgIEZpbGUgPSBzaGltcy5GaWxlO1xuICAgIFJlYWRhYmxlU3RyZWFtID0gc2hpbXMuUmVhZGFibGVTdHJlYW07XG4gICAgZ2V0TXVsdGlwYXJ0UmVxdWVzdE9wdGlvbnMgPSBzaGltcy5nZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9ucztcbiAgICBnZXREZWZhdWx0QWdlbnQgPSBzaGltcy5nZXREZWZhdWx0QWdlbnQ7XG4gICAgZmlsZUZyb21QYXRoID0gc2hpbXMuZmlsZUZyb21QYXRoO1xuICAgIGlzRnNSZWFkU3RyZWFtID0gc2hpbXMuaXNGc1JlYWRTdHJlYW07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZWdpc3RyeS5tanMubWFwIiwiaW1wb3J0IHsgTXVsdGlwYXJ0Qm9keSB9IGZyb20gXCIuL011bHRpcGFydEJvZHkubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gZ2V0UnVudGltZSh7IG1hbnVhbGx5SW1wb3J0ZWQgfSA9IHt9KSB7XG4gICAgY29uc3QgcmVjb21tZW5kYXRpb24gPSBtYW51YWxseUltcG9ydGVkID9cbiAgICAgICAgYFlvdSBtYXkgbmVlZCB0byB1c2UgcG9seWZpbGxzYFxuICAgICAgICA6IGBBZGQgb25lIG9mIHRoZXNlIGltcG9ydHMgYmVmb3JlIHlvdXIgZmlyc3QgXFxgaW1wb3J0IOKApiBmcm9tICdvcGVuYWknXFxgOlxuLSBcXGBpbXBvcnQgJ29wZW5haS9zaGltcy9ub2RlJ1xcYCAoaWYgeW91J3JlIHJ1bm5pbmcgb24gTm9kZSlcbi0gXFxgaW1wb3J0ICdvcGVuYWkvc2hpbXMvd2ViJ1xcYCAob3RoZXJ3aXNlKVxuYDtcbiAgICBsZXQgX2ZldGNoLCBfUmVxdWVzdCwgX1Jlc3BvbnNlLCBfSGVhZGVycztcbiAgICB0cnkge1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIF9mZXRjaCA9IGZldGNoO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIF9SZXF1ZXN0ID0gUmVxdWVzdDtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBfUmVzcG9uc2UgPSBSZXNwb25zZTtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBfSGVhZGVycyA9IEhlYWRlcnM7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZW52aXJvbm1lbnQgaXMgbWlzc2luZyB0aGUgZm9sbG93aW5nIFdlYiBGZXRjaCBBUEkgdHlwZTogJHtlcnJvci5tZXNzYWdlfS4gJHtyZWNvbW1lbmRhdGlvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogJ3dlYicsXG4gICAgICAgIGZldGNoOiBfZmV0Y2gsXG4gICAgICAgIFJlcXVlc3Q6IF9SZXF1ZXN0LFxuICAgICAgICBSZXNwb25zZTogX1Jlc3BvbnNlLFxuICAgICAgICBIZWFkZXJzOiBfSGVhZGVycyxcbiAgICAgICAgRm9ybURhdGE6IFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHR5cGVvZiBGb3JtRGF0YSAhPT0gJ3VuZGVmaW5lZCcgPyBGb3JtRGF0YSA6IChjbGFzcyBGb3JtRGF0YSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZpbGUgdXBsb2FkcyBhcmVuJ3Qgc3VwcG9ydGVkIGluIHRoaXMgZW52aXJvbm1lbnQgeWV0IGFzICdGb3JtRGF0YScgaXMgdW5kZWZpbmVkLiAke3JlY29tbWVuZGF0aW9ufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgQmxvYjogdHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnID8gQmxvYiA6IChjbGFzcyBCbG9iIHtcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmlsZSB1cGxvYWRzIGFyZW4ndCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudCB5ZXQgYXMgJ0Jsb2InIGlzIHVuZGVmaW5lZC4gJHtyZWNvbW1lbmRhdGlvbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIEZpbGU6IFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHR5cGVvZiBGaWxlICE9PSAndW5kZWZpbmVkJyA/IEZpbGUgOiAoY2xhc3MgRmlsZSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZpbGUgdXBsb2FkcyBhcmVuJ3Qgc3VwcG9ydGVkIGluIHRoaXMgZW52aXJvbm1lbnQgeWV0IGFzICdGaWxlJyBpcyB1bmRlZmluZWQuICR7cmVjb21tZW5kYXRpb259YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBSZWFkYWJsZVN0cmVhbTogXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdHlwZW9mIFJlYWRhYmxlU3RyZWFtICE9PSAndW5kZWZpbmVkJyA/IFJlYWRhYmxlU3RyZWFtIDogKGNsYXNzIFJlYWRhYmxlU3RyZWFtIHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc3RyZWFtaW5nIGlzbid0IHN1cHBvcnRlZCBpbiB0aGlzIGVudmlyb25tZW50IHlldCBhcyAnUmVhZGFibGVTdHJlYW0nIGlzIHVuZGVmaW5lZC4gJHtyZWNvbW1lbmRhdGlvbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIGdldE11bHRpcGFydFJlcXVlc3RPcHRpb25zOiBhc3luYyAoXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgZm9ybSwgb3B0cykgPT4gKHtcbiAgICAgICAgICAgIC4uLm9wdHMsXG4gICAgICAgICAgICBib2R5OiBuZXcgTXVsdGlwYXJ0Qm9keShmb3JtKSxcbiAgICAgICAgfSksXG4gICAgICAgIGdldERlZmF1bHRBZ2VudDogKHVybCkgPT4gdW5kZWZpbmVkLFxuICAgICAgICBmaWxlRnJvbVBhdGg6ICgpID0+IHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGBmaWxlRnJvbVBhdGhgIGZ1bmN0aW9uIGlzIG9ubHkgc3VwcG9ydGVkIGluIE5vZGUuIFNlZSB0aGUgUkVBRE1FIGZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vd3d3LmdpdGh1Yi5jb20vb3BlbmFpL29wZW5haS1ub2RlI2ZpbGUtdXBsb2FkcycpO1xuICAgICAgICB9LFxuICAgICAgICBpc0ZzUmVhZFN0cmVhbTogKHZhbHVlKSA9PiBmYWxzZSxcbiAgICB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9d2ViLXJ1bnRpbWUubWpzLm1hcCIsImNvbnN0IFNUUiA9IDBiMDAwMDAwMDAxO1xuY29uc3QgTlVNID0gMGIwMDAwMDAwMTA7XG5jb25zdCBBUlIgPSAwYjAwMDAwMDEwMDtcbmNvbnN0IE9CSiA9IDBiMDAwMDAxMDAwO1xuY29uc3QgTlVMTCA9IDBiMDAwMDEwMDAwO1xuY29uc3QgQk9PTCA9IDBiMDAwMTAwMDAwO1xuY29uc3QgTkFOID0gMGIwMDEwMDAwMDA7XG5jb25zdCBJTkZJTklUWSA9IDBiMDEwMDAwMDAwO1xuY29uc3QgTUlOVVNfSU5GSU5JVFkgPSAwYjEwMDAwMDAwMDtcbmNvbnN0IElORiA9IElORklOSVRZIHwgTUlOVVNfSU5GSU5JVFk7XG5jb25zdCBTUEVDSUFMID0gTlVMTCB8IEJPT0wgfCBJTkYgfCBOQU47XG5jb25zdCBBVE9NID0gU1RSIHwgTlVNIHwgU1BFQ0lBTDtcbmNvbnN0IENPTExFQ1RJT04gPSBBUlIgfCBPQko7XG5jb25zdCBBTEwgPSBBVE9NIHwgQ09MTEVDVElPTjtcbmNvbnN0IEFsbG93ID0ge1xuICAgIFNUUixcbiAgICBOVU0sXG4gICAgQVJSLFxuICAgIE9CSixcbiAgICBOVUxMLFxuICAgIEJPT0wsXG4gICAgTkFOLFxuICAgIElORklOSVRZLFxuICAgIE1JTlVTX0lORklOSVRZLFxuICAgIElORixcbiAgICBTUEVDSUFMLFxuICAgIEFUT00sXG4gICAgQ09MTEVDVElPTixcbiAgICBBTEwsXG59O1xuLy8gVGhlIEpTT04gc3RyaW5nIHNlZ21lbnQgd2FzIHVuYWJsZSB0byBiZSBwYXJzZWQgY29tcGxldGVseVxuY2xhc3MgUGFydGlhbEpTT04gZXh0ZW5kcyBFcnJvciB7XG59XG5jbGFzcyBNYWxmb3JtZWRKU09OIGV4dGVuZHMgRXJyb3Ige1xufVxuLyoqXG4gKiBQYXJzZSBpbmNvbXBsZXRlIEpTT05cbiAqIEBwYXJhbSB7c3RyaW5nfSBqc29uU3RyaW5nIFBhcnRpYWwgSlNPTiB0byBiZSBwYXJzZWRcbiAqIEBwYXJhbSB7bnVtYmVyfSBhbGxvd1BhcnRpYWwgU3BlY2lmeSB3aGF0IHR5cGVzIGFyZSBhbGxvd2VkIHRvIGJlIHBhcnRpYWwsIHNlZSB7QGxpbmsgQWxsb3d9IGZvciBkZXRhaWxzXG4gKiBAcmV0dXJucyBUaGUgcGFyc2VkIEpTT05cbiAqIEB0aHJvd3Mge1BhcnRpYWxKU09OfSBJZiB0aGUgSlNPTiBpcyBpbmNvbXBsZXRlIChyZWxhdGVkIHRvIHRoZSBgYWxsb3dgIHBhcmFtZXRlcilcbiAqIEB0aHJvd3Mge01hbGZvcm1lZEpTT059IElmIHRoZSBKU09OIGlzIG1hbGZvcm1lZFxuICovXG5mdW5jdGlvbiBwYXJzZUpTT04oanNvblN0cmluZywgYWxsb3dQYXJ0aWFsID0gQWxsb3cuQUxMKSB7XG4gICAgaWYgKHR5cGVvZiBqc29uU3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBleHBlY3Rpbmcgc3RyLCBnb3QgJHt0eXBlb2YganNvblN0cmluZ31gKTtcbiAgICB9XG4gICAgaWYgKCFqc29uU3RyaW5nLnRyaW0oKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7anNvblN0cmluZ30gaXMgZW1wdHlgKTtcbiAgICB9XG4gICAgcmV0dXJuIF9wYXJzZUpTT04oanNvblN0cmluZy50cmltKCksIGFsbG93UGFydGlhbCk7XG59XG5jb25zdCBfcGFyc2VKU09OID0gKGpzb25TdHJpbmcsIGFsbG93KSA9PiB7XG4gICAgY29uc3QgbGVuZ3RoID0ganNvblN0cmluZy5sZW5ndGg7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBtYXJrUGFydGlhbEpTT04gPSAobXNnKSA9PiB7XG4gICAgICAgIHRocm93IG5ldyBQYXJ0aWFsSlNPTihgJHttc2d9IGF0IHBvc2l0aW9uICR7aW5kZXh9YCk7XG4gICAgfTtcbiAgICBjb25zdCB0aHJvd01hbGZvcm1lZEVycm9yID0gKG1zZykgPT4ge1xuICAgICAgICB0aHJvdyBuZXcgTWFsZm9ybWVkSlNPTihgJHttc2d9IGF0IHBvc2l0aW9uICR7aW5kZXh9YCk7XG4gICAgfTtcbiAgICBjb25zdCBwYXJzZUFueSA9ICgpID0+IHtcbiAgICAgICAgc2tpcEJsYW5rKCk7XG4gICAgICAgIGlmIChpbmRleCA+PSBsZW5ndGgpXG4gICAgICAgICAgICBtYXJrUGFydGlhbEpTT04oJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0Jyk7XG4gICAgICAgIGlmIChqc29uU3RyaW5nW2luZGV4XSA9PT0gJ1wiJylcbiAgICAgICAgICAgIHJldHVybiBwYXJzZVN0cigpO1xuICAgICAgICBpZiAoanNvblN0cmluZ1tpbmRleF0gPT09ICd7JylcbiAgICAgICAgICAgIHJldHVybiBwYXJzZU9iaigpO1xuICAgICAgICBpZiAoanNvblN0cmluZ1tpbmRleF0gPT09ICdbJylcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUFycigpO1xuICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgNCkgPT09ICdudWxsJyB8fFxuICAgICAgICAgICAgKEFsbG93Lk5VTEwgJiBhbGxvdyAmJiBsZW5ndGggLSBpbmRleCA8IDQgJiYgJ251bGwnLnN0YXJ0c1dpdGgoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgpKSkpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDQ7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgNCkgPT09ICd0cnVlJyB8fFxuICAgICAgICAgICAgKEFsbG93LkJPT0wgJiBhbGxvdyAmJiBsZW5ndGggLSBpbmRleCA8IDQgJiYgJ3RydWUnLnN0YXJ0c1dpdGgoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgpKSkpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDQ7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgNSkgPT09ICdmYWxzZScgfHxcbiAgICAgICAgICAgIChBbGxvdy5CT09MICYgYWxsb3cgJiYgbGVuZ3RoIC0gaW5kZXggPCA1ICYmICdmYWxzZScuc3RhcnRzV2l0aChqc29uU3RyaW5nLnN1YnN0cmluZyhpbmRleCkpKSkge1xuICAgICAgICAgICAgaW5kZXggKz0gNTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgOCkgPT09ICdJbmZpbml0eScgfHxcbiAgICAgICAgICAgIChBbGxvdy5JTkZJTklUWSAmIGFsbG93ICYmIGxlbmd0aCAtIGluZGV4IDwgOCAmJiAnSW5maW5pdHknLnN0YXJ0c1dpdGgoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgpKSkpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDg7XG4gICAgICAgICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDkpID09PSAnLUluZmluaXR5JyB8fFxuICAgICAgICAgICAgKEFsbG93Lk1JTlVTX0lORklOSVRZICYgYWxsb3cgJiZcbiAgICAgICAgICAgICAgICAxIDwgbGVuZ3RoIC0gaW5kZXggJiZcbiAgICAgICAgICAgICAgICBsZW5ndGggLSBpbmRleCA8IDkgJiZcbiAgICAgICAgICAgICAgICAnLUluZmluaXR5Jy5zdGFydHNXaXRoKGpzb25TdHJpbmcuc3Vic3RyaW5nKGluZGV4KSkpKSB7XG4gICAgICAgICAgICBpbmRleCArPSA5O1xuICAgICAgICAgICAgcmV0dXJuIC1JbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgMykgPT09ICdOYU4nIHx8XG4gICAgICAgICAgICAoQWxsb3cuTkFOICYgYWxsb3cgJiYgbGVuZ3RoIC0gaW5kZXggPCAzICYmICdOYU4nLnN0YXJ0c1dpdGgoanNvblN0cmluZy5zdWJzdHJpbmcoaW5kZXgpKSkpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IDM7XG4gICAgICAgICAgICByZXR1cm4gTmFOO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXJzZU51bSgpO1xuICAgIH07XG4gICAgY29uc3QgcGFyc2VTdHIgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gaW5kZXg7XG4gICAgICAgIGxldCBlc2NhcGUgPSBmYWxzZTtcbiAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBpbml0aWFsIHF1b3RlXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCAmJiAoanNvblN0cmluZ1tpbmRleF0gIT09ICdcIicgfHwgKGVzY2FwZSAmJiBqc29uU3RyaW5nW2luZGV4IC0gMV0gPT09ICdcXFxcJykpKSB7XG4gICAgICAgICAgICBlc2NhcGUgPSBqc29uU3RyaW5nW2luZGV4XSA9PT0gJ1xcXFwnID8gIWVzY2FwZSA6IGZhbHNlO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAoanNvblN0cmluZy5jaGFyQXQoaW5kZXgpID09ICdcIicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoc3RhcnQsICsraW5kZXggLSBOdW1iZXIoZXNjYXBlKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvd01hbGZvcm1lZEVycm9yKFN0cmluZyhlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoQWxsb3cuU1RSICYgYWxsb3cpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGluZGV4IC0gTnVtYmVyKGVzY2FwZSkpICsgJ1wiJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFN5bnRheEVycm9yOiBJbnZhbGlkIGVzY2FwZSBzZXF1ZW5jZVxuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBqc29uU3RyaW5nLmxhc3RJbmRleE9mKCdcXFxcJykpICsgJ1wiJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbWFya1BhcnRpYWxKU09OKCdVbnRlcm1pbmF0ZWQgc3RyaW5nIGxpdGVyYWwnKTtcbiAgICB9O1xuICAgIGNvbnN0IHBhcnNlT2JqID0gKCkgPT4ge1xuICAgICAgICBpbmRleCsrOyAvLyBza2lwIGluaXRpYWwgYnJhY2VcbiAgICAgICAgc2tpcEJsYW5rKCk7XG4gICAgICAgIGNvbnN0IG9iaiA9IHt9O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2hpbGUgKGpzb25TdHJpbmdbaW5kZXhdICE9PSAnfScpIHtcbiAgICAgICAgICAgICAgICBza2lwQmxhbmsoKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gbGVuZ3RoICYmIEFsbG93Lk9CSiAmIGFsbG93KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHBhcnNlU3RyKCk7XG4gICAgICAgICAgICAgICAgc2tpcEJsYW5rKCk7XG4gICAgICAgICAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBjb2xvblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcGFyc2VBbnkoKTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwga2V5LCB7IHZhbHVlLCB3cml0YWJsZTogdHJ1ZSwgZW51bWVyYWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoQWxsb3cuT0JKICYgYWxsb3cpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBza2lwQmxhbmsoKTtcbiAgICAgICAgICAgICAgICBpZiAoanNvblN0cmluZ1tpbmRleF0gPT09ICcsJylcbiAgICAgICAgICAgICAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBjb21tYVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoQWxsb3cuT0JKICYgYWxsb3cpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBtYXJrUGFydGlhbEpTT04oXCJFeHBlY3RlZCAnfScgYXQgZW5kIG9mIG9iamVjdFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrOyAvLyBza2lwIGZpbmFsIGJyYWNlXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcbiAgICBjb25zdCBwYXJzZUFyciA9ICgpID0+IHtcbiAgICAgICAgaW5kZXgrKzsgLy8gc2tpcCBpbml0aWFsIGJyYWNrZXRcbiAgICAgICAgY29uc3QgYXJyID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3aGlsZSAoanNvblN0cmluZ1tpbmRleF0gIT09ICddJykge1xuICAgICAgICAgICAgICAgIGFyci5wdXNoKHBhcnNlQW55KCkpO1xuICAgICAgICAgICAgICAgIHNraXBCbGFuaygpO1xuICAgICAgICAgICAgICAgIGlmIChqc29uU3RyaW5nW2luZGV4XSA9PT0gJywnKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Kys7IC8vIHNraXAgY29tbWFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChBbGxvdy5BUlIgJiBhbGxvdykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXJrUGFydGlhbEpTT04oXCJFeHBlY3RlZCAnXScgYXQgZW5kIG9mIGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7IC8vIHNraXAgZmluYWwgYnJhY2tldFxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH07XG4gICAgY29uc3QgcGFyc2VOdW0gPSAoKSA9PiB7XG4gICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKGpzb25TdHJpbmcgPT09ICctJyAmJiBBbGxvdy5OVU0gJiBhbGxvdylcbiAgICAgICAgICAgICAgICBtYXJrUGFydGlhbEpTT04oXCJOb3Qgc3VyZSB3aGF0ICctJyBpc1wiKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChBbGxvdy5OVU0gJiBhbGxvdykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCcuJyA9PT0ganNvblN0cmluZ1tqc29uU3RyaW5nLmxlbmd0aCAtIDFdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKDAsIGpzb25TdHJpbmcubGFzdEluZGV4T2YoJy4nKSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoMCwganNvblN0cmluZy5sYXN0SW5kZXhPZignZScpKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aHJvd01hbGZvcm1lZEVycm9yKFN0cmluZyhlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhcnQgPSBpbmRleDtcbiAgICAgICAgaWYgKGpzb25TdHJpbmdbaW5kZXhdID09PSAnLScpXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB3aGlsZSAoanNvblN0cmluZ1tpbmRleF0gJiYgIScsXX0nLmluY2x1ZGVzKGpzb25TdHJpbmdbaW5kZXhdKSlcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIGlmIChpbmRleCA9PSBsZW5ndGggJiYgIShBbGxvdy5OVU0gJiBhbGxvdykpXG4gICAgICAgICAgICBtYXJrUGFydGlhbEpTT04oJ1VudGVybWluYXRlZCBudW1iZXIgbGl0ZXJhbCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvblN0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGluZGV4KSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChqc29uU3RyaW5nLnN1YnN0cmluZyhzdGFydCwgaW5kZXgpID09PSAnLScgJiYgQWxsb3cuTlVNICYgYWxsb3cpXG4gICAgICAgICAgICAgICAgbWFya1BhcnRpYWxKU09OKFwiTm90IHN1cmUgd2hhdCAnLScgaXNcIik7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb25TdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBqc29uU3RyaW5nLmxhc3RJbmRleE9mKCdlJykpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dNYWxmb3JtZWRFcnJvcihTdHJpbmcoZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBza2lwQmxhbmsgPSAoKSA9PiB7XG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCAmJiAnIFxcblxcclxcdCcuaW5jbHVkZXMoanNvblN0cmluZ1tpbmRleF0pKSB7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gcGFyc2VBbnkoKTtcbn07XG4vLyB1c2luZyB0aGlzIGZ1bmN0aW9uIHdpdGggbWFsZm9ybWVkIEpTT04gaXMgdW5kZWZpbmVkIGJlaGF2aW9yXG5jb25zdCBwYXJ0aWFsUGFyc2UgPSAoaW5wdXQpID0+IHBhcnNlSlNPTihpbnB1dCwgQWxsb3cuQUxMIF4gQWxsb3cuTlVNKTtcbmV4cG9ydCB7IHBhcnRpYWxQYXJzZSwgUGFydGlhbEpTT04sIE1hbGZvcm1lZEpTT04gfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBhcnNlci5tanMubWFwIiwidmFyIF9fY2xhc3NQcml2YXRlRmllbGRTZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRTZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xufTtcbnZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XG59O1xudmFyIF9BYnN0cmFjdFBhZ2VfY2xpZW50O1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb24ubWpzXCI7XG5pbXBvcnQgeyBTdHJlYW0gfSBmcm9tIFwiLi9zdHJlYW1pbmcubWpzXCI7XG5pbXBvcnQgeyBPcGVuQUlFcnJvciwgQVBJRXJyb3IsIEFQSUNvbm5lY3Rpb25FcnJvciwgQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvciwgQVBJVXNlckFib3J0RXJyb3IsIH0gZnJvbSBcIi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgeyBraW5kIGFzIHNoaW1zS2luZCwgZ2V0RGVmYXVsdEFnZW50LCBmZXRjaCwgfSBmcm9tIFwiLi9fc2hpbXMvaW5kZXgubWpzXCI7XG5pbXBvcnQgeyBpc0Jsb2JMaWtlLCBpc011bHRpcGFydEJvZHkgfSBmcm9tIFwiLi91cGxvYWRzLm1qc1wiO1xuZXhwb3J0IHsgbWF5YmVNdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMsIG11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucywgY3JlYXRlRm9ybSwgfSBmcm9tIFwiLi91cGxvYWRzLm1qc1wiO1xuYXN5bmMgZnVuY3Rpb24gZGVmYXVsdFBhcnNlUmVzcG9uc2UocHJvcHMpIHtcbiAgICBjb25zdCB7IHJlc3BvbnNlIH0gPSBwcm9wcztcbiAgICBpZiAocHJvcHMub3B0aW9ucy5zdHJlYW0pIHtcbiAgICAgICAgZGVidWcoJ3Jlc3BvbnNlJywgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZS51cmwsIHJlc3BvbnNlLmhlYWRlcnMsIHJlc3BvbnNlLmJvZHkpO1xuICAgICAgICAvLyBOb3RlOiB0aGVyZSBpcyBhbiBpbnZhcmlhbnQgaGVyZSB0aGF0IGlzbid0IHJlcHJlc2VudGVkIGluIHRoZSB0eXBlIHN5c3RlbVxuICAgICAgICAvLyB0aGF0IGlmIHlvdSBzZXQgYHN0cmVhbTogdHJ1ZWAgdGhlIHJlc3BvbnNlIHR5cGUgbXVzdCBhbHNvIGJlIGBTdHJlYW08VD5gXG4gICAgICAgIGlmIChwcm9wcy5vcHRpb25zLl9fc3RyZWFtQ2xhc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5vcHRpb25zLl9fc3RyZWFtQ2xhc3MuZnJvbVNTRVJlc3BvbnNlKHJlc3BvbnNlLCBwcm9wcy5jb250cm9sbGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gU3RyZWFtLmZyb21TU0VSZXNwb25zZShyZXNwb25zZSwgcHJvcHMuY29udHJvbGxlcik7XG4gICAgfVxuICAgIC8vIGZldGNoIHJlZnVzZXMgdG8gcmVhZCB0aGUgYm9keSB3aGVuIHRoZSBzdGF0dXMgY29kZSBpcyAyMDQuXG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjA0KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAocHJvcHMub3B0aW9ucy5fX2JpbmFyeVJlc3BvbnNlKSB7XG4gICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudFR5cGUgPSByZXNwb25zZS5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJyk7XG4gICAgY29uc3QgaXNKU09OID0gY29udGVudFR5cGU/LmluY2x1ZGVzKCdhcHBsaWNhdGlvbi9qc29uJykgfHwgY29udGVudFR5cGU/LmluY2x1ZGVzKCdhcHBsaWNhdGlvbi92bmQuYXBpK2pzb24nKTtcbiAgICBpZiAoaXNKU09OKSB7XG4gICAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIGRlYnVnKCdyZXNwb25zZScsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2UudXJsLCByZXNwb25zZS5oZWFkZXJzLCBqc29uKTtcbiAgICAgICAgcmV0dXJuIF9hZGRSZXF1ZXN0SUQoanNvbiwgcmVzcG9uc2UpO1xuICAgIH1cbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgIGRlYnVnKCdyZXNwb25zZScsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2UudXJsLCByZXNwb25zZS5oZWFkZXJzLCB0ZXh0KTtcbiAgICAvLyBUT0RPIGhhbmRsZSBibG9iLCBhcnJheWJ1ZmZlciwgb3RoZXIgY29udGVudCB0eXBlcywgZXRjLlxuICAgIHJldHVybiB0ZXh0O1xufVxuZnVuY3Rpb24gX2FkZFJlcXVlc3RJRCh2YWx1ZSwgcmVzcG9uc2UpIHtcbiAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHZhbHVlLCAnX3JlcXVlc3RfaWQnLCB7XG4gICAgICAgIHZhbHVlOiByZXNwb25zZS5oZWFkZXJzLmdldCgneC1yZXF1ZXN0LWlkJyksXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIH0pO1xufVxuLyoqXG4gKiBBIHN1YmNsYXNzIG9mIGBQcm9taXNlYCBwcm92aWRpbmcgYWRkaXRpb25hbCBoZWxwZXIgbWV0aG9kc1xuICogZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIFNESy5cbiAqL1xuZXhwb3J0IGNsYXNzIEFQSVByb21pc2UgZXh0ZW5kcyBQcm9taXNlIHtcbiAgICBjb25zdHJ1Y3RvcihyZXNwb25zZVByb21pc2UsIHBhcnNlUmVzcG9uc2UgPSBkZWZhdWx0UGFyc2VSZXNwb25zZSkge1xuICAgICAgICBzdXBlcigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgLy8gdGhpcyBpcyBtYXliZSBhIGJpdCB3ZWlyZCBidXQgdGhpcyBoYXMgdG8gYmUgYSBuby1vcCB0byBub3QgaW1wbGljaXRseVxuICAgICAgICAgICAgLy8gcGFyc2UgdGhlIHJlc3BvbnNlIGJvZHk7IGluc3RlYWQgLnRoZW4sIC5jYXRjaCwgLmZpbmFsbHkgYXJlIG92ZXJyaWRkZW5cbiAgICAgICAgICAgIC8vIHRvIHBhcnNlIHRoZSByZXNwb25zZVxuICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVzcG9uc2VQcm9taXNlID0gcmVzcG9uc2VQcm9taXNlO1xuICAgICAgICB0aGlzLnBhcnNlUmVzcG9uc2UgPSBwYXJzZVJlc3BvbnNlO1xuICAgIH1cbiAgICBfdGhlblVud3JhcCh0cmFuc2Zvcm0pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBUElQcm9taXNlKHRoaXMucmVzcG9uc2VQcm9taXNlLCBhc3luYyAocHJvcHMpID0+IF9hZGRSZXF1ZXN0SUQodHJhbnNmb3JtKGF3YWl0IHRoaXMucGFyc2VSZXNwb25zZShwcm9wcyksIHByb3BzKSwgcHJvcHMucmVzcG9uc2UpKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgcmF3IGBSZXNwb25zZWAgaW5zdGFuY2UgaW5zdGVhZCBvZiBwYXJzaW5nIHRoZSByZXNwb25zZVxuICAgICAqIGRhdGEuXG4gICAgICpcbiAgICAgKiBJZiB5b3Ugd2FudCB0byBwYXJzZSB0aGUgcmVzcG9uc2UgYm9keSBidXQgc3RpbGwgZ2V0IHRoZSBgUmVzcG9uc2VgXG4gICAgICogaW5zdGFuY2UsIHlvdSBjYW4gdXNlIHtAbGluayB3aXRoUmVzcG9uc2UoKX0uXG4gICAgICpcbiAgICAgKiDwn5GLIEdldHRpbmcgdGhlIHdyb25nIFR5cGVTY3JpcHQgdHlwZSBmb3IgYFJlc3BvbnNlYD9cbiAgICAgKiBUcnkgc2V0dGluZyBgXCJtb2R1bGVSZXNvbHV0aW9uXCI6IFwiTm9kZU5leHRcImAgaWYgeW91IGNhbixcbiAgICAgKiBvciBhZGQgb25lIG9mIHRoZXNlIGltcG9ydHMgYmVmb3JlIHlvdXIgZmlyc3QgYGltcG9ydCDigKYgZnJvbSAnb3BlbmFpJ2A6XG4gICAgICogLSBgaW1wb3J0ICdvcGVuYWkvc2hpbXMvbm9kZSdgIChpZiB5b3UncmUgcnVubmluZyBvbiBOb2RlKVxuICAgICAqIC0gYGltcG9ydCAnb3BlbmFpL3NoaW1zL3dlYidgIChvdGhlcndpc2UpXG4gICAgICovXG4gICAgYXNSZXNwb25zZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzcG9uc2VQcm9taXNlLnRoZW4oKHApID0+IHAucmVzcG9uc2UpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBwYXJzZWQgcmVzcG9uc2UgZGF0YSwgdGhlIHJhdyBgUmVzcG9uc2VgIGluc3RhbmNlIGFuZCB0aGUgSUQgb2YgdGhlIHJlcXVlc3QsXG4gICAgICogcmV0dXJuZWQgdmlhIHRoZSBYLVJlcXVlc3QtSUQgaGVhZGVyIHdoaWNoIGlzIHVzZWZ1bCBmb3IgZGVidWdnaW5nIHJlcXVlc3RzIGFuZCByZXBvcnRpbmdcbiAgICAgKiBpc3N1ZXMgdG8gT3BlbkFJLlxuICAgICAqXG4gICAgICogSWYgeW91IGp1c3Qgd2FudCB0byBnZXQgdGhlIHJhdyBgUmVzcG9uc2VgIGluc3RhbmNlIHdpdGhvdXQgcGFyc2luZyBpdCxcbiAgICAgKiB5b3UgY2FuIHVzZSB7QGxpbmsgYXNSZXNwb25zZSgpfS5cbiAgICAgKlxuICAgICAqXG4gICAgICog8J+RiyBHZXR0aW5nIHRoZSB3cm9uZyBUeXBlU2NyaXB0IHR5cGUgZm9yIGBSZXNwb25zZWA/XG4gICAgICogVHJ5IHNldHRpbmcgYFwibW9kdWxlUmVzb2x1dGlvblwiOiBcIk5vZGVOZXh0XCJgIGlmIHlvdSBjYW4sXG4gICAgICogb3IgYWRkIG9uZSBvZiB0aGVzZSBpbXBvcnRzIGJlZm9yZSB5b3VyIGZpcnN0IGBpbXBvcnQg4oCmIGZyb20gJ29wZW5haSdgOlxuICAgICAqIC0gYGltcG9ydCAnb3BlbmFpL3NoaW1zL25vZGUnYCAoaWYgeW91J3JlIHJ1bm5pbmcgb24gTm9kZSlcbiAgICAgKiAtIGBpbXBvcnQgJ29wZW5haS9zaGltcy93ZWInYCAob3RoZXJ3aXNlKVxuICAgICAqL1xuICAgIGFzeW5jIHdpdGhSZXNwb25zZSgpIHtcbiAgICAgICAgY29uc3QgW2RhdGEsIHJlc3BvbnNlXSA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnBhcnNlKCksIHRoaXMuYXNSZXNwb25zZSgpXSk7XG4gICAgICAgIHJldHVybiB7IGRhdGEsIHJlc3BvbnNlLCByZXF1ZXN0X2lkOiByZXNwb25zZS5oZWFkZXJzLmdldCgneC1yZXF1ZXN0LWlkJykgfTtcbiAgICB9XG4gICAgcGFyc2UoKSB7XG4gICAgICAgIGlmICghdGhpcy5wYXJzZWRQcm9taXNlKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnNlZFByb21pc2UgPSB0aGlzLnJlc3BvbnNlUHJvbWlzZS50aGVuKHRoaXMucGFyc2VSZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VkUHJvbWlzZTtcbiAgICB9XG4gICAgdGhlbihvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZSgpLnRoZW4ob25mdWxmaWxsZWQsIG9ucmVqZWN0ZWQpO1xuICAgIH1cbiAgICBjYXRjaChvbnJlamVjdGVkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlKCkuY2F0Y2gob25yZWplY3RlZCk7XG4gICAgfVxuICAgIGZpbmFsbHkob25maW5hbGx5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlKCkuZmluYWxseShvbmZpbmFsbHkpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBUElDbGllbnQge1xuICAgIGNvbnN0cnVjdG9yKHsgYmFzZVVSTCwgbWF4UmV0cmllcyA9IDIsIHRpbWVvdXQgPSA2MDAwMDAsIC8vIDEwIG1pbnV0ZXNcbiAgICBodHRwQWdlbnQsIGZldGNoOiBvdmVycmlkZGVuRmV0Y2gsIH0pIHtcbiAgICAgICAgdGhpcy5iYXNlVVJMID0gYmFzZVVSTDtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gdmFsaWRhdGVQb3NpdGl2ZUludGVnZXIoJ21heFJldHJpZXMnLCBtYXhSZXRyaWVzKTtcbiAgICAgICAgdGhpcy50aW1lb3V0ID0gdmFsaWRhdGVQb3NpdGl2ZUludGVnZXIoJ3RpbWVvdXQnLCB0aW1lb3V0KTtcbiAgICAgICAgdGhpcy5odHRwQWdlbnQgPSBodHRwQWdlbnQ7XG4gICAgICAgIHRoaXMuZmV0Y2ggPSBvdmVycmlkZGVuRmV0Y2ggPz8gZmV0Y2g7XG4gICAgfVxuICAgIGF1dGhIZWFkZXJzKG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBPdmVycmlkZSB0aGlzIHRvIGFkZCB5b3VyIG93biBkZWZhdWx0IGhlYWRlcnMsIGZvciBleGFtcGxlOlxuICAgICAqXG4gICAgICogIHtcbiAgICAgKiAgICAuLi5zdXBlci5kZWZhdWx0SGVhZGVycygpLFxuICAgICAqICAgIEF1dGhvcml6YXRpb246ICdCZWFyZXIgMTIzJyxcbiAgICAgKiAgfVxuICAgICAqL1xuICAgIGRlZmF1bHRIZWFkZXJzKG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIEFjY2VwdDogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICdVc2VyLUFnZW50JzogdGhpcy5nZXRVc2VyQWdlbnQoKSxcbiAgICAgICAgICAgIC4uLmdldFBsYXRmb3JtSGVhZGVycygpLFxuICAgICAgICAgICAgLi4udGhpcy5hdXRoSGVhZGVycyhvcHRzKSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogT3ZlcnJpZGUgdGhpcyB0byBhZGQgeW91ciBvd24gaGVhZGVycyB2YWxpZGF0aW9uOlxuICAgICAqL1xuICAgIHZhbGlkYXRlSGVhZGVycyhoZWFkZXJzLCBjdXN0b21IZWFkZXJzKSB7IH1cbiAgICBkZWZhdWx0SWRlbXBvdGVuY3lLZXkoKSB7XG4gICAgICAgIHJldHVybiBgc3RhaW5sZXNzLW5vZGUtcmV0cnktJHt1dWlkNCgpfWA7XG4gICAgfVxuICAgIGdldChwYXRoLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ldGhvZFJlcXVlc3QoJ2dldCcsIHBhdGgsIG9wdHMpO1xuICAgIH1cbiAgICBwb3N0KHBhdGgsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWV0aG9kUmVxdWVzdCgncG9zdCcsIHBhdGgsIG9wdHMpO1xuICAgIH1cbiAgICBwYXRjaChwYXRoLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ldGhvZFJlcXVlc3QoJ3BhdGNoJywgcGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIHB1dChwYXRoLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ldGhvZFJlcXVlc3QoJ3B1dCcsIHBhdGgsIG9wdHMpO1xuICAgIH1cbiAgICBkZWxldGUocGF0aCwgb3B0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXRob2RSZXF1ZXN0KCdkZWxldGUnLCBwYXRoLCBvcHRzKTtcbiAgICB9XG4gICAgbWV0aG9kUmVxdWVzdChtZXRob2QsIHBhdGgsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdChQcm9taXNlLnJlc29sdmUob3B0cykudGhlbihhc3luYyAob3B0cykgPT4ge1xuICAgICAgICAgICAgY29uc3QgYm9keSA9IG9wdHMgJiYgaXNCbG9iTGlrZShvcHRzPy5ib2R5KSA/IG5ldyBEYXRhVmlldyhhd2FpdCBvcHRzLmJvZHkuYXJyYXlCdWZmZXIoKSlcbiAgICAgICAgICAgICAgICA6IG9wdHM/LmJvZHkgaW5zdGFuY2VvZiBEYXRhVmlldyA/IG9wdHMuYm9keVxuICAgICAgICAgICAgICAgICAgICA6IG9wdHM/LmJvZHkgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciA/IG5ldyBEYXRhVmlldyhvcHRzLmJvZHkpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG9wdHMgJiYgQXJyYXlCdWZmZXIuaXNWaWV3KG9wdHM/LmJvZHkpID8gbmV3IERhdGFWaWV3KG9wdHMuYm9keS5idWZmZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBvcHRzPy5ib2R5O1xuICAgICAgICAgICAgcmV0dXJuIHsgbWV0aG9kLCBwYXRoLCAuLi5vcHRzLCBib2R5IH07XG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgZ2V0QVBJTGlzdChwYXRoLCBQYWdlLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3RBUElMaXN0KFBhZ2UsIHsgbWV0aG9kOiAnZ2V0JywgcGF0aCwgLi4ub3B0cyB9KTtcbiAgICB9XG4gICAgY2FsY3VsYXRlQ29udGVudExlbmd0aChib2R5KSB7XG4gICAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBCdWZmZXIuYnl0ZUxlbmd0aChib2R5LCAndXRmOCcpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIFRleHRFbmNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbmNvZGVkID0gZW5jb2Rlci5lbmNvZGUoYm9keSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVuY29kZWQubGVuZ3RoLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGJvZHkpKSB7XG4gICAgICAgICAgICByZXR1cm4gYm9keS5ieXRlTGVuZ3RoLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGJ1aWxkUmVxdWVzdChvcHRpb25zLCB7IHJldHJ5Q291bnQgPSAwIH0gPSB7fSkge1xuICAgICAgICBvcHRpb25zID0geyAuLi5vcHRpb25zIH07XG4gICAgICAgIGNvbnN0IHsgbWV0aG9kLCBwYXRoLCBxdWVyeSwgaGVhZGVyczogaGVhZGVycyA9IHt9IH0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBib2R5ID0gQXJyYXlCdWZmZXIuaXNWaWV3KG9wdGlvbnMuYm9keSkgfHwgKG9wdGlvbnMuX19iaW5hcnlSZXF1ZXN0ICYmIHR5cGVvZiBvcHRpb25zLmJvZHkgPT09ICdzdHJpbmcnKSA/XG4gICAgICAgICAgICBvcHRpb25zLmJvZHlcbiAgICAgICAgICAgIDogaXNNdWx0aXBhcnRCb2R5KG9wdGlvbnMuYm9keSkgPyBvcHRpb25zLmJvZHkuYm9keVxuICAgICAgICAgICAgICAgIDogb3B0aW9ucy5ib2R5ID8gSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5ib2R5LCBudWxsLCAyKVxuICAgICAgICAgICAgICAgICAgICA6IG51bGw7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSB0aGlzLmNhbGN1bGF0ZUNvbnRlbnRMZW5ndGgoYm9keSk7XG4gICAgICAgIGNvbnN0IHVybCA9IHRoaXMuYnVpbGRVUkwocGF0aCwgcXVlcnkpO1xuICAgICAgICBpZiAoJ3RpbWVvdXQnIGluIG9wdGlvbnMpXG4gICAgICAgICAgICB2YWxpZGF0ZVBvc2l0aXZlSW50ZWdlcigndGltZW91dCcsIG9wdGlvbnMudGltZW91dCk7XG4gICAgICAgIG9wdGlvbnMudGltZW91dCA9IG9wdGlvbnMudGltZW91dCA/PyB0aGlzLnRpbWVvdXQ7XG4gICAgICAgIGNvbnN0IGh0dHBBZ2VudCA9IG9wdGlvbnMuaHR0cEFnZW50ID8/IHRoaXMuaHR0cEFnZW50ID8/IGdldERlZmF1bHRBZ2VudCh1cmwpO1xuICAgICAgICBjb25zdCBtaW5BZ2VudFRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQgKyAxMDAwO1xuICAgICAgICBpZiAodHlwZW9mIGh0dHBBZ2VudD8ub3B0aW9ucz8udGltZW91dCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgICAgIG1pbkFnZW50VGltZW91dCA+IChodHRwQWdlbnQub3B0aW9ucy50aW1lb3V0ID8/IDApKSB7XG4gICAgICAgICAgICAvLyBBbGxvdyBhbnkgZ2l2ZW4gcmVxdWVzdCB0byBidW1wIG91ciBhZ2VudCBhY3RpdmUgc29ja2V0IHRpbWVvdXQuXG4gICAgICAgICAgICAvLyBUaGlzIG1heSBzZWVtIHN0cmFuZ2UsIGJ1dCBsZWFraW5nIGFjdGl2ZSBzb2NrZXRzIHNob3VsZCBiZSByYXJlIGFuZCBub3QgcGFydGljdWxhcmx5IHByb2JsZW1hdGljLFxuICAgICAgICAgICAgLy8gYW5kIHdpdGhvdXQgbXV0YXRpbmcgYWdlbnQgd2Ugd291bGQgbmVlZCB0byBjcmVhdGUgbW9yZSBvZiB0aGVtLlxuICAgICAgICAgICAgLy8gVGhpcyB0cmFkZW9mZiBvcHRpbWl6ZXMgZm9yIHBlcmZvcm1hbmNlLlxuICAgICAgICAgICAgaHR0cEFnZW50Lm9wdGlvbnMudGltZW91dCA9IG1pbkFnZW50VGltZW91dDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5pZGVtcG90ZW5jeUhlYWRlciAmJiBtZXRob2QgIT09ICdnZXQnKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuaWRlbXBvdGVuY3lLZXkpXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5pZGVtcG90ZW5jeUtleSA9IHRoaXMuZGVmYXVsdElkZW1wb3RlbmN5S2V5KCk7XG4gICAgICAgICAgICBoZWFkZXJzW3RoaXMuaWRlbXBvdGVuY3lIZWFkZXJdID0gb3B0aW9ucy5pZGVtcG90ZW5jeUtleTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXFIZWFkZXJzID0gdGhpcy5idWlsZEhlYWRlcnMoeyBvcHRpb25zLCBoZWFkZXJzLCBjb250ZW50TGVuZ3RoLCByZXRyeUNvdW50IH0pO1xuICAgICAgICBjb25zdCByZXEgPSB7XG4gICAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgICAuLi4oYm9keSAmJiB7IGJvZHk6IGJvZHkgfSksXG4gICAgICAgICAgICBoZWFkZXJzOiByZXFIZWFkZXJzLFxuICAgICAgICAgICAgLi4uKGh0dHBBZ2VudCAmJiB7IGFnZW50OiBodHRwQWdlbnQgfSksXG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlIG5vZGUtZmV0Y2ggdXNlcyBhIGN1c3RvbSBBYm9ydFNpZ25hbCB0eXBlIHRoYXQgaXNcbiAgICAgICAgICAgIC8vIG5vdCBjb21wYXRpYmxlIHdpdGggc3RhbmRhcmQgd2ViIHR5cGVzXG4gICAgICAgICAgICBzaWduYWw6IG9wdGlvbnMuc2lnbmFsID8/IG51bGwsXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7IHJlcSwgdXJsLCB0aW1lb3V0OiBvcHRpb25zLnRpbWVvdXQgfTtcbiAgICB9XG4gICAgYnVpbGRIZWFkZXJzKHsgb3B0aW9ucywgaGVhZGVycywgY29udGVudExlbmd0aCwgcmV0cnlDb3VudCwgfSkge1xuICAgICAgICBjb25zdCByZXFIZWFkZXJzID0ge307XG4gICAgICAgIGlmIChjb250ZW50TGVuZ3RoKSB7XG4gICAgICAgICAgICByZXFIZWFkZXJzWydjb250ZW50LWxlbmd0aCddID0gY29udGVudExlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZWZhdWx0SGVhZGVycyA9IHRoaXMuZGVmYXVsdEhlYWRlcnMob3B0aW9ucyk7XG4gICAgICAgIGFwcGx5SGVhZGVyc011dChyZXFIZWFkZXJzLCBkZWZhdWx0SGVhZGVycyk7XG4gICAgICAgIGFwcGx5SGVhZGVyc011dChyZXFIZWFkZXJzLCBoZWFkZXJzKTtcbiAgICAgICAgLy8gbGV0IGJ1aWx0aW4gZmV0Y2ggc2V0IHRoZSBDb250ZW50LVR5cGUgZm9yIG11bHRpcGFydCBib2RpZXNcbiAgICAgICAgaWYgKGlzTXVsdGlwYXJ0Qm9keShvcHRpb25zLmJvZHkpICYmIHNoaW1zS2luZCAhPT0gJ25vZGUnKSB7XG4gICAgICAgICAgICBkZWxldGUgcmVxSGVhZGVyc1snY29udGVudC10eXBlJ107XG4gICAgICAgIH1cbiAgICAgICAgLy8gRG9uJ3Qgc2V0IHRoZXNlcyBoZWFkZXJzIGlmIHRoZXkgd2VyZSBhbHJlYWR5IHNldCBvciByZW1vdmVkIHRocm91Z2ggZGVmYXVsdCBoZWFkZXJzIG9yIGJ5IHRoZSBjYWxsZXIuXG4gICAgICAgIC8vIFdlIGNoZWNrIGBkZWZhdWx0SGVhZGVyc2AgYW5kIGBoZWFkZXJzYCwgd2hpY2ggY2FuIGNvbnRhaW4gbnVsbHMsIGluc3RlYWQgb2YgYHJlcUhlYWRlcnNgIHRvIGFjY291bnRcbiAgICAgICAgLy8gZm9yIHRoZSByZW1vdmFsIGNhc2UuXG4gICAgICAgIGlmIChnZXRIZWFkZXIoZGVmYXVsdEhlYWRlcnMsICd4LXN0YWlubGVzcy1yZXRyeS1jb3VudCcpID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIGdldEhlYWRlcihoZWFkZXJzLCAneC1zdGFpbmxlc3MtcmV0cnktY291bnQnKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXFIZWFkZXJzWyd4LXN0YWlubGVzcy1yZXRyeS1jb3VudCddID0gU3RyaW5nKHJldHJ5Q291bnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChnZXRIZWFkZXIoZGVmYXVsdEhlYWRlcnMsICd4LXN0YWlubGVzcy10aW1lb3V0JykgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgZ2V0SGVhZGVyKGhlYWRlcnMsICd4LXN0YWlubGVzcy10aW1lb3V0JykgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgb3B0aW9ucy50aW1lb3V0KSB7XG4gICAgICAgICAgICByZXFIZWFkZXJzWyd4LXN0YWlubGVzcy10aW1lb3V0J10gPSBTdHJpbmcob3B0aW9ucy50aW1lb3V0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnZhbGlkYXRlSGVhZGVycyhyZXFIZWFkZXJzLCBoZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHJlcUhlYWRlcnM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFVzZWQgYXMgYSBjYWxsYmFjayBmb3IgbXV0YXRpbmcgdGhlIGdpdmVuIGBGaW5hbFJlcXVlc3RPcHRpb25zYCBvYmplY3QuXG4gICAgICovXG4gICAgYXN5bmMgcHJlcGFyZU9wdGlvbnMob3B0aW9ucykgeyB9XG4gICAgLyoqXG4gICAgICogVXNlZCBhcyBhIGNhbGxiYWNrIGZvciBtdXRhdGluZyB0aGUgZ2l2ZW4gYFJlcXVlc3RJbml0YCBvYmplY3QuXG4gICAgICpcbiAgICAgKiBUaGlzIGlzIHVzZWZ1bCBmb3IgY2FzZXMgd2hlcmUgeW91IHdhbnQgdG8gYWRkIGNlcnRhaW4gaGVhZGVycyBiYXNlZCBvZmYgb2ZcbiAgICAgKiB0aGUgcmVxdWVzdCBwcm9wZXJ0aWVzLCBlLmcuIGBtZXRob2RgIG9yIGB1cmxgLlxuICAgICAqL1xuICAgIGFzeW5jIHByZXBhcmVSZXF1ZXN0KHJlcXVlc3QsIHsgdXJsLCBvcHRpb25zIH0pIHsgfVxuICAgIHBhcnNlSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgICAgIHJldHVybiAoIWhlYWRlcnMgPyB7fVxuICAgICAgICAgICAgOiBTeW1ib2wuaXRlcmF0b3IgaW4gaGVhZGVycyA/XG4gICAgICAgICAgICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKEFycmF5LmZyb20oaGVhZGVycykubWFwKChoZWFkZXIpID0+IFsuLi5oZWFkZXJdKSlcbiAgICAgICAgICAgICAgICA6IHsgLi4uaGVhZGVycyB9KTtcbiAgICB9XG4gICAgbWFrZVN0YXR1c0Vycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpIHtcbiAgICAgICAgcmV0dXJuIEFQSUVycm9yLmdlbmVyYXRlKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgIH1cbiAgICByZXF1ZXN0KG9wdGlvbnMsIHJlbWFpbmluZ1JldHJpZXMgPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuZXcgQVBJUHJvbWlzZSh0aGlzLm1ha2VSZXF1ZXN0KG9wdGlvbnMsIHJlbWFpbmluZ1JldHJpZXMpKTtcbiAgICB9XG4gICAgYXN5bmMgbWFrZVJlcXVlc3Qob3B0aW9uc0lucHV0LCByZXRyaWVzUmVtYWluaW5nKSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCBvcHRpb25zSW5wdXQ7XG4gICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSBvcHRpb25zLm1heFJldHJpZXMgPz8gdGhpcy5tYXhSZXRyaWVzO1xuICAgICAgICBpZiAocmV0cmllc1JlbWFpbmluZyA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXRyaWVzUmVtYWluaW5nID0gbWF4UmV0cmllcztcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCB0aGlzLnByZXBhcmVPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICBjb25zdCB7IHJlcSwgdXJsLCB0aW1lb3V0IH0gPSB0aGlzLmJ1aWxkUmVxdWVzdChvcHRpb25zLCB7IHJldHJ5Q291bnQ6IG1heFJldHJpZXMgLSByZXRyaWVzUmVtYWluaW5nIH0pO1xuICAgICAgICBhd2FpdCB0aGlzLnByZXBhcmVSZXF1ZXN0KHJlcSwgeyB1cmwsIG9wdGlvbnMgfSk7XG4gICAgICAgIGRlYnVnKCdyZXF1ZXN0JywgdXJsLCBvcHRpb25zLCByZXEuaGVhZGVycyk7XG4gICAgICAgIGlmIChvcHRpb25zLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmZldGNoV2l0aFRpbWVvdXQodXJsLCByZXEsIHRpbWVvdXQsIGNvbnRyb2xsZXIpLmNhdGNoKGNhc3RUb0Vycm9yKTtcbiAgICAgICAgaWYgKHJlc3BvbnNlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJldHJpZXNSZW1haW5pbmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXRyeVJlcXVlc3Qob3B0aW9ucywgcmV0cmllc1JlbWFpbmluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzcG9uc2UubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBBUElDb25uZWN0aW9uRXJyb3IoeyBjYXVzZTogcmVzcG9uc2UgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzcG9uc2VIZWFkZXJzID0gY3JlYXRlUmVzcG9uc2VIZWFkZXJzKHJlc3BvbnNlLmhlYWRlcnMpO1xuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICBpZiAocmV0cmllc1JlbWFpbmluZyAmJiB0aGlzLnNob3VsZFJldHJ5KHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHJ5TWVzc2FnZSA9IGByZXRyeWluZywgJHtyZXRyaWVzUmVtYWluaW5nfSBhdHRlbXB0cyByZW1haW5pbmdgO1xuICAgICAgICAgICAgICAgIGRlYnVnKGByZXNwb25zZSAoZXJyb3I7ICR7cmV0cnlNZXNzYWdlfSlgLCByZXNwb25zZS5zdGF0dXMsIHVybCwgcmVzcG9uc2VIZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXRyeVJlcXVlc3Qob3B0aW9ucywgcmV0cmllc1JlbWFpbmluZywgcmVzcG9uc2VIZWFkZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGVyclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCkuY2F0Y2goKGUpID0+IGNhc3RUb0Vycm9yKGUpLm1lc3NhZ2UpO1xuICAgICAgICAgICAgY29uc3QgZXJySlNPTiA9IHNhZmVKU09OKGVyclRleHQpO1xuICAgICAgICAgICAgY29uc3QgZXJyTWVzc2FnZSA9IGVyckpTT04gPyB1bmRlZmluZWQgOiBlcnJUZXh0O1xuICAgICAgICAgICAgY29uc3QgcmV0cnlNZXNzYWdlID0gcmV0cmllc1JlbWFpbmluZyA/IGAoZXJyb3I7IG5vIG1vcmUgcmV0cmllcyBsZWZ0KWAgOiBgKGVycm9yOyBub3QgcmV0cnlhYmxlKWA7XG4gICAgICAgICAgICBkZWJ1ZyhgcmVzcG9uc2UgKGVycm9yOyAke3JldHJ5TWVzc2FnZX0pYCwgcmVzcG9uc2Uuc3RhdHVzLCB1cmwsIHJlc3BvbnNlSGVhZGVycywgZXJyTWVzc2FnZSk7XG4gICAgICAgICAgICBjb25zdCBlcnIgPSB0aGlzLm1ha2VTdGF0dXNFcnJvcihyZXNwb25zZS5zdGF0dXMsIGVyckpTT04sIGVyck1lc3NhZ2UsIHJlc3BvbnNlSGVhZGVycyk7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgcmVzcG9uc2UsIG9wdGlvbnMsIGNvbnRyb2xsZXIgfTtcbiAgICB9XG4gICAgcmVxdWVzdEFQSUxpc3QoUGFnZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5tYWtlUmVxdWVzdChvcHRpb25zLCBudWxsKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQYWdlUHJvbWlzZSh0aGlzLCByZXF1ZXN0LCBQYWdlKTtcbiAgICB9XG4gICAgYnVpbGRVUkwocGF0aCwgcXVlcnkpIHtcbiAgICAgICAgY29uc3QgdXJsID0gaXNBYnNvbHV0ZVVSTChwYXRoKSA/XG4gICAgICAgICAgICBuZXcgVVJMKHBhdGgpXG4gICAgICAgICAgICA6IG5ldyBVUkwodGhpcy5iYXNlVVJMICsgKHRoaXMuYmFzZVVSTC5lbmRzV2l0aCgnLycpICYmIHBhdGguc3RhcnRzV2l0aCgnLycpID8gcGF0aC5zbGljZSgxKSA6IHBhdGgpKTtcbiAgICAgICAgY29uc3QgZGVmYXVsdFF1ZXJ5ID0gdGhpcy5kZWZhdWx0UXVlcnkoKTtcbiAgICAgICAgaWYgKCFpc0VtcHR5T2JqKGRlZmF1bHRRdWVyeSkpIHtcbiAgICAgICAgICAgIHF1ZXJ5ID0geyAuLi5kZWZhdWx0UXVlcnksIC4uLnF1ZXJ5IH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBxdWVyeSA9PT0gJ29iamVjdCcgJiYgcXVlcnkgJiYgIUFycmF5LmlzQXJyYXkocXVlcnkpKSB7XG4gICAgICAgICAgICB1cmwuc2VhcmNoID0gdGhpcy5zdHJpbmdpZnlRdWVyeShxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVybC50b1N0cmluZygpO1xuICAgIH1cbiAgICBzdHJpbmdpZnlRdWVyeShxdWVyeSkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMocXVlcnkpXG4gICAgICAgICAgICAuZmlsdGVyKChbXywgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnKVxuICAgICAgICAgICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke2VuY29kZVVSSUNvbXBvbmVudChrZXkpfT0ke2VuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSl9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgJHtlbmNvZGVVUklDb21wb25lbnQoa2V5KX09YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgQ2Fubm90IHN0cmluZ2lmeSB0eXBlICR7dHlwZW9mIHZhbHVlfTsgRXhwZWN0ZWQgc3RyaW5nLCBudW1iZXIsIGJvb2xlYW4sIG9yIG51bGwuIElmIHlvdSBuZWVkIHRvIHBhc3MgbmVzdGVkIHF1ZXJ5IHBhcmFtZXRlcnMsIHlvdSBjYW4gbWFudWFsbHkgZW5jb2RlIHRoZW0sIGUuZy4geyBxdWVyeTogeyAnZm9vW2tleTFdJzogdmFsdWUxLCAnZm9vW2tleTJdJzogdmFsdWUyIH0gfSwgYW5kIHBsZWFzZSBvcGVuIGEgR2l0SHViIGlzc3VlIHJlcXVlc3RpbmcgYmV0dGVyIHN1cHBvcnQgZm9yIHlvdXIgdXNlIGNhc2UuYCk7XG4gICAgICAgIH0pXG4gICAgICAgICAgICAuam9pbignJicpO1xuICAgIH1cbiAgICBhc3luYyBmZXRjaFdpdGhUaW1lb3V0KHVybCwgaW5pdCwgbXMsIGNvbnRyb2xsZXIpIHtcbiAgICAgICAgY29uc3QgeyBzaWduYWwsIC4uLm9wdGlvbnMgfSA9IGluaXQgfHwge307XG4gICAgICAgIGlmIChzaWduYWwpXG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiBjb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIG1zKTtcbiAgICAgICAgY29uc3QgZmV0Y2hPcHRpb25zID0ge1xuICAgICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIH07XG4gICAgICAgIGlmIChmZXRjaE9wdGlvbnMubWV0aG9kKSB7XG4gICAgICAgICAgICAvLyBDdXN0b20gbWV0aG9kcyBsaWtlICdwYXRjaCcgbmVlZCB0byBiZSB1cHBlcmNhc2VkXG4gICAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy91bmRpY2kvaXNzdWVzLzIyOTRcbiAgICAgICAgICAgIGZldGNoT3B0aW9ucy5tZXRob2QgPSBmZXRjaE9wdGlvbnMubWV0aG9kLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgLy8gdXNlIHVuZGVmaW5lZCB0aGlzIGJpbmRpbmc7IGZldGNoIGVycm9ycyBpZiBib3VuZCB0byBzb21ldGhpbmcgZWxzZSBpbiBicm93c2VyL2Nsb3VkZmxhcmVcbiAgICAgICAgdGhpcy5mZXRjaC5jYWxsKHVuZGVmaW5lZCwgdXJsLCBmZXRjaE9wdGlvbnMpLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB9KSk7XG4gICAgfVxuICAgIHNob3VsZFJldHJ5KHJlc3BvbnNlKSB7XG4gICAgICAgIC8vIE5vdGUgdGhpcyBpcyBub3QgYSBzdGFuZGFyZCBoZWFkZXIuXG4gICAgICAgIGNvbnN0IHNob3VsZFJldHJ5SGVhZGVyID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoJ3gtc2hvdWxkLXJldHJ5Jyk7XG4gICAgICAgIC8vIElmIHRoZSBzZXJ2ZXIgZXhwbGljaXRseSBzYXlzIHdoZXRoZXIgb3Igbm90IHRvIHJldHJ5LCBvYmV5LlxuICAgICAgICBpZiAoc2hvdWxkUmV0cnlIZWFkZXIgPT09ICd0cnVlJylcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICBpZiAoc2hvdWxkUmV0cnlIZWFkZXIgPT09ICdmYWxzZScpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIC8vIFJldHJ5IG9uIHJlcXVlc3QgdGltZW91dHMuXG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwOClcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAvLyBSZXRyeSBvbiBsb2NrIHRpbWVvdXRzLlxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDkpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgLy8gUmV0cnkgb24gcmF0ZSBsaW1pdHMuXG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSlcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAvLyBSZXRyeSBpbnRlcm5hbCBlcnJvcnMuXG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPj0gNTAwKVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYXN5bmMgcmV0cnlSZXF1ZXN0KG9wdGlvbnMsIHJldHJpZXNSZW1haW5pbmcsIHJlc3BvbnNlSGVhZGVycykge1xuICAgICAgICBsZXQgdGltZW91dE1pbGxpcztcbiAgICAgICAgLy8gTm90ZSB0aGUgYHJldHJ5LWFmdGVyLW1zYCBoZWFkZXIgbWF5IG5vdCBiZSBzdGFuZGFyZCwgYnV0IGlzIGEgZ29vZCBpZGVhIGFuZCB3ZSdkIGxpa2UgcHJvYWN0aXZlIHN1cHBvcnQgZm9yIGl0LlxuICAgICAgICBjb25zdCByZXRyeUFmdGVyTWlsbGlzSGVhZGVyID0gcmVzcG9uc2VIZWFkZXJzPy5bJ3JldHJ5LWFmdGVyLW1zJ107XG4gICAgICAgIGlmIChyZXRyeUFmdGVyTWlsbGlzSGVhZGVyKSB7XG4gICAgICAgICAgICBjb25zdCB0aW1lb3V0TXMgPSBwYXJzZUZsb2F0KHJldHJ5QWZ0ZXJNaWxsaXNIZWFkZXIpO1xuICAgICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4odGltZW91dE1zKSkge1xuICAgICAgICAgICAgICAgIHRpbWVvdXRNaWxsaXMgPSB0aW1lb3V0TXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQWJvdXQgdGhlIFJldHJ5LUFmdGVyIGhlYWRlcjogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSFRUUC9IZWFkZXJzL1JldHJ5LUFmdGVyXG4gICAgICAgIGNvbnN0IHJldHJ5QWZ0ZXJIZWFkZXIgPSByZXNwb25zZUhlYWRlcnM/LlsncmV0cnktYWZ0ZXInXTtcbiAgICAgICAgaWYgKHJldHJ5QWZ0ZXJIZWFkZXIgJiYgIXRpbWVvdXRNaWxsaXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXRTZWNvbmRzID0gcGFyc2VGbG9hdChyZXRyeUFmdGVySGVhZGVyKTtcbiAgICAgICAgICAgIGlmICghTnVtYmVyLmlzTmFOKHRpbWVvdXRTZWNvbmRzKSkge1xuICAgICAgICAgICAgICAgIHRpbWVvdXRNaWxsaXMgPSB0aW1lb3V0U2Vjb25kcyAqIDEwMDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0TWlsbGlzID0gRGF0ZS5wYXJzZShyZXRyeUFmdGVySGVhZGVyKSAtIERhdGUubm93KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgdGhlIEFQSSBhc2tzIHVzIHRvIHdhaXQgYSBjZXJ0YWluIGFtb3VudCBvZiB0aW1lIChhbmQgaXQncyBhIHJlYXNvbmFibGUgYW1vdW50KSxcbiAgICAgICAgLy8ganVzdCBkbyB3aGF0IGl0IHNheXMsIGJ1dCBvdGhlcndpc2UgY2FsY3VsYXRlIGEgZGVmYXVsdFxuICAgICAgICBpZiAoISh0aW1lb3V0TWlsbGlzICYmIDAgPD0gdGltZW91dE1pbGxpcyAmJiB0aW1lb3V0TWlsbGlzIDwgNjAgKiAxMDAwKSkge1xuICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IG9wdGlvbnMubWF4UmV0cmllcyA/PyB0aGlzLm1heFJldHJpZXM7XG4gICAgICAgICAgICB0aW1lb3V0TWlsbGlzID0gdGhpcy5jYWxjdWxhdGVEZWZhdWx0UmV0cnlUaW1lb3V0TWlsbGlzKHJldHJpZXNSZW1haW5pbmcsIG1heFJldHJpZXMpO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IHNsZWVwKHRpbWVvdXRNaWxsaXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5tYWtlUmVxdWVzdChvcHRpb25zLCByZXRyaWVzUmVtYWluaW5nIC0gMSk7XG4gICAgfVxuICAgIGNhbGN1bGF0ZURlZmF1bHRSZXRyeVRpbWVvdXRNaWxsaXMocmV0cmllc1JlbWFpbmluZywgbWF4UmV0cmllcykge1xuICAgICAgICBjb25zdCBpbml0aWFsUmV0cnlEZWxheSA9IDAuNTtcbiAgICAgICAgY29uc3QgbWF4UmV0cnlEZWxheSA9IDguMDtcbiAgICAgICAgY29uc3QgbnVtUmV0cmllcyA9IG1heFJldHJpZXMgLSByZXRyaWVzUmVtYWluaW5nO1xuICAgICAgICAvLyBBcHBseSBleHBvbmVudGlhbCBiYWNrb2ZmLCBidXQgbm90IG1vcmUgdGhhbiB0aGUgbWF4LlxuICAgICAgICBjb25zdCBzbGVlcFNlY29uZHMgPSBNYXRoLm1pbihpbml0aWFsUmV0cnlEZWxheSAqIE1hdGgucG93KDIsIG51bVJldHJpZXMpLCBtYXhSZXRyeURlbGF5KTtcbiAgICAgICAgLy8gQXBwbHkgc29tZSBqaXR0ZXIsIHRha2UgdXAgdG8gYXQgbW9zdCAyNSBwZXJjZW50IG9mIHRoZSByZXRyeSB0aW1lLlxuICAgICAgICBjb25zdCBqaXR0ZXIgPSAxIC0gTWF0aC5yYW5kb20oKSAqIDAuMjU7XG4gICAgICAgIHJldHVybiBzbGVlcFNlY29uZHMgKiBqaXR0ZXIgKiAxMDAwO1xuICAgIH1cbiAgICBnZXRVc2VyQWdlbnQoKSB7XG4gICAgICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9L0pTICR7VkVSU0lPTn1gO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBYnN0cmFjdFBhZ2Uge1xuICAgIGNvbnN0cnVjdG9yKGNsaWVudCwgcmVzcG9uc2UsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgX0Fic3RyYWN0UGFnZV9jbGllbnQuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fic3RyYWN0UGFnZV9jbGllbnQsIGNsaWVudCwgXCJmXCIpO1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICB0aGlzLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgICAgIHRoaXMuYm9keSA9IGJvZHk7XG4gICAgfVxuICAgIGhhc05leHRQYWdlKCkge1xuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuZ2V0UGFnaW5hdGVkSXRlbXMoKTtcbiAgICAgICAgaWYgKCFpdGVtcy5sZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiB0aGlzLm5leHRQYWdlSW5mbygpICE9IG51bGw7XG4gICAgfVxuICAgIGFzeW5jIGdldE5leHRQYWdlKCkge1xuICAgICAgICBjb25zdCBuZXh0SW5mbyA9IHRoaXMubmV4dFBhZ2VJbmZvKCk7XG4gICAgICAgIGlmICghbmV4dEluZm8pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcignTm8gbmV4dCBwYWdlIGV4cGVjdGVkOyBwbGVhc2UgY2hlY2sgYC5oYXNOZXh0UGFnZSgpYCBiZWZvcmUgY2FsbGluZyBgLmdldE5leHRQYWdlKClgLicpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5leHRPcHRpb25zID0geyAuLi50aGlzLm9wdGlvbnMgfTtcbiAgICAgICAgaWYgKCdwYXJhbXMnIGluIG5leHRJbmZvICYmIHR5cGVvZiBuZXh0T3B0aW9ucy5xdWVyeSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIG5leHRPcHRpb25zLnF1ZXJ5ID0geyAuLi5uZXh0T3B0aW9ucy5xdWVyeSwgLi4ubmV4dEluZm8ucGFyYW1zIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoJ3VybCcgaW4gbmV4dEluZm8pIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IFsuLi5PYmplY3QuZW50cmllcyhuZXh0T3B0aW9ucy5xdWVyeSB8fCB7fSksIC4uLm5leHRJbmZvLnVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHBhcmFtcykge1xuICAgICAgICAgICAgICAgIG5leHRJbmZvLnVybC5zZWFyY2hQYXJhbXMuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV4dE9wdGlvbnMucXVlcnkgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBuZXh0T3B0aW9ucy5wYXRoID0gbmV4dEluZm8udXJsLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGF3YWl0IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0UGFnZV9jbGllbnQsIFwiZlwiKS5yZXF1ZXN0QVBJTGlzdCh0aGlzLmNvbnN0cnVjdG9yLCBuZXh0T3B0aW9ucyk7XG4gICAgfVxuICAgIGFzeW5jICppdGVyUGFnZXMoKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdGhpcy1hbGlhc1xuICAgICAgICBsZXQgcGFnZSA9IHRoaXM7XG4gICAgICAgIHlpZWxkIHBhZ2U7XG4gICAgICAgIHdoaWxlIChwYWdlLmhhc05leHRQYWdlKCkpIHtcbiAgICAgICAgICAgIHBhZ2UgPSBhd2FpdCBwYWdlLmdldE5leHRQYWdlKCk7XG4gICAgICAgICAgICB5aWVsZCBwYWdlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jICpbKF9BYnN0cmFjdFBhZ2VfY2xpZW50ID0gbmV3IFdlYWtNYXAoKSwgU3ltYm9sLmFzeW5jSXRlcmF0b3IpXSgpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBwYWdlIG9mIHRoaXMuaXRlclBhZ2VzKCkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBwYWdlLmdldFBhZ2luYXRlZEl0ZW1zKCkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuLyoqXG4gKiBUaGlzIHN1YmNsYXNzIG9mIFByb21pc2Ugd2lsbCByZXNvbHZlIHRvIGFuIGluc3RhbnRpYXRlZCBQYWdlIG9uY2UgdGhlIHJlcXVlc3QgY29tcGxldGVzLlxuICpcbiAqIEl0IGFsc28gaW1wbGVtZW50cyBBc3luY0l0ZXJhYmxlIHRvIGFsbG93IGF1dG8tcGFnaW5hdGluZyBpdGVyYXRpb24gb24gYW4gdW5hd2FpdGVkIGxpc3QgY2FsbCwgZWc6XG4gKlxuICogICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsaWVudC5pdGVtcy5saXN0KCkpIHtcbiAqICAgICAgY29uc29sZS5sb2coaXRlbSlcbiAqICAgIH1cbiAqL1xuZXhwb3J0IGNsYXNzIFBhZ2VQcm9taXNlIGV4dGVuZHMgQVBJUHJvbWlzZSB7XG4gICAgY29uc3RydWN0b3IoY2xpZW50LCByZXF1ZXN0LCBQYWdlKSB7XG4gICAgICAgIHN1cGVyKHJlcXVlc3QsIGFzeW5jIChwcm9wcykgPT4gbmV3IFBhZ2UoY2xpZW50LCBwcm9wcy5yZXNwb25zZSwgYXdhaXQgZGVmYXVsdFBhcnNlUmVzcG9uc2UocHJvcHMpLCBwcm9wcy5vcHRpb25zKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFsbG93IGF1dG8tcGFnaW5hdGluZyBpdGVyYXRpb24gb24gYW4gdW5hd2FpdGVkIGxpc3QgY2FsbCwgZWc6XG4gICAgICpcbiAgICAgKiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xpZW50Lml0ZW1zLmxpc3QoKSkge1xuICAgICAqICAgICAgY29uc29sZS5sb2coaXRlbSlcbiAgICAgKiAgICB9XG4gICAgICovXG4gICAgYXN5bmMgKltTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCB0aGlzO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgcGFnZSkge1xuICAgICAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgfVxuICAgIH1cbn1cbmV4cG9ydCBjb25zdCBjcmVhdGVSZXNwb25zZUhlYWRlcnMgPSAoaGVhZGVycykgPT4ge1xuICAgIHJldHVybiBuZXcgUHJveHkoT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBoZWFkZXJzLmVudHJpZXMoKSksIHtcbiAgICAgICAgZ2V0KHRhcmdldCwgbmFtZSkge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gbmFtZS50b1N0cmluZygpO1xuICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtrZXkudG9Mb3dlckNhc2UoKV0gfHwgdGFyZ2V0W2tleV07XG4gICAgICAgIH0sXG4gICAgfSk7XG59O1xuLy8gVGhpcyBpcyByZXF1aXJlZCBzbyB0aGF0IHdlIGNhbiBkZXRlcm1pbmUgaWYgYSBnaXZlbiBvYmplY3QgbWF0Y2hlcyB0aGUgUmVxdWVzdE9wdGlvbnNcbi8vIHR5cGUgYXQgcnVudGltZS4gV2hpbGUgdGhpcyByZXF1aXJlcyBkdXBsaWNhdGlvbiwgaXQgaXMgZW5mb3JjZWQgYnkgdGhlIFR5cGVTY3JpcHRcbi8vIGNvbXBpbGVyIHN1Y2ggdGhhdCBhbnkgbWlzc2luZyAvIGV4dHJhbmVvdXMga2V5cyB3aWxsIGNhdXNlIGFuIGVycm9yLlxuY29uc3QgcmVxdWVzdE9wdGlvbnNLZXlzID0ge1xuICAgIG1ldGhvZDogdHJ1ZSxcbiAgICBwYXRoOiB0cnVlLFxuICAgIHF1ZXJ5OiB0cnVlLFxuICAgIGJvZHk6IHRydWUsXG4gICAgaGVhZGVyczogdHJ1ZSxcbiAgICBtYXhSZXRyaWVzOiB0cnVlLFxuICAgIHN0cmVhbTogdHJ1ZSxcbiAgICB0aW1lb3V0OiB0cnVlLFxuICAgIGh0dHBBZ2VudDogdHJ1ZSxcbiAgICBzaWduYWw6IHRydWUsXG4gICAgaWRlbXBvdGVuY3lLZXk6IHRydWUsXG4gICAgX19tZXRhZGF0YTogdHJ1ZSxcbiAgICBfX2JpbmFyeVJlcXVlc3Q6IHRydWUsXG4gICAgX19iaW5hcnlSZXNwb25zZTogdHJ1ZSxcbiAgICBfX3N0cmVhbUNsYXNzOiB0cnVlLFxufTtcbmV4cG9ydCBjb25zdCBpc1JlcXVlc3RPcHRpb25zID0gKG9iaikgPT4ge1xuICAgIHJldHVybiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgb2JqICE9PSBudWxsICYmXG4gICAgICAgICFpc0VtcHR5T2JqKG9iaikgJiZcbiAgICAgICAgT2JqZWN0LmtleXMob2JqKS5ldmVyeSgoaykgPT4gaGFzT3duKHJlcXVlc3RPcHRpb25zS2V5cywgaykpKTtcbn07XG5jb25zdCBnZXRQbGF0Zm9ybVByb3BlcnRpZXMgPSAoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBEZW5vICE9PSAndW5kZWZpbmVkJyAmJiBEZW5vLmJ1aWxkICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1MYW5nJzogJ2pzJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1QYWNrYWdlLVZlcnNpb24nOiBWRVJTSU9OLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLU9TJzogbm9ybWFsaXplUGxhdGZvcm0oRGVuby5idWlsZC5vcyksXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtQXJjaCc6IG5vcm1hbGl6ZUFyY2goRGVuby5idWlsZC5hcmNoKSxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lJzogJ2Rlbm8nLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUtVmVyc2lvbic6IHR5cGVvZiBEZW5vLnZlcnNpb24gPT09ICdzdHJpbmcnID8gRGVuby52ZXJzaW9uIDogRGVuby52ZXJzaW9uPy5kZW5vID8/ICd1bmtub3duJyxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBFZGdlUnVudGltZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1MYW5nJzogJ2pzJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1QYWNrYWdlLVZlcnNpb24nOiBWRVJTSU9OLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLU9TJzogJ1Vua25vd24nLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUFyY2gnOiBgb3RoZXI6JHtFZGdlUnVudGltZX1gLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUnOiAnZWRnZScsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZS1WZXJzaW9uJzogcHJvY2Vzcy52ZXJzaW9uLFxuICAgICAgICB9O1xuICAgIH1cbiAgICAvLyBDaGVjayBpZiBOb2RlLmpzXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgPyBwcm9jZXNzIDogMCkgPT09ICdbb2JqZWN0IHByb2Nlc3NdJykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLUxhbmcnOiAnanMnLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVBhY2thZ2UtVmVyc2lvbic6IFZFUlNJT04sXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtT1MnOiBub3JtYWxpemVQbGF0Zm9ybShwcm9jZXNzLnBsYXRmb3JtKSxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1BcmNoJzogbm9ybWFsaXplQXJjaChwcm9jZXNzLmFyY2gpLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUnOiAnbm9kZScsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZS1WZXJzaW9uJzogcHJvY2Vzcy52ZXJzaW9uLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25zdCBicm93c2VySW5mbyA9IGdldEJyb3dzZXJJbmZvKCk7XG4gICAgaWYgKGJyb3dzZXJJbmZvKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtTGFuZyc6ICdqcycsXG4gICAgICAgICAgICAnWC1TdGFpbmxlc3MtUGFja2FnZS1WZXJzaW9uJzogVkVSU0lPTixcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1PUyc6ICdVbmtub3duJyxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1BcmNoJzogJ3Vua25vd24nLFxuICAgICAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUnOiBgYnJvd3Nlcjoke2Jyb3dzZXJJbmZvLmJyb3dzZXJ9YCxcbiAgICAgICAgICAgICdYLVN0YWlubGVzcy1SdW50aW1lLVZlcnNpb24nOiBicm93c2VySW5mby52ZXJzaW9uLFxuICAgICAgICB9O1xuICAgIH1cbiAgICAvLyBUT0RPIGFkZCBzdXBwb3J0IGZvciBDbG91ZGZsYXJlIHdvcmtlcnMsIGV0Yy5cbiAgICByZXR1cm4ge1xuICAgICAgICAnWC1TdGFpbmxlc3MtTGFuZyc6ICdqcycsXG4gICAgICAgICdYLVN0YWlubGVzcy1QYWNrYWdlLVZlcnNpb24nOiBWRVJTSU9OLFxuICAgICAgICAnWC1TdGFpbmxlc3MtT1MnOiAnVW5rbm93bicsXG4gICAgICAgICdYLVN0YWlubGVzcy1BcmNoJzogJ3Vua25vd24nLFxuICAgICAgICAnWC1TdGFpbmxlc3MtUnVudGltZSc6ICd1bmtub3duJyxcbiAgICAgICAgJ1gtU3RhaW5sZXNzLVJ1bnRpbWUtVmVyc2lvbic6ICd1bmtub3duJyxcbiAgICB9O1xufTtcbi8vIE5vdGU6IG1vZGlmaWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL0pTLURldlRvb2xzL2hvc3QtZW52aXJvbm1lbnQvYmxvYi9iMWFiNzllY2RlMzdkYjVkNmUxNjNjMDUwZTU0ZmU3ZDI4N2Q3YzkyL3NyYy9pc29tb3JwaGljLmJyb3dzZXIudHNcbmZ1bmN0aW9uIGdldEJyb3dzZXJJbmZvKCkge1xuICAgIGlmICh0eXBlb2YgbmF2aWdhdG9yID09PSAndW5kZWZpbmVkJyB8fCAhbmF2aWdhdG9yKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICAvLyBOT1RFOiBUaGUgb3JkZXIgbWF0dGVycyBoZXJlIVxuICAgIGNvbnN0IGJyb3dzZXJQYXR0ZXJucyA9IFtcbiAgICAgICAgeyBrZXk6ICdlZGdlJywgcGF0dGVybjogL0VkZ2UoPzpcXFcrKFxcZCspXFwuKFxcZCspKD86XFwuKFxcZCspKT8pPy8gfSxcbiAgICAgICAgeyBrZXk6ICdpZScsIHBhdHRlcm46IC9NU0lFKD86XFxXKyhcXGQrKVxcLihcXGQrKSg/OlxcLihcXGQrKSk/KT8vIH0sXG4gICAgICAgIHsga2V5OiAnaWUnLCBwYXR0ZXJuOiAvVHJpZGVudCg/Oi4qcnZcXDooXFxkKylcXC4oXFxkKykoPzpcXC4oXFxkKykpPyk/LyB9LFxuICAgICAgICB7IGtleTogJ2Nocm9tZScsIHBhdHRlcm46IC9DaHJvbWUoPzpcXFcrKFxcZCspXFwuKFxcZCspKD86XFwuKFxcZCspKT8pPy8gfSxcbiAgICAgICAgeyBrZXk6ICdmaXJlZm94JywgcGF0dGVybjogL0ZpcmVmb3goPzpcXFcrKFxcZCspXFwuKFxcZCspKD86XFwuKFxcZCspKT8pPy8gfSxcbiAgICAgICAgeyBrZXk6ICdzYWZhcmknLCBwYXR0ZXJuOiAvKD86VmVyc2lvblxcVysoXFxkKylcXC4oXFxkKykoPzpcXC4oXFxkKykpPyk/KD86XFxXK01vYmlsZVxcUyopP1xcVytTYWZhcmkvIH0sXG4gICAgXTtcbiAgICAvLyBGaW5kIHRoZSBGSVJTVCBtYXRjaGluZyBicm93c2VyXG4gICAgZm9yIChjb25zdCB7IGtleSwgcGF0dGVybiB9IG9mIGJyb3dzZXJQYXR0ZXJucykge1xuICAgICAgICBjb25zdCBtYXRjaCA9IHBhdHRlcm4uZXhlYyhuYXZpZ2F0b3IudXNlckFnZW50KTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBjb25zdCBtYWpvciA9IG1hdGNoWzFdIHx8IDA7XG4gICAgICAgICAgICBjb25zdCBtaW5vciA9IG1hdGNoWzJdIHx8IDA7XG4gICAgICAgICAgICBjb25zdCBwYXRjaCA9IG1hdGNoWzNdIHx8IDA7XG4gICAgICAgICAgICByZXR1cm4geyBicm93c2VyOiBrZXksIHZlcnNpb246IGAke21ham9yfS4ke21pbm9yfS4ke3BhdGNofWAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbmNvbnN0IG5vcm1hbGl6ZUFyY2ggPSAoYXJjaCkgPT4ge1xuICAgIC8vIE5vZGUgZG9jczpcbiAgICAvLyAtIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NhcmNoXG4gICAgLy8gRGVubyBkb2NzOlxuICAgIC8vIC0gaHR0cHM6Ly9kb2MuZGVuby5sYW5kL2Rlbm8vc3RhYmxlL34vRGVuby5idWlsZFxuICAgIGlmIChhcmNoID09PSAneDMyJylcbiAgICAgICAgcmV0dXJuICd4MzInO1xuICAgIGlmIChhcmNoID09PSAneDg2XzY0JyB8fCBhcmNoID09PSAneDY0JylcbiAgICAgICAgcmV0dXJuICd4NjQnO1xuICAgIGlmIChhcmNoID09PSAnYXJtJylcbiAgICAgICAgcmV0dXJuICdhcm0nO1xuICAgIGlmIChhcmNoID09PSAnYWFyY2g2NCcgfHwgYXJjaCA9PT0gJ2FybTY0JylcbiAgICAgICAgcmV0dXJuICdhcm02NCc7XG4gICAgaWYgKGFyY2gpXG4gICAgICAgIHJldHVybiBgb3RoZXI6JHthcmNofWA7XG4gICAgcmV0dXJuICd1bmtub3duJztcbn07XG5jb25zdCBub3JtYWxpemVQbGF0Zm9ybSA9IChwbGF0Zm9ybSkgPT4ge1xuICAgIC8vIE5vZGUgcGxhdGZvcm1zOlxuICAgIC8vIC0gaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc3BsYXRmb3JtXG4gICAgLy8gRGVubyBwbGF0Zm9ybXM6XG4gICAgLy8gLSBodHRwczovL2RvYy5kZW5vLmxhbmQvZGVuby9zdGFibGUvfi9EZW5vLmJ1aWxkXG4gICAgLy8gLSBodHRwczovL2dpdGh1Yi5jb20vZGVub2xhbmQvZGVuby9pc3N1ZXMvMTQ3OTlcbiAgICBwbGF0Zm9ybSA9IHBsYXRmb3JtLnRvTG93ZXJDYXNlKCk7XG4gICAgLy8gTk9URTogdGhpcyBpT1MgY2hlY2sgaXMgdW50ZXN0ZWQgYW5kIG1heSBub3Qgd29ya1xuICAgIC8vIE5vZGUgZG9lcyBub3Qgd29yayBuYXRpdmVseSBvbiBJT1MsIHRoZXJlIGlzIGEgZm9yayBhdFxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMtbW9iaWxlL25vZGVqcy1tb2JpbGVcbiAgICAvLyBob3dldmVyIGl0IGlzIHVua25vd24gYXQgdGhlIHRpbWUgb2Ygd3JpdGluZyBob3cgdG8gZGV0ZWN0IGlmIGl0IGlzIHJ1bm5pbmdcbiAgICBpZiAocGxhdGZvcm0uaW5jbHVkZXMoJ2lvcycpKVxuICAgICAgICByZXR1cm4gJ2lPUyc7XG4gICAgaWYgKHBsYXRmb3JtID09PSAnYW5kcm9pZCcpXG4gICAgICAgIHJldHVybiAnQW5kcm9pZCc7XG4gICAgaWYgKHBsYXRmb3JtID09PSAnZGFyd2luJylcbiAgICAgICAgcmV0dXJuICdNYWNPUyc7XG4gICAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKVxuICAgICAgICByZXR1cm4gJ1dpbmRvd3MnO1xuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ2ZyZWVic2QnKVxuICAgICAgICByZXR1cm4gJ0ZyZWVCU0QnO1xuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ29wZW5ic2QnKVxuICAgICAgICByZXR1cm4gJ09wZW5CU0QnO1xuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ2xpbnV4JylcbiAgICAgICAgcmV0dXJuICdMaW51eCc7XG4gICAgaWYgKHBsYXRmb3JtKVxuICAgICAgICByZXR1cm4gYE90aGVyOiR7cGxhdGZvcm19YDtcbiAgICByZXR1cm4gJ1Vua25vd24nO1xufTtcbmxldCBfcGxhdGZvcm1IZWFkZXJzO1xuY29uc3QgZ2V0UGxhdGZvcm1IZWFkZXJzID0gKCkgPT4ge1xuICAgIHJldHVybiAoX3BsYXRmb3JtSGVhZGVycyA/PyAoX3BsYXRmb3JtSGVhZGVycyA9IGdldFBsYXRmb3JtUHJvcGVydGllcygpKSk7XG59O1xuZXhwb3J0IGNvbnN0IHNhZmVKU09OID0gKHRleHQpID0+IHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh0ZXh0KTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbn07XG4vLyBodHRwczovL3VybC5zcGVjLndoYXR3Zy5vcmcvI3VybC1zY2hlbWUtc3RyaW5nXG5jb25zdCBzdGFydHNXaXRoU2NoZW1lUmVnZXhwID0gL15bYS16XVthLXowLTkrLi1dKjovaTtcbmNvbnN0IGlzQWJzb2x1dGVVUkwgPSAodXJsKSA9PiB7XG4gICAgcmV0dXJuIHN0YXJ0c1dpdGhTY2hlbWVSZWdleHAudGVzdCh1cmwpO1xufTtcbmV4cG9ydCBjb25zdCBzbGVlcCA9IChtcykgPT4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbmNvbnN0IHZhbGlkYXRlUG9zaXRpdmVJbnRlZ2VyID0gKG5hbWUsIG4pID0+IHtcbiAgICBpZiAodHlwZW9mIG4gIT09ICdudW1iZXInIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKG4pKSB7XG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgJHtuYW1lfSBtdXN0IGJlIGFuIGludGVnZXJgKTtcbiAgICB9XG4gICAgaWYgKG4gPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgJHtuYW1lfSBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlcmApO1xuICAgIH1cbiAgICByZXR1cm4gbjtcbn07XG5leHBvcnQgY29uc3QgY2FzdFRvRXJyb3IgPSAoZXJyKSA9PiB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKVxuICAgICAgICByZXR1cm4gZXJyO1xuICAgIGlmICh0eXBlb2YgZXJyID09PSAnb2JqZWN0JyAmJiBlcnIgIT09IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRXJyb3IoSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggeyB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgRXJyb3IoZXJyKTtcbn07XG5leHBvcnQgY29uc3QgZW5zdXJlUHJlc2VudCA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYEV4cGVjdGVkIGEgdmFsdWUgdG8gYmUgZ2l2ZW4gYnV0IHJlY2VpdmVkICR7dmFsdWV9IGluc3RlYWQuYCk7XG4gICAgcmV0dXJuIHZhbHVlO1xufTtcbi8qKlxuICogUmVhZCBhbiBlbnZpcm9ubWVudCB2YXJpYWJsZS5cbiAqXG4gKiBUcmltcyBiZWdpbm5pbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuXG4gKlxuICogV2lsbCByZXR1cm4gdW5kZWZpbmVkIGlmIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBkb2Vzbid0IGV4aXN0IG9yIGNhbm5vdCBiZSBhY2Nlc3NlZC5cbiAqL1xuZXhwb3J0IGNvbnN0IHJlYWRFbnYgPSAoZW52KSA9PiB7XG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5lbnY/LltlbnZdPy50cmltKCkgPz8gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIERlbm8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBEZW5vLmVudj8uZ2V0Py4oZW52KT8udHJpbSgpO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufTtcbmV4cG9ydCBjb25zdCBjb2VyY2VJbnRlZ2VyID0gKHZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpXG4gICAgICAgIHJldHVybiBNYXRoLnJvdW5kKHZhbHVlKTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHZhbHVlLCAxMCk7XG4gICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBDb3VsZCBub3QgY29lcmNlICR7dmFsdWV9ICh0eXBlOiAke3R5cGVvZiB2YWx1ZX0pIGludG8gYSBudW1iZXJgKTtcbn07XG5leHBvcnQgY29uc3QgY29lcmNlRmxvYXQgPSAodmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJylcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZSk7XG4gICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBDb3VsZCBub3QgY29lcmNlICR7dmFsdWV9ICh0eXBlOiAke3R5cGVvZiB2YWx1ZX0pIGludG8gYSBudW1iZXJgKTtcbn07XG5leHBvcnQgY29uc3QgY29lcmNlQm9vbGVhbiA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJylcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4gdmFsdWUgPT09ICd0cnVlJztcbiAgICByZXR1cm4gQm9vbGVhbih2YWx1ZSk7XG59O1xuZXhwb3J0IGNvbnN0IG1heWJlQ29lcmNlSW50ZWdlciA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBjb2VyY2VJbnRlZ2VyKHZhbHVlKTtcbn07XG5leHBvcnQgY29uc3QgbWF5YmVDb2VyY2VGbG9hdCA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBjb2VyY2VGbG9hdCh2YWx1ZSk7XG59O1xuZXhwb3J0IGNvbnN0IG1heWJlQ29lcmNlQm9vbGVhbiA9ICh2YWx1ZSkgPT4ge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBjb2VyY2VCb29sZWFuKHZhbHVlKTtcbn07XG4vLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzQ0OTEyODdcbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5T2JqKG9iaikge1xuICAgIGlmICghb2JqKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IF9rIGluIG9iailcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xufVxuLy8gaHR0cHM6Ly9lc2xpbnQub3JnL2RvY3MvbGF0ZXN0L3J1bGVzL25vLXByb3RvdHlwZS1idWlsdGluc1xuZXhwb3J0IGZ1bmN0aW9uIGhhc093bihvYmosIGtleSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xufVxuLyoqXG4gKiBDb3BpZXMgaGVhZGVycyBmcm9tIFwibmV3SGVhZGVyc1wiIG9udG8gXCJ0YXJnZXRIZWFkZXJzXCIsXG4gKiB1c2luZyBsb3dlci1jYXNlIGZvciBhbGwgcHJvcGVydGllcyxcbiAqIGlnbm9yaW5nIGFueSBrZXlzIHdpdGggdW5kZWZpbmVkIHZhbHVlcyxcbiAqIGFuZCBkZWxldGluZyBhbnkga2V5cyB3aXRoIG51bGwgdmFsdWVzLlxuICovXG5mdW5jdGlvbiBhcHBseUhlYWRlcnNNdXQodGFyZ2V0SGVhZGVycywgbmV3SGVhZGVycykge1xuICAgIGZvciAoY29uc3QgayBpbiBuZXdIZWFkZXJzKSB7XG4gICAgICAgIGlmICghaGFzT3duKG5ld0hlYWRlcnMsIGspKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIGNvbnN0IGxvd2VyS2V5ID0gay50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZiAoIWxvd2VyS2V5KVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIGNvbnN0IHZhbCA9IG5ld0hlYWRlcnNba107XG4gICAgICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0YXJnZXRIZWFkZXJzW2xvd2VyS2V5XTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGFyZ2V0SGVhZGVyc1tsb3dlcktleV0gPSB2YWw7XG4gICAgICAgIH1cbiAgICB9XG59XG5jb25zdCBTRU5TSVRJVkVfSEVBREVSUyA9IG5ldyBTZXQoWydhdXRob3JpemF0aW9uJywgJ2FwaS1rZXknXSk7XG5leHBvcnQgZnVuY3Rpb24gZGVidWcoYWN0aW9uLCAuLi5hcmdzKSB7XG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzPy5lbnY/LlsnREVCVUcnXSA9PT0gJ3RydWUnKSB7XG4gICAgICAgIGNvbnN0IG1vZGlmaWVkQXJncyA9IGFyZ3MubWFwKChhcmcpID0+IHtcbiAgICAgICAgICAgIGlmICghYXJnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBzZW5zaXRpdmUgaGVhZGVycyBpbiByZXF1ZXN0IGJvZHkgJ2hlYWRlcnMnIG9iamVjdFxuICAgICAgICAgICAgaWYgKGFyZ1snaGVhZGVycyddKSB7XG4gICAgICAgICAgICAgICAgLy8gY2xvbmUgc28gd2UgZG9uJ3QgbXV0YXRlXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kaWZpZWRBcmcgPSB7IC4uLmFyZywgaGVhZGVyczogeyAuLi5hcmdbJ2hlYWRlcnMnXSB9IH07XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBoZWFkZXIgaW4gYXJnWydoZWFkZXJzJ10pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFNFTlNJVElWRV9IRUFERVJTLmhhcyhoZWFkZXIudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkQXJnWydoZWFkZXJzJ11baGVhZGVyXSA9ICdSRURBQ1RFRCc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZGlmaWVkQXJnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG1vZGlmaWVkQXJnID0gbnVsbDtcbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBzZW5zaXRpdmUgaGVhZGVycyBpbiBoZWFkZXJzIG9iamVjdFxuICAgICAgICAgICAgZm9yIChjb25zdCBoZWFkZXIgaW4gYXJnKSB7XG4gICAgICAgICAgICAgICAgaWYgKFNFTlNJVElWRV9IRUFERVJTLmhhcyhoZWFkZXIudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gYXZvaWQgbWFraW5nIGEgY29weSB1bnRpbCB3ZSBuZWVkIHRvXG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkQXJnID8/IChtb2RpZmllZEFyZyA9IHsgLi4uYXJnIH0pO1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZEFyZ1toZWFkZXJdID0gJ1JFREFDVEVEJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbW9kaWZpZWRBcmcgPz8gYXJnO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coYE9wZW5BSTpERUJVRzoke2FjdGlvbn1gLCAuLi5tb2RpZmllZEFyZ3MpO1xuICAgIH1cbn1cbi8qKlxuICogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIxMTc1MjNcbiAqL1xuY29uc3QgdXVpZDQgPSAoKSA9PiB7XG4gICAgcmV0dXJuICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgKGMpID0+IHtcbiAgICAgICAgY29uc3QgciA9IChNYXRoLnJhbmRvbSgpICogMTYpIHwgMDtcbiAgICAgICAgY29uc3QgdiA9IGMgPT09ICd4JyA/IHIgOiAociAmIDB4MykgfCAweDg7XG4gICAgICAgIHJldHVybiB2LnRvU3RyaW5nKDE2KTtcbiAgICB9KTtcbn07XG5leHBvcnQgY29uc3QgaXNSdW5uaW5nSW5Ccm93c2VyID0gKCkgPT4ge1xuICAgIHJldHVybiAoXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdHlwZW9mIHdpbmRvdy5kb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyk7XG59O1xuZXhwb3J0IGNvbnN0IGlzSGVhZGVyc1Byb3RvY29sID0gKGhlYWRlcnMpID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIGhlYWRlcnM/LmdldCA9PT0gJ2Z1bmN0aW9uJztcbn07XG5leHBvcnQgY29uc3QgZ2V0UmVxdWlyZWRIZWFkZXIgPSAoaGVhZGVycywgaGVhZGVyKSA9PiB7XG4gICAgY29uc3QgZm91bmRIZWFkZXIgPSBnZXRIZWFkZXIoaGVhZGVycywgaGVhZGVyKTtcbiAgICBpZiAoZm91bmRIZWFkZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7aGVhZGVyfSBoZWFkZXJgKTtcbiAgICB9XG4gICAgcmV0dXJuIGZvdW5kSGVhZGVyO1xufTtcbmV4cG9ydCBjb25zdCBnZXRIZWFkZXIgPSAoaGVhZGVycywgaGVhZGVyKSA9PiB7XG4gICAgY29uc3QgbG93ZXJDYXNlZEhlYWRlciA9IGhlYWRlci50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChpc0hlYWRlcnNQcm90b2NvbChoZWFkZXJzKSkge1xuICAgICAgICAvLyB0byBkZWFsIHdpdGggdGhlIGNhc2Ugd2hlcmUgdGhlIGhlYWRlciBsb29rcyBsaWtlIFN0YWlubGVzcy1FdmVudC1JZFxuICAgICAgICBjb25zdCBpbnRlcmNhcHNIZWFkZXIgPSBoZWFkZXJbMF0/LnRvVXBwZXJDYXNlKCkgK1xuICAgICAgICAgICAgaGVhZGVyLnN1YnN0cmluZygxKS5yZXBsYWNlKC8oW15cXHddKShcXHcpL2csIChfbSwgZzEsIGcyKSA9PiBnMSArIGcyLnRvVXBwZXJDYXNlKCkpO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBbaGVhZGVyLCBsb3dlckNhc2VkSGVhZGVyLCBoZWFkZXIudG9VcHBlckNhc2UoKSwgaW50ZXJjYXBzSGVhZGVyXSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBoZWFkZXJzLmdldChrZXkpO1xuICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGhlYWRlcnMpKSB7XG4gICAgICAgIGlmIChrZXkudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXJDYXNlZEhlYWRlcikge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA8PSAxKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVbMF07XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBSZWNlaXZlZCAke3ZhbHVlLmxlbmd0aH0gZW50cmllcyBmb3IgdGhlICR7aGVhZGVyfSBoZWFkZXIsIHVzaW5nIHRoZSBmaXJzdCBlbnRyeS5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgdG8gQmFzZTY0IGZvcm1hdC5cbiAqL1xuZXhwb3J0IGNvbnN0IHRvQmFzZTY0ID0gKHN0cikgPT4ge1xuICAgIGlmICghc3RyKVxuICAgICAgICByZXR1cm4gJyc7XG4gICAgaWYgKHR5cGVvZiBCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShzdHIpLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBidG9hICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gYnRvYShzdHIpO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoJ0Nhbm5vdCBnZW5lcmF0ZSBiNjQgc3RyaW5nOyBFeHBlY3RlZCBgQnVmZmVyYCBvciBgYnRvYWAgdG8gYmUgZGVmaW5lZCcpO1xufTtcbmV4cG9ydCBmdW5jdGlvbiBpc09iaihvYmopIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkob2JqKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvcmUubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBjYXN0VG9FcnJvciB9IGZyb20gXCIuL2NvcmUubWpzXCI7XG5leHBvcnQgY2xhc3MgT3BlbkFJRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgQVBJRXJyb3IgZXh0ZW5kcyBPcGVuQUlFcnJvciB7XG4gICAgY29uc3RydWN0b3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycykge1xuICAgICAgICBzdXBlcihgJHtBUElFcnJvci5tYWtlTWVzc2FnZShzdGF0dXMsIGVycm9yLCBtZXNzYWdlKX1gKTtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXM7XG4gICAgICAgIHRoaXMuaGVhZGVycyA9IGhlYWRlcnM7XG4gICAgICAgIHRoaXMucmVxdWVzdF9pZCA9IGhlYWRlcnM/LlsneC1yZXF1ZXN0LWlkJ107XG4gICAgICAgIHRoaXMuZXJyb3IgPSBlcnJvcjtcbiAgICAgICAgY29uc3QgZGF0YSA9IGVycm9yO1xuICAgICAgICB0aGlzLmNvZGUgPSBkYXRhPy5bJ2NvZGUnXTtcbiAgICAgICAgdGhpcy5wYXJhbSA9IGRhdGE/LlsncGFyYW0nXTtcbiAgICAgICAgdGhpcy50eXBlID0gZGF0YT8uWyd0eXBlJ107XG4gICAgfVxuICAgIHN0YXRpYyBtYWtlTWVzc2FnZShzdGF0dXMsIGVycm9yLCBtZXNzYWdlKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9IGVycm9yPy5tZXNzYWdlID9cbiAgICAgICAgICAgIHR5cGVvZiBlcnJvci5tZXNzYWdlID09PSAnc3RyaW5nJyA/XG4gICAgICAgICAgICAgICAgZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgICAgIDogSlNPTi5zdHJpbmdpZnkoZXJyb3IubWVzc2FnZSlcbiAgICAgICAgICAgIDogZXJyb3IgPyBKU09OLnN0cmluZ2lmeShlcnJvcilcbiAgICAgICAgICAgICAgICA6IG1lc3NhZ2U7XG4gICAgICAgIGlmIChzdGF0dXMgJiYgbXNnKSB7XG4gICAgICAgICAgICByZXR1cm4gYCR7c3RhdHVzfSAke21zZ31gO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMpIHtcbiAgICAgICAgICAgIHJldHVybiBgJHtzdGF0dXN9IHN0YXR1cyBjb2RlIChubyBib2R5KWA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1zZykge1xuICAgICAgICAgICAgcmV0dXJuIG1zZztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gJyhubyBzdGF0dXMgY29kZSBvciBib2R5KSc7XG4gICAgfVxuICAgIHN0YXRpYyBnZW5lcmF0ZShzdGF0dXMsIGVycm9yUmVzcG9uc2UsIG1lc3NhZ2UsIGhlYWRlcnMpIHtcbiAgICAgICAgaWYgKCFzdGF0dXMgfHwgIWhlYWRlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQVBJQ29ubmVjdGlvbkVycm9yKHsgbWVzc2FnZSwgY2F1c2U6IGNhc3RUb0Vycm9yKGVycm9yUmVzcG9uc2UpIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVycm9yID0gZXJyb3JSZXNwb25zZT8uWydlcnJvciddO1xuICAgICAgICBpZiAoc3RhdHVzID09PSA0MDApIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQmFkUmVxdWVzdEVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQwMSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBdXRoZW50aWNhdGlvbkVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXMgPT09IDQwMykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQZXJtaXNzaW9uRGVuaWVkRXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IE5vdEZvdW5kRXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDA5KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IENvbmZsaWN0RXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gNDIyKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFVucHJvY2Vzc2FibGVFbnRpdHlFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzID09PSA0MjkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmF0ZUxpbWl0RXJyb3Ioc3RhdHVzLCBlcnJvciwgbWVzc2FnZSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cyA+PSA1MDApIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgSW50ZXJuYWxTZXJ2ZXJFcnJvcihzdGF0dXMsIGVycm9yLCBtZXNzYWdlLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IEFQSUVycm9yKHN0YXR1cywgZXJyb3IsIG1lc3NhZ2UsIGhlYWRlcnMpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBUElVc2VyQWJvcnRFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IG1lc3NhZ2UgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBtZXNzYWdlIHx8ICdSZXF1ZXN0IHdhcyBhYm9ydGVkLicsIHVuZGVmaW5lZCk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFQSUNvbm5lY3Rpb25FcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IG1lc3NhZ2UsIGNhdXNlIH0pIHtcbiAgICAgICAgc3VwZXIodW5kZWZpbmVkLCB1bmRlZmluZWQsIG1lc3NhZ2UgfHwgJ0Nvbm5lY3Rpb24gZXJyb3IuJywgdW5kZWZpbmVkKTtcbiAgICAgICAgLy8gaW4gc29tZSBlbnZpcm9ubWVudHMgdGhlICdjYXVzZScgcHJvcGVydHkgaXMgYWxyZWFkeSBkZWNsYXJlZFxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGlmIChjYXVzZSlcbiAgICAgICAgICAgIHRoaXMuY2F1c2UgPSBjYXVzZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvciBleHRlbmRzIEFQSUNvbm5lY3Rpb25FcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBtZXNzYWdlIH0gPSB7fSkge1xuICAgICAgICBzdXBlcih7IG1lc3NhZ2U6IG1lc3NhZ2UgPz8gJ1JlcXVlc3QgdGltZWQgb3V0LicgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEJhZFJlcXVlc3RFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBBdXRoZW50aWNhdGlvbkVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIFBlcm1pc3Npb25EZW5pZWRFcnJvciBleHRlbmRzIEFQSUVycm9yIHtcbn1cbmV4cG9ydCBjbGFzcyBOb3RGb3VuZEVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIENvbmZsaWN0RXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgVW5wcm9jZXNzYWJsZUVudGl0eUVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIFJhdGVMaW1pdEVycm9yIGV4dGVuZHMgQVBJRXJyb3Ige1xufVxuZXhwb3J0IGNsYXNzIEludGVybmFsU2VydmVyRXJyb3IgZXh0ZW5kcyBBUElFcnJvciB7XG59XG5leHBvcnQgY2xhc3MgTGVuZ3RoRmluaXNoUmVhc29uRXJyb3IgZXh0ZW5kcyBPcGVuQUlFcnJvciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKGBDb3VsZCBub3QgcGFyc2UgcmVzcG9uc2UgY29udGVudCBhcyB0aGUgbGVuZ3RoIGxpbWl0IHdhcyByZWFjaGVkYCk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIENvbnRlbnRGaWx0ZXJGaW5pc2hSZWFzb25FcnJvciBleHRlbmRzIE9wZW5BSUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoYENvdWxkIG5vdCBwYXJzZSByZXNwb25zZSBjb250ZW50IGFzIHRoZSByZXF1ZXN0IHdhcyByZWplY3RlZCBieSB0aGUgY29udGVudCBmaWx0ZXJgKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lcnJvci5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbnZhciBfYTtcbmltcG9ydCAqIGFzIHFzIGZyb20gXCIuL2ludGVybmFsL3FzL2luZGV4Lm1qc1wiO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi9jb3JlLm1qc1wiO1xuaW1wb3J0ICogYXMgRXJyb3JzIGZyb20gXCIuL2Vycm9yLm1qc1wiO1xuaW1wb3J0ICogYXMgUGFnaW5hdGlvbiBmcm9tIFwiLi9wYWdpbmF0aW9uLm1qc1wiO1xuaW1wb3J0ICogYXMgVXBsb2FkcyBmcm9tIFwiLi91cGxvYWRzLm1qc1wiO1xuaW1wb3J0ICogYXMgQVBJIGZyb20gXCIuL3Jlc291cmNlcy9pbmRleC5tanNcIjtcbmltcG9ydCB7IEJhdGNoZXMsIEJhdGNoZXNQYWdlLCB9IGZyb20gXCIuL3Jlc291cmNlcy9iYXRjaGVzLm1qc1wiO1xuaW1wb3J0IHsgQ29tcGxldGlvbnMsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2NvbXBsZXRpb25zLm1qc1wiO1xuaW1wb3J0IHsgRW1iZWRkaW5ncywgfSBmcm9tIFwiLi9yZXNvdXJjZXMvZW1iZWRkaW5ncy5tanNcIjtcbmltcG9ydCB7IEZpbGVPYmplY3RzUGFnZSwgRmlsZXMsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2ZpbGVzLm1qc1wiO1xuaW1wb3J0IHsgSW1hZ2VzLCB9IGZyb20gXCIuL3Jlc291cmNlcy9pbWFnZXMubWpzXCI7XG5pbXBvcnQgeyBNb2RlbHMsIE1vZGVsc1BhZ2UgfSBmcm9tIFwiLi9yZXNvdXJjZXMvbW9kZWxzLm1qc1wiO1xuaW1wb3J0IHsgTW9kZXJhdGlvbnMsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL21vZGVyYXRpb25zLm1qc1wiO1xuaW1wb3J0IHsgQXVkaW8gfSBmcm9tIFwiLi9yZXNvdXJjZXMvYXVkaW8vYXVkaW8ubWpzXCI7XG5pbXBvcnQgeyBCZXRhIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2JldGEvYmV0YS5tanNcIjtcbmltcG9ydCB7IENoYXQgfSBmcm9tIFwiLi9yZXNvdXJjZXMvY2hhdC9jaGF0Lm1qc1wiO1xuaW1wb3J0IHsgRmluZVR1bmluZyB9IGZyb20gXCIuL3Jlc291cmNlcy9maW5lLXR1bmluZy9maW5lLXR1bmluZy5tanNcIjtcbmltcG9ydCB7IFVwbG9hZHMgYXMgVXBsb2Fkc0FQSVVwbG9hZHMsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL3VwbG9hZHMvdXBsb2Fkcy5tanNcIjtcbmltcG9ydCB7IENoYXRDb21wbGV0aW9uc1BhZ2UsIH0gZnJvbSBcIi4vcmVzb3VyY2VzL2NoYXQvY29tcGxldGlvbnMvY29tcGxldGlvbnMubWpzXCI7XG4vKipcbiAqIEFQSSBDbGllbnQgZm9yIGludGVyZmFjaW5nIHdpdGggdGhlIE9wZW5BSSBBUEkuXG4gKi9cbmV4cG9ydCBjbGFzcyBPcGVuQUkgZXh0ZW5kcyBDb3JlLkFQSUNsaWVudCB7XG4gICAgLyoqXG4gICAgICogQVBJIENsaWVudCBmb3IgaW50ZXJmYWNpbmcgd2l0aCB0aGUgT3BlbkFJIEFQSS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgdW5kZWZpbmVkfSBbb3B0cy5hcGlLZXk9cHJvY2Vzcy5lbnZbJ09QRU5BSV9BUElfS0VZJ10gPz8gdW5kZWZpbmVkXVxuICAgICAqIEBwYXJhbSB7c3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZH0gW29wdHMub3JnYW5pemF0aW9uPXByb2Nlc3MuZW52WydPUEVOQUlfT1JHX0lEJ10gPz8gbnVsbF1cbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IG51bGwgfCB1bmRlZmluZWR9IFtvcHRzLnByb2plY3Q9cHJvY2Vzcy5lbnZbJ09QRU5BSV9QUk9KRUNUX0lEJ10gPz8gbnVsbF1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdHMuYmFzZVVSTD1wcm9jZXNzLmVudlsnT1BFTkFJX0JBU0VfVVJMJ10gPz8gaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MV0gLSBPdmVycmlkZSB0aGUgZGVmYXVsdCBiYXNlIFVSTCBmb3IgdGhlIEFQSS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdHMudGltZW91dD0xMCBtaW51dGVzXSAtIFRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIChpbiBtaWxsaXNlY29uZHMpIHRoZSBjbGllbnQgd2lsbCB3YWl0IGZvciBhIHJlc3BvbnNlIGJlZm9yZSB0aW1pbmcgb3V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5odHRwQWdlbnRdIC0gQW4gSFRUUCBhZ2VudCB1c2VkIHRvIG1hbmFnZSBIVFRQKHMpIGNvbm5lY3Rpb25zLlxuICAgICAqIEBwYXJhbSB7Q29yZS5GZXRjaH0gW29wdHMuZmV0Y2hdIC0gU3BlY2lmeSBhIGN1c3RvbSBgZmV0Y2hgIGZ1bmN0aW9uIGltcGxlbWVudGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5tYXhSZXRyaWVzPTJdIC0gVGhlIG1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRoZSBjbGllbnQgd2lsbCByZXRyeSBhIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIHtDb3JlLkhlYWRlcnN9IG9wdHMuZGVmYXVsdEhlYWRlcnMgLSBEZWZhdWx0IGhlYWRlcnMgdG8gaW5jbHVkZSB3aXRoIGV2ZXJ5IHJlcXVlc3QgdG8gdGhlIEFQSS5cbiAgICAgKiBAcGFyYW0ge0NvcmUuRGVmYXVsdFF1ZXJ5fSBvcHRzLmRlZmF1bHRRdWVyeSAtIERlZmF1bHQgcXVlcnkgcGFyYW1ldGVycyB0byBpbmNsdWRlIHdpdGggZXZlcnkgcmVxdWVzdCB0byB0aGUgQVBJLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXI9ZmFsc2VdIC0gQnkgZGVmYXVsdCwgY2xpZW50LXNpZGUgdXNlIG9mIHRoaXMgbGlicmFyeSBpcyBub3QgYWxsb3dlZCwgYXMgaXQgcmlza3MgZXhwb3NpbmcgeW91ciBzZWNyZXQgQVBJIGNyZWRlbnRpYWxzIHRvIGF0dGFja2Vycy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih7IGJhc2VVUkwgPSBDb3JlLnJlYWRFbnYoJ09QRU5BSV9CQVNFX1VSTCcpLCBhcGlLZXkgPSBDb3JlLnJlYWRFbnYoJ09QRU5BSV9BUElfS0VZJyksIG9yZ2FuaXphdGlvbiA9IENvcmUucmVhZEVudignT1BFTkFJX09SR19JRCcpID8/IG51bGwsIHByb2plY3QgPSBDb3JlLnJlYWRFbnYoJ09QRU5BSV9QUk9KRUNUX0lEJykgPz8gbnVsbCwgLi4ub3B0cyB9ID0ge30pIHtcbiAgICAgICAgaWYgKGFwaUtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKFwiVGhlIE9QRU5BSV9BUElfS0VZIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIG1pc3Npbmcgb3IgZW1wdHk7IGVpdGhlciBwcm92aWRlIGl0LCBvciBpbnN0YW50aWF0ZSB0aGUgT3BlbkFJIGNsaWVudCB3aXRoIGFuIGFwaUtleSBvcHRpb24sIGxpa2UgbmV3IE9wZW5BSSh7IGFwaUtleTogJ015IEFQSSBLZXknIH0pLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgYXBpS2V5LFxuICAgICAgICAgICAgb3JnYW5pemF0aW9uLFxuICAgICAgICAgICAgcHJvamVjdCxcbiAgICAgICAgICAgIC4uLm9wdHMsXG4gICAgICAgICAgICBiYXNlVVJMOiBiYXNlVVJMIHx8IGBodHRwczovL2FwaS5vcGVuYWkuY29tL3YxYCxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmRhbmdlcm91c2x5QWxsb3dCcm93c2VyICYmIENvcmUuaXNSdW5uaW5nSW5Ccm93c2VyKCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoXCJJdCBsb29rcyBsaWtlIHlvdSdyZSBydW5uaW5nIGluIGEgYnJvd3Nlci1saWtlIGVudmlyb25tZW50LlxcblxcblRoaXMgaXMgZGlzYWJsZWQgYnkgZGVmYXVsdCwgYXMgaXQgcmlza3MgZXhwb3NpbmcgeW91ciBzZWNyZXQgQVBJIGNyZWRlbnRpYWxzIHRvIGF0dGFja2Vycy5cXG5JZiB5b3UgdW5kZXJzdGFuZCB0aGUgcmlza3MgYW5kIGhhdmUgYXBwcm9wcmlhdGUgbWl0aWdhdGlvbnMgaW4gcGxhY2UsXFxueW91IGNhbiBzZXQgdGhlIGBkYW5nZXJvdXNseUFsbG93QnJvd3NlcmAgb3B0aW9uIHRvIGB0cnVlYCwgZS5nLixcXG5cXG5uZXcgT3BlbkFJKHsgYXBpS2V5LCBkYW5nZXJvdXNseUFsbG93QnJvd3NlcjogdHJ1ZSB9KTtcXG5cXG5odHRwczovL2hlbHAub3BlbmFpLmNvbS9lbi9hcnRpY2xlcy81MTEyNTk1LWJlc3QtcHJhY3RpY2VzLWZvci1hcGkta2V5LXNhZmV0eVxcblwiKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlcih7XG4gICAgICAgICAgICBiYXNlVVJMOiBvcHRpb25zLmJhc2VVUkwsXG4gICAgICAgICAgICB0aW1lb3V0OiBvcHRpb25zLnRpbWVvdXQgPz8gNjAwMDAwIC8qIDEwIG1pbnV0ZXMgKi8sXG4gICAgICAgICAgICBodHRwQWdlbnQ6IG9wdGlvbnMuaHR0cEFnZW50LFxuICAgICAgICAgICAgbWF4UmV0cmllczogb3B0aW9ucy5tYXhSZXRyaWVzLFxuICAgICAgICAgICAgZmV0Y2g6IG9wdGlvbnMuZmV0Y2gsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25zID0gbmV3IEFQSS5Db21wbGV0aW9ucyh0aGlzKTtcbiAgICAgICAgdGhpcy5jaGF0ID0gbmV3IEFQSS5DaGF0KHRoaXMpO1xuICAgICAgICB0aGlzLmVtYmVkZGluZ3MgPSBuZXcgQVBJLkVtYmVkZGluZ3ModGhpcyk7XG4gICAgICAgIHRoaXMuZmlsZXMgPSBuZXcgQVBJLkZpbGVzKHRoaXMpO1xuICAgICAgICB0aGlzLmltYWdlcyA9IG5ldyBBUEkuSW1hZ2VzKHRoaXMpO1xuICAgICAgICB0aGlzLmF1ZGlvID0gbmV3IEFQSS5BdWRpbyh0aGlzKTtcbiAgICAgICAgdGhpcy5tb2RlcmF0aW9ucyA9IG5ldyBBUEkuTW9kZXJhdGlvbnModGhpcyk7XG4gICAgICAgIHRoaXMubW9kZWxzID0gbmV3IEFQSS5Nb2RlbHModGhpcyk7XG4gICAgICAgIHRoaXMuZmluZVR1bmluZyA9IG5ldyBBUEkuRmluZVR1bmluZyh0aGlzKTtcbiAgICAgICAgdGhpcy5iZXRhID0gbmV3IEFQSS5CZXRhKHRoaXMpO1xuICAgICAgICB0aGlzLmJhdGNoZXMgPSBuZXcgQVBJLkJhdGNoZXModGhpcyk7XG4gICAgICAgIHRoaXMudXBsb2FkcyA9IG5ldyBBUEkuVXBsb2Fkcyh0aGlzKTtcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuYXBpS2V5ID0gYXBpS2V5O1xuICAgICAgICB0aGlzLm9yZ2FuaXphdGlvbiA9IG9yZ2FuaXphdGlvbjtcbiAgICAgICAgdGhpcy5wcm9qZWN0ID0gcHJvamVjdDtcbiAgICB9XG4gICAgZGVmYXVsdFF1ZXJ5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3B0aW9ucy5kZWZhdWx0UXVlcnk7XG4gICAgfVxuICAgIGRlZmF1bHRIZWFkZXJzKG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN1cGVyLmRlZmF1bHRIZWFkZXJzKG9wdHMpLFxuICAgICAgICAgICAgJ09wZW5BSS1Pcmdhbml6YXRpb24nOiB0aGlzLm9yZ2FuaXphdGlvbixcbiAgICAgICAgICAgICdPcGVuQUktUHJvamVjdCc6IHRoaXMucHJvamVjdCxcbiAgICAgICAgICAgIC4uLnRoaXMuX29wdGlvbnMuZGVmYXVsdEhlYWRlcnMsXG4gICAgICAgIH07XG4gICAgfVxuICAgIGF1dGhIZWFkZXJzKG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuYXBpS2V5fWAgfTtcbiAgICB9XG4gICAgc3RyaW5naWZ5UXVlcnkocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIHFzLnN0cmluZ2lmeShxdWVyeSwgeyBhcnJheUZvcm1hdDogJ2JyYWNrZXRzJyB9KTtcbiAgICB9XG59XG5fYSA9IE9wZW5BSTtcbk9wZW5BSS5PcGVuQUkgPSBfYTtcbk9wZW5BSS5ERUZBVUxUX1RJTUVPVVQgPSA2MDAwMDA7IC8vIDEwIG1pbnV0ZXNcbk9wZW5BSS5PcGVuQUlFcnJvciA9IEVycm9ycy5PcGVuQUlFcnJvcjtcbk9wZW5BSS5BUElFcnJvciA9IEVycm9ycy5BUElFcnJvcjtcbk9wZW5BSS5BUElDb25uZWN0aW9uRXJyb3IgPSBFcnJvcnMuQVBJQ29ubmVjdGlvbkVycm9yO1xuT3BlbkFJLkFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3IgPSBFcnJvcnMuQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvcjtcbk9wZW5BSS5BUElVc2VyQWJvcnRFcnJvciA9IEVycm9ycy5BUElVc2VyQWJvcnRFcnJvcjtcbk9wZW5BSS5Ob3RGb3VuZEVycm9yID0gRXJyb3JzLk5vdEZvdW5kRXJyb3I7XG5PcGVuQUkuQ29uZmxpY3RFcnJvciA9IEVycm9ycy5Db25mbGljdEVycm9yO1xuT3BlbkFJLlJhdGVMaW1pdEVycm9yID0gRXJyb3JzLlJhdGVMaW1pdEVycm9yO1xuT3BlbkFJLkJhZFJlcXVlc3RFcnJvciA9IEVycm9ycy5CYWRSZXF1ZXN0RXJyb3I7XG5PcGVuQUkuQXV0aGVudGljYXRpb25FcnJvciA9IEVycm9ycy5BdXRoZW50aWNhdGlvbkVycm9yO1xuT3BlbkFJLkludGVybmFsU2VydmVyRXJyb3IgPSBFcnJvcnMuSW50ZXJuYWxTZXJ2ZXJFcnJvcjtcbk9wZW5BSS5QZXJtaXNzaW9uRGVuaWVkRXJyb3IgPSBFcnJvcnMuUGVybWlzc2lvbkRlbmllZEVycm9yO1xuT3BlbkFJLlVucHJvY2Vzc2FibGVFbnRpdHlFcnJvciA9IEVycm9ycy5VbnByb2Nlc3NhYmxlRW50aXR5RXJyb3I7XG5PcGVuQUkudG9GaWxlID0gVXBsb2Fkcy50b0ZpbGU7XG5PcGVuQUkuZmlsZUZyb21QYXRoID0gVXBsb2Fkcy5maWxlRnJvbVBhdGg7XG5PcGVuQUkuQ29tcGxldGlvbnMgPSBDb21wbGV0aW9ucztcbk9wZW5BSS5DaGF0ID0gQ2hhdDtcbk9wZW5BSS5DaGF0Q29tcGxldGlvbnNQYWdlID0gQ2hhdENvbXBsZXRpb25zUGFnZTtcbk9wZW5BSS5FbWJlZGRpbmdzID0gRW1iZWRkaW5ncztcbk9wZW5BSS5GaWxlcyA9IEZpbGVzO1xuT3BlbkFJLkZpbGVPYmplY3RzUGFnZSA9IEZpbGVPYmplY3RzUGFnZTtcbk9wZW5BSS5JbWFnZXMgPSBJbWFnZXM7XG5PcGVuQUkuQXVkaW8gPSBBdWRpbztcbk9wZW5BSS5Nb2RlcmF0aW9ucyA9IE1vZGVyYXRpb25zO1xuT3BlbkFJLk1vZGVscyA9IE1vZGVscztcbk9wZW5BSS5Nb2RlbHNQYWdlID0gTW9kZWxzUGFnZTtcbk9wZW5BSS5GaW5lVHVuaW5nID0gRmluZVR1bmluZztcbk9wZW5BSS5CZXRhID0gQmV0YTtcbk9wZW5BSS5CYXRjaGVzID0gQmF0Y2hlcztcbk9wZW5BSS5CYXRjaGVzUGFnZSA9IEJhdGNoZXNQYWdlO1xuT3BlbkFJLlVwbG9hZHMgPSBVcGxvYWRzQVBJVXBsb2Fkcztcbi8qKiBBUEkgQ2xpZW50IGZvciBpbnRlcmZhY2luZyB3aXRoIHRoZSBBenVyZSBPcGVuQUkgQVBJLiAqL1xuZXhwb3J0IGNsYXNzIEF6dXJlT3BlbkFJIGV4dGVuZHMgT3BlbkFJIHtcbiAgICAvKipcbiAgICAgKiBBUEkgQ2xpZW50IGZvciBpbnRlcmZhY2luZyB3aXRoIHRoZSBBenVyZSBPcGVuQUkgQVBJLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCB1bmRlZmluZWR9IFtvcHRzLmFwaVZlcnNpb249cHJvY2Vzcy5lbnZbJ09QRU5BSV9BUElfVkVSU0lPTiddID8/IHVuZGVmaW5lZF1cbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IHVuZGVmaW5lZH0gW29wdHMuZW5kcG9pbnQ9cHJvY2Vzcy5lbnZbJ0FaVVJFX09QRU5BSV9FTkRQT0lOVCddID8/IHVuZGVmaW5lZF0gLSBZb3VyIEF6dXJlIGVuZHBvaW50LCBpbmNsdWRpbmcgdGhlIHJlc291cmNlLCBlLmcuIGBodHRwczovL2V4YW1wbGUtcmVzb3VyY2UuYXp1cmUub3BlbmFpLmNvbS9gXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCB1bmRlZmluZWR9IFtvcHRzLmFwaUtleT1wcm9jZXNzLmVudlsnQVpVUkVfT1BFTkFJX0FQSV9LRVknXSA/PyB1bmRlZmluZWRdXG4gICAgICogQHBhcmFtIHtzdHJpbmcgfCB1bmRlZmluZWR9IG9wdHMuZGVwbG95bWVudCAtIEEgbW9kZWwgZGVwbG95bWVudCwgaWYgZ2l2ZW4sIHNldHMgdGhlIGJhc2UgY2xpZW50IFVSTCB0byBpbmNsdWRlIGAvZGVwbG95bWVudHMve2RlcGxveW1lbnR9YC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IG51bGwgfCB1bmRlZmluZWR9IFtvcHRzLm9yZ2FuaXphdGlvbj1wcm9jZXNzLmVudlsnT1BFTkFJX09SR19JRCddID8/IG51bGxdXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRzLmJhc2VVUkw9cHJvY2Vzcy5lbnZbJ09QRU5BSV9CQVNFX1VSTCddXSAtIFNldHMgdGhlIGJhc2UgVVJMIGZvciB0aGUgQVBJLCBlLmcuIGBodHRwczovL2V4YW1wbGUtcmVzb3VyY2UuYXp1cmUub3BlbmFpLmNvbS9vcGVuYWkvYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdHMudGltZW91dD0xMCBtaW51dGVzXSAtIFRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIChpbiBtaWxsaXNlY29uZHMpIHRoZSBjbGllbnQgd2lsbCB3YWl0IGZvciBhIHJlc3BvbnNlIGJlZm9yZSB0aW1pbmcgb3V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5odHRwQWdlbnRdIC0gQW4gSFRUUCBhZ2VudCB1c2VkIHRvIG1hbmFnZSBIVFRQKHMpIGNvbm5lY3Rpb25zLlxuICAgICAqIEBwYXJhbSB7Q29yZS5GZXRjaH0gW29wdHMuZmV0Y2hdIC0gU3BlY2lmeSBhIGN1c3RvbSBgZmV0Y2hgIGZ1bmN0aW9uIGltcGxlbWVudGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5tYXhSZXRyaWVzPTJdIC0gVGhlIG1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRoZSBjbGllbnQgd2lsbCByZXRyeSBhIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIHtDb3JlLkhlYWRlcnN9IG9wdHMuZGVmYXVsdEhlYWRlcnMgLSBEZWZhdWx0IGhlYWRlcnMgdG8gaW5jbHVkZSB3aXRoIGV2ZXJ5IHJlcXVlc3QgdG8gdGhlIEFQSS5cbiAgICAgKiBAcGFyYW0ge0NvcmUuRGVmYXVsdFF1ZXJ5fSBvcHRzLmRlZmF1bHRRdWVyeSAtIERlZmF1bHQgcXVlcnkgcGFyYW1ldGVycyB0byBpbmNsdWRlIHdpdGggZXZlcnkgcmVxdWVzdCB0byB0aGUgQVBJLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXI9ZmFsc2VdIC0gQnkgZGVmYXVsdCwgY2xpZW50LXNpZGUgdXNlIG9mIHRoaXMgbGlicmFyeSBpcyBub3QgYWxsb3dlZCwgYXMgaXQgcmlza3MgZXhwb3NpbmcgeW91ciBzZWNyZXQgQVBJIGNyZWRlbnRpYWxzIHRvIGF0dGFja2Vycy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih7IGJhc2VVUkwgPSBDb3JlLnJlYWRFbnYoJ09QRU5BSV9CQVNFX1VSTCcpLCBhcGlLZXkgPSBDb3JlLnJlYWRFbnYoJ0FaVVJFX09QRU5BSV9BUElfS0VZJyksIGFwaVZlcnNpb24gPSBDb3JlLnJlYWRFbnYoJ09QRU5BSV9BUElfVkVSU0lPTicpLCBlbmRwb2ludCwgZGVwbG95bWVudCwgYXp1cmVBRFRva2VuUHJvdmlkZXIsIGRhbmdlcm91c2x5QWxsb3dCcm93c2VyLCAuLi5vcHRzIH0gPSB7fSkge1xuICAgICAgICBpZiAoIWFwaVZlcnNpb24pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoXCJUaGUgT1BFTkFJX0FQSV9WRVJTSU9OIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIG1pc3Npbmcgb3IgZW1wdHk7IGVpdGhlciBwcm92aWRlIGl0LCBvciBpbnN0YW50aWF0ZSB0aGUgQXp1cmVPcGVuQUkgY2xpZW50IHdpdGggYW4gYXBpVmVyc2lvbiBvcHRpb24sIGxpa2UgbmV3IEF6dXJlT3BlbkFJKHsgYXBpVmVyc2lvbjogJ015IEFQSSBWZXJzaW9uJyB9KS5cIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBhenVyZUFEVG9rZW5Qcm92aWRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXIgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghYXp1cmVBRFRva2VuUHJvdmlkZXIgJiYgIWFwaUtleSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcignTWlzc2luZyBjcmVkZW50aWFscy4gUGxlYXNlIHBhc3Mgb25lIG9mIGBhcGlLZXlgIGFuZCBgYXp1cmVBRFRva2VuUHJvdmlkZXJgLCBvciBzZXQgdGhlIGBBWlVSRV9PUEVOQUlfQVBJX0tFWWAgZW52aXJvbm1lbnQgdmFyaWFibGUuJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGF6dXJlQURUb2tlblByb3ZpZGVyICYmIGFwaUtleSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcignVGhlIGBhcGlLZXlgIGFuZCBgYXp1cmVBRFRva2VuUHJvdmlkZXJgIGFyZ3VtZW50cyBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlOyBvbmx5IG9uZSBjYW4gYmUgcGFzc2VkIGF0IGEgdGltZS4nKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZWZpbmUgYSBzZW50aW5lbCB2YWx1ZSB0byBhdm9pZCBhbnkgdHlwaW5nIGlzc3Vlc1xuICAgICAgICBhcGlLZXkgPz8gKGFwaUtleSA9IEFQSV9LRVlfU0VOVElORUwpO1xuICAgICAgICBvcHRzLmRlZmF1bHRRdWVyeSA9IHsgLi4ub3B0cy5kZWZhdWx0UXVlcnksICdhcGktdmVyc2lvbic6IGFwaVZlcnNpb24gfTtcbiAgICAgICAgaWYgKCFiYXNlVVJMKSB7XG4gICAgICAgICAgICBpZiAoIWVuZHBvaW50KSB7XG4gICAgICAgICAgICAgICAgZW5kcG9pbnQgPSBwcm9jZXNzLmVudlsnQVpVUkVfT1BFTkFJX0VORFBPSU5UJ107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWVuZHBvaW50KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5PcGVuQUlFcnJvcignTXVzdCBwcm92aWRlIG9uZSBvZiB0aGUgYGJhc2VVUkxgIG9yIGBlbmRwb2ludGAgYXJndW1lbnRzLCBvciB0aGUgYEFaVVJFX09QRU5BSV9FTkRQT0lOVGAgZW52aXJvbm1lbnQgdmFyaWFibGUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJhc2VVUkwgPSBgJHtlbmRwb2ludH0vb3BlbmFpYDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChlbmRwb2ludCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoJ2Jhc2VVUkwgYW5kIGVuZHBvaW50IGFyZSBtdXR1YWxseSBleGNsdXNpdmUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdXBlcih7XG4gICAgICAgICAgICBhcGlLZXksXG4gICAgICAgICAgICBiYXNlVVJMLFxuICAgICAgICAgICAgLi4ub3B0cyxcbiAgICAgICAgICAgIC4uLihkYW5nZXJvdXNseUFsbG93QnJvd3NlciAhPT0gdW5kZWZpbmVkID8geyBkYW5nZXJvdXNseUFsbG93QnJvd3NlciB9IDoge30pLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hcGlWZXJzaW9uID0gJyc7XG4gICAgICAgIHRoaXMuX2F6dXJlQURUb2tlblByb3ZpZGVyID0gYXp1cmVBRFRva2VuUHJvdmlkZXI7XG4gICAgICAgIHRoaXMuYXBpVmVyc2lvbiA9IGFwaVZlcnNpb247XG4gICAgICAgIHRoaXMuZGVwbG95bWVudE5hbWUgPSBkZXBsb3ltZW50O1xuICAgIH1cbiAgICBidWlsZFJlcXVlc3Qob3B0aW9ucywgcHJvcHMgPSB7fSkge1xuICAgICAgICBpZiAoX2RlcGxveW1lbnRzX2VuZHBvaW50cy5oYXMob3B0aW9ucy5wYXRoKSAmJiBvcHRpb25zLm1ldGhvZCA9PT0gJ3Bvc3QnICYmIG9wdGlvbnMuYm9keSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoIUNvcmUuaXNPYmoob3B0aW9ucy5ib2R5KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgcmVxdWVzdCBib2R5IHRvIGJlIGFuIG9iamVjdCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbW9kZWwgPSB0aGlzLmRlcGxveW1lbnROYW1lIHx8IG9wdGlvbnMuYm9keVsnbW9kZWwnXSB8fCBvcHRpb25zLl9fbWV0YWRhdGE/LlsnbW9kZWwnXTtcbiAgICAgICAgICAgIGlmIChtb2RlbCAhPT0gdW5kZWZpbmVkICYmICF0aGlzLmJhc2VVUkwuaW5jbHVkZXMoJy9kZXBsb3ltZW50cycpKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wYXRoID0gYC9kZXBsb3ltZW50cy8ke21vZGVsfSR7b3B0aW9ucy5wYXRofWA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1cGVyLmJ1aWxkUmVxdWVzdChvcHRpb25zLCBwcm9wcyk7XG4gICAgfVxuICAgIGFzeW5jIF9nZXRBenVyZUFEVG9rZW4oKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fYXp1cmVBRFRva2VuUHJvdmlkZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gYXdhaXQgdGhpcy5fYXp1cmVBRFRva2VuUHJvdmlkZXIoKTtcbiAgICAgICAgICAgIGlmICghdG9rZW4gfHwgdHlwZW9mIHRva2VuICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcnMuT3BlbkFJRXJyb3IoYEV4cGVjdGVkICdhenVyZUFEVG9rZW5Qcm92aWRlcicgYXJndW1lbnQgdG8gcmV0dXJuIGEgc3RyaW5nIGJ1dCBpdCByZXR1cm5lZCAke3Rva2VufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGF1dGhIZWFkZXJzKG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgICBhc3luYyBwcmVwYXJlT3B0aW9ucyhvcHRzKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdXNlciBzaG91bGQgcHJvdmlkZSBhIGJlYXJlciB0b2tlbiBwcm92aWRlciBpZiB0aGV5IHdhbnRcbiAgICAgICAgICogdG8gdXNlIEF6dXJlIEFEIGF1dGhlbnRpY2F0aW9uLiBUaGUgdXNlciBzaG91bGRuJ3Qgc2V0IHRoZVxuICAgICAgICAgKiBBdXRob3JpemF0aW9uIGhlYWRlciBtYW51YWxseSBiZWNhdXNlIHRoZSBoZWFkZXIgaXMgb3ZlcndyaXR0ZW5cbiAgICAgICAgICogd2l0aCB0aGUgQXp1cmUgQUQgdG9rZW4gaWYgYSBiZWFyZXIgdG9rZW4gcHJvdmlkZXIgaXMgcHJvdmlkZWQuXG4gICAgICAgICAqL1xuICAgICAgICBpZiAob3B0cy5oZWFkZXJzPy5bJ2FwaS1rZXknXSkge1xuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLnByZXBhcmVPcHRpb25zKG9wdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRva2VuID0gYXdhaXQgdGhpcy5fZ2V0QXp1cmVBRFRva2VuKCk7XG4gICAgICAgIG9wdHMuaGVhZGVycyA/PyAob3B0cy5oZWFkZXJzID0ge30pO1xuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICAgIG9wdHMuaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Rva2VufWA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5hcGlLZXkgIT09IEFQSV9LRVlfU0VOVElORUwpIHtcbiAgICAgICAgICAgIG9wdHMuaGVhZGVyc1snYXBpLWtleSddID0gdGhpcy5hcGlLZXk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3JzLk9wZW5BSUVycm9yKCdVbmFibGUgdG8gaGFuZGxlIGF1dGgnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VwZXIucHJlcGFyZU9wdGlvbnMob3B0cyk7XG4gICAgfVxufVxuY29uc3QgX2RlcGxveW1lbnRzX2VuZHBvaW50cyA9IG5ldyBTZXQoW1xuICAgICcvY29tcGxldGlvbnMnLFxuICAgICcvY2hhdC9jb21wbGV0aW9ucycsXG4gICAgJy9lbWJlZGRpbmdzJyxcbiAgICAnL2F1ZGlvL3RyYW5zY3JpcHRpb25zJyxcbiAgICAnL2F1ZGlvL3RyYW5zbGF0aW9ucycsXG4gICAgJy9hdWRpby9zcGVlY2gnLFxuICAgICcvaW1hZ2VzL2dlbmVyYXRpb25zJyxcbl0pO1xuY29uc3QgQVBJX0tFWV9TRU5USU5FTCA9ICc8TWlzc2luZyBLZXk+JztcbmV4cG9ydCB7IHRvRmlsZSwgZmlsZUZyb21QYXRoIH0gZnJvbSBcIi4vdXBsb2Fkcy5tanNcIjtcbmV4cG9ydCB7IE9wZW5BSUVycm9yLCBBUElFcnJvciwgQVBJQ29ubmVjdGlvbkVycm9yLCBBUElDb25uZWN0aW9uVGltZW91dEVycm9yLCBBUElVc2VyQWJvcnRFcnJvciwgTm90Rm91bmRFcnJvciwgQ29uZmxpY3RFcnJvciwgUmF0ZUxpbWl0RXJyb3IsIEJhZFJlcXVlc3RFcnJvciwgQXV0aGVudGljYXRpb25FcnJvciwgSW50ZXJuYWxTZXJ2ZXJFcnJvciwgUGVybWlzc2lvbkRlbmllZEVycm9yLCBVbnByb2Nlc3NhYmxlRW50aXR5RXJyb3IsIH0gZnJvbSBcIi4vZXJyb3IubWpzXCI7XG5leHBvcnQgZGVmYXVsdCBPcGVuQUk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5tanMubWFwIiwidmFyIF9fY2xhc3NQcml2YXRlRmllbGRTZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRTZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xufTtcbnZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XG59O1xudmFyIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4O1xuaW1wb3J0IHsgT3BlbkFJRXJyb3IgfSBmcm9tIFwiLi4vLi4vZXJyb3IubWpzXCI7XG4vKipcbiAqIEEgcmUtaW1wbGVtZW50YXRpb24gb2YgaHR0cHgncyBgTGluZURlY29kZXJgIGluIFB5dGhvbiB0aGF0IGhhbmRsZXMgaW5jcmVtZW50YWxseVxuICogcmVhZGluZyBsaW5lcyBmcm9tIHRleHQuXG4gKlxuICogaHR0cHM6Ly9naXRodWIuY29tL2VuY29kZS9odHRweC9ibG9iLzkyMDMzM2VhOTgxMThlOWNmNjE3ZjI0NjkwNWQ3YjIwMjUxMDk0MWMvaHR0cHgvX2RlY29kZXJzLnB5I0wyNThcbiAqL1xuZXhwb3J0IGNsYXNzIExpbmVEZWNvZGVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXguc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIHRoaXMuYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgbnVsbCwgXCJmXCIpO1xuICAgIH1cbiAgICBkZWNvZGUoY2h1bmspIHtcbiAgICAgICAgaWYgKGNodW5rID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBiaW5hcnlDaHVuayA9IGNodW5rIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgPyBuZXcgVWludDhBcnJheShjaHVuaylcbiAgICAgICAgICAgIDogdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJyA/IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShjaHVuaylcbiAgICAgICAgICAgICAgICA6IGNodW5rO1xuICAgICAgICBsZXQgbmV3RGF0YSA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmxlbmd0aCArIGJpbmFyeUNodW5rLmxlbmd0aCk7XG4gICAgICAgIG5ld0RhdGEuc2V0KHRoaXMuYnVmZmVyKTtcbiAgICAgICAgbmV3RGF0YS5zZXQoYmluYXJ5Q2h1bmssIHRoaXMuYnVmZmVyLmxlbmd0aCk7XG4gICAgICAgIHRoaXMuYnVmZmVyID0gbmV3RGF0YTtcbiAgICAgICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICAgICAgbGV0IHBhdHRlcm5JbmRleDtcbiAgICAgICAgd2hpbGUgKChwYXR0ZXJuSW5kZXggPSBmaW5kTmV3bGluZUluZGV4KHRoaXMuYnVmZmVyLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikpKSAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAocGF0dGVybkluZGV4LmNhcnJpYWdlICYmIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gc2tpcCB1bnRpbCB3ZSBlaXRoZXIgZ2V0IGEgY29ycmVzcG9uZGluZyBgXFxuYCwgYSBuZXcgYFxccmAgb3Igbm90aGluZ1xuICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIHBhdHRlcm5JbmRleC5pbmRleCwgXCJmXCIpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gd2UgZ290IGRvdWJsZSBcXHIgb3IgXFxydGV4dFxcblxuICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSAhPSBudWxsICYmXG4gICAgICAgICAgICAgICAgKHBhdHRlcm5JbmRleC5pbmRleCAhPT0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpICsgMSB8fCBwYXR0ZXJuSW5kZXguY2FycmlhZ2UpKSB7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaCh0aGlzLmRlY29kZVRleHQodGhpcy5idWZmZXIuc2xpY2UoMCwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgXCJmXCIpIC0gMSkpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1ZmZlciA9IHRoaXMuYnVmZmVyLnNsaWNlKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0xpbmVEZWNvZGVyX2NhcnJpYWdlUmV0dXJuSW5kZXgsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgbnVsbCwgXCJmXCIpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZW5kSW5kZXggPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9MaW5lRGVjb2Rlcl9jYXJyaWFnZVJldHVybkluZGV4LCBcImZcIikgIT09IG51bGwgPyBwYXR0ZXJuSW5kZXgucHJlY2VkaW5nIC0gMSA6IHBhdHRlcm5JbmRleC5wcmVjZWRpbmc7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gdGhpcy5kZWNvZGVUZXh0KHRoaXMuYnVmZmVyLnNsaWNlKDAsIGVuZEluZGV4KSk7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGxpbmUpO1xuICAgICAgICAgICAgdGhpcy5idWZmZXIgPSB0aGlzLmJ1ZmZlci5zbGljZShwYXR0ZXJuSW5kZXguaW5kZXgpO1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCwgbnVsbCwgXCJmXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaW5lcztcbiAgICB9XG4gICAgZGVjb2RlVGV4dChieXRlcykge1xuICAgICAgICBpZiAoYnl0ZXMgPT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgaWYgKHR5cGVvZiBieXRlcyA9PT0gJ3N0cmluZycpXG4gICAgICAgICAgICByZXR1cm4gYnl0ZXM7XG4gICAgICAgIC8vIE5vZGU6XG4gICAgICAgIGlmICh0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGJ5dGVzIGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ5dGVzLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYnl0ZXMgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGJ5dGVzKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBVbmV4cGVjdGVkOiByZWNlaXZlZCBub24tVWludDhBcnJheSAoJHtieXRlcy5jb25zdHJ1Y3Rvci5uYW1lfSkgc3RyZWFtIGNodW5rIGluIGFuIGVudmlyb25tZW50IHdpdGggYSBnbG9iYWwgXCJCdWZmZXJcIiBkZWZpbmVkLCB3aGljaCB0aGlzIGxpYnJhcnkgYXNzdW1lcyB0byBiZSBOb2RlLiBQbGVhc2UgcmVwb3J0IHRoaXMgZXJyb3IuYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQnJvd3NlclxuICAgICAgICBpZiAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGJ5dGVzIGluc3RhbmNlb2YgVWludDhBcnJheSB8fCBieXRlcyBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlciA/PyAodGhpcy50ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigndXRmOCcpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50ZXh0RGVjb2Rlci5kZWNvZGUoYnl0ZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBVbmV4cGVjdGVkOiByZWNlaXZlZCBub24tVWludDhBcnJheS9BcnJheUJ1ZmZlciAoJHtieXRlcy5jb25zdHJ1Y3Rvci5uYW1lfSkgaW4gYSB3ZWIgcGxhdGZvcm0uIFBsZWFzZSByZXBvcnQgdGhpcyBlcnJvci5gKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYFVuZXhwZWN0ZWQ6IG5laXRoZXIgQnVmZmVyIG5vciBUZXh0RGVjb2RlciBhcmUgYXZhaWxhYmxlIGFzIGdsb2JhbHMuIFBsZWFzZSByZXBvcnQgdGhpcyBlcnJvci5gKTtcbiAgICB9XG4gICAgZmx1c2goKSB7XG4gICAgICAgIGlmICghdGhpcy5idWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZGVjb2RlKCdcXG4nKTtcbiAgICB9XG59XG5fTGluZURlY29kZXJfY2FycmlhZ2VSZXR1cm5JbmRleCA9IG5ldyBXZWFrTWFwKCk7XG4vLyBwcmV0dGllci1pZ25vcmVcbkxpbmVEZWNvZGVyLk5FV0xJTkVfQ0hBUlMgPSBuZXcgU2V0KFsnXFxuJywgJ1xcciddKTtcbkxpbmVEZWNvZGVyLk5FV0xJTkVfUkVHRVhQID0gL1xcclxcbnxbXFxuXFxyXS9nO1xuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNlYXJjaGVzIHRoZSBidWZmZXIgZm9yIHRoZSBlbmQgcGF0dGVybnMsIChcXHIgb3IgXFxuKVxuICogYW5kIHJldHVybnMgYW4gb2JqZWN0IHdpdGggdGhlIGluZGV4IHByZWNlZGluZyB0aGUgbWF0Y2hlZCBuZXdsaW5lIGFuZCB0aGVcbiAqIGluZGV4IGFmdGVyIHRoZSBuZXdsaW5lIGNoYXIuIGBudWxsYCBpcyByZXR1cm5lZCBpZiBubyBuZXcgbGluZSBpcyBmb3VuZC5cbiAqXG4gKiBgYGB0c1xuICogZmluZE5ld0xpbmVJbmRleCgnYWJjXFxuZGVmJykgLT4geyBwcmVjZWRpbmc6IDIsIGluZGV4OiAzIH1cbiAqIGBgYFxuICovXG5mdW5jdGlvbiBmaW5kTmV3bGluZUluZGV4KGJ1ZmZlciwgc3RhcnRJbmRleCkge1xuICAgIGNvbnN0IG5ld2xpbmUgPSAweDBhOyAvLyBcXG5cbiAgICBjb25zdCBjYXJyaWFnZSA9IDB4MGQ7IC8vIFxcclxuICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4ID8/IDA7IGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGJ1ZmZlcltpXSA9PT0gbmV3bGluZSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgcHJlY2VkaW5nOiBpLCBpbmRleDogaSArIDEsIGNhcnJpYWdlOiBmYWxzZSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChidWZmZXJbaV0gPT09IGNhcnJpYWdlKSB7XG4gICAgICAgICAgICByZXR1cm4geyBwcmVjZWRpbmc6IGksIGluZGV4OiBpICsgMSwgY2FycmlhZ2U6IHRydWUgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWxpbmUubWpzLm1hcCIsImV4cG9ydCBjb25zdCBkZWZhdWx0X2Zvcm1hdCA9ICdSRkMzOTg2JztcbmV4cG9ydCBjb25zdCBmb3JtYXR0ZXJzID0ge1xuICAgIFJGQzE3Mzg6ICh2KSA9PiBTdHJpbmcodikucmVwbGFjZSgvJTIwL2csICcrJyksXG4gICAgUkZDMzk4NjogKHYpID0+IFN0cmluZyh2KSxcbn07XG5leHBvcnQgY29uc3QgUkZDMTczOCA9ICdSRkMxNzM4JztcbmV4cG9ydCBjb25zdCBSRkMzOTg2ID0gJ1JGQzM5ODYnO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Zm9ybWF0cy5tanMubWFwIiwiaW1wb3J0IHsgZW5jb2RlLCBpc19idWZmZXIsIG1heWJlX21hcCB9IGZyb20gXCIuL3V0aWxzLm1qc1wiO1xuaW1wb3J0IHsgZGVmYXVsdF9mb3JtYXQsIGZvcm1hdHRlcnMgfSBmcm9tIFwiLi9mb3JtYXRzLm1qc1wiO1xuY29uc3QgaGFzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbmNvbnN0IGFycmF5X3ByZWZpeF9nZW5lcmF0b3JzID0ge1xuICAgIGJyYWNrZXRzKHByZWZpeCkge1xuICAgICAgICByZXR1cm4gU3RyaW5nKHByZWZpeCkgKyAnW10nO1xuICAgIH0sXG4gICAgY29tbWE6ICdjb21tYScsXG4gICAgaW5kaWNlcyhwcmVmaXgsIGtleSkge1xuICAgICAgICByZXR1cm4gU3RyaW5nKHByZWZpeCkgKyAnWycgKyBrZXkgKyAnXSc7XG4gICAgfSxcbiAgICByZXBlYXQocHJlZml4KSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcocHJlZml4KTtcbiAgICB9LFxufTtcbmNvbnN0IGlzX2FycmF5ID0gQXJyYXkuaXNBcnJheTtcbmNvbnN0IHB1c2ggPSBBcnJheS5wcm90b3R5cGUucHVzaDtcbmNvbnN0IHB1c2hfdG9fYXJyYXkgPSBmdW5jdGlvbiAoYXJyLCB2YWx1ZV9vcl9hcnJheSkge1xuICAgIHB1c2guYXBwbHkoYXJyLCBpc19hcnJheSh2YWx1ZV9vcl9hcnJheSkgPyB2YWx1ZV9vcl9hcnJheSA6IFt2YWx1ZV9vcl9hcnJheV0pO1xufTtcbmNvbnN0IHRvX0lTTyA9IERhdGUucHJvdG90eXBlLnRvSVNPU3RyaW5nO1xuY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgYWRkUXVlcnlQcmVmaXg6IGZhbHNlLFxuICAgIGFsbG93RG90czogZmFsc2UsXG4gICAgYWxsb3dFbXB0eUFycmF5czogZmFsc2UsXG4gICAgYXJyYXlGb3JtYXQ6ICdpbmRpY2VzJyxcbiAgICBjaGFyc2V0OiAndXRmLTgnLFxuICAgIGNoYXJzZXRTZW50aW5lbDogZmFsc2UsXG4gICAgZGVsaW1pdGVyOiAnJicsXG4gICAgZW5jb2RlOiB0cnVlLFxuICAgIGVuY29kZURvdEluS2V5czogZmFsc2UsXG4gICAgZW5jb2RlcjogZW5jb2RlLFxuICAgIGVuY29kZVZhbHVlc09ubHk6IGZhbHNlLFxuICAgIGZvcm1hdDogZGVmYXVsdF9mb3JtYXQsXG4gICAgZm9ybWF0dGVyOiBmb3JtYXR0ZXJzW2RlZmF1bHRfZm9ybWF0XSxcbiAgICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgICBpbmRpY2VzOiBmYWxzZSxcbiAgICBzZXJpYWxpemVEYXRlKGRhdGUpIHtcbiAgICAgICAgcmV0dXJuIHRvX0lTTy5jYWxsKGRhdGUpO1xuICAgIH0sXG4gICAgc2tpcE51bGxzOiBmYWxzZSxcbiAgICBzdHJpY3ROdWxsSGFuZGxpbmc6IGZhbHNlLFxufTtcbmZ1bmN0aW9uIGlzX25vbl9udWxsaXNoX3ByaW1pdGl2ZSh2KSB7XG4gICAgcmV0dXJuICh0eXBlb2YgdiA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgdHlwZW9mIHYgPT09ICdudW1iZXInIHx8XG4gICAgICAgIHR5cGVvZiB2ID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgdHlwZW9mIHYgPT09ICdzeW1ib2wnIHx8XG4gICAgICAgIHR5cGVvZiB2ID09PSAnYmlnaW50Jyk7XG59XG5jb25zdCBzZW50aW5lbCA9IHt9O1xuZnVuY3Rpb24gaW5uZXJfc3RyaW5naWZ5KG9iamVjdCwgcHJlZml4LCBnZW5lcmF0ZUFycmF5UHJlZml4LCBjb21tYVJvdW5kVHJpcCwgYWxsb3dFbXB0eUFycmF5cywgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZURvdEluS2V5cywgZW5jb2RlciwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMsIHNlcmlhbGl6ZURhdGUsIGZvcm1hdCwgZm9ybWF0dGVyLCBlbmNvZGVWYWx1ZXNPbmx5LCBjaGFyc2V0LCBzaWRlQ2hhbm5lbCkge1xuICAgIGxldCBvYmogPSBvYmplY3Q7XG4gICAgbGV0IHRtcF9zYyA9IHNpZGVDaGFubmVsO1xuICAgIGxldCBzdGVwID0gMDtcbiAgICBsZXQgZmluZF9mbGFnID0gZmFsc2U7XG4gICAgd2hpbGUgKCh0bXBfc2MgPSB0bXBfc2MuZ2V0KHNlbnRpbmVsKSkgIT09IHZvaWQgdW5kZWZpbmVkICYmICFmaW5kX2ZsYWcpIHtcbiAgICAgICAgLy8gV2hlcmUgb2JqZWN0IGxhc3QgYXBwZWFyZWQgaW4gdGhlIHJlZiB0cmVlXG4gICAgICAgIGNvbnN0IHBvcyA9IHRtcF9zYy5nZXQob2JqZWN0KTtcbiAgICAgICAgc3RlcCArPSAxO1xuICAgICAgICBpZiAodHlwZW9mIHBvcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChwb3MgPT09IHN0ZXApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQ3ljbGljIG9iamVjdCB2YWx1ZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZmluZF9mbGFnID0gdHJ1ZTsgLy8gQnJlYWsgd2hpbGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHRtcF9zYy5nZXQoc2VudGluZWwpID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc3RlcCA9IDA7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgb2JqID0gZmlsdGVyKHByZWZpeCwgb2JqKTtcbiAgICB9XG4gICAgZWxzZSBpZiAob2JqIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICBvYmogPSBzZXJpYWxpemVEYXRlPy4ob2JqKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoZ2VuZXJhdGVBcnJheVByZWZpeCA9PT0gJ2NvbW1hJyAmJiBpc19hcnJheShvYmopKSB7XG4gICAgICAgIG9iaiA9IG1heWJlX21hcChvYmosIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXJpYWxpemVEYXRlPy4odmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoc3RyaWN0TnVsbEhhbmRsaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gZW5jb2RlciAmJiAhZW5jb2RlVmFsdWVzT25seSA/XG4gICAgICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICAgICAgICAgIGVuY29kZXIocHJlZml4LCBkZWZhdWx0cy5lbmNvZGVyLCBjaGFyc2V0LCAna2V5JywgZm9ybWF0KVxuICAgICAgICAgICAgICAgIDogcHJlZml4O1xuICAgICAgICB9XG4gICAgICAgIG9iaiA9ICcnO1xuICAgIH1cbiAgICBpZiAoaXNfbm9uX251bGxpc2hfcHJpbWl0aXZlKG9iaikgfHwgaXNfYnVmZmVyKG9iaikpIHtcbiAgICAgICAgaWYgKGVuY29kZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGtleV92YWx1ZSA9IGVuY29kZVZhbHVlc09ubHkgPyBwcmVmaXhcbiAgICAgICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgICAgICAgICAgOiBlbmNvZGVyKHByZWZpeCwgZGVmYXVsdHMuZW5jb2RlciwgY2hhcnNldCwgJ2tleScsIGZvcm1hdCk7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIGZvcm1hdHRlcj8uKGtleV92YWx1ZSkgK1xuICAgICAgICAgICAgICAgICAgICAnPScgK1xuICAgICAgICAgICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdHRlcj8uKGVuY29kZXIob2JqLCBkZWZhdWx0cy5lbmNvZGVyLCBjaGFyc2V0LCAndmFsdWUnLCBmb3JtYXQpKSxcbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtmb3JtYXR0ZXI/LihwcmVmaXgpICsgJz0nICsgZm9ybWF0dGVyPy4oU3RyaW5nKG9iaikpXTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWVzID0gW107XG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgfVxuICAgIGxldCBvYmpfa2V5cztcbiAgICBpZiAoZ2VuZXJhdGVBcnJheVByZWZpeCA9PT0gJ2NvbW1hJyAmJiBpc19hcnJheShvYmopKSB7XG4gICAgICAgIC8vIHdlIG5lZWQgdG8gam9pbiBlbGVtZW50cyBpblxuICAgICAgICBpZiAoZW5jb2RlVmFsdWVzT25seSAmJiBlbmNvZGVyKSB7XG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIHZhbHVlcyBvbmx5XG4gICAgICAgICAgICBvYmogPSBtYXliZV9tYXAob2JqLCBlbmNvZGVyKTtcbiAgICAgICAgfVxuICAgICAgICBvYmpfa2V5cyA9IFt7IHZhbHVlOiBvYmoubGVuZ3RoID4gMCA/IG9iai5qb2luKCcsJykgfHwgbnVsbCA6IHZvaWQgdW5kZWZpbmVkIH1dO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc19hcnJheShmaWx0ZXIpKSB7XG4gICAgICAgIG9ial9rZXlzID0gZmlsdGVyO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgICAgIG9ial9rZXlzID0gc29ydCA/IGtleXMuc29ydChzb3J0KSA6IGtleXM7XG4gICAgfVxuICAgIGNvbnN0IGVuY29kZWRfcHJlZml4ID0gZW5jb2RlRG90SW5LZXlzID8gU3RyaW5nKHByZWZpeCkucmVwbGFjZSgvXFwuL2csICclMkUnKSA6IFN0cmluZyhwcmVmaXgpO1xuICAgIGNvbnN0IGFkanVzdGVkX3ByZWZpeCA9IGNvbW1hUm91bmRUcmlwICYmIGlzX2FycmF5KG9iaikgJiYgb2JqLmxlbmd0aCA9PT0gMSA/IGVuY29kZWRfcHJlZml4ICsgJ1tdJyA6IGVuY29kZWRfcHJlZml4O1xuICAgIGlmIChhbGxvd0VtcHR5QXJyYXlzICYmIGlzX2FycmF5KG9iaikgJiYgb2JqLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gYWRqdXN0ZWRfcHJlZml4ICsgJ1tdJztcbiAgICB9XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBvYmpfa2V5cy5sZW5ndGg7ICsraikge1xuICAgICAgICBjb25zdCBrZXkgPSBvYmpfa2V5c1tqXTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JyAmJiB0eXBlb2Yga2V5LnZhbHVlICE9PSAndW5kZWZpbmVkJyA/IGtleS52YWx1ZSA6IG9ialtrZXldO1xuICAgICAgICBpZiAoc2tpcE51bGxzICYmIHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNvbnN0IGVuY29kZWRfa2V5ID0gYWxsb3dEb3RzICYmIGVuY29kZURvdEluS2V5cyA/IGtleS5yZXBsYWNlKC9cXC4vZywgJyUyRScpIDoga2V5O1xuICAgICAgICBjb25zdCBrZXlfcHJlZml4ID0gaXNfYXJyYXkob2JqKSA/XG4gICAgICAgICAgICB0eXBlb2YgZ2VuZXJhdGVBcnJheVByZWZpeCA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAgICAgZ2VuZXJhdGVBcnJheVByZWZpeChhZGp1c3RlZF9wcmVmaXgsIGVuY29kZWRfa2V5KVxuICAgICAgICAgICAgICAgIDogYWRqdXN0ZWRfcHJlZml4XG4gICAgICAgICAgICA6IGFkanVzdGVkX3ByZWZpeCArIChhbGxvd0RvdHMgPyAnLicgKyBlbmNvZGVkX2tleSA6ICdbJyArIGVuY29kZWRfa2V5ICsgJ10nKTtcbiAgICAgICAgc2lkZUNoYW5uZWwuc2V0KG9iamVjdCwgc3RlcCk7XG4gICAgICAgIGNvbnN0IHZhbHVlU2lkZUNoYW5uZWwgPSBuZXcgV2Vha01hcCgpO1xuICAgICAgICB2YWx1ZVNpZGVDaGFubmVsLnNldChzZW50aW5lbCwgc2lkZUNoYW5uZWwpO1xuICAgICAgICBwdXNoX3RvX2FycmF5KHZhbHVlcywgaW5uZXJfc3RyaW5naWZ5KHZhbHVlLCBrZXlfcHJlZml4LCBnZW5lcmF0ZUFycmF5UHJlZml4LCBjb21tYVJvdW5kVHJpcCwgYWxsb3dFbXB0eUFycmF5cywgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZURvdEluS2V5cywgXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgZ2VuZXJhdGVBcnJheVByZWZpeCA9PT0gJ2NvbW1hJyAmJiBlbmNvZGVWYWx1ZXNPbmx5ICYmIGlzX2FycmF5KG9iaikgPyBudWxsIDogZW5jb2RlciwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMsIHNlcmlhbGl6ZURhdGUsIGZvcm1hdCwgZm9ybWF0dGVyLCBlbmNvZGVWYWx1ZXNPbmx5LCBjaGFyc2V0LCB2YWx1ZVNpZGVDaGFubmVsKSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG59XG5mdW5jdGlvbiBub3JtYWxpemVfc3RyaW5naWZ5X29wdGlvbnMob3B0cyA9IGRlZmF1bHRzKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzLmFsbG93RW1wdHlBcnJheXMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBvcHRzLmFsbG93RW1wdHlBcnJheXMgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdgYWxsb3dFbXB0eUFycmF5c2Agb3B0aW9uIGNhbiBvbmx5IGJlIGB0cnVlYCBvciBgZmFsc2VgLCB3aGVuIHByb3ZpZGVkJyk7XG4gICAgfVxuICAgIGlmICh0eXBlb2Ygb3B0cy5lbmNvZGVEb3RJbktleXMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBvcHRzLmVuY29kZURvdEluS2V5cyAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2BlbmNvZGVEb3RJbktleXNgIG9wdGlvbiBjYW4gb25seSBiZSBgdHJ1ZWAgb3IgYGZhbHNlYCwgd2hlbiBwcm92aWRlZCcpO1xuICAgIH1cbiAgICBpZiAob3B0cy5lbmNvZGVyICE9PSBudWxsICYmIHR5cGVvZiBvcHRzLmVuY29kZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBvcHRzLmVuY29kZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRW5jb2RlciBoYXMgdG8gYmUgYSBmdW5jdGlvbi4nKTtcbiAgICB9XG4gICAgY29uc3QgY2hhcnNldCA9IG9wdHMuY2hhcnNldCB8fCBkZWZhdWx0cy5jaGFyc2V0O1xuICAgIGlmICh0eXBlb2Ygb3B0cy5jaGFyc2V0ICE9PSAndW5kZWZpbmVkJyAmJiBvcHRzLmNoYXJzZXQgIT09ICd1dGYtOCcgJiYgb3B0cy5jaGFyc2V0ICE9PSAnaXNvLTg4NTktMScpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGNoYXJzZXQgb3B0aW9uIG11c3QgYmUgZWl0aGVyIHV0Zi04LCBpc28tODg1OS0xLCBvciB1bmRlZmluZWQnKTtcbiAgICB9XG4gICAgbGV0IGZvcm1hdCA9IGRlZmF1bHRfZm9ybWF0O1xuICAgIGlmICh0eXBlb2Ygb3B0cy5mb3JtYXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmICghaGFzLmNhbGwoZm9ybWF0dGVycywgb3B0cy5mb3JtYXQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGZvcm1hdCBvcHRpb24gcHJvdmlkZWQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZm9ybWF0ID0gb3B0cy5mb3JtYXQ7XG4gICAgfVxuICAgIGNvbnN0IGZvcm1hdHRlciA9IGZvcm1hdHRlcnNbZm9ybWF0XTtcbiAgICBsZXQgZmlsdGVyID0gZGVmYXVsdHMuZmlsdGVyO1xuICAgIGlmICh0eXBlb2Ygb3B0cy5maWx0ZXIgPT09ICdmdW5jdGlvbicgfHwgaXNfYXJyYXkob3B0cy5maWx0ZXIpKSB7XG4gICAgICAgIGZpbHRlciA9IG9wdHMuZmlsdGVyO1xuICAgIH1cbiAgICBsZXQgYXJyYXlGb3JtYXQ7XG4gICAgaWYgKG9wdHMuYXJyYXlGb3JtYXQgJiYgb3B0cy5hcnJheUZvcm1hdCBpbiBhcnJheV9wcmVmaXhfZ2VuZXJhdG9ycykge1xuICAgICAgICBhcnJheUZvcm1hdCA9IG9wdHMuYXJyYXlGb3JtYXQ7XG4gICAgfVxuICAgIGVsc2UgaWYgKCdpbmRpY2VzJyBpbiBvcHRzKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0cy5pbmRpY2VzID8gJ2luZGljZXMnIDogJ3JlcGVhdCc7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBhcnJheUZvcm1hdCA9IGRlZmF1bHRzLmFycmF5Rm9ybWF0O1xuICAgIH1cbiAgICBpZiAoJ2NvbW1hUm91bmRUcmlwJyBpbiBvcHRzICYmIHR5cGVvZiBvcHRzLmNvbW1hUm91bmRUcmlwICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGNvbW1hUm91bmRUcmlwYCBtdXN0IGJlIGEgYm9vbGVhbiwgb3IgYWJzZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGFsbG93RG90cyA9IHR5cGVvZiBvcHRzLmFsbG93RG90cyA9PT0gJ3VuZGVmaW5lZCcgP1xuICAgICAgICAhIW9wdHMuZW5jb2RlRG90SW5LZXlzID09PSB0cnVlID9cbiAgICAgICAgICAgIHRydWVcbiAgICAgICAgICAgIDogZGVmYXVsdHMuYWxsb3dEb3RzXG4gICAgICAgIDogISFvcHRzLmFsbG93RG90cztcbiAgICByZXR1cm4ge1xuICAgICAgICBhZGRRdWVyeVByZWZpeDogdHlwZW9mIG9wdHMuYWRkUXVlcnlQcmVmaXggPT09ICdib29sZWFuJyA/IG9wdHMuYWRkUXVlcnlQcmVmaXggOiBkZWZhdWx0cy5hZGRRdWVyeVByZWZpeCxcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBhbGxvd0RvdHM6IGFsbG93RG90cyxcbiAgICAgICAgYWxsb3dFbXB0eUFycmF5czogdHlwZW9mIG9wdHMuYWxsb3dFbXB0eUFycmF5cyA9PT0gJ2Jvb2xlYW4nID8gISFvcHRzLmFsbG93RW1wdHlBcnJheXMgOiBkZWZhdWx0cy5hbGxvd0VtcHR5QXJyYXlzLFxuICAgICAgICBhcnJheUZvcm1hdDogYXJyYXlGb3JtYXQsXG4gICAgICAgIGNoYXJzZXQ6IGNoYXJzZXQsXG4gICAgICAgIGNoYXJzZXRTZW50aW5lbDogdHlwZW9mIG9wdHMuY2hhcnNldFNlbnRpbmVsID09PSAnYm9vbGVhbicgPyBvcHRzLmNoYXJzZXRTZW50aW5lbCA6IGRlZmF1bHRzLmNoYXJzZXRTZW50aW5lbCxcbiAgICAgICAgY29tbWFSb3VuZFRyaXA6ICEhb3B0cy5jb21tYVJvdW5kVHJpcCxcbiAgICAgICAgZGVsaW1pdGVyOiB0eXBlb2Ygb3B0cy5kZWxpbWl0ZXIgPT09ICd1bmRlZmluZWQnID8gZGVmYXVsdHMuZGVsaW1pdGVyIDogb3B0cy5kZWxpbWl0ZXIsXG4gICAgICAgIGVuY29kZTogdHlwZW9mIG9wdHMuZW5jb2RlID09PSAnYm9vbGVhbicgPyBvcHRzLmVuY29kZSA6IGRlZmF1bHRzLmVuY29kZSxcbiAgICAgICAgZW5jb2RlRG90SW5LZXlzOiB0eXBlb2Ygb3B0cy5lbmNvZGVEb3RJbktleXMgPT09ICdib29sZWFuJyA/IG9wdHMuZW5jb2RlRG90SW5LZXlzIDogZGVmYXVsdHMuZW5jb2RlRG90SW5LZXlzLFxuICAgICAgICBlbmNvZGVyOiB0eXBlb2Ygb3B0cy5lbmNvZGVyID09PSAnZnVuY3Rpb24nID8gb3B0cy5lbmNvZGVyIDogZGVmYXVsdHMuZW5jb2RlcixcbiAgICAgICAgZW5jb2RlVmFsdWVzT25seTogdHlwZW9mIG9wdHMuZW5jb2RlVmFsdWVzT25seSA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5lbmNvZGVWYWx1ZXNPbmx5IDogZGVmYXVsdHMuZW5jb2RlVmFsdWVzT25seSxcbiAgICAgICAgZmlsdGVyOiBmaWx0ZXIsXG4gICAgICAgIGZvcm1hdDogZm9ybWF0LFxuICAgICAgICBmb3JtYXR0ZXI6IGZvcm1hdHRlcixcbiAgICAgICAgc2VyaWFsaXplRGF0ZTogdHlwZW9mIG9wdHMuc2VyaWFsaXplRGF0ZSA9PT0gJ2Z1bmN0aW9uJyA/IG9wdHMuc2VyaWFsaXplRGF0ZSA6IGRlZmF1bHRzLnNlcmlhbGl6ZURhdGUsXG4gICAgICAgIHNraXBOdWxsczogdHlwZW9mIG9wdHMuc2tpcE51bGxzID09PSAnYm9vbGVhbicgPyBvcHRzLnNraXBOdWxscyA6IGRlZmF1bHRzLnNraXBOdWxscyxcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBzb3J0OiB0eXBlb2Ygb3B0cy5zb3J0ID09PSAnZnVuY3Rpb24nID8gb3B0cy5zb3J0IDogbnVsbCxcbiAgICAgICAgc3RyaWN0TnVsbEhhbmRsaW5nOiB0eXBlb2Ygb3B0cy5zdHJpY3ROdWxsSGFuZGxpbmcgPT09ICdib29sZWFuJyA/IG9wdHMuc3RyaWN0TnVsbEhhbmRsaW5nIDogZGVmYXVsdHMuc3RyaWN0TnVsbEhhbmRsaW5nLFxuICAgIH07XG59XG5leHBvcnQgZnVuY3Rpb24gc3RyaW5naWZ5KG9iamVjdCwgb3B0cyA9IHt9KSB7XG4gICAgbGV0IG9iaiA9IG9iamVjdDtcbiAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplX3N0cmluZ2lmeV9vcHRpb25zKG9wdHMpO1xuICAgIGxldCBvYmpfa2V5cztcbiAgICBsZXQgZmlsdGVyO1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgICAgIG9iaiA9IGZpbHRlcignJywgb2JqKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNfYXJyYXkob3B0aW9ucy5maWx0ZXIpKSB7XG4gICAgICAgIGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgICAgICBvYmpfa2V5cyA9IGZpbHRlcjtcbiAgICB9XG4gICAgY29uc3Qga2V5cyA9IFtdO1xuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICBjb25zdCBnZW5lcmF0ZUFycmF5UHJlZml4ID0gYXJyYXlfcHJlZml4X2dlbmVyYXRvcnNbb3B0aW9ucy5hcnJheUZvcm1hdF07XG4gICAgY29uc3QgY29tbWFSb3VuZFRyaXAgPSBnZW5lcmF0ZUFycmF5UHJlZml4ID09PSAnY29tbWEnICYmIG9wdGlvbnMuY29tbWFSb3VuZFRyaXA7XG4gICAgaWYgKCFvYmpfa2V5cykge1xuICAgICAgICBvYmpfa2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnNvcnQpIHtcbiAgICAgICAgb2JqX2tleXMuc29ydChvcHRpb25zLnNvcnQpO1xuICAgIH1cbiAgICBjb25zdCBzaWRlQ2hhbm5lbCA9IG5ldyBXZWFrTWFwKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvYmpfa2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBrZXkgPSBvYmpfa2V5c1tpXTtcbiAgICAgICAgaWYgKG9wdGlvbnMuc2tpcE51bGxzICYmIG9ialtrZXldID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBwdXNoX3RvX2FycmF5KGtleXMsIGlubmVyX3N0cmluZ2lmeShvYmpba2V5XSwga2V5LCBcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICBnZW5lcmF0ZUFycmF5UHJlZml4LCBjb21tYVJvdW5kVHJpcCwgb3B0aW9ucy5hbGxvd0VtcHR5QXJyYXlzLCBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZywgb3B0aW9ucy5za2lwTnVsbHMsIG9wdGlvbnMuZW5jb2RlRG90SW5LZXlzLCBvcHRpb25zLmVuY29kZSA/IG9wdGlvbnMuZW5jb2RlciA6IG51bGwsIG9wdGlvbnMuZmlsdGVyLCBvcHRpb25zLnNvcnQsIG9wdGlvbnMuYWxsb3dEb3RzLCBvcHRpb25zLnNlcmlhbGl6ZURhdGUsIG9wdGlvbnMuZm9ybWF0LCBvcHRpb25zLmZvcm1hdHRlciwgb3B0aW9ucy5lbmNvZGVWYWx1ZXNPbmx5LCBvcHRpb25zLmNoYXJzZXQsIHNpZGVDaGFubmVsKSk7XG4gICAgfVxuICAgIGNvbnN0IGpvaW5lZCA9IGtleXMuam9pbihvcHRpb25zLmRlbGltaXRlcik7XG4gICAgbGV0IHByZWZpeCA9IG9wdGlvbnMuYWRkUXVlcnlQcmVmaXggPT09IHRydWUgPyAnPycgOiAnJztcbiAgICBpZiAob3B0aW9ucy5jaGFyc2V0U2VudGluZWwpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuY2hhcnNldCA9PT0gJ2lzby04ODU5LTEnKSB7XG4gICAgICAgICAgICAvLyBlbmNvZGVVUklDb21wb25lbnQoJyYjMTAwMDM7JyksIHRoZSBcIm51bWVyaWMgZW50aXR5XCIgcmVwcmVzZW50YXRpb24gb2YgYSBjaGVja21hcmtcbiAgICAgICAgICAgIHByZWZpeCArPSAndXRmOD0lMjYlMjMxMDAwMyUzQiYnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gZW5jb2RlVVJJQ29tcG9uZW50KCfinJMnKVxuICAgICAgICAgICAgcHJlZml4ICs9ICd1dGY4PSVFMiU5QyU5MyYnO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBqb2luZWQubGVuZ3RoID4gMCA/IHByZWZpeCArIGpvaW5lZCA6ICcnO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3RyaW5naWZ5Lm1qcy5tYXAiLCJpbXBvcnQgeyBSRkMxNzM4IH0gZnJvbSBcIi4vZm9ybWF0cy5tanNcIjtcbmNvbnN0IGhhcyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5jb25zdCBpc19hcnJheSA9IEFycmF5LmlzQXJyYXk7XG5jb25zdCBoZXhfdGFibGUgPSAoKCkgPT4ge1xuICAgIGNvbnN0IGFycmF5ID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyNTY7ICsraSkge1xuICAgICAgICBhcnJheS5wdXNoKCclJyArICgoaSA8IDE2ID8gJzAnIDogJycpICsgaS50b1N0cmluZygxNikpLnRvVXBwZXJDYXNlKCkpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG59KSgpO1xuZnVuY3Rpb24gY29tcGFjdF9xdWV1ZShxdWV1ZSkge1xuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZS5wb3AoKTtcbiAgICAgICAgaWYgKCFpdGVtKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIGNvbnN0IG9iaiA9IGl0ZW0ub2JqW2l0ZW0ucHJvcF07XG4gICAgICAgIGlmIChpc19hcnJheShvYmopKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wYWN0ZWQgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgb2JqLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmpbal0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBhY3RlZC5wdXNoKG9ialtqXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgaXRlbS5vYmpbaXRlbS5wcm9wXSA9IGNvbXBhY3RlZDtcbiAgICAgICAgfVxuICAgIH1cbn1cbmZ1bmN0aW9uIGFycmF5X3RvX29iamVjdChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBvYmogPSBvcHRpb25zICYmIG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc291cmNlW2ldICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb2JqW2ldID0gc291cmNlW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59XG5leHBvcnQgZnVuY3Rpb24gbWVyZ2UodGFyZ2V0LCBzb3VyY2UsIG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICghc291cmNlKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuICAgIGlmICh0eXBlb2Ygc291cmNlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoaXNfYXJyYXkodGFyZ2V0KSkge1xuICAgICAgICAgICAgdGFyZ2V0LnB1c2goc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0YXJnZXQgJiYgdHlwZW9mIHRhcmdldCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGlmICgob3B0aW9ucyAmJiAob3B0aW9ucy5wbGFpbk9iamVjdHMgfHwgb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMpKSB8fFxuICAgICAgICAgICAgICAgICFoYXMuY2FsbChPYmplY3QucHJvdG90eXBlLCBzb3VyY2UpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W3NvdXJjZV0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFt0YXJnZXQsIHNvdXJjZV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG4gICAgaWYgKCF0YXJnZXQgfHwgdHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIFt0YXJnZXRdLmNvbmNhdChzb3VyY2UpO1xuICAgIH1cbiAgICBsZXQgbWVyZ2VUYXJnZXQgPSB0YXJnZXQ7XG4gICAgaWYgKGlzX2FycmF5KHRhcmdldCkgJiYgIWlzX2FycmF5KHNvdXJjZSkpIHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBtZXJnZVRhcmdldCA9IGFycmF5X3RvX29iamVjdCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAoaXNfYXJyYXkodGFyZ2V0KSAmJiBpc19hcnJheShzb3VyY2UpKSB7XG4gICAgICAgIHNvdXJjZS5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtLCBpKSB7XG4gICAgICAgICAgICBpZiAoaGFzLmNhbGwodGFyZ2V0LCBpKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldEl0ZW0gPSB0YXJnZXRbaV07XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldEl0ZW0gJiYgdHlwZW9mIHRhcmdldEl0ZW0gPT09ICdvYmplY3QnICYmIGl0ZW0gJiYgdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtpXSA9IG1lcmdlKHRhcmdldEl0ZW0sIGl0ZW0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnB1c2goaXRlbSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W2ldID0gaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3Qua2V5cyhzb3VyY2UpLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBrZXkpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgaWYgKGhhcy5jYWxsKGFjYywga2V5KSkge1xuICAgICAgICAgICAgYWNjW2tleV0gPSBtZXJnZShhY2Nba2V5XSwgdmFsdWUsIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYWNjW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgIH0sIG1lcmdlVGFyZ2V0KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBhc3NpZ25fc2luZ2xlX3NvdXJjZSh0YXJnZXQsIHNvdXJjZSkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzb3VyY2UpLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBrZXkpIHtcbiAgICAgICAgYWNjW2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCB0YXJnZXQpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZShzdHIsIF8sIGNoYXJzZXQpIHtcbiAgICBjb25zdCBzdHJXaXRob3V0UGx1cyA9IHN0ci5yZXBsYWNlKC9cXCsvZywgJyAnKTtcbiAgICBpZiAoY2hhcnNldCA9PT0gJ2lzby04ODU5LTEnKSB7XG4gICAgICAgIC8vIHVuZXNjYXBlIG5ldmVyIHRocm93cywgbm8gdHJ5Li4uY2F0Y2ggbmVlZGVkOlxuICAgICAgICByZXR1cm4gc3RyV2l0aG91dFBsdXMucmVwbGFjZSgvJVswLTlhLWZdezJ9L2dpLCB1bmVzY2FwZSk7XG4gICAgfVxuICAgIC8vIHV0Zi04XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHJXaXRob3V0UGx1cyk7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBzdHJXaXRob3V0UGx1cztcbiAgICB9XG59XG5jb25zdCBsaW1pdCA9IDEwMjQ7XG5leHBvcnQgY29uc3QgZW5jb2RlID0gKHN0ciwgX2RlZmF1bHRFbmNvZGVyLCBjaGFyc2V0LCBfa2luZCwgZm9ybWF0KSA9PiB7XG4gICAgLy8gVGhpcyBjb2RlIHdhcyBvcmlnaW5hbGx5IHdyaXR0ZW4gYnkgQnJpYW4gV2hpdGUgZm9yIHRoZSBpby5qcyBjb3JlIHF1ZXJ5c3RyaW5nIGxpYnJhcnkuXG4gICAgLy8gSXQgaGFzIGJlZW4gYWRhcHRlZCBoZXJlIGZvciBzdHJpY3RlciBhZGhlcmVuY2UgdG8gUkZDIDM5ODZcbiAgICBpZiAoc3RyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBsZXQgc3RyaW5nID0gc3RyO1xuICAgIGlmICh0eXBlb2Ygc3RyID09PSAnc3ltYm9sJykge1xuICAgICAgICBzdHJpbmcgPSBTeW1ib2wucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3RyKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgc3RyaW5nID0gU3RyaW5nKHN0cik7XG4gICAgfVxuICAgIGlmIChjaGFyc2V0ID09PSAnaXNvLTg4NTktMScpIHtcbiAgICAgICAgcmV0dXJuIGVzY2FwZShzdHJpbmcpLnJlcGxhY2UoLyV1WzAtOWEtZl17NH0vZ2ksIGZ1bmN0aW9uICgkMCkge1xuICAgICAgICAgICAgcmV0dXJuICclMjYlMjMnICsgcGFyc2VJbnQoJDAuc2xpY2UoMiksIDE2KSArICclM0InO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGV0IG91dCA9ICcnO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3RyaW5nLmxlbmd0aDsgaiArPSBsaW1pdCkge1xuICAgICAgICBjb25zdCBzZWdtZW50ID0gc3RyaW5nLmxlbmd0aCA+PSBsaW1pdCA/IHN0cmluZy5zbGljZShqLCBqICsgbGltaXQpIDogc3RyaW5nO1xuICAgICAgICBjb25zdCBhcnIgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBsZXQgYyA9IHNlZ21lbnQuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIGlmIChjID09PSAweDJkIHx8IC8vIC1cbiAgICAgICAgICAgICAgICBjID09PSAweDJlIHx8IC8vIC5cbiAgICAgICAgICAgICAgICBjID09PSAweDVmIHx8IC8vIF9cbiAgICAgICAgICAgICAgICBjID09PSAweDdlIHx8IC8vIH5cbiAgICAgICAgICAgICAgICAoYyA+PSAweDMwICYmIGMgPD0gMHgzOSkgfHwgLy8gMC05XG4gICAgICAgICAgICAgICAgKGMgPj0gMHg0MSAmJiBjIDw9IDB4NWEpIHx8IC8vIGEtelxuICAgICAgICAgICAgICAgIChjID49IDB4NjEgJiYgYyA8PSAweDdhKSB8fCAvLyBBLVpcbiAgICAgICAgICAgICAgICAoZm9ybWF0ID09PSBSRkMxNzM4ICYmIChjID09PSAweDI4IHx8IGMgPT09IDB4MjkpKSAvLyAoIClcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGFyclthcnIubGVuZ3RoXSA9IHNlZ21lbnQuY2hhckF0KGkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGMgPCAweDgwKSB7XG4gICAgICAgICAgICAgICAgYXJyW2Fyci5sZW5ndGhdID0gaGV4X3RhYmxlW2NdO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGMgPCAweDgwMCkge1xuICAgICAgICAgICAgICAgIGFyclthcnIubGVuZ3RoXSA9IGhleF90YWJsZVsweGMwIHwgKGMgPj4gNildICsgaGV4X3RhYmxlWzB4ODAgfCAoYyAmIDB4M2YpXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjIDwgMHhkODAwIHx8IGMgPj0gMHhlMDAwKSB7XG4gICAgICAgICAgICAgICAgYXJyW2Fyci5sZW5ndGhdID1cbiAgICAgICAgICAgICAgICAgICAgaGV4X3RhYmxlWzB4ZTAgfCAoYyA+PiAxMildICsgaGV4X3RhYmxlWzB4ODAgfCAoKGMgPj4gNikgJiAweDNmKV0gKyBoZXhfdGFibGVbMHg4MCB8IChjICYgMHgzZildO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSArPSAxO1xuICAgICAgICAgICAgYyA9IDB4MTAwMDAgKyAoKChjICYgMHgzZmYpIDw8IDEwKSB8IChzZWdtZW50LmNoYXJDb2RlQXQoaSkgJiAweDNmZikpO1xuICAgICAgICAgICAgYXJyW2Fyci5sZW5ndGhdID1cbiAgICAgICAgICAgICAgICBoZXhfdGFibGVbMHhmMCB8IChjID4+IDE4KV0gK1xuICAgICAgICAgICAgICAgICAgICBoZXhfdGFibGVbMHg4MCB8ICgoYyA+PiAxMikgJiAweDNmKV0gK1xuICAgICAgICAgICAgICAgICAgICBoZXhfdGFibGVbMHg4MCB8ICgoYyA+PiA2KSAmIDB4M2YpXSArXG4gICAgICAgICAgICAgICAgICAgIGhleF90YWJsZVsweDgwIHwgKGMgJiAweDNmKV07XG4gICAgICAgIH1cbiAgICAgICAgb3V0ICs9IGFyci5qb2luKCcnKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbn07XG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdCh2YWx1ZSkge1xuICAgIGNvbnN0IHF1ZXVlID0gW3sgb2JqOiB7IG86IHZhbHVlIH0sIHByb3A6ICdvJyB9XTtcbiAgICBjb25zdCByZWZzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBpdGVtID0gcXVldWVbaV07XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgY29uc3Qgb2JqID0gaXRlbS5vYmpbaXRlbS5wcm9wXTtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwga2V5cy5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0ga2V5c1tqXTtcbiAgICAgICAgICAgIGNvbnN0IHZhbCA9IG9ialtrZXldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdvYmplY3QnICYmIHZhbCAhPT0gbnVsbCAmJiByZWZzLmluZGV4T2YodmFsKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBxdWV1ZS5wdXNoKHsgb2JqOiBvYmosIHByb3A6IGtleSB9KTtcbiAgICAgICAgICAgICAgICByZWZzLnB1c2godmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBjb21wYWN0X3F1ZXVlKHF1ZXVlKTtcbiAgICByZXR1cm4gdmFsdWU7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNfcmVnZXhwKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNfYnVmZmVyKG9iaikge1xuICAgIGlmICghb2JqIHx8IHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuICEhKG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNvbWJpbmUoYSwgYikge1xuICAgIHJldHVybiBbXS5jb25jYXQoYSwgYik7XG59XG5leHBvcnQgZnVuY3Rpb24gbWF5YmVfbWFwKHZhbCwgZm4pIHtcbiAgICBpZiAoaXNfYXJyYXkodmFsKSkge1xuICAgICAgICBjb25zdCBtYXBwZWQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWwubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIG1hcHBlZC5wdXNoKGZuKHZhbFtpXSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgfVxuICAgIHJldHVybiBmbih2YWwpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXRpbHMubWpzLm1hcCIsIi8qKlxuICogTW9zdCBicm93c2VycyBkb24ndCB5ZXQgaGF2ZSBhc3luYyBpdGVyYWJsZSBzdXBwb3J0IGZvciBSZWFkYWJsZVN0cmVhbSxcbiAqIGFuZCBOb2RlIGhhcyBhIHZlcnkgZGlmZmVyZW50IHdheSBvZiByZWFkaW5nIGJ5dGVzIGZyb20gaXRzIFwiUmVhZGFibGVTdHJlYW1cIi5cbiAqXG4gKiBUaGlzIHBvbHlmaWxsIHdhcyBwdWxsZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vTWF0dGlhc0J1ZWxlbnMvd2ViLXN0cmVhbXMtcG9seWZpbGwvcHVsbC8xMjIjaXNzdWVjb21tZW50LTE2MjczNTQ0OTBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFJlYWRhYmxlU3RyZWFtVG9Bc3luY0l0ZXJhYmxlKHN0cmVhbSkge1xuICAgIGlmIChzdHJlYW1bU3ltYm9sLmFzeW5jSXRlcmF0b3JdKVxuICAgICAgICByZXR1cm4gc3RyZWFtO1xuICAgIGNvbnN0IHJlYWRlciA9IHN0cmVhbS5nZXRSZWFkZXIoKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBhc3luYyBuZXh0KCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQ/LmRvbmUpXG4gICAgICAgICAgICAgICAgICAgIHJlYWRlci5yZWxlYXNlTG9jaygpOyAvLyByZWxlYXNlIGxvY2sgd2hlbiBzdHJlYW0gYmVjb21lcyBjbG9zZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVsZWFzZUxvY2soKTsgLy8gcmVsZWFzZSBsb2NrIHdoZW4gc3RyZWFtIGJlY29tZXMgZXJyb3JlZFxuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGFzeW5jIHJldHVybigpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbmNlbFByb21pc2UgPSByZWFkZXIuY2FuY2VsKCk7XG4gICAgICAgICAgICByZWFkZXIucmVsZWFzZUxvY2soKTtcbiAgICAgICAgICAgIGF3YWl0IGNhbmNlbFByb21pc2U7XG4gICAgICAgICAgICByZXR1cm4geyBkb25lOiB0cnVlLCB2YWx1ZTogdW5kZWZpbmVkIH07XG4gICAgICAgIH0sXG4gICAgICAgIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcbiAgICB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3RyZWFtLXV0aWxzLm1qcy5tYXAiLCJ2YXIgX19jbGFzc1ByaXZhdGVGaWVsZEdldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZEdldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwga2luZCwgZikge1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcbiAgICByZXR1cm4ga2luZCA9PT0gXCJtXCIgPyBmIDoga2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIpIDogZiA/IGYudmFsdWUgOiBzdGF0ZS5nZXQocmVjZWl2ZXIpO1xufTtcbnZhciBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsQ29udGVudCwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxNZXNzYWdlLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbCwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGxSZXN1bHQsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2NhbGN1bGF0ZVRvdGFsVXNhZ2UsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX3ZhbGlkYXRlUGFyYW1zLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9zdHJpbmdpZnlGdW5jdGlvbkNhbGxSZXN1bHQ7XG5pbXBvcnQgeyBPcGVuQUlFcnJvciB9IGZyb20gXCIuLi9lcnJvci5tanNcIjtcbmltcG9ydCB7IGlzUnVubmFibGVGdW5jdGlvbldpdGhQYXJzZSwgfSBmcm9tIFwiLi9SdW5uYWJsZUZ1bmN0aW9uLm1qc1wiO1xuaW1wb3J0IHsgaXNBc3Npc3RhbnRNZXNzYWdlLCBpc0Z1bmN0aW9uTWVzc2FnZSwgaXNUb29sTWVzc2FnZSB9IGZyb20gXCIuL2NoYXRDb21wbGV0aW9uVXRpbHMubWpzXCI7XG5pbXBvcnQgeyBFdmVudFN0cmVhbSB9IGZyb20gXCIuL0V2ZW50U3RyZWFtLm1qc1wiO1xuaW1wb3J0IHsgaXNBdXRvUGFyc2FibGVUb29sLCBwYXJzZUNoYXRDb21wbGV0aW9uIH0gZnJvbSBcIi4uL2xpYi9wYXJzZXIubWpzXCI7XG5jb25zdCBERUZBVUxUX01BWF9DSEFUX0NPTVBMRVRJT05TID0gMTA7XG5leHBvcnQgY2xhc3MgQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lciBleHRlbmRzIEV2ZW50U3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLmFkZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fY2hhdENvbXBsZXRpb25zID0gW107XG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBbXTtcbiAgICB9XG4gICAgX2FkZENoYXRDb21wbGV0aW9uKGNoYXRDb21wbGV0aW9uKSB7XG4gICAgICAgIHRoaXMuX2NoYXRDb21wbGV0aW9ucy5wdXNoKGNoYXRDb21wbGV0aW9uKTtcbiAgICAgICAgdGhpcy5fZW1pdCgnY2hhdENvbXBsZXRpb24nLCBjaGF0Q29tcGxldGlvbik7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjaGF0Q29tcGxldGlvbi5jaG9pY2VzWzBdPy5tZXNzYWdlO1xuICAgICAgICBpZiAobWVzc2FnZSlcbiAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBjaGF0Q29tcGxldGlvbjtcbiAgICB9XG4gICAgX2FkZE1lc3NhZ2UobWVzc2FnZSwgZW1pdCA9IHRydWUpIHtcbiAgICAgICAgaWYgKCEoJ2NvbnRlbnQnIGluIG1lc3NhZ2UpKVxuICAgICAgICAgICAgbWVzc2FnZS5jb250ZW50ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICBpZiAoZW1pdCkge1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnbWVzc2FnZScsIG1lc3NhZ2UpO1xuICAgICAgICAgICAgaWYgKChpc0Z1bmN0aW9uTWVzc2FnZShtZXNzYWdlKSB8fCBpc1Rvb2xNZXNzYWdlKG1lc3NhZ2UpKSAmJiBtZXNzYWdlLmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAvLyBOb3RlLCB0aGlzIGFzc3VtZXMgdGhhdCB7cm9sZTogJ3Rvb2wnLCBjb250ZW50OiDigKZ9IGlzIGFsd2F5cyB0aGUgcmVzdWx0IG9mIGEgY2FsbCBvZiB0b29sIG9mIHR5cGU9ZnVuY3Rpb24uXG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnZnVuY3Rpb25DYWxsUmVzdWx0JywgbWVzc2FnZS5jb250ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGlzQXNzaXN0YW50TWVzc2FnZShtZXNzYWdlKSAmJiBtZXNzYWdlLmZ1bmN0aW9uX2NhbGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdmdW5jdGlvbkNhbGwnLCBtZXNzYWdlLmZ1bmN0aW9uX2NhbGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNBc3Npc3RhbnRNZXNzYWdlKG1lc3NhZ2UpICYmIG1lc3NhZ2UudG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbF9jYWxsIG9mIG1lc3NhZ2UudG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9vbF9jYWxsLnR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2Z1bmN0aW9uQ2FsbCcsIHRvb2xfY2FsbC5mdW5jdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQHJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgZmluYWwgQ2hhdENvbXBsZXRpb24sIG9yIHJlamVjdHNcbiAgICAgKiBpZiBhbiBlcnJvciBvY2N1cnJlZCBvciB0aGUgc3RyZWFtIGVuZGVkIHByZW1hdHVyZWx5IHdpdGhvdXQgcHJvZHVjaW5nIGEgQ2hhdENvbXBsZXRpb24uXG4gICAgICovXG4gICAgYXN5bmMgZmluYWxDaGF0Q29tcGxldGlvbigpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb24gPSB0aGlzLl9jaGF0Q29tcGxldGlvbnNbdGhpcy5fY2hhdENvbXBsZXRpb25zLmxlbmd0aCAtIDFdO1xuICAgICAgICBpZiAoIWNvbXBsZXRpb24pXG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoJ3N0cmVhbSBlbmRlZCB3aXRob3V0IHByb2R1Y2luZyBhIENoYXRDb21wbGV0aW9uJyk7XG4gICAgICAgIHJldHVybiBjb21wbGV0aW9uO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBjb250ZW50IG9mIHRoZSBmaW5hbCBDaGF0Q29tcGxldGlvbk1lc3NhZ2UsIG9yIHJlamVjdHNcbiAgICAgKiBpZiBhbiBlcnJvciBvY2N1cnJlZCBvciB0aGUgc3RyZWFtIGVuZGVkIHByZW1hdHVyZWx5IHdpdGhvdXQgcHJvZHVjaW5nIGEgQ2hhdENvbXBsZXRpb25NZXNzYWdlLlxuICAgICAqL1xuICAgIGFzeW5jIGZpbmFsQ29udGVudCgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsQ29udGVudCkuY2FsbCh0aGlzKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQHJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgdGhlIGZpbmFsIGFzc2lzdGFudCBDaGF0Q29tcGxldGlvbk1lc3NhZ2UgcmVzcG9uc2UsXG4gICAgICogb3IgcmVqZWN0cyBpZiBhbiBlcnJvciBvY2N1cnJlZCBvciB0aGUgc3RyZWFtIGVuZGVkIHByZW1hdHVyZWx5IHdpdGhvdXQgcHJvZHVjaW5nIGEgQ2hhdENvbXBsZXRpb25NZXNzYWdlLlxuICAgICAqL1xuICAgIGFzeW5jIGZpbmFsTWVzc2FnZSgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsTWVzc2FnZSkuY2FsbCh0aGlzKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQHJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgY29udGVudCBvZiB0aGUgZmluYWwgRnVuY3Rpb25DYWxsLCBvciByZWplY3RzXG4gICAgICogaWYgYW4gZXJyb3Igb2NjdXJyZWQgb3IgdGhlIHN0cmVhbSBlbmRlZCBwcmVtYXR1cmVseSB3aXRob3V0IHByb2R1Y2luZyBhIENoYXRDb21wbGV0aW9uTWVzc2FnZS5cbiAgICAgKi9cbiAgICBhc3luYyBmaW5hbEZ1bmN0aW9uQ2FsbCgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsKS5jYWxsKHRoaXMpO1xuICAgIH1cbiAgICBhc3luYyBmaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0KS5jYWxsKHRoaXMpO1xuICAgIH1cbiAgICBhc3luYyB0b3RhbFVzYWdlKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfY2FsY3VsYXRlVG90YWxVc2FnZSkuY2FsbCh0aGlzKTtcbiAgICB9XG4gICAgYWxsQ2hhdENvbXBsZXRpb25zKCkge1xuICAgICAgICByZXR1cm4gWy4uLnRoaXMuX2NoYXRDb21wbGV0aW9uc107XG4gICAgfVxuICAgIF9lbWl0RmluYWwoKSB7XG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb24gPSB0aGlzLl9jaGF0Q29tcGxldGlvbnNbdGhpcy5fY2hhdENvbXBsZXRpb25zLmxlbmd0aCAtIDFdO1xuICAgICAgICBpZiAoY29tcGxldGlvbilcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ZpbmFsQ2hhdENvbXBsZXRpb24nLCBjb21wbGV0aW9uKTtcbiAgICAgICAgY29uc3QgZmluYWxNZXNzYWdlID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbE1lc3NhZ2UpLmNhbGwodGhpcyk7XG4gICAgICAgIGlmIChmaW5hbE1lc3NhZ2UpXG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdmaW5hbE1lc3NhZ2UnLCBmaW5hbE1lc3NhZ2UpO1xuICAgICAgICBjb25zdCBmaW5hbENvbnRlbnQgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsQ29udGVudCkuY2FsbCh0aGlzKTtcbiAgICAgICAgaWYgKGZpbmFsQ29udGVudClcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2ZpbmFsQ29udGVudCcsIGZpbmFsQ29udGVudCk7XG4gICAgICAgIGNvbnN0IGZpbmFsRnVuY3Rpb25DYWxsID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbCkuY2FsbCh0aGlzKTtcbiAgICAgICAgaWYgKGZpbmFsRnVuY3Rpb25DYWxsKVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgnZmluYWxGdW5jdGlvbkNhbGwnLCBmaW5hbEZ1bmN0aW9uQ2FsbCk7XG4gICAgICAgIGNvbnN0IGZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCkuY2FsbCh0aGlzKTtcbiAgICAgICAgaWYgKGZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0ICE9IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdmaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCcsIGZpbmFsRnVuY3Rpb25DYWxsUmVzdWx0KTtcbiAgICAgICAgaWYgKHRoaXMuX2NoYXRDb21wbGV0aW9ucy5zb21lKChjKSA9PiBjLnVzYWdlKSkge1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgndG90YWxVc2FnZScsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfY2FsY3VsYXRlVG90YWxVc2FnZSkuY2FsbCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgX2NyZWF0ZUNoYXRDb21wbGV0aW9uKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfdmFsaWRhdGVQYXJhbXMpLmNhbGwodGhpcywgcGFyYW1zKTtcbiAgICAgICAgY29uc3QgY2hhdENvbXBsZXRpb24gPSBhd2FpdCBjbGllbnQuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoeyAuLi5wYXJhbXMsIHN0cmVhbTogZmFsc2UgfSwgeyAuLi5vcHRpb25zLCBzaWduYWw6IHRoaXMuY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hhdENvbXBsZXRpb24ocGFyc2VDaGF0Q29tcGxldGlvbihjaGF0Q29tcGxldGlvbiwgcGFyYW1zKSk7XG4gICAgfVxuICAgIGFzeW5jIF9ydW5DaGF0Q29tcGxldGlvbihjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgcGFyYW1zLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKG1lc3NhZ2UsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5fY3JlYXRlQ2hhdENvbXBsZXRpb24oY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBhc3luYyBfcnVuRnVuY3Rpb25zKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJvbGUgPSAnZnVuY3Rpb24nO1xuICAgICAgICBjb25zdCB7IGZ1bmN0aW9uX2NhbGwgPSAnYXV0bycsIHN0cmVhbSwgLi4ucmVzdFBhcmFtcyB9ID0gcGFyYW1zO1xuICAgICAgICBjb25zdCBzaW5nbGVGdW5jdGlvblRvQ2FsbCA9IHR5cGVvZiBmdW5jdGlvbl9jYWxsICE9PSAnc3RyaW5nJyAmJiBmdW5jdGlvbl9jYWxsPy5uYW1lO1xuICAgICAgICBjb25zdCB7IG1heENoYXRDb21wbGV0aW9ucyA9IERFRkFVTFRfTUFYX0NIQVRfQ09NUExFVElPTlMgfSA9IG9wdGlvbnMgfHwge307XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uc0J5TmFtZSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGYgb2YgcGFyYW1zLmZ1bmN0aW9ucykge1xuICAgICAgICAgICAgZnVuY3Rpb25zQnlOYW1lW2YubmFtZSB8fCBmLmZ1bmN0aW9uLm5hbWVdID0gZjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdW5jdGlvbnMgPSBwYXJhbXMuZnVuY3Rpb25zLm1hcCgoZikgPT4gKHtcbiAgICAgICAgICAgIG5hbWU6IGYubmFtZSB8fCBmLmZ1bmN0aW9uLm5hbWUsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBmLnBhcmFtZXRlcnMsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogZi5kZXNjcmlwdGlvbixcbiAgICAgICAgfSkpO1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgcGFyYW1zLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKG1lc3NhZ2UsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1heENoYXRDb21wbGV0aW9uczsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBjaGF0Q29tcGxldGlvbiA9IGF3YWl0IHRoaXMuX2NyZWF0ZUNoYXRDb21wbGV0aW9uKGNsaWVudCwge1xuICAgICAgICAgICAgICAgIC4uLnJlc3RQYXJhbXMsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25fY2FsbCxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbnMsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFsuLi50aGlzLm1lc3NhZ2VzXSxcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNoYXRDb21wbGV0aW9uLmNob2ljZXNbMF0/Lm1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgbWVzc2FnZSBpbiBDaGF0Q29tcGxldGlvbiByZXNwb25zZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtZXNzYWdlLmZ1bmN0aW9uX2NhbGwpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgeyBuYW1lLCBhcmd1bWVudHM6IGFyZ3MgfSA9IG1lc3NhZ2UuZnVuY3Rpb25fY2FsbDtcbiAgICAgICAgICAgIGNvbnN0IGZuID0gZnVuY3Rpb25zQnlOYW1lW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFmbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBgSW52YWxpZCBmdW5jdGlvbl9jYWxsOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfS4gQXZhaWxhYmxlIG9wdGlvbnMgYXJlOiAke2Z1bmN0aW9uc1xuICAgICAgICAgICAgICAgICAgICAubWFwKChmKSA9PiBKU09OLnN0cmluZ2lmeShmLm5hbWUpKVxuICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX0uIFBsZWFzZSB0cnkgYWdhaW5gO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCBuYW1lLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2luZ2xlRnVuY3Rpb25Ub0NhbGwgJiYgc2luZ2xlRnVuY3Rpb25Ub0NhbGwgIT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYEludmFsaWQgZnVuY3Rpb25fY2FsbDogJHtKU09OLnN0cmluZ2lmeShuYW1lKX0uICR7SlNPTi5zdHJpbmdpZnkoc2luZ2xlRnVuY3Rpb25Ub0NhbGwpfSByZXF1ZXN0ZWQuIFBsZWFzZSB0cnkgYWdhaW5gO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCBuYW1lLCBjb250ZW50IH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHBhcnNlZDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcGFyc2VkID0gaXNSdW5uYWJsZUZ1bmN0aW9uV2l0aFBhcnNlKGZuKSA/IGF3YWl0IGZuLnBhcnNlKGFyZ3MpIDogYXJncztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgICAgICByb2xlLFxuICAgICAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIGl0IGNhbid0IHJ1bGUgb3V0IGBuZXZlcmAgdHlwZS5cbiAgICAgICAgICAgIGNvbnN0IHJhd0NvbnRlbnQgPSBhd2FpdCBmbi5mdW5jdGlvbihwYXJzZWQsIHRoaXMpO1xuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzLCBcIm1cIiwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfc3RyaW5naWZ5RnVuY3Rpb25DYWxsUmVzdWx0KS5jYWxsKHRoaXMsIHJhd0NvbnRlbnQpO1xuICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIG5hbWUsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICBpZiAoc2luZ2xlRnVuY3Rpb25Ub0NhbGwpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIF9ydW5Ub29scyhjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCByb2xlID0gJ3Rvb2wnO1xuICAgICAgICBjb25zdCB7IHRvb2xfY2hvaWNlID0gJ2F1dG8nLCBzdHJlYW0sIC4uLnJlc3RQYXJhbXMgfSA9IHBhcmFtcztcbiAgICAgICAgY29uc3Qgc2luZ2xlRnVuY3Rpb25Ub0NhbGwgPSB0eXBlb2YgdG9vbF9jaG9pY2UgIT09ICdzdHJpbmcnICYmIHRvb2xfY2hvaWNlPy5mdW5jdGlvbj8ubmFtZTtcbiAgICAgICAgY29uc3QgeyBtYXhDaGF0Q29tcGxldGlvbnMgPSBERUZBVUxUX01BWF9DSEFUX0NPTVBMRVRJT05TIH0gPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICAvLyBUT0RPKHNvbWVkYXkpOiBjbGVhbiB0aGlzIGxvZ2ljIHVwXG4gICAgICAgIGNvbnN0IGlucHV0VG9vbHMgPSBwYXJhbXMudG9vbHMubWFwKCh0b29sKSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNBdXRvUGFyc2FibGVUb29sKHRvb2wpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0b29sLiRjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoJ1Rvb2wgZ2l2ZW4gdG8gYC5ydW5Ub29scygpYCB0aGF0IGRvZXMgbm90IGhhdmUgYW4gYXNzb2NpYXRlZCBmdW5jdGlvbicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb246IHRvb2wuJGNhbGxiYWNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdG9vbC5mdW5jdGlvbi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZnVuY3Rpb24uZGVzY3JpcHRpb24gfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB0b29sLmZ1bmN0aW9uLnBhcmFtZXRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZTogdG9vbC4kcGFyc2VSYXcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJpY3Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0b29sO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgZnVuY3Rpb25zQnlOYW1lID0ge307XG4gICAgICAgIGZvciAoY29uc3QgZiBvZiBpbnB1dFRvb2xzKSB7XG4gICAgICAgICAgICBpZiAoZi50eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25zQnlOYW1lW2YuZnVuY3Rpb24ubmFtZSB8fCBmLmZ1bmN0aW9uLmZ1bmN0aW9uLm5hbWVdID0gZi5mdW5jdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0b29scyA9ICd0b29scycgaW4gcGFyYW1zID9cbiAgICAgICAgICAgIGlucHV0VG9vbHMubWFwKCh0KSA9PiB0LnR5cGUgPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHQuZnVuY3Rpb24ubmFtZSB8fCB0LmZ1bmN0aW9uLmZ1bmN0aW9uLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB0LmZ1bmN0aW9uLnBhcmFtZXRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdC5mdW5jdGlvbi5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmljdDogdC5mdW5jdGlvbi5zdHJpY3QsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIDogdClcbiAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgcGFyYW1zLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKG1lc3NhZ2UsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1heENoYXRDb21wbGV0aW9uczsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBjaGF0Q29tcGxldGlvbiA9IGF3YWl0IHRoaXMuX2NyZWF0ZUNoYXRDb21wbGV0aW9uKGNsaWVudCwge1xuICAgICAgICAgICAgICAgIC4uLnJlc3RQYXJhbXMsXG4gICAgICAgICAgICAgICAgdG9vbF9jaG9pY2UsXG4gICAgICAgICAgICAgICAgdG9vbHMsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFsuLi50aGlzLm1lc3NhZ2VzXSxcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNoYXRDb21wbGV0aW9uLmNob2ljZXNbMF0/Lm1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgbWVzc2FnZSBpbiBDaGF0Q29tcGxldGlvbiByZXNwb25zZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtZXNzYWdlLnRvb2xfY2FsbHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbF9jYWxsIG9mIG1lc3NhZ2UudG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgIGlmICh0b29sX2NhbGwudHlwZSAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbF9jYWxsX2lkID0gdG9vbF9jYWxsLmlkO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgbmFtZSwgYXJndW1lbnRzOiBhcmdzIH0gPSB0b29sX2NhbGwuZnVuY3Rpb247XG4gICAgICAgICAgICAgICAgY29uc3QgZm4gPSBmdW5jdGlvbnNCeU5hbWVbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFmbikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYEludmFsaWQgdG9vbF9jYWxsOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfS4gQXZhaWxhYmxlIG9wdGlvbnMgYXJlOiAke09iamVjdC5rZXlzKGZ1bmN0aW9uc0J5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKG5hbWUpID0+IEpTT04uc3RyaW5naWZ5KG5hbWUpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9LiBQbGVhc2UgdHJ5IGFnYWluYDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIHRvb2xfY2FsbF9pZCwgY29udGVudCB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHNpbmdsZUZ1bmN0aW9uVG9DYWxsICYmIHNpbmdsZUZ1bmN0aW9uVG9DYWxsICE9PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBgSW52YWxpZCB0b29sX2NhbGw6ICR7SlNPTi5zdHJpbmdpZnkobmFtZSl9LiAke0pTT04uc3RyaW5naWZ5KHNpbmdsZUZ1bmN0aW9uVG9DYWxsKX0gcmVxdWVzdGVkLiBQbGVhc2UgdHJ5IGFnYWluYDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIHRvb2xfY2FsbF9pZCwgY29udGVudCB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VkID0gaXNSdW5uYWJsZUZ1bmN0aW9uV2l0aFBhcnNlKGZuKSA/IGF3YWl0IGZuLnBhcnNlKGFyZ3MpIDogYXJncztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoeyByb2xlLCB0b29sX2NhbGxfaWQsIGNvbnRlbnQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIGl0IGNhbid0IHJ1bGUgb3V0IGBuZXZlcmAgdHlwZS5cbiAgICAgICAgICAgICAgICBjb25zdCByYXdDb250ZW50ID0gYXdhaXQgZm4uZnVuY3Rpb24ocGFyc2VkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9pbnN0YW5jZXMsIFwibVwiLCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9zdHJpbmdpZnlGdW5jdGlvbkNhbGxSZXN1bHQpLmNhbGwodGhpcywgcmF3Q29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkTWVzc2FnZSh7IHJvbGUsIHRvb2xfY2FsbF9pZCwgY29udGVudCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoc2luZ2xlRnVuY3Rpb25Ub0NhbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxufVxuX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfaW5zdGFuY2VzID0gbmV3IFdlYWtTZXQoKSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxDb250ZW50ID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxDb250ZW50KCkge1xuICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2luc3RhbmNlcywgXCJtXCIsIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2dldEZpbmFsTWVzc2FnZSkuY2FsbCh0aGlzKS5jb250ZW50ID8/IG51bGw7XG59LCBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbE1lc3NhZ2UgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbE1lc3NhZ2UoKSB7XG4gICAgbGV0IGkgPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tID4gMCkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5tZXNzYWdlc1tpXTtcbiAgICAgICAgaWYgKGlzQXNzaXN0YW50TWVzc2FnZShtZXNzYWdlKSkge1xuICAgICAgICAgICAgY29uc3QgeyBmdW5jdGlvbl9jYWxsLCAuLi5yZXN0IH0gPSBtZXNzYWdlO1xuICAgICAgICAgICAgLy8gVE9ETzogc3VwcG9ydCBhdWRpbyBoZXJlXG4gICAgICAgICAgICBjb25zdCByZXQgPSB7XG4gICAgICAgICAgICAgICAgLi4ucmVzdCxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBtZXNzYWdlLmNvbnRlbnQgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICByZWZ1c2FsOiBtZXNzYWdlLnJlZnVzYWwgPz8gbnVsbCxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25fY2FsbCkge1xuICAgICAgICAgICAgICAgIHJldC5mdW5jdGlvbl9jYWxsID0gZnVuY3Rpb25fY2FsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKCdzdHJlYW0gZW5kZWQgd2l0aG91dCBwcm9kdWNpbmcgYSBDaGF0Q29tcGxldGlvbk1lc3NhZ2Ugd2l0aCByb2xlPWFzc2lzdGFudCcpO1xufSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGwgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbCgpIHtcbiAgICBmb3IgKGxldCBpID0gdGhpcy5tZXNzYWdlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5tZXNzYWdlc1tpXTtcbiAgICAgICAgaWYgKGlzQXNzaXN0YW50TWVzc2FnZShtZXNzYWdlKSAmJiBtZXNzYWdlPy5mdW5jdGlvbl9jYWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbWVzc2FnZS5mdW5jdGlvbl9jYWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Fzc2lzdGFudE1lc3NhZ2UobWVzc2FnZSkgJiYgbWVzc2FnZT8udG9vbF9jYWxscz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gbWVzc2FnZS50b29sX2NhbGxzLmF0KC0xKT8uZnVuY3Rpb247XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuO1xufSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfZ2V0RmluYWxGdW5jdGlvbkNhbGxSZXN1bHQgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl9nZXRGaW5hbEZ1bmN0aW9uQ2FsbFJlc3VsdCgpIHtcbiAgICBmb3IgKGxldCBpID0gdGhpcy5tZXNzYWdlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5tZXNzYWdlc1tpXTtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb25NZXNzYWdlKG1lc3NhZ2UpICYmIG1lc3NhZ2UuY29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbWVzc2FnZS5jb250ZW50O1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc1Rvb2xNZXNzYWdlKG1lc3NhZ2UpICYmXG4gICAgICAgICAgICBtZXNzYWdlLmNvbnRlbnQgIT0gbnVsbCAmJlxuICAgICAgICAgICAgdHlwZW9mIG1lc3NhZ2UuY29udGVudCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZXMuc29tZSgoeCkgPT4geC5yb2xlID09PSAnYXNzaXN0YW50JyAmJlxuICAgICAgICAgICAgICAgIHgudG9vbF9jYWxscz8uc29tZSgoeSkgPT4geS50eXBlID09PSAnZnVuY3Rpb24nICYmIHkuaWQgPT09IG1lc3NhZ2UudG9vbF9jYWxsX2lkKSkpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXNzYWdlLmNvbnRlbnQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuO1xufSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfY2FsY3VsYXRlVG90YWxVc2FnZSA9IGZ1bmN0aW9uIF9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyX2NhbGN1bGF0ZVRvdGFsVXNhZ2UoKSB7XG4gICAgY29uc3QgdG90YWwgPSB7XG4gICAgICAgIGNvbXBsZXRpb25fdG9rZW5zOiAwLFxuICAgICAgICBwcm9tcHRfdG9rZW5zOiAwLFxuICAgICAgICB0b3RhbF90b2tlbnM6IDAsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IHsgdXNhZ2UgfSBvZiB0aGlzLl9jaGF0Q29tcGxldGlvbnMpIHtcbiAgICAgICAgaWYgKHVzYWdlKSB7XG4gICAgICAgICAgICB0b3RhbC5jb21wbGV0aW9uX3Rva2VucyArPSB1c2FnZS5jb21wbGV0aW9uX3Rva2VucztcbiAgICAgICAgICAgIHRvdGFsLnByb21wdF90b2tlbnMgKz0gdXNhZ2UucHJvbXB0X3Rva2VucztcbiAgICAgICAgICAgIHRvdGFsLnRvdGFsX3Rva2VucyArPSB1c2FnZS50b3RhbF90b2tlbnM7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRvdGFsO1xufSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfdmFsaWRhdGVQYXJhbXMgPSBmdW5jdGlvbiBfQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lcl92YWxpZGF0ZVBhcmFtcyhwYXJhbXMpIHtcbiAgICBpZiAocGFyYW1zLm4gIT0gbnVsbCAmJiBwYXJhbXMubiA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKCdDaGF0Q29tcGxldGlvbiBjb252ZW5pZW5jZSBoZWxwZXJzIG9ubHkgc3VwcG9ydCBuPTEgYXQgdGhpcyB0aW1lLiBUbyB1c2Ugbj4xLCBwbGVhc2UgdXNlIGNoYXQuY29tcGxldGlvbnMuY3JlYXRlKCkgZGlyZWN0bHkuJyk7XG4gICAgfVxufSwgX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfc3RyaW5naWZ5RnVuY3Rpb25DYWxsUmVzdWx0ID0gZnVuY3Rpb24gX0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXJfc3RyaW5naWZ5RnVuY3Rpb25DYWxsUmVzdWx0KHJhd0NvbnRlbnQpIHtcbiAgICByZXR1cm4gKHR5cGVvZiByYXdDb250ZW50ID09PSAnc3RyaW5nJyA/IHJhd0NvbnRlbnRcbiAgICAgICAgOiByYXdDb250ZW50ID09PSB1bmRlZmluZWQgPyAndW5kZWZpbmVkJ1xuICAgICAgICAgICAgOiBKU09OLnN0cmluZ2lmeShyYXdDb250ZW50KSk7XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9QWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lci5tanMubWFwIiwidmFyIF9fY2xhc3NQcml2YXRlRmllbGRHZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRHZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcbn07XG52YXIgX19jbGFzc1ByaXZhdGVGaWVsZFNldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZFNldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XG59O1xudmFyIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBfQXNzaXN0YW50U3RyZWFtX2V2ZW50cywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdHMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50SW5kZXgsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsSW5kZXgsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRFdmVudCwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU25hcHNob3QsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blN0ZXBTbmFwc2hvdCwgX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudCwgX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0LCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZU1lc3NhZ2UsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuU3RlcCwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVFdmVudCwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlUnVuU3RlcCwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlTWVzc2FnZSwgX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlQ29udGVudCwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW47XG5pbXBvcnQgKiBhcyBDb3JlIGZyb20gXCIuLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgU3RyZWFtIH0gZnJvbSBcIi4uL3N0cmVhbWluZy5tanNcIjtcbmltcG9ydCB7IEFQSVVzZXJBYm9ydEVycm9yLCBPcGVuQUlFcnJvciB9IGZyb20gXCIuLi9lcnJvci5tanNcIjtcbmltcG9ydCB7IEV2ZW50U3RyZWFtIH0gZnJvbSBcIi4vRXZlbnRTdHJlYW0ubWpzXCI7XG5leHBvcnQgY2xhc3MgQXNzaXN0YW50U3RyZWFtIGV4dGVuZHMgRXZlbnRTdHJlYW0ge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcy5hZGQodGhpcyk7XG4gICAgICAgIC8vVHJhY2sgYWxsIGV2ZW50cyBpbiBhIHNpbmdsZSBsaXN0IGZvciByZWZlcmVuY2VcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9ldmVudHMuc2V0KHRoaXMsIFtdKTtcbiAgICAgICAgLy9Vc2VkIHRvIGFjY3VtdWxhdGUgZGVsdGFzXG4gICAgICAgIC8vV2UgYXJlIGFjY3VtdWxhdGluZyBtYW55IHR5cGVzIHNvIHRoZSB2YWx1ZSBoZXJlIGlzIG5vdCBzdHJpY3RcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLnNldCh0aGlzLCB7fSk7XG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90cy5zZXQodGhpcywge30pO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1bi5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRDb250ZW50LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbEluZGV4LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgLy9Gb3IgY3VycmVudCBzbmFwc2hvdCBtZXRob2RzXG4gICAgICAgIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudEV2ZW50LnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TbmFwc2hvdC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU3RlcFNuYXBzaG90LnNldCh0aGlzLCB2b2lkIDApO1xuICAgIH1cbiAgICBbKF9Bc3Npc3RhbnRTdHJlYW1fZXZlbnRzID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3RzID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsSW5kZXggPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCA9IG5ldyBXZWFrTWFwKCksIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudEV2ZW50ID0gbmV3IFdlYWtNYXAoKSwgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU25hcHNob3QgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TdGVwU25hcHNob3QgPSBuZXcgV2Vha01hcCgpLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcyA9IG5ldyBXZWFrU2V0KCksIFN5bWJvbC5hc3luY0l0ZXJhdG9yKV0oKSB7XG4gICAgICAgIGNvbnN0IHB1c2hRdWV1ZSA9IFtdO1xuICAgICAgICBjb25zdCByZWFkUXVldWUgPSBbXTtcbiAgICAgICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICAgICAgLy9DYXRjaCBhbGwgZm9yIHBhc3NpbmcgYWxvbmcgYWxsIGV2ZW50c1xuICAgICAgICB0aGlzLm9uKCdldmVudCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVhZGVyID0gcmVhZFF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICBpZiAocmVhZGVyKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlc29sdmUoZXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcHVzaFF1ZXVlLnB1c2goZXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlYWRlciBvZiByZWFkUXVldWUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVzb2x2ZSh1bmRlZmluZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVhZFF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uKCdhYm9ydCcsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVhZFF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVhZFF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmV4dDogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcHVzaFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkUXVldWUucHVzaCh7IHJlc29sdmUsIHJlamVjdCB9KSkudGhlbigoY2h1bmspID0+IChjaHVuayA/IHsgdmFsdWU6IGNodW5rLCBkb25lOiBmYWxzZSB9IDogeyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBwdXNoUXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogY2h1bmssIGRvbmU6IGZhbHNlIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmV0dXJuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgfVxuICAgIHN0YXRpYyBmcm9tUmVhZGFibGVTdHJlYW0oc3RyZWFtKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBBc3Npc3RhbnRTdHJlYW0oKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9mcm9tUmVhZGFibGVTdHJlYW0oc3RyZWFtKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIGFzeW5jIF9mcm9tUmVhZGFibGVTdHJlYW0ocmVhZGFibGVTdHJlYW0sIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY29ubmVjdGVkKCk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IFN0cmVhbS5mcm9tUmVhZGFibGVTdHJlYW0ocmVhZGFibGVTdHJlYW0sIHRoaXMuY29udHJvbGxlcik7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2Ygc3RyZWFtKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9hZGRFdmVudCkuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0cmVhbS5jb250cm9sbGVyLnNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZFJ1bihfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICB9XG4gICAgdG9SZWFkYWJsZVN0cmVhbSgpIHtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gbmV3IFN0cmVhbSh0aGlzW1N5bWJvbC5hc3luY0l0ZXJhdG9yXS5iaW5kKHRoaXMpLCB0aGlzLmNvbnRyb2xsZXIpO1xuICAgICAgICByZXR1cm4gc3RyZWFtLnRvUmVhZGFibGVTdHJlYW0oKTtcbiAgICB9XG4gICAgc3RhdGljIGNyZWF0ZVRvb2xBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bklkLCBydW5zLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IEFzc2lzdGFudFN0cmVhbSgpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1blRvb2xBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bklkLCBydW5zLCBwYXJhbXMsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3N0cmVhbScgfSxcbiAgICAgICAgfSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBhc3luYyBfY3JlYXRlVG9vbEFzc2lzdGFudFN0cmVhbShydW4sIHRocmVhZElkLCBydW5JZCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJvZHkgPSB7IC4uLnBhcmFtcywgc3RyZWFtOiB0cnVlIH07XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IHJ1bi5zdWJtaXRUb29sT3V0cHV0cyh0aHJlYWRJZCwgcnVuSWQsIGJvZHksIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBzaWduYWw6IHRoaXMuY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBldmVudCBvZiBzdHJlYW0pIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50KS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyZWFtLmNvbnRyb2xsZXIuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkUnVuKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlVGhyZWFkQXNzaXN0YW50U3RyZWFtKHBhcmFtcywgdGhyZWFkLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBBc3Npc3RhbnRTdHJlYW0oKTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl90aHJlYWRBc3Npc3RhbnRTdHJlYW0ocGFyYW1zLCB0aHJlYWQsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3N0cmVhbScgfSxcbiAgICAgICAgfSkpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5zLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IEFzc2lzdGFudFN0cmVhbSgpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1bkFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgcnVucywgcGFyYW1zLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdzdHJlYW0nIH0sXG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgY3VycmVudEV2ZW50KCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRFdmVudCwgXCJmXCIpO1xuICAgIH1cbiAgICBjdXJyZW50UnVuKCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TbmFwc2hvdCwgXCJmXCIpO1xuICAgIH1cbiAgICBjdXJyZW50TWVzc2FnZVNuYXBzaG90KCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpO1xuICAgIH1cbiAgICBjdXJyZW50UnVuU3RlcFNuYXBzaG90KCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TdGVwU25hcHNob3QsIFwiZlwiKTtcbiAgICB9XG4gICAgYXN5bmMgZmluYWxSdW5TdGVwcygpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kb25lKCk7XG4gICAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIikpO1xuICAgIH1cbiAgICBhc3luYyBmaW5hbE1lc3NhZ2VzKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdHMsIFwiZlwiKSk7XG4gICAgfVxuICAgIGFzeW5jIGZpbmFsUnVuKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmRvbmUoKTtcbiAgICAgICAgaWYgKCFfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4sIFwiZlwiKSlcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdGaW5hbCBydW4gd2FzIG5vdCByZWNlaXZlZC4nKTtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9maW5hbFJ1biwgXCJmXCIpO1xuICAgIH1cbiAgICBhc3luYyBfY3JlYXRlVGhyZWFkQXNzaXN0YW50U3RyZWFtKHRocmVhZCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJvZHkgPSB7IC4uLnBhcmFtcywgc3RyZWFtOiB0cnVlIH07XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IHRocmVhZC5jcmVhdGVBbmRSdW4oYm9keSwgeyAuLi5vcHRpb25zLCBzaWduYWw6IHRoaXMuY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGV2ZW50IG9mIHN0cmVhbSkge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQpLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdHJlYW0uY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBUElVc2VyQWJvcnRFcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRSdW4oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fZW5kUmVxdWVzdCkuY2FsbCh0aGlzKSk7XG4gICAgfVxuICAgIGFzeW5jIF9jcmVhdGVBc3Npc3RhbnRTdHJlYW0ocnVuLCB0aHJlYWRJZCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJvZHkgPSB7IC4uLnBhcmFtcywgc3RyZWFtOiB0cnVlIH07XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IHJ1bi5jcmVhdGUodGhyZWFkSWQsIGJvZHksIHsgLi4ub3B0aW9ucywgc2lnbmFsOiB0aGlzLmNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgICAgICB0aGlzLl9jb25uZWN0ZWQoKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBldmVudCBvZiBzdHJlYW0pIHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50KS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyZWFtLmNvbnRyb2xsZXIuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkUnVuKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgIH1cbiAgICBzdGF0aWMgYWNjdW11bGF0ZURlbHRhKGFjYywgZGVsdGEpIHtcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBkZWx0YVZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhkZWx0YSkpIHtcbiAgICAgICAgICAgIGlmICghYWNjLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICBhY2Nba2V5XSA9IGRlbHRhVmFsdWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgYWNjVmFsdWUgPSBhY2Nba2V5XTtcbiAgICAgICAgICAgIGlmIChhY2NWYWx1ZSA9PT0gbnVsbCB8fCBhY2NWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgYWNjW2tleV0gPSBkZWx0YVZhbHVlO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gV2UgZG9uJ3QgYWNjdW11bGF0ZSB0aGVzZSBzcGVjaWFsIHByb3BlcnRpZXNcbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdpbmRleCcgfHwga2V5ID09PSAndHlwZScpIHtcbiAgICAgICAgICAgICAgICBhY2Nba2V5XSA9IGRlbHRhVmFsdWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBUeXBlLXNwZWNpZmljIGFjY3VtdWxhdGlvbiBsb2dpY1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhY2NWYWx1ZSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGRlbHRhVmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgYWNjVmFsdWUgKz0gZGVsdGFWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiBhY2NWYWx1ZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGRlbHRhVmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgYWNjVmFsdWUgKz0gZGVsdGFWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKENvcmUuaXNPYmooYWNjVmFsdWUpICYmIENvcmUuaXNPYmooZGVsdGFWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBhY2NWYWx1ZSA9IHRoaXMuYWNjdW11bGF0ZURlbHRhKGFjY1ZhbHVlLCBkZWx0YVZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYWNjVmFsdWUpICYmIEFycmF5LmlzQXJyYXkoZGVsdGFWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYWNjVmFsdWUuZXZlcnkoKHgpID0+IHR5cGVvZiB4ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgeCA9PT0gJ251bWJlcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFjY1ZhbHVlLnB1c2goLi4uZGVsdGFWYWx1ZSk7IC8vIFVzZSBzcHJlYWQgc3ludGF4IGZvciBlZmZpY2llbnQgYWRkaXRpb25cbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZGVsdGFFbnRyeSBvZiBkZWx0YVZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghQ29yZS5pc09iaihkZWx0YUVudHJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhcnJheSBkZWx0YSBlbnRyeSB0byBiZSBhbiBvYmplY3QgYnV0IGdvdDogJHtkZWx0YUVudHJ5fWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gZGVsdGFFbnRyeVsnaW5kZXgnXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZGV4ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZGVsdGFFbnRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGFycmF5IGRlbHRhIGVudHJ5IHRvIGhhdmUgYW4gYGluZGV4YCBwcm9wZXJ0eScpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGFycmF5IGRlbHRhIGVudHJ5IFxcYGluZGV4XFxgIHByb3BlcnR5IHRvIGJlIGEgbnVtYmVyIGJ1dCBnb3QgJHtpbmRleH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhY2NFbnRyeSA9IGFjY1ZhbHVlW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY0VudHJ5ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1ZhbHVlLnB1c2goZGVsdGFFbnRyeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NWYWx1ZVtpbmRleF0gPSB0aGlzLmFjY3VtdWxhdGVEZWx0YShhY2NFbnRyeSwgZGVsdGFFbnRyeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcihgVW5oYW5kbGVkIHJlY29yZCB0eXBlOiAke2tleX0sIGRlbHRhVmFsdWU6ICR7ZGVsdGFWYWx1ZX0sIGFjY1ZhbHVlOiAke2FjY1ZhbHVlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWNjW2tleV0gPSBhY2NWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgIH1cbiAgICBfYWRkUnVuKHJ1bikge1xuICAgICAgICByZXR1cm4gcnVuO1xuICAgIH1cbiAgICBhc3luYyBfdGhyZWFkQXNzaXN0YW50U3RyZWFtKHBhcmFtcywgdGhyZWFkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLl9jcmVhdGVUaHJlYWRBc3Npc3RhbnRTdHJlYW0odGhyZWFkLCBwYXJhbXMsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBhc3luYyBfcnVuQXNzaXN0YW50U3RyZWFtKHRocmVhZElkLCBydW5zLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX2NyZWF0ZUFzc2lzdGFudFN0cmVhbShydW5zLCB0aHJlYWRJZCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgICB9XG4gICAgYXN5bmMgX3J1blRvb2xBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bklkLCBydW5zLCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX2NyZWF0ZVRvb2xBc3Npc3RhbnRTdHJlYW0ocnVucywgdGhyZWFkSWQsIHJ1bklkLCBwYXJhbXMsIG9wdGlvbnMpO1xuICAgIH1cbn1cbl9Bc3Npc3RhbnRTdHJlYW1fYWRkRXZlbnQgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2FkZEV2ZW50KGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZW5kZWQpXG4gICAgICAgIHJldHVybjtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudEV2ZW50LCBldmVudCwgXCJmXCIpO1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZUV2ZW50KS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5jcmVhdGVkJzpcbiAgICAgICAgICAgIC8vTm8gYWN0aW9uIG9uIHRoaXMgZXZlbnQuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jcmVhdGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5xdWV1ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmluX3Byb2dyZXNzJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5yZXF1aXJlc19hY3Rpb24nOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uaW5jb21wbGV0ZSc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uZmFpbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jYW5jZWxsaW5nJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jYW5jZWxsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmV4cGlyZWQnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuKS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY3JlYXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5pbl9wcm9ncmVzcyc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5kZWx0YSc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZmFpbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNhbmNlbGxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5leHBpcmVkJzpcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1blN0ZXApLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmNyZWF0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5pbl9wcm9ncmVzcyc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmRlbHRhJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuaW5jb21wbGV0ZSc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVNZXNzYWdlKS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAvL1RoaXMgaXMgaW5jbHVkZWQgZm9yIGNvbXBsZXRlbmVzcywgYnV0IGVycm9ycyBhcmUgcHJvY2Vzc2VkIGluIHRoZSBTU0UgZXZlbnQgcHJvY2Vzc2luZyBzbyB0aGlzIHNob3VsZCBub3Qgb2NjdXJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRW5jb3VudGVyZWQgYW4gZXJyb3IgZXZlbnQgaW4gZXZlbnQgcHJvY2Vzc2luZyAtIGVycm9ycyBzaG91bGQgYmUgcHJvY2Vzc2VkIGVhcmxpZXInKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGFzc2VydE5ldmVyKGV2ZW50KTtcbiAgICB9XG59LCBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2VuZFJlcXVlc3QoKSB7XG4gICAgaWYgKHRoaXMuZW5kZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBzdHJlYW0gaGFzIGVuZGVkLCB0aGlzIHNob3VsZG4ndCBoYXBwZW5gKTtcbiAgICB9XG4gICAgaWYgKCFfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fZmluYWxSdW4sIFwiZlwiKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0ZpbmFsIHJ1biBoYXMgbm90IGJlZW4gcmVjZWl2ZWQnKTtcbiAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLCBcImZcIik7XG59LCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZU1lc3NhZ2UgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZU1lc3NhZ2UoZXZlbnQpIHtcbiAgICBjb25zdCBbYWNjdW11bGF0ZWRNZXNzYWdlLCBuZXdDb250ZW50XSA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVNZXNzYWdlKS5jYWxsKHRoaXMsIGV2ZW50LCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIikpO1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIGFjY3VtdWxhdGVkTWVzc2FnZSwgXCJmXCIpO1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3RzLCBcImZcIilbYWNjdW11bGF0ZWRNZXNzYWdlLmlkXSA9IGFjY3VtdWxhdGVkTWVzc2FnZTtcbiAgICBmb3IgKGNvbnN0IGNvbnRlbnQgb2YgbmV3Q29udGVudCkge1xuICAgICAgICBjb25zdCBzbmFwc2hvdENvbnRlbnQgPSBhY2N1bXVsYXRlZE1lc3NhZ2UuY29udGVudFtjb250ZW50LmluZGV4XTtcbiAgICAgICAgaWYgKHNuYXBzaG90Q29udGVudD8udHlwZSA9PSAndGV4dCcpIHtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3RleHRDcmVhdGVkJywgc25hcHNob3RDb250ZW50LnRleHQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHN3aXRjaCAoZXZlbnQuZXZlbnQpIHtcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuY3JlYXRlZCc6XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdtZXNzYWdlQ3JlYXRlZCcsIGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmluX3Byb2dyZXNzJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5kZWx0YSc6XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdtZXNzYWdlRGVsdGEnLCBldmVudC5kYXRhLmRlbHRhLCBhY2N1bXVsYXRlZE1lc3NhZ2UpO1xuICAgICAgICAgICAgaWYgKGV2ZW50LmRhdGEuZGVsdGEuY29udGVudCkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY29udGVudCBvZiBldmVudC5kYXRhLmRlbHRhLmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9JZiBpdCBpcyB0ZXh0IGRlbHRhLCBlbWl0IGEgdGV4dCBkZWx0YSBldmVudFxuICAgICAgICAgICAgICAgICAgICBpZiAoY29udGVudC50eXBlID09ICd0ZXh0JyAmJiBjb250ZW50LnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0ZXh0RGVsdGEgPSBjb250ZW50LnRleHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgc25hcHNob3QgPSBhY2N1bXVsYXRlZE1lc3NhZ2UuY29udGVudFtjb250ZW50LmluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzbmFwc2hvdCAmJiBzbmFwc2hvdC50eXBlID09ICd0ZXh0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3RleHREZWx0YScsIHRleHREZWx0YSwgc25hcHNob3QudGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcignVGhlIHNuYXBzaG90IGFzc29jaWF0ZWQgd2l0aCB0aGlzIHRleHQgZGVsdGEgaXMgbm90IHRleHQgb3IgbWlzc2luZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50LmluZGV4ICE9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudEluZGV4LCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vU2VlIGlmIHdlIGhhdmUgaW4gcHJvZ3Jlc3MgY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQsIFwiZlwiKS50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RleHQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndGV4dERvbmUnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnQsIFwiZlwiKS50ZXh0LCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2ltYWdlX2ZpbGUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnaW1hZ2VGaWxlRG9uZScsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCwgXCJmXCIpLmltYWdlX2ZpbGUsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9tZXNzYWdlU25hcHNob3QsIFwiZlwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleCwgY29udGVudC5pbmRleCwgXCJmXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50Q29udGVudCwgYWNjdW11bGF0ZWRNZXNzYWdlLmNvbnRlbnRbY29udGVudC5pbmRleF0sIFwiZlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuaW5jb21wbGV0ZSc6XG4gICAgICAgICAgICAvL1dlIGVtaXQgdGhlIGxhdGVzdCBjb250ZW50IHdlIHdlcmUgd29ya2luZyBvbiBvbiBjb21wbGV0aW9uIChpbmNsdWRpbmcgaW5jb21wbGV0ZSlcbiAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleCwgXCJmXCIpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50Q29udGVudCA9IGV2ZW50LmRhdGEuY29udGVudFtfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudENvbnRlbnRJbmRleCwgXCJmXCIpXTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudENvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChjdXJyZW50Q29udGVudC50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdpbWFnZV9maWxlJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdpbWFnZUZpbGVEb25lJywgY3VycmVudENvbnRlbnQuaW1hZ2VfZmlsZSwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RleHQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3RleHREb25lJywgY3VycmVudENvbnRlbnQudGV4dCwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fbWVzc2FnZVNuYXBzaG90LCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdtZXNzYWdlRG9uZScsIGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX21lc3NhZ2VTbmFwc2hvdCwgdW5kZWZpbmVkLCBcImZcIik7XG4gICAgfVxufSwgX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW5TdGVwID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVSdW5TdGVwKGV2ZW50KSB7XG4gICAgY29uc3QgYWNjdW11bGF0ZWRSdW5TdGVwID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZVJ1blN0ZXApLmNhbGwodGhpcywgZXZlbnQpO1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50UnVuU3RlcFNuYXBzaG90LCBhY2N1bXVsYXRlZFJ1blN0ZXAsIFwiZlwiKTtcbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jcmVhdGVkJzpcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3J1blN0ZXBDcmVhdGVkJywgZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmRlbHRhJzpcbiAgICAgICAgICAgIGNvbnN0IGRlbHRhID0gZXZlbnQuZGF0YS5kZWx0YTtcbiAgICAgICAgICAgIGlmIChkZWx0YS5zdGVwX2RldGFpbHMgJiZcbiAgICAgICAgICAgICAgICBkZWx0YS5zdGVwX2RldGFpbHMudHlwZSA9PSAndG9vbF9jYWxscycgJiZcbiAgICAgICAgICAgICAgICBkZWx0YS5zdGVwX2RldGFpbHMudG9vbF9jYWxscyAmJlxuICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkUnVuU3RlcC5zdGVwX2RldGFpbHMudHlwZSA9PSAndG9vbF9jYWxscycpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2xDYWxsIG9mIGRlbHRhLnN0ZXBfZGV0YWlscy50b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b29sQ2FsbC5pbmRleCA9PSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsSW5kZXgsIFwiZlwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbENhbGxEZWx0YScsIHRvb2xDYWxsLCBhY2N1bXVsYXRlZFJ1blN0ZXAuc3RlcF9kZXRhaWxzLnRvb2xfY2FsbHNbdG9vbENhbGwuaW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sQ2FsbERvbmUnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbEluZGV4LCB0b29sQ2FsbC5pbmRleCwgXCJmXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgYWNjdW11bGF0ZWRSdW5TdGVwLnN0ZXBfZGV0YWlscy50b29sX2NhbGxzW3Rvb2xDYWxsLmluZGV4XSwgXCJmXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9jdXJyZW50VG9vbENhbGwsIFwiZlwiKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCd0b29sQ2FsbENyZWF0ZWQnLCBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgncnVuU3RlcERlbHRhJywgZXZlbnQuZGF0YS5kZWx0YSwgYWNjdW11bGF0ZWRSdW5TdGVwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY29tcGxldGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmZhaWxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5jYW5jZWxsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZXhwaXJlZCc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFJ1blN0ZXBTbmFwc2hvdCwgdW5kZWZpbmVkLCBcImZcIik7XG4gICAgICAgICAgICBjb25zdCBkZXRhaWxzID0gZXZlbnQuZGF0YS5zdGVwX2RldGFpbHM7XG4gICAgICAgICAgICBpZiAoZGV0YWlscy50eXBlID09ICd0b29sX2NhbGxzJykge1xuICAgICAgICAgICAgICAgIGlmIChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCBcImZcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbENhbGxEb25lJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgdW5kZWZpbmVkLCBcImZcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZW1pdCgncnVuU3RlcERvbmUnLCBldmVudC5kYXRhLCBhY2N1bXVsYXRlZFJ1blN0ZXApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5pbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59LCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZUV2ZW50ID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9oYW5kbGVFdmVudChldmVudCkge1xuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ldmVudHMsIFwiZlwiKS5wdXNoKGV2ZW50KTtcbiAgICB0aGlzLl9lbWl0KCdldmVudCcsIGV2ZW50KTtcbn0sIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZVJ1blN0ZXAgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVSdW5TdGVwKGV2ZW50KSB7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY3JlYXRlZCc6XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdID0gZXZlbnQuZGF0YTtcbiAgICAgICAgICAgIHJldHVybiBldmVudC5kYXRhO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuZGVsdGEnOlxuICAgICAgICAgICAgbGV0IHNuYXBzaG90ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXTtcbiAgICAgICAgICAgIGlmICghc25hcHNob3QpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcignUmVjZWl2ZWQgYSBSdW5TdGVwRGVsdGEgYmVmb3JlIGNyZWF0aW9uIG9mIGEgc25hcHNob3QnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBkYXRhID0gZXZlbnQuZGF0YTtcbiAgICAgICAgICAgIGlmIChkYXRhLmRlbHRhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWNjdW11bGF0ZWQgPSBBc3Npc3RhbnRTdHJlYW0uYWNjdW11bGF0ZURlbHRhKHNuYXBzaG90LCBkYXRhLmRlbHRhKTtcbiAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdID0gYWNjdW11bGF0ZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXTtcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmNvbXBsZXRlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uc3RlcC5mYWlsZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuY2FuY2VsbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5zdGVwLmV4cGlyZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnN0ZXAuaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX3J1blN0ZXBTbmFwc2hvdHMsIFwiZlwiKVtldmVudC5kYXRhLmlkXSA9IGV2ZW50LmRhdGE7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG4gICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0Fzc2lzdGFudFN0cmVhbV9ydW5TdGVwU25hcHNob3RzLCBcImZcIilbZXZlbnQuZGF0YS5pZF0pXG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fcnVuU3RlcFNuYXBzaG90cywgXCJmXCIpW2V2ZW50LmRhdGEuaWRdO1xuICAgIHRocm93IG5ldyBFcnJvcignTm8gc25hcHNob3QgYXZhaWxhYmxlJyk7XG59LCBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVNZXNzYWdlID0gZnVuY3Rpb24gX0Fzc2lzdGFudFN0cmVhbV9hY2N1bXVsYXRlTWVzc2FnZShldmVudCwgc25hcHNob3QpIHtcbiAgICBsZXQgbmV3Q29udGVudCA9IFtdO1xuICAgIHN3aXRjaCAoZXZlbnQuZXZlbnQpIHtcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuY3JlYXRlZCc6XG4gICAgICAgICAgICAvL09uIGNyZWF0aW9uIHRoZSBzbmFwc2hvdCBpcyBqdXN0IHRoZSBpbml0aWFsIG1lc3NhZ2VcbiAgICAgICAgICAgIHJldHVybiBbZXZlbnQuZGF0YSwgbmV3Q29udGVudF07XG4gICAgICAgIGNhc2UgJ3RocmVhZC5tZXNzYWdlLmRlbHRhJzpcbiAgICAgICAgICAgIGlmICghc25hcHNob3QpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcignUmVjZWl2ZWQgYSBkZWx0YSB3aXRoIG5vIGV4aXN0aW5nIHNuYXBzaG90ICh0aGVyZSBzaG91bGQgYmUgb25lIGZyb20gbWVzc2FnZSBjcmVhdGlvbiknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBkYXRhID0gZXZlbnQuZGF0YTtcbiAgICAgICAgICAgIC8vSWYgdGhpcyBkZWx0YSBkb2VzIG5vdCBoYXZlIGNvbnRlbnQsIG5vdGhpbmcgdG8gcHJvY2Vzc1xuICAgICAgICAgICAgaWYgKGRhdGEuZGVsdGEuY29udGVudCkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY29udGVudEVsZW1lbnQgb2YgZGF0YS5kZWx0YS5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50RWxlbWVudC5pbmRleCBpbiBzbmFwc2hvdC5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudENvbnRlbnQgPSBzbmFwc2hvdC5jb250ZW50W2NvbnRlbnRFbGVtZW50LmluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNuYXBzaG90LmNvbnRlbnRbY29udGVudEVsZW1lbnQuaW5kZXhdID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZUNvbnRlbnQpLmNhbGwodGhpcywgY29udGVudEVsZW1lbnQsIGN1cnJlbnRDb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNuYXBzaG90LmNvbnRlbnRbY29udGVudEVsZW1lbnQuaW5kZXhdID0gY29udGVudEVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIGEgbmV3IGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbnRlbnQucHVzaChjb250ZW50RWxlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gW3NuYXBzaG90LCBuZXdDb250ZW50XTtcbiAgICAgICAgY2FzZSAndGhyZWFkLm1lc3NhZ2UuaW5fcHJvZ3Jlc3MnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQubWVzc2FnZS5pbmNvbXBsZXRlJzpcbiAgICAgICAgICAgIC8vTm8gY2hhbmdlcyBvbiBvdGhlciB0aHJlYWQgZXZlbnRzXG4gICAgICAgICAgICBpZiAoc25hcHNob3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW3NuYXBzaG90LCBuZXdDb250ZW50XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdSZWNlaXZlZCB0aHJlYWQgbWVzc2FnZSBldmVudCB3aXRoIG5vIGV4aXN0aW5nIHNuYXBzaG90Jyk7XG4gICAgICAgICAgICB9XG4gICAgfVxuICAgIHRocm93IEVycm9yKCdUcmllZCB0byBhY2N1bXVsYXRlIGEgbm9uLW1lc3NhZ2UgZXZlbnQnKTtcbn0sIF9Bc3Npc3RhbnRTdHJlYW1fYWNjdW11bGF0ZUNvbnRlbnQgPSBmdW5jdGlvbiBfQXNzaXN0YW50U3RyZWFtX2FjY3VtdWxhdGVDb250ZW50KGNvbnRlbnRFbGVtZW50LCBjdXJyZW50Q29udGVudCkge1xuICAgIHJldHVybiBBc3Npc3RhbnRTdHJlYW0uYWNjdW11bGF0ZURlbHRhKGN1cnJlbnRDb250ZW50LCBjb250ZW50RWxlbWVudCk7XG59LCBfQXNzaXN0YW50U3RyZWFtX2hhbmRsZVJ1biA9IGZ1bmN0aW9uIF9Bc3Npc3RhbnRTdHJlYW1faGFuZGxlUnVuKGV2ZW50KSB7XG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRSdW5TbmFwc2hvdCwgZXZlbnQuZGF0YSwgXCJmXCIpO1xuICAgIHN3aXRjaCAoZXZlbnQuZXZlbnQpIHtcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jcmVhdGVkJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLnF1ZXVlZCc6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5pbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5yZXF1aXJlc19hY3Rpb24nOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNhbmNlbGxlZCc6XG4gICAgICAgIGNhc2UgJ3RocmVhZC5ydW4uZmFpbGVkJzpcbiAgICAgICAgY2FzZSAndGhyZWFkLnJ1bi5jb21wbGV0ZWQnOlxuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmV4cGlyZWQnOlxuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2ZpbmFsUnVuLCBldmVudC5kYXRhLCBcImZcIik7XG4gICAgICAgICAgICBpZiAoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgndG9vbENhbGxEb25lJywgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQXNzaXN0YW50U3RyZWFtX2N1cnJlbnRUb29sQ2FsbCwgXCJmXCIpKTtcbiAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9Bc3Npc3RhbnRTdHJlYW1fY3VycmVudFRvb2xDYWxsLCB1bmRlZmluZWQsIFwiZlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0aHJlYWQucnVuLmNhbmNlbGxpbmcnOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcbmZ1bmN0aW9uIGFzc2VydE5ldmVyKF94KSB7IH1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUFzc2lzdGFudFN0cmVhbS5tanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lciwgfSBmcm9tIFwiLi9BYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyLm1qc1wiO1xuaW1wb3J0IHsgaXNBc3Npc3RhbnRNZXNzYWdlIH0gZnJvbSBcIi4vY2hhdENvbXBsZXRpb25VdGlscy5tanNcIjtcbmV4cG9ydCBjbGFzcyBDaGF0Q29tcGxldGlvblJ1bm5lciBleHRlbmRzIEFic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIge1xuICAgIC8qKiBAZGVwcmVjYXRlZCAtIHBsZWFzZSB1c2UgYHJ1blRvb2xzYCBpbnN0ZWFkLiAqL1xuICAgIHN0YXRpYyBydW5GdW5jdGlvbnMoY2xpZW50LCBwYXJhbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uUnVubmVyKCk7XG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdydW5GdW5jdGlvbnMnIH0sXG4gICAgICAgIH07XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuRnVuY3Rpb25zKGNsaWVudCwgcGFyYW1zLCBvcHRzKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIHN0YXRpYyBydW5Ub29scyhjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25SdW5uZXIoKTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ3J1blRvb2xzJyB9LFxuICAgICAgICB9O1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1blRvb2xzKGNsaWVudCwgcGFyYW1zLCBvcHRzKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIF9hZGRNZXNzYWdlKG1lc3NhZ2UsIGVtaXQgPSB0cnVlKSB7XG4gICAgICAgIHN1cGVyLl9hZGRNZXNzYWdlKG1lc3NhZ2UsIGVtaXQpO1xuICAgICAgICBpZiAoaXNBc3Npc3RhbnRNZXNzYWdlKG1lc3NhZ2UpICYmIG1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICAgICAgdGhpcy5fZW1pdCgnY29udGVudCcsIG1lc3NhZ2UuY29udGVudCk7XG4gICAgICAgIH1cbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1DaGF0Q29tcGxldGlvblJ1bm5lci5tanMubWFwIiwidmFyIF9fY2xhc3NQcml2YXRlRmllbGRTZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRTZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIHZhbHVlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB3cml0ZSBwcml2YXRlIG1lbWJlciB0byBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xufTtcbnZhciBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0ID0gKHRoaXMgJiYgdGhpcy5fX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KSB8fCBmdW5jdGlvbiAocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgZ2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XG59O1xudmFyIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYmVnaW5SZXF1ZXN0LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0Q2hvaWNlRXZlbnRTdGF0ZSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FkZENodW5rLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdFRvb2xDYWxsRG9uZUV2ZW50LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdENvbnRlbnREb25lRXZlbnRzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW5kUmVxdWVzdCwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldEF1dG9QYXJzZWFibGVSZXNwb25zZUZvcm1hdCwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FjY3VtdWxhdGVDaGF0Q29tcGxldGlvbjtcbmltcG9ydCB7IE9wZW5BSUVycm9yLCBBUElVc2VyQWJvcnRFcnJvciwgTGVuZ3RoRmluaXNoUmVhc29uRXJyb3IsIENvbnRlbnRGaWx0ZXJGaW5pc2hSZWFzb25FcnJvciwgfSBmcm9tIFwiLi4vZXJyb3IubWpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdENoYXRDb21wbGV0aW9uUnVubmVyLCB9IGZyb20gXCIuL0Fic3RyYWN0Q2hhdENvbXBsZXRpb25SdW5uZXIubWpzXCI7XG5pbXBvcnQgeyBTdHJlYW0gfSBmcm9tIFwiLi4vc3RyZWFtaW5nLm1qc1wiO1xuaW1wb3J0IHsgaGFzQXV0b1BhcnNlYWJsZUlucHV0LCBpc0F1dG9QYXJzYWJsZVJlc3BvbnNlRm9ybWF0LCBpc0F1dG9QYXJzYWJsZVRvb2wsIG1heWJlUGFyc2VDaGF0Q29tcGxldGlvbiwgc2hvdWxkUGFyc2VUb29sQ2FsbCwgfSBmcm9tIFwiLi4vbGliL3BhcnNlci5tanNcIjtcbmltcG9ydCB7IHBhcnRpYWxQYXJzZSB9IGZyb20gXCIuLi9fdmVuZG9yL3BhcnRpYWwtanNvbi1wYXJzZXIvcGFyc2VyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENoYXRDb21wbGV0aW9uU3RyZWFtIGV4dGVuZHMgQWJzdHJhY3RDaGF0Q29tcGxldGlvblJ1bm5lciB7XG4gICAgY29uc3RydWN0b3IocGFyYW1zKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMuYWRkKHRoaXMpO1xuICAgICAgICBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMuc2V0KHRoaXMsIHZvaWQgMCk7XG4gICAgICAgIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdC5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBwYXJhbXMsIFwiZlwiKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMsIFtdLCBcImZcIik7XG4gICAgfVxuICAgIGdldCBjdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCgpIHtcbiAgICAgICAgcmV0dXJuIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCBcImZcIik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEludGVuZGVkIGZvciB1c2Ugb24gdGhlIGZyb250ZW5kLCBjb25zdW1pbmcgYSBzdHJlYW0gcHJvZHVjZWQgd2l0aFxuICAgICAqIGAudG9SZWFkYWJsZVN0cmVhbSgpYCBvbiB0aGUgYmFja2VuZC5cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCBtZXNzYWdlcyBzZW50IHRvIHRoZSBtb2RlbCBkbyBub3QgYXBwZWFyIGluIGAub24oJ21lc3NhZ2UnKWBcbiAgICAgKiBpbiB0aGlzIGNvbnRleHQuXG4gICAgICovXG4gICAgc3RhdGljIGZyb21SZWFkYWJsZVN0cmVhbShzdHJlYW0pIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uU3RyZWFtKG51bGwpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX2Zyb21SZWFkYWJsZVN0cmVhbShzdHJlYW0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgc3RhdGljIGNyZWF0ZUNoYXRDb21wbGV0aW9uKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBDaGF0Q29tcGxldGlvblN0cmVhbShwYXJhbXMpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX3J1bkNoYXRDb21wbGV0aW9uKGNsaWVudCwgeyAuLi5wYXJhbXMsIHN0cmVhbTogdHJ1ZSB9LCB7IC4uLm9wdGlvbnMsIGhlYWRlcnM6IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLUhlbHBlci1NZXRob2QnOiAnc3RyZWFtJyB9IH0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgYXN5bmMgX2NyZWF0ZUNoYXRDb21wbGV0aW9uKGNsaWVudCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyLl9jcmVhdGVDaGF0Q29tcGxldGlvbjtcbiAgICAgICAgY29uc3Qgc2lnbmFsID0gb3B0aW9ucz8uc2lnbmFsO1xuICAgICAgICBpZiAoc2lnbmFsKSB7XG4gICAgICAgICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICBzaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB0aGlzLmNvbnRyb2xsZXIuYWJvcnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2JlZ2luUmVxdWVzdCkuY2FsbCh0aGlzKTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgY2xpZW50LmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKHsgLi4ucGFyYW1zLCBzdHJlYW06IHRydWUgfSwgeyAuLi5vcHRpb25zLCBzaWduYWw6IHRoaXMuY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbSkge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FkZENodW5rKS5jYWxsKHRoaXMsIGNodW5rKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyZWFtLmNvbnRyb2xsZXIuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hhdENvbXBsZXRpb24oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgIH1cbiAgICBhc3luYyBfZnJvbVJlYWRhYmxlU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHNpZ25hbCA9IG9wdGlvbnM/LnNpZ25hbDtcbiAgICAgICAgaWYgKHNpZ25hbCkge1xuICAgICAgICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgKCkgPT4gdGhpcy5jb250cm9sbGVyLmFib3J0KCkpO1xuICAgICAgICB9XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9iZWdpblJlcXVlc3QpLmNhbGwodGhpcyk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RlZCgpO1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBTdHJlYW0uZnJvbVJlYWRhYmxlU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCB0aGlzLmNvbnRyb2xsZXIpO1xuICAgICAgICBsZXQgY2hhdElkO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbSkge1xuICAgICAgICAgICAgaWYgKGNoYXRJZCAmJiBjaGF0SWQgIT09IGNodW5rLmlkKSB7XG4gICAgICAgICAgICAgICAgLy8gQSBuZXcgcmVxdWVzdCBoYXMgYmVlbiBtYWRlLlxuICAgICAgICAgICAgICAgIHRoaXMuX2FkZENoYXRDb21wbGV0aW9uKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbmRSZXF1ZXN0KS5jYWxsKHRoaXMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hZGRDaHVuaykuY2FsbCh0aGlzLCBjaHVuayk7XG4gICAgICAgICAgICBjaGF0SWQgPSBjaHVuay5pZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RyZWFtLmNvbnRyb2xsZXIuc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQVBJVXNlckFib3J0RXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hhdENvbXBsZXRpb24oX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VuZFJlcXVlc3QpLmNhbGwodGhpcykpO1xuICAgIH1cbiAgICBbKF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMgPSBuZXcgV2Vha01hcCgpLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMgPSBuZXcgV2Vha01hcCgpLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QgPSBuZXcgV2Vha01hcCgpLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzID0gbmV3IFdlYWtTZXQoKSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2JlZ2luUmVxdWVzdCA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9iZWdpblJlcXVlc3QoKSB7XG4gICAgICAgIGlmICh0aGlzLmVuZGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jdXJyZW50Q2hhdENvbXBsZXRpb25TbmFwc2hvdCwgdW5kZWZpbmVkLCBcImZcIik7XG4gICAgfSwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldENob2ljZUV2ZW50U3RhdGUgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0Q2hvaWNlRXZlbnRTdGF0ZShjaG9pY2UpIHtcbiAgICAgICAgbGV0IHN0YXRlID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY2hvaWNlRXZlbnRTdGF0ZXMsIFwiZlwiKVtjaG9pY2UuaW5kZXhdO1xuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZSA9IHtcbiAgICAgICAgICAgIGNvbnRlbnRfZG9uZTogZmFsc2UsXG4gICAgICAgICAgICByZWZ1c2FsX2RvbmU6IGZhbHNlLFxuICAgICAgICAgICAgbG9ncHJvYnNfY29udGVudF9kb25lOiBmYWxzZSxcbiAgICAgICAgICAgIGxvZ3Byb2JzX3JlZnVzYWxfZG9uZTogZmFsc2UsXG4gICAgICAgICAgICBkb25lX3Rvb2xfY2FsbHM6IG5ldyBTZXQoKSxcbiAgICAgICAgICAgIGN1cnJlbnRfdG9vbF9jYWxsX2luZGV4OiBudWxsLFxuICAgICAgICB9O1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcywgXCJmXCIpW2Nob2ljZS5pbmRleF0gPSBzdGF0ZTtcbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hZGRDaHVuayA9IGZ1bmN0aW9uIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hZGRDaHVuayhjaHVuaykge1xuICAgICAgICBpZiAodGhpcy5lbmRlZClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgY29tcGxldGlvbiA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9hY2N1bXVsYXRlQ2hhdENvbXBsZXRpb24pLmNhbGwodGhpcywgY2h1bmspO1xuICAgICAgICB0aGlzLl9lbWl0KCdjaHVuaycsIGNodW5rLCBjb21wbGV0aW9uKTtcbiAgICAgICAgZm9yIChjb25zdCBjaG9pY2Ugb2YgY2h1bmsuY2hvaWNlcykge1xuICAgICAgICAgICAgY29uc3QgY2hvaWNlU25hcHNob3QgPSBjb21wbGV0aW9uLmNob2ljZXNbY2hvaWNlLmluZGV4XTtcbiAgICAgICAgICAgIGlmIChjaG9pY2UuZGVsdGEuY29udGVudCAhPSBudWxsICYmXG4gICAgICAgICAgICAgICAgY2hvaWNlU25hcHNob3QubWVzc2FnZT8ucm9sZSA9PT0gJ2Fzc2lzdGFudCcgJiZcbiAgICAgICAgICAgICAgICBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlPy5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnY29udGVudCcsIGNob2ljZS5kZWx0YS5jb250ZW50LCBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2NvbnRlbnQuZGVsdGEnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRlbHRhOiBjaG9pY2UuZGVsdGEuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgc25hcHNob3Q6IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VkOiBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLnBhcnNlZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjaG9pY2UuZGVsdGEucmVmdXNhbCAhPSBudWxsICYmXG4gICAgICAgICAgICAgICAgY2hvaWNlU25hcHNob3QubWVzc2FnZT8ucm9sZSA9PT0gJ2Fzc2lzdGFudCcgJiZcbiAgICAgICAgICAgICAgICBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlPy5yZWZ1c2FsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgncmVmdXNhbC5kZWx0YScsIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsdGE6IGNob2ljZS5kZWx0YS5yZWZ1c2FsLFxuICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdDogY2hvaWNlU25hcHNob3QubWVzc2FnZS5yZWZ1c2FsLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNob2ljZS5sb2dwcm9icz8uY29udGVudCAhPSBudWxsICYmIGNob2ljZVNuYXBzaG90Lm1lc3NhZ2U/LnJvbGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZW1pdCgnbG9ncHJvYnMuY29udGVudC5kZWx0YScsIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogY2hvaWNlLmxvZ3Byb2JzPy5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdDogY2hvaWNlU25hcHNob3QubG9ncHJvYnM/LmNvbnRlbnQgPz8gW10sXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2hvaWNlLmxvZ3Byb2JzPy5yZWZ1c2FsICE9IG51bGwgJiYgY2hvaWNlU25hcHNob3QubWVzc2FnZT8ucm9sZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbWl0KCdsb2dwcm9icy5yZWZ1c2FsLmRlbHRhJywge1xuICAgICAgICAgICAgICAgICAgICByZWZ1c2FsOiBjaG9pY2UubG9ncHJvYnM/LnJlZnVzYWwsXG4gICAgICAgICAgICAgICAgICAgIHNuYXBzaG90OiBjaG9pY2VTbmFwc2hvdC5sb2dwcm9icz8ucmVmdXNhbCA/PyBbXSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldENob2ljZUV2ZW50U3RhdGUpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QpO1xuICAgICAgICAgICAgaWYgKGNob2ljZVNuYXBzaG90LmZpbmlzaF9yZWFzb24pIHtcbiAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdENvbnRlbnREb25lRXZlbnRzKS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90KTtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGUuY3VycmVudF90b29sX2NhbGxfaW5kZXggIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdFRvb2xDYWxsRG9uZUV2ZW50KS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90LCBzdGF0ZS5jdXJyZW50X3Rvb2xfY2FsbF9pbmRleCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sQ2FsbCBvZiBjaG9pY2UuZGVsdGEudG9vbF9jYWxscyA/PyBbXSkge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZS5jdXJyZW50X3Rvb2xfY2FsbF9pbmRleCAhPT0gdG9vbENhbGwuaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VtaXRDb250ZW50RG9uZUV2ZW50cykuY2FsbCh0aGlzLCBjaG9pY2VTbmFwc2hvdCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5ldyB0b29sIGNhbGwgc3RhcnRlZCwgdGhlIHByZXZpb3VzIG9uZSBpcyBkb25lXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0ZS5jdXJyZW50X3Rvb2xfY2FsbF9pbmRleCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9pbnN0YW5jZXMsIFwibVwiLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdFRvb2xDYWxsRG9uZUV2ZW50KS5jYWxsKHRoaXMsIGNob2ljZVNuYXBzaG90LCBzdGF0ZS5jdXJyZW50X3Rvb2xfY2FsbF9pbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3RhdGUuY3VycmVudF90b29sX2NhbGxfaW5kZXggPSB0b29sQ2FsbC5pbmRleDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbENhbGxEZWx0YSBvZiBjaG9pY2UuZGVsdGEudG9vbF9jYWxscyA/PyBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xDYWxsU25hcHNob3QgPSBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLnRvb2xfY2FsbHM/Llt0b29sQ2FsbERlbHRhLmluZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAoIXRvb2xDYWxsU25hcHNob3Q/LnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0b29sQ2FsbFNuYXBzaG90Py50eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xfY2FsbHMuZnVuY3Rpb24uYXJndW1lbnRzLmRlbHRhJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbj8ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiB0b29sQ2FsbERlbHRhLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJndW1lbnRzOiB0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLmFyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlZF9hcmd1bWVudHM6IHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24ucGFyc2VkX2FyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50c19kZWx0YTogdG9vbENhbGxEZWx0YS5mdW5jdGlvbj8uYXJndW1lbnRzID8/ICcnLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydE5ldmVyKHRvb2xDYWxsU25hcHNob3Q/LnR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0VG9vbENhbGxEb25lRXZlbnQgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdFRvb2xDYWxsRG9uZUV2ZW50KGNob2ljZVNuYXBzaG90LCB0b29sQ2FsbEluZGV4KSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldENob2ljZUV2ZW50U3RhdGUpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QpO1xuICAgICAgICBpZiAoc3RhdGUuZG9uZV90b29sX2NhbGxzLmhhcyh0b29sQ2FsbEluZGV4KSkge1xuICAgICAgICAgICAgLy8gd2UndmUgYWxyZWFkeSBmaXJlZCB0aGUgZG9uZSBldmVudFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRvb2xDYWxsU25hcHNob3QgPSBjaG9pY2VTbmFwc2hvdC5tZXNzYWdlLnRvb2xfY2FsbHM/Llt0b29sQ2FsbEluZGV4XTtcbiAgICAgICAgaWYgKCF0b29sQ2FsbFNuYXBzaG90KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIHRvb2wgY2FsbCBzbmFwc2hvdCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdG9vbENhbGxTbmFwc2hvdC50eXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Rvb2wgY2FsbCBzbmFwc2hvdCBtaXNzaW5nIGB0eXBlYCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0b29sQ2FsbFNuYXBzaG90LnR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0VG9vbCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgXCJmXCIpPy50b29scz8uZmluZCgodG9vbCkgPT4gdG9vbC50eXBlID09PSAnZnVuY3Rpb24nICYmIHRvb2wuZnVuY3Rpb24ubmFtZSA9PT0gdG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5uYW1lKTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ3Rvb2xfY2FsbHMuZnVuY3Rpb24uYXJndW1lbnRzLmRvbmUnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogdG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5uYW1lLFxuICAgICAgICAgICAgICAgIGluZGV4OiB0b29sQ2FsbEluZGV4LFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50czogdG9vbENhbGxTbmFwc2hvdC5mdW5jdGlvbi5hcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgcGFyc2VkX2FyZ3VtZW50czogaXNBdXRvUGFyc2FibGVUb29sKGlucHV0VG9vbCkgPyBpbnB1dFRvb2wuJHBhcnNlUmF3KHRvb2xDYWxsU25hcHNob3QuZnVuY3Rpb24uYXJndW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICA6IGlucHV0VG9vbD8uZnVuY3Rpb24uc3RyaWN0ID8gSlNPTi5wYXJzZSh0b29sQ2FsbFNuYXBzaG90LmZ1bmN0aW9uLmFyZ3VtZW50cylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVsbCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYXNzZXJ0TmV2ZXIodG9vbENhbGxTbmFwc2hvdC50eXBlKTtcbiAgICAgICAgfVxuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbWl0Q29udGVudERvbmVFdmVudHMgPSBmdW5jdGlvbiBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZW1pdENvbnRlbnREb25lRXZlbnRzKGNob2ljZVNuYXBzaG90KSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldENob2ljZUV2ZW50U3RhdGUpLmNhbGwodGhpcywgY2hvaWNlU25hcHNob3QpO1xuICAgICAgICBpZiAoY2hvaWNlU25hcHNob3QubWVzc2FnZS5jb250ZW50ICYmICFzdGF0ZS5jb250ZW50X2RvbmUpIHtcbiAgICAgICAgICAgIHN0YXRlLmNvbnRlbnRfZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZUZvcm1hdCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRBdXRvUGFyc2VhYmxlUmVzcG9uc2VGb3JtYXQpLmNhbGwodGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdjb250ZW50LmRvbmUnLCB7XG4gICAgICAgICAgICAgICAgY29udGVudDogY2hvaWNlU25hcHNob3QubWVzc2FnZS5jb250ZW50LFxuICAgICAgICAgICAgICAgIHBhcnNlZDogcmVzcG9uc2VGb3JtYXQgPyByZXNwb25zZUZvcm1hdC4kcGFyc2VSYXcoY2hvaWNlU25hcHNob3QubWVzc2FnZS5jb250ZW50KSA6IG51bGwsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hvaWNlU25hcHNob3QubWVzc2FnZS5yZWZ1c2FsICYmICFzdGF0ZS5yZWZ1c2FsX2RvbmUpIHtcbiAgICAgICAgICAgIHN0YXRlLnJlZnVzYWxfZG9uZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdyZWZ1c2FsLmRvbmUnLCB7IHJlZnVzYWw6IGNob2ljZVNuYXBzaG90Lm1lc3NhZ2UucmVmdXNhbCB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hvaWNlU25hcHNob3QubG9ncHJvYnM/LmNvbnRlbnQgJiYgIXN0YXRlLmxvZ3Byb2JzX2NvbnRlbnRfZG9uZSkge1xuICAgICAgICAgICAgc3RhdGUubG9ncHJvYnNfY29udGVudF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2xvZ3Byb2JzLmNvbnRlbnQuZG9uZScsIHsgY29udGVudDogY2hvaWNlU25hcHNob3QubG9ncHJvYnMuY29udGVudCB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hvaWNlU25hcHNob3QubG9ncHJvYnM/LnJlZnVzYWwgJiYgIXN0YXRlLmxvZ3Byb2JzX3JlZnVzYWxfZG9uZSkge1xuICAgICAgICAgICAgc3RhdGUubG9ncHJvYnNfcmVmdXNhbF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2xvZ3Byb2JzLnJlZnVzYWwuZG9uZScsIHsgcmVmdXNhbDogY2hvaWNlU25hcHNob3QubG9ncHJvYnMucmVmdXNhbCB9KTtcbiAgICAgICAgfVxuICAgIH0sIF9DaGF0Q29tcGxldGlvblN0cmVhbV9lbmRSZXF1ZXN0ID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2VuZFJlcXVlc3QoKSB7XG4gICAgICAgIGlmICh0aGlzLmVuZGVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYHN0cmVhbSBoYXMgZW5kZWQsIHRoaXMgc2hvdWxkbid0IGhhcHBlbmApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNuYXBzaG90ID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIFwiZlwiKTtcbiAgICAgICAgaWYgKCFzbmFwc2hvdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGByZXF1ZXN0IGVuZGVkIHdpdGhvdXQgc2VuZGluZyBhbnkgY2h1bmtzYCk7XG4gICAgICAgIH1cbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIHVuZGVmaW5lZCwgXCJmXCIpO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9jaG9pY2VFdmVudFN0YXRlcywgW10sIFwiZlwiKTtcbiAgICAgICAgcmV0dXJuIGZpbmFsaXplQ2hhdENvbXBsZXRpb24oc25hcHNob3QsIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgXCJmXCIpKTtcbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fZ2V0QXV0b1BhcnNlYWJsZVJlc3BvbnNlRm9ybWF0ID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2dldEF1dG9QYXJzZWFibGVSZXNwb25zZUZvcm1hdCgpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2VGb3JtYXQgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIFwiZlwiKT8ucmVzcG9uc2VfZm9ybWF0O1xuICAgICAgICBpZiAoaXNBdXRvUGFyc2FibGVSZXNwb25zZUZvcm1hdChyZXNwb25zZUZvcm1hdCkpIHtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZUZvcm1hdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fYWNjdW11bGF0ZUNoYXRDb21wbGV0aW9uID0gZnVuY3Rpb24gX0NoYXRDb21wbGV0aW9uU3RyZWFtX2FjY3VtdWxhdGVDaGF0Q29tcGxldGlvbihjaHVuaykge1xuICAgICAgICB2YXIgX2EsIF9iLCBfYywgX2Q7XG4gICAgICAgIGxldCBzbmFwc2hvdCA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2N1cnJlbnRDaGF0Q29tcGxldGlvblNuYXBzaG90LCBcImZcIik7XG4gICAgICAgIGNvbnN0IHsgY2hvaWNlcywgLi4ucmVzdCB9ID0gY2h1bms7XG4gICAgICAgIGlmICghc25hcHNob3QpIHtcbiAgICAgICAgICAgIHNuYXBzaG90ID0gX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fY3VycmVudENoYXRDb21wbGV0aW9uU25hcHNob3QsIHtcbiAgICAgICAgICAgICAgICAuLi5yZXN0LFxuICAgICAgICAgICAgICAgIGNob2ljZXM6IFtdLFxuICAgICAgICAgICAgfSwgXCJmXCIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihzbmFwc2hvdCwgcmVzdCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCB7IGRlbHRhLCBmaW5pc2hfcmVhc29uLCBpbmRleCwgbG9ncHJvYnMgPSBudWxsLCAuLi5vdGhlciB9IG9mIGNodW5rLmNob2ljZXMpIHtcbiAgICAgICAgICAgIGxldCBjaG9pY2UgPSBzbmFwc2hvdC5jaG9pY2VzW2luZGV4XTtcbiAgICAgICAgICAgIGlmICghY2hvaWNlKSB7XG4gICAgICAgICAgICAgICAgY2hvaWNlID0gc25hcHNob3QuY2hvaWNlc1tpbmRleF0gPSB7IGZpbmlzaF9yZWFzb24sIGluZGV4LCBtZXNzYWdlOiB7fSwgbG9ncHJvYnMsIC4uLm90aGVyIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobG9ncHJvYnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNob2ljZS5sb2dwcm9icykge1xuICAgICAgICAgICAgICAgICAgICBjaG9pY2UubG9ncHJvYnMgPSBPYmplY3QuYXNzaWduKHt9LCBsb2dwcm9icyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHJlZnVzYWwsIC4uLnJlc3QgfSA9IGxvZ3Byb2JzO1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnRJc0VtcHR5KHJlc3QpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGNob2ljZS5sb2dwcm9icywgcmVzdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoX2EgPSBjaG9pY2UubG9ncHJvYnMpLmNvbnRlbnQgPz8gKF9hLmNvbnRlbnQgPSBbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2UubG9ncHJvYnMuY29udGVudC5wdXNoKC4uLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWZ1c2FsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoX2IgPSBjaG9pY2UubG9ncHJvYnMpLnJlZnVzYWwgPz8gKF9iLnJlZnVzYWwgPSBbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2UubG9ncHJvYnMucmVmdXNhbC5wdXNoKC4uLnJlZnVzYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZpbmlzaF9yZWFzb24pIHtcbiAgICAgICAgICAgICAgICBjaG9pY2UuZmluaXNoX3JlYXNvbiA9IGZpbmlzaF9yZWFzb247XG4gICAgICAgICAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX3BhcmFtcywgXCJmXCIpICYmIGhhc0F1dG9QYXJzZWFibGVJbnB1dChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9wYXJhbXMsIFwiZlwiKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbmlzaF9yZWFzb24gPT09ICdsZW5ndGgnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTGVuZ3RoRmluaXNoUmVhc29uRXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoZmluaXNoX3JlYXNvbiA9PT0gJ2NvbnRlbnRfZmlsdGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IENvbnRlbnRGaWx0ZXJGaW5pc2hSZWFzb25FcnJvcigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjaG9pY2UsIG90aGVyKTtcbiAgICAgICAgICAgIGlmICghZGVsdGEpXG4gICAgICAgICAgICAgICAgY29udGludWU7IC8vIFNob3VsZG4ndCBoYXBwZW47IGp1c3QgaW4gY2FzZS5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgcmVmdXNhbCwgZnVuY3Rpb25fY2FsbCwgcm9sZSwgdG9vbF9jYWxscywgLi4ucmVzdCB9ID0gZGVsdGE7XG4gICAgICAgICAgICBhc3NlcnRJc0VtcHR5KHJlc3QpO1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjaG9pY2UubWVzc2FnZSwgcmVzdCk7XG4gICAgICAgICAgICBpZiAocmVmdXNhbCkge1xuICAgICAgICAgICAgICAgIGNob2ljZS5tZXNzYWdlLnJlZnVzYWwgPSAoY2hvaWNlLm1lc3NhZ2UucmVmdXNhbCB8fCAnJykgKyByZWZ1c2FsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJvbGUpXG4gICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2Uucm9sZSA9IHJvbGU7XG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25fY2FsbCkge1xuICAgICAgICAgICAgICAgIGlmICghY2hvaWNlLm1lc3NhZ2UuZnVuY3Rpb25fY2FsbCkge1xuICAgICAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5mdW5jdGlvbl9jYWxsID0gZnVuY3Rpb25fY2FsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmdW5jdGlvbl9jYWxsLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5mdW5jdGlvbl9jYWxsLm5hbWUgPSBmdW5jdGlvbl9jYWxsLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmdW5jdGlvbl9jYWxsLmFyZ3VtZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgKF9jID0gY2hvaWNlLm1lc3NhZ2UuZnVuY3Rpb25fY2FsbCkuYXJndW1lbnRzID8/IChfYy5hcmd1bWVudHMgPSAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS5mdW5jdGlvbl9jYWxsLmFyZ3VtZW50cyArPSBmdW5jdGlvbl9jYWxsLmFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UuY29udGVudCA9IChjaG9pY2UubWVzc2FnZS5jb250ZW50IHx8ICcnKSArIGNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgaWYgKCFjaG9pY2UubWVzc2FnZS5yZWZ1c2FsICYmIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0NoYXRDb21wbGV0aW9uU3RyZWFtX2luc3RhbmNlcywgXCJtXCIsIF9DaGF0Q29tcGxldGlvblN0cmVhbV9nZXRBdXRvUGFyc2VhYmxlUmVzcG9uc2VGb3JtYXQpLmNhbGwodGhpcykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hvaWNlLm1lc3NhZ2UucGFyc2VkID0gcGFydGlhbFBhcnNlKGNob2ljZS5tZXNzYWdlLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0b29sX2NhbGxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjaG9pY2UubWVzc2FnZS50b29sX2NhbGxzKVxuICAgICAgICAgICAgICAgICAgICBjaG9pY2UubWVzc2FnZS50b29sX2NhbGxzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB7IGluZGV4LCBpZCwgdHlwZSwgZnVuY3Rpb246IGZuLCAuLi5yZXN0IH0gb2YgdG9vbF9jYWxscykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b29sX2NhbGwgPSAoKF9kID0gY2hvaWNlLm1lc3NhZ2UudG9vbF9jYWxscylbaW5kZXhdID8/IChfZFtpbmRleF0gPSB7fSkpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKHRvb2xfY2FsbCwgcmVzdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpZClcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbC5pZCA9IGlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbC50eXBlID0gdHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZuKVxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbF9jYWxsLmZ1bmN0aW9uID8/ICh0b29sX2NhbGwuZnVuY3Rpb24gPSB7IG5hbWU6IGZuLm5hbWUgPz8gJycsIGFyZ3VtZW50czogJycgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmbj8ubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbC5mdW5jdGlvbi5uYW1lID0gZm4ubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZuPy5hcmd1bWVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbC5mdW5jdGlvbi5hcmd1bWVudHMgKz0gZm4uYXJndW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNob3VsZFBhcnNlVG9vbENhbGwoX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfQ2hhdENvbXBsZXRpb25TdHJlYW1fcGFyYW1zLCBcImZcIiksIHRvb2xfY2FsbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sX2NhbGwuZnVuY3Rpb24ucGFyc2VkX2FyZ3VtZW50cyA9IHBhcnRpYWxQYXJzZSh0b29sX2NhbGwuZnVuY3Rpb24uYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc25hcHNob3Q7XG4gICAgfSwgU3ltYm9sLmFzeW5jSXRlcmF0b3IpXSgpIHtcbiAgICAgICAgY29uc3QgcHVzaFF1ZXVlID0gW107XG4gICAgICAgIGNvbnN0IHJlYWRRdWV1ZSA9IFtdO1xuICAgICAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLm9uKCdjaHVuaycsIChjaHVuaykgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVhZGVyID0gcmVhZFF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICBpZiAocmVhZGVyKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlc29sdmUoY2h1bmspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcHVzaFF1ZXVlLnB1c2goY2h1bmspO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlYWRlciBvZiByZWFkUXVldWUpIHtcbiAgICAgICAgICAgICAgICByZWFkZXIucmVzb2x2ZSh1bmRlZmluZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVhZFF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uKCdhYm9ydCcsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVhZFF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgcmVhZGVyLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVhZFF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmV4dDogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcHVzaFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkUXVldWUucHVzaCh7IHJlc29sdmUsIHJlamVjdCB9KSkudGhlbigoY2h1bmspID0+IChjaHVuayA/IHsgdmFsdWU6IGNodW5rLCBkb25lOiBmYWxzZSB9IDogeyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBwdXNoUXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogY2h1bmssIGRvbmU6IGZhbHNlIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmV0dXJuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgfVxuICAgIHRvUmVhZGFibGVTdHJlYW0oKSB7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IG5ldyBTdHJlYW0odGhpc1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0uYmluZCh0aGlzKSwgdGhpcy5jb250cm9sbGVyKTtcbiAgICAgICAgcmV0dXJuIHN0cmVhbS50b1JlYWRhYmxlU3RyZWFtKCk7XG4gICAgfVxufVxuZnVuY3Rpb24gZmluYWxpemVDaGF0Q29tcGxldGlvbihzbmFwc2hvdCwgcGFyYW1zKSB7XG4gICAgY29uc3QgeyBpZCwgY2hvaWNlcywgY3JlYXRlZCwgbW9kZWwsIHN5c3RlbV9maW5nZXJwcmludCwgLi4ucmVzdCB9ID0gc25hcHNob3Q7XG4gICAgY29uc3QgY29tcGxldGlvbiA9IHtcbiAgICAgICAgLi4ucmVzdCxcbiAgICAgICAgaWQsXG4gICAgICAgIGNob2ljZXM6IGNob2ljZXMubWFwKCh7IG1lc3NhZ2UsIGZpbmlzaF9yZWFzb24sIGluZGV4LCBsb2dwcm9icywgLi4uY2hvaWNlUmVzdCB9KSA9PiB7XG4gICAgICAgICAgICBpZiAoIWZpbmlzaF9yZWFzb24pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgZmluaXNoX3JlYXNvbiBmb3IgY2hvaWNlICR7aW5kZXh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQgPSBudWxsLCBmdW5jdGlvbl9jYWxsLCB0b29sX2NhbGxzLCAuLi5tZXNzYWdlUmVzdCB9ID0gbWVzc2FnZTtcbiAgICAgICAgICAgIGNvbnN0IHJvbGUgPSBtZXNzYWdlLnJvbGU7IC8vIHRoaXMgaXMgd2hhdCB3ZSBleHBlY3Q7IGluIHRoZW9yeSBpdCBjb3VsZCBiZSBkaWZmZXJlbnQgd2hpY2ggd291bGQgbWFrZSBvdXIgdHlwZXMgYSBzbGlnaHQgbGllIGJ1dCB3b3VsZCBiZSBmaW5lLlxuICAgICAgICAgICAgaWYgKCFyb2xlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIHJvbGUgZm9yIGNob2ljZSAke2luZGV4fWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZ1bmN0aW9uX2NhbGwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGFyZ3VtZW50czogYXJncywgbmFtZSB9ID0gZnVuY3Rpb25fY2FsbDtcbiAgICAgICAgICAgICAgICBpZiAoYXJncyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBmdW5jdGlvbl9jYWxsLmFyZ3VtZW50cyBmb3IgY2hvaWNlICR7aW5kZXh9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgZnVuY3Rpb25fY2FsbC5uYW1lIGZvciBjaG9pY2UgJHtpbmRleH1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgLi4uY2hvaWNlUmVzdCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uX2NhbGw6IHsgYXJndW1lbnRzOiBhcmdzLCBuYW1lIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICByb2xlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVmdXNhbDogbWVzc2FnZS5yZWZ1c2FsID8/IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaF9yZWFzb24sXG4gICAgICAgICAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgICAgICAgICBsb2dwcm9icyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRvb2xfY2FsbHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAuLi5jaG9pY2VSZXN0LFxuICAgICAgICAgICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoX3JlYXNvbixcbiAgICAgICAgICAgICAgICAgICAgbG9ncHJvYnMsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLm1lc3NhZ2VSZXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgcm9sZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWZ1c2FsOiBtZXNzYWdlLnJlZnVzYWwgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xfY2FsbHM6IHRvb2xfY2FsbHMubWFwKCh0b29sX2NhbGwsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGZ1bmN0aW9uOiBmbiwgdHlwZSwgaWQsIC4uLnRvb2xSZXN0IH0gPSB0b29sX2NhbGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBhcmd1bWVudHM6IGFyZ3MsIG5hbWUsIC4uLmZuUmVzdCB9ID0gZm4gfHwge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGNob2ljZXNbJHtpbmRleH1dLnRvb2xfY2FsbHNbJHtpfV0uaWRcXG4ke3N0cihzbmFwc2hvdCl9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBtaXNzaW5nIGNob2ljZXNbJHtpbmRleH1dLnRvb2xfY2FsbHNbJHtpfV0udHlwZVxcbiR7c3RyKHNuYXBzaG90KX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgT3BlbkFJRXJyb3IoYG1pc3NpbmcgY2hvaWNlc1ske2luZGV4fV0udG9vbF9jYWxsc1ske2l9XS5mdW5jdGlvbi5uYW1lXFxuJHtzdHIoc25hcHNob3QpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgbWlzc2luZyBjaG9pY2VzWyR7aW5kZXh9XS50b29sX2NhbGxzWyR7aX1dLmZ1bmN0aW9uLmFyZ3VtZW50c1xcbiR7c3RyKHNuYXBzaG90KX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgLi4udG9vbFJlc3QsIGlkLCB0eXBlLCBmdW5jdGlvbjogeyAuLi5mblJlc3QsIG5hbWUsIGFyZ3VtZW50czogYXJncyB9IH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAuLi5jaG9pY2VSZXN0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHsgLi4ubWVzc2FnZVJlc3QsIGNvbnRlbnQsIHJvbGUsIHJlZnVzYWw6IG1lc3NhZ2UucmVmdXNhbCA/PyBudWxsIH0sXG4gICAgICAgICAgICAgICAgZmluaXNoX3JlYXNvbixcbiAgICAgICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgICAgICBsb2dwcm9icyxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgICBjcmVhdGVkLFxuICAgICAgICBtb2RlbCxcbiAgICAgICAgb2JqZWN0OiAnY2hhdC5jb21wbGV0aW9uJyxcbiAgICAgICAgLi4uKHN5c3RlbV9maW5nZXJwcmludCA/IHsgc3lzdGVtX2ZpbmdlcnByaW50IH0gOiB7fSksXG4gICAgfTtcbiAgICByZXR1cm4gbWF5YmVQYXJzZUNoYXRDb21wbGV0aW9uKGNvbXBsZXRpb24sIHBhcmFtcyk7XG59XG5mdW5jdGlvbiBzdHIoeCkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh4KTtcbn1cbi8qKlxuICogRW5zdXJlcyB0aGUgZ2l2ZW4gYXJndW1lbnQgaXMgYW4gZW1wdHkgb2JqZWN0LCB1c2VmdWwgZm9yXG4gKiBhc3NlcnRpbmcgdGhhdCBhbGwga25vd24gcHJvcGVydGllcyBvbiBhbiBvYmplY3QgaGF2ZSBiZWVuXG4gKiBkZXN0cnVjdHVyZWQuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydElzRW1wdHkob2JqKSB7XG4gICAgcmV0dXJuO1xufVxuZnVuY3Rpb24gYXNzZXJ0TmV2ZXIoX3gpIHsgfVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Q2hhdENvbXBsZXRpb25TdHJlYW0ubWpzLm1hcCIsImltcG9ydCB7IENoYXRDb21wbGV0aW9uU3RyZWFtIH0gZnJvbSBcIi4vQ2hhdENvbXBsZXRpb25TdHJlYW0ubWpzXCI7XG5leHBvcnQgY2xhc3MgQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIgZXh0ZW5kcyBDaGF0Q29tcGxldGlvblN0cmVhbSB7XG4gICAgc3RhdGljIGZyb21SZWFkYWJsZVN0cmVhbShzdHJlYW0pIHtcbiAgICAgICAgY29uc3QgcnVubmVyID0gbmV3IENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyKG51bGwpO1xuICAgICAgICBydW5uZXIuX3J1bigoKSA9PiBydW5uZXIuX2Zyb21SZWFkYWJsZVN0cmVhbShzdHJlYW0pKTtcbiAgICAgICAgcmV0dXJuIHJ1bm5lcjtcbiAgICB9XG4gICAgLyoqIEBkZXByZWNhdGVkIC0gcGxlYXNlIHVzZSBgcnVuVG9vbHNgIGluc3RlYWQuICovXG4gICAgc3RhdGljIHJ1bkZ1bmN0aW9ucyhjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIobnVsbCk7XG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdydW5GdW5jdGlvbnMnIH0sXG4gICAgICAgIH07XG4gICAgICAgIHJ1bm5lci5fcnVuKCgpID0+IHJ1bm5lci5fcnVuRnVuY3Rpb25zKGNsaWVudCwgcGFyYW1zLCBvcHRzKSk7XG4gICAgICAgIHJldHVybiBydW5uZXI7XG4gICAgfVxuICAgIHN0YXRpYyBydW5Ub29scyhjbGllbnQsIHBhcmFtcywgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBydW5uZXIgPSBuZXcgQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIoXG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgVE9ETyB0aGVzZSB0eXBlcyBhcmUgaW5jb21wYXRpYmxlXG4gICAgICAgIHBhcmFtcyk7XG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtSGVscGVyLU1ldGhvZCc6ICdydW5Ub29scycgfSxcbiAgICAgICAgfTtcbiAgICAgICAgcnVubmVyLl9ydW4oKCkgPT4gcnVubmVyLl9ydW5Ub29scyhjbGllbnQsIHBhcmFtcywgb3B0cykpO1xuICAgICAgICByZXR1cm4gcnVubmVyO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUNoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLm1qcy5tYXAiLCJ2YXIgX19jbGFzc1ByaXZhdGVGaWVsZFNldCA9ICh0aGlzICYmIHRoaXMuX19jbGFzc1ByaXZhdGVGaWVsZFNldCkgfHwgZnVuY3Rpb24gKHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJtXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIG1ldGhvZCBpcyBub3Qgd3JpdGFibGVcIik7XG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIChraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlciwgdmFsdWUpIDogZiA/IGYudmFsdWUgPSB2YWx1ZSA6IHN0YXRlLnNldChyZWNlaXZlciwgdmFsdWUpKSwgdmFsdWU7XG59O1xudmFyIF9fY2xhc3NQcml2YXRlRmllbGRHZXQgPSAodGhpcyAmJiB0aGlzLl9fY2xhc3NQcml2YXRlRmllbGRHZXQpIHx8IGZ1bmN0aW9uIChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcmVhZCBwcml2YXRlIG1lbWJlciBmcm9tIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcbn07XG52YXIgX0V2ZW50U3RyZWFtX2luc3RhbmNlcywgX0V2ZW50U3RyZWFtX2Nvbm5lY3RlZFByb21pc2UsIF9FdmVudFN0cmVhbV9yZXNvbHZlQ29ubmVjdGVkUHJvbWlzZSwgX0V2ZW50U3RyZWFtX3JlamVjdENvbm5lY3RlZFByb21pc2UsIF9FdmVudFN0cmVhbV9lbmRQcm9taXNlLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUVuZFByb21pc2UsIF9FdmVudFN0cmVhbV9yZWplY3RFbmRQcm9taXNlLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBfRXZlbnRTdHJlYW1fZW5kZWQsIF9FdmVudFN0cmVhbV9lcnJvcmVkLCBfRXZlbnRTdHJlYW1fYWJvcnRlZCwgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQsIF9FdmVudFN0cmVhbV9oYW5kbGVFcnJvcjtcbmltcG9ydCB7IEFQSVVzZXJBYm9ydEVycm9yLCBPcGVuQUlFcnJvciB9IGZyb20gXCIuLi9lcnJvci5tanNcIjtcbmV4cG9ydCBjbGFzcyBFdmVudFN0cmVhbSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIF9FdmVudFN0cmVhbV9pbnN0YW5jZXMuYWRkKHRoaXMpO1xuICAgICAgICB0aGlzLmNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9jb25uZWN0ZWRQcm9taXNlLnNldCh0aGlzLCB2b2lkIDApO1xuICAgICAgICBfRXZlbnRTdHJlYW1fcmVzb2x2ZUNvbm5lY3RlZFByb21pc2Uuc2V0KHRoaXMsICgpID0+IHsgfSk7XG4gICAgICAgIF9FdmVudFN0cmVhbV9yZWplY3RDb25uZWN0ZWRQcm9taXNlLnNldCh0aGlzLCAoKSA9PiB7IH0pO1xuICAgICAgICBfRXZlbnRTdHJlYW1fZW5kUHJvbWlzZS5zZXQodGhpcywgdm9pZCAwKTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX3Jlc29sdmVFbmRQcm9taXNlLnNldCh0aGlzLCAoKSA9PiB7IH0pO1xuICAgICAgICBfRXZlbnRTdHJlYW1fcmVqZWN0RW5kUHJvbWlzZS5zZXQodGhpcywgKCkgPT4geyB9KTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2xpc3RlbmVycy5zZXQodGhpcywge30pO1xuICAgICAgICBfRXZlbnRTdHJlYW1fZW5kZWQuc2V0KHRoaXMsIGZhbHNlKTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2Vycm9yZWQuc2V0KHRoaXMsIGZhbHNlKTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2Fib3J0ZWQuc2V0KHRoaXMsIGZhbHNlKTtcbiAgICAgICAgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQuc2V0KHRoaXMsIGZhbHNlKTtcbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fY29ubmVjdGVkUHJvbWlzZSwgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUNvbm5lY3RlZFByb21pc2UsIHJlc29sdmUsIFwiZlwiKTtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX3JlamVjdENvbm5lY3RlZFByb21pc2UsIHJlamVjdCwgXCJmXCIpO1xuICAgICAgICB9KSwgXCJmXCIpO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lbmRQcm9taXNlLCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZXNvbHZlRW5kUHJvbWlzZSwgcmVzb2x2ZSwgXCJmXCIpO1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVqZWN0RW5kUHJvbWlzZSwgcmVqZWN0LCBcImZcIik7XG4gICAgICAgIH0pLCBcImZcIik7XG4gICAgICAgIC8vIERvbid0IGxldCB0aGVzZSBwcm9taXNlcyBjYXVzZSB1bmhhbmRsZWQgcmVqZWN0aW9uIGVycm9ycy5cbiAgICAgICAgLy8gd2Ugd2lsbCBtYW51YWxseSBjYXVzZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uIGVycm9yIGxhdGVyXG4gICAgICAgIC8vIGlmIHRoZSB1c2VyIGhhc24ndCByZWdpc3RlcmVkIGFueSBlcnJvciBsaXN0ZW5lciBvciBjYWxsZWRcbiAgICAgICAgLy8gYW55IHByb21pc2UtcmV0dXJuaW5nIG1ldGhvZC5cbiAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fY29ubmVjdGVkUHJvbWlzZSwgXCJmXCIpLmNhdGNoKCgpID0+IHsgfSk7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2VuZFByb21pc2UsIFwiZlwiKS5jYXRjaCgoKSA9PiB7IH0pO1xuICAgIH1cbiAgICBfcnVuKGV4ZWN1dG9yKSB7XG4gICAgICAgIC8vIFVuZm9ydHVuYXRlbHkgaWYgd2UgY2FsbCBgZXhlY3V0b3IoKWAgaW1tZWRpYXRlbHkgd2UgZ2V0IHJ1bnRpbWUgZXJyb3JzIGFib3V0XG4gICAgICAgIC8vIHJlZmVyZW5jZXMgdG8gYHRoaXNgIGJlZm9yZSB0aGUgYHN1cGVyKClgIGNvbnN0cnVjdG9yIGNhbGwgcmV0dXJucy5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBleGVjdXRvcigpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXRGaW5hbCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2VuZCcpO1xuICAgICAgICAgICAgfSwgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1faW5zdGFuY2VzLCBcIm1cIiwgX0V2ZW50U3RyZWFtX2hhbmRsZUVycm9yKS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSwgMCk7XG4gICAgfVxuICAgIF9jb25uZWN0ZWQoKSB7XG4gICAgICAgIGlmICh0aGlzLmVuZGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZXNvbHZlQ29ubmVjdGVkUHJvbWlzZSwgXCJmXCIpLmNhbGwodGhpcyk7XG4gICAgICAgIHRoaXMuX2VtaXQoJ2Nvbm5lY3QnKTtcbiAgICB9XG4gICAgZ2V0IGVuZGVkKCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fZW5kZWQsIFwiZlwiKTtcbiAgICB9XG4gICAgZ2V0IGVycm9yZWQoKSB7XG4gICAgICAgIHJldHVybiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lcnJvcmVkLCBcImZcIik7XG4gICAgfVxuICAgIGdldCBhYm9ydGVkKCkge1xuICAgICAgICByZXR1cm4gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fYWJvcnRlZCwgXCJmXCIpO1xuICAgIH1cbiAgICBhYm9ydCgpIHtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyLmFib3J0KCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFkZHMgdGhlIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIHRoZSBlbmQgb2YgdGhlIGxpc3RlbmVycyBhcnJheSBmb3IgdGhlIGV2ZW50LlxuICAgICAqIE5vIGNoZWNrcyBhcmUgbWFkZSB0byBzZWUgaWYgdGhlIGxpc3RlbmVyIGhhcyBhbHJlYWR5IGJlZW4gYWRkZWQuIE11bHRpcGxlIGNhbGxzIHBhc3NpbmdcbiAgICAgKiB0aGUgc2FtZSBjb21iaW5hdGlvbiBvZiBldmVudCBhbmQgbGlzdGVuZXIgd2lsbCByZXN1bHQgaW4gdGhlIGxpc3RlbmVyIGJlaW5nIGFkZGVkLCBhbmRcbiAgICAgKiBjYWxsZWQsIG11bHRpcGxlIHRpbWVzLlxuICAgICAqIEByZXR1cm5zIHRoaXMgQ2hhdENvbXBsZXRpb25TdHJlYW0sIHNvIHRoYXQgY2FsbHMgY2FuIGJlIGNoYWluZWRcbiAgICAgKi9cbiAgICBvbihldmVudCwgbGlzdGVuZXIpIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdIHx8IChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF0gPSBbXSk7XG4gICAgICAgIGxpc3RlbmVycy5wdXNoKHsgbGlzdGVuZXIgfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIgZnJvbSB0aGUgbGlzdGVuZXIgYXJyYXkgZm9yIHRoZSBldmVudC5cbiAgICAgKiBvZmYoKSB3aWxsIHJlbW92ZSwgYXQgbW9zdCwgb25lIGluc3RhbmNlIG9mIGEgbGlzdGVuZXIgZnJvbSB0aGUgbGlzdGVuZXIgYXJyYXkuIElmIGFueSBzaW5nbGVcbiAgICAgKiBsaXN0ZW5lciBoYXMgYmVlbiBhZGRlZCBtdWx0aXBsZSB0aW1lcyB0byB0aGUgbGlzdGVuZXIgYXJyYXkgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnQsIHRoZW5cbiAgICAgKiBvZmYoKSBtdXN0IGJlIGNhbGxlZCBtdWx0aXBsZSB0aW1lcyB0byByZW1vdmUgZWFjaCBpbnN0YW5jZS5cbiAgICAgKiBAcmV0dXJucyB0aGlzIENoYXRDb21wbGV0aW9uU3RyZWFtLCBzbyB0aGF0IGNhbGxzIGNhbiBiZSBjaGFpbmVkXG4gICAgICovXG4gICAgb2ZmKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF07XG4gICAgICAgIGlmICghbGlzdGVuZXJzKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gbGlzdGVuZXJzLmZpbmRJbmRleCgobCkgPT4gbC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpO1xuICAgICAgICBpZiAoaW5kZXggPj0gMClcbiAgICAgICAgICAgIGxpc3RlbmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWRkcyBhIG9uZS10aW1lIGxpc3RlbmVyIGZ1bmN0aW9uIGZvciB0aGUgZXZlbnQuIFRoZSBuZXh0IHRpbWUgdGhlIGV2ZW50IGlzIHRyaWdnZXJlZCxcbiAgICAgKiB0aGlzIGxpc3RlbmVyIGlzIHJlbW92ZWQgYW5kIHRoZW4gaW52b2tlZC5cbiAgICAgKiBAcmV0dXJucyB0aGlzIENoYXRDb21wbGV0aW9uU3RyZWFtLCBzbyB0aGF0IGNhbGxzIGNhbiBiZSBjaGFpbmVkXG4gICAgICovXG4gICAgb25jZShldmVudCwgbGlzdGVuZXIpIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdIHx8IChfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9saXN0ZW5lcnMsIFwiZlwiKVtldmVudF0gPSBbXSk7XG4gICAgICAgIGxpc3RlbmVycy5wdXNoKHsgbGlzdGVuZXIsIG9uY2U6IHRydWUgfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIHNpbWlsYXIgdG8gYC5vbmNlKClgLCBidXQgcmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB0aGUgbmV4dCB0aW1lXG4gICAgICogdGhlIGV2ZW50IGlzIHRyaWdnZXJlZCwgaW5zdGVhZCBvZiBjYWxsaW5nIGEgbGlzdGVuZXIgY2FsbGJhY2suXG4gICAgICogQHJldHVybnMgYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdGhlIG5leHQgdGltZSBnaXZlbiBldmVudCBpcyB0cmlnZ2VyZWQsXG4gICAgICogb3IgcmVqZWN0cyBpZiBhbiBlcnJvciBpcyBlbWl0dGVkLiAgKElmIHlvdSByZXF1ZXN0IHRoZSAnZXJyb3InIGV2ZW50LFxuICAgICAqIHJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgZXJyb3IpLlxuICAgICAqXG4gICAgICogRXhhbXBsZTpcbiAgICAgKlxuICAgICAqICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IHN0cmVhbS5lbWl0dGVkKCdtZXNzYWdlJykgLy8gcmVqZWN0cyBpZiB0aGUgc3RyZWFtIGVycm9yc1xuICAgICAqL1xuICAgIGVtaXR0ZWQoZXZlbnQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQsIHRydWUsIFwiZlwiKTtcbiAgICAgICAgICAgIGlmIChldmVudCAhPT0gJ2Vycm9yJylcbiAgICAgICAgICAgICAgICB0aGlzLm9uY2UoJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgICAgICAgIHRoaXMub25jZShldmVudCwgcmVzb2x2ZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhc3luYyBkb25lKCkge1xuICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9jYXRjaGluZ1Byb21pc2VDcmVhdGVkLCB0cnVlLCBcImZcIik7XG4gICAgICAgIGF3YWl0IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2VuZFByb21pc2UsIFwiZlwiKTtcbiAgICB9XG4gICAgX2VtaXQoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGRvbid0IGVtaXQgYW55IGV2ZW50cyBhZnRlciBlbmRcbiAgICAgICAgaWYgKF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2VuZGVkLCBcImZcIikpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQgPT09ICdlbmQnKSB7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lbmRlZCwgdHJ1ZSwgXCJmXCIpO1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fcmVzb2x2ZUVuZFByb21pc2UsIFwiZlwiKS5jYWxsKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2xpc3RlbmVycywgXCJmXCIpW2V2ZW50XTtcbiAgICAgICAgaWYgKGxpc3RlbmVycykge1xuICAgICAgICAgICAgX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fbGlzdGVuZXJzLCBcImZcIilbZXZlbnRdID0gbGlzdGVuZXJzLmZpbHRlcigobCkgPT4gIWwub25jZSk7XG4gICAgICAgICAgICBsaXN0ZW5lcnMuZm9yRWFjaCgoeyBsaXN0ZW5lciB9KSA9PiBsaXN0ZW5lciguLi5hcmdzKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2ZW50ID09PSAnYWJvcnQnKSB7XG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAoIV9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX2NhdGNoaW5nUHJvbWlzZUNyZWF0ZWQsIFwiZlwiKSAmJiAhbGlzdGVuZXJzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZWplY3RDb25uZWN0ZWRQcm9taXNlLCBcImZcIikuY2FsbCh0aGlzLCBlcnJvcik7XG4gICAgICAgICAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHRoaXMsIF9FdmVudFN0cmVhbV9yZWplY3RFbmRQcm9taXNlLCBcImZcIikuY2FsbCh0aGlzLCBlcnJvcik7XG4gICAgICAgICAgICB0aGlzLl9lbWl0KCdlbmQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQgPT09ICdlcnJvcicpIHtcbiAgICAgICAgICAgIC8vIE5PVEU6IF9lbWl0KCdlcnJvcicsIGVycm9yKSBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSAjaGFuZGxlRXJyb3IoKS5cbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gYXJnc1swXTtcbiAgICAgICAgICAgIGlmICghX19jbGFzc1ByaXZhdGVGaWVsZEdldCh0aGlzLCBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZCwgXCJmXCIpICYmICFsaXN0ZW5lcnM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIFRyaWdnZXIgYW4gdW5oYW5kbGVkIHJlamVjdGlvbiBpZiB0aGUgdXNlciBoYXNuJ3QgcmVnaXN0ZXJlZCBhbnkgZXJyb3IgaGFuZGxlcnMuXG4gICAgICAgICAgICAgICAgLy8gSWYgeW91IGFyZSBzZWVpbmcgc3RhY2sgdHJhY2VzIGhlcmUsIG1ha2Ugc3VyZSB0byBoYW5kbGUgZXJyb3JzIHZpYSBlaXRoZXI6XG4gICAgICAgICAgICAgICAgLy8gLSBydW5uZXIub24oJ2Vycm9yJywgKCkgPT4gLi4uKVxuICAgICAgICAgICAgICAgIC8vIC0gYXdhaXQgcnVubmVyLmRvbmUoKVxuICAgICAgICAgICAgICAgIC8vIC0gYXdhaXQgcnVubmVyLmZpbmFsQ2hhdENvbXBsZXRpb24oKVxuICAgICAgICAgICAgICAgIC8vIC0gZXRjLlxuICAgICAgICAgICAgICAgIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX3JlamVjdENvbm5lY3RlZFByb21pc2UsIFwiZlwiKS5jYWxsKHRoaXMsIGVycm9yKTtcbiAgICAgICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQodGhpcywgX0V2ZW50U3RyZWFtX3JlamVjdEVuZFByb21pc2UsIFwiZlwiKS5jYWxsKHRoaXMsIGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMuX2VtaXQoJ2VuZCcpO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9lbWl0RmluYWwoKSB7IH1cbn1cbl9FdmVudFN0cmVhbV9jb25uZWN0ZWRQcm9taXNlID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX3Jlc29sdmVDb25uZWN0ZWRQcm9taXNlID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX3JlamVjdENvbm5lY3RlZFByb21pc2UgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fZW5kUHJvbWlzZSA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9yZXNvbHZlRW5kUHJvbWlzZSA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9yZWplY3RFbmRQcm9taXNlID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2xpc3RlbmVycyA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9lbmRlZCA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9lcnJvcmVkID0gbmV3IFdlYWtNYXAoKSwgX0V2ZW50U3RyZWFtX2Fib3J0ZWQgPSBuZXcgV2Vha01hcCgpLCBfRXZlbnRTdHJlYW1fY2F0Y2hpbmdQcm9taXNlQ3JlYXRlZCA9IG5ldyBXZWFrTWFwKCksIF9FdmVudFN0cmVhbV9pbnN0YW5jZXMgPSBuZXcgV2Vha1NldCgpLCBfRXZlbnRTdHJlYW1faGFuZGxlRXJyb3IgPSBmdW5jdGlvbiBfRXZlbnRTdHJlYW1faGFuZGxlRXJyb3IoZXJyb3IpIHtcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHRoaXMsIF9FdmVudFN0cmVhbV9lcnJvcmVkLCB0cnVlLCBcImZcIik7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7XG4gICAgICAgIGVycm9yID0gbmV3IEFQSVVzZXJBYm9ydEVycm9yKCk7XG4gICAgfVxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEFQSVVzZXJBYm9ydEVycm9yKSB7XG4gICAgICAgIF9fY2xhc3NQcml2YXRlRmllbGRTZXQodGhpcywgX0V2ZW50U3RyZWFtX2Fib3J0ZWQsIHRydWUsIFwiZlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VtaXQoJ2Fib3J0JywgZXJyb3IpO1xuICAgIH1cbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBPcGVuQUlFcnJvcikge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW1pdCgnZXJyb3InLCBlcnJvcik7XG4gICAgfVxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGNvbnN0IG9wZW5BSUVycm9yID0gbmV3IE9wZW5BSUVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIG9wZW5BSUVycm9yLmNhdXNlID0gZXJyb3I7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbWl0KCdlcnJvcicsIG9wZW5BSUVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2VtaXQoJ2Vycm9yJywgbmV3IE9wZW5BSUVycm9yKFN0cmluZyhlcnJvcikpKTtcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FdmVudFN0cmVhbS5tanMubWFwIiwiZXhwb3J0IGZ1bmN0aW9uIGlzUnVubmFibGVGdW5jdGlvbldpdGhQYXJzZShmbikge1xuICAgIHJldHVybiB0eXBlb2YgZm4ucGFyc2UgPT09ICdmdW5jdGlvbic7XG59XG4vKipcbiAqIFRoaXMgaXMgaGVscGVyIGNsYXNzIGZvciBwYXNzaW5nIGEgYGZ1bmN0aW9uYCBhbmQgYHBhcnNlYCB3aGVyZSB0aGUgYGZ1bmN0aW9uYFxuICogYXJndW1lbnQgdHlwZSBtYXRjaGVzIHRoZSBgcGFyc2VgIHJldHVybiB0eXBlLlxuICpcbiAqIEBkZXByZWNhdGVkIC0gcGxlYXNlIHVzZSBQYXJzaW5nVG9vbEZ1bmN0aW9uIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXJzaW5nRnVuY3Rpb24ge1xuICAgIGNvbnN0cnVjdG9yKGlucHV0KSB7XG4gICAgICAgIHRoaXMuZnVuY3Rpb24gPSBpbnB1dC5mdW5jdGlvbjtcbiAgICAgICAgdGhpcy5wYXJzZSA9IGlucHV0LnBhcnNlO1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSBpbnB1dC5wYXJhbWV0ZXJzO1xuICAgICAgICB0aGlzLmRlc2NyaXB0aW9uID0gaW5wdXQuZGVzY3JpcHRpb247XG4gICAgICAgIHRoaXMubmFtZSA9IGlucHV0Lm5hbWU7XG4gICAgfVxufVxuLyoqXG4gKiBUaGlzIGlzIGhlbHBlciBjbGFzcyBmb3IgcGFzc2luZyBhIGBmdW5jdGlvbmAgYW5kIGBwYXJzZWAgd2hlcmUgdGhlIGBmdW5jdGlvbmBcbiAqIGFyZ3VtZW50IHR5cGUgbWF0Y2hlcyB0aGUgYHBhcnNlYCByZXR1cm4gdHlwZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhcnNpbmdUb29sRnVuY3Rpb24ge1xuICAgIGNvbnN0cnVjdG9yKGlucHV0KSB7XG4gICAgICAgIHRoaXMudHlwZSA9ICdmdW5jdGlvbic7XG4gICAgICAgIHRoaXMuZnVuY3Rpb24gPSBpbnB1dDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1SdW5uYWJsZUZ1bmN0aW9uLm1qcy5tYXAiLCIvKipcbiAqIExpa2UgYFByb21pc2UuYWxsU2V0dGxlZCgpYCBidXQgdGhyb3dzIGFuIGVycm9yIGlmIGFueSBwcm9taXNlcyBhcmUgcmVqZWN0ZWQuXG4gKi9cbmV4cG9ydCBjb25zdCBhbGxTZXR0bGVkV2l0aFRocm93ID0gYXN5bmMgKHByb21pc2VzKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChwcm9taXNlcyk7XG4gICAgY29uc3QgcmVqZWN0ZWQgPSByZXN1bHRzLmZpbHRlcigocmVzdWx0KSA9PiByZXN1bHQuc3RhdHVzID09PSAncmVqZWN0ZWQnKTtcbiAgICBpZiAocmVqZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlamVjdGVkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKHJlc3VsdC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtyZWplY3RlZC5sZW5ndGh9IHByb21pc2UocykgZmFpbGVkIC0gc2VlIHRoZSBhYm92ZSBlcnJvcnNgKTtcbiAgICB9XG4gICAgLy8gTm90ZTogVFMgd2FzIGNvbXBsYWluaW5nIGFib3V0IHVzaW5nIGAuZmlsdGVyKCkubWFwKClgIGhlcmUgZm9yIHNvbWUgcmVhc29uXG4gICAgY29uc3QgdmFsdWVzID0gW107XG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcpIHtcbiAgICAgICAgICAgIHZhbHVlcy5wdXNoKHJlc3VsdC52YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1VdGlsLm1qcy5tYXAiLCJleHBvcnQgY29uc3QgaXNBc3Npc3RhbnRNZXNzYWdlID0gKG1lc3NhZ2UpID0+IHtcbiAgICByZXR1cm4gbWVzc2FnZT8ucm9sZSA9PT0gJ2Fzc2lzdGFudCc7XG59O1xuZXhwb3J0IGNvbnN0IGlzRnVuY3Rpb25NZXNzYWdlID0gKG1lc3NhZ2UpID0+IHtcbiAgICByZXR1cm4gbWVzc2FnZT8ucm9sZSA9PT0gJ2Z1bmN0aW9uJztcbn07XG5leHBvcnQgY29uc3QgaXNUb29sTWVzc2FnZSA9IChtZXNzYWdlKSA9PiB7XG4gICAgcmV0dXJuIG1lc3NhZ2U/LnJvbGUgPT09ICd0b29sJztcbn07XG5leHBvcnQgZnVuY3Rpb24gaXNQcmVzZW50KG9iaikge1xuICAgIHJldHVybiBvYmogIT0gbnVsbDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNoYXRDb21wbGV0aW9uVXRpbHMubWpzLm1hcCIsImltcG9ydCB7IENvbnRlbnRGaWx0ZXJGaW5pc2hSZWFzb25FcnJvciwgTGVuZ3RoRmluaXNoUmVhc29uRXJyb3IsIE9wZW5BSUVycm9yIH0gZnJvbSBcIi4uL2Vycm9yLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQYXJzZWFibGVSZXNwb25zZUZvcm1hdChyZXNwb25zZV9mb3JtYXQsIHBhcnNlcikge1xuICAgIGNvbnN0IG9iaiA9IHsgLi4ucmVzcG9uc2VfZm9ybWF0IH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMob2JqLCB7XG4gICAgICAgICRicmFuZDoge1xuICAgICAgICAgICAgdmFsdWU6ICdhdXRvLXBhcnNlYWJsZS1yZXNwb25zZS1mb3JtYXQnLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgICRwYXJzZVJhdzoge1xuICAgICAgICAgICAgdmFsdWU6IHBhcnNlcixcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgIH0pO1xuICAgIHJldHVybiBvYmo7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNBdXRvUGFyc2FibGVSZXNwb25zZUZvcm1hdChyZXNwb25zZV9mb3JtYXQpIHtcbiAgICByZXR1cm4gcmVzcG9uc2VfZm9ybWF0Py5bJyRicmFuZCddID09PSAnYXV0by1wYXJzZWFibGUtcmVzcG9uc2UtZm9ybWF0Jztcbn1cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUGFyc2VhYmxlVG9vbCh0b29sLCB7IHBhcnNlciwgY2FsbGJhY2ssIH0pIHtcbiAgICBjb25zdCBvYmogPSB7IC4uLnRvb2wgfTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhvYmosIHtcbiAgICAgICAgJGJyYW5kOiB7XG4gICAgICAgICAgICB2YWx1ZTogJ2F1dG8tcGFyc2VhYmxlLXRvb2wnLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgICRwYXJzZVJhdzoge1xuICAgICAgICAgICAgdmFsdWU6IHBhcnNlcixcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICAkY2FsbGJhY2s6IHtcbiAgICAgICAgICAgIHZhbHVlOiBjYWxsYmFjayxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgIH0pO1xuICAgIHJldHVybiBvYmo7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNBdXRvUGFyc2FibGVUb29sKHRvb2wpIHtcbiAgICByZXR1cm4gdG9vbD8uWyckYnJhbmQnXSA9PT0gJ2F1dG8tcGFyc2VhYmxlLXRvb2wnO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1heWJlUGFyc2VDaGF0Q29tcGxldGlvbihjb21wbGV0aW9uLCBwYXJhbXMpIHtcbiAgICBpZiAoIXBhcmFtcyB8fCAhaGFzQXV0b1BhcnNlYWJsZUlucHV0KHBhcmFtcykpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmNvbXBsZXRpb24sXG4gICAgICAgICAgICBjaG9pY2VzOiBjb21wbGV0aW9uLmNob2ljZXMubWFwKChjaG9pY2UpID0+ICh7XG4gICAgICAgICAgICAgICAgLi4uY2hvaWNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHsgLi4uY2hvaWNlLm1lc3NhZ2UsIHBhcnNlZDogbnVsbCwgdG9vbF9jYWxsczogY2hvaWNlLm1lc3NhZ2UudG9vbF9jYWxscyA/PyBbXSB9LFxuICAgICAgICAgICAgfSkpLFxuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VDaGF0Q29tcGxldGlvbihjb21wbGV0aW9uLCBwYXJhbXMpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ2hhdENvbXBsZXRpb24oY29tcGxldGlvbiwgcGFyYW1zKSB7XG4gICAgY29uc3QgY2hvaWNlcyA9IGNvbXBsZXRpb24uY2hvaWNlcy5tYXAoKGNob2ljZSkgPT4ge1xuICAgICAgICBpZiAoY2hvaWNlLmZpbmlzaF9yZWFzb24gPT09ICdsZW5ndGgnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgTGVuZ3RoRmluaXNoUmVhc29uRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hvaWNlLmZpbmlzaF9yZWFzb24gPT09ICdjb250ZW50X2ZpbHRlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBDb250ZW50RmlsdGVyRmluaXNoUmVhc29uRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY2hvaWNlLFxuICAgICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgICAgIC4uLmNob2ljZS5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIHRvb2xfY2FsbHM6IGNob2ljZS5tZXNzYWdlLnRvb2xfY2FsbHM/Lm1hcCgodG9vbENhbGwpID0+IHBhcnNlVG9vbENhbGwocGFyYW1zLCB0b29sQ2FsbCkpID8/IFtdLFxuICAgICAgICAgICAgICAgIHBhcnNlZDogY2hvaWNlLm1lc3NhZ2UuY29udGVudCAmJiAhY2hvaWNlLm1lc3NhZ2UucmVmdXNhbCA/XG4gICAgICAgICAgICAgICAgICAgIHBhcnNlUmVzcG9uc2VGb3JtYXQocGFyYW1zLCBjaG9pY2UubWVzc2FnZS5jb250ZW50KVxuICAgICAgICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH0pO1xuICAgIHJldHVybiB7IC4uLmNvbXBsZXRpb24sIGNob2ljZXMgfTtcbn1cbmZ1bmN0aW9uIHBhcnNlUmVzcG9uc2VGb3JtYXQocGFyYW1zLCBjb250ZW50KSB7XG4gICAgaWYgKHBhcmFtcy5yZXNwb25zZV9mb3JtYXQ/LnR5cGUgIT09ICdqc29uX3NjaGVtYScpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwYXJhbXMucmVzcG9uc2VfZm9ybWF0Py50eXBlID09PSAnanNvbl9zY2hlbWEnKSB7XG4gICAgICAgIGlmICgnJHBhcnNlUmF3JyBpbiBwYXJhbXMucmVzcG9uc2VfZm9ybWF0KSB7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZV9mb3JtYXQgPSBwYXJhbXMucmVzcG9uc2VfZm9ybWF0O1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlX2Zvcm1hdC4kcGFyc2VSYXcoY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuZnVuY3Rpb24gcGFyc2VUb29sQ2FsbChwYXJhbXMsIHRvb2xDYWxsKSB7XG4gICAgY29uc3QgaW5wdXRUb29sID0gcGFyYW1zLnRvb2xzPy5maW5kKChpbnB1dFRvb2wpID0+IGlucHV0VG9vbC5mdW5jdGlvbj8ubmFtZSA9PT0gdG9vbENhbGwuZnVuY3Rpb24ubmFtZSk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgLi4udG9vbENhbGwsXG4gICAgICAgIGZ1bmN0aW9uOiB7XG4gICAgICAgICAgICAuLi50b29sQ2FsbC5mdW5jdGlvbixcbiAgICAgICAgICAgIHBhcnNlZF9hcmd1bWVudHM6IGlzQXV0b1BhcnNhYmxlVG9vbChpbnB1dFRvb2wpID8gaW5wdXRUb29sLiRwYXJzZVJhdyh0b29sQ2FsbC5mdW5jdGlvbi5hcmd1bWVudHMpXG4gICAgICAgICAgICAgICAgOiBpbnB1dFRvb2w/LmZ1bmN0aW9uLnN0cmljdCA/IEpTT04ucGFyc2UodG9vbENhbGwuZnVuY3Rpb24uYXJndW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICAgIH0sXG4gICAgfTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRQYXJzZVRvb2xDYWxsKHBhcmFtcywgdG9vbENhbGwpIHtcbiAgICBpZiAoIXBhcmFtcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGlucHV0VG9vbCA9IHBhcmFtcy50b29scz8uZmluZCgoaW5wdXRUb29sKSA9PiBpbnB1dFRvb2wuZnVuY3Rpb24/Lm5hbWUgPT09IHRvb2xDYWxsLmZ1bmN0aW9uLm5hbWUpO1xuICAgIHJldHVybiBpc0F1dG9QYXJzYWJsZVRvb2woaW5wdXRUb29sKSB8fCBpbnB1dFRvb2w/LmZ1bmN0aW9uLnN0cmljdCB8fCBmYWxzZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBoYXNBdXRvUGFyc2VhYmxlSW5wdXQocGFyYW1zKSB7XG4gICAgaWYgKGlzQXV0b1BhcnNhYmxlUmVzcG9uc2VGb3JtYXQocGFyYW1zLnJlc3BvbnNlX2Zvcm1hdCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiAocGFyYW1zLnRvb2xzPy5zb21lKCh0KSA9PiBpc0F1dG9QYXJzYWJsZVRvb2wodCkgfHwgKHQudHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0LmZ1bmN0aW9uLnN0cmljdCA9PT0gdHJ1ZSkpID8/IGZhbHNlKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUlucHV0VG9vbHModG9vbHMpIHtcbiAgICBmb3IgKGNvbnN0IHRvb2wgb2YgdG9vbHMgPz8gW10pIHtcbiAgICAgICAgaWYgKHRvb2wudHlwZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IE9wZW5BSUVycm9yKGBDdXJyZW50bHkgb25seSBcXGBmdW5jdGlvblxcYCB0b29sIHR5cGVzIHN1cHBvcnQgYXV0by1wYXJzaW5nOyBSZWNlaXZlZCBcXGAke3Rvb2wudHlwZX1cXGBgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9vbC5mdW5jdGlvbi5zdHJpY3QgIT09IHRydWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgVGhlIFxcYCR7dG9vbC5mdW5jdGlvbi5uYW1lfVxcYCB0b29sIGlzIG5vdCBtYXJrZWQgd2l0aCBcXGBzdHJpY3Q6IHRydWVcXGAuIE9ubHkgc3RyaWN0IGZ1bmN0aW9uIHRvb2xzIGNhbiBiZSBhdXRvLXBhcnNlZGApO1xuICAgICAgICB9XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFyc2VyLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQWJzdHJhY3RQYWdlIH0gZnJvbSBcIi4vY29yZS5tanNcIjtcbi8qKlxuICogTm90ZTogbm8gcGFnaW5hdGlvbiBhY3R1YWxseSBvY2N1cnMgeWV0LCB0aGlzIGlzIGZvciBmb3J3YXJkcy1jb21wYXRpYmlsaXR5LlxuICovXG5leHBvcnQgY2xhc3MgUGFnZSBleHRlbmRzIEFic3RyYWN0UGFnZSB7XG4gICAgY29uc3RydWN0b3IoY2xpZW50LCByZXNwb25zZSwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBzdXBlcihjbGllbnQsIHJlc3BvbnNlLCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5kYXRhID0gYm9keS5kYXRhIHx8IFtdO1xuICAgICAgICB0aGlzLm9iamVjdCA9IGJvZHkub2JqZWN0O1xuICAgIH1cbiAgICBnZXRQYWdpbmF0ZWRJdGVtcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YSA/PyBbXTtcbiAgICB9XG4gICAgLy8gQGRlcHJlY2F0ZWQgUGxlYXNlIHVzZSBgbmV4dFBhZ2VJbmZvKClgIGluc3RlYWRcbiAgICAvKipcbiAgICAgKiBUaGlzIHBhZ2UgcmVwcmVzZW50cyBhIHJlc3BvbnNlIHRoYXQgaXNuJ3QgYWN0dWFsbHkgcGFnaW5hdGVkIGF0IHRoZSBBUEkgbGV2ZWxcbiAgICAgKiBzbyB0aGVyZSB3aWxsIG5ldmVyIGJlIGFueSBuZXh0IHBhZ2UgcGFyYW1zLlxuICAgICAqL1xuICAgIG5leHRQYWdlUGFyYW1zKCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbmV4dFBhZ2VJbmZvKCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQ3Vyc29yUGFnZSBleHRlbmRzIEFic3RyYWN0UGFnZSB7XG4gICAgY29uc3RydWN0b3IoY2xpZW50LCByZXNwb25zZSwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBzdXBlcihjbGllbnQsIHJlc3BvbnNlLCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5kYXRhID0gYm9keS5kYXRhIHx8IFtdO1xuICAgICAgICB0aGlzLmhhc19tb3JlID0gYm9keS5oYXNfbW9yZSB8fCBmYWxzZTtcbiAgICB9XG4gICAgZ2V0UGFnaW5hdGVkSXRlbXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEgPz8gW107XG4gICAgfVxuICAgIGhhc05leHRQYWdlKCkge1xuICAgICAgICBpZiAodGhpcy5oYXNfbW9yZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VwZXIuaGFzTmV4dFBhZ2UoKTtcbiAgICB9XG4gICAgLy8gQGRlcHJlY2F0ZWQgUGxlYXNlIHVzZSBgbmV4dFBhZ2VJbmZvKClgIGluc3RlYWRcbiAgICBuZXh0UGFnZVBhcmFtcygpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IHRoaXMubmV4dFBhZ2VJbmZvKCk7XG4gICAgICAgIGlmICghaW5mbylcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICBpZiAoJ3BhcmFtcycgaW4gaW5mbylcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnBhcmFtcztcbiAgICAgICAgY29uc3QgcGFyYW1zID0gT2JqZWN0LmZyb21FbnRyaWVzKGluZm8udXJsLnNlYXJjaFBhcmFtcyk7XG4gICAgICAgIGlmICghT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG4gICAgbmV4dFBhZ2VJbmZvKCkge1xuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5nZXRQYWdpbmF0ZWRJdGVtcygpO1xuICAgICAgICBpZiAoIWRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpZCA9IGRhdGFbZGF0YS5sZW5ndGggLSAxXT8uaWQ7XG4gICAgICAgIGlmICghaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHBhcmFtczogeyBhZnRlcjogaWQgfSB9O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBhZ2luYXRpb24ubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5leHBvcnQgY2xhc3MgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKGNsaWVudCkge1xuICAgICAgICB0aGlzLl9jbGllbnQgPSBjbGllbnQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmVzb3VyY2UubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIFNwZWVjaEFQSSBmcm9tIFwiLi9zcGVlY2gubWpzXCI7XG5pbXBvcnQgeyBTcGVlY2ggfSBmcm9tIFwiLi9zcGVlY2gubWpzXCI7XG5pbXBvcnQgKiBhcyBUcmFuc2NyaXB0aW9uc0FQSSBmcm9tIFwiLi90cmFuc2NyaXB0aW9ucy5tanNcIjtcbmltcG9ydCB7IFRyYW5zY3JpcHRpb25zLCB9IGZyb20gXCIuL3RyYW5zY3JpcHRpb25zLm1qc1wiO1xuaW1wb3J0ICogYXMgVHJhbnNsYXRpb25zQVBJIGZyb20gXCIuL3RyYW5zbGF0aW9ucy5tanNcIjtcbmltcG9ydCB7IFRyYW5zbGF0aW9ucywgfSBmcm9tIFwiLi90cmFuc2xhdGlvbnMubWpzXCI7XG5leHBvcnQgY2xhc3MgQXVkaW8gZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMudHJhbnNjcmlwdGlvbnMgPSBuZXcgVHJhbnNjcmlwdGlvbnNBUEkuVHJhbnNjcmlwdGlvbnModGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy50cmFuc2xhdGlvbnMgPSBuZXcgVHJhbnNsYXRpb25zQVBJLlRyYW5zbGF0aW9ucyh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLnNwZWVjaCA9IG5ldyBTcGVlY2hBUEkuU3BlZWNoKHRoaXMuX2NsaWVudCk7XG4gICAgfVxufVxuQXVkaW8uVHJhbnNjcmlwdGlvbnMgPSBUcmFuc2NyaXB0aW9ucztcbkF1ZGlvLlRyYW5zbGF0aW9ucyA9IFRyYW5zbGF0aW9ucztcbkF1ZGlvLlNwZWVjaCA9IFNwZWVjaDtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWF1ZGlvLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5leHBvcnQgY2xhc3MgU3BlZWNoIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyBhdWRpbyBmcm9tIHRoZSBpbnB1dCB0ZXh0LlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2F1ZGlvL3NwZWVjaCcsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyBBY2NlcHQ6ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgICAgICBfX2JpbmFyeVJlc3BvbnNlOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zcGVlY2gubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4uLy4uL2NvcmUubWpzXCI7XG5leHBvcnQgY2xhc3MgVHJhbnNjcmlwdGlvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvYXVkaW8vdHJhbnNjcmlwdGlvbnMnLCBDb3JlLm11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyh7IGJvZHksIC4uLm9wdGlvbnMsIF9fbWV0YWRhdGE6IHsgbW9kZWw6IGJvZHkubW9kZWwgfSB9KSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dHJhbnNjcmlwdGlvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4uLy4uL2NvcmUubWpzXCI7XG5leHBvcnQgY2xhc3MgVHJhbnNsYXRpb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2F1ZGlvL3RyYW5zbGF0aW9ucycsIENvcmUubXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zKHsgYm9keSwgLi4ub3B0aW9ucywgX19tZXRhZGF0YTogeyBtb2RlbDogYm9keS5tb2RlbCB9IH0pKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD10cmFuc2xhdGlvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBCYXRjaGVzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIGV4ZWN1dGVzIGEgYmF0Y2ggZnJvbSBhbiB1cGxvYWRlZCBmaWxlIG9mIHJlcXVlc3RzXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvYmF0Y2hlcycsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgYmF0Y2guXG4gICAgICovXG4gICAgcmV0cmlldmUoYmF0Y2hJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2JhdGNoZXMvJHtiYXRjaElkfWAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBsaXN0KHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvYmF0Y2hlcycsIEJhdGNoZXNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYW5jZWxzIGFuIGluLXByb2dyZXNzIGJhdGNoLiBUaGUgYmF0Y2ggd2lsbCBiZSBpbiBzdGF0dXMgYGNhbmNlbGxpbmdgIGZvciB1cCB0b1xuICAgICAqIDEwIG1pbnV0ZXMsIGJlZm9yZSBjaGFuZ2luZyB0byBgY2FuY2VsbGVkYCwgd2hlcmUgaXQgd2lsbCBoYXZlIHBhcnRpYWwgcmVzdWx0c1xuICAgICAqIChpZiBhbnkpIGF2YWlsYWJsZSBpbiB0aGUgb3V0cHV0IGZpbGUuXG4gICAgICovXG4gICAgY2FuY2VsKGJhdGNoSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvYmF0Y2hlcy8ke2JhdGNoSWR9L2NhbmNlbGAsIG9wdGlvbnMpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBCYXRjaGVzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuQmF0Y2hlcy5CYXRjaGVzUGFnZSA9IEJhdGNoZXNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YmF0Y2hlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEFzc2lzdGFudHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGFzc2lzdGFudCB3aXRoIGEgbW9kZWwgYW5kIGluc3RydWN0aW9ucy5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9hc3Npc3RhbnRzJywge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGFuIGFzc2lzdGFudC5cbiAgICAgKi9cbiAgICByZXRyaWV2ZShhc3Npc3RhbnRJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL2Fzc2lzdGFudHMvJHthc3Npc3RhbnRJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1vZGlmaWVzIGFuIGFzc2lzdGFudC5cbiAgICAgKi9cbiAgICB1cGRhdGUoYXNzaXN0YW50SWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvYXNzaXN0YW50cy8ke2Fzc2lzdGFudElkfWAsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxpc3QocXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3Qoe30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy9hc3Npc3RhbnRzJywgQXNzaXN0YW50c1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYW4gYXNzaXN0YW50LlxuICAgICAqL1xuICAgIGRlbChhc3Npc3RhbnRJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL2Fzc2lzdGFudHMvJHthc3Npc3RhbnRJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFzc2lzdGFudHNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5Bc3Npc3RhbnRzLkFzc2lzdGFudHNQYWdlID0gQXNzaXN0YW50c1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1hc3Npc3RhbnRzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBBc3Npc3RhbnRzQVBJIGZyb20gXCIuL2Fzc2lzdGFudHMubWpzXCI7XG5pbXBvcnQgKiBhcyBDaGF0QVBJIGZyb20gXCIuL2NoYXQvY2hhdC5tanNcIjtcbmltcG9ydCB7IEFzc2lzdGFudHMsIEFzc2lzdGFudHNQYWdlLCB9IGZyb20gXCIuL2Fzc2lzdGFudHMubWpzXCI7XG5pbXBvcnQgKiBhcyBSZWFsdGltZUFQSSBmcm9tIFwiLi9yZWFsdGltZS9yZWFsdGltZS5tanNcIjtcbmltcG9ydCB7IFJlYWx0aW1lIH0gZnJvbSBcIi4vcmVhbHRpbWUvcmVhbHRpbWUubWpzXCI7XG5pbXBvcnQgKiBhcyBUaHJlYWRzQVBJIGZyb20gXCIuL3RocmVhZHMvdGhyZWFkcy5tanNcIjtcbmltcG9ydCB7IFRocmVhZHMsIH0gZnJvbSBcIi4vdGhyZWFkcy90aHJlYWRzLm1qc1wiO1xuaW1wb3J0ICogYXMgVmVjdG9yU3RvcmVzQVBJIGZyb20gXCIuL3ZlY3Rvci1zdG9yZXMvdmVjdG9yLXN0b3Jlcy5tanNcIjtcbmltcG9ydCB7IFZlY3RvclN0b3JlcywgVmVjdG9yU3RvcmVzUGFnZSwgfSBmcm9tIFwiLi92ZWN0b3Itc3RvcmVzL3ZlY3Rvci1zdG9yZXMubWpzXCI7XG5pbXBvcnQgeyBDaGF0IH0gZnJvbSBcIi4vY2hhdC9jaGF0Lm1qc1wiO1xuZXhwb3J0IGNsYXNzIEJldGEgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSBuZXcgUmVhbHRpbWVBUEkuUmVhbHRpbWUodGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy52ZWN0b3JTdG9yZXMgPSBuZXcgVmVjdG9yU3RvcmVzQVBJLlZlY3RvclN0b3Jlcyh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLmNoYXQgPSBuZXcgQ2hhdEFQSS5DaGF0KHRoaXMuX2NsaWVudCk7XG4gICAgICAgIHRoaXMuYXNzaXN0YW50cyA9IG5ldyBBc3Npc3RhbnRzQVBJLkFzc2lzdGFudHModGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy50aHJlYWRzID0gbmV3IFRocmVhZHNBUEkuVGhyZWFkcyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbn1cbkJldGEuUmVhbHRpbWUgPSBSZWFsdGltZTtcbkJldGEuVmVjdG9yU3RvcmVzID0gVmVjdG9yU3RvcmVzO1xuQmV0YS5WZWN0b3JTdG9yZXNQYWdlID0gVmVjdG9yU3RvcmVzUGFnZTtcbkJldGEuQXNzaXN0YW50cyA9IEFzc2lzdGFudHM7XG5CZXRhLkFzc2lzdGFudHNQYWdlID0gQXNzaXN0YW50c1BhZ2U7XG5CZXRhLlRocmVhZHMgPSBUaHJlYWRzO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YmV0YS5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29tcGxldGlvbnNBUEkgZnJvbSBcIi4vY29tcGxldGlvbnMubWpzXCI7XG5leHBvcnQgY2xhc3MgQ2hhdCBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5jb21wbGV0aW9ucyA9IG5ldyBDb21wbGV0aW9uc0FQSS5Db21wbGV0aW9ucyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbn1cbihmdW5jdGlvbiAoQ2hhdCkge1xuICAgIENoYXQuQ29tcGxldGlvbnMgPSBDb21wbGV0aW9uc0FQSS5Db21wbGV0aW9ucztcbn0pKENoYXQgfHwgKENoYXQgPSB7fSkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hhdC5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25SdW5uZXIgfSBmcm9tIFwiLi4vLi4vLi4vbGliL0NoYXRDb21wbGV0aW9uUnVubmVyLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIsIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9DaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lci5tanNcIjtcbmltcG9ydCB7IENoYXRDb21wbGV0aW9uU3RyZWFtIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9DaGF0Q29tcGxldGlvblN0cmVhbS5tanNcIjtcbmltcG9ydCB7IHBhcnNlQ2hhdENvbXBsZXRpb24sIHZhbGlkYXRlSW5wdXRUb29scyB9IGZyb20gXCIuLi8uLi8uLi9saWIvcGFyc2VyLm1qc1wiO1xuZXhwb3J0IHsgQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIsIH0gZnJvbSBcIi4uLy4uLy4uL2xpYi9DaGF0Q29tcGxldGlvblN0cmVhbWluZ1J1bm5lci5tanNcIjtcbmV4cG9ydCB7IFBhcnNpbmdGdW5jdGlvbiwgUGFyc2luZ1Rvb2xGdW5jdGlvbiwgfSBmcm9tIFwiLi4vLi4vLi4vbGliL1J1bm5hYmxlRnVuY3Rpb24ubWpzXCI7XG5leHBvcnQgeyBDaGF0Q29tcGxldGlvblN0cmVhbSB9IGZyb20gXCIuLi8uLi8uLi9saWIvQ2hhdENvbXBsZXRpb25TdHJlYW0ubWpzXCI7XG5leHBvcnQgeyBDaGF0Q29tcGxldGlvblJ1bm5lciwgfSBmcm9tIFwiLi4vLi4vLi4vbGliL0NoYXRDb21wbGV0aW9uUnVubmVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIHBhcnNlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgdmFsaWRhdGVJbnB1dFRvb2xzKGJvZHkudG9vbHMpO1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmNoYXQuY29tcGxldGlvbnNcbiAgICAgICAgICAgIC5jcmVhdGUoYm9keSwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAuLi5vcHRpb25zPy5oZWFkZXJzLFxuICAgICAgICAgICAgICAgICdYLVN0YWlubGVzcy1IZWxwZXItTWV0aG9kJzogJ2JldGEuY2hhdC5jb21wbGV0aW9ucy5wYXJzZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KVxuICAgICAgICAgICAgLl90aGVuVW53cmFwKChjb21wbGV0aW9uKSA9PiBwYXJzZUNoYXRDb21wbGV0aW9uKGNvbXBsZXRpb24sIGJvZHkpKTtcbiAgICB9XG4gICAgcnVuRnVuY3Rpb25zKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGJvZHkuc3RyZWFtKSB7XG4gICAgICAgICAgICByZXR1cm4gQ2hhdENvbXBsZXRpb25TdHJlYW1pbmdSdW5uZXIucnVuRnVuY3Rpb25zKHRoaXMuX2NsaWVudCwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIENoYXRDb21wbGV0aW9uUnVubmVyLnJ1bkZ1bmN0aW9ucyh0aGlzLl9jbGllbnQsIGJvZHksIG9wdGlvbnMpO1xuICAgIH1cbiAgICBydW5Ub29scyhib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChib2R5LnN0cmVhbSkge1xuICAgICAgICAgICAgcmV0dXJuIENoYXRDb21wbGV0aW9uU3RyZWFtaW5nUnVubmVyLnJ1blRvb2xzKHRoaXMuX2NsaWVudCwgYm9keSwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIENoYXRDb21wbGV0aW9uUnVubmVyLnJ1blRvb2xzKHRoaXMuX2NsaWVudCwgYm9keSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBjaGF0IGNvbXBsZXRpb24gc3RyZWFtXG4gICAgICovXG4gICAgc3RyZWFtKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIENoYXRDb21wbGV0aW9uU3RyZWFtLmNyZWF0ZUNoYXRDb21wbGV0aW9uKHRoaXMuX2NsaWVudCwgYm9keSwgb3B0aW9ucyk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29tcGxldGlvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIFNlc3Npb25zQVBJIGZyb20gXCIuL3Nlc3Npb25zLm1qc1wiO1xuaW1wb3J0IHsgU2Vzc2lvbnMsIH0gZnJvbSBcIi4vc2Vzc2lvbnMubWpzXCI7XG5leHBvcnQgY2xhc3MgUmVhbHRpbWUgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuc2Vzc2lvbnMgPSBuZXcgU2Vzc2lvbnNBUEkuU2Vzc2lvbnModGhpcy5fY2xpZW50KTtcbiAgICB9XG59XG5SZWFsdGltZS5TZXNzaW9ucyA9IFNlc3Npb25zO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmVhbHRpbWUubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBTZXNzaW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gZXBoZW1lcmFsIEFQSSB0b2tlbiBmb3IgdXNlIGluIGNsaWVudC1zaWRlIGFwcGxpY2F0aW9ucyB3aXRoIHRoZVxuICAgICAqIFJlYWx0aW1lIEFQSS4gQ2FuIGJlIGNvbmZpZ3VyZWQgd2l0aCB0aGUgc2FtZSBzZXNzaW9uIHBhcmFtZXRlcnMgYXMgdGhlXG4gICAgICogYHNlc3Npb24udXBkYXRlYCBjbGllbnQgZXZlbnQuXG4gICAgICpcbiAgICAgKiBJdCByZXNwb25kcyB3aXRoIGEgc2Vzc2lvbiBvYmplY3QsIHBsdXMgYSBgY2xpZW50X3NlY3JldGAga2V5IHdoaWNoIGNvbnRhaW5zIGFcbiAgICAgKiB1c2FibGUgZXBoZW1lcmFsIEFQSSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGF1dGhlbnRpY2F0ZSBicm93c2VyIGNsaWVudHMgZm9yXG4gICAgICogdGhlIFJlYWx0aW1lIEFQSS5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9yZWFsdGltZS9zZXNzaW9ucycsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c2Vzc2lvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBNZXNzYWdlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBtZXNzYWdlLlxuICAgICAqL1xuICAgIGNyZWF0ZSh0aHJlYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L21lc3NhZ2VzYCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYSBtZXNzYWdlLlxuICAgICAqL1xuICAgIHJldHJpZXZlKHRocmVhZElkLCBtZXNzYWdlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC90aHJlYWRzLyR7dGhyZWFkSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTW9kaWZpZXMgYSBtZXNzYWdlLlxuICAgICAqL1xuICAgIHVwZGF0ZSh0aHJlYWRJZCwgbWVzc2FnZUlkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGlzdCh0aHJlYWRJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3QodGhyZWFkSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9tZXNzYWdlc2AsIE1lc3NhZ2VzUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZXMgYSBtZXNzYWdlLlxuICAgICAqL1xuICAgIGRlbCh0aHJlYWRJZCwgbWVzc2FnZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZGVsZXRlKGAvdGhyZWFkcy8ke3RocmVhZElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2VzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuTWVzc2FnZXMuTWVzc2FnZXNQYWdlID0gTWVzc2FnZXNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bWVzc2FnZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEFzc2lzdGFudFN0cmVhbSB9IGZyb20gXCIuLi8uLi8uLi8uLi9saWIvQXNzaXN0YW50U3RyZWFtLm1qc1wiO1xuaW1wb3J0IHsgc2xlZXAgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCAqIGFzIFN0ZXBzQVBJIGZyb20gXCIuL3N0ZXBzLm1qc1wiO1xuaW1wb3J0IHsgUnVuU3RlcHNQYWdlLCBTdGVwcywgfSBmcm9tIFwiLi9zdGVwcy5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBSdW5zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLnN0ZXBzID0gbmV3IFN0ZXBzQVBJLlN0ZXBzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxuICAgIGNyZWF0ZSh0aHJlYWRJZCwgcGFyYW1zLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHsgaW5jbHVkZSwgLi4uYm9keSB9ID0gcGFyYW1zO1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnNgLCB7XG4gICAgICAgICAgICBxdWVyeTogeyBpbmNsdWRlIH0sXG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgICAgICBzdHJlYW06IHBhcmFtcy5zdHJlYW0gPz8gZmFsc2UsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSBydW4uXG4gICAgICovXG4gICAgcmV0cmlldmUodGhyZWFkSWQsIHJ1bklkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdGhyZWFkcy8ke3RocmVhZElkfS9ydW5zLyR7cnVuSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBNb2RpZmllcyBhIHJ1bi5cbiAgICAgKi9cbiAgICB1cGRhdGUodGhyZWFkSWQsIHJ1bklkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVucy8ke3J1bklkfWAsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxpc3QodGhyZWFkSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHRocmVhZElkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVuc2AsIFJ1bnNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FuY2VscyBhIHJ1biB0aGF0IGlzIGBpbl9wcm9ncmVzc2AuXG4gICAgICovXG4gICAgY2FuY2VsKHRocmVhZElkLCBydW5JZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnMvJHtydW5JZH0vY2FuY2VsYCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBIGhlbHBlciB0byBjcmVhdGUgYSBydW4gYW4gcG9sbCBmb3IgYSB0ZXJtaW5hbCBzdGF0ZS4gTW9yZSBpbmZvcm1hdGlvbiBvbiBSdW5cbiAgICAgKiBsaWZlY3ljbGVzIGNhbiBiZSBmb3VuZCBoZXJlOlxuICAgICAqIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvaG93LWl0LXdvcmtzL3J1bnMtYW5kLXJ1bi1zdGVwc1xuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUFuZFBvbGwodGhyZWFkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcnVuID0gYXdhaXQgdGhpcy5jcmVhdGUodGhyZWFkSWQsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wb2xsKHRocmVhZElkLCBydW4uaWQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBSdW4gc3RyZWFtXG4gICAgICpcbiAgICAgKiBAZGVwcmVjYXRlZCB1c2UgYHN0cmVhbWAgaW5zdGVhZFxuICAgICAqL1xuICAgIGNyZWF0ZUFuZFN0cmVhbSh0aHJlYWRJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gQXNzaXN0YW50U3RyZWFtLmNyZWF0ZUFzc2lzdGFudFN0cmVhbSh0aHJlYWRJZCwgdGhpcy5fY2xpZW50LmJldGEudGhyZWFkcy5ydW5zLCBib2R5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQSBoZWxwZXIgdG8gcG9sbCBhIHJ1biBzdGF0dXMgdW50aWwgaXQgcmVhY2hlcyBhIHRlcm1pbmFsIHN0YXRlLiBNb3JlXG4gICAgICogaW5mb3JtYXRpb24gb24gUnVuIGxpZmVjeWNsZXMgY2FuIGJlIGZvdW5kIGhlcmU6XG4gICAgICogaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy9ob3ctaXQtd29ya3MvcnVucy1hbmQtcnVuLXN0ZXBzXG4gICAgICovXG4gICAgYXN5bmMgcG9sbCh0aHJlYWRJZCwgcnVuSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IHsgLi4ub3B0aW9ucz8uaGVhZGVycywgJ1gtU3RhaW5sZXNzLVBvbGwtSGVscGVyJzogJ3RydWUnIH07XG4gICAgICAgIGlmIChvcHRpb25zPy5wb2xsSW50ZXJ2YWxNcykge1xuICAgICAgICAgICAgaGVhZGVyc1snWC1TdGFpbmxlc3MtQ3VzdG9tLVBvbGwtSW50ZXJ2YWwnXSA9IG9wdGlvbnMucG9sbEludGVydmFsTXMudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgY29uc3QgeyBkYXRhOiBydW4sIHJlc3BvbnNlIH0gPSBhd2FpdCB0aGlzLnJldHJpZXZlKHRocmVhZElkLCBydW5JZCwge1xuICAgICAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogeyAuLi5vcHRpb25zPy5oZWFkZXJzLCAuLi5oZWFkZXJzIH0sXG4gICAgICAgICAgICB9KS53aXRoUmVzcG9uc2UoKTtcbiAgICAgICAgICAgIHN3aXRjaCAocnVuLnN0YXR1cykge1xuICAgICAgICAgICAgICAgIC8vSWYgd2UgYXJlIGluIGFueSBzb3J0IG9mIGludGVybWVkaWF0ZSBzdGF0ZSB3ZSBwb2xsXG4gICAgICAgICAgICAgICAgY2FzZSAncXVldWVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdpbl9wcm9ncmVzcyc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY2FuY2VsbGluZyc6XG4gICAgICAgICAgICAgICAgICAgIGxldCBzbGVlcEludGVydmFsID0gNTAwMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnM/LnBvbGxJbnRlcnZhbE1zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzbGVlcEludGVydmFsID0gb3B0aW9ucy5wb2xsSW50ZXJ2YWxNcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlckludGVydmFsID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoJ29wZW5haS1wb2xsLWFmdGVyLW1zJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGVhZGVySW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJJbnRlcnZhbE1zID0gcGFyc2VJbnQoaGVhZGVySW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oaGVhZGVySW50ZXJ2YWxNcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2xlZXBJbnRlcnZhbCA9IGhlYWRlckludGVydmFsTXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNsZWVwKHNsZWVwSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAvL1dlIHJldHVybiB0aGUgcnVuIGluIGFueSB0ZXJtaW5hbCBzdGF0ZS5cbiAgICAgICAgICAgICAgICBjYXNlICdyZXF1aXJlc19hY3Rpb24nOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2luY29tcGxldGUnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2NhbmNlbGxlZCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcGxldGVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdmYWlsZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2V4cGlyZWQnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcnVuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIFJ1biBzdHJlYW1cbiAgICAgKi9cbiAgICBzdHJlYW0odGhyZWFkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIEFzc2lzdGFudFN0cmVhbS5jcmVhdGVBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHRoaXMuX2NsaWVudC5iZXRhLnRocmVhZHMucnVucywgYm9keSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHN1Ym1pdFRvb2xPdXRwdXRzKHRocmVhZElkLCBydW5JZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnMvJHtydW5JZH0vc3VibWl0X3Rvb2xfb3V0cHV0c2AsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgICAgIHN0cmVhbTogYm9keS5zdHJlYW0gPz8gZmFsc2UsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBIGhlbHBlciB0byBzdWJtaXQgYSB0b29sIG91dHB1dCB0byBhIHJ1biBhbmQgcG9sbCBmb3IgYSB0ZXJtaW5hbCBydW4gc3RhdGUuXG4gICAgICogTW9yZSBpbmZvcm1hdGlvbiBvbiBSdW4gbGlmZWN5Y2xlcyBjYW4gYmUgZm91bmQgaGVyZTpcbiAgICAgKiBodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL2hvdy1pdC13b3Jrcy9ydW5zLWFuZC1ydW4tc3RlcHNcbiAgICAgKi9cbiAgICBhc3luYyBzdWJtaXRUb29sT3V0cHV0c0FuZFBvbGwodGhyZWFkSWQsIHJ1bklkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1biA9IGF3YWl0IHRoaXMuc3VibWl0VG9vbE91dHB1dHModGhyZWFkSWQsIHJ1bklkLCBib2R5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucG9sbCh0aHJlYWRJZCwgcnVuLmlkLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3VibWl0IHRoZSB0b29sIG91dHB1dHMgZnJvbSBhIHByZXZpb3VzIHJ1biBhbmQgc3RyZWFtIHRoZSBydW4gdG8gYSB0ZXJtaW5hbFxuICAgICAqIHN0YXRlLiBNb3JlIGluZm9ybWF0aW9uIG9uIFJ1biBsaWZlY3ljbGVzIGNhbiBiZSBmb3VuZCBoZXJlOlxuICAgICAqIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvaG93LWl0LXdvcmtzL3J1bnMtYW5kLXJ1bi1zdGVwc1xuICAgICAqL1xuICAgIHN1Ym1pdFRvb2xPdXRwdXRzU3RyZWFtKHRocmVhZElkLCBydW5JZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gQXNzaXN0YW50U3RyZWFtLmNyZWF0ZVRvb2xBc3Npc3RhbnRTdHJlYW0odGhyZWFkSWQsIHJ1bklkLCB0aGlzLl9jbGllbnQuYmV0YS50aHJlYWRzLnJ1bnMsIGJvZHksIG9wdGlvbnMpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBSdW5zUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuUnVucy5SdW5zUGFnZSA9IFJ1bnNQYWdlO1xuUnVucy5TdGVwcyA9IFN0ZXBzO1xuUnVucy5SdW5TdGVwc1BhZ2UgPSBSdW5TdGVwc1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1ydW5zLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgU3RlcHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgcmV0cmlldmUodGhyZWFkSWQsIHJ1bklkLCBzdGVwSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXRyaWV2ZSh0aHJlYWRJZCwgcnVuSWQsIHN0ZXBJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldChgL3RocmVhZHMvJHt0aHJlYWRJZH0vcnVucy8ke3J1bklkfS9zdGVwcy8ke3N0ZXBJZH1gLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGlzdCh0aHJlYWRJZCwgcnVuSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHRocmVhZElkLCBydW5JZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC90aHJlYWRzLyR7dGhyZWFkSWR9L3J1bnMvJHtydW5JZH0vc3RlcHNgLCBSdW5TdGVwc1BhZ2UsIHtcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBSdW5TdGVwc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cblN0ZXBzLlJ1blN0ZXBzUGFnZSA9IFJ1blN0ZXBzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0ZXBzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uLy4uLy4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBBc3Npc3RhbnRTdHJlYW0gfSBmcm9tIFwiLi4vLi4vLi4vbGliL0Fzc2lzdGFudFN0cmVhbS5tanNcIjtcbmltcG9ydCAqIGFzIE1lc3NhZ2VzQVBJIGZyb20gXCIuL21lc3NhZ2VzLm1qc1wiO1xuaW1wb3J0IHsgTWVzc2FnZXMsIE1lc3NhZ2VzUGFnZSwgfSBmcm9tIFwiLi9tZXNzYWdlcy5tanNcIjtcbmltcG9ydCAqIGFzIFJ1bnNBUEkgZnJvbSBcIi4vcnVucy9ydW5zLm1qc1wiO1xuaW1wb3J0IHsgUnVucywgUnVuc1BhZ2UsIH0gZnJvbSBcIi4vcnVucy9ydW5zLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFRocmVhZHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMucnVucyA9IG5ldyBSdW5zQVBJLlJ1bnModGhpcy5fY2xpZW50KTtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IG5ldyBNZXNzYWdlc0FQSS5NZXNzYWdlcyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbiAgICBjcmVhdGUoYm9keSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKGJvZHkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGUoe30sIGJvZHkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL3RocmVhZHMnLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSB0aHJlYWQuXG4gICAgICovXG4gICAgcmV0cmlldmUodGhyZWFkSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC90aHJlYWRzLyR7dGhyZWFkSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBNb2RpZmllcyBhIHRocmVhZC5cbiAgICAgKi9cbiAgICB1cGRhdGUodGhyZWFkSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdGhyZWFkcy8ke3RocmVhZElkfWAsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIHRocmVhZC5cbiAgICAgKi9cbiAgICBkZWwodGhyZWFkSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC90aHJlYWRzLyR7dGhyZWFkSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBjcmVhdGVBbmRSdW4oYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy90aHJlYWRzL3J1bnMnLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgICAgICBzdHJlYW06IGJvZHkuc3RyZWFtID8/IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQSBoZWxwZXIgdG8gY3JlYXRlIGEgdGhyZWFkLCBzdGFydCBhIHJ1biBhbmQgdGhlbiBwb2xsIGZvciBhIHRlcm1pbmFsIHN0YXRlLlxuICAgICAqIE1vcmUgaW5mb3JtYXRpb24gb24gUnVuIGxpZmVjeWNsZXMgY2FuIGJlIGZvdW5kIGhlcmU6XG4gICAgICogaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXNzaXN0YW50cy9ob3ctaXQtd29ya3MvcnVucy1hbmQtcnVuLXN0ZXBzXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlQW5kUnVuUG9sbChib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHJ1biA9IGF3YWl0IHRoaXMuY3JlYXRlQW5kUnVuKGJvZHksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5ydW5zLnBvbGwocnVuLnRocmVhZF9pZCwgcnVuLmlkLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgdGhyZWFkIGFuZCBzdHJlYW0gdGhlIHJ1biBiYWNrXG4gICAgICovXG4gICAgY3JlYXRlQW5kUnVuU3RyZWFtKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIEFzc2lzdGFudFN0cmVhbS5jcmVhdGVUaHJlYWRBc3Npc3RhbnRTdHJlYW0oYm9keSwgdGhpcy5fY2xpZW50LmJldGEudGhyZWFkcywgb3B0aW9ucyk7XG4gICAgfVxufVxuVGhyZWFkcy5SdW5zID0gUnVucztcblRocmVhZHMuUnVuc1BhZ2UgPSBSdW5zUGFnZTtcblRocmVhZHMuTWVzc2FnZXMgPSBNZXNzYWdlcztcblRocmVhZHMuTWVzc2FnZXNQYWdlID0gTWVzc2FnZXNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dGhyZWFkcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgc2xlZXAgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IGFsbFNldHRsZWRXaXRoVGhyb3cgfSBmcm9tIFwiLi4vLi4vLi4vbGliL1V0aWwubWpzXCI7XG5pbXBvcnQgeyBWZWN0b3JTdG9yZUZpbGVzUGFnZSB9IGZyb20gXCIuL2ZpbGVzLm1qc1wiO1xuZXhwb3J0IGNsYXNzIEZpbGVCYXRjaGVzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIHZlY3RvciBzdG9yZSBmaWxlIGJhdGNoLlxuICAgICAqL1xuICAgIGNyZWF0ZSh2ZWN0b3JTdG9yZUlkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlX2JhdGNoZXNgLCB7XG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSB2ZWN0b3Igc3RvcmUgZmlsZSBiYXRjaC5cbiAgICAgKi9cbiAgICByZXRyaWV2ZSh2ZWN0b3JTdG9yZUlkLCBiYXRjaElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVfYmF0Y2hlcy8ke2JhdGNoSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgYSB2ZWN0b3Igc3RvcmUgZmlsZSBiYXRjaC4gVGhpcyBhdHRlbXB0cyB0byBjYW5jZWwgdGhlIHByb2Nlc3Npbmcgb2ZcbiAgICAgKiBmaWxlcyBpbiB0aGlzIGJhdGNoIGFzIHNvb24gYXMgcG9zc2libGUuXG4gICAgICovXG4gICAgY2FuY2VsKHZlY3RvclN0b3JlSWQsIGJhdGNoSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVfYmF0Y2hlcy8ke2JhdGNoSWR9L2NhbmNlbGAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgdmVjdG9yIHN0b3JlIGJhdGNoIGFuZCBwb2xsIHVudGlsIGFsbCBmaWxlcyBoYXZlIGJlZW4gcHJvY2Vzc2VkLlxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUFuZFBvbGwodmVjdG9yU3RvcmVJZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBiYXRjaCA9IGF3YWl0IHRoaXMuY3JlYXRlKHZlY3RvclN0b3JlSWQsIGJvZHkpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wb2xsKHZlY3RvclN0b3JlSWQsIGJhdGNoLmlkLCBvcHRpb25zKTtcbiAgICB9XG4gICAgbGlzdEZpbGVzKHZlY3RvclN0b3JlSWQsIGJhdGNoSWQsIHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0RmlsZXModmVjdG9yU3RvcmVJZCwgYmF0Y2hJZCwge30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZV9iYXRjaGVzLyR7YmF0Y2hJZH0vZmlsZXNgLCBWZWN0b3JTdG9yZUZpbGVzUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucywgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogV2FpdCBmb3IgdGhlIGdpdmVuIGZpbGUgYmF0Y2ggdG8gYmUgcHJvY2Vzc2VkLlxuICAgICAqXG4gICAgICogTm90ZTogdGhpcyB3aWxsIHJldHVybiBldmVuIGlmIG9uZSBvZiB0aGUgZmlsZXMgZmFpbGVkIHRvIHByb2Nlc3MsIHlvdSBuZWVkIHRvXG4gICAgICogY2hlY2sgYmF0Y2guZmlsZV9jb3VudHMuZmFpbGVkX2NvdW50IHRvIGhhbmRsZSB0aGlzIGNhc2UuXG4gICAgICovXG4gICAgYXN5bmMgcG9sbCh2ZWN0b3JTdG9yZUlkLCBiYXRjaElkLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSB7IC4uLm9wdGlvbnM/LmhlYWRlcnMsICdYLVN0YWlubGVzcy1Qb2xsLUhlbHBlcic6ICd0cnVlJyB9O1xuICAgICAgICBpZiAob3B0aW9ucz8ucG9sbEludGVydmFsTXMpIHtcbiAgICAgICAgICAgIGhlYWRlcnNbJ1gtU3RhaW5sZXNzLUN1c3RvbS1Qb2xsLUludGVydmFsJ10gPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogYmF0Y2gsIHJlc3BvbnNlIH0gPSBhd2FpdCB0aGlzLnJldHJpZXZlKHZlY3RvclN0b3JlSWQsIGJhdGNoSWQsIHtcbiAgICAgICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICB9KS53aXRoUmVzcG9uc2UoKTtcbiAgICAgICAgICAgIHN3aXRjaCAoYmF0Y2guc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnaW5fcHJvZ3Jlc3MnOlxuICAgICAgICAgICAgICAgICAgICBsZXQgc2xlZXBJbnRlcnZhbCA9IDUwMDA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zPy5wb2xsSW50ZXJ2YWxNcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2xlZXBJbnRlcnZhbCA9IG9wdGlvbnMucG9sbEludGVydmFsTXM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJJbnRlcnZhbCA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdvcGVuYWktcG9sbC1hZnRlci1tcycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhlYWRlckludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVySW50ZXJ2YWxNcyA9IHBhcnNlSW50KGhlYWRlckludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGhlYWRlckludGVydmFsTXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNsZWVwSW50ZXJ2YWwgPSBoZWFkZXJJbnRlcnZhbE1zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzbGVlcChzbGVlcEludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjYW5jZWxsZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbXBsZXRlZCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBiYXRjaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBVcGxvYWRzIHRoZSBnaXZlbiBmaWxlcyBjb25jdXJyZW50bHkgYW5kIHRoZW4gY3JlYXRlcyBhIHZlY3RvciBzdG9yZSBmaWxlIGJhdGNoLlxuICAgICAqXG4gICAgICogVGhlIGNvbmN1cnJlbmN5IGxpbWl0IGlzIGNvbmZpZ3VyYWJsZSB1c2luZyB0aGUgYG1heENvbmN1cnJlbmN5YCBwYXJhbWV0ZXIuXG4gICAgICovXG4gICAgYXN5bmMgdXBsb2FkQW5kUG9sbCh2ZWN0b3JTdG9yZUlkLCB7IGZpbGVzLCBmaWxlSWRzID0gW10gfSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoZmlsZXMgPT0gbnVsbCB8fCBmaWxlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBcXGBmaWxlc1xcYCBwcm92aWRlZCB0byBwcm9jZXNzLiBJZiB5b3UndmUgYWxyZWFkeSB1cGxvYWRlZCBmaWxlcyB5b3Ugc2hvdWxkIHVzZSBcXGAuY3JlYXRlQW5kUG9sbCgpXFxgIGluc3RlYWRgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb25maWd1cmVkQ29uY3VycmVuY3kgPSBvcHRpb25zPy5tYXhDb25jdXJyZW5jeSA/PyA1O1xuICAgICAgICAvLyBXZSBjYXAgdGhlIG51bWJlciBvZiB3b3JrZXJzIGF0IHRoZSBudW1iZXIgb2YgZmlsZXMgKHNvIHdlIGRvbid0IHN0YXJ0IGFueSB1bm5lY2Vzc2FyeSB3b3JrZXJzKVxuICAgICAgICBjb25zdCBjb25jdXJyZW5jeUxpbWl0ID0gTWF0aC5taW4oY29uZmlndXJlZENvbmN1cnJlbmN5LCBmaWxlcy5sZW5ndGgpO1xuICAgICAgICBjb25zdCBjbGllbnQgPSB0aGlzLl9jbGllbnQ7XG4gICAgICAgIGNvbnN0IGZpbGVJdGVyYXRvciA9IGZpbGVzLnZhbHVlcygpO1xuICAgICAgICBjb25zdCBhbGxGaWxlSWRzID0gWy4uLmZpbGVJZHNdO1xuICAgICAgICAvLyBUaGlzIGNvZGUgaXMgYmFzZWQgb24gdGhpcyBkZXNpZ24uIFRoZSBsaWJyYXJpZXMgZG9uJ3QgYWNjb21tb2RhdGUgb3VyIGVudmlyb25tZW50IGxpbWl0cy5cbiAgICAgICAgLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNDA2Mzk0MzIvd2hhdC1pcy10aGUtYmVzdC13YXktdG8tbGltaXQtY29uY3VycmVuY3ktd2hlbi11c2luZy1lczZzLXByb21pc2UtYWxsXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NGaWxlcyhpdGVyYXRvcikge1xuICAgICAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVPYmogPSBhd2FpdCBjbGllbnQuZmlsZXMuY3JlYXRlKHsgZmlsZTogaXRlbSwgcHVycG9zZTogJ2Fzc2lzdGFudHMnIH0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGFsbEZpbGVJZHMucHVzaChmaWxlT2JqLmlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBTdGFydCB3b3JrZXJzIHRvIHByb2Nlc3MgcmVzdWx0c1xuICAgICAgICBjb25zdCB3b3JrZXJzID0gQXJyYXkoY29uY3VycmVuY3lMaW1pdCkuZmlsbChmaWxlSXRlcmF0b3IpLm1hcChwcm9jZXNzRmlsZXMpO1xuICAgICAgICAvLyBXYWl0IGZvciBhbGwgcHJvY2Vzc2luZyB0byBjb21wbGV0ZS5cbiAgICAgICAgYXdhaXQgYWxsU2V0dGxlZFdpdGhUaHJvdyh3b3JrZXJzKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY3JlYXRlQW5kUG9sbCh2ZWN0b3JTdG9yZUlkLCB7XG4gICAgICAgICAgICBmaWxlX2lkczogYWxsRmlsZUlkcyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IHsgVmVjdG9yU3RvcmVGaWxlc1BhZ2UgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGUtYmF0Y2hlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgc2xlZXAsIGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBGaWxlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSB2ZWN0b3Igc3RvcmUgZmlsZSBieSBhdHRhY2hpbmcgYVxuICAgICAqIFtGaWxlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2ZpbGVzKSB0byBhXG4gICAgICogW3ZlY3RvciBzdG9yZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS92ZWN0b3Itc3RvcmVzL29iamVjdCkuXG4gICAgICovXG4gICAgY3JlYXRlKHZlY3RvclN0b3JlSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVzYCwge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgdmVjdG9yIHN0b3JlIGZpbGUuXG4gICAgICovXG4gICAgcmV0cmlldmUodmVjdG9yU3RvcmVJZCwgZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvdmVjdG9yX3N0b3Jlcy8ke3ZlY3RvclN0b3JlSWR9L2ZpbGVzLyR7ZmlsZUlkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGlzdCh2ZWN0b3JTdG9yZUlkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh2ZWN0b3JTdG9yZUlkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfS9maWxlc2AsIFZlY3RvclN0b3JlRmlsZXNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGEgdmVjdG9yIHN0b3JlIGZpbGUuIFRoaXMgd2lsbCByZW1vdmUgdGhlIGZpbGUgZnJvbSB0aGUgdmVjdG9yIHN0b3JlIGJ1dFxuICAgICAqIHRoZSBmaWxlIGl0c2VsZiB3aWxsIG5vdCBiZSBkZWxldGVkLiBUbyBkZWxldGUgdGhlIGZpbGUsIHVzZSB0aGVcbiAgICAgKiBbZGVsZXRlIGZpbGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmlsZXMvZGVsZXRlKVxuICAgICAqIGVuZHBvaW50LlxuICAgICAqL1xuICAgIGRlbCh2ZWN0b3JTdG9yZUlkLCBmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH0vZmlsZXMvJHtmaWxlSWR9YCwge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ09wZW5BSS1CZXRhJzogJ2Fzc2lzdGFudHM9djInLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYSBmaWxlIHRvIHRoZSBnaXZlbiB2ZWN0b3Igc3RvcmUgYW5kIHdhaXQgZm9yIGl0IHRvIGJlIHByb2Nlc3NlZC5cbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVBbmRQb2xsKHZlY3RvclN0b3JlSWQsIGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRoaXMuY3JlYXRlKHZlY3RvclN0b3JlSWQsIGJvZHksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wb2xsKHZlY3RvclN0b3JlSWQsIGZpbGUuaWQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBXYWl0IGZvciB0aGUgdmVjdG9yIHN0b3JlIGZpbGUgdG8gZmluaXNoIHByb2Nlc3NpbmcuXG4gICAgICpcbiAgICAgKiBOb3RlOiB0aGlzIHdpbGwgcmV0dXJuIGV2ZW4gaWYgdGhlIGZpbGUgZmFpbGVkIHRvIHByb2Nlc3MsIHlvdSBuZWVkIHRvIGNoZWNrXG4gICAgICogZmlsZS5sYXN0X2Vycm9yIGFuZCBmaWxlLnN0YXR1cyB0byBoYW5kbGUgdGhlc2UgY2FzZXNcbiAgICAgKi9cbiAgICBhc3luYyBwb2xsKHZlY3RvclN0b3JlSWQsIGZpbGVJZCwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBoZWFkZXJzID0geyAuLi5vcHRpb25zPy5oZWFkZXJzLCAnWC1TdGFpbmxlc3MtUG9sbC1IZWxwZXInOiAndHJ1ZScgfTtcbiAgICAgICAgaWYgKG9wdGlvbnM/LnBvbGxJbnRlcnZhbE1zKSB7XG4gICAgICAgICAgICBoZWFkZXJzWydYLVN0YWlubGVzcy1DdXN0b20tUG9sbC1JbnRlcnZhbCddID0gb3B0aW9ucy5wb2xsSW50ZXJ2YWxNcy50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJldHJpZXZlKHZlY3RvclN0b3JlSWQsIGZpbGVJZCwge1xuICAgICAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICAgIH0pLndpdGhSZXNwb25zZSgpO1xuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGZpbGVSZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgc3dpdGNoIChmaWxlLnN0YXR1cykge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2luX3Byb2dyZXNzJzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNsZWVwSW50ZXJ2YWwgPSA1MDAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucz8ucG9sbEludGVydmFsTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNsZWVwSW50ZXJ2YWwgPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVySW50ZXJ2YWwgPSBmaWxlUmVzcG9uc2UucmVzcG9uc2UuaGVhZGVycy5nZXQoJ29wZW5haS1wb2xsLWFmdGVyLW1zJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGVhZGVySW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJJbnRlcnZhbE1zID0gcGFyc2VJbnQoaGVhZGVySW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oaGVhZGVySW50ZXJ2YWxNcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2xlZXBJbnRlcnZhbCA9IGhlYWRlckludGVydmFsTXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNsZWVwKHNsZWVwSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdmYWlsZWQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbXBsZXRlZCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWxlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFVwbG9hZCBhIGZpbGUgdG8gdGhlIGBmaWxlc2AgQVBJIGFuZCB0aGVuIGF0dGFjaCBpdCB0byB0aGUgZ2l2ZW4gdmVjdG9yIHN0b3JlLlxuICAgICAqXG4gICAgICogTm90ZSB0aGUgZmlsZSB3aWxsIGJlIGFzeW5jaHJvbm91c2x5IHByb2Nlc3NlZCAoeW91IGNhbiB1c2UgdGhlIGFsdGVybmF0aXZlXG4gICAgICogcG9sbGluZyBoZWxwZXIgbWV0aG9kIHRvIHdhaXQgZm9yIHByb2Nlc3NpbmcgdG8gY29tcGxldGUpLlxuICAgICAqL1xuICAgIGFzeW5jIHVwbG9hZCh2ZWN0b3JTdG9yZUlkLCBmaWxlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGZpbGVJbmZvID0gYXdhaXQgdGhpcy5fY2xpZW50LmZpbGVzLmNyZWF0ZSh7IGZpbGU6IGZpbGUsIHB1cnBvc2U6ICdhc3Npc3RhbnRzJyB9LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlKHZlY3RvclN0b3JlSWQsIHsgZmlsZV9pZDogZmlsZUluZm8uaWQgfSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFkZCBhIGZpbGUgdG8gYSB2ZWN0b3Igc3RvcmUgYW5kIHBvbGwgdW50aWwgcHJvY2Vzc2luZyBpcyBjb21wbGV0ZS5cbiAgICAgKi9cbiAgICBhc3luYyB1cGxvYWRBbmRQb2xsKHZlY3RvclN0b3JlSWQsIGZpbGUsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZmlsZUluZm8gPSBhd2FpdCB0aGlzLnVwbG9hZCh2ZWN0b3JTdG9yZUlkLCBmaWxlLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucG9sbCh2ZWN0b3JTdG9yZUlkLCBmaWxlSW5mby5pZCwgb3B0aW9ucyk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFZlY3RvclN0b3JlRmlsZXNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5GaWxlcy5WZWN0b3JTdG9yZUZpbGVzUGFnZSA9IFZlY3RvclN0b3JlRmlsZXNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZXMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCAqIGFzIEZpbGVCYXRjaGVzQVBJIGZyb20gXCIuL2ZpbGUtYmF0Y2hlcy5tanNcIjtcbmltcG9ydCB7IEZpbGVCYXRjaGVzLCB9IGZyb20gXCIuL2ZpbGUtYmF0Y2hlcy5tanNcIjtcbmltcG9ydCAqIGFzIEZpbGVzQVBJIGZyb20gXCIuL2ZpbGVzLm1qc1wiO1xuaW1wb3J0IHsgRmlsZXMsIFZlY3RvclN0b3JlRmlsZXNQYWdlLCB9IGZyb20gXCIuL2ZpbGVzLm1qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yUGFnZSB9IGZyb20gXCIuLi8uLi8uLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFZlY3RvclN0b3JlcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5maWxlcyA9IG5ldyBGaWxlc0FQSS5GaWxlcyh0aGlzLl9jbGllbnQpO1xuICAgICAgICB0aGlzLmZpbGVCYXRjaGVzID0gbmV3IEZpbGVCYXRjaGVzQVBJLkZpbGVCYXRjaGVzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIHZlY3RvciBzdG9yZS5cbiAgICAgKi9cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy92ZWN0b3Jfc3RvcmVzJywge1xuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEgdmVjdG9yIHN0b3JlLlxuICAgICAqL1xuICAgIHJldHJpZXZlKHZlY3RvclN0b3JlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC92ZWN0b3Jfc3RvcmVzLyR7dmVjdG9yU3RvcmVJZH1gLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1vZGlmaWVzIGEgdmVjdG9yIHN0b3JlLlxuICAgICAqL1xuICAgIHVwZGF0ZSh2ZWN0b3JTdG9yZUlkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfWAsIHtcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxpc3QocXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3Qoe30sIHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldEFQSUxpc3QoJy92ZWN0b3Jfc3RvcmVzJywgVmVjdG9yU3RvcmVzUGFnZSwge1xuICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnT3BlbkFJLUJldGEnOiAnYXNzaXN0YW50cz12MicsIC4uLm9wdGlvbnM/LmhlYWRlcnMgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIHZlY3RvciBzdG9yZS5cbiAgICAgKi9cbiAgICBkZWwodmVjdG9yU3RvcmVJZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL3ZlY3Rvcl9zdG9yZXMvJHt2ZWN0b3JTdG9yZUlkfWAsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdPcGVuQUktQmV0YSc6ICdhc3Npc3RhbnRzPXYyJywgLi4ub3B0aW9ucz8uaGVhZGVycyB9LFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVmVjdG9yU3RvcmVzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuVmVjdG9yU3RvcmVzLlZlY3RvclN0b3Jlc1BhZ2UgPSBWZWN0b3JTdG9yZXNQYWdlO1xuVmVjdG9yU3RvcmVzLkZpbGVzID0gRmlsZXM7XG5WZWN0b3JTdG9yZXMuVmVjdG9yU3RvcmVGaWxlc1BhZ2UgPSBWZWN0b3JTdG9yZUZpbGVzUGFnZTtcblZlY3RvclN0b3Jlcy5GaWxlQmF0Y2hlcyA9IEZpbGVCYXRjaGVzO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dmVjdG9yLXN0b3Jlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29tcGxldGlvbnNBUEkgZnJvbSBcIi4vY29tcGxldGlvbnMvY29tcGxldGlvbnMubWpzXCI7XG5pbXBvcnQgeyBDaGF0Q29tcGxldGlvbnNQYWdlLCBDb21wbGV0aW9ucywgfSBmcm9tIFwiLi9jb21wbGV0aW9ucy9jb21wbGV0aW9ucy5tanNcIjtcbmV4cG9ydCBjbGFzcyBDaGF0IGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25zID0gbmV3IENvbXBsZXRpb25zQVBJLkNvbXBsZXRpb25zKHRoaXMuX2NsaWVudCk7XG4gICAgfVxufVxuQ2hhdC5Db21wbGV0aW9ucyA9IENvbXBsZXRpb25zO1xuQ2hhdC5DaGF0Q29tcGxldGlvbnNQYWdlID0gQ2hhdENvbXBsZXRpb25zUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNoYXQubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCAqIGFzIE1lc3NhZ2VzQVBJIGZyb20gXCIuL21lc3NhZ2VzLm1qc1wiO1xuaW1wb3J0IHsgTWVzc2FnZXMgfSBmcm9tIFwiLi9tZXNzYWdlcy5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb21wbGV0aW9ucyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IG5ldyBNZXNzYWdlc0FQSS5NZXNzYWdlcyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbiAgICBjcmVhdGUoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9jaGF0L2NvbXBsZXRpb25zJywgeyBib2R5LCAuLi5vcHRpb25zLCBzdHJlYW06IGJvZHkuc3RyZWFtID8/IGZhbHNlIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzdG9yZWQgY2hhdCBjb21wbGV0aW9uLiBPbmx5IGNoYXQgY29tcGxldGlvbnMgdGhhdCBoYXZlIGJlZW4gY3JlYXRlZCB3aXRoXG4gICAgICogdGhlIGBzdG9yZWAgcGFyYW1ldGVyIHNldCB0byBgdHJ1ZWAgd2lsbCBiZSByZXR1cm5lZC5cbiAgICAgKi9cbiAgICByZXRyaWV2ZShjb21wbGV0aW9uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9jaGF0L2NvbXBsZXRpb25zLyR7Y29tcGxldGlvbklkfWAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBNb2RpZnkgYSBzdG9yZWQgY2hhdCBjb21wbGV0aW9uLiBPbmx5IGNoYXQgY29tcGxldGlvbnMgdGhhdCBoYXZlIGJlZW4gY3JlYXRlZFxuICAgICAqIHdpdGggdGhlIGBzdG9yZWAgcGFyYW1ldGVyIHNldCB0byBgdHJ1ZWAgY2FuIGJlIG1vZGlmaWVkLiBDdXJyZW50bHksIHRoZSBvbmx5XG4gICAgICogc3VwcG9ydGVkIG1vZGlmaWNhdGlvbiBpcyB0byB1cGRhdGUgdGhlIGBtZXRhZGF0YWAgZmllbGQuXG4gICAgICovXG4gICAgdXBkYXRlKGNvbXBsZXRpb25JZCwgYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoYC9jaGF0L2NvbXBsZXRpb25zLyR7Y29tcGxldGlvbklkfWAsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgbGlzdChxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL2NoYXQvY29tcGxldGlvbnMnLCBDaGF0Q29tcGxldGlvbnNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSBzdG9yZWQgY2hhdCBjb21wbGV0aW9uLiBPbmx5IGNoYXQgY29tcGxldGlvbnMgdGhhdCBoYXZlIGJlZW4gY3JlYXRlZFxuICAgICAqIHdpdGggdGhlIGBzdG9yZWAgcGFyYW1ldGVyIHNldCB0byBgdHJ1ZWAgY2FuIGJlIGRlbGV0ZWQuXG4gICAgICovXG4gICAgZGVsKGNvbXBsZXRpb25JZCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LmRlbGV0ZShgL2NoYXQvY29tcGxldGlvbnMvJHtjb21wbGV0aW9uSWR9YCwgb3B0aW9ucyk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIENoYXRDb21wbGV0aW9uc1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbmV4cG9ydCBjbGFzcyBDaGF0Q29tcGxldGlvblN0b3JlTWVzc2FnZXNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5Db21wbGV0aW9ucy5DaGF0Q29tcGxldGlvbnNQYWdlID0gQ2hhdENvbXBsZXRpb25zUGFnZTtcbkNvbXBsZXRpb25zLk1lc3NhZ2VzID0gTWVzc2FnZXM7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb21wbGV0aW9ucy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQ2hhdENvbXBsZXRpb25TdG9yZU1lc3NhZ2VzUGFnZSB9IGZyb20gXCIuL2NvbXBsZXRpb25zLm1qc1wiO1xuZXhwb3J0IGNsYXNzIE1lc3NhZ2VzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGxpc3QoY29tcGxldGlvbklkLCBxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdChjb21wbGV0aW9uSWQsIHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KGAvY2hhdC9jb21wbGV0aW9ucy8ke2NvbXBsZXRpb25JZH0vbWVzc2FnZXNgLCBDaGF0Q29tcGxldGlvblN0b3JlTWVzc2FnZXNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbn1cbmV4cG9ydCB7IENoYXRDb21wbGV0aW9uU3RvcmVNZXNzYWdlc1BhZ2UgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1lc3NhZ2VzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29tcGxldGlvbnMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvY29tcGxldGlvbnMnLCB7IGJvZHksIC4uLm9wdGlvbnMsIHN0cmVhbTogYm9keS5zdHJlYW0gPz8gZmFsc2UgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29tcGxldGlvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi9yZXNvdXJjZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBFbWJlZGRpbmdzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gZW1iZWRkaW5nIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIGlucHV0IHRleHQuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvZW1iZWRkaW5ncycsIHsgYm9keSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lbWJlZGRpbmdzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgeyBpc1JlcXVlc3RPcHRpb25zIH0gZnJvbSBcIi4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBzbGVlcCB9IGZyb20gXCIuLi9jb3JlLm1qc1wiO1xuaW1wb3J0IHsgQVBJQ29ubmVjdGlvblRpbWVvdXRFcnJvciB9IGZyb20gXCIuLi9lcnJvci5tanNcIjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4uL2NvcmUubWpzXCI7XG5pbXBvcnQgeyBDdXJzb3JQYWdlIH0gZnJvbSBcIi4uL3BhZ2luYXRpb24ubWpzXCI7XG5leHBvcnQgY2xhc3MgRmlsZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogVXBsb2FkIGEgZmlsZSB0aGF0IGNhbiBiZSB1c2VkIGFjcm9zcyB2YXJpb3VzIGVuZHBvaW50cy4gSW5kaXZpZHVhbCBmaWxlcyBjYW4gYmVcbiAgICAgKiB1cCB0byA1MTIgTUIsIGFuZCB0aGUgc2l6ZSBvZiBhbGwgZmlsZXMgdXBsb2FkZWQgYnkgb25lIG9yZ2FuaXphdGlvbiBjYW4gYmUgdXBcbiAgICAgKiB0byAxMDAgR0IuXG4gICAgICpcbiAgICAgKiBUaGUgQXNzaXN0YW50cyBBUEkgc3VwcG9ydHMgZmlsZXMgdXAgdG8gMiBtaWxsaW9uIHRva2VucyBhbmQgb2Ygc3BlY2lmaWMgZmlsZVxuICAgICAqIHR5cGVzLiBTZWUgdGhlXG4gICAgICogW0Fzc2lzdGFudHMgVG9vbHMgZ3VpZGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2Fzc2lzdGFudHMvdG9vbHMpIGZvclxuICAgICAqIGRldGFpbHMuXG4gICAgICpcbiAgICAgKiBUaGUgRmluZS10dW5pbmcgQVBJIG9ubHkgc3VwcG9ydHMgYC5qc29ubGAgZmlsZXMuIFRoZSBpbnB1dCBhbHNvIGhhcyBjZXJ0YWluXG4gICAgICogcmVxdWlyZWQgZm9ybWF0cyBmb3IgZmluZS10dW5pbmdcbiAgICAgKiBbY2hhdF0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maW5lLXR1bmluZy9jaGF0LWlucHV0KSBvclxuICAgICAqIFtjb21wbGV0aW9uc10oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maW5lLXR1bmluZy9jb21wbGV0aW9ucy1pbnB1dClcbiAgICAgKiBtb2RlbHMuXG4gICAgICpcbiAgICAgKiBUaGUgQmF0Y2ggQVBJIG9ubHkgc3VwcG9ydHMgYC5qc29ubGAgZmlsZXMgdXAgdG8gMjAwIE1CIGluIHNpemUuIFRoZSBpbnB1dCBhbHNvXG4gICAgICogaGFzIGEgc3BlY2lmaWMgcmVxdWlyZWRcbiAgICAgKiBbZm9ybWF0XShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2JhdGNoL3JlcXVlc3QtaW5wdXQpLlxuICAgICAqXG4gICAgICogUGxlYXNlIFtjb250YWN0IHVzXShodHRwczovL2hlbHAub3BlbmFpLmNvbS8pIGlmIHlvdSBuZWVkIHRvIGluY3JlYXNlIHRoZXNlXG4gICAgICogc3RvcmFnZSBsaW1pdHMuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvZmlsZXMnLCBDb3JlLm11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyh7IGJvZHksIC4uLm9wdGlvbnMgfSkpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IGEgc3BlY2lmaWMgZmlsZS5cbiAgICAgKi9cbiAgICByZXRyaWV2ZShmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9maWxlcy8ke2ZpbGVJZH1gLCBvcHRpb25zKTtcbiAgICB9XG4gICAgbGlzdChxdWVyeSA9IHt9LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChpc1JlcXVlc3RPcHRpb25zKHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGlzdCh7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdCgnL2ZpbGVzJywgRmlsZU9iamVjdHNQYWdlLCB7IHF1ZXJ5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSBmaWxlLlxuICAgICAqL1xuICAgIGRlbChmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC9maWxlcy8ke2ZpbGVJZH1gLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY29udGVudHMgb2YgdGhlIHNwZWNpZmllZCBmaWxlLlxuICAgICAqL1xuICAgIGNvbnRlbnQoZmlsZUlkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvZmlsZXMvJHtmaWxlSWR9L2NvbnRlbnRgLCB7XG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgaGVhZGVyczogeyBBY2NlcHQ6ICdhcHBsaWNhdGlvbi9iaW5hcnknLCAuLi5vcHRpb25zPy5oZWFkZXJzIH0sXG4gICAgICAgICAgICBfX2JpbmFyeVJlc3BvbnNlOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY29udGVudHMgb2YgdGhlIHNwZWNpZmllZCBmaWxlLlxuICAgICAqXG4gICAgICogQGRlcHJlY2F0ZWQgVGhlIGAuY29udGVudCgpYCBtZXRob2Qgc2hvdWxkIGJlIHVzZWQgaW5zdGVhZFxuICAgICAqL1xuICAgIHJldHJpZXZlQ29udGVudChmaWxlSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9maWxlcy8ke2ZpbGVJZH0vY29udGVudGAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBXYWl0cyBmb3IgdGhlIGdpdmVuIGZpbGUgdG8gYmUgcHJvY2Vzc2VkLCBkZWZhdWx0IHRpbWVvdXQgaXMgMzAgbWlucy5cbiAgICAgKi9cbiAgICBhc3luYyB3YWl0Rm9yUHJvY2Vzc2luZyhpZCwgeyBwb2xsSW50ZXJ2YWwgPSA1MDAwLCBtYXhXYWl0ID0gMzAgKiA2MCAqIDEwMDAgfSA9IHt9KSB7XG4gICAgICAgIGNvbnN0IFRFUk1JTkFMX1NUQVRFUyA9IG5ldyBTZXQoWydwcm9jZXNzZWQnLCAnZXJyb3InLCAnZGVsZXRlZCddKTtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICBsZXQgZmlsZSA9IGF3YWl0IHRoaXMucmV0cmlldmUoaWQpO1xuICAgICAgICB3aGlsZSAoIWZpbGUuc3RhdHVzIHx8ICFURVJNSU5BTF9TVEFURVMuaGFzKGZpbGUuc3RhdHVzKSkge1xuICAgICAgICAgICAgYXdhaXQgc2xlZXAocG9sbEludGVydmFsKTtcbiAgICAgICAgICAgIGZpbGUgPSBhd2FpdCB0aGlzLnJldHJpZXZlKGlkKTtcbiAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnQgPiBtYXhXYWl0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEFQSUNvbm5lY3Rpb25UaW1lb3V0RXJyb3Ioe1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgR2l2aW5nIHVwIG9uIHdhaXRpbmcgZm9yIGZpbGUgJHtpZH0gdG8gZmluaXNoIHByb2Nlc3NpbmcgYWZ0ZXIgJHttYXhXYWl0fSBtaWxsaXNlY29uZHMuYCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgRmlsZU9iamVjdHNQYWdlIGV4dGVuZHMgQ3Vyc29yUGFnZSB7XG59XG5GaWxlcy5GaWxlT2JqZWN0c1BhZ2UgPSBGaWxlT2JqZWN0c1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgSm9ic0FQSSBmcm9tIFwiLi9qb2JzL2pvYnMubWpzXCI7XG5pbXBvcnQgeyBGaW5lVHVuaW5nSm9iRXZlbnRzUGFnZSwgRmluZVR1bmluZ0pvYnNQYWdlLCBKb2JzLCB9IGZyb20gXCIuL2pvYnMvam9icy5tanNcIjtcbmV4cG9ydCBjbGFzcyBGaW5lVHVuaW5nIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmpvYnMgPSBuZXcgSm9ic0FQSS5Kb2JzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxufVxuRmluZVR1bmluZy5Kb2JzID0gSm9icztcbkZpbmVUdW5pbmcuRmluZVR1bmluZ0pvYnNQYWdlID0gRmluZVR1bmluZ0pvYnNQYWdlO1xuRmluZVR1bmluZy5GaW5lVHVuaW5nSm9iRXZlbnRzUGFnZSA9IEZpbmVUdW5pbmdKb2JFdmVudHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmluZS10dW5pbmcubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCB7IGlzUmVxdWVzdE9wdGlvbnMgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBDaGVja3BvaW50cyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBsaXN0KGZpbmVUdW5pbmdKb2JJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3QoZmluZVR1bmluZ0pvYklkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL2ZpbmVfdHVuaW5nL2pvYnMvJHtmaW5lVHVuaW5nSm9iSWR9L2NoZWNrcG9pbnRzYCwgRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuQ2hlY2twb2ludHMuRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZSA9IEZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jaGVja3BvaW50cy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgaXNSZXF1ZXN0T3B0aW9ucyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ2hlY2twb2ludHNBUEkgZnJvbSBcIi4vY2hlY2twb2ludHMubWpzXCI7XG5pbXBvcnQgeyBDaGVja3BvaW50cywgRmluZVR1bmluZ0pvYkNoZWNrcG9pbnRzUGFnZSwgfSBmcm9tIFwiLi9jaGVja3BvaW50cy5tanNcIjtcbmltcG9ydCB7IEN1cnNvclBhZ2UgfSBmcm9tIFwiLi4vLi4vLi4vcGFnaW5hdGlvbi5tanNcIjtcbmV4cG9ydCBjbGFzcyBKb2JzIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmNoZWNrcG9pbnRzID0gbmV3IENoZWNrcG9pbnRzQVBJLkNoZWNrcG9pbnRzKHRoaXMuX2NsaWVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmaW5lLXR1bmluZyBqb2Igd2hpY2ggYmVnaW5zIHRoZSBwcm9jZXNzIG9mIGNyZWF0aW5nIGEgbmV3IG1vZGVsIGZyb21cbiAgICAgKiBhIGdpdmVuIGRhdGFzZXQuXG4gICAgICpcbiAgICAgKiBSZXNwb25zZSBpbmNsdWRlcyBkZXRhaWxzIG9mIHRoZSBlbnF1ZXVlZCBqb2IgaW5jbHVkaW5nIGpvYiBzdGF0dXMgYW5kIHRoZSBuYW1lXG4gICAgICogb2YgdGhlIGZpbmUtdHVuZWQgbW9kZWxzIG9uY2UgY29tcGxldGUuXG4gICAgICpcbiAgICAgKiBbTGVhcm4gbW9yZSBhYm91dCBmaW5lLXR1bmluZ10oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvZ3VpZGVzL2ZpbmUtdHVuaW5nKVxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2ZpbmVfdHVuaW5nL2pvYnMnLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEdldCBpbmZvIGFib3V0IGEgZmluZS10dW5pbmcgam9iLlxuICAgICAqXG4gICAgICogW0xlYXJuIG1vcmUgYWJvdXQgZmluZS10dW5pbmddKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2d1aWRlcy9maW5lLXR1bmluZylcbiAgICAgKi9cbiAgICByZXRyaWV2ZShmaW5lVHVuaW5nSm9iSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXQoYC9maW5lX3R1bmluZy9qb2JzLyR7ZmluZVR1bmluZ0pvYklkfWAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBsaXN0KHF1ZXJ5ID0ge30sIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGlzUmVxdWVzdE9wdGlvbnMocXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0KHt9LCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvZmluZV90dW5pbmcvam9icycsIEZpbmVUdW5pbmdKb2JzUGFnZSwgeyBxdWVyeSwgLi4ub3B0aW9ucyB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlbHkgY2FuY2VsIGEgZmluZS10dW5lIGpvYi5cbiAgICAgKi9cbiAgICBjYW5jZWwoZmluZVR1bmluZ0pvYklkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL2ZpbmVfdHVuaW5nL2pvYnMvJHtmaW5lVHVuaW5nSm9iSWR9L2NhbmNlbGAsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBsaXN0RXZlbnRzKGZpbmVUdW5pbmdKb2JJZCwgcXVlcnkgPSB7fSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoaXNSZXF1ZXN0T3B0aW9ucyhxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpc3RFdmVudHMoZmluZVR1bmluZ0pvYklkLCB7fSwgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0QVBJTGlzdChgL2ZpbmVfdHVuaW5nL2pvYnMvJHtmaW5lVHVuaW5nSm9iSWR9L2V2ZW50c2AsIEZpbmVUdW5pbmdKb2JFdmVudHNQYWdlLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBGaW5lVHVuaW5nSm9ic1BhZ2UgZXh0ZW5kcyBDdXJzb3JQYWdlIHtcbn1cbmV4cG9ydCBjbGFzcyBGaW5lVHVuaW5nSm9iRXZlbnRzUGFnZSBleHRlbmRzIEN1cnNvclBhZ2Uge1xufVxuSm9icy5GaW5lVHVuaW5nSm9ic1BhZ2UgPSBGaW5lVHVuaW5nSm9ic1BhZ2U7XG5Kb2JzLkZpbmVUdW5pbmdKb2JFdmVudHNQYWdlID0gRmluZVR1bmluZ0pvYkV2ZW50c1BhZ2U7XG5Kb2JzLkNoZWNrcG9pbnRzID0gQ2hlY2twb2ludHM7XG5Kb2JzLkZpbmVUdW5pbmdKb2JDaGVja3BvaW50c1BhZ2UgPSBGaW5lVHVuaW5nSm9iQ2hlY2twb2ludHNQYWdlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9am9icy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0ICogYXMgQ29yZSBmcm9tIFwiLi4vY29yZS5tanNcIjtcbmV4cG9ydCBjbGFzcyBJbWFnZXMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHZhcmlhdGlvbiBvZiBhIGdpdmVuIGltYWdlLlxuICAgICAqL1xuICAgIGNyZWF0ZVZhcmlhdGlvbihib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL2ltYWdlcy92YXJpYXRpb25zJywgQ29yZS5tdWx0aXBhcnRGb3JtUmVxdWVzdE9wdGlvbnMoeyBib2R5LCAuLi5vcHRpb25zIH0pKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBlZGl0ZWQgb3IgZXh0ZW5kZWQgaW1hZ2UgZ2l2ZW4gYW4gb3JpZ2luYWwgaW1hZ2UgYW5kIGEgcHJvbXB0LlxuICAgICAqL1xuICAgIGVkaXQoYm9keSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpZW50LnBvc3QoJy9pbWFnZXMvZWRpdHMnLCBDb3JlLm11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyh7IGJvZHksIC4uLm9wdGlvbnMgfSkpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGltYWdlIGdpdmVuIGEgcHJvbXB0LlxuICAgICAqL1xuICAgIGdlbmVyYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvaW1hZ2VzL2dlbmVyYXRpb25zJywgeyBib2R5LCAuLi5vcHRpb25zIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWltYWdlcy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuaW1wb3J0IHsgUGFnZSB9IGZyb20gXCIuLi9wYWdpbmF0aW9uLm1qc1wiO1xuZXhwb3J0IGNsYXNzIE1vZGVscyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSBtb2RlbCBpbnN0YW5jZSwgcHJvdmlkaW5nIGJhc2ljIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtb2RlbCBzdWNoIGFzXG4gICAgICogdGhlIG93bmVyIGFuZCBwZXJtaXNzaW9uaW5nLlxuICAgICAqL1xuICAgIHJldHJpZXZlKG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQuZ2V0KGAvbW9kZWxzLyR7bW9kZWx9YCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIExpc3RzIHRoZSBjdXJyZW50bHkgYXZhaWxhYmxlIG1vZGVscywgYW5kIHByb3ZpZGVzIGJhc2ljIGluZm9ybWF0aW9uIGFib3V0IGVhY2hcbiAgICAgKiBvbmUgc3VjaCBhcyB0aGUgb3duZXIgYW5kIGF2YWlsYWJpbGl0eS5cbiAgICAgKi9cbiAgICBsaXN0KG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5nZXRBUElMaXN0KCcvbW9kZWxzJywgTW9kZWxzUGFnZSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIGZpbmUtdHVuZWQgbW9kZWwuIFlvdSBtdXN0IGhhdmUgdGhlIE93bmVyIHJvbGUgaW4geW91ciBvcmdhbml6YXRpb24gdG9cbiAgICAgKiBkZWxldGUgYSBtb2RlbC5cbiAgICAgKi9cbiAgICBkZWwobW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5kZWxldGUoYC9tb2RlbHMvJHttb2RlbH1gLCBvcHRpb25zKTtcbiAgICB9XG59XG4vKipcbiAqIE5vdGU6IG5vIHBhZ2luYXRpb24gYWN0dWFsbHkgb2NjdXJzIHlldCwgdGhpcyBpcyBmb3IgZm9yd2FyZHMtY29tcGF0aWJpbGl0eS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vZGVsc1BhZ2UgZXh0ZW5kcyBQYWdlIHtcbn1cbk1vZGVscy5Nb2RlbHNQYWdlID0gTW9kZWxzUGFnZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1vZGVscy5tanMubWFwIiwiLy8gRmlsZSBnZW5lcmF0ZWQgZnJvbSBvdXIgT3BlbkFQSSBzcGVjIGJ5IFN0YWlubGVzcy4gU2VlIENPTlRSSUJVVElORy5tZCBmb3IgZGV0YWlscy5cbmltcG9ydCB7IEFQSVJlc291cmNlIH0gZnJvbSBcIi4uL3Jlc291cmNlLm1qc1wiO1xuZXhwb3J0IGNsYXNzIE1vZGVyYXRpb25zIGV4dGVuZHMgQVBJUmVzb3VyY2Uge1xuICAgIC8qKlxuICAgICAqIENsYXNzaWZpZXMgaWYgdGV4dCBhbmQvb3IgaW1hZ2UgaW5wdXRzIGFyZSBwb3RlbnRpYWxseSBoYXJtZnVsLiBMZWFybiBtb3JlIGluXG4gICAgICogdGhlIFttb2RlcmF0aW9uIGd1aWRlXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9ndWlkZXMvbW9kZXJhdGlvbikuXG4gICAgICovXG4gICAgY3JlYXRlKGJvZHksIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaWVudC5wb3N0KCcvbW9kZXJhdGlvbnMnLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bW9kZXJhdGlvbnMubWpzLm1hcCIsIi8vIEZpbGUgZ2VuZXJhdGVkIGZyb20gb3VyIE9wZW5BUEkgc3BlYyBieSBTdGFpbmxlc3MuIFNlZSBDT05UUklCVVRJTkcubWQgZm9yIGRldGFpbHMuXG5pbXBvcnQgeyBBUElSZXNvdXJjZSB9IGZyb20gXCIuLi8uLi9yZXNvdXJjZS5tanNcIjtcbmltcG9ydCAqIGFzIENvcmUgZnJvbSBcIi4uLy4uL2NvcmUubWpzXCI7XG5leHBvcnQgY2xhc3MgUGFydHMgZXh0ZW5kcyBBUElSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogQWRkcyBhXG4gICAgICogW1BhcnRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdXBsb2Fkcy9wYXJ0LW9iamVjdCkgdG8gYW5cbiAgICAgKiBbVXBsb2FkXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3VwbG9hZHMvb2JqZWN0KSBvYmplY3QuXG4gICAgICogQSBQYXJ0IHJlcHJlc2VudHMgYSBjaHVuayBvZiBieXRlcyBmcm9tIHRoZSBmaWxlIHlvdSBhcmUgdHJ5aW5nIHRvIHVwbG9hZC5cbiAgICAgKlxuICAgICAqIEVhY2ggUGFydCBjYW4gYmUgYXQgbW9zdCA2NCBNQiwgYW5kIHlvdSBjYW4gYWRkIFBhcnRzIHVudGlsIHlvdSBoaXQgdGhlIFVwbG9hZFxuICAgICAqIG1heGltdW0gb2YgOCBHQi5cbiAgICAgKlxuICAgICAqIEl0IGlzIHBvc3NpYmxlIHRvIGFkZCBtdWx0aXBsZSBQYXJ0cyBpbiBwYXJhbGxlbC4gWW91IGNhbiBkZWNpZGUgdGhlIGludGVuZGVkXG4gICAgICogb3JkZXIgb2YgdGhlIFBhcnRzIHdoZW4geW91XG4gICAgICogW2NvbXBsZXRlIHRoZSBVcGxvYWRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdXBsb2Fkcy9jb21wbGV0ZSkuXG4gICAgICovXG4gICAgY3JlYXRlKHVwbG9hZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3VwbG9hZHMvJHt1cGxvYWRJZH0vcGFydHNgLCBDb3JlLm11bHRpcGFydEZvcm1SZXF1ZXN0T3B0aW9ucyh7IGJvZHksIC4uLm9wdGlvbnMgfSkpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBhcnRzLm1qcy5tYXAiLCIvLyBGaWxlIGdlbmVyYXRlZCBmcm9tIG91ciBPcGVuQVBJIHNwZWMgYnkgU3RhaW5sZXNzLiBTZWUgQ09OVFJJQlVUSU5HLm1kIGZvciBkZXRhaWxzLlxuaW1wb3J0IHsgQVBJUmVzb3VyY2UgfSBmcm9tIFwiLi4vLi4vcmVzb3VyY2UubWpzXCI7XG5pbXBvcnQgKiBhcyBQYXJ0c0FQSSBmcm9tIFwiLi9wYXJ0cy5tanNcIjtcbmltcG9ydCB7IFBhcnRzIH0gZnJvbSBcIi4vcGFydHMubWpzXCI7XG5leHBvcnQgY2xhc3MgVXBsb2FkcyBleHRlbmRzIEFQSVJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5wYXJ0cyA9IG5ldyBQYXJ0c0FQSS5QYXJ0cyh0aGlzLl9jbGllbnQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIGludGVybWVkaWF0ZVxuICAgICAqIFtVcGxvYWRdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdXBsb2Fkcy9vYmplY3QpIG9iamVjdFxuICAgICAqIHRoYXQgeW91IGNhbiBhZGRcbiAgICAgKiBbUGFydHNdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvdXBsb2Fkcy9wYXJ0LW9iamVjdCkgdG8uXG4gICAgICogQ3VycmVudGx5LCBhbiBVcGxvYWQgY2FuIGFjY2VwdCBhdCBtb3N0IDggR0IgaW4gdG90YWwgYW5kIGV4cGlyZXMgYWZ0ZXIgYW4gaG91clxuICAgICAqIGFmdGVyIHlvdSBjcmVhdGUgaXQuXG4gICAgICpcbiAgICAgKiBPbmNlIHlvdSBjb21wbGV0ZSB0aGUgVXBsb2FkLCB3ZSB3aWxsIGNyZWF0ZSBhXG4gICAgICogW0ZpbGVdKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvZmlsZXMvb2JqZWN0KSBvYmplY3QgdGhhdFxuICAgICAqIGNvbnRhaW5zIGFsbCB0aGUgcGFydHMgeW91IHVwbG9hZGVkLiBUaGlzIEZpbGUgaXMgdXNhYmxlIGluIHRoZSByZXN0IG9mIG91clxuICAgICAqIHBsYXRmb3JtIGFzIGEgcmVndWxhciBGaWxlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEZvciBjZXJ0YWluIGBwdXJwb3NlYHMsIHRoZSBjb3JyZWN0IGBtaW1lX3R5cGVgIG11c3QgYmUgc3BlY2lmaWVkLiBQbGVhc2UgcmVmZXJcbiAgICAgKiB0byBkb2N1bWVudGF0aW9uIGZvciB0aGUgc3VwcG9ydGVkIE1JTUUgdHlwZXMgZm9yIHlvdXIgdXNlIGNhc2U6XG4gICAgICpcbiAgICAgKiAtIFtBc3Npc3RhbnRzXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hc3Npc3RhbnRzL3Rvb2xzL2ZpbGUtc2VhcmNoI3N1cHBvcnRlZC1maWxlcylcbiAgICAgKlxuICAgICAqIEZvciBndWlkYW5jZSBvbiB0aGUgcHJvcGVyIGZpbGVuYW1lIGV4dGVuc2lvbnMgZm9yIGVhY2ggcHVycG9zZSwgcGxlYXNlIGZvbGxvd1xuICAgICAqIHRoZSBkb2N1bWVudGF0aW9uIG9uXG4gICAgICogW2NyZWF0aW5nIGEgRmlsZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maWxlcy9jcmVhdGUpLlxuICAgICAqL1xuICAgIGNyZWF0ZShib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdCgnL3VwbG9hZHMnLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbmNlbHMgdGhlIFVwbG9hZC4gTm8gUGFydHMgbWF5IGJlIGFkZGVkIGFmdGVyIGFuIFVwbG9hZCBpcyBjYW5jZWxsZWQuXG4gICAgICovXG4gICAgY2FuY2VsKHVwbG9hZElkLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3VwbG9hZHMvJHt1cGxvYWRJZH0vY2FuY2VsYCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENvbXBsZXRlcyB0aGVcbiAgICAgKiBbVXBsb2FkXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL3VwbG9hZHMvb2JqZWN0KS5cbiAgICAgKlxuICAgICAqIFdpdGhpbiB0aGUgcmV0dXJuZWQgVXBsb2FkIG9iamVjdCwgdGhlcmUgaXMgYSBuZXN0ZWRcbiAgICAgKiBbRmlsZV0oaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9maWxlcy9vYmplY3QpIG9iamVjdCB0aGF0XG4gICAgICogaXMgcmVhZHkgdG8gdXNlIGluIHRoZSByZXN0IG9mIHRoZSBwbGF0Zm9ybS5cbiAgICAgKlxuICAgICAqIFlvdSBjYW4gc3BlY2lmeSB0aGUgb3JkZXIgb2YgdGhlIFBhcnRzIGJ5IHBhc3NpbmcgaW4gYW4gb3JkZXJlZCBsaXN0IG9mIHRoZSBQYXJ0XG4gICAgICogSURzLlxuICAgICAqXG4gICAgICogVGhlIG51bWJlciBvZiBieXRlcyB1cGxvYWRlZCB1cG9uIGNvbXBsZXRpb24gbXVzdCBtYXRjaCB0aGUgbnVtYmVyIG9mIGJ5dGVzXG4gICAgICogaW5pdGlhbGx5IHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIHRoZSBVcGxvYWQgb2JqZWN0LiBObyBQYXJ0cyBtYXkgYmUgYWRkZWQgYWZ0ZXJcbiAgICAgKiBhbiBVcGxvYWQgaXMgY29tcGxldGVkLlxuICAgICAqL1xuICAgIGNvbXBsZXRlKHVwbG9hZElkLCBib2R5LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGllbnQucG9zdChgL3VwbG9hZHMvJHt1cGxvYWRJZH0vY29tcGxldGVgLCB7IGJvZHksIC4uLm9wdGlvbnMgfSk7XG4gICAgfVxufVxuVXBsb2Fkcy5QYXJ0cyA9IFBhcnRzO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXBsb2Fkcy5tanMubWFwIiwiaW1wb3J0IHsgUmVhZGFibGVTdHJlYW0gfSBmcm9tIFwiLi9fc2hpbXMvaW5kZXgubWpzXCI7XG5pbXBvcnQgeyBPcGVuQUlFcnJvciB9IGZyb20gXCIuL2Vycm9yLm1qc1wiO1xuaW1wb3J0IHsgTGluZURlY29kZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9kZWNvZGVycy9saW5lLm1qc1wiO1xuaW1wb3J0IHsgUmVhZGFibGVTdHJlYW1Ub0FzeW5jSXRlcmFibGUgfSBmcm9tIFwiLi9pbnRlcm5hbC9zdHJlYW0tdXRpbHMubWpzXCI7XG5pbXBvcnQgeyBBUElFcnJvciB9IGZyb20gXCIuL2Vycm9yLm1qc1wiO1xuZXhwb3J0IGNsYXNzIFN0cmVhbSB7XG4gICAgY29uc3RydWN0b3IoaXRlcmF0b3IsIGNvbnRyb2xsZXIpIHtcbiAgICAgICAgdGhpcy5pdGVyYXRvciA9IGl0ZXJhdG9yO1xuICAgICAgICB0aGlzLmNvbnRyb2xsZXIgPSBjb250cm9sbGVyO1xuICAgIH1cbiAgICBzdGF0aWMgZnJvbVNTRVJlc3BvbnNlKHJlc3BvbnNlLCBjb250cm9sbGVyKSB7XG4gICAgICAgIGxldCBjb25zdW1lZCA9IGZhbHNlO1xuICAgICAgICBhc3luYyBmdW5jdGlvbiogaXRlcmF0b3IoKSB7XG4gICAgICAgICAgICBpZiAoY29uc3VtZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBpdGVyYXRlIG92ZXIgYSBjb25zdW1lZCBzdHJlYW0sIHVzZSBgLnRlZSgpYCB0byBzcGxpdCB0aGUgc3RyZWFtLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3VtZWQgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzc2Ugb2YgX2l0ZXJTU0VNZXNzYWdlcyhyZXNwb25zZSwgY29udHJvbGxlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbmUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNzZS5kYXRhLnN0YXJ0c1dpdGgoJ1tET05FXScpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzc2UuZXZlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRhO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShzc2UuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkIG5vdCBwYXJzZSBtZXNzYWdlIGludG8gSlNPTjpgLCBzc2UuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRnJvbSBjaHVuazpgLCBzc2UucmF3KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBBUElFcnJvcih1bmRlZmluZWQsIGRhdGEuZXJyb3IsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHlpZWxkIGRhdGE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IEpTT04ucGFyc2Uoc3NlLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBDb3VsZCBub3QgcGFyc2UgbWVzc2FnZSBpbnRvIEpTT046YCwgc3NlLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZyb20gY2h1bms6YCwgc3NlLnJhdyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IElzIHRoaXMgd2hlcmUgdGhlIGVycm9yIHNob3VsZCBiZSB0aHJvd24/XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3NlLmV2ZW50ID09ICdlcnJvcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQVBJRXJyb3IodW5kZWZpbmVkLCBkYXRhLmVycm9yLCBkYXRhLm1lc3NhZ2UsIHVuZGVmaW5lZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB5aWVsZCB7IGV2ZW50OiBzc2UuZXZlbnQsIGRhdGE6IGRhdGEgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHVzZXIgY2FsbHMgYHN0cmVhbS5jb250cm9sbGVyLmFib3J0KClgLCB3ZSBzaG91bGQgZXhpdCB3aXRob3V0IHRocm93aW5nLlxuICAgICAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IgJiYgZS5uYW1lID09PSAnQWJvcnRFcnJvcicpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmluYWxseSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHVzZXIgYGJyZWFrYHMsIGFib3J0IHRoZSBvbmdvaW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAgICAgaWYgKCFkb25lKVxuICAgICAgICAgICAgICAgICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBTdHJlYW0oaXRlcmF0b3IsIGNvbnRyb2xsZXIpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYSBTdHJlYW0gZnJvbSBhIG5ld2xpbmUtc2VwYXJhdGVkIFJlYWRhYmxlU3RyZWFtXG4gICAgICogd2hlcmUgZWFjaCBpdGVtIGlzIGEgSlNPTiB2YWx1ZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgZnJvbVJlYWRhYmxlU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCBjb250cm9sbGVyKSB7XG4gICAgICAgIGxldCBjb25zdW1lZCA9IGZhbHNlO1xuICAgICAgICBhc3luYyBmdW5jdGlvbiogaXRlckxpbmVzKCkge1xuICAgICAgICAgICAgY29uc3QgbGluZURlY29kZXIgPSBuZXcgTGluZURlY29kZXIoKTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZXIgPSBSZWFkYWJsZVN0cmVhbVRvQXN5bmNJdGVyYWJsZShyZWFkYWJsZVN0cmVhbSk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIGl0ZXIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZURlY29kZXIuZGVjb2RlKGNodW5rKSkge1xuICAgICAgICAgICAgICAgICAgICB5aWVsZCBsaW5lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lRGVjb2Rlci5mbHVzaCgpKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgbGluZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhc3luYyBmdW5jdGlvbiogaXRlcmF0b3IoKSB7XG4gICAgICAgICAgICBpZiAoY29uc3VtZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBpdGVyYXRlIG92ZXIgYSBjb25zdW1lZCBzdHJlYW0sIHVzZSBgLnRlZSgpYCB0byBzcGxpdCB0aGUgc3RyZWFtLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3VtZWQgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIGl0ZXJMaW5lcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb25lKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaW5lKVxuICAgICAgICAgICAgICAgICAgICAgICAgeWllbGQgSlNPTi5wYXJzZShsaW5lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSB1c2VyIGNhbGxzIGBzdHJlYW0uY29udHJvbGxlci5hYm9ydCgpYCwgd2Ugc2hvdWxkIGV4aXQgd2l0aG91dCB0aHJvd2luZy5cbiAgICAgICAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yICYmIGUubmFtZSA9PT0gJ0Fib3J0RXJyb3InKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSB1c2VyIGBicmVha2BzLCBhYm9ydCB0aGUgb25nb2luZyByZXF1ZXN0LlxuICAgICAgICAgICAgICAgIGlmICghZG9uZSlcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgU3RyZWFtKGl0ZXJhdG9yLCBjb250cm9sbGVyKTtcbiAgICB9XG4gICAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXRlcmF0b3IoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3BsaXRzIHRoZSBzdHJlYW0gaW50byB0d28gc3RyZWFtcyB3aGljaCBjYW4gYmVcbiAgICAgKiBpbmRlcGVuZGVudGx5IHJlYWQgZnJvbSBhdCBkaWZmZXJlbnQgc3BlZWRzLlxuICAgICAqL1xuICAgIHRlZSgpIHtcbiAgICAgICAgY29uc3QgbGVmdCA9IFtdO1xuICAgICAgICBjb25zdCByaWdodCA9IFtdO1xuICAgICAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0b3IoKTtcbiAgICAgICAgY29uc3QgdGVlSXRlcmF0b3IgPSAocXVldWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbmV4dDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZWZ0LnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJpZ2h0LnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIG5ldyBTdHJlYW0oKCkgPT4gdGVlSXRlcmF0b3IobGVmdCksIHRoaXMuY29udHJvbGxlciksXG4gICAgICAgICAgICBuZXcgU3RyZWFtKCgpID0+IHRlZUl0ZXJhdG9yKHJpZ2h0KSwgdGhpcy5jb250cm9sbGVyKSxcbiAgICAgICAgXTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhpcyBzdHJlYW0gdG8gYSBuZXdsaW5lLXNlcGFyYXRlZCBSZWFkYWJsZVN0cmVhbSBvZlxuICAgICAqIEpTT04gc3RyaW5naWZpZWQgdmFsdWVzIGluIHRoZSBzdHJlYW1cbiAgICAgKiB3aGljaCBjYW4gYmUgdHVybmVkIGJhY2sgaW50byBhIFN0cmVhbSB3aXRoIGBTdHJlYW0uZnJvbVJlYWRhYmxlU3RyZWFtKClgLlxuICAgICAqL1xuICAgIHRvUmVhZGFibGVTdHJlYW0oKSB7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICBsZXQgaXRlcjtcbiAgICAgICAgY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICAgICAgICByZXR1cm4gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICAgICAgICAgIGFzeW5jIHN0YXJ0KCkge1xuICAgICAgICAgICAgICAgIGl0ZXIgPSBzZWxmW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzeW5jIHB1bGwoY3RybCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgdmFsdWUsIGRvbmUgfSA9IGF3YWl0IGl0ZXIubmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9uZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdHJsLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ5dGVzID0gZW5jb2Rlci5lbmNvZGUoSlNPTi5zdHJpbmdpZnkodmFsdWUpICsgJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBjdHJsLmVucXVldWUoYnl0ZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0cmwuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXN5bmMgY2FuY2VsKCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IGl0ZXIucmV0dXJuPy4oKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogX2l0ZXJTU0VNZXNzYWdlcyhyZXNwb25zZSwgY29udHJvbGxlcikge1xuICAgIGlmICghcmVzcG9uc2UuYm9keSkge1xuICAgICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgICAgIHRocm93IG5ldyBPcGVuQUlFcnJvcihgQXR0ZW1wdGVkIHRvIGl0ZXJhdGUgb3ZlciBhIHJlc3BvbnNlIHdpdGggbm8gYm9keWApO1xuICAgIH1cbiAgICBjb25zdCBzc2VEZWNvZGVyID0gbmV3IFNTRURlY29kZXIoKTtcbiAgICBjb25zdCBsaW5lRGVjb2RlciA9IG5ldyBMaW5lRGVjb2RlcigpO1xuICAgIGNvbnN0IGl0ZXIgPSBSZWFkYWJsZVN0cmVhbVRvQXN5bmNJdGVyYWJsZShyZXNwb25zZS5ib2R5KTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNzZUNodW5rIG9mIGl0ZXJTU0VDaHVua3MoaXRlcikpIHtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVEZWNvZGVyLmRlY29kZShzc2VDaHVuaykpIHtcbiAgICAgICAgICAgIGNvbnN0IHNzZSA9IHNzZURlY29kZXIuZGVjb2RlKGxpbmUpO1xuICAgICAgICAgICAgaWYgKHNzZSlcbiAgICAgICAgICAgICAgICB5aWVsZCBzc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVEZWNvZGVyLmZsdXNoKCkpIHtcbiAgICAgICAgY29uc3Qgc3NlID0gc3NlRGVjb2Rlci5kZWNvZGUobGluZSk7XG4gICAgICAgIGlmIChzc2UpXG4gICAgICAgICAgICB5aWVsZCBzc2U7XG4gICAgfVxufVxuLyoqXG4gKiBHaXZlbiBhbiBhc3luYyBpdGVyYWJsZSBpdGVyYXRvciwgaXRlcmF0ZXMgb3ZlciBpdCBhbmQgeWllbGRzIGZ1bGxcbiAqIFNTRSBjaHVua3MsIGkuZS4geWllbGRzIHdoZW4gYSBkb3VibGUgbmV3LWxpbmUgaXMgZW5jb3VudGVyZWQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uKiBpdGVyU1NFQ2h1bmtzKGl0ZXJhdG9yKSB7XG4gICAgbGV0IGRhdGEgPSBuZXcgVWludDhBcnJheSgpO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGNodW5rID09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJpbmFyeUNodW5rID0gY2h1bmsgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciA/IG5ldyBVaW50OEFycmF5KGNodW5rKVxuICAgICAgICAgICAgOiB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnID8gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGNodW5rKVxuICAgICAgICAgICAgICAgIDogY2h1bms7XG4gICAgICAgIGxldCBuZXdEYXRhID0gbmV3IFVpbnQ4QXJyYXkoZGF0YS5sZW5ndGggKyBiaW5hcnlDaHVuay5sZW5ndGgpO1xuICAgICAgICBuZXdEYXRhLnNldChkYXRhKTtcbiAgICAgICAgbmV3RGF0YS5zZXQoYmluYXJ5Q2h1bmssIGRhdGEubGVuZ3RoKTtcbiAgICAgICAgZGF0YSA9IG5ld0RhdGE7XG4gICAgICAgIGxldCBwYXR0ZXJuSW5kZXg7XG4gICAgICAgIHdoaWxlICgocGF0dGVybkluZGV4ID0gZmluZERvdWJsZU5ld2xpbmVJbmRleChkYXRhKSkgIT09IC0xKSB7XG4gICAgICAgICAgICB5aWVsZCBkYXRhLnNsaWNlKDAsIHBhdHRlcm5JbmRleCk7XG4gICAgICAgICAgICBkYXRhID0gZGF0YS5zbGljZShwYXR0ZXJuSW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChkYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgeWllbGQgZGF0YTtcbiAgICB9XG59XG5mdW5jdGlvbiBmaW5kRG91YmxlTmV3bGluZUluZGV4KGJ1ZmZlcikge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gc2VhcmNoZXMgdGhlIGJ1ZmZlciBmb3IgdGhlIGVuZCBwYXR0ZXJucyAoXFxyXFxyLCBcXG5cXG4sIFxcclxcblxcclxcbilcbiAgICAvLyBhbmQgcmV0dXJucyB0aGUgaW5kZXggcmlnaHQgYWZ0ZXIgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYW55IHBhdHRlcm4sXG4gICAgLy8gb3IgLTEgaWYgbm9uZSBvZiB0aGUgcGF0dGVybnMgYXJlIGZvdW5kLlxuICAgIGNvbnN0IG5ld2xpbmUgPSAweDBhOyAvLyBcXG5cbiAgICBjb25zdCBjYXJyaWFnZSA9IDB4MGQ7IC8vIFxcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgICBpZiAoYnVmZmVyW2ldID09PSBuZXdsaW5lICYmIGJ1ZmZlcltpICsgMV0gPT09IG5ld2xpbmUpIHtcbiAgICAgICAgICAgIC8vIFxcblxcblxuICAgICAgICAgICAgcmV0dXJuIGkgKyAyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChidWZmZXJbaV0gPT09IGNhcnJpYWdlICYmIGJ1ZmZlcltpICsgMV0gPT09IGNhcnJpYWdlKSB7XG4gICAgICAgICAgICAvLyBcXHJcXHJcbiAgICAgICAgICAgIHJldHVybiBpICsgMjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYnVmZmVyW2ldID09PSBjYXJyaWFnZSAmJlxuICAgICAgICAgICAgYnVmZmVyW2kgKyAxXSA9PT0gbmV3bGluZSAmJlxuICAgICAgICAgICAgaSArIDMgPCBidWZmZXIubGVuZ3RoICYmXG4gICAgICAgICAgICBidWZmZXJbaSArIDJdID09PSBjYXJyaWFnZSAmJlxuICAgICAgICAgICAgYnVmZmVyW2kgKyAzXSA9PT0gbmV3bGluZSkge1xuICAgICAgICAgICAgLy8gXFxyXFxuXFxyXFxuXG4gICAgICAgICAgICByZXR1cm4gaSArIDQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xufVxuY2xhc3MgU1NFRGVjb2RlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSBudWxsO1xuICAgICAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICAgICAgdGhpcy5jaHVua3MgPSBbXTtcbiAgICB9XG4gICAgZGVjb2RlKGxpbmUpIHtcbiAgICAgICAgaWYgKGxpbmUuZW5kc1dpdGgoJ1xccicpKSB7XG4gICAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHJpbmcoMCwgbGluZS5sZW5ndGggLSAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWxpbmUpIHtcbiAgICAgICAgICAgIC8vIGVtcHR5IGxpbmUgYW5kIHdlIGRpZG4ndCBwcmV2aW91c2x5IGVuY291bnRlciBhbnkgbWVzc2FnZXNcbiAgICAgICAgICAgIGlmICghdGhpcy5ldmVudCAmJiAhdGhpcy5kYXRhLmxlbmd0aClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHNzZSA9IHtcbiAgICAgICAgICAgICAgICBldmVudDogdGhpcy5ldmVudCxcbiAgICAgICAgICAgICAgICBkYXRhOiB0aGlzLmRhdGEuam9pbignXFxuJyksXG4gICAgICAgICAgICAgICAgcmF3OiB0aGlzLmNodW5rcyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmV2ZW50ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZGF0YSA9IFtdO1xuICAgICAgICAgICAgdGhpcy5jaHVua3MgPSBbXTtcbiAgICAgICAgICAgIHJldHVybiBzc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jaHVua3MucHVzaChsaW5lKTtcbiAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnOicpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZpZWxkbmFtZSwgXywgdmFsdWVdID0gcGFydGl0aW9uKGxpbmUsICc6Jyk7XG4gICAgICAgIGlmICh2YWx1ZS5zdGFydHNXaXRoKCcgJykpIHtcbiAgICAgICAgICAgIHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmaWVsZG5hbWUgPT09ICdldmVudCcpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChmaWVsZG5hbWUgPT09ICdkYXRhJykge1xuICAgICAgICAgICAgdGhpcy5kYXRhLnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cbi8qKiBUaGlzIGlzIGFuIGludGVybmFsIGhlbHBlciBmdW5jdGlvbiB0aGF0J3MganVzdCB1c2VkIGZvciB0ZXN0aW5nICovXG5leHBvcnQgZnVuY3Rpb24gX2RlY29kZUNodW5rcyhjaHVua3MsIHsgZmx1c2ggfSA9IHsgZmx1c2g6IGZhbHNlIH0pIHtcbiAgICBjb25zdCBkZWNvZGVyID0gbmV3IExpbmVEZWNvZGVyKCk7XG4gICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGNodW5rcykge1xuICAgICAgICBsaW5lcy5wdXNoKC4uLmRlY29kZXIuZGVjb2RlKGNodW5rKSk7XG4gICAgfVxuICAgIGlmIChmbHVzaCkge1xuICAgICAgICBsaW5lcy5wdXNoKC4uLmRlY29kZXIuZmx1c2goKSk7XG4gICAgfVxuICAgIHJldHVybiBsaW5lcztcbn1cbmZ1bmN0aW9uIHBhcnRpdGlvbihzdHIsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IGluZGV4ID0gc3RyLmluZGV4T2YoZGVsaW1pdGVyKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIHJldHVybiBbc3RyLnN1YnN0cmluZygwLCBpbmRleCksIGRlbGltaXRlciwgc3RyLnN1YnN0cmluZyhpbmRleCArIGRlbGltaXRlci5sZW5ndGgpXTtcbiAgICB9XG4gICAgcmV0dXJuIFtzdHIsICcnLCAnJ107XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdHJlYW1pbmcubWpzLm1hcCIsImltcG9ydCB7IEZvcm1EYXRhLCBGaWxlLCBnZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9ucywgaXNGc1JlYWRTdHJlYW0sIH0gZnJvbSBcIi4vX3NoaW1zL2luZGV4Lm1qc1wiO1xuZXhwb3J0IHsgZmlsZUZyb21QYXRoIH0gZnJvbSBcIi4vX3NoaW1zL2luZGV4Lm1qc1wiO1xuZXhwb3J0IGNvbnN0IGlzUmVzcG9uc2VMaWtlID0gKHZhbHVlKSA9PiB2YWx1ZSAhPSBudWxsICYmXG4gICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiB2YWx1ZS51cmwgPT09ICdzdHJpbmcnICYmXG4gICAgdHlwZW9mIHZhbHVlLmJsb2IgPT09ICdmdW5jdGlvbic7XG5leHBvcnQgY29uc3QgaXNGaWxlTGlrZSA9ICh2YWx1ZSkgPT4gdmFsdWUgIT0gbnVsbCAmJlxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2YgdmFsdWUubmFtZSA9PT0gJ3N0cmluZycgJiZcbiAgICB0eXBlb2YgdmFsdWUubGFzdE1vZGlmaWVkID09PSAnbnVtYmVyJyAmJlxuICAgIGlzQmxvYkxpa2UodmFsdWUpO1xuLyoqXG4gKiBUaGUgQmxvYkxpa2UgdHlwZSBvbWl0cyBhcnJheUJ1ZmZlcigpIGJlY2F1c2UgQHR5cGVzL25vZGUtZmV0Y2hAXjIuNi40IGxhY2tzIGl0OyBidXQgdGhpcyBjaGVja1xuICogYWRkcyB0aGUgYXJyYXlCdWZmZXIoKSBtZXRob2QgdHlwZSBiZWNhdXNlIGl0IGlzIGF2YWlsYWJsZSBhbmQgdXNlZCBhdCBydW50aW1lXG4gKi9cbmV4cG9ydCBjb25zdCBpc0Jsb2JMaWtlID0gKHZhbHVlKSA9PiB2YWx1ZSAhPSBudWxsICYmXG4gICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiB2YWx1ZS5zaXplID09PSAnbnVtYmVyJyAmJlxuICAgIHR5cGVvZiB2YWx1ZS50eXBlID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiB2YWx1ZS50ZXh0ID09PSAnZnVuY3Rpb24nICYmXG4gICAgdHlwZW9mIHZhbHVlLnNsaWNlID09PSAnZnVuY3Rpb24nICYmXG4gICAgdHlwZW9mIHZhbHVlLmFycmF5QnVmZmVyID09PSAnZnVuY3Rpb24nO1xuZXhwb3J0IGNvbnN0IGlzVXBsb2FkYWJsZSA9ICh2YWx1ZSkgPT4ge1xuICAgIHJldHVybiBpc0ZpbGVMaWtlKHZhbHVlKSB8fCBpc1Jlc3BvbnNlTGlrZSh2YWx1ZSkgfHwgaXNGc1JlYWRTdHJlYW0odmFsdWUpO1xufTtcbi8qKlxuICogSGVscGVyIGZvciBjcmVhdGluZyBhIHtAbGluayBGaWxlfSB0byBwYXNzIHRvIGFuIFNESyB1cGxvYWQgbWV0aG9kIGZyb20gYSB2YXJpZXR5IG9mIGRpZmZlcmVudCBkYXRhIGZvcm1hdHNcbiAqIEBwYXJhbSB2YWx1ZSB0aGUgcmF3IGNvbnRlbnQgb2YgdGhlIGZpbGUuICBDYW4gYmUgYW4ge0BsaW5rIFVwbG9hZGFibGV9LCB7QGxpbmsgQmxvYkxpa2VQYXJ0fSwgb3Ige0BsaW5rIEFzeW5jSXRlcmFibGV9IG9mIHtAbGluayBCbG9iTGlrZVBhcnR9c1xuICogQHBhcmFtIHtzdHJpbmc9fSBuYW1lIHRoZSBuYW1lIG9mIHRoZSBmaWxlLiBJZiBvbWl0dGVkLCB0b0ZpbGUgd2lsbCB0cnkgdG8gZGV0ZXJtaW5lIGEgZmlsZSBuYW1lIGZyb20gYml0cyBpZiBwb3NzaWJsZVxuICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zIGFkZGl0aW9uYWwgcHJvcGVydGllc1xuICogQHBhcmFtIHtzdHJpbmc9fSBvcHRpb25zLnR5cGUgdGhlIE1JTUUgdHlwZSBvZiB0aGUgY29udGVudFxuICogQHBhcmFtIHtudW1iZXI9fSBvcHRpb25zLmxhc3RNb2RpZmllZCB0aGUgbGFzdCBtb2RpZmllZCB0aW1lc3RhbXBcbiAqIEByZXR1cm5zIGEge0BsaW5rIEZpbGV9IHdpdGggdGhlIGdpdmVuIHByb3BlcnRpZXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvRmlsZSh2YWx1ZSwgbmFtZSwgb3B0aW9ucykge1xuICAgIC8vIElmIGl0J3MgYSBwcm9taXNlLCByZXNvbHZlIGl0LlxuICAgIHZhbHVlID0gYXdhaXQgdmFsdWU7XG4gICAgLy8gSWYgd2UndmUgYmVlbiBnaXZlbiBhIGBGaWxlYCB3ZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nXG4gICAgaWYgKGlzRmlsZUxpa2UodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKGlzUmVzcG9uc2VMaWtlKHZhbHVlKSkge1xuICAgICAgICBjb25zdCBibG9iID0gYXdhaXQgdmFsdWUuYmxvYigpO1xuICAgICAgICBuYW1lIHx8IChuYW1lID0gbmV3IFVSTCh2YWx1ZS51cmwpLnBhdGhuYW1lLnNwbGl0KC9bXFxcXC9dLykucG9wKCkgPz8gJ3Vua25vd25fZmlsZScpO1xuICAgICAgICAvLyB3ZSBuZWVkIHRvIGNvbnZlcnQgdGhlIGBCbG9iYCBpbnRvIGFuIGFycmF5IGJ1ZmZlciBiZWNhdXNlIHRoZSBgQmxvYmAgY2xhc3NcbiAgICAgICAgLy8gdGhhdCBgbm9kZS1mZXRjaGAgZGVmaW5lcyBpcyBpbmNvbXBhdGlibGUgd2l0aCB0aGUgd2ViIHN0YW5kYXJkIHdoaWNoIHJlc3VsdHNcbiAgICAgICAgLy8gaW4gYG5ldyBGaWxlYCBpbnRlcnByZXRpbmcgaXQgYXMgYSBzdHJpbmcgaW5zdGVhZCBvZiBiaW5hcnkgZGF0YS5cbiAgICAgICAgY29uc3QgZGF0YSA9IGlzQmxvYkxpa2UoYmxvYikgPyBbKGF3YWl0IGJsb2IuYXJyYXlCdWZmZXIoKSldIDogW2Jsb2JdO1xuICAgICAgICByZXR1cm4gbmV3IEZpbGUoZGF0YSwgbmFtZSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGNvbnN0IGJpdHMgPSBhd2FpdCBnZXRCeXRlcyh2YWx1ZSk7XG4gICAgbmFtZSB8fCAobmFtZSA9IGdldE5hbWUodmFsdWUpID8/ICd1bmtub3duX2ZpbGUnKTtcbiAgICBpZiAoIW9wdGlvbnM/LnR5cGUpIHtcbiAgICAgICAgY29uc3QgdHlwZSA9IGJpdHNbMF0/LnR5cGU7XG4gICAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIHR5cGUgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IEZpbGUoYml0cywgbmFtZSwgb3B0aW9ucyk7XG59XG5hc3luYyBmdW5jdGlvbiBnZXRCeXRlcyh2YWx1ZSkge1xuICAgIGxldCBwYXJ0cyA9IFtdO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgIEFycmF5QnVmZmVyLmlzVmlldyh2YWx1ZSkgfHwgLy8gaW5jbHVkZXMgVWludDhBcnJheSwgQnVmZmVyLCBldGMuXG4gICAgICAgIHZhbHVlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgcGFydHMucHVzaCh2YWx1ZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQmxvYkxpa2UodmFsdWUpKSB7XG4gICAgICAgIHBhcnRzLnB1c2goYXdhaXQgdmFsdWUuYXJyYXlCdWZmZXIoKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXN5bmNJdGVyYWJsZUl0ZXJhdG9yKHZhbHVlKSAvLyBpbmNsdWRlcyBSZWFkYWJsZSwgUmVhZGFibGVTdHJlYW0sIGV0Yy5cbiAgICApIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgcGFydHMucHVzaChjaHVuayk7IC8vIFRPRE8sIGNvbnNpZGVyIHZhbGlkYXRpbmc/XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBkYXRhIHR5cGU6ICR7dHlwZW9mIHZhbHVlfTsgY29uc3RydWN0b3I6ICR7dmFsdWU/LmNvbnN0cnVjdG9yXG4gICAgICAgICAgICA/Lm5hbWV9OyBwcm9wczogJHtwcm9wc0ZvckVycm9yKHZhbHVlKX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnRzO1xufVxuZnVuY3Rpb24gcHJvcHNGb3JFcnJvcih2YWx1ZSkge1xuICAgIGNvbnN0IHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpO1xuICAgIHJldHVybiBgWyR7cHJvcHMubWFwKChwKSA9PiBgXCIke3B9XCJgKS5qb2luKCcsICcpfV1gO1xufVxuZnVuY3Rpb24gZ2V0TmFtZSh2YWx1ZSkge1xuICAgIHJldHVybiAoZ2V0U3RyaW5nRnJvbU1heWJlQnVmZmVyKHZhbHVlLm5hbWUpIHx8XG4gICAgICAgIGdldFN0cmluZ0Zyb21NYXliZUJ1ZmZlcih2YWx1ZS5maWxlbmFtZSkgfHxcbiAgICAgICAgLy8gRm9yIGZzLlJlYWRTdHJlYW1cbiAgICAgICAgZ2V0U3RyaW5nRnJvbU1heWJlQnVmZmVyKHZhbHVlLnBhdGgpPy5zcGxpdCgvW1xcXFwvXS8pLnBvcCgpKTtcbn1cbmNvbnN0IGdldFN0cmluZ0Zyb21NYXliZUJ1ZmZlciA9ICh4KSA9PiB7XG4gICAgaWYgKHR5cGVvZiB4ID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgaWYgKHR5cGVvZiBCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHggaW5zdGFuY2VvZiBCdWZmZXIpXG4gICAgICAgIHJldHVybiBTdHJpbmcoeCk7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5jb25zdCBpc0FzeW5jSXRlcmFibGVJdGVyYXRvciA9ICh2YWx1ZSkgPT4gdmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHR5cGVvZiB2YWx1ZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPT09ICdmdW5jdGlvbic7XG5leHBvcnQgY29uc3QgaXNNdWx0aXBhcnRCb2R5ID0gKGJvZHkpID0+IGJvZHkgJiYgdHlwZW9mIGJvZHkgPT09ICdvYmplY3QnICYmIGJvZHkuYm9keSAmJiBib2R5W1N5bWJvbC50b1N0cmluZ1RhZ10gPT09ICdNdWx0aXBhcnRCb2R5Jztcbi8qKlxuICogUmV0dXJucyBhIG11bHRpcGFydC9mb3JtLWRhdGEgcmVxdWVzdCBpZiBhbnkgcGFydCBvZiB0aGUgZ2l2ZW4gcmVxdWVzdCBib2R5IGNvbnRhaW5zIGEgRmlsZSAvIEJsb2IgdmFsdWUuXG4gKiBPdGhlcndpc2UgcmV0dXJucyB0aGUgcmVxdWVzdCBhcyBpcy5cbiAqL1xuZXhwb3J0IGNvbnN0IG1heWJlTXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zID0gYXN5bmMgKG9wdHMpID0+IHtcbiAgICBpZiAoIWhhc1VwbG9hZGFibGVWYWx1ZShvcHRzLmJvZHkpKVxuICAgICAgICByZXR1cm4gb3B0cztcbiAgICBjb25zdCBmb3JtID0gYXdhaXQgY3JlYXRlRm9ybShvcHRzLmJvZHkpO1xuICAgIHJldHVybiBnZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9ucyhmb3JtLCBvcHRzKTtcbn07XG5leHBvcnQgY29uc3QgbXVsdGlwYXJ0Rm9ybVJlcXVlc3RPcHRpb25zID0gYXN5bmMgKG9wdHMpID0+IHtcbiAgICBjb25zdCBmb3JtID0gYXdhaXQgY3JlYXRlRm9ybShvcHRzLmJvZHkpO1xuICAgIHJldHVybiBnZXRNdWx0aXBhcnRSZXF1ZXN0T3B0aW9ucyhmb3JtLCBvcHRzKTtcbn07XG5leHBvcnQgY29uc3QgY3JlYXRlRm9ybSA9IGFzeW5jIChib2R5KSA9PiB7XG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGJvZHkgfHwge30pLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBhZGRGb3JtVmFsdWUoZm9ybSwga2V5LCB2YWx1ZSkpKTtcbiAgICByZXR1cm4gZm9ybTtcbn07XG5jb25zdCBoYXNVcGxvYWRhYmxlVmFsdWUgPSAodmFsdWUpID0+IHtcbiAgICBpZiAoaXNVcGxvYWRhYmxlKHZhbHVlKSlcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKVxuICAgICAgICByZXR1cm4gdmFsdWUuc29tZShoYXNVcGxvYWRhYmxlVmFsdWUpO1xuICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGZvciAoY29uc3QgayBpbiB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKGhhc1VwbG9hZGFibGVWYWx1ZSh2YWx1ZVtrXSkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcbmNvbnN0IGFkZEZvcm1WYWx1ZSA9IGFzeW5jIChmb3JtLCBrZXksIHZhbHVlKSA9PiB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBSZWNlaXZlZCBudWxsIGZvciBcIiR7a2V5fVwiOyB0byBwYXNzIG51bGwgaW4gRm9ybURhdGEsIHlvdSBtdXN0IHVzZSB0aGUgc3RyaW5nICdudWxsJ2ApO1xuICAgIH1cbiAgICAvLyBUT0RPOiBtYWtlIG5lc3RlZCBmb3JtYXRzIGNvbmZpZ3VyYWJsZVxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgZm9ybS5hcHBlbmQoa2V5LCBTdHJpbmcodmFsdWUpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNVcGxvYWRhYmxlKHZhbHVlKSkge1xuICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgdG9GaWxlKHZhbHVlKTtcbiAgICAgICAgZm9ybS5hcHBlbmQoa2V5LCBmaWxlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodmFsdWUubWFwKChlbnRyeSkgPT4gYWRkRm9ybVZhbHVlKGZvcm0sIGtleSArICdbXScsIGVudHJ5KSkpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHZhbHVlKS5tYXAoKFtuYW1lLCBwcm9wXSkgPT4gYWRkRm9ybVZhbHVlKGZvcm0sIGAke2tleX1bJHtuYW1lfV1gLCBwcm9wKSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW52YWxpZCB2YWx1ZSBnaXZlbiB0byBmb3JtLCBleHBlY3RlZCBhIHN0cmluZywgbnVtYmVyLCBib29sZWFuLCBvYmplY3QsIEFycmF5LCBGaWxlIG9yIEJsb2IgYnV0IGdvdCAke3ZhbHVlfSBpbnN0ZWFkYCk7XG4gICAgfVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXVwbG9hZHMubWpzLm1hcCIsImV4cG9ydCBjb25zdCBWRVJTSU9OID0gJzQuODUuMSc7IC8vIHgtcmVsZWFzZS1wbGVhc2UtdmVyc2lvblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dmVyc2lvbi5tanMubWFwIiwiaW1wb3J0IHsgU0VSVkVSX0hPU1QsIEFQSV9QQVRIIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHsgSUNvbmZpZyB9IGZyb20gJy4vY29uZmlnJztcbmltcG9ydCB7IGhhbmRsZUxMTVJlcXVlc3QgfSBmcm9tICcuL2xsbSc7XG5pbXBvcnQgeyBzZW5kQm90TWVzc2FnZSB9IGZyb20gJy4vYm90JztcblxuZXhwb3J0IGZ1bmN0aW9uIGZldGNoUmFkYXJQb2NTZXJ2ZXIocGF0aDogc3RyaW5nLCBib2R5OiBhbnkpIHtcbiAgICBjb25zdCB1cmwgPSBTRVJWRVJfSE9TVCArIHBhdGg7XG4gICAgcmV0dXJuIGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgICAgIH0pXG4gICAgICAudGhlbihhc3luYyByZXNwb25zZSA9PiB7XG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcblxuICAgICAgICAgIGNvbnN0IGVycm9yRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JEYXRhLmRldGFpbCB8fCBgSFRUUCBlcnJvciEgc3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5Ub3BpY3MoY29uZmlnOiBJQ29uZmlnKSB7XG4gICAgY29uc3QgeyB1c2VybmFtZSwgZXh0ZW5zaW9uSWQsIG1vZGVsICB9ID0gY29uZmlnO1xuICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICAgIHVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICAgICAgZXh0ZW5zaW9uX2lkOiBleHRlbnNpb25JZCxcbiAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgIH07XG5cbiAgICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5HRU5fVE9QSUNTLCBib2R5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyZW5kaW5nVG9waWNzKGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCwgbW9kZWwgIH0gPSBjb25maWc7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgICB1c2VybmFtZTogdXNlcm5hbWUsXG4gICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICAgICAgbW9kZWw6IG1vZGVsLFxuICB9O1xuXG4gIHJldHVybiBmZXRjaFJhZGFyUG9jU2VydmVyKEFQSV9QQVRILlRSRU5ESU5HX1RPUElDUywgYm9keSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXN0b21RdWVyeShxdWVyeTogc3RyaW5nLCBjb25maWc6IElDb25maWcpIHtcbiAgICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCwgbW9kZWwgIH0gPSBjb25maWc7XG5cbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAgICB1c2VybmFtZTogdXNlcm5hbWUsXG4gICAgICAgIGV4dGVuc2lvbl9pZDogZXh0ZW5zaW9uSWQsXG4gICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgcXVlcnk6IHF1ZXJ5XG4gICAgfTtcblxuICAgIHJldHVybiBmZXRjaFJhZGFyUG9jU2VydmVyKEFQSV9QQVRILlFVRVJZLCBib2R5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JhbFF1ZXJ5KHF1ZXJ5OiBzdHJpbmcsIGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCwgbW9kZWwgIH0gPSBjb25maWc7XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICAgIHVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICAgIGV4dGVuc2lvbl9pZDogZXh0ZW5zaW9uSWQsXG4gICAgICBtb2RlbDogbW9kZWwsXG4gICAgICBxdWVyeTogcXVlcnlcbiAgfTtcblxuICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5HTE9CQUxfUVVFUlksIGJvZHkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmV0Y2hMYXN0SW5kZXhUaW1lKGNvbmZpZzogSUNvbmZpZykge1xuICAgIGNvbnN0IHsgdXNlcm5hbWUsIGV4dGVuc2lvbklkICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgICAgdXNlcm5hbWU6IHVzZXJuYW1lLFxuICAgICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICAgIH07XG5cbiAgICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5MQVRFU1RfSU5ERVhfVElNRSwgYm9keSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmRleGluZyhkYXRhOiBhbnlbXSwgY29uZmlnOiBJQ29uZmlnKSB7XG4gIGNvbnN0IHsgdXNlcm5hbWUsIGV4dGVuc2lvbklkLCBtb2RlbCAgfSA9IGNvbmZpZztcblxuICBpZiAoIWRhdGEgfHwgZGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ05vIGRhdGEgcHJvdmlkZWQnKSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgICAgdXNlcm5hbWUsXG4gICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICAgICAgbW9kZWwsXG4gICAgICBkYXRhXG4gIH07XG5cbiAgcmV0dXJuIGZldGNoUmFkYXJQb2NTZXJ2ZXIoQVBJX1BBVEguSU5ERVhJTkcsIGJvZHkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5jcmVtZW50KGRhdGE6IGFueVtdLCBjb25maWc6IElDb25maWcpIHtcbiAgY29uc3QgeyB1c2VybmFtZSwgZXh0ZW5zaW9uSWQsIG1vZGVsICB9ID0gY29uZmlnO1xuXG4gIGlmICghZGF0YSB8fCBkYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignTm8gZGF0YSBwcm92aWRlZCcpKTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgICB1c2VybmFtZSxcbiAgICAgIGV4dGVuc2lvbl9pZDogZXh0ZW5zaW9uSWQsXG4gICAgICBtb2RlbCxcbiAgICAgIGRhdGFcbiAgfTtcblxuICByZXR1cm4gZmV0Y2hSYWRhclBvY1NlcnZlcihBUElfUEFUSC5JTkNSRU1FTlQsIGJvZHkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlX2luZGV4aW5nKGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lLCBleHRlbnNpb25JZCAgfSA9IGNvbmZpZztcblxuICBjb25zdCBib2R5ID0ge1xuICAgICAgdXNlcm5hbWUsXG4gICAgICBleHRlbnNpb25faWQ6IGV4dGVuc2lvbklkLFxuICB9O1xuXG4gIHJldHVybiBmZXRjaFJhZGFyUG9jU2VydmVyKEFQSV9QQVRILkRFTEVURSwgYm9keSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmZXRjaERpZnlTZXJ2ZXIocXVlcnk6IHN0cmluZ1tdLCBjb25maWc6IElDb25maWcpIHtcbiAgY29uc3QgdXJsID0gJ2h0dHBzOi8vbGFwMi1hcGktZGV2LmludC5yY2xhYmVudi5jb20vdjEvY29tcGxldGlvbi1tZXNzYWdlcyc7XG4gIGNvbnN0IHsgdXNlcm5hbWUsIGFwaUtleSAgfSA9IGNvbmZpZztcblxuICBjb25zdCBkYXRhID0ge1xuICAgIGlucHV0czogeyBxdWVyeTogSlNPTi5zdHJpbmdpZnkocXVlcnkpLCB1c2VybmFtZTogdXNlcm5hbWV9LFxuICAgIHJlc3BvbnNlX21vZGU6ICdibG9ja2luZycsXG4gICAgdXNlcjogdXNlcm5hbWVcbiAgfTtcblxuICByZXR1cm4gZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgaGVhZGVyczoge1xuICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7YXBpS2V5fWAsXG4gICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKVxuICB9KVxuICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gIC50aGVuKGRhdGEgPT4ge1xuICAgIHJldHVybiBkYXRhLmFuc3dlcjtcbiAgfSlcbiAgLmNhdGNoKGVycm9yID0+IHtcbiAgICByZXR1cm4gZXJyb3IubWVzc2FnZSB8fCAnSHR0cHMgZXJyb3InXG4gIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2VuZERhdGFUb09sbGFtYSAoZGF0YTogYW55W10sIGNvbmZpZzogSUNvbmZpZykge1xuICBjb25zdCB7IHVzZXJuYW1lIH0gPSBjb25maWc7XG4gIC8vIFRvZG86IOS7jiBiY2tnb3VybmQtPnN0b3JhZ2Ug5Lyg5Y+CIOS4reiOt+WPliBjb25jZXJuZWRJdGVtc1xuICBjb25zdCBjb25jZXJuZWRJdGVtczoge3RleHQ6IHN0cmluZ31bXSA9IChhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ2NvbmNlcm5lZEl0ZW1zJykpLmNvbmNlcm5lZEl0ZW1zIHx8IFtcbiAgICAgIHt0ZXh0OidyZWNvcmRpbmcg6aG555uu5ZyoIFJDViBtb2JpbGUg5Lit55qE55u45YWz5L+h5oGv77yM54m55Yir5pivIEJFIOS+nei1lumDqOWIhueahOWujOaIkOaDheWGte+8iOWFs+mUruivje+8mnJlY29yZGluZy9SQ1YgbW9iaWxlL0JFIGRlcGVuZGVuY2llc++8jOW/hemhu+WQjOaXtuWMheWQq1wicmVjb3JkaW5nXCLlkoxcIkJFXCLnm7jlhbPlhbPplK7or43vvIknfSxcbiAgICAgIHt0ZXh0OifogYrliLDlhbPkuo7lhazlj7jmlL/nrZbvvIzkuZ/lj6/ku6XmmK/mlL/nrZbnm7jlhbPnmoTlhavljabmtojmga8nfSxcbiAgICAgIHt0ZXh0OidTb3BoaWEgKEppbm1laSkgTGluIOWPkemAgeeahOaJgOaciea2iOaBr++8iOWPqumcgOimgeajgOafpeWPkemAgeiAheaYr+WQpuWujOWFqOWMuemFje+8iSd9LFxuICAgICAge3RleHQ6J+S7u+S9leaYjuehriBA5oiRIOeahOa2iOaBr++8jOaIluiAheaPkOWIsOaIkeeahOWQjeWtl+eahOa2iOaBryd9LFxuICAgIF07XG4gIGNvbnNvbGUubG9nKGRhdGEsIGNvbmNlcm5lZEl0ZW1zLCBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ2NvbmNlcm5lZEl0ZW1zJykpO1xuICAvLyDmj5LlhaXosIPor5XmlbDmja5cbiAgLy8gZGF0YS51bnNoaWZ0KHtcbiAgLy8gICBncm91cE5hbWU6ICdSZWNvcmRpbmcgVGVzdCcsXG4gIC8vICAgZ3JvdXBJZDogJzEyMycsXG4gIC8vICAgcG9zdHM6IFtcbiAgLy8gICAgIHsgY3JlYXRvcjogJ1NvcGhpYSAoSmlubWVpKSBMaW4nLCB0aW1lOiAnMjAyNS0wMi0xMyAwMDowMDowMCcsIHRleHQ6ICdSZWNvcmRpbmcgcHJvamVjdCBCRSBkZXBlbmRlbmNpZXMgY29tcGxldGVkJyB9XG4gIC8vICAgXVxuICAvLyB9KTtcbiAgLy8gZGF0YS51bnNoaWZ0KHtcbiAgLy8gICBncm91cE5hbWU6ICflpKfnvqQnLFxuICAvLyAgIGdyb3VwSWQ6ICczMjEnLFxuICAvLyAgIHBvc3RzOiBbXG4gIC8vICAgICB7IGNyZWF0b3I6ICdDb2xpbiBMaXUnLCB0aW1lOiAnMjAyNS0wMi0xNCAwMDowMDowMCcsIHRleHQ6ICdAVGVhbSDlupTopoHmsYLvvIzlpKflrrbms6jmhI/kuIDkuIvliLDlhazlj7jml7blgJnnmoTkuIrkuIvnj63ml7bpl7TvvIzoh7PlsJHkv53mjIE45Liq5bCP5pe25Zyo5YWs5Y+455qE5pe26Ze077yM5peg54m55q6K5oOF5Ya15LiN6KaB5Lit5Zy656a75byA77yM6LCi6LCi5ZCE5L2NIOOAgicgfVxuICAvLyAgIF1cbiAgLy8gfSk7XG4gIC8vIGRhdGEuc3BsaWNlKDIpO1xuICBjb25zb2xlLmxvZyhkYXRhKTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTExNX1RZUEUgPT09ICdsb2NhbCcpIHtcbiAgICAvLyDmi4bliIbljZXmnaHlj5HpgIEgTExNXG4gICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcbiAgICAgIG9sbGFtYUFuYWx5c2lzUHJvZ3Jlc3M6IHtcbiAgICAgICAgdG90YWw6IGRhdGEubGVuZ3RoLFxuICAgICAgICBsYXN0QW5hbHl6ZWRJbmRleDogMCxcbiAgICAgICAgbGFzdEFuYWx5emVkVGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICB9XG4gICAgfSk7XG4gICAgZGF0YS5mb3JFYWNoKGFzeW5jIChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IGF3YWl0IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYC0t5byA5aeL5YiG5p6Q56ysICR7aW5kZXgrMX0vJHtkYXRhLmxlbmd0aH0g5p2h5raI5oGvLS1gKTtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgPG1lc3NhZ2VfZ3JvdXAgdGVhbV9uYW1lPVwiJHtpdGVtLmdyb3VwTmFtZX1cIiB0ZWFtX2lkPVwiJHtpdGVtLmdyb3VwSWR9XCI+JHtpdGVtLnBvc3RzLm1hcCgocG9zdDphbnkpID0+IGBcbiAgICAgICAgICA8bWVzc2FnZV9jb250ZW50IHNlbmRlcj1cIiR7cG9zdC5jcmVhdG9yfVwiIGRhdGV0aW1lPVwiJHtwb3N0LnRpbWV9XCI+JHtwb3N0LnRleHR9PC9tZXNzYWdlX2NvbnRlbnQ+YCkuam9pbignJyl9XG4gICAgICAgIDwvbWVzc2FnZV9ncm91cD5gXG4gICAgICBjb25zdCBwcm9tcHQgPSBgXG4gICAgICAgIOaIkeeahOWQjeWtl+aYr++8miR7dXNlcm5hbWV9IO+8iOWmguaenOi/h+a7pOinhOWImeS4rea2iOaBr+eahOWGheWuuSBtZXNzYWdlX2NvbnRlbnQg5pyJ5o+Q5Yiw5oiR77yM5Y+v5L2c5Li65Yik5pat5raI5oGv5piv5ZCm5pyJQOaIke+8jOWNs+S+v+aYr+S4jeW4puWnk+awj0DlkI3lrZfpg6jliIYg5Lmf6KeG5Li65o+Q5Y+K77yM5o6S6ZmkIHNlbmRlciDmmK/miJHnmoTmtojmga/vvIlcblxuICAgICAgICAtLS0tIOi/meaYr+aIkeaUtuWIsOeahOacgOi/keiBiuadoea2iOaBr+W8gOWniyAtLS0tXG4gICAgICAgICR7bWVzc2FnZX1cbiAgICAgICAgLS0tLSDov5nmmK/miJHmlLbliLDnmoTmnIDov5HogYrmnaHmtojmga/nu5PmnZ8gLS0tLVxuXG4gICAgICAgIC0tLS0g5Lul5LiL5piv5oiR55qE6ZyA5rGC5ZKM5L2g6ZyA6KaB6L+U5Zue55qE5YaF5a655a6a5LmJIC0tLS1cbiAgICAgICAg5L2g5piv5LiA5Liq5b6I57uG5b+D55qE6aG555uu57uP55CG77yM6K+35LuU57uG6ZiF6K+75bm26K6k55yf5YiG5p6Q5Lul5LiK5raI5oGv77yM5omn6KGM5Lul5LiL5LiJ5q2l55qE5Lu75Yqh77yaXG4gICAgICAgIDEuIOivt+S7lOe7humYheivuyBtZXNzYWdlX2dyb3VwIOmHjOeahOavj+adoeiBiuWkqea2iOaBr++8jOWIpOaWremHjOmdoueahCBtZXNzYWdlX2NvbnRlbnQg5piv5ZCm5pyJ56ym5ZCI5Lul5LiL6KeE5YiZ5YW25Lit5LiA5p2h77yaXG4gICAgICAgICAgJHtjb25jZXJuZWRJdGVtcy5tYXAoKGl0ZW06YW55LCBpOm51bWJlcikgPT4gYC0g6KeE5YiZJHtpKzF9OiAke2l0ZW0udGV4dH1gKS5qb2luKCdcXG4gICAgICAgICAgJyl9XG4gICAgICAgIDIuIOWvuSBtZXNzYWdlX2dyb3VwIOS4reWImuacieespuWQiOinhOWImeeahOa2iOaBr++8jOivt+aPkOWPluS7peS4i+Wtl+aute+8iOWPquaPkOWPluWOn+aWh++8jOS4jeWBmuS/ruaUueS4jeWBmue/u+ivke+8ie+8mlxuICAgICAgICAgIC0gbWVzc2FnZV9jb250ZW505raI5oGv5Y6f5paH5Y+K5YW25a+55bqU5Y+R6YCB6ICFc2VuZGVy5ZKM5Y+R6YCB5pe26Ze0ZGF0ZXRpbWUsIOi/mOaciW1lc3NhZ2VfZ3JvdXDkuK3nmoQgdGVhbV9uYW1lLCB0ZWFtX2lkLCDku6Xlj4rnrKblkIjnmoTop4TliJl4XG4gICAgICAgIDMuIOWvuSBtZXNzYWdlX2dyb3VwIOS4reWImuacieespuWQiOinhOWImeeahOa2iOaBr++8jOavj+adoeeUn+aIkOWvueW6lOeahOi/mSAzIOS4quaWsOWtl+aute+8mlxuICAgICAgICAgIC0gbWF0Y2hlZF9ydWxlOiDkuIrpnaLnrKzkuIDmraXnmoTnrKblkIjliLDnmoTop4TliJl455qE5Y6f5paH5YaF5a65XG4gICAgICAgICAgLSBmaWx0ZXJfcmVhc29uOiDpgInmi6nov5nmnaHmtojmga/ov4fmu6Tlh7rmnaXnmoTljp/lm6DvvIzlj6/ku6XnlKjkuK3mlofooajovr5cbiAgICAgICAgICAtIHN1bW1hcnk6IOWvuei/meadoea2iOaBr+aJgOWcqOeahCBtZXNzYWdlX2dyb3VwIOeahOWFtuS7lua2iOaBr+eahOS4iuS4i+aWh+WBmuWHuuaAu+e7k+W5tumAguW9k+eahOaOqOeQhuS4uuS7gOS5iHNlbmRlcuS8muWPkeWHuui/meS4qua2iOaBr+OAguivt+S4jeimgeeVmeepuu+8jOi/memHjOWPr+S7peeUqOS4reaWh1xuXG4gICAgICAgIOWwhuS7u+WKoei+k+WHuueahOaVsOaNrui/m+ihjOWmguS4i+mqjOivge+8mlxuICAgICAgICAxLiDku6XkuKXmoLxKU09O5qC85byP6L6T5Ye677yM5LuF5YyF5ZCr5Yy56YWN55qE5raI5oGv44CC5aaC5p6c5rKh5pyJ5Yy56YWN5Lu75L2V6KeE5YiZ77yM6L6T5Ye656m6W13mlbDnu4TvvJpcbiAgICAgICAgICBbe1xuICAgICAgICAgICAgXCJtZXNzYWdlX2NvbnRlbnRcIjogXCJ7bWVzc2FnZV9jb250ZW50fVwiLFxuICAgICAgICAgICAgXCJzZW5kZXJcIjogXCJ7c2VuZGVyfVwiLFxuICAgICAgICAgICAgXCJtYXRjaGVkX3J1bGVcIjogXCLmiYDnrKblkIjnmoTop4TliJnnmoTlhoXlrrlcIixcbiAgICAgICAgICAgIFwiZmlsdGVyX3JlYXNvblwiOiBcIlwiLFxuICAgICAgICAgICAgXCJ0ZWFtX25hbWVcIjogXCJ7dGVhbV9uYW1lfVwiLFxuICAgICAgICAgICAgXCJ0ZWFtX2lkXCI6IFwie3RlYW1faWR9XCIsXG4gICAgICAgICAgICBcInRlYW1fdXJsXCI6IFwiaHR0cHM6Ly9hcHAucmluZ2NlbnRyYWwuY29tL21lc3NhZ2VzL3t0ZWFtX2lkfVwiLFxuICAgICAgICAgICAgXCJzdW1tYXJ5XCI6IFwi6K+35oC757uT5LiK5LiL5paH5Yiw6L+Z6YeMXCIsXG4gICAgICAgICAgICBcImRhdGV0aW1lXCI6IFwie2RhdGV0aW1lfVwiLFxuICAgICAgICAgIH1dXG4gICAgICAgIDIuIOWGjeasoeajgOafpeS4i+WNs+Wwhui+k+WHuueahOWGheWuue+8jOaYr+WQpuaciemHjeWkjeiusOW9le+8jOWmguaenOWPkeeOsOmHjeWkjeiusOW9le+8iG1lc3NhZ2VfY29udGVudOOAgXRlYW1faWQg5ZKMIGRhdGV0aW1lIOmDveebuOWQjO+8ie+8jOS/neeVmeaXtumXtOi+g+aWsOeahOmCo+adoeiusOW9le+8jOWIoOmZpOmHjeWkjeeahOiusOW9lVxuICAgICAgYFxuICAgICAgYXdhaXQgc2VuZFRvT2xsYW1hKHByb21wdCk7XG4gICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICBvbGxhbWFBbmFseXNpc1Byb2dyZXNzOiB7XG4gICAgICAgICAgdG90YWw6IGRhdGEubGVuZ3RoLFxuICAgICAgICAgIGxhc3RBbmFseXplZEluZGV4OiBpbmRleCArIDEsXG4gICAgICAgICAgbGFzdEFuYWx5emVkVGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sIDMgKiA2MCAqIDEwMDAgKiBpbmRleCArIDEpKTtcblxuICB9IGVsc2Uge1xuICAgIC8vIOWQiOW5tuWPkemAgSBMTE1cbiAgICBjb25zdCBtZXNzYWdlcyA9IGRhdGEucmVkdWNlKChhY2MsIGl0ZW0pID0+IGAke2FjY31cXG5cbiAgICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIiR7aXRlbS5ncm91cE5hbWV9XCIgdGVhbV9pZD1cIiR7aXRlbS5ncm91cElkfVwiPiR7aXRlbS5wb3N0cy5tYXAoKHBvc3Q6YW55KSA9PiBgXG4gICAgICAgIDxtZXNzYWdlX2NvbnRlbnQgc2VuZGVyPVwiJHtwb3N0LmNyZWF0b3J9XCIgZGF0ZXRpbWU9XCIke3Bvc3QudGltZX1cIj4ke3Bvc3QudGV4dH08L21lc3NhZ2VfY29udGVudD5gKS5qb2luKCcnKX1cbiAgICAgIDwvbWVzc2FnZV9ncm91cD5gLCAnPG1lc3NhZ2VzPicpIFxuICAgICAgLy8g5aKe5Yqg6LCD6K+V5pWw5o2u8J+Rh1xuICAgICAgKyBgXFxuXFxuICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIlJlY29yZGluZyBUZXN0XCIgdGVhbV9pZD1cIjEyM1wiPlxuICAgICAgICA8bWVzc2FnZV9jb250ZW50IHNlbmRlcj1cIlNvcGhpYSAoSmlubWVpKSBMaW5cIiBkYXRldGltZT1cIjIwMjUtMDItMTMgMDA6MDA6MDBcIj5SZWNvcmRpbmcgcHJvamVjdCBCRSBkZXBlbmRlbmNpZXMgY29tcGxldGVkPC9tZXNzYWdlX2NvbnRlbnQ+XG4gICAgICA8L21lc3NhZ2VfZ3JvdXA+YFxuICAgICAgKyBgXFxuXFxuICAgIDxtZXNzYWdlX2dyb3VwIHRlYW1fbmFtZT1cIuWkp+e+pFwiIHRlYW1faWQ9XCIzMjFcIj5cbiAgICAgICAgPG1lc3NhZ2VfY29udGVudCBzZW5kZXI9XCJDb2xpbiBMaXVcIiBkYXRldGltZT1cIjIwMjUtMDItMTQgMDA6MDA6MDBcIj5AVGVhbSDlupTopoHmsYLvvIzlpKflrrbms6jmhI/kuIDkuIvliLDlhazlj7jml7blgJnnmoTkuIrkuIvnj63ml7bpl7TvvIzoh7PlsJHkv53mjIE45Liq5bCP5pe25Zyo5YWs5Y+455qE5pe26Ze077yM5peg54m55q6K5oOF5Ya15LiN6KaB5Lit5Zy656a75byA77yM6LCi6LCi5ZCE5L2NIOOAgjwvbWVzc2FnZV9jb250ZW50PlxuICAgICAgPC9tZXNzYWdlX2dyb3VwPmBcbiAgICAgICsgJ1xcbiAgICA8L21lc3NhZ2VzPic7XG5cbiAgICBjb25zdCBwcm9tcHQgPSBgXG4gICAgICDmiJHnmoTlkI3lrZfmmK/vvJoke3VzZXJuYW1lfSDvvIjlpoLmnpzov4fmu6Top4TliJnkuK3mtojmga/nmoTlhoXlrrkgbWVzc2FnZV9jb250ZW50IOacieaPkOWIsOaIke+8jOWPr+S9nOS4uuWIpOaWrea2iOaBr+aYr+WQpuaciUDmiJHvvIzljbPkvr/mmK/kuI3luKblp5PmsI9A5ZCN5a2X6YOo5YiGIOS5n+inhuS4uuaPkOWPiu+8jOaOkumZpCBzZW5kZXIg5piv5oiR55qE5raI5oGv77yJXG5cbiAgICAgIC0tLS0g6L+Z5piv5oiR5pS25Yiw55qE5pyA6L+R6IGK5p2h5raI5oGv5byA5aeLIC0tLS1cbiAgICAgICR7bWVzc2FnZXN9XG4gICAgICAtLS0tIOi/meaYr+aIkeaUtuWIsOeahOacgOi/keiBiuadoea2iOaBr+e7k+adnyAtLS0tXG5cbiAgICAgIOavj+adoSBtZXNzYWdlX2dyb3VwIOmDveaYr+WQjOS4gOS4que+pOe7hOeahOa2iOaBr+mbhuWQiO+8jOWFtuS4reWPr+iDveWMheWQq+S6huWkmuadoeS4jeWQjOS6uuWPkeeahCBtZXNzYWdlX2NvbnRlbnTvvIzkuI3lkIznmoQgbWVzc2FnZV9ncm91cCDkuI3nm7jlhbPogZTjgIJcbiAgICAgIOS9oOaYr+S4gOS4quW+iOe7huW/g+eahOmhueebrue7j+eQhu+8jOivt+iupOecn+WIhuaekOS7peS4iua2iOaBr++8jOW5tuaMieeFp+S7peS4i+imgeaxgui/lOWbnuaVsOaNruOAglxuXG4gICAgICAtLS0tIOS7peS4i+aYr+aIkeeahOmcgOaxguWSjOS9oOmcgOimgei/lOWbnueahOWGheWuueWumuS5iSAtLS0tXG4gICAgICDorqnmiJHku6zmnaXkuIDkuKrkuIDkuKrmn6XnnIsgbWVzc2FnZV9ncm91cO+8jOW5tuS4lOmSiOWvueavj+S4qiBtZXNzYWdlX2dyb3VwIOmDveaJp+ihjOS7peS4i+S4ieatpeeahOS7u+WKoe+8mlxuICAgICAgMS4g6K+35LuU57uG6ZiF6K+7IG1lc3NhZ2VfZ3JvdXAg6YeM55qE5q+P5p2h6IGK5aSp5raI5oGv77yM5Yik5pat6YeM6Z2i55qEIG1lc3NhZ2VfY29udGVudCDmmK/lkKbmnInnrKblkIjku6XkuIvop4TliJnlhbbkuK3kuIDmnaHjgILlpoLmnpzmsqHmnInliJnot7Pov4flubbmn6XnnIvkuIvkuIDkuKogbWVzc2FnZV9ncm91cO+8mlxuICAgICAgICAke2NvbmNlcm5lZEl0ZW1zLm1hcCgoaXRlbTphbnksIGk6bnVtYmVyKSA9PiBgLSDop4TliJkke2krMX06ICR7aXRlbS50ZXh0fWApLmpvaW4oJ1xcbiAgICAgICAgJyl9XG4gICAgICAyLiDlr7kgbWVzc2FnZV9ncm91cCDkuK3liJrmnInnrKblkIjop4TliJnnmoTmtojmga/vvIzor7fmj5Dlj5bku6XkuIvlrZfmrrXvvIjlj6rmj5Dlj5bljp/mlofvvIzkuI3lgZrkv67mlLnkuI3lgZrnv7vor5HvvInvvJpcbiAgICAgICAgLSBtZXNzYWdlX2NvbnRlbnTmtojmga/ljp/mloflj4rlhbblr7nlupTlj5HpgIHogIVzZW5kZXLlkozlj5HpgIHml7bpl7RkYXRldGltZSwg6L+Y5pyJbWVzc2FnZV9ncm91cOS4reeahCB0ZWFtX25hbWUsIHRlYW1faWQsIOS7peWPiuespuWQiOeahOinhOWImXhcbiAgICAgIDMuIOWvuSBtZXNzYWdlX2dyb3VwIOS4reWImuacieespuWQiOinhOWImeeahOa2iOaBr++8jOavj+adoeeUn+aIkOWvueW6lOeahOi/mSAzIOS4quaWsOWtl+aute+8mlxuICAgICAgICAtIG1hdGNoZWRfcnVsZTog5LiK6Z2i56ys5LiA5q2l55qE56ym5ZCI5Yiw55qE6KeE5YiZeOeahOWOn+aWh+WGheWuuVxuICAgICAgICAtIGZpbHRlcl9yZWFzb246IOmAieaLqei/meadoea2iOaBr+i/h+a7pOWHuuadpeeahOWOn+WboO+8jOWPr+S7peeUqOS4reaWh+ihqOi+vlxuICAgICAgICAtIHN1bW1hcnk6IOWvuei/meadoea2iOaBr+aJgOWcqOeahCBtZXNzYWdlX2dyb3VwIOeahOWFtuS7lua2iOaBr+eahOS4iuS4i+aWh+WBmuWHuuaAu+e7k+W5tumAguW9k+eahOaOqOeQhuS4uuS7gOS5iHNlbmRlcuS8muWPkeWHuui/meS4qua2iOaBr+OAguivt+S4jeimgeeVmeepuu+8jOi/memHjOWPr+S7peeUqOS4reaWh1xuICAgICAg57uT5p2f5b2T5YmNIG1lc3NhZ2VfZ3JvdXAg55qE5LiJ5q2l5Lu75Yqh5ZCO77yM5byA5aeL6YGN5Y6G5LiL5LiA5LiqIG1lc3NhZ2VfZ3JvdXDvvIznm7TliLDmiYDmnIkgbWVzc2FnZV9ncm91cCDpg73pgY3ljoblrozmiJDjgIJcblxuICAgICAg5bCG5Lu75Yqh6L6T5Ye655qE5pWw5o2u6L+b6KGM5aaC5LiL6aqM6K+B77yaXG4gICAgICAxLiDku6XkuKXmoLxKU09O5qC85byP6L6T5Ye677yM5LuF5YyF5ZCr5Yy56YWN55qE5raI5oGv44CC5aaC5p6c5rKh5pyJ5Yy56YWN5Lu75L2V6KeE5YiZ77yM6L6T5Ye656m6W13mlbDnu4TvvJpcbiAgICAgICAgW3tcbiAgICAgICAgICBcIm1lc3NhZ2VfY29udGVudFwiOiBcInttZXNzYWdlX2NvbnRlbnR9XCIsXG4gICAgICAgICAgXCJzZW5kZXJcIjogXCJ7c2VuZGVyfVwiLFxuICAgICAgICAgIFwibWF0Y2hlZF9ydWxlXCI6IFwi5omA56ym5ZCI55qE6KeE5YiZ55qE5YaF5a65XCIsXG4gICAgICAgICAgXCJmaWx0ZXJfcmVhc29uXCI6IFwiXCIsXG4gICAgICAgICAgXCJ0ZWFtX25hbWVcIjogXCJ7dGVhbV9uYW1lfVwiLFxuICAgICAgICAgIFwidGVhbV9pZFwiOiBcInt0ZWFtX2lkfVwiLFxuICAgICAgICAgIFwidGVhbV91cmxcIjogXCJodHRwczovL2FwcC5yaW5nY2VudHJhbC5jb20vbWVzc2FnZXMve3RlYW1faWR9XCIsXG4gICAgICAgICAgXCJzdW1tYXJ5XCI6IFwi6K+35oC757uT5LiK5LiL5paH5Yiw6L+Z6YeMXCIsXG4gICAgICAgICAgXCJkYXRldGltZVwiOiBcIntkYXRldGltZX1cIixcbiAgICAgICAgfV1cbiAgICAgIDIuIOWGjeasoeajgOafpeS4i+WNs+Wwhui+k+WHuueahOWGheWuue+8jOaYr+WQpuaciemHjeWkjeiusOW9le+8jOWmguaenOWPkeeOsOmHjeWkjeiusOW9le+8iG1lc3NhZ2VfY29udGVudOOAgXRlYW1faWQg5ZKMIGRhdGV0aW1lIOmDveebuOWQjO+8ie+8jOS/neeVmeaXtumXtOi+g+aWsOeahOmCo+adoeiusOW9le+8jOWIoOmZpOmHjeWkjeeahOiusOW9lVxuICAgIGBcbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgb2xsYW1hQW5hbHlzaXNQcm9ncmVzczoge1xuICAgICAgICB0b3RhbDogMSxcbiAgICAgICAgbGFzdEFuYWx5emVkSW5kZXg6IDAsXG4gICAgICAgIGxhc3RBbmFseXplZFRpbWU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgfVxuICAgIH0pO1xuICAgIGF3YWl0IHNlbmRUb09sbGFtYShwcm9tcHQpO1xuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XG4gICAgICBvbGxhbWFBbmFseXNpc1Byb2dyZXNzOiB7XG4gICAgICAgIHRvdGFsOiAxLFxuICAgICAgICBsYXN0QW5hbHl6ZWRJbmRleDogMSxcbiAgICAgICAgbGFzdEFuYWx5emVkVGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHNlbmRUb09sbGFtYSA9IGFzeW5jIChwcm9tcHQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIHByb21wdCB0byBPbGxhbWE6JywgcHJvbXB0KTtcbiAgICB0cnkge1xuICAgICAgICAvLyDmo4Dmn6XmmK/lkKblnKggYmFja2dyb3VuZCBzY3JpcHQg546v5aKD5LitXG4gICAgICAgIGNvbnN0IGlzQmFja2dyb3VuZCA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnO1xuICAgICAgICBpZiAoaXNCYWNrZ3JvdW5kKSB7XG4gICAgICAgICAgICAvLyDlnKggYmFja2dyb3VuZCBzY3JpcHQg5Lit55u05o6l6LCD55So5aSE55CG5Ye95pWwXG4gICAgICAgICAgICBjb25zdCBbcmVzcG9uc2UsIGpzb25BcnJheV0gPSBhd2FpdCBoYW5kbGVMTE1SZXF1ZXN0KHsgcHJvbXB0IH0pO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJPbGxhbWEncyByZXNwb25zZTpcIiwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJPbGxhbWEncyBqc29uQXJyYXk6XCIsIGpzb25BcnJheSk7XG4gICAgICAgICAgICAvLyDlj5HpgIEgYm90IOa2iOaBr++8jOmBjeWOhuaVsOe7hOS4reeahOavj+S4qumhueebrlxuICAgICAgICAgICAgaWYgKGpzb25BcnJheSAmJiBqc29uQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGpzb25BcnJheS5mb3JFYWNoKGpzb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZW5kQm90TWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkX3J1bGU6IGpzb24ubWF0Y2hlZF9ydWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGVhbV9uYW1lOiBqc29uLnRlYW1fbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlYW1faWQ6IGpzb24udGVhbV9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlcjoganNvbi5zZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlX2NvbnRlbnQ6IGpzb24ubWVzc2FnZV9jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeToganNvbi5zdW1tYXJ5XG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5ZyoIGNvbnRlbnQgc2NyaXB0IOaIluWFtuS7lueOr+Wig+S4reS9v+eUqCBtZXNzYWdlIHBhc3NpbmdcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdMTE1fUkVRVUVTVCcsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBib2R5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IHByb21wdFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5lcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBzZW5kaW5nIHRvIE9sbGFtYTpcIiwgcmVzcG9uc2UuZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJBZGRpdGlvbmFsIGRldGFpbHM6XCIsIHJlc3BvbnNlLmRldGFpbHMgfHwgJ05vIGRldGFpbHMnKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UucmF3UmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJSYXcgcmVzcG9uc2UgZnJvbSBPbGxhbWE6XCIsIHJlc3BvbnNlLnJhd1Jlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KGBGYWlsZWQgdG8gY29ubmVjdCB0byBPbGxhbWE6ICR7cmVzcG9uc2UuZXJyb3J9YCwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkxMTSdzIHJlc3BvbnNlOlwiLCByZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0FuYWx5c2lzIGNvbXBsZXRlLCBwbGVhc2UgY2hlY2sgdGhlIGNvbnNvbGUnLCAnc3VjY2VzcycpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignUmVjZWl2ZWQgaW52YWxpZCByZXNwb25zZSBmb3JtYXQgZnJvbSBMTE0nKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVW5leHBlY3RlZCByZXNwb25zZSBmb3JtYXQ6XCIsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoZXJyb3IubWVzc2FnZSwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gc2VuZFRvT2xsYW1hOlwiLCBlcnJvcik7XG4gICAgICAgIHNob3dUb2FzdChgRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgICB9XG59O1xuXG5leHBvcnQgY29uc3Qgc2hvd1RvYXN0ID0gKG1lc3NhZ2U6IHN0cmluZywgdHlwZTogc3RyaW5nKSA9PiB7XG4gICAgKHdpbmRvdyBhcyBhbnkpLnNob3dUb2FzdD8uKG1lc3NhZ2UsIHR5cGUpO1xufTsiLCJpbnRlcmZhY2UgTWVzc2FnZURhdGEge1xuICAgIG1hdGNoZWRfcnVsZTogc3RyaW5nO1xuICAgIHRlYW1fbmFtZTogc3RyaW5nO1xuICAgIHRlYW1faWQ6IHN0cmluZztcbiAgICBzZW5kZXI6IHN0cmluZztcbiAgICBtZXNzYWdlX2NvbnRlbnQ6IHN0cmluZztcbiAgICBzdW1tYXJ5OiBzdHJpbmc7XG59XG5cbmNvbnN0IEJPVF9BUElfQkFTRV9VUkwgPSAnaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92Mic7XG5jb25zdCBCT1RfVE9LRU4gPSBwcm9jZXNzLmVudi5CT1RfVE9LRU47XG5jb25zdCBCT1RfVFlQRSA9IHByb2Nlc3MuZW52LkJPVF9UWVBFO1xuY29uc3QgVEVBTV9JRCA9IHByb2Nlc3MuZW52LlRFQU1fSUQ7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZW5kQm90TWVzc2FnZShtZXNzYWdlRGF0YTogTWVzc2FnZURhdGEpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZyhcIlNlbmRpbmcgYm90IG1lc3NhZ2U6XCIsIG1lc3NhZ2VEYXRhKTtcbiAgICBjb25zdCB1c2VybmFtZSA9IChhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ2NvbmZpZycpKS5jb25maWcudXNlcm5hbWU7XG4gICAgY29uc3QgdXNlckVtYWlsID0gdXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpICsgJ0ByaW5nY2VudHJhbC5jb20nO1xuICAgIGNvbnN0IGZvcm1hdHRlZE1lc3NhZ2UgPSBgKirnm5HmtYvliLDkuIDmnaHmgqjlj6/og73lhbPms6jnmoTmtojmga8qKiAoQUnlj6/og73lubvop4kg5LuF5L6b5Y+C6ICDKVxuXG5fX+WFs+azqOmhuV9f77yaXFxgJHttZXNzYWdlRGF0YS5tYXRjaGVkX3J1bGV9XFxgXG5fX+WcqOe+pF9f77yaPGEgY2xhc3M9J2F0X21lbnRpb25fY29tcG9zZScgcmVsPSd7XCJpZFwiOiR7bWVzc2FnZURhdGEudGVhbV9pZH19Jz5AJHttZXNzYWdlRGF0YS50ZWFtX25hbWV9PC9hPlxuX1/lj5HpgIHogIVfX++8miR7bWVzc2FnZURhdGEuc2VuZGVyfVxuX1/ljp/mlodfX++8miR7bWVzc2FnZURhdGEubWVzc2FnZV9jb250ZW50fVxuX1/kuIrkuIvmlodfX++8miR7bWVzc2FnZURhdGEuc3VtbWFyeX1gO1xuXG4gICAgY29uc3QgcGF5bG9hZCA9IEJPVF9UWVBFID09PSAndGVhbScgPyB7XG4gICAgICAgIG1lbnRpb25MaXN0OiBbdXNlckVtYWlsXSxcbiAgICAgICAgaXNUZWFtTWVudGlvbjogZmFsc2UsXG4gICAgICAgIHRlYW1OYW1lOiBtZXNzYWdlRGF0YS50ZWFtX25hbWUsXG4gICAgICAgIHRlYW1JZDogVEVBTV9JRCxcbiAgICAgICAgbWVzc2FnZTogZm9ybWF0dGVkTWVzc2FnZSxcbiAgICAgICAgc2tpcE1lbnRpb25DaGVjazogdHJ1ZVxuICAgIH0gOiB7XG4gICAgICAgIG1lbnRpb246IHRydWUsXG4gICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgIGVtYWlsQXV0b0NvcnJlY3Q6IHRydWUsXG4gICAgICAgIG1lc3NhZ2U6IGZvcm1hdHRlZE1lc3NhZ2UsXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7Qk9UX0FQSV9CQVNFX1VSTH0vJHtCT1RfVFlQRX0vbWVzc2FnZWAsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdhY2NlcHQnOiAnKi8qJyxcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke0JPVF9UT0tFTn1gLFxuICAgICAgICAgICAgICAgICdib3QnOiAnNDcwMDM3MjAyMEAzNzQzOTUxMC5ib3QuZ2xpcC5uZXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBCb3QgQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzZW5kIGJvdCBtZXNzYWdlOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufSAiLCIvLyBleHBvcnQgY29uc3QgU0VSVkVSX0hPU1QgPSAnaHR0cHM6Ly9yYWRhci1wb2MuaW50LnJjbGFiZW52LmNvbTo4NDQzJztcbmV4cG9ydCBjb25zdCBTRVJWRVJfSE9TVCA9ICdodHRwOi8vbG9jYWxob3N0OjYzMzMnO1xuXG5leHBvcnQgY29uc3QgQVBJX1BBVEggPSB7XG4gICAgR0VOX1RPUElDUzogJy92MS9nZW4vdG9waWNzJyxcbiAgICBRVUVSWTogJy92MS9xdWVyeScsXG4gICAgR0xPQkFMX1FVRVJZOiAnL3YxL2dsb2JhbF9xdWVyeScsXG4gICAgTEFURVNUX0lOREVYX1RJTUU6ICcvdjEvZmV0Y2hfbGF0ZXN0X2luZGV4X3RpbWUnLFxuICAgIElOREVYSU5HOiAnL3YxL2luZGV4aW5nJyxcbiAgICBJTkNSRU1FTlQ6ICcvdjEvdXBkYXRlX2luZGV4aW5nJyxcbiAgICBERUxFVEU6ICcvdjEvZGVsZXRlJyxcbiAgICBUUkVORElOR19UT1BJQ1M6ICcvdjEvdHJlbmRpbmcvdG9waWNzJyxcbn1cblxuZXhwb3J0IGNvbnN0IENPTkZJR19MT0NBTF9TVE9SQUdFX0tFWSA9ICdSQURBUl9QT0NfQ09ORklHJztcblxuZXhwb3J0IGNvbnN0IFJBREFSX1BPQ19SRVNVTFRfTElTVFMgPSAnUkFEQVJfUE9DX1JFU1VMVF9MSVNUUyc7XG5cbmV4cG9ydCBjb25zdCBSQURBUl9QT0NfQ0FORElEQVRFX1FVRVNUSU9OUyA9ICdSQURBUl9QT0NfQ0FORElEQVRFX1FVRVNUSU9OUyc7IiwiaW1wb3J0IE9wZW5BSSBmcm9tICdvcGVuYWknO1xuXG4vLyDliJ3lp4vljJYgT3BlbkFJIOWuouaIt+err1xuY29uc3Qgb3BlbmFpID0gbmV3IE9wZW5BSSh7XG4gICAgYXBpS2V5OiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSxcbiAgICBiYXNlVVJMOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0JBU0VfVVJMLFxuICAgIGRhbmdlcm91c2x5QWxsb3dCcm93c2VyOiB0cnVlXG59KTtcblxuLy8g5paw5aKe77ya5LuO5ZON5bqU5paH5pys5Lit5o+Q5Y+WIEpTT04g5pWw5o2uXG5mdW5jdGlvbiBleHRyYWN0SnNvbkZyb21SZXNwb25zZShyZXNwb25zZTogc3RyaW5nKTogYW55W10ge1xuICAgIGxldCBqc29uRGF0YTogYW55W10gPSBbXTtcbiAgICB0cnkge1xuICAgICAgICAvLyDpppblhYjlsJ3or5Xnm7TmjqXop6PmnpDmlbTkuKrlk43lupRcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdFBhcnNlID0gSlNPTi5wYXJzZShyZXNwb25zZS50cmltKCkpO1xuICAgICAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoZGlyZWN0UGFyc2UpID8gZGlyZWN0UGFyc2UgOiBbZGlyZWN0UGFyc2VdO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyDlpoLmnpznm7TmjqXop6PmnpDlpLHotKXvvIznu6fnu63lsJ3or5Xlhbbku5bmlrnms5VcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWwneivleS7juWTjeW6lOS4reafpeaJviBKU09OIOS7o+eggeWdl1xuICAgICAgICBjb25zdCBqc29uTWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvYGBgKD86anNvbik/XFxzKihbXFxzXFxTXSo/KVxccypgYGAvKTtcbiAgICAgICAgaWYgKGpzb25NYXRjaCkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoanNvbk1hdGNoWzFdLnRyaW0oKSk7XG4gICAgICAgICAgICBqc29uRGF0YSA9IEFycmF5LmlzQXJyYXkocGFyc2VkRGF0YSkgPyBwYXJzZWREYXRhIDogW3BhcnNlZERhdGFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5bCd6K+V5p+l5om+5Y+v6IO955qEIEpTT04g5a2X56ym5Liy77yI5pa55ous5Y+35oiW5aSn5ous5Y+35byA5aS05ZKM57uT5bC+77yJXG4gICAgICAgICAgICBjb25zdCBqc29uUmVnZXggPSAvKFxcW1tcXHNcXFNdKlxcXXxcXHtbXFxzXFxTXSpcXH0pLztcbiAgICAgICAgICAgIGNvbnN0IHBvdGVudGlhbEpzb24gPSByZXNwb25zZS5tYXRjaChqc29uUmVnZXgpO1xuICAgICAgICAgICAgaWYgKHBvdGVudGlhbEpzb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShwb3RlbnRpYWxKc29uWzFdLnRyaW0oKSk7XG4gICAgICAgICAgICAgICAganNvbkRhdGEgPSBBcnJheS5pc0FycmF5KHBhcnNlZERhdGEpID8gcGFyc2VkRGF0YSA6IFtwYXJzZWREYXRhXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gcGFyc2UgSlNPTiBmcm9tIExMTSByZXNwb25zZTonLCBlKTtcbiAgICB9XG4gICAgcmV0dXJuIGpzb25EYXRhO1xufVxuXG4vLyDlpITnkIYgT2xsYW1hIOivt+axguOAgk9sbGFtYSDlronoo4XlkI7pnIDopoHmioogbGF1bmNoY3RsIHNldGVudiBPTExBTUFfT1JJR0lOUyBcIipcIiDliqDlhaXliLAgLmJhc2hyYyDkuK1cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZU9sbGFtYVJlcXVlc3QoYm9keTogYW55KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3Byb2Nlc3MuZW52Lk9MTEFNQV9CQVNFX1VSTH0vYXBpL2dlbmVyYXRlYCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgbW9kZWw6IHByb2Nlc3MuZW52Lk9MTEFNQV9NT0RFTCxcbiAgICAgICAgICAgIHByb21wdDogYm9keS5wcm9tcHQsXG4gICAgICAgICAgICBzdHJlYW06IGZhbHNlLFxuICAgICAgICAgICAgdGVtcGVyYXR1cmU6IDAuMyxcbiAgICAgICAgICAgIHRvcF9wOiAwLjlcbiAgICAgICAgfSlcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQIGVycm9yISBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICByZXR1cm4gcmVzdWx0LnJlc3BvbnNlO1xufVxuXG4vLyDlpITnkIYgT3BlbkFJIOivt+axglxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlT3BlbkFJUmVxdWVzdChib2R5OiBhbnkpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGNvbXBsZXRpb24gPSBhd2FpdCBvcGVuYWkuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoe1xuICAgICAgICBtb2RlbDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMLFxuICAgICAgICBtZXNzYWdlczogW3sgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IGJvZHkucHJvbXB0IH1dLFxuICAgICAgICB0ZW1wZXJhdHVyZTogMC4zLFxuICAgICAgICB0b3BfcDogMC45XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29tcGxldGlvbi5jaG9pY2VzWzBdLm1lc3NhZ2UuY29udGVudCB8fCAnJztcbn1cblxuLy8g5qC55o2u5LiN5ZCMIExMTSDmnI3liqHlpITnkIYgTExNIOivt+axgu+8jOW5tuaPkOWPliBKU09OIOaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxMTVJlcXVlc3QoYm9keTogYW55KTogUHJvbWlzZTxbc3RyaW5nLCBhbnlbXV0+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gcHJvY2Vzcy5lbnYuTExNX1RZUEUgPT09ICdsb2NhbCcgPyBoYW5kbGVPbGxhbWFSZXF1ZXN0IDogaGFuZGxlT3BlbkFJUmVxdWVzdDtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGhhbmRsZXIoYm9keSk7XG4gICAgY29uc3QganNvbkRhdGEgPSBleHRyYWN0SnNvbkZyb21SZXNwb25zZShyZXNwb25zZSk7XG4gICAgcmV0dXJuIFtyZXNwb25zZSwganNvbkRhdGFdO1xufSAiLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IHNlbmREYXRhVG9PbGxhbWEgfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQgeyBoYW5kbGVMTE1SZXF1ZXN0IH0gZnJvbSAnLi9sbG0nO1xuaW1wb3J0IHsgc2VuZEJvdE1lc3NhZ2UgfSBmcm9tICcuL2JvdCc7XG5jb25zdCBzY2hlZHVsZWRJbnRlcnZhbCA9IDEyMDsgIC8vIOavjzLlsI/ml7bmiafooYzkuIDmrKFcblxuY29uc29sZS5sb2coJ0JhY2tncm91bmQgc2NyaXB0IGxvYWRlZCcpO1xuXG4vLyDmianlsZXlronoo4XmiJbmm7TmlrDml7bvvIznq4vljbPliJvlu7rlrprml7bku7vliqFcbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnRXh0ZW5zaW9uIGluc3RhbGxlZC91cGRhdGVkJyk7XG5cbiAgICAvLyDliJ3lp4vljJbphY3nva5cbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoJ3NjaGVkdWxlQWN0aXZlJyk7XG4gICAgY2hyb21lLnN0b3JhZ2UubG9jYWwucmVtb3ZlKCdvbGxhbWFBbmFseXNpc1Byb2dyZXNzJyk7XG4gICAgXG4gICAgLy8g6I635Y+W5bm25riF55CG6L+H5pyf55qEIGNvbmNlcm5lZEl0ZW1zXG4gICAgY29uc3Qgc3RvcmFnZSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgnY29uY2VybmVkSXRlbXMnKTtcbiAgICBpZiAoc3RvcmFnZS5jb25jZXJuZWRJdGVtcykge1xuICAgICAgICAvLyDov4fmu6Tmjonov4fmnJ/nmoTpobnnm65cbiAgICAgICAgY29uc3QgdmFsaWRJdGVtcyA9IHN0b3JhZ2UuY29uY2VybmVkSXRlbXMuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgICAgICAgcmV0dXJuICFpdGVtLmV4cGlyZWRBdCB8fCBuZXcgRGF0ZShpdGVtLmV4cGlyZWRBdCkgPiBuZXcgRGF0ZSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWmguaenOaciemhueebruiiq+i/h+a7pOaOie+8jOabtOaWsOWtmOWCqFxuICAgICAgICBpZiAodmFsaWRJdGVtcy5sZW5ndGggIT09IHN0b3JhZ2UuY29uY2VybmVkSXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBjb25jZXJuZWRJdGVtczogdmFsaWRJdGVtcyB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDlpoLmnpzmsqHmnIkgY29uY2VybmVkSXRlbXMg5oiW5bey5riF56m677yM6K6+572u6buY6K6k5YC8XG4gICAgaWYgKCFzdG9yYWdlLmNvbmNlcm5lZEl0ZW1zIHx8IHN0b3JhZ2UuY29uY2VybmVkSXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7Y29uY2VybmVkSXRlbXM6IFtcbiAgICAgICAgICAgIHt0ZXh0OifogYrliLDlhbPkuo7lhazlj7jmlL/nrZbvvIzkuZ/lj6/ku6XmmK/mlL/nrZbnm7jlhbPnmoTlhavljabmtojmga8nfSxcbiAgICAgICAgICAgIHt0ZXh0Oifku7vkvZXmmI7noa4gQOaIkSDnmoTmtojmga/vvIzmiJbogIXmj5DliLDmiJHnmoTlkI3lrZfnmoTmtojmga8nfSxcbiAgICAgICAgXX0pO1xuICAgIH1cblxuICAgIC8vIOafpeaJvuW5tuWIt+aWsCBSaW5nQ2VudHJhbCDmoIfnrb7pobVcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByY1RhYiA9IGF3YWl0IGZpbmRSaW5nQ2VudHJhbFRhYigpO1xuICAgICAgICBpZiAocmNUYWIgJiYgcmNUYWIuaWQpIHtcbiAgICAgICAgICAgIGF3YWl0IGNocm9tZS50YWJzLnJlbG9hZChyY1RhYi5pZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUmluZ0NlbnRyYWwgdGFiIHJlZnJlc2hlZCcpO1xuXG4gICAgICAgICAgICAvLyDlu7bov5/ojrflj5YgUkMgUmFkYXIg6YWN572uXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnZ2V0Q29uZmlnRnJvbVdlYnBhZ2UnLCBhd2FpdCBnZXRDb25maWdGcm9tV2VicGFnZSgpKTtcbiAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XG4gICAgICAgICAgICAgICAgY29uZmlnOiBhd2FpdCBnZXRDb25maWdGcm9tV2VicGFnZSgpIHx8IHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0R3JvdXBOYW1lczogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlU21zOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlVm9pY2VtYWlsOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlQ2FsbFRyYW5zY3JpcHQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVDYWxlbmRhcjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZUNhbmRpZGF0ZVF1ZXN0aW9uczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdEZvbGRlckdyb3VwSWRzOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICB1c2VybmFtZTogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW5zaW9uSWQ6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIGFwaUtleTogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw6IFwiNG9cIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byByZWZyZXNoIFJpbmdDZW50cmFsIHRhYjonLCBlcnJvcik7XG4gICAgfVxufSk7XG5cbi8vIOebkeWQrOWumuaXtuS7u+WKoVxuY2hyb21lLmFsYXJtcy5vbkFsYXJtLmFkZExpc3RlbmVyKChhbGFybSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdhbGFybScsIGFsYXJtKTtcbiAgICBpZiAoYWxhcm0ubmFtZSA9PT0gJ2NoZWNrTWVzc2FnZXMnKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdSdW5uaW5nIHNjaGVkdWxlZCBtZXNzYWdlIGNoZWNrLi4uJyk7XG4gICAgICAgIHJ1blNjaGVkdWxlZFRhc2soKTtcbiAgICB9XG59KTtcblxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChyZXF1ZXN0LCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmVkIG1lc3NhZ2U6JywgcmVxdWVzdCk7XG5cbiAgICBpZiAocmVxdWVzdC50eXBlID09PSAnTExNX1JFUVVFU1QnKSB7XG4gICAgICAgIGNvbnN0IHsgYm9keSB9ID0gcmVxdWVzdC5kYXRhO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgcmVxdWVzdCB0byBMTE06JywgYm9keSk7XG4gICAgICAgIFxuICAgICAgICBoYW5kbGVMTE1SZXF1ZXN0KGJvZHkpXG4gICAgICAgICAgICAudGhlbigoW3JhdywganNvbkFycmF5XSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdMTE0gcmVzcG9uc2U6JywgcmF3KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnTExNIGpzb25BcnJheTonLCBqc29uQXJyYXkpO1xuICAgICAgICAgICAgICAgIC8vIOWPkemAgSBib3Qg5raI5oGv77yM6YGN5Y6G5pWw57uE5Lit55qE5q+P5Liq6aG555uuXG4gICAgICAgICAgICAgICAgaWYgKGpzb25BcnJheSAmJiBqc29uQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBqc29uQXJyYXkuZm9yRWFjaChqc29uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRCb3RNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkX3J1bGU6IGpzb24ubWF0Y2hlZF9ydWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlYW1fbmFtZToganNvbi50ZWFtX25hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVhbV9pZDoganNvbi50ZWFtX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlcjoganNvbi5zZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZV9jb250ZW50OiBqc29uLm1lc3NhZ2VfY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBqc29uLnN1bW1hcnlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgZGF0YTogcmF3IH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTExNIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IGBGYWlsZWQgdG8gY29ubmVjdCB0byAke3Byb2Nlc3MuZW52LkxMTV9UWVBFfSBzZXJ2aWNlYFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAocmVxdWVzdC50eXBlID09PSAnQ09OVFJPTF9TQ0hFRFVMRURfQ0hFQ0snKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ3N0YXJ0Jykge1xuICAgICAgICAgICAgc3RhcnRTY2hlZHVsZWRDaGVjaygpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3RhdHVzOiAnc3RhcnRlZCcgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVxdWVzdC5hY3Rpb24gPT09ICdzdG9wJykge1xuICAgICAgICAgICAgc3RvcFNjaGVkdWxlZENoZWNrKCk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdGF0dXM6ICdzdG9wcGVkJyB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59KTtcblxuLy8g5ZCv5Yqo5a6a5pe25Lu75YqhXG5sZXQgdGltZXJGaXJzdFJ1bkFsYXJtczogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBzdGFydFNjaGVkdWxlZENoZWNrKCkge1xuICAgIHRpbWVyRmlyc3RSdW5BbGFybXMgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcnVuU2NoZWR1bGVkVGFzaygpOyAvLyDnq4vljbPmiafooYzkuIDmrKFcbiAgICB9LCAxMDAwMCk7XG4gICAgY2hyb21lLmFsYXJtcy5jcmVhdGUoJ2NoZWNrTWVzc2FnZXMnLCB7XG4gICAgICAgIHBlcmlvZEluTWludXRlczogc2NoZWR1bGVkSW50ZXJ2YWxcbiAgICB9KTtcbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBzY2hlZHVsZUFjdGl2ZTogdHJ1ZSB9KTtcbiAgICBjb25zb2xlLmxvZygnU2NoZWR1bGVkIG1lc3NhZ2UgY2hlY2sgc3RhcnRlZCcpO1xufVxuXG4vLyDlgZzmraLlrprml7bku7vliqFcbmV4cG9ydCBmdW5jdGlvbiBzdG9wU2NoZWR1bGVkQ2hlY2soKSB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyRmlyc3RSdW5BbGFybXMpO1xuICAgIGNocm9tZS5hbGFybXMuY2xlYXIoJ2NoZWNrTWVzc2FnZXMnKTtcbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBzY2hlZHVsZUFjdGl2ZTogZmFsc2UgfSk7XG4gICAgY29uc29sZS5sb2coJ1NjaGVkdWxlZCBtZXNzYWdlIGNoZWNrIHN0b3BwZWQnKTtcbn1cblxuLy8g5a6a5pe25oqT5Y+W5YiG5p6Q5raI5oGvXG5hc3luYyBmdW5jdGlvbiBydW5TY2hlZHVsZWRUYXNrKCkge1xuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2NvbmZpZyddLCBhc3luYyAocmVzdWx0KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZXN1bHQnLCByZXN1bHQpO1xuICAgICAgICBpZiAocmVzdWx0LmNvbmZpZykge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnID0gcmVzdWx0LmNvbmZpZztcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5ldyBEYXRlKERhdGUubm93KCkgLSAoc2NoZWR1bGVkSW50ZXJ2YWwgKyA1KSAqIDYwICogMTAwMCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8g5p+l5om+5oiW5Yib5bu6IFJpbmdDZW50cmFsIOagh+etvumhtVxuICAgICAgICAgICAgICAgIGxldCByY1RhYiA9IGF3YWl0IGZpbmRSaW5nQ2VudHJhbFRhYigpO1xuICAgICAgICAgICAgICAgIGlmICghcmNUYWIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmNUYWIgPSBhd2FpdCBjcmVhdGVSaW5nQ2VudHJhbFRhYigpO1xuICAgICAgICAgICAgICAgICAgICAvLyDnrYnlvoXpobXpnaLliqDovb3lrozmiJBcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgd2FpdEZvclRhYkxvYWQocmNUYWIuaWQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIOWwneivleWPkemAgea2iOaBr++8jOWmguaenOWksei0peWImemHjeivlVxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZE1lc3NhZ2VXaXRoUmV0cnkocmNUYWIuaWQsIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0ZFVENIX1VTRVJfREFUQScsXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2VuZERhdGFUb09sbGFtYShyZXNwb25zZS5kYXRhLCBjb25maWcpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdCYWNrZ3JvdW5kIHRhc2sgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbi8vIOafpeaJvuW3suaJk+W8gOeahCBSaW5nQ2VudHJhbCDmoIfnrb7pobVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kUmluZ0NlbnRyYWxUYWIoKSB7XG4gICAgY29uc3QgdGFicyA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHtcbiAgICAgICAgdXJsOiBcIio6Ly9hcHAucmluZ2NlbnRyYWwuY29tLypcIlxuICAgIH0pO1xuICAgIHJldHVybiB0YWJzWzBdO1xufVxuXG4vLyDliJvlu7rmlrDnmoQgUmluZ0NlbnRyYWwg5qCH562+6aG1XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlUmluZ0NlbnRyYWxUYWIoKSB7XG4gICAgcmV0dXJuIGF3YWl0IGNocm9tZS50YWJzLmNyZWF0ZSh7XG4gICAgICAgIHVybDogXCJodHRwczovL2FwcC5yaW5nY2VudHJhbC5jb20vdmlkZW9cIixcbiAgICAgICAgYWN0aXZlOiBmYWxzZVxuICAgIH0pO1xufVxuXG4vLyDnrYnlvoXmoIfnrb7pobXliqDovb3lrozmiJBcbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yVGFiTG9hZCh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNocm9tZS50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcihmdW5jdGlvbiBsaXN0ZW5lcih1cGRhdGVkVGFiSWQsIGluZm8pIHtcbiAgICAgICAgICAgIGlmICh1cGRhdGVkVGFiSWQgPT09IHRhYklkICYmIGluZm8uc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnRhYnMub25VcGRhdGVkLnJlbW92ZUxpc3RlbmVyKGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICAvLyDnu5npobXpnaLkuIDkupvpop3lpJbml7bpl7TmnaXliJ3lp4vljJYgY29udGVudCBzY3JpcHRcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuLy8g5bim6YeN6K+V5py65Yi255qE5raI5oGv5Y+R6YCB5Ye95pWwXG5mdW5jdGlvbiBzZW5kTWVzc2FnZVdpdGhSZXRyeSh0YWJJZDogbnVtYmVyLCBtZXNzYWdlOiBhbnksIG1heFJldHJpZXMgPSAzKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuXG4gICAgICAgIGNvbnN0IHRyeVNlbmRNZXNzYWdlID0gKCkgPT4ge1xuICAgICAgICAgICAgYXR0ZW1wdHMrKztcbiAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHRhYklkLCBtZXNzYWdlLCByZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQXR0ZW1wdCAke2F0dGVtcHRzfSBmYWlsZWQ6YCwgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dGVtcHRzIDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCh0cnlTZW5kTWVzc2FnZSwgNTAwMCk7IC8vIDXnp5LlkI7ph43or5VcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0ZhaWxlZCB0byBzZW5kIG1lc3NhZ2UgYWZ0ZXIgbXVsdGlwbGUgYXR0ZW1wdHMnKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgIXJlc3BvbnNlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0ZhaWxlZCB0byBmZXRjaCB1c2VyIGRhdGE6ICcgKyByZXNwb25zZT8uZXJyb3IpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRyeVNlbmRNZXNzYWdlKCk7XG4gICAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldENvbmZpZ0Zyb21XZWJwYWdlKCkge1xuICAgIGNvbnN0IHRhYiA9IGF3YWl0IGZpbmRSaW5nQ2VudHJhbFRhYigpO1xuICAgIGlmICghdGFiKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHNlbmRNZXNzYWdlV2l0aFJldHJ5KHRhYi5pZCwge1xuICAgICAgICAgICAgdHlwZTogJ0dFVF9DT05GSUcnXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzcG9uc2UuY29uZmlnO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgY29uZmlnOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufSAiXSwibmFtZXMiOlsiU0VSVkVSX0hPU1QiLCJBUElfUEFUSCIsImhhbmRsZUxMTVJlcXVlc3QiLCJzZW5kQm90TWVzc2FnZSIsImZldGNoUmFkYXJQb2NTZXJ2ZXIiLCJwYXRoIiwiYm9keSIsInVybCIsImZldGNoIiwibWV0aG9kIiwiaGVhZGVycyIsIkpTT04iLCJzdHJpbmdpZnkiLCJ0aGVuIiwicmVzcG9uc2UiLCJvayIsImVycm9yRGF0YSIsImpzb24iLCJFcnJvciIsImRldGFpbCIsInN0YXR1cyIsImRhdGEiLCJnZW5Ub3BpY3MiLCJjb25maWciLCJ1c2VybmFtZSIsImV4dGVuc2lvbklkIiwibW9kZWwiLCJleHRlbnNpb25faWQiLCJHRU5fVE9QSUNTIiwidHJlbmRpbmdUb3BpY3MiLCJUUkVORElOR19UT1BJQ1MiLCJjdXN0b21RdWVyeSIsInF1ZXJ5IiwiUVVFUlkiLCJnbG9iYWxRdWVyeSIsIkdMT0JBTF9RVUVSWSIsImZldGNoTGFzdEluZGV4VGltZSIsIkxBVEVTVF9JTkRFWF9USU1FIiwiaW5kZXhpbmciLCJsZW5ndGgiLCJQcm9taXNlIiwicmVqZWN0IiwiSU5ERVhJTkciLCJpbmNyZW1lbnQiLCJJTkNSRU1FTlQiLCJkZWxldGVfaW5kZXhpbmciLCJERUxFVEUiLCJmZXRjaERpZnlTZXJ2ZXIiLCJhcGlLZXkiLCJpbnB1dHMiLCJyZXNwb25zZV9tb2RlIiwidXNlciIsImFuc3dlciIsImNhdGNoIiwiZXJyb3IiLCJtZXNzYWdlIiwic2VuZERhdGFUb09sbGFtYSIsImNvbmNlcm5lZEl0ZW1zIiwiY2hyb21lIiwic3RvcmFnZSIsImxvY2FsIiwiZ2V0IiwidGV4dCIsImNvbnNvbGUiLCJsb2ciLCJwcm9jZXNzIiwiZW52IiwiTExNX1RZUEUiLCJzZXQiLCJvbGxhbWFBbmFseXNpc1Byb2dyZXNzIiwidG90YWwiLCJsYXN0QW5hbHl6ZWRJbmRleCIsImxhc3RBbmFseXplZFRpbWUiLCJEYXRlIiwidG9JU09TdHJpbmciLCJmb3JFYWNoIiwiaXRlbSIsImluZGV4Iiwic2V0VGltZW91dCIsImdyb3VwTmFtZSIsImdyb3VwSWQiLCJwb3N0cyIsIm1hcCIsInBvc3QiLCJjcmVhdG9yIiwidGltZSIsImpvaW4iLCJwcm9tcHQiLCJpIiwic2VuZFRvT2xsYW1hIiwibWVzc2FnZXMiLCJyZWR1Y2UiLCJhY2MiLCJpc0JhY2tncm91bmQiLCJ3aW5kb3ciLCJqc29uQXJyYXkiLCJtYXRjaGVkX3J1bGUiLCJ0ZWFtX25hbWUiLCJ0ZWFtX2lkIiwic2VuZGVyIiwibWVzc2FnZV9jb250ZW50Iiwic3VtbWFyeSIsInJ1bnRpbWUiLCJzZW5kTWVzc2FnZSIsInR5cGUiLCJkZXRhaWxzIiwicmF3UmVzcG9uc2UiLCJzaG93VG9hc3QiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwibWVzc2FnZURhdGEiLCJ1c2VyRW1haWwiLCJ0cmltIiwic3BsaXQiLCJmb3JtYXR0ZWRNZXNzYWdlIiwicGF5bG9hZCIsIm1lbnRpb25MaXN0IiwiaXNUZWFtTWVudGlvbiIsInRlYW1OYW1lIiwidGVhbUlkIiwic2tpcE1lbnRpb25DaGVjayIsIm1lbnRpb24iLCJlbWFpbCIsImVtYWlsQXV0b0NvcnJlY3QiLCJDT05GSUdfTE9DQUxfU1RPUkFHRV9LRVkiLCJSQURBUl9QT0NfUkVTVUxUX0xJU1RTIiwiUkFEQVJfUE9DX0NBTkRJREFURV9RVUVTVElPTlMiLCJPcGVuQUkiLCJvcGVuYWkiLCJPUEVOQUlfQVBJX0tFWSIsImJhc2VVUkwiLCJPUEVOQUlfQVBJX0JBU0VfVVJMIiwiZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXIiLCJleHRyYWN0SnNvbkZyb21SZXNwb25zZSIsImpzb25EYXRhIiwiZGlyZWN0UGFyc2UiLCJwYXJzZSIsIkFycmF5IiwiaXNBcnJheSIsImUiLCJqc29uTWF0Y2giLCJtYXRjaCIsInBhcnNlZERhdGEiLCJqc29uUmVnZXgiLCJwb3RlbnRpYWxKc29uIiwid2FybiIsImhhbmRsZU9sbGFtYVJlcXVlc3QiLCJPTExBTUFfQkFTRV9VUkwiLCJPTExBTUFfTU9ERUwiLCJzdHJlYW0iLCJ0ZW1wZXJhdHVyZSIsInRvcF9wIiwicmVzdWx0IiwiaGFuZGxlT3BlbkFJUmVxdWVzdCIsImNvbXBsZXRpb24iLCJjaGF0IiwiY29tcGxldGlvbnMiLCJjcmVhdGUiLCJPUEVOQUlfTU9ERUwiLCJyb2xlIiwiY29udGVudCIsImNob2ljZXMiLCJoYW5kbGVyIiwic2NoZWR1bGVkSW50ZXJ2YWwiLCJvbkluc3RhbGxlZCIsImFkZExpc3RlbmVyIiwicmVtb3ZlIiwidmFsaWRJdGVtcyIsImZpbHRlciIsImV4cGlyZWRBdCIsInJjVGFiIiwiZmluZFJpbmdDZW50cmFsVGFiIiwiaWQiLCJ0YWJzIiwicmVsb2FkIiwiZ2V0Q29uZmlnRnJvbVdlYnBhZ2UiLCJzZWxlY3RHcm91cE5hbWVzIiwiZW5hYmxlTWVzc2FnZSIsImVuYWJsZVNtcyIsImVuYWJsZVZvaWNlbWFpbCIsImVuYWJsZUNhbGxUcmFuc2NyaXB0IiwiZW5hYmxlQ2FsZW5kYXIiLCJlbmFibGVDYW5kaWRhdGVRdWVzdGlvbnMiLCJzZWxlY3RGb2xkZXJHcm91cElkcyIsImFsYXJtcyIsIm9uQWxhcm0iLCJhbGFybSIsIm5hbWUiLCJydW5TY2hlZHVsZWRUYXNrIiwib25NZXNzYWdlIiwicmVxdWVzdCIsInNlbmRSZXNwb25zZSIsIl9yZWYiLCJyYXciLCJhY3Rpb24iLCJzdGFydFNjaGVkdWxlZENoZWNrIiwic3RvcFNjaGVkdWxlZENoZWNrIiwidGltZXJGaXJzdFJ1bkFsYXJtcyIsInBlcmlvZEluTWludXRlcyIsInNjaGVkdWxlQWN0aXZlIiwiY2xlYXJUaW1lb3V0IiwiY2xlYXIiLCJzdGFydFRpbWUiLCJub3ciLCJjcmVhdGVSaW5nQ2VudHJhbFRhYiIsIndhaXRGb3JUYWJMb2FkIiwic2VuZE1lc3NhZ2VXaXRoUmV0cnkiLCJhY3RpdmUiLCJ0YWJJZCIsInJlc29sdmUiLCJvblVwZGF0ZWQiLCJsaXN0ZW5lciIsInVwZGF0ZWRUYWJJZCIsImluZm8iLCJyZW1vdmVMaXN0ZW5lciIsIm1heFJldHJpZXMiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJhdHRlbXB0cyIsInRyeVNlbmRNZXNzYWdlIiwibGFzdEVycm9yIiwidGFiIl0sInNvdXJjZVJvb3QiOiIifQ==