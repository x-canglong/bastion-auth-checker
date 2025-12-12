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
      }
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
   * 返回所有重复项的键值对
   */
  findDuplicates(records) {
    const seen = new Map();
    const duplicates = new Set();
    
    records.forEach((record, index) => {
      // 使用主机IP、主机名称、账户登录名作为唯一标识
      const key = `${record['主机IP'] || ''}_${record['主机名称'] || ''}_${record['账户登录名'] || ''}`;
      
      if (seen.has(key)) {
        duplicates.add(index);
        duplicates.add(seen.get(key));
      } else {
        seen.set(key, index);
      }
    });
    
    return Array.from(duplicates);
  }

  /**
   * 检查单条记录是否需要删除
   */
  shouldDelete(record, sheetName) {
    const reasons = [];
    
    // 检查是否是生产环境
    const isProd = this.isProductionHost(record['主机名称']);
    if (isProd && !this.isOpsPersonnel(sheetName)) {
      reasons.push('非运维人员拥有生产环境权限');
    }
    
    // 检查是否是主数据库
    const isMasterDb = this.isMasterDatabase(record['主机IP'], record['主机名称']);
    if (isMasterDb && !this.isOpsPersonnel(sheetName)) {
      reasons.push('非运维人员拥有主数据库权限');
    }
    
    return {
      shouldDelete: reasons.length > 0,
      reasons
    };
  }

  /**
   * 检查所有记录
   */
  checkAll(records, sheetName) {
    const results = records.map((record, index) => {
      const checkResult = this.shouldDelete(record, sheetName);
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

