from typing import Dict, List
from fastapi import WebSocket

class RoomManager:
    def __init__(self):
        # meeting_code -> list of dicts {"peer_id": str, "display_name": str, "websocket": WebSocket}
        self.active_rooms: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket, meeting_code: str, peer_id: str, display_name: str):
        await websocket.accept()
        if meeting_code not in self.active_rooms:
            self.active_rooms[meeting_code] = []
        
        self.active_rooms[meeting_code].append({
            "peer_id": peer_id,
            "display_name": display_name,
            "websocket": websocket
        })

    def disconnect(self, websocket: WebSocket, meeting_code: str):
        if meeting_code in self.active_rooms:
            self.active_rooms[meeting_code] = [
                client for client in self.active_rooms[meeting_code] 
                if client["websocket"] != websocket
            ]
            if not self.active_rooms[meeting_code]:
                del self.active_rooms[meeting_code]

    async def broadcast_to_room(self, meeting_code: str, message: dict, exclude: WebSocket = None):
        if meeting_code in self.active_rooms:
            for client in self.active_rooms[meeting_code]:
                if client["websocket"] != exclude:
                    await client["websocket"].send_json(message)

    async def send_to_peer(self, meeting_code: str, target_peer_id: str, message: dict):
        if meeting_code in self.active_rooms:
            for client in self.active_rooms[meeting_code]:
                if client["peer_id"] == target_peer_id:
                    await client["websocket"].send_json(message)
                    break

room_manager = RoomManager()
