type Props = {
  message: string;
};

export function StatusLiveRegion({ message }: Props) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
