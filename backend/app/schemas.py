"""
Pydantic模型（API请求/响应模型）
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ValidationRuleBase(BaseModel):
    """校验规则基础模型"""
    rule_type: str = Field(..., description="规则类型")
    rule_key: str = Field(..., description="规则键名")
    rule_value: Dict[str, Any] = Field(..., description="规则值")
    description: Optional[str] = Field(None, description="规则描述")


class ValidationRuleCreate(ValidationRuleBase):
    """创建校验规则"""
    pass


class ValidationRuleUpdate(BaseModel):
    """更新校验规则"""
    rule_value: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


class ValidationRuleResponse(ValidationRuleBase):
    """校验规则响应"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AuthorizationRecordBase(BaseModel):
    """授权记录基础模型"""
    person_name: str
    host_ip: str
    host_name: str
    host_network: Optional[str] = None
    host_group: Optional[str] = None
    protocol: Optional[str] = None
    account_login_name: Optional[str] = None


class AuthorizationRecordCreate(AuthorizationRecordBase):
    """创建授权记录"""
    check_time: datetime


class AuthorizationRecordResponse(AuthorizationRecordBase):
    """授权记录响应"""
    id: int
    check_time: datetime
    is_marked_deletion: bool
    deletion_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CheckHistoryResponse(BaseModel):
    """检查历史响应"""
    id: int
    check_time: datetime
    total_records: int
    marked_deletions: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExcelUploadResponse(BaseModel):
    """Excel上传响应"""
    success: bool
    message: str
    total_records: int = 0
    imported_records: int = 0


class CheckRequest(BaseModel):
    """执行检查请求"""
    check_time: Optional[datetime] = None


class CheckResponse(BaseModel):
    """执行检查响应"""
    success: bool
    message: str
    total_records: int
    marked_deletions: int
    check_time: datetime

