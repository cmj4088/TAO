"""FastAPI 应用入口"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import settings, app01, app02
from app.m1_auth.router import router as auth_router

VERSION = "2.0.0"

REGISTERED_APPS = [
    {"id": "app01", "name": "监考分配", "description": "自动分配监考员，支持拖拽调整"},
    {"id": "app02", "name": "文件审查", "description": "审查教学文件格式与内容错误"},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="教务办·智能体",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router)
app.include_router(app01.router)
app.include_router(app02.router)
app.include_router(auth_router)


@app.get("/api/version")
def get_version():
    return {"version": VERSION}


@app.get("/api/apps")
def get_apps():
    return {"apps": REGISTERED_APPS}
