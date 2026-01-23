import { getGoogleAuthToken } from './utils/googleAuth';

export class Sheet {
  private token: string;
  private sheetId: string;
  private gid: string | null;
  private sheetName: string;

  constructor(token: string, sheetId: string, sheetName: string) {
    this.token = token;
    this.sheetId = sheetId;
    this.sheetName = sheetName;
    this.gid = null;
  }

  /**
   * 从 Google Sheets URL 创建 Sheet 实例（静态工厂方法）
   * @param url Google Sheets URL
   * @param token 认证 token
   * @returns Sheet 实例
   */
  static async fromUrl(url: string, token: string): Promise<Sheet> {
    const sheetId = Sheet.extractSheetId(url);
    const gid = Sheet.extractGid(url);
    
    if (!sheetId) {
      throw new Error('无法从 URL 中提取 Sheet ID');
    }

    // 获取 sheetName
    const sheetName = await Sheet.getSheetNameByGid(token, sheetId, gid);
    
    const sheet = new Sheet(token, sheetId, sheetName);
    sheet.gid = gid;
    return sheet;
  }

  static async getToken(): Promise<string> {
    const token = await getGoogleAuthToken({ caller: 'Sheet.getToken' });
    if (!token) {
      throw new Error('无法获取 Google 授权');
    }
    return token;
  }

  static extractSheetId(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  static extractGid(url: string): string | null {
    const match = url.match(/[#&]gid=([0-9]+)/);
    return match ? match[1] : null;
  }

  static async getSheetNames(token: string, sheetId: string): Promise<any> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    return json.sheets;
  }

  static async getSheetNameByGid(token: string, sheetId: string, gid: string | null): Promise<string> {
    const sheets = await Sheet.getSheetNames(token, sheetId);
    if (gid) {
      const sheet = sheets.find((s: any) => s.properties.sheetId.toString() === gid);
      if (sheet) return sheet.properties.title;
    }
    // 如果找不到对应的gid或gid为null，返回第一个sheet的名称
    return sheets[0].properties.title;
  }

  async readSheet(valueRenderOption: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE'): Promise<string[][]> {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}?valueRenderOption=${valueRenderOption}`;
    const res = await fetch(sheetUrl, {
        headers: { Authorization: `Bearer ${this.token}` }
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`读取 Sheet 失败 (${res.status}): ${errorText}`);
    }
    
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
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(`写入 Sheet 失败: ${error.error?.message || '未知错误'}`);
    }
    
    return res.json();
  }

  /**
   * 批量更新多个范围的数据
   * @param updates 更新数据数组，每个元素包含 range 和 values
   * @returns API 响应
   */
  async batchUpdateValues(updates: Array<{ range: string; values: string[][] }>): Promise<any> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values:batchUpdate`;
    
    const data = updates.map(update => ({
      range: `${this.sheetName}!${update.range}`,
      values: update.values
    }));
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: data
      })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(`批量更新失败: ${error.error?.message || '未知错误'}`);
    }
    
    return res.json();
  }

  // 插入行或列
  async insertDimension(dimension: 'ROWS' | 'COLUMNS', startIndex: number, endIndex: number, sheetId?: number): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}:batchUpdate`;
    
    // 使用传入的 sheetId 或 this.gid，如果都没有则使用 0（第一个 sheet）
    const targetSheetId = sheetId ?? (this.gid ? parseInt(this.gid) : 0);
    
    const request = {
      requests: [{
        insertDimension: {
          range: {
            sheetId: targetSheetId,
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
            sheetId: targetSheetId,
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

  // 删除行或列
  async deleteDimension(dimension: 'ROWS' | 'COLUMNS', startIndex: number, endIndex: number, sheetId?: number): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}:batchUpdate`;
    
    // 使用传入的 sheetId 或 this.gid，如果都没有则使用 0（第一个 sheet）
    const targetSheetId = sheetId ?? (this.gid ? parseInt(this.gid) : 0);
    
    const request = {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: targetSheetId,
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
      throw new Error(`删除维度失败: ${error.error?.message || '未知错误'}`);
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

  public getGid(): string | null {
    return this.gid;
  }

  // 移动单行到新位置（保留格式）
  async moveRow(fromRowIndex: number, toRowIndex: number, sheetId?: number): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}:batchUpdate`;
    
    // 使用传入的 sheetId 或 this.gid，如果都没有则使用 0（第一个 sheet）
    const targetSheetId = sheetId ?? (this.gid ? parseInt(this.gid) : 0);
    
    // moveDimension API: 把 [startIndex, endIndex) 的行移动到 destinationIndex
    // 注意：如果 destinationIndex > startIndex，移动后的位置是 destinationIndex - 1
    // 如果 destinationIndex < startIndex，移动后的位置是 destinationIndex
    const request = {
      requests: [{
        moveDimension: {
          source: {
            sheetId: targetSheetId,
            dimension: 'ROWS',
            startIndex: fromRowIndex,
            endIndex: fromRowIndex + 1
          },
          destinationIndex: toRowIndex > fromRowIndex ? toRowIndex + 1 : toRowIndex
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
      throw new Error(`移动行失败: ${error.error?.message || '未知错误'}`);
    }
  }
}