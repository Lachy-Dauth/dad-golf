import type { ActivityEvent } from "../../api.js";
import { formatDateTime } from "../../utils/dateFormat.js";

export interface ActivityTabProps {
  events: ActivityEvent[];
}

export function ActivityTab({ events }: ActivityTabProps) {
  if (events.length === 0) return <div className="muted">No activity yet.</div>;
  return (
    <div className="list">
      {events.map((e) => (
        <div key={`${e.timestamp}-${e.type}-${e.description}`} className="list-row">
          <div>
            <div className="list-primary">{e.description}</div>
            <div className="list-secondary">{formatDateTime(e.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
