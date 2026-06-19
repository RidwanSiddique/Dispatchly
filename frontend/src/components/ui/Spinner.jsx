export function Spinner({ size = 'md' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeMap[size]} animate-spin rounded-full border-2 border-gray-200 border-t-blue-600`}
      />
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
    </div>
  );
}
