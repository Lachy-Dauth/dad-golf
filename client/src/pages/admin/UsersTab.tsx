import type { AdminUser } from "../../api.js";
import { formatDate } from "../../utils/dateFormat.js";

export interface UsersTabProps {
  users: AdminUser[];
  currentUserId: string;
  onDelete: (id: string, username: string) => void;
}

export function UsersTab({ users, currentUserId, onDelete }: UsersTabProps) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Display Name</th>
            <th>Handicap</th>
            <th>Rounds</th>
            <th>Courses</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                @{u.username}
                {u.isAdmin && (
                  <span className="badge badge-active" style={{ marginLeft: 6 }}>
                    admin
                  </span>
                )}
              </td>
              <td>{u.displayName}</td>
              <td>{u.handicap.toFixed(1)}</td>
              <td>{u.roundCount}</td>
              <td>{u.courseCount}</td>
              <td>{formatDate(u.createdAt)}</td>
              <td>
                {u.id !== currentUserId && (
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDelete(u.id, u.username)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
