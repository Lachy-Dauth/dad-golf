import type { AdminGroup } from "../../api.js";
import { formatDate } from "../../utils/dateFormat.js";

export interface GroupsTabProps {
  groups: AdminGroup[];
}

export function GroupsTab({ groups }: GroupsTabProps) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Members</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td>{g.ownerName ?? "-"}</td>
              <td>{g.memberCount}</td>
              <td>{formatDate(g.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
