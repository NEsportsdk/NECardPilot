type VallectiveMarkProps = {
  className?: string;
  title?: string;
};

export default function VallectiveMark({
  className,
  title,
}: VallectiveMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      role={title ? "img" : undefined}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M139 91L256 421"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="62"
      />
      <path
        d="M373 91L256 421"
        fill="none"
        stroke="var(--vallective-mark-accent, #7867ff)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="62"
      />
    </svg>
  );
}
