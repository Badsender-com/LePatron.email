export const parsePaginationData = (paginationsData) => {
  const isGettingAllData =
    parseInt(paginationsData.totalDocs || 0) ===
    parseInt(paginationsData.limit || 0);

  if (!paginationsData) {
    return;
  }
  const page = parseInt(paginationsData.page || 1);
  const itemsPerPage = !isGettingAllData
    ? parseInt(paginationsData.limit || 5)
    : -1;
  const pageStart = !isGettingAllData ? itemsPerPage * (page - 1) : 0;
  const pageStop = !isGettingAllData
    ? pageStart + itemsPerPage
    : parseInt(paginationsData.totalDocs || 0);
  const pageCount = parseInt(paginationsData.totalPages || 0);
  const itemsLength = parseInt(paginationsData.totalDocs || 0);
  return { page, itemsPerPage, pageStart, pageStop, pageCount, itemsLength };
};
