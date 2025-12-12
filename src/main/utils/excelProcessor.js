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
   */
  static processSheet(sheetData, sheetName, authChecker) {
    const results = authChecker.checkAll(sheetData, sheetName);
    
    // 添加删除标记列
    const processedData = sheetData.map((record, index) => {
      const result = results[index];
      return {
        ...record,
        '删除标记': result.shouldDelete ? '删除' : ''
      };
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
    
    Object.keys(sheets).forEach(sheetName => {
      // 只处理"已授权主机"工作表
      if (!sheetName.includes('已授权主机')) {
        return;
      }
      
      summary.totalSheets++;
      const sheetData = sheets[sheetName];
      summary.totalRecords += sheetData.length;
      
      const processed = this.processSheet(sheetData, sheetName, authChecker);
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
      originalSheets: sheets
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
      const worksheet = XLSX.utils.json_to_sheet(processed.processedData);
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
      const records = processed.results.map((r, index) => ({
        id: `${sheetName}_${index}`,
        sheetName,
        ...r.record,
        '删除标记': r.shouldDelete ? '删除' : '',
        '删除原因': r.reasons.join('; '),
        shouldDelete: r.shouldDelete,
        reasons: r.reasons,
        originalIndex: index
      }));
      
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

