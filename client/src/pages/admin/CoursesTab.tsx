import type { AdminCourse } from "../../api.js";
import { formatDate } from "../../utils/dateFormat.js";

export interface CoursesTabProps {
  courses: AdminCourse[];
}

export function CoursesTab({ courses }: CoursesTabProps) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Holes</th>
            <th>Creator</th>
            <th>Favorites</th>
            <th>Rounds</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.location ?? "-"}</td>
              <td>{c.holeCount}</td>
              <td>{c.createdByName ?? "-"}</td>
              <td>{c.favoriteCount}</td>
              <td>{c.roundCount}</td>
              <td>{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
