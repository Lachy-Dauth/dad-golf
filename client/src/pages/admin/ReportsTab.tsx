import { Link } from "react-router-dom";
import type { AdminCourseReport } from "../../api.js";

export interface ReportsTabProps {
  reports: AdminCourseReport[];
  onDismiss: (courseId: string) => void;
}

export function ReportsTab({ reports, onDismiss }: ReportsTabProps) {
  if (reports.length === 0) return <div className="muted">No reported courses.</div>;
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Course</th>
            <th>Location</th>
            <th>Reports</th>
            <th>Reasons</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.courseId}>
              <td>
                <Link to={`/courses/${r.courseId}`}>{r.courseName}</Link>
              </td>
              <td>{r.courseLocation ?? "-"}</td>
              <td>{r.reportCount}</td>
              <td>{r.reasons.map((reason) => reason.replace(/_/g, " ")).join(", ")}</td>
              <td>
                <div className="row-actions">
                  <Link to={`/courses/${r.courseId}/edit`} className="btn btn-small">
                    Edit
                  </Link>
                  <button className="btn btn-small" onClick={() => onDismiss(r.courseId)}>
                    Dismiss
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
