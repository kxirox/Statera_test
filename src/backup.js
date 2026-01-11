export function buildBackupPayload({
  expenses,
  categories,
  banks,
  accountTypes,
  people,
  recurring,
}) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      expenses,
      categories,
      banks,
      accountTypes,
      people,
      recurring,
    },
  };
}
