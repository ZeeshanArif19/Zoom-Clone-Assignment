from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_code = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(String, nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    duration = Column(Integer, default=60)
    is_scheduled = Column(Boolean, default=False)
    status = Column(String, default="waiting") # waiting, active, ended
    created_at = Column(DateTime, default=datetime.utcnow)
    
    participants = relationship("Participant", back_populates="meeting")

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    peer_id = Column(String, index=True)
    display_name = Column(String)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)

    meeting = relationship("Meeting", back_populates="participants")
