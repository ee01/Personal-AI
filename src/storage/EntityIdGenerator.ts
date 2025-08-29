import { v4 as uuidv4 } from 'uuid';

/**
 * 统一的实体ID生成器
 * 确保云端和本地使用相同的命名结构
 */
export class EntityIdGenerator {
  private static instance: EntityIdGenerator;
  
  private constructor() {}
  
  public static getInstance(): EntityIdGenerator {
    if (!EntityIdGenerator.instance) {
      EntityIdGenerator.instance = new EntityIdGenerator();
    }
    return EntityIdGenerator.instance;
  }

  /**
   * 生成统一的实体ID
   * 格式: {type}_{sanitized_name}_{short_uuid}
   * 例如: person_colin_liu_a1b2c3d4
   */
  generateId(entity: { type: string; name: string }): string {
    const sanitizedType = this.sanitizeType(entity.type);
    const sanitizedName = this.sanitizeName(entity.name);
    const shortUuid = this.generateShortUuid();
    
    return `${sanitizedType}_${sanitizedName}_${shortUuid}`;
  }

  /**
   * 清理实体类型名称
   */
  private sanitizeType(type: string): string {
    return type.toLowerCase().replace(/[^a-z]/g, '');
  }

  /**
   * 清理实体名称，处理中文和特殊字符
   */
  private sanitizeName(name: string): string {
    if (!name || name.trim() === '') {
      return 'entity';
    }

    // 简单的中文转拼音映射（部分常用字符）
    const chineseToPinyin: Record<string, string> = {
      '项目': 'xiangmu',
      '文档': 'wendang',
      '人员': 'renyuan',
      '主题': 'zhuti',
      '任务': 'renwu',
      '团队': 'tuandui',
      '公司': 'gongsi',
      '系统': 'xitong',
      '数据': 'shuju',
      '功能': 'gongneng',
      '需求': 'xuqiu',
      '设计': 'sheji',
      '开发': 'kaifa',
      '测试': 'ceshi',
      '部署': 'bushu',
      '维护': 'weihu',
      '管理': 'guanli',
      '分析': 'fenxi',
      '报告': 'baogao',
      '会议': 'huiyi',
      '刘': 'liu',
      '陈': 'chen',
      '王': 'wang',
      '李': 'li',
      '张': 'zhang',
      '赵': 'zhao',
      '孙': 'sun',
      '周': 'zhou',
      '吴': 'wu',
      '郑': 'zheng'
    };

    let cleanName = name.trim();

    // 替换中文词汇为拼音
    for (const [chinese, pinyin] of Object.entries(chineseToPinyin)) {
      cleanName = cleanName.replace(new RegExp(chinese, 'g'), pinyin);
    }

    // 移除其他中文字符（通过Unicode范围）
    cleanName = cleanName.replace(/[\u4e00-\u9fff]/g, '');

    // 只保留字母、数字和连字符
    cleanName = cleanName.replace(/[^a-zA-Z0-9\-_]/g, '');

    // 移除多余的连字符和下划线
    cleanName = cleanName.replace(/[-_]+/g, '_');

    // 移除开头和结尾的连字符和下划线
    cleanName = cleanName.replace(/^[-_]+|[-_]+$/g, '');

    // 限制长度并确保不为空
    if (cleanName.length === 0) {
      cleanName = 'entity';
    } else if (cleanName.length > 15) {
      cleanName = cleanName.substring(0, 15);
    }

    // 确保以字母开头
    if (!/^[a-zA-Z]/.test(cleanName)) {
      cleanName = 'entity_' + cleanName;
    }

    return cleanName.toLowerCase();
  }

  /**
   * 生成短UUID（8位）
   */
  private generateShortUuid(): string {
    return uuidv4().substring(0, 8);
  }
}

// 导出单例实例
export const entityIdGenerator = EntityIdGenerator.getInstance();
