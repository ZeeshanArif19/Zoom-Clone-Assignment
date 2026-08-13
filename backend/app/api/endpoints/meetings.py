from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.schemas.meeting import MeetingCreate, MeetingResponse
from app.services import meeting_service

router = APIRouter()

@router.post("/instant", response_model=MeetingResponse)
def create_instant_meeting(db: Session = Depends(get_db)):
    meeting_in = MeetingCreate(title="Instant Meeting", is_scheduled=False)
    return meeting_service.create_meeting(db=db, meeting=meeting_in)

@router.post("/schedule", response_model=MeetingResponse)
def schedule_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    meeting.is_scheduled = True
    return meeting_service.create_meeting(db=db, meeting=meeting)

@router.get("/upcoming", response_model=List[MeetingResponse])
def get_upcoming_meetings(db: Session = Depends(get_db)):
    return meeting_service.get_upcoming_meetings(db=db)

@router.get("/recent", response_model=List[MeetingResponse])
def get_recent_meetings(db: Session = Depends(get_db)):
    return meeting_service.get_recent_meetings(db=db)

@router.get("/{meeting_code}", response_model=MeetingResponse)
def get_meeting(meeting_code: str, db: Session = Depends(get_db)):
    db_meeting = meeting_service.get_meeting_by_code(db=db, meeting_code=meeting_code)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting
