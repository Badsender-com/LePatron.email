// What a quality finding becomes in the comments panel: the comment's own
// severity and category, and a text the reviewer can read without the drawer.

const COMMENT_SEVERITY = {
  error: 'blocking',
  warning: 'important',
  info: 'info',
};

// Comments have three categories: design, content, general.
const COMMENT_CATEGORY = {
  content: 'content',
  copy: 'content',
  accessibility: 'design',
  performance: 'design',
  technical: 'general',
};

/**
 * The comment draft for a finding, as viewModel.createCommentFromQc takes it.
 * @param {Object} item - a row of the drawer (title, description, finding)
 * @param {Function} t - translation
 */
function commentDraftFor(item, t) {
  const { finding } = item;
  return {
    blockId: finding.blockId,
    text: `${t('Quality control')} · ${item.title} : ${item.description}`,
    severity: COMMENT_SEVERITY[finding.severity] || 'info',
    category: COMMENT_CATEGORY[finding.category] || 'general',
  };
}

module.exports = { commentDraftFor, COMMENT_SEVERITY, COMMENT_CATEGORY };
