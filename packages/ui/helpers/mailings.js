const passThroughFilter = () => true;

// https://exploringjs.com/impatient-js/ch_sets.html#intersection-a-b
function arrayIntersection(first, second) {
  const a = new Set(first);
  const b = new Set(second);
  const intersection = new Set([...a].filter((x) => b.has(x)));
  return [...intersection];
}

function haveSameTags(first, second) {
  return arrayIntersection(first, second).length === first.length;
}

export function createFilters(filters) {
  const nameRegexp = new RegExp(filters.name, `gi`);
  const nameTest = !filters.name
    ? passThroughFilter
    : (mailing) => nameRegexp.test(mailing.name);
  const templateTest =
    filters.templates.length === 0
      ? passThroughFilter
      : (mailing) => filters.templates.includes(mailing.templateId);

  const createdStartDate = new Date(filters.createdAtStart).valueOf();
  const createdEndDate = new Date(filters.createdAtEnd).valueOf();
  const updatedStartDate = new Date(filters.updatedAtStart).valueOf();
  const updatedEndDate = new Date(filters.updatedAtEnd).valueOf();

  const createdAtStartTest = !filters.createdAtStart
    ? passThroughFilter
    : (mailing) => new Date(mailing.createdAt).valueOf() >= createdStartDate;
  const createdAtEndTest = !filters.createdAtEnd
    ? passThroughFilter
    : (mailing) => new Date(mailing.createdAt).valueOf() <= createdEndDate;
  const updatedAtStartTest = !filters.updatedAtStart
    ? passThroughFilter
    : (mailing) => new Date(mailing.updatedAt).valueOf() >= updatedStartDate;
  const updatedAtEndTest = !filters.updatedAtEnd
    ? passThroughFilter
    : (mailing) => new Date(mailing.updatedAt).valueOf() <= updatedEndDate;

  const tagsFilter =
    filters.tags.length === 0
      ? passThroughFilter
      : (mailing) => haveSameTags(filters.tags, mailing.tags);
  return (mailing) => {
    return (
      nameTest(mailing) &&
      templateTest(mailing) &&
      tagsFilter(mailing) &&
      createdAtStartTest(mailing) &&
      createdAtEndTest(mailing) &&
      updatedAtStartTest(mailing) &&
      updatedAtEndTest(mailing)
    );
  };
}
