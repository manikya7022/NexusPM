"""Nexus PM — Project CRUD routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

import redis_client

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    color: Optional[str] = None


@router.get("")
async def list_projects():
    return redis_client.list_projects()


@router.post("")
async def create_project(req: CreateProjectRequest):
    project = redis_client.create_project(req.name, req.description)
    return project


@router.get("/{project_id}")
async def get_project(project_id: str):
    project = redis_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}")
async def update_project(project_id: str, req: UpdateProjectRequest):
    updates = req.model_dump(exclude_none=True)
    project = redis_client.update_project(project_id, updates)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if not redis_client.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}
