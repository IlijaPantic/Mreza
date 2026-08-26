type FieldErrorProps = {
  message?: string;
};

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="mt-1 font-sans text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}
