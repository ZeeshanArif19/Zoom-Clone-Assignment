from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MeetingCreate(BaseModel):
    title: str = "Instant Meeting"
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    duration: int = 60
    is_scheduled: bool = False

class MeetingResponse(BaseModel):
    id: int
    meeting_code: str
    title: str
    description: Optional[str]
    start_time: datetime
    duration: int
    is_scheduled: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
