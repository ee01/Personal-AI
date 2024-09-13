export const MARKDOWN_STYLE = `
.radar-poc-result-inner {
    color-scheme: light;
    --color-prettylights-syntax-comment: #6e7781;
    --color-prettylights-syntax-constant: #0550ae;
    --color-prettylights-syntax-entity: #8250df;
    --color-prettylights-syntax-storage-modifier-import: #24292f;
    --color-prettylights-syntax-entity-tag: #116329;
    --color-prettylights-syntax-keyword: #cf222e;
    --color-prettylights-syntax-string: #0a3069;
    --color-prettylights-syntax-variable: #953800;
    --color-prettylights-syntax-brackethighlighter-unmatched: #82071e;
    --color-prettylights-syntax-invalid-illegal-text: #f6f8fa;
    --color-prettylights-syntax-invalid-illegal-bg: #82071e;
    --color-prettylights-syntax-carriage-return-text: #f6f8fa;
    --color-prettylights-syntax-carriage-return-bg: #cf222e;
    --color-prettylights-syntax-string-regexp: #116329;
    --color-prettylights-syntax-markup-list: #3b2300;
    --color-prettylights-syntax-markup-heading: #0550ae;
    --color-prettylights-syntax-markup-italic: #24292f;
    --color-prettylights-syntax-markup-bold: #24292f;
    --color-prettylights-syntax-markup-deleted-text: #82071e;
    --color-prettylights-syntax-markup-deleted-bg: #ffebe9;
    --color-prettylights-syntax-markup-inserted-text: #116329;
    --color-prettylights-syntax-markup-inserted-bg: #dafbe1;
    --color-prettylights-syntax-markup-changed-text: #953800;
    --color-prettylights-syntax-markup-changed-bg: #ffd8b5;
    --color-prettylights-syntax-markup-ignored-text: #eaeef2;
    --color-prettylights-syntax-markup-ignored-bg: #0550ae;
    --color-prettylights-syntax-meta-diff-range: #8250df;
    --color-prettylights-syntax-brackethighlighter-angle: #57606a;
    --color-prettylights-syntax-sublimelinter-gutter-mark: #8c959f;
    --color-prettylights-syntax-constant-other-reference-link: #0a3069;
    --color-fg-default: #24292f;
    --color-fg-muted: #57606a;
    --color-fg-subtle: #6e7781;
    --color-canvas-default: transparent;
    --color-canvas-subtle: #f6f8fa;
    --color-border-default: #d0d7de;
    --color-border-muted: #d8dee4;
    --color-neutral-muted: rgba(175,184,193,.2);
    --color-accent-fg: #0969da;
    --color-accent-emphasis: #0969da;
    --color-attention-subtle: #fff8c5;
    --color-danger-fg: #cf222e

    -ms-text-size-adjust: 100%;
    -webkit-text-size-adjust: 100%;
    margin: 0;
    color: #101828;
    background-color: var(--color-canvas-default);
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    word-wrap: break-word;
    word-break: break-word;
    -webkit-user-select: text;
    -moz-user-select: text;
    user-select: text;
    flex: 1;
}
.radar-poc-result-inner h1 {
    font-size: 20px;
}
.radar-poc-result-inner h2 {
    font-size: 18px;
}
.radar-poc-result-inner h3 .radar-poc-result-inner h4, .radar-poc-result-inner h5, .radar-poc-result-inner h6 {
    font-size: 16px;
}

.radar-poc-result-inner h1:hover .anchor .octicon-link:before,.radar-poc-result-inner h2:hover .anchor .octicon-link:before,.radar-poc-result-inner h3:hover .anchor .octicon-link:before,.radar-poc-result-inner h4:hover .anchor .octicon-link:before,.radar-poc-result-inner h5:hover .anchor .octicon-link:before,.radar-poc-result-inner h6:hover .anchor .octicon-link:before {
    width: 16px;
    height: 16px;
    content: " ";
    display: inline-block;
    background-color: currentColor;
    -webkit-mask-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' version='1.1' aria-hidden='true'><path fill-rule='evenodd' d='M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z'></path></svg>");
    mask-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' version='1.1' aria-hidden='true'><path fill-rule='evenodd' d='M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z'></path></svg>")
}

.radar-poc-result-inner details,.radar-poc-result-inner figcaption,.radar-poc-result-inner figure {
    display: block
}

.radar-poc-result-inner summary {
    display: list-item
}

.radar-poc-result-inner [hidden] {
    display: none!important
}

.radar-poc-result-inner a {
    background-color: transparent;
    color: #155eef;
    text-decoration: none
}

.radar-poc-result-inner abbr[title] {
    border-bottom: none;
    -webkit-text-decoration: underline dotted;
    text-decoration: underline dotted
}

.radar-poc-result-inner b,.radar-poc-result-inner strong {
    font-weight: var(--base-text-weight-semibold,600)
}

.radar-poc-result-inner dfn {
    font-style: italic
}

.radar-poc-result-inner mark {
    background-color: var(--color-attention-subtle);
    color: var(--color-fg-default)
}

.radar-poc-result-inner small {
    font-size: 90%
}

.radar-poc-result-inner sub,.radar-poc-result-inner sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline
}

.radar-poc-result-inner sub {
    bottom: -.25em
}

.radar-poc-result-inner sup {
    top: -.5em
}

.radar-poc-result-inner img {
    border-style: none;
    max-width: 100%;
    box-sizing: content-box;
    background-color: var(--color-canvas-default)
}

.radar-poc-result-inner code,.radar-poc-result-inner kbd,.radar-poc-result-inner pre,.radar-poc-result-inner samp {
    font-family: monospace;
    font-size: 1em
}

.radar-poc-result-inner figure {
    margin: 1em 40px
}

.radar-poc-result-inner hr {
    box-sizing: content-box;
    overflow: hidden;
    background: transparent;
    height: .25em;
    padding: 0;
    margin: 24px 0;
    background-color: var(--color-border-default);
    border: 0
}

.radar-poc-result-inner input {
    font: inherit;
    margin: 0;
    overflow: visible;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit
}

.radar-poc-result-inner [type=button],.radar-poc-result-inner [type=reset],.radar-poc-result-inner [type=submit] {
    -webkit-appearance: button
}

.radar-poc-result-inner [type=checkbox],.radar-poc-result-inner [type=radio] {
    box-sizing: border-box;
    padding: 0
}

.radar-poc-result-inner [type=number]::-webkit-inner-spin-button,.radar-poc-result-inner [type=number]::-webkit-outer-spin-button {
    height: auto
}

.radar-poc-result-inner [type=search]::-webkit-search-cancel-button,.radar-poc-result-inner [type=search]::-webkit-search-decoration {
    -webkit-appearance: none
}

.radar-poc-result-inner ::-webkit-input-placeholder {
    color: inherit;
    opacity: .54
}

.radar-poc-result-inner ::-webkit-file-upload-button {
    -webkit-appearance: button;
    font: inherit
}

.radar-poc-result-inner a:hover {
    text-decoration: underline
}

.radar-poc-result-inner ::-moz-placeholder {
    color: var(--color-fg-subtle);
    opacity: 1
}

.radar-poc-result-inner ::placeholder {
    color: var(--color-fg-subtle);
    opacity: 1
}

.radar-poc-result-inner hr:after,.radar-poc-result-inner hr:before {
    display: table;
    content: ""
}

.radar-poc-result-inner hr:after {
    clear: both
}

.radar-poc-result-inner table {
    border-spacing: 0;
    border-collapse: collapse;
    display: block;
    width: -moz-max-content;
    width: max-content;
    max-width: 100%;
    overflow: auto
}

.radar-poc-result-inner td,.radar-poc-result-inner th {
    padding: 0
}

.radar-poc-result-inner details summary {
    cursor: pointer
}

.radar-poc-result-inner details:not([open])>:not(summary) {
    display: none!important
}

.radar-poc-result-inner [role=button]:focus,.radar-poc-result-inner a:focus,.radar-poc-result-inner input[type=checkbox]:focus,.radar-poc-result-inner input[type=radio]:focus {
    outline: 2px solid var(--color-accent-fg);
    outline-offset: -2px;
    box-shadow: none
}

.radar-poc-result-inner [role=button]:focus:not(:focus-visible),.radar-poc-result-inner a:focus:not(:focus-visible),.radar-poc-result-inner input[type=checkbox]:focus:not(:focus-visible),.radar-poc-result-inner input[type=radio]:focus:not(:focus-visible) {
    outline: 1px solid transparent
}

.radar-poc-result-inner [role=button]:focus-visible,.radar-poc-result-inner a:focus-visible,.radar-poc-result-inner input[type=checkbox]:focus-visible,.radar-poc-result-inner input[type=radio]:focus-visible {
    outline: 2px solid var(--color-accent-fg);
    outline-offset: -2px;
    box-shadow: none
}

.radar-poc-result-inner a:not([class]):focus,.radar-poc-result-inner a:not([class]):focus-visible,.radar-poc-result-inner input[type=checkbox]:focus,.radar-poc-result-inner input[type=checkbox]:focus-visible,.radar-poc-result-inner input[type=radio]:focus,.radar-poc-result-inner input[type=radio]:focus-visible {
    outline-offset: 0
}

.radar-poc-result-inner kbd {
    display: inline-block;
    padding: 3px 5px;
    font: 11px ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace;
    line-height: 10px;
    color: var(--color-fg-default);
    vertical-align: middle;
    background-color: var(--color-canvas-subtle);
    border-bottom-color: var(--color-neutral-muted);
    border: 1px solid var(--color-neutral-muted);
    border-radius: 6px;
    box-shadow: inset 0 -1px 0 var(--color-neutral-muted)
}

.radar-poc-result-inner h1,.radar-poc-result-inner h2,.radar-poc-result-inner h3,.radar-poc-result-inner h4,.radar-poc-result-inner h5,.radar-poc-result-inner h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: var(--base-text-weight-semibold,600);
    line-height: 1.25
}

.radar-poc-result-inner p {
    margin-top: 0;
    margin-bottom: 10px
}

.radar-poc-result-inner blockquote {
    margin: 0;
    padding: 0 8px;
    border-left: 2px solid #2970ff
}

.radar-poc-result-inner ol,.radar-poc-result-inner ul {
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 2em
}

.radar-poc-result-inner ol {
    list-style: decimal
}

.radar-poc-result-inner ul {
    list-style: disc
}

.radar-poc-result-inner ol ol,.radar-poc-result-inner ul ol {
    list-style-type: lower-roman
}

.radar-poc-result-inner ol ol ol,.radar-poc-result-inner ol ul ol,.radar-poc-result-inner ul ol ol,.radar-poc-result-inner ul ul ol {
    list-style-type: lower-alpha
}

.radar-poc-result-inner dd {
    margin-left: 0
}

.radar-poc-result-inner code,.radar-poc-result-inner pre,.radar-poc-result-inner samp,.radar-poc-result-inner tt {
    font-family: ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace;
    font-size: 12px
}

.radar-poc-result-inner pre {
    margin-top: 0;
    margin-bottom: 0;
    word-wrap: normal
}

.radar-poc-result-inner .octicon {
    display: inline-block;
    overflow: visible!important;
    vertical-align: text-bottom;
    fill: currentColor
}

.radar-poc-result-inner input::-webkit-inner-spin-button,.radar-poc-result-inner input::-webkit-outer-spin-button {
    margin: 0;
    -webkit-appearance: none;
    appearance: none
}

.radar-poc-result-inner:after,.radar-poc-result-inner:before {
    display: table;
    content: ""
}

.radar-poc-result-inner:after {
    clear: both
}

.radar-poc-result-inner>:first-child {
    margin-top: 0!important
}

.radar-poc-result-inner>:last-child {
    margin-bottom: 0!important
}

.radar-poc-result-inner a:not([href]) {
    color: inherit;
    text-decoration: none
}

.radar-poc-result-inner .absent {
    color: var(--color-danger-fg)
}

.radar-poc-result-inner .anchor {
    float: left;
    padding-right: 4px;
    margin-left: -20px;
    line-height: 1
}

.radar-poc-result-inner .anchor:focus {
    outline: none
}

.radar-poc-result-inner blockquote,.radar-poc-result-inner details,.radar-poc-result-inner dl,.radar-poc-result-inner ol,.radar-poc-result-inner p,.radar-poc-result-inner pre,.radar-poc-result-inner table,.radar-poc-result-inner ul {
    margin-top: 0;
    margin-bottom: 16px
}

.radar-poc-result-inner blockquote>:first-child {
    margin-top: 0
}

.radar-poc-result-inner blockquote>:last-child {
    margin-bottom: 0
}

.radar-poc-result-inner h1 .octicon-link,.radar-poc-result-inner h2 .octicon-link,.radar-poc-result-inner h3 .octicon-link,.radar-poc-result-inner h4 .octicon-link,.radar-poc-result-inner h5 .octicon-link,.radar-poc-result-inner h6 .octicon-link {
    color: var(--color-fg-default);
    vertical-align: middle;
    visibility: hidden
}

.radar-poc-result-inner h1:hover .anchor,.radar-poc-result-inner h2:hover .anchor,.radar-poc-result-inner h3:hover .anchor,.radar-poc-result-inner h4:hover .anchor,.radar-poc-result-inner h5:hover .anchor,.radar-poc-result-inner h6:hover .anchor {
    text-decoration: none
}

.radar-poc-result-inner h1:hover .anchor .octicon-link,.radar-poc-result-inner h2:hover .anchor .octicon-link,.radar-poc-result-inner h3:hover .anchor .octicon-link,.radar-poc-result-inner h4:hover .anchor .octicon-link,.radar-poc-result-inner h5:hover .anchor .octicon-link,.radar-poc-result-inner h6:hover .anchor .octicon-link {
    visibility: visible
}

.radar-poc-result-inner h1 code,.radar-poc-result-inner h1 tt,.radar-poc-result-inner h2 code,.radar-poc-result-inner h2 tt,.radar-poc-result-inner h3 code,.radar-poc-result-inner h3 tt,.radar-poc-result-inner h4 code,.radar-poc-result-inner h4 tt,.radar-poc-result-inner h5 code,.radar-poc-result-inner h5 tt,.radar-poc-result-inner h6 code,.radar-poc-result-inner h6 tt {
    padding: 0 .2em;
    font-size: inherit
}

.radar-poc-result-inner summary h1,.radar-poc-result-inner summary h2,.radar-poc-result-inner summary h3,.radar-poc-result-inner summary h4,.radar-poc-result-inner summary h5,.radar-poc-result-inner summary h6 {
    display: inline-block
}

.radar-poc-result-inner summary h1 .anchor,.radar-poc-result-inner summary h2 .anchor,.radar-poc-result-inner summary h3 .anchor,.radar-poc-result-inner summary h4 .anchor,.radar-poc-result-inner summary h5 .anchor,.radar-poc-result-inner summary h6 .anchor {
    margin-left: -40px
}

.radar-poc-result-inner summary h1,.radar-poc-result-inner summary h2 {
    padding-bottom: 0;
    border-bottom: 0
}

.radar-poc-result-inner ol.no-list,.radar-poc-result-inner ul.no-list {
    padding: 0;
    list-style-type: none
}

.radar-poc-result-inner ol[type=a] {
    list-style-type: lower-alpha
}

.radar-poc-result-inner ol[type=A] {
    list-style-type: upper-alpha
}

.radar-poc-result-inner ol[type=i] {
    list-style-type: lower-roman
}

.radar-poc-result-inner ol[type=I] {
    list-style-type: upper-roman
}

.radar-poc-result-inner div>ol:not([type]),.radar-poc-result-inner ol[type="1"] {
    list-style-type: decimal
}

.radar-poc-result-inner ol ol,.radar-poc-result-inner ol ul,.radar-poc-result-inner ul ol,.radar-poc-result-inner ul ul {
    margin-top: 0;
    margin-bottom: 0
}

.radar-poc-result-inner li>p {
    margin-top: 16px
}

.radar-poc-result-inner li+li {
    margin-top: .25em
}

.radar-poc-result-inner dl {
    padding: 0
}

.radar-poc-result-inner dl dt {
    padding: 0;
    margin-top: 16px;
    font-size: 1em;
    font-style: italic;
    font-weight: var(--base-text-weight-semibold,600)
}

.radar-poc-result-inner dl dd {
    padding: 0 16px;
    margin-bottom: 16px
}

.radar-poc-result-inner table th {
    font-weight: var(--base-text-weight-semibold,600);
    white-space: nowrap
}

.radar-poc-result-inner table td,.radar-poc-result-inner table th {
    padding: 6px 13px;
    border: 1px solid var(--color-border-default)
}

.radar-poc-result-inner table tr {
    background-color: var(--color-canvas-default);
    border-top: 1px solid var(--color-border-muted)
}

.radar-poc-result-inner table tr:nth-child(2n) {
    background-color: var(--color-canvas-subtle)
}

.radar-poc-result-inner table img {
    background-color: transparent
}

.radar-poc-result-inner img[align=right] {
    padding-left: 20px
}

.radar-poc-result-inner img[align=left] {
    padding-right: 20px
}

.radar-poc-result-inner .emoji {
    max-width: none;
    vertical-align: text-top;
    background-color: transparent
}

.radar-poc-result-inner span.frame {
    display: block;
    overflow: hidden
}

.radar-poc-result-inner span.frame>span {
    display: block;
    float: left;
    width: auto;
    padding: 7px;
    margin: 13px 0 0;
    overflow: hidden;
    border: 1px solid var(--color-border-default)
}

.radar-poc-result-inner span.frame span img {
    display: block;
    float: left
}

.radar-poc-result-inner span.frame span span {
    display: block;
    padding: 5px 0 0;
    clear: both;
    color: var(--color-fg-default)
}

.radar-poc-result-inner span.align-center {
    display: block;
    overflow: hidden;
    clear: both
}

.radar-poc-result-inner span.align-center>span {
    display: block;
    margin: 13px auto 0;
    overflow: hidden;
    text-align: center
}

.radar-poc-result-inner span.align-center span img {
    margin: 0 auto;
    text-align: center
}

.radar-poc-result-inner span.align-right {
    display: block;
    overflow: hidden;
    clear: both
}

.radar-poc-result-inner span.align-right>span {
    display: block;
    margin: 13px 0 0;
    overflow: hidden;
    text-align: right
}

.radar-poc-result-inner span.align-right span img {
    margin: 0;
    text-align: right
}

.radar-poc-result-inner span.float-left {
    display: block;
    float: left;
    margin-right: 13px;
    overflow: hidden
}

.radar-poc-result-inner span.float-left span {
    margin: 13px 0 0
}

.radar-poc-result-inner span.float-right {
    display: block;
    float: right;
    margin-left: 13px;
    overflow: hidden
}

.radar-poc-result-inner span.float-right>span {
    display: block;
    margin: 13px auto 0;
    overflow: hidden;
    text-align: right
}

.radar-poc-result-inner code,.radar-poc-result-inner tt {
    padding: .2em .4em;
    margin: 0;
    font-size: 85%;
    white-space: break-spaces;
    background-color: var(--color-neutral-muted);
    border-radius: 6px
}

.radar-poc-result-inner code br,.radar-poc-result-inner tt br {
    display: none
}

.radar-poc-result-inner del code {
    text-decoration: inherit
}

.radar-poc-result-inner samp {
    font-size: 85%
}

.radar-poc-result-inner pre code {
    font-size: 100%;
    white-space: pre-wrap!important
}

.radar-poc-result-inner pre>code {
    padding: 0;
    margin: 0;
    word-break: normal;
    white-space: pre-wrap;
    background: transparent;
    border: 0
}

.radar-poc-result-inner .highlight {
    margin-bottom: 16px
}

.radar-poc-result-inner .highlight pre {
    margin-bottom: 0;
    word-break: normal
}

.radar-poc-result-inner .highlight pre,.radar-poc-result-inner pre {
    padding: 16px;
    background: #fff;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    border-radius: 6px
}

.radar-poc-result-inner pre {
    padding: 0
}

.radar-poc-result-inner pre code,.radar-poc-result-inner pre tt {
    display: inline-block;
    max-width: 100%;
    padding: 0;
    margin: 0;
    overflow-x: auto;
    line-height: inherit;
    word-wrap: normal;
    background-color: transparent;
    border: 0
}

.radar-poc-result-inner .csv-data td,.radar-poc-result-inner .csv-data th {
    padding: 5px;
    overflow: hidden;
    font-size: 12px;
    line-height: 1;
    text-align: left;
    white-space: nowrap
}

.radar-poc-result-inner .csv-data .blob-num {
    padding: 10px 8px 9px;
    text-align: right;
    background: var(--color-canvas-default);
    border: 0
}

.radar-poc-result-inner .csv-data tr {
    border-top: 0
}

.radar-poc-result-inner .csv-data th {
    font-weight: var(--base-text-weight-semibold,600);
    background: var(--color-canvas-subtle);
    border-top: 0
}

.radar-poc-result-inner [data-footnote-ref]:before {
    content: "["
}

.radar-poc-result-inner [data-footnote-ref]:after {
    content: "]"
}

.radar-poc-result-inner .footnotes {
    font-size: 12px;
    color: var(--color-fg-muted);
    border-top: 1px solid var(--color-border-default)
}

.radar-poc-result-inner .footnotes ol {
    padding-left: 16px
}

.radar-poc-result-inner .footnotes ol ul {
    display: inline-block;
    padding-left: 16px;
    margin-top: 16px
}

.radar-poc-result-inner .footnotes li {
    position: relative
}

.radar-poc-result-inner .footnotes li:target:before {
    position: absolute;
    top: -8px;
    right: -8px;
    bottom: -8px;
    left: -24px;
    pointer-events: none;
    content: "";
    border: 2px solid var(--color-accent-emphasis);
    border-radius: 6px
}

.radar-poc-result-inner .footnotes li:target {
    color: var(--color-fg-default)
}

.radar-poc-result-inner .footnotes .data-footnote-backref g-emoji {
    font-family: monospace
}

.radar-poc-result-inner .pl-c {
    color: var(--color-prettylights-syntax-comment)
}

.radar-poc-result-inner .pl-c1,.radar-poc-result-inner .pl-s .pl-v {
    color: var(--color-prettylights-syntax-constant)
}

.radar-poc-result-inner .pl-e,.radar-poc-result-inner .pl-en {
    color: var(--color-prettylights-syntax-entity)
}

.radar-poc-result-inner .pl-s .pl-s1,.radar-poc-result-inner .pl-smi {
    color: var(--color-prettylights-syntax-storage-modifier-import)
}

.radar-poc-result-inner .pl-ent {
    color: var(--color-prettylights-syntax-entity-tag)
}

.radar-poc-result-inner .pl-k {
    color: var(--color-prettylights-syntax-keyword)
}

.radar-poc-result-inner .pl-pds,.radar-poc-result-inner .pl-s,.radar-poc-result-inner .pl-s .pl-pse .pl-s1,.radar-poc-result-inner .pl-sr,.radar-poc-result-inner .pl-sr .pl-cce,.radar-poc-result-inner .pl-sr .pl-sra,.radar-poc-result-inner .pl-sr .pl-sre {
    color: var(--color-prettylights-syntax-string)
}

.radar-poc-result-inner .pl-smw,.radar-poc-result-inner .pl-v {
    color: var(--color-prettylights-syntax-variable)
}

.radar-poc-result-inner .pl-bu {
    color: var(--color-prettylights-syntax-brackethighlighter-unmatched)
}

.radar-poc-result-inner .pl-ii {
    color: var(--color-prettylights-syntax-invalid-illegal-text);
    background-color: var(--color-prettylights-syntax-invalid-illegal-bg)
}

.radar-poc-result-inner .pl-c2 {
    color: var(--color-prettylights-syntax-carriage-return-text);
    background-color: var(--color-prettylights-syntax-carriage-return-bg)
}

.radar-poc-result-inner .pl-sr .pl-cce {
    font-weight: 700;
    color: var(--color-prettylights-syntax-string-regexp)
}

.radar-poc-result-inner .pl-ml {
    color: var(--color-prettylights-syntax-markup-list)
}

.radar-poc-result-inner .pl-mh,.radar-poc-result-inner .pl-mh .pl-en,.radar-poc-result-inner .pl-ms {
    font-weight: 700;
    color: var(--color-prettylights-syntax-markup-heading)
}

.radar-poc-result-inner .pl-mi {
    font-style: italic;
    color: var(--color-prettylights-syntax-markup-italic)
}

.radar-poc-result-inner .pl-mb {
    font-weight: 700;
    color: var(--color-prettylights-syntax-markup-bold)
}

.radar-poc-result-inner .pl-md {
    color: var(--color-prettylights-syntax-markup-deleted-text);
    background-color: var(--color-prettylights-syntax-markup-deleted-bg)
}

.radar-poc-result-inner .pl-mi1 {
    color: var(--color-prettylights-syntax-markup-inserted-text);
    background-color: var(--color-prettylights-syntax-markup-inserted-bg)
}

.radar-poc-result-inner .pl-mc {
    color: var(--color-prettylights-syntax-markup-changed-text);
    background-color: var(--color-prettylights-syntax-markup-changed-bg)
}

.radar-poc-result-inner .pl-mi2 {
    color: var(--color-prettylights-syntax-markup-ignored-text);
    background-color: var(--color-prettylights-syntax-markup-ignored-bg)
}

.radar-poc-result-inner .pl-mdr {
    font-weight: 700;
    color: var(--color-prettylights-syntax-meta-diff-range)
}

.radar-poc-result-inner .pl-ba {
    color: var(--color-prettylights-syntax-brackethighlighter-angle)
}

.radar-poc-result-inner .pl-sg {
    color: var(--color-prettylights-syntax-sublimelinter-gutter-mark)
}

.radar-poc-result-inner .pl-corl {
    text-decoration: underline;
    color: var(--color-prettylights-syntax-constant-other-reference-link)
}

.radar-poc-result-inner g-emoji {
    display: inline-block;
    min-width: 1ch;
    font-family: Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;
    font-size: 1em;
    font-style: normal!important;
    font-weight: var(--base-text-weight-normal,400);
    line-height: 1;
    vertical-align: -.075em
}

.radar-poc-result-inner g-emoji img {
    width: 1em;
    height: 1em
}

.radar-poc-result-inner .task-list-item {
    list-style-type: none
}

.radar-poc-result-inner .task-list-item label {
    font-weight: var(--base-text-weight-normal,400)
}

.radar-poc-result-inner .task-list-item.enabled label {
    cursor: pointer
}

.radar-poc-result-inner .task-list-item+.task-list-item {
    margin-top: 4px
}

.radar-poc-result-inner .task-list-item .handle {
    display: none
}

.radar-poc-result-inner .task-list-item-checkbox {
    margin: 0 .2em .25em -1.4em;
    vertical-align: middle
}

.radar-poc-result-inner .contains-task-list:dir(rtl) .task-list-item-checkbox {
    margin: 0 -1.6em .25em .2em
}

.radar-poc-result-inner .contains-task-list {
    position: relative
}

.radar-poc-result-inner .contains-task-list:focus-within .task-list-item-convert-container,.radar-poc-result-inner .contains-task-list:hover .task-list-item-convert-container {
    display: block;
    width: auto;
    height: 24px;
    overflow: visible;
    clip: auto
}

.radar-poc-result-inner ::-webkit-calendar-picker-indicator {
    filter: invert(50%)
}

.radar-poc-result-inner .react-syntax-highlighter-line-number {
    color: #d0d5dd
}
`