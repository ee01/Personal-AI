/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/analyzers/baseAnalyzer.ts":
/*!***************************************!*\
  !*** ./src/analyzers/baseAnalyzer.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./src/analyzers/llmAnalyzer.ts":
/*!**************************************!*\
  !*** ./src/analyzers/llmAnalyzer.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LLMContentAnalyzer: () => (/* binding */ LLMContentAnalyzer)
/* harmony export */ });
/* harmony import */ var _baseAnalyzer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./baseAnalyzer */ "./src/analyzers/baseAnalyzer.ts");
/* harmony import */ var _llm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../llm */ "./src/llm.ts");
/**
 * LLM辅助分析器实现
 */


 // 导入callLLMJsonAPI函数

/**
 * LLM辅助分析器类
 * 使用LLM分析难以结构化解析的幻灯片内容
 */
class LLMContentAnalyzer extends _baseAnalyzer__WEBPACK_IMPORTED_MODULE_0__.BaseSlideAnalyzer {
  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  canHandle(slide) {
    // 这是后备分析器，可以处理任何幻灯片，但优先级较低
    return true;
  }

  /**
   * 分析具体内容
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 部分分析结果
   */
  async analyzeContent(slide, contentType) {
    try {
      // 生成分析提示
      const {
        prompt,
        elementMap
      } = this.generateAnalysisPrompt(slide);

      // 调用LLM API进行分析
      const llmResponse = await this.callLLMAPI(prompt);

      // 解析LLM响应
      const projects = this.parseLLMResponse(llmResponse, elementMap, slide.objectId);

      // 计算置信度和项目字段
      const confidence = this.calculateLLMConfidence(projects, llmResponse);
      const projectFields = this.determineCommonFields(projects);
      return {
        projects,
        projectFields,
        confidence,
        warnings: confidence < LLMContentAnalyzer.MIN_CONFIDENCE_THRESHOLD ? ['LLM分析置信度较低，可能需要手动检查项目数据'] : undefined
      };
    } catch (error) {
      console.error('LLM分析错误:', error);
      return {
        projects: [],
        confidence: 0,
        warnings: [`LLM分析错误: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * 生成分析提示
   * @param slide 幻灯片对象
   * @returns 分析提示和元素映射
   */
  generateAnalysisPrompt(slide) {
    const elementMap = new Map();
    let slideContent = '';

    // 提取幻灯片内容，同时生成元素ID映射
    if (slide.pageElements) {
      slideContent = this.extractSlideContent(slide, elementMap);
    }

    // 构建LLM提示
    const prompt = `
分析以下Google Slides幻灯片内容，提取其中的项目信息：

=== 幻灯片内容 ===
${slideContent}
=== 幻灯片内容结束 ===

从以上内容中提取所有项目信息，包括：
1. 项目ID/Jira工单号（如有，通常是形如"ABC-123"的格式）
2. 项目名称
3. 项目状态（如：进行中、完成、阻塞等）
4. 项目负责人/Owner
5. 项目赛道/团队（如有）
6. 项目备注/行动项（如有）

对于每个识别的项目，请同时提供其对应的元素ID，方便后续定位和更新。
如果从内容中无法确定某些字段，请将其留空。

返回JSON格式如下：
{
  "projects": [
    {
      "id": "项目ID或Jira工单号",
      "name": "项目名称",
      "status": "项目状态",
      "owner": "负责人",
      "track": "赛道/团队",
      "comments": "备注/行动项",
      "elementId": "对应的元素ID"
    }
  ],
  "confidence": 0.8, // 分析结果的置信度(0-1)
  "analysis": "分析过程和考虑因素的简要说明"
}
`;
    return {
      prompt,
      elementMap
    };
  }

  /**
   * 提取幻灯片内容并创建元素ID映射
   * @param slide 幻灯片对象
   * @param elementMap 元素ID映射表
   * @returns 幻灯片内容文本
   */
  extractSlideContent(slide, elementMap) {
    const contentParts = [];
    let elementIndex = 0;
    if (!slide.pageElements) {
      return '';
    }

    // 处理所有页面元素
    for (const element of slide.pageElements) {
      const elementId = element.objectId;
      const mappedId = `element_${elementIndex++}`;
      elementMap.set(mappedId, elementId);

      // 根据元素类型提取内容
      if (element.shape && element.shape.text) {
        // 处理形状中的文本
        const textContent = this.extractTextFromTextElements(element.shape.text.textElements || []);
        if (textContent) {
          contentParts.push(`[文本元素 ID:${mappedId}]\n${textContent}\n`);
        }
      } else if (element.table) {
        // 处理表格
        const tableContent = this.extractTableContent(element.table);
        if (tableContent) {
          contentParts.push(`[表格元素 ID:${mappedId}]\n${tableContent}\n`);
        }
      }
      // 可以添加更多元素类型的提取逻辑
    }
    return contentParts.join('\n');
  }

  /**
   * 从文本元素数组中提取文本
   * @param textElements 文本元素数组
   * @returns 提取的文本
   */
  extractTextFromTextElements(textElements) {
    return textElements.map(element => element.textRun?.content || '').join('').trim();
  }

  /**
   * 提取表格内容
   * @param table 表格对象
   * @returns 表格内容文本表示
   */
  extractTableContent(table) {
    if (!table.tableRows) {
      return '';
    }
    const rows = [];

    // 遍历表格行
    for (const row of table.tableRows) {
      if (!row.tableCells) continue;
      const cells = [];

      // 遍历单元格
      for (const cell of row.tableCells) {
        const cellText = cell.text && cell.text.textElements ? this.extractTextFromTextElements(cell.text.textElements) : '';
        cells.push(cellText);
      }

      // 添加行，用|分隔单元格
      rows.push(cells.join(' | '));
    }
    return rows.join('\n');
  }

  /**
   * 调用LLM API进行分析
   * 注意：这里需要实现具体的API调用逻辑，可以使用Chrome extension的消息传递机制
   * @param prompt 提示内容
   * @returns LLM响应
   */
  async callLLMAPI(prompt) {
    try {
      // 使用callLLMJsonAPI函数调用实际的LLM API
      console.log('调用LLM API进行分析', prompt.substring(0, 100) + '...');

      // 准备请求体
      const requestBody = {
        prompt: prompt,
        type: 'analyze' // 根据实际需要调整类型
      };

      // 调用API并获取响应
      const response = await (0,_llm__WEBPACK_IMPORTED_MODULE_1__.callLLMJsonAPI)(requestBody);

      // 如果没有有效响应，提供默认结构
      if (!response || typeof response !== 'object') {
        return {
          projects: [],
          confidence: 0,
          analysis: "LLM分析未返回有效数据"
        };
      }
      return response;
    } catch (error) {
      console.error('LLM API调用错误:', error);
      // 出错时返回默认结构
      return {
        projects: [],
        confidence: 0,
        analysis: `LLM API调用错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 解析LLM响应
   * @param response LLM响应对象
   * @param elementMap 元素ID映射表
   * @param slideId 幻灯片ID
   * @returns 项目数据数组
   */
  parseLLMResponse(response, elementMap, slideId) {
    if (!response || !response.projects || !Array.isArray(response.projects)) {
      return [];
    }

    // 转换LLM返回的项目数据
    return response.projects.map(project => {
      // 获取实际元素ID
      const mappedElementId = project.elementId && elementMap.has(project.elementId) ? elementMap.get(project.elementId) : undefined;

      // 创建项目数据对象
      const projectData = {
        id: project.id || `llm-project-${slideId}-${Math.random().toString(36).substr(2, 9)}`,
        name: project.name || '',
        status: project.status || '',
        owner: project.owner || '',
        slideId: slideId,
        slideElementId: mappedElementId
      };

      // 添加可选字段
      if (project.track) {
        projectData.track = project.track;
      }
      if (project.comments) {
        projectData.comments = project.comments;
      }
      return projectData;
    });
  }

  /**
   * 计算LLM分析结果的置信度
   * @param projects 项目数据数组
   * @param llmResponse LLM响应
   * @returns 置信度(0-1)
   */
  calculateLLMConfidence(projects, llmResponse) {
    // 如果LLM提供了置信度，直接使用
    if (llmResponse.confidence !== undefined && typeof llmResponse.confidence === 'number' && llmResponse.confidence >= 0 && llmResponse.confidence <= 1) {
      return llmResponse.confidence;
    }

    // 否则计算基于项目数据的置信度
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
}
// 最小需要的置信度阈值
LLMContentAnalyzer.MIN_CONFIDENCE_THRESHOLD = 0.4;

/***/ }),

/***/ "./src/analyzers/tableAnalyzer.ts":
/*!****************************************!*\
  !*** ./src/analyzers/tableAnalyzer.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ }),

/***/ "./src/analyzers/textAnalyzer.ts":
/*!***************************************!*\
  !*** ./src/analyzers/textAnalyzer.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ }),

/***/ "./src/embeddings.ts":
/*!***************************!*\
  !*** ./src/embeddings.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createOffscreenDocument: () => (/* binding */ createOffscreenDocument),
/* harmony export */   getEmbeddingViaOffscreen: () => (/* binding */ getEmbeddingViaOffscreen),
/* harmony export */   handleEmbeddingResult: () => (/* binding */ handleEmbeddingResult)
/* harmony export */ });
// 创建新文件处理嵌入相关功能
const pendingEmbeddingRequests = new Map();

// 创建离屏文档
async function createOffscreenDocument() {
  try {
    // 检查是否已经存在离屏文档
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) {
      console.log('离屏文档已存在');
      return;
    }
    console.log('创建离屏文档...');
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: '需要使用 WebAssembly 来运行嵌入模型'
    });
    console.log('离屏文档创建成功');
  } catch (error) {
    console.error('创建离屏文档失败:', error);
  }
}

// 通过离屏文档获取嵌入向量
async function getEmbeddingViaOffscreen(text) {
  try {
    await createOffscreenDocument();

    // 生成唯一请求ID
    const requestId = Date.now().toString() + Math.random().toString().slice(2);

    // 创建Promise并存储
    const resultPromise = new Promise((resolve, reject) => {
      pendingEmbeddingRequests.set(requestId, {
        resolve,
        reject
      });

      // 设置超时
      setTimeout(() => {
        if (pendingEmbeddingRequests.has(requestId)) {
          pendingEmbeddingRequests.delete(requestId);
          reject(new Error('获取嵌入向量超时'));
        }
      }, 30000); // 30秒超时
    });

    // 发送消息到离屏文档
    chrome.runtime.sendMessage({
      type: 'GET_EMBEDDING',
      requestId,
      text
    });
    return resultPromise;
  } catch (error) {
    console.error('通过离屏文档获取嵌入向量失败:', error);
    return new Array(384).fill(0);
  }
}

// 处理嵌入结果
function handleEmbeddingResult(message) {
  if (message.type === 'EMBEDDING_RESULT') {
    const requestId = message.requestId;
    const pendingRequest = pendingEmbeddingRequests.get(requestId);
    if (pendingRequest) {
      pendingEmbeddingRequests.delete(requestId);
      pendingRequest.resolve(message.embedding);
    }
  }
}

/***/ }),

/***/ "./src/entityExtraction.ts":
/*!*********************************!*\
  !*** ./src/entityExtraction.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   extractEntitiesForQuery: () => (/* binding */ extractEntitiesForQuery),
/* harmony export */   extractEntitiesToStore: () => (/* binding */ extractEntitiesToStore)
/* harmony export */ });
/* harmony import */ var _llm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./llm */ "./src/llm.ts");
// 新文件：实体识别和提取


// 使用LLM提取消息中的实体
async function extractEntitiesToStore(content) {
  let metadata = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  try {
    const prompt = `
    请分析以下消息，提取所有相关的实体信息和关系：
    
    消息内容：
    ${content}
    ${metadata.sender ? `消息发送者：${metadata.sender}` : ''}
    ${metadata.team_name ? `消息所在群组：${metadata.team_name}` : ''}
    ${metadata.summary ? `根据上下文得到的总结：${metadata.summary}` : ''}

    请严格按照以下 JSON 格式提取实体信息：
    {
      "entities": {
        "people": [
          {
            "name": "",
            "role": "",  // 角色，如"员工"、"客户"等
            "mentioned_context": ""  // 在消息中提及的上下文
          }
        ],
        "time": [
          {
            "raw": "",  // 原始时间表述
            "normalized": "",  // 标准化时间
            "type": ""  // deadline/schedule/mentioned
          }
        ],
        "location": [
          {
            "name": "",
            "type": ""  // office/remote/physical
          }
        ],
        "projects": [
          {
            "name": "",
            "status": "",  // 进行中/已完成/计划中
            "related_people": []  // 相关人员
          }
        ],
        "topics": [
          {
            "name": "",
            "category": "",  // 技术/业务/管理等
            "keywords": []
          }
        ],
        "resources": [
          {
            "type": "",  // 文档/链接/工具等
            "name": "",
            "location": ""
          }
        ]
      },
      "metadata": {
        "sentiment": "",  // positive/negative/neutral
        "priority": "",   // high/medium/low
        "category": [],   // 消息类别：决策/讨论/公告等
        "tags": []       // 自动标签
      },
      "relationships": [
        {
          "source": "",      // 实体1
          "target": "",      // 实体2
          "relationship": "" // 关系类型
        }
      ],
      "actions": [
        {
          "type": "",        // task/decision/followup
          "description": "", 
          "assignee": "",
          "deadline": null,  // 时间戳
          "status": ""      // pending/completed
        }
      ]
    }
    
    仅返回JSON，不要有其他内容。如果某类实体不存在，返回空数组。
    `;
    const entityData = await (0,_llm__WEBPACK_IMPORTED_MODULE_0__.callLLMJsonAPI)({
      prompt,
      type: 'query'
    });
    console.log('提取出的实体信息：', entityData);
    if (typeof entityData === 'object') {
      return {
        entities: {
          people: entityData.entities?.people || [],
          time: entityData.entities?.time || [],
          location: entityData.entities?.location || [],
          projects: entityData.entities?.projects || [],
          topics: entityData.entities?.topics || [],
          resources: entityData.entities?.resources || []
        },
        metadata: {
          sentiment: entityData.metadata?.sentiment || "neutral",
          priority: entityData.metadata?.priority || "medium",
          category: entityData.metadata?.category || [],
          tags: entityData.metadata?.tags || []
        },
        relationships: entityData.relationships || [],
        actions: entityData.actions || []
      };
    }
    return {
      entities: {
        people: [],
        time: [],
        location: [],
        projects: [],
        topics: [],
        resources: []
      },
      metadata: {
        sentiment: "neutral",
        priority: "medium",
        category: [],
        tags: []
      },
      relationships: [],
      actions: []
    };
  } catch (error) {
    console.error('实体提取失败:', error);
    return {
      entities: {
        people: [],
        time: [],
        location: [],
        projects: [],
        topics: [],
        resources: []
      },
      metadata: {
        sentiment: "neutral",
        priority: "medium",
        category: [],
        tags: []
      },
      relationships: [],
      actions: []
    };
  }
}
async function extractEntitiesForQuery(question) {
  try {
    const analysisPrompt = `
    分析以下问题，提取查询意图和关键实体。按JSON格式返回：
    
    问题: "${question}"
    
    {
      "query": {
        "intent": {
          "primary": "",     // search/analyze/summarize/compare
          "secondary": "",   // 具体查询类型，如project_status/person_info等
          "action_type": "" // retrieve/count/timeline/relationship
        },
        "filters": {
          "time_range": {
            "type": "recent|all|specific|range",
            "start": null,   // 时间戳
            "end": null,     // 时间戳
            "description": "" // 对时间范围的文字描述，如"今年"、"这个月"、"最近一周"等
          },
          "entities": {
            "people": [
              {
                "name": "",
                "role": "",
                "required": true  // 是否必须包含该人物
              }
            ],
            "projects": [
              {
                "name": "",
                "status": "",
                "required": true
              }
            ],
            "topics": [
              {
                "name": "",
                "category": "",
                "required": true
              }
            ],
            "location": [
              {
                "name": "",
                "type": "",
                "required": true
              }
            ]
          }
        },
        "output": {
          "format": "",     // list/timeline/summary/graph
          "fields": [],     // 需要返回的字段
          "sort": {
            "field": "",
            "order": "asc|desc"
          },
          "limit": null    // 结果数量限制
        }
      },
      "context": {
        "reference_time": null,  // 参考时间点
        "user_context": "",     // 用户查询上下文
        "priority": ""         // high/medium/low
      }
    }
    
    注意：
    1. time_range.type 必须是以下值之一：
       - "all"：表示所有时间，不指定则默认是 all
       - "recent"：仅表示最近几天，如"最近"、"近期"、"最近几天"
       - "specific"：表示具体时间点
       - "range"：表示时间范围
    2. 对于包含较长时间段的描述：
       - "这个月"、"本月"应设为range类型，而非recent
       - "今年"、"本年"应设为range类型，而非recent
       - "去年"、"上个月"等也应设为range类型
    3. 请在description字段中保留原始时间描述词，如"今年"、"这个月"等
    4. 所有时间戳必须是数字或null，不能是字符串
    5. 如果无法确定具体时间，相关时间字段设为null
    6. 时间疑问词表示查询事件发生时间，不是限制查询范围
    7. required 字段表示该实体是否为必需匹配项
    8. 重要：如果问题中没有明确的时间限定词（如"最近"、"今年"、"这个月"等），请将time_range.type设为"all"
    `;

    // 使用LLM分析问题
    const queryIntent = await (0,_llm__WEBPACK_IMPORTED_MODULE_0__.callLLMJsonAPI)({
      prompt: analysisPrompt,
      type: 'query'
    });
    return queryIntent;
  } catch (error) {
    console.error('查询意图分析失败:', error);
    return {
      query: {
        intent: {
          primary: "search",
          secondary: "general",
          action_type: "retrieve"
        },
        filters: {
          time_range: {
            type: "all",
            start: null,
            end: null,
            description: ""
          },
          entities: {
            people: [],
            projects: [],
            topics: [],
            location: []
          }
        },
        output: {
          format: "list",
          fields: [],
          sort: {
            field: "",
            order: "desc"
          },
          limit: 10
        }
      },
      context: {
        reference_time: null,
        user_context: "",
        priority: "medium"
      }
    };
  }
}

/***/ }),

/***/ "./src/interfaces/slideAnalyzer.ts":
/*!*****************************************!*\
  !*** ./src/interfaces/slideAnalyzer.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ }),

/***/ "./src/llm.ts":
/*!********************!*\
  !*** ./src/llm.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DifyChat: () => (/* binding */ DifyChat),
/* harmony export */   GroqChat: () => (/* binding */ GroqChat),
/* harmony export */   OllamaChat: () => (/* binding */ OllamaChat),
/* harmony export */   OpenAIChat: () => (/* binding */ OpenAIChat),
/* harmony export */   callLLMJsonAPI: () => (/* binding */ callLLMJsonAPI),
/* harmony export */   handleLLMRequest: () => (/* binding */ handleLLMRequest),
/* harmony export */   knowledgeQuery: () => (/* binding */ knowledgeQuery)
/* harmony export */ });
/* harmony import */ var openai__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! openai */ "./node_modules/openai/index.mjs");
/* harmony import */ var groq_sdk__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! groq-sdk */ "./node_modules/groq-sdk/index.mjs");
/* harmony import */ var _vectorStore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./vectorStore */ "./src/vectorStore.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/utils.ts");
/* harmony import */ var _entityExtraction__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./entityExtraction */ "./src/entityExtraction.ts");






// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
async function handleLLMRequest(body) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getEnvConfig)();
  let handler;
  switch (envConfig.LLM_TYPE) {
    case 'local':
      handler = handleOllamaRequest;
      if (body.type === 'review') body.model = envConfig.OLLAMA_REVIEW_MODEL;
      if (body.type === 'query') body.model = envConfig.OLLAMA_QUERY_MODEL;
      break;
    case 'groq':
      handler = handleGroqRequest;
      if (body.type === 'review') body.model = envConfig.GROQ_REVIEW_MODEL;
      break;
    case 'dify':
      handler = handleDifyRequest;
      if (body.type === 'review') body.apiKey = envConfig.DIFY_REVIEW_API_KEY;
      break;
    default:
      handler = handleOpenAIRequest;
      if (body.type === 'review') body.model = envConfig.OPENAI_REVIEW_MODEL;
  }
  const response = await handler(body);
  return response;
}

// 处理 Ollama 请求。Ollama 安装后需要把 launchctl setenv OLLAMA_ORIGINS "*" 加入到 .bashrc 中
async function handleOllamaRequest(body) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getEnvConfig)();
  const response = await fetch(`${envConfig.OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: body.model || envConfig.OLLAMA_MODEL,
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
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getEnvConfig)();
  // 初始化 OpenAI 客户端
  const openai = new openai__WEBPACK_IMPORTED_MODULE_3__["default"]({
    apiKey: envConfig.OPENAI_API_KEY,
    baseURL: envConfig.OPENAI_API_BASE_URL,
    dangerouslyAllowBrowser: true
  });
  const completion = await openai.chat.completions.create({
    model: envConfig.OPENAI_MODEL,
    messages: body.system_prompt ? [{
      role: "system",
      content: body.system_prompt
    }, {
      role: "user",
      content: body.user_prompt
    }] : [{
      role: "user",
      content: body.prompt
    }],
    temperature: 0.3,
    top_p: 0.9
  });
  return completion.choices[0].message.content || '';
}

// 处理 Groq 请求
async function handleGroqRequest(body) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getEnvConfig)();
  // 初始化 Groq 客户端
  const groq = new groq_sdk__WEBPACK_IMPORTED_MODULE_4__["default"]({
    apiKey: envConfig.GROQ_API_KEY,
    dangerouslyAllowBrowser: true
  });
  const completion = await groq.chat.completions.create({
    model: envConfig.GROQ_MODEL || 'mixtral-8x7b-32768',
    messages: body.system_prompt ? [{
      role: "system",
      content: body.system_prompt
    }, {
      role: "user",
      content: body.user_prompt
    }] : [{
      role: "user",
      content: body.prompt
    }],
    temperature: 0.3,
    top_p: 0.9
  });
  return completion.choices[0].message.content || '';
}

// 新增：处理 Dify 请求
async function handleDifyRequest(body) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getEnvConfig)();
  // 新增：初始化 Dify API 配置
  const difyConfig = {
    apiKey: envConfig.DIFY_API_KEY,
    reviewApiKey: envConfig.DIFY_REVIEW_API_KEY,
    baseURL: envConfig.DIFY_API_BASE_URL || 'https://api.dify.ai/v1'
  };
  const response = await fetch(`${difyConfig.baseURL}/completion-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${body.apiKey || difyConfig.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: {
        query: body.prompt
      },
      // 可选的输入参数
      response_mode: 'blocking',
      // 改为 streaming 模式
      user: body.user || 'default-user' // 可选
    })
  });
  if (!response.ok) {
    throw new Error(`Dify API error! status: ${response.status}`);
  }
  const result = await response.json();
  return result.answer || '';
}

// 新增：从响应文本中提取 JSON 数据
function extractJsonFromResponse(response) {
  let jsonData = [];
  try {
    // 首先尝试直接解析整个响应
    try {
      const directParse = JSON.parse(response.trim());
      return directParse;
    } catch (e) {
      // 如果直接解析失败，继续尝试其他方法
    }

    // 尝试从响应中查找 JSON 代码块
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[1].trim());
      jsonData = parsedData;
    } else {
      // 尝试查找可能的 JSON 字符串（方括号或大括号开头和结尾）
      const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/;
      const potentialJson = response.match(jsonRegex);
      if (potentialJson) {
        const parsedData = JSON.parse(potentialJson[1].trim());
        jsonData = parsedData;
      }
    }
  } catch (e) {
    console.warn('Failed to parse JSON from LLM response:', e);
  }
  return jsonData;
}

// 用通用查询函数替代原来的项目进展查询函数
async function knowledgeQuery(question) {
  console.log('knowledgeQuery', question, new Date().getTime());
  try {
    // 1. 从问题中识别查询意图和关键实体
    const queryIntent = await (0,_entityExtraction__WEBPACK_IMPORTED_MODULE_2__.extractEntitiesForQuery)(question);
    console.log('queryIntent', queryIntent, new Date().getTime());

    // 类型安全处理：确保时间范围有效
    if (queryIntent?.query?.filters?.time_range) {
      const timeRange = queryIntent.query.filters.time_range;

      // 处理时间疑问词
      if (timeRange.type === 'specific' && typeof timeRange.start === 'string') {
        console.warn(`非法的时间值: ${timeRange.start}，类型: ${typeof timeRange.start}`);

        // 检查是否是常见的时间疑问词
        const timeQuestionWords = ["什么时候", "何时", "几点", "哪天", "什么日期", "什么时间", "几号", "什么时段", "几月", "哪一天", "什么季节"];
        if (timeQuestionWords.some(word => timeRange.start.includes(word))) {
          console.log(`检测到时间疑问词: "${timeRange.start}"，将time_range.type设为"all"`);
          timeRange.type = "all";
          timeRange.start = null;
          timeRange.end = null;
        }
      }

      // 根据时间描述设置具体的时间范围
      if (timeRange.type === 'range' && timeRange.description) {
        const now = new Date();
        const thisYear = now.getFullYear();
        const thisMonth = now.getMonth();
        if (/今年|本年|今年度|本年度/.test(timeRange.description)) {
          // 今年范围：从今年1月1日到现在
          const startOfYear = new Date(thisYear, 0, 1).getTime();
          timeRange.start = startOfYear;
          timeRange.end = now.getTime();
          console.log(`设置今年时间范围: ${new Date(startOfYear).toISOString()} 到 ${new Date().toISOString()}`);
        } else if (/这个月|本月|当月/.test(timeRange.description)) {
          // 这个月范围：从本月1日到现在
          const startOfMonth = new Date(thisYear, thisMonth, 1).getTime();
          timeRange.start = startOfMonth;
          timeRange.end = now.getTime();
          console.log(`设置本月时间范围: ${new Date(startOfMonth).toISOString()} 到 ${new Date().toISOString()}`);
        } else if (/上个月|上月|前一个月/.test(timeRange.description)) {
          // 上个月范围
          const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
          const startOfLastMonth = new Date(lastMonthYear, lastMonth, 1).getTime();
          const endOfLastMonth = new Date(thisYear, thisMonth, 0).getTime();
          timeRange.start = startOfLastMonth;
          timeRange.end = endOfLastMonth;
          console.log(`设置上月时间范围: ${new Date(startOfLastMonth).toISOString()} 到 ${new Date(endOfLastMonth).toISOString()}`);
        } else if (/去年|上一年|前一年/.test(timeRange.description)) {
          // 去年范围
          const lastYear = thisYear - 1;
          const startOfLastYear = new Date(lastYear, 0, 1).getTime();
          const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
          timeRange.start = startOfLastYear;
          timeRange.end = endOfLastYear;
          console.log(`设置去年时间范围: ${new Date(startOfLastYear).toISOString()} 到 ${new Date(endOfLastYear).toISOString()}`);
        } else if (/过去(\d+)天|最近(\d+)天/.test(timeRange.description)) {
          // 过去N天
          const matches = timeRange.description.match(/过去(\d+)天|最近(\d+)天/);
          if (matches) {
            const days = parseInt(matches[1] || matches[2]);
            if (!isNaN(days)) {
              const pastDays = now.getTime() - days * 24 * 60 * 60 * 1000;
              timeRange.start = pastDays;
              timeRange.end = now.getTime();
              console.log(`设置过去${days}天时间范围: ${new Date(pastDays).toISOString()} 到 ${new Date().toISOString()}`);
            }
          }
        }
      }

      // 如果是recent类型，设置默认为过去7天
      if (timeRange.type === 'recent') {
        const now = new Date();
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        timeRange.start = sevenDaysAgo;
        timeRange.end = now.getTime();
        console.log(`设置最近时间范围(7天): ${new Date(sevenDaysAgo).toISOString()} 到 ${new Date().toISOString()}`);
      }
    }

    // 1.5 获取所有已知人名、项目和主题进行模糊匹配
    // 1.5.1 人名模糊匹配
    if (queryIntent?.query?.filters?.entities?.people?.length > 0) {
      // 获取所有已知人名
      const knownPeople = await (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.getAllKnownPeople)();
      console.log('已知人名列表:', knownPeople);

      // 对每个识别出的人名进行模糊匹配
      const matchedPeople = [];
      for (const person of queryIntent.query.filters.entities.people) {
        const matchedPerson = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchPerson)(person.name, knownPeople);
        if (matchedPerson) {
          console.log(`人名模糊匹配: "${person.name}" => "${matchedPerson}"`);
          matchedPeople.push({
            name: matchedPerson,
            role: person.role,
            required: person.required
          });
        } else {
          // 如果没有匹配到，保留原始人名
          matchedPeople.push(person);
        }
      }

      // 更新查询意图中的人名
      queryIntent.query.filters.entities.people = matchedPeople;
      console.log('更新后的人名列表:', queryIntent.query.filters.entities.people);
    }

    // 1.5.2 项目和主题的模糊匹配
    // 获取所有已知项目和主题
    const knownProjects = await (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.getAllKnownProjects)();
    const knownTopics = await (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.getAllKnownTopics)();
    console.log('已知项目列表:', knownProjects);
    console.log('已知主题列表:', knownTopics);

    // 项目模糊匹配
    if (queryIntent?.query?.filters?.entities?.projects?.length > 0) {
      const matchedProjects = [];
      for (const project of queryIntent.query.filters.entities.projects) {
        const matchedNames = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchEntityName)(project.name, knownProjects);
        if (matchedNames.length > 0) {
          console.log(`项目模糊匹配: "${project.name}" => `, matchedNames);
          matchedNames.forEach(name => {
            matchedProjects.push({
              name,
              status: project.status,
              required: project.required
            });
          });
        } else {
          // 如果项目没匹配到，检查是否可以在主题中找到
          const matchedTopics = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchEntityName)(project.name, knownTopics);
          if (matchedTopics.length > 0) {
            console.log(`项目在主题中匹配: "${project.name}" => `, matchedTopics);
            // 将匹配到的主题添加到主题列表中
            if (!queryIntent.query.filters.entities.topics) {
              queryIntent.query.filters.entities.topics = [];
            }
            matchedTopics.forEach(name => {
              queryIntent.query.filters.entities.topics.push({
                name,
                category: '',
                required: project.required
              });
            });
          } else {
            matchedProjects.push(project);
          }
        }
      }

      // 更新查询意图中的项目
      queryIntent.query.filters.entities.projects = matchedProjects;
    }

    // 主题模糊匹配
    if (queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      const matchedTopics = [];
      for (const topic of queryIntent.query.filters.entities.topics) {
        const matchedNames = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchEntityName)(topic.name, knownTopics);
        if (matchedNames.length > 0) {
          console.log(`主题模糊匹配: "${topic.name}" => `, matchedNames);
          matchedNames.forEach(name => {
            matchedTopics.push({
              name,
              category: topic.category,
              required: topic.required
            });
          });
        } else {
          // 如果主题没匹配到，检查是否可以在项目中找到
          const matchedProjects = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchEntityName)(topic.name, knownProjects);
          if (matchedProjects.length > 0) {
            console.log(`主题在项目中匹配: "${topic.name}" => `, matchedProjects);
            // 将匹配到的项目添加到项目列表中
            if (!queryIntent.query.filters.entities.projects) {
              queryIntent.query.filters.entities.projects = [];
            }
            matchedProjects.forEach(name => {
              queryIntent.query.filters.entities.projects.push({
                name,
                status: '',
                required: topic.required
              });
            });
          } else {
            matchedTopics.push(topic);
          }
        }
      }

      // 更新查询意图中的主题
      queryIntent.query.filters.entities.topics = matchedTopics;
    }

    // 1.5.3 特殊处理：如果用户查询既没有指定项目也没有指定主题，但问题中含有实体名称，尝试从两者中匹配
    if (!queryIntent?.query?.filters?.entities?.projects?.length && !queryIntent?.query?.filters?.entities?.topics?.length) {
      // 从问题中提取可能的实体名称（简单策略：提取所有名词短语）
      const words = question.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        // 尝试不同长度的词组
        for (let j = Math.min(i + 3, words.length); j > i; j--) {
          const phrase = words.slice(i, j).join(' ');

          // 在项目中查找
          const matchedProjects = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchEntityName)(phrase, knownProjects);
          if (matchedProjects.length > 0) {
            console.log(`从问题中提取项目: "${phrase}" => `, matchedProjects);
            if (!queryIntent.query.filters.entities.projects) {
              queryIntent.query.filters.entities.projects = [];
            }
            matchedProjects.forEach(name => {
              queryIntent.query.filters.entities.projects.push({
                name,
                status: '',
                required: true
              });
            });
          }

          // 在主题中查找
          const matchedTopics = (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.fuzzyMatchEntityName)(phrase, knownTopics);
          if (matchedTopics.length > 0) {
            console.log(`从问题中提取主题: "${phrase}" => `, matchedTopics);
            if (!queryIntent.query.filters.entities.topics) {
              queryIntent.query.filters.entities.topics = [];
            }
            matchedTopics.forEach(name => {
              queryIntent.query.filters.entities.topics.push({
                name,
                category: '',
                required: true
              });
            });
          }
        }
      }
    }

    // 去重（基于name字段）
    if (queryIntent?.query?.filters?.entities?.projects) {
      queryIntent.query.filters.entities.projects = Array.from(new Map(queryIntent.query.filters.entities.projects.map(item => [item.name, item])).values());
    }
    if (queryIntent?.query?.filters?.entities?.topics) {
      queryIntent.query.filters.entities.topics = Array.from(new Map(queryIntent.query.filters.entities.topics.map(item => [item.name, item])).values());
    }
    console.log('最终查询意图:', queryIntent);

    // 2. 构建查询过滤条件
    const filters = {};

    // 添加安全检查，确保 queryIntent 结构完整
    if (queryIntent?.query?.filters) {
      // 复制实体过滤器
      if (queryIntent.query.filters.entities) {
        filters.entities = queryIntent.query.filters.entities;
      }

      // 复制时间范围
      if (queryIntent.query.filters.time_range) {
        filters.time_range = queryIntent.query.filters.time_range;
      }
    }

    // 设置输出选项
    const output = queryIntent?.query?.output || {
      format: "list",
      limit: 20,
      sort: {
        field: "timestamp",
        order: "desc"
      }
    };

    // 4. 查询向量数据库
    let queryResults;
    try {
      queryResults = await (0,_vectorStore__WEBPACK_IMPORTED_MODULE_0__.naturalLanguageQuery)(question, filters, output);
      console.log('queryResults', queryResults, new Date().getTime());
    } catch (error) {
      console.error('向量数据库查询失败:', error);
      queryResults = {
        question: question,
        results: {
          ids: [],
          documents: [],
          metadatas: [],
          distances: []
        }
      };
    }

    // 添加空值检查
    if (!queryResults) {
      console.warn('向量数据库查询返回空结果');
      queryResults = {
        question: question,
        results: {
          ids: [],
          documents: [],
          metadatas: [],
          distances: []
        }
      };
    }
    const {
      question: formattedQuestion,
      results
    } = queryResults;
    if (!results || !results.documents || results.documents.length === 0) {
      return {
        success: false,
        message: `没有找到关于"${question}"的相关信息。`
      };
    }
    console.log('results', !results, !results.documents, results.documents.length === 0, new Date().getTime());
    // 5. 根据查询类型构建不同的提示模板
    let promptTemplate = "";
    switch (queryIntent?.query?.intent?.secondary) {
      case "project_status":
        promptTemplate = `
        以下是关于项目的一些信息:
        {{context}}
        
        基于以上信息,请分析并回答关于项目进展的问题:
        ${formattedQuestion}
        
        请包括:
        1. 项目当前进展
        2. 存在的风险和挑战
        3. 下一步计划
        `;
        break;
      case "person_info":
        promptTemplate = `
        以下是关于{{person}}的一些信息:
        {{context}}
        
        基于这些信息,请回答:
        ${formattedQuestion}
        
        请分析此人:
        1. 关注的重点话题/项目
        2. 交流和决策风格
        3. 可能的兴趣和关注点
        `;
        break;
      case "topic_discussion":
        promptTemplate = `
        以下是关于"{{topic}}"话题的相关信息:
        {{context}}
        
        基于这些信息,请回答:
        ${formattedQuestion}
        
        请分析:
        1. 这个话题的主要讨论点
        2. 不同观点和立场
        3. 最新的发展或决策
        `;
        break;
      case "action_items":
        promptTemplate = `
        以下是一些可能包含行动项的消息:
        {{context}}
        
        基于这些信息,请回答:
        ${formattedQuestion}
        
        请列出:
        1. 所有需要注意的行动项
        2. 各项的截止日期(如有提及)
        3. 负责人(如有提及)
        `;
        break;
      default:
        promptTemplate = `
        以下是与问题"${formattedQuestion}"相关的信息:
        {{context}}
        
        请基于以上信息提供详细回答。仅使用提供的信息,不要添加额外知识。
        如果信息不足,请明确指出。
        `;
    }

    // 6. 插入上下文
    const messagesContext = results.documents.map((doc, idx) => {
      const metadata = results.metadatas[idx];
      const source = metadata.source;
      const date = new Date(Number(metadata.timestamp)).toLocaleString();
      return `[${date} - ${source}] ${doc}`;
    }).join('\n\n');
    let prompt = promptTemplate.replace('{{context}}', messagesContext);

    // 替换实体
    if (queryIntent?.query?.intent?.secondary === "person_info" && queryIntent?.query?.filters?.entities?.people?.length > 0) {
      prompt = prompt.replace('{{person}}', queryIntent.query.filters.entities.people[0].name);
    }
    if (queryIntent?.query?.intent?.secondary === "topic_discussion" && queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      prompt = prompt.replace('{{topic}}', queryIntent.query.filters.entities.topics[0].name);
    }

    // 7. 调用 LLM 生成回答
    const llmResponse = await handleLLMRequest({
      prompt
    });

    // 8. 构建符合 QueryResult 接口的结果
    const formattedResults = results.documents.map((doc, idx) => {
      const metadata = results.metadatas[idx];
      const id = String(results.ids[idx]);
      const relevance = 1 - results.distances[idx]; // 转换距离为相关性分数

      // 解析标签
      let tags = [];
      try {
        if (metadata.tags) {
          tags = JSON.parse(String(metadata.tags));
        } else if (metadata.category) {
          tags = JSON.parse(String(metadata.category));
        }
      } catch (e) {
        console.error('解析标签失败:', e);
        tags = [];
      }

      // 构建团队信息
      const teamInfo = metadata.teamName || metadata.teamId ? {
        name: String(metadata.teamName || '未知群组'),
        id: String(metadata.teamId || ''),
        url: metadata.teamId ? `https://app.ringcentral.com/messages/${metadata.teamId}` : ''
      } : undefined;

      // 构建 QueryResult 对象
      return {
        id: id,
        summary: String(metadata.summary) || doc.substring(0, 100) + '...',
        details: String(metadata.details || doc),
        timestamp: new Date(Number(metadata.timestamp)).toISOString(),
        source: String(metadata.source),
        relevance: relevance,
        tags: tags,
        team: teamInfo,
        reply_advice: metadata.reply_advice || ''
      };
    });
    return {
      success: true,
      analysis: llmResponse,
      relatedMessages: results.documents.length,
      queryIntent: queryIntent,
      results: formattedResults
    };
  } catch (error) {
    console.error('通用查询失败:', error);
    return {
      success: false,
      message: '查询时发生错误,请稍后再试。'
    };
  }
}

// 实现 callLLMJsonAPI 函数
async function callLLMJsonAPI(body) {
  // 复用现有的 LLM 请求代码
  const response = await handleLLMRequest(body);
  const jsonData = extractJsonFromResponse(response);
  return jsonData;
}

// 通用聊天消息接口

// OPENAI聊天实现
class OpenAIChat {
  // 存储不同会话的历史记录

  constructor(apiKey) {
    let baseUrl = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'https://api.openai.com/v1';
    // OpenAI实例
    this.conversationId = '';
    // 添加会话ID存储
    this.conversationHistory = new Map();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    // 初始化OpenAI客户端
    this.openai = new openai__WEBPACK_IMPORTED_MODULE_3__["default"]({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true
    });
  }

  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }

  // 设置会话ID
  setConversationId(id) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }

  // 获取当前会话ID
  getConversationId() {
    return this.conversationId;
  }

  // 获取当前会话的历史记录
  getConversationHistory() {
    return this.conversationHistory.get(this.conversationId) || [];
  }
  async chat(options) {
    const {
      model,
      messages,
      temperature = 0.7,
      max_tokens,
      stream = false,
      onMessage,
      onComplete,
      onError
    } = options;
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }

      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      const tokenLimit = model.includes('gpt-4') ? 8000 : 4000; // 根据模型调整
      const optimizedHistory = this.optimizeHistory(history, tokenLimit);
      const allMessages = [...optimizedHistory, ...messages];

      // 使用OpenAI SDK
      if (stream) {
        const stream = await this.openai.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens,
          stream: true
        });
        let fullResponse = '';
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onMessage?.(content);
          }
        }

        // 更新会话历史
        if (fullResponse) {
          history.push(...messages); // 添加用户消息
          history.push({
            role: 'assistant',
            content: fullResponse
          }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        onComplete?.(fullResponse);
        return fullResponse;
      } else {
        const completion = await this.openai.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens
        });
        const content = completion.choices[0].message.content || '';

        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({
            role: 'assistant',
            content
          }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
  optimizeHistory(messages) {
    let maxTokens = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4000;
    // 如果消息数量少，直接返回
    if (messages.length <= 3) return messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');

    // 获取非系统消息
    let conversationMessages = messages.filter(m => m.role !== 'system');

    // 估算当前token数量（简单估算：每4个字符约1个token）
    const estimateTokens = msgs => {
      return msgs.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    };

    // 如果预估token数量超过限制，开始裁剪历史
    let estimatedTokens = estimateTokens(conversationMessages);

    // 保留最新的消息，逐步移除较早的消息对
    while (estimatedTokens > maxTokens && conversationMessages.length > 2) {
      // 移除最早的一对对话（用户+助手）
      conversationMessages = conversationMessages.slice(2);
      estimatedTokens = estimateTokens(conversationMessages);
    }

    // 合并系统消息和优化后的对话
    return [...systemMessages, ...conversationMessages];
  }
}

// DIFY聊天实现
class DifyChat {
  // 添加会话ID存储

  constructor(apiKey, baseUrl) {
    this.conversationId = '';
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }

  // 设置会话ID
  setConversationId(id) {
    this.conversationId = id;
    return this;
  }

  // 获取当前会话ID
  getConversationId() {
    return this.conversationId;
  }
  async chat(options) {
    const {
      messages,
      temperature = 0.7,
      stream = false,
      onMessage,
      onComplete,
      onError
    } = options;

    // 提取用户输入（最后一条用户消息）
    const userInput = messages.filter(m => m.role === 'user').pop()?.content || '';

    // 提取历史消息
    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));
    try {
      const requestBody = {
        inputs: {},
        query: userInput,
        response_mode: stream ? 'streaming' : 'blocking',
        user: 'user-id',
        // 可自定义
        temperature
      };

      // 如果有会话ID，添加到请求中
      if (this.conversationId) {
        requestBody.conversation_id = this.conversationId;
      }

      // 只在没有会话ID时添加历史消息
      if (!this.conversationId && history.length > 0) {
        requestBody.history = history;
      }
      const response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      if (stream) {
        // 处理流式响应
        const reader = response.body?.getReader();
        let fullResponse = '';
        let metaDataProcessed = false;
        if (reader) {
          let isDone = false;
          while (!isDone) {
            const {
              done,
              value
            } = await reader.read();
            isDone = done;
            if (done) break;
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const json = JSON.parse(line);

                // 保存会话ID (只需处理一次)
                if (!metaDataProcessed && json.conversation_id) {
                  this.conversationId = json.conversation_id;
                  metaDataProcessed = true;
                }
                if (json.event === 'message' && json.data) {
                  fullResponse += json.data.answer || '';
                  onMessage?.(json.data.answer || '');
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
          onComplete?.(fullResponse);
        }
      } else {
        const json = await response.json();

        // 保存会话ID
        if (json.conversation_id) {
          this.conversationId = json.conversation_id;
        }
        const content = json.answer || '';
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
}

// GROQ聊天实现
class GroqChat {
  // 存储不同会话的历史记录

  constructor(apiKey) {
    // Groq实例
    this.conversationId = '';
    // 添加会话ID存储
    this.conversationHistory = new Map();
    this.apiKey = apiKey;

    // 初始化Groq客户端
    this.groq = new groq_sdk__WEBPACK_IMPORTED_MODULE_4__["default"]({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }

  // 设置会话ID
  setConversationId(id) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }

  // 获取当前会话ID
  getConversationId() {
    return this.conversationId;
  }

  // 获取当前会话的历史记录
  getConversationHistory() {
    return this.conversationHistory.get(this.conversationId) || [];
  }
  async chat(options) {
    const {
      model,
      messages,
      temperature = 0.7,
      max_tokens,
      stream = false,
      onMessage,
      onComplete,
      onError
    } = options;
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }

      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      const tokenLimit = model.includes('gpt-4') ? 8000 : 4000; // 根据模型调整
      const optimizedHistory = this.optimizeHistory(history, tokenLimit);
      const allMessages = [...optimizedHistory, ...messages];

      // 使用Groq SDK
      if (stream) {
        const stream = await this.groq.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens,
          stream: true
        });
        let fullResponse = '';
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onMessage?.(content);
          }
        }

        // 更新会话历史
        if (fullResponse) {
          history.push(...messages); // 添加用户消息
          history.push({
            role: 'assistant',
            content: fullResponse
          }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        onComplete?.(fullResponse);
        return fullResponse;
      } else {
        const completion = await this.groq.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens
        });
        const content = completion.choices[0].message.content || '';

        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({
            role: 'assistant',
            content
          }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
  optimizeHistory(messages) {
    let maxTokens = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4000;
    // 如果消息数量少，直接返回
    if (messages.length <= 3) return messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');

    // 获取非系统消息
    let conversationMessages = messages.filter(m => m.role !== 'system');

    // 估算当前token数量（简单估算：每4个字符约1个token）
    const estimateTokens = msgs => {
      return msgs.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    };

    // 如果预估token数量超过限制，开始裁剪历史
    let estimatedTokens = estimateTokens(conversationMessages);

    // 保留最新的消息，逐步移除较早的消息对
    while (estimatedTokens > maxTokens && conversationMessages.length > 2) {
      // 移除最早的一对对话（用户+助手）
      conversationMessages = conversationMessages.slice(2);
      estimatedTokens = estimateTokens(conversationMessages);
    }

    // 合并系统消息和优化后的对话
    return [...systemMessages, ...conversationMessages];
  }
}

// Ollama聊天实现
class OllamaChat {
  // 存储不同会话的历史记录

  constructor() {
    let baseUrl = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'http://localhost:11434';
    this.conversationId = '';
    // 移除了`: string`类型注解
    this.conversationHistory = new Map();
    this.baseUrl = baseUrl;
  }

  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }

  // 设置会话ID
  setConversationId(id) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }

  // 获取当前会话ID
  getConversationId() {
    return this.conversationId;
  }

  // 获取当前会话的历史记录
  getConversationHistory() {
    return this.conversationHistory.get(this.conversationId) || [];
  }
  async chat(options) {
    const {
      model,
      messages,
      temperature = 0.7,
      stream = false,
      onMessage,
      onComplete,
      onError
    } = options;
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }

      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];

      // 合并历史记录和新消息，转换为Ollama的格式
      const allMessages = [...history, ...messages].map(m => ({
        role: m.role,
        content: m.content
      }));
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          temperature,
          stream
        })
      });
      if (stream) {
        // 处理流式响应
        const reader = response.body?.getReader();
        let fullResponse = '';
        if (reader) {
          let isDone = false;
          while (!isDone) {
            const {
              done,
              value
            } = await reader.read();
            isDone = done;
            if (done) break;
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message && json.message.content) {
                  const content = json.message.content;
                  fullResponse += content;
                  onMessage?.(content);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }

          // 更新会话历史
          if (fullResponse) {
            history.push(...messages); // 添加用户消息
            history.push({
              role: 'assistant',
              content: fullResponse
            }); // 添加助手回复
            this.conversationHistory.set(this.conversationId, history);
          }
          onComplete?.(fullResponse);
        }
      } else {
        const json = await response.json();
        const content = json.message?.content || '';

        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({
            role: 'assistant',
            content
          }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
}

// 导出所有实现


/***/ }),

/***/ "./src/storage.ts":
/*!************************!*\
  !*** ./src/storage.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getCurrentUserInfo: () => (/* binding */ getCurrentUserInfo),
/* harmony export */   getFolders: () => (/* binding */ getFolders),
/* harmony export */   getGroupsMap: () => (/* binding */ getGroupsMap),
/* harmony export */   getIndexedDBData: () => (/* binding */ getIndexedDBData),
/* harmony export */   getLocalStorageItem: () => (/* binding */ getLocalStorageItem),
/* harmony export */   setLocalStorageItem: () => (/* binding */ setLocalStorageItem)
/* harmony export */ });
function getIndexedDBData(databaseName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const dataRequest = objectStore.getAll();
      dataRequest.onsuccess = event => {
        resolve(event.target.result);
      };
      dataRequest.onerror = event => {
        reject(event.target.error);
      };
    };
    request.onerror = event => {
      reject(event.target.error);
    };
  });
}
const getLocalStorageItem = (key, defaultValue) => {
  return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue));
};
const setLocalStorageItem = (key, defaultValue) => {
  localStorage.setItem(key, JSON.stringify(defaultValue));
};
function getCurrentUserInfo() {
  const {
    extension: extensionId
  } = getLocalStorageItem('ownExtension', {});
  const username = getLocalStorageItem('displayName', 'radar-poc');
  return {
    extensionId,
    username
  };
}
function getFolders() {
  return getIndexedDBData('Glip', 'profile').then(_ref => {
    let [data] = _ref;
    const favorite_group_ids = data?.favorite_group_ids || [];
    const conversation_sets = data?.conversation_sets || [];
    // @ts-ignore
    const folders = [{
      title: ' ',
      ids: []
    }, {
      title: 'favorite',
      ids: favorite_group_ids
    }, ...conversation_sets.filter(item => item.type === 'folder')];
    return folders;
  }).catch(error => {
    console.log(error);
  });
}
function getGroupsMap() {
  return getIndexedDBData('Glip', 'group').then(groups => {
    const groupsMap = groups.reduce((acc, group) => {
      acc[group.id] = {
        name: group.set_abbreviation,
        is_team: group.is_team
      };
      return acc;
    }, {});
    return groupsMap;
  });
}

/***/ }),

/***/ "./src/utils.ts":
/*!**********************!*\
  !*** ./src/utils.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultEnvConfig: () => (/* binding */ defaultEnvConfig),
/* harmony export */   formatDate: () => (/* binding */ formatDate),
/* harmony export */   getDefaultEnvConfig: () => (/* binding */ getDefaultEnvConfig),
/* harmony export */   getEnvConfig: () => (/* binding */ getEnvConfig),
/* harmony export */   getUserInfo: () => (/* binding */ getUserInfo),
/* harmony export */   showToast: () => (/* binding */ showToast),
/* harmony export */   transformGroupLinks: () => (/* binding */ transformGroupLinks),
/* harmony export */   transformPostLinks: () => (/* binding */ transformPostLinks),
/* harmony export */   uniqBy: () => (/* binding */ uniqBy)
/* harmony export */ });
/* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./storage */ "./src/storage.ts");


// 环境配置类型定义

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
  if (!container) return;

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

// 默认环境配置
const defaultEnvConfig = {
  SCHEDULED_INTERVAL: Number(process.env.SCHEDULED_INTERVAL) || 120,
  ANALYSIS_TYPE: process.env.ANALYSIS_TYPE || "filter",
  LLM_TYPE: process.env.LLM_TYPE || "dify",
  ANALYZE_BY_GROUP: process.env.ANALYZE_BY_GROUP === "true",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "deepseek-r1",
  OLLAMA_REVIEW_MODEL: process.env.OLLAMA_REVIEW_MODEL || "llama3.1",
  OLLAMA_QUERY_MODEL: process.env.OLLAMA_QUERY_MODEL || "llama3.1",
  DIFY_API_KEY: process.env.DIFY_API_KEY || "",
  DIFY_REVIEW_API_KEY: process.env.DIFY_REVIEW_API_KEY || "",
  DIFY_API_BASE_URL: process.env.DIFY_API_BASE_URL || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "",
  OPENAI_REVIEW_MODEL: process.env.OPENAI_REVIEW_MODEL || "",
  OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL: process.env.GROQ_MODEL || "",
  GROQ_REVIEW_MODEL: process.env.GROQ_REVIEW_MODEL || "",
  BOT_API_BASE_URL: process.env.BOT_API_BASE_URL || "https://botman.int.rclabenv.com/v2",
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  BOT_ID: process.env.BOT_ID || "4700372020@37439510.bot.glip.net",
  BOT_TYPE: process.env.BOT_TYPE || "user",
  TEAM_ID: process.env.TEAM_ID || "",
  ENABLE_BOT: process.env.ENABLE_BOT === "true",
  LLM_REVIEW_BEFORE_SEND: process.env.LLM_REVIEW_BEFORE_SEND === "true",
  ENABLE_CHROMA: process.env.ENABLE_CHROMA === "true",
  CHROMA_API_URL: process.env.CHROMA_API_URL || "http://localhost:8000",
  CHROMA_PORT: Number(process.env.CHROMA_PORT) || 8000,
  CHROMA_COLLECTION_NAME: process.env.CHROMA_COLLECTION_NAME || "",
  JIRA_BASE_URL: process.env.JIRA_BASE_URL || "https://jira.ringcentral.com",
  JIRA_USERNAME: process.env.JIRA_USERNAME || "",
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || ""
};

// 获取环境配置，如果可能的话从 storage 获取，否则从 process.env 获取
async function getEnvConfig() {
  try {
    const {
      envConfig
    } = await chrome.storage.local.get(['envConfig']);
    if (envConfig) {
      // 将存储的配置与默认配置合并，确保新增的配置项也会被包含
      return {
        ...defaultEnvConfig,
        ...envConfig
      };
    }
  } catch (error) {
    console.error('获取配置失败:', error);
  }

  // 如果获取失败或没有保存的配置，返回默认值
  return defaultEnvConfig;
}
function getDefaultEnvConfig() {
  return defaultEnvConfig;
}
function getUserInfo() {
  const accountUD = (0,_storage__WEBPACK_IMPORTED_MODULE_0__.getLocalStorageItem)('global.account.UD', '');
  const accountInfoList = (0,_storage__WEBPACK_IMPORTED_MODULE_0__.getLocalStorageItem)('global.account.ACCOUNT_SESSION_DATA_LIST', {});
  const accountInfo = accountUD ? accountInfoList[accountUD] : accountInfoList.find(item => item.displayName != '');
  console.log('accountInfoList', accountInfoList, accountInfo);
  if (accountInfo) return {
    extensionId: accountInfo.extensionId,
    email: accountInfo.email,
    fullName: accountInfo.displayName,
    username: accountInfo.email ? accountInfo.email.trim().split('@')[0] : accountInfo.displayName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '')
  };
  const userInfo = (0,_storage__WEBPACK_IMPORTED_MODULE_0__.getCurrentUserInfo)();
  return {
    extensionId: userInfo.extensionId,
    fullName: userInfo.username,
    username: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
    email: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '') + '@ringcentral.com'
  };
}

/***/ }),

/***/ "./src/vectorStore.ts":
/*!****************************!*\
  !*** ./src/vectorStore.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fuzzyMatchEntityName: () => (/* binding */ fuzzyMatchEntityName),
/* harmony export */   fuzzyMatchPerson: () => (/* binding */ fuzzyMatchPerson),
/* harmony export */   getAllKnownPeople: () => (/* binding */ getAllKnownPeople),
/* harmony export */   getAllKnownProjects: () => (/* binding */ getAllKnownProjects),
/* harmony export */   getAllKnownTopics: () => (/* binding */ getAllKnownTopics),
/* harmony export */   getEmbedding: () => (/* binding */ getEmbedding),
/* harmony export */   initChromaClient: () => (/* binding */ initChromaClient),
/* harmony export */   naturalLanguageQuery: () => (/* binding */ naturalLanguageQuery),
/* harmony export */   storeMessage: () => (/* binding */ storeMessage)
/* harmony export */ });
/* harmony import */ var chromadb__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! chromadb */ "./node_modules/chromadb/dist/chromadb.mjs");
/* harmony import */ var _embeddings__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./embeddings */ "./src/embeddings.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils */ "./src/utils.ts");



let chromaClient = null;
let messageCollection = null;

// 获取嵌入向量
async function getEmbedding(text) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('嵌入模型已禁用，返回空向量');
    return new Array(384).fill(0);
  }
  try {
    // 使用离屏文档获取嵌入向量
    return await (0,_embeddings__WEBPACK_IMPORTED_MODULE_1__.getEmbeddingViaOffscreen)(text);
  } catch (error) {
    console.error('获取嵌入向量失败:', error);
    return new Array(384).fill(0);
  }
}

// 初始化 Chroma 客户端
async function initChromaClient() {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用');
    return false;
  }
  try {
    chromaClient = new chromadb__WEBPACK_IMPORTED_MODULE_0__.ChromaClient({
      path: envConfig.CHROMA_API_URL || 'http://localhost:8000'
    });
    console.log('正在连接向量数据库...');
    const collections = await chromaClient.listCollections();
    console.log('可用集合:', collections);

    // 创建一个空的 embeddingFunction，因为我们使用自定义的 getEmbedding 函数
    const embeddingFunction = {
      generate: async texts => {
        // 这个函数不会被调用，因为我们在添加文档前手动生成嵌入
        return new Array(texts.length).fill(new Array(1536).fill(0));
      }
    };
    let username = '';
    try {
      const {
        userinfo
      } = await chrome.storage.local.get('userinfo');
      username = userinfo.username || (userinfo.userEmail ? userinfo.userEmail.trim().split('@')[0] : userinfo.fullName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''));
      if (!username) throw new Error('username is empty');
    } catch (error) {
      envConfig.CHROMA_COLLECTION_NAME = 'messages';
    }
    const collectionName = envConfig.CHROMA_COLLECTION_NAME || username + '-messages';
    console.log('collectionName', collectionName, envConfig.CHROMA_COLLECTION_NAME, username);
    if (!collections.includes(collectionName)) {
      messageCollection = await chromaClient.createCollection({
        name: collectionName,
        metadata: {
          description: "存储与关注项匹配的消息"
        },
        embeddingFunction
      });
    } else {
      messageCollection = await chromaClient.getCollection({
        name: collectionName,
        embeddingFunction
      });
    }
    console.log('向量数据库集合已初始化', messageCollection);
    return true;
  } catch (error) {
    console.error('初始化 Chroma 客户端失败:', error);
    return false;
  }
}

// 存储消息到向量数据库
async function storeMessage(messageId, content, metadata) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，消息未存储');
    return false;
  }
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    const embedding = await getEmbedding(content);

    // 简化元数据，确保它与 Chroma 兼容
    const simplifiedMetadata = {
      source: metadata.source,
      timestamp: metadata.timestamp,
      matchedRules: JSON.stringify(metadata.matchedRules),
      summary: metadata.summary,
      details: content
    };
    if (metadata.teamName) simplifiedMetadata.teamName = metadata.teamName;
    if (metadata.teamId) simplifiedMetadata.teamId = metadata.teamId;

    // 处理实体数据
    if (metadata.entities) {
      // 存储完整的实体数据
      simplifiedMetadata.entities = JSON.stringify(metadata.entities);

      // 为了便于搜索，单独存储实体名称列表
      if (metadata.entities.people) {
        simplifiedMetadata.people = JSON.stringify(metadata.entities.people.map(p => p.name));
      }
      if (metadata.entities.projects) {
        simplifiedMetadata.projects = JSON.stringify(metadata.entities.projects.map(p => p.name));
      }
      if (metadata.entities.topics) {
        simplifiedMetadata.topics = JSON.stringify(metadata.entities.topics.map(t => t.name));
      }
      if (metadata.entities.location) {
        simplifiedMetadata.locations = JSON.stringify(metadata.entities.location.map(l => l.name));
      }
    }

    // 处理元数据
    if (metadata.metadata) {
      if (metadata.metadata.sentiment) simplifiedMetadata.sentiment = metadata.metadata.sentiment;
      if (metadata.metadata.priority) simplifiedMetadata.priority = metadata.metadata.priority;
      if (metadata.metadata.category) simplifiedMetadata.category = JSON.stringify(metadata.metadata.category);
      if (metadata.metadata.tags) simplifiedMetadata.tags = JSON.stringify(metadata.metadata.tags);
    }

    // 处理关系数据
    if (metadata.relationships) {
      simplifiedMetadata.relationships = JSON.stringify(metadata.relationships);
    }

    // 处理行动项
    if (metadata.actions) {
      simplifiedMetadata.actions = JSON.stringify(metadata.actions);
    }

    // 生成搜索标签
    const allTags = new Set();

    // 添加所有实体名称到标签
    if (metadata.entities) {
      if (metadata.entities.people) {
        metadata.entities.people.forEach(p => allTags.add(p.name));
      }
      if (metadata.entities.projects) {
        metadata.entities.projects.forEach(p => allTags.add(p.name));
      }
      if (metadata.entities.topics) {
        metadata.entities.topics.forEach(t => allTags.add(t.name));
      }
      if (metadata.entities.location) {
        metadata.entities.location.forEach(l => allTags.add(l.name));
      }
    }

    // 添加分类和标签
    if (metadata.metadata?.category) {
      metadata.metadata.category.forEach(c => allTags.add(c));
    }
    if (metadata.metadata?.tags) {
      metadata.metadata.tags.forEach(t => allTags.add(t));
    }

    // 更新搜索标签
    simplifiedMetadata.searchTags = JSON.stringify(Array.from(allTags));
    await messageCollection.add({
      ids: [messageId],
      embeddings: [embedding],
      documents: [content],
      metadatas: [simplifiedMetadata]
    });
    console.log(`消息 ${messageId} 已存储到向量数据库`);
    return true;
  } catch (error) {
    console.error('存储消息到向量数据库失败:', error);
    return false;
  }
}

// 辅助函数：记录查询条件
function logQueryConditions(where) {
  console.log('完整查询条件:', JSON.stringify(where, null, 2));
  return where;
}

// 辅助函数：生成可能的 JSON 字符串模式
function generatePossibleJsonPatterns(value) {
  // 转义特殊字符，防止 JSON 注入
  const escapedValue = value.replace(/"/g, '\\"');

  // 基本模式，适用于单值数组和多值数组
  const patterns = [`["${escapedValue}"]`,
  // 精确匹配单个值 ["value"]
  `["${escapedValue}", `,
  // 数组开头 ["value", ...
  `, "${escapedValue}"]`,
  // 数组结尾 ..., "value"]
  `, "${escapedValue}", `,
  // 数组中间 ..., "value", ...
  `"${escapedValue}"` // 直接包含的值 "value"
  ];

  // 处理可能的空格变化
  patterns.push(`[ "${escapedValue}" ]`); // 带空格的数组 [ "value" ]
  patterns.push(`[ "${escapedValue}"]`); // 混合空格样式 [ "value"]
  patterns.push(`["${escapedValue}" ]`); // 混合空格样式 ["value" ]

  // 处理不同的引号格式（单引号）
  patterns.push(`['${escapedValue}']`); // 单引号格式 ['value']
  patterns.push(`'${escapedValue}'`); // 单引号直接值 'value'

  // 处理值本身包含的部分（用于子字符串搜索）
  if (escapedValue.includes(' ')) {
    // 如果值中包含空格，则提取关键部分
    const parts = escapedValue.split(' ');
    for (const part of parts) {
      if (part.length > 2) {
        // 只处理有意义的部分
        patterns.push(`"${part}"`); // 匹配部分关键词 "keyword"
        patterns.push(`'${part}'`); // 单引号格式 'keyword'
      }
    }
  }
  return patterns;
}

// 使用 $in 进行字符串模式匹配的更高级方法
function createJsonPatternFilters(field, values) {
  // 对每个值，生成可能的 JSON 模式
  const allPatterns = [];
  for (const value of values) {
    allPatterns.push(...generatePossibleJsonPatterns(value));
  }

  // 处理两种可能情况：
  // 1. 字段存储为JSON字符串数组  
  // 2. 字段直接存储为普通字符串（没有JSON格式化）
  return {
    "$or": [{
      [field]: {
        $in: allPatterns
      }
    },
    // 直接搜索原始值（针对可能未格式化为JSON的字段）
    ...values.map(value => ({
      [field]: value
    }))]
  };
}

// 修改：通用自然语言查询接口，添加 filters 参数
async function naturalLanguageQuery(userQuestion, filters, output) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法执行自然语言查询');
    return {
      question: userQuestion,
      results: {
        ids: [],
        documents: [],
        metadatas: [],
        distances: []
      }
    };
  }
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    const queryEmbedding = await getEmbedding(userQuestion);
    const queryParams = {
      queryEmbeddings: [queryEmbedding],
      nResults: output?.limit || 20
    };
    if (filters && Object.keys(filters).length > 0) {
      const conditions = [];

      // 处理基础过滤条件
      if (filters.source) {
        conditions.push({
          source: filters.source
        });
      }
      if (filters.teamName) {
        conditions.push({
          teamName: filters.teamName
        });
      }

      // 处理时间范围过滤
      if (filters.time_range) {
        const {
          type,
          start,
          end
        } = filters.time_range;

        // 对于"all"类型，不添加时间过滤
        if (type === "all") {
          console.log(`时间范围类型为"all"，不应用时间过滤`);
        }
        // 如果具有明确的start和end时间
        else if (start && end) {
          // 修复：Chroma不支持多个操作符在同一个对象中的写法
          conditions.push({
            "$and": [{
              timestamp: {
                "$gte": start
              }
            }, {
              timestamp: {
                "$lte": end
              }
            }]
          });
          console.log(`应用时间范围过滤: ${new Date(start).toISOString()} 到 ${new Date(end).toISOString()}`);
        }
        // 如果只有start时间（从某时刻到现在）
        else if (start && !end) {
          conditions.push({
            timestamp: {
              "$gte": start
            }
          });
          console.log(`应用时间范围过滤: ${new Date(start).toISOString()} 到现在`);
        }
        // 如果只有end时间（到某个时刻为止）
        else if (!start && end) {
          conditions.push({
            timestamp: {
              "$lte": end
            }
          });
          console.log(`应用时间范围过滤: 从最早到 ${new Date(end).toISOString()}`);
        }
        // 如果是特定时间
        else if (type === "specific" && start) {
          // 为特定时间点添加一天的范围，以确保能捕获到该天的所有消息
          const nextDay = start + 24 * 60 * 60 * 1000;
          // 修复：Chroma不支持多个操作符在同一个对象中的写法
          conditions.push({
            "$and": [{
              timestamp: {
                "$gte": start
              }
            }, {
              timestamp: {
                "$lte": nextDay
              }
            }]
          });
          console.log(`应用特定时间过滤: ${new Date(start).toISOString()}`);
        }
        // 对于recent类型（如果走到这里，说明没有设置start和end）
        else if (type === "recent") {
          const now = new Date();
          const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
          conditions.push({
            "$and": [{
              timestamp: {
                "$gte": sevenDaysAgo
              }
            }, {
              timestamp: {
                "$lte": now.getTime()
              }
            }]
          });
          console.log(`应用最近时间范围过滤(7天): ${new Date(sevenDaysAgo).toISOString()} 到 ${new Date().toISOString()}`);
        }
      }

      // 处理实体过滤
      if (filters.entities) {
        // 处理人物过滤
        if (filters.entities.people?.length) {
          const peopleNames = filters.entities.people.map(p => p.name);

          // 增强人名匹配：同时检查 people 字段和 source 字段
          const peopleCondition = {
            "$or": [createJsonPatternFilters('people', peopleNames),
            // 同时检查source字段（发送者）
            ...peopleNames.map(name => ({
              source: name
            }))]
          };
          conditions.push(peopleCondition);
        }

        // 处理项目过滤
        if (filters.entities.projects?.length) {
          const projectNames = filters.entities.projects.map(p => p.name);
          conditions.push(createJsonPatternFilters('projects', projectNames));
        }

        // 处理话题过滤
        if (filters.entities.topics?.length) {
          const topicNames = filters.entities.topics.map(t => t.name);
          conditions.push(createJsonPatternFilters('topics', topicNames));
        }

        // 处理位置过滤
        if (filters.entities.location?.length) {
          const locationNames = filters.entities.location.map(l => l.name);
          conditions.push(createJsonPatternFilters('locations', locationNames));
        }
      }

      // 处理元数据过滤
      if (filters.metadata) {
        if (filters.metadata.sentiment) {
          conditions.push({
            sentiment: filters.metadata.sentiment
          });
        }
        if (filters.metadata.priority) {
          conditions.push({
            priority: filters.metadata.priority
          });
        }
        if (filters.metadata.category?.length) {
          conditions.push(createJsonPatternFilters('category', filters.metadata.category));
        }
        if (filters.metadata.tags?.length) {
          conditions.push(createJsonPatternFilters('searchTags', filters.metadata.tags));
        }
      }

      // 合并所有条件
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          queryParams.where = logQueryConditions(conditions[0]);
        } else {
          queryParams.where = logQueryConditions({
            $and: conditions
          });
        }
      }
    }

    // 执行查询
    console.log('naturalLanguageQuery queryParams', queryParams);
    let results = await messageCollection.query(queryParams);

    // 记录结果
    console.log(`查询结果: 找到 ${results.ids[0]?.length || 0} 条匹配记录`);
    if (results.ids[0]?.length > 0) {
      console.log('第一条记录预览:', {
        id: results.ids[0][0],
        document: results.documents[0][0].substring(0, 100) + '...',
        metadata: results.metadatas[0][0]
      });
    } else {
      console.log('没有找到匹配记录，检查是否因为查询条件过于严格');
      // 尝试仅通过向量相似度查询
      console.log('尝试仅使用向量相似度查询，不添加过滤条件');
      try {
        results = await messageCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: output?.limit || 20
        });
        console.log(`向量相似度查询结果: 找到 ${results.ids[0]?.length || 0} 条匹配记录`);
        if (results.ids[0]?.length > 0 && filters.entities.people?.length) {
          const simpleNames = filters.entities.people.map(p => p.name);
          // 找出匹配的索引位置
          const matchedIndices = results.metadatas[0].map((meta, index) => {
            const source = meta.source?.toString().toLowerCase() || '';
            return simpleNames.some(name => source.includes(name.toLowerCase())) ? index : -1;
          }).filter(i => i !== -1);

          // 根据匹配的索引过滤所有结果
          results.ids[0] = matchedIndices.map(i => results.ids[0][i]);
          results.metadatas[0] = matchedIndices.map(i => results.metadatas[0][i]);
          results.documents[0] = matchedIndices.map(i => results.documents[0][i]);
          results.distances[0] = matchedIndices.map(i => results.distances[0][i]);
          console.log(`其中有 ${matchedIndices.length} 条与 ${simpleNames.join(', ')} 相关的消息`);
        }
      } catch (error) {
        console.error('简单向量查询也失败了:', error);
      }
    }

    // 返回查询结果
    return {
      question: userQuestion,
      results: {
        ids: results.ids[0] || [],
        documents: results.documents[0] || [],
        metadatas: results.metadatas[0] || [],
        distances: results.distances[0] || []
      }
    };
  } catch (error) {
    console.error('自然语言查询失败:', error);
    return null;
  }
}

// 获取所有已知的人名
async function getAllKnownPeople() {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法获取已知人名');
    return [];
  }
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }

    // 获取所有消息的元数据
    const allMessages = await messageCollection.get();

    // 提取所有来源（发送者）
    const sources = new Set();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach(metadata => {
        if (metadata.source) {
          sources.add(String(metadata.source));
        }
      });
    }

    // 提取所有提到的人物
    const mentionedPeople = new Set();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach(metadata => {
        if (metadata.people) {
          try {
            const people = JSON.parse(String(metadata.people));
            if (Array.isArray(people)) {
              people.forEach(person => mentionedPeople.add(person));
            }
          } catch (e) {
            console.error('解析人物数据失败:', e);
          }
        }
      });
    }

    // 合并所有人名
    return Array.from(new Set([...Array.from(sources), ...Array.from(mentionedPeople)]));
  } catch (error) {
    console.error('获取已知人名失败:', error);
    return [];
  }
}

// 模糊匹配人名
function fuzzyMatchPerson(partialName, knownPeople) {
  if (!partialName || !knownPeople || knownPeople.length === 0) {
    return null;
  }

  // 转换为小写进行比较
  const lowerPartialName = partialName.toLowerCase();

  // 1. 精确匹配（忽略大小写）
  const exactMatch = knownPeople.find(person => person.toLowerCase() === lowerPartialName);
  if (exactMatch) return exactMatch;

  // 2. 开头匹配（例如 "Nelson" 匹配 "Nelson Wu"）
  const startsWithMatch = knownPeople.find(person => person.toLowerCase().startsWith(lowerPartialName));
  if (startsWithMatch) return startsWithMatch;

  // 3. 包含匹配（例如 "Wu" 匹配 "Nelson Wu"）
  const containsMatch = knownPeople.find(person => person.toLowerCase().includes(lowerPartialName));
  if (containsMatch) return containsMatch;

  // 4. 分词匹配（例如 "nelson" 匹配 "Nelson Wu"）
  const wordMatch = knownPeople.find(person => {
    const words = person.toLowerCase().split(/\s+/);
    return words.some(word => word === lowerPartialName);
  });
  if (wordMatch) return wordMatch;

  // 5. 首字母匹配（例如 "NW" 匹配 "Nelson Wu"）
  if (lowerPartialName.length >= 2) {
    const initialsMatch = knownPeople.find(person => {
      const initials = person.split(/\s+/).map(word => word[0]?.toLowerCase()).join('');
      return initials === lowerPartialName;
    });
    if (initialsMatch) return initialsMatch;
  }

  // 没有找到匹配
  return null;
}

// 获取所有已知的项目
async function getAllKnownProjects() {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法获取已知项目');
    return [];
  }
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }

    // 获取所有消息的元数据
    const allMessages = await messageCollection.get();

    // 提取所有项目
    const projects = new Set();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach(metadata => {
        if (metadata.projects) {
          try {
            const projectsList = JSON.parse(String(metadata.projects));
            if (Array.isArray(projectsList)) {
              projectsList.forEach(project => projects.add(project));
            }
          } catch (e) {
            console.error('解析项目数据失败:', e);
          }
        }
      });
    }
    return Array.from(projects);
  } catch (error) {
    console.error('获取已知项目失败:', error);
    return [];
  }
}

// 获取所有已知的主题
async function getAllKnownTopics() {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法获取已知主题');
    return [];
  }
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }

    // 获取所有消息的元数据
    const allMessages = await messageCollection.get();

    // 提取所有主题
    const topics = new Set();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach(metadata => {
        if (metadata.topics) {
          try {
            const topicsList = JSON.parse(String(metadata.topics));
            if (Array.isArray(topicsList)) {
              topicsList.forEach(topic => topics.add(topic));
            }
          } catch (e) {
            console.error('解析主题数据失败:', e);
          }
        }
      });
    }
    return Array.from(topics);
  } catch (error) {
    console.error('获取已知主题失败:', error);
    return [];
  }
}

// 模糊匹配项目或主题
function fuzzyMatchEntityName(partialName, knownNames) {
  if (!partialName || !knownNames || knownNames.length === 0) {
    return [];
  }

  // 转换为小写进行比较
  const lowerPartialName = partialName.toLowerCase();
  const matches = [];

  // 1. 精确匹配（忽略大小写）
  const exactMatches = knownNames.filter(name => name.toLowerCase() === lowerPartialName);
  matches.push(...exactMatches);

  // 如果找到精确匹配，直接返回
  if (matches.length > 0) return matches;

  // 2. 开头匹配（例如 "AI note" 匹配 "AI note 相关的规划进度"）
  const startsWithMatches = knownNames.filter(name => name.toLowerCase().startsWith(lowerPartialName));
  matches.push(...startsWithMatches);

  // 3. 包含匹配（例如 "note" 匹配 "AI note 相关的规划进度"）
  const containsMatches = knownNames.filter(name => name.toLowerCase().includes(lowerPartialName) && !matches.includes(name) // 避免重复
  );
  matches.push(...containsMatches);

  // 4. 词语匹配（例如 "AI" 和 "note" 都匹配 "AI note 相关的规划进度"）
  const words = lowerPartialName.split(/\s+/);
  if (words.length > 1) {
    const wordMatches = knownNames.filter(name => {
      const nameWords = name.toLowerCase().split(/\s+/);
      return words.every(word => nameWords.some(nameWord => nameWord.includes(word))) && !matches.includes(name); // 避免重复
    });
    matches.push(...wordMatches);
  }
  return matches;
}

/***/ }),

/***/ "./node_modules/base64-js/index.js":
/*!*****************************************!*\
  !*** ./node_modules/base64-js/index.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}


/***/ }),

/***/ "./node_modules/buffer/index.js":
/*!**************************************!*\
  !*** ./node_modules/buffer/index.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */



const base64 = __webpack_require__(/*! base64-js */ "./node_modules/base64-js/index.js")
const ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js")
const customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

const K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    const arr = new Uint8Array(1)
    const proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  const buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof SharedArrayBuffer !== 'undefined' &&
      (isInstance(value, SharedArrayBuffer) ||
      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  const valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  const b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpreted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  const length = byteLength(string, encoding) | 0
  let buf = createBuffer(length)

  const actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0
  const buf = createBuffer(length)
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayView (arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    const copy = new Uint8Array(arrayView)
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  }
  return fromArrayLike(arrayView)
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  let buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    const len = checked(obj.length) | 0
    const buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  let x = a.length
  let y = b.length

  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  let i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  const buffer = Buffer.allocUnsafe(length)
  let pos = 0
  for (i = 0; i < list.length; ++i) {
    let buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      if (pos + buf.length > buffer.length) {
        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)
        buf.copy(buffer, pos)
      } else {
        Uint8Array.prototype.set.call(
          buffer,
          buf,
          pos
        )
      }
    } else if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    } else {
      buf.copy(buffer, pos)
    }
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  const len = string.length
  const mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  let loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  const i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  const len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  const len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  const len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  const length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  let str = ''
  const max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  let x = thisEnd - thisStart
  let y = end - start
  const len = Math.min(x, y)

  const thisCopy = this.slice(thisStart, thisEnd)
  const targetCopy = target.slice(start, end)

  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  let indexSize = 1
  let arrLength = arr.length
  let valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  let i
  if (dir) {
    let foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      let found = true
      for (let j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  const remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  const strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  let i
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  const remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
      case 'latin1':
      case 'binary':
        return asciiWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  const res = []

  let i = start
  while (i < end) {
    const firstByte = buf[i]
    let codePoint = null
    let bytesPerSequence = (firstByte > 0xEF)
      ? 4
      : (firstByte > 0xDF)
          ? 3
          : (firstByte > 0xBF)
              ? 2
              : 1

    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  const len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  let res = ''
  let i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  const len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  let out = ''
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  const bytes = buf.slice(start, end)
  let res = ''
  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  const len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  const newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUintLE =
Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUintBE =
Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  let val = this[offset + --byteLength]
  let mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUint8 =
Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUint16LE =
Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUint16BE =
Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUint32LE =
Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUint32BE =
Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const lo = first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24

  const hi = this[++offset] +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    last * 2 ** 24

  return BigInt(lo) + (BigInt(hi) << BigInt(32))
})

Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const hi = first * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  const lo = this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last

  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
})

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let i = byteLength
  let mul = 1
  let val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = this[offset + 4] +
    this[offset + 5] * 2 ** 8 +
    this[offset + 6] * 2 ** 16 +
    (last << 24) // Overflow

  return (BigInt(val) << BigInt(32)) +
    BigInt(first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24)
})

Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = (first << 24) + // Overflow
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  return (BigInt(val) << BigInt(32)) +
    BigInt(this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last)
})

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUintLE =
Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let mul = 1
  let i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUintBE =
Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let i = byteLength - 1
  let mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUint8 =
Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUint16LE =
Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUint16BE =
Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUint32LE =
Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUint32BE =
Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function wrtBigUInt64LE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  return offset
}

function wrtBigUInt64BE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset + 7] = lo
  lo = lo >> 8
  buf[offset + 6] = lo
  lo = lo >> 8
  buf[offset + 5] = lo
  lo = lo >> 8
  buf[offset + 4] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset + 3] = hi
  hi = hi >> 8
  buf[offset + 2] = hi
  hi = hi >> 8
  buf[offset + 1] = hi
  hi = hi >> 8
  buf[offset] = hi
  return offset + 8
}

Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = 0
  let mul = 1
  let sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = byteLength - 1
  let mul = 1
  let sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  const len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      const code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  let i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    const bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    const len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// CUSTOM ERRORS
// =============

// Simplified versions from Node, changed for Buffer-only usage
const errors = {}
function E (sym, getMessage, Base) {
  errors[sym] = class NodeError extends Base {
    constructor () {
      super()

      Object.defineProperty(this, 'message', {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      })

      // Add the error code to the name to include it in the stack trace.
      this.name = `${this.name} [${sym}]`
      // Access the stack to generate the error message including the error code
      // from the name.
      this.stack // eslint-disable-line no-unused-expressions
      // Reset the name to the actual name.
      delete this.name
    }

    get code () {
      return sym
    }

    set code (value) {
      Object.defineProperty(this, 'code', {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      })
    }

    toString () {
      return `${this.name} [${sym}]: ${this.message}`
    }
  }
}

E('ERR_BUFFER_OUT_OF_BOUNDS',
  function (name) {
    if (name) {
      return `${name} is outside of buffer bounds`
    }

    return 'Attempt to access memory outside buffer bounds'
  }, RangeError)
E('ERR_INVALID_ARG_TYPE',
  function (name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
  }, TypeError)
E('ERR_OUT_OF_RANGE',
  function (str, range, input) {
    let msg = `The value of "${str}" is out of range.`
    let received = input
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input))
    } else if (typeof input === 'bigint') {
      received = String(input)
      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
        received = addNumericalSeparator(received)
      }
      received += 'n'
    }
    msg += ` It must be ${range}. Received ${received}`
    return msg
  }, RangeError)

function addNumericalSeparator (val) {
  let res = ''
  let i = val.length
  const start = val[0] === '-' ? 1 : 0
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`
  }
  return `${val.slice(0, i)}${res}`
}

// CHECK FUNCTIONS
// ===============

function checkBounds (buf, offset, byteLength) {
  validateNumber(offset, 'offset')
  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
    boundsError(offset, buf.length - (byteLength + 1))
  }
}

function checkIntBI (value, min, max, buf, offset, byteLength) {
  if (value > max || value < min) {
    const n = typeof min === 'bigint' ? 'n' : ''
    let range
    if (byteLength > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`
      } else {
        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
                `${(byteLength + 1) * 8 - 1}${n}`
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`
    }
    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
  }
  checkBounds(buf, offset, byteLength)
}

function validateNumber (value, name) {
  if (typeof value !== 'number') {
    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
  }
}

function boundsError (value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type)
    throw new errors.ERR_OUT_OF_RANGE(type || 'offset', 'an integer', value)
  }

  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
  }

  throw new errors.ERR_OUT_OF_RANGE(type || 'offset',
                                    `>= ${type ? 1 : 0} and <= ${length}`,
                                    value)
}

// HELPER FUNCTIONS
// ================

const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  let codePoint
  const length = string.length
  let leadSurrogate = null
  const bytes = []

  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  let c, hi, lo
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  let i
  for (i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef'
  const table = new Array(256)
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

// Return not function with Error if BigInt not supported
function defineBigIntMethod (fn) {
  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
}

function BufferBigIntNotDefined () {
  throw new Error('BigInt not supported')
}


/***/ }),

/***/ "./node_modules/ieee754/index.js":
/*!***************************************!*\
  !*** ./node_modules/ieee754/index.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, exports) => {

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}


/***/ }),

/***/ "./node_modules/isomorphic-fetch/fetch-npm-browserify.js":
/*!***************************************************************!*\
  !*** ./node_modules/isomorphic-fetch/fetch-npm-browserify.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
__webpack_require__(/*! whatwg-fetch */ "./node_modules/whatwg-fetch/fetch.js");
module.exports = self.fetch.bind(self);


/***/ }),

/***/ "./node_modules/whatwg-fetch/fetch.js":
/*!********************************************!*\
  !*** ./node_modules/whatwg-fetch/fetch.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DOMException: () => (/* binding */ DOMException),
/* harmony export */   Headers: () => (/* binding */ Headers),
/* harmony export */   Request: () => (/* binding */ Request),
/* harmony export */   Response: () => (/* binding */ Response),
/* harmony export */   fetch: () => (/* binding */ fetch)
/* harmony export */ });
/* eslint-disable no-prototype-builtins */
var g =
  (typeof globalThis !== 'undefined' && globalThis) ||
  (typeof self !== 'undefined' && self) ||
  // eslint-disable-next-line no-undef
  (typeof __webpack_require__.g !== 'undefined' && __webpack_require__.g) ||
  {}

var support = {
  searchParams: 'URLSearchParams' in g,
  iterable: 'Symbol' in g && 'iterator' in Symbol,
  blob:
    'FileReader' in g &&
    'Blob' in g &&
    (function() {
      try {
        new Blob()
        return true
      } catch (e) {
        return false
      }
    })(),
  formData: 'FormData' in g,
  arrayBuffer: 'ArrayBuffer' in g
}

function isDataView(obj) {
  return obj && DataView.prototype.isPrototypeOf(obj)
}

if (support.arrayBuffer) {
  var viewClasses = [
    '[object Int8Array]',
    '[object Uint8Array]',
    '[object Uint8ClampedArray]',
    '[object Int16Array]',
    '[object Uint16Array]',
    '[object Int32Array]',
    '[object Uint32Array]',
    '[object Float32Array]',
    '[object Float64Array]'
  ]

  var isArrayBufferView =
    ArrayBuffer.isView ||
    function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    name = String(name)
  }
  if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
    throw new TypeError('Invalid character in header field name: "' + name + '"')
  }
  return name.toLowerCase()
}

function normalizeValue(value) {
  if (typeof value !== 'string') {
    value = String(value)
  }
  return value
}

// Build a destructive iterator for the value list
function iteratorFor(items) {
  var iterator = {
    next: function() {
      var value = items.shift()
      return {done: value === undefined, value: value}
    }
  }

  if (support.iterable) {
    iterator[Symbol.iterator] = function() {
      return iterator
    }
  }

  return iterator
}

function Headers(headers) {
  this.map = {}

  if (headers instanceof Headers) {
    headers.forEach(function(value, name) {
      this.append(name, value)
    }, this)
  } else if (Array.isArray(headers)) {
    headers.forEach(function(header) {
      if (header.length != 2) {
        throw new TypeError('Headers constructor: expected name/value pair to be length 2, found' + header.length)
      }
      this.append(header[0], header[1])
    }, this)
  } else if (headers) {
    Object.getOwnPropertyNames(headers).forEach(function(name) {
      this.append(name, headers[name])
    }, this)
  }
}

Headers.prototype.append = function(name, value) {
  name = normalizeName(name)
  value = normalizeValue(value)
  var oldValue = this.map[name]
  this.map[name] = oldValue ? oldValue + ', ' + value : value
}

Headers.prototype['delete'] = function(name) {
  delete this.map[normalizeName(name)]
}

Headers.prototype.get = function(name) {
  name = normalizeName(name)
  return this.has(name) ? this.map[name] : null
}

Headers.prototype.has = function(name) {
  return this.map.hasOwnProperty(normalizeName(name))
}

Headers.prototype.set = function(name, value) {
  this.map[normalizeName(name)] = normalizeValue(value)
}

Headers.prototype.forEach = function(callback, thisArg) {
  for (var name in this.map) {
    if (this.map.hasOwnProperty(name)) {
      callback.call(thisArg, this.map[name], name, this)
    }
  }
}

Headers.prototype.keys = function() {
  var items = []
  this.forEach(function(value, name) {
    items.push(name)
  })
  return iteratorFor(items)
}

Headers.prototype.values = function() {
  var items = []
  this.forEach(function(value) {
    items.push(value)
  })
  return iteratorFor(items)
}

Headers.prototype.entries = function() {
  var items = []
  this.forEach(function(value, name) {
    items.push([name, value])
  })
  return iteratorFor(items)
}

if (support.iterable) {
  Headers.prototype[Symbol.iterator] = Headers.prototype.entries
}

function consumed(body) {
  if (body._noBody) return
  if (body.bodyUsed) {
    return Promise.reject(new TypeError('Already read'))
  }
  body.bodyUsed = true
}

function fileReaderReady(reader) {
  return new Promise(function(resolve, reject) {
    reader.onload = function() {
      resolve(reader.result)
    }
    reader.onerror = function() {
      reject(reader.error)
    }
  })
}

function readBlobAsArrayBuffer(blob) {
  var reader = new FileReader()
  var promise = fileReaderReady(reader)
  reader.readAsArrayBuffer(blob)
  return promise
}

function readBlobAsText(blob) {
  var reader = new FileReader()
  var promise = fileReaderReady(reader)
  var match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type)
  var encoding = match ? match[1] : 'utf-8'
  reader.readAsText(blob, encoding)
  return promise
}

function readArrayBufferAsText(buf) {
  var view = new Uint8Array(buf)
  var chars = new Array(view.length)

  for (var i = 0; i < view.length; i++) {
    chars[i] = String.fromCharCode(view[i])
  }
  return chars.join('')
}

function bufferClone(buf) {
  if (buf.slice) {
    return buf.slice(0)
  } else {
    var view = new Uint8Array(buf.byteLength)
    view.set(new Uint8Array(buf))
    return view.buffer
  }
}

function Body() {
  this.bodyUsed = false

  this._initBody = function(body) {
    /*
      fetch-mock wraps the Response object in an ES6 Proxy to
      provide useful test harness features such as flush. However, on
      ES5 browsers without fetch or Proxy support pollyfills must be used;
      the proxy-pollyfill is unable to proxy an attribute unless it exists
      on the object before the Proxy is created. This change ensures
      Response.bodyUsed exists on the instance, while maintaining the
      semantic of setting Request.bodyUsed in the constructor before
      _initBody is called.
    */
    // eslint-disable-next-line no-self-assign
    this.bodyUsed = this.bodyUsed
    this._bodyInit = body
    if (!body) {
      this._noBody = true;
      this._bodyText = ''
    } else if (typeof body === 'string') {
      this._bodyText = body
    } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
      this._bodyBlob = body
    } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
      this._bodyFormData = body
    } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
      this._bodyText = body.toString()
    } else if (support.arrayBuffer && support.blob && isDataView(body)) {
      this._bodyArrayBuffer = bufferClone(body.buffer)
      // IE 10-11 can't handle a DataView body.
      this._bodyInit = new Blob([this._bodyArrayBuffer])
    } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
      this._bodyArrayBuffer = bufferClone(body)
    } else {
      this._bodyText = body = Object.prototype.toString.call(body)
    }

    if (!this.headers.get('content-type')) {
      if (typeof body === 'string') {
        this.headers.set('content-type', 'text/plain;charset=UTF-8')
      } else if (this._bodyBlob && this._bodyBlob.type) {
        this.headers.set('content-type', this._bodyBlob.type)
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
      }
    }
  }

  if (support.blob) {
    this.blob = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return Promise.resolve(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(new Blob([this._bodyArrayBuffer]))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as blob')
      } else {
        return Promise.resolve(new Blob([this._bodyText]))
      }
    }
  }

  this.arrayBuffer = function() {
    if (this._bodyArrayBuffer) {
      var isConsumed = consumed(this)
      if (isConsumed) {
        return isConsumed
      } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
        return Promise.resolve(
          this._bodyArrayBuffer.buffer.slice(
            this._bodyArrayBuffer.byteOffset,
            this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
          )
        )
      } else {
        return Promise.resolve(this._bodyArrayBuffer)
      }
    } else if (support.blob) {
      return this.blob().then(readBlobAsArrayBuffer)
    } else {
      throw new Error('could not read as ArrayBuffer')
    }
  }

  this.text = function() {
    var rejected = consumed(this)
    if (rejected) {
      return rejected
    }

    if (this._bodyBlob) {
      return readBlobAsText(this._bodyBlob)
    } else if (this._bodyArrayBuffer) {
      return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
    } else if (this._bodyFormData) {
      throw new Error('could not read FormData body as text')
    } else {
      return Promise.resolve(this._bodyText)
    }
  }

  if (support.formData) {
    this.formData = function() {
      return this.text().then(decode)
    }
  }

  this.json = function() {
    return this.text().then(JSON.parse)
  }

  return this
}

// HTTP methods whose capitalization should be normalized
var methods = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']

function normalizeMethod(method) {
  var upcased = method.toUpperCase()
  return methods.indexOf(upcased) > -1 ? upcased : method
}

function Request(input, options) {
  if (!(this instanceof Request)) {
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
  }

  options = options || {}
  var body = options.body

  if (input instanceof Request) {
    if (input.bodyUsed) {
      throw new TypeError('Already read')
    }
    this.url = input.url
    this.credentials = input.credentials
    if (!options.headers) {
      this.headers = new Headers(input.headers)
    }
    this.method = input.method
    this.mode = input.mode
    this.signal = input.signal
    if (!body && input._bodyInit != null) {
      body = input._bodyInit
      input.bodyUsed = true
    }
  } else {
    this.url = String(input)
  }

  this.credentials = options.credentials || this.credentials || 'same-origin'
  if (options.headers || !this.headers) {
    this.headers = new Headers(options.headers)
  }
  this.method = normalizeMethod(options.method || this.method || 'GET')
  this.mode = options.mode || this.mode || null
  this.signal = options.signal || this.signal || (function () {
    if ('AbortController' in g) {
      var ctrl = new AbortController();
      return ctrl.signal;
    }
  }());
  this.referrer = null

  if ((this.method === 'GET' || this.method === 'HEAD') && body) {
    throw new TypeError('Body not allowed for GET or HEAD requests')
  }
  this._initBody(body)

  if (this.method === 'GET' || this.method === 'HEAD') {
    if (options.cache === 'no-store' || options.cache === 'no-cache') {
      // Search for a '_' parameter in the query string
      var reParamSearch = /([?&])_=[^&]*/
      if (reParamSearch.test(this.url)) {
        // If it already exists then set the value with the current time
        this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime())
      } else {
        // Otherwise add a new '_' parameter to the end with the current time
        var reQueryString = /\?/
        this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime()
      }
    }
  }
}

Request.prototype.clone = function() {
  return new Request(this, {body: this._bodyInit})
}

function decode(body) {
  var form = new FormData()
  body
    .trim()
    .split('&')
    .forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
  return form
}

function parseHeaders(rawHeaders) {
  var headers = new Headers()
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
  var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ')
  // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
  // https://github.com/github/fetch/issues/748
  // https://github.com/zloirock/core-js/issues/751
  preProcessedHeaders
    .split('\r')
    .map(function(header) {
      return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
    })
    .forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        try {
          headers.append(key, value)
        } catch (error) {
          console.warn('Response ' + error.message)
        }
      }
    })
  return headers
}

Body.call(Request.prototype)

function Response(bodyInit, options) {
  if (!(this instanceof Response)) {
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
  }
  if (!options) {
    options = {}
  }

  this.type = 'default'
  this.status = options.status === undefined ? 200 : options.status
  if (this.status < 200 || this.status > 599) {
    throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].")
  }
  this.ok = this.status >= 200 && this.status < 300
  this.statusText = options.statusText === undefined ? '' : '' + options.statusText
  this.headers = new Headers(options.headers)
  this.url = options.url || ''
  this._initBody(bodyInit)
}

Body.call(Response.prototype)

Response.prototype.clone = function() {
  return new Response(this._bodyInit, {
    status: this.status,
    statusText: this.statusText,
    headers: new Headers(this.headers),
    url: this.url
  })
}

Response.error = function() {
  var response = new Response(null, {status: 200, statusText: ''})
  response.ok = false
  response.status = 0
  response.type = 'error'
  return response
}

var redirectStatuses = [301, 302, 303, 307, 308]

Response.redirect = function(url, status) {
  if (redirectStatuses.indexOf(status) === -1) {
    throw new RangeError('Invalid status code')
  }

  return new Response(null, {status: status, headers: {location: url}})
}

var DOMException = g.DOMException
try {
  new DOMException()
} catch (err) {
  DOMException = function(message, name) {
    this.message = message
    this.name = name
    var error = Error(message)
    this.stack = error.stack
  }
  DOMException.prototype = Object.create(Error.prototype)
  DOMException.prototype.constructor = DOMException
}

function fetch(input, init) {
  return new Promise(function(resolve, reject) {
    var request = new Request(input, init)

    if (request.signal && request.signal.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'))
    }

    var xhr = new XMLHttpRequest()

    function abortXhr() {
      xhr.abort()
    }

    xhr.onload = function() {
      var options = {
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
      }
      // This check if specifically for when a user fetches a file locally from the file system
      // Only if the status is out of a normal range
      if (request.url.indexOf('file://') === 0 && (xhr.status < 200 || xhr.status > 599)) {
        options.status = 200;
      } else {
        options.status = xhr.status;
      }
      options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
      var body = 'response' in xhr ? xhr.response : xhr.responseText
      setTimeout(function() {
        resolve(new Response(body, options))
      }, 0)
    }

    xhr.onerror = function() {
      setTimeout(function() {
        reject(new TypeError('Network request failed'))
      }, 0)
    }

    xhr.ontimeout = function() {
      setTimeout(function() {
        reject(new TypeError('Network request timed out'))
      }, 0)
    }

    xhr.onabort = function() {
      setTimeout(function() {
        reject(new DOMException('Aborted', 'AbortError'))
      }, 0)
    }

    function fixUrl(url) {
      try {
        return url === '' && g.location.href ? g.location.href : url
      } catch (e) {
        return url
      }
    }

    xhr.open(request.method, fixUrl(request.url), true)

    if (request.credentials === 'include') {
      xhr.withCredentials = true
    } else if (request.credentials === 'omit') {
      xhr.withCredentials = false
    }

    if ('responseType' in xhr) {
      if (support.blob) {
        xhr.responseType = 'blob'
      } else if (
        support.arrayBuffer
      ) {
        xhr.responseType = 'arraybuffer'
      }
    }

    if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers || (g.Headers && init.headers instanceof g.Headers))) {
      var names = [];
      Object.getOwnPropertyNames(init.headers).forEach(function(name) {
        names.push(normalizeName(name))
        xhr.setRequestHeader(name, normalizeValue(init.headers[name]))
      })
      request.headers.forEach(function(value, name) {
        if (names.indexOf(name) === -1) {
          xhr.setRequestHeader(name, value)
        }
      })
    } else {
      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })
    }

    if (request.signal) {
      request.signal.addEventListener('abort', abortXhr)

      xhr.onreadystatechange = function() {
        // DONE (success or failure)
        if (xhr.readyState === 4) {
          request.signal.removeEventListener('abort', abortXhr)
        }
      }
    }

    xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
  })
}

fetch.polyfill = true

if (!g.fetch) {
  g.fetch = fetch
  g.Headers = Headers
  g.Request = Request
  g.Response = Response
}


/***/ }),

/***/ "https://unpkg.com/chromadb-default-embed@2.14.0":
/*!******************************************************************!*\
  !*** external "https://unpkg.com/chromadb-default-embed@2.14.0" ***!
  \******************************************************************/
/***/ ((module) => {

"use strict";
module.exports = import("https://unpkg.com/chromadb-default-embed@2.14.0");;

/***/ }),

/***/ "./node_modules/chromadb/dist/chromadb.mjs":
/*!*************************************************!*\
  !*** ./node_modules/chromadb/dist/chromadb.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AdminClient: () => (/* binding */ AdminClient),
/* harmony export */   ChromaClient: () => (/* binding */ ChromaClient),
/* harmony export */   ChromaClientError: () => (/* binding */ ChromaClientError),
/* harmony export */   ChromaConnectionError: () => (/* binding */ ChromaConnectionError),
/* harmony export */   ChromaError: () => (/* binding */ ChromaError),
/* harmony export */   ChromaForbiddenError: () => (/* binding */ ChromaForbiddenError),
/* harmony export */   ChromaNotFoundError: () => (/* binding */ ChromaNotFoundError),
/* harmony export */   ChromaServerError: () => (/* binding */ ChromaServerError),
/* harmony export */   ChromaUnauthorizedError: () => (/* binding */ ChromaUnauthorizedError),
/* harmony export */   ChromaUniqueError: () => (/* binding */ ChromaUniqueError),
/* harmony export */   ChromaValueError: () => (/* binding */ ChromaValueError),
/* harmony export */   CloudClient: () => (/* binding */ CloudClient),
/* harmony export */   CohereEmbeddingFunction: () => (/* binding */ CohereEmbeddingFunction),
/* harmony export */   Collection: () => (/* binding */ Collection),
/* harmony export */   DefaultEmbeddingFunction: () => (/* binding */ DefaultEmbeddingFunction),
/* harmony export */   GoogleGenerativeAiEmbeddingFunction: () => (/* binding */ GoogleGenerativeAiEmbeddingFunction),
/* harmony export */   HuggingFaceEmbeddingServerFunction: () => (/* binding */ HuggingFaceEmbeddingServerFunction),
/* harmony export */   IncludeEnum: () => (/* binding */ IncludeEnum),
/* harmony export */   InvalidArgumentError: () => (/* binding */ InvalidArgumentError),
/* harmony export */   InvalidCollectionError: () => (/* binding */ InvalidCollectionError),
/* harmony export */   JinaEmbeddingFunction: () => (/* binding */ JinaEmbeddingFunction),
/* harmony export */   OllamaEmbeddingFunction: () => (/* binding */ OllamaEmbeddingFunction),
/* harmony export */   OpenAIEmbeddingFunction: () => (/* binding */ OpenAIEmbeddingFunction),
/* harmony export */   TransformersEmbeddingFunction: () => (/* binding */ TransformersEmbeddingFunction),
/* harmony export */   createErrorByType: () => (/* binding */ createErrorByType)
/* harmony export */ });
/* harmony import */ var isomorphic_fetch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! isomorphic-fetch */ "./node_modules/isomorphic-fetch/fetch-npm-browserify.js");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};

// src/generated/runtime.ts

var defaultFetch = fetch;
var BASE_PATH = "";
var BaseAPI = class {
  constructor(configuration, basePath = BASE_PATH, fetch2 = defaultFetch) {
    this.basePath = basePath;
    this.fetch = fetch2;
    if (configuration) {
      this.configuration = configuration;
      this.basePath = configuration.basePath || this.basePath;
    }
  }
};
var RequiredError = class _RequiredError extends Error {
  constructor(field, msg) {
    super(msg);
    this.field = field;
    Object.setPrototypeOf(this, _RequiredError.prototype);
    this.name = "RequiredError";
  }
};

// src/generated/api.ts
var ApiApiFetchParamCreator = function(configuration) {
  return {
    /**
     * @summary Add
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.AddRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    add(tenant, databaseName, collectionId, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling add.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling add.");
      }
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling add.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling add.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/add`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Add V1
     * @param {string} collectionId
     * @param {Api.AddV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    addV1(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling addV1.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling addV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/add`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Delete
     * @param {string} collectionId
     * @param {string} tenant
     * @param {string} databaseName
     * @param {Api.ADeleteRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    aDelete(collectionId, tenant, databaseName, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling aDelete.");
      }
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling aDelete.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling aDelete.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling aDelete.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/delete`.replace("{collection_id}", encodeURIComponent(String(collectionId))).replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get
     * @param {string} collectionId
     * @param {string} tenant
     * @param {string} databaseName
     * @param {Api.AGetRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    aGet(collectionId, tenant, databaseName, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling aGet.");
      }
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling aGet.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling aGet.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling aGet.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/get`.replace("{collection_id}", encodeURIComponent(String(collectionId))).replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Count
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    count(tenant, databaseName, collectionId, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling count.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling count.");
      }
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling count.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/count`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Count Collections
     * @param {string} tenant
     * @param {string} databaseName
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    countCollections(tenant, databaseName, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling countCollections.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling countCollections.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections_count`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Count Collections V1
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    countCollectionsV1(tenant, database, options = {}) {
      let localVarPath = `/api/v1/count_collections`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      if (database !== void 0) {
        localVarQueryParameter.append("database", String(database));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Count V1
     * @param {string} collectionId
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    countV1(collectionId, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling countV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/count`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Create Collection
     * @param {string} tenant
     * @param {string} databaseName
     * @param {Api.CreateCollectionRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createCollection(tenant, databaseName, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling createCollection.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling createCollection.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling createCollection.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Create Collection V1
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {Api.CreateCollectionV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createCollectionV1(tenant, database, request, options = {}) {
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling createCollectionV1.");
      }
      let localVarPath = `/api/v1/collections`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      if (database !== void 0) {
        localVarQueryParameter.append("database", String(database));
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Create Database
     * @param {string} tenant
     * @param {Api.CreateDatabaseRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createDatabase(tenant, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling createDatabase.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling createDatabase.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases`.replace("{tenant}", encodeURIComponent(String(tenant)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Create Database V1
     * @param {string} [tenant]
     * @param {Api.CreateDatabaseV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createDatabaseV1(tenant, request, options = {}) {
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling createDatabaseV1.");
      }
      let localVarPath = `/api/v1/databases`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Create Tenant
     * @param {Api.CreateTenantRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createTenant(request, options = {}) {
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling createTenant.");
      }
      let localVarPath = `/api/v2/tenants`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Create Tenant V1
     * @param {Api.CreateTenantV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createTenantV1(request, options = {}) {
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling createTenantV1.");
      }
      let localVarPath = `/api/v1/tenants`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Delete Collection
     * @param {string} collectionName
     * @param {string} tenant
     * @param {string} databaseName
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteCollection(collectionName, tenant, databaseName, options = {}) {
      if (collectionName === null || collectionName === void 0) {
        throw new RequiredError("collectionName", "Required parameter collectionName was null or undefined when calling deleteCollection.");
      }
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling deleteCollection.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling deleteCollection.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_name}`.replace("{collection_name}", encodeURIComponent(String(collectionName))).replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "DELETE" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Delete Collection V1
     * @param {string} collectionName
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteCollectionV1(collectionName, tenant, database, options = {}) {
      if (collectionName === null || collectionName === void 0) {
        throw new RequiredError("collectionName", "Required parameter collectionName was null or undefined when calling deleteCollectionV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_name}`.replace("{collection_name}", encodeURIComponent(String(collectionName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "DELETE" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      if (database !== void 0) {
        localVarQueryParameter.append("database", String(database));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Delete Database
     * @param {string} databaseName
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteDatabase(databaseName, tenant, options = {}) {
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling deleteDatabase.");
      }
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling deleteDatabase.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}`.replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{tenant}", encodeURIComponent(String(tenant)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "DELETE" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Delete V1
     * @param {string} collectionId
     * @param {Api.DeleteV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteV1(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling deleteV1.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling deleteV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/delete`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Collection
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionName
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getCollection(tenant, databaseName, collectionName, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling getCollection.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling getCollection.");
      }
      if (collectionName === null || collectionName === void 0) {
        throw new RequiredError("collectionName", "Required parameter collectionName was null or undefined when calling getCollection.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_name}`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_name}", encodeURIComponent(String(collectionName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Collection V1
     * @param {string} collectionName
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getCollectionV1(collectionName, tenant, database, options = {}) {
      if (collectionName === null || collectionName === void 0) {
        throw new RequiredError("collectionName", "Required parameter collectionName was null or undefined when calling getCollectionV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_name}`.replace("{collection_name}", encodeURIComponent(String(collectionName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      if (database !== void 0) {
        localVarQueryParameter.append("database", String(database));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Database
     * @param {string} databaseName
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getDatabase(databaseName, tenant, options = {}) {
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling getDatabase.");
      }
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling getDatabase.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}`.replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{tenant}", encodeURIComponent(String(tenant)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Database V1
     * @param {string} database
     * @param {string} [tenant]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getDatabaseV1(database, tenant, options = {}) {
      if (database === null || database === void 0) {
        throw new RequiredError("database", "Required parameter database was null or undefined when calling getDatabaseV1.");
      }
      let localVarPath = `/api/v1/databases/{database}`.replace("{database}", encodeURIComponent(String(database)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Nearest Neighbors
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.GetNearestNeighborsRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getNearestNeighbors(tenant, databaseName, collectionId, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling getNearestNeighbors.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling getNearestNeighbors.");
      }
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling getNearestNeighbors.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling getNearestNeighbors.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/query`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Nearest Neighbors V1
     * @param {string} collectionId
     * @param {Api.GetNearestNeighborsV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getNearestNeighborsV1(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling getNearestNeighborsV1.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling getNearestNeighborsV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/query`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Tenant
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getTenant(tenant, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling getTenant.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}`.replace("{tenant}", encodeURIComponent(String(tenant)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get Tenant V1
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getTenantV1(tenant, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling getTenantV1.");
      }
      let localVarPath = `/api/v1/tenants/{tenant}`.replace("{tenant}", encodeURIComponent(String(tenant)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get User Identity
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getUserIdentity(options = {}) {
      let localVarPath = `/api/v2/auth/identity`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Root
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV11(options = {}) {
      let localVarPath = `/api/v1`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Get V1
     * @param {string} collectionId
     * @param {Api.GetV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV12(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling getV12.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling getV12.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/get`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Heartbeat
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV1Heartbeat(options = {}) {
      let localVarPath = `/api/v1/heartbeat`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Pre Flight Checks
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV1PreFlightChecks(options = {}) {
      let localVarPath = `/api/v1/pre-flight-checks`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Version
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV1Version(options = {}) {
      let localVarPath = `/api/v1/version`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Root
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2(options = {}) {
      let localVarPath = `/api/v2`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Heartbeat
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2Heartbeat(options = {}) {
      let localVarPath = `/api/v2/heartbeat`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Pre Flight Checks
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2PreFlightChecks(options = {}) {
      let localVarPath = `/api/v2/pre-flight-checks`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Version
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2Version(options = {}) {
      let localVarPath = `/api/v2/version`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary List Collections
     * @param {string} tenant
     * @param {string} databaseName
     * @param {number | null} [limit]
     * @param {number | null} [offset]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    listCollections(tenant, databaseName, limit, offset, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling listCollections.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling listCollections.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (limit !== void 0) {
        localVarQueryParameter.append("limit", String(limit));
      }
      if (offset !== void 0) {
        localVarQueryParameter.append("offset", String(offset));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary List Collections V1
     * @param {number | null} [limit]
     * @param {number | null} [offset]
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    listCollectionsV1(limit, offset, tenant, database, options = {}) {
      let localVarPath = `/api/v1/collections`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (limit !== void 0) {
        localVarQueryParameter.append("limit", String(limit));
      }
      if (offset !== void 0) {
        localVarQueryParameter.append("offset", String(offset));
      }
      if (tenant !== void 0) {
        localVarQueryParameter.append("tenant", String(tenant));
      }
      if (database !== void 0) {
        localVarQueryParameter.append("database", String(database));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary List Databases
     * @param {string} tenant
     * @param {number | null} [limit]
     * @param {number | null} [offset]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    listDatabases(tenant, limit, offset, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling listDatabases.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases`.replace("{tenant}", encodeURIComponent(String(tenant)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "GET" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      if (limit !== void 0) {
        localVarQueryParameter.append("limit", String(limit));
      }
      if (offset !== void 0) {
        localVarQueryParameter.append("offset", String(offset));
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Reset
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    postV1Reset(options = {}) {
      let localVarPath = `/api/v1/reset`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Reset
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    postV2Reset(options = {}) {
      let localVarPath = `/api/v2/reset`;
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarRequestOptions.headers = localVarHeaderParameter;
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Update
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.UpdateRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    update(tenant, databaseName, collectionId, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling update.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling update.");
      }
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling update.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling update.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/update`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Update Collection
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.UpdateCollectionRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    updateCollection(tenant, databaseName, collectionId, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling updateCollection.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling updateCollection.");
      }
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling updateCollection.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling updateCollection.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "PUT" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Update Collection V1
     * @param {string} collectionId
     * @param {Api.UpdateCollectionV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    updateCollectionV1(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling updateCollectionV1.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling updateCollectionV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "PUT" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Update V1
     * @param {string} collectionId
     * @param {Api.UpdateV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    updateV1(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling updateV1.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling updateV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/update`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Upsert
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.UpsertRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    upsert(tenant, databaseName, collectionId, request, options = {}) {
      if (tenant === null || tenant === void 0) {
        throw new RequiredError("tenant", "Required parameter tenant was null or undefined when calling upsert.");
      }
      if (databaseName === null || databaseName === void 0) {
        throw new RequiredError("databaseName", "Required parameter databaseName was null or undefined when calling upsert.");
      }
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling upsert.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling upsert.");
      }
      let localVarPath = `/api/v2/tenants/{tenant}/databases/{database_name}/collections/{collection_id}/upsert`.replace("{tenant}", encodeURIComponent(String(tenant))).replace("{database_name}", encodeURIComponent(String(databaseName))).replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    },
    /**
     * @summary Upsert V1
     * @param {string} collectionId
     * @param {Api.UpsertV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    upsertV1(collectionId, request, options = {}) {
      if (collectionId === null || collectionId === void 0) {
        throw new RequiredError("collectionId", "Required parameter collectionId was null or undefined when calling upsertV1.");
      }
      if (request === null || request === void 0) {
        throw new RequiredError("request", "Required parameter request was null or undefined when calling upsertV1.");
      }
      let localVarPath = `/api/v1/collections/{collection_id}/upsert`.replace("{collection_id}", encodeURIComponent(String(collectionId)));
      const localVarPathQueryStart = localVarPath.indexOf("?");
      const localVarRequestOptions = Object.assign({ method: "POST" }, options);
      const localVarHeaderParameter = options.headers ? new Headers(options.headers) : new Headers();
      const localVarQueryParameter = new URLSearchParams(localVarPathQueryStart !== -1 ? localVarPath.substring(localVarPathQueryStart + 1) : "");
      if (localVarPathQueryStart !== -1) {
        localVarPath = localVarPath.substring(0, localVarPathQueryStart);
      }
      localVarHeaderParameter.set("Content-Type", "application/json");
      localVarRequestOptions.headers = localVarHeaderParameter;
      if (request !== void 0) {
        localVarRequestOptions.body = JSON.stringify(request || {});
      }
      const localVarQueryParameterString = localVarQueryParameter.toString();
      if (localVarQueryParameterString) {
        localVarPath += "?" + localVarQueryParameterString;
      }
      return {
        url: localVarPath,
        options: localVarRequestOptions
      };
    }
  };
};
var ApiApiFp = function(configuration) {
  return {
    /**
     * @summary Add
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.AddRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    add(tenant, databaseName, collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).add(tenant, databaseName, collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 201) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Add V1
     * @param {string} collectionId
     * @param {Api.AddV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    addV1(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).addV1(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 201) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Delete
     * @param {string} collectionId
     * @param {string} tenant
     * @param {string} databaseName
     * @param {Api.ADeleteRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    aDelete(collectionId, tenant, databaseName, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).aDelete(collectionId, tenant, databaseName, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get
     * @param {string} collectionId
     * @param {string} tenant
     * @param {string} databaseName
     * @param {Api.AGetRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    aGet(collectionId, tenant, databaseName, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).aGet(collectionId, tenant, databaseName, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Count
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    count(tenant, databaseName, collectionId, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).count(tenant, databaseName, collectionId, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Count Collections
     * @param {string} tenant
     * @param {string} databaseName
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    countCollections(tenant, databaseName, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).countCollections(tenant, databaseName, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Count Collections V1
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    countCollectionsV1(tenant, database, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).countCollectionsV1(tenant, database, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Count V1
     * @param {string} collectionId
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    countV1(collectionId, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).countV1(collectionId, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Create Collection
     * @param {string} tenant
     * @param {string} databaseName
     * @param {Api.CreateCollectionRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createCollection(tenant, databaseName, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).createCollection(tenant, databaseName, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Create Collection V1
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {Api.CreateCollectionV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createCollectionV1(tenant, database, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).createCollectionV1(tenant, database, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Create Database
     * @param {string} tenant
     * @param {Api.CreateDatabaseRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createDatabase(tenant, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).createDatabase(tenant, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Create Database V1
     * @param {string} [tenant]
     * @param {Api.CreateDatabaseV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createDatabaseV1(tenant, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).createDatabaseV1(tenant, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Create Tenant
     * @param {Api.CreateTenantRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createTenant(request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).createTenant(request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Create Tenant V1
     * @param {Api.CreateTenantV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    createTenantV1(request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).createTenantV1(request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Delete Collection
     * @param {string} collectionName
     * @param {string} tenant
     * @param {string} databaseName
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteCollection(collectionName, tenant, databaseName, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).deleteCollection(collectionName, tenant, databaseName, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Delete Collection V1
     * @param {string} collectionName
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteCollectionV1(collectionName, tenant, database, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).deleteCollectionV1(collectionName, tenant, database, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Delete Database
     * @param {string} databaseName
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteDatabase(databaseName, tenant, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).deleteDatabase(databaseName, tenant, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Delete V1
     * @param {string} collectionId
     * @param {Api.DeleteV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    deleteV1(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).deleteV1(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Collection
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionName
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getCollection(tenant, databaseName, collectionName, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getCollection(tenant, databaseName, collectionName, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Collection V1
     * @param {string} collectionName
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getCollectionV1(collectionName, tenant, database, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getCollectionV1(collectionName, tenant, database, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Database
     * @param {string} databaseName
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getDatabase(databaseName, tenant, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getDatabase(databaseName, tenant, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Database V1
     * @param {string} database
     * @param {string} [tenant]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getDatabaseV1(database, tenant, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getDatabaseV1(database, tenant, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Nearest Neighbors
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.GetNearestNeighborsRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getNearestNeighbors(tenant, databaseName, collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getNearestNeighbors(tenant, databaseName, collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Nearest Neighbors V1
     * @param {string} collectionId
     * @param {Api.GetNearestNeighborsV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getNearestNeighborsV1(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getNearestNeighborsV1(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Tenant
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getTenant(tenant, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getTenant(tenant, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get Tenant V1
     * @param {string} tenant
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getTenantV1(tenant, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getTenantV1(tenant, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get User Identity
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getUserIdentity(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getUserIdentity(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Root
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV11(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV11(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Get V1
     * @param {string} collectionId
     * @param {Api.GetV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV12(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV12(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Heartbeat
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV1Heartbeat(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV1Heartbeat(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Pre Flight Checks
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV1PreFlightChecks(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV1PreFlightChecks(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Version
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV1Version(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV1Version(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Root
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV2(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Heartbeat
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2Heartbeat(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV2Heartbeat(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Pre Flight Checks
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2PreFlightChecks(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV2PreFlightChecks(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Version
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    getV2Version(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).getV2Version(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary List Collections
     * @param {string} tenant
     * @param {string} databaseName
     * @param {number | null} [limit]
     * @param {number | null} [offset]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    listCollections(tenant, databaseName, limit, offset, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).listCollections(tenant, databaseName, limit, offset, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary List Collections V1
     * @param {number | null} [limit]
     * @param {number | null} [offset]
     * @param {string} [tenant]
     * @param {string} [database]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    listCollectionsV1(limit, offset, tenant, database, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).listCollectionsV1(limit, offset, tenant, database, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary List Databases
     * @param {string} tenant
     * @param {number | null} [limit]
     * @param {number | null} [offset]
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    listDatabases(tenant, limit, offset, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).listDatabases(tenant, limit, offset, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Reset
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    postV1Reset(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).postV1Reset(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Reset
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    postV2Reset(options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).postV2Reset(options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Update
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.UpdateRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    update(tenant, databaseName, collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).update(tenant, databaseName, collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Update Collection
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.UpdateCollectionRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    updateCollection(tenant, databaseName, collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).updateCollection(tenant, databaseName, collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Update Collection V1
     * @param {string} collectionId
     * @param {Api.UpdateCollectionV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    updateCollectionV1(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).updateCollectionV1(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Update V1
     * @param {string} collectionId
     * @param {Api.UpdateV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    updateV1(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).updateV1(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Upsert
     * @param {string} tenant
     * @param {string} databaseName
     * @param {string} collectionId
     * @param {Api.UpsertRequest} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    upsert(tenant, databaseName, collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).upsert(tenant, databaseName, collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    },
    /**
     * @summary Upsert V1
     * @param {string} collectionId
     * @param {Api.UpsertV1Request} request
     * @param {RequestInit} [options] Override http request option.
     * @throws {RequiredError}
     */
    upsertV1(collectionId, request, options) {
      const localVarFetchArgs = ApiApiFetchParamCreator(configuration).upsertV1(collectionId, request, options);
      return (fetch2 = defaultFetch, basePath = BASE_PATH) => {
        return fetch2(basePath + localVarFetchArgs.url, localVarFetchArgs.options).then((response) => {
          const contentType = response.headers.get("Content-Type");
          const mimeType = contentType ? contentType.replace(/;.*/, "") : void 0;
          if (response.status === 200) {
            if (mimeType === "application/json") {
              return response.json();
            }
            throw response;
          }
          if (response.status === 422) {
            if (mimeType === "application/json") {
              throw response;
            }
            throw response;
          }
          throw response;
        });
      };
    }
  };
};
var ApiApi = class extends BaseAPI {
  /**
   * @summary Add
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionId
   * @param {Api.AddRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  add(tenant, databaseName, collectionId, request, options) {
    return ApiApiFp(this.configuration).add(tenant, databaseName, collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Add V1
   * @param {string} collectionId
   * @param {Api.AddV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  addV1(collectionId, request, options) {
    return ApiApiFp(this.configuration).addV1(collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Delete
   * @param {string} collectionId
   * @param {string} tenant
   * @param {string} databaseName
   * @param {Api.ADeleteRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  aDelete(collectionId, tenant, databaseName, request, options) {
    return ApiApiFp(this.configuration).aDelete(collectionId, tenant, databaseName, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get
   * @param {string} collectionId
   * @param {string} tenant
   * @param {string} databaseName
   * @param {Api.AGetRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  aGet(collectionId, tenant, databaseName, request, options) {
    return ApiApiFp(this.configuration).aGet(collectionId, tenant, databaseName, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Count
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionId
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  count(tenant, databaseName, collectionId, options) {
    return ApiApiFp(this.configuration).count(tenant, databaseName, collectionId, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Count Collections
   * @param {string} tenant
   * @param {string} databaseName
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  countCollections(tenant, databaseName, options) {
    return ApiApiFp(this.configuration).countCollections(tenant, databaseName, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Count Collections V1
   * @param {string} [tenant]
   * @param {string} [database]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  countCollectionsV1(tenant, database, options) {
    return ApiApiFp(this.configuration).countCollectionsV1(tenant, database, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Count V1
   * @param {string} collectionId
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  countV1(collectionId, options) {
    return ApiApiFp(this.configuration).countV1(collectionId, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Create Collection
   * @param {string} tenant
   * @param {string} databaseName
   * @param {Api.CreateCollectionRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  createCollection(tenant, databaseName, request, options) {
    return ApiApiFp(this.configuration).createCollection(tenant, databaseName, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Create Collection V1
   * @param {string} [tenant]
   * @param {string} [database]
   * @param {Api.CreateCollectionV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  createCollectionV1(tenant, database, request, options) {
    return ApiApiFp(this.configuration).createCollectionV1(tenant, database, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Create Database
   * @param {string} tenant
   * @param {Api.CreateDatabaseRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  createDatabase(tenant, request, options) {
    return ApiApiFp(this.configuration).createDatabase(tenant, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Create Database V1
   * @param {string} [tenant]
   * @param {Api.CreateDatabaseV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  createDatabaseV1(tenant, request, options) {
    return ApiApiFp(this.configuration).createDatabaseV1(tenant, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Create Tenant
   * @param {Api.CreateTenantRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  createTenant(request, options) {
    return ApiApiFp(this.configuration).createTenant(request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Create Tenant V1
   * @param {Api.CreateTenantV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  createTenantV1(request, options) {
    return ApiApiFp(this.configuration).createTenantV1(request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Delete Collection
   * @param {string} collectionName
   * @param {string} tenant
   * @param {string} databaseName
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  deleteCollection(collectionName, tenant, databaseName, options) {
    return ApiApiFp(this.configuration).deleteCollection(collectionName, tenant, databaseName, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Delete Collection V1
   * @param {string} collectionName
   * @param {string} [tenant]
   * @param {string} [database]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  deleteCollectionV1(collectionName, tenant, database, options) {
    return ApiApiFp(this.configuration).deleteCollectionV1(collectionName, tenant, database, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Delete Database
   * @param {string} databaseName
   * @param {string} tenant
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  deleteDatabase(databaseName, tenant, options) {
    return ApiApiFp(this.configuration).deleteDatabase(databaseName, tenant, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Delete V1
   * @param {string} collectionId
   * @param {Api.DeleteV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  deleteV1(collectionId, request, options) {
    return ApiApiFp(this.configuration).deleteV1(collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Collection
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionName
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getCollection(tenant, databaseName, collectionName, options) {
    return ApiApiFp(this.configuration).getCollection(tenant, databaseName, collectionName, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Collection V1
   * @param {string} collectionName
   * @param {string} [tenant]
   * @param {string} [database]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getCollectionV1(collectionName, tenant, database, options) {
    return ApiApiFp(this.configuration).getCollectionV1(collectionName, tenant, database, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Database
   * @param {string} databaseName
   * @param {string} tenant
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getDatabase(databaseName, tenant, options) {
    return ApiApiFp(this.configuration).getDatabase(databaseName, tenant, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Database V1
   * @param {string} database
   * @param {string} [tenant]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getDatabaseV1(database, tenant, options) {
    return ApiApiFp(this.configuration).getDatabaseV1(database, tenant, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Nearest Neighbors
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionId
   * @param {Api.GetNearestNeighborsRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getNearestNeighbors(tenant, databaseName, collectionId, request, options) {
    return ApiApiFp(this.configuration).getNearestNeighbors(tenant, databaseName, collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Nearest Neighbors V1
   * @param {string} collectionId
   * @param {Api.GetNearestNeighborsV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getNearestNeighborsV1(collectionId, request, options) {
    return ApiApiFp(this.configuration).getNearestNeighborsV1(collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Tenant
   * @param {string} tenant
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getTenant(tenant, options) {
    return ApiApiFp(this.configuration).getTenant(tenant, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get Tenant V1
   * @param {string} tenant
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getTenantV1(tenant, options) {
    return ApiApiFp(this.configuration).getTenantV1(tenant, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get User Identity
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getUserIdentity(options) {
    return ApiApiFp(this.configuration).getUserIdentity(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Root
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV11(options) {
    return ApiApiFp(this.configuration).getV11(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Get V1
   * @param {string} collectionId
   * @param {Api.GetV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV12(collectionId, request, options) {
    return ApiApiFp(this.configuration).getV12(collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Heartbeat
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV1Heartbeat(options) {
    return ApiApiFp(this.configuration).getV1Heartbeat(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Pre Flight Checks
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV1PreFlightChecks(options) {
    return ApiApiFp(this.configuration).getV1PreFlightChecks(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Version
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV1Version(options) {
    return ApiApiFp(this.configuration).getV1Version(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Root
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV2(options) {
    return ApiApiFp(this.configuration).getV2(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Heartbeat
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV2Heartbeat(options) {
    return ApiApiFp(this.configuration).getV2Heartbeat(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Pre Flight Checks
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV2PreFlightChecks(options) {
    return ApiApiFp(this.configuration).getV2PreFlightChecks(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Version
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  getV2Version(options) {
    return ApiApiFp(this.configuration).getV2Version(options)(this.fetch, this.basePath);
  }
  /**
   * @summary List Collections
   * @param {string} tenant
   * @param {string} databaseName
   * @param {number | null} [limit]
   * @param {number | null} [offset]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  listCollections(tenant, databaseName, limit, offset, options) {
    return ApiApiFp(this.configuration).listCollections(tenant, databaseName, limit, offset, options)(this.fetch, this.basePath);
  }
  /**
   * @summary List Collections V1
   * @param {number | null} [limit]
   * @param {number | null} [offset]
   * @param {string} [tenant]
   * @param {string} [database]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  listCollectionsV1(limit, offset, tenant, database, options) {
    return ApiApiFp(this.configuration).listCollectionsV1(limit, offset, tenant, database, options)(this.fetch, this.basePath);
  }
  /**
   * @summary List Databases
   * @param {string} tenant
   * @param {number | null} [limit]
   * @param {number | null} [offset]
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  listDatabases(tenant, limit, offset, options) {
    return ApiApiFp(this.configuration).listDatabases(tenant, limit, offset, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Reset
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  postV1Reset(options) {
    return ApiApiFp(this.configuration).postV1Reset(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Reset
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  postV2Reset(options) {
    return ApiApiFp(this.configuration).postV2Reset(options)(this.fetch, this.basePath);
  }
  /**
   * @summary Update
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionId
   * @param {Api.UpdateRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  update(tenant, databaseName, collectionId, request, options) {
    return ApiApiFp(this.configuration).update(tenant, databaseName, collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Update Collection
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionId
   * @param {Api.UpdateCollectionRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  updateCollection(tenant, databaseName, collectionId, request, options) {
    return ApiApiFp(this.configuration).updateCollection(tenant, databaseName, collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Update Collection V1
   * @param {string} collectionId
   * @param {Api.UpdateCollectionV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  updateCollectionV1(collectionId, request, options) {
    return ApiApiFp(this.configuration).updateCollectionV1(collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Update V1
   * @param {string} collectionId
   * @param {Api.UpdateV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  updateV1(collectionId, request, options) {
    return ApiApiFp(this.configuration).updateV1(collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Upsert
   * @param {string} tenant
   * @param {string} databaseName
   * @param {string} collectionId
   * @param {Api.UpsertRequest} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  upsert(tenant, databaseName, collectionId, request, options) {
    return ApiApiFp(this.configuration).upsert(tenant, databaseName, collectionId, request, options)(this.fetch, this.basePath);
  }
  /**
   * @summary Upsert V1
   * @param {string} collectionId
   * @param {Api.UpsertV1Request} request
   * @param {RequestInit} [options] Override http request option.
   * @throws {RequiredError}
   */
  upsertV1(collectionId, request, options) {
    return ApiApiFp(this.configuration).upsertV1(collectionId, request, options)(this.fetch, this.basePath);
  }
};

// src/generated/models.ts
var Api;
((Api2) => {
  let IncludeEnum2;
  ((IncludeEnum3) => {
    IncludeEnum3["Documents"] = "documents";
    IncludeEnum3["Embeddings"] = "embeddings";
    IncludeEnum3["Metadatas"] = "metadatas";
    IncludeEnum3["Distances"] = "distances";
    IncludeEnum3["Uris"] = "uris";
    IncludeEnum3["Data"] = "data";
  })(IncludeEnum2 = Api2.IncludeEnum || (Api2.IncludeEnum = {}));
})(Api || (Api = {}));

// src/generated/configuration.ts
var Configuration = class {
  constructor(param = {}) {
    this.apiKey = param.apiKey;
    this.username = param.username;
    this.password = param.password;
    this.authorization = param.authorization;
    this.basePath = param.basePath;
  }
};

// src/Errors.ts
var ChromaError = class extends Error {
  constructor(name, message, cause) {
    super(message);
    this.cause = cause;
    this.name = name;
  }
};
var ChromaConnectionError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaConnectionError";
  }
};
var ChromaServerError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaServerError";
  }
};
var ChromaClientError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaClientError";
  }
};
var ChromaUnauthorizedError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaAuthError";
  }
};
var ChromaForbiddenError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaForbiddenError";
  }
};
var ChromaNotFoundError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaNotFoundError";
  }
};
var ChromaValueError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaValueError";
  }
};
var InvalidCollectionError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "InvalidCollectionError";
  }
};
var InvalidArgumentError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "InvalidArgumentError";
  }
};
var ChromaUniqueError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaUniqueError";
  }
};
function createErrorByType(type, message) {
  switch (type) {
    case "InvalidCollection":
      return new InvalidCollectionError(message);
    case "InvalidArgumentError":
      return new InvalidArgumentError(message);
    default:
      return void 0;
  }
}

// src/Collection.ts
var Collection = class {
  /**
   * @ignore
   */
  constructor(name, id, client, embeddingFunction, metadata) {
    this.name = name;
    this.id = id;
    this.metadata = metadata;
    this.client = client;
    this.embeddingFunction = embeddingFunction;
  }
  /**
   * Add items to the collection
   * @param {Object} params - The parameters for the query.
   * @param {ID | IDs} [params.ids] - IDs of the items to add.
   * @param {Embedding | Embeddings} [params.embeddings] - Optional embeddings of the items to add.
   * @param {Metadata | Metadatas} [params.metadatas] - Optional metadata of the items to add.
   * @param {Document | Documents} [params.documents] - Optional documents of the items to add.
   * @returns {Promise<AddResponse>} - The response from the API. True if successful.
   *
   * @example
   * ```typescript
   * const response = await collection.add({
   *   ids: ["id1", "id2"],
   *   embeddings: [[1, 2, 3], [4, 5, 6]],
   *   metadatas: [{ "key": "value" }, { "key": "value" }],
   *   documents: ["document1", "document2"]
   * });
   * ```
   */
  async add(params) {
    await this.client.init();
    await this.client.api.add(
      this.client.tenant,
      this.client.database,
      this.id,
      // TODO: For some reason the auto generated code requires metadata to be defined here.
      await prepareRecordRequest(
        params,
        this.embeddingFunction
      ),
      this.client.api.options
    );
  }
  /**
   * Upsert items to the collection
   * @param {Object} params - The parameters for the query.
   * @param {ID | IDs} [params.ids] - IDs of the items to add.
   * @param {Embedding | Embeddings} [params.embeddings] - Optional embeddings of the items to add.
   * @param {Metadata | Metadatas} [params.metadatas] - Optional metadata of the items to add.
   * @param {Document | Documents} [params.documents] - Optional documents of the items to add.
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * const response = await collection.upsert({
   *   ids: ["id1", "id2"],
   *   embeddings: [[1, 2, 3], [4, 5, 6]],
   *   metadatas: [{ "key": "value" }, { "key": "value" }],
   *   documents: ["document1", "document2"],
   * });
   * ```
   */
  async upsert(params) {
    await this.client.init();
    await this.client.api.upsert(
      this.client.tenant,
      this.client.database,
      this.id,
      // TODO: For some reason the auto generated code requires metadata to be defined here.
      await prepareRecordRequest(
        params,
        this.embeddingFunction
      ),
      this.client.api.options
    );
  }
  /**
   * Count the number of items in the collection
   * @returns {Promise<number>} - The number of items in the collection.
   *
   * @example
   * ```typescript
   * const count = await collection.count();
   * ```
   */
  async count() {
    await this.client.init();
    return await this.client.api.count(
      this.client.tenant,
      this.client.database,
      this.id,
      this.client.api.options
    );
  }
  /**
   * Get items from the collection
   * @param {Object} params - The parameters for the query.
   * @param {ID | IDs} [params.ids] - Optional IDs of the items to get.
   * @param {Where} [params.where] - Optional where clause to filter items by.
   * @param {PositiveInteger} [params.limit] - Optional limit on the number of items to get.
   * @param {PositiveInteger} [params.offset] - Optional offset on the items to get.
   * @param {IncludeEnum[]} [params.include] - Optional list of items to include in the response.
   * @param {WhereDocument} [params.whereDocument] - Optional where clause to filter items by.
   * @returns {Promise<GetResponse>} - The response from the server.
   *
   * @example
   * ```typescript
   * const response = await collection.get({
   *   ids: ["id1", "id2"],
   *   where: { "key": "value" },
   *   limit: 10,
   *   offset: 0,
   *   include: ["embeddings", "metadatas", "documents"],
   *   whereDocument: { $contains: "value" },
   * });
   * ```
   */
  async get({
    ids,
    where,
    limit,
    offset,
    include,
    whereDocument
  } = {}) {
    await this.client.init();
    const idsArray = ids ? toArray(ids) : void 0;
    const resp = await this.client.api.aGet(
      this.id,
      this.client.tenant,
      this.client.database,
      {
        ids: idsArray,
        where,
        limit,
        offset,
        include,
        where_document: whereDocument
      },
      this.client.api.options
    );
    return resp;
  }
  /**
   * Update items in the collection
   * @param {Object} params - The parameters for the query.
   * @param {ID | IDs} [params.ids] - IDs of the items to add.
   * @param {Embedding | Embeddings} [params.embeddings] - Optional embeddings of the items to add.
   * @param {Metadata | Metadatas} [params.metadatas] - Optional metadata of the items to add.
   * @param {Document | Documents} [params.documents] - Optional documents of the items to add.
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * const response = await collection.update({
   *   ids: ["id1", "id2"],
   *   embeddings: [[1, 2, 3], [4, 5, 6]],
   *   metadatas: [{ "key": "value" }, { "key": "value" }],
   *   documents: ["document1", "document2"],
   * });
   * ```
   */
  async update(params) {
    await this.client.init();
    await this.client.api.update(
      this.client.tenant,
      this.client.database,
      this.id,
      await prepareRecordRequest(params, this.embeddingFunction, true),
      this.client.api.options
    );
  }
  /**
   * Performs a query on the collection using the specified parameters.
   *
   * @param {Object} params - The parameters for the query.
   * @param {Embedding | Embeddings} [params.queryEmbeddings] - Optional query embeddings to use for the search.
   * @param {PositiveInteger} [params.nResults] - Optional number of results to return (default is 10).
   * @param {Where} [params.where] - Optional query condition to filter results based on metadata values.
   * @param {string | string[]} [params.queryTexts] - Optional query text(s) to search for in the collection.
   * @param {WhereDocument} [params.whereDocument] - Optional query condition to filter results based on document content.
   * @param {IncludeEnum[]} [params.include] - Optional array of fields to include in the result, such as "metadata" and "document".
   *
   * @returns {Promise<QueryResponse>} A promise that resolves to the query results.
   * @throws {Error} If there is an issue executing the query.
   * @example
   * // Query the collection using embeddings
   * const results = await collection.query({
   *   queryEmbeddings: [[0.1, 0.2, ...], ...],
   *   nResults: 10,
   *   where: {"name": {"$eq": "John Doe"}},
   *   include: ["metadata", "document"]
   * });
   * @example
   * ```js
   * // Query the collection using query text
   * const results = await collection.query({
   *   queryTexts: "some text",
   *   nResults: 10,
   *   where: {"name": {"$eq": "John Doe"}},
   *   include: ["metadata", "document"]
   * });
   * ```
   *
   */
  async query({
    nResults = 10,
    where,
    whereDocument,
    include,
    queryTexts,
    queryEmbeddings
  }) {
    if (queryTexts && queryEmbeddings || !queryTexts && !queryEmbeddings) {
      throw new Error(
        "You must supply exactly one of queryTexts or queryEmbeddings."
      );
    }
    await this.client.init();
    const arrayQueryEmbeddings = queryTexts !== void 0 ? await this.embeddingFunction.generate(toArray(queryTexts)) : toArrayOfArrays(queryEmbeddings);
    return await this.client.api.getNearestNeighbors(
      this.client.tenant,
      this.client.database,
      this.id,
      {
        query_embeddings: arrayQueryEmbeddings,
        where,
        n_results: nResults,
        where_document: whereDocument,
        include
      },
      this.client.api.options
    );
  }
  /**
   * Modify the collection name or metadata
   * @param {Object} params - The parameters for the query.
   * @param {string} [params.name] - Optional new name for the collection.
   * @param {CollectionMetadata} [params.metadata] - Optional new metadata for the collection.
   * @returns {Promise<void>} - The response from the API.
   *
   * @example
   * ```typescript
   * const response = await client.updateCollection({
   *   name: "new name",
   *   metadata: { "key": "value" },
   * });
   * ```
   */
  async modify({
    name,
    metadata
  }) {
    await this.client.init();
    return this.client.api.updateCollection(
      this.client.tenant,
      this.client.database,
      this.id,
      {
        new_name: name,
        new_metadata: metadata
      },
      this.client.api.options
    ).then(() => {
      if (name !== void 0) {
        this.name = name;
      }
      if (metadata !== void 0) {
        this.metadata = metadata;
      }
      return {
        name: this.name,
        metadata: this.metadata
      };
    });
  }
  /**
   * Peek inside the collection
   * @param {Object} params - The parameters for the query.
   * @param {PositiveInteger} [params.limit] - Optional number of results to return (default is 10).
   * @returns {Promise<GetResponse>} A promise that resolves to the query results.
   * @throws {Error} If there is an issue executing the query.
   *
   * @example
   * ```typescript
   * const results = await collection.peek({
   *   limit: 10
   * });
   * ```
   */
  async peek({ limit = 10 } = {}) {
    await this.client.init();
    return await this.client.api.aGet(
      this.id,
      this.client.tenant,
      this.client.database,
      {
        limit
      },
      this.client.api.options
    );
  }
  /**
   * Deletes items from the collection.
   * @param {Object} params - The parameters for deleting items from the collection.
   * @param {ID | IDs} [params.ids] - Optional ID or array of IDs of items to delete.
   * @param {Where} [params.where] - Optional query condition to filter items to delete based on metadata values.
   * @param {WhereDocument} [params.whereDocument] - Optional query condition to filter items to delete based on document content.
   * @returns {Promise<string[]>} A promise that resolves to the IDs of the deleted items.
   * @throws {Error} If there is an issue deleting items from the collection.
   *
   * @example
   * ```typescript
   * const results = await collection.delete({
   *   ids: "some_id",
   *   where: {"name": {"$eq": "John Doe"}},
   *   whereDocument: {"$contains":"search_string"}
   * });
   * ```
   */
  async delete({
    ids,
    where,
    whereDocument
  } = {}) {
    await this.client.init();
    let idsArray = void 0;
    if (ids !== void 0)
      idsArray = toArray(ids);
    await this.client.api.aDelete(
      this.id,
      this.client.tenant,
      this.client.database,
      { ids: idsArray, where, where_document: whereDocument },
      this.client.api.options
    );
  }
};

// src/utils.ts
function toArray(obj) {
  if (Array.isArray(obj)) {
    return obj;
  } else {
    return [obj];
  }
}
function toArrayOfArrays(obj) {
  if (obj.length === 0) {
    return [];
  }
  if (Array.isArray(obj[0])) {
    return obj;
  }
  if (obj[0] && typeof obj[0][Symbol.iterator] === "function") {
    return obj.map((el) => Array.from(el));
  }
  return [obj];
}
async function validateTenantDatabase(adminClient, tenant, database) {
  try {
    await adminClient.getTenant({ name: tenant });
  } catch (error) {
    if (error instanceof ChromaConnectionError) {
      throw error;
    }
    throw new Error(
      `Could not connect to tenant ${tenant}. Are you sure it exists? Underlying error:
${error}`
    );
  }
  try {
    await adminClient.getDatabase({ name: database, tenantName: tenant });
  } catch (error) {
    if (error instanceof ChromaConnectionError) {
      throw error;
    }
    throw new Error(
      `Could not connect to database ${database} for tenant ${tenant}. Are you sure it exists? Underlying error:
${error}`
    );
  }
}
function isBrowser() {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}
function arrayifyParams(params) {
  return {
    ids: toArray(params.ids),
    embeddings: params.embeddings ? toArrayOfArrays(params.embeddings) : void 0,
    metadatas: params.metadatas ? toArray(params.metadatas) : void 0,
    documents: params.documents ? toArray(params.documents) : void 0
  };
}
async function prepareRecordRequest(reqParams, embeddingFunction, update) {
  const { ids, embeddings, metadatas, documents } = arrayifyParams(reqParams);
  if (!embeddings && !documents && !update) {
    throw new Error("embeddings and documents cannot both be undefined");
  }
  const embeddingsArray = embeddings ? embeddings : documents ? await embeddingFunction.generate(documents) : void 0;
  if (!embeddingsArray && !update) {
    throw new Error("Failed to generate embeddings for your request.");
  }
  for (let i = 0; i < ids.length; i += 1) {
    if (typeof ids[i] !== "string") {
      throw new Error(
        `Expected ids to be strings, found ${typeof ids[i]} at index ${i}`
      );
    }
  }
  if (embeddingsArray !== void 0 && ids.length !== embeddingsArray.length || metadatas !== void 0 && ids.length !== metadatas.length || documents !== void 0 && ids.length !== documents.length) {
    throw new Error(
      "ids, embeddings, metadatas, and documents must all be the same length"
    );
  }
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    const duplicateIds = ids.filter(
      (item, index) => ids.indexOf(item) !== index
    );
    throw new Error(
      `ID's must be unique, found duplicates for: ${duplicateIds}`
    );
  }
  return {
    ids,
    metadatas,
    documents,
    embeddings: embeddingsArray
  };
}
function wrapCollection(api, collection) {
  return new Collection(
    collection.name,
    collection.id,
    api,
    collection.embeddingFunction,
    collection.metadata
  );
}

// src/auth.ts
var tokenHeaderTypeToHeaderKey = (headerType) => {
  if (headerType === "AUTHORIZATION") {
    return "Authorization";
  } else {
    return "X-Chroma-Token";
  }
};
var base64Encode = (str) => {
  return Buffer.from(str).toString("base64");
};
var BasicAuthClientProvider = class {
  /**
   * Creates a new BasicAuthClientProvider.
   * @param textCredentials - The credentials for the authentication provider. Must be of the form "username:password". If not supplied, the environment variable CHROMA_CLIENT_AUTH_CREDENTIALS will be used.
   * @throws {Error} If neither credentials provider or text credentials are supplied.
   */
  constructor(textCredentials) {
    const creds = textCredentials != null ? textCredentials : process.env.CHROMA_CLIENT_AUTH_CREDENTIALS;
    if (creds === void 0) {
      throw new Error(
        "Credentials must be supplied via environment variable (CHROMA_CLIENT_AUTH_CREDENTIALS) or passed in as configuration."
      );
    }
    this.credentials = {
      Authorization: "Basic " + base64Encode(creds)
    };
  }
  authenticate() {
    return this.credentials;
  }
};
var TokenAuthClientProvider = class {
  constructor(textCredentials, headerType = "AUTHORIZATION") {
    const creds = textCredentials != null ? textCredentials : process.env.CHROMA_CLIENT_AUTH_CREDENTIALS;
    if (creds === void 0) {
      throw new Error(
        "Credentials must be supplied via environment variable (CHROMA_CLIENT_AUTH_CREDENTIALS) or passed in as configuration."
      );
    }
    const headerKey = tokenHeaderTypeToHeaderKey(headerType);
    const headerVal = headerType === "AUTHORIZATION" ? `Bearer ${creds}` : creds;
    this.credentials = {};
    this.credentials[headerKey] = headerVal;
  }
  authenticate() {
    return this.credentials;
  }
};
var authOptionsToAuthProvider = (auth) => {
  if (auth.provider === void 0) {
    throw new Error("Auth provider not specified");
  }
  if (auth.credentials === void 0) {
    throw new Error("Auth credentials not specified");
  }
  switch (auth.provider) {
    case "basic":
      return new BasicAuthClientProvider(auth.credentials);
    case "token":
      return new TokenAuthClientProvider(
        auth.credentials,
        auth.tokenHeaderType
      );
      break;
    default:
      throw new Error("Invalid auth provider");
  }
};

// src/ChromaFetch.ts
function isOfflineError(error) {
  var _a, _b, _c;
  return Boolean(
    ((error == null ? void 0 : error.name) === "TypeError" || (error == null ? void 0 : error.name) === "FetchError") && (((_a = error.message) == null ? void 0 : _a.includes("fetch failed")) || ((_b = error.message) == null ? void 0 : _b.includes("Failed to fetch")) || ((_c = error.message) == null ? void 0 : _c.includes("ENOTFOUND")))
  );
}
function parseServerError(error) {
  const regex = /(\w+)\('(.+)'\)/;
  const match = error == null ? void 0 : error.match(regex);
  if (match) {
    const [, name, message] = match;
    switch (name) {
      case "ValueError":
        return new ChromaValueError(message);
      default:
        return new ChromaError(name, message);
    }
  }
  return new ChromaServerError(
    "The server encountered an error while handling the request."
  );
}
var chromaFetch = async (input, init) => {
  try {
    const resp = await fetch(input, init);
    const clonedResp = resp.clone();
    const respBody = await clonedResp.json();
    if (!clonedResp.ok) {
      const error = createErrorByType(respBody == null ? void 0 : respBody.error, respBody == null ? void 0 : respBody.message);
      if (error) {
        throw error;
      }
      switch (resp.status) {
        case 400:
          throw new ChromaClientError(
            `Bad request to ${input} with status: ${resp.statusText}`
          );
        case 401:
          throw new ChromaUnauthorizedError(`Unauthorized`);
        case 403:
          throw new ChromaForbiddenError(
            `You do not have permission to access the requested resource.`
          );
        case 404:
          throw new ChromaNotFoundError(
            `The requested resource could not be found: ${input}`
          );
        case 409:
          throw new ChromaUniqueError("The resource already exists");
        case 500:
          throw parseServerError(respBody == null ? void 0 : respBody.error);
        case 502:
        case 503:
        case 504:
          throw new ChromaConnectionError(
            `Unable to connect to the chromadb server. Please try again later.`
          );
      }
      throw new Error(
        `Failed to fetch ${input} with status ${resp.status}: ${resp.statusText}`
      );
    }
    if (respBody == null ? void 0 : respBody.error) {
      throw parseServerError(respBody.error);
    }
    return resp;
  } catch (error) {
    if (isOfflineError(error)) {
      throw new ChromaConnectionError(
        "Failed to connect to chromadb. Make sure your server is running and try again. If you are running from a browser, make sure that your chromadb instance is configured to allow requests from the current origin using the CHROMA_SERVER_CORS_ALLOW_ORIGINS environment variable.",
        error
      );
    }
    throw error;
  }
};

// src/AdminClient.ts
var DEFAULT_TENANT = "default_tenant";
var DEFAULT_DATABASE = "default_database";
var AdminClient = class {
  /**
   * Creates a new AdminClient instance.
   * @param {Object} params - The parameters for creating a new client
   * @param {string} [params.path] - The base path for the Chroma API.
   * @returns {AdminClient} A new AdminClient instance.
   *
   * @example
   * ```typescript
   * const client = new AdminClient({
   *   path: "http://localhost:8000"
   * });
   * ```
   */
  constructor({
    path,
    fetchOptions,
    auth,
    tenant = DEFAULT_TENANT,
    database = DEFAULT_DATABASE
  } = {}) {
    this.tenant = DEFAULT_TENANT;
    this.database = DEFAULT_DATABASE;
    if (path === void 0)
      path = "http://localhost:8000";
    this.tenant = tenant;
    this.database = database;
    this.authProvider = void 0;
    const apiConfig = new Configuration({
      basePath: path
    });
    this.api = new ApiApi(apiConfig, void 0, chromaFetch);
    this.api.options = fetchOptions != null ? fetchOptions : {};
    if (auth !== void 0) {
      this.authProvider = authOptionsToAuthProvider(auth);
      this.api.options.headers = __spreadValues(__spreadValues({}, this.api.options.headers), this.authProvider.authenticate());
    }
  }
  /**
   * Sets the tenant and database for the client.
   *
   * @param {Object} params - The parameters for setting tenant and database.
   * @param {string} params.tenant - The name of the tenant.
   * @param {string} params.database - The name of the database.
   *
   * @returns {Promise<void>} A promise that returns nothing
   * @throws {Error} Any issues
   *
   * @example
   * ```typescript
   * await adminClient.setTenant({
   *   tenant: "my_tenant",
   *   database: "my_database",
   * });
   * ```
   */
  async setTenant({
    tenant = DEFAULT_TENANT,
    database = DEFAULT_DATABASE
  }) {
    await validateTenantDatabase(this, tenant, database);
    this.tenant = tenant;
    this.database = database;
  }
  /**
   * Sets the database for the client.
   *
   * @param {Object} params - The parameters for setting the database.
   * @param {string} params.database - The name of the database.
   *
   * @returns {Promise<void>} A promise that returns nothing
   * @throws {Error} Any issues
   *
   * @example
   * ```typescript
   * await adminClient.setDatabase({
   *   database: "my_database",
   * });
   * ```
   */
  async setDatabase({
    database = DEFAULT_DATABASE
  }) {
    await validateTenantDatabase(this, this.tenant, database);
    this.database = database;
  }
  /**
   * Creates a new tenant with the specified properties.
   *
   * @param {Object} params - The parameters for creating a new tenant.
   * @param {string} params.name - The name of the tenant.
   *
   * @returns {Promise<Tenant>} A promise that resolves to the created tenant.
   * @throws {Error} If there is an issue creating the tenant.
   *
   * @example
   * ```typescript
   * await adminClient.createTenant({
   *   name: "my_tenant",
   * });
   * ```
   */
  async createTenant({ name }) {
    await this.api.createTenant({ name }, this.api.options);
    return { name };
  }
  /**
   * Gets a tenant with the specified properties.
   *
   * @param {Object} params - The parameters for getting a tenant.
   * @param {string} params.name - The name of the tenant.
   *
   * @returns {Promise<Tenant>} A promise that resolves to the tenant.
   * @throws {Error} If there is an issue getting the tenant.
   *
   * @example
   * ```typescript
   * await adminClient.getTenant({
   *   name: "my_tenant",
   * });
   * ```
   */
  async getTenant({ name }) {
    const getTenant = await this.api.getTenant(
      name,
      this.api.options
    );
    return { name: getTenant.name };
  }
  /**
   * Creates a new database with the specified properties.
   *
   * @param {Object} params - The parameters for creating a new database.
   * @param {string} params.name - The name of the database.
   * @param {string} params.tenantName - The name of the tenant.
   *
   * @returns {Promise<Database>} A promise that resolves to the created database.
   * @throws {Error} If there is an issue creating the database.
   *
   * @example
   * ```typescript
   * await adminClient.createDatabase({
   *   name: "my_database",
   *   tenantName: "my_tenant",
   * });
   * ```
   */
  async createDatabase({
    name,
    tenantName
  }) {
    await this.api.createDatabase(tenantName, { name }, this.api.options);
    return { name };
  }
  /**
   * Gets a database with the specified properties.
   *
   * @param {Object} params - The parameters for getting a database.
   * @param {string} params.name - The name of the database.
   * @param {string} params.tenantName - The name of the tenant.
   *
   * @returns {Promise<Database>} A promise that resolves to the database.
   * @throws {Error} If there is an issue getting the database.
   *
   * @example
   * ```typescript
   * await adminClient.getDatabase({
   *   name: "my_database",
   *   tenantName: "my_tenant",
   * });
   * ```
   */
  async getDatabase({
    name,
    tenantName
  }) {
    const result = await this.api.getDatabase(
      name,
      tenantName,
      this.api.options
    );
    return result;
  }
  /**
   * Deletes a database.
   *
   * @param {Object} params - The parameters for deleting a database.
   * @param {string} params.name - The name of the database.
   * @param {string} params.tenantName - The name of the tenant.
   *
   * @returns {Promise<void>} A promise that returns nothing.
   * @throws {Error} If there is an issue deleting the database.
   */
  async deleteDatabase({
    name,
    tenantName
  }) {
    await this.api.deleteDatabase(name, tenantName, this.api.options);
  }
  /**
   * Lists database for a specific tenant.
   *
   * @param {Object} params - The parameters for listing databases.
   * @param {number} [params.limit] - The maximum number of databases to return.
   * @param {number} [params.offset] - The number of databases to skip.
   *
   * @returns {Promise<Database[]>} A promise that resolves to a list of databases.
   * @throws {Error} If there is an issue listing the databases.
   */
  async listDatabases({
    limit,
    offset,
    tenantName
  }) {
    return await this.api.listDatabases(
      tenantName,
      limit,
      offset,
      this.api.options
    );
  }
};

// src/embeddings/DefaultEmbeddingFunction.ts
var TransformersApi;
var DefaultEmbeddingFunction = class _DefaultEmbeddingFunction {
  /**
   * DefaultEmbeddingFunction constructor.
   * @param options The configuration options.
   * @param options.model The model to use to calculate embeddings. Defaults to 'Xenova/all-MiniLM-L6-v2', which is an ONNX port of `sentence-transformers/all-MiniLM-L6-v2`.
   * @param options.revision The specific model version to use (can be a branch, tag name, or commit id). Defaults to 'main'.
   * @param options.quantized Whether to load the 8-bit quantized version of the model. Defaults to `false`.
   * @param options.progress_callback If specified, this function will be called during model construction, to provide the user with progress updates.
   */
  constructor({
    model = "Xenova/all-MiniLM-L6-v2",
    revision = "main",
    quantized = false,
    progress_callback = null
  } = {}) {
    this.model = model;
    this.revision = revision;
    this.quantized = quantized;
    this.progress_callback = progress_callback;
  }
  async generate(texts) {
    await this.loadClient();
    this.pipelinePromise = new Promise(async (resolve, reject) => {
      try {
        const pipeline = this.transformersApi;
        const quantized = this.quantized;
        const revision = this.revision;
        const progress_callback = this.progress_callback;
        resolve(
          await pipeline("feature-extraction", this.model, {
            quantized,
            revision,
            progress_callback
          })
        );
      } catch (e) {
        reject(e);
      }
    });
    let pipe = await this.pipelinePromise;
    let output = await pipe(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }
  async loadClient() {
    if (this.transformersApi)
      return;
    try {
      let { pipeline } = await _DefaultEmbeddingFunction.import();
      TransformersApi = pipeline;
    } catch (_a) {
      if (_a.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Please install the chromadb-default-embed package to use the DefaultEmbeddingFunction, `npm install chromadb-default-embed`"
        );
      }
      throw _a;
    }
    this.transformersApi = TransformersApi;
  }
  /** @ignore */
  static async import() {
    try {
      let importResult;
      if (isBrowser()) {
        importResult = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! https://unpkg.com/chromadb-default-embed@2.14.0 */ "https://unpkg.com/chromadb-default-embed@2.14.0"));
      } else {
        importResult = await __webpack_require__.e(/*! import() */ "node_modules_chromadb-default-embed_src_models_js-node_modules_chromadb-default-embed_src_tra-7378af").then(__webpack_require__.bind(__webpack_require__, /*! chromadb-default-embed */ "./node_modules/chromadb-default-embed/src/transformers.js"));
      }
      const { pipeline, env } = importResult;
      env.allowLocalModels = false;
      return { pipeline };
    } catch (e) {
      throw new Error(
        "Please install chromadb-default-embed as a dependency with, e.g. `npm install chromadb-default-embed`"
      );
    }
  }
};

// src/ChromaClient.ts
var DEFAULT_TENANT2 = "default_tenant";
var DEFAULT_DATABASE2 = "default_database";
var ChromaClient = class {
  /**
   * Creates a new ChromaClient instance.
   * @param {Object} params - The parameters for creating a new client
   * @param {string} [params.path] - The base path for the Chroma API.
   * @returns {ChromaClient} A new ChromaClient instance.
   *
   * @example
   * ```typescript
   * const client = new ChromaClient({
   *   path: "http://localhost:8000"
   * });
   * ```
   */
  constructor({
    path = "http://localhost:8000",
    fetchOptions,
    auth,
    tenant = DEFAULT_TENANT2,
    database = DEFAULT_DATABASE2
  } = {}) {
    this.tenant = tenant;
    this.database = database;
    this.authProvider = void 0;
    const apiConfig = new Configuration({
      basePath: path
    });
    this.api = new ApiApi(apiConfig, void 0, chromaFetch);
    this.api.options = fetchOptions != null ? fetchOptions : {};
    if (auth !== void 0) {
      this.authProvider = authOptionsToAuthProvider(auth);
      this.api.options.headers = __spreadValues(__spreadValues({}, this.api.options.headers), this.authProvider.authenticate());
    }
    this._adminClient = new AdminClient({
      path,
      fetchOptions,
      auth,
      tenant,
      database
    });
  }
  /** @ignore */
  async init() {
    if (!this._initPromise) {
      if (this.authProvider !== void 0) {
        await this.getUserIdentity();
      }
      this._initPromise = validateTenantDatabase(
        this._adminClient,
        this.tenant,
        this.database
      );
    }
    return this._initPromise;
  }
  /**
   * Tries to set the tenant and database for the client.
   *
   * @returns {Promise<void>} A promise that resolves when the tenant/database is resolved.
   * @throws {Error} If there is an issue resolving the tenant and database.
   *
   */
  async getUserIdentity() {
    const user_identity = await this.api.getUserIdentity(
      this.api.options
    );
    const user_tenant = user_identity.tenant;
    const user_databases = user_identity.databases;
    if (user_tenant !== null && user_tenant !== void 0 && user_tenant !== "*" && this.tenant == DEFAULT_TENANT2) {
      this.tenant = user_tenant;
    }
    if (user_databases !== null && user_databases !== void 0 && user_databases.length == 1 && user_databases[0] !== "*" && this.database == DEFAULT_DATABASE2) {
      this.database = user_databases[0];
    }
  }
  /**
   * Resets the state of the object by making an API call to the reset endpoint.
   *
   * @returns {Promise<boolean>} A promise that resolves when the reset operation is complete.
   * @throws {ChromaConnectionError} If the client is unable to connect to the server.
   * @throws {ChromaServerError} If the server experienced an error while the state.
   *
   * @example
   * ```typescript
   * await client.reset();
   * ```
   */
  async reset() {
    await this.init();
    return await this.api.postV2Reset(this.api.options);
  }
  /**
   * Returns the version of the Chroma API.
   * @returns {Promise<string>} A promise that resolves to the version of the Chroma API.
   * @throws {ChromaConnectionError} If the client is unable to connect to the server.
   *
   * @example
   * ```typescript
   * const version = await client.version();
   * ```
   */
  async version() {
    return await this.api.getV2Version(this.api.options);
  }
  /**
   * Returns a heartbeat from the Chroma API.
   * @returns {Promise<number>} A promise that resolves to the heartbeat from the Chroma API.
   * @throws {ChromaConnectionError} If the client is unable to connect to the server.
   *
   * @example
   * ```typescript
   * const heartbeat = await client.heartbeat();
   * ```
   */
  async heartbeat() {
    const response = await this.api.getV2Heartbeat(this.api.options);
    return response["nanosecond heartbeat"];
  }
  /**
   * Creates a new collection with the specified properties.
   *
   * @param {Object} params - The parameters for creating a new collection.
   * @param {string} params.name - The name of the collection.
   * @param {CollectionMetadata} [params.metadata] - Optional metadata associated with the collection.
   * @param {IEmbeddingFunction} [params.embeddingFunction] - Optional custom embedding function for the collection.
   *
   * @returns {Promise<Collection>} A promise that resolves to the created collection.
   * @throws {ChromaConnectionError} If the client is unable to connect to the server.
   * @throws {ChromaServerError} If there is an issue creating the collection.
   *
   * @example
   * ```typescript
   * const collection = await client.createCollection({
   *   name: "my_collection",
   *   metadata: {
   *     "description": "My first collection"
   *   }
   * });
   * ```
   */
  async createCollection({
    name,
    metadata,
    embeddingFunction = new DefaultEmbeddingFunction()
  }) {
    await this.init();
    const newCollection = await this.api.createCollection(
      this.tenant,
      this.database,
      {
        name,
        // @ts-ignore: we need to generate the client libraries again
        configuration: null,
        //TODO: Configuration type in JavaScript
        metadata
      },
      this.api.options
    );
    return wrapCollection(this, {
      name: newCollection.name,
      id: newCollection.id,
      metadata: newCollection.metadata,
      embeddingFunction
    });
  }
  /**
   * Gets or creates a collection with the specified properties.
   *
   * @param {Object} params - The parameters for creating a new collection.
   * @param {string} params.name - The name of the collection.
   * @param {CollectionMetadata} [params.metadata] - Optional metadata associated with the collection.
   * @param {IEmbeddingFunction} [params.embeddingFunction] - Optional custom embedding function for the collection.
   *
   * @returns {Promise<Collection>} A promise that resolves to the got or created collection.
   * @throws {Error} If there is an issue getting or creating the collection.
   *
   * @example
   * ```typescript
   * const collection = await client.getOrCreateCollection({
   *   name: "my_collection",
   *   metadata: {
   *     "description": "My first collection"
   *   }
   * });
   * ```
   */
  async getOrCreateCollection({
    name,
    metadata,
    embeddingFunction = new DefaultEmbeddingFunction()
  }) {
    await this.init();
    const newCollection = await this.api.createCollection(
      this.tenant,
      this.database,
      {
        name,
        // @ts-ignore: we need to generate the client libraries again
        configuration: null,
        //TODO: Configuration type in JavaScript
        metadata,
        get_or_create: true
      },
      this.api.options
    );
    return wrapCollection(this, {
      name: newCollection.name,
      id: newCollection.id,
      metadata: newCollection.metadata,
      embeddingFunction
    });
  }
  /**
   * Get all collection names.
   *
   * @returns {Promise<string[]>} A promise that resolves to a list of collection names.
   * @param {PositiveInteger} [params.limit] - Optional limit on the number of items to get.
   * @param {PositiveInteger} [params.offset] - Optional offset on the items to get.
   * @throws {Error} If there is an issue listing the collections.
   *
   * @example
   * ```typescript
   * const collections = await client.listCollections({
   *     limit: 10,
   *     offset: 0,
   * });
   * ```
   */
  async listCollections({ limit, offset } = {}) {
    await this.init();
    const collections = await this.api.listCollections(
      this.tenant,
      this.database,
      limit,
      offset,
      this.api.options
    );
    return collections.map((collection) => collection.name);
  }
  /**
   * List collection names, IDs, and metadata.
   *
   * @param {PositiveInteger} [params.limit] - Optional limit on the number of items to get.
   * @param {PositiveInteger} [params.offset] - Optional offset on the items to get.
   * @throws {Error} If there is an issue listing the collections.
   * @returns {Promise<{ name: string, id: string, metadata?: CollectionMetadata }[]>} A promise that resolves to a list of collection names, IDs, and metadata.
   *
   * @example
   * ```typescript
   * const collections = await client.listCollectionsAndMetadata({
   *    limit: 10,
   *    offset: 0,
   * });
   */
  async listCollectionsAndMetadata({
    limit,
    offset
  } = {}) {
    await this.init();
    return await this.api.listCollections(
      this.tenant,
      this.database,
      limit,
      offset,
      this.api.options
    );
  }
  /**
   * Counts all collections.
   *
   * @returns {Promise<number>} A promise that resolves to the number of collections.
   * @throws {Error} If there is an issue counting the collections.
   *
   * @example
   * ```typescript
   * const collections = await client.countCollections();
   * ```
   */
  async countCollections() {
    await this.init();
    return await this.api.countCollections(
      this.tenant,
      this.database,
      this.api.options
    );
  }
  /**
   * Gets a collection with the specified name.
   * @param {Object} params - The parameters for getting a collection.
   * @param {string} params.name - The name of the collection.
   * @param {IEmbeddingFunction} [params.embeddingFunction] - Optional custom embedding function for the collection.
   * @returns {Promise<Collection>} A promise that resolves to the collection.
   * @throws {Error} If there is an issue getting the collection.
   *
   * @example
   * ```typescript
   * const collection = await client.getCollection({
   *   name: "my_collection"
   * });
   * ```
   */
  async getCollection({
    name,
    embeddingFunction
  }) {
    await this.init();
    const response = await this.api.getCollection(
      this.tenant,
      this.database,
      name,
      this.api.options
    );
    return wrapCollection(this, {
      name: response.name,
      id: response.id,
      metadata: response.metadata,
      embeddingFunction
    });
  }
  /**
   * Deletes a collection with the specified name.
   * @param {Object} params - The parameters for deleting a collection.
   * @param {string} params.name - The name of the collection.
   * @returns {Promise<void>} A promise that resolves when the collection is deleted.
   * @throws {Error} If there is an issue deleting the collection.
   *
   * @example
   * ```typescript
   * await client.deleteCollection({
   *  name: "my_collection"
   * });
   * ```
   */
  async deleteCollection({ name }) {
    await this.init();
    await this.api.deleteCollection(
      name,
      this.tenant,
      this.database,
      this.api.options
    );
  }
};

// src/CloudClient.ts
var CloudClient = class extends ChromaClient {
  constructor({
    apiKey,
    database,
    tenant,
    cloudHost,
    cloudPort
  }) {
    if (!apiKey) {
      apiKey = process.env.CHROMA_API_KEY;
    }
    if (!apiKey) {
      throw new Error("No API key provided");
    }
    cloudHost = cloudHost || "https://api.trychroma.com";
    cloudPort = cloudPort || "8000";
    const path = `${cloudHost}:${cloudPort}`;
    const auth = {
      provider: "token",
      credentials: apiKey,
      tokenHeaderType: "X_CHROMA_TOKEN"
    };
    return new ChromaClient({
      path,
      auth,
      database,
      tenant
    });
    super();
  }
};

// src/embeddings/OpenAIEmbeddingFunction.ts
var OpenAIApi;
var openAiVersion = null;
var openAiMajorVersion = null;
var OpenAIAPIv3 = class {
  constructor(configuration) {
    this.configuration = new OpenAIApi.Configuration({
      organization: configuration.organization,
      apiKey: configuration.apiKey
    });
    this.openai = new OpenAIApi.OpenAIApi(this.configuration);
  }
  async createEmbedding(params) {
    const embeddings = [];
    const response = await this.openai.createEmbedding({
      model: params.model,
      input: params.input
    }).catch((error) => {
      throw error;
    });
    const data = response.data["data"];
    for (let i = 0; i < data.length; i += 1) {
      embeddings.push(data[i]["embedding"]);
    }
    return embeddings;
  }
};
var OpenAIAPIv4 = class {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.openai = new OpenAIApi({
      apiKey: this.apiKey
    });
  }
  async createEmbedding(params) {
    const embeddings = [];
    const response = await this.openai.embeddings.create(params);
    const data = response["data"];
    for (let i = 0; i < data.length; i += 1) {
      embeddings.push(data[i]["embedding"]);
    }
    return embeddings;
  }
};
var OpenAIEmbeddingFunction = class _OpenAIEmbeddingFunction {
  constructor({
    openai_api_key,
    openai_model,
    openai_organization_id,
    openai_embedding_dimensions
  }) {
    this.api_key = openai_api_key;
    this.org_id = openai_organization_id || "";
    this.model = openai_model || "text-embedding-ada-002";
    this.dimensions = openai_embedding_dimensions;
  }
  async loadClient() {
    if (this.openaiApi)
      return;
    try {
      const { openai, version } = await _OpenAIEmbeddingFunction.import();
      OpenAIApi = openai;
      let versionVar = version;
      openAiVersion = versionVar.replace(/[^0-9.]/g, "");
      openAiMajorVersion = parseInt(openAiVersion.split(".")[0]);
    } catch (_a) {
      if (_a.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Please install the openai package to use the OpenAIEmbeddingFunction, e.g. `npm install openai`"
        );
      }
      throw _a;
    }
    if (openAiMajorVersion > 3) {
      this.openaiApi = new OpenAIAPIv4(this.api_key);
    } else {
      this.openaiApi = new OpenAIAPIv3({
        organization: this.org_id,
        apiKey: this.api_key
      });
    }
  }
  async generate(texts) {
    await this.loadClient();
    return await this.openaiApi.createEmbedding({
      model: this.model,
      input: texts,
      dimensions: this.dimensions
    }).catch((error) => {
      throw error;
    });
  }
  /** @ignore */
  static async import() {
    try {
      const { default: openai } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! openai */ "./node_modules/openai/index.mjs"));
      const { VERSION } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! openai/version */ "./node_modules/openai/version.mjs"));
      return { openai, version: VERSION };
    } catch (e) {
      throw new Error(
        "Please install the openai package to use the OpenAIEmbeddingFunction, e.g. `npm install openai`"
      );
    }
  }
};

// src/embeddings/CohereEmbeddingFunction.ts
var CohereAISDK56 = class {
  constructor(configuration) {
    this.apiKey = configuration.apiKey;
  }
  async loadClient() {
    if (this.cohereClient)
      return;
    const { default: cohere } = await __webpack_require__.e(/*! import() */ "node_modules_cohere-ai_index_js").then(__webpack_require__.t.bind(__webpack_require__, /*! cohere-ai */ "./node_modules/cohere-ai/index.js", 19));
    cohere.init(this.apiKey);
    this.cohereClient = cohere;
  }
  async createEmbedding(params) {
    await this.loadClient();
    return await this.cohereClient.embed({
      texts: params.input,
      model: params.model
    }).then((response) => {
      return response.body.embeddings;
    });
  }
};
var CohereAISDK7 = class {
  constructor(configuration) {
    this.apiKey = configuration.apiKey;
  }
  async loadClient() {
    if (this.cohereClient)
      return;
    const cohere = await __webpack_require__.e(/*! import() */ "node_modules_cohere-ai_index_js").then(__webpack_require__.t.bind(__webpack_require__, /*! cohere-ai */ "./node_modules/cohere-ai/index.js", 19)).then((cohere2) => {
      return cohere2;
    });
    this.cohereClient = new cohere.CohereClient({
      token: this.apiKey
    });
  }
  async createEmbedding(params) {
    await this.loadClient();
    return await this.cohereClient.embed({ texts: params.input, model: params.model }).then((response) => {
      return response.embeddings;
    });
  }
};
var CohereEmbeddingFunction = class {
  constructor({
    cohere_api_key,
    model
  }) {
    this.model = model || "large";
    this.apiKey = cohere_api_key;
  }
  async initCohereClient() {
    if (this.cohereAiApi)
      return;
    try {
      this.cohereAiApi = await __webpack_require__.e(/*! import() */ "node_modules_cohere-ai_index_js").then(__webpack_require__.t.bind(__webpack_require__, /*! cohere-ai */ "./node_modules/cohere-ai/index.js", 19)).then((cohere) => {
        if (cohere.CohereClient) {
          return new CohereAISDK7({ apiKey: this.apiKey });
        } else {
          return new CohereAISDK56({ apiKey: this.apiKey });
        }
      });
    } catch (e) {
      if (e.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Please install the cohere-ai package to use the CohereEmbeddingFunction, `npm install -S cohere-ai`"
        );
      }
      throw e;
    }
  }
  async generate(texts) {
    await this.initCohereClient();
    return await this.cohereAiApi.createEmbedding({
      model: this.model,
      input: texts
    });
  }
};

// src/embeddings/TransformersEmbeddingFunction.ts
var TransformersApi2;
var TransformersEmbeddingFunction = class _TransformersEmbeddingFunction {
  /**
   * TransformersEmbeddingFunction constructor.
   * @param options The configuration options.
   * @param options.model The model to use to calculate embeddings. Defaults to 'Xenova/all-MiniLM-L6-v2', which is an ONNX port of `sentence-transformers/all-MiniLM-L6-v2`.
   * @param options.revision The specific model version to use (can be a branch, tag name, or commit id). Defaults to 'main'.
   * @param options.quantized Whether to load the 8-bit quantized version of the model. Defaults to `false`.
   * @param options.progress_callback If specified, this function will be called during model construction, to provide the user with progress updates.
   */
  constructor({
    model = "Xenova/all-MiniLM-L6-v2",
    revision = "main",
    quantized = false,
    progress_callback = null
  } = {}) {
    this.model = model;
    this.revision = revision;
    this.quantized = quantized;
    this.progress_callback = progress_callback;
  }
  async generate(texts) {
    await this.loadClient();
    this.pipelinePromise = new Promise(async (resolve, reject) => {
      try {
        const pipeline = this.transformersApi;
        const quantized = this.quantized;
        const revision = this.revision;
        const progress_callback = this.progress_callback;
        resolve(
          await pipeline("feature-extraction", this.model, {
            quantized,
            revision,
            progress_callback
          })
        );
      } catch (e) {
        reject(e);
      }
    });
    let pipe = await this.pipelinePromise;
    let output = await pipe(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }
  async loadClient() {
    if (this.transformersApi)
      return;
    try {
      let { pipeline } = await _TransformersEmbeddingFunction.import();
      TransformersApi2 = pipeline;
    } catch (_a) {
      if (_a.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Please install the @xenova/transformers package to use the TransformersEmbeddingFunction, `npm install @xenova/transformers`"
        );
      }
      throw _a;
    }
    this.transformersApi = TransformersApi2;
  }
  /** @ignore */
  static async import() {
    try {
      const { pipeline } = await __webpack_require__.e(/*! import() */ "node_modules_xenova_transformers_src_models_js-node_modules_xenova_transformers_src_transformers_js").then(__webpack_require__.bind(__webpack_require__, /*! @xenova/transformers */ "./node_modules/@xenova/transformers/src/transformers.js"));
      return { pipeline };
    } catch (e) {
      throw new Error(
        "Please install @xenova/transformers as a dependency with, e.g. `npm install @xenova/transformers`"
      );
    }
  }
};

// src/embeddings/HuggingFaceEmbeddingServerFunction.ts
var HuggingFaceEmbeddingServerFunction = class {
  constructor({ url }) {
    this.url = url;
  }
  async generate(texts) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: texts })
    });
    if (!response.ok) {
      throw new Error(`Failed to generate embeddings: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }
};

// src/embeddings/JinaEmbeddingFunction.ts
var JinaEmbeddingFunction = class {
  constructor({
    jinaai_api_key,
    model_name
  }) {
    this.model_name = model_name || "jina-embeddings-v2-base-en";
    this.api_url = "https://api.jina.ai/v1/embeddings";
    this.headers = {
      Authorization: `Bearer ${jinaai_api_key}`,
      "Accept-Encoding": "identity",
      "Content-Type": "application/json"
    };
  }
  async generate(texts) {
    try {
      const response = await fetch(this.api_url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          input: texts,
          model: this.model_name
        })
      });
      const data = await response.json();
      if (!data || !data.data) {
        throw new Error(data.detail);
      }
      const embeddings = data.data;
      const sortedEmbeddings = embeddings.sort((a, b) => a.index - b.index);
      return sortedEmbeddings.map((result) => result.embedding);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error calling Jina AI API: ${error.message}`);
      } else {
        throw new Error(`Error calling Jina AI API: ${error}`);
      }
    }
  }
};

// src/embeddings/GoogleGeminiEmbeddingFunction.ts
var googleGenAiApi;
var GoogleGenerativeAiEmbeddingFunction = class _GoogleGenerativeAiEmbeddingFunction {
  constructor({
    googleApiKey,
    model,
    taskType
  }) {
    this.api_key = googleApiKey;
    this.model = model || "embedding-001";
    this.taskType = taskType || "RETRIEVAL_DOCUMENT";
  }
  async loadClient() {
    if (this.googleGenAiApi)
      return;
    try {
      const { googleGenAi } = await _GoogleGenerativeAiEmbeddingFunction.import();
      googleGenAiApi = googleGenAi;
      googleGenAiApi = new googleGenAiApi(this.api_key);
    } catch (_a) {
      if (_a.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Please install the @google/generative-ai package to use the GoogleGenerativeAiEmbeddingFunction, `npm install @google/generative-ai`"
        );
      }
      throw _a;
    }
    this.googleGenAiApi = googleGenAiApi;
  }
  async generate(texts) {
    await this.loadClient();
    const model = this.googleGenAiApi.getGenerativeModel({ model: this.model });
    const response = await model.batchEmbedContents({
      requests: texts.map((t) => ({
        content: { parts: [{ text: t }] },
        taskType: this.taskType
      }))
    });
    const embeddings = response.embeddings.map((e) => e.values);
    return embeddings;
  }
  /** @ignore */
  static async import() {
    try {
      const { GoogleGenerativeAI } = await __webpack_require__.e(/*! import() */ "node_modules_google_generative-ai_dist_index_mjs").then(__webpack_require__.bind(__webpack_require__, /*! @google/generative-ai */ "./node_modules/@google/generative-ai/dist/index.mjs"));
      const googleGenAi = GoogleGenerativeAI;
      return { googleGenAi };
    } catch (e) {
      throw new Error(
        "Please install @google/generative-ai as a dependency with, e.g. `npm install @google/generative-ai`"
      );
    }
  }
};

// src/embeddings/OllamaEmbeddingFunction.ts
var DEFAULT_MODEL = "chroma/all-minilm-l6-v2-f32";
var DEFAULT_LOCAL_URL = "http://localhost:11434";
var OllamaEmbeddingFunction = class _OllamaEmbeddingFunction {
  constructor({
    url = DEFAULT_LOCAL_URL,
    model = DEFAULT_MODEL
  } = {
    url: DEFAULT_LOCAL_URL,
    model: DEFAULT_MODEL
  }) {
    if (url && url.endsWith("/api/embeddings")) {
      this.url = url.slice(0, -"/api/embeddings".length);
    } else {
      this.url = url || DEFAULT_LOCAL_URL;
    }
    this.model = model || DEFAULT_MODEL;
  }
  async initClient() {
    if (this.ollamaClient)
      return;
    try {
      const { ollama } = await _OllamaEmbeddingFunction.import();
      this.ollamaClient = new ollama.Ollama({ host: this.url });
    } catch (e) {
      if (e.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "Please install the ollama package to use the OllamaEmbeddingFunction, `npm install -S ollama`"
        );
      }
      throw e;
    }
  }
  /** @ignore */
  static async import() {
    try {
      const { ollama } = await Promise.resolve().then(function webpackMissingModule() { var e = new Error("Cannot find module 'ollama'"); e.code = 'MODULE_NOT_FOUND'; throw e; }).then((m) => ({ ollama: m }));
      return { ollama };
    } catch (e) {
      throw new Error(
        "Please install Ollama as a dependency with, e.g. `npm install ollama`"
      );
    }
  }
  async generate(texts) {
    await this.initClient();
    return await this.ollamaClient.embed({
      model: this.model,
      input: texts
    }).then((response) => {
      return response.embeddings;
    });
  }
};

// src/types.ts
var IncludeEnum = /* @__PURE__ */ ((IncludeEnum2) => {
  IncludeEnum2["Documents"] = "documents";
  IncludeEnum2["Embeddings"] = "embeddings";
  IncludeEnum2["Metadatas"] = "metadatas";
  IncludeEnum2["Distances"] = "distances";
  return IncludeEnum2;
})(IncludeEnum || {});

//# sourceMappingURL=chromadb.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/_shims/MultipartBody.mjs":
/*!********************************************************!*\
  !*** ./node_modules/groq-sdk/_shims/MultipartBody.mjs ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./node_modules/groq-sdk/_shims/index.mjs":
/*!************************************************!*\
  !*** ./node_modules/groq-sdk/_shims/index.mjs ***!
  \************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var _registry_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./registry.mjs */ "./node_modules/groq-sdk/_shims/registry.mjs");
/* harmony import */ var groq_sdk_shims_auto_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! groq-sdk/_shims/auto/runtime */ "./node_modules/groq-sdk/_shims/web-runtime.mjs");
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */


if (!_registry_mjs__WEBPACK_IMPORTED_MODULE_0__.kind) _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.setShims(groq_sdk_shims_auto_runtime__WEBPACK_IMPORTED_MODULE_1__.getRuntime(), { auto: true });



/***/ }),

/***/ "./node_modules/groq-sdk/_shims/registry.mjs":
/*!***************************************************!*\
  !*** ./node_modules/groq-sdk/_shims/registry.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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
        throw new Error(`you must \`import 'groq-sdk/shims/${shims.kind}'\` before importing anything else from groq-sdk`);
    }
    if (kind) {
        throw new Error(`can't \`import 'groq-sdk/shims/${shims.kind}'\` after \`import 'groq-sdk/shims/${kind}'\``);
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

/***/ "./node_modules/groq-sdk/_shims/web-runtime.mjs":
/*!******************************************************!*\
  !*** ./node_modules/groq-sdk/_shims/web-runtime.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntime: () => (/* binding */ getRuntime)
/* harmony export */ });
/* harmony import */ var _MultipartBody_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./MultipartBody.mjs */ "./node_modules/groq-sdk/_shims/MultipartBody.mjs");

function getRuntime({ manuallyImported } = {}) {
    const recommendation = manuallyImported ?
        `You may need to use polyfills`
        : `Add one of these imports before your first \`import … from 'groq-sdk'\`:
- \`import 'groq-sdk/shims/node'\` (if you're running on Node)
- \`import 'groq-sdk/shims/web'\` (otherwise)
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
            throw new Error('The `fileFromPath` function is only supported in Node. See the README for more details: https://www.github.com/groq/groq-typescript#file-uploads');
        },
        isFsReadStream: (value) => false,
    };
}
//# sourceMappingURL=web-runtime.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/core.mjs":
/*!****************************************!*\
  !*** ./node_modules/groq-sdk/core.mjs ***!
  \****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var _version_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./version.mjs */ "./node_modules/groq-sdk/version.mjs");
/* harmony import */ var _lib_streaming_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./lib/streaming.mjs */ "./node_modules/groq-sdk/lib/streaming.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/groq-sdk/error.mjs");
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/groq-sdk/_shims/index.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/groq-sdk/uploads.mjs");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];
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
        return _lib_streaming_mjs__WEBPACK_IMPORTED_MODULE_2__.Stream.fromSSEResponse(response, props.controller);
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
        return json;
    }
    const text = await response.text();
    debug('response', response.status, response.url, response.headers, text);
    // TODO handle blob, arraybuffer, other content types, etc.
    return text;
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
        return new APIPromise(this.responsePromise, async (props) => transform(await this.parseResponse(props), props));
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
     * or add one of these imports before your first `import … from 'groq-sdk'`:
     * - `import 'groq-sdk/shims/node'` (if you're running on Node)
     * - `import 'groq-sdk/shims/web'` (otherwise)
     */
    asResponse() {
        return this.responsePromise.then((p) => p.response);
    }
    /**
     * Gets the parsed response data and the raw `Response` instance.
     *
     * If you just want to get the raw `Response` instance without parsing it,
     * you can use {@link asResponse()}.
     *
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` if you can,
     * or add one of these imports before your first `import … from 'groq-sdk'`:
     * - `import 'groq-sdk/shims/node'` (if you're running on Node)
     * - `import 'groq-sdk/shims/web'` (otherwise)
     */
    async withResponse() {
        const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
        return { data, response };
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
    constructor({ baseURL, maxRetries = 2, timeout = 60000, // 1 minute
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
        const timeout = options.timeout ?? this.timeout;
        const httpAgent = options.httpAgent ?? this.httpAgent ?? (0,_shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.getDefaultAgent)(url);
        const minAgentTimeout = timeout + 1000;
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
        return { req, url, timeout };
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
        // Don't set the retry count header if it was already set or removed through default headers or by the
        // caller. We check `defaultHeaders` and `headers`, which can contain nulls, instead of `reqHeaders` to
        // account for the removal case.
        if (getHeader(defaultHeaders, 'x-stainless-retry-count') === undefined &&
            getHeader(headers, 'x-stainless-retry-count') === undefined) {
            reqHeaders['x-stainless-retry-count'] = String(retryCount);
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
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError(`Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
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
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError('No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.');
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
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError(`${name} must be an integer`);
    }
    if (n < 0) {
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError(`${name} must be a positive integer`);
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
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError(`Expected a value to be given but received ${value} instead.`);
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
        return process.env?.[env]?.trim() ?? undefined;
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
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
const coerceFloat = (value) => {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string')
        return parseFloat(value);
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
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
function debug(action, ...args) {
    if (typeof process !== 'undefined' && process?.env?.['DEBUG'] === 'true') {
        console.log(`Groq:DEBUG:${action}`, ...args);
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
    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_3__.GroqError('Cannot generate b64 string; Expected `Buffer` or `btoa` to be defined');
};
function isObj(obj) {
    return obj != null && typeof obj === 'object' && !Array.isArray(obj);
}
//# sourceMappingURL=core.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/error.mjs":
/*!*****************************************!*\
  !*** ./node_modules/groq-sdk/error.mjs ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   APIConnectionError: () => (/* binding */ APIConnectionError),
/* harmony export */   APIConnectionTimeoutError: () => (/* binding */ APIConnectionTimeoutError),
/* harmony export */   APIError: () => (/* binding */ APIError),
/* harmony export */   APIUserAbortError: () => (/* binding */ APIUserAbortError),
/* harmony export */   AuthenticationError: () => (/* binding */ AuthenticationError),
/* harmony export */   BadRequestError: () => (/* binding */ BadRequestError),
/* harmony export */   ConflictError: () => (/* binding */ ConflictError),
/* harmony export */   GroqError: () => (/* binding */ GroqError),
/* harmony export */   InternalServerError: () => (/* binding */ InternalServerError),
/* harmony export */   NotFoundError: () => (/* binding */ NotFoundError),
/* harmony export */   PermissionDeniedError: () => (/* binding */ PermissionDeniedError),
/* harmony export */   RateLimitError: () => (/* binding */ RateLimitError),
/* harmony export */   UnprocessableEntityError: () => (/* binding */ UnprocessableEntityError)
/* harmony export */ });
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/groq-sdk/core.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class GroqError extends Error {
}
class APIError extends GroqError {
    constructor(status, error, message, headers) {
        super(`${APIError.makeMessage(status, error, message)}`);
        this.status = status;
        this.headers = headers;
        this.error = error;
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
        const error = errorResponse;
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
//# sourceMappingURL=error.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/index.mjs":
/*!*****************************************!*\
  !*** ./node_modules/groq-sdk/index.mjs ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   APIConnectionError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionError),
/* harmony export */   APIConnectionTimeoutError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionTimeoutError),
/* harmony export */   APIError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError),
/* harmony export */   APIUserAbortError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError),
/* harmony export */   AuthenticationError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.AuthenticationError),
/* harmony export */   BadRequestError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.BadRequestError),
/* harmony export */   ConflictError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.ConflictError),
/* harmony export */   Groq: () => (/* binding */ Groq),
/* harmony export */   GroqError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError),
/* harmony export */   InternalServerError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.InternalServerError),
/* harmony export */   NotFoundError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.NotFoundError),
/* harmony export */   PermissionDeniedError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.PermissionDeniedError),
/* harmony export */   RateLimitError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.RateLimitError),
/* harmony export */   UnprocessableEntityError: () => (/* reexport safe */ _error_mjs__WEBPACK_IMPORTED_MODULE_1__.UnprocessableEntityError),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   fileFromPath: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_10__.fileFromPath),
/* harmony export */   toFile: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_9__.toFile)
/* harmony export */ });
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/groq-sdk/core.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/groq-sdk/error.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/groq-sdk/uploads.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/groq-sdk/_shims/index.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./resources/completions.mjs */ "./node_modules/groq-sdk/resources/completions.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./resources/chat/chat.mjs */ "./node_modules/groq-sdk/resources/chat/chat.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./resources/embeddings.mjs */ "./node_modules/groq-sdk/resources/embeddings.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./resources/audio/audio.mjs */ "./node_modules/groq-sdk/resources/audio/audio.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./resources/models.mjs */ "./node_modules/groq-sdk/resources/models.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./resources/batches.mjs */ "./node_modules/groq-sdk/resources/batches.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./resources/files.mjs */ "./node_modules/groq-sdk/resources/files.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _a;











/**
 * API Client for interfacing with the Groq API.
 */
class Groq extends _core_mjs__WEBPACK_IMPORTED_MODULE_0__.APIClient {
    /**
     * API Client for interfacing with the Groq API.
     *
     * @param {string | undefined} [opts.apiKey=process.env['GROQ_API_KEY'] ?? undefined]
     * @param {string} [opts.baseURL=process.env['GROQ_BASE_URL'] ?? https://api.groq.com] - Override the default base URL for the API.
     * @param {number} [opts.timeout=1 minute] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
     */
    constructor({ baseURL = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('GROQ_BASE_URL'), apiKey = _core_mjs__WEBPACK_IMPORTED_MODULE_0__.readEnv('GROQ_API_KEY'), ...opts } = {}) {
        if (apiKey === undefined) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError("The GROQ_API_KEY environment variable is missing or empty; either provide it, or instantiate the Groq client with an apiKey option, like new Groq({ apiKey: 'My API Key' }).");
        }
        const options = {
            apiKey,
            ...opts,
            baseURL: baseURL || `https://api.groq.com`,
        };
        if (!options.dangerouslyAllowBrowser && _core_mjs__WEBPACK_IMPORTED_MODULE_0__.isRunningInBrowser()) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew Groq({ apiKey, dangerouslyAllowBrowser: true })");
        }
        super({
            baseURL: options.baseURL,
            timeout: options.timeout ?? 60000 /* 1 minute */,
            httpAgent: options.httpAgent,
            maxRetries: options.maxRetries,
            fetch: options.fetch,
        });
        this.completions = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__.Completions(this);
        this.chat = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__.Chat(this);
        this.embeddings = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__.Embeddings(this);
        this.audio = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.Audio(this);
        this.models = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__.Models(this);
        this.batches = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__.Batches(this);
        this.files = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__.Files(this);
        this._options = options;
        this.apiKey = apiKey;
    }
    defaultQuery() {
        return this._options.defaultQuery;
    }
    defaultHeaders(opts) {
        return {
            ...super.defaultHeaders(opts),
            ...this._options.defaultHeaders,
        };
    }
    authHeaders(opts) {
        return { Authorization: `Bearer ${this.apiKey}` };
    }
}
_a = Groq;
Groq.Groq = _a;
Groq.DEFAULT_TIMEOUT = 60000; // 1 minute
Groq.GroqError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError;
Groq.APIError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError;
Groq.APIConnectionError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionError;
Groq.APIConnectionTimeoutError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIConnectionTimeoutError;
Groq.APIUserAbortError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError;
Groq.NotFoundError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.NotFoundError;
Groq.ConflictError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.ConflictError;
Groq.RateLimitError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.RateLimitError;
Groq.BadRequestError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.BadRequestError;
Groq.AuthenticationError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.AuthenticationError;
Groq.InternalServerError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.InternalServerError;
Groq.PermissionDeniedError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.PermissionDeniedError;
Groq.UnprocessableEntityError = _error_mjs__WEBPACK_IMPORTED_MODULE_1__.UnprocessableEntityError;
Groq.toFile = _uploads_mjs__WEBPACK_IMPORTED_MODULE_9__.toFile;
Groq.fileFromPath = _uploads_mjs__WEBPACK_IMPORTED_MODULE_10__.fileFromPath;
Groq.Completions = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__.Completions;
Groq.Chat = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__.Chat;
Groq.Embeddings = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__.Embeddings;
Groq.Audio = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.Audio;
Groq.Models = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__.Models;
Groq.Batches = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__.Batches;
Groq.Files = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__.Files;


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Groq);
//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/lib/streaming.mjs":
/*!*************************************************!*\
  !*** ./node_modules/groq-sdk/lib/streaming.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Stream: () => (/* binding */ Stream),
/* harmony export */   readableStreamAsyncIterable: () => (/* binding */ readableStreamAsyncIterable)
/* harmony export */ });
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../_shims/index.mjs */ "./node_modules/groq-sdk/_shims/index.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/groq-sdk/error.mjs");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];



class Stream {
    constructor(iterator, controller) {
        this.iterator = iterator;
        this.controller = controller;
    }
    static fromSSEResponse(response, controller) {
        let consumed = false;
        const decoder = new SSEDecoder();
        async function* iterMessages() {
            if (!response.body) {
                controller.abort();
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError(`Attempted to iterate over a response with no body`);
            }
            const lineDecoder = new LineDecoder();
            const iter = readableStreamAsyncIterable(response.body);
            for await (const chunk of iter) {
                for (const line of lineDecoder.decode(chunk)) {
                    const sse = decoder.decode(line);
                    if (sse)
                        yield sse;
                }
            }
            for (const line of lineDecoder.flush()) {
                const sse = decoder.decode(line);
                if (sse)
                    yield sse;
            }
        }
        async function* iterator() {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const sse of iterMessages()) {
                    if (done)
                        continue;
                    if (sse.data.startsWith('[DONE]')) {
                        done = true;
                        continue;
                    }
                    if (sse.event === null || sse.event === 'error') {
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
                            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError(data.error.status_code, data.error, data.error.message, undefined);
                        }
                        yield data;
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
            const lineDecoder = new LineDecoder();
            const iter = readableStreamAsyncIterable(readableStream);
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
/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */
class LineDecoder {
    constructor() {
        this.buffer = [];
        this.trailingCR = false;
    }
    decode(chunk) {
        let text = this.decodeText(chunk);
        if (this.trailingCR) {
            text = '\r' + text;
            this.trailingCR = false;
        }
        if (text.endsWith('\r')) {
            this.trailingCR = true;
            text = text.slice(0, -1);
        }
        if (!text) {
            return [];
        }
        const trailingNewline = LineDecoder.NEWLINE_CHARS.has(text[text.length - 1] || '');
        let lines = text.split(LineDecoder.NEWLINE_REGEXP);
        if (lines.length === 1 && !trailingNewline) {
            this.buffer.push(lines[0]);
            return [];
        }
        if (this.buffer.length > 0) {
            lines = [this.buffer.join('') + lines[0], ...lines.slice(1)];
            this.buffer = [];
        }
        if (!trailingNewline) {
            this.buffer = [lines.pop() || ''];
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
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError(`Unexpected: received non-Uint8Array (${bytes.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`);
        }
        // Browser
        if (typeof TextDecoder !== 'undefined') {
            if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
                this.textDecoder ?? (this.textDecoder = new TextDecoder('utf8'));
                return this.textDecoder.decode(bytes);
            }
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError(`Unexpected: received non-Uint8Array/ArrayBuffer (${bytes.constructor.name}) in a web platform. Please report this error.`);
        }
        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.GroqError(`Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.`);
    }
    flush() {
        if (!this.buffer.length && !this.trailingCR) {
            return [];
        }
        const lines = [this.buffer.join('')];
        this.buffer = [];
        this.trailingCR = false;
        return lines;
    }
}
// prettier-ignore
LineDecoder.NEWLINE_CHARS = new Set(['\n', '\r', '\x0b', '\x0c', '\x1c', '\x1d', '\x1e', '\x85', '\u2028', '\u2029']);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/g;
function partition(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index !== -1) {
        return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
    }
    return [str, '', ''];
}
/**
 * Most browsers don't yet have async iterable support for ReadableStream,
 * and Node has a very different way of reading bytes from its "ReadableStream".
 *
 * This polyfill was pulled from https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */
function readableStreamAsyncIterable(stream) {
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
//# sourceMappingURL=streaming.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resource.mjs":
/*!********************************************!*\
  !*** ./node_modules/groq-sdk/resource.mjs ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./node_modules/groq-sdk/resources/audio/audio.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/groq-sdk/resources/audio/audio.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Audio: () => (/* binding */ Audio)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
/* harmony import */ var _transcriptions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./transcriptions.mjs */ "./node_modules/groq-sdk/resources/audio/transcriptions.mjs");
/* harmony import */ var _translations_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./translations.mjs */ "./node_modules/groq-sdk/resources/audio/translations.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.





class Audio extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.transcriptions = new _transcriptions_mjs__WEBPACK_IMPORTED_MODULE_1__.Transcriptions(this._client);
        this.translations = new _translations_mjs__WEBPACK_IMPORTED_MODULE_2__.Translations(this._client);
    }
}
Audio.Transcriptions = _transcriptions_mjs__WEBPACK_IMPORTED_MODULE_1__.Transcriptions;
Audio.Translations = _translations_mjs__WEBPACK_IMPORTED_MODULE_2__.Translations;
//# sourceMappingURL=audio.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/audio/transcriptions.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/groq-sdk/resources/audio/transcriptions.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Transcriptions: () => (/* binding */ Transcriptions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/groq-sdk/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Transcriptions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Transcribes audio into the input language.
     */
    create(body, options) {
        return this._client.post('/openai/v1/audio/transcriptions', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
}
//# sourceMappingURL=transcriptions.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/audio/translations.mjs":
/*!****************************************************************!*\
  !*** ./node_modules/groq-sdk/resources/audio/translations.mjs ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Translations: () => (/* binding */ Translations)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/groq-sdk/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Translations extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Translates audio into English.
     */
    create(body, options) {
        return this._client.post('/openai/v1/audio/translations', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
}
//# sourceMappingURL=translations.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/batches.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/groq-sdk/resources/batches.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Batches: () => (/* binding */ Batches)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Batches extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Creates and executes a batch from an uploaded file of requests
     */
    create(body, options) {
        return this._client.post('/openai/v1/batches', { body, ...options });
    }
    /**
     * Retrieves a batch.
     */
    retrieve(batchId, options) {
        return this._client.get(`/openai/v1/batches/${batchId}`, options);
    }
    /**
     * List your organization's batches.
     */
    list(options) {
        return this._client.get('/openai/v1/batches', options);
    }
}
//# sourceMappingURL=batches.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/chat/chat.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/groq-sdk/resources/chat/chat.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Chat: () => (/* binding */ Chat)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
/* harmony import */ var _completions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./completions.mjs */ "./node_modules/groq-sdk/resources/chat/completions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class Chat extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.completions = new _completions_mjs__WEBPACK_IMPORTED_MODULE_1__.Completions(this._client);
    }
}
Chat.Completions = _completions_mjs__WEBPACK_IMPORTED_MODULE_1__.Completions;
//# sourceMappingURL=chat.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/chat/completions.mjs":
/*!**************************************************************!*\
  !*** ./node_modules/groq-sdk/resources/chat/completions.mjs ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Completions: () => (/* binding */ Completions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Completions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    create(body, options) {
        return this._client.post('/openai/v1/chat/completions', {
            body,
            ...options,
            stream: body.stream ?? false,
        });
    }
}
//# sourceMappingURL=completions.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/completions.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/groq-sdk/resources/completions.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Completions: () => (/* binding */ Completions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Completions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
}
//# sourceMappingURL=completions.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/embeddings.mjs":
/*!********************************************************!*\
  !*** ./node_modules/groq-sdk/resources/embeddings.mjs ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Embeddings: () => (/* binding */ Embeddings)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Embeddings extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Creates an embedding vector representing the input text.
     */
    create(body, options) {
        return this._client.post('/openai/v1/embeddings', { body, ...options });
    }
}
//# sourceMappingURL=embeddings.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/files.mjs":
/*!***************************************************!*\
  !*** ./node_modules/groq-sdk/resources/files.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Files: () => (/* binding */ Files)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/groq-sdk/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Files extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Upload a file that can be used across various endpoints.
     *
     * The Batch API only supports `.jsonl` files up to 100 MB in size. The input also
     * has a specific required [format](/docs/batch).
     *
     * Please contact us if you need to increase these storage limits.
     */
    create(body, options) {
        return this._client.post('/openai/v1/files', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({ body, ...options }));
    }
    /**
     * Returns a list of files.
     */
    list(options) {
        return this._client.get('/openai/v1/files', options);
    }
    /**
     * Delete a file.
     */
    delete(fileId, options) {
        return this._client.delete(`/openai/v1/files/${fileId}`, options);
    }
    /**
     * Returns the contents of the specified file.
     */
    content(fileId, options) {
        return this._client.get(`/openai/v1/files/${fileId}/content`, options);
    }
    /**
     * Returns information about a file.
     */
    info(fileId, options) {
        return this._client.get(`/openai/v1/files/${fileId}`, options);
    }
}
//# sourceMappingURL=files.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/resources/models.mjs":
/*!****************************************************!*\
  !*** ./node_modules/groq-sdk/resources/models.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Models: () => (/* binding */ Models)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/groq-sdk/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class Models extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Get a specific model
     */
    retrieve(model, options) {
        return this._client.get(`/openai/v1/models/${model}`, options);
    }
    /**
     * get all available models
     */
    list(options) {
        return this._client.get('/openai/v1/models', options);
    }
    /**
     * Delete a model
     */
    delete(model, options) {
        return this._client.delete(`/openai/v1/models/${model}`, options);
    }
}
//# sourceMappingURL=models.mjs.map

/***/ }),

/***/ "./node_modules/groq-sdk/uploads.mjs":
/*!*******************************************!*\
  !*** ./node_modules/groq-sdk/uploads.mjs ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/groq-sdk/_shims/index.mjs");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];


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

/***/ "./node_modules/groq-sdk/version.mjs":
/*!*******************************************!*\
  !*** ./node_modules/groq-sdk/version.mjs ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VERSION: () => (/* binding */ VERSION)
/* harmony export */ });
const VERSION = '0.15.0'; // x-release-please-version
//# sourceMappingURL=version.mjs.map

/***/ }),

/***/ "./node_modules/openai/_shims/MultipartBody.mjs":
/*!******************************************************!*\
  !*** ./node_modules/openai/_shims/MultipartBody.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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
/* harmony export */   init: () => (/* binding */ init),
/* harmony export */   isFsReadStream: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.isFsReadStream),
/* harmony export */   kind: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.kind),
/* harmony export */   setShims: () => (/* reexport safe */ _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.setShims)
/* harmony export */ });
/* harmony import */ var _registry_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./registry.mjs */ "./node_modules/openai/_shims/registry.mjs");
/* harmony import */ var openai_shims_auto_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! openai/_shims/auto/runtime */ "./node_modules/openai/_shims/web-runtime.mjs");
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */


const init = () => {
  if (!_registry_mjs__WEBPACK_IMPORTED_MODULE_0__.kind) _registry_mjs__WEBPACK_IMPORTED_MODULE_0__.setShims(openai_shims_auto_runtime__WEBPACK_IMPORTED_MODULE_1__.getRuntime(), { auto: true });
};


init();


/***/ }),

/***/ "./node_modules/openai/_shims/registry.mjs":
/*!*************************************************!*\
  !*** ./node_modules/openai/_shims/registry.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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
/* harmony export */   toBase64: () => (/* binding */ toBase64),
/* harmony export */   toFloat32Array: () => (/* binding */ toFloat32Array)
/* harmony export */ });
/* harmony import */ var _version_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./version.mjs */ "./node_modules/openai/version.mjs");
/* harmony import */ var _streaming_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./streaming.mjs */ "./node_modules/openai/streaming.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/openai/_shims/index.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/openai/uploads.mjs");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];
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




// try running side effects outside of _shims/index to workaround https://github.com/vercel/next.js/issues/76881
(0,_shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__.init)();


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
    const mediaType = contentType?.split(';')[0]?.trim();
    const isJSON = mediaType?.includes('application/json') || mediaType?.endsWith('+json');
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
        return process.env?.[env]?.trim() ?? undefined;
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
    if (typeof process !== 'undefined' && process?.env?.['DEBUG'] === 'true') {
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
/**
 * Converts a Base64 encoded string to a Float32Array.
 * @param base64Str - The Base64 encoded string.
 * @returns An Array of numbers interpreted as Float32 values.
 */
const toFloat32Array = (base64Str) => {
    if (typeof Buffer !== 'undefined') {
        // for Node.js environment
        return Array.from(new Float32Array(Buffer.from(base64Str, 'base64').buffer));
    }
    else {
        // for legacy web platform APIs
        const binaryStr = atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return Array.from(new Float32Array(bytes.buffer));
    }
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

"use strict";
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

"use strict";
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
/* harmony export */   fileFromPath: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_18__.fileFromPath),
/* harmony export */   toFile: () => (/* reexport safe */ _uploads_mjs__WEBPACK_IMPORTED_MODULE_17__.toFile)
/* harmony export */ });
/* harmony import */ var _internal_qs_index_mjs__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./internal/qs/index.mjs */ "./node_modules/openai/internal/qs/stringify.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/openai/uploads.mjs");
/* harmony import */ var _uploads_mjs__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./uploads.mjs */ "./node_modules/openai/_shims/index.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./resources/completions.mjs */ "./node_modules/openai/resources/completions.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./resources/chat/chat.mjs */ "./node_modules/openai/resources/chat/chat.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./resources/embeddings.mjs */ "./node_modules/openai/resources/embeddings.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./resources/files.mjs */ "./node_modules/openai/resources/files.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./resources/images.mjs */ "./node_modules/openai/resources/images.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./resources/audio/audio.mjs */ "./node_modules/openai/resources/audio/audio.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./resources/moderations.mjs */ "./node_modules/openai/resources/moderations.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./resources/models.mjs */ "./node_modules/openai/resources/models.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./resources/fine-tuning/fine-tuning.mjs */ "./node_modules/openai/resources/fine-tuning/fine-tuning.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./resources/vector-stores/vector-stores.mjs */ "./node_modules/openai/resources/vector-stores/vector-stores.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./resources/beta/beta.mjs */ "./node_modules/openai/resources/beta/beta.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./resources/batches.mjs */ "./node_modules/openai/resources/batches.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./resources/uploads/uploads.mjs */ "./node_modules/openai/resources/uploads/uploads.mjs");
/* harmony import */ var _resources_index_mjs__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./resources/responses/responses.mjs */ "./node_modules/openai/resources/responses/responses.mjs");
/* harmony import */ var _resources_chat_completions_completions_mjs__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./resources/chat/completions/completions.mjs */ "./node_modules/openai/resources/chat/completions/completions.mjs");
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
        this.vectorStores = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__.VectorStores(this);
        this.beta = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__.Beta(this);
        this.batches = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__.Batches(this);
        this.uploads = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_14__.Uploads(this);
        this.responses = new _resources_index_mjs__WEBPACK_IMPORTED_MODULE_15__.Responses(this);
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
        return _internal_qs_index_mjs__WEBPACK_IMPORTED_MODULE_16__.stringify(query, { arrayFormat: 'brackets' });
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
OpenAI.toFile = _uploads_mjs__WEBPACK_IMPORTED_MODULE_17__.toFile;
OpenAI.fileFromPath = _uploads_mjs__WEBPACK_IMPORTED_MODULE_18__.fileFromPath;
OpenAI.Completions = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_2__.Completions;
OpenAI.Chat = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_3__.Chat;
OpenAI.ChatCompletionsPage = _resources_chat_completions_completions_mjs__WEBPACK_IMPORTED_MODULE_19__.ChatCompletionsPage;
OpenAI.Embeddings = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_4__.Embeddings;
OpenAI.Files = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.Files;
OpenAI.FileObjectsPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_5__.FileObjectsPage;
OpenAI.Images = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_6__.Images;
OpenAI.Audio = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_7__.Audio;
OpenAI.Moderations = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_8__.Moderations;
OpenAI.Models = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__.Models;
OpenAI.ModelsPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_9__.ModelsPage;
OpenAI.FineTuning = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_10__.FineTuning;
OpenAI.VectorStores = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__.VectorStores;
OpenAI.VectorStoresPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__.VectorStoresPage;
OpenAI.VectorStoreSearchResponsesPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_11__.VectorStoreSearchResponsesPage;
OpenAI.Beta = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_12__.Beta;
OpenAI.Batches = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__.Batches;
OpenAI.BatchesPage = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_13__.BatchesPage;
OpenAI.Uploads = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_14__.Uploads;
OpenAI.Responses = _resources_index_mjs__WEBPACK_IMPORTED_MODULE_15__.Responses;
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
                endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LineDecoder: () => (/* binding */ LineDecoder),
/* harmony export */   findDoubleNewlineIndex: () => (/* binding */ findDoubleNewlineIndex)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../error.mjs */ "./node_modules/openai/error.mjs");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];
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
function findDoubleNewlineIndex(buffer) {
    // This function searches the buffer for the end patterns (\r\r, \n\n, \r\n\r\n)
    // and returns the index right after the first occurrence of any pattern,
    // or -1 if none of the patterns are found.
    const newline = 0x0a; // \n
    const carriage = 0x0d; // \r
    for (let i = 0; i < buffer.length - 1; i++) {
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
//# sourceMappingURL=line.mjs.map

/***/ }),

/***/ "./node_modules/openai/internal/qs/formats.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/internal/qs/formats.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "./node_modules/openai/lib/ResponsesParser.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/lib/ResponsesParser.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addOutputText: () => (/* binding */ addOutputText),
/* harmony export */   hasAutoParseableInput: () => (/* binding */ hasAutoParseableInput),
/* harmony export */   isAutoParsableTool: () => (/* binding */ isAutoParsableTool),
/* harmony export */   makeParseableResponseTool: () => (/* binding */ makeParseableResponseTool),
/* harmony export */   maybeParseResponse: () => (/* binding */ maybeParseResponse),
/* harmony export */   parseResponse: () => (/* binding */ parseResponse),
/* harmony export */   shouldParseToolCall: () => (/* binding */ shouldParseToolCall),
/* harmony export */   validateInputTools: () => (/* binding */ validateInputTools)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _lib_parser_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/parser.mjs */ "./node_modules/openai/lib/parser.mjs");


function maybeParseResponse(response, params) {
    if (!params || !hasAutoParseableInput(params)) {
        return {
            ...response,
            output_parsed: null,
            output: response.output.map((item) => {
                if (item.type === 'function_call') {
                    return {
                        ...item,
                        parsed_arguments: null,
                    };
                }
                if (item.type === 'message') {
                    return {
                        ...item,
                        content: item.content.map((content) => ({
                            ...content,
                            parsed: null,
                        })),
                    };
                }
                else {
                    return item;
                }
            }),
        };
    }
    return parseResponse(response, params);
}
function parseResponse(response, params) {
    const output = response.output.map((item) => {
        if (item.type === 'function_call') {
            return {
                ...item,
                parsed_arguments: parseToolCall(params, item),
            };
        }
        if (item.type === 'message') {
            const content = item.content.map((content) => {
                if (content.type === 'output_text') {
                    return {
                        ...content,
                        parsed: parseTextFormat(params, content.text),
                    };
                }
                return content;
            });
            return {
                ...item,
                content,
            };
        }
        return item;
    });
    const parsed = Object.assign({}, response, { output });
    if (!Object.getOwnPropertyDescriptor(response, 'output_text')) {
        addOutputText(parsed);
    }
    Object.defineProperty(parsed, 'output_parsed', {
        enumerable: true,
        get() {
            for (const output of parsed.output) {
                if (output.type !== 'message') {
                    continue;
                }
                for (const content of output.content) {
                    if (content.type === 'output_text' && content.parsed !== null) {
                        return content.parsed;
                    }
                }
            }
            return null;
        },
    });
    return parsed;
}
function parseTextFormat(params, content) {
    if (params.text?.format?.type !== 'json_schema') {
        return null;
    }
    if ('$parseRaw' in params.text?.format) {
        const text_format = params.text?.format;
        return text_format.$parseRaw(content);
    }
    return JSON.parse(content);
}
function hasAutoParseableInput(params) {
    if ((0,_lib_parser_mjs__WEBPACK_IMPORTED_MODULE_0__.isAutoParsableResponseFormat)(params.text?.format)) {
        return true;
    }
    return false;
}
function makeParseableResponseTool(tool, { parser, callback, }) {
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
function getInputToolByName(input_tools, name) {
    return input_tools.find((tool) => tool.type === 'function' && tool.name === name);
}
function parseToolCall(params, toolCall) {
    const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
    return {
        ...toolCall,
        ...toolCall,
        parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.arguments)
            : inputTool?.strict ? JSON.parse(toolCall.arguments)
                : null,
    };
}
function shouldParseToolCall(params, toolCall) {
    if (!params) {
        return false;
    }
    const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
    return isAutoParsableTool(inputTool) || inputTool?.strict || false;
}
function validateInputTools(tools) {
    for (const tool of tools ?? []) {
        if (tool.type !== 'function') {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
        }
        if (tool.function.strict !== true) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
        }
    }
}
function addOutputText(rsp) {
    const texts = [];
    for (const output of rsp.output) {
        if (output.type !== 'message') {
            continue;
        }
        for (const content of output.content) {
            if (content.type === 'output_text') {
                texts.push(content.text);
            }
        }
    }
    rsp.output_text = texts.join('');
}
//# sourceMappingURL=ResponsesParser.mjs.map

/***/ }),

/***/ "./node_modules/openai/lib/RunnableFunction.mjs":
/*!******************************************************!*\
  !*** ./node_modules/openai/lib/RunnableFunction.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hasAutoParseableInput: () => (/* binding */ hasAutoParseableInput),
/* harmony export */   isAutoParsableResponseFormat: () => (/* binding */ isAutoParsableResponseFormat),
/* harmony export */   isAutoParsableTool: () => (/* binding */ isAutoParsableTool),
/* harmony export */   makeParseableResponseFormat: () => (/* binding */ makeParseableResponseFormat),
/* harmony export */   makeParseableTextFormat: () => (/* binding */ makeParseableTextFormat),
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
function makeParseableTextFormat(response_format, parser) {
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
                message: {
                    ...choice.message,
                    parsed: null,
                    ...(choice.message.tool_calls ?
                        {
                            tool_calls: choice.message.tool_calls,
                        }
                        : undefined),
                },
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
                ...(choice.message.tool_calls ?
                    {
                        tool_calls: choice.message.tool_calls?.map((toolCall) => parseToolCall(params, toolCall)) ?? undefined,
                    }
                    : undefined),
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

/***/ "./node_modules/openai/lib/responses/ResponseStream.mjs":
/*!**************************************************************!*\
  !*** ./node_modules/openai/lib/responses/ResponseStream.mjs ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ResponseStream: () => (/* binding */ ResponseStream)
/* harmony export */ });
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _EventStream_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../EventStream.mjs */ "./node_modules/openai/lib/EventStream.mjs");
/* harmony import */ var _ResponsesParser_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../ResponsesParser.mjs */ "./node_modules/openai/lib/ResponsesParser.mjs");
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
var _ResponseStream_instances, _ResponseStream_params, _ResponseStream_currentResponseSnapshot, _ResponseStream_finalResponse, _ResponseStream_beginRequest, _ResponseStream_addEvent, _ResponseStream_endRequest, _ResponseStream_accumulateResponse;



class ResponseStream extends _EventStream_mjs__WEBPACK_IMPORTED_MODULE_0__.EventStream {
    constructor(params) {
        super();
        _ResponseStream_instances.add(this);
        _ResponseStream_params.set(this, void 0);
        _ResponseStream_currentResponseSnapshot.set(this, void 0);
        _ResponseStream_finalResponse.set(this, void 0);
        __classPrivateFieldSet(this, _ResponseStream_params, params, "f");
    }
    static createResponse(client, params, options) {
        const runner = new ResponseStream(params);
        runner._run(() => runner._createResponse(client, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    async _createResponse(client, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
        const stream = await client.responses.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIUserAbortError();
        }
        return __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
    }
    [(_ResponseStream_params = new WeakMap(), _ResponseStream_currentResponseSnapshot = new WeakMap(), _ResponseStream_finalResponse = new WeakMap(), _ResponseStream_instances = new WeakSet(), _ResponseStream_beginRequest = function _ResponseStream_beginRequest() {
        if (this.ended)
            return;
        __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, undefined, "f");
    }, _ResponseStream_addEvent = function _ResponseStream_addEvent(event) {
        if (this.ended)
            return;
        const response = __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_accumulateResponse).call(this, event);
        this._emit('event', event);
        switch (event.type) {
            case 'response.output_text.delta': {
                const output = response.output[event.output_index];
                if (!output) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'message') {
                    const content = output.content[event.content_index];
                    if (!content) {
                        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing content at index ${event.content_index}`);
                    }
                    if (content.type !== 'output_text') {
                        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`expected content to be 'output_text', got ${content.type}`);
                    }
                    this._emit('response.output_text.delta', {
                        ...event,
                        snapshot: content.text,
                    });
                }
                break;
            }
            case 'response.function_call_arguments.delta': {
                const output = response.output[event.output_index];
                if (!output) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'function_call') {
                    this._emit('response.function_call_arguments.delta', {
                        ...event,
                        snapshot: output.arguments,
                    });
                }
                break;
            }
            default:
                // @ts-ignore
                this._emit(event.type, event);
                break;
        }
    }, _ResponseStream_endRequest = function _ResponseStream_endRequest() {
        if (this.ended) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`stream has ended, this shouldn't happen`);
        }
        const snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
        if (!snapshot) {
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`request ended without sending any events`);
        }
        __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, undefined, "f");
        const parsedResponse = finalizeResponse(snapshot, __classPrivateFieldGet(this, _ResponseStream_params, "f"));
        __classPrivateFieldSet(this, _ResponseStream_finalResponse, parsedResponse, "f");
        return parsedResponse;
    }, _ResponseStream_accumulateResponse = function _ResponseStream_accumulateResponse(event) {
        let snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
        if (!snapshot) {
            if (event.type !== 'response.created') {
                throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`When snapshot hasn't been set yet, expected 'response.created' event, got ${event.type}`);
            }
            snapshot = __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
            return snapshot;
        }
        switch (event.type) {
            case 'response.output_item.added': {
                snapshot.output.push(event.item);
                break;
            }
            case 'response.content_part.added': {
                const output = snapshot.output[event.output_index];
                if (!output) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'message') {
                    output.content.push(event.part);
                }
                break;
            }
            case 'response.output_text.delta': {
                const output = snapshot.output[event.output_index];
                if (!output) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'message') {
                    const content = output.content[event.content_index];
                    if (!content) {
                        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing content at index ${event.content_index}`);
                    }
                    if (content.type !== 'output_text') {
                        throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`expected content to be 'output_text', got ${content.type}`);
                    }
                    content.text += event.delta;
                }
                break;
            }
            case 'response.function_call_arguments.delta': {
                const output = snapshot.output[event.output_index];
                if (!output) {
                    throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'function_call') {
                    output.arguments += event.delta;
                }
                break;
            }
            case 'response.completed': {
                __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
                break;
            }
        }
        return snapshot;
    }, Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
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
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((event) => (event ? { value: event, done: false } : { value: undefined, done: true }));
                }
                const event = pushQueue.shift();
                return { value: event, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    /**
     * @returns a promise that resolves with the final Response, or rejects
     * if an error occurred or the stream ended prematurely without producing a REsponse.
     */
    async finalResponse() {
        await this.done();
        const response = __classPrivateFieldGet(this, _ResponseStream_finalResponse, "f");
        if (!response)
            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.OpenAIError('stream ended without producing a ChatCompletion');
        return response;
    }
}
function finalizeResponse(snapshot, params) {
    return (0,_ResponsesParser_mjs__WEBPACK_IMPORTED_MODULE_2__.maybeParseResponse)(snapshot, params);
}
//# sourceMappingURL=ResponseStream.mjs.map

/***/ }),

/***/ "./node_modules/openai/pagination.mjs":
/*!********************************************!*\
  !*** ./node_modules/openai/pagination.mjs ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Transcriptions: () => (/* binding */ Transcriptions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/uploads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Transcriptions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    create(body, options) {
        return this._client.post('/audio/transcriptions', _core_mjs__WEBPACK_IMPORTED_MODULE_1__.multipartFormRequestOptions({
            body,
            ...options,
            stream: body.stream ?? false,
            __metadata: { model: body.model },
        }));
    }
}
//# sourceMappingURL=transcriptions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/audio/translations.mjs":
/*!**************************************************************!*\
  !*** ./node_modules/openai/resources/audio/translations.mjs ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Beta: () => (/* binding */ Beta)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _assistants_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./assistants.mjs */ "./node_modules/openai/resources/beta/assistants.mjs");
/* harmony import */ var _chat_chat_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./chat/chat.mjs */ "./node_modules/openai/resources/beta/chat/chat.mjs");
/* harmony import */ var _realtime_realtime_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./realtime/realtime.mjs */ "./node_modules/openai/resources/beta/realtime/realtime.mjs");
/* harmony import */ var _threads_threads_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./threads/threads.mjs */ "./node_modules/openai/resources/beta/threads/threads.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.









class Beta extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.realtime = new _realtime_realtime_mjs__WEBPACK_IMPORTED_MODULE_1__.Realtime(this._client);
        this.chat = new _chat_chat_mjs__WEBPACK_IMPORTED_MODULE_2__.Chat(this._client);
        this.assistants = new _assistants_mjs__WEBPACK_IMPORTED_MODULE_3__.Assistants(this._client);
        this.threads = new _threads_threads_mjs__WEBPACK_IMPORTED_MODULE_4__.Threads(this._client);
    }
}
Beta.Realtime = _realtime_realtime_mjs__WEBPACK_IMPORTED_MODULE_1__.Realtime;
Beta.Assistants = _assistants_mjs__WEBPACK_IMPORTED_MODULE_3__.Assistants;
Beta.AssistantsPage = _assistants_mjs__WEBPACK_IMPORTED_MODULE_3__.AssistantsPage;
Beta.Threads = _threads_threads_mjs__WEBPACK_IMPORTED_MODULE_4__.Threads;
//# sourceMappingURL=beta.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/chat/chat.mjs":
/*!**********************************************************!*\
  !*** ./node_modules/openai/resources/beta/chat/chat.mjs ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Realtime: () => (/* binding */ Realtime)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _sessions_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sessions.mjs */ "./node_modules/openai/resources/beta/realtime/sessions.mjs");
/* harmony import */ var _transcription_sessions_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./transcription-sessions.mjs */ "./node_modules/openai/resources/beta/realtime/transcription-sessions.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.





class Realtime extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.sessions = new _sessions_mjs__WEBPACK_IMPORTED_MODULE_1__.Sessions(this._client);
        this.transcriptionSessions = new _transcription_sessions_mjs__WEBPACK_IMPORTED_MODULE_2__.TranscriptionSessions(this._client);
    }
}
Realtime.Sessions = _sessions_mjs__WEBPACK_IMPORTED_MODULE_1__.Sessions;
Realtime.TranscriptionSessions = _transcription_sessions_mjs__WEBPACK_IMPORTED_MODULE_2__.TranscriptionSessions;
//# sourceMappingURL=realtime.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/realtime/sessions.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/openai/resources/beta/realtime/sessions.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./node_modules/openai/resources/beta/realtime/transcription-sessions.mjs":
/*!********************************************************************************!*\
  !*** ./node_modules/openai/resources/beta/realtime/transcription-sessions.mjs ***!
  \********************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TranscriptionSessions: () => (/* binding */ TranscriptionSessions)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../resource.mjs */ "./node_modules/openai/resource.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

class TranscriptionSessions extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Create an ephemeral API token for use in client-side applications with the
     * Realtime API specifically for realtime transcriptions. Can be configured with
     * the same session parameters as the `transcription_session.update` client event.
     *
     * It responds with a session object, plus a `client_secret` key which contains a
     * usable ephemeral API token that can be used to authenticate browser clients for
     * the Realtime API.
     */
    create(body, options) {
        return this._client.post('/realtime/transcription_sessions', {
            body,
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
//# sourceMappingURL=transcription-sessions.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/beta/threads/messages.mjs":
/*!*****************************************************************!*\
  !*** ./node_modules/openai/resources/beta/threads/messages.mjs ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "./node_modules/openai/resources/chat/chat.mjs":
/*!*****************************************************!*\
  !*** ./node_modules/openai/resources/chat/chat.mjs ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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
     * Get a stored chat completion. Only Chat Completions that have been created with
     * the `store` parameter set to `true` will be returned.
     */
    retrieve(completionId, options) {
        return this._client.get(`/chat/completions/${completionId}`, options);
    }
    /**
     * Modify a stored chat completion. Only Chat Completions that have been created
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
     * Delete a stored chat completion. Only Chat Completions that have been created
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

"use strict";
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

"use strict";
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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Embeddings: () => (/* binding */ Embeddings)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../core.mjs */ "./node_modules/openai/core.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.


class Embeddings extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    /**
     * Creates an embedding vector representing the input text.
     */
    create(body, options) {
        const hasUserProvidedEncodingFormat = !!body.encoding_format;
        // No encoding_format specified, defaulting to base64 for performance reasons
        // See https://github.com/openai/openai-node/pull/1312
        let encoding_format = hasUserProvidedEncodingFormat ? body.encoding_format : 'base64';
        if (hasUserProvidedEncodingFormat) {
            _core_mjs__WEBPACK_IMPORTED_MODULE_1__.debug('Request', 'User defined encoding_format:', body.encoding_format);
        }
        const response = this._client.post('/embeddings', {
            body: {
                ...body,
                encoding_format: encoding_format,
            },
            ...options,
        });
        // if the user specified an encoding_format, return the response as-is
        if (hasUserProvidedEncodingFormat) {
            return response;
        }
        // in this stage, we are sure the user did not specify an encoding_format
        // and we defaulted to base64 for performance reasons
        // we are sure then that the response is base64 encoded, let's decode it
        // the returned result will be a float32 array since this is OpenAI API's default encoding
        _core_mjs__WEBPACK_IMPORTED_MODULE_1__.debug('response', 'Decoding base64 embeddings to float32 array');
        return response._thenUnwrap((response) => {
            if (response && response.data) {
                response.data.forEach((embeddingBase64Obj) => {
                    const embeddingBase64Str = embeddingBase64Obj.embedding;
                    embeddingBase64Obj.embedding = _core_mjs__WEBPACK_IMPORTED_MODULE_1__.toFloat32Array(embeddingBase64Str);
                });
            }
            return response;
        });
    }
}
//# sourceMappingURL=embeddings.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/files.mjs":
/*!*************************************************!*\
  !*** ./node_modules/openai/resources/files.mjs ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "./node_modules/openai/resources/responses/input-items.mjs":
/*!*****************************************************************!*\
  !*** ./node_modules/openai/resources/responses/input-items.mjs ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InputItems: () => (/* binding */ InputItems),
/* harmony export */   ResponseItemsPage: () => (/* reexport safe */ _responses_mjs__WEBPACK_IMPORTED_MODULE_2__.ResponseItemsPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _responses_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./responses.mjs */ "./node_modules/openai/resources/responses/responses.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.



class InputItems extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    list(responseId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_1__.isRequestOptions)(query)) {
            return this.list(responseId, {}, query);
        }
        return this._client.getAPIList(`/responses/${responseId}/input_items`, _responses_mjs__WEBPACK_IMPORTED_MODULE_2__.ResponseItemsPage, {
            query,
            ...options,
        });
    }
}

//# sourceMappingURL=input-items.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/responses/responses.mjs":
/*!***************************************************************!*\
  !*** ./node_modules/openai/resources/responses/responses.mjs ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ResponseItemsPage: () => (/* binding */ ResponseItemsPage),
/* harmony export */   Responses: () => (/* binding */ Responses)
/* harmony export */ });
/* harmony import */ var _lib_ResponsesParser_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/ResponsesParser.mjs */ "./node_modules/openai/lib/ResponsesParser.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _input_items_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./input-items.mjs */ "./node_modules/openai/resources/responses/input-items.mjs");
/* harmony import */ var _lib_responses_ResponseStream_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../lib/responses/ResponseStream.mjs */ "./node_modules/openai/lib/responses/ResponseStream.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.







class Responses extends _resource_mjs__WEBPACK_IMPORTED_MODULE_0__.APIResource {
    constructor() {
        super(...arguments);
        this.inputItems = new _input_items_mjs__WEBPACK_IMPORTED_MODULE_1__.InputItems(this._client);
    }
    create(body, options) {
        return this._client.post('/responses', { body, ...options, stream: body.stream ?? false })._thenUnwrap((rsp) => {
            if ('object' in rsp && rsp.object === 'response') {
                (0,_lib_ResponsesParser_mjs__WEBPACK_IMPORTED_MODULE_2__.addOutputText)(rsp);
            }
            return rsp;
        });
    }
    retrieve(responseId, query = {}, options) {
        if ((0,_core_mjs__WEBPACK_IMPORTED_MODULE_3__.isRequestOptions)(query)) {
            return this.retrieve(responseId, {}, query);
        }
        return this._client.get(`/responses/${responseId}`, { query, ...options });
    }
    /**
     * Deletes a model response with the given ID.
     */
    del(responseId, options) {
        return this._client.delete(`/responses/${responseId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    parse(body, options) {
        return this._client.responses
            .create(body, options)
            ._thenUnwrap((response) => (0,_lib_ResponsesParser_mjs__WEBPACK_IMPORTED_MODULE_2__.parseResponse)(response, body));
    }
    /**
     * Creates a chat completion stream
     */
    stream(body, options) {
        return _lib_responses_ResponseStream_mjs__WEBPACK_IMPORTED_MODULE_4__.ResponseStream.createResponse(this._client, body, options);
    }
}
class ResponseItemsPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_5__.CursorPage {
}
Responses.InputItems = _input_items_mjs__WEBPACK_IMPORTED_MODULE_1__.InputItems;
//# sourceMappingURL=responses.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/uploads/parts.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/openai/resources/uploads/parts.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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
     * For certain `purpose` values, the correct `mime_type` must be specified. Please
     * refer to documentation for the
     * [supported MIME types for your use case](https://platform.openai.com/docs/assistants/tools/file-search#supported-files).
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

/***/ "./node_modules/openai/resources/vector-stores/file-batches.mjs":
/*!**********************************************************************!*\
  !*** ./node_modules/openai/resources/vector-stores/file-batches.mjs ***!
  \**********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FileBatches: () => (/* binding */ FileBatches),
/* harmony export */   VectorStoreFilesPage: () => (/* reexport safe */ _files_mjs__WEBPACK_IMPORTED_MODULE_2__.VectorStoreFilesPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _lib_Util_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../lib/Util.mjs */ "./node_modules/openai/lib/Util.mjs");
/* harmony import */ var _files_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./files.mjs */ "./node_modules/openai/resources/vector-stores/files.mjs");
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

/***/ "./node_modules/openai/resources/vector-stores/files.mjs":
/*!***************************************************************!*\
  !*** ./node_modules/openai/resources/vector-stores/files.mjs ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FileContentResponsesPage: () => (/* binding */ FileContentResponsesPage),
/* harmony export */   Files: () => (/* binding */ Files),
/* harmony export */   VectorStoreFilesPage: () => (/* binding */ VectorStoreFilesPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
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
    /**
     * Update attributes on a vector store file.
     */
    update(vectorStoreId, fileId, body, options) {
        return this._client.post(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
            body,
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
    /**
     * Retrieve the parsed contents of a vector store file.
     */
    content(vectorStoreId, fileId, options) {
        return this._client.getAPIList(`/vector_stores/${vectorStoreId}/files/${fileId}/content`, FileContentResponsesPage, { ...options, headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers } });
    }
}
class VectorStoreFilesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.CursorPage {
}
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */
class FileContentResponsesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_2__.Page {
}
Files.VectorStoreFilesPage = VectorStoreFilesPage;
Files.FileContentResponsesPage = FileContentResponsesPage;
//# sourceMappingURL=files.mjs.map

/***/ }),

/***/ "./node_modules/openai/resources/vector-stores/vector-stores.mjs":
/*!***********************************************************************!*\
  !*** ./node_modules/openai/resources/vector-stores/vector-stores.mjs ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VectorStoreSearchResponsesPage: () => (/* binding */ VectorStoreSearchResponsesPage),
/* harmony export */   VectorStores: () => (/* binding */ VectorStores),
/* harmony export */   VectorStoresPage: () => (/* binding */ VectorStoresPage)
/* harmony export */ });
/* harmony import */ var _resource_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../resource.mjs */ "./node_modules/openai/resource.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../core.mjs */ "./node_modules/openai/core.mjs");
/* harmony import */ var _file_batches_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./file-batches.mjs */ "./node_modules/openai/resources/vector-stores/file-batches.mjs");
/* harmony import */ var _files_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./files.mjs */ "./node_modules/openai/resources/vector-stores/files.mjs");
/* harmony import */ var _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../pagination.mjs */ "./node_modules/openai/pagination.mjs");
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
    /**
     * Search a vector store for relevant chunks based on a query and file attributes
     * filter.
     */
    search(vectorStoreId, body, options) {
        return this._client.getAPIList(`/vector_stores/${vectorStoreId}/search`, VectorStoreSearchResponsesPage, {
            body,
            method: 'post',
            ...options,
            headers: { 'OpenAI-Beta': 'assistants=v2', ...options?.headers },
        });
    }
}
class VectorStoresPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__.CursorPage {
}
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */
class VectorStoreSearchResponsesPage extends _pagination_mjs__WEBPACK_IMPORTED_MODULE_4__.Page {
}
VectorStores.VectorStoresPage = VectorStoresPage;
VectorStores.VectorStoreSearchResponsesPage = VectorStoreSearchResponsesPage;
VectorStores.Files = _files_mjs__WEBPACK_IMPORTED_MODULE_1__.Files;
VectorStores.VectorStoreFilesPage = _files_mjs__WEBPACK_IMPORTED_MODULE_1__.VectorStoreFilesPage;
VectorStores.FileContentResponsesPage = _files_mjs__WEBPACK_IMPORTED_MODULE_1__.FileContentResponsesPage;
VectorStores.FileBatches = _file_batches_mjs__WEBPACK_IMPORTED_MODULE_2__.FileBatches;
//# sourceMappingURL=vector-stores.mjs.map

/***/ }),

/***/ "./node_modules/openai/streaming.mjs":
/*!*******************************************!*\
  !*** ./node_modules/openai/streaming.mjs ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Stream: () => (/* binding */ Stream),
/* harmony export */   _iterSSEMessages: () => (/* binding */ _iterSSEMessages)
/* harmony export */ });
/* harmony import */ var _shims_index_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./_shims/index.mjs */ "./node_modules/openai/_shims/index.mjs");
/* harmony import */ var _error_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./error.mjs */ "./node_modules/openai/error.mjs");
/* harmony import */ var _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./internal/decoders/line.mjs */ "./node_modules/openai/internal/decoders/line.mjs");
/* harmony import */ var _internal_stream_utils_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./internal/stream-utils.mjs */ "./node_modules/openai/internal/stream-utils.mjs");
/* harmony import */ var _core_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./core.mjs */ "./node_modules/openai/core.mjs");






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
                    if (sse.event === null ||
                        sse.event.startsWith('response.') ||
                        sse.event.startsWith('transcript.')) {
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
                            throw new _error_mjs__WEBPACK_IMPORTED_MODULE_1__.APIError(undefined, data.error, undefined, (0,_core_mjs__WEBPACK_IMPORTED_MODULE_2__.createResponseHeaders)(response.headers));
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
            const lineDecoder = new _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_3__.LineDecoder();
            const iter = (0,_internal_stream_utils_mjs__WEBPACK_IMPORTED_MODULE_4__.ReadableStreamToAsyncIterable)(readableStream);
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
    const lineDecoder = new _internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_3__.LineDecoder();
    const iter = (0,_internal_stream_utils_mjs__WEBPACK_IMPORTED_MODULE_4__.ReadableStreamToAsyncIterable)(response.body);
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
        while ((patternIndex = (0,_internal_decoders_line_mjs__WEBPACK_IMPORTED_MODULE_3__.findDoubleNewlineIndex)(data)) !== -1) {
            yield data.slice(0, patternIndex);
            data = data.slice(patternIndex);
        }
    }
    if (data.length > 0) {
        yield data;
    }
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

"use strict";
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
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];


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

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VERSION: () => (/* binding */ VERSION)
/* harmony export */ });
const VERSION = '4.91.0'; // x-release-please-version
//# sourceMappingURL=version.mjs.map

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
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__webpack_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__webpack_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__webpack_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
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
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		var inProgress = {};
/******/ 		var dataWebpackPrefix = "personal-ai:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			var script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					var s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				script.timeout = 120;
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			var onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				var doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode && script.parentNode.removeChild(script);
/******/ 				doneFns && doneFns.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
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
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "/";
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"analyzers/analyzerFactory": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							var promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							var error = new Error();
/******/ 							var loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										var realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var chunkIds = data[0];
/******/ 			var moreModules = data[1];
/******/ 			var runtime = data[2];
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkpersonal_ai"] = self["webpackChunkpersonal_ai"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!******************************************!*\
  !*** ./src/analyzers/analyzerFactory.ts ***!
  \******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SlideAnalyzerFactoryImpl: () => (/* binding */ SlideAnalyzerFactoryImpl)
/* harmony export */ });
/* harmony import */ var _tableAnalyzer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tableAnalyzer */ "./src/analyzers/tableAnalyzer.ts");
/* harmony import */ var _textAnalyzer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./textAnalyzer */ "./src/analyzers/textAnalyzer.ts");
/* harmony import */ var _llmAnalyzer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./llmAnalyzer */ "./src/analyzers/llmAnalyzer.ts");
/**
 * 幻灯片分析器工厂实现
 */





/**
 * 分析器工厂类
 * 根据幻灯片内容类型创建合适的分析器
 */
class SlideAnalyzerFactoryImpl {
  // 是否使用LLM作为后备分析器

  /**
   * 构造函数
   * @param options 可选的配置选项
   */
  constructor(options) {
    this.analyzerCache = new Map();
    this.useLLMFallback = false;
    if (options) {
      this.useLLMFallback = options.useLLMFallback || false;
    }
  }

  /**
   * 创建适合幻灯片内容的分析器
   * @param slide 幻灯片对象
   * @returns 适合的内容分析器
   */
  createAnalyzer(slide) {
    // 如果缓存中已有此幻灯片的分析器，直接返回
    if (slide.objectId && this.analyzerCache.has(slide.objectId)) {
      return this.analyzerCache.get(slide.objectId);
    }

    // 创建所有可用的分析器，按优先级排序
    const availableAnalyzers = [new _tableAnalyzer__WEBPACK_IMPORTED_MODULE_0__.TableContentAnalyzerImpl(), new _textAnalyzer__WEBPACK_IMPORTED_MODULE_1__.TextContentAnalyzerImpl()];

    // 如果启用了LLM后备，添加LLM分析器（最低优先级）
    if (this.useLLMFallback) {
      availableAnalyzers.push(new _llmAnalyzer__WEBPACK_IMPORTED_MODULE_2__.LLMContentAnalyzer());
    }

    // 查找能处理此幻灯片的分析器
    for (const analyzer of availableAnalyzers) {
      if (analyzer.canHandle(slide)) {
        // 缓存并返回找到的分析器
        if (slide.objectId) {
          this.analyzerCache.set(slide.objectId, analyzer);
        }
        return analyzer;
      }
    }

    // 如果没有找到，优先使用LLM分析器（如果启用），否则使用默认分析器
    const defaultAnalyzer = this.useLLMFallback ? new _llmAnalyzer__WEBPACK_IMPORTED_MODULE_2__.LLMContentAnalyzer() : availableAnalyzers[0];
    if (slide.objectId) {
      this.analyzerCache.set(slide.objectId, defaultAnalyzer);
    }
    return defaultAnalyzer;
  }

  /**
   * 清除分析器缓存
   */
  clearCache() {
    this.analyzerCache.clear();
  }
}
})();

/******/ })()
;
//# sourceMappingURL=analyzerFactory.js.map