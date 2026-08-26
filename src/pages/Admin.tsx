import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { onValue, push, ref, set } from 'firebase/database';

type EventItem = {
  id: string;
  name: string;
  createdAt: number;
  status: string;
  connectedUsers: number;
};

export default function Admin() {
  const navigate = useNavigate();

  const [eventName, setEventName] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    const eventsRef = ref(db, 'events');

    const unsubscribe = onValue(eventsRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setEvents([]);
        return;
      }

      const eventList: EventItem[] = Object.entries(data).map(([id, value]) => {
        const event = value as Omit<EventItem, 'id'>;

        return {
          id,
          ...event,
        };
      });

      eventList.sort((a, b) => b.createdAt - a.createdAt);

      setEvents(eventList);
    });

    return () => unsubscribe();
  }, []);

  async function createEvent() {
    const trimmedName = eventName.trim();

    if (!trimmedName) {
      setMessage('Please enter an event name.');
      return;
    }

    setCreating(true);
    setMessage('');

    try {
      const eventsRef = ref(db, 'events');
      const newEventRef = push(eventsRef);

      await set(newEventRef, {
        name: trimmedName,
        createdAt: Date.now(),
        status: 'waiting',
        connectedUsers: 0,
      });

      setMessage('✅ Event created successfully!');
      setEventName('');
    } catch (error) {
      console.error('Error creating event:', error);
      setMessage('❌ Failed to create event. Check the console.');
    } finally {
      setCreating(false);
    }
  }

  function openEvent(eventId: string) {
    navigate(`/admin/event/${eventId}`);
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">LIGHTSYNC</p>
          <h1>Organizer Dashboard</h1>
        </div>

        <button
          className="button button-secondary"
          onClick={() => navigate('/')}
        >
          Home
        </button>
      </header>

      <section className="card">
        <h2>Create an Event</h2>

        <p>
          Create an event that your audience will later join using a QR code.
        </p>

        <div className="form-group">
          <label htmlFor="eventName">Event name</label>

          <input
            id="eventName"
            type="text"
            placeholder="Example: Summer Concert"
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
            disabled={creating}
          />
        </div>

        <button
          className="button button-primary"
          onClick={createEvent}
          disabled={creating}
        >
          {creating ? 'Creating...' : 'Create Event'}
        </button>

        {message && <p className="status-message">{message}</p>}
      </section>

      <section className="events-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR EVENTS</p>
            <h2>Events</h2>
          </div>

          <span className="event-count">{events.length}</span>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <p>No events yet.</p>
            <span>Create your first LightSync event above.</span>
          </div>
        ) : (
          <div className="event-list">
            {events.map((event) => (
              <button
                key={event.id}
                className="event-item"
                onClick={() => openEvent(event.id)}
              >
                <div className="event-info">
                  <h3>{event.name}</h3>

                  <span>ID: {event.id}</span>
                </div>

                <div className="event-meta">
                  <span className="event-status">{event.status}</span>

                  <span className="event-arrow">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
