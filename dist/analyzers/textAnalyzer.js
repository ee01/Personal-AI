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
//# sourceMappingURL=textAnalyzer.js.map