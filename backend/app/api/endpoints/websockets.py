from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.core.room_manager import room_manager
from app.db.database import SessionLocal
from app.db.models import Participant, Meeting
from datetime import datetime

router = APIRouter()

@router.websocket("/ws/meeting/{meeting_code}")
async def websocket_endpoint(websocket: WebSocket, meeting_code: str, peer_id: str, display_name: str):
    # Connect to room manager
    await room_manager.connect(websocket, meeting_code, peer_id, display_name)
    
    # Register participant in DB
    db = SessionLocal()
    db_participant = None
    try:
        meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
        if meeting:
            db_participant = Participant(meeting_id=meeting.id, peer_id=peer_id, display_name=display_name)
            db.add(db_participant)
            if meeting.status == "waiting":
                meeting.status = "active"
            db.commit()
            db.refresh(db_participant)
    finally:
        db.close()

    try:
        # Notify others
        await room_manager.broadcast_to_room(
            meeting_code,
            {"type": "user_joined", "peer_id": peer_id, "display_name": display_name},
            exclude=websocket
        )

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            target_id = data.get("target_id")

            # Route targeted WebRTC messages
            if msg_type in ["offer", "answer", "ice_candidate"]:
                if target_id:
                    await room_manager.send_to_peer(meeting_code, target_id, data)
            
            # Additional chat/status broadcasts can go here if needed

    except WebSocketDisconnect:
        room_manager.disconnect(websocket, meeting_code)
        
        # Notify others
        await room_manager.broadcast_to_room(
            meeting_code,
            {"type": "user_left", "peer_id": peer_id}
        )

        # Update DB
        if db_participant:
            db = SessionLocal()
            try:
                p = db.query(Participant).filter(Participant.id == db_participant.id).first()
                if p:
                    p.left_at = datetime.utcnow()
                
                # Check if room is empty
                if meeting_code not in room_manager.active_rooms or len(room_manager.active_rooms[meeting_code]) == 0:
                    meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
                    if meeting:
                        meeting.status = "ended"
                
                db.commit()
            finally:
                db.close()
