"""
数据库模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON, Index
from sqlalchemy.sql import func
from app.database import Base


class ValidationRule(Base):
    """校验规则表"""
    __tablename__ = "validation_rules"
    
    id = Column(Integer, primary_key=True, index=True, comment="主键ID")
    rule_type = Column(String(50), nullable=False, index=True, comment="规则类型: ops_personnel, long_time_setting, prod_env_pattern, master_db_ips")
    rule_key = Column(String(100), nullable=False, comment="规则键名")
    rule_value = Column(JSON, nullable=False, comment="规则值(JSON格式)")
    description = Column(Text, comment="规则描述")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    __table_args__ = (
        Index('idx_rule_type_key', 'rule_type', 'rule_key'),
    )


class AuthorizationRecord(Base):
    """授权记录表"""
    __tablename__ = "authorization_records"
    
    id = Column(Integer, primary_key=True, index=True, comment="主键ID")
    person_name = Column(String(100), nullable=False, index=True, comment="人员姓名")
    host_ip = Column(String(50), nullable=False, index=True, comment="主机IP")
    host_name = Column(String(200), nullable=False, index=True, comment="主机名称")
    host_network = Column(String(200), comment="主机网络")
    host_group = Column(String(200), comment="主机组")
    protocol = Column(String(20), comment="协议")
    account_login_name = Column(String(100), comment="账户登录名")
    check_time = Column(DateTime, nullable=False, index=True, comment="检查时间")
    is_marked_deletion = Column(Boolean, default=False, index=True, comment="是否标记删除")
    deletion_reason = Column(Text, comment="删除原因")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    __table_args__ = (
        Index('idx_person_host', 'person_name', 'host_ip', 'host_name', 'protocol', 'account_login_name'),
        Index('idx_check_time', 'check_time'),
    )


class CheckHistory(Base):
    """检查历史表"""
    __tablename__ = "check_history"
    
    id = Column(Integer, primary_key=True, index=True, comment="主键ID")
    check_time = Column(DateTime, nullable=False, index=True, comment="检查时间")
    total_records = Column(Integer, default=0, comment="总记录数")
    marked_deletions = Column(Integer, default=0, comment="标记删除数")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")

