export class Sheet {
  private token: string;
  private sheetId: string;
  private gid: string;
  private sheetName: string;

  constructor(url: string, token: string) {
    this.token = token;
    this.sheetId = this.extractSheetId(url);
    this.gid = this.extractGid(url);
  }
    
  async init() {
    if (!this.token) this.token = await this.getToken();
    this.sheetName = await this.getSheetNameByGid(this.token, this.sheetId, this.gid);
  }

  async getToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(token);
        });
    });
  }

  extractSheetId(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  extractGid(url: string): string | null {
    const match = url.match(/[#&]gid=([0-9]+)/);
    return match ? match[1] : null;
  }

  async getSheetNames(token: string, sheetId: string): Promise<any> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    return json.sheets;
  }

  async getSheetNameByGid(token: string, sheetId: string, gid: string): Promise<string> {
    const sheets = await this.getSheetNames(token, sheetId);
    const sheet = sheets.find((s: any) => s.properties.sheetId.toString() === gid);
    return sheet ? sheet.properties.title : sheets[0].properties.title; // 如果找不到对应的gid,返回第一个sheet的名称
  }

  async readSheet(valueRenderOption: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE'): Promise<string[][]> {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}?valueRenderOption=${valueRenderOption}`;
    const res = await fetch(sheetUrl, {
        headers: { Authorization: `Bearer ${this.token}` }
    });
    const json = await res.json();
    return json.values;
  }

  async writeSheet(values: string[][], position = 'A1'): Promise<any> {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}!${position}?valueInputOption=USER_ENTERED`;
    const res = await fetch(sheetUrl, {
        method: 'PUT',
        headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
    });
    return res.json();
  }

  // 插入行或列
  async insertDimension(dimension: 'ROWS' | 'COLUMNS', startIndex: number, endIndex: number): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}:batchUpdate`;
    const request = {
      requests: [{
        insertDimension: {
          range: {
            sheetId: parseInt(this.gid),
            dimension,
            startIndex,
            endIndex
          },
          inheritFromBefore: true
        }
      },
      {
        addDimensionGroup: {
          range: {
            sheetId: parseInt(this.gid),
            dimension,
            startIndex,
            endIndex
          }
        }
      }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(`插入维度失败: ${error.error?.message || '未知错误'}`);
    }
  }

  /**
   * 读取配置表数据
   * @param sheetName 配置表名称
   * @returns 配置表数据
   */
  async readConfigSheet(configSheetName = ''): Promise<string[][]> {
    if (!configSheetName) configSheetName = this.sheetName + '_config';
    try {
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${configSheetName}`;
        const res = await fetch(sheetUrl, {
            headers: { Authorization: `Bearer ${this.token}` }
        });
        const json = await res.json();
        return json.values;
    } catch (error) {
      console.error('读取配置表失败:', error);
      throw error;
    }
  }

  /**
   * 获取表格的第一行作为表头
   * @returns 表头数组
   */
  async getHeaders(): Promise<string[]> {
    const values = await this.readSheet();
    if (!values || values.length === 0) {
      throw new Error('表格为空');
    }
    return values[0];
  }

  public getSheetName(): string {
    return this.sheetName;
  }
}