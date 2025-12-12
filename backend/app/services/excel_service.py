"""
Excel处理服务
"""
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app import models, schemas


class ExcelService:
    """Excel服务类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def import_excel(self, file) -> schemas.ExcelUploadResponse:
        """导入Excel文件"""
        # 读取Excel文件
        contents = await file.read()
        excel_file = pd.ExcelFile(contents, engine='openpyxl')
        
        total_records = 0
        imported_records = 0
        
        # 遍历所有sheet页
        for sheet_name in excel_file.sheet_names:
            # 只处理"已授权主机"的sheet页
            if "已授权主机" not in sheet_name:
                continue
            
            # 从sheet名称提取人员姓名（格式：xxx已授权主机）
            person_name = sheet_name.replace("已授权主机", "").strip()
            
            # 读取sheet数据
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            # 检查必要的列是否存在
            required_columns = ["主机IP", "主机名称"]
            if not all(col in df.columns for col in required_columns):
                continue
            
            # 获取当前检查时间
            check_time = datetime.now()
            
            # 处理每一行数据
            for _, row in df.iterrows():
                total_records += 1
                
                # 跳过空行
                if pd.isna(row.get("主机IP")) or pd.isna(row.get("主机名称")):
                    continue
                
                # 创建授权记录
                record = models.AuthorizationRecord(
                    person_name=person_name,
                    host_ip=str(row.get("主机IP", "")).strip(),
                    host_name=str(row.get("主机名称", "")).strip(),
                    host_network=str(row.get("主机网络", "")).strip() if pd.notna(row.get("主机网络")) else None,
                    host_group=str(row.get("主机组", "")).strip() if pd.notna(row.get("主机组")) else None,
                    protocol=str(row.get("协议", "")).strip() if pd.notna(row.get("协议")) else None,
                    account_login_name=str(row.get("账户登录名", "")).strip() if pd.notna(row.get("账户登录名")) else None,
                    check_time=check_time,
                    is_marked_deletion=False
                )
                
                self.db.add(record)
                imported_records += 1
        
        self.db.commit()
        
        return schemas.ExcelUploadResponse(
            success=True,
            message=f"导入成功，共导入 {imported_records} 条记录",
            total_records=total_records,
            imported_records=imported_records
        )

