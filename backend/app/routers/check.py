"""
检查功能路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app import models, schemas
from app.services.check_service import CheckService

router = APIRouter()


@router.post("/execute", response_model=schemas.CheckResponse)
async def execute_check(
    request: schemas.CheckRequest,
    db: Session = Depends(get_db)
):
    """执行检查"""
    try:
        check_service = CheckService(db)
        check_time = request.check_time or datetime.now()
        result = check_service.execute_check(check_time)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检查失败: {str(e)}")


@router.get("/history", response_model=List[schemas.CheckHistoryResponse])
async def get_check_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """获取检查历史"""
    return db.query(models.CheckHistory).order_by(
        models.CheckHistory.check_time.desc()
    ).offset(skip).limit(limit).all()


@router.get("/history/{history_id}", response_model=schemas.CheckHistoryResponse)
async def get_check_history_detail(
    history_id: int,
    db: Session = Depends(get_db)
):
    """获取检查历史详情"""
    history = db.query(models.CheckHistory).filter(
        models.CheckHistory.id == history_id
    ).first()
    if not history:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    return history

