interface Props {
  className?: string;
}

/** The cedar from the flag, simplified into a single path. */
export default function Cedar({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Cedar of Lebanon">
      <path
        fill="currentColor"
        d="M50 6 40.5 22h5.2L33.8 40.5h6.4L24.5 60h9.1L14 80h32.4v14h7.2V80H86L66.4 60h9.1L59.8 40.5h6.4L54.3 22h5.2L50 6Z"
      />
    </svg>
  );
}
