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
//# sourceMappingURL=tableAnalyzer.js.map