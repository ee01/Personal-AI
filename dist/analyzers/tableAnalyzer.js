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
/*!****************************************!*\
  !*** ./src/analyzers/tableAnalyzer.ts ***!
  \****************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TableContentAnalyzerImpl: () => (/* binding */ TableContentAnalyzerImpl)
/* harmony export */ });
/* harmony import */ var _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../interfaces/slideAnalyzer */ "./src/interfaces/slideAnalyzer.ts");
/* harmony import */ var _baseAnalyzer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseAnalyzer */ "./src/analyzers/baseAnalyzer.ts");
/**
 * 表格内容分析器实现
 */



/**
 * 表格分析器类
 * 专门处理表格样式的项目数据
 */
class TableContentAnalyzerImpl extends _baseAnalyzer__WEBPACK_IMPORTED_MODULE_1__.BaseSlideAnalyzer {
  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  canHandle(slide) {
    // 检查是否有表格元素
    if (!slide.pageElements) return false;
    const hasTable = slide.pageElements.some(element => element.table !== undefined);
    if (!hasTable) return false;

    // 如果有表格，进一步检查表格是否可能包含项目数据
    const contentType = this.determineContentType(slide);
    return contentType === _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.TABLE || contentType === _interfaces_slideAnalyzer__WEBPACK_IMPORTED_MODULE_0__.SlideContentType.MIXED;
  }

  /**
   * 分析表格内容
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

    // 查找所有表格元素
    const tableElements = slide.pageElements.filter(element => element.table);
    if (tableElements.length === 0) {
      return {
        projects: [],
        confidence: 0
      };
    }

    // 分析所有表格，找出最可能包含项目数据的表格
    const allTableResults = [];
    for (const tableElement of tableElements) {
      try {
        const result = await this.analyzeTable(tableElement);

        // 计算此表格的置信度
        const confidence = this.calculateTableConfidence(result.headers, result.columnMapping, result.projectRows);

        // 提取项目字段名称
        const projectFields = Object.keys(result.columnMapping).filter(field => result.columnMapping[field] !== -1);
        allTableResults.push({
          projects: result.projectRows,
          tableElement,
          confidence,
          columnMapping: result.columnMapping,
          projectFields
        });
      } catch (error) {
        console.error('表格分析错误:', error);
        // 继续分析下一个表格
      }
    }

    // 如果没有找到任何项目数据，返回空结果
    if (allTableResults.length === 0) {
      return {
        projects: [],
        confidence: 0
      };
    }

    // 选择置信度最高的表格结果
    allTableResults.sort((a, b) => b.confidence - a.confidence);
    const bestResult = allTableResults[0];
    const warnings = [];

    // 如果有多个表格，但无法确定主表格，添加警告
    if (allTableResults.length > 1 && bestResult.confidence > 0 && allTableResults[1].confidence > bestResult.confidence * 0.8) {
      warnings.push('幻灯片包含多个可能的项目表格，已选择最可能的一个进行分析');
    }

    // 如果最佳表格的置信度仍然很低，添加警告
    if (bestResult.confidence < 0.5) {
      warnings.push('表格结构识别置信度较低，可能不是标准项目表格');
    }
    return {
      projects: bestResult.projects,
      confidence: bestResult.confidence,
      projectFields: bestResult.projectFields,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 分析表格结构
   * @param tableElement 表格元素
   * @returns 表格分析结果
   */
  async analyzeTable(tableElement) {
    if (!tableElement.table || !tableElement.table.tableRows) {
      throw new Error('无效的表格元素');
    }
    const tableData = tableElement.table;
    const tableId = tableElement.objectId;
    if (tableData.tableRows.length < 2) {
      throw new Error('表格行数不足');
    }

    // 获取表头行
    const headerRow = tableData.tableRows[0];
    if (!headerRow.tableCells) {
      throw new Error('表头行不包含单元格');
    }

    // 解析表头
    const headers = headerRow.tableCells.map(cell => {
      if (!cell.text || !cell.text.textElements) return '';
      return cell.text.textElements.map(textElement => textElement.textRun?.content || '').join('').toLowerCase().trim();
    });

    // 识别列索引，采用更智能的列名匹配
    const columnMapping = this.mapColumnIndices(headers);

    // 处理数据行
    const projectRows = [];
    for (let i = 1; i < tableData.tableRows.length; i++) {
      const row = tableData.tableRows[i];
      if (!row.tableCells) continue;
      const cells = row.tableCells;

      // 确保有足够的单元格
      const requiredColumns = [columnMapping.description, columnMapping.status].filter(idx => idx !== -1);
      const maxRequiredColumn = Math.max(...requiredColumns);
      if (cells.length <= maxRequiredColumn) {
        // 跳过没有足够列的行
        continue;
      }
      try {
        // 提取项目数据
        const project = this.extractProjectFromRow(tableId, cells, columnMapping, i);
        if (project) {
          projectRows.push(project);
        }
      } catch (error) {
        console.warn(`处理第${i}行时出错:`, error);
        // 继续处理下一行
      }
    }
    return {
      headers,
      columnMapping,
      projectRows
    };
  }

  /**
   * 智能匹配列索引
   * 使用模糊匹配和同义词来识别列的用途
   * @param headers 表头文本数组
   * @returns 列映射
   */
  mapColumnIndices(headers) {
    const columnMapping = {
      status: -1,
      description: -1,
      owner: -1,
      track: -1,
      comments: -1
    };

    // 对每个表头，检查是否匹配任一类型的列
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];

      // 状态列检查
      if (TableContentAnalyzerImpl.STATUS_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.status = i;
      }

      // 描述列检查
      if (TableContentAnalyzerImpl.DESCRIPTION_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.description = i;
      }

      // 负责人列检查
      if (TableContentAnalyzerImpl.OWNER_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.owner = i;
      }

      // 赛道列检查
      if (TableContentAnalyzerImpl.TRACK_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.track = i;
      }

      // 备注列检查
      if (TableContentAnalyzerImpl.COMMENTS_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.comments = i;
      }
    }

    // 如果找不到显式的描述列，尝试使用第一列作为描述列
    if (columnMapping.description === -1 && headers.length > 0) {
      columnMapping.description = 0;
    }
    return columnMapping;
  }

  /**
   * 从表格行提取项目数据
   * @param tableId 表格ID
   * @param cells 行单元格
   * @param columnMapping 列索引映射
   * @param rowIndex 行索引
   * @returns 项目数据
   */
  extractProjectFromRow(tableId, cells, columnMapping, rowIndex) {
    // 提取描述单元格内容
    if (columnMapping.description === -1) {
      return null; // 缺少描述列，无法识别项目
    }
    const descriptionCell = cells[columnMapping.description];
    if (!descriptionCell.text || !descriptionCell.text.textElements) {
      return null; // 描述单元格为空
    }
    const descriptionText = descriptionCell.text.textElements.map(textElement => textElement.textRun?.content || '').join('');

    // 如果描述为空，跳过此行
    if (!descriptionText.trim()) {
      return null;
    }

    // 提取Jira工单ID
    const jiraTicketMatch = descriptionText.match(/([A-Z]+-\d+)/);
    const jiraTicketId = jiraTicketMatch ? jiraTicketMatch[0] : '';

    // 提取项目名称
    let projectName = descriptionText;
    if (jiraTicketId) {
      projectName = projectName.replace(jiraTicketId, '').trim();
      // 如果有冒号，取冒号后的部分
      if (projectName.includes(':')) {
        projectName = projectName.split(':')[1].trim();
      }
    }

    // 获取状态信息
    let statusText = '';
    if (columnMapping.status !== -1) {
      const statusCell = cells[columnMapping.status];
      statusText = statusCell.text && statusCell.text.textElements ? statusCell.text.textElements.map(textElement => textElement.textRun?.content || '').join('').trim() : '';
    }

    // 获取负责人信息
    let ownerText = '';
    if (columnMapping.owner !== -1) {
      const ownerCell = cells[columnMapping.owner];
      ownerText = ownerCell.text && ownerCell.text.textElements ? ownerCell.text.textElements.map(textElement => textElement.textRun?.content || '').join('').trim() : '';
    }

    // 创建项目数据对象
    const project = {
      id: jiraTicketId || `project-${tableId}-${rowIndex}`,
      name: projectName,
      status: statusText,
      owner: ownerText,
      tableId: tableId,
      row: rowIndex,
      columnIndices: columnMapping
    };

    // 添加可选字段
    if (columnMapping.track !== -1) {
      const trackCell = cells[columnMapping.track];
      project.track = trackCell.text && trackCell.text.textElements ? trackCell.text.textElements.map(textElement => textElement.textRun?.content || '').join('').trim() : '';
    }
    if (columnMapping.comments !== -1) {
      const commentsCell = cells[columnMapping.comments];
      project.comments = commentsCell.text && commentsCell.text.textElements ? commentsCell.text.textElements.map(textElement => textElement.textRun?.content || '').join('').trim() : '';
    }
    return project;
  }

  /**
   * 计算表格的项目数据置信度
   * @param headers 表头
   * @param columnMapping 列映射
   * @param projects 提取的项目数据
   * @returns 置信度分数(0-1)
   */
  calculateTableConfidence(headers, columnMapping, projects) {
    let score = 0;

    // 1. 检查是否识别到关键列
    if (columnMapping.status !== -1) score += 0.2;
    if (columnMapping.description !== -1) score += 0.2;
    if (columnMapping.owner !== -1) score += 0.1;
    if (columnMapping.track !== -1) score += 0.05;
    if (columnMapping.comments !== -1) score += 0.05;

    // 2. 检查项目数据有效性
    if (projects.length === 0) {
      return 0; // 没有提取到项目
    }

    // 计算包含Jira工单ID的项目比例
    const jiraProjects = projects.filter(p => /[A-Z]+-\d+/.test(p.id));
    const jiraRatio = jiraProjects.length / projects.length;
    score += jiraRatio * 0.2;

    // 3. 检查表格结构
    if (headers.length >= 3) score += 0.1; // 表格列数适中
    if (projects.length >= 2) score += 0.1; // 有多行项目数据

    return Math.min(1, score);
  }
}
// 识别项目状态的常见列名
TableContentAnalyzerImpl.STATUS_COLUMNS = ['status', 'state', 'stage', '状态', '阶段'];
// 识别项目描述的常见列名
TableContentAnalyzerImpl.DESCRIPTION_COLUMNS = ['project', 'description', 'summary', 'name', 'title', '项目', '描述', '名称', '标题'];
// 识别项目负责人的常见列名
TableContentAnalyzerImpl.OWNER_COLUMNS = ['owner', 'assignee', 'responsible', 'person', 'lead', 'reporter', '负责人', '责任人', '所有者', '执行者'];
// 识别赛道/团队的常见列名
TableContentAnalyzerImpl.TRACK_COLUMNS = ['track', 'team', 'group', 'department', 'area', '赛道', '团队', '组别', '部门', '分类'];
// 识别备注/注释的常见列名
TableContentAnalyzerImpl.COMMENTS_COLUMNS = ['comment', 'note', 'action', 'item', 'todo', 'remarks', 'hightlight', '备注', '注释', '行动项', '待办'];
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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SUFBSSxDQUFDLEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9hbmFseXplcnMvYmFzZUFuYWx5emVyLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2ludGVyZmFjZXMvc2xpZGVBbmFseXplci50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2FuYWx5emVycy90YWJsZUFuYWx5emVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog5bm754Gv54mH5YaF5a655YiG5p6Q5Zmo5Z+657G7XG4gKi9cblxuaW1wb3J0IHsgR29vZ2xlU2xpZGUsIEdvb2dsZVBhZ2VFbGVtZW50LCBHb29nbGVUZXh0RWxlbWVudCB9IGZyb20gJy4uL2ludGVyZmFjZXMvZ29vZ2xlU2xpZGVzJztcbmltcG9ydCB7IFxuICBTbGlkZUNvbnRlbnRBbmFseXplciwgXG4gIFNsaWRlQ29udGVudFR5cGUsIFxuICBQcm9qZWN0U3RydWN0dXJlVHlwZSwgXG4gIFNsaWRlQW5hbHlzaXNSZXN1bHQgXG59IGZyb20gJy4uL2ludGVyZmFjZXMvc2xpZGVBbmFseXplcic7XG5pbXBvcnQgeyBQcm9qZWN0RGF0YSB9IGZyb20gJy4uL3NsaWRlJztcblxuLyoqXG4gKiDln7rnoYDliIbmnpDlmajmir3osaHnsbtcbiAqIOaPkOS+m+mAmueUqOWKn+iDveWSjOahhuaetu+8jOWFt+S9k+WIhuaekOeUseWtkOexu+WunueOsFxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVNsaWRlQW5hbHl6ZXIgaW1wbGVtZW50cyBTbGlkZUNvbnRlbnRBbmFseXplciB7XG4gIC8qKlxuICAgKiDliIbmnpDlubvnga/niYflhoXlrrlcbiAgICogQHBhcmFtIHNsaWRlIOW5u+eBr+eJh+WvueixoVxuICAgKiBAcmV0dXJucyDliIbmnpDnu5PmnpxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBhbmFseXplKHNsaWRlOiBHb29nbGVTbGlkZSk6IFByb21pc2U8U2xpZGVBbmFseXNpc1Jlc3VsdD4ge1xuICAgIC8vIOi/m+ihjOWfuuacrOW5u+eBr+eJh+WFg+e0oOWIhuaekFxuICAgIGNvbnN0IG1ldGFkYXRhID0gdGhpcy5hbmFseXplU2xpZGVNZXRhZGF0YShzbGlkZSk7XG4gICAgY29uc3QgY29udGVudFR5cGUgPSB0aGlzLmRldGVybWluZUNvbnRlbnRUeXBlKHNsaWRlKTtcbiAgICBcbiAgICAvLyDliJ3lp4vljJbnu5PmnpxcbiAgICBjb25zdCByZXN1bHQ6IFNsaWRlQW5hbHlzaXNSZXN1bHQgPSB7XG4gICAgICBjb250ZW50VHlwZSxcbiAgICAgIHByb2plY3RTdHJ1Y3R1cmU6IFByb2plY3RTdHJ1Y3R1cmVUeXBlLlVOS05PV04sXG4gICAgICBwcm9qZWN0RmllbGRzOiBbXSxcbiAgICAgIHByb2plY3RzOiBbXSxcbiAgICAgIGNvbmZpZGVuY2U6IDAsXG4gICAgICBtZXRhZGF0YVxuICAgIH07XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIOWIhuaekOmhueebrue7k+aehFxuICAgICAgcmVzdWx0LnByb2plY3RTdHJ1Y3R1cmUgPSB0aGlzLmFuYWx5emVQcm9qZWN0U3RydWN0dXJlKHNsaWRlKTtcbiAgICAgIFxuICAgICAgLy8g6L+b6KGM5YW35L2T5YaF5a655YiG5p6Q77yM55Sx5a2Q57G75a6e546wXG4gICAgICBjb25zdCBhbmFseXNpc1Jlc3VsdCA9IGF3YWl0IHRoaXMuYW5hbHl6ZUNvbnRlbnQoc2xpZGUsIGNvbnRlbnRUeXBlKTtcbiAgICAgIFxuICAgICAgLy8g5ZCI5bm25YiG5p6Q57uT5p6cXG4gICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgYW5hbHlzaXNSZXN1bHQpO1xuICAgICAgXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCflubvnga/niYfliIbmnpDplJnor686JywgZXJyb3IpO1xuICAgICAgcmVzdWx0Lndhcm5pbmdzID0gW2DliIbmnpDplJnor686ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBdO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliKTmlq3mmK/lkKblj6/ku6XlpITnkIbmraTnsbvlnovnmoTlubvnga/niYdcbiAgICog5a2Q57G75bqU6K+l6YeN5YaZ5q2k5pa55rOV5Lul5o+Q5L6b5YW35L2T55qE5Yik5pat6YC76L6RXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5piv5ZCm5Y+v5Lul5aSE55CGXG4gICAqL1xuICBwdWJsaWMgYWJzdHJhY3QgY2FuSGFuZGxlKHNsaWRlOiBHb29nbGVTbGlkZSk6IGJvb2xlYW47XG4gIFxuICAvKipcbiAgICog5YiG5p6Q5YW35L2T5YaF5a65XG4gICAqIOWtkOexu+mcgOimgeWunueOsOatpOaWueazlei/m+ihjOWFt+S9k+WIhuaekOmAu+i+kVxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEBwYXJhbSBjb250ZW50VHlwZSDlhoXlrrnnsbvlnotcbiAgICogQHJldHVybnMg6YOo5YiG5YiG5p6Q57uT5p6cXG4gICAqL1xuICBwcm90ZWN0ZWQgYWJzdHJhY3QgYW5hbHl6ZUNvbnRlbnQoXG4gICAgc2xpZGU6IEdvb2dsZVNsaWRlLCBcbiAgICBjb250ZW50VHlwZTogU2xpZGVDb250ZW50VHlwZVxuICApOiBQcm9taXNlPFBhcnRpYWw8U2xpZGVBbmFseXNpc1Jlc3VsdD4+O1xuICBcbiAgLyoqXG4gICAqIOWIhuaekOW5u+eBr+eJh+WFg+aVsOaNrlxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOW5u+eBr+eJh+WFg+aVsOaNrlxuICAgKi9cbiAgcHJvdGVjdGVkIGFuYWx5emVTbGlkZU1ldGFkYXRhKHNsaWRlOiBHb29nbGVTbGlkZSkge1xuICAgIGNvbnN0IHBhZ2VFbGVtZW50cyA9IHNsaWRlLnBhZ2VFbGVtZW50cyB8fCBbXTtcbiAgICBcbiAgICAvLyDorqHmlbDkuI3lkIznsbvlnovnmoTlhYPntKBcbiAgICBsZXQgdGFibGVDb3VudCA9IDA7XG4gICAgbGV0IHRleHRDb3VudCA9IDA7XG4gICAgbGV0IHNoYXBlQ291bnQgPSAwO1xuICAgIGxldCBsaXN0Q291bnQgPSAwO1xuICAgIFxuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBwYWdlRWxlbWVudHMpIHtcbiAgICAgIGlmIChlbGVtZW50LnRhYmxlKSB0YWJsZUNvdW50Kys7XG4gICAgICBpZiAoZWxlbWVudC5zaGFwZT8udGV4dCkge1xuICAgICAgICB0ZXh0Q291bnQrKztcbiAgICAgICAgLy8g5qOA5p+l5paH5pys5piv5ZCm5YyF5ZCr5YiX6KGoXG4gICAgICAgIGlmICh0aGlzLmNvbnRhaW5zTGlzdChlbGVtZW50LnNoYXBlLnRleHQudGV4dEVsZW1lbnRzKSkge1xuICAgICAgICAgIGxpc3RDb3VudCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZWxlbWVudC5zaGFwZSAmJiAhZWxlbWVudC5zaGFwZS50ZXh0KSBzaGFwZUNvdW50Kys7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzbGlkZUlkOiBzbGlkZS5vYmplY3RJZCxcbiAgICAgIGVsZW1lbnRDb3VudDogcGFnZUVsZW1lbnRzLmxlbmd0aCxcbiAgICAgIGhhc1RhYmxlOiB0YWJsZUNvdW50ID4gMCxcbiAgICAgIGhhc1RleHQ6IHRleHRDb3VudCA+IDAsXG4gICAgICBoYXNTaGFwZXM6IHNoYXBlQ291bnQgPiAwLFxuICAgICAgaGFzTGlzdHM6IGxpc3RDb3VudCA+IDBcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog56Gu5a6a5bm754Gv54mH5YaF5a6557G75Z6LXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5YaF5a6557G75Z6LXG4gICAqL1xuICBwcm90ZWN0ZWQgZGV0ZXJtaW5lQ29udGVudFR5cGUoc2xpZGU6IEdvb2dsZVNsaWRlKTogU2xpZGVDb250ZW50VHlwZSB7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmFuYWx5emVTbGlkZU1ldGFkYXRhKHNsaWRlKTtcbiAgICBcbiAgICBpZiAobWV0YWRhdGEuaGFzVGFibGUpIHtcbiAgICAgIC8vIOWmguaenOacieihqOagvO+8jOWPr+S7peaYr+ihqOagvOaIlua3t+WQiFxuICAgICAgcmV0dXJuIG1ldGFkYXRhLmhhc1RleHQgJiYgIXRoaXMuaXNUYWJsZURvbWluYW50KHNsaWRlKSBcbiAgICAgICAgPyBTbGlkZUNvbnRlbnRUeXBlLk1JWEVEIFxuICAgICAgICA6IFNsaWRlQ29udGVudFR5cGUuVEFCTEU7XG4gICAgfSBlbHNlIGlmIChtZXRhZGF0YS5oYXNMaXN0cykge1xuICAgICAgLy8g5aaC5p6c5pyJ5YiX6KGo5L2G5rKh5pyJ6KGo5qC8XG4gICAgICByZXR1cm4gU2xpZGVDb250ZW50VHlwZS5MSVNUO1xuICAgIH0gZWxzZSBpZiAobWV0YWRhdGEuaGFzVGV4dCkge1xuICAgICAgLy8g5aaC5p6c5pyJ5paH5pys5L2G5rKh5pyJ6KGo5qC85ZKM5YiX6KGoXG4gICAgICByZXR1cm4gU2xpZGVDb250ZW50VHlwZS5URVhUO1xuICAgIH0gZWxzZSBpZiAobWV0YWRhdGEuaGFzU2hhcGVzKSB7XG4gICAgICAvLyDlj6rmnInlvaLnirZcbiAgICAgIHJldHVybiBTbGlkZUNvbnRlbnRUeXBlLlNIQVBFO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gU2xpZGVDb250ZW50VHlwZS5VTktOT1dOO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG5p6Q6aG555uu57uT5p6E57G75Z6LXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg6aG555uu57uT5p6E57G75Z6LXG4gICAqL1xuICBwcm90ZWN0ZWQgYW5hbHl6ZVByb2plY3RTdHJ1Y3R1cmUoc2xpZGU6IEdvb2dsZVNsaWRlKTogUHJvamVjdFN0cnVjdHVyZVR5cGUge1xuICAgIC8vIOafpeaJvuW5u+eBr+eJh+agh+mimOaIluaWh+acrOWGheWuueS4reeahOWFs+mUruivjVxuICAgIGNvbnN0IHRleHRDb250ZW50ID0gdGhpcy5leHRyYWN0QWxsVGV4dENvbnRlbnQoc2xpZGUpO1xuICAgIGNvbnN0IGxvd2VyVGV4dCA9IHRleHRDb250ZW50LnRvTG93ZXJDYXNlKCk7XG4gICAgXG4gICAgLy8g5qC55o2u5YWz6ZSu6K+N5Yik5pat6aG555uu57uT5p6E57G75Z6LXG4gICAgaWYgKGxvd2VyVGV4dC5pbmNsdWRlcygnc3ByaW50JykgfHwgbG93ZXJUZXh0LmluY2x1ZGVzKCfov63ku6MnKSB8fCBcbiAgICAgICAgbG93ZXJUZXh0LmluY2x1ZGVzKCdpdGVyYXRpb24nKSB8fCBsb3dlclRleHQuaW5jbHVkZXMoJ+WRqOaKpScpKSB7XG4gICAgICByZXR1cm4gUHJvamVjdFN0cnVjdHVyZVR5cGUuU1BSSU5UO1xuICAgIH0gZWxzZSBpZiAobG93ZXJUZXh0LmluY2x1ZGVzKCdlcGljJykgfHwgbG93ZXJUZXh0LmluY2x1ZGVzKCfnibnmgKcnKSB8fCBcbiAgICAgICAgICAgICAgIGxvd2VyVGV4dC5pbmNsdWRlcygnZmVhdHVyZScpKSB7XG4gICAgICByZXR1cm4gUHJvamVjdFN0cnVjdHVyZVR5cGUuRVBJQztcbiAgICB9IGVsc2UgaWYgKGxvd2VyVGV4dC5pbmNsdWRlcygncmVsZWFzZScpIHx8IGxvd2VyVGV4dC5pbmNsdWRlcygn5Y+R5biDJykgfHwgXG4gICAgICAgICAgICAgICBsb3dlclRleHQuaW5jbHVkZXMoJ+eJiOacrCcpKSB7XG4gICAgICByZXR1cm4gUHJvamVjdFN0cnVjdHVyZVR5cGUuUkVMRUFTRTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29udGFpbnNNdWx0aXBsZUppcmFUaWNrZXRzKHRleHRDb250ZW50KSkge1xuICAgICAgLy8g5aaC5p6c5qOA5rWL5Yiw5aSa5LiqSmlyYeW3peWNlUlE77yM5L2G5rKh5pyJ5YW25LuW5YWz6ZSu6K+N77yM6buY6K6k5Li65re35ZCI57uT5p6EXG4gICAgICByZXR1cm4gUHJvamVjdFN0cnVjdHVyZVR5cGUuTUlYRUQ7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnRhaW5zU2luZ2xlSmlyYVRpY2tldCh0ZXh0Q29udGVudCkpIHtcbiAgICAgIC8vIOWmguaenOWPquajgOa1i+WIsOS4gOS4qkppcmHlt6XljZVJRFxuICAgICAgcmV0dXJuIFByb2plY3RTdHJ1Y3R1cmVUeXBlLlNJTkdMRV9USUNLRVQ7XG4gICAgfVxuICAgIFxuICAgIC8vIOm7mOiupOS4uuiHquWumuS5iee7k+aehFxuICAgIHJldHVybiBQcm9qZWN0U3RydWN0dXJlVHlwZS5DVVNUT007XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5blubvnga/niYfmiYDmnInmlofmnKzlhoXlrrlcbiAgICogQHBhcmFtIHNsaWRlIOW5u+eBr+eJh+WvueixoVxuICAgKiBAcmV0dXJucyDmiYDmnInmlofmnKzlhoXlrrlcbiAgICovXG4gIHByb3RlY3RlZCBleHRyYWN0QWxsVGV4dENvbnRlbnQoc2xpZGU6IEdvb2dsZVNsaWRlKTogc3RyaW5nIHtcbiAgICBjb25zdCB0ZXh0Q29udGVudDogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBpZiAoIXNsaWRlLnBhZ2VFbGVtZW50cykgcmV0dXJuICcnO1xuICAgIFxuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBzbGlkZS5wYWdlRWxlbWVudHMpIHtcbiAgICAgIC8vIOS7juihqOagvOS4reaPkOWPluaWh+acrFxuICAgICAgaWYgKGVsZW1lbnQudGFibGUgJiYgZWxlbWVudC50YWJsZS50YWJsZVJvd3MpIHtcbiAgICAgICAgZm9yIChjb25zdCByb3cgb2YgZWxlbWVudC50YWJsZS50YWJsZVJvd3MpIHtcbiAgICAgICAgICBpZiAoIXJvdy50YWJsZUNlbGxzKSBjb250aW51ZTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IGNlbGwgb2Ygcm93LnRhYmxlQ2VsbHMpIHtcbiAgICAgICAgICAgIGlmICghY2VsbC50ZXh0IHx8ICFjZWxsLnRleHQudGV4dEVsZW1lbnRzKSBjb250aW51ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgY2VsbFRleHQgPSBjZWxsLnRleHQudGV4dEVsZW1lbnRzXG4gICAgICAgICAgICAgIC5tYXAoZSA9PiBlLnRleHRSdW4/LmNvbnRlbnQgfHwgJycpXG4gICAgICAgICAgICAgIC5qb2luKCcnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNlbGxUZXh0LnRyaW0oKSkge1xuICAgICAgICAgICAgICB0ZXh0Q29udGVudC5wdXNoKGNlbGxUZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5LuO5b2i54q25Lit5o+Q5Y+W5paH5pysXG4gICAgICBpZiAoZWxlbWVudC5zaGFwZSAmJiBlbGVtZW50LnNoYXBlLnRleHQgJiYgZWxlbWVudC5zaGFwZS50ZXh0LnRleHRFbGVtZW50cykge1xuICAgICAgICBjb25zdCBzaGFwZVRleHQgPSBlbGVtZW50LnNoYXBlLnRleHQudGV4dEVsZW1lbnRzXG4gICAgICAgICAgLm1hcChlID0+IGUudGV4dFJ1bj8uY29udGVudCB8fCAnJylcbiAgICAgICAgICAuam9pbignJyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc2hhcGVUZXh0LnRyaW0oKSkge1xuICAgICAgICAgIHRleHRDb250ZW50LnB1c2goc2hhcGVUZXh0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdGV4dENvbnRlbnQuam9pbignXFxuJyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmmK/lkKbljIXlkKvljZXkuKpKaXJh5bel5Y2VXG4gICAqIEBwYXJhbSB0ZXh0IOaWh+acrOWGheWuuVxuICAgKiBAcmV0dXJucyDmmK/lkKbljIXlkKvljZXkuKpKaXJh5bel5Y2VXG4gICAqL1xuICBwcm90ZWN0ZWQgY29udGFpbnNTaW5nbGVKaXJhVGlja2V0KHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGppcmFUaWNrZXRQYXR0ZXJuID0gL1tBLVpdKy1cXGQrL2c7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHRleHQubWF0Y2goamlyYVRpY2tldFBhdHRlcm4pO1xuICAgIHJldHVybiBtYXRjaGVzICE9PSBudWxsICYmIG1hdGNoZXMubGVuZ3RoID09PSAxO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5YyF5ZCr5aSa5LiqSmlyYeW3peWNlVxuICAgKiBAcGFyYW0gdGV4dCDmlofmnKzlhoXlrrlcbiAgICogQHJldHVybnMg5piv5ZCm5YyF5ZCr5aSa5LiqSmlyYeW3peWNlVxuICAgKi9cbiAgcHJvdGVjdGVkIGNvbnRhaW5zTXVsdGlwbGVKaXJhVGlja2V0cyh0ZXh0OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBqaXJhVGlja2V0UGF0dGVybiA9IC9bQS1aXSstXFxkKy9nO1xuICAgIGNvbnN0IG1hdGNoZXMgPSB0ZXh0Lm1hdGNoKGppcmFUaWNrZXRQYXR0ZXJuKTtcbiAgICByZXR1cm4gbWF0Y2hlcyAhPT0gbnVsbCAmJiBtYXRjaGVzLmxlbmd0aCA+IDE7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6XmlofmnKzlhYPntKDmmK/lkKbljIXlkKvliJfooahcbiAgICogQHBhcmFtIHRleHRFbGVtZW50cyDmlofmnKzlhYPntKDmlbDnu4RcbiAgICogQHJldHVybnMg5piv5ZCm5YyF5ZCr5YiX6KGoXG4gICAqL1xuICBwcm90ZWN0ZWQgY29udGFpbnNMaXN0KHRleHRFbGVtZW50cz86IEdvb2dsZVRleHRFbGVtZW50W10pOiBib29sZWFuIHtcbiAgICBpZiAoIXRleHRFbGVtZW50cykgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIHJldHVybiB0ZXh0RWxlbWVudHMuc29tZShlbGVtZW50ID0+IFxuICAgICAgZWxlbWVudC5wYXJhZ3JhcGhNYXJrZXI/LnN0eWxlPy5idWxsZXRQcmVzZXQgIT09IHVuZGVmaW5lZFxuICAgICk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliKTmlq3ooajmoLzmmK/lkKbmmK/lubvnga/niYfnmoTkuLvopoHlhoXlrrlcbiAgICogQHBhcmFtIHNsaWRlIOW5u+eBr+eJh+WvueixoVxuICAgKiBAcmV0dXJucyDooajmoLzmmK/lkKbkuLrkuLvopoHlhoXlrrlcbiAgICovXG4gIHByb3RlY3RlZCBpc1RhYmxlRG9taW5hbnQoc2xpZGU6IEdvb2dsZVNsaWRlKTogYm9vbGVhbiB7XG4gICAgaWYgKCFzbGlkZS5wYWdlRWxlbWVudHMpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBjb25zdCB0b3RhbEVsZW1lbnRzID0gc2xpZGUucGFnZUVsZW1lbnRzLmxlbmd0aDtcbiAgICBjb25zdCB0YWJsZUVsZW1lbnRzID0gc2xpZGUucGFnZUVsZW1lbnRzLmZpbHRlcihlID0+IGUudGFibGUpLmxlbmd0aDtcbiAgICBcbiAgICAvLyDlpoLmnpzooajmoLzlhYPntKDljaDmr5TotoXov4c1MCXvvIzmiJbogIXlj6rmnInkuIDkuKrooajmoLzlkozlsJHph4/lhbbku5blhYPntKBcbiAgICByZXR1cm4gKHRhYmxlRWxlbWVudHMgLyB0b3RhbEVsZW1lbnRzID4gMC41KSB8fCBcbiAgICAgICAgICAgKHRhYmxlRWxlbWVudHMgPT09IDEgJiYgdG90YWxFbGVtZW50cyA8PSAzKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOS7juaWh+acrOS4reaPkOWPluaJgOaciUppcmHlt6XljZVJRFxuICAgKiBAcGFyYW0gdGV4dCDmlofmnKzlhoXlrrlcbiAgICogQHJldHVybnMgSmlyYeW3peWNlUlE5pWw57uEXG4gICAqL1xuICBwcm90ZWN0ZWQgZXh0cmFjdEppcmFUaWNrZXRzKHRleHQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBqaXJhVGlja2V0UGF0dGVybiA9IC9bQS1aXSstXFxkKy9nO1xuICAgIHJldHVybiB0ZXh0Lm1hdGNoKGppcmFUaWNrZXRQYXR0ZXJuKSB8fCBbXTtcbiAgfVxufSAiLCIvKipcbiAqIOW5u+eBr+eJh+WIhuaekOWZqOaOpeWPo+WumuS5iVxuICovXG5cbmltcG9ydCB7IEdvb2dsZVNsaWRlLCBHb29nbGVQYWdlRWxlbWVudCB9IGZyb20gJy4vZ29vZ2xlU2xpZGVzJztcbmltcG9ydCB7IFByb2plY3REYXRhIH0gZnJvbSAnLi4vc2xpZGUnO1xuXG4vKipcbiAqIOW5u+eBr+eJh+WGheWuueexu+Wei+aemuS4vlxuICovXG5leHBvcnQgZW51bSBTbGlkZUNvbnRlbnRUeXBlIHtcbiAgVEFCTEUgPSAndGFibGUnLFxuICBURVhUID0gJ3RleHQnLFxuICBTSEFQRSA9ICdzaGFwZScsXG4gIExJU1QgPSAnbGlzdCcsXG4gIE1JWEVEID0gJ21peGVkJyxcbiAgVU5LTk9XTiA9ICd1bmtub3duJ1xufVxuXG4vKipcbiAqIOmhueebrue7k+aehOexu+Wei+aemuS4vlxuICovXG5leHBvcnQgZW51bSBQcm9qZWN0U3RydWN0dXJlVHlwZSB7XG4gIFNJTkdMRV9USUNLRVQgPSAnc2luZ2xlX3RpY2tldCcsICAvLyDljZXkuKpKaXJh5bel5Y2VXG4gIFNQUklOVCA9ICdzcHJpbnQnLCAgICAgICAgICAgICAgICAvLyBTcHJpbnQv6L+t5LujXG4gIEVQSUMgPSAnZXBpYycsICAgICAgICAgICAgICAgICAgICAvLyBFcGljL+eJueaAp1xuICBSRUxFQVNFID0gJ3JlbGVhc2UnLCAgICAgICAgICAgICAgLy8g5Y+R5biDXG4gIE1JWEVEID0gJ21peGVkJywgICAgICAgICAgICAgICAgICAvLyDmt7flkIjnu5PmnoRcbiAgQ1VTVE9NID0gJ2N1c3RvbScsICAgICAgICAgICAgICAgIC8vIOiHquWumuS5iee7k+aehFxuICBVTktOT1dOID0gJ3Vua25vd24nICAgICAgICAgICAgICAgLy8g5pyq55+l57uT5p6EXG59XG5cbi8qKlxuICog5bm754Gv54mH5YaF5a655YiG5p6Q57uT5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2xpZGVBbmFseXNpc1Jlc3VsdCB7XG4gIGNvbnRlbnRUeXBlOiBTbGlkZUNvbnRlbnRUeXBlO1xuICBwcm9qZWN0U3RydWN0dXJlOiBQcm9qZWN0U3RydWN0dXJlVHlwZTtcbiAgcHJvamVjdEZpZWxkczogc3RyaW5nW107XG4gIHByb2plY3RzOiBQcm9qZWN0RGF0YVtdO1xuICBjb25maWRlbmNlOiBudW1iZXI7XG4gIG1ldGFkYXRhOiB7XG4gICAgc2xpZGVJZDogc3RyaW5nO1xuICAgIGVsZW1lbnRDb3VudDogbnVtYmVyO1xuICAgIGhhc1RhYmxlOiBib29sZWFuO1xuICAgIGhhc1RleHQ6IGJvb2xlYW47XG4gICAgaGFzU2hhcGVzOiBib29sZWFuO1xuICAgIGhhc0xpc3RzOiBib29sZWFuO1xuICB9O1xuICB3YXJuaW5ncz86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIOW5u+eBr+eJh+WGheWuueWIhuaekOWZqOaOpeWPo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFNsaWRlQ29udGVudEFuYWx5emVyIHtcbiAgLyoqXG4gICAqIOWIhuaekOW5u+eBr+eJh+WGheWuuVxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOWIhuaekOe7k+aenFxuICAgKi9cbiAgYW5hbHl6ZShzbGlkZTogR29vZ2xlU2xpZGUpOiBQcm9taXNlPFNsaWRlQW5hbHlzaXNSZXN1bHQ+O1xuICBcbiAgLyoqXG4gICAqIOWIpOaWreaYr+WQpuWPr+S7peWkhOeQhuatpOexu+Wei+eahOW5u+eBr+eJh1xuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOaYr+WQpuWPr+S7peWkhOeQhlxuICAgKi9cbiAgY2FuSGFuZGxlKHNsaWRlOiBHb29nbGVTbGlkZSk6IGJvb2xlYW47XG59XG5cbi8qKlxuICog6KGo5qC85YaF5a655YiG5p6Q5Zmo5o6l5Y+jXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVGFibGVDb250ZW50QW5hbHl6ZXIgZXh0ZW5kcyBTbGlkZUNvbnRlbnRBbmFseXplciB7XG4gIC8qKlxuICAgKiDliIbmnpDooajmoLznu5PmnoRcbiAgICogQHBhcmFtIHRhYmxlRWxlbWVudCDooajmoLzlhYPntKBcbiAgICogQHJldHVybnMg6KGo5qC85YiG5p6Q57uT5p6cXG4gICAqL1xuICBhbmFseXplVGFibGUodGFibGVFbGVtZW50OiBHb29nbGVQYWdlRWxlbWVudCk6IFByb21pc2U8e1xuICAgIGhlYWRlcnM6IHN0cmluZ1tdO1xuICAgIGNvbHVtbk1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gICAgcHJvamVjdFJvd3M6IFByb2plY3REYXRhW107XG4gIH0+O1xufVxuXG4vKipcbiAqIOaWh+acrOWGheWuueWIhuaekOWZqOaOpeWPo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFRleHRDb250ZW50QW5hbHl6ZXIgZXh0ZW5kcyBTbGlkZUNvbnRlbnRBbmFseXplciB7XG4gIC8qKlxuICAgKiDliIbmnpDmlofmnKzlhoXlrrlcbiAgICogQHBhcmFtIHRleHRFbGVtZW50cyDmlofmnKzlhYPntKDmlbDnu4RcbiAgICogQHJldHVybnMg5paH5pys5YiG5p6Q57uT5p6cXG4gICAqL1xuICBhbmFseXplVGV4dEVsZW1lbnRzKHRleHRFbGVtZW50czogR29vZ2xlUGFnZUVsZW1lbnRbXSk6IFByb21pc2U8e1xuICAgIHByb2plY3RGaWVsZHM6IHN0cmluZ1tdO1xuICAgIHByb2plY3RzOiBQcm9qZWN0RGF0YVtdO1xuICB9Pjtcbn1cblxuLyoqXG4gKiDlhYPntKDlvJXnlKjorrDlvZVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50UmVmZXJlbmNlIHtcbiAgc2xpZGVJZDogc3RyaW5nO1xuICBlbGVtZW50SWQ6IHN0cmluZztcbiAgZWxlbWVudFR5cGU6IHN0cmluZztcbiAgY29udGVudFBhdGg/OiBzdHJpbmdbXTsgLy8g55So5LqO5a6a5L2N5YWD57Sg5YaF55qE54m55a6a5YaF5a65XG59XG5cbi8qKlxuICog5bim5pyJ5YWD57Sg5byV55So55qE6aG555uu5pWw5o2uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJvamVjdERhdGFXaXRoUmVmZXJlbmNlcyBleHRlbmRzIFByb2plY3REYXRhIHtcbiAgZWxlbWVudFJlZmVyZW5jZXM6IFJlY29yZDxzdHJpbmcsIEVsZW1lbnRSZWZlcmVuY2U+OyAvLyDlrZfmrrXlkI3liLDlhYPntKDlvJXnlKjnmoTmmKDlsIRcbn1cblxuLyoqXG4gKiDpobnnm67lrZfmrrXlu7rorq5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9qZWN0RmllbGRTdWdnZXN0aW9uIHtcbiAgZmllbGROYW1lOiBzdHJpbmc7XG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgcG9zc2libGVWYWx1ZXM/OiBzdHJpbmdbXTtcbiAgaXNSZXF1aXJlZD86IGJvb2xlYW47XG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIOW5u+eBr+eJh+WIhuaekOWZqOW3peWOguaOpeWPo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFNsaWRlQW5hbHl6ZXJGYWN0b3J5IHtcbiAgLyoqXG4gICAqIOWIm+W7uuWQiOmAgueahOWIhuaekOWZqFxuICAgKiBAcGFyYW0gc2xpZGUg5bm754Gv54mH5a+56LGhXG4gICAqIEByZXR1cm5zIOmAguWQiOeahOWIhuaekOWZqFxuICAgKi9cbiAgY3JlYXRlQW5hbHl6ZXIoc2xpZGU6IEdvb2dsZVNsaWRlKTogU2xpZGVDb250ZW50QW5hbHl6ZXI7XG59ICIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiLyoqXG4gKiDooajmoLzlhoXlrrnliIbmnpDlmajlrp7njrBcbiAqL1xuXG5pbXBvcnQgeyBHb29nbGVTbGlkZSwgR29vZ2xlUGFnZUVsZW1lbnQsIEdvb2dsZVRhYmxlQ2VsbCwgR29vZ2xlVGFibGVSb3csIEdvb2dsZVRleHRFbGVtZW50IH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9nb29nbGVTbGlkZXMnO1xuaW1wb3J0IHsgXG4gIFNsaWRlQ29udGVudFR5cGUsIFxuICBUYWJsZUNvbnRlbnRBbmFseXplciwgXG4gIFNsaWRlQW5hbHlzaXNSZXN1bHQgXG59IGZyb20gJy4uL2ludGVyZmFjZXMvc2xpZGVBbmFseXplcic7XG5pbXBvcnQgeyBCYXNlU2xpZGVBbmFseXplciB9IGZyb20gJy4vYmFzZUFuYWx5emVyJztcbmltcG9ydCB7IFByb2plY3REYXRhIH0gZnJvbSAnLi4vc2xpZGUnO1xuXG4vKipcbiAqIOihqOagvOWIhuaekOWZqOexu1xuICog5LiT6Zeo5aSE55CG6KGo5qC85qC35byP55qE6aG555uu5pWw5o2uXG4gKi9cbmV4cG9ydCBjbGFzcyBUYWJsZUNvbnRlbnRBbmFseXplckltcGwgZXh0ZW5kcyBCYXNlU2xpZGVBbmFseXplciBpbXBsZW1lbnRzIFRhYmxlQ29udGVudEFuYWx5emVyIHtcbiAgLy8g6K+G5Yir6aG555uu54q25oCB55qE5bi46KeB5YiX5ZCNXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNUQVRVU19DT0xVTU5TID0gWydzdGF0dXMnLCAnc3RhdGUnLCAnc3RhZ2UnLCAn54q25oCBJywgJ+mYtuautSddO1xuICBcbiAgLy8g6K+G5Yir6aG555uu5o+P6L+w55qE5bi46KeB5YiX5ZCNXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFU0NSSVBUSU9OX0NPTFVNTlMgPSBbJ3Byb2plY3QnLCAnZGVzY3JpcHRpb24nLCAnc3VtbWFyeScsICduYW1lJywgJ3RpdGxlJywgJ+mhueebricsICfmj4/ov7AnLCAn5ZCN56ewJywgJ+agh+mimCddO1xuICBcbiAgLy8g6K+G5Yir6aG555uu6LSf6LSj5Lq655qE5bi46KeB5YiX5ZCNXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE9XTkVSX0NPTFVNTlMgPSBbJ293bmVyJywgJ2Fzc2lnbmVlJywgJ3Jlc3BvbnNpYmxlJywgJ3BlcnNvbicsICdsZWFkJywgJ3JlcG9ydGVyJywgJ+i0n+i0o+S6uicsICfotKPku7vkuronLCAn5omA5pyJ6ICFJywgJ+aJp+ihjOiAhSddO1xuICBcbiAgLy8g6K+G5Yir6LWb6YGTL+WboumYn+eahOW4uOingeWIl+WQjVxuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBUUkFDS19DT0xVTU5TID0gWyd0cmFjaycsICd0ZWFtJywgJ2dyb3VwJywgJ2RlcGFydG1lbnQnLCAnYXJlYScsICfotZvpgZMnLCAn5Zui6ZifJywgJ+e7hOWIqycsICfpg6jpl6gnLCAn5YiG57G7J107XG4gIFxuICAvLyDor4bliKvlpIfms6gv5rOo6YeK55qE5bi46KeB5YiX5ZCNXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENPTU1FTlRTX0NPTFVNTlMgPSBbJ2NvbW1lbnQnLCAnbm90ZScsICdhY3Rpb24nLCAnaXRlbScsICd0b2RvJywgJ3JlbWFya3MnLCAnaGlnaHRsaWdodCcsICflpIfms6gnLCAn5rOo6YeKJywgJ+ihjOWKqOmhuScsICflvoXlip4nXTtcblxuICAvKipcbiAgICog5Yik5pat5piv5ZCm5Y+v5Lul5aSE55CG5q2k57G75Z6L55qE5bm754Gv54mHXG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHJldHVybnMg5piv5ZCm5Y+v5Lul5aSE55CGXG4gICAqL1xuICBwdWJsaWMgY2FuSGFuZGxlKHNsaWRlOiBHb29nbGVTbGlkZSk6IGJvb2xlYW4ge1xuICAgIC8vIOajgOafpeaYr+WQpuacieihqOagvOWFg+e0oFxuICAgIGlmICghc2xpZGUucGFnZUVsZW1lbnRzKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgY29uc3QgaGFzVGFibGUgPSBzbGlkZS5wYWdlRWxlbWVudHMuc29tZShlbGVtZW50ID0+IGVsZW1lbnQudGFibGUgIT09IHVuZGVmaW5lZCk7XG4gICAgaWYgKCFoYXNUYWJsZSkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIC8vIOWmguaenOacieihqOagvO+8jOi/m+S4gOatpeajgOafpeihqOagvOaYr+WQpuWPr+iDveWMheWQq+mhueebruaVsOaNrlxuICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gdGhpcy5kZXRlcm1pbmVDb250ZW50VHlwZShzbGlkZSk7XG4gICAgcmV0dXJuIGNvbnRlbnRUeXBlID09PSBTbGlkZUNvbnRlbnRUeXBlLlRBQkxFIHx8IGNvbnRlbnRUeXBlID09PSBTbGlkZUNvbnRlbnRUeXBlLk1JWEVEO1xuICB9XG4gIFxuICAvKipcbiAgICog5YiG5p6Q6KGo5qC85YaF5a65XG4gICAqIEBwYXJhbSBzbGlkZSDlubvnga/niYflr7nosaFcbiAgICogQHBhcmFtIGNvbnRlbnRUeXBlIOWGheWuueexu+Wei1xuICAgKiBAcmV0dXJucyDliIbmnpDnu5PmnpxcbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBhbmFseXplQ29udGVudChcbiAgICBzbGlkZTogR29vZ2xlU2xpZGUsIFxuICAgIGNvbnRlbnRUeXBlOiBTbGlkZUNvbnRlbnRUeXBlXG4gICk6IFByb21pc2U8UGFydGlhbDxTbGlkZUFuYWx5c2lzUmVzdWx0Pj4ge1xuICAgIGlmICghc2xpZGUucGFnZUVsZW1lbnRzKSB7XG4gICAgICByZXR1cm4geyBwcm9qZWN0czogW10sIGNvbmZpZGVuY2U6IDAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g5p+l5om+5omA5pyJ6KGo5qC85YWD57SgXG4gICAgY29uc3QgdGFibGVFbGVtZW50cyA9IHNsaWRlLnBhZ2VFbGVtZW50cy5maWx0ZXIoZWxlbWVudCA9PiBlbGVtZW50LnRhYmxlKTtcbiAgICBpZiAodGFibGVFbGVtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7IHByb2plY3RzOiBbXSwgY29uZmlkZW5jZTogMCB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDliIbmnpDmiYDmnInooajmoLzvvIzmib7lh7rmnIDlj6/og73ljIXlkKvpobnnm67mlbDmja7nmoTooajmoLxcbiAgICBjb25zdCBhbGxUYWJsZVJlc3VsdHM6IEFycmF5PHtcbiAgICAgIHByb2plY3RzOiBQcm9qZWN0RGF0YVtdO1xuICAgICAgdGFibGVFbGVtZW50OiBHb29nbGVQYWdlRWxlbWVudDtcbiAgICAgIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgICAgIGNvbHVtbk1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gICAgICBwcm9qZWN0RmllbGRzOiBzdHJpbmdbXTtcbiAgICB9PiA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgdGFibGVFbGVtZW50IG9mIHRhYmxlRWxlbWVudHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuYW5hbHl6ZVRhYmxlKHRhYmxlRWxlbWVudCk7XG4gICAgICAgIFxuICAgICAgICAvLyDorqHnrpfmraTooajmoLznmoTnva7kv6HluqZcbiAgICAgICAgY29uc3QgY29uZmlkZW5jZSA9IHRoaXMuY2FsY3VsYXRlVGFibGVDb25maWRlbmNlKFxuICAgICAgICAgIHJlc3VsdC5oZWFkZXJzLCBcbiAgICAgICAgICByZXN1bHQuY29sdW1uTWFwcGluZywgXG4gICAgICAgICAgcmVzdWx0LnByb2plY3RSb3dzXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyDmj5Dlj5bpobnnm67lrZfmrrXlkI3np7BcbiAgICAgICAgY29uc3QgcHJvamVjdEZpZWxkcyA9IE9iamVjdC5rZXlzKHJlc3VsdC5jb2x1bW5NYXBwaW5nKS5maWx0ZXIoZmllbGQgPT4gXG4gICAgICAgICAgcmVzdWx0LmNvbHVtbk1hcHBpbmdbZmllbGRdICE9PSAtMVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgYWxsVGFibGVSZXN1bHRzLnB1c2goe1xuICAgICAgICAgIHByb2plY3RzOiByZXN1bHQucHJvamVjdFJvd3MsXG4gICAgICAgICAgdGFibGVFbGVtZW50LFxuICAgICAgICAgIGNvbmZpZGVuY2UsXG4gICAgICAgICAgY29sdW1uTWFwcGluZzogcmVzdWx0LmNvbHVtbk1hcHBpbmcsXG4gICAgICAgICAgcHJvamVjdEZpZWxkc1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+ihqOagvOWIhuaekOmUmeivrzonLCBlcnJvcik7XG4gICAgICAgIC8vIOe7p+e7reWIhuaekOS4i+S4gOS4quihqOagvFxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDlpoLmnpzmsqHmnInmib7liLDku7vkvZXpobnnm67mlbDmja7vvIzov5Tlm57nqbrnu5PmnpxcbiAgICBpZiAoYWxsVGFibGVSZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHsgcHJvamVjdHM6IFtdLCBjb25maWRlbmNlOiAwIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOmAieaLqee9ruS/oeW6puacgOmrmOeahOihqOagvOe7k+aenFxuICAgIGFsbFRhYmxlUmVzdWx0cy5zb3J0KChhLCBiKSA9PiBiLmNvbmZpZGVuY2UgLSBhLmNvbmZpZGVuY2UpO1xuICAgIGNvbnN0IGJlc3RSZXN1bHQgPSBhbGxUYWJsZVJlc3VsdHNbMF07XG4gICAgXG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8g5aaC5p6c5pyJ5aSa5Liq6KGo5qC877yM5L2G5peg5rOV56Gu5a6a5Li76KGo5qC877yM5re75Yqg6K2m5ZGKXG4gICAgaWYgKGFsbFRhYmxlUmVzdWx0cy5sZW5ndGggPiAxICYmIFxuICAgICAgICBiZXN0UmVzdWx0LmNvbmZpZGVuY2UgPiAwICYmIFxuICAgICAgICBhbGxUYWJsZVJlc3VsdHNbMV0uY29uZmlkZW5jZSA+IGJlc3RSZXN1bHQuY29uZmlkZW5jZSAqIDAuOCkge1xuICAgICAgd2FybmluZ3MucHVzaCgn5bm754Gv54mH5YyF5ZCr5aSa5Liq5Y+v6IO955qE6aG555uu6KGo5qC877yM5bey6YCJ5oup5pyA5Y+v6IO955qE5LiA5Liq6L+b6KGM5YiG5p6QJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOWmguaenOacgOS9s+ihqOagvOeahOe9ruS/oeW6puS7jeeEtuW+iOS9ju+8jOa3u+WKoOitpuWRilxuICAgIGlmIChiZXN0UmVzdWx0LmNvbmZpZGVuY2UgPCAwLjUpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ+ihqOagvOe7k+aehOivhuWIq+e9ruS/oeW6pui+g+S9ju+8jOWPr+iDveS4jeaYr+agh+WHhumhueebruihqOagvCcpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcHJvamVjdHM6IGJlc3RSZXN1bHQucHJvamVjdHMsXG4gICAgICBjb25maWRlbmNlOiBiZXN0UmVzdWx0LmNvbmZpZGVuY2UsXG4gICAgICBwcm9qZWN0RmllbGRzOiBiZXN0UmVzdWx0LnByb2plY3RGaWVsZHMsXG4gICAgICB3YXJuaW5nczogd2FybmluZ3MubGVuZ3RoID4gMCA/IHdhcm5pbmdzIDogdW5kZWZpbmVkXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIhuaekOihqOagvOe7k+aehFxuICAgKiBAcGFyYW0gdGFibGVFbGVtZW50IOihqOagvOWFg+e0oFxuICAgKiBAcmV0dXJucyDooajmoLzliIbmnpDnu5PmnpxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBhbmFseXplVGFibGUodGFibGVFbGVtZW50OiBHb29nbGVQYWdlRWxlbWVudCk6IFByb21pc2U8e1xuICAgIGhlYWRlcnM6IHN0cmluZ1tdO1xuICAgIGNvbHVtbk1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gICAgcHJvamVjdFJvd3M6IFByb2plY3REYXRhW107XG4gIH0+IHtcbiAgICBpZiAoIXRhYmxlRWxlbWVudC50YWJsZSB8fCAhdGFibGVFbGVtZW50LnRhYmxlLnRhYmxlUm93cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfml6DmlYjnmoTooajmoLzlhYPntKAnKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgdGFibGVEYXRhID0gdGFibGVFbGVtZW50LnRhYmxlO1xuICAgIGNvbnN0IHRhYmxlSWQgPSB0YWJsZUVsZW1lbnQub2JqZWN0SWQ7XG4gICAgXG4gICAgaWYgKHRhYmxlRGF0YS50YWJsZVJvd3MubGVuZ3RoIDwgMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfooajmoLzooYzmlbDkuI3otrMnKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6I635Y+W6KGo5aS06KGMXG4gICAgY29uc3QgaGVhZGVyUm93ID0gdGFibGVEYXRhLnRhYmxlUm93c1swXTtcbiAgICBpZiAoIWhlYWRlclJvdy50YWJsZUNlbGxzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ihqOWktOihjOS4jeWMheWQq+WNleWFg+agvCcpO1xuICAgIH1cbiAgICBcbiAgICAvLyDop6PmnpDooajlpLRcbiAgICBjb25zdCBoZWFkZXJzID0gaGVhZGVyUm93LnRhYmxlQ2VsbHMubWFwKChjZWxsOiBHb29nbGVUYWJsZUNlbGwpID0+IHtcbiAgICAgIGlmICghY2VsbC50ZXh0IHx8ICFjZWxsLnRleHQudGV4dEVsZW1lbnRzKSByZXR1cm4gJyc7XG4gICAgICByZXR1cm4gY2VsbC50ZXh0LnRleHRFbGVtZW50c1xuICAgICAgICAubWFwKCh0ZXh0RWxlbWVudDogR29vZ2xlVGV4dEVsZW1lbnQpID0+IHRleHRFbGVtZW50LnRleHRSdW4/LmNvbnRlbnQgfHwgJycpXG4gICAgICAgIC5qb2luKCcnKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAudHJpbSgpO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIOivhuWIq+WIl+e0ouW8le+8jOmHh+eUqOabtOaZuuiDveeahOWIl+WQjeWMuemFjVxuICAgIGNvbnN0IGNvbHVtbk1hcHBpbmcgPSB0aGlzLm1hcENvbHVtbkluZGljZXMoaGVhZGVycyk7XG4gICAgXG4gICAgLy8g5aSE55CG5pWw5o2u6KGMXG4gICAgY29uc3QgcHJvamVjdFJvd3M6IFByb2plY3REYXRhW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IHRhYmxlRGF0YS50YWJsZVJvd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJvdyA9IHRhYmxlRGF0YS50YWJsZVJvd3NbaV07XG4gICAgICBpZiAoIXJvdy50YWJsZUNlbGxzKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY2VsbHMgPSByb3cudGFibGVDZWxscztcbiAgICAgIFxuICAgICAgLy8g56Gu5L+d5pyJ6Laz5aSf55qE5Y2V5YWD5qC8XG4gICAgICBjb25zdCByZXF1aXJlZENvbHVtbnMgPSBbXG4gICAgICAgIGNvbHVtbk1hcHBpbmcuZGVzY3JpcHRpb24sIFxuICAgICAgICBjb2x1bW5NYXBwaW5nLnN0YXR1c1xuICAgICAgXS5maWx0ZXIoaWR4ID0+IGlkeCAhPT0gLTEpO1xuICAgICAgXG4gICAgICBjb25zdCBtYXhSZXF1aXJlZENvbHVtbiA9IE1hdGgubWF4KC4uLnJlcXVpcmVkQ29sdW1ucyk7XG4gICAgICBpZiAoY2VsbHMubGVuZ3RoIDw9IG1heFJlcXVpcmVkQ29sdW1uKSB7XG4gICAgICAgIC8vIOi3s+i/h+ayoeaciei2s+Wkn+WIl+eahOihjFxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8g5o+Q5Y+W6aG555uu5pWw5o2uXG4gICAgICAgIGNvbnN0IHByb2plY3QgPSB0aGlzLmV4dHJhY3RQcm9qZWN0RnJvbVJvdyhcbiAgICAgICAgICB0YWJsZUlkLFxuICAgICAgICAgIGNlbGxzLFxuICAgICAgICAgIGNvbHVtbk1hcHBpbmcsXG4gICAgICAgICAgaVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKHByb2plY3QpIHtcbiAgICAgICAgICBwcm9qZWN0Um93cy5wdXNoKHByb2plY3QpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oYOWkhOeQhuesrCR7aX3ooYzml7blh7rplJk6YCwgZXJyb3IpO1xuICAgICAgICAvLyDnu6fnu63lpITnkIbkuIvkuIDooYxcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGhlYWRlcnMsXG4gICAgICBjb2x1bW5NYXBwaW5nLFxuICAgICAgcHJvamVjdFJvd3NcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5pm66IO95Yy56YWN5YiX57Si5byVXG4gICAqIOS9v+eUqOaooeeziuWMuemFjeWSjOWQjOS5ieivjeadpeivhuWIq+WIl+eahOeUqOmAlFxuICAgKiBAcGFyYW0gaGVhZGVycyDooajlpLTmlofmnKzmlbDnu4RcbiAgICogQHJldHVybnMg5YiX5pig5bCEXG4gICAqL1xuICBwcml2YXRlIG1hcENvbHVtbkluZGljZXMoaGVhZGVyczogc3RyaW5nW10pOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+IHtcbiAgICBjb25zdCBjb2x1bW5NYXBwaW5nOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAgICAgc3RhdHVzOiAtMSxcbiAgICAgIGRlc2NyaXB0aW9uOiAtMSxcbiAgICAgIG93bmVyOiAtMSxcbiAgICAgIHRyYWNrOiAtMSxcbiAgICAgIGNvbW1lbnRzOiAtMVxuICAgIH07XG4gICAgXG4gICAgLy8g5a+55q+P5Liq6KGo5aS077yM5qOA5p+l5piv5ZCm5Yy56YWN5Lu75LiA57G75Z6L55qE5YiXXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBoZWFkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJzW2ldO1xuICAgICAgXG4gICAgICAvLyDnirbmgIHliJfmo4Dmn6VcbiAgICAgIGlmIChUYWJsZUNvbnRlbnRBbmFseXplckltcGwuU1RBVFVTX0NPTFVNTlMuc29tZShrZXl3b3JkID0+IGhlYWRlci5pbmNsdWRlcyhrZXl3b3JkKSkpIHtcbiAgICAgICAgY29sdW1uTWFwcGluZy5zdGF0dXMgPSBpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmj4/ov7DliJfmo4Dmn6VcbiAgICAgIGlmIChUYWJsZUNvbnRlbnRBbmFseXplckltcGwuREVTQ1JJUFRJT05fQ09MVU1OUy5zb21lKGtleXdvcmQgPT4gaGVhZGVyLmluY2x1ZGVzKGtleXdvcmQpKSkge1xuICAgICAgICBjb2x1bW5NYXBwaW5nLmRlc2NyaXB0aW9uID0gaTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g6LSf6LSj5Lq65YiX5qOA5p+lXG4gICAgICBpZiAoVGFibGVDb250ZW50QW5hbHl6ZXJJbXBsLk9XTkVSX0NPTFVNTlMuc29tZShrZXl3b3JkID0+IGhlYWRlci5pbmNsdWRlcyhrZXl3b3JkKSkpIHtcbiAgICAgICAgY29sdW1uTWFwcGluZy5vd25lciA9IGk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOi1m+mBk+WIl+ajgOafpVxuICAgICAgaWYgKFRhYmxlQ29udGVudEFuYWx5emVySW1wbC5UUkFDS19DT0xVTU5TLnNvbWUoa2V5d29yZCA9PiBoZWFkZXIuaW5jbHVkZXMoa2V5d29yZCkpKSB7XG4gICAgICAgIGNvbHVtbk1hcHBpbmcudHJhY2sgPSBpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDlpIfms6jliJfmo4Dmn6VcbiAgICAgIGlmIChUYWJsZUNvbnRlbnRBbmFseXplckltcGwuQ09NTUVOVFNfQ09MVU1OUy5zb21lKGtleXdvcmQgPT4gaGVhZGVyLmluY2x1ZGVzKGtleXdvcmQpKSkge1xuICAgICAgICBjb2x1bW5NYXBwaW5nLmNvbW1lbnRzID0gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5aaC5p6c5om+5LiN5Yiw5pi+5byP55qE5o+P6L+w5YiX77yM5bCd6K+V5L2/55So56ys5LiA5YiX5L2c5Li65o+P6L+w5YiXXG4gICAgaWYgKGNvbHVtbk1hcHBpbmcuZGVzY3JpcHRpb24gPT09IC0xICYmIGhlYWRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29sdW1uTWFwcGluZy5kZXNjcmlwdGlvbiA9IDA7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjb2x1bW5NYXBwaW5nO1xuICB9XG4gIFxuICAvKipcbiAgICog5LuO6KGo5qC86KGM5o+Q5Y+W6aG555uu5pWw5o2uXG4gICAqIEBwYXJhbSB0YWJsZUlkIOihqOagvElEXG4gICAqIEBwYXJhbSBjZWxscyDooYzljZXlhYPmoLxcbiAgICogQHBhcmFtIGNvbHVtbk1hcHBpbmcg5YiX57Si5byV5pig5bCEXG4gICAqIEBwYXJhbSByb3dJbmRleCDooYzntKLlvJVcbiAgICogQHJldHVybnMg6aG555uu5pWw5o2uXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RQcm9qZWN0RnJvbVJvdyhcbiAgICB0YWJsZUlkOiBzdHJpbmcsXG4gICAgY2VsbHM6IEdvb2dsZVRhYmxlQ2VsbFtdLFxuICAgIGNvbHVtbk1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sXG4gICAgcm93SW5kZXg6IG51bWJlclxuICApOiBQcm9qZWN0RGF0YSB8IG51bGwge1xuICAgIC8vIOaPkOWPluaPj+i/sOWNleWFg+agvOWGheWuuVxuICAgIGlmIChjb2x1bW5NYXBwaW5nLmRlc2NyaXB0aW9uID09PSAtMSkge1xuICAgICAgcmV0dXJuIG51bGw7IC8vIOe8uuWwkeaPj+i/sOWIl++8jOaXoOazleivhuWIq+mhueebrlxuICAgIH1cbiAgICBcbiAgICBjb25zdCBkZXNjcmlwdGlvbkNlbGwgPSBjZWxsc1tjb2x1bW5NYXBwaW5nLmRlc2NyaXB0aW9uXTtcbiAgICBpZiAoIWRlc2NyaXB0aW9uQ2VsbC50ZXh0IHx8ICFkZXNjcmlwdGlvbkNlbGwudGV4dC50ZXh0RWxlbWVudHMpIHtcbiAgICAgIHJldHVybiBudWxsOyAvLyDmj4/ov7DljZXlhYPmoLzkuLrnqbpcbiAgICB9XG4gICAgXG4gICAgY29uc3QgZGVzY3JpcHRpb25UZXh0ID0gZGVzY3JpcHRpb25DZWxsLnRleHQudGV4dEVsZW1lbnRzXG4gICAgICAubWFwKCh0ZXh0RWxlbWVudDogR29vZ2xlVGV4dEVsZW1lbnQpID0+IHRleHRFbGVtZW50LnRleHRSdW4/LmNvbnRlbnQgfHwgJycpXG4gICAgICAuam9pbignJyk7XG4gICAgXG4gICAgLy8g5aaC5p6c5o+P6L+w5Li656m677yM6Lez6L+H5q2k6KGMXG4gICAgaWYgKCFkZXNjcmlwdGlvblRleHQudHJpbSgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5o+Q5Y+WSmlyYeW3peWNlUlEXG4gICAgY29uc3QgamlyYVRpY2tldE1hdGNoID0gZGVzY3JpcHRpb25UZXh0Lm1hdGNoKC8oW0EtWl0rLVxcZCspLyk7XG4gICAgY29uc3QgamlyYVRpY2tldElkID0gamlyYVRpY2tldE1hdGNoID8gamlyYVRpY2tldE1hdGNoWzBdIDogJyc7XG4gICAgXG4gICAgLy8g5o+Q5Y+W6aG555uu5ZCN56ewXG4gICAgbGV0IHByb2plY3ROYW1lID0gZGVzY3JpcHRpb25UZXh0O1xuICAgIGlmIChqaXJhVGlja2V0SWQpIHtcbiAgICAgIHByb2plY3ROYW1lID0gcHJvamVjdE5hbWUucmVwbGFjZShqaXJhVGlja2V0SWQsICcnKS50cmltKCk7XG4gICAgICAvLyDlpoLmnpzmnInlhpLlj7fvvIzlj5blhpLlj7flkI7nmoTpg6jliIZcbiAgICAgIGlmIChwcm9qZWN0TmFtZS5pbmNsdWRlcygnOicpKSB7XG4gICAgICAgIHByb2plY3ROYW1lID0gcHJvamVjdE5hbWUuc3BsaXQoJzonKVsxXS50cmltKCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOiOt+WPlueKtuaAgeS/oeaBr1xuICAgIGxldCBzdGF0dXNUZXh0ID0gJyc7XG4gICAgaWYgKGNvbHVtbk1hcHBpbmcuc3RhdHVzICE9PSAtMSkge1xuICAgICAgY29uc3Qgc3RhdHVzQ2VsbCA9IGNlbGxzW2NvbHVtbk1hcHBpbmcuc3RhdHVzXTtcbiAgICAgIHN0YXR1c1RleHQgPSBzdGF0dXNDZWxsLnRleHQgJiYgc3RhdHVzQ2VsbC50ZXh0LnRleHRFbGVtZW50cyBcbiAgICAgICAgPyBzdGF0dXNDZWxsLnRleHQudGV4dEVsZW1lbnRzXG4gICAgICAgICAgICAubWFwKCh0ZXh0RWxlbWVudDogR29vZ2xlVGV4dEVsZW1lbnQpID0+IHRleHRFbGVtZW50LnRleHRSdW4/LmNvbnRlbnQgfHwgJycpXG4gICAgICAgICAgICAuam9pbignJylcbiAgICAgICAgICAgIC50cmltKClcbiAgICAgICAgOiAnJztcbiAgICB9XG4gICAgXG4gICAgLy8g6I635Y+W6LSf6LSj5Lq65L+h5oGvXG4gICAgbGV0IG93bmVyVGV4dCA9ICcnO1xuICAgIGlmIChjb2x1bW5NYXBwaW5nLm93bmVyICE9PSAtMSkge1xuICAgICAgY29uc3Qgb3duZXJDZWxsID0gY2VsbHNbY29sdW1uTWFwcGluZy5vd25lcl07XG4gICAgICBvd25lclRleHQgPSBvd25lckNlbGwudGV4dCAmJiBvd25lckNlbGwudGV4dC50ZXh0RWxlbWVudHMgXG4gICAgICAgID8gb3duZXJDZWxsLnRleHQudGV4dEVsZW1lbnRzXG4gICAgICAgICAgICAubWFwKCh0ZXh0RWxlbWVudDogR29vZ2xlVGV4dEVsZW1lbnQpID0+IHRleHRFbGVtZW50LnRleHRSdW4/LmNvbnRlbnQgfHwgJycpXG4gICAgICAgICAgICAuam9pbignJylcbiAgICAgICAgICAgIC50cmltKClcbiAgICAgICAgOiAnJztcbiAgICB9XG4gICAgXG4gICAgLy8g5Yib5bu66aG555uu5pWw5o2u5a+56LGhXG4gICAgY29uc3QgcHJvamVjdDogUHJvamVjdERhdGEgPSB7XG4gICAgICBpZDogamlyYVRpY2tldElkIHx8IGBwcm9qZWN0LSR7dGFibGVJZH0tJHtyb3dJbmRleH1gLFxuICAgICAgbmFtZTogcHJvamVjdE5hbWUsXG4gICAgICBzdGF0dXM6IHN0YXR1c1RleHQsXG4gICAgICBvd25lcjogb3duZXJUZXh0LFxuICAgICAgdGFibGVJZDogdGFibGVJZCxcbiAgICAgIHJvdzogcm93SW5kZXgsXG4gICAgICBjb2x1bW5JbmRpY2VzOiBjb2x1bW5NYXBwaW5nXG4gICAgfTtcbiAgICBcbiAgICAvLyDmt7vliqDlj6/pgInlrZfmrrVcbiAgICBpZiAoY29sdW1uTWFwcGluZy50cmFjayAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IHRyYWNrQ2VsbCA9IGNlbGxzW2NvbHVtbk1hcHBpbmcudHJhY2tdO1xuICAgICAgcHJvamVjdC50cmFjayA9IHRyYWNrQ2VsbC50ZXh0ICYmIHRyYWNrQ2VsbC50ZXh0LnRleHRFbGVtZW50cyBcbiAgICAgICAgPyB0cmFja0NlbGwudGV4dC50ZXh0RWxlbWVudHNcbiAgICAgICAgICAgIC5tYXAoKHRleHRFbGVtZW50OiBHb29nbGVUZXh0RWxlbWVudCkgPT4gdGV4dEVsZW1lbnQudGV4dFJ1bj8uY29udGVudCB8fCAnJylcbiAgICAgICAgICAgIC5qb2luKCcnKVxuICAgICAgICAgICAgLnRyaW0oKVxuICAgICAgICA6ICcnO1xuICAgIH1cbiAgICBcbiAgICBpZiAoY29sdW1uTWFwcGluZy5jb21tZW50cyAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGNvbW1lbnRzQ2VsbCA9IGNlbGxzW2NvbHVtbk1hcHBpbmcuY29tbWVudHNdO1xuICAgICAgcHJvamVjdC5jb21tZW50cyA9IGNvbW1lbnRzQ2VsbC50ZXh0ICYmIGNvbW1lbnRzQ2VsbC50ZXh0LnRleHRFbGVtZW50cyBcbiAgICAgICAgPyBjb21tZW50c0NlbGwudGV4dC50ZXh0RWxlbWVudHNcbiAgICAgICAgICAgIC5tYXAoKHRleHRFbGVtZW50OiBHb29nbGVUZXh0RWxlbWVudCkgPT4gdGV4dEVsZW1lbnQudGV4dFJ1bj8uY29udGVudCB8fCAnJylcbiAgICAgICAgICAgIC5qb2luKCcnKVxuICAgICAgICAgICAgLnRyaW0oKVxuICAgICAgICA6ICcnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcHJvamVjdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiuoeeul+ihqOagvOeahOmhueebruaVsOaNrue9ruS/oeW6plxuICAgKiBAcGFyYW0gaGVhZGVycyDooajlpLRcbiAgICogQHBhcmFtIGNvbHVtbk1hcHBpbmcg5YiX5pig5bCEXG4gICAqIEBwYXJhbSBwcm9qZWN0cyDmj5Dlj5bnmoTpobnnm67mlbDmja5cbiAgICogQHJldHVybnMg572u5L+h5bqm5YiG5pWwKDAtMSlcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlVGFibGVDb25maWRlbmNlKFxuICAgIGhlYWRlcnM6IHN0cmluZ1tdLFxuICAgIGNvbHVtbk1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sXG4gICAgcHJvamVjdHM6IFByb2plY3REYXRhW11cbiAgKTogbnVtYmVyIHtcbiAgICBsZXQgc2NvcmUgPSAwO1xuICAgIFxuICAgIC8vIDEuIOajgOafpeaYr+WQpuivhuWIq+WIsOWFs+mUruWIl1xuICAgIGlmIChjb2x1bW5NYXBwaW5nLnN0YXR1cyAhPT0gLTEpIHNjb3JlICs9IDAuMjtcbiAgICBpZiAoY29sdW1uTWFwcGluZy5kZXNjcmlwdGlvbiAhPT0gLTEpIHNjb3JlICs9IDAuMjtcbiAgICBpZiAoY29sdW1uTWFwcGluZy5vd25lciAhPT0gLTEpIHNjb3JlICs9IDAuMTtcbiAgICBpZiAoY29sdW1uTWFwcGluZy50cmFjayAhPT0gLTEpIHNjb3JlICs9IDAuMDU7XG4gICAgaWYgKGNvbHVtbk1hcHBpbmcuY29tbWVudHMgIT09IC0xKSBzY29yZSArPSAwLjA1O1xuICAgIFxuICAgIC8vIDIuIOajgOafpemhueebruaVsOaNruacieaViOaAp1xuICAgIGlmIChwcm9qZWN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAwOyAvLyDmsqHmnInmj5Dlj5bliLDpobnnm65cbiAgICB9XG4gICAgXG4gICAgLy8g6K6h566X5YyF5ZCrSmlyYeW3peWNlUlE55qE6aG555uu5q+U5L6LXG4gICAgY29uc3QgamlyYVByb2plY3RzID0gcHJvamVjdHMuZmlsdGVyKHAgPT4gL1tBLVpdKy1cXGQrLy50ZXN0KHAuaWQpKTtcbiAgICBjb25zdCBqaXJhUmF0aW8gPSBqaXJhUHJvamVjdHMubGVuZ3RoIC8gcHJvamVjdHMubGVuZ3RoO1xuICAgIHNjb3JlICs9IGppcmFSYXRpbyAqIDAuMjtcbiAgICBcbiAgICAvLyAzLiDmo4Dmn6XooajmoLznu5PmnoRcbiAgICBpZiAoaGVhZGVycy5sZW5ndGggPj0gMykgc2NvcmUgKz0gMC4xOyAvLyDooajmoLzliJfmlbDpgILkuK1cbiAgICBpZiAocHJvamVjdHMubGVuZ3RoID49IDIpIHNjb3JlICs9IDAuMTsgLy8g5pyJ5aSa6KGM6aG555uu5pWw5o2uXG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKDEsIHNjb3JlKTtcbiAgfVxufSAiXSwibmFtZXMiOlsiU2xpZGVDb250ZW50VHlwZSIsIlByb2plY3RTdHJ1Y3R1cmVUeXBlIiwiQmFzZVNsaWRlQW5hbHl6ZXIiLCJhbmFseXplIiwic2xpZGUiLCJtZXRhZGF0YSIsImFuYWx5emVTbGlkZU1ldGFkYXRhIiwiY29udGVudFR5cGUiLCJkZXRlcm1pbmVDb250ZW50VHlwZSIsInJlc3VsdCIsInByb2plY3RTdHJ1Y3R1cmUiLCJVTktOT1dOIiwicHJvamVjdEZpZWxkcyIsInByb2plY3RzIiwiY29uZmlkZW5jZSIsImFuYWx5emVQcm9qZWN0U3RydWN0dXJlIiwiYW5hbHlzaXNSZXN1bHQiLCJhbmFseXplQ29udGVudCIsIk9iamVjdCIsImFzc2lnbiIsImVycm9yIiwiY29uc29sZSIsIndhcm5pbmdzIiwiRXJyb3IiLCJtZXNzYWdlIiwiU3RyaW5nIiwicGFnZUVsZW1lbnRzIiwidGFibGVDb3VudCIsInRleHRDb3VudCIsInNoYXBlQ291bnQiLCJsaXN0Q291bnQiLCJlbGVtZW50IiwidGFibGUiLCJzaGFwZSIsInRleHQiLCJjb250YWluc0xpc3QiLCJ0ZXh0RWxlbWVudHMiLCJzbGlkZUlkIiwib2JqZWN0SWQiLCJlbGVtZW50Q291bnQiLCJsZW5ndGgiLCJoYXNUYWJsZSIsImhhc1RleHQiLCJoYXNTaGFwZXMiLCJoYXNMaXN0cyIsImlzVGFibGVEb21pbmFudCIsIk1JWEVEIiwiVEFCTEUiLCJMSVNUIiwiVEVYVCIsIlNIQVBFIiwidGV4dENvbnRlbnQiLCJleHRyYWN0QWxsVGV4dENvbnRlbnQiLCJsb3dlclRleHQiLCJ0b0xvd2VyQ2FzZSIsImluY2x1ZGVzIiwiU1BSSU5UIiwiRVBJQyIsIlJFTEVBU0UiLCJjb250YWluc011bHRpcGxlSmlyYVRpY2tldHMiLCJjb250YWluc1NpbmdsZUppcmFUaWNrZXQiLCJTSU5HTEVfVElDS0VUIiwiQ1VTVE9NIiwidGFibGVSb3dzIiwicm93IiwidGFibGVDZWxscyIsImNlbGwiLCJjZWxsVGV4dCIsIm1hcCIsImUiLCJ0ZXh0UnVuIiwiY29udGVudCIsImpvaW4iLCJ0cmltIiwicHVzaCIsInNoYXBlVGV4dCIsImppcmFUaWNrZXRQYXR0ZXJuIiwibWF0Y2hlcyIsIm1hdGNoIiwic29tZSIsInBhcmFncmFwaE1hcmtlciIsInN0eWxlIiwiYnVsbGV0UHJlc2V0IiwidW5kZWZpbmVkIiwidG90YWxFbGVtZW50cyIsInRhYmxlRWxlbWVudHMiLCJmaWx0ZXIiLCJleHRyYWN0SmlyYVRpY2tldHMiLCJUYWJsZUNvbnRlbnRBbmFseXplckltcGwiLCJjYW5IYW5kbGUiLCJhbGxUYWJsZVJlc3VsdHMiLCJ0YWJsZUVsZW1lbnQiLCJhbmFseXplVGFibGUiLCJjYWxjdWxhdGVUYWJsZUNvbmZpZGVuY2UiLCJoZWFkZXJzIiwiY29sdW1uTWFwcGluZyIsInByb2plY3RSb3dzIiwia2V5cyIsImZpZWxkIiwic29ydCIsImEiLCJiIiwiYmVzdFJlc3VsdCIsInRhYmxlRGF0YSIsInRhYmxlSWQiLCJoZWFkZXJSb3ciLCJ0ZXh0RWxlbWVudCIsIm1hcENvbHVtbkluZGljZXMiLCJpIiwiY2VsbHMiLCJyZXF1aXJlZENvbHVtbnMiLCJkZXNjcmlwdGlvbiIsInN0YXR1cyIsImlkeCIsIm1heFJlcXVpcmVkQ29sdW1uIiwiTWF0aCIsIm1heCIsInByb2plY3QiLCJleHRyYWN0UHJvamVjdEZyb21Sb3ciLCJ3YXJuIiwib3duZXIiLCJ0cmFjayIsImNvbW1lbnRzIiwiaGVhZGVyIiwiU1RBVFVTX0NPTFVNTlMiLCJrZXl3b3JkIiwiREVTQ1JJUFRJT05fQ09MVU1OUyIsIk9XTkVSX0NPTFVNTlMiLCJUUkFDS19DT0xVTU5TIiwiQ09NTUVOVFNfQ09MVU1OUyIsInJvd0luZGV4IiwiZGVzY3JpcHRpb25DZWxsIiwiZGVzY3JpcHRpb25UZXh0IiwiamlyYVRpY2tldE1hdGNoIiwiamlyYVRpY2tldElkIiwicHJvamVjdE5hbWUiLCJyZXBsYWNlIiwic3BsaXQiLCJzdGF0dXNUZXh0Iiwic3RhdHVzQ2VsbCIsIm93bmVyVGV4dCIsIm93bmVyQ2VsbCIsImlkIiwibmFtZSIsImNvbHVtbkluZGljZXMiLCJ0cmFja0NlbGwiLCJjb21tZW50c0NlbGwiLCJzY29yZSIsImppcmFQcm9qZWN0cyIsInAiLCJ0ZXN0IiwiamlyYVJhdGlvIiwibWluIl0sInNvdXJjZVJvb3QiOiIifQ==