"""
FastAPI主应用
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import rules, records, check
from app.database import engine, Base
from app.models import ValidationRule, AuthorizationRecord, CheckHistory
from app.init_db import init_default_rules


# 启动时创建表
def init_tables():
    """初始化数据库表"""
    Base.metadata.create_all(bind=engine)
    # 初始化默认规则
    init_default_rules()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    init_tables()
    yield
    # 关闭时执行（如果需要）


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="堡垒机授权检查系统API",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应配置具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(rules.router, prefix="/api/rules", tags=["规则管理"])
app.include_router(records.router, prefix="/api/records", tags=["授权记录"])
app.include_router(check.router, prefix="/api/check", tags=["检查功能"])


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "堡垒机授权检查系统API",
        "version": settings.VERSION
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}

