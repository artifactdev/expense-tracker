type ActiveFiltersParams = {
  startDate?: string | null;
  endDate?: string | null;
  transType?: string;
  filterType?: string;
  filterOperator?: string;
  filterValue?: string;
  categories?: string[];
};

export const getActiveFilters = (params: ActiveFiltersParams) => {
  const filterDescriptions: string[] = [
    params.startDate && params.endDate
      ? `Filtering transactions from ${params.startDate} to ${params.endDate}`
      : 'Showing all transactions',
  ];

  if (params.transType) {
    filterDescriptions.push(`showing ${params.transType}`);
  }

  if (params.filterType && params.filterValue) {
    filterDescriptions.push(
      `by ${params.filterType.toLowerCase()} (${
        !params.filterOperator ? '' : params.filterOperator === 'gt' ? '> ' : '< '
      }${params.filterValue})`
    );
  }

  if (params.categories && params.categories.length) {
    filterDescriptions.push(`displaying the categories: ${params.categories.join(', ')}`);
  }

  return filterDescriptions.join(', ');
};
