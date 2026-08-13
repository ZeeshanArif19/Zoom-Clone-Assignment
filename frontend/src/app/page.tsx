"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInstantMeeting, scheduleMeeting, getUpcomingMeetings, getRecentMeetings, deleteMeeting } from '../lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [scheduleData, setScheduleData] = useState({ title: '', description: '', start_time: '', duration: 60 });
  const [upcoming, setUpcoming] = useState([]);
  const [recent, setRecent] = useState([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    fetchMeetings();
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMeetings = async () => {
    try {
      setUpcoming(await getUpcomingMeetings());
      setRecent(await getRecentMeetings());
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewMeeting = async () => {
    try {
      const meeting = await createInstantMeeting();
      router.push(`/meeting/${meeting.meeting_code}`);
    } catch (e) {
      alert("Failed to create meeting");
    }
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode) {
      let code = joinCode;
      if (joinCode.includes('http')) {
        const parts = joinCode.split('/meeting/');
        if (parts.length > 1) {
          code = parts[1];
        }
      }
      router.push(`/meeting/${code}`);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await scheduleMeeting({
        title: scheduleData.title,
        description: scheduleData.description,
        start_time: new Date(scheduleData.start_time).toISOString(),
        duration: Number(scheduleData.duration)
      });
      setShowSchedule(false);
      fetchMeetings();
    } catch (e) {
      alert("Failed to schedule meeting");
    }
  };

  const handleDeleteMeeting = async (meetingCode: string) => {
    if (confirm("Are you sure you want to delete this scheduled meeting?")) {
      try {
        await deleteMeeting(meetingCode);
        fetchMeetings();
      } catch (e) {
        alert("Failed to delete meeting");
      }
    }
  };

  const getMeetingTimeStatus = (startTimeStr: string) => {
    const now = new Date().getTime();
    const startTime = new Date(startTimeStr + 'Z').getTime();
    const diffMinutes = (startTime - now) / (1000 * 60);

    if (diffMinutes <= 10 && diffMinutes >= -180) {
      return { isLive: true, buttonText: 'Join Now' };
    }
    return { isLive: false, buttonText: 'Start' };
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div className="home-container">
      <div className="clock-section">
        <h1 className="clock-time">{currentTime ? formatTime(currentTime) : '--:--'}</h1>
        <p className="clock-date">{currentTime ? formatDate(currentTime) : '---'}</p>
      </div>

      <div className="action-buttons-row">
        <div className="action-button-container">
          <button className="action-btn action-btn-orange" onClick={handleNewMeeting}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 10.5V7C17 6.44772 16.5523 6 16 6H4C3.44772 6 3 6.44772 3 7V17C3 17.5523 3.44772 18 4 18H16C16.5523 18 17 17.5523 17 17V13.5L21 17.5V6.5L17 10.5Z" fill="white"/>
              <line x1="4.5" y1="4.5" x2="19.5" y2="19.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="action-label">New meeting</span>
        </div>
        
        <div className="action-button-container">
          <button className="action-btn action-btn-blue" onClick={() => setShowJoin(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="action-label">Join</span>
        </div>

        <div className="action-button-container">
          <button className="action-btn action-btn-blue" onClick={() => setShowSchedule(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="white" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="2"/>
              <text x="12" y="17" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">19</text>
            </svg>
          </button>
          <span className="action-label">Schedule</span>
        </div>
      </div>

      <div className="cards-row">
        <div className="scheduled-meetings-card">
          <h2 className="recent-activity-title">Upcoming meetings</h2>
          <div className="scheduled-content" style={{ display: 'block', padding: upcoming.length > 0 ? '0' : '40px 20px', minHeight: 'auto' }}>
            {upcoming.length === 0 ? (
              <div className="empty-state-box">
                <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 50 Q 60 20 100 50 Z" fill="#C2D3FF" />
                  <path d="M40 50 Q 60 20 80 50 Z" fill="#A0B9FF" />
                  <rect x="58" y="50" width="4" height="30" fill="#E0E0E0" />
                  <rect x="70" y="70" width="20" height="4" fill="#E0E0E0" transform="rotate(-15 70 70)" />
                  <rect x="75" y="75" width="15" height="4" fill="#E0E0E0" />
                  <ellipse cx="60" cy="85" rx="35" ry="6" fill="rgba(0, 0, 0, 0.05)" />
                </svg>
                <p>No meetings scheduled.</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcoming.map((m: any) => {
                  const status = getMeetingTimeStatus(m.start_time);
                  return (
                    <li key={m.id} style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px', color: '#111' }}>{m.title}</strong>
                          {m.description && <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 6px 0' }}>{m.description}</p>}
                          <div style={{ fontSize: '0.85rem', color: 'var(--zoom-text-light)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>📅 {new Date(m.start_time + 'Z').toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ({m.duration || 60} mins)</span>
                            <span>🆔 ID: {m.meeting_code}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          <button 
                            className="btn" 
                            style={{ 
                              padding: '6px 14px', 
                              fontSize: '0.8rem', 
                              width: 'auto',
                              backgroundColor: status.isLive ? '#22c55e' : 'var(--zoom-blue)',
                              color: 'white'
                            }} 
                            onClick={() => router.push(`/meeting/${m.meeting_code}`)}
                          >
                            {status.buttonText}
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--zoom-blue)', color: 'var(--zoom-blue)', flex: 1 }} onClick={() => {
                              const link = `${window.location.origin}/meeting/${m.meeting_code}`;
                              navigator.clipboard.writeText(link);
                              alert('Invite link copied!');
                            }}>Copy Link</button>
                            <button 
                              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer', background: '#fff0f0', border: '1px solid #ff4d4f', color: '#ff4d4f' }} 
                              onClick={() => handleDeleteMeeting(m.meeting_code)} 
                              title="Delete Meeting"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="recent-activity-card">
          <h2 className="recent-activity-title">Recent activity</h2>
          <div className="recent-activity-content" style={{ display: 'block', padding: recent.length > 0 ? '0' : '60px 20px', minHeight: 'auto' }}>
            {recent.length === 0 ? (
              <div className="empty-state-box">
                <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M60 85L30 70V40L60 55L90 40V70L60 85Z" fill="#1877F2"/>
                  <path d="M60 55L30 40L60 25L90 40L60 55Z" fill="#EBF3FF"/>
                  <path d="M30 40L25 35L55 20L60 25L30 40Z" fill="#B3D4FF"/>
                  <path d="M90 40L95 35L65 20L60 25L90 40Z" fill="#B3D4FF"/>
                  <path d="M60 55V85L30 70V40L60 55Z" fill="#0C56D0"/>
                  <path d="M60 55V85L90 70V40L60 55Z" fill="#1877F2"/>
                  
                  <path d="M28 40L45 50L45 58L28 48V40Z" fill="#0C56D0"/>
                  <path d="M92 40L75 50L75 58L92 48V40Z" fill="#094ADA"/>

                  <ellipse cx="60" cy="80" rx="40" ry="10" fill="rgba(0, 0, 0, 0.05)" style={{mixBlendMode: "multiply"}}/>
                </svg>
                <p>No recent activity</p>
              </div>
            ) : (
               <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recent.map((m: any) => (
                  <li key={m.id} style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                    <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px' }}>{m.title}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--zoom-text-light)' }}>
                      Joined: {new Date(m.created_at + 'Z').toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Join Modal */}
      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Join Meeting</h2>
            <form onSubmit={handleJoinMeeting}>
              <div className="form-group">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Meeting ID or Link" 
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">Join</button>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="modal-overlay" onClick={() => setShowSchedule(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Schedule Meeting</h2>
            <form onSubmit={handleScheduleSubmit}>
              <div className="form-group">
                <label>Topic</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={scheduleData.title}
                  onChange={e => setScheduleData({...scheduleData, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={scheduleData.description}
                  onChange={e => setScheduleData({...scheduleData, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Date &amp; Time</label>
                <input 
                  type="datetime-local" 
                  className="form-control" 
                  value={scheduleData.start_time}
                  onChange={e => setScheduleData({...scheduleData, start_time: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={scheduleData.duration}
                  onChange={e => setScheduleData({...scheduleData, duration: Number(e.target.value)})}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">Save</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
