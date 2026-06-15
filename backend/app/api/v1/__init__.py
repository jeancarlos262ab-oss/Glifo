from fastapi import APIRouter
from app.api.v1 import pieces, search, graph, jobs, stats, ai

api_router = APIRouter()

api_router.include_router(pieces.router)
api_router.include_router(search.router)
api_router.include_router(graph.router)
api_router.include_router(jobs.router)
api_router.include_router(stats.router)
api_router.include_router(ai.router)
