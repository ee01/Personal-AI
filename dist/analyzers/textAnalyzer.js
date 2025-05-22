/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/analyzers/baseAnalyzer.ts":
/*!***************************************!*\
  !*** ./src/analyzers/baseAnalyzer.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BaseSlideAnalyzer: () => (/* binding */ BaseSlideAnalyzer)
/* harmony export */ });
/* harmony import */ var _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../interfaces/slideAnalyzer */ "./src/interfaces/slideAnalyzer.ts");
/**
 * 幻灯片内容分析器基类
 */


/**
 * 基础分析器抽象类
 * 提供通用功能和框架，具体分析由子类实现
 */
class BaseSlideAnalyzer {
  /**
   * 分析幻灯片内容
   * @param slide 幻灯片对象
   * @returns 分析结果
   */
  async analyze(slide) {
    // 进行基本幻灯片元素分析
    const metadata = this.analyzeSlideMetadata(slide);
    const contentType = this.determineContentType(slide);

    // 初始化结果
    const result = {
      contentType,
      projectStructure: _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.UNKNOWN,
      projectFields: [],
      projects: [],
      confidence: 0,
      metadata
    };
    try {
      // 分析项目结构
      result.projectStructure = this.analyzeProjectStructure(slide);

      // 进行具体内容分析，由子类实现
      const analysisResult = await this.analyzeContent(slide, contentType);

      // 合并分析结果
      Object.assign(result, analysisResult);
      return result;
    } catch (error) {
      console.error('幻灯片分析错误:', error);
      result.warnings = [`分析错误: ${error instanceof Error ? error.message : String(error)}`];
      return result;
    }
  }

  /**
   * 判断是否可以处理此类型的幻灯片
   * 子类应该重写此方法以提供具体的判断逻辑
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */

  /**
   * 分析具体内容
   * 子类需要实现此方法进行具体分析逻辑
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 部分分析结果
   */

  /**
   * 分析幻灯片元数据
   * @param slide 幻灯片对象
   * @returns 幻灯片元数据
   */
  analyzeSlideMetadata(slide) {
    const pageElements = slide.pageElements || [];

    // 计数不同类型的元素
    let tableCount = 0;
    let textCount = 0;
    let shapeCount = 0;
    let listCount = 0;
    for (const element of pageElements) {
      if (element.table) tableCount++;
      if (element.shape?.text) {
        textCount++;
        // 检查文本是否包含列表
        if (this.containsList(element.shape.text.textElements)) {
          listCount++;
        }
      }
      if (element.shape && !element.shape.text) shapeCount++;
    }
    return {
      slideId: slide.objectId,
      elementCount: pageElements.length,
      hasTable: tableCount > 0,
      hasText: textCount > 0,
      hasShapes: shapeCount > 0,
      hasLists: listCount > 0
    };
  }

  /**
   * 确定幻灯片内容类型
   * @param slide 幻灯片对象
   * @returns 内容类型
   */
  determineContentType(slide) {
    const metadata = this.analyzeSlideMetadata(slide);
    if (metadata.hasTable) {
      // 如果有表格，可以是表格或混合
      return metadata.hasText && !this.isTableDominant(slide) ? _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.MIXED : _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.TABLE;
    } else if (metadata.hasLists) {
      // 如果有列表但没有表格
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.LIST;
    } else if (metadata.hasText) {
      // 如果有文本但没有表格和列表
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.TEXT;
    } else if (metadata.hasShapes) {
      // 只有形状
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.SHAPE;
    }
    return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.UNKNOWN;
  }

  /**
   * 分析项目结构类型
   * @param slide 幻灯片对象
   * @returns 项目结构类型
   */
  analyzeProjectStructure(slide) {
    // 查找幻灯片标题或文本内容中的关键词
    const textContent = this.extractAllTextContent(slide);
    const lowerText = textContent.toLowerCase();

    // 根据关键词判断项目结构类型
    if (lowerText.includes('sprint') || lowerText.includes('迭代') || lowerText.includes('iteration') || lowerText.includes('周报')) {
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.SPRINT;
    } else if (lowerText.includes('epic') || lowerText.includes('特性') || lowerText.includes('feature')) {
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.EPIC;
    } else if (lowerText.includes('release') || lowerText.includes('发布') || lowerText.includes('版本')) {
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.RELEASE;
    } else if (this.containsMultipleJiraTickets(textContent)) {
      // 如果检测到多个Jira工单ID，但没有其他关键词，默认为混合结构
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.MIXED;
    } else if (this.containsSingleJiraTicket(textContent)) {
      // 如果只检测到一个Jira工单ID
      return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.SINGLE_TICKET;
    }

    // 默认为自定义结构
    return _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.ProjectStructureType.CUSTOM;
  }

  /**
   * 提取幻灯片所有文本内容
   * @param slide 幻灯片对象
   * @returns 所有文本内容
   */
  extractAllTextContent(slide) {
    const textContent = [];
    if (!slide.pageElements) return '';
    for (const element of slide.pageElements) {
      // 从表格中提取文本
      if (element.table && element.table.tableRows) {
        for (const row of element.table.tableRows) {
          if (!row.tableCells) continue;
          for (const cell of row.tableCells) {
            if (!cell.text || !cell.text.textElements) continue;
            const cellText = cell.text.textElements.map(e => e.textRun?.content || '').join('');
            if (cellText.trim()) {
              textContent.push(cellText);
            }
          }
        }
      }

      // 从形状中提取文本
      if (element.shape && element.shape.text && element.shape.text.textElements) {
        const shapeText = element.shape.text.textElements.map(e => e.textRun?.content || '').join('');
        if (shapeText.trim()) {
          textContent.push(shapeText);
        }
      }
    }
    return textContent.join('\n');
  }

  /**
   * 检查是否包含单个Jira工单
   * @param text 文本内容
   * @returns 是否包含单个Jira工单
   */
  containsSingleJiraTicket(text) {
    const jiraTicketPattern = /[A-Z]+-\d+/g;
    const matches = text.match(jiraTicketPattern);
    return matches !== null && matches.length === 1;
  }

  /**
   * 检查是否包含多个Jira工单
   * @param text 文本内容
   * @returns 是否包含多个Jira工单
   */
  containsMultipleJiraTickets(text) {
    const jiraTicketPattern = /[A-Z]+-\d+/g;
    const matches = text.match(jiraTicketPattern);
    return matches !== null && matches.length > 1;
  }

  /**
   * 检查文本元素是否包含列表
   * @param textElements 文本元素数组
   * @returns 是否包含列表
   */
  containsList(textElements) {
    if (!textElements) return false;
    return textElements.some(element => element.paragraphMarker?.style?.bulletPreset !== undefined);
  }

  /**
   * 判断表格是否是幻灯片的主要内容
   * @param slide 幻灯片对象
   * @returns 表格是否为主要内容
   */
  isTableDominant(slide) {
    if (!slide.pageElements) return false;
    const totalElements = slide.pageElements.length;
    const tableElements = slide.pageElements.filter(e => e.table).length;

    // 如果表格元素占比超过50%，或者只有一个表格和少量其他元素
    return tableElements / totalElements > 0.5 || tableElements === 1 && totalElements <= 3;
  }

  /**
   * 从文本中提取所有Jira工单ID
   * @param text 文本内容
   * @returns Jira工单ID数组
   */
  extractJiraTickets(text) {
    const jiraTicketPattern = /[A-Z]+-\d+/g;
    return text.match(jiraTicketPattern) || [];
  }
}

/***/ }),

/***/ "./src/interfaces/slideAnalyzer.ts":
/*!*****************************************!*\
  !*** ./src/interfaces/slideAnalyzer.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProjectStructureType: () => (/* binding */ ProjectStructureType),
/* harmony export */   SlideContentType: () => (/* binding */ SlideContentType)
/* harmony export */ });
/**
 * 幻灯片分析器接口定义
 */

/**
 * 幻灯片内容类型枚举
 */
let SlideContentType = /*#__PURE__*/function (SlideContentType) {
  SlideContentType["TABLE"] = "table";
  SlideContentType["TEXT"] = "text";
  SlideContentType["SHAPE"] = "shape";
  SlideContentType["LIST"] = "list";
  SlideContentType["MIXED"] = "mixed";
  SlideContentType["UNKNOWN"] = "unknown";
  return SlideContentType;
}({});

/**
 * 项目结构类型枚举
 */
let ProjectStructureType = /*#__PURE__*/function (ProjectStructureType) {
  ProjectStructureType["SINGLE_TICKET"] = "single_ticket";
  ProjectStructureType["SPRINT"] = "sprint";
  ProjectStructureType["EPIC"] = "epic";
  ProjectStructureType["RELEASE"] = "release";
  ProjectStructureType["MIXED"] = "mixed";
  ProjectStructureType["CUSTOM"] = "custom";
  ProjectStructureType["UNKNOWN"] = "unknown";
  return ProjectStructureType;
}({});

/**
 * 幻灯片内容分析结果
 */

/**
 * 幻灯片内容分析器接口
 */

/**
 * 表格内容分析器接口
 */

/**
 * 文本内容分析器接口
 */

/**
 * 元素引用记录
 */

/**
 * 带有元素引用的项目数据
 */

/**
 * 项目字段建议
 */

/**
 * 幻灯片分析器工厂接口
 */

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
/*!***************************************!*\
  !*** ./src/analyzers/textAnalyzer.ts ***!
  \***************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TextContentAnalyzerImpl: () => (/* binding */ TextContentAnalyzerImpl)
/* harmony export */ });
/* harmony import */ var _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../interfaces/slideAnalyzer */ "./src/interfaces/slideAnalyzer.ts");
/* harmony import */ var _baseAnalyzer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseAnalyzer */ "./src/analyzers/baseAnalyzer.ts");
/**
 * 文本内容分析器实现
 */



/**
 * 文本结构类型
 */
var TextStructureType = /*#__PURE__*/function (TextStructureType) {
  TextStructureType["PARAGRAPH"] = "paragraph";
  TextStructureType["BULLET_LIST"] = "bullet_list";
  TextStructureType["NUMBERED_LIST"] = "numbered_list";
  TextStructureType["MIXED"] = "mixed";
  return TextStructureType;
}(TextStructureType || {});
/**
 * 文本块信息
 */
/**
 * 文本内容分析器类
 * 处理基于文本和列表的项目信息
 */
class TextContentAnalyzerImpl extends _baseAnalyzer__WEBPACK_IMPORTED_MODULE_1__.BaseSlideAnalyzer {
  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  canHandle(slide) {
    if (!slide.pageElements) return false;
    const metadata = this.analyzeSlideMetadata(slide);
    const contentType = this.determineContentType(slide);

    // 能处理文本、列表或混合(但不以表格为主)的幻灯片
    return contentType === _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.TEXT || contentType === _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.LIST || contentType === _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.MIXED && !metadata.hasTable;
  }

  /**
   * 分析文本内容
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 分析结果
   */
  async analyzeContent(slide, contentType) {
    if (!slide.pageElements) {
      return {
        projects: [],
        confidence: 0
      };
    }

    // 获取所有文本元素
    const textElements = slide.pageElements.filter(element => element.shape && element.shape.text || element.table && element.table.tableRows);
    if (textElements.length === 0) {
      return {
        projects: [],
        confidence: 0
      };
    }
    try {
      // 分析文本元素
      const result = await this.analyzeTextElements(textElements);

      // 计算置信度
      const confidence = this.calculateTextConfidence(result.projects);

      // 生成警告
      const warnings = [];
      if (confidence < 0.4) {
        warnings.push('文本结构识别置信度较低，可能无法准确提取所有项目信息');
      }
      if (result.projects.length === 0) {
        warnings.push('未能从文本中提取项目数据，请检查幻灯片内容格式');
      }
      return {
        projects: result.projects,
        projectFields: result.projectFields,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('文本分析错误:', error);
      return {
        projects: [],
        confidence: 0,
        warnings: [`文本分析错误: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * 分析文本元素
   * @param elements 页面元素数组
   * @returns 文本分析结果
   */
  async analyzeTextElements(elements) {
    // 提取文本块
    const textBlocks = this.extractTextBlocks(elements);

    // 构建文本结构树
    const structuredBlocks = this.buildTextStructureTree(textBlocks);

    // 根据结构提取项目
    const projects = this.extractProjectsFromTextStructure(structuredBlocks);

    // 确定项目共有字段
    const projectFields = this.determineCommonFields(projects);
    return {
      projectFields,
      projects
    };
  }

  /**
   * 从页面元素中提取文本块
   * @param elements 页面元素数组
   * @returns 文本块数组
   */
  extractTextBlocks(elements) {
    const blocks = [];
    let index = 0;
    for (const element of elements) {
      // 处理形状中的文本
      if (element.shape && element.shape.text && element.shape.text.textElements) {
        const shapeBlocks = this.extractTextBlocksFromShape(element.shape, element.objectId, index);
        blocks.push(...shapeBlocks);
        index += shapeBlocks.length;
      }
    }
    return blocks;
  }

  /**
   * 从形状中提取文本块
   * @param shape 形状对象
   * @param elementId 元素ID
   * @param startIndex 起始索引
   * @returns 文本块数组
   */
  extractTextBlocksFromShape(shape, elementId, startIndex) {
    const blocks = [];
    if (!shape.text || !shape.text.textElements) {
      return blocks;
    }
    let currentBlock = null;
    let currentContent = [];
    let currentType = TextStructureType.PARAGRAPH;
    let currentLevel = 0;
    let isBold = false;
    let fontSize = 0;

    // 遍历文本元素
    for (const textElement of shape.text.textElements) {
      // 处理段落标记
      if (textElement.paragraphMarker) {
        // 如果已经有内容，保存当前块
        if (currentContent.length > 0 && currentBlock) {
          currentBlock.content = currentContent.join('').trim();
          if (currentBlock.content) {
            blocks.push(currentBlock);
          }
        }

        // 开始新块
        currentContent = [];

        // 确定块类型
        if (textElement.paragraphMarker.style?.bulletPreset) {
          currentType = TextStructureType.BULLET_LIST;

          // 根据缩进确定级别
          const indent = textElement.paragraphMarker.style.indent?.magnitude || 0;
          currentLevel = Math.floor(indent / 20); // 假设每级缩进20单位
        } else {
          currentType = TextStructureType.PARAGRAPH;
          currentLevel = 0;
        }
        currentBlock = {
          elementId,
          content: '',
          type: currentType,
          level: currentLevel,
          isBold: false,
          fontSize: 0,
          isTitle: false,
          index: startIndex + blocks.length
        };
      }

      // 处理文本内容
      if (textElement.textRun) {
        // 获取样式信息
        const style = textElement.textRun.style;
        if (style) {
          isBold = style.bold || false;
          fontSize = style.fontSize?.magnitude || 0;
        }

        // 添加文本
        const content = textElement.textRun.content || '';
        currentContent.push(content);

        // 如果是第一个文本元素，更新块的样式信息
        if (currentBlock && currentContent.length === 1) {
          currentBlock.isBold = isBold;
          currentBlock.fontSize = fontSize;
          currentBlock.isTitle = fontSize > 14 || isBold; // 根据字体大小和粗体判断是否是标题
        }
      }
    }

    // 保存最后一个块
    if (currentContent.length > 0 && currentBlock) {
      currentBlock.content = currentContent.join('').trim();
      if (currentBlock.content) {
        blocks.push(currentBlock);
      }
    }
    return blocks;
  }

  /**
   * 构建文本结构树
   * @param blocks 文本块数组
   * @returns 结构化的文本块数组
   */
  buildTextStructureTree(blocks) {
    // 按索引排序
    blocks.sort((a, b) => a.index - b.index);

    // 构建层级结构树
    const rootBlocks = [];
    const stack = [];
    for (const block of blocks) {
      // 重置堆栈，直到找到适当的父级
      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }
      if (stack.length === 0) {
        // 顶层块
        rootBlocks.push(block);
      } else {
        // 添加为子块
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(block);
      }

      // 如果不是列表项，或者是标题，不入栈
      if (block.type !== TextStructureType.BULLET_LIST || block.isTitle) {
        continue;
      }

      // 当前块入栈
      stack.push(block);
    }
    return rootBlocks;
  }

  /**
   * 从文本结构中提取项目
   * @param blocks 结构化的文本块数组
   * @returns 项目数据数组
   */
  extractProjectsFromTextStructure(blocks) {
    const projects = [];

    // 识别不同的项目结构模式并提取

    // 模式1: 标题或列表项是项目名称，子项是项目详情
    this.extractProjectsFromTitleChildrenPattern(blocks, projects);

    // 模式2: 列表项包含完整的项目信息
    this.extractProjectsFromListItemPattern(blocks, projects);

    // 模式3: 段落文本包含完整的项目信息
    this.extractProjectsFromParagraphPattern(blocks, projects);
    return projects;
  }

  /**
   * 从标题-子项模式中提取项目
   * @param blocks 文本块数组
   * @param projects 项目数组（输出）
   */
  extractProjectsFromTitleChildrenPattern(blocks, projects) {
    for (const block of blocks) {
      // 只考虑有子项的标题或列表项
      if (!block.children || block.children.length === 0) {
        continue;
      }

      // 尝试从标题中提取项目ID和名称
      const titleText = block.content;
      const jiraMatch = TextContentAnalyzerImpl.JIRA_TICKET_PATTERN.exec(titleText);
      if (!jiraMatch) {
        // 如果没有Jira ID，可能不是项目标题，递归处理子项
        if (block.children) {
          this.extractProjectsFromTitleChildrenPattern(block.children, projects);
        }
        continue;
      }
      const jiraId = jiraMatch[1];
      let projectName = titleText.replace(jiraId, '').trim();

      // 如果有冒号，取冒号后的部分
      if (projectName.includes(':')) {
        projectName = projectName.split(':')[1].trim();
      } else if (projectName.includes('：')) {
        projectName = projectName.split('：')[1].trim();
      }

      // 从子项中提取项目详情
      let status = '';
      let owner = '';
      let track = '';
      let comments = '';
      for (const child of block.children) {
        const childText = child.content.toLowerCase();

        // 尝试匹配状态
        for (const pattern of TextContentAnalyzerImpl.STATUS_PATTERNS) {
          const match = pattern.exec(child.content);
          if (match) {
            status = match[1] || match[0];
            break;
          }
        }

        // 如果没有通过模式匹配找到，通过关键词查找
        if (!status && (childText.includes('状态') || childText.includes('status'))) {
          status = child.content.replace(/状态[:：]|status[:：]/i, '').trim();
        }

        // 尝试匹配负责人
        for (const pattern of TextContentAnalyzerImpl.OWNER_PATTERNS) {
          const match = pattern.exec(child.content);
          if (match) {
            owner = match[1] || match[0];
            break;
          }
        }

        // 如果没有通过模式匹配找到，通过关键词查找
        if (!owner && (childText.includes('负责人') || childText.includes('责任人') || childText.includes('owner') || childText.includes('assignee'))) {
          owner = child.content.replace(/负责人[:：]|责任人[:：]|owner[:：]|assignee[:：]/i, '').trim();
        }

        // 尝试匹配赛道/团队
        for (const pattern of TextContentAnalyzerImpl.TRACK_PATTERNS) {
          const match = pattern.exec(child.content);
          if (match) {
            track = match[1] || match[0];
            break;
          }
        }

        // 添加其他未识别内容为备注
        if (!childText.includes('状态') && !childText.includes('status') && !childText.includes('负责人') && !childText.includes('责任人') && !childText.includes('owner') && !childText.includes('assignee') && !childText.includes('赛道') && !childText.includes('团队') && !childText.includes('track') && !childText.includes('team')) {
          if (comments) {
            comments += '\n';
          }
          comments += child.content;
        }
      }

      // 创建项目数据
      projects.push({
        id: jiraId,
        name: projectName,
        status: status,
        owner: owner,
        track: track,
        comments: comments,
        slideElementId: block.elementId
      });
    }
  }

  /**
   * 从列表项模式中提取项目
   * @param blocks 文本块数组
   * @param projects 项目数组（输出）
   */
  extractProjectsFromListItemPattern(blocks, projects) {
    for (const block of blocks) {
      if (block.type !== TextStructureType.BULLET_LIST && block.type !== TextStructureType.NUMBERED_LIST) {
        // 递归处理子项
        if (block.children) {
          this.extractProjectsFromListItemPattern(block.children, projects);
        }
        continue;
      }
      const content = block.content;
      const jiraMatch = TextContentAnalyzerImpl.JIRA_TICKET_PATTERN.exec(content);
      if (!jiraMatch) {
        // 递归处理子项
        if (block.children) {
          this.extractProjectsFromListItemPattern(block.children, projects);
        }
        continue;
      }
      const jiraId = jiraMatch[1];
      let projectName = content.replace(jiraId, '').trim();

      // 分离项目名称和其他信息
      let status = '';
      let owner = '';
      const track = '';
      let comments = '';

      // 尝试提取状态（通常在方括号或其他标记中）
      const statusMatches = content.match(/\[(.*?)\]/);
      if (statusMatches) {
        status = statusMatches[1];
        projectName = projectName.replace(/\[.*?\]/, '').trim();
      }

      // 尝试提取负责人（通常使用@符号）
      const ownerMatches = content.match(/@([^\s]+)/);
      if (ownerMatches) {
        owner = ownerMatches[1];
        projectName = projectName.replace(/@[^\s]+/, '').trim();
      }

      // 提取项目名称（通常在冒号后）
      if (projectName.includes(':')) {
        const parts = projectName.split(':');
        if (parts.length >= 2) {
          comments = parts.slice(2).join(':').trim();
          projectName = parts[1].trim();
        }
      } else if (projectName.includes('：')) {
        const parts = projectName.split('：');
        if (parts.length >= 2) {
          comments = parts.slice(2).join('：').trim();
          projectName = parts[1].trim();
        }
      }

      // 创建项目数据
      projects.push({
        id: jiraId,
        name: projectName,
        status: status,
        owner: owner,
        track: track,
        comments: comments,
        slideElementId: block.elementId
      });

      // 递归处理子项（如果有）
      if (block.children) {
        // 将子项内容作为当前项目的评论/备注
        for (const child of block.children) {
          if (projects[projects.length - 1].comments) {
            projects[projects.length - 1].comments += '\n';
          } else {
            projects[projects.length - 1].comments = '';
          }
          projects[projects.length - 1].comments += child.content;
        }
      }
    }
  }

  /**
   * 从段落模式中提取项目
   * @param blocks 文本块数组
   * @param projects 项目数组（输出）
   */
  extractProjectsFromParagraphPattern(blocks, projects) {
    for (const block of blocks) {
      if (block.type !== TextStructureType.PARAGRAPH) {
        // 递归处理子项
        if (block.children) {
          this.extractProjectsFromParagraphPattern(block.children, projects);
        }
        continue;
      }
      const content = block.content;
      const jiraMatches = content.match(/[A-Z]+-\d+/g);
      if (!jiraMatches || jiraMatches.length === 0) {
        continue;
      }

      // 对于每个匹配的Jira ID，尝试提取相关项目信息
      for (const jiraId of jiraMatches) {
        const jiraIndex = content.indexOf(jiraId);
        const textAfterJira = content.substring(jiraIndex + jiraId.length);

        // 提取项目名称（假设在Jira ID后面的文本到下一个分隔符）
        let projectName = textAfterJira.trim();
        let status = '';
        let owner = '';
        let comments = '';

        // 处理冒号后的内容
        if (projectName.startsWith(':')) {
          projectName = projectName.substring(1).trim();
        }

        // 提取状态（如果有）
        const statusMatch = textAfterJira.match(/\[(.*?)\]/);
        if (statusMatch) {
          status = statusMatch[1];
          projectName = projectName.replace(/\[.*?\]/, '').trim();
        }

        // 提取负责人（如果有）
        const ownerMatch = textAfterJira.match(/@([^\s]+)/);
        if (ownerMatch) {
          owner = ownerMatch[1];
          projectName = projectName.replace(/@[^\s]+/, '').trim();
        }

        // 如果有多个句子，可能后面的是评论
        const sentences = projectName.split(/[.。]/);
        if (sentences.length > 1) {
          projectName = sentences[0].trim();
          comments = sentences.slice(1).join('.').trim();
        }

        // 创建项目数据
        projects.push({
          id: jiraId,
          name: projectName,
          status: status,
          owner: owner,
          comments: comments,
          slideElementId: block.elementId
        });
      }
    }
  }

  /**
   * 确定项目共有的字段
   * @param projects 项目数组
   * @returns 共有字段名数组
   */
  determineCommonFields(projects) {
    if (projects.length === 0) {
      return [];
    }
    const fields = new Set(['id', 'name']);

    // 计算每个字段的存在比例
    const fieldCounts = {
      status: 0,
      owner: 0,
      track: 0,
      comments: 0
    };
    for (const project of projects) {
      if (project.status) fieldCounts.status++;
      if (project.owner) fieldCounts.owner++;
      if (project.track) fieldCounts.track++;
      if (project.comments) fieldCounts.comments++;
    }

    // 如果字段在超过30%的项目中存在，认为是共有字段
    const threshold = projects.length * 0.3;
    for (const [field, count] of Object.entries(fieldCounts)) {
      if (count >= threshold) {
        fields.add(field);
      }
    }
    return Array.from(fields);
  }

  /**
   * 计算文本分析的置信度
   * @param projects 提取的项目
   * @returns 置信度分数(0-1)
   */
  calculateTextConfidence(projects) {
    if (projects.length === 0) {
      return 0;
    }
    let score = 0;

    // 1. 项目数量评分
    if (projects.length >= 3) {
      score += 0.3;
    } else if (projects.length >= 1) {
      score += 0.1;
    }

    // 2. 字段完整性评分
    let completenessScore = 0;
    let totalFields = 0;
    for (const project of projects) {
      let projectFields = 0;
      let filledFields = 0;
      for (const field of ['id', 'name', 'status', 'owner', 'track', 'comments']) {
        projectFields++;
        if (project[field]) {
          filledFields++;
        }
      }
      completenessScore += filledFields / projectFields;
      totalFields++;
    }
    score += completenessScore / totalFields * 0.4;

    // 3. Jira ID评分
    const jiraProjects = projects.filter(p => /[A-Z]+-\d+/.test(p.id));
    score += jiraProjects.length / projects.length * 0.3;
    return Math.min(1, score);
  }
}
// Jira工单ID模式
TextContentAnalyzerImpl.JIRA_TICKET_PATTERN = /([A-Z]+-\d+)/;
// 项目状态关键词和正则表达式
TextContentAnalyzerImpl.STATUS_PATTERNS = [/状态[:：]\s*([^,，。\n]+)/i, /status[:：]\s*([^,，。\n]+)/i, /\[(进行中|完成|待办|阻塞|延期|取消)\]/i, /\[(in progress|done|todo|blocked|delayed|cancelled)\]/i];
// 负责人关键词和正则表达式
TextContentAnalyzerImpl.OWNER_PATTERNS = [/负责人[:：]\s*([^,，。\n]+)/i, /owner[:：]\s*([^,，。\n]+)/i, /责任人[:：]\s*([^,，。\n]+)/i, /assignee[:：]\s*([^,，。\n]+)/i, /@([^\s]+)/];
// 赛道/团队关键词和正则表达式
TextContentAnalyzerImpl.TRACK_PATTERNS = [/赛道[:：]\s*([^,，。\n]+)/i, /团队[:：]\s*([^,，。\n]+)/i, /track[:：]\s*([^,，。\n]+)/i, /team[:：]\s*([^,，。\n]+)/i];
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LENBQUNvRyxDQUFDLElBQUksWUFBWSxDQUFDQyxJQUFJLENBQUNELENBQUMsQ0FBQ2pDLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFNEIsS0FBSyxJQUFLSSxZQUFZLENBQUNqSixNQUFNLEdBQUczQixRQUFRLENBQUMyQixNQUFNLEdBQUksR0FBRztJQUV0RCxPQUFPNkUsSUFBSSxDQUFDdUUsR0FBRyxDQUFDLENBQUMsRUFBRVAsS0FBSyxDQUFDO0VBQzNCO0FBQ0Y7QUFycEJFO0FBRFc1Rix1QkFBdUIsQ0FFVmdELG1CQUFtQixHQUFHLGNBQWM7QUFFNUQ7QUFKV2hELHVCQUF1QixDQUtWNkQsZUFBZSxHQUFHLENBQ3hDLHVCQUF1QixFQUN2QiwyQkFBMkIsRUFDM0IsMkJBQTJCLEVBQzNCLHdEQUF3RCxDQUN6RDtBQUVEO0FBWlc3RCx1QkFBdUIsQ0FhVjhELGNBQWMsR0FBRyxDQUN2Qyx3QkFBd0IsRUFDeEIsMEJBQTBCLEVBQzFCLHdCQUF3QixFQUN4Qiw2QkFBNkIsRUFDN0IsV0FBVyxDQUNaO0FBRUQ7QUFyQlc5RCx1QkFBdUIsQ0FzQlYrRCxjQUFjLEdBQUcsQ0FDdkMsdUJBQXVCLEVBQ3ZCLHVCQUF1QixFQUN2QiwwQkFBMEIsRUFDMUIseUJBQXlCLENBQzFCLEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9hbmFseXplcnMvYmFzZUFuYWx5emVyLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2ludGVyZmFjZXMvc2xpZGVBbmFseXplci50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2FuYWx5emVycy90ZXh0QW5hbHl6ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDlubvnga/niYflhoXlrrnliIbmnpDlmajln7rnsbtcbiAqL1xuXG5pbXBvcnQgeyBHb29nbGVTbGlkZSwgR29vZ2xlUGFnZUVsZW1lbnQsIEdvb2dsZVRleHRFbGVtZW50IH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9nb29nbGVTbGlkZXMnO1xuaW1wb3J0IHsgXG4gIFNsaWRlQ29udGVudEFuYWx5emVyLCBcbiAgU2xpZGVDb250ZW50VHlwZSwgXG4gIFByb2plY3RTdHJ1Y3R1cmVUeXBlLCBcbiAgU2xpZGVBbmFseXNpc1Jlc3VsdCBcbn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9zbGlkZUFuYWx5emVyJztcbmltcG9ydCB7IFByb2plY3REYXRhIH0gZnJvbSAnLi4vc2xpZGUnO1xuXG4vKipcbiAqIOWfuuehgOWIhuaekOWZqOaKveixoeexu1xuICog5o+Q5L6b6YCa55So5Yqf6IO95ZKM5qGG5p6277yM5YW35L2T5YiG5p6Q55Sx5a2Q57G75a6e546wXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlU2xpZGVBbmFseXplciBpbXBsZW1lbnRzIFNsaWRlQ29udGVudEFuYWx5emVyIHtcbiAgLyoqXG4gICAqIOWIhuaekOW5u+eBr+eJh+WGheWuuVxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOWIhuaekOe7k+aenFxuICAgKi9cbiAgcHVibGljIGFzeW5jIGFuYWx5emUoc2xpZGU6IEdvb2dsZVNsaWRlKTogUHJvbWlzZTxTbGlkZUFuYWx5c2lzUmVzdWx0PiB7XG4gICAgLy8g6L+b6KGM5Z+65pys5bm754Gv54mH5YWD57Sg5YiG5p6QXG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmFuYWx5emVTbGlkZU1ldGFkYXRhKHNsaWRlKTtcbiAgICBjb25zdCBjb250ZW50VHlwZSA9IHRoaXMuZGV0ZXJtaW5lQ29udGVudFR5cGUoc2xpZGUpO1xuICAgIFxuICAgIC8vIOWIneWni+WMlue7k+aenFxuICAgIGNvbnN0IHJlc3VsdDogU2xpZGVBbmFseXNpc1Jlc3VsdCA9IHtcbiAgICAgIGNvbnRlbnRUeXBlLFxuICAgICAgcHJvamVjdFN0cnVjdHVyZTogUHJvamVjdFN0cnVjdHVyZVR5cGUuVU5LTk9XTixcbiAgICAgIHByb2plY3RGaWVsZHM6IFtdLFxuICAgICAgcHJvamVjdHM6IFtdLFxuICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgIG1ldGFkYXRhXG4gICAgfTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8g5YiG5p6Q6aG555uu57uT5p6EXG4gICAgICByZXN1bHQucHJvamVjdFN0cnVjdHVyZSA9IHRoaXMuYW5hbHl6ZVByb2plY3RTdHJ1Y3R1cmUoc2xpZGUpO1xuICAgICAgXG4gICAgICAvLyDov5vooYzlhbfkvZPlhoXlrrnliIbmnpDvvIznlLHlrZDnsbvlrp7njrBcbiAgICAgIGNvbnN0IGFuYWx5c2lzUmVzdWx0ID0gYXdhaXQgdGhpcy5hbmFseXplQ29udGVudChzbGlkZSwgY29udGVudFR5cGUpO1xuICAgICAgXG4gICAgICAvLyDlkIjlubbliIbmnpDnu5PmnpxcbiAgICAgIE9iamVjdC5hc3NpZ24ocmVzdWx0LCBhbmFseXNpc1Jlc3VsdCk7XG4gICAgICBcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+W5u+eBr+eJh+WIhuaekOmUmeivrzonLCBlcnJvcik7XG4gICAgICByZXN1bHQud2FybmluZ3MgPSBbYOWIhuaekOmUmeivrzogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YF07XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIpOaWreaYr+WQpuWPr+S7peWkhOeQhuatpOexu+Wei+eahOW5u+eBr+eJh1xuICAgKiDlrZDnsbvlupTor6Xph43lhpnmraTmlrnms5Xku6Xmj5DkvpvlhbfkvZPnmoTliKTmlq3pgLvovpFcbiAgICogQHBhcmFtIHNsaWRlIOW5u+eBr+eJh+WvueixoVxuICAgKiBAcmV0dXJucyDmmK/lkKblj6/ku6XlpITnkIZcbiAgICovXG4gIHB1YmxpYyBhYnN0cmFjdCBjYW5IYW5kbGUoc2xpZGU6IEdvb2dsZVNsaWRlKTogYm9vbGVhbjtcbiAgXG4gIC8qKlxuICAgKiDliIbmnpDlhbfkvZPlhoXlrrlcbiAgICog5a2Q57G76ZyA6KaB5a6e546w5q2k5pa55rOV6L+b6KGM5YW35L2T5YiG5p6Q6YC76L6RXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHBhcmFtIGNvbnRlbnRUeXBlIOWGheWuueexu+Wei1xuICAgKiBAcmV0dXJucyDpg6jliIbliIbmnpDnu5PmnpxcbiAgICovXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBhbmFseXplQ29udGVudChcbiAgICBzbGlkZTogR29vZ2xlU2xpZGUsIFxuICAgIGNvbnRlbnRUeXBlOiBTbGlkZUNvbnRlbnRUeXBlXG4gICk6IFByb21pc2U8UGFydGlhbDxTbGlkZUFuYWx5c2lzUmVzdWx0Pj47XG4gIFxuICAvKipcbiAgICog5YiG5p6Q5bm754Gv54mH5YWD5pWw5o2uXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5bm754Gv54mH5YWD5pWw5o2uXG4gICAqL1xuICBwcm90ZWN0ZWQgYW5hbHl6ZVNsaWRlTWV0YWRhdGEoc2xpZGU6IEdvb2dsZVNsaWRlKSB7XG4gICAgY29uc3QgcGFnZUVsZW1lbnRzID0gc2xpZGUucGFnZUVsZW1lbnRzIHx8IFtdO1xuICAgIFxuICAgIC8vIOiuoeaVsOS4jeWQjOexu+Wei+eahOWFg+e0oFxuICAgIGxldCB0YWJsZUNvdW50ID0gMDtcbiAgICBsZXQgdGV4dENvdW50ID0gMDtcbiAgICBsZXQgc2hhcGVDb3VudCA9IDA7XG4gICAgbGV0IGxpc3RDb3VudCA9IDA7XG4gICAgXG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIHBhZ2VFbGVtZW50cykge1xuICAgICAgaWYgKGVsZW1lbnQudGFibGUpIHRhYmxlQ291bnQrKztcbiAgICAgIGlmIChlbGVtZW50LnNoYXBlPy50ZXh0KSB7XG4gICAgICAgIHRleHRDb3VudCsrO1xuICAgICAgICAvLyDmo4Dmn6XmlofmnKzmmK/lkKbljIXlkKvliJfooahcbiAgICAgICAgaWYgKHRoaXMuY29udGFpbnNMaXN0KGVsZW1lbnQuc2hhcGUudGV4dC50ZXh0RWxlbWVudHMpKSB7XG4gICAgICAgICAgbGlzdENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChlbGVtZW50LnNoYXBlICYmICFlbGVtZW50LnNoYXBlLnRleHQpIHNoYXBlQ291bnQrKztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHNsaWRlSWQ6IHNsaWRlLm9iamVjdElkLFxuICAgICAgZWxlbWVudENvdW50OiBwYWdlRWxlbWVudHMubGVuZ3RoLFxuICAgICAgaGFzVGFibGU6IHRhYmxlQ291bnQgPiAwLFxuICAgICAgaGFzVGV4dDogdGV4dENvdW50ID4gMCxcbiAgICAgIGhhc1NoYXBlczogc2hhcGVDb3VudCA+IDAsXG4gICAgICBoYXNMaXN0czogbGlzdENvdW50ID4gMFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnoa7lrprlubvnga/niYflhoXlrrnnsbvlnotcbiAgICogQHBhcmFtIHNsaWRlIOW5u+eBr+eJh+WvueixoVxuICAgKiBAcmV0dXJucyDlhoXlrrnnsbvlnotcbiAgICovXG4gIHByb3RlY3RlZCBkZXRlcm1pbmVDb250ZW50VHlwZShzbGlkZTogR29vZ2xlU2xpZGUpOiBTbGlkZUNvbnRlbnRUeXBlIHtcbiAgICBjb25zdCBtZXRhZGF0YSA9IHRoaXMuYW5hbHl6ZVNsaWRlTWV0YWRhdGEoc2xpZGUpO1xuICAgIFxuICAgIGlmIChtZXRhZGF0YS5oYXNUYWJsZSkge1xuICAgICAgLy8g5aaC5p6c5pyJ6KGo5qC877yM5Y+v5Lul5piv6KGo5qC85oiW5re35ZCIXG4gICAgICByZXR1cm4gbWV0YWRhdGEuaGFzVGV4dCAmJiAhdGhpcy5pc1RhYmxlRG9taW5hbnQoc2xpZGUpIFxuICAgICAgICA/IFNsaWRlQ29udGVudFR5cGUuTUlYRUQgXG4gICAgICAgIDogU2xpZGVDb250ZW50VHlwZS5UQUJMRTtcbiAgICB9IGVsc2UgaWYgKG1ldGFkYXRhLmhhc0xpc3RzKSB7XG4gICAgICAvLyDlpoLmnpzmnInliJfooajkvYbmsqHmnInooajmoLxcbiAgICAgIHJldHVybiBTbGlkZUNvbnRlbnRUeXBlLkxJU1Q7XG4gICAgfSBlbHNlIGlmIChtZXRhZGF0YS5oYXNUZXh0KSB7XG4gICAgICAvLyDlpoLmnpzmnInmlofmnKzkvYbmsqHmnInooajmoLzlkozliJfooahcbiAgICAgIHJldHVybiBTbGlkZUNvbnRlbnRUeXBlLlRFWFQ7XG4gICAgfSBlbHNlIGlmIChtZXRhZGF0YS5oYXNTaGFwZXMpIHtcbiAgICAgIC8vIOWPquacieW9oueKtlxuICAgICAgcmV0dXJuIFNsaWRlQ29udGVudFR5cGUuU0hBUEU7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBTbGlkZUNvbnRlbnRUeXBlLlVOS05PV047XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliIbmnpDpobnnm67nu5PmnoTnsbvlnotcbiAgICogQHBhcmFtIHNsaWRlIOW5u+eBr+eJh+WvueixoVxuICAgKiBAcmV0dXJucyDpobnnm67nu5PmnoTnsbvlnotcbiAgICovXG4gIHByb3RlY3RlZCBhbmFseXplUHJvamVjdFN0cnVjdHVyZShzbGlkZTogR29vZ2xlU2xpZGUpOiBQcm9qZWN0U3RydWN0dXJlVHlwZSB7XG4gICAgLy8g5p+l5om+5bm754Gv54mH5qCH6aKY5oiW5paH5pys5YaF5a655Lit55qE5YWz6ZSu6K+NXG4gICAgY29uc3QgdGV4dENvbnRlbnQgPSB0aGlzLmV4dHJhY3RBbGxUZXh0Q29udGVudChzbGlkZSk7XG4gICAgY29uc3QgbG93ZXJUZXh0ID0gdGV4dENvbnRlbnQudG9Mb3dlckNhc2UoKTtcbiAgICBcbiAgICAvLyDmoLnmja7lhbPplK7or43liKTmlq3pobnnm67nu5PmnoTnsbvlnotcbiAgICBpZiAobG93ZXJUZXh0LmluY2x1ZGVzKCdzcHJpbnQnKSB8fCBsb3dlclRleHQuaW5jbHVkZXMoJ+i/reS7oycpIHx8IFxuICAgICAgICBsb3dlclRleHQuaW5jbHVkZXMoJ2l0ZXJhdGlvbicpIHx8IGxvd2VyVGV4dC5pbmNsdWRlcygn5ZGo5oqlJykpIHtcbiAgICAgIHJldHVybiBQcm9qZWN0U3RydWN0dXJlVHlwZS5TUFJJTlQ7XG4gICAgfSBlbHNlIGlmIChsb3dlclRleHQuaW5jbHVkZXMoJ2VwaWMnKSB8fCBsb3dlclRleHQuaW5jbHVkZXMoJ+eJueaApycpIHx8IFxuICAgICAgICAgICAgICAgbG93ZXJUZXh0LmluY2x1ZGVzKCdmZWF0dXJlJykpIHtcbiAgICAgIHJldHVybiBQcm9qZWN0U3RydWN0dXJlVHlwZS5FUElDO1xuICAgIH0gZWxzZSBpZiAobG93ZXJUZXh0LmluY2x1ZGVzKCdyZWxlYXNlJykgfHwgbG93ZXJUZXh0LmluY2x1ZGVzKCflj5HluIMnKSB8fCBcbiAgICAgICAgICAgICAgIGxvd2VyVGV4dC5pbmNsdWRlcygn54mI5pysJykpIHtcbiAgICAgIHJldHVybiBQcm9qZWN0U3RydWN0dXJlVHlwZS5SRUxFQVNFO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb250YWluc011bHRpcGxlSmlyYVRpY2tldHModGV4dENvbnRlbnQpKSB7XG4gICAgICAvLyDlpoLmnpzmo4DmtYvliLDlpJrkuKpKaXJh5bel5Y2VSUTvvIzkvYbmsqHmnInlhbbku5blhbPplK7or43vvIzpu5jorqTkuLrmt7flkIjnu5PmnoRcbiAgICAgIHJldHVybiBQcm9qZWN0U3RydWN0dXJlVHlwZS5NSVhFRDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29udGFpbnNTaW5nbGVKaXJhVGlja2V0KHRleHRDb250ZW50KSkge1xuICAgICAgLy8g5aaC5p6c5Y+q5qOA5rWL5Yiw5LiA5LiqSmlyYeW3peWNlUlEXG4gICAgICByZXR1cm4gUHJvamVjdFN0cnVjdHVyZVR5cGUuU0lOR0xFX1RJQ0tFVDtcbiAgICB9XG4gICAgXG4gICAgLy8g6buY6K6k5Li66Ieq5a6a5LmJ57uT5p6EXG4gICAgcmV0dXJuIFByb2plY3RTdHJ1Y3R1cmVUeXBlLkNVU1RPTTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaPkOWPluW5u+eBr+eJh+aJgOacieaWh+acrOWGheWuuVxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOaJgOacieaWh+acrOWGheWuuVxuICAgKi9cbiAgcHJvdGVjdGVkIGV4dHJhY3RBbGxUZXh0Q29udGVudChzbGlkZTogR29vZ2xlU2xpZGUpOiBzdHJpbmcge1xuICAgIGNvbnN0IHRleHRDb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGlmICghc2xpZGUucGFnZUVsZW1lbnRzKSByZXR1cm4gJyc7XG4gICAgXG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIHNsaWRlLnBhZ2VFbGVtZW50cykge1xuICAgICAgLy8g5LuO6KGo5qC85Lit5o+Q5Y+W5paH5pysXG4gICAgICBpZiAoZWxlbWVudC50YWJsZSAmJiBlbGVtZW50LnRhYmxlLnRhYmxlUm93cykge1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiBlbGVtZW50LnRhYmxlLnRhYmxlUm93cykge1xuICAgICAgICAgIGlmICghcm93LnRhYmxlQ2VsbHMpIGNvbnRpbnVlO1xuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgY2VsbCBvZiByb3cudGFibGVDZWxscykge1xuICAgICAgICAgICAgaWYgKCFjZWxsLnRleHQgfHwgIWNlbGwudGV4dC50ZXh0RWxlbWVudHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjZWxsVGV4dCA9IGNlbGwudGV4dC50ZXh0RWxlbWVudHNcbiAgICAgICAgICAgICAgLm1hcChlID0+IGUudGV4dFJ1bj8uY29udGVudCB8fCAnJylcbiAgICAgICAgICAgICAgLmpvaW4oJycpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoY2VsbFRleHQudHJpbSgpKSB7XG4gICAgICAgICAgICAgIHRleHRDb250ZW50LnB1c2goY2VsbFRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDku47lvaLnirbkuK3mj5Dlj5bmlofmnKxcbiAgICAgIGlmIChlbGVtZW50LnNoYXBlICYmIGVsZW1lbnQuc2hhcGUudGV4dCAmJiBlbGVtZW50LnNoYXBlLnRleHQudGV4dEVsZW1lbnRzKSB7XG4gICAgICAgIGNvbnN0IHNoYXBlVGV4dCA9IGVsZW1lbnQuc2hhcGUudGV4dC50ZXh0RWxlbWVudHNcbiAgICAgICAgICAubWFwKGUgPT4gZS50ZXh0UnVuPy5jb250ZW50IHx8ICcnKVxuICAgICAgICAgIC5qb2luKCcnKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzaGFwZVRleHQudHJpbSgpKSB7XG4gICAgICAgICAgdGV4dENvbnRlbnQucHVzaChzaGFwZVRleHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0ZXh0Q29udGVudC5qb2luKCdcXG4nKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpeaYr+WQpuWMheWQq+WNleS4qkppcmHlt6XljZVcbiAgICogQHBhcmFtIHRleHQg5paH5pys5YaF5a65XG4gICAqIEByZXR1cm5zIOaYr+WQpuWMheWQq+WNleS4qkppcmHlt6XljZVcbiAgICovXG4gIHByb3RlY3RlZCBjb250YWluc1NpbmdsZUppcmFUaWNrZXQodGV4dDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgamlyYVRpY2tldFBhdHRlcm4gPSAvW0EtWl0rLVxcZCsvZztcbiAgICBjb25zdCBtYXRjaGVzID0gdGV4dC5tYXRjaChqaXJhVGlja2V0UGF0dGVybik7XG4gICAgcmV0dXJuIG1hdGNoZXMgIT09IG51bGwgJiYgbWF0Y2hlcy5sZW5ndGggPT09IDE7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmmK/lkKbljIXlkKvlpJrkuKpKaXJh5bel5Y2VXG4gICAqIEBwYXJhbSB0ZXh0IOaWh+acrOWGheWuuVxuICAgKiBAcmV0dXJucyDmmK/lkKbljIXlkKvlpJrkuKpKaXJh5bel5Y2VXG4gICAqL1xuICBwcm90ZWN0ZWQgY29udGFpbnNNdWx0aXBsZUppcmFUaWNrZXRzKHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGppcmFUaWNrZXRQYXR0ZXJuID0gL1tBLVpdKy1cXGQrL2c7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHRleHQubWF0Y2goamlyYVRpY2tldFBhdHRlcm4pO1xuICAgIHJldHVybiBtYXRjaGVzICE9PSBudWxsICYmIG1hdGNoZXMubGVuZ3RoID4gMTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpeaWh+acrOWFg+e0oOaYr+WQpuWMheWQq+WIl+ihqFxuICAgKiBAcGFyYW0gdGV4dEVsZW1lbnRzIOaWh+acrOWFg+e0oOaVsOe7hFxuICAgKiBAcmV0dXJucyDmmK/lkKbljIXlkKvliJfooahcbiAgICovXG4gIHByb3RlY3RlZCBjb250YWluc0xpc3QodGV4dEVsZW1lbnRzPzogR29vZ2xlVGV4dEVsZW1lbnRbXSk6IGJvb2xlYW4ge1xuICAgIGlmICghdGV4dEVsZW1lbnRzKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgcmV0dXJuIHRleHRFbGVtZW50cy5zb21lKGVsZW1lbnQgPT4gXG4gICAgICBlbGVtZW50LnBhcmFncmFwaE1hcmtlcj8uc3R5bGU/LmJ1bGxldFByZXNldCAhPT0gdW5kZWZpbmVkXG4gICAgKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIpOaWreihqOagvOaYr+WQpuaYr+W5u+eBr+eJh+eahOS4u+imgeWGheWuuVxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOihqOagvOaYr+WQpuS4uuS4u+imgeWGheWuuVxuICAgKi9cbiAgcHJvdGVjdGVkIGlzVGFibGVEb21pbmFudChzbGlkZTogR29vZ2xlU2xpZGUpOiBib29sZWFuIHtcbiAgICBpZiAoIXNsaWRlLnBhZ2VFbGVtZW50cykgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGNvbnN0IHRvdGFsRWxlbWVudHMgPSBzbGlkZS5wYWdlRWxlbWVudHMubGVuZ3RoO1xuICAgIGNvbnN0IHRhYmxlRWxlbWVudHMgPSBzbGlkZS5wYWdlRWxlbWVudHMuZmlsdGVyKGUgPT4gZS50YWJsZSkubGVuZ3RoO1xuICAgIFxuICAgIC8vIOWmguaenOihqOagvOWFg+e0oOWNoOavlOi2hei/hzUwJe+8jOaIluiAheWPquacieS4gOS4quihqOagvOWSjOWwkemHj+WFtuS7luWFg+e0oFxuICAgIHJldHVybiAodGFibGVFbGVtZW50cyAvIHRvdGFsRWxlbWVudHMgPiAwLjUpIHx8IFxuICAgICAgICAgICAodGFibGVFbGVtZW50cyA9PT0gMSAmJiB0b3RhbEVsZW1lbnRzIDw9IDMpO1xuICB9XG4gIFxuICAvKipcbiAgICog5LuO5paH5pys5Lit5o+Q5Y+W5omA5pyJSmlyYeW3peWNlUlEXG4gICAqIEBwYXJhbSB0ZXh0IOaWh+acrOWGheWuuVxuICAgKiBAcmV0dXJucyBKaXJh5bel5Y2VSUTmlbDnu4RcbiAgICovXG4gIHByb3RlY3RlZCBleHRyYWN0SmlyYVRpY2tldHModGV4dDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGppcmFUaWNrZXRQYXR0ZXJuID0gL1tBLVpdKy1cXGQrL2c7XG4gICAgcmV0dXJuIHRleHQubWF0Y2goamlyYVRpY2tldFBhdHRlcm4pIHx8IFtdO1xuICB9XG59ICIsIi8qKlxuICog5bm754Gv54mH5YiG5p6Q5Zmo5o6l5Y+j5a6a5LmJXG4gKi9cblxuaW1wb3J0IHsgR29vZ2xlU2xpZGUsIEdvb2dsZVBhZ2VFbGVtZW50IH0gZnJvbSAnLi9nb29nbGVTbGlkZXMnO1xuaW1wb3J0IHsgUHJvamVjdERhdGEgfSBmcm9tICcuLi9zbGlkZSc7XG5cbi8qKlxuICog5bm754Gv54mH5YaF5a6557G75Z6L5p6a5Li+XG4gKi9cbmV4cG9ydCBlbnVtIFNsaWRlQ29udGVudFR5cGUge1xuICBUQUJMRSA9ICd0YWJsZScsXG4gIFRFWFQgPSAndGV4dCcsXG4gIFNIQVBFID0gJ3NoYXBlJyxcbiAgTElTVCA9ICdsaXN0JyxcbiAgTUlYRUQgPSAnbWl4ZWQnLFxuICBVTktOT1dOID0gJ3Vua25vd24nXG59XG5cbi8qKlxuICog6aG555uu57uT5p6E57G75Z6L5p6a5Li+XG4gKi9cbmV4cG9ydCBlbnVtIFByb2plY3RTdHJ1Y3R1cmVUeXBlIHtcbiAgU0lOR0xFX1RJQ0tFVCA9ICdzaW5nbGVfdGlja2V0JywgIC8vIOWNleS4qkppcmHlt6XljZVcbiAgU1BSSU5UID0gJ3NwcmludCcsICAgICAgICAgICAgICAgIC8vIFNwcmludC/ov63ku6NcbiAgRVBJQyA9ICdlcGljJywgICAgICAgICAgICAgICAgICAgIC8vIEVwaWMv54m55oCnXG4gIFJFTEVBU0UgPSAncmVsZWFzZScsICAgICAgICAgICAgICAvLyDlj5HluINcbiAgTUlYRUQgPSAnbWl4ZWQnLCAgICAgICAgICAgICAgICAgIC8vIOa3t+WQiOe7k+aehFxuICBDVVNUT00gPSAnY3VzdG9tJywgICAgICAgICAgICAgICAgLy8g6Ieq5a6a5LmJ57uT5p6EXG4gIFVOS05PV04gPSAndW5rbm93bicgICAgICAgICAgICAgICAvLyDmnKrnn6Xnu5PmnoRcbn1cblxuLyoqXG4gKiDlubvnga/niYflhoXlrrnliIbmnpDnu5PmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTbGlkZUFuYWx5c2lzUmVzdWx0IHtcbiAgY29udGVudFR5cGU6IFNsaWRlQ29udGVudFR5cGU7XG4gIHByb2plY3RTdHJ1Y3R1cmU6IFByb2plY3RTdHJ1Y3R1cmVUeXBlO1xuICBwcm9qZWN0RmllbGRzOiBzdHJpbmdbXTtcbiAgcHJvamVjdHM6IFByb2plY3REYXRhW107XG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgbWV0YWRhdGE6IHtcbiAgICBzbGlkZUlkOiBzdHJpbmc7XG4gICAgZWxlbWVudENvdW50OiBudW1iZXI7XG4gICAgaGFzVGFibGU6IGJvb2xlYW47XG4gICAgaGFzVGV4dDogYm9vbGVhbjtcbiAgICBoYXNTaGFwZXM6IGJvb2xlYW47XG4gICAgaGFzTGlzdHM6IGJvb2xlYW47XG4gIH07XG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG59XG5cbi8qKlxuICog5bm754Gv54mH5YaF5a655YiG5p6Q5Zmo5o6l5Y+jXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2xpZGVDb250ZW50QW5hbHl6ZXIge1xuICAvKipcbiAgICog5YiG5p6Q5bm754Gv54mH5YaF5a65XG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5YiG5p6Q57uT5p6cXG4gICAqL1xuICBhbmFseXplKHNsaWRlOiBHb29nbGVTbGlkZSk6IFByb21pc2U8U2xpZGVBbmFseXNpc1Jlc3VsdD47XG4gIFxuICAvKipcbiAgICog5Yik5pat5piv5ZCm5Y+v5Lul5aSE55CG5q2k57G75Z6L55qE5bm754Gv54mHXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5piv5ZCm5Y+v5Lul5aSE55CGXG4gICAqL1xuICBjYW5IYW5kbGUoc2xpZGU6IEdvb2dsZVNsaWRlKTogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDooajmoLzlhoXlrrnliIbmnpDlmajmjqXlj6NcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUYWJsZUNvbnRlbnRBbmFseXplciBleHRlbmRzIFNsaWRlQ29udGVudEFuYWx5emVyIHtcbiAgLyoqXG4gICAqIOWIhuaekOihqOagvOe7k+aehFxuICAgKiBAcGFyYW0gdGFibGVFbGVtZW50IOihqOagvOWFg+e0oFxuICAgKiBAcmV0dXJucyDooajmoLzliIbmnpDnu5PmnpxcbiAgICovXG4gIGFuYWx5emVUYWJsZSh0YWJsZUVsZW1lbnQ6IEdvb2dsZVBhZ2VFbGVtZW50KTogUHJvbWlzZTx7XG4gICAgaGVhZGVyczogc3RyaW5nW107XG4gICAgY29sdW1uTWFwcGluZzogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgICBwcm9qZWN0Um93czogUHJvamVjdERhdGFbXTtcbiAgfT47XG59XG5cbi8qKlxuICog5paH5pys5YaF5a655YiG5p6Q5Zmo5o6l5Y+jXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVGV4dENvbnRlbnRBbmFseXplciBleHRlbmRzIFNsaWRlQ29udGVudEFuYWx5emVyIHtcbiAgLyoqXG4gICAqIOWIhuaekOaWh+acrOWGheWuuVxuICAgKiBAcGFyYW0gdGV4dEVsZW1lbnRzIOaWh+acrOWFg+e0oOaVsOe7hFxuICAgKiBAcmV0dXJucyDmlofmnKzliIbmnpDnu5PmnpxcbiAgICovXG4gIGFuYWx5emVUZXh0RWxlbWVudHModGV4dEVsZW1lbnRzOiBHb29nbGVQYWdlRWxlbWVudFtdKTogUHJvbWlzZTx7XG4gICAgcHJvamVjdEZpZWxkczogc3RyaW5nW107XG4gICAgcHJvamVjdHM6IFByb2plY3REYXRhW107XG4gIH0+O1xufVxuXG4vKipcbiAqIOWFg+e0oOW8leeUqOiusOW9lVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVsZW1lbnRSZWZlcmVuY2Uge1xuICBzbGlkZUlkOiBzdHJpbmc7XG4gIGVsZW1lbnRJZDogc3RyaW5nO1xuICBlbGVtZW50VHlwZTogc3RyaW5nO1xuICBjb250ZW50UGF0aD86IHN0cmluZ1tdOyAvLyDnlKjkuo7lrprkvY3lhYPntKDlhoXnmoTnibnlrprlhoXlrrlcbn1cblxuLyoqXG4gKiDluKbmnInlhYPntKDlvJXnlKjnmoTpobnnm67mlbDmja5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9qZWN0RGF0YVdpdGhSZWZlcmVuY2VzIGV4dGVuZHMgUHJvamVjdERhdGEge1xuICBlbGVtZW50UmVmZXJlbmNlczogUmVjb3JkPHN0cmluZywgRWxlbWVudFJlZmVyZW5jZT47IC8vIOWtl+auteWQjeWIsOWFg+e0oOW8leeUqOeahOaYoOWwhFxufVxuXG4vKipcbiAqIOmhueebruWtl+auteW7uuiurlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByb2plY3RGaWVsZFN1Z2dlc3Rpb24ge1xuICBmaWVsZE5hbWU6IHN0cmluZztcbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICBwb3NzaWJsZVZhbHVlcz86IHN0cmluZ1tdO1xuICBpc1JlcXVpcmVkPzogYm9vbGVhbjtcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbi8qKlxuICog5bm754Gv54mH5YiG5p6Q5Zmo5bel5Y6C5o6l5Y+jXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2xpZGVBbmFseXplckZhY3Rvcnkge1xuICAvKipcbiAgICog5Yib5bu65ZCI6YCC55qE5YiG5p6Q5ZmoXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg6YCC5ZCI55qE5YiG5p6Q5ZmoXG4gICAqL1xuICBjcmVhdGVBbmFseXplcihzbGlkZTogR29vZ2xlU2xpZGUpOiBTbGlkZUNvbnRlbnRBbmFseXplcjtcbn0gIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIvKipcbiAqIOaWh+acrOWGheWuueWIhuaekOWZqOWunueOsFxuICovXG5cbmltcG9ydCB7IEdvb2dsZVNsaWRlLCBHb29nbGVQYWdlRWxlbWVudCwgR29vZ2xlVGV4dEVsZW1lbnQsIEdvb2dsZVNoYXBlIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9nb29nbGVTbGlkZXMnO1xuaW1wb3J0IHsgXG4gIFNsaWRlQ29udGVudFR5cGUsIFxuICBUZXh0Q29udGVudEFuYWx5emVyLCBcbiAgU2xpZGVBbmFseXNpc1Jlc3VsdCBcbn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9zbGlkZUFuYWx5emVyJztcbmltcG9ydCB7IEJhc2VTbGlkZUFuYWx5emVyIH0gZnJvbSAnLi9iYXNlQW5hbHl6ZXInO1xuaW1wb3J0IHsgUHJvamVjdERhdGEgfSBmcm9tICcuLi9zbGlkZSc7XG5cbi8qKlxuICog5paH5pys57uT5p6E57G75Z6LXG4gKi9cbmVudW0gVGV4dFN0cnVjdHVyZVR5cGUge1xuICBQQVJBR1JBUEggPSAncGFyYWdyYXBoJyxcbiAgQlVMTEVUX0xJU1QgPSAnYnVsbGV0X2xpc3QnLFxuICBOVU1CRVJFRF9MSVNUID0gJ251bWJlcmVkX2xpc3QnLFxuICBNSVhFRCA9ICdtaXhlZCdcbn1cblxuLyoqXG4gKiDmlofmnKzlnZfkv6Hmga9cbiAqL1xuaW50ZXJmYWNlIFRleHRCbG9jayB7XG4gIGVsZW1lbnRJZDogc3RyaW5nO1xuICBjb250ZW50OiBzdHJpbmc7XG4gIHR5cGU6IFRleHRTdHJ1Y3R1cmVUeXBlO1xuICBsZXZlbDogbnVtYmVyO1xuICBmb250U2l6ZT86IG51bWJlcjtcbiAgaXNCb2xkPzogYm9vbGVhbjtcbiAgaXNUaXRsZT86IGJvb2xlYW47XG4gIGluZGV4OiBudW1iZXI7XG4gIGNoaWxkcmVuPzogVGV4dEJsb2NrW107XG59XG5cbi8qKlxuICog5paH5pys5YaF5a655YiG5p6Q5Zmo57G7XG4gKiDlpITnkIbln7rkuo7mlofmnKzlkozliJfooajnmoTpobnnm67kv6Hmga9cbiAqL1xuZXhwb3J0IGNsYXNzIFRleHRDb250ZW50QW5hbHl6ZXJJbXBsIGV4dGVuZHMgQmFzZVNsaWRlQW5hbHl6ZXIgaW1wbGVtZW50cyBUZXh0Q29udGVudEFuYWx5emVyIHtcbiAgLy8gSmlyYeW3peWNlUlE5qih5byPXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEpJUkFfVElDS0VUX1BBVFRFUk4gPSAvKFtBLVpdKy1cXGQrKS87XG4gIFxuICAvLyDpobnnm67nirbmgIHlhbPplK7or43lkozmraPliJnooajovr7lvI9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU1RBVFVTX1BBVFRFUk5TID0gW1xuICAgIC/nirbmgIFbOu+8ml1cXHMqKFteLO+8jOOAglxcbl0rKS9pLFxuICAgIC9zdGF0dXNbOu+8ml1cXHMqKFteLO+8jOOAglxcbl0rKS9pLFxuICAgIC9cXFso6L+b6KGM5LitfOWujOaIkHzlvoXlip586Zi75aGefOW7tuacn3zlj5bmtogpXFxdL2ksXG4gICAgL1xcWyhpbiBwcm9ncmVzc3xkb25lfHRvZG98YmxvY2tlZHxkZWxheWVkfGNhbmNlbGxlZClcXF0vaVxuICBdO1xuICBcbiAgLy8g6LSf6LSj5Lq65YWz6ZSu6K+N5ZKM5q2j5YiZ6KGo6L6+5byPXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE9XTkVSX1BBVFRFUk5TID0gW1xuICAgIC/otJ/otKPkurpbOu+8ml1cXHMqKFteLO+8jOOAglxcbl0rKS9pLFxuICAgIC9vd25lcls677yaXVxccyooW14s77yM44CCXFxuXSspL2ksXG4gICAgL+i0o+S7u+S6uls677yaXVxccyooW14s77yM44CCXFxuXSspL2ksXG4gICAgL2Fzc2lnbmVlWzrvvJpdXFxzKihbXizvvIzjgIJcXG5dKykvaSxcbiAgICAvQChbXlxcc10rKS9cbiAgXTtcbiAgXG4gIC8vIOi1m+mBky/lm6LpmJ/lhbPplK7or43lkozmraPliJnooajovr7lvI9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVFJBQ0tfUEFUVEVSTlMgPSBbXG4gICAgL+i1m+mBk1s677yaXVxccyooW14s77yM44CCXFxuXSspL2ksXG4gICAgL+WboumYn1s677yaXVxccyooW14s77yM44CCXFxuXSspL2ksXG4gICAgL3RyYWNrWzrvvJpdXFxzKihbXizvvIzjgIJcXG5dKykvaSxcbiAgICAvdGVhbVs677yaXVxccyooW14s77yM44CCXFxuXSspL2lcbiAgXTtcblxuICAvKipcbiAgICog5Yik5pat5piv5ZCm5Y+v5Lul5aSE55CG5q2k57G75Z6L55qE5bm754Gv54mHXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5piv5ZCm5Y+v5Lul5aSE55CGXG4gICAqL1xuICBwdWJsaWMgY2FuSGFuZGxlKHNsaWRlOiBHb29nbGVTbGlkZSk6IGJvb2xlYW4ge1xuICAgIGlmICghc2xpZGUucGFnZUVsZW1lbnRzKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmFuYWx5emVTbGlkZU1ldGFkYXRhKHNsaWRlKTtcbiAgICBjb25zdCBjb250ZW50VHlwZSA9IHRoaXMuZGV0ZXJtaW5lQ29udGVudFR5cGUoc2xpZGUpO1xuICAgIFxuICAgIC8vIOiDveWkhOeQhuaWh+acrOOAgeWIl+ihqOaIlua3t+WQiCjkvYbkuI3ku6XooajmoLzkuLrkuLsp55qE5bm754Gv54mHXG4gICAgcmV0dXJuIGNvbnRlbnRUeXBlID09PSBTbGlkZUNvbnRlbnRUeXBlLlRFWFQgfHxcbiAgICAgICAgICAgY29udGVudFR5cGUgPT09IFNsaWRlQ29udGVudFR5cGUuTElTVCB8fFxuICAgICAgICAgICAoY29udGVudFR5cGUgPT09IFNsaWRlQ29udGVudFR5cGUuTUlYRUQgJiYgIW1ldGFkYXRhLmhhc1RhYmxlKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIhuaekOaWh+acrOWGheWuuVxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEBwYXJhbSBjb250ZW50VHlwZSDlhoXlrrnnsbvlnotcbiAgICogQHJldHVybnMg5YiG5p6Q57uT5p6cXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYW5hbHl6ZUNvbnRlbnQoXG4gICAgc2xpZGU6IEdvb2dsZVNsaWRlLCBcbiAgICBjb250ZW50VHlwZTogU2xpZGVDb250ZW50VHlwZVxuICApOiBQcm9taXNlPFBhcnRpYWw8U2xpZGVBbmFseXNpc1Jlc3VsdD4+IHtcbiAgICBpZiAoIXNsaWRlLnBhZ2VFbGVtZW50cykge1xuICAgICAgcmV0dXJuIHsgcHJvamVjdHM6IFtdLCBjb25maWRlbmNlOiAwIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOiOt+WPluaJgOacieaWh+acrOWFg+e0oFxuICAgIGNvbnN0IHRleHRFbGVtZW50cyA9IHNsaWRlLnBhZ2VFbGVtZW50cy5maWx0ZXIoZWxlbWVudCA9PiBcbiAgICAgIChlbGVtZW50LnNoYXBlICYmIGVsZW1lbnQuc2hhcGUudGV4dCkgfHwgXG4gICAgICAoZWxlbWVudC50YWJsZSAmJiBlbGVtZW50LnRhYmxlLnRhYmxlUm93cylcbiAgICApO1xuICAgIFxuICAgIGlmICh0ZXh0RWxlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4geyBwcm9qZWN0czogW10sIGNvbmZpZGVuY2U6IDAgfTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIOWIhuaekOaWh+acrOWFg+e0oFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5hbmFseXplVGV4dEVsZW1lbnRzKHRleHRFbGVtZW50cyk7XG4gICAgICBcbiAgICAgIC8vIOiuoeeul+e9ruS/oeW6plxuICAgICAgY29uc3QgY29uZmlkZW5jZSA9IHRoaXMuY2FsY3VsYXRlVGV4dENvbmZpZGVuY2UocmVzdWx0LnByb2plY3RzKTtcbiAgICAgIFxuICAgICAgLy8g55Sf5oiQ6K2m5ZGKXG4gICAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGlmIChjb25maWRlbmNlIDwgMC40KSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ+aWh+acrOe7k+aehOivhuWIq+e9ruS/oeW6pui+g+S9ju+8jOWPr+iDveaXoOazleWHhuehruaPkOWPluaJgOaciemhueebruS/oeaBrycpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAocmVzdWx0LnByb2plY3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKCfmnKrog73ku47mlofmnKzkuK3mj5Dlj5bpobnnm67mlbDmja7vvIzor7fmo4Dmn6Xlubvnga/niYflhoXlrrnmoLzlvI8nKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJvamVjdHM6IHJlc3VsdC5wcm9qZWN0cyxcbiAgICAgICAgcHJvamVjdEZpZWxkczogcmVzdWx0LnByb2plY3RGaWVsZHMsXG4gICAgICAgIGNvbmZpZGVuY2UsXG4gICAgICAgIHdhcm5pbmdzOiB3YXJuaW5ncy5sZW5ndGggPiAwID8gd2FybmluZ3MgOiB1bmRlZmluZWRcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+aWh+acrOWIhuaekOmUmeivrzonLCBlcnJvcik7XG4gICAgICByZXR1cm4geyBcbiAgICAgICAgcHJvamVjdHM6IFtdLCBcbiAgICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgICAgd2FybmluZ3M6IFtg5paH5pys5YiG5p6Q6ZSZ6K+vOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXVxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliIbmnpDmlofmnKzlhYPntKBcbiAgICogQHBhcmFtIGVsZW1lbnRzIOmhtemdouWFg+e0oOaVsOe7hFxuICAgKiBAcmV0dXJucyDmlofmnKzliIbmnpDnu5PmnpxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBhbmFseXplVGV4dEVsZW1lbnRzKGVsZW1lbnRzOiBHb29nbGVQYWdlRWxlbWVudFtdKTogUHJvbWlzZTx7XG4gICAgcHJvamVjdEZpZWxkczogc3RyaW5nW107XG4gICAgcHJvamVjdHM6IFByb2plY3REYXRhW107XG4gIH0+IHtcbiAgICAvLyDmj5Dlj5bmlofmnKzlnZdcbiAgICBjb25zdCB0ZXh0QmxvY2tzID0gdGhpcy5leHRyYWN0VGV4dEJsb2NrcyhlbGVtZW50cyk7XG4gICAgXG4gICAgLy8g5p6E5bu65paH5pys57uT5p6E5qCRXG4gICAgY29uc3Qgc3RydWN0dXJlZEJsb2NrcyA9IHRoaXMuYnVpbGRUZXh0U3RydWN0dXJlVHJlZSh0ZXh0QmxvY2tzKTtcbiAgICBcbiAgICAvLyDmoLnmja7nu5PmnoTmj5Dlj5bpobnnm65cbiAgICBjb25zdCBwcm9qZWN0cyA9IHRoaXMuZXh0cmFjdFByb2plY3RzRnJvbVRleHRTdHJ1Y3R1cmUoc3RydWN0dXJlZEJsb2Nrcyk7XG4gICAgXG4gICAgLy8g56Gu5a6a6aG555uu5YWx5pyJ5a2X5q61XG4gICAgY29uc3QgcHJvamVjdEZpZWxkcyA9IHRoaXMuZGV0ZXJtaW5lQ29tbW9uRmllbGRzKHByb2plY3RzKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcHJvamVjdEZpZWxkcyxcbiAgICAgIHByb2plY3RzXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOS7jumhtemdouWFg+e0oOS4reaPkOWPluaWh+acrOWdl1xuICAgKiBAcGFyYW0gZWxlbWVudHMg6aG16Z2i5YWD57Sg5pWw57uEXG4gICAqIEByZXR1cm5zIOaWh+acrOWdl+aVsOe7hFxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0VGV4dEJsb2NrcyhlbGVtZW50czogR29vZ2xlUGFnZUVsZW1lbnRbXSk6IFRleHRCbG9ja1tdIHtcbiAgICBjb25zdCBibG9ja3M6IFRleHRCbG9ja1tdID0gW107XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcbiAgICAgIC8vIOWkhOeQhuW9oueKtuS4reeahOaWh+acrFxuICAgICAgaWYgKGVsZW1lbnQuc2hhcGUgJiYgZWxlbWVudC5zaGFwZS50ZXh0ICYmIGVsZW1lbnQuc2hhcGUudGV4dC50ZXh0RWxlbWVudHMpIHtcbiAgICAgICAgY29uc3Qgc2hhcGVCbG9ja3MgPSB0aGlzLmV4dHJhY3RUZXh0QmxvY2tzRnJvbVNoYXBlKGVsZW1lbnQuc2hhcGUsIGVsZW1lbnQub2JqZWN0SWQsIGluZGV4KTtcbiAgICAgICAgYmxvY2tzLnB1c2goLi4uc2hhcGVCbG9ja3MpO1xuICAgICAgICBpbmRleCArPSBzaGFwZUJsb2Nrcy5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBibG9ja3M7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDku47lvaLnirbkuK3mj5Dlj5bmlofmnKzlnZdcbiAgICogQHBhcmFtIHNoYXBlIOW9oueKtuWvueixoVxuICAgKiBAcGFyYW0gZWxlbWVudElkIOWFg+e0oElEXG4gICAqIEBwYXJhbSBzdGFydEluZGV4IOi1t+Wni+e0ouW8lVxuICAgKiBAcmV0dXJucyDmlofmnKzlnZfmlbDnu4RcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdFRleHRCbG9ja3NGcm9tU2hhcGUoc2hhcGU6IEdvb2dsZVNoYXBlLCBlbGVtZW50SWQ6IHN0cmluZywgc3RhcnRJbmRleDogbnVtYmVyKTogVGV4dEJsb2NrW10ge1xuICAgIGNvbnN0IGJsb2NrczogVGV4dEJsb2NrW10gPSBbXTtcbiAgICBcbiAgICBpZiAoIXNoYXBlLnRleHQgfHwgIXNoYXBlLnRleHQudGV4dEVsZW1lbnRzKSB7XG4gICAgICByZXR1cm4gYmxvY2tzO1xuICAgIH1cbiAgICBcbiAgICBsZXQgY3VycmVudEJsb2NrOiBUZXh0QmxvY2sgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudENvbnRlbnQ6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGN1cnJlbnRUeXBlID0gVGV4dFN0cnVjdHVyZVR5cGUuUEFSQUdSQVBIO1xuICAgIGxldCBjdXJyZW50TGV2ZWwgPSAwO1xuICAgIGxldCBpc0JvbGQgPSBmYWxzZTtcbiAgICBsZXQgZm9udFNpemUgPSAwO1xuICAgIFxuICAgIC8vIOmBjeWOhuaWh+acrOWFg+e0oFxuICAgIGZvciAoY29uc3QgdGV4dEVsZW1lbnQgb2Ygc2hhcGUudGV4dC50ZXh0RWxlbWVudHMpIHtcbiAgICAgIC8vIOWkhOeQhuauteiQveagh+iusFxuICAgICAgaWYgKHRleHRFbGVtZW50LnBhcmFncmFwaE1hcmtlcikge1xuICAgICAgICAvLyDlpoLmnpzlt7Lnu4/mnInlhoXlrrnvvIzkv53lrZjlvZPliY3lnZdcbiAgICAgICAgaWYgKGN1cnJlbnRDb250ZW50Lmxlbmd0aCA+IDAgJiYgY3VycmVudEJsb2NrKSB7XG4gICAgICAgICAgY3VycmVudEJsb2NrLmNvbnRlbnQgPSBjdXJyZW50Q29udGVudC5qb2luKCcnKS50cmltKCk7XG4gICAgICAgICAgaWYgKGN1cnJlbnRCbG9jay5jb250ZW50KSB7XG4gICAgICAgICAgICBibG9ja3MucHVzaChjdXJyZW50QmxvY2spO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5byA5aeL5paw5Z2XXG4gICAgICAgIGN1cnJlbnRDb250ZW50ID0gW107XG4gICAgICAgIFxuICAgICAgICAvLyDnoa7lrprlnZfnsbvlnotcbiAgICAgICAgaWYgKHRleHRFbGVtZW50LnBhcmFncmFwaE1hcmtlci5zdHlsZT8uYnVsbGV0UHJlc2V0KSB7XG4gICAgICAgICAgY3VycmVudFR5cGUgPSBUZXh0U3RydWN0dXJlVHlwZS5CVUxMRVRfTElTVDtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDmoLnmja7nvKnov5vnoa7lrprnuqfliKtcbiAgICAgICAgICBjb25zdCBpbmRlbnQgPSB0ZXh0RWxlbWVudC5wYXJhZ3JhcGhNYXJrZXIuc3R5bGUuaW5kZW50Py5tYWduaXR1ZGUgfHwgMDtcbiAgICAgICAgICBjdXJyZW50TGV2ZWwgPSBNYXRoLmZsb29yKGluZGVudCAvIDIwKTsgLy8g5YGH6K6+5q+P57qn57yp6L+bMjDljZXkvY1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50VHlwZSA9IFRleHRTdHJ1Y3R1cmVUeXBlLlBBUkFHUkFQSDtcbiAgICAgICAgICBjdXJyZW50TGV2ZWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjdXJyZW50QmxvY2sgPSB7XG4gICAgICAgICAgZWxlbWVudElkLFxuICAgICAgICAgIGNvbnRlbnQ6ICcnLFxuICAgICAgICAgIHR5cGU6IGN1cnJlbnRUeXBlLFxuICAgICAgICAgIGxldmVsOiBjdXJyZW50TGV2ZWwsXG4gICAgICAgICAgaXNCb2xkOiBmYWxzZSxcbiAgICAgICAgICBmb250U2l6ZTogMCxcbiAgICAgICAgICBpc1RpdGxlOiBmYWxzZSxcbiAgICAgICAgICBpbmRleDogc3RhcnRJbmRleCArIGJsb2Nrcy5sZW5ndGhcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5aSE55CG5paH5pys5YaF5a65XG4gICAgICBpZiAodGV4dEVsZW1lbnQudGV4dFJ1bikge1xuICAgICAgICAvLyDojrflj5bmoLflvI/kv6Hmga9cbiAgICAgICAgY29uc3Qgc3R5bGUgPSB0ZXh0RWxlbWVudC50ZXh0UnVuLnN0eWxlO1xuICAgICAgICBpZiAoc3R5bGUpIHtcbiAgICAgICAgICBpc0JvbGQgPSBzdHlsZS5ib2xkIHx8IGZhbHNlO1xuICAgICAgICAgIGZvbnRTaXplID0gc3R5bGUuZm9udFNpemU/Lm1hZ25pdHVkZSB8fCAwO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDmt7vliqDmlofmnKxcbiAgICAgICAgY29uc3QgY29udGVudCA9IHRleHRFbGVtZW50LnRleHRSdW4uY29udGVudCB8fCAnJztcbiAgICAgICAgY3VycmVudENvbnRlbnQucHVzaChjb250ZW50KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWmguaenOaYr+esrOS4gOS4quaWh+acrOWFg+e0oO+8jOabtOaWsOWdl+eahOagt+W8j+S/oeaBr1xuICAgICAgICBpZiAoY3VycmVudEJsb2NrICYmIGN1cnJlbnRDb250ZW50Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGN1cnJlbnRCbG9jay5pc0JvbGQgPSBpc0JvbGQ7XG4gICAgICAgICAgY3VycmVudEJsb2NrLmZvbnRTaXplID0gZm9udFNpemU7XG4gICAgICAgICAgY3VycmVudEJsb2NrLmlzVGl0bGUgPSBmb250U2l6ZSA+IDE0IHx8IGlzQm9sZDsgLy8g5qC55o2u5a2X5L2T5aSn5bCP5ZKM57KX5L2T5Yik5pat5piv5ZCm5piv5qCH6aKYXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5L+d5a2Y5pyA5ZCO5LiA5Liq5Z2XXG4gICAgaWYgKGN1cnJlbnRDb250ZW50Lmxlbmd0aCA+IDAgJiYgY3VycmVudEJsb2NrKSB7XG4gICAgICBjdXJyZW50QmxvY2suY29udGVudCA9IGN1cnJlbnRDb250ZW50LmpvaW4oJycpLnRyaW0oKTtcbiAgICAgIGlmIChjdXJyZW50QmxvY2suY29udGVudCkge1xuICAgICAgICBibG9ja3MucHVzaChjdXJyZW50QmxvY2spO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYmxvY2tzO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65paH5pys57uT5p6E5qCRXG4gICAqIEBwYXJhbSBibG9ja3Mg5paH5pys5Z2X5pWw57uEXG4gICAqIEByZXR1cm5zIOe7k+aehOWMlueahOaWh+acrOWdl+aVsOe7hFxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFRleHRTdHJ1Y3R1cmVUcmVlKGJsb2NrczogVGV4dEJsb2NrW10pOiBUZXh0QmxvY2tbXSB7XG4gICAgLy8g5oyJ57Si5byV5o6S5bqPXG4gICAgYmxvY2tzLnNvcnQoKGEsIGIpID0+IGEuaW5kZXggLSBiLmluZGV4KTtcbiAgICBcbiAgICAvLyDmnoTlu7rlsYLnuqfnu5PmnoTmoJFcbiAgICBjb25zdCByb290QmxvY2tzOiBUZXh0QmxvY2tbXSA9IFtdO1xuICAgIGNvbnN0IHN0YWNrOiBUZXh0QmxvY2tbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICAvLyDph43nva7loIbmoIjvvIznm7TliLDmib7liLDpgILlvZPnmoTniLbnuqdcbiAgICAgIHdoaWxlIChzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmxldmVsID49IGJsb2NrLmxldmVsKSB7XG4gICAgICAgIHN0YWNrLnBvcCgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIOmhtuWxguWdl1xuICAgICAgICByb290QmxvY2tzLnB1c2goYmxvY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8g5re75Yqg5Li65a2Q5Z2XXG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuICAgICAgICBpZiAoIXBhcmVudC5jaGlsZHJlbikge1xuICAgICAgICAgIHBhcmVudC5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHBhcmVudC5jaGlsZHJlbi5wdXNoKGJsb2NrKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5aaC5p6c5LiN5piv5YiX6KGo6aG577yM5oiW6ICF5piv5qCH6aKY77yM5LiN5YWl5qCIXG4gICAgICBpZiAoYmxvY2sudHlwZSAhPT0gVGV4dFN0cnVjdHVyZVR5cGUuQlVMTEVUX0xJU1QgfHwgYmxvY2suaXNUaXRsZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5b2T5YmN5Z2X5YWl5qCIXG4gICAgICBzdGFjay5wdXNoKGJsb2NrKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJvb3RCbG9ja3M7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDku47mlofmnKznu5PmnoTkuK3mj5Dlj5bpobnnm65cbiAgICogQHBhcmFtIGJsb2NrcyDnu5PmnoTljJbnmoTmlofmnKzlnZfmlbDnu4RcbiAgICogQHJldHVybnMg6aG555uu5pWw5o2u5pWw57uEXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RQcm9qZWN0c0Zyb21UZXh0U3RydWN0dXJlKGJsb2NrczogVGV4dEJsb2NrW10pOiBQcm9qZWN0RGF0YVtdIHtcbiAgICBjb25zdCBwcm9qZWN0czogUHJvamVjdERhdGFbXSA9IFtdO1xuICAgIFxuICAgIC8vIOivhuWIq+S4jeWQjOeahOmhueebrue7k+aehOaooeW8j+W5tuaPkOWPllxuICAgIFxuICAgIC8vIOaooeW8jzE6IOagh+mimOaIluWIl+ihqOmhueaYr+mhueebruWQjeensO+8jOWtkOmhueaYr+mhueebruivpuaDhVxuICAgIHRoaXMuZXh0cmFjdFByb2plY3RzRnJvbVRpdGxlQ2hpbGRyZW5QYXR0ZXJuKGJsb2NrcywgcHJvamVjdHMpO1xuICAgIFxuICAgIC8vIOaooeW8jzI6IOWIl+ihqOmhueWMheWQq+WujOaVtOeahOmhueebruS/oeaBr1xuICAgIHRoaXMuZXh0cmFjdFByb2plY3RzRnJvbUxpc3RJdGVtUGF0dGVybihibG9ja3MsIHByb2plY3RzKTtcbiAgICBcbiAgICAvLyDmqKHlvI8zOiDmrrXokL3mlofmnKzljIXlkKvlrozmlbTnmoTpobnnm67kv6Hmga9cbiAgICB0aGlzLmV4dHJhY3RQcm9qZWN0c0Zyb21QYXJhZ3JhcGhQYXR0ZXJuKGJsb2NrcywgcHJvamVjdHMpO1xuICAgIFxuICAgIHJldHVybiBwcm9qZWN0cztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOS7juagh+mimC3lrZDpobnmqKHlvI/kuK3mj5Dlj5bpobnnm65cbiAgICogQHBhcmFtIGJsb2NrcyDmlofmnKzlnZfmlbDnu4RcbiAgICogQHBhcmFtIHByb2plY3RzIOmhueebruaVsOe7hO+8iOi+k+WHuu+8iVxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0UHJvamVjdHNGcm9tVGl0bGVDaGlsZHJlblBhdHRlcm4oYmxvY2tzOiBUZXh0QmxvY2tbXSwgcHJvamVjdHM6IFByb2plY3REYXRhW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuICAgICAgLy8g5Y+q6ICD6JmR5pyJ5a2Q6aG555qE5qCH6aKY5oiW5YiX6KGo6aG5XG4gICAgICBpZiAoIWJsb2NrLmNoaWxkcmVuIHx8IGJsb2NrLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5bCd6K+V5LuO5qCH6aKY5Lit5o+Q5Y+W6aG555uuSUTlkozlkI3np7BcbiAgICAgIGNvbnN0IHRpdGxlVGV4dCA9IGJsb2NrLmNvbnRlbnQ7XG4gICAgICBjb25zdCBqaXJhTWF0Y2ggPSBUZXh0Q29udGVudEFuYWx5emVySW1wbC5KSVJBX1RJQ0tFVF9QQVRURVJOLmV4ZWModGl0bGVUZXh0KTtcbiAgICAgIFxuICAgICAgaWYgKCFqaXJhTWF0Y2gpIHtcbiAgICAgICAgLy8g5aaC5p6c5rKh5pyJSmlyYSBJRO+8jOWPr+iDveS4jeaYr+mhueebruagh+mimO+8jOmAkuW9kuWkhOeQhuWtkOmhuVxuICAgICAgICBpZiAoYmxvY2suY2hpbGRyZW4pIHtcbiAgICAgICAgICB0aGlzLmV4dHJhY3RQcm9qZWN0c0Zyb21UaXRsZUNoaWxkcmVuUGF0dGVybihibG9jay5jaGlsZHJlbiwgcHJvamVjdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBqaXJhSWQgPSBqaXJhTWF0Y2hbMV07XG4gICAgICBsZXQgcHJvamVjdE5hbWUgPSB0aXRsZVRleHQucmVwbGFjZShqaXJhSWQsICcnKS50cmltKCk7XG4gICAgICBcbiAgICAgIC8vIOWmguaenOacieWGkuWPt++8jOWPluWGkuWPt+WQjueahOmDqOWIhlxuICAgICAgaWYgKHByb2plY3ROYW1lLmluY2x1ZGVzKCc6JykpIHtcbiAgICAgICAgcHJvamVjdE5hbWUgPSBwcm9qZWN0TmFtZS5zcGxpdCgnOicpWzFdLnRyaW0oKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvamVjdE5hbWUuaW5jbHVkZXMoJ++8micpKSB7XG4gICAgICAgIHByb2plY3ROYW1lID0gcHJvamVjdE5hbWUuc3BsaXQoJ++8micpWzFdLnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5LuO5a2Q6aG55Lit5o+Q5Y+W6aG555uu6K+m5oOFXG4gICAgICBsZXQgc3RhdHVzID0gJyc7XG4gICAgICBsZXQgb3duZXIgPSAnJztcbiAgICAgIGxldCB0cmFjayA9ICcnO1xuICAgICAgbGV0IGNvbW1lbnRzID0gJyc7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgYmxvY2suY2hpbGRyZW4pIHtcbiAgICAgICAgY29uc3QgY2hpbGRUZXh0ID0gY2hpbGQuY29udGVudC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgLy8g5bCd6K+V5Yy56YWN54q25oCBXG4gICAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBUZXh0Q29udGVudEFuYWx5emVySW1wbC5TVEFUVVNfUEFUVEVSTlMpIHtcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IHBhdHRlcm4uZXhlYyhjaGlsZC5jb250ZW50KTtcbiAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIHN0YXR1cyA9IG1hdGNoWzFdIHx8IG1hdGNoWzBdO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDlpoLmnpzmsqHmnInpgJrov4fmqKHlvI/ljLnphY3mib7liLDvvIzpgJrov4flhbPplK7or43mn6Xmib5cbiAgICAgICAgaWYgKCFzdGF0dXMgJiYgKGNoaWxkVGV4dC5pbmNsdWRlcygn54q25oCBJykgfHwgY2hpbGRUZXh0LmluY2x1ZGVzKCdzdGF0dXMnKSkpIHtcbiAgICAgICAgICBzdGF0dXMgPSBjaGlsZC5jb250ZW50LnJlcGxhY2UoL+eKtuaAgVs677yaXXxzdGF0dXNbOu+8ml0vaSwgJycpLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5bCd6K+V5Yy56YWN6LSf6LSj5Lq6XG4gICAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBUZXh0Q29udGVudEFuYWx5emVySW1wbC5PV05FUl9QQVRURVJOUykge1xuICAgICAgICAgIGNvbnN0IG1hdGNoID0gcGF0dGVybi5leGVjKGNoaWxkLmNvbnRlbnQpO1xuICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgb3duZXIgPSBtYXRjaFsxXSB8fCBtYXRjaFswXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5aaC5p6c5rKh5pyJ6YCa6L+H5qih5byP5Yy56YWN5om+5Yiw77yM6YCa6L+H5YWz6ZSu6K+N5p+l5om+XG4gICAgICAgIGlmICghb3duZXIgJiYgKGNoaWxkVGV4dC5pbmNsdWRlcygn6LSf6LSj5Lq6JykgfHwgY2hpbGRUZXh0LmluY2x1ZGVzKCfotKPku7vkuronKSB8fCBjaGlsZFRleHQuaW5jbHVkZXMoJ293bmVyJykgfHwgY2hpbGRUZXh0LmluY2x1ZGVzKCdhc3NpZ25lZScpKSkge1xuICAgICAgICAgIG93bmVyID0gY2hpbGQuY29udGVudC5yZXBsYWNlKC/otJ/otKPkurpbOu+8ml186LSj5Lu75Lq6WzrvvJpdfG93bmVyWzrvvJpdfGFzc2lnbmVlWzrvvJpdL2ksICcnKS50cmltKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWwneivleWMuemFjei1m+mBky/lm6LpmJ9cbiAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIFRleHRDb250ZW50QW5hbHl6ZXJJbXBsLlRSQUNLX1BBVFRFUk5TKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMoY2hpbGQuY29udGVudCk7XG4gICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICB0cmFjayA9IG1hdGNoWzFdIHx8IG1hdGNoWzBdO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDmt7vliqDlhbbku5bmnKror4bliKvlhoXlrrnkuLrlpIfms6hcbiAgICAgICAgaWYgKCFjaGlsZFRleHQuaW5jbHVkZXMoJ+eKtuaAgScpICYmICFjaGlsZFRleHQuaW5jbHVkZXMoJ3N0YXR1cycpICYmXG4gICAgICAgICAgICAhY2hpbGRUZXh0LmluY2x1ZGVzKCfotJ/otKPkuronKSAmJiAhY2hpbGRUZXh0LmluY2x1ZGVzKCfotKPku7vkuronKSAmJiBcbiAgICAgICAgICAgICFjaGlsZFRleHQuaW5jbHVkZXMoJ293bmVyJykgJiYgIWNoaWxkVGV4dC5pbmNsdWRlcygnYXNzaWduZWUnKSAmJlxuICAgICAgICAgICAgIWNoaWxkVGV4dC5pbmNsdWRlcygn6LWb6YGTJykgJiYgIWNoaWxkVGV4dC5pbmNsdWRlcygn5Zui6ZifJykgJiZcbiAgICAgICAgICAgICFjaGlsZFRleHQuaW5jbHVkZXMoJ3RyYWNrJykgJiYgIWNoaWxkVGV4dC5pbmNsdWRlcygndGVhbScpKSB7XG4gICAgICAgICAgaWYgKGNvbW1lbnRzKSB7XG4gICAgICAgICAgICBjb21tZW50cyArPSAnXFxuJztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29tbWVudHMgKz0gY2hpbGQuY29udGVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDliJvlu7rpobnnm67mlbDmja5cbiAgICAgIHByb2plY3RzLnB1c2goe1xuICAgICAgICBpZDogamlyYUlkLFxuICAgICAgICBuYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgICAgc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgIG93bmVyOiBvd25lcixcbiAgICAgICAgdHJhY2s6IHRyYWNrLFxuICAgICAgICBjb21tZW50czogY29tbWVudHMsXG4gICAgICAgIHNsaWRlRWxlbWVudElkOiBibG9jay5lbGVtZW50SWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIOS7juWIl+ihqOmhueaooeW8j+S4reaPkOWPlumhueebrlxuICAgKiBAcGFyYW0gYmxvY2tzIOaWh+acrOWdl+aVsOe7hFxuICAgKiBAcGFyYW0gcHJvamVjdHMg6aG555uu5pWw57uE77yI6L6T5Ye677yJXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RQcm9qZWN0c0Zyb21MaXN0SXRlbVBhdHRlcm4oYmxvY2tzOiBUZXh0QmxvY2tbXSwgcHJvamVjdHM6IFByb2plY3REYXRhW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuICAgICAgaWYgKGJsb2NrLnR5cGUgIT09IFRleHRTdHJ1Y3R1cmVUeXBlLkJVTExFVF9MSVNUICYmIGJsb2NrLnR5cGUgIT09IFRleHRTdHJ1Y3R1cmVUeXBlLk5VTUJFUkVEX0xJU1QpIHtcbiAgICAgICAgLy8g6YCS5b2S5aSE55CG5a2Q6aG5XG4gICAgICAgIGlmIChibG9jay5jaGlsZHJlbikge1xuICAgICAgICAgIHRoaXMuZXh0cmFjdFByb2plY3RzRnJvbUxpc3RJdGVtUGF0dGVybihibG9jay5jaGlsZHJlbiwgcHJvamVjdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjb250ZW50ID0gYmxvY2suY29udGVudDtcbiAgICAgIGNvbnN0IGppcmFNYXRjaCA9IFRleHRDb250ZW50QW5hbHl6ZXJJbXBsLkpJUkFfVElDS0VUX1BBVFRFUk4uZXhlYyhjb250ZW50KTtcbiAgICAgIFxuICAgICAgaWYgKCFqaXJhTWF0Y2gpIHtcbiAgICAgICAgLy8g6YCS5b2S5aSE55CG5a2Q6aG5XG4gICAgICAgIGlmIChibG9jay5jaGlsZHJlbikge1xuICAgICAgICAgIHRoaXMuZXh0cmFjdFByb2plY3RzRnJvbUxpc3RJdGVtUGF0dGVybihibG9jay5jaGlsZHJlbiwgcHJvamVjdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBqaXJhSWQgPSBqaXJhTWF0Y2hbMV07XG4gICAgICBsZXQgcHJvamVjdE5hbWUgPSBjb250ZW50LnJlcGxhY2UoamlyYUlkLCAnJykudHJpbSgpO1xuICAgICAgXG4gICAgICAvLyDliIbnprvpobnnm67lkI3np7Dlkozlhbbku5bkv6Hmga9cbiAgICAgIGxldCBzdGF0dXMgPSAnJztcbiAgICAgIGxldCBvd25lciA9ICcnO1xuICAgICAgY29uc3QgdHJhY2sgPSAnJztcbiAgICAgIGxldCBjb21tZW50cyA9ICcnO1xuICAgICAgXG4gICAgICAvLyDlsJ3or5Xmj5Dlj5bnirbmgIHvvIjpgJrluLjlnKjmlrnmi6zlj7fmiJblhbbku5bmoIforrDkuK3vvIlcbiAgICAgIGNvbnN0IHN0YXR1c01hdGNoZXMgPSBjb250ZW50Lm1hdGNoKC9cXFsoLio/KVxcXS8pO1xuICAgICAgaWYgKHN0YXR1c01hdGNoZXMpIHtcbiAgICAgICAgc3RhdHVzID0gc3RhdHVzTWF0Y2hlc1sxXTtcbiAgICAgICAgcHJvamVjdE5hbWUgPSBwcm9qZWN0TmFtZS5yZXBsYWNlKC9cXFsuKj9cXF0vLCAnJykudHJpbSgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDlsJ3or5Xmj5Dlj5botJ/otKPkurrvvIjpgJrluLjkvb/nlKhA56ym5Y+377yJXG4gICAgICBjb25zdCBvd25lck1hdGNoZXMgPSBjb250ZW50Lm1hdGNoKC9AKFteXFxzXSspLyk7XG4gICAgICBpZiAob3duZXJNYXRjaGVzKSB7XG4gICAgICAgIG93bmVyID0gb3duZXJNYXRjaGVzWzFdO1xuICAgICAgICBwcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lLnJlcGxhY2UoL0BbXlxcc10rLywgJycpLnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5o+Q5Y+W6aG555uu5ZCN56ew77yI6YCa5bi45Zyo5YaS5Y+35ZCO77yJXG4gICAgICBpZiAocHJvamVjdE5hbWUuaW5jbHVkZXMoJzonKSkge1xuICAgICAgICBjb25zdCBwYXJ0cyA9IHByb2plY3ROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPj0gMikge1xuICAgICAgICAgIGNvbW1lbnRzID0gcGFydHMuc2xpY2UoMikuam9pbignOicpLnRyaW0oKTtcbiAgICAgICAgICBwcm9qZWN0TmFtZSA9IHBhcnRzWzFdLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwcm9qZWN0TmFtZS5pbmNsdWRlcygn77yaJykpIHtcbiAgICAgICAgY29uc3QgcGFydHMgPSBwcm9qZWN0TmFtZS5zcGxpdCgn77yaJyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPj0gMikge1xuICAgICAgICAgIGNvbW1lbnRzID0gcGFydHMuc2xpY2UoMikuam9pbign77yaJykudHJpbSgpO1xuICAgICAgICAgIHByb2plY3ROYW1lID0gcGFydHNbMV0udHJpbSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOWIm+W7uumhueebruaVsOaNrlxuICAgICAgcHJvamVjdHMucHVzaCh7XG4gICAgICAgIGlkOiBqaXJhSWQsXG4gICAgICAgIG5hbWU6IHByb2plY3ROYW1lLFxuICAgICAgICBzdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgb3duZXI6IG93bmVyLFxuICAgICAgICB0cmFjazogdHJhY2ssXG4gICAgICAgIGNvbW1lbnRzOiBjb21tZW50cyxcbiAgICAgICAgc2xpZGVFbGVtZW50SWQ6IGJsb2NrLmVsZW1lbnRJZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIOmAkuW9kuWkhOeQhuWtkOmhue+8iOWmguaenOacie+8iVxuICAgICAgaWYgKGJsb2NrLmNoaWxkcmVuKSB7XG4gICAgICAgIC8vIOWwhuWtkOmhueWGheWuueS9nOS4uuW9k+WJjemhueebrueahOivhOiuui/lpIfms6hcbiAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBibG9jay5jaGlsZHJlbikge1xuICAgICAgICAgIGlmIChwcm9qZWN0c1twcm9qZWN0cy5sZW5ndGggLSAxXS5jb21tZW50cykge1xuICAgICAgICAgICAgcHJvamVjdHNbcHJvamVjdHMubGVuZ3RoIC0gMV0uY29tbWVudHMgKz0gJ1xcbic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb2plY3RzW3Byb2plY3RzLmxlbmd0aCAtIDFdLmNvbW1lbnRzID0gJyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIHByb2plY3RzW3Byb2plY3RzLmxlbmd0aCAtIDFdLmNvbW1lbnRzICs9IGNoaWxkLmNvbnRlbnQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDku47mrrXokL3mqKHlvI/kuK3mj5Dlj5bpobnnm65cbiAgICogQHBhcmFtIGJsb2NrcyDmlofmnKzlnZfmlbDnu4RcbiAgICogQHBhcmFtIHByb2plY3RzIOmhueebruaVsOe7hO+8iOi+k+WHuu+8iVxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0UHJvamVjdHNGcm9tUGFyYWdyYXBoUGF0dGVybihibG9ja3M6IFRleHRCbG9ja1tdLCBwcm9qZWN0czogUHJvamVjdERhdGFbXSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICBpZiAoYmxvY2sudHlwZSAhPT0gVGV4dFN0cnVjdHVyZVR5cGUuUEFSQUdSQVBIKSB7XG4gICAgICAgIC8vIOmAkuW9kuWkhOeQhuWtkOmhuVxuICAgICAgICBpZiAoYmxvY2suY2hpbGRyZW4pIHtcbiAgICAgICAgICB0aGlzLmV4dHJhY3RQcm9qZWN0c0Zyb21QYXJhZ3JhcGhQYXR0ZXJuKGJsb2NrLmNoaWxkcmVuLCBwcm9qZWN0cyk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBibG9jay5jb250ZW50O1xuICAgICAgY29uc3QgamlyYU1hdGNoZXMgPSBjb250ZW50Lm1hdGNoKC9bQS1aXSstXFxkKy9nKTtcbiAgICAgIFxuICAgICAgaWYgKCFqaXJhTWF0Y2hlcyB8fCBqaXJhTWF0Y2hlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOWvueS6juavj+S4quWMuemFjeeahEppcmEgSUTvvIzlsJ3or5Xmj5Dlj5bnm7jlhbPpobnnm67kv6Hmga9cbiAgICAgIGZvciAoY29uc3QgamlyYUlkIG9mIGppcmFNYXRjaGVzKSB7XG4gICAgICAgIGNvbnN0IGppcmFJbmRleCA9IGNvbnRlbnQuaW5kZXhPZihqaXJhSWQpO1xuICAgICAgICBjb25zdCB0ZXh0QWZ0ZXJKaXJhID0gY29udGVudC5zdWJzdHJpbmcoamlyYUluZGV4ICsgamlyYUlkLmxlbmd0aCk7XG4gICAgICAgIFxuICAgICAgICAvLyDmj5Dlj5bpobnnm67lkI3np7DvvIjlgYforr7lnKhKaXJhIElE5ZCO6Z2i55qE5paH5pys5Yiw5LiL5LiA5Liq5YiG6ZqU56ym77yJXG4gICAgICAgIGxldCBwcm9qZWN0TmFtZSA9IHRleHRBZnRlckppcmEudHJpbSgpO1xuICAgICAgICBsZXQgc3RhdHVzID0gJyc7XG4gICAgICAgIGxldCBvd25lciA9ICcnO1xuICAgICAgICBsZXQgY29tbWVudHMgPSAnJztcbiAgICAgICAgXG4gICAgICAgIC8vIOWkhOeQhuWGkuWPt+WQjueahOWGheWuuVxuICAgICAgICBpZiAocHJvamVjdE5hbWUuc3RhcnRzV2l0aCgnOicpKSB7XG4gICAgICAgICAgcHJvamVjdE5hbWUgPSBwcm9qZWN0TmFtZS5zdWJzdHJpbmcoMSkudHJpbSgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDmj5Dlj5bnirbmgIHvvIjlpoLmnpzmnInvvIlcbiAgICAgICAgY29uc3Qgc3RhdHVzTWF0Y2ggPSB0ZXh0QWZ0ZXJKaXJhLm1hdGNoKC9cXFsoLio/KVxcXS8pO1xuICAgICAgICBpZiAoc3RhdHVzTWF0Y2gpIHtcbiAgICAgICAgICBzdGF0dXMgPSBzdGF0dXNNYXRjaFsxXTtcbiAgICAgICAgICBwcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lLnJlcGxhY2UoL1xcWy4qP1xcXS8sICcnKS50cmltKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOaPkOWPlui0n+i0o+S6uu+8iOWmguaenOacie+8iVxuICAgICAgICBjb25zdCBvd25lck1hdGNoID0gdGV4dEFmdGVySmlyYS5tYXRjaCgvQChbXlxcc10rKS8pO1xuICAgICAgICBpZiAob3duZXJNYXRjaCkge1xuICAgICAgICAgIG93bmVyID0gb3duZXJNYXRjaFsxXTtcbiAgICAgICAgICBwcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lLnJlcGxhY2UoL0BbXlxcc10rLywgJycpLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5aaC5p6c5pyJ5aSa5Liq5Y+l5a2Q77yM5Y+v6IO95ZCO6Z2i55qE5piv6K+E6K66XG4gICAgICAgIGNvbnN0IHNlbnRlbmNlcyA9IHByb2plY3ROYW1lLnNwbGl0KC9bLuOAgl0vKTtcbiAgICAgICAgaWYgKHNlbnRlbmNlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgcHJvamVjdE5hbWUgPSBzZW50ZW5jZXNbMF0udHJpbSgpO1xuICAgICAgICAgIGNvbW1lbnRzID0gc2VudGVuY2VzLnNsaWNlKDEpLmpvaW4oJy4nKS50cmltKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWIm+W7uumhueebruaVsOaNrlxuICAgICAgICBwcm9qZWN0cy5wdXNoKHtcbiAgICAgICAgICBpZDogamlyYUlkLFxuICAgICAgICAgIG5hbWU6IHByb2plY3ROYW1lLFxuICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgIG93bmVyOiBvd25lcixcbiAgICAgICAgICBjb21tZW50czogY29tbWVudHMsXG4gICAgICAgICAgc2xpZGVFbGVtZW50SWQ6IGJsb2NrLmVsZW1lbnRJZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnoa7lrprpobnnm67lhbHmnInnmoTlrZfmrrVcbiAgICogQHBhcmFtIHByb2plY3RzIOmhueebruaVsOe7hFxuICAgKiBAcmV0dXJucyDlhbHmnInlrZfmrrXlkI3mlbDnu4RcbiAgICovXG4gIHByaXZhdGUgZGV0ZXJtaW5lQ29tbW9uRmllbGRzKHByb2plY3RzOiBQcm9qZWN0RGF0YVtdKTogc3RyaW5nW10ge1xuICAgIGlmIChwcm9qZWN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgZmllbGRzID0gbmV3IFNldDxzdHJpbmc+KFsnaWQnLCAnbmFtZSddKTtcbiAgICBcbiAgICAvLyDorqHnrpfmr4/kuKrlrZfmrrXnmoTlrZjlnKjmr5TkvotcbiAgICBjb25zdCBmaWVsZENvdW50czogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHtcbiAgICAgIHN0YXR1czogMCxcbiAgICAgIG93bmVyOiAwLFxuICAgICAgdHJhY2s6IDAsXG4gICAgICBjb21tZW50czogMFxuICAgIH07XG4gICAgXG4gICAgZm9yIChjb25zdCBwcm9qZWN0IG9mIHByb2plY3RzKSB7XG4gICAgICBpZiAocHJvamVjdC5zdGF0dXMpIGZpZWxkQ291bnRzLnN0YXR1cysrO1xuICAgICAgaWYgKHByb2plY3Qub3duZXIpIGZpZWxkQ291bnRzLm93bmVyKys7XG4gICAgICBpZiAocHJvamVjdC50cmFjaykgZmllbGRDb3VudHMudHJhY2srKztcbiAgICAgIGlmIChwcm9qZWN0LmNvbW1lbnRzKSBmaWVsZENvdW50cy5jb21tZW50cysrO1xuICAgIH1cbiAgICBcbiAgICAvLyDlpoLmnpzlrZfmrrXlnKjotoXov4czMCXnmoTpobnnm67kuK3lrZjlnKjvvIzorqTkuLrmmK/lhbHmnInlrZfmrrVcbiAgICBjb25zdCB0aHJlc2hvbGQgPSBwcm9qZWN0cy5sZW5ndGggKiAwLjM7XG4gICAgXG4gICAgZm9yIChjb25zdCBbZmllbGQsIGNvdW50XSBvZiBPYmplY3QuZW50cmllcyhmaWVsZENvdW50cykpIHtcbiAgICAgIGlmIChjb3VudCA+PSB0aHJlc2hvbGQpIHtcbiAgICAgICAgZmllbGRzLmFkZChmaWVsZCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBBcnJheS5mcm9tKGZpZWxkcyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpfmlofmnKzliIbmnpDnmoTnva7kv6HluqZcbiAgICogQHBhcmFtIHByb2plY3RzIOaPkOWPlueahOmhueebrlxuICAgKiBAcmV0dXJucyDnva7kv6HluqbliIbmlbAoMC0xKVxuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhdGVUZXh0Q29uZmlkZW5jZShwcm9qZWN0czogUHJvamVjdERhdGFbXSk6IG51bWJlciB7XG4gICAgaWYgKHByb2plY3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIFxuICAgIGxldCBzY29yZSA9IDA7XG4gICAgXG4gICAgLy8gMS4g6aG555uu5pWw6YeP6K+E5YiGXG4gICAgaWYgKHByb2plY3RzLmxlbmd0aCA+PSAzKSB7XG4gICAgICBzY29yZSArPSAwLjM7XG4gICAgfSBlbHNlIGlmIChwcm9qZWN0cy5sZW5ndGggPj0gMSkge1xuICAgICAgc2NvcmUgKz0gMC4xO1xuICAgIH1cbiAgICBcbiAgICAvLyAyLiDlrZfmrrXlrozmlbTmgKfor4TliIZcbiAgICBsZXQgY29tcGxldGVuZXNzU2NvcmUgPSAwO1xuICAgIGxldCB0b3RhbEZpZWxkcyA9IDA7XG4gICAgXG4gICAgZm9yIChjb25zdCBwcm9qZWN0IG9mIHByb2plY3RzKSB7XG4gICAgICBsZXQgcHJvamVjdEZpZWxkcyA9IDA7XG4gICAgICBsZXQgZmlsbGVkRmllbGRzID0gMDtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBmaWVsZCBvZiBbJ2lkJywgJ25hbWUnLCAnc3RhdHVzJywgJ293bmVyJywgJ3RyYWNrJywgJ2NvbW1lbnRzJ10pIHtcbiAgICAgICAgcHJvamVjdEZpZWxkcysrO1xuICAgICAgICBpZiAocHJvamVjdFtmaWVsZCBhcyBrZXlvZiBQcm9qZWN0RGF0YV0pIHtcbiAgICAgICAgICBmaWxsZWRGaWVsZHMrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb21wbGV0ZW5lc3NTY29yZSArPSBmaWxsZWRGaWVsZHMgLyBwcm9qZWN0RmllbGRzO1xuICAgICAgdG90YWxGaWVsZHMrKztcbiAgICB9XG4gICAgXG4gICAgc2NvcmUgKz0gKGNvbXBsZXRlbmVzc1Njb3JlIC8gdG90YWxGaWVsZHMpICogMC40O1xuICAgIFxuICAgIC8vIDMuIEppcmEgSUTor4TliIZcbiAgICBjb25zdCBqaXJhUHJvamVjdHMgPSBwcm9qZWN0cy5maWx0ZXIocCA9PiAvW0EtWl0rLVxcZCsvLnRlc3QocC5pZCkpO1xuICAgIHNjb3JlICs9IChqaXJhUHJvamVjdHMubGVuZ3RoIC8gcHJvamVjdHMubGVuZ3RoKSAqIDAuMztcbiAgICBcbiAgICByZXR1cm4gTWF0aC5taW4oMSwgc2NvcmUpO1xuICB9XG59ICJdLCJuYW1lcyI6WyJTbGlkZUNvbnRlbnRUeXBlIiwiUHJvamVjdFN0cnVjdHVyZVR5cGUiLCJCYXNlU2xpZGVBbmFseXplciIsImFuYWx5emUiLCJzbGlkZSIsIm1ldGFkYXRhIiwiYW5hbHl6ZVNsaWRlTWV0YWRhdGEiLCJjb250ZW50VHlwZSIsImRldGVybWluZUNvbnRlbnRUeXBlIiwicmVzdWx0IiwicHJvamVjdFN0cnVjdHVyZSIsIlVOS05PV04iLCJwcm9qZWN0RmllbGRzIiwicHJvamVjdHMiLCJjb25maWRlbmNlIiwiYW5hbHl6ZVByb2plY3RTdHJ1Y3R1cmUiLCJhbmFseXNpc1Jlc3VsdCIsImFuYWx5emVDb250ZW50IiwiT2JqZWN0IiwiYXNzaWduIiwiZXJyb3IiLCJjb25zb2xlIiwid2FybmluZ3MiLCJFcnJvciIsIm1lc3NhZ2UiLCJTdHJpbmciLCJwYWdlRWxlbWVudHMiLCJ0YWJsZUNvdW50IiwidGV4dENvdW50Iiwic2hhcGVDb3VudCIsImxpc3RDb3VudCIsImVsZW1lbnQiLCJ0YWJsZSIsInNoYXBlIiwidGV4dCIsImNvbnRhaW5zTGlzdCIsInRleHRFbGVtZW50cyIsInNsaWRlSWQiLCJvYmplY3RJZCIsImVsZW1lbnRDb3VudCIsImxlbmd0aCIsImhhc1RhYmxlIiwiaGFzVGV4dCIsImhhc1NoYXBlcyIsImhhc0xpc3RzIiwiaXNUYWJsZURvbWluYW50IiwiTUlYRUQiLCJUQUJMRSIsIkxJU1QiLCJURVhUIiwiU0hBUEUiLCJ0ZXh0Q29udGVudCIsImV4dHJhY3RBbGxUZXh0Q29udGVudCIsImxvd2VyVGV4dCIsInRvTG93ZXJDYXNlIiwiaW5jbHVkZXMiLCJTUFJJTlQiLCJFUElDIiwiUkVMRUFTRSIsImNvbnRhaW5zTXVsdGlwbGVKaXJhVGlja2V0cyIsImNvbnRhaW5zU2luZ2xlSmlyYVRpY2tldCIsIlNJTkdMRV9USUNLRVQiLCJDVVNUT00iLCJ0YWJsZVJvd3MiLCJyb3ciLCJ0YWJsZUNlbGxzIiwiY2VsbCIsImNlbGxUZXh0IiwibWFwIiwiZSIsInRleHRSdW4iLCJjb250ZW50Iiwiam9pbiIsInRyaW0iLCJwdXNoIiwic2hhcGVUZXh0IiwiamlyYVRpY2tldFBhdHRlcm4iLCJtYXRjaGVzIiwibWF0Y2giLCJzb21lIiwicGFyYWdyYXBoTWFya2VyIiwic3R5bGUiLCJidWxsZXRQcmVzZXQiLCJ1bmRlZmluZWQiLCJ0b3RhbEVsZW1lbnRzIiwidGFibGVFbGVtZW50cyIsImZpbHRlciIsImV4dHJhY3RKaXJhVGlja2V0cyIsIlRleHRTdHJ1Y3R1cmVUeXBlIiwiVGV4dENvbnRlbnRBbmFseXplckltcGwiLCJjYW5IYW5kbGUiLCJhbmFseXplVGV4dEVsZW1lbnRzIiwiY2FsY3VsYXRlVGV4dENvbmZpZGVuY2UiLCJlbGVtZW50cyIsInRleHRCbG9ja3MiLCJleHRyYWN0VGV4dEJsb2NrcyIsInN0cnVjdHVyZWRCbG9ja3MiLCJidWlsZFRleHRTdHJ1Y3R1cmVUcmVlIiwiZXh0cmFjdFByb2plY3RzRnJvbVRleHRTdHJ1Y3R1cmUiLCJkZXRlcm1pbmVDb21tb25GaWVsZHMiLCJibG9ja3MiLCJpbmRleCIsInNoYXBlQmxvY2tzIiwiZXh0cmFjdFRleHRCbG9ja3NGcm9tU2hhcGUiLCJlbGVtZW50SWQiLCJzdGFydEluZGV4IiwiY3VycmVudEJsb2NrIiwiY3VycmVudENvbnRlbnQiLCJjdXJyZW50VHlwZSIsIlBBUkFHUkFQSCIsImN1cnJlbnRMZXZlbCIsImlzQm9sZCIsImZvbnRTaXplIiwidGV4dEVsZW1lbnQiLCJCVUxMRVRfTElTVCIsImluZGVudCIsIm1hZ25pdHVkZSIsIk1hdGgiLCJmbG9vciIsInR5cGUiLCJsZXZlbCIsImlzVGl0bGUiLCJib2xkIiwic29ydCIsImEiLCJiIiwicm9vdEJsb2NrcyIsInN0YWNrIiwiYmxvY2siLCJwb3AiLCJwYXJlbnQiLCJjaGlsZHJlbiIsImV4dHJhY3RQcm9qZWN0c0Zyb21UaXRsZUNoaWxkcmVuUGF0dGVybiIsImV4dHJhY3RQcm9qZWN0c0Zyb21MaXN0SXRlbVBhdHRlcm4iLCJleHRyYWN0UHJvamVjdHNGcm9tUGFyYWdyYXBoUGF0dGVybiIsInRpdGxlVGV4dCIsImppcmFNYXRjaCIsIkpJUkFfVElDS0VUX1BBVFRFUk4iLCJleGVjIiwiamlyYUlkIiwicHJvamVjdE5hbWUiLCJyZXBsYWNlIiwic3BsaXQiLCJzdGF0dXMiLCJvd25lciIsInRyYWNrIiwiY29tbWVudHMiLCJjaGlsZCIsImNoaWxkVGV4dCIsInBhdHRlcm4iLCJTVEFUVVNfUEFUVEVSTlMiLCJPV05FUl9QQVRURVJOUyIsIlRSQUNLX1BBVFRFUk5TIiwiaWQiLCJuYW1lIiwic2xpZGVFbGVtZW50SWQiLCJOVU1CRVJFRF9MSVNUIiwic3RhdHVzTWF0Y2hlcyIsIm93bmVyTWF0Y2hlcyIsInBhcnRzIiwic2xpY2UiLCJqaXJhTWF0Y2hlcyIsImppcmFJbmRleCIsImluZGV4T2YiLCJ0ZXh0QWZ0ZXJKaXJhIiwic3Vic3RyaW5nIiwic3RhcnRzV2l0aCIsInN0YXR1c01hdGNoIiwib3duZXJNYXRjaCIsInNlbnRlbmNlcyIsImZpZWxkcyIsIlNldCIsImZpZWxkQ291bnRzIiwicHJvamVjdCIsInRocmVzaG9sZCIsImZpZWxkIiwiY291bnQiLCJlbnRyaWVzIiwiYWRkIiwiQXJyYXkiLCJmcm9tIiwic2NvcmUiLCJjb21wbGV0ZW5lc3NTY29yZSIsInRvdGFsRmllbGRzIiwiZmlsbGVkRmllbGRzIiwiamlyYVByb2plY3RzIiwicCIsInRlc3QiLCJtaW4iXSwic291cmNlUm9vdCI6IiJ9