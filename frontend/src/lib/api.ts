const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';


export const createInstantMeeting = async () => {
  const res = await fetch(`${API_BASE_URL}/meetings/instant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to create meeting');
  return res.json();
};

export const scheduleMeeting = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/meetings/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to schedule meeting');
  return res.json();
};

export const getMeeting = async (meeting_code: string) => {
  const res = await fetch(`${API_BASE_URL}/meetings/${meeting_code}`);
  if (!res.ok) throw new Error('Meeting not found');
  return res.json();
};

export const getUpcomingMeetings = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/meetings/upcoming`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.warn('Backend server is unreachable:', error);
    return [];
  }
};

export const getRecentMeetings = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/meetings/recent`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.warn('Backend server is unreachable:', error);
    return [];
  }
};

export const deleteMeeting = async (meeting_code: string) => {
  const res = await fetch(`${API_BASE_URL}/meetings/${meeting_code}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete meeting');
  return res.json();
};
