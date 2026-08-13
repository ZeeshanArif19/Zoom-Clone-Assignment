import uuid
from sqlalchemy.orm import Session
from app.db.models import Meeting
from app.schemas.meeting import MeetingCreate

def create_meeting(db: Session, meeting: MeetingCreate):
    meeting_code = uuid.uuid4().hex[:9] # Clean 9-char code without dashes
    db_meeting = Meeting(
        meeting_code=meeting_code,
        title=meeting.title,
        description=meeting.description,
        start_time=meeting.start_time,
        duration=meeting.duration,
        is_scheduled=meeting.is_scheduled
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

def get_meeting_by_code(db: Session, meeting_code: str):
    return db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()

def get_upcoming_meetings(db: Session):
    return db.query(Meeting).filter(Meeting.is_scheduled == True, Meeting.status != "ended").order_by(Meeting.created_at.desc()).all()

def get_recent_meetings(db: Session):
    # Return all instant (non-scheduled) meetings, newest first
    return db.query(Meeting).filter(Meeting.is_scheduled == False).order_by(Meeting.created_at.desc()).all()
