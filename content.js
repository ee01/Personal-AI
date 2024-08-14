
/**
 * marked v14.0.0 - a markdown parser
 * Copyright (c) 2011-2024, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/markedjs/marked
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).marked={})}(this,(function(e){"use strict";function t(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}function n(t){e.defaults=t}e.defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};const s=/[&<>"']/,r=new RegExp(s.source,"g"),i=/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,l=new RegExp(i.source,"g"),o={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},a=e=>o[e];function c(e,t){if(t){if(s.test(e))return e.replace(r,a)}else if(i.test(e))return e.replace(l,a);return e}const h=/(^|[^\[])\^/g;function p(e,t){let n="string"==typeof e?e:e.source;t=t||"";const s={replace:(e,t)=>{let r="string"==typeof t?t:t.source;return r=r.replace(h,"$1"),n=n.replace(e,r),s},getRegex:()=>new RegExp(n,t)};return s}function u(e){try{e=encodeURI(e).replace(/%25/g,"%")}catch{return null}return e}const k={exec:()=>null};function g(e,t){const n=e.replace(/\|/g,((e,t,n)=>{let s=!1,r=t;for(;--r>=0&&"\\"===n[r];)s=!s;return s?"|":" |"})).split(/ \|/);let s=0;if(n[0].trim()||n.shift(),n.length>0&&!n[n.length-1].trim()&&n.pop(),t)if(n.length>t)n.splice(t);else for(;n.length<t;)n.push("");for(;s<n.length;s++)n[s]=n[s].trim().replace(/\\\|/g,"|");return n}function f(e,t,n){const s=e.length;if(0===s)return"";let r=0;for(;r<s;){const i=e.charAt(s-r-1);if(i!==t||n){if(i===t||!n)break;r++}else r++}return e.slice(0,s-r)}function d(e,t,n,s){const r=t.href,i=t.title?c(t.title):null,l=e[1].replace(/\\([\[\]])/g,"$1");if("!"!==e[0].charAt(0)){s.state.inLink=!0;const e={type:"link",raw:n,href:r,title:i,text:l,tokens:s.inlineTokens(l)};return s.state.inLink=!1,e}return{type:"image",raw:n,href:r,title:i,text:c(l)}}class x{options;rules;lexer;constructor(t){this.options=t||e.defaults}space(e){const t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){const t=this.rules.block.code.exec(e);if(t){const e=t[0].replace(/^ {1,4}/gm,"");return{type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?e:f(e,"\n")}}}fences(e){const t=this.rules.block.fences.exec(e);if(t){const e=t[0],n=function(e,t){const n=e.match(/^(\s+)(?:```)/);if(null===n)return t;const s=n[1];return t.split("\n").map((e=>{const t=e.match(/^\s+/);if(null===t)return e;const[n]=t;return n.length>=s.length?e.slice(s.length):e})).join("\n")}(e,t[3]||"");return{type:"code",raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:n}}}heading(e){const t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(/#$/.test(e)){const t=f(e,"#");this.options.pedantic?e=t.trim():t&&!/ $/.test(t)||(e=t.trim())}return{type:"heading",raw:t[0],depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){const t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:f(t[0],"\n")}}blockquote(e){const t=this.rules.block.blockquote.exec(e);if(t){let e=f(t[0],"\n").split("\n"),n="",s="";const r=[];for(;e.length>0;){let t=!1;const i=[];let l;for(l=0;l<e.length;l++)if(/^ {0,3}>/.test(e[l]))i.push(e[l]),t=!0;else{if(t)break;i.push(e[l])}e=e.slice(l);const o=i.join("\n"),a=o.replace(/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,"\n    $1").replace(/^ {0,3}>[ \t]?/gm,"");n=n?`${n}\n${o}`:o,s=s?`${s}\n${a}`:a;const c=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(a,r,!0),this.lexer.state.top=c,0===e.length)break;const h=r[r.length-1];if("code"===h?.type)break;if("blockquote"===h?.type){const t=h,i=t.raw+"\n"+e.join("\n"),l=this.blockquote(i);r[r.length-1]=l,n=n.substring(0,n.length-t.raw.length)+l.raw,s=s.substring(0,s.length-t.text.length)+l.text;break}if("list"!==h?.type);else{const t=h,i=t.raw+"\n"+e.join("\n"),l=this.list(i);r[r.length-1]=l,n=n.substring(0,n.length-h.raw.length)+l.raw,s=s.substring(0,s.length-t.raw.length)+l.raw,e=i.substring(r[r.length-1].raw.length).split("\n")}}return{type:"blockquote",raw:n,tokens:r,text:s}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim();const s=n.length>1,r={type:"list",raw:"",ordered:s,start:s?+n.slice(0,-1):"",loose:!1,items:[]};n=s?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=s?n:"[*+-]");const i=new RegExp(`^( {0,3}${n})((?:[\t ][^\\n]*)?(?:\\n|$))`);let l=!1;for(;e;){let n=!1,s="",o="";if(!(t=i.exec(e)))break;if(this.rules.block.hr.test(e))break;s=t[0],e=e.substring(s.length);let a=t[2].split("\n",1)[0].replace(/^\t+/,(e=>" ".repeat(3*e.length))),c=e.split("\n",1)[0],h=!a.trim(),p=0;if(this.options.pedantic?(p=2,o=a.trimStart()):h?p=t[1].length+1:(p=t[2].search(/[^ ]/),p=p>4?1:p,o=a.slice(p),p+=t[1].length),h&&/^ *$/.test(c)&&(s+=c+"\n",e=e.substring(c.length+1),n=!0),!n){const t=new RegExp(`^ {0,${Math.min(3,p-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`),n=new RegExp(`^ {0,${Math.min(3,p-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),r=new RegExp(`^ {0,${Math.min(3,p-1)}}(?:\`\`\`|~~~)`),i=new RegExp(`^ {0,${Math.min(3,p-1)}}#`);for(;e;){const l=e.split("\n",1)[0];if(c=l,this.options.pedantic&&(c=c.replace(/^ {1,4}(?=( {4})*[^ ])/g,"  ")),r.test(c))break;if(i.test(c))break;if(t.test(c))break;if(n.test(e))break;if(c.search(/[^ ]/)>=p||!c.trim())o+="\n"+c.slice(p);else{if(h)break;if(a.search(/[^ ]/)>=4)break;if(r.test(a))break;if(i.test(a))break;if(n.test(a))break;o+="\n"+c}h||c.trim()||(h=!0),s+=l+"\n",e=e.substring(l.length+1),a=c.slice(p)}}r.loose||(l?r.loose=!0:/\n *\n *$/.test(s)&&(l=!0));let u,k=null;this.options.gfm&&(k=/^\[[ xX]\] /.exec(o),k&&(u="[ ] "!==k[0],o=o.replace(/^\[[ xX]\] +/,""))),r.items.push({type:"list_item",raw:s,task:!!k,checked:u,loose:!1,text:o,tokens:[]}),r.raw+=s}r.items[r.items.length-1].raw=r.items[r.items.length-1].raw.trimEnd(),r.items[r.items.length-1].text=r.items[r.items.length-1].text.trimEnd(),r.raw=r.raw.trimEnd();for(let e=0;e<r.items.length;e++)if(this.lexer.state.top=!1,r.items[e].tokens=this.lexer.blockTokens(r.items[e].text,[]),!r.loose){const t=r.items[e].tokens.filter((e=>"space"===e.type)),n=t.length>0&&t.some((e=>/\n.*\n/.test(e.raw)));r.loose=n}if(r.loose)for(let e=0;e<r.items.length;e++)r.items[e].loose=!0;return r}}html(e){const t=this.rules.block.html.exec(e);if(t){return{type:"html",block:!0,raw:t[0],pre:"pre"===t[1]||"script"===t[1]||"style"===t[1],text:t[0]}}}def(e){const t=this.rules.block.def.exec(e);if(t){const e=t[1].toLowerCase().replace(/\s+/g," "),n=t[2]?t[2].replace(/^<(.*)>$/,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:e,raw:t[0],href:n,title:s}}}table(e){const t=this.rules.block.table.exec(e);if(!t)return;if(!/[:|]/.test(t[2]))return;const n=g(t[1]),s=t[2].replace(/^\||\| *$/g,"").split("|"),r=t[3]&&t[3].trim()?t[3].replace(/\n[ \t]*$/,"").split("\n"):[],i={type:"table",raw:t[0],header:[],align:[],rows:[]};if(n.length===s.length){for(const e of s)/^ *-+: *$/.test(e)?i.align.push("right"):/^ *:-+: *$/.test(e)?i.align.push("center"):/^ *:-+ *$/.test(e)?i.align.push("left"):i.align.push(null);for(let e=0;e<n.length;e++)i.header.push({text:n[e],tokens:this.lexer.inline(n[e]),header:!0,align:i.align[e]});for(const e of r)i.rows.push(g(e,i.header.length).map(((e,t)=>({text:e,tokens:this.lexer.inline(e),header:!1,align:i.align[t]}))));return i}}lheading(e){const t=this.rules.block.lheading.exec(e);if(t)return{type:"heading",raw:t[0],depth:"="===t[2].charAt(0)?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){const t=this.rules.block.paragraph.exec(e);if(t){const e="\n"===t[1].charAt(t[1].length-1)?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){const t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){const t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:c(t[1])}}tag(e){const t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&/^<a /i.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&/^<\/a>/i.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&/^<(pre|code|kbd|script)(\s|>)/i.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&/^<\/(pre|code|kbd|script)(\s|>)/i.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){const t=this.rules.inline.link.exec(e);if(t){const e=t[2].trim();if(!this.options.pedantic&&/^</.test(e)){if(!/>$/.test(e))return;const t=f(e.slice(0,-1),"\\");if((e.length-t.length)%2==0)return}else{const e=function(e,t){if(-1===e.indexOf(t[1]))return-1;let n=0;for(let s=0;s<e.length;s++)if("\\"===e[s])s++;else if(e[s]===t[0])n++;else if(e[s]===t[1]&&(n--,n<0))return s;return-1}(t[2],"()");if(e>-1){const n=(0===t[0].indexOf("!")?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=""}}let n=t[2],s="";if(this.options.pedantic){const e=/^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(n);e&&(n=e[1],s=e[3])}else s=t[3]?t[3].slice(1,-1):"";return n=n.trim(),/^</.test(n)&&(n=this.options.pedantic&&!/>$/.test(e)?n.slice(1):n.slice(1,-1)),d(t,{href:n?n.replace(this.rules.inline.anyPunctuation,"$1"):n,title:s?s.replace(this.rules.inline.anyPunctuation,"$1"):s},t[0],this.lexer)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){const e=t[(n[2]||n[1]).replace(/\s+/g," ").toLowerCase()];if(!e){const e=n[0].charAt(0);return{type:"text",raw:e,text:e}}return d(n,e,n[0],this.lexer)}}emStrong(e,t,n=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!s)return;if(s[3]&&n.match(/[\p{L}\p{N}]/u))return;if(!(s[1]||s[2]||"")||!n||this.rules.inline.punctuation.exec(n)){const n=[...s[0]].length-1;let r,i,l=n,o=0;const a="*"===s[0][0]?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(a.lastIndex=0,t=t.slice(-1*e.length+n);null!=(s=a.exec(t));){if(r=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!r)continue;if(i=[...r].length,s[3]||s[4]){l+=i;continue}if((s[5]||s[6])&&n%3&&!((n+i)%3)){o+=i;continue}if(l-=i,l>0)continue;i=Math.min(i,i+l+o);const t=[...s[0]][0].length,a=e.slice(0,n+s.index+t+i);if(Math.min(n,i)%2){const e=a.slice(1,-1);return{type:"em",raw:a,text:e,tokens:this.lexer.inlineTokens(e)}}const c=a.slice(2,-2);return{type:"strong",raw:a,text:c,tokens:this.lexer.inlineTokens(c)}}}}codespan(e){const t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(/\n/g," ");const n=/[^ ]/.test(e),s=/^ /.test(e)&&/ $/.test(e);return n&&s&&(e=e.substring(1,e.length-1)),e=c(e,!0),{type:"codespan",raw:t[0],text:e}}}br(e){const t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e){const t=this.rules.inline.del.exec(e);if(t)return{type:"del",raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){const t=this.rules.inline.autolink.exec(e);if(t){let e,n;return"@"===t[2]?(e=c(t[1]),n="mailto:"+e):(e=c(t[1]),n=e),{type:"link",raw:t[0],text:e,href:n,tokens:[{type:"text",raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if("@"===t[2])e=c(t[0]),n="mailto:"+e;else{let s;do{s=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??""}while(s!==t[0]);e=c(t[0]),n="www."===t[1]?"http://"+t[0]:t[0]}return{type:"link",raw:t[0],text:e,href:n,tokens:[{type:"text",raw:e,text:e}]}}}inlineText(e){const t=this.rules.inline.text.exec(e);if(t){let e;return e=this.lexer.state.inRawBlock?t[0]:c(t[0]),{type:"text",raw:t[0],text:e}}}}const b=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,w=/(?:[*+-]|\d{1,9}[.)])/,m=p(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g,w).replace(/blockCode/g,/ {4}/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).getRegex(),y=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,$=/(?!\s*\])(?:\\.|[^\[\]\\])+/,z=p(/^ {0,3}\[(label)\]: *(?:\n *)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n *)?| *\n *)(title))? *(?:\n+|$)/).replace("label",$).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),T=p(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,w).getRegex(),R="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",_=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,A=p("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n *)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$))","i").replace("comment",_).replace("tag",R).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),S=p(y).replace("hr",b).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",R).getRegex(),I={blockquote:p(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",S).getRegex(),code:/^( {4}[^\n]+(?:\n(?: *(?:\n|$))*)?)+/,def:z,fences:/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,heading:/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,hr:b,html:A,lheading:m,list:T,newline:/^(?: *(?:\n|$))+/,paragraph:S,table:k,text:/^[^\n]+/},E=p("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",b).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code"," {4}[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",R).getRegex(),q={...I,table:E,paragraph:p(y).replace("hr",b).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",E).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",R).getRegex()},Z={...I,html:p("^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:\"[^\"]*\"|'[^']*'|\\s[^'\"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))").replace("comment",_).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:k,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:p(y).replace("hr",b).replace("heading"," *#{1,6} *[^\n]").replace("lheading",m).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},P=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,L=/^( {2,}|\\)\n(?!\s*$)/,Q="\\p{P}\\p{S}",v=p(/^((?![*_])[\spunctuation])/,"u").replace(/punctuation/g,Q).getRegex(),B=p(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/,"u").replace(/punct/g,Q).getRegex(),M=p("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])","gu").replace(/punct/g,Q).getRegex(),O=p("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])","gu").replace(/punct/g,Q).getRegex(),j=p(/\\([punct])/,"gu").replace(/punct/g,Q).getRegex(),D=p(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),C=p(_).replace("(?:--\x3e|$)","--\x3e").getRegex(),H=p("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",C).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),U=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,X=p(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label",U).replace("href",/<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),F=p(/^!?\[(label)\]\[(ref)\]/).replace("label",U).replace("ref",$).getRegex(),N=p(/^!?\[(ref)\](?:\[\])?/).replace("ref",$).getRegex(),G={_backpedal:k,anyPunctuation:j,autolink:D,blockSkip:/\[[^[\]]*?\]\([^\(\)]*?\)|`[^`]*?`|<[^<>]*?>/g,br:L,code:/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,del:k,emStrongLDelim:B,emStrongRDelimAst:M,emStrongRDelimUnd:O,escape:P,link:X,nolink:N,punctuation:v,reflink:F,reflinkSearch:p("reflink|nolink(?!\\()","g").replace("reflink",F).replace("nolink",N).getRegex(),tag:H,text:/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,url:k},J={...G,link:p(/^!?\[(label)\]\((.*?)\)/).replace("label",U).getRegex(),reflink:p(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",U).getRegex()},K={...G,escape:p(P).replace("])","~|])").getRegex(),url:p(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])([\s\S]*?[^\s~])\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},V={...K,br:p(L).replace("{2,}","*").getRegex(),text:p(K.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},W={normal:I,gfm:q,pedantic:Z},Y={normal:G,gfm:K,breaks:V,pedantic:J};class ee{tokens;options;state;tokenizer;inlineQueue;constructor(t){this.tokens=[],this.tokens.links=Object.create(null),this.options=t||e.defaults,this.options.tokenizer=this.options.tokenizer||new x,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};const n={block:W.normal,inline:Y.normal};this.options.pedantic?(n.block=W.pedantic,n.inline=Y.pedantic):this.options.gfm&&(n.block=W.gfm,this.options.breaks?n.inline=Y.breaks:n.inline=Y.gfm),this.tokenizer.rules=n}static get rules(){return{block:W,inline:Y}}static lex(e,t){return new ee(t).lex(e)}static lexInline(e,t){return new ee(t).inlineTokens(e)}lex(e){e=e.replace(/\r\n|\r/g,"\n"),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){const t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=!1){let s,r,i;for(e=this.options.pedantic?e.replace(/\t/g,"    ").replace(/^ +$/gm,""):e.replace(/^( *)(\t+)/gm,((e,t,n)=>t+"    ".repeat(n.length)));e;)if(!(this.options.extensions&&this.options.extensions.block&&this.options.extensions.block.some((n=>!!(s=n.call({lexer:this},e,t))&&(e=e.substring(s.raw.length),t.push(s),!0)))))if(s=this.tokenizer.space(e))e=e.substring(s.raw.length),1===s.raw.length&&t.length>0?t[t.length-1].raw+="\n":t.push(s);else if(s=this.tokenizer.code(e))e=e.substring(s.raw.length),r=t[t.length-1],!r||"paragraph"!==r.type&&"text"!==r.type?t.push(s):(r.raw+="\n"+s.raw,r.text+="\n"+s.text,this.inlineQueue[this.inlineQueue.length-1].src=r.text);else if(s=this.tokenizer.fences(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.heading(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.hr(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.blockquote(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.list(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.html(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.def(e))e=e.substring(s.raw.length),r=t[t.length-1],!r||"paragraph"!==r.type&&"text"!==r.type?this.tokens.links[s.tag]||(this.tokens.links[s.tag]={href:s.href,title:s.title}):(r.raw+="\n"+s.raw,r.text+="\n"+s.raw,this.inlineQueue[this.inlineQueue.length-1].src=r.text);else if(s=this.tokenizer.table(e))e=e.substring(s.raw.length),t.push(s);else if(s=this.tokenizer.lheading(e))e=e.substring(s.raw.length),t.push(s);else{if(i=e,this.options.extensions&&this.options.extensions.startBlock){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startBlock.forEach((e=>{s=e.call({lexer:this},n),"number"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(i=e.substring(0,t+1))}if(this.state.top&&(s=this.tokenizer.paragraph(i)))r=t[t.length-1],n&&"paragraph"===r?.type?(r.raw+="\n"+s.raw,r.text+="\n"+s.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=r.text):t.push(s),n=i.length!==e.length,e=e.substring(s.raw.length);else if(s=this.tokenizer.text(e))e=e.substring(s.raw.length),r=t[t.length-1],r&&"text"===r.type?(r.raw+="\n"+s.raw,r.text+="\n"+s.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=r.text):t.push(s);else if(e){const t="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n,s,r,i,l,o,a=e;if(this.tokens.links){const e=Object.keys(this.tokens.links);if(e.length>0)for(;null!=(i=this.tokenizer.rules.inline.reflinkSearch.exec(a));)e.includes(i[0].slice(i[0].lastIndexOf("[")+1,-1))&&(a=a.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+a.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;null!=(i=this.tokenizer.rules.inline.blockSkip.exec(a));)a=a.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+a.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);for(;null!=(i=this.tokenizer.rules.inline.anyPunctuation.exec(a));)a=a.slice(0,i.index)+"++"+a.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;e;)if(l||(o=""),l=!1,!(this.options.extensions&&this.options.extensions.inline&&this.options.extensions.inline.some((s=>!!(n=s.call({lexer:this},e,t))&&(e=e.substring(n.raw.length),t.push(n),!0)))))if(n=this.tokenizer.escape(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.tag(e))e=e.substring(n.raw.length),s=t[t.length-1],s&&"text"===n.type&&"text"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(n=this.tokenizer.link(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.reflink(e,this.tokens.links))e=e.substring(n.raw.length),s=t[t.length-1],s&&"text"===n.type&&"text"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(n=this.tokenizer.emStrong(e,a,o))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.codespan(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.br(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.del(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.autolink(e))e=e.substring(n.raw.length),t.push(n);else if(this.state.inLink||!(n=this.tokenizer.url(e))){if(r=e,this.options.extensions&&this.options.extensions.startInline){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startInline.forEach((e=>{s=e.call({lexer:this},n),"number"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(r=e.substring(0,t+1))}if(n=this.tokenizer.inlineText(r))e=e.substring(n.raw.length),"_"!==n.raw.slice(-1)&&(o=n.raw.slice(-1)),l=!0,s=t[t.length-1],s&&"text"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(e){const t="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}else e=e.substring(n.raw.length),t.push(n);return t}}class te{options;parser;constructor(t){this.options=t||e.defaults}space(e){return""}code({text:e,lang:t,escaped:n}){const s=(t||"").match(/^\S*/)?.[0],r=e.replace(/\n$/,"")+"\n";return s?'<pre><code class="language-'+c(s)+'">'+(n?r:c(r,!0))+"</code></pre>\n":"<pre><code>"+(n?r:c(r,!0))+"</code></pre>\n"}blockquote({tokens:e}){return`<blockquote>\n${this.parser.parse(e)}</blockquote>\n`}html({text:e}){return e}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>\n`}hr(e){return"<hr>\n"}list(e){const t=e.ordered,n=e.start;let s="";for(let t=0;t<e.items.length;t++){const n=e.items[t];s+=this.listitem(n)}const r=t?"ol":"ul";return"<"+r+(t&&1!==n?' start="'+n+'"':"")+">\n"+s+"</"+r+">\n"}listitem(e){let t="";if(e.task){const n=this.checkbox({checked:!!e.checked});e.loose?e.tokens.length>0&&"paragraph"===e.tokens[0].type?(e.tokens[0].text=n+" "+e.tokens[0].text,e.tokens[0].tokens&&e.tokens[0].tokens.length>0&&"text"===e.tokens[0].tokens[0].type&&(e.tokens[0].tokens[0].text=n+" "+e.tokens[0].tokens[0].text)):e.tokens.unshift({type:"text",raw:n+" ",text:n+" "}):t+=n+" "}return t+=this.parser.parse(e.tokens,!!e.loose),`<li>${t}</li>\n`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>\n`}table(e){let t="",n="";for(let t=0;t<e.header.length;t++)n+=this.tablecell(e.header[t]);t+=this.tablerow({text:n});let s="";for(let t=0;t<e.rows.length;t++){const r=e.rows[t];n="";for(let e=0;e<r.length;e++)n+=this.tablecell(r[e]);s+=this.tablerow({text:n})}return s&&(s=`<tbody>${s}</tbody>`),"<table>\n<thead>\n"+t+"</thead>\n"+s+"</table>\n"}tablerow({text:e}){return`<tr>\n${e}</tr>\n`}tablecell(e){const t=this.parser.parseInline(e.tokens),n=e.header?"th":"td";return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>\n`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${e}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){const s=this.parser.parseInline(n),r=u(e);if(null===r)return s;let i='<a href="'+(e=r)+'"';return t&&(i+=' title="'+t+'"'),i+=">"+s+"</a>",i}image({href:e,title:t,text:n}){const s=u(e);if(null===s)return n;let r=`<img src="${e=s}" alt="${n}"`;return t&&(r+=` title="${t}"`),r+=">",r}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):e.text}}class ne{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}}class se{options;renderer;textRenderer;constructor(t){this.options=t||e.defaults,this.options.renderer=this.options.renderer||new te,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new ne}static parse(e,t){return new se(t).parse(e)}static parseInline(e,t){return new se(t).parseInline(e)}parse(e,t=!0){let n="";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[r.type]){const e=r,t=this.options.extensions.renderers[e.type].call({parser:this},e);if(!1!==t||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(e.type)){n+=t||"";continue}}const i=r;switch(i.type){case"space":n+=this.renderer.space(i);continue;case"hr":n+=this.renderer.hr(i);continue;case"heading":n+=this.renderer.heading(i);continue;case"code":n+=this.renderer.code(i);continue;case"table":n+=this.renderer.table(i);continue;case"blockquote":n+=this.renderer.blockquote(i);continue;case"list":n+=this.renderer.list(i);continue;case"html":n+=this.renderer.html(i);continue;case"paragraph":n+=this.renderer.paragraph(i);continue;case"text":{let r=i,l=this.renderer.text(r);for(;s+1<e.length&&"text"===e[s+1].type;)r=e[++s],l+="\n"+this.renderer.text(r);n+=t?this.renderer.paragraph({type:"paragraph",raw:l,text:l,tokens:[{type:"text",raw:l,text:l}]}):l;continue}default:{const e='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(e),"";throw new Error(e)}}}return n}parseInline(e,t){t=t||this.renderer;let n="";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[r.type]){const e=this.options.extensions.renderers[r.type].call({parser:this},r);if(!1!==e||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(r.type)){n+=e||"";continue}}const i=r;switch(i.type){case"escape":case"text":n+=t.text(i);break;case"html":n+=t.html(i);break;case"link":n+=t.link(i);break;case"image":n+=t.image(i);break;case"strong":n+=t.strong(i);break;case"em":n+=t.em(i);break;case"codespan":n+=t.codespan(i);break;case"br":n+=t.br(i);break;case"del":n+=t.del(i);break;default:{const e='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(e),"";throw new Error(e)}}}return n}}class re{options;constructor(t){this.options=t||e.defaults}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}}class ie{defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};options=this.setOptions;parse=this.parseMarkdown(ee.lex,se.parse);parseInline=this.parseMarkdown(ee.lexInline,se.parseInline);Parser=se;Renderer=te;TextRenderer=ne;Lexer=ee;Tokenizer=x;Hooks=re;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(const s of e)switch(n=n.concat(t.call(this,s)),s.type){case"table":{const e=s;for(const s of e.header)n=n.concat(this.walkTokens(s.tokens,t));for(const s of e.rows)for(const e of s)n=n.concat(this.walkTokens(e.tokens,t));break}case"list":{const e=s;n=n.concat(this.walkTokens(e.items,t));break}default:{const e=s;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach((s=>{const r=e[s].flat(1/0);n=n.concat(this.walkTokens(r,t))})):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){const t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach((e=>{const n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach((e=>{if(!e.name)throw new Error("extension name required");if("renderer"in e){const n=t.renderers[e.name];t.renderers[e.name]=n?function(...t){let s=e.renderer.apply(this,t);return!1===s&&(s=n.apply(this,t)),s}:e.renderer}if("tokenizer"in e){if(!e.level||"block"!==e.level&&"inline"!==e.level)throw new Error("extension level must be 'block' or 'inline'");const n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&("block"===e.level?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:"inline"===e.level&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}"childTokens"in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)})),n.extensions=t),e.renderer){const t=this.defaults.renderer||new te(this.defaults);for(const n in e.renderer){if(!(n in t))throw new Error(`renderer '${n}' does not exist`);if(["options","parser"].includes(n))continue;const s=n,r=e.renderer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n||""}}n.renderer=t}if(e.tokenizer){const t=this.defaults.tokenizer||new x(this.defaults);for(const n in e.tokenizer){if(!(n in t))throw new Error(`tokenizer '${n}' does not exist`);if(["options","rules","lexer"].includes(n))continue;const s=n,r=e.tokenizer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){const t=this.defaults.hooks||new re;for(const n in e.hooks){if(!(n in t))throw new Error(`hook '${n}' does not exist`);if("options"===n)continue;const s=n,r=e.hooks[s],i=t[s];re.passThroughHooks.has(n)?t[s]=e=>{if(this.defaults.async)return Promise.resolve(r.call(t,e)).then((e=>i.call(t,e)));const n=r.call(t,e);return i.call(t,n)}:t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){const t=this.defaults.walkTokens,s=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(s.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}})),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return ee.lex(e,t??this.defaults)}parser(e,t){return se.parse(e,t??this.defaults)}parseMarkdown(e,t){return(n,s)=>{const r={...s},i={...this.defaults,...r},l=this.onError(!!i.silent,!!i.async);if(!0===this.defaults.async&&!1===r.async)return l(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(null==n)return l(new Error("marked(): input parameter is undefined or null"));if("string"!=typeof n)return l(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(n)+", string expected"));if(i.hooks&&(i.hooks.options=i),i.async)return Promise.resolve(i.hooks?i.hooks.preprocess(n):n).then((t=>e(t,i))).then((e=>i.hooks?i.hooks.processAllTokens(e):e)).then((e=>i.walkTokens?Promise.all(this.walkTokens(e,i.walkTokens)).then((()=>e)):e)).then((e=>t(e,i))).then((e=>i.hooks?i.hooks.postprocess(e):e)).catch(l);try{i.hooks&&(n=i.hooks.preprocess(n));let s=e(n,i);i.hooks&&(s=i.hooks.processAllTokens(s)),i.walkTokens&&this.walkTokens(s,i.walkTokens);let r=t(s,i);return i.hooks&&(r=i.hooks.postprocess(r)),r}catch(e){return l(e)}}}onError(e,t){return n=>{if(n.message+="\nPlease report this to https://github.com/markedjs/marked.",e){const e="<p>An error occurred:</p><pre>"+c(n.message+"",!0)+"</pre>";return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}}const le=new ie;function oe(e,t){return le.parse(e,t)}oe.options=oe.setOptions=function(e){return le.setOptions(e),oe.defaults=le.defaults,n(oe.defaults),oe},oe.getDefaults=t,oe.defaults=e.defaults,oe.use=function(...e){return le.use(...e),oe.defaults=le.defaults,n(oe.defaults),oe},oe.walkTokens=function(e,t){return le.walkTokens(e,t)},oe.parseInline=le.parseInline,oe.Parser=se,oe.parser=se.parse,oe.Renderer=te,oe.TextRenderer=ne,oe.Lexer=ee,oe.lexer=ee.lex,oe.Tokenizer=x,oe.Hooks=re,oe.parse=oe;const ae=oe.options,ce=oe.setOptions,he=oe.use,pe=oe.walkTokens,ue=oe.parseInline,ke=oe,ge=se.parse,fe=ee.lex;e.Hooks=re,e.Lexer=ee,e.Marked=ie,e.Parser=se,e.Renderer=te,e.TextRenderer=ne,e.Tokenizer=x,e.getDefaults=t,e.lexer=fe,e.marked=oe,e.options=ae,e.parse=ke,e.parseInline=ue,e.parser=ge,e.setOptions=ce,e.use=he,e.walkTokens=pe}));

function getIndexedDBData(databaseName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);

    request.onsuccess = (event) => {
      console.log(`IndexedDB '${databaseName}' opened successfully`);
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const dataRequest = objectStore.getAll();

      dataRequest.onsuccess = (event) => {
        console.log(`Data fetched successfully from store ${storeName}`);
        resolve(event.target.result);
      };

      dataRequest.onerror = (event) => {
        console.error(`Error fetching data from store '${storeName}':`, event.target.error);
        reject(event.target.error);
      };
    };

    request.onerror = (event) => {
      console.error(`Error opening IndexedDB '${databaseName}':`, event.target.error);
      reject(event.target.error);
    };
  });
}

function fetchAllMessageData() {
  return Promise.all([
    getIndexedDBData('Glip', 'group'),
    getIndexedDBData('Glip', 'person'),
    getIndexedDBData('Glip', 'post'),
    getIndexedDBData('Glip', 'replyPost')
  ])
  .then(([groupData, personData, postData, replyPostData]) => ({
    group: groupData,
    person: personData,
    post: postData,
    replyPost: replyPostData
  }))
  .catch(error => {
    console.error("Error fetchAllMessageData:", error);
    throw error;
  });
}

function fetchAllPhoneData(enableSms, enableVoicemail, enableCallTranscript) {
  const promises = [];
  if (enableSms) {
    promises.push(getIndexedDBData('SMS', 'sms'));
  }
  if (enableVoicemail) {
    promises.push(getIndexedDBData('Voicemail', 'voicemail'));
  }
  if (enableCallTranscript) {
    promises.push(getIndexedDBData('CaptionsTranscripts', 'callTranscript'));
    promises.push(getIndexedDBData('CallLog', 'callLog'));
  }

  return Promise.all(promises)
    .then(results => {
      const [sms, voicemail, callTranscript, callLog] = [
        enableSms ? results.shift() : [],
        enableVoicemail ? results.shift() : [],
        enableCallTranscript ? results.shift() : [],
        enableCallTranscript ? results.shift() : []
      ];

      return {
        sms,
        voicemail,
        callTranscript,
        callLog
      };
    })
    .catch(error => {
      console.error("Error fetchAllPhoneData:", error);
      throw error;
    });
}


function transformData2Group(data) {
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.groupId]) {
      acc[item.groupId] = {
        groupId: item.groupId,
        groupName: item.groupName,
        text: '',
        groupType: 'team',
        time: '' // 初始化 time 字段
      };
    }
    acc[item.groupId].text += item.parentId ? `[postId:${item.id}][threadId:${item.parentId}][${item.time}][${item.creator}]: ${item.text}\n` : `[postId:${item.id}][${item.time}][${item.creator}]: ${item.text}\n`;

    acc[item.groupId].time = item.time; // 更新 time 为当前项的时间
    acc[item.groupId].groupType = item.groupType;
    return acc;
  }, {});

  return Object.values(groupedData);
};

function getDirectUserNameByGroupName(groupName) {
  // "jenny.cai+spike.yang"; => "jenny.cai"
  const regex = /^[^+]+/;
  const match = groupName.match(regex);
  const result = match ? match[0] : '';
  return result;
}

function TransformMessagePosts(enableMessage, startTime, groupPost, selectGroupNames, ignoreGroupNames) {
  if (!enableMessage) {
    return Promise.resolve([]);
  }

  const transformMessagePosts = (input, persons, groups) => {
    const personsMap = persons.reduce((acc, person) => {
        acc[person.id] = `${person.first_name} ${person.last_name}`;
        return acc;
    }, {});
    const groupsMap = groups.reduce((acc, group) => {
        acc[group.id] = {
            id: group.id,
            name: group.set_abbreviation,
            is_team: group.is_team
        };
        return acc;
    }, {});

    const filteredPosts = input.filter(post => post.text !== '');

    // 转换数据结构
    const transformedData = filteredPosts.map(post => ({
        id: post.id, // 使用 unique_id 作为 id
        parentId: post.parent_post_id, // 使用 parent_id 作为 parentId
        groupName: groupsMap[post.group_id].name, // 使用 group_id 作为 group_name
        groupType: groupsMap[post.group_id].is_team ? 'team' : 'direct message', // 使用 group_id 作为 group_type
        groupId: post.group_id, // 使用 group_id 作为 group_id
        type: 'message', // 固定为 message
        text: post.text, // 使用原始文本
        creator: personsMap[post.creator_id] || '',
        time: new Date(post.created_at)
    })).filter(item => item.text !== '' && item.creator !== '');

    // 按时间排序
    transformedData.sort((a, b) => new Date(a.time) - new Date(b.time));

    return transformedData;
  };

  return fetchAllMessageData()
  .then((glipData) => {
      const post = glipData.post.concat(glipData.replyPost);
      const transformedData = transformMessagePosts(post, glipData.person, glipData.group)
      .filter(item => new Date(item.time) >= new Date(startTime))
      .filter(item => {
        const groupName = item.groupName;

        const isGroupSelected = selectGroupNames.length === 0 || selectGroupNames.includes(groupName);
        // const isDirectMessageSelected = selectDirectMessageNames.length === 0 || selectDirectMessageNames.includes(getDirectUserNameByGroupName(groupName));
        const isGroupIgnored = ignoreGroupNames.length > 0 && ignoreGroupNames.includes(groupName);

        return isGroupSelected && !isGroupIgnored;
      });

      return groupPost ? transformData2Group(transformedData) : transformedData;
  })
  .catch((error) => {
      console.error('Error processing files:', error);
  });
}

const transformSMS = (input) => {
  return input.map(item => ({
    id: item.id.toString(), // 将ID转换为字符串形式
    type: "sms", // 确保类型为小写
    text: item.subject || '', // 如果没有主题，则使用空字符串
    from: item.from ? (item.from.name || item.from.phoneNumber) : 'unknown', // 如果没有用户名，设置为'unknown'
    to: item.to ? item.to.map(recipient => recipient.name || recipient.phoneNumber || 'unknown  ') : ['unknown'], // 如果没有用户名，设置为'unknown'
    readStatus: item.readStatus, // 读取状态, 已读未读
    time: new Date(item.__timestamp), // 使用输入中的时间戳
  })).filter(item => item.text !== '');
};

const transformCall = (transcripts, logs) => {
  // 按 telephonySessionId 分组 transcripts
  const groupedTranscripts = transcripts.reduce((acc, curr) => {
    if (!acc[curr.telephonySessionId]) {
      acc[curr.telephonySessionId] = [];
    }
    acc[curr.telephonySessionId].push(curr);
    return acc;
  }, {});

  // 按 telephonySessionId 分组 logs
  const groupedLogs = logs.reduce((acc, curr) => {
    if (!acc[curr.telephonySessionId]) {
      acc[curr.telephonySessionId] = [];
    }
    acc[curr.telephonySessionId].push(curr);
    return acc;
  }, {});

  // 转换数据
  const transformedData = Object.entries(groupedTranscripts).map(([sessionId, sessionTranscripts]) => {
    // 按时间排序
    sessionTranscripts.sort((a, b) => a.startTimeMs - b.startTimeMs);

    const text = transcripts
    .filter(t => !t.text.includes('transcription on'))
    .map(t => `[${new Date(t.startTimeMs)}][${t.participant.name}]: ${t.text}`).join('\n');


    // 使用最后一个记录的时间作为endTime
    const endTime = new Date(sessionTranscripts[sessionTranscripts.length - 1].startTimeMs);

    // 查找对应的 log 信息
    const sessionLog = groupedLogs[sessionId] ? groupedLogs[sessionId][0] : {};

    return {
      id: sessionId,
      type: 'callTranscript',
      text: text,
      time: endTime,
      from: sessionLog.from ? sessionLog.from.name : 'unknown',
      to: sessionLog.to ? sessionLog.to.name : 'unknown'
    };
  });

  return transformedData;
};

const transformVoicemail = (input) => {
  return input.map(item => ({
    id: item.id.toString(), // 将ID转换为字符串形式
    type: "voicemail", // 确保类型为小写
    text: item.transcription || '', // 如果没有主题，则使用空字符串
    from: item.from ? (item.from.name || item.from.phoneNumber) : 'unknown', // 如果没有用户名，设置为'unknown'
    to: item.to ? item.to.map(recipient => recipient.name || recipient.phoneNumber || 'unknown  ') : ['unknown'], // 如果没有用户名，设置为'unknown'
    readStatus: item.readStatus, // 读取状态, 已读未读
    time: new Date(item.__timestamp), // 使用输入中的时间戳
  })).filter(item => item.text !== '');
};

const TransformPhone = (startTime, enableSms,enableVoicemail,enableCallTranscript) => {
  return fetchAllPhoneData(enableSms,enableVoicemail,enableCallTranscript).then((inputData) => {
    const sms = transformSMS(inputData.sms).filter(item => new Date(item.time) >= new Date(startTime));
    const voicemail = transformVoicemail(inputData.voicemail).filter(item => new Date(item.time) >= new Date(startTime));
    const callTranscript = transformCall(inputData.callTranscript, inputData.callLog).filter(item => new Date(item.time) >= new Date(startTime));

    return sms.concat(voicemail).concat(callTranscript);
  });
}

function insertMarkdownCss(styles) {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  return styleSheet;
}

// 示例使用
const cssStyles = `
.radar-poc-result {
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
    user-select: text
}

.light,:root {
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
}

@media(prefers-color-scheme: light) {
    :root {
        color-scheme:light;
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
    }
}

.radar-poc-result h1:hover .anchor .octicon-link:before,.radar-poc-result h2:hover .anchor .octicon-link:before,.radar-poc-result h3:hover .anchor .octicon-link:before,.radar-poc-result h4:hover .anchor .octicon-link:before,.radar-poc-result h5:hover .anchor .octicon-link:before,.radar-poc-result h6:hover .anchor .octicon-link:before {
    width: 16px;
    height: 16px;
    content: " ";
    display: inline-block;
    background-color: currentColor;
    -webkit-mask-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' version='1.1' aria-hidden='true'><path fill-rule='evenodd' d='M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z'></path></svg>");
    mask-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' version='1.1' aria-hidden='true'><path fill-rule='evenodd' d='M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z'></path></svg>")
}

.radar-poc-result details,.radar-poc-result figcaption,.radar-poc-result figure {
    display: block
}

.radar-poc-result summary {
    display: list-item
}

.radar-poc-result [hidden] {
    display: none!important
}

.radar-poc-result a {
    background-color: transparent;
    color: #155eef;
    text-decoration: none
}

.radar-poc-result abbr[title] {
    border-bottom: none;
    -webkit-text-decoration: underline dotted;
    text-decoration: underline dotted
}

.radar-poc-result b,.radar-poc-result strong {
    font-weight: var(--base-text-weight-semibold,600)
}

.radar-poc-result dfn {
    font-style: italic
}

.radar-poc-result mark {
    background-color: var(--color-attention-subtle);
    color: var(--color-fg-default)
}

.radar-poc-result small {
    font-size: 90%
}

.radar-poc-result sub,.radar-poc-result sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline
}

.radar-poc-result sub {
    bottom: -.25em
}

.radar-poc-result sup {
    top: -.5em
}

.radar-poc-result img {
    border-style: none;
    max-width: 100%;
    box-sizing: content-box;
    background-color: var(--color-canvas-default)
}

.radar-poc-result code,.radar-poc-result kbd,.radar-poc-result pre,.radar-poc-result samp {
    font-family: monospace;
    font-size: 1em
}

.radar-poc-result figure {
    margin: 1em 40px
}

.radar-poc-result hr {
    box-sizing: content-box;
    overflow: hidden;
    background: transparent;
    height: .25em;
    padding: 0;
    margin: 24px 0;
    background-color: var(--color-border-default);
    border: 0
}

.radar-poc-result input {
    font: inherit;
    margin: 0;
    overflow: visible;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit
}

.radar-poc-result [type=button],.radar-poc-result [type=reset],.radar-poc-result [type=submit] {
    -webkit-appearance: button
}

.radar-poc-result [type=checkbox],.radar-poc-result [type=radio] {
    box-sizing: border-box;
    padding: 0
}

.radar-poc-result [type=number]::-webkit-inner-spin-button,.radar-poc-result [type=number]::-webkit-outer-spin-button {
    height: auto
}

.radar-poc-result [type=search]::-webkit-search-cancel-button,.radar-poc-result [type=search]::-webkit-search-decoration {
    -webkit-appearance: none
}

.radar-poc-result ::-webkit-input-placeholder {
    color: inherit;
    opacity: .54
}

.radar-poc-result ::-webkit-file-upload-button {
    -webkit-appearance: button;
    font: inherit
}

.radar-poc-result a:hover {
    text-decoration: underline
}

.radar-poc-result ::-moz-placeholder {
    color: var(--color-fg-subtle);
    opacity: 1
}

.radar-poc-result ::placeholder {
    color: var(--color-fg-subtle);
    opacity: 1
}

.radar-poc-result hr:after,.radar-poc-result hr:before {
    display: table;
    content: ""
}

.radar-poc-result hr:after {
    clear: both
}

.radar-poc-result table {
    border-spacing: 0;
    border-collapse: collapse;
    display: block;
    width: -moz-max-content;
    width: max-content;
    max-width: 100%;
    overflow: auto
}

.radar-poc-result td,.radar-poc-result th {
    padding: 0
}

.radar-poc-result details summary {
    cursor: pointer
}

.radar-poc-result details:not([open])>:not(summary) {
    display: none!important
}

.radar-poc-result [role=button]:focus,.radar-poc-result a:focus,.radar-poc-result input[type=checkbox]:focus,.radar-poc-result input[type=radio]:focus {
    outline: 2px solid var(--color-accent-fg);
    outline-offset: -2px;
    box-shadow: none
}

.radar-poc-result [role=button]:focus:not(:focus-visible),.radar-poc-result a:focus:not(:focus-visible),.radar-poc-result input[type=checkbox]:focus:not(:focus-visible),.radar-poc-result input[type=radio]:focus:not(:focus-visible) {
    outline: 1px solid transparent
}

.radar-poc-result [role=button]:focus-visible,.radar-poc-result a:focus-visible,.radar-poc-result input[type=checkbox]:focus-visible,.radar-poc-result input[type=radio]:focus-visible {
    outline: 2px solid var(--color-accent-fg);
    outline-offset: -2px;
    box-shadow: none
}

.radar-poc-result a:not([class]):focus,.radar-poc-result a:not([class]):focus-visible,.radar-poc-result input[type=checkbox]:focus,.radar-poc-result input[type=checkbox]:focus-visible,.radar-poc-result input[type=radio]:focus,.radar-poc-result input[type=radio]:focus-visible {
    outline-offset: 0
}

.radar-poc-result kbd {
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

.radar-poc-result h1,.radar-poc-result h2,.radar-poc-result h3,.radar-poc-result h4,.radar-poc-result h5,.radar-poc-result h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: var(--base-text-weight-semibold,600);
    line-height: 1.25
}

.radar-poc-result p {
    margin-top: 0;
    margin-bottom: 10px
}

.radar-poc-result blockquote {
    margin: 0;
    padding: 0 8px;
    border-left: 2px solid #2970ff
}

.radar-poc-result ol,.radar-poc-result ul {
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 2em
}

.radar-poc-result ol {
    list-style: decimal
}

.radar-poc-result ul {
    list-style: disc
}

.radar-poc-result ol ol,.radar-poc-result ul ol {
    list-style-type: lower-roman
}

.radar-poc-result ol ol ol,.radar-poc-result ol ul ol,.radar-poc-result ul ol ol,.radar-poc-result ul ul ol {
    list-style-type: lower-alpha
}

.radar-poc-result dd {
    margin-left: 0
}

.radar-poc-result code,.radar-poc-result pre,.radar-poc-result samp,.radar-poc-result tt {
    font-family: ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace;
    font-size: 12px
}

.radar-poc-result pre {
    margin-top: 0;
    margin-bottom: 0;
    word-wrap: normal
}

.radar-poc-result .octicon {
    display: inline-block;
    overflow: visible!important;
    vertical-align: text-bottom;
    fill: currentColor
}

.radar-poc-result input::-webkit-inner-spin-button,.radar-poc-result input::-webkit-outer-spin-button {
    margin: 0;
    -webkit-appearance: none;
    appearance: none
}

.radar-poc-result:after,.radar-poc-result:before {
    display: table;
    content: ""
}

.radar-poc-result:after {
    clear: both
}

.radar-poc-result>:first-child {
    margin-top: 0!important
}

.radar-poc-result>:last-child {
    margin-bottom: 0!important
}

.radar-poc-result a:not([href]) {
    color: inherit;
    text-decoration: none
}

.radar-poc-result .absent {
    color: var(--color-danger-fg)
}

.radar-poc-result .anchor {
    float: left;
    padding-right: 4px;
    margin-left: -20px;
    line-height: 1
}

.radar-poc-result .anchor:focus {
    outline: none
}

.radar-poc-result blockquote,.radar-poc-result details,.radar-poc-result dl,.radar-poc-result ol,.radar-poc-result p,.radar-poc-result pre,.radar-poc-result table,.radar-poc-result ul {
    margin-top: 0;
    margin-bottom: 16px
}

.radar-poc-result blockquote>:first-child {
    margin-top: 0
}

.radar-poc-result blockquote>:last-child {
    margin-bottom: 0
}

.radar-poc-result h1 .octicon-link,.radar-poc-result h2 .octicon-link,.radar-poc-result h3 .octicon-link,.radar-poc-result h4 .octicon-link,.radar-poc-result h5 .octicon-link,.radar-poc-result h6 .octicon-link {
    color: var(--color-fg-default);
    vertical-align: middle;
    visibility: hidden
}

.radar-poc-result h1:hover .anchor,.radar-poc-result h2:hover .anchor,.radar-poc-result h3:hover .anchor,.radar-poc-result h4:hover .anchor,.radar-poc-result h5:hover .anchor,.radar-poc-result h6:hover .anchor {
    text-decoration: none
}

.radar-poc-result h1:hover .anchor .octicon-link,.radar-poc-result h2:hover .anchor .octicon-link,.radar-poc-result h3:hover .anchor .octicon-link,.radar-poc-result h4:hover .anchor .octicon-link,.radar-poc-result h5:hover .anchor .octicon-link,.radar-poc-result h6:hover .anchor .octicon-link {
    visibility: visible
}

.radar-poc-result h1 code,.radar-poc-result h1 tt,.radar-poc-result h2 code,.radar-poc-result h2 tt,.radar-poc-result h3 code,.radar-poc-result h3 tt,.radar-poc-result h4 code,.radar-poc-result h4 tt,.radar-poc-result h5 code,.radar-poc-result h5 tt,.radar-poc-result h6 code,.radar-poc-result h6 tt {
    padding: 0 .2em;
    font-size: inherit
}

.radar-poc-result summary h1,.radar-poc-result summary h2,.radar-poc-result summary h3,.radar-poc-result summary h4,.radar-poc-result summary h5,.radar-poc-result summary h6 {
    display: inline-block
}

.radar-poc-result summary h1 .anchor,.radar-poc-result summary h2 .anchor,.radar-poc-result summary h3 .anchor,.radar-poc-result summary h4 .anchor,.radar-poc-result summary h5 .anchor,.radar-poc-result summary h6 .anchor {
    margin-left: -40px
}

.radar-poc-result summary h1,.radar-poc-result summary h2 {
    padding-bottom: 0;
    border-bottom: 0
}

.radar-poc-result ol.no-list,.radar-poc-result ul.no-list {
    padding: 0;
    list-style-type: none
}

.radar-poc-result ol[type=a] {
    list-style-type: lower-alpha
}

.radar-poc-result ol[type=A] {
    list-style-type: upper-alpha
}

.radar-poc-result ol[type=i] {
    list-style-type: lower-roman
}

.radar-poc-result ol[type=I] {
    list-style-type: upper-roman
}

.radar-poc-result div>ol:not([type]),.radar-poc-result ol[type="1"] {
    list-style-type: decimal
}

.radar-poc-result ol ol,.radar-poc-result ol ul,.radar-poc-result ul ol,.radar-poc-result ul ul {
    margin-top: 0;
    margin-bottom: 0
}

.radar-poc-result li>p {
    margin-top: 16px
}

.radar-poc-result li+li {
    margin-top: .25em
}

.radar-poc-result dl {
    padding: 0
}

.radar-poc-result dl dt {
    padding: 0;
    margin-top: 16px;
    font-size: 1em;
    font-style: italic;
    font-weight: var(--base-text-weight-semibold,600)
}

.radar-poc-result dl dd {
    padding: 0 16px;
    margin-bottom: 16px
}

.radar-poc-result table th {
    font-weight: var(--base-text-weight-semibold,600);
    white-space: nowrap
}

.radar-poc-result table td,.radar-poc-result table th {
    padding: 6px 13px;
    border: 1px solid var(--color-border-default)
}

.radar-poc-result table tr {
    background-color: var(--color-canvas-default);
    border-top: 1px solid var(--color-border-muted)
}

.radar-poc-result table tr:nth-child(2n) {
    background-color: var(--color-canvas-subtle)
}

.radar-poc-result table img {
    background-color: transparent
}

.radar-poc-result img[align=right] {
    padding-left: 20px
}

.radar-poc-result img[align=left] {
    padding-right: 20px
}

.radar-poc-result .emoji {
    max-width: none;
    vertical-align: text-top;
    background-color: transparent
}

.radar-poc-result span.frame {
    display: block;
    overflow: hidden
}

.radar-poc-result span.frame>span {
    display: block;
    float: left;
    width: auto;
    padding: 7px;
    margin: 13px 0 0;
    overflow: hidden;
    border: 1px solid var(--color-border-default)
}

.radar-poc-result span.frame span img {
    display: block;
    float: left
}

.radar-poc-result span.frame span span {
    display: block;
    padding: 5px 0 0;
    clear: both;
    color: var(--color-fg-default)
}

.radar-poc-result span.align-center {
    display: block;
    overflow: hidden;
    clear: both
}

.radar-poc-result span.align-center>span {
    display: block;
    margin: 13px auto 0;
    overflow: hidden;
    text-align: center
}

.radar-poc-result span.align-center span img {
    margin: 0 auto;
    text-align: center
}

.radar-poc-result span.align-right {
    display: block;
    overflow: hidden;
    clear: both
}

.radar-poc-result span.align-right>span {
    display: block;
    margin: 13px 0 0;
    overflow: hidden;
    text-align: right
}

.radar-poc-result span.align-right span img {
    margin: 0;
    text-align: right
}

.radar-poc-result span.float-left {
    display: block;
    float: left;
    margin-right: 13px;
    overflow: hidden
}

.radar-poc-result span.float-left span {
    margin: 13px 0 0
}

.radar-poc-result span.float-right {
    display: block;
    float: right;
    margin-left: 13px;
    overflow: hidden
}

.radar-poc-result span.float-right>span {
    display: block;
    margin: 13px auto 0;
    overflow: hidden;
    text-align: right
}

.radar-poc-result code,.radar-poc-result tt {
    padding: .2em .4em;
    margin: 0;
    font-size: 85%;
    white-space: break-spaces;
    background-color: var(--color-neutral-muted);
    border-radius: 6px
}

.radar-poc-result code br,.radar-poc-result tt br {
    display: none
}

.radar-poc-result del code {
    text-decoration: inherit
}

.radar-poc-result samp {
    font-size: 85%
}

.radar-poc-result pre code {
    font-size: 100%;
    white-space: pre-wrap!important
}

.radar-poc-result pre>code {
    padding: 0;
    margin: 0;
    word-break: normal;
    white-space: pre-wrap;
    background: transparent;
    border: 0
}

.radar-poc-result .highlight {
    margin-bottom: 16px
}

.radar-poc-result .highlight pre {
    margin-bottom: 0;
    word-break: normal
}

.radar-poc-result .highlight pre,.radar-poc-result pre {
    padding: 16px;
    background: #fff;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    border-radius: 6px
}

.radar-poc-result pre {
    padding: 0
}

.radar-poc-result pre code,.radar-poc-result pre tt {
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

.radar-poc-result .csv-data td,.radar-poc-result .csv-data th {
    padding: 5px;
    overflow: hidden;
    font-size: 12px;
    line-height: 1;
    text-align: left;
    white-space: nowrap
}

.radar-poc-result .csv-data .blob-num {
    padding: 10px 8px 9px;
    text-align: right;
    background: var(--color-canvas-default);
    border: 0
}

.radar-poc-result .csv-data tr {
    border-top: 0
}

.radar-poc-result .csv-data th {
    font-weight: var(--base-text-weight-semibold,600);
    background: var(--color-canvas-subtle);
    border-top: 0
}

.radar-poc-result [data-footnote-ref]:before {
    content: "["
}

.radar-poc-result [data-footnote-ref]:after {
    content: "]"
}

.radar-poc-result .footnotes {
    font-size: 12px;
    color: var(--color-fg-muted);
    border-top: 1px solid var(--color-border-default)
}

.radar-poc-result .footnotes ol {
    padding-left: 16px
}

.radar-poc-result .footnotes ol ul {
    display: inline-block;
    padding-left: 16px;
    margin-top: 16px
}

.radar-poc-result .footnotes li {
    position: relative
}

.radar-poc-result .footnotes li:target:before {
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

.radar-poc-result .footnotes li:target {
    color: var(--color-fg-default)
}

.radar-poc-result .footnotes .data-footnote-backref g-emoji {
    font-family: monospace
}

.radar-poc-result .pl-c {
    color: var(--color-prettylights-syntax-comment)
}

.radar-poc-result .pl-c1,.radar-poc-result .pl-s .pl-v {
    color: var(--color-prettylights-syntax-constant)
}

.radar-poc-result .pl-e,.radar-poc-result .pl-en {
    color: var(--color-prettylights-syntax-entity)
}

.radar-poc-result .pl-s .pl-s1,.radar-poc-result .pl-smi {
    color: var(--color-prettylights-syntax-storage-modifier-import)
}

.radar-poc-result .pl-ent {
    color: var(--color-prettylights-syntax-entity-tag)
}

.radar-poc-result .pl-k {
    color: var(--color-prettylights-syntax-keyword)
}

.radar-poc-result .pl-pds,.radar-poc-result .pl-s,.radar-poc-result .pl-s .pl-pse .pl-s1,.radar-poc-result .pl-sr,.radar-poc-result .pl-sr .pl-cce,.radar-poc-result .pl-sr .pl-sra,.radar-poc-result .pl-sr .pl-sre {
    color: var(--color-prettylights-syntax-string)
}

.radar-poc-result .pl-smw,.radar-poc-result .pl-v {
    color: var(--color-prettylights-syntax-variable)
}

.radar-poc-result .pl-bu {
    color: var(--color-prettylights-syntax-brackethighlighter-unmatched)
}

.radar-poc-result .pl-ii {
    color: var(--color-prettylights-syntax-invalid-illegal-text);
    background-color: var(--color-prettylights-syntax-invalid-illegal-bg)
}

.radar-poc-result .pl-c2 {
    color: var(--color-prettylights-syntax-carriage-return-text);
    background-color: var(--color-prettylights-syntax-carriage-return-bg)
}

.radar-poc-result .pl-sr .pl-cce {
    font-weight: 700;
    color: var(--color-prettylights-syntax-string-regexp)
}

.radar-poc-result .pl-ml {
    color: var(--color-prettylights-syntax-markup-list)
}

.radar-poc-result .pl-mh,.radar-poc-result .pl-mh .pl-en,.radar-poc-result .pl-ms {
    font-weight: 700;
    color: var(--color-prettylights-syntax-markup-heading)
}

.radar-poc-result .pl-mi {
    font-style: italic;
    color: var(--color-prettylights-syntax-markup-italic)
}

.radar-poc-result .pl-mb {
    font-weight: 700;
    color: var(--color-prettylights-syntax-markup-bold)
}

.radar-poc-result .pl-md {
    color: var(--color-prettylights-syntax-markup-deleted-text);
    background-color: var(--color-prettylights-syntax-markup-deleted-bg)
}

.radar-poc-result .pl-mi1 {
    color: var(--color-prettylights-syntax-markup-inserted-text);
    background-color: var(--color-prettylights-syntax-markup-inserted-bg)
}

.radar-poc-result .pl-mc {
    color: var(--color-prettylights-syntax-markup-changed-text);
    background-color: var(--color-prettylights-syntax-markup-changed-bg)
}

.radar-poc-result .pl-mi2 {
    color: var(--color-prettylights-syntax-markup-ignored-text);
    background-color: var(--color-prettylights-syntax-markup-ignored-bg)
}

.radar-poc-result .pl-mdr {
    font-weight: 700;
    color: var(--color-prettylights-syntax-meta-diff-range)
}

.radar-poc-result .pl-ba {
    color: var(--color-prettylights-syntax-brackethighlighter-angle)
}

.radar-poc-result .pl-sg {
    color: var(--color-prettylights-syntax-sublimelinter-gutter-mark)
}

.radar-poc-result .pl-corl {
    text-decoration: underline;
    color: var(--color-prettylights-syntax-constant-other-reference-link)
}

.radar-poc-result g-emoji {
    display: inline-block;
    min-width: 1ch;
    font-family: Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;
    font-size: 1em;
    font-style: normal!important;
    font-weight: var(--base-text-weight-normal,400);
    line-height: 1;
    vertical-align: -.075em
}

.radar-poc-result g-emoji img {
    width: 1em;
    height: 1em
}

.radar-poc-result .task-list-item {
    list-style-type: none
}

.radar-poc-result .task-list-item label {
    font-weight: var(--base-text-weight-normal,400)
}

.radar-poc-result .task-list-item.enabled label {
    cursor: pointer
}

.radar-poc-result .task-list-item+.task-list-item {
    margin-top: 4px
}

.radar-poc-result .task-list-item .handle {
    display: none
}

.radar-poc-result .task-list-item-checkbox {
    margin: 0 .2em .25em -1.4em;
    vertical-align: middle
}

.radar-poc-result .contains-task-list:dir(rtl) .task-list-item-checkbox {
    margin: 0 -1.6em .25em .2em
}

.radar-poc-result .contains-task-list {
    position: relative
}

.radar-poc-result .contains-task-list:focus-within .task-list-item-convert-container,.radar-poc-result .contains-task-list:hover .task-list-item-convert-container {
    display: block;
    width: auto;
    height: 24px;
    overflow: visible;
    clip: auto
}

.radar-poc-result ::-webkit-calendar-picker-indicator {
    filter: invert(50%)
}

.radar-poc-result .react-syntax-highlighter-line-number {
    color: #d0d5dd
}

`;

let styleSheet = null;

function insert2MainBody() {
  // JavaScript to insert a new DOM element
  const resultElement = document.getElementById('radar-poc-result');
  if (resultElement) {
    resultElement.remove();
  }

  const appMainSection = document.getElementById('app-main-section');

  // Create a new div element
  const newElement = document.createElement('div');
  newElement.id = 'radar-poc-result';
  newElement.className = 'radar-poc-result';
  if (!styleSheet) {
    styleSheet = insertMarkdownCss(cssStyles);
  }
  
  // Apply styles to the new element
  newElement.style.width = '480px';
  newElement.style.backgroundColor = 'rgb(249, 249, 249)'; // Example background color
  newElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  newElement.style.padding = '20px';
  newElement.style.borderRight = '1px solid rgb(243, 243, 243)';
  newElement.style.overflowY = 'auto';

  // Add some content to the new element
  newElement.innerHTML = 'Loading...';

  // Insert the new element into the app-main-section
  appMainSection.appendChild(newElement);
}

function query(username, query, apiKey, contactUserName) {
  const url = 'https://lap2-api-dev.int.rclabenv.com/v1/completion-messages';

  const data = {
    inputs: { query: JSON.stringify(query), username: username},
    response_mode: 'blocking',
    user: username
  };

  if (contactUserName) {
    data.inputs.contact_user_names = contactUserName;
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    console.log('Success:', data);
    return data.answer;
  })
  .catch(error => {
    console.error('Error:', error);
    return error.message || 'Https error'
  });
}

function extractAndParseJSON(inputString) {
    // 使用正则表达式提取JSON部分
    const jsonMatch = inputString.match(/```json([\s\S]*?)```/);
    if (jsonMatch) {
        const jsonString = jsonMatch[1].trim();
        try {
            const jsonObject = JSON.parse(jsonString);
            return jsonObject;
        } catch (error) {
            console.error("JSON解析错误:", error);
            return [];
        }
    } else {
        console.log("未找到JSON数据");
        return [];
    }
}


function filterGroup(groups, username, autoFilterGroup) {
    if (!autoFilterGroup) {
        return Promise.resolve(groups);
    }

    const apiKey = 'app-LZueVrlxA37lrUCuHCpN5jzs';
    const teamGroups = groups.filter(group => !!group.groupType);
    const chunkSize = 5; // 设置并发请求的数量
    const results = [];

    function processChunks(index) {
        if (index >= teamGroups.length) {
            return Promise.resolve(results);  // 全部处理完毕，返回结果数组
        }

        const chunk = teamGroups.slice(index, index + chunkSize);

        // 并发处理chunk中的所有请求
        return Promise.all(chunk.map(group => query(username, group, apiKey)))
            .then(responses => {
                responses.forEach(response => {
                    results.push(...extractAndParseJSON(response));  // 将结果添加到结果数组
                });
                return processChunks(index + chunkSize);  // 处理下一个chunk
            })
            .catch(error => {
                console.error('Error processing groups:', error);
                return processChunks(index + chunkSize);  // 即使有错误，也继续处理下一个chunk
            });
    }

    return processChunks(0).then(() => {
        console.log('All groups processed.');
        // 过滤出 isImportant 为 true 的 team group
        const importantTeamGroupIds = results
            .filter(result => result.isImportant)
            .map(result => result.groupId);

        // 保留 groupType !== 'team' 的所有 group 和 isImportant 为 true 的 team group
        return groups.filter(group => 
            !group.groupType || importantTeamGroupIds.includes(group.groupId)
        );
    });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_INDEX_DB_DATA") {
    const startTime = message.startTime;
    const groupPost = message.groupPost || false;
    const apiKey = message.apiKey || '';
    const contactUserName = message.contactUserName || '';
    const selectGroupName = message.selectGroupName || '';
    // const selectDirectMessages = message.selectDirectMessages || '';
    const ignoreGroupName = message.ignoreGroupName || '';
    const enableMessage = message.enableMessage;
    const enableSms = message.enableSms;
    const enableVoicemail = message.enableVoicemail;
    const enableCallTranscript = message.enableCallTranscript;
    const autoFilterGroup = message.autoFilterGroup;

    const selectGroupNames = selectGroupName.split(',').map(item => item.trim()).filter(item => !!item);
    // const selectDirectMessageNames = selectDirectMessages.split(',').map(item => item.trim().toLowerCase()).filter(item => !!item);
    const ignoreGroupNames = ignoreGroupName.split(',').map(item => item.trim()).filter(item => !!item);

    console.log('Received message:', message);
    sendResponse({ status: 'success' });
    insert2MainBody();
    const resultElement = document.getElementById('radar-poc-result');

    Promise.all([TransformMessagePosts(enableMessage, startTime, groupPost, selectGroupNames, ignoreGroupNames), TransformPhone(startTime, enableSms,enableVoicemail,enableCallTranscript)]).then(([message, phone]) => {
      const username = localStorage.getItem('displayName');
      const data = message.concat(phone).sort((a, b) => new Date(a.time) - new Date(b.time));

      filterGroup(data, username, autoFilterGroup).then(filteredGroups => {
        console.log('Filtered Groups:', filteredGroups.length);
        query(username, filteredGroups, apiKey, contactUserName).then(answer => {
            resultElement.innerHTML = marked.parse(answer || 'llm anwser error');
          }).catch(error => {
            resultElement.innerHTML = error.message;
          });
        }).catch(error => {
            console.error('filterGroup Error:', error);
            resultElement.innerHTML = error.message;
        });
    }).catch(error => {
      resultElement.innerHTML = error.message;
    });

    return true; // Will respond asynchronously.
  }
});
