export const parsePaginationData = (paginationsData) => {
  if (!paginationsData) {
    return;
  }
  const page = parseInt(paginationsData.page || 1);
  const itemsPerPage = parseInt(paginationsData.limit || 5);
  const pageStart = itemsPerPage * (page - 1);
  const pageStop = pageStart + itemsPerPage;
  const pageCount = parseInt(paginationsData.totalPages || 0);
  const itemsLength = parseInt(paginationsData.totalDocs || 0);
  return { page, itemsPerPage, pageStart, pageStop, pageCount, itemsLength };
};
