"""
检查服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import List, Dict, Any
import re
from app import models, schemas


class CheckService:
    """检查服务类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def execute_check(self, check_time: datetime) -> schemas.CheckResponse:
        """执行检查"""
        # 获取所有规则
        rules = self._get_rules()
        
        # 获取运维人员列表
        ops_personnel = self._get_ops_personnel(rules)
        
        # 获取长时间设置（天数）
        long_time_days = self._get_long_time_days(rules)
        
        # 获取生产环境判断规则
        prod_env_patterns = self._get_prod_env_patterns(rules)
        
        # 获取主数据库IP规则
        master_db_ips = self._get_master_db_ips(rules)
        
        # 获取所有授权记录
        all_records = self.db.query(models.AuthorizationRecord).all()
        total_records = len(all_records)
        marked_deletions = 0
        
        # 1. 检查重复授权
        marked_deletions += self._check_duplicates(all_records)
        
        # 2. 检查非运维人员的长时间权限
        if long_time_days > 0:
            marked_deletions += self._check_long_time_permissions(
                all_records, ops_personnel, long_time_days, check_time
            )
        
        # 3. 检查非运维人员的生产环境权限
        marked_deletions += self._check_prod_env_permissions(
            all_records, ops_personnel, prod_env_patterns
        )
        
        # 4. 检查非运维人员的主数据库权限
        marked_deletions += self._check_master_db_permissions(
            all_records, ops_personnel, master_db_ips
        )
        
        # 保存检查历史
        history = models.CheckHistory(
            check_time=check_time,
            total_records=total_records,
            marked_deletions=marked_deletions
        )
        self.db.add(history)
        self.db.commit()
        
        return schemas.CheckResponse(
            success=True,
            message=f"检查完成，共标记 {marked_deletions} 条记录为删除",
            total_records=total_records,
            marked_deletions=marked_deletions,
            check_time=check_time
        )
    
    def _get_rules(self) -> Dict[str, List[models.ValidationRule]]:
        """获取所有规则"""
        rules = self.db.query(models.ValidationRule).all()
        rules_dict = {}
        for rule in rules:
            if rule.rule_type not in rules_dict:
                rules_dict[rule.rule_type] = []
            rules_dict[rule.rule_type].append(rule)
        return rules_dict
    
    def _get_ops_personnel(self, rules: Dict) -> List[str]:
        """获取运维人员列表"""
        ops_personnel = []
        if "ops_personnel" in rules:
            for rule in rules["ops_personnel"]:
                if isinstance(rule.rule_value, dict) and "personnel" in rule.rule_value:
                    ops_personnel.extend(rule.rule_value["personnel"])
        return list(set(ops_personnel))
    
    def _get_long_time_days(self, rules: Dict) -> int:
        """获取长时间设置（天数）"""
        if "long_time_setting" in rules:
            for rule in rules["long_time_setting"]:
                if isinstance(rule.rule_value, dict) and "days" in rule.rule_value:
                    return int(rule.rule_value["days"])
        return 0
    
    def _get_prod_env_patterns(self, rules: Dict) -> List[Dict[str, Any]]:
        """获取生产环境判断规则"""
        patterns = []
        if "prod_env_pattern" in rules:
            for rule in rules["prod_env_pattern"]:
                if isinstance(rule.rule_value, dict):
                    patterns.append(rule.rule_value)
        return patterns
    
    def _get_master_db_ips(self, rules: Dict) -> List[str]:
        """获取主数据库IP列表"""
        ips = []
        if "master_db_ips" in rules:
            for rule in rules["master_db_ips"]:
                if isinstance(rule.rule_value, dict):
                    if "single_ips" in rule.rule_value:
                        ips.extend(rule.rule_value["single_ips"])
                    if "ip_ranges" in rule.rule_value:
                        # IP范围处理
                        for ip_range in rule.rule_value["ip_ranges"]:
                            ips.extend(self._expand_ip_range(ip_range))
        return list(set(ips))
    
    def _expand_ip_range(self, ip_range: str) -> List[str]:
        """展开IP范围（简单实现，支持192.168.1.1-192.168.1.10格式）"""
        if "-" not in ip_range:
            return [ip_range]
        
        start_ip, end_ip = ip_range.split("-")
        # 这里简化处理，实际应该更完善
        return [start_ip.strip(), end_ip.strip()]
    
    def _check_duplicates(self, records: List[models.AuthorizationRecord]) -> int:
        """检查重复授权"""
        marked_count = 0
        seen = {}
        
        for record in records:
            if record.is_marked_deletion:
                continue
            
            # 创建唯一键
            key = (
                record.person_name,
                record.host_ip,
                record.host_name,
                record.protocol or "",
                record.account_login_name or ""
            )
            
            if key in seen:
                # 标记为删除
                record.is_marked_deletion = True
                record.deletion_reason = "重复授权"
                marked_count += 1
            else:
                seen[key] = record
        
        self.db.commit()
        return marked_count
    
    def _check_long_time_permissions(
        self,
        records: List[models.AuthorizationRecord],
        ops_personnel: List[str],
        long_time_days: int,
        current_time: datetime
    ) -> int:
        """检查长时间权限"""
        marked_count = 0
        cutoff_time = current_time - timedelta(days=long_time_days)
        
        for record in records:
            if record.is_marked_deletion or record.person_name in ops_personnel:
                continue
            
            if record.check_time < cutoff_time:
                record.is_marked_deletion = True
                record.deletion_reason = f"超过{long_time_days}天的长时间权限"
                marked_count += 1
        
        self.db.commit()
        return marked_count
    
    def _check_prod_env_permissions(
        self,
        records: List[models.AuthorizationRecord],
        ops_personnel: List[str],
        patterns: List[Dict[str, Any]]
    ) -> int:
        """检查生产环境权限"""
        marked_count = 0
        
        for record in records:
            if record.is_marked_deletion or record.person_name in ops_personnel:
                continue
            
            # 检查主机名称是否匹配生产环境规则
            if self._is_prod_env(record.host_name, patterns):
                record.is_marked_deletion = True
                record.deletion_reason = "非运维人员拥有生产环境权限"
                marked_count += 1
        
        self.db.commit()
        return marked_count
    
    def _is_prod_env(self, host_name: str, patterns: List[Dict[str, Any]]) -> bool:
        """判断是否生产环境"""
        for pattern in patterns:
            pattern_type = pattern.get("type", "")
            pattern_value = pattern.get("value", "")
            
            if pattern_type == "regex":
                if re.search(pattern_value, host_name):
                    return True
            elif pattern_type == "contains":
                if pattern_value in host_name:
                    return True
            elif pattern_type == "starts_with":
                if host_name.startswith(pattern_value):
                    return True
            elif pattern_type == "ends_with":
                if host_name.endswith(pattern_value):
                    return True
        
        return False
    
    def _check_master_db_permissions(
        self,
        records: List[models.AuthorizationRecord],
        ops_personnel: List[str],
        master_db_ips: List[str]
    ) -> int:
        """检查主数据库权限"""
        marked_count = 0
        
        for record in records:
            if record.is_marked_deletion or record.person_name in ops_personnel:
                continue
            
            # 检查是否是数据库协议
            if record.protocol and record.protocol.upper() in ["MYSQL", "MARIADB", "POSTGRESQL"]:
                if record.host_ip in master_db_ips:
                    record.is_marked_deletion = True
                    record.deletion_reason = "非运维人员拥有主数据库权限"
                    marked_count += 1
        
        self.db.commit()
        return marked_count

