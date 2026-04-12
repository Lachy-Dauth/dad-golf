import { Link } from "react-router-dom";
import type { AdminRound } from "../../api.js";
import { formatDate } from "../../utils/dateFormat.js";
import { StatusBadge } from "./StatusBadge.js";

export interface RoundsTabProps {
  rounds: AdminRound[];
  total: number;
  onDelete: (id: string, roomCode: string) => void;
}

export function RoundsTab({ rounds, total, onDelete }: RoundsTabProps) {
  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>
        {total} total round{total !== 1 ? "s" : ""}
      </div>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Course</th>
              <th>Leader</th>
              <th>Players</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/r/${r.roomCode}`}>{r.roomCode}</Link>
                </td>
                <td>{r.courseName}</td>
                <td>{r.leaderName ?? "-"}</td>
                <td>{r.playerCount}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{formatDate(r.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDelete(r.id, r.roomCode)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
