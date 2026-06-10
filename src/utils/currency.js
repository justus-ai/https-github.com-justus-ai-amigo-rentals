const kesFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

export const formatKES = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return 'KES 0';
  }

  return kesFormatter.format(amount);
};