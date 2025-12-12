"""
授权记录管理路由
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app import models, schemas
from app.services.excel_service import ExcelService

router = APIRouter()


@router.get("/", response_model=List[schemas.AuthorizationRecordResponse])
async def get_records(
    person_name: Optional[str] = None,
    is_marked_deletion: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取授权记录列表"""
    query = db.query(models.AuthorizationRecord)
    
    if person_name:
        query = query.filter(models.AuthorizationRecord.person_name == person_name)
    if is_marked_deletion is not None:
        query = query.filter(models.AuthorizationRecord.is_marked_deletion == is_marked_deletion)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=schemas.AuthorizationRecordResponse)
async def get_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    """获取单个授权记录"""
    record = db.query(models.AuthorizationRecord).filter(
        models.AuthorizationRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.post("/upload", response_model=schemas.ExcelUploadResponse)
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传Excel文件并导入授权记录"""
    try:
        excel_service = ExcelService(db)
        result = await excel_service.import_excel(file)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.put("/{record_id}/mark-deletion")
async def mark_deletion(
    record_id: int,
    reason: str,
    db: Session = Depends(get_db)
):
    """标记记录为删除"""
    record = db.query(models.AuthorizationRecord).filter(
        models.AuthorizationRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record.is_marked_deletion = True
    record.deletion_reason = reason
    db.commit()
    return {"message": "标记成功"}


@router.put("/{record_id}/unmark-deletion")
async def unmark_deletion(
    record_id: int,
    db: Session = Depends(get_db)
):
    """取消标记删除"""
    record = db.query(models.AuthorizationRecord).filter(
        models.AuthorizationRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record.is_marked_deletion = False
    record.deletion_reason = None
    db.commit()
    return {"message": "取消标记成功"}

