/**
 * 授权检查核心逻辑
 */

class AuthChecker {
  constructor(config) {
    this.config = {
      // 运维岗位人员名单（从工作表名称中提取，支持部分匹配）
      opsPersonnel: config?.opsPersonnel || ['王礼鑫', '王鹏辉', '杨志智', '张涛'],
      // 生产环境主机名称规则（支持正则表达式）
      productionHostPatterns: config?.productionHostPatterns || ['prd', 'pehx-outpub-'],
      // 生产环境主机名称排除规则（不匹配这些规则）
      productionHostExcludePatterns: config?.productionHostExcludePatterns || ['uat'],
      // 主数据库IP地址列表
      masterDbIPs: config?.masterDbIPs || [
        '192.168.240.181',
        '192.168.240.156'
      ],
      // IP地址范围判断（主数据库IP更靠前）
      masterDbIPRange: config?.masterDbIPRange || {
        start: '192.168.240.150',
        end: '192.168.240.190'
      },
      // 重复授权判断字段
      duplicateFields: config?.duplicateFields || ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
      // 长时间权限天数
      longTimeDays: config?.longTimeDays || 30
    };
  }

  /**
   * 检查是否是运维岗位人员
   */
  isOpsPersonnel(sheetName) {
    if (!sheetName) return false;
    
    // 检查是否在运维人员名单中
    const nameMatch = this.config.opsPersonnel.some(name => 
      sheetName.includes(name) || name.includes(sheetName.split('已授权')[0])
    );
    
    return nameMatch;
  }

  /**
   * 检查是否是生产环境主机
   */
  isProductionHost(hostName) {
    if (!hostName) return false;
    
    // 先检查排除规则
    if (this.config.productionHostExcludePatterns && this.config.productionHostExcludePatterns.length > 0) {
      const excluded = this.config.productionHostExcludePatterns.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(hostName);
        }
        return hostName.includes(pattern);
      });
      if (excluded) {
        return false;
      }
    }
    
    // 再检查包含规则
    return this.config.productionHostPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(hostName);
      }
      return hostName.includes(pattern);
    });
  }

  /**
   * 检查是否是主数据库
   */
  isMasterDatabase(ip, hostName) {
    if (!ip) return false;
    
    // 直接匹配主数据库IP列表
    if (this.config.masterDbIPs.includes(ip)) {
      return true;
    }
    
    // 根据IP地址范围判断（主数据库IP更靠前）
    if (this.isIPInRange(ip, this.config.masterDbIPRange.start, this.config.masterDbIPRange.end)) {
      // 检查主机名称是否包含主数据库标识
      if (hostName && /maindb|master/i.test(hostName)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查IP是否在指定范围内
   */
  isIPInRange(ip, startIP, endIP) {
    const ipToNumber = (ipStr) => {
      return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    };
    
    const ipNum = ipToNumber(ip);
    const startNum = ipToNumber(startIP);
    const endNum = ipToNumber(endIP);
    
    return ipNum >= startNum && ipNum <= endNum;
  }

  /**
   * 检查重复授权
   * 返回需要删除的重复项索引（保留第一条，其他标记删除）
   */
  findDuplicates(records) {
    const seen = new Map();
    const duplicatesToDelete = new Set();
    const fields = this.config.duplicateFields || ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'];
    
    records.forEach((record, index) => {
      // 使用配置的字段组合作为唯一标识
      const key = fields.map(field => record[field] || '').join('_');
      
      if (seen.has(key)) {
        // 如果已存在，标记当前项为删除（保留第一条）
        duplicatesToDelete.add(index);
      } else {
        // 第一次出现，记录索引
        seen.set(key, index);
      }
    });
    
    return Array.from(duplicatesToDelete);
  }

  /**
   * 获取权限的唯一标识
   */
  getPermissionKey(record) {
    return `${record['主机IP'] || ''}_${record['主机名称'] || ''}_${record['主机网络'] || ''}_${record['主机组'] || ''}_${record['协议'] || ''}_${record['账户登录名'] || ''}`;
  }

  /**
   * 检查单条记录是否需要删除
   * @param {Object} record - 记录对象
   * @param {String} sheetName - 工作表名称
   * @param {Object} historicalCheck - 历史检查记录（30天前的检查），包含permissions对象（按sheetName分组）
   * @param {Number} currentCheckTime - 当前检查时间戳（毫秒）
   */
  shouldDelete(record, sheetName, historicalCheck, currentCheckTime) {
    const reasons = [];
    
    // 如果是运维人员，不检查长时间权限
    if (this.isOpsPersonnel(sheetName)) {
      return {
        shouldDelete: false,
        reasons: []
      };
    }
    
    // 检查是否是生产环境
    const isProd = this.isProductionHost(record['主机名称']);
    // 检查是否是主数据库
    const isMasterDb = this.isMasterDatabase(record['主机IP'], record['主机名称']);
    
    // 只有生产环境或主数据库的权限才需要检查长时间
    if (isProd || isMasterDb) {
      // 如果有历史检查记录，检查30天前是否也有这个权限
      if (historicalCheck && historicalCheck.permissions) {
        // 获取当前工作表的历史权限记录
        const sheetHistoricalPermissions = historicalCheck.permissions[sheetName];
        const permissionKey = this.getPermissionKey(record);
        
        // 兼容旧格式（对象）和新格式（数组）
        let hasPermission = false;
        if (Array.isArray(sheetHistoricalPermissions)) {
          // 新格式：权限key数组
          hasPermission = sheetHistoricalPermissions.includes(permissionKey);
        } else if (sheetHistoricalPermissions && typeof sheetHistoricalPermissions === 'object') {
          // 旧格式：权限key对象
          hasPermission = sheetHistoricalPermissions.hasOwnProperty(permissionKey);
        }
        
        // 如果30天前就有这个权限，现在还有，标记删除
        if (hasPermission) {
          if (isProd) {
            reasons.push(`非运维人员长时间拥有生产环境权限（超过${this.config.longTimeDays}天）`);
          }
          if (isMasterDb) {
            reasons.push(`非运维人员长时间拥有主数据库权限（超过${this.config.longTimeDays}天）`);
          }
        }
      }
      // 如果没有历史检查记录（首次检查或历史记录不足），不标记删除，允许拥有
    }
    
    return {
      shouldDelete: reasons.length > 0,
      reasons
    };
  }

  /**
   * 检查所有记录
   * @param {Array} records - 记录数组
   * @param {String} sheetName - 工作表名称
   * @param {Object} historicalCheck - 历史检查记录（30天前的检查）
   * @param {Number} currentCheckTime - 当前检查时间戳（毫秒）
   */
  checkAll(records, sheetName, historicalCheck, currentCheckTime) {
    const results = records.map((record, index) => {
      const checkResult = this.shouldDelete(record, sheetName, historicalCheck, currentCheckTime);
      return {
        index,
        record,
        shouldDelete: checkResult.shouldDelete,
        reasons: checkResult.reasons
      };
    });
    
    // 标记重复授权
    const duplicateIndices = this.findDuplicates(records);
    duplicateIndices.forEach(idx => {
      if (!results[idx].shouldDelete) {
        results[idx].shouldDelete = true;
        results[idx].reasons.push('重复授权');
      }
    });
    
    return results;
  }
}

export default AuthChecker;

