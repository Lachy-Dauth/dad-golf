import type { BadgeDefinition } from "@dad-golf/shared";

interface BadgeIconProps {
  badge: BadgeDefinition;
  earned: boolean;
  earnedAt?: string;
}

export default function BadgeIcon({ badge, earned, earnedAt }: BadgeIconProps) {
  return (
    <div
      className="badge-item"
      title={earned ? `${badge.name}: ${badge.description}` : badge.description}
    >
      <div className={`badge-icon ${earned ? "earned" : "locked"}`}>
        {earned ? badge.icon : "?"}
      </div>
      <div className="badge-name">{badge.name}</div>
      {earned && earnedAt && (
        <div className="badge-earned-at">
          {new Date(earnedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </div>
      )}
      {!earned && <div className="badge-earned-at">{badge.description}</div>}
    </div>
  );
}
