/**
 * Excel文件处理工具
 */

import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

class ExcelProcessor {
  /**
   * 读取Excel文件
   */
  static readExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheets = {};
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        sheets[sheetName] = data;
      });
      
      return {
        workbook,
        sheets,
        filePath
      };
    } catch (error) {
      throw new Error(`读取Excel文件失败: ${error.message}`);
    }
  }

  /**
   * 处理单个工作表
   * @param {Array} sheetData - 工作表数据
   * @param {String} sheetName - 工作表名称
   * @param {Object} authChecker - 检查器实例
   * @param {Object} historicalCheck - 历史检查记录（30天前的检查）
   * @param {Number} currentCheckTime - 当前检查时间戳（毫秒）
   */
  static processSheet(sheetData, sheetName, authChecker, historicalCheck, currentCheckTime) {
    const results = authChecker.checkAll(sheetData, sheetName, historicalCheck, currentCheckTime);
    
    // 添加删除标记列（确保只添加一次）
    const processedData = sheetData.map((record, index) => {
      const result = results[index];
      // 创建新对象，避免修改原对象
      const newRecord = { ...record };
      // 删除可能存在的旧标记列
      delete newRecord['删除标记'];
      delete newRecord['__EMPTY'];
      // 添加删除标记
      newRecord['删除标记'] = result.shouldDelete ? '删除' : '';
      return newRecord;
    });
    
    return {
      originalData: sheetData,
      processedData,
      results,
      sheetName
    };
  }

  /**
   * 处理整个Excel文件
   * @param {String} filePath - 文件路径
   * @param {Object} authChecker - 检查器实例
   * @param {Object} options - 选项
   * @param {Object} options.historicalCheck - 历史检查记录（30天前的检查）
   * @param {Number} options.currentCheckTime - 当前检查时间戳（毫秒）
   * @param {Number} options.longTimeDays - 长时间权限天数
   */
  static processExcel(filePath, authChecker, options = {}) {
    const { workbook, sheets } = this.readExcel(filePath);
    const processedSheets = {};
    const summary = {
      totalSheets: 0,
      totalRecords: 0,
      markedForDeletion: 0,
      byReason: {}
    };
    
    // 获取检查时间
    const currentCheckTime = options.currentCheckTime || Date.now();
    const historicalCheck = options.historicalCheck || null;
    
    Object.keys(sheets).forEach(sheetName => {
      // 只处理"已授权主机"工作表
      if (!sheetName.includes('已授权主机')) {
        return;
      }
      
      summary.totalSheets++;
      const sheetData = sheets[sheetName];
      summary.totalRecords += sheetData.length;
      
      const processed = this.processSheet(sheetData, sheetName, authChecker, historicalCheck, currentCheckTime);
      processedSheets[sheetName] = processed;
      
      // 统计删除原因
      processed.results.forEach(result => {
        if (result.shouldDelete) {
          summary.markedForDeletion++;
          result.reasons.forEach(reason => {
            summary.byReason[reason] = (summary.byReason[reason] || 0) + 1;
          });
        }
      });
    });
    
    return {
      workbook,
      processedSheets,
      summary,
      originalSheets: sheets,
      checkTime: currentCheckTime
    };
  }

  /**
   * 保存处理后的Excel文件
   */
  static saveExcel(processedResult, outputPath) {
    const { workbook, processedSheets } = processedResult;
    
    // 更新每个工作表的数据
    Object.keys(processedSheets).forEach(sheetName => {
      const processed = processedSheets[sheetName];
      // 清理数据，确保没有重复的删除标记列和空列
      const cleanData = processed.processedData.map((record, index) => {
        const cleanRecord = {};
        const originalRecord = processed.originalData[index];
        
        // 先添加所有原始字段（排除可能的删除标记列）
        if (originalRecord) {
          Object.keys(originalRecord).forEach(key => {
            if (key && key !== '删除标记' && !key.startsWith('__EMPTY')) {
              cleanRecord[key] = record[key];
            }
          });
        } else {
          // 如果没有原始记录，从当前记录中提取（排除特殊列）
          Object.keys(record).forEach(key => {
            if (key && key !== '删除标记' && !key.startsWith('__EMPTY')) {
              cleanRecord[key] = record[key];
            }
          });
        }
        
        // 最后添加删除标记列（确保唯一）
        cleanRecord['删除标记'] = record['删除标记'] || '';
        
        return cleanRecord;
      });
      const worksheet = XLSX.utils.json_to_sheet(cleanData);
      workbook.Sheets[sheetName] = worksheet;
    });
    
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 写入文件
    XLSX.writeFile(workbook, outputPath);
    
    return outputPath;
  }

  /**
   * 生成预览数据（用于UI显示）
   */
  static generatePreview(processedResult, limit = null) {
    const preview = {};
    
    Object.keys(processedResult.processedSheets).forEach(sheetName => {
      const processed = processedResult.processedSheets[sheetName];
      const records = processed.results.map((r, index) => {
        // 创建完全可序列化的对象
        const record = {};
        // 复制原始记录的所有字段（确保都是基本类型）
        Object.keys(r.record).forEach(key => {
          const value = r.record[key];
          // 只保留可序列化的值
          if (value !== null && value !== undefined) {
            if (typeof value === 'object' && !Array.isArray(value)) {
              // 如果是对象，转换为字符串
              record[key] = JSON.stringify(value);
            } else {
              record[key] = value;
            }
          } else {
            record[key] = '';
          }
        });
        
        return {
          id: `${sheetName}_${index}`,
          sheetName,
          ...record,
          '删除标记': r.shouldDelete ? '删除' : '',
          '删除原因': r.reasons.join('; '),
          shouldDelete: r.shouldDelete,
          reasons: Array.isArray(r.reasons) ? r.reasons : [],
          originalIndex: index
        };
      });
      
      preview[sheetName] = limit ? records.slice(0, limit) : records;
    });
    
    return preview;
  }

  /**
   * 更新删除标记
   */
  static updateDeleteMark(processedResult, sheetName, recordIndex, shouldDelete) {
    if (!processedResult.processedSheets[sheetName]) {
      throw new Error(`工作表 ${sheetName} 不存在`);
    }
    
    const processed = processedResult.processedSheets[sheetName];
    if (recordIndex < 0 || recordIndex >= processed.results.length) {
      throw new Error(`记录索引 ${recordIndex} 超出范围`);
    }
    
    const oldShouldDelete = processed.results[recordIndex].shouldDelete;
    processed.results[recordIndex].shouldDelete = shouldDelete;
    processed.processedData[recordIndex]['删除标记'] = shouldDelete ? '删除' : '';
    
    // 重新计算统计信息
    const summary = {
      totalSheets: Object.keys(processedResult.processedSheets).length,
      totalRecords: 0,
      markedForDeletion: 0,
      byReason: {}
    };
    
    Object.keys(processedResult.processedSheets).forEach(sName => {
      const sProcessed = processedResult.processedSheets[sName];
      summary.totalRecords += sProcessed.results.length;
      sProcessed.results.forEach(result => {
        if (result.shouldDelete) {
          summary.markedForDeletion++;
          // 只有当有删除原因时才统计
          if (result.reasons && result.reasons.length > 0) {
            result.reasons.forEach(reason => {
              summary.byReason[reason] = (summary.byReason[reason] || 0) + 1;
            });
          }
        }
      });
    });
    
    processedResult.summary = summary;
    
    return processedResult;
  }
}

export default ExcelProcessor;

