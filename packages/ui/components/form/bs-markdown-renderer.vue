<script>
import MarkdownIt from 'markdown-it';

// Single shared parser. HTML disabled — the input may come straight from
// an LLM output, so we treat it as untrusted and never let raw HTML through.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

export default {
  name: 'BsMarkdownRenderer',
  props: {
    source: { type: String, default: '' },
  },
  computed: {
    rendered() {
      if (!this.source) return '';
      return md.render(this.source);
    },
  },
};
</script>

<template>
  <!-- markdown-it is configured with html:false so the rendered output is
       always plain HTML produced from Markdown (no raw HTML passes through),
       which makes v-html safe here. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="bs-markdown-renderer" v-html="rendered" />
</template>

<style lang="scss" scoped>
.bs-markdown-renderer {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: rgba(0, 0, 0, 0.87);

  ::v-deep {
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 1rem 0 0.5rem;
      font-weight: 600;
    }
    h1 {
      font-size: 1.25rem;
    }
    h2 {
      font-size: 1.125rem;
    }
    h3 {
      font-size: 1rem;
    }
    p {
      margin: 0 0 0.75rem;
    }
    ul,
    ol {
      margin: 0 0 0.75rem 1.25rem;
    }
    li {
      margin-bottom: 0.25rem;
    }
    code {
      background: #f5f5f5;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      font-size: 0.85rem;
      font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    }
    pre {
      background: #f5f5f5;
      padding: 0.75rem;
      border-radius: 4px;
      overflow: auto;
      font-size: 0.8125rem;
      line-height: 1.45;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    a {
      // White-label: the brand colour must come from the theme, never a
      // literal (see issue #1002).
      color: var(--v-accent-base, #00acdc);
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
    blockquote {
      margin: 0 0 0.75rem;
      padding: 0.25rem 0.75rem;
      border-left: 3px solid rgba(0, 0, 0, 0.15);
      color: rgba(0, 0, 0, 0.65);
    }
    hr {
      border: 0;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      margin: 1rem 0;
    }
  }
}
</style>
