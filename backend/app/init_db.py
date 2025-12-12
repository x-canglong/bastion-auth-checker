"""
数据库初始化脚本
"""
from app.database import engine, Base
from app.models import ValidationRule, AuthorizationRecord, CheckHistory
from app.database import SessionLocal
from datetime import datetime


def init_database():
    """初始化数据库"""
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    print("数据库表创建成功")
    
    # 初始化默认规则
    init_default_rules()


def init_default_rules():
    """初始化默认规则"""
    db = SessionLocal()
    try:
        # 检查是否已有规则
        existing_rules = db.query(ValidationRule).count()
        if existing_rules > 0:
            print("规则已存在，跳过初始化")
            return
        
        # 初始化运维人员列表
        ops_personnel_rule = ValidationRule(
            rule_type="ops_personnel",
            rule_key="default",
            rule_value={"personnel": []},
            description="运维人员列表"
        )
        db.add(ops_personnel_rule)
        
        # 初始化长时间设置
        long_time_rule = ValidationRule(
            rule_type="long_time_setting",
            rule_key="default",
            rule_value={"days": 30},
            description="长时间权限设置（天数）"
        )
        db.add(long_time_rule)
        
        # 初始化生产环境判断规则
        prod_env_rule = ValidationRule(
            rule_type="prod_env_pattern",
            rule_key="contains_prd",
            rule_value={
                "type": "contains",
                "value": "prd"
            },
            description="生产环境判断：主机名包含prd"
        )
        db.add(prod_env_rule)
        
        prod_env_rule2 = ValidationRule(
            rule_type="prod_env_pattern",
            rule_key="contains_outpub",
            rule_value={
                "type": "contains",
                "value": "outpub"
            },
            description="生产环境判断：主机名包含outpub"
        )
        db.add(prod_env_rule2)
        
        # 初始化主数据库IP规则
        master_db_rule = ValidationRule(
            rule_type="master_db_ips",
            rule_key="default",
            rule_value={
                "single_ips": ["192.168.240.181", "192.168.240.156"],
                "ip_ranges": []
            },
            description="主数据库IP列表"
        )
        db.add(master_db_rule)
        
        db.commit()
        print("默认规则初始化成功")
    except Exception as e:
        db.rollback()
        print(f"初始化规则失败: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    init_database()

