/**
 * 豆包随手记类型定义
 * 
 * 随手记支持的消息类型：
 * - 生活助手类：待办清单、购物清单、停车位置、东西在哪、重要日子
 * - 信息记录类：句子摘抄、地址、证件/卡号、号码/数字、健康数据
 */

export type MemoType = 
  // 生活助手类
  | 'todo'           // 待办清单
  | 'shopping'       // 购物清单
  | 'parking'        // 停车位置
  | 'where'          // 东西在哪
  | 'important_date' // 重要日子
  // 信息记录类
  | 'quote'          // 句子摘抄
  | 'address'        // 地址
  | 'card'           // 证件/卡号
  | 'number'         // 号码/数字
  | 'health'         // 健康数据
  // 默认类型
  | 'note';          // 普通笔记

export interface MemoItem {
  type: MemoType;
  title: string;
  content: string;
  metadata?: {
    dueDate?: string;        // 用于待办/重要日子
    location?: string;       // 用于停车位置/地址
    category?: string;       // 用于购物清单分类
    importance?: 'low' | 'medium' | 'high';
    tags?: string[];
    source?: string;         // 来源
  };
}

export interface MemoTypePattern {
  type: MemoType;
  keywords: string[];
  patterns: RegExp[];
  priority: number; // 越高越优先匹配
}

// 类型匹配模式定义
export const MEMO_TYPE_PATTERNS: MemoTypePattern[] = [
  {
    type: 'parking',
    keywords: ['停车', '车位', '停车场', '停在', 'parking', 'B1', 'B2', '地下'],
    patterns: [
      /停[在车][A-Za-z0-9\-楼层]+/,
      /车[位号][:：]\s*[A-Za-z0-9\-]+/,
      /[Bb][12]\s*[层楼]?\s*[A-Za-z0-9\-]*/,
      /停车[场位][：:]\s*.+/,
    ],
    priority: 90,
  },
  {
    type: 'where',
    keywords: ['放在', '在哪', '存放', '收在', '放在哪', '东西在哪'],
    patterns: [
      /[东西物品][放在存收][^。！？]+/,
      /[把将].+放在[^。！？]+/,
      /.+在哪[里么？]/,
      /[钥匙钱包证件卡片].+放[^。！？]+/,
    ],
    priority: 85,
  },
  {
    type: 'important_date',
    keywords: ['生日', '纪念日', '结婚', '入职', '到期', '截止', 'appointment', 'meeting', '会议'],
    patterns: [
      /\d{1,2}月\d{1,2}[日号].{0,5}(生日|纪念日|结婚)/,
      /(生日|纪念日|结婚|入职)[:：]?\s*\d{4}[-年]\d{1,2}[-月]\d{1,2}[日号]?/,
      /(会议|meeting)[:：]?\s*\d{4}[-年]\d{1,2}[-月]\d{1,2}[日号]?/,
      /(截止|到期)[日期]?[:：]?\s*\d{4}[-年]\d{1,2}[-月]\d{1,2}[日号]?/,
    ],
    priority: 80,
  },
  {
    type: 'shopping',
    keywords: ['买', '购物', '超市', '菜市场', '购物清单', '要买', '需要买', '买东西'],
    patterns: [
      /要?买[:：]?\s*.+/,
      /购物清单[:：]?\s*.+/,
      /需要?买[的]?东西[:：]?\s*.+/,
      /去超市[买要][^。！？]+/,
    ],
    priority: 75,
  },
  {
    type: 'todo',
    keywords: ['待办', '要做', '需要做', '记得', '别忘了', '提醒我', 'todo', 'task'],
    patterns: [
      /待办[事项清单]?[:：]?\s*.+/,
      /[要需]要做[:：]?\s*.+/,
      /记得[去要][^。！？]+/,
      /别忘[了记][^。！？]+/,
      /提醒我[^。！？]+/,
    ],
    priority: 70,
  },
  {
    type: 'card',
    keywords: ['身份证', '银行卡', '信用卡', '护照', '驾照', '社保卡', '会员卡', '卡号'],
    patterns: [
      /(身份证|护照|驾照|社保卡)[号码]?[:：]?\s*\d+[Xx]?/,
      /(银行|信用)卡[号码]?[:：]?\s*\d{4,}/,
      /会员卡[号码]?[:：]?\s*.+/,
    ],
    priority: 85,
  },
  {
    type: 'address',
    keywords: ['地址', '住在', '公司地址', '家在', '路', '街', '号'],
    patterns: [
      /[住家公司]地址[:：]?\s*.+/,
      /.+[路街]\d+号/,
      /.+[市区县].+[路街]/,
      /地址[是为]?[:：]?\s*.+/,
    ],
    priority: 65,
  },
  {
    type: 'number',
    keywords: ['号码', '手机号', '电话', '账号', '密码', '验证码', '编号'],
    patterns: [
      /(手机|电话)[号码]?[:：]?\s*1[3-9]\d{9}/,
      /账号[号码]?[:：]?\s*[A-Za-z0-9_]+/,
      /密码[:：]?\s*[A-Za-z0-9!@#$%^&*]+/,
      /验证码[:：]?\s*\d{4,6}/,
    ],
    priority: 80,
  },
  {
    type: 'health',
    keywords: ['血压', '血糖', '体重', '身高', '体温', '健康', '体检', '用药'],
    patterns: [
      /(血压|血糖)[:：]?\s*\d+[\/.]\d*/,
      /体重[:：]?\s*\d+(\.\d+)?\s*(kg|公斤|斤)?/,
      /身高[:：]?\s*\d+(\.\d+)?\s*(cm|厘米|m|米)?/,
      /体温[:：]?\s*\d+(\.\d+)?\s*℃?/,
    ],
    priority: 75,
  },
  {
    type: 'quote',
    keywords: ['名言', '金句', '摘抄', '引用', '说过', 'quote', 'saying'],
    patterns: [
      /["「『]([^"」』]+)["」』][—–-]?\s*[A-Za-z\u4e00-\u9fff]+/,
      /摘抄[:：]?\s*.+/,
      /金句[:：]?\s*.+/,
      /.+说过[:：]?["「『]/,
    ],
    priority: 60,
  },
];

// 类型显示名称
export const MEMO_TYPE_NAMES: Record<MemoType, string> = {
  todo: '待办清单',
  shopping: '购物清单',
  parking: '停车位置',
  where: '东西在哪',
  important_date: '重要日子',
  quote: '句子摘抄',
  address: '地址',
  card: '证件/卡号',
  number: '号码/数字',
  health: '健康数据',
  note: '普通笔记',
};

// 类型图标（用于格式化输出）
export const MEMO_TYPE_ICONS: Record<MemoType, string> = {
  todo: '✅',
  shopping: '🛒',
  parking: '🅿️',
  where: '📍',
  important_date: '📅',
  quote: '💬',
  address: '🏠',
  card: '💳',
  number: '🔢',
  health: '❤️',
  note: '📝',
};
