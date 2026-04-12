import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import type {
  Course,
  Group,
  GroupInvite,
  GroupMember,
  GroupRole,
  RoundSummary,
  ScheduledRound,
  ScheduledRoundRsvp,
} from "@dad-golf/shared";
import { useAuth } from "../AuthContext.js";
import ScheduledRoundCard from "../components/ScheduledRoundCard.js";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [groupRounds, setGroupRounds] = useState<RoundSummary[]>([]);
  const [groupRoundsTotal, setGroupRoundsTotal] = useState(0);
  const [roundsOffset, setRoundsOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Scheduled rounds state
  const [scheduledRounds, setScheduledRounds] = useState<ScheduledRound[]>([]);
  const [rsvpsByRound, setRsvpsByRound] = useState<Record<string, ScheduledRoundRsvp[]>>({});
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    courseId: "",
    scheduledDate: "",
    scheduledTime: "",
    durationMinutes: "",
    notes: "",
  });

  const myMember = user ? members.find((m) => m.userId === user.id) : null;
  const isAdmin = myMember?.role === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const load = useCallback(() => {
    if (!id) return;
    api
      .getGroup(id)
      .then((res) => {
        setGroup(res.group);
        setMembers(res.members);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const loadInvites = useCallback(() => {
    if (!id) return;
    api
      .listGroupInvites(id)
      .then((res) => setInvites(res.invites))
      .catch(() => {
        /* ignore: only admins can list invites */
      });
  }, [id]);

  const loadScheduledRounds = useCallback(() => {
    if (!id) return;
    api
      .listScheduledRounds(id)
      .then((res) => {
        setScheduledRounds(res.scheduledRounds);
        setRsvpsByRound(res.rsvps);
      })
      .catch(() => {
        /* ignore: user may not be a member */
      });
  }, [id]);

  useEffect(() => load(), [id, user?.id, load]);
  useEffect(() => {
    if (isAdmin) loadInvites();
    else setInvites([]);
  }, [isAdmin, id, loadInvites]);
  useEffect(() => {
    if (myMember) loadScheduledRounds();
  }, [myMember, loadScheduledRounds]);

  useEffect(() => {
    setGroupRounds([]);
    setGroupRoundsTotal(0);
    setRoundsOffset(0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .listGroupRounds(id, 20, roundsOffset)
      .then((res) => {
        setGroupRounds((prev) => (roundsOffset === 0 ? res.rounds : [...prev, ...res.rounds]));
        setGroupRoundsTotal(res.total);
      })
      .catch((e: Error) => setError(e.message));
  }, [id, roundsOffset]);

  async function handleRemove(memberId: string) {
    if (!id) return;
    try {
      await api.removeGroupMember(id, memberId);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleChangeRole(memberId: string, role: GroupRole) {
    if (!id) return;
    try {
      await api.updateGroupMemberRole(id, memberId, role);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCreateInvite() {
    if (!id) return;
    try {
      await api.createGroupInvite(id);
      loadInvites();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!id) return;
    if (!confirm("Revoke this invite link?")) return;
    try {
      await api.deleteGroupInvite(id, inviteId);
      loadInvites();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleOpenScheduleForm() {
    setShowScheduleForm(true);
    if (courses.length === 0) {
      try {
        const res = await api.listCourses();
        setCourses(res.courses);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }

  async function handleCreateScheduledRound() {
    if (!id) return;
    try {
      const dur = scheduleForm.durationMinutes ? Number(scheduleForm.durationMinutes) : undefined;
      await api.createScheduledRound(id, {
        courseId: scheduleForm.courseId,
        scheduledDate: scheduleForm.scheduledDate,
        scheduledTime: scheduleForm.scheduledTime || undefined,
        durationMinutes: dur,
        notes: scheduleForm.notes || undefined,
      });
      setShowScheduleForm(false);
      setScheduleForm({
        courseId: "",
        scheduledDate: "",
        scheduledTime: "",
        durationMinutes: "",
        notes: "",
      });
      loadScheduledRounds();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function inviteUrl(token: string): string {
    return `${location.origin}/groups/join/${token}`;
  }

  if (!group) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{group.name}</h1>
        <span className="badge">{members.length}</span>
      </div>
      {myMember && (
        <p className="muted">Your role: {myMember.role === "admin" ? "Admin" : "Member"}</p>
      )}

      {isAdmin && (
        <section className="section">
          <div className="section-header">
            <h2>Invite links</h2>
            <button className="btn btn-primary" onClick={handleCreateInvite}>
              + New invite
            </button>
          </div>
          <p className="muted">Share an invite link so signed-in players can join the group.</p>
          {invites.length === 0 ? (
            <div className="muted">No active invites.</div>
          ) : (
            <ul className="list">
              {invites.map((inv) => (
                <li key={inv.id}>
                  <div className="list-row">
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      <div className="list-primary mono">{inviteUrl(inv.token)}</div>
                      <div className="list-secondary">
                        Created {new Date(inv.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="row-actions">
                      <button
                        className="btn"
                        onClick={() => navigator.clipboard?.writeText(inviteUrl(inv.token))}
                      >
                        Copy
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleRevokeInvite(inv.id)}
                        aria-label="Revoke"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {myMember && (
        <section className="section">
          <div className="section-header">
            <h2>Upcoming rounds</h2>
            {isAdmin && (
              <button className="btn btn-primary" onClick={handleOpenScheduleForm}>
                + Schedule
              </button>
            )}
          </div>

          {showScheduleForm && (
            <div className="form" style={{ marginBottom: 12 }}>
              <label className="field">
                <span>Course</span>
                <select
                  value={scheduleForm.courseId}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, courseId: e.target.value }))}
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={scheduleForm.scheduledDate}
                  onChange={(e) =>
                    setScheduleForm((f) => ({ ...f, scheduledDate: e.target.value }))
                  }
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Time (optional)</span>
                  <input
                    type="time"
                    value={scheduleForm.scheduledTime}
                    onChange={(e) =>
                      setScheduleForm((f) => ({ ...f, scheduledTime: e.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Duration (optional)</span>
                  <select
                    value={scheduleForm.durationMinutes}
                    onChange={(e) =>
                      setScheduleForm((f) => ({ ...f, durationMinutes: e.target.value }))
                    }
                  >
                    <option value="">--</option>
                    <option value="120">2 hours</option>
                    <option value="150">2.5 hours</option>
                    <option value="180">3 hours</option>
                    <option value="210">3.5 hours</option>
                    <option value="240">4 hours</option>
                    <option value="270">4.5 hours</option>
                    <option value="300">5 hours</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Meet at pro shop"
                  maxLength={200}
                />
              </label>
              <div className="form-actions">
                <button className="btn" onClick={() => setShowScheduleForm(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!scheduleForm.courseId || !scheduleForm.scheduledDate}
                  onClick={handleCreateScheduledRound}
                >
                  Schedule
                </button>
              </div>
            </div>
          )}

          {scheduledRounds.length === 0 ? (
            <div className="muted">No upcoming rounds scheduled.</div>
          ) : (
            scheduledRounds.map((sr) => (
              <ScheduledRoundCard
                key={sr.id}
                scheduledRound={sr}
                rsvps={rsvpsByRound[sr.id] ?? []}
                currentUserId={user?.id ?? null}
              />
            ))
          )}
        </section>
      )}

      {error && <div className="error">{error}</div>}

      <section className="section">
        <h2>Members</h2>
        {members.length === 0 ? (
          <div className="muted">No members yet.</div>
        ) : (
          <ul className="list">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={
                  isAdmin
                    ? !(m.role === "admin" && adminCount <= 1 && m.userId === user?.id)
                    : !!user && m.userId === user.id
                }
                canChangeRole={isAdmin && m.userId !== null}
                isLastAdmin={m.role === "admin" && adminCount <= 1}
                onRemove={() => handleRemove(m.id)}
                onChangeRole={(role) => handleChangeRole(m.id, role)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Round History</h2>
        {groupRounds.length === 0 ? (
          <div className="muted">No completed rounds for this group yet.</div>
        ) : (
          <ul className="list">
            {groupRounds.map((r) => (
              <li key={r.roomCode}>
                <Link to={`/r/${r.roomCode}`} className="list-row">
                  <div>
                    <div className="list-primary">{r.courseName}</div>
                    <div className="list-secondary">
                      {new Date(r.date).toLocaleDateString()} &middot; {r.playerCount} player
                      {r.playerCount !== 1 ? "s" : ""}
                      {r.winnerName && <> &middot; Won by {r.winnerName}</>}
                    </div>
                  </div>
                  <span className="chevron">&rsaquo;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {groupRounds.length < groupRoundsTotal && (
          <div className="form-actions">
            <button className="btn" onClick={() => setRoundsOffset((o) => o + 20)}>
              Load more
            </button>
          </div>
        )}
      </section>

      <Link to="/groups" className="back-link">
        &larr; Back
      </Link>
    </div>
  );
}

function MemberRow({
  member,
  canRemove,
  canChangeRole,
  isLastAdmin,
  onRemove,
  onChangeRole,
}: {
  member: GroupMember;
  canRemove: boolean;
  canChangeRole: boolean;
  isLastAdmin: boolean;
  onRemove: () => void;
  onChangeRole: (role: GroupRole) => void;
}) {
  return (
    <li>
      <div className="list-row">
        <div>
          <div className="list-primary">
            {member.name}
            {member.role === "admin" && <span className="badge">admin</span>}
            {member.userId === null && <span className="badge">guest</span>}
          </div>
          <div className="list-secondary">GA HCP {member.handicap.toFixed(1)}</div>
        </div>
        <div className="row-actions">
          {canChangeRole && (
            <select
              value={member.role}
              onChange={(e) => onChangeRole(e.target.value as GroupRole)}
              disabled={isLastAdmin && member.role === "admin"}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {canRemove && (
            <button className="btn-icon" onClick={onRemove} aria-label="Remove">
              ✕
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
