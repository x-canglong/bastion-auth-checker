"""
规则管理路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.ValidationRuleResponse])
async def get_rules(
    rule_type: str = None,
    db: Session = Depends(get_db)
):
    """获取规则列表"""
    query = db.query(models.ValidationRule)
    if rule_type:
        query = query.filter(models.ValidationRule.rule_type == rule_type)
    return query.all()


@router.get("/{rule_id}", response_model=schemas.ValidationRuleResponse)
async def get_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """获取单个规则"""
    rule = db.query(models.ValidationRule).filter(models.ValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@router.post("/", response_model=schemas.ValidationRuleResponse)
async def create_rule(
    rule: schemas.ValidationRuleCreate,
    db: Session = Depends(get_db)
):
    """创建规则"""
    # 检查是否已存在相同类型的规则
    existing = db.query(models.ValidationRule).filter(
        models.ValidationRule.rule_type == rule.rule_type,
        models.ValidationRule.rule_key == rule.rule_key
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="规则已存在")
    
    db_rule = models.ValidationRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.put("/{rule_id}", response_model=schemas.ValidationRuleResponse)
async def update_rule(
    rule_id: int,
    rule: schemas.ValidationRuleUpdate,
    db: Session = Depends(get_db)
):
    """更新规则"""
    db_rule = db.query(models.ValidationRule).filter(models.ValidationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    update_data = rule.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rule, key, value)
    
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """删除规则"""
    db_rule = db.query(models.ValidationRule).filter(models.ValidationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    db.delete(db_rule)
    db.commit()
    return {"message": "删除成功"}

