/**
 * Google Slides API接口定义
 */

/**
 * Google Slides演示文稿
 */
export interface GooglePresentation {
  presentationId: string;
  title: string;
  slides: GoogleSlide[];
}

/**
 * Google Slides幻灯片
 */
export interface GoogleSlide {
  objectId: string;
  pageElements?: GooglePageElement[];
  pageType?: string;
  slideProperties?: {
    layoutObjectId?: string;
    masterObjectId?: string;
  };
}

/**
 * 页面元素基础接口
 */
export interface GooglePageElement {
  objectId: string;
  size: {
    width: { magnitude: number; unit: string };
    height: { magnitude: number; unit: string };
  };
  transform: {
    scaleX: number;
    scaleY: number;
    translateX: number;
    translateY: number;
    unit: string;
  };
  title?: string;
  description?: string;
  shape?: GoogleShape;
  table?: GoogleTable;
  image?: GoogleImage;
  video?: GoogleVideo;
  line?: GoogleLine;
  wordArt?: GoogleWordArt;
  elementGroup?: GoogleElementGroup;
}

/**
 * Google Slides表格
 */
export interface GoogleTable {
  rows: number;
  columns: number;
  tableRows?: GoogleTableRow[];
  tableColumns?: {
    columnWidth: { magnitude: number; unit: string };
  }[];
  horizontalBorderRows?: GoogleTableBorderRow[];
  verticalBorderRows?: GoogleTableBorderRow[];
}

/**
 * Google Slides表格行
 */
export interface GoogleTableRow {
  rowHeight?: { magnitude: number; unit: string };
  tableCells?: GoogleTableCell[];
}

/**
 * Google Slides表格单元格
 */
export interface GoogleTableCell {
  location?: {
    rowIndex: number;
    columnIndex: number;
  };
  rowSpan?: number;
  columnSpan?: number;
  text?: GoogleText;
  tableCellProperties?: {
    tableCellBackgroundFill?: {
      solidFill?: {
        color?: {
          rgbColor?: { red?: number; green?: number; blue?: number };
        };
        alpha?: number;
      };
    };
  };
}

/**
 * Google Slides文本
 */
export interface GoogleText {
  textElements?: GoogleTextElement[];
}

/**
 * Google Slides文本元素
 */
export interface GoogleTextElement {
  textRun?: {
    content: string;
    style?: GoogleTextStyle;
  };
  paragraphMarker?: {
    style?: {
      spaceAbove?: { magnitude: number; unit: string };
      spaceBelow?: { magnitude: number; unit: string };
      indent?: { magnitude: number; unit: string };
      alignment?: string;
      direction?: string;
      spacingMode?: string;
      lineSpacing?: number;
      bulletPreset?: string;
    };
  };
  autoText?: {
    type: string;
    content: string;
    style?: GoogleTextStyle;
  };
}

/**
 * Google Slides文本样式
 */
export interface GoogleTextStyle {
  foregroundColor?: {
    opaqueColor?: {
      rgbColor?: { red?: number; green?: number; blue?: number };
    };
  };
  backgroundColor?: {
    opaqueColor?: {
      rgbColor?: { red?: number; green?: number; blue?: number };
    };
  };
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: { magnitude: number; unit: string };
  link?: {
    url?: string;
    relativeLink?: string;
    pageObjectId?: string;
    slideIndex?: number;
  };
}

/**
 * Google Slides表格边框行
 */
export interface GoogleTableBorderRow {
  tableBorderCells: {
    location: {
      rowIndex: number;
      columnIndex: number;
    };
    tableBorderProperties: {
      dashStyle?: string;
      width?: { magnitude: number; unit: string };
      tableBorderFill?: {
        solidFill?: {
          color?: {
            rgbColor?: { red?: number; green?: number; blue?: number };
          };
          alpha?: number;
        };
      };
    };
  }[];
}

/**
 * Google Slides形状
 */
export interface GoogleShape {
  shapeType: string;
  shapeProperties?: {
    shapeBackgroundFill?: {
      solidFill?: {
        color?: {
          rgbColor?: { red?: number; green?: number; blue?: number };
        };
        alpha?: number;
      };
    };
    outline?: {
      outlineFill?: {
        solidFill?: {
          color?: {
            rgbColor?: { red?: number; green?: number; blue?: number };
          };
          alpha?: number;
        };
      };
      weight?: { magnitude: number; unit: string };
      dashStyle?: string;
    };
  };
  text?: GoogleText;
}

/**
 * Google Slides图片
 */
export interface GoogleImage {
  contentUrl?: string;
  imageProperties?: {
    brightness?: number;
    contrast?: number;
    transparency?: number;
    cropProperties?: {
      leftOffset?: number;
      rightOffset?: number;
      topOffset?: number;
      bottomOffset?: number;
      angle?: number;
    };
  };
}

/**
 * Google Slides视频
 */
export interface GoogleVideo {
  videoId?: string;
  url?: string;
  source?: string;
}

/**
 * Google Slides线条
 */
export interface GoogleLine {
  lineType?: string;
  lineProperties?: {
    lineFill?: {
      solidFill?: {
        color?: {
          rgbColor?: { red?: number; green?: number; blue?: number };
        };
        alpha?: number;
      };
    };
    weight?: { magnitude: number; unit: string };
    dashStyle?: string;
  };
}

/**
 * Google Slides艺术字
 */
export interface GoogleWordArt {
  renderedText?: string;
}

/**
 * Google Slides元素组
 */
export interface GoogleElementGroup {
  children?: GooglePageElement[];
}

/**
 * Slides API批量更新响应
 */
export interface SlidesBatchUpdateResponse {
  replies: any[];
  presentationId: string;
} 