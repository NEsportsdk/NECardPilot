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
        d="M106 112c-4-13 3-27 16-31l42-13c13-4 27 3 31 16l80 263-36 93c-5 13-23 13-28 0L106 112Z"
        fill="currentColor"
      />
      <path
        d="M406 112c4-13-3-27-16-31l-42-13c-13-4-27 3-31 16l-80 263 36 93c5 13 23 13 28 0l105-328Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M151 116l18-6 9 29-18 6-9-29Zm201 0-18-6-9 29 18 6 9-29Z"
        fill="#6950DC"
        opacity="0.72"
      />
    </svg>
  );
}
