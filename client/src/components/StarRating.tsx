interface Props {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
}

export default function StarRating({ value, onChange, size = "md" }: Props) {
  const stars = [1, 2, 3, 4, 5];
  const interactive = !!onChange;

  return (
    <span
      className={`star-rating star-rating-${size} ${interactive ? "star-rating-interactive" : ""}`}
    >
      {stars.map((n) => (
        <span
          key={n}
          className={`star ${n <= value ? "star-filled" : "star-empty"}`}
          onClick={interactive ? () => onChange(n) : undefined}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(n);
                  }
                }
              : undefined
          }
          aria-label={interactive ? `Rate ${n} star${n > 1 ? "s" : ""}` : undefined}
        >
          {n <= value ? "\u2605" : "\u2606"}
        </span>
      ))}
    </span>
  );
}
